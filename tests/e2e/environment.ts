import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";

import { MIN_PASSWORD_LENGTH } from "../../src/server/auth/password";

// The authenticated suite is destructive (it resets the schema it points at), so it must only
// ever target the throwaway database that compose.e2e.yaml publishes on the host loopback.
// Every rule below fails closed, and no message echoes the connection string or a password.

export const E2E_DATABASE_NAME = "websoprotelco_e2e_test";
export const E2E_DEFAULT_DATABASE_PORT = 55432;
export const E2E_DEFAULT_APP_PORT = 8787;

const DEFAULT_POSTGRES_PORT = "5432";
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);
const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(["postgresql:", "postgres:"]);
const RUN_ID_PATTERN = /^[a-f0-9]{8,32}$/;

export const E2E_ENVIRONMENT_VARIABLES = {
  DATABASE_URL: "E2E_DATABASE_URL",
  RUN_ID: "E2E_RUN_ID",
  ADMIN_PASSWORD: "E2E_ADMIN_PASSWORD",
  CUSTOMER_PASSWORD: "E2E_CUSTOMER_PASSWORD",
  APP_DIR: "E2E_APP_DIR",
} as const;

const RUNTIME_ROOTS = ["uploads", "documents"] as const;
const ENVIRONMENT_FILE_PATTERN = /^\.env(\..+)?$/;

function parsePostgresUrl(connectionString: string): URL {
  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("E2E database URL is not a valid PostgreSQL URL.");
  }

  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    throw new Error("E2E database URL is not a valid PostgreSQL URL (expected postgresql://).");
  }

  return url;
}

export function assertIsolatedE2eDatabaseUrl(connectionString: string): string {
  const url = parsePostgresUrl(connectionString);

  // `db` is the Compose-internal service name: it resolves inside the Compose network only,
  // never from the host that runs Playwright, so it is refused rather than half-working.
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(`E2E database host must be loopback (received "${url.hostname}").`);
  }

  if (url.port === "" || url.port === DEFAULT_POSTGRES_PORT) {
    throw new Error("E2E database URL needs an explicit non-default port; 5432 is the development database.");
  }

  const databaseName = url.pathname.replace(/^\//, "");

  if (databaseName !== E2E_DATABASE_NAME) {
    throw new Error(`E2E database name must be ${E2E_DATABASE_NAME}.`);
  }

  return connectionString;
}

function isInside(candidate: string, parent: string): boolean {
  return candidate === parent || candidate.startsWith(parent + path.sep);
}

function realDirectoryOrNull(target: string): string | null {
  try {
    const stat = lstatSync(target);

    // `lstat` does not follow links: a symlinked root is refused even if its target is a directory,
    // because the server would then write wherever the link points.
    return stat.isDirectory() && !stat.isSymbolicLink() ? realpathSync(target) : null;
  } catch {
    return null;
  }
}

// Uploads are written to `<cwd>/data/{uploads,documents}` and no setting redirects them, so the
// only way to keep the suite off the developer's real disk is to run the app server from a
// throwaway directory that owns those roots. This returns that directory's real path, and throws
// unless every runtime root the server can write to is provably not the repository's.
export function assertIsolatedAppDirectory(appDirectory: string, repositoryRoot: string = process.cwd()): string {
  if (!path.isAbsolute(appDirectory)) {
    throw new Error("E2E app directory must be an absolute path.");
  }

  if (!existsSync(appDirectory)) {
    throw new Error("E2E app directory does not exist.");
  }

  const realApp = realpathSync(appDirectory);
  const realRepository = realpathSync(repositoryRoot);
  const repositoryData = path.join(realRepository, "data");

  if (realApp === realRepository) {
    throw new Error("E2E app directory must not be the repository: its data/ holds the developer's real files.");
  }

  if (isInside(realApp, repositoryData)) {
    throw new Error("E2E app directory must not live inside the repository data tree.");
  }

  // Next loads `.env*` from its project directory; one copied here could carry the Compose-only
  // `db` hostname (or a real credential) and override the isolated database.
  if (readdirSync(realApp).some((name) => ENVIRONMENT_FILE_PATTERN.test(name))) {
    throw new Error("E2E app directory must not contain environment files (.env*).");
  }

  const appData = realDirectoryOrNull(path.join(realApp, "data"));

  if (appData === null) {
    throw new Error("E2E app data directory must be a real directory, not a symlink or a file.");
  }

  for (const root of RUNTIME_ROOTS) {
    const appRoot = realDirectoryOrNull(path.join(realApp, "data", root));

    if (appRoot === null) {
      throw new Error(`E2E app data/${root} must be a real directory, not a symlink, a file or missing.`);
    }

    // Defence in depth: even if the checks above are bypassed some other way, the resolved root
    // must differ from the repository's.
    if (isInside(appRoot, path.join(repositoryData, root))) {
      throw new Error(`E2E app data/${root} resolves to the repository's own ${root} root.`);
    }
  }

  return realApp;
}

export interface E2eAccount {
  email: string;
  password: string;
}

export interface AuthenticatedE2eEnvironment {
  databaseUrl: string;
  runId: string;
  // Real path of the throwaway directory the app server runs from; its data/ roots receive uploads.
  appDirectory: string;
  admin: E2eAccount;
  customer: E2eAccount;
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function requireVariable(env: EnvironmentSource, name: string): string {
  const value = env[name];

  if (!value) {
    throw new Error(`${name} is required. Run the suite through \`pnpm test:e2e:auth\` so it owns the isolated database.`);
  }

  return value;
}

function requirePassword(env: EnvironmentSource, name: string): string {
  const value = requireVariable(env, name);

  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  return value;
}

export function readAuthenticatedE2eEnvironment(
  env: EnvironmentSource = process.env,
  repositoryRoot: string = process.cwd(),
): AuthenticatedE2eEnvironment {
  const names = E2E_ENVIRONMENT_VARIABLES;
  const databaseUrl = assertIsolatedE2eDatabaseUrl(requireVariable(env, names.DATABASE_URL));
  const appDirectory = assertIsolatedAppDirectory(requireVariable(env, names.APP_DIR), repositoryRoot);
  const runId = requireVariable(env, names.RUN_ID);

  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`${names.RUN_ID} must be a lowercase hex token of 8-32 characters.`);
  }

  const adminPassword = requirePassword(env, names.ADMIN_PASSWORD);
  const customerPassword = requirePassword(env, names.CUSTOMER_PASSWORD);

  if (adminPassword === customerPassword) {
    throw new Error(`${names.ADMIN_PASSWORD} and ${names.CUSTOMER_PASSWORD} must differ.`);
  }

  return {
    databaseUrl,
    runId,
    appDirectory,
    admin: { email: `e2e-admin-${runId}@soprotelco.test`, password: adminPassword },
    customer: { email: `e2e-customer-${runId}@soprotelco.test`, password: customerPassword },
  };
}
