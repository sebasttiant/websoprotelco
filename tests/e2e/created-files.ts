import { appendFileSync, existsSync, readdirSync, readFileSync, rmdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { readAuthenticatedE2eEnvironment } from "./environment";

// Uploads write to `<cwd>/data/{uploads,documents}` of the app server, and the authenticated suite
// runs that server from a throwaway workspace (tests/e2e/app-workspace.ts), so these roots are the
// workspace's, never the repository's. Every file an upload creates is still recorded the moment
// its URL is known and removed by the test itself, so the before/after state comparisons hold;
// after a crash, global teardown sweeps the ledger and the runner deletes the whole workspace.
// Only recorded files are ever deleted here; nothing is removed by directory sweep.

const RUNTIME_ROOT_PREFIXES = {
  "/uploads/": "uploads",
  "/documents/": "documents",
} as const;

function ledgerPath(runId: string): string {
  return path.join(tmpdir(), `websoprotelco-e2e-${runId}-created-files.log`);
}

// The workspace's runtime root. `readAuthenticatedE2eEnvironment` has already refused any
// directory whose data/ could be the repository's, so this can never point at the developer's disk.
export function runtimeRoot(kind: "uploads" | "documents"): string {
  return path.join(readAuthenticatedE2eEnvironment().appDirectory, "data", kind);
}

// Maps a public asset URL such as `/uploads/banners/x.webp` to its absolute path on disk,
// refusing anything that would resolve outside the runtime roots.
export function diskPathForPublicUrl(publicUrl: string): string {
  for (const [prefix, kind] of Object.entries(RUNTIME_ROOT_PREFIXES)) {
    if (publicUrl.startsWith(prefix)) {
      const root = runtimeRoot(kind as "uploads" | "documents");
      const resolved = path.resolve(root, publicUrl.slice(prefix.length));

      if (resolved.startsWith(root + path.sep)) {
        return resolved;
      }
    }
  }

  throw new Error("Upload URL does not map to a runtime asset root.");
}

function insideRuntimeRoot(resolved: string): boolean {
  return (["uploads", "documents"] as const).some((kind) => resolved.startsWith(runtimeRoot(kind) + path.sep));
}

// Removes one file and then any directory the upload created for it (e.g. `documents/manual`)
// once it is empty. The runtime roots themselves are never removed.
export function removeCreatedFile(absolutePath: string): void {
  const resolved = path.resolve(absolutePath);

  if (!insideRuntimeRoot(resolved)) {
    return;
  }

  rmSync(resolved, { force: true });

  for (let directory = path.dirname(resolved); insideRuntimeRoot(directory); directory = path.dirname(directory)) {
    if (readdirSync(directory).length > 0) {
      return;
    }

    rmdirSync(directory);
  }
}

export function recordCreatedFile(runId: string, absolutePath: string): void {
  appendFileSync(ledgerPath(runId), `${absolutePath}\n`);
}

export function removeRecordedFiles(runId: string): number {
  const ledger = ledgerPath(runId);

  if (!existsSync(ledger)) {
    return 0;
  }

  const recorded = readFileSync(ledger, "utf8").split("\n").filter(Boolean);
  let removed = 0;

  for (const absolutePath of recorded) {
    if (existsSync(absolutePath)) {
      removeCreatedFile(absolutePath);
      removed += 1;
    }
  }

  rmSync(ledger);

  return removed;
}
