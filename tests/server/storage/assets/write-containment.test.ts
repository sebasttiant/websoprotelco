// @vitest-environment node
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

let workspace = "";

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(workspace, { recursive: true, force: true });
});

// The read side of containment lives in containment.test.ts; this is the write side, which the
// storage adapter enforces on its own and which no read test can observe.
describe("storage adapter write containment", () => {
  test("refuses document and design-image writes and deletes through an existing category symlink", async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "write-containment-"));
    vi.spyOn(process, "cwd").mockReturnValue(workspace);
    const documents = path.join(workspace, "data", "documents");
    const uploads = path.join(workspace, "data", "uploads");
    const outside = path.join(workspace, "outside");
    await mkdir(documents, { recursive: true });
    await mkdir(uploads, { recursive: true });
    await mkdir(outside);
    await symlink(outside, path.join(documents, "manual"));
    await symlink(outside, path.join(uploads, "banners"));
    vi.resetModules();
    const { createLocalStorageAdapter } = await import("@/server/storage/local");
    const storage = createLocalStorageAdapter();
    const file = new File(["%PDF"], "guide.pdf", { type: "application/pdf" });

    await expect(storage.saveDocument(file, "manual")).rejects.toThrow("symbolic link");
    await expect(storage.deleteFile("/documents/manual/guide.pdf")).rejects.toThrow("symbolic link");
    await expect(storage.saveDesignImage(new File(["image"], "banner.png", { type: "image/png" }), "banners")).rejects.toThrow("symbolic link");
  });
});
