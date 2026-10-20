// @vitest-environment node
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createAppWorkspace } from "./app-workspace";
import { assertIsolatedAppDirectory } from "./environment";

let sandbox = "";
let repository = "";

// Every file and directory under `root` with a content hash, so "unchanged" means path-for-path
// and byte-for-byte rather than "the same number of entries".
function snapshotTree(root: string): string[] {
  return readdirSync(root, { withFileTypes: true, recursive: true })
    .map((entry) => {
      const absolute = path.join(entry.parentPath, entry.name);
      const relative = path.relative(root, absolute);

      return entry.isFile()
        ? `${relative}:${createHash("sha256").update(readFileSync(absolute)).digest("hex")}`
        : `${relative}/`;
    })
    .sort();
}

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(path.join(tmpdir(), "app-workspace-test-")));
  repository = path.join(sandbox, "repo");

  mkdirSync(path.join(repository, "src", "app"), { recursive: true });
  mkdirSync(path.join(repository, "public", "assets"), { recursive: true });
  mkdirSync(path.join(repository, "public", "uploads"), { recursive: true });
  mkdirSync(path.join(repository, "public", "documents"), { recursive: true });
  mkdirSync(path.join(repository, "node_modules", "next"), { recursive: true });
  mkdirSync(path.join(repository, "data", "uploads"), { recursive: true });
  mkdirSync(path.join(repository, "data", "documents", "manual"), { recursive: true });

  writeFileSync(path.join(repository, "package.json"), '{"name":"fixture"}');
  writeFileSync(path.join(repository, "tsconfig.json"), "{}");
  writeFileSync(path.join(repository, "next.config.ts"), "export default {};");
  writeFileSync(path.join(repository, "postcss.config.mjs"), "export default {};");
  writeFileSync(path.join(repository, "src", "app", "page.tsx"), "export default function Page() { return null; }");
  writeFileSync(path.join(repository, "public", "assets", "logo.svg"), "<svg/>");
  writeFileSync(path.join(repository, "public", "uploads", "legacy.webp"), "legacy");
  writeFileSync(path.join(repository, "data", "uploads", "developer-file.webp"), "developer upload");
  writeFileSync(path.join(repository, "data", "documents", "manual", "guide.pdf"), "developer document");
  // The development file whose `db` hostname the host runner cannot resolve.
  writeFileSync(path.join(repository, ".env"), "DATABASE_URL=postgresql://u:synthetic@db:5432/websoprotelco\n");
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("createAppWorkspace", () => {
  test("builds a throwaway app directory with its own real, empty runtime roots", () => {
    const workspace = createAppWorkspace(repository, sandbox);

    try {
      expect(path.dirname(workspace.directory)).toBe(sandbox);
      expect(path.basename(workspace.directory)).toMatch(/^websoprotelco-e2e-app-/);

      for (const root of ["uploads", "documents"]) {
        const directory = path.join(workspace.directory, "data", root);

        expect(lstatSync(directory).isDirectory()).toBe(true);
        expect(lstatSync(directory).isSymbolicLink()).toBe(false);
        expect(readdirSync(directory)).toEqual([]);
        expect(realpathSync(directory)).not.toBe(realpathSync(path.join(repository, "data", root)));
      }
    } finally {
      workspace.dispose();
    }
  });

  test("carries the project entries Next needs and nothing else", () => {
    const workspace = createAppWorkspace(repository, sandbox);

    try {
      expect(readdirSync(workspace.directory).sort()).toEqual([
        "data",
        "next.config.ts",
        "node_modules",
        "package.json",
        "postcss.config.mjs",
        "public",
        "src",
        "tsconfig.json",
      ]);
      expect(existsSync(path.join(workspace.directory, "src", "app", "page.tsx"))).toBe(true);
      expect(existsSync(path.join(workspace.directory, "public", "assets", "logo.svg"))).toBe(true);
      expect(lstatSync(path.join(workspace.directory, "node_modules")).isSymbolicLink()).toBe(true);
      expect(realpathSync(path.join(workspace.directory, "node_modules"))).toBe(
        realpathSync(path.join(repository, "node_modules")),
      );
    } finally {
      workspace.dispose();
    }
  });

  test("never carries a .env file or the legacy public upload roots", () => {
    const workspace = createAppWorkspace(repository, sandbox);

    try {
      expect(readdirSync(workspace.directory).filter((name) => name.startsWith(".env"))).toEqual([]);
      expect(existsSync(path.join(workspace.directory, "public", "uploads"))).toBe(false);
      expect(existsSync(path.join(workspace.directory, "public", "documents"))).toBe(false);
    } finally {
      workspace.dispose();
    }
  });

  test("passes the same isolation guard the Playwright process enforces", () => {
    const workspace = createAppWorkspace(repository, sandbox);

    try {
      expect(assertIsolatedAppDirectory(workspace.directory, repository)).toBe(workspace.directory);
    } finally {
      workspace.dispose();
    }
  });

  test("removes the whole workspace on dispose, idempotently, and leaves the repository untouched", () => {
    const before = snapshotTree(repository);
    const workspace = createAppWorkspace(repository, sandbox);

    writeFileSync(path.join(workspace.directory, "data", "uploads", "written-by-the-server.webp"), "x");

    workspace.dispose();
    workspace.dispose();

    expect(existsSync(workspace.directory)).toBe(false);
    expect(snapshotTree(repository)).toEqual(before);
    // The symlinked node_modules is removed as a link, never followed into the repository.
    expect(existsSync(path.join(repository, "node_modules", "next"))).toBe(true);
  });

  test("fails closed when a required project entry is missing", () => {
    rmSync(path.join(repository, "next.config.ts"));

    expect(() => createAppWorkspace(repository, sandbox)).toThrow("next.config.ts");
    expect(readdirSync(sandbox).filter((name) => name.startsWith("websoprotelco-e2e-app-"))).toEqual([]);
  });
});
