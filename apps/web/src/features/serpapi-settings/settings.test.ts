import { describe, expect, it } from "vitest";

import {
  applyAccountChecks,
  createRunConfig,
  hasKeyHealth,
  keyPoolText,
  loadSettings,
  maskKey,
  nextRetryKey,
  normalizeKeyPool,
  resolveStorageFailure,
  SERP_API_SETTINGS_STORAGE_KEY,
  saveSettings,
  selectBatchKeys,
} from "./settings";

describe("SerpAPI Settings", () => {
  it("trims, de-duplicates, and masks Keys without exposing their secrets", () => {
    let id = 0;
    const keys = normalizeKeyPool(
      "  alpha-key  \n\nbeta-key\nalpha-key\n",
      [],
      () => `new-key-${++id}`,
    );

    expect(keys).toEqual([
      expect.objectContaining({
        id: "new-key-1",
        secret: "alpha-key",
        status: "unchecked",
      }),
      expect.objectContaining({
        id: "new-key-2",
        secret: "beta-key",
        status: "unchecked",
      }),
    ]);
    expect(maskKey("alpha-key")).toBe("alpha-k••••••key");
    expect(maskKey("abc")).toBe("••••••");
    expect(keyPoolText(keys)).toBe("alpha-key\nbeta-key");
    expect(hasKeyHealth(keys)).toBe(false);
    const firstKey = keys[0];
    expect(firstKey).toBeDefined();
    if (!firstKey) {
      return;
    }
    expect(
      hasKeyHealth([{ ...firstKey, checkedAt: "2026-08-31T00:00:00.000Z" }]),
    ).toBe(true);
  });

  it("keeps Settings in memory when storage fails and retries only its own key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const settings = {
      schemaVersion: 1 as const,
      strategy: "round-robin" as const,
      keys: [],
    };

    expect(saveSettings(storage, settings)).toEqual({ persisted: true });
    expect(loadSettings(storage)).toEqual(settings);

    const unavailableStorage = {
      ...storage,
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    };
    expect(saveSettings(unavailableStorage, settings)).toEqual({
      persisted: false,
    });
    expect(
      resolveStorageFailure("memory", unavailableStorage, settings),
    ).toEqual({
      persisted: false,
    });

    values.set(SERP_API_SETTINGS_STORAGE_KEY, "old-settings");
    expect(resolveStorageFailure("retry", storage, settings)).toEqual({
      persisted: true,
    });
    expect(values.get(SERP_API_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify(settings),
    );
  });

  it("shares an account's unusable status and keeps scheduling state immutable", () => {
    const keys = normalizeKeyPool(
      "one-key\ntwo-key\nthree-key",
      [],
      (() => {
        let id = 0;
        return () => `key-${++id}`;
      })(),
    );
    const checked = applyAccountChecks(keys, {
      "key-1": {
        accountId: "account-a",
        checkedAt: "2026-08-31T00:00:00.000Z",
        hourlyLimit: 100,
        hourlyUsed: 10,
        monthlyLimit: 1000,
        planName: "Starter",
        searchesLeft: 20,
        status: "active",
      },
      "key-2": {
        accountId: "account-a",
        checkedAt: "2026-08-31T00:00:00.000Z",
        hourlyLimit: 100,
        hourlyUsed: 100,
        monthlyLimit: 1000,
        planName: "Starter",
        searchesLeft: 20,
        status: "rate-limited",
      },
      "key-3": {
        accountId: "account-b",
        checkedAt: "2026-08-31T00:00:00.000Z",
        hourlyLimit: 100,
        hourlyUsed: 10,
        monthlyLimit: 1000,
        planName: "Starter",
        searchesLeft: 20,
        status: "active",
      },
    });
    const settings = {
      schemaVersion: 1 as const,
      strategy: "round-robin" as const,
      keys: checked,
    };

    expect(checked.slice(0, 2).map((key) => key.status)).toEqual([
      "rate-limited",
      "rate-limited",
    ]);
    expect(selectBatchKeys(settings, 3)).toEqual(["key-3", "key-3", "key-3"]);
    expect(selectBatchKeys({ ...settings, strategy: "sequential" }, 2)).toEqual(
      ["key-3", "key-3"],
    );

    const runConfig = createRunConfig(settings);
    const liveKey = settings.keys[2];
    if (liveKey) {
      liveKey.status = "invalid";
    }
    expect(runConfig.keys[2]?.status).toBe("active");
    expect(nextRetryKey(runConfig.keys, new Set(["key-3"]))).toBeNull();
  });

  it("does not persist provider error codes with browser Settings", () => {
    const keys = normalizeKeyPool("one-key", [], () => "key-1");
    const checks = {
      "key-1": {
        accountId: null,
        checkedAt: "2026-08-31T00:00:00.000Z",
        code: "INVALID_KEY",
        hourlyLimit: null,
        hourlyUsed: null,
        monthlyLimit: null,
        planName: null,
        searchesLeft: null,
        status: "invalid" as const,
      },
    };

    const checked = applyAccountChecks(keys, checks);
    expect(checked[0]).not.toHaveProperty("code");
  });

  it("round-robins across accounts before reusing an account's second Key", () => {
    const keys = normalizeKeyPool(
      "one-key\ntwo-key\nthree-key",
      [],
      (() => {
        let id = 0;
        return () => `key-${++id}`;
      })(),
    );
    const checked = applyAccountChecks(keys, {
      "key-1": {
        accountId: "account-a",
        checkedAt: "2026-08-31T00:00:00.000Z",
        hourlyLimit: 100,
        hourlyUsed: 10,
        monthlyLimit: 1000,
        planName: "Starter",
        searchesLeft: 20,
        status: "active",
      },
      "key-2": {
        accountId: "account-a",
        checkedAt: "2026-08-31T00:00:00.000Z",
        hourlyLimit: 100,
        hourlyUsed: 10,
        monthlyLimit: 1000,
        planName: "Starter",
        searchesLeft: 20,
        status: "active",
      },
      "key-3": {
        accountId: "account-b",
        checkedAt: "2026-08-31T00:00:00.000Z",
        hourlyLimit: 100,
        hourlyUsed: 10,
        monthlyLimit: 1000,
        planName: "Starter",
        searchesLeft: 20,
        status: "active",
      },
    });

    expect(
      selectBatchKeys(
        { schemaVersion: 1, strategy: "round-robin", keys: checked },
        3,
      ),
    ).toEqual(["key-1", "key-3", "key-1"]);
  });
});
