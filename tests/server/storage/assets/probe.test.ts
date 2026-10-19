// @vitest-environment node
import { chmod, mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { probeRuntimeAssetRoots } from "@/server/storage/assets";

let workspace: string;
let baseDirectory: string;
let uploads: string;
let documents: string;

// Permission bits mean nothing to root, so those cases are skipped visibly instead of asserting
// something that cannot fail.
const isRoot = process.getuid?.() === 0;
const testUnprivileged = isRoot ? test.skip : test;

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "assets-probe-"));
  baseDirectory = path.join(workspace, "public");
  uploads = path.join(baseDirectory, "uploads");
  documents = path.join(baseDirectory, "documents");
  await mkdir(uploads, { recursive: true });
  await mkdir(documents, { recursive: true });
});

afterEach(async () => {
  await chmod(uploads, 0o755).catch(() => undefined);
  await chmod(documents, 0o755).catch(() => undefined);
  await rm(workspace, { recursive: true, force: true });
});

describe("probeRuntimeAssetRoots", () => {
  test("passes when both roots accept a full write-read-verify round trip", async () => {
    expect(await probeRuntimeAssetRoots(baseDirectory)).toEqual({ ok: true });
  });

  test("leaves no residue in either root on success", async () => {
    await probeRuntimeAssetRoots(baseDirectory);

    expect(await readdir(uploads)).toEqual([]);
    expect(await readdir(documents)).toEqual([]);
  });

  test("reports the offending root when one is missing", async () => {
    await rm(documents, { recursive: true, force: true });

    const result = await probeRuntimeAssetRoots(baseDirectory);

    expect(result.ok).toBe(false);
    expect(result.failedRoot).toBe("documents");
    expect(result.code).toBe("ENOENT");
  });

  testUnprivileged("fails with EACCES when a root is not writable", async () => {
    await chmod(uploads, 0o500);

    const result = await probeRuntimeAssetRoots(baseDirectory);

    expect(result).toMatchObject({ ok: false, failedRoot: "uploads", code: "EACCES" });
  });

  testUnprivileged("fails when a root denies traversal, so the sentinel cannot be reached", async () => {
    // Read and write bits without the execute bit: the directory exists and looks usable, but no
    // path inside it can be resolved. A `stat`-only probe would still have called this healthy.
    await chmod(uploads, 0o600);

    const result = await probeRuntimeAssetRoots(baseDirectory);

    expect(result.ok).toBe(false);
    expect(result.failedRoot).toBe("uploads");
    expect(result.code).toBe("EACCES");
  });

  testUnprivileged("leaves no residue when the probe fails partway", async () => {
    await chmod(documents, 0o500);

    expect((await probeRuntimeAssetRoots(baseDirectory)).ok).toBe(false);
    await chmod(documents, 0o755);

    // uploads was probed successfully before documents failed; neither may keep a sentinel.
    expect(await readdir(uploads)).toEqual([]);
    expect(await readdir(documents)).toEqual([]);
  });

  test("stops at the first failing root and names it", async () => {
    await rm(uploads, { recursive: true, force: true });

    const result = await probeRuntimeAssetRoots(baseDirectory);

    expect(result.failedRoot).toBe("uploads");
  });
});
