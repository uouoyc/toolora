import {
  createIdbWorkspaceStorage,
  loadStoredWorkspace,
  retrySaveWorkspace,
  saveWorkspace,
  type WorkspaceStorage as ToolWorkspaceStorage,
} from "../../lib/workspace-storage";
import { type KeywordRankingWorkspace, restoreWorkspace } from "./workspace";

export const KEYWORD_RANKING_WORKSPACE_KEY = "keyword-ranking";

export type WorkspaceStorage = ToolWorkspaceStorage<KeywordRankingWorkspace>;

export const keywordRankingWorkspaceStorage =
  createIdbWorkspaceStorage<KeywordRankingWorkspace>(
    KEYWORD_RANKING_WORKSPACE_KEY,
  );

export async function loadWorkspace() {
  return loadStoredWorkspace(keywordRankingWorkspaceStorage, restoreWorkspace);
}

export { retrySaveWorkspace, saveWorkspace };
