import { afterEach, describe, expect, it, vi } from "vitest";

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
});
