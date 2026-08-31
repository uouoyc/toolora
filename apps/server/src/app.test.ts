import { afterEach, describe, expect, it, vi } from "vitest";

describe("Hono app", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports that the server is healthy", async () => {
    vi.stubEnv("CORS_ORIGIN", "http://localhost:3001");

    const { app } = await import("./app");
    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });
});
