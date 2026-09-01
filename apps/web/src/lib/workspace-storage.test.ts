import { del, get, set } from "idb-keyval";
import { describe, expect, it, vi } from "vitest";
import {
  createIdbWorkspaceStorage,
  loadStoredWorkspace,
  retrySaveWorkspace,
  saveWorkspace,
} from "./workspace-storage";

vi.mock("idb-keyval", () => ({
  del: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));

type TestWorkspace = {
  name: string;
  schemaVersion: 1;
};

function makeWorkspace(): TestWorkspace {
  return { name: "current", schemaVersion: 1 };
}

describe("tool Workspace storage", () => {
  it("keeps a Workspace in memory when saving fails and retries only this Tool", async () => {
    const workspace = makeWorkspace();
    const storage = {
      del: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      set: vi
        .fn()
        .mockRejectedValueOnce(new DOMException("quota", "QuotaExceededError"))
        .mockResolvedValue(undefined),
    };

    await expect(saveWorkspace(storage, workspace)).resolves.toEqual({
      persisted: false,
    });
    await expect(retrySaveWorkspace(storage, workspace)).resolves.toEqual({
      persisted: true,
    });
    expect(storage.del).toHaveBeenCalledOnce();
  });

  it("returns null when reading or restoring throws", async () => {
    const storage = {
      del: vi.fn(),
      get: vi.fn().mockRejectedValue(new Error("indexeddb unavailable")),
      set: vi.fn(),
    };

    await expect(
      loadStoredWorkspace(storage, (raw) => {
        if (raw === null) {
          return null;
        }
        throw new Error("unparseable");
      }),
    ).resolves.toBeNull();
    await expect(loadStoredWorkspace(storage, () => null)).resolves.toBeNull();
  });

  it("restores a stored Workspace through the Tool restore hook", async () => {
    const stored = makeWorkspace();
    const storage = {
      del: vi.fn(),
      get: vi.fn().mockResolvedValue(stored),
      set: vi.fn(),
    };

    await expect(
      loadStoredWorkspace<TestWorkspace>(storage, (raw) =>
        raw?.schemaVersion === 1 ? raw : null,
      ),
    ).resolves.toEqual(stored);
    await expect(
      loadStoredWorkspace<TestWorkspace>(
        { get: vi.fn().mockResolvedValue(undefined) },
        (raw) => raw,
      ),
    ).resolves.toBeNull();
  });

  it("scopes the IndexedDB record to the Tool slug key", async () => {
    const storage = createIdbWorkspaceStorage<TestWorkspace>("some-tool");

    await storage.set(makeWorkspace());
    await storage.get();
    await storage.del();

    expect(set).toHaveBeenCalledWith("some-tool", expect.anything());
    expect(get).toHaveBeenCalledWith("some-tool");
    expect(del).toHaveBeenCalledWith("some-tool");
  });
});
