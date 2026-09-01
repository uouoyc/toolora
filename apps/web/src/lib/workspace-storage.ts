import { del, get, set } from "idb-keyval";

export type WorkspaceStorage<T> = {
  del: () => Promise<void>;
  get: () => Promise<T | undefined>;
  set: (workspace: T) => Promise<void>;
};

export function createIdbWorkspaceStorage<T>(key: string): WorkspaceStorage<T> {
  return {
    del: () => del(key),
    get: () => get<T>(key),
    set: (workspace) => set(key, workspace),
  };
}

export async function loadStoredWorkspace<T>(
  storage: Pick<WorkspaceStorage<T>, "get">,
  restore: (raw: T | null) => T | null,
) {
  try {
    return restore((await storage.get()) ?? null);
  } catch {
    return null;
  }
}

export async function saveWorkspace<T>(
  storage: Pick<WorkspaceStorage<T>, "set">,
  workspace: T,
) {
  try {
    await storage.set(workspace);
    return { persisted: true } as const;
  } catch {
    return { persisted: false } as const;
  }
}

export async function retrySaveWorkspace<T>(
  storage: Pick<WorkspaceStorage<T>, "del" | "set">,
  workspace: T,
) {
  try {
    await storage.del();
  } catch {
    return { persisted: false } as const;
  }
  return saveWorkspace(storage, workspace);
}
