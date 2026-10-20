import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { assertIsolatedAppDirectory } from "./environment";

// The authenticated suite runs the Next server from a throwaway directory instead of the
// repository. Uploads are written to `<cwd>/data/{uploads,documents}` with no setting to redirect
// them, so running from here is what keeps every file the suite creates off the developer's real
// disk, and what lets a crashed run be cleaned up by deleting a single directory.
//
// The workspace holds only what `next dev` needs:
//   - copies of the project sources and config (so nothing the server generates lands in the repo);
//   - a symlink to the repository's node_modules (installing again would be slow and need network);
//   - real, empty data/uploads and data/documents;
//   - NO `.env*`: Next loads those from its project directory, and the development one points at
//     the Compose-only host `db`. Everything the server needs is passed explicitly instead.

const WORKSPACE_PREFIX = "websoprotelco-e2e-app-";
const REQUIRED_FILES = ["package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"] as const;
const REQUIRED_DIRECTORIES = ["src", "public"] as const;
// `public/uploads|documents` are legacy runtime locations; the server reads `data/` instead.
const SKIPPED_PUBLIC_ENTRIES: ReadonlySet<string> = new Set(["uploads", "documents"]);

export interface AppWorkspace {
  // Real path of the workspace, i.e. what `assertIsolatedAppDirectory` accepts.
  directory: string;
  // Removes the whole workspace. Safe to call repeatedly, including from a signal handler.
  dispose(): void;
}

function requireEntry(repositoryRoot: string, name: string): string {
  const source = path.join(repositoryRoot, name);

  if (!existsSync(source)) {
    throw new Error(`Cannot build the E2E app workspace: ${name} is missing from the repository.`);
  }

  return source;
}

export function createAppWorkspace(repositoryRoot: string, parentDirectory: string = tmpdir()): AppWorkspace {
  const realRepository = realpathSync(repositoryRoot);
  const sources = {
    files: REQUIRED_FILES.map((name) => [name, requireEntry(realRepository, name)] as const),
    directories: REQUIRED_DIRECTORIES.map((name) => [name, requireEntry(realRepository, name)] as const),
    nodeModules: requireEntry(realRepository, "node_modules"),
  };

  const directory = realpathSync(mkdtempSync(path.join(realpathSync(parentDirectory), WORKSPACE_PREFIX)));
  let disposed = false;

  const dispose = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    // `rmSync` unlinks a symlink instead of following it, so node_modules in the repository is
    // never touched.
    rmSync(directory, { recursive: true, force: true });
  };

  try {
    for (const [name, source] of sources.files) {
      cpSync(source, path.join(directory, name));
    }

    for (const [name, source] of sources.directories) {
      cpSync(source, path.join(directory, name), {
        recursive: true,
        filter: (entry) => !(name === "public" && SKIPPED_PUBLIC_ENTRIES.has(path.relative(source, entry))),
      });
    }

    symlinkSync(sources.nodeModules, path.join(directory, "node_modules"), "dir");
    mkdirSync(path.join(directory, "data", "uploads"), { recursive: true });
    mkdirSync(path.join(directory, "data", "documents"), { recursive: true });

    // Fail now, with the workspace removed, rather than let a misbuilt one reach the server.
    assertIsolatedAppDirectory(directory, realRepository);
  } catch (error) {
    dispose();
    throw error;
  }

  return { directory, dispose };
}
