import type {
  SerpApiCheckKeysInput,
  SerpApiCheckKeysOutput,
} from "@toolora/api/contracts/serpapi";
import {
  applyAccountChecks,
  createRunConfig,
  isEligible,
  loadSettings,
  type SerpApiSettings,
  type StorageLike,
  saveSettings,
} from "./settings";

/**
 * Loads the Key Pool, refreshes its health through the Provider, keeps the
 * checks in browser storage, and returns the immutable Run config. Shared by
 * every SerpAPI Tool's start/retry path.
 */
export async function settingsForRun(
  storage: StorageLike,
  checkKeys: (
    keys: SerpApiCheckKeysInput["keys"],
  ) => Promise<SerpApiCheckKeysOutput>,
): Promise<SerpApiSettings> {
  const saved = loadSettings(storage);
  if (saved.keys.length === 0) {
    throw new Error("请先在设置中添加 SerpAPI Key。");
  }

  let checked = saved;
  try {
    const response = await checkKeys(
      saved.keys.map(({ id, secret }) => ({ id, secret })),
    );
    checked = {
      ...saved,
      keys: applyAccountChecks(saved.keys, response.results),
    };
    saveSettings(storage, checked);
  } catch {
    throw new Error("无法检测 SerpAPI Key，请稍后重试。");
  }

  if (!checked.keys.some(isEligible)) {
    throw new Error("没有可用的 SerpAPI Key，请先检测 Key 状态。");
  }
  return createRunConfig(checked);
}
