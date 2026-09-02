import {
  createIdbWorkspaceStorage,
  loadStoredWorkspace,
  retrySaveWorkspace,
  saveWorkspace,
  type WorkspaceStorage as ToolWorkspaceStorage,
} from "../../lib/workspace-storage";
import { type KeywordClusteringWorkspace, restoreWorkspace } from "./workspace";

export const KEYWORD_CLUSTERING_WORKSPACE_KEY = "keyword-clustering";

export type WorkspaceStorage = ToolWorkspaceStorage<KeywordClusteringWorkspace>;

export const keywordClusteringWorkspaceStorage =
  createIdbWorkspaceStorage<KeywordClusteringWorkspace>(
    KEYWORD_CLUSTERING_WORKSPACE_KEY,
  );

export async function loadWorkspace() {
  return loadStoredWorkspace(
    keywordClusteringWorkspaceStorage,
    restoreWorkspace,
  );
}

export { retrySaveWorkspace, saveWorkspace };
