// Deterministic typecheck that never writes to a tracked file.
//
// `next typegen` regenerates `next-env.d.ts` in whatever directory it treats as the project root,
// and it bakes the active `distDir` into that file's `import "./<distDir>/types/routes.d.ts"`
// line. Running it in the repository root therefore rewrites a tracked file, and the bytes it
// writes depend on which command ran last: `next dev`/`next build` produce `./.next/...` while an
// isolated typecheck produces its own path. The tracked file flaps forever.
//
// So typegen runs in a disposable project root instead: `.next-typecheck/`, gitignored, rebuilt
// from scratch on every run and removed afterwards. Its `src` and `node_modules` are symlinks
// back to the repository, so Next sees the real routes while every file it generates — including
// its own `next-env.d.ts` — lands inside the disposable directory.
//
// The workspace lives inside the repository rather than in the OS temp directory on purpose:
// Next writes `typeof import("../../src/app/…")` into the generated route validator, so those
// paths only resolve from a root that has `src` beside the generated types. Keeping the
// workspace at a fixed in-repo path also lets `tsconfig.json` include the result
// (`.next-typecheck/.next/types/**/*.ts`) without any per-run rewriting.
//
// This also isolates the run from a concurrently running `next dev`, which writes its own
// transient validator bytes into `.next/dev`. That directory is excluded from the program, so a
// half-written dev artifact can never fail or mask a CI typecheck.
import { cp, mkdir, rm, symlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const workspace = join(root, ".next-typecheck");

// Files Next needs to recognise the workspace as a Next project. Copies, not symlinks: typegen
// may rewrite `tsconfig.json`, and that rewrite must land on a disposable copy.
const PROJECT_FILES = ["next.config.ts", "tsconfig.json", "package.json"];

// Directories Next must see through to reach the real sources.
const LINKED_DIRS = ["src", "node_modules", "public"];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function createWorkspace() {
  await rm(workspace, { recursive: true, force: true });
  await mkdir(workspace, { recursive: true });
  await Promise.all([
    ...PROJECT_FILES.map((file) => cp(join(root, file), join(workspace, file))),
    ...LINKED_DIRS.map((dir) => symlink(join(root, dir), join(workspace, dir), "dir")),
  ]);
}

try {
  await createWorkspace();

  const typegen = await run(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "typegen"], {
    cwd: workspace,
  });

  process.exitCode =
    typegen === 0 ? await run(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--noEmit"], { cwd: root }) : 1;
} finally {
  // Only ever removes the directory this script created.
  await rm(workspace, { recursive: true, force: true });
}
