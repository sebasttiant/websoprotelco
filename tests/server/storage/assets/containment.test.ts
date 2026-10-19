// @vitest-environment node
import { chmod, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { RUNTIME_ASSET_ROOTS, serveRuntimeAsset } from "@/server/storage/assets";

// Real files, real descriptors, no filesystem mocking. `baseDirectory` stands in for
// `<cwd>/public`, which is the mounted volume in production.
let workspace: string;
let baseDirectory: string;
let uploads: string;
let documents: string;
let outside: string;

const IMAGE = "2026-07-26-39615f86-a97e-43e8-852a-e2d97cc6108c.webp";
const DOCUMENT = "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f_manual.pdf";
const IMAGE_BYTES = Buffer.from("RIFF____WEBPVP8 legitimate-image");
const SECRET = "EXTERNAL SECRET BYTES";

// Permission bits are meaningless to root, so those tests are skipped LOUDLY rather than passing
// vacuously. Vitest reports them as skipped in the run summary.
const isRoot = process.getuid?.() === 0;
const testUnprivileged = isRoot ? test.skip : test;

const get = (headers?: HeadersInit): Request => new Request("http://localhost/asset", { headers });

function serveImage(segments: string[], request: Request = get()): Promise<Response> {
  return serveRuntimeAsset(RUNTIME_ASSET_ROOTS.UPLOADS, segments, request, baseDirectory);
}

function serveDocument(segments: string[], request: Request = get()): Promise<Response> {
  return serveRuntimeAsset(RUNTIME_ASSET_ROOTS.DOCUMENTS, segments, request, baseDirectory);
}

/** Reads and discards the body so no response is ever abandoned with an open descriptor. */
async function bodyOf(response: Response): Promise<string> {
  return response.text();
}

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "assets-containment-"));
  baseDirectory = path.join(workspace, "public");
  outside = path.join(workspace, "outside");
  uploads = path.join(baseDirectory, "uploads");
  documents = path.join(baseDirectory, "documents");

  await mkdir(path.join(uploads, "banners"), { recursive: true });
  await mkdir(path.join(documents, "manual"), { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(outside, IMAGE), SECRET);
  await writeFile(path.join(outside, "secret.env"), SECRET);
  await writeFile(path.join(uploads, IMAGE), IMAGE_BYTES);
  await writeFile(path.join(documents, "manual", DOCUMENT), "%PDF-1.7 document");
});

afterEach(async () => {
  await chmod(uploads, 0o755).catch(() => undefined);
  await rm(workspace, { recursive: true, force: true });
});

describe("a normally mounted root", () => {
  test("serves the image it holds", async () => {
    const response = await serveImage([IMAGE]);

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(IMAGE_BYTES);
  });

  test("serves a nested document", async () => {
    const response = await serveDocument(["manual", DOCUMENT]);

    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toContain("%PDF-1.7");
  });
});

describe("root containment", () => {
  // The escape reproduced by the second review: the ROOT itself was the symlink, and anchoring on
  // realpath(root) followed it out of the volume and returned 200 with external bytes.
  test("rejects a root that is already a symlink, and returns no external bytes", async () => {
    await rm(uploads, { recursive: true });
    await symlink(outside, uploads);

    const response = await serveImage([IMAGE]);
    const body = await bodyOf(response);

    expect(response.status).toBe(503);
    expect(body).not.toContain(SECRET);
  });

  test("rejects a symlinked root even for a disallowed extension", async () => {
    await rm(uploads, { recursive: true });
    await symlink(outside, uploads);

    const response = await serveImage(["secret.env"]);

    expect(response.status).not.toBe(200);
    expect(await bodyOf(response)).not.toContain(SECRET);
  });

  test("rejects a root replaced by a symlink between requests", async () => {
    expect((await serveImage([IMAGE])).status).toBe(200);

    await rm(uploads, { recursive: true });
    await symlink(outside, uploads);

    const response = await serveImage([IMAGE]);

    expect(response.status).toBe(503);
    expect(await bodyOf(response)).not.toContain(SECRET);
  });

  test("rejects a root that is a regular file", async () => {
    await rm(uploads, { recursive: true });
    await writeFile(uploads, "not a directory");

    expect((await serveImage([IMAGE])).status).toBe(503);
  });

  test("a missing root is 503, not 404 — a lost mount is not missing content", async () => {
    await rm(documents, { recursive: true, force: true });

    expect((await serveDocument(["manual", DOCUMENT])).status).toBe(503);
  });

  testUnprivileged("an unreadable root is 503 and leaks no path", async () => {
    await chmod(uploads, 0o000);

    const response = await serveImage([IMAGE]);
    const body = await bodyOf(response);

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(body).not.toContain(workspace);
  });
});

