import { afterEach, describe, expect, it, vi } from "vitest";

function generatedDomain() {
  return `${crypto.randomUUID()}.invalid`;
}

function generatedUrl(host: string, path = "/") {
  return new URL(path, `https://${host}`).toString();
}

describe("Hono app", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports that the server is healthy", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");

    const { app } = await import("./app");
    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  it("logs only the stable request fields", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const { app } = await import("./app");
    await app.request("/");

    const entry = JSON.parse(log.mock.calls[0]?.[0] ?? "{}") as Record<
      string,
      unknown
    >;
    expect(Object.keys(entry).sort()).toEqual([
      "durationMs",
      "procedure",
      "requestId",
      "status",
      "tooloraCode",
    ]);
    expect(entry).toMatchObject({
      procedure: "/",
      status: 200,
      tooloraCode: null,
    });
  });

  it("checks each submitted Key through the SerpAPI adapter with stable statuses", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            account_id: "account-a",
            account_rate_limit_per_hour: 100,
            plan_name: "Starter",
            searches_per_month: 100,
            this_hour_searches: 2,
            total_searches_left: 8,
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 401 })),
    );

    const { app } = await import("./app");
    const response = await app.request("/rpc/serpApi/checkKeys", {
      body: JSON.stringify({
        json: {
          keys: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              secret: "test-key-a",
            },
            {
              id: "00000000-0000-4000-8000-000000000002",
              secret: "test-key-b",
            },
          ],
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      json: {
        results: {
          "00000000-0000-4000-8000-000000000001": expect.objectContaining({
            accountId: "account-a",
            checkedAt: expect.any(String),
            code: null,
            hourlyLimit: 100,
            hourlyUsed: 2,
            monthlyLimit: 100,
            planName: "Starter",
            searchesLeft: 8,
            status: "active",
          }),
          "00000000-0000-4000-8000-000000000002": expect.objectContaining({
            accountId: null,
            checkedAt: expect.any(String),
            code: "INVALID_KEY",
            hourlyLimit: null,
            hourlyUsed: null,
            monthlyLimit: null,
            planName: null,
            searchesLeft: null,
            status: "invalid",
          }),
        },
      },
    });
  });

  it("maps malformed input to the public validation error", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");

    const { app } = await import("./app");
    const response = await app.request("/rpc/serpApi/checkKeys", {
      body: JSON.stringify({ json: { keys: [] } }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      json: { code: "VALIDATION_ERROR", status: 400 },
    });
  });

  it("runs a Keyword Ranking batch through fixed Google Light pagination", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");
    const targetDomain = generatedDomain();
    const otherDomain = generatedDomain();
    const firstUrl = generatedUrl(`www.${targetDomain}`, "/first");
    const laterUrl = generatedUrl(`www.${targetDomain}`, "/later");
    const secondUrl = generatedUrl(targetDomain, "/second");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          organic_results: [
            { link: laterUrl, position: 4 },
            { link: generatedUrl(otherDomain), position: 1 },
            { link: firstUrl, position: 2 },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          organic_results: [
            { link: generatedUrl(`blog.${targetDomain}`), position: 1 },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          organic_results: [
            { link: generatedUrl(otherDomain, "/again"), position: 1 },
            { link: secondUrl, position: 2 },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { app } = await import("./app");
    const response = await app.request("/rpc/keywordRanking/runBatch", {
      body: JSON.stringify({
        json: {
          country: "US",
          key: {
            id: "00000000-0000-4000-8000-000000000003",
            secret: "test-key",
          },
          keywords: [" Alpha ", "Beta"],
          language: "EN",
          searchDepth: 20,
          targetDomain: generatedUrl(
            `www.${targetDomain}`,
            "/path?ignored=true",
          ),
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      json: {
        results: [
          {
            errorCode: null,
            keyword: "alpha",
            rank: 2,
            status: "found",
            url: firstUrl,
          },
          {
            errorCode: null,
            keyword: "beta",
            rank: 12,
            status: "found",
            url: secondUrl,
          },
        ],
      },
    });
    expect(JSON.stringify(body)).not.toContain("test-key");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const secondRequest = fetchMock.mock.calls[2]?.[0] as URL;
    expect(secondRequest.searchParams.get("engine")).toBe("google_light");
    expect(secondRequest.searchParams.get("start")).toBe("10");
  });

  it("fetches clustering Evidence as raw URLs with deduplicated page identities", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          organic_results: [
            {
              link: "https://www.example.com/a?gad_campaignid=24&gad_source=1",
            },
            { link: "http://example.com/a?utm_source=google" },
            { link: "https://other.com/b?b=2&a=1" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          organic_results: [{ link: "https://shared.example/x?gclid=1" }],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { app } = await import("./app");
    const response = await app.request("/rpc/keywordClustering/fetchBatch", {
      body: JSON.stringify({
        json: {
          country: "US",
          key: {
            id: "00000000-0000-4000-8000-000000000005",
            secret: "test-key",
          },
          keywords: [" Alpha ", "Beta"],
          language: "EN",
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      json: {
        results: [
          {
            errorCode: null,
            keyword: "alpha",
            status: "evidence-ready",
            urls: [
              {
                url: "https://www.example.com/a?gad_campaignid=24&gad_source=1",
                urlIdentity: "example.com/a",
              },
              {
                url: "https://other.com/b?b=2&a=1",
                urlIdentity: "other.com/b",
              },
            ],
          },
          {
            errorCode: null,
            keyword: "beta",
            status: "evidence-ready",
            urls: [
              {
                url: "https://shared.example/x?gclid=1",
                urlIdentity: "shared.example/x",
              },
            ],
          },
        ],
      },
    });
    expect(JSON.stringify(body)).not.toContain("test-key");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const request = fetchMock.mock.calls[0]?.[0] as URL;
    expect(request.searchParams.get("engine")).toBe("google_light");
    expect(request.searchParams.get("start")).toBe("0");
  });

  it("reports successful clustering requests without valid URLs as no-evidence", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ organic_results: [] }))
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(
        Response.json({ organic_results: [{ link: "not-a-url" }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { app } = await import("./app");
    const response = await app.request("/rpc/keywordClustering/fetchBatch", {
      body: JSON.stringify({
        json: {
          country: "us",
          key: {
            id: "00000000-0000-4000-8000-000000000006",
            secret: "test-key",
          },
          keywords: ["empty", "missing", "invalid"],
          language: "en",
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      json: {
        results: [
          {
            errorCode: null,
            keyword: "empty",
            status: "no-evidence",
            urls: [],
          },
          {
            errorCode: null,
            keyword: "missing",
            status: "no-evidence",
            urls: [],
          },
          {
            errorCode: null,
            keyword: "invalid",
            status: "no-evidence",
            urls: [],
          },
        ],
      },
    });
  });

  it("returns a stable failure for the clustering failed queue", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );

    const { app } = await import("./app");
    const response = await app.request("/rpc/keywordClustering/fetchBatch", {
      body: JSON.stringify({
        json: {
          country: "us",
          key: {
            id: "00000000-0000-4000-8000-000000000007",
            secret: "test-key",
          },
          keywords: ["alpha"],
          language: "en",
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(await response.json()).toEqual({
      json: {
        failures: [
          {
            errorCode: "KEY_FORBIDDEN",
            httpStatus: 403,
            keyword: "alpha",
          },
        ],
        results: [
          {
            errorCode: "KEY_FORBIDDEN",
            fetchedAt: null,
            keyword: "alpha",
            status: "failed",
            urls: [],
          },
        ],
      },
    });
  });

  it("returns a stable failure status for the browser failed queue", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");
    const targetDomain = generatedDomain();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );

    const { app } = await import("./app");
    const response = await app.request("/rpc/keywordRanking/runBatch", {
      body: JSON.stringify({
        json: {
          country: "us",
          key: {
            id: "00000000-0000-4000-8000-000000000004",
            secret: "test-key",
          },
          keywords: ["alpha"],
          language: "en",
          searchDepth: 10,
          targetDomain,
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(await response.json()).toEqual({
      json: {
        failures: [
          {
            errorCode: "KEY_FORBIDDEN",
            httpStatus: 403,
            keyword: "alpha",
          },
        ],
        results: [
          {
            errorCode: "KEY_FORBIDDEN",
            fetchedAt: null,
            keyword: "alpha",
            rank: null,
            status: "failed",
            url: null,
          },
        ],
      },
    });
  });
});
