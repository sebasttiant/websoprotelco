// @vitest-environment node
import { chmod, mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { RUNTIME_ASSET_ROOTS, serveRuntimeAsset } from "@/server/storage/assets";

/**
 * Descriptor accounting. `/proc/self/fd` turns "does this leak?" into an assertion instead of a
 * code-review opinion. Where it does not exist the checks are skipped LOUDLY rather than passing
 * vacuously, because a green test that verified nothing is worse than an absent one.
 */
const hasProcFd = existsSync("/proc/self/fd");
const testWithDescriptors = hasProcFd ? test : test.skip;
const isRoot = process.getuid?.() === 0;

let workspace: string;
let baseDirectory: string;

const IMAGE = "2026-07-26-39615f86-a97e-43e8-852a-e2d97cc6108c.webp";
const EMPTY = "2026-07-26-11111111-1111-4111-8111-111111111111.webp";
const IMAGE_BYTES = Buffer.from("RIFF____WEBPVP8 image-payload");

const req = (method = "GET", headers?: HeadersInit): Request => new Request("http://localhost/asset", { method, headers });

const serveImage = (segments: string[], request: Request = req()): Promise<Response> =>
  serveRuntimeAsset(RUNTIME_ASSET_ROOTS.UPLOADS, segments, request, baseDirectory);

async function descriptorCount(): Promise<number> {
  return (await readdir("/proc/self/fd")).length;
}

/** Descriptors are released asynchronously; settle before asserting rather than sleeping blindly. */
async function settledDescriptorCount(target: number): Promise<number> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const current = await descriptorCount();

    if (current <= target) {
      return current;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return descriptorCount();
}

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "assets-fd-"));
  baseDirectory = path.join(workspace, "public");
  await mkdir(path.join(baseDirectory, "uploads"), { recursive: true });
  await mkdir(path.join(baseDirectory, "documents"), { recursive: true });
  await writeFile(path.join(baseDirectory, "uploads", IMAGE), IMAGE_BYTES);
  await writeFile(path.join(baseDirectory, "uploads", EMPTY), "");
});

afterEach(async () => {
  await chmod(path.join(baseDirectory, "uploads", IMAGE), 0o644).catch(() => undefined);
  await rm(workspace, { recursive: true, force: true });
});

describe("descriptor lifecycle", () => {
  testWithDescriptors("a fully read response releases its descriptor", async () => {
    const baseline = await descriptorCount();
    await (await serveImage([IMAGE])).arrayBuffer();

    expect(await settledDescriptorCount(baseline)).toBeLessThanOrEqual(baseline);
  });

  testWithDescriptors("a cancelled stream releases its descriptor", async () => {
    const baseline = await descriptorCount();
    const response = await serveImage([IMAGE]);
    await response.body?.cancel();

    expect(await settledDescriptorCount(baseline)).toBeLessThanOrEqual(baseline);
  });

  testWithDescriptors("304, HEAD, 416 and 404 responses release their descriptor", async () => {
    const validator = (await serveImage([IMAGE], req("HEAD"))).headers.get("etag") ?? "";
    const baseline = await descriptorCount();

    await serveImage([IMAGE], req("GET", { "if-none-match": validator }));
    await serveImage([IMAGE], req("HEAD"));
    await serveImage([IMAGE], req("GET", { range: "bytes=99999-" }));
    await serveImage(["2026-07-26-00000000-0000-4000-8000-000000000000.webp"]);

    expect(await settledDescriptorCount(baseline)).toBeLessThanOrEqual(baseline);
  });

  // The reproduced leak: `bytes=-1` on an empty file produced { start: 0, end: -1 }, which threw
  // inside createReadStream AFTER ownership had been transferred — 503 plus one descriptor per
  // request. 40 requests made a 40-descriptor hole.
  testWithDescriptors("a repeated zero-byte Range attack leaks nothing and never returns 503", async () => {
    const baseline = await descriptorCount();
    const statuses = new Set<number>();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await serveImage([EMPTY], req("GET", { range: "bytes=-1" }));
      statuses.add(response.status);
      await response.body?.cancel();
    }

    expect([...statuses]).toEqual([416]);
    expect(await settledDescriptorCount(baseline)).toBeLessThanOrEqual(baseline);
  });

  testWithDescriptors("repeated operational failures leak nothing", async () => {
    if (isRoot) {
      return; // permission bits do not apply to root; covered by the skipped-loudly tests elsewhere.
    }

    await chmod(path.join(baseDirectory, "uploads", IMAGE), 0o000);
    const baseline = await descriptorCount();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await serveImage([IMAGE]);
      expect(response.status).toBe(503);
      await response.text();
    }

    expect(await settledDescriptorCount(baseline)).toBeLessThanOrEqual(baseline);
  });

  testWithDescriptors("a response already streaming survives deletion of the file underneath it", async () => {
    // POSIX keeps the inode alive for the open descriptor, so the in-flight download completes
    // instead of truncating, while the NEXT request correctly reports the file as gone.
    const baseline = await descriptorCount();
    const response = await serveImage([IMAGE]);
    await rm(path.join(baseDirectory, "uploads", IMAGE));

    expect(Buffer.from(await response.arrayBuffer())).toEqual(IMAGE_BYTES);
    expect((await serveImage([IMAGE])).status).toBe(404);
    expect(await settledDescriptorCount(baseline)).toBeLessThanOrEqual(baseline);
  });

  testWithDescriptors("a mid-stream failure closes the descriptor and reports a sanitized diagnostic", async () => {
    const baseline = await descriptorCount();
    const response = await serveImage([IMAGE]);
    const reader = response.body?.getReader();

    // Abort after the headers were committed: the status can no longer change, so the only
    // remaining obligation is releasing the descriptor.
    await reader?.cancel();

    expect(await settledDescriptorCount(baseline)).toBeLessThanOrEqual(baseline);
  });
});
