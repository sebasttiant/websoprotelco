import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

import { createAppWorkspace } from "./app-workspace";
import {
  assertIsolatedE2eDatabaseUrl,
  E2E_DATABASE_NAME,
  E2E_DEFAULT_DATABASE_PORT,
  E2E_ENVIRONMENT_VARIABLES,
} from "./environment";

// Owns the whole lifecycle of the authenticated suite so it is reproducible from a clean host:
//   1. generate per-run credentials (never printed, never written to disk),
//   2. build the throwaway app workspace the server runs from, so uploads never touch the
//      repository's own `data/` (see tests/e2e/app-workspace.ts),
//   3. start the throwaway PostgreSQL from compose.e2e.yaml and wait until it is healthy,
//   4. run `playwright test --project=authenticated` against it,
//   5. ALWAYS destroy the container and the workspace, including on failure and on Ctrl-C.
// Migrations, seeding and the schema reset are done by tests/e2e/global-setup.ts.

const COMPOSE_ARGS = ["compose", "-f", "compose.e2e.yaml"] as const;

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined) {
    return E2E_DEFAULT_DATABASE_PORT;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("E2E_DB_PORT must be an integer between 1024 and 65535.");
  }

  return port;
}

function compose(env: NodeJS.ProcessEnv, ...args: string[]): number {
  return spawnSync("docker", [...COMPOSE_ARGS, ...args], { env, stdio: "inherit" }).status ?? 1;
}

async function main(): Promise<number> {
  const databasePort = parsePort(process.env.E2E_DB_PORT);
  const databasePassword = randomToken(24);
  const databaseUrl = assertIsolatedE2eDatabaseUrl(
    `postgresql://e2e_user:${databasePassword}@127.0.0.1:${databasePort}/${E2E_DATABASE_NAME}`,
  );

  const workspace = createAppWorkspace(process.cwd());

  const names = E2E_ENVIRONMENT_VARIABLES;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2E_AUTHENTICATED: "1",
    E2E_DB_PASSWORD: databasePassword,
    E2E_DB_PORT: String(databasePort),
    [names.DATABASE_URL]: databaseUrl,
    [names.RUN_ID]: randomBytes(6).toString("hex"),
    [names.ADMIN_PASSWORD]: randomToken(24),
    [names.CUSTOMER_PASSWORD]: randomToken(24),
    [names.APP_DIR]: workspace.directory,
    // Anything inheriting DATABASE_URL (the app server, setup helpers) must see the isolated
    // database, never whatever the developer's shell happens to export.
    DATABASE_URL: databaseUrl,
  };

  let tornDown = false;
  const teardown = (): void => {
    if (!tornDown) {
      tornDown = true;
      compose(env, "down", "--volumes", "--remove-orphans");
      workspace.dispose();
    }
  };

  process.once("SIGINT", () => {
    teardown();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    teardown();
    process.exit(143);
  });

  try {
    if (compose(env, "up", "--detach", "--wait") !== 0) {
      console.error("Could not start the isolated E2E database (is Docker running and the port free?).");
      return 1;
    }

    return await new Promise<number>((resolve) => {
      const playwright = spawn(
        "pnpm",
        ["exec", "playwright", "test", "--project=authenticated", ...process.argv.slice(2)],
        { env, stdio: "inherit" },
      );

      playwright.on("error", (error) => {
        console.error(`Could not start Playwright: ${error.message}`);
        resolve(1);
      });
      playwright.on("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    teardown();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Authenticated E2E run failed.");
    process.exitCode = 1;
  },
);