describe("ancestor and final-file containment", () => {
  test("rejects an ancestor directory replaced by a symlink pointing outside", async () => {
    await mkdir(path.join(outside, "banners"), { recursive: true });
    await writeFile(path.join(outside, "banners", IMAGE), SECRET);
    await rm(path.join(uploads, "banners"), { recursive: true });
    await symlink(path.join(outside, "banners"), path.join(uploads, "banners"));

    const response = await serveImage(["banners", IMAGE]);

    expect(response.status).toBe(404);
    expect(await bodyOf(response)).not.toContain(SECRET);
  });

  test("rejects a final file replaced by a symlink pointing outside", async () => {
    await rm(path.join(uploads, IMAGE));
    await symlink(path.join(outside, IMAGE), path.join(uploads, IMAGE));

    const response = await serveImage([IMAGE]);

    expect(response.status).toBe(404);
    expect(await bodyOf(response)).not.toContain(SECRET);
  });

  test("rejects a symlink that was there from the start", async () => {
    await symlink(path.join(outside, IMAGE), path.join(uploads, "linked.webp"));

    expect((await serveImage(["linked.webp"])).status).toBe(404);
  });

  test.each([
    ["parent traversal", ["..", "outside", IMAGE]],
    ["deep traversal", ["..", "..", "..", "etc", "passwd.webp"]],
    ["traversal mid-path", ["banners", "..", "..", "outside", IMAGE]],
    ["decoded percent-escape", ["..%2f..%2foutside", IMAGE]],
    ["encoded dot segment", ["%2e%2e", "outside", IMAGE]],
    ["embedded separator", ["../outside/" + IMAGE]],
    ["backslash separator", ["..\\outside\\" + IMAGE]],
    ["absolute path", ["/etc/passwd.webp"]],
    ["null byte", ["image.webp\0.png"]],
    ["current directory", [".", IMAGE]],
    ["dotfile", [".env.webp"]],
    ["no segments", []],
  ])("rejects %s with 404", async (_label, segments) => {
    const response = await serveImage(segments);

    expect(response.status).toBe(404);
    expect(await bodyOf(response)).not.toContain(SECRET);
  });

  test("a directory is 404, never a listing", async () => {
    expect((await serveImage(["banners"])).status).toBe(404);
  });

  test("a document request cannot reach the uploads root", async () => {
    expect((await serveDocument(["..", "uploads", IMAGE])).status).toBe(404);
  });
});

describe("per-root file policy", () => {
  test("uploads refuses a PDF that exists", async () => {
    await writeFile(path.join(uploads, "leak.pdf"), "%PDF-1.7");

    expect((await serveImage(["leak.pdf"])).status).toBe(404);
  });

  test("documents refuses an image that exists", async () => {
    await writeFile(path.join(documents, "manual", "leak.webp"), IMAGE_BYTES);

    expect((await serveDocument(["manual", "leak.webp"])).status).toBe(404);
  });

  test.each([["config.env"], ["payload.html"], ["server.js"], ["archive.webp.gz"]])("never serves %s", async (name) => {
    await writeFile(path.join(uploads, name), "DATABASE_URL=postgres://secret");

    expect((await serveImage([name])).status).toBe(404);
  });

  test("declares the content type from the policy, never from file content", async () => {
    await writeFile(path.join(uploads, IMAGE), "%PDF-1.7 actually a document");

    const response = await serveImage([IMAGE]);
    await bodyOf(response);

    expect(response.headers.get("content-type")).toBe("image/webp");
  });
});

describe("absence", () => {
  test("a file that was never uploaded is 404 and is never cached", async () => {
    const response = await serveImage(["2026-07-26-00000000-0000-4000-8000-000000000000.webp"]);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("a deleted document is 404 on the next request", async () => {
    await rm(path.join(documents, "manual", DOCUMENT));

    expect((await serveDocument(["manual", DOCUMENT])).status).toBe(404);
  });

  testUnprivileged("an unreadable file is 503, not 404", async () => {
    await chmod(path.join(uploads, IMAGE), 0o000);

    const response = await serveImage([IMAGE]);
    await bodyOf(response);

    expect(response.status).toBe(503);
  });
});
