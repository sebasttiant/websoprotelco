// @vitest-environment node
import { chmod, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { runtimeAssetRoots } from "@/server/storage/roots";
import { checkRuntimeAssetRoots, serveRuntimeAsset } from "@/server/storage/runtime-assets";
import { GET as documentGet } from "@/app/documents/[...path]/route";
import { GET as uploadGet } from "@/app/uploads/[...path]/route";

let workspace = "";

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(workspace, { recursive: true, force: true });
});

async function root(kind: "uploads" | "documents") {
  workspace = await mkdtemp(path.join(tmpdir(), "runtime-assets-"));
  vi.spyOn(process, "cwd").mockReturnValue(workspace);
  const target = runtimeAssetRoots()[kind];
  await mkdir(target, { recursive: true });
  return target;
}

describe("runtime asset reader", () => {
  test("serves an immediate image with its exact MIME and nosniff", async () => {
    const uploads = await root("uploads");
    await writeFile(path.join(uploads, "image.webp"), "image");

    const response = await serveRuntimeAsset("uploads", ["image.webp"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.text()).resolves.toBe("image");
  });

  test("serves a PDF only as an attachment", async () => {
    const documents = await root("documents");
    await mkdir(path.join(documents, "manual"));
    await writeFile(path.join(documents, "manual", "guide.pdf"), "%PDF");

    const response = await serveRuntimeAsset("documents", ["manual", "guide.pdf"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe("attachment");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("rejects invalid grammar and detectable symlinks as 404", async () => {
    const uploads = await root("uploads");
    await writeFile(path.join(workspace, "outside.webp"), "outside");
    await symlink(path.join(workspace, "outside.webp"), path.join(uploads, "link.webp"));

    await expect(serveRuntimeAsset("uploads", ["../secret.webp"])).resolves.toMatchObject({ status: 404 });
    await expect(serveRuntimeAsset("uploads", ["link.webp"])).resolves.toMatchObject({ status: 404 });
  });

  test("distinguishes a missing leaf from an unavailable root", async () => {
    await root("uploads");
    await expect(serveRuntimeAsset("uploads", ["missing.webp"])).resolves.toMatchObject({ status: 404 });
    await rm(path.join(workspace, "data", "uploads"), { recursive: true });
    await expect(serveRuntimeAsset("uploads", ["missing.webp"])).resolves.toMatchObject({ status: 503 });
  });

  test("treats a traversal-denied root as unavailable", async () => {
    const uploads = await root("uploads");
    await chmod(uploads, 0o600);

    await expect(serveRuntimeAsset("uploads", ["missing.webp"])).resolves.toMatchObject({ status: 503 });
    await chmod(uploads, 0o700);
  });

  test("requires write and search access for health roots", async () => {
    const uploads = await root("uploads");
    await mkdir(path.join(workspace, "data", "documents"), { recursive: true });
    await chmod(uploads, 0o600);

    await expect(checkRuntimeAssetRoots()).rejects.toMatchObject({ code: "EACCES" });
    await chmod(uploads, 0o700);
  });

  test("refuses document writes and deletes through an existing category symlink", async () => {
    const documents = await root("documents");
    const uploads = path.join(workspace, "data", "uploads");
    const outside = path.join(workspace, "outside");
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

  test("keeps the public URLs bound to their respective roots", async () => {
    const uploads = await root("uploads");
    const documents = path.join(workspace, "data", "documents", "manual");
    await mkdir(documents, { recursive: true });
    await writeFile(path.join(uploads, "image.webp"), "image");
    await writeFile(path.join(documents, "guide.pdf"), "%PDF");

    const params = (path: string[]) => ({ params: Promise.resolve({ path }) });
    const [image, document] = await Promise.all([
      uploadGet(new Request("http://local/uploads/image.webp"), params(["image.webp"])),
      documentGet(new Request("http://local/documents/manual/guide.pdf"), params(["manual", "guide.pdf"])),
    ]);

    expect([image.status, document.status]).toEqual([200, 200]);
  });
});
