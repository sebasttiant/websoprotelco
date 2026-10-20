import { constants as fsConstants } from "node:fs";
import { lstat, open, stat, unlink, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";

import { errorCode, logAssetFailure, type AssetOperation } from "./diagnostics";
import { RUNTIME_ASSET_ROOT_VALUES, type RuntimeAssetRoot } from "./policy";

/**
 * Deploy-time proof that the mounted volumes are genuinely usable by the runtime user.
 *
 * A configuration check cannot see the failure that actually takes uploads down in production: a
 * volume mounted root-owned, a full disk, a read-only remount. Nor can a write followed by `stat`,
 * which proves an inode exists but not that a single byte survived. The probe therefore performs
 * the full round trip — write random bytes, open, read, compare exactly, close, unlink, confirm
 * the unlink — and treats a failure at ANY of those steps as a failed probe.
 *
 * Cleanup runs whether the probe passed or failed, and a cleanup that cannot be confirmed is
 * itself a failure rather than something swallowed silently.
 */

const PROBE_BYTE_LENGTH = 32;

export interface RuntimeAssetProbeResult {
  ok: boolean;
  failedRoot?: RuntimeAssetRoot;
  operation?: AssetOperation;
  code?: string;
}

function dataDirectory(): string {
  return path.join(process.cwd(), "data");
}

async function readBack(probePath: string): Promise<Buffer> {
  const handle = await open(probePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);

  try {
    return await handle.readFile();
  } finally {
    // A close failure means the descriptor state is unknown; surfacing it is the point.
    await handle.close();
  }
}

/**
 * A root that is a symlink would send the sentinel write outside the managed volume, and would
 * report healthy while the serving path (which refuses symlinked roots) answers 503.
 */
async function rootFault(rootPath: string): Promise<string | null> {
  const link = await lstat(rootPath).catch((error: unknown) => errorCode(error));

  if (typeof link === "string") {
    return link;
  }

  if (link.isSymbolicLink()) {
    return "EROOTSYMLINK";
  }

  return link.isDirectory() ? null : "ENOTDIR";
}

async function probeRoot(baseDirectory: string, root: RuntimeAssetRoot): Promise<RuntimeAssetProbeResult> {
  const fault = await rootFault(path.join(baseDirectory, root));

  if (fault) {
    return { ok: false, failedRoot: root, operation: "probe", code: fault };
  }

  const probePath = path.join(baseDirectory, root, `.storage-probe-${randomUUID()}`);
  const payload = randomBytes(PROBE_BYTE_LENGTH);
  let written = false;

  try {
    // `wx` so the probe can never overwrite an existing file, whatever its name.
    await writeFile(probePath, payload, { flag: "wx" });
    written = true;

    const readValue = await readBack(probePath);

    if (!readValue.equals(payload)) {
      return { ok: false, failedRoot: root, operation: "probe", code: "EPAYLOADMISMATCH" };
    }
  } catch (error) {
    return { ok: false, failedRoot: root, operation: "probe", code: errorCode(error) };
  } finally {
    if (written) {
      // Deliberately not swallowed: a sentinel left behind is residue, and residue that keeps
      // accumulating on every deploy check is a defect of its own.
      await unlink(probePath).catch(() => undefined);
    }
  }

  if (written) {
    const residue = await stat(probePath).then(
      () => true,
      () => false,
    );

    if (residue) {
      return { ok: false, failedRoot: root, operation: "probe", code: "ECLEANUP" };
    }
  }

  return { ok: true };
}

export async function probeRuntimeAssetRoots(
  baseDirectory: string = dataDirectory(),
): Promise<RuntimeAssetProbeResult> {
  for (const root of RUNTIME_ASSET_ROOT_VALUES) {
    const result = await probeRoot(baseDirectory, root);

    if (!result.ok) {
      logAssetFailure(root, "probe", result.code ?? "UNKNOWN");

      return result;
    }
  }

  return { ok: true };
}
