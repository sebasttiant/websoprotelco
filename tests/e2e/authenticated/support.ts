import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";

import { expect, type APIResponse, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Client } from "pg";

import { runtimeRoot } from "../created-files";
import { readAuthenticatedE2eEnvironment, type AuthenticatedE2eEnvironment, type E2eAccount } from "../environment";

// Evaluated at import, so a spec cannot even be collected against a non-isolated database.
export const environment: AuthenticatedE2eEnvironment = readAuthenticatedE2eEnvironment();

// Smallest valid 1x1 PNG: it has to survive the real signature check and the sharp re-encode.
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
export const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");

export interface SignedInSession {
  context: BrowserContext;
  page: Page;
}

export async function signIn(browser: Browser, account: E2eAccount, landing: RegExp): Promise<SignedInSession> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/login");
  // The sign-in form is a hydrated client component; submitting before hydration would fall
  // back to a plain navigation and lose the Server Action result. React tags a hydrated DOM node
  // with a `__reactProps$…` key, which is a deterministic signal. `networkidle` is not: the dev
  // server keeps a long-lived connection open for hot reloading, so the network never goes idle.
  await page.waitForFunction(() => {
    const form = document.querySelector("form");

    return form !== null && Object.keys(form).some((key) => key.startsWith("__reactProps$"));
  });
  await page.getByLabel("Correo").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(landing);

  return { context, page };
}

// Tables whose rows churn on every authenticated request (session bookkeeping) are compared by
// row count only; everything else is compared by a digest of its full contents, which also
// covers counters such as products.stock_quantity.
const COUNT_ONLY_TABLES: ReadonlySet<string> = new Set(["sessions"]);
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

export interface PersistedState {
  tables: Record<string, string>;
  // Files in the throwaway app workspace's runtime roots (where the server really writes).
  files: string[];
  // The repository's own `data/` tree, path-for-path and byte-for-byte. The suite must never
  // touch it, so this has to be identical in every capture of a run.
  repositoryData: string[];
}

function listFiles(directory: string): string[] {
  const found: string[] = [];

  // A fresh workspace holds no files; a missing root simply holds none either.
  if (!existsSync(directory)) {
    return found;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) {
      found.push(path.relative(environment.appDirectory, path.join(entry.parentPath, entry.name)));
    }
  }

  return found.sort();
}

// Every entry under `root`: files as `path:sha256`, directories as `path/`, links as `path->target`.
// A checkout without `data/` has an empty snapshot, and creating the directory would change it.
export function snapshotTree(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true, recursive: true })
    .map((entry) => {
      const absolute = path.join(entry.parentPath, entry.name);
      const relative = path.relative(root, absolute);

      if (entry.isSymbolicLink()) {
        return `${relative}->${readlinkSync(absolute)}`;
      }

      return entry.isFile()
        ? `${relative}:${createHash("sha256").update(readFileSync(absolute)).digest("hex")}`
        : `${relative}/`;
    })
    .sort();
}

// The developer's real runtime data. The Playwright worker runs from the repository root, which is
// the same root `assertIsolatedAppDirectory` compares the workspace against.
export function repositoryDataRoot(): string {
  return path.join(process.cwd(), "data");
}

export async function capturePersistedState(): Promise<PersistedState> {
  const client = new Client({ connectionString: environment.databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const tables: Record<string, string> = {};

    for (const { tablename } of rows) {
      if (!SAFE_IDENTIFIER.test(tablename)) {
        throw new Error("Unexpected table name in the E2E database.");
      }

      const query = COUNT_ONLY_TABLES.has(tablename)
        ? `SELECT count(*)::text AS value FROM "${tablename}"`
        : `SELECT count(*)::text || ':' || md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS value FROM "${tablename}" t`;
      const result = await client.query<{ value: string }>(query);

      tables[tablename] = result.rows[0].value;
    }

    return {
      tables,
      files: [...listFiles(runtimeRoot("uploads")), ...listFiles(runtimeRoot("documents"))],
      repositoryData: snapshotTree(repositoryDataRoot()),
    };
  } finally {
    await client.end();
  }
}

export async function expectJsonError(response: APIResponse, status: number, message: string): Promise<void> {
  expect(response.status()).toBe(status);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(response.headers()["content-disposition"]).toBeUndefined();
  expect(await response.json()).toEqual({ error: message });
}
