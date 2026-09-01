import { del, get, set } from "idb-keyval";

import { type KeywordRankingWorkspace, restoreWorkspace } from "./workspace";

export const KEYWORD_RANKING_WORKSPACE_KEY = "keyword-ranking";

export type WorkspaceStorage = {
  del: () => Promise<void>;
  get: () => Promise<KeywordRankingWorkspace | undefined>;
  set: (workspace: KeywordRankingWorkspace) => Promise<void>;
};

const browserStorage: WorkspaceStorage = {
  del: () => del(KEYWORD_RANKING_WORKSPACE_KEY),
  get: () => get<KeywordRankingWorkspace>(KEYWORD_RANKING_WORKSPACE_KEY),
  set: (workspace) => set(KEYWORD_RANKING_WORKSPACE_KEY, workspace),
};

export async function loadWorkspace() {
  try {
    return restoreWorkspace((await browserStorage.get()) ?? null);
  } catch {
    return null;
  }
}

export async function saveWorkspace(
  storage: Pick<WorkspaceStorage, "set">,
  workspace: KeywordRankingWorkspace,
) {
  try {
    await storage.set(workspace);
    return { persisted: true } as const;
  } catch {
    return { persisted: false } as const;
  }
}

export async function retrySaveWorkspace(
  storage: Pick<WorkspaceStorage, "del" | "set">,
  workspace: KeywordRankingWorkspace,
) {
  try {
    await storage.del();
  } catch {
    return { persisted: false } as const;
  }
  return saveWorkspace(storage, workspace);
}

export const keywordRankingWorkspaceStorage = browserStorage;
