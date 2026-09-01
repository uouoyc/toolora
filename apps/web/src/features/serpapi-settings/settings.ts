import type { KeyStatus } from "@toolora/api/contracts/serpapi";

export type { KeyStatus };

export type SerpApiKeyEntry = {
  id: string;
  secret: string;
  status: KeyStatus;
  accountId: string | null;
  searchesLeft: number | null;
  hourlyUsed: number | null;
  hourlyLimit: number | null;
  checkedAt: string | null;
  monthlyLimit: number | null;
  planName: string | null;
};

export type SerpApiSettings = {
  schemaVersion: 1;
  strategy: "round-robin" | "sequential";
  keys: SerpApiKeyEntry[];
};

export type KeyCheck = Omit<SerpApiKeyEntry, "id" | "secret">;

export type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const SERP_API_SETTINGS_STORAGE_KEY = "toolora:serpapi-settings";

export const SERP_API_SETTINGS_CHANGED_EVENT =
  "toolora:serpapi-settings-changed";

export function createEmptySettings(): SerpApiSettings {
  return { schemaVersion: 1, strategy: "round-robin", keys: [] };
}

export function maskKey(secret: string) {
  if (secret.length <= 3) {
    return "••••••";
  }
  if (secret.length <= 8) {
    return `${secret.slice(0, 3)}••••••`;
  }
  return `${secret.slice(0, 7)}••••••${secret.slice(-3)}`;
}

export function keyPoolText(keys: SerpApiKeyEntry[]) {
  return keys.map((key) => key.secret).join("\n");
}

export function hasKeyHealth(keys: SerpApiKeyEntry[]) {
  return keys.some((key) => key.checkedAt !== null);
}

export function normalizeKeyPool(
  value: string,
  current: SerpApiKeyEntry[],
  createId: () => string,
) {
  const existing = new Map(current.map((key) => [key.secret, key]));
  const seen = new Set<string>();

  return value
    .split(/\r?\n/)
    .map((secret) => secret.trim())
    .filter(
      (secret) => secret && !seen.has(secret) && Boolean(seen.add(secret)),
    )
    .map(
      (secret): SerpApiKeyEntry =>
        existing.get(secret) ?? {
          id: createId(),
          secret,
          status: "unchecked",
          accountId: null,
          searchesLeft: null,
          hourlyUsed: null,
          hourlyLimit: null,
          checkedAt: null,
          monthlyLimit: null,
          planName: null,
        },
    );
}

export function loadSettings(storage: StorageLike): SerpApiSettings {
  try {
    const value = storage.getItem(SERP_API_SETTINGS_STORAGE_KEY);
    if (!value) {
      return createEmptySettings();
    }

    const settings = JSON.parse(value) as SerpApiSettings;
    return settings.schemaVersion === 1 && Array.isArray(settings.keys)
      ? settings
      : createEmptySettings();
  } catch {
    return createEmptySettings();
  }
}

export function saveSettings(storage: StorageLike, settings: SerpApiSettings) {
  try {
    storage.setItem(SERP_API_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return { persisted: true } as const;
  } catch {
    return { persisted: false } as const;
  }
}

export function resolveStorageFailure(
  choice: "memory" | "retry",
  storage: StorageLike,
  settings: SerpApiSettings,
) {
  if (choice === "memory") {
    return { persisted: false } as const;
  }

  try {
    storage.removeItem(SERP_API_SETTINGS_STORAGE_KEY);
  } catch {
    return { persisted: false } as const;
  }

  return saveSettings(storage, settings);
}

/** A Key may serve a Run only after a health check marked it active (or unknown). */
export function isEligible(key: SerpApiKeyEntry) {
  return key.status === "active" || key.status === "unknown";
}

export function applyAccountChecks(
  keys: SerpApiKeyEntry[],
  checks: Record<string, KeyCheck>,
) {
  const checked = keys.map((key) => {
    const check = checks[key.id];
    return check
      ? {
          ...key,
          accountId: check.accountId,
          checkedAt: check.checkedAt,
          hourlyLimit: check.hourlyLimit,
          hourlyUsed: check.hourlyUsed,
          monthlyLimit: check.monthlyLimit,
          planName: check.planName,
          searchesLeft: check.searchesLeft,
          status: check.status,
        }
      : key;
  });
  const unavailableByAccount = new Map<string, SerpApiKeyEntry>();

  for (const key of checked) {
    if (key.accountId && !isEligible(key)) {
      unavailableByAccount.set(key.accountId, key);
    }
  }

  return checked.map((key) => {
    const shared = key.accountId
      ? unavailableByAccount.get(key.accountId)
      : undefined;
    return shared ? { ...key, ...shared, id: key.id, secret: key.secret } : key;
  });
}

export function createRunConfig(settings: SerpApiSettings) {
  return structuredClone(settings);
}

export function selectBatchKeys(settings: SerpApiSettings, batchCount: number) {
  const eligible = settings.keys.filter(isEligible);
  const candidates = settings.strategy === "round-robin" ? [] : eligible;
  if (settings.strategy === "round-robin") {
    const firstKeyByAccount = new Map<string, SerpApiKeyEntry>();
    for (const key of eligible) {
      const account = key.accountId ?? key.id;
      if (!firstKeyByAccount.has(account)) {
        firstKeyByAccount.set(account, key);
      }
    }
    candidates.push(...firstKeyByAccount.values());
  }
  const first = candidates[0];
  if (!first) {
    return [];
  }

  return Array.from(
    { length: batchCount },
    (_, index) =>
      (settings.strategy === "round-robin"
        ? (candidates[index % candidates.length] ?? first)
        : first
      ).id,
  );
}

export function nextRetryKey(
  keys: SerpApiKeyEntry[],
  attemptedIds: ReadonlySet<string>,
) {
  return (
    keys.find((key) => isEligible(key) && !attemptedIds.has(key.id)) ?? null
  );
}
