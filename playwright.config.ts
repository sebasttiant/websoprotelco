import path from "node:path";

import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

import { E2E_DEFAULT_APP_PORT, readAuthenticatedE2eEnvironment } from "./tests/e2e/environment";

// Two mutually exclusive modes, so the original public smoke run keeps behaving exactly as before:
//   - default:        the `chromium` project against `pnpm dev` (PLAYWRIGHT_BASE_URL honoured);
//   - authenticated:  `pnpm test:e2e:auth` sets E2E_AUTHENTICATED=1 and owns an isolated
//                     PostgreSQL, a dedicated app server and generated credentials.
const authenticatedMode = process.env.E2E_AUTHENTICATED === "1";

const port = process.env.PORT ?? "8585";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

const sharedConfig: PlaywrightTestConfig = {
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
};

function authenticatedConfig(): PlaywrightTestConfig {
  // Throws unless the database is the isolated loopback E2E target, before anything starts.
  const environment = readAuthenticatedE2eEnvironment();
  const appPort = process.env.E2E_PORT ?? String(E2E_DEFAULT_APP_PORT);
  const appURL = `http://127.0.0.1:${appPort}`;

  return {
    ...sharedConfig,
    // One worker, no file parallelism: the specs compare whole-database digests and the runtime
    // asset directories before/after each operation, which concurrent tests would invalidate.
    fullyParallel: false,
    workers: 1,
    timeout: 90_000,
    expect: { timeout: 15_000 },
    globalSetup: "./tests/e2e/global-setup.ts",
    globalTeardown: "./tests/e2e/global-teardown.ts",
    projects: [
      {
        name: "authenticated",
        testMatch: "e2e/authenticated/**/*.spec.ts",
        use: {
          ...devices["Desktop Chrome"],
          baseURL: appURL,
          // Credentials are typed into the sign-in form; a trace, screenshot or video would
          // record them, so none are ever captured for this project.
          trace: "off",
          screenshot: "off",
          video: "off",
        },
      },
    ],
    webServer: {
      // The server runs from the throwaway app workspace, never from the repository: uploads are
      // written to `<cwd>/data`, and a `.env` in the repository points at the Compose-only host
      // `db`. The repository's own Next binary is used because the workspace has no `.bin`.
      // `--webpack`: Turbopack refuses the workspace's node_modules symlink (it points outside
      // Turbopack's filesystem root); webpack resolves it to the real path without that limit.
      command: `node ${JSON.stringify(path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"))} dev --webpack --hostname 127.0.0.1 --port ${appPort}`,
      cwd: environment.appDirectory,
      // The health route needs no database, so it is ready before global setup migrates it.
      url: `${appURL}/api/health`,
      // Never adopt a server somebody else started: it would point at an unknown database.
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DATABASE_URL: environment.databaseUrl,
        DATABASE_SSL: "disable",
        STORAGE_PROVIDER: "local",
        SESSION_COOKIE_SECURE: "false",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  };
}

export default defineConfig(
  authenticatedMode
    ? authenticatedConfig()
    : {
        ...sharedConfig,
        fullyParallel: true,
        workers: process.env.CI ? 1 : undefined,
        use: {
          baseURL,
          trace: "on-first-retry",
        },
        projects: [
          {
            name: "chromium",
            testIgnore: "e2e/authenticated/**",
            use: { ...devices["Desktop Chrome"] },
          },
        ],
        webServer: {
          command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      },
);
