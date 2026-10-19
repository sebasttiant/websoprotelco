// @vitest-environment node
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The one branch real filesystems will not reproduce on demand: the sentinel is written, but what
 * comes back is not what went in — a short read, a silently truncating mount, a corrupted page.
 * `stat`-based probing cannot see this at all, which is why the read-back comparison exists, and
 * why it is worth proving that the comparison actually rejects.
 */
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();

  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      // Bind the real implementation BEFORE shadowing it, or the override calls itself.
      const readOriginal = handle.readFile.bind(handle);

      return Object.assign(handle, {
        readFile: async () => {
          // Hand back a truncated copy: the bytes exist, but not all of them.
          return Buffer.from(await readOriginal()).subarray(0, 4);
        },
      });
    },
  };
});

const { probeRuntimeAssetRoots } = await import("@/server/storage/assets");

let workspace: string;
let baseDirectory: string;

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "assets-readback-"));
  baseDirectory = path.join(workspace, "public");
  await mkdir(path.join(baseDirectory, "uploads"), { recursive: true });
  await mkdir(path.join(baseDirectory, "documents"), { recursive: true });
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("probe read-back verification", () => {
  test("a short read fails the probe instead of reporting healthy storage", async () => {
    const result = await probeRuntimeAssetRoots(baseDirectory);

    expect(result).toMatchObject({ ok: false, failedRoot: "uploads", code: "EPAYLOADMISMATCH" });
  });

  test("the sentinel is still removed when verification fails", async () => {
    await probeRuntimeAssetRoots(baseDirectory);

    expect(await readdir(path.join(baseDirectory, "uploads"))).toEqual([]);
  });
});
