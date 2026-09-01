import { describe, expect, it, vi } from "vitest";
import { settingsForRun } from "./run-settings";
import { type SerpApiKeyEntry, saveSettings } from "./settings";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function uncheckedKey(id: string, secret: string): SerpApiKeyEntry {
  return {
    id,
    secret,
    status: "unchecked",
    accountId: null,
    searchesLeft: null,
    hourlyUsed: null,
    hourlyLimit: null,
    checkedAt: null,
    monthlyLimit: null,
    planName: null,
  };
}

const KEY_A = "00000000-0000-4000-8000-000000000001";
const KEY_B = "00000000-0000-4000-8000-000000000002";

describe("SerpAPI run settings", () => {
  it("refuses to start a Run before any Key is saved", async () => {
    const storage = memoryStorage();
    const checkKeys = vi.fn();

    await expect(settingsForRun(storage, checkKeys)).rejects.toThrow(
      "请先在设置中添加 SerpAPI Key。",
    );
    expect(checkKeys).not.toHaveBeenCalled();
  });

  it("health-checks the pool, persists the checks, and returns the run config", async () => {
    const storage = memoryStorage();
    saveSettings(storage, {
      schemaVersion: 1,
      strategy: "round-robin",
      keys: [uncheckedKey(KEY_A, "secret-a"), uncheckedKey(KEY_B, "secret-b")],
    });
    const checkedAt = "2026-09-01T00:00:00.000Z";
    const checkKeys = vi.fn().mockResolvedValue({
      results: {
        [KEY_A]: {
          accountId: "account-a",
          checkedAt,
          code: null,
          hourlyLimit: 100,
          hourlyUsed: 1,
          monthlyLimit: 100,
          planName: "Starter",
          searchesLeft: 99,
          status: "active",
        },
        [KEY_B]: {
          accountId: null,
          checkedAt,
          code: "INVALID_KEY",
          hourlyLimit: null,
          hourlyUsed: null,
          monthlyLimit: null,
          planName: null,
          searchesLeft: null,
          status: "invalid",
        },
      },
    });

    const settings = await settingsForRun(storage, checkKeys);

    expect(checkKeys).toHaveBeenCalledWith([
      { id: KEY_A, secret: "secret-a" },
      { id: KEY_B, secret: "secret-b" },
    ]);
    expect(settings.strategy).toBe("round-robin");
    expect(settings.keys.map((key) => key.status)).toEqual([
      "active",
      "invalid",
    ]);
  });

  it("rejects when the health check itself fails", async () => {
    const storage = memoryStorage();
    saveSettings(storage, {
      schemaVersion: 1,
      strategy: "round-robin",
      keys: [uncheckedKey(KEY_A, "secret-a")],
    });
    const checkKeys = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(settingsForRun(storage, checkKeys)).rejects.toThrow(
      "无法检测 SerpAPI Key，请稍后重试。",
    );
  });

  it("rejects when no checked Key is eligible", async () => {
    const storage = memoryStorage();
    saveSettings(storage, {
      schemaVersion: 1,
      strategy: "round-robin",
      keys: [uncheckedKey(KEY_A, "secret-a")],
    });
    const checkedAt = "2026-09-01T00:00:00.000Z";
    const checkKeys = vi.fn().mockResolvedValue({
      results: {
        [KEY_A]: {
          accountId: null,
          checkedAt,
          code: "INVALID_KEY",
          hourlyLimit: null,
          hourlyUsed: null,
          monthlyLimit: null,
          planName: null,
          searchesLeft: null,
          status: "invalid",
        },
      },
    });

    await expect(settingsForRun(storage, checkKeys)).rejects.toThrow(
      "没有可用的 SerpAPI Key，请先检测 Key 状态。",
    );
  });
});
