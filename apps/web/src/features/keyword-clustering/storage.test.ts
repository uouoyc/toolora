import { describe, expect, it, vi } from "vitest";
import { retrySaveWorkspace, saveWorkspace } from "./storage";
import { createWorkspace } from "./workspace";

describe("Keyword Clustering Workspace storage", () => {
  it("keeps a Workspace in memory when IndexedDB fails and retries only this Tool", async () => {
    const workspace = createWorkspace({
      country: "us",
      keywords: ["alpha"],
      language: "en",
    });
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
});
