// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { assertIsolatedAppDirectory, assertIsolatedE2eDatabaseUrl, readAuthenticatedE2eEnvironment } from "./environment";

const PASSWORD_A = "a-long-synthetic-value-1";
const PASSWORD_B = "b-long-synthetic-value-2";

let sandbox = "";
let repository = "";
let appDirectory = "";

// A stand-in repository with a developer `data/` tree, plus a separate throwaway app directory.
beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(path.join(tmpdir(), "e2e-environment-test-")));
  repository = path.join(sandbox, "repo");
  appDirectory = path.join(sandbox, "app");

  for (const root of [repository, appDirectory]) {
    mkdirSync(path.join(root, "data", "uploads"), { recursive: true });
    mkdirSync(path.join(root, "data", "documents"), { recursive: true });
  }
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function validEnvironment(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    E2E_DATABASE_URL: "postgresql://e2e_user:synthetic@127.0.0.1:55432/websoprotelco_e2e_test",
    E2E_RUN_ID: "0123abcd4567",
    E2E_ADMIN_PASSWORD: PASSWORD_A,
    E2E_CUSTOMER_PASSWORD: PASSWORD_B,
    E2E_APP_DIR: appDirectory,
    ...overrides,
  };
}

describe("isolated E2E database guard", () => {
  test("accepts only the loopback E2E database on a non-default port", () => {
    const url = "postgresql://e2e_user:synthetic@127.0.0.1:55432/websoprotelco_e2e_test";

    expect(assertIsolatedE2eDatabaseUrl(url)).toBe(url);
    expect(assertIsolatedE2eDatabaseUrl(url.replace("127.0.0.1", "localhost"))).toContain("localhost");
  });

  test("rejects the Compose-internal hostname `db`, which a host runner cannot resolve", () => {
    expect(() =>
      assertIsolatedE2eDatabaseUrl("postgresql://e2e_user:synthetic@db:5432/websoprotelco_e2e_test"),
    ).toThrow('E2E database host must be loopback (received "db")');
  });

  test.each([
    ["a remote host", "postgresql://u:p@10.0.0.5:55432/websoprotelco_e2e_test", "host must be loopback"],
    ["the default PostgreSQL port", "postgresql://u:p@127.0.0.1:5432/websoprotelco_e2e_test", "explicit non-default port"],
    ["a missing port", "postgresql://u:p@127.0.0.1/websoprotelco_e2e_test", "explicit non-default port"],
    ["the development database", "postgresql://u:p@127.0.0.1:55432/websoprotelco", "database name must be"],
    ["another _test database", "postgresql://u:p@127.0.0.1:55432/other_test", "database name must be"],
    ["a non-PostgreSQL scheme", "mysql://u:p@127.0.0.1:55432/websoprotelco_e2e_test", "PostgreSQL"],
  ])("rejects %s", (_label, url, message) => {
    expect(() => assertIsolatedE2eDatabaseUrl(url)).toThrow(message);
  });

  test("never echoes the connection string or its password in the failure", () => {
    let message = "";

    try {
      assertIsolatedE2eDatabaseUrl("postgresql://e2e_user:topsecretvalue@db:5432/websoprotelco");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe("");
    expect(message).not.toContain("topsecretvalue");
    expect(message).not.toContain("postgresql://");
  });

  test("rejects a malformed URL without echoing it", () => {
    expect(() => assertIsolatedE2eDatabaseUrl("not a url with secret")).toThrow("not a valid PostgreSQL URL");
  });
});

describe("isolated E2E app directory guard", () => {
  test("accepts a throwaway directory that owns its runtime roots", () => {
    expect(assertIsolatedAppDirectory(appDirectory, repository)).toBe(appDirectory);
  });

  test("returns the resolved real path, so later comparisons cannot be fooled by a link", () => {
    const link = path.join(sandbox, "app-link");
    symlinkSync(appDirectory, link);

    expect(assertIsolatedAppDirectory(link, repository)).toBe(appDirectory);
  });

  test("rejects the repository root itself, whose data/ is the developer's real disk", () => {
    expect(() => assertIsolatedAppDirectory(repository, repository)).toThrow("must not be the repository");
  });

  test("rejects a symlink that resolves to the repository root", () => {
    const link = path.join(sandbox, "repo-link");
    symlinkSync(repository, link);

    expect(() => assertIsolatedAppDirectory(link, repository)).toThrow("must not be the repository");
  });

  test("rejects a directory inside the repository data tree", () => {
    const inside = path.join(repository, "data", "uploads", "nested-app");
    mkdirSync(path.join(inside, "data", "uploads"), { recursive: true });
    mkdirSync(path.join(inside, "data", "documents"), { recursive: true });

    expect(() => assertIsolatedAppDirectory(inside, repository)).toThrow("inside the repository data");
  });

  test("rejects a data directory that is a symlink to the repository data", () => {
    rmSync(path.join(appDirectory, "data"), { recursive: true });
    symlinkSync(path.join(repository, "data"), path.join(appDirectory, "data"));

    expect(() => assertIsolatedAppDirectory(appDirectory, repository)).toThrow("data directory must be a real directory");
  });

  test.each(["uploads", "documents"])("rejects a %s root that is a symlink to the repository one", (root) => {
    rmSync(path.join(appDirectory, "data", root), { recursive: true });
    symlinkSync(path.join(repository, "data", root), path.join(appDirectory, "data", root));

    expect(() => assertIsolatedAppDirectory(appDirectory, repository)).toThrow(`data/${root} must be a real directory`);
  });

  test.each([".env", ".env.local", ".env.production"])("rejects a directory holding %s", (name) => {
    writeFileSync(path.join(appDirectory, name), "DATABASE_URL=postgresql://u:p@db:5432/websoprotelco\n");

    expect(() => assertIsolatedAppDirectory(appDirectory, repository)).toThrow("must not contain environment files");
  });

  test("rejects a relative path", () => {
    expect(() => assertIsolatedAppDirectory("relative/app", repository)).toThrow("must be an absolute path");
  });

  test("rejects a directory that does not exist", () => {
    expect(() => assertIsolatedAppDirectory(path.join(sandbox, "missing"), repository)).toThrow("does not exist");
  });

  test("rejects a directory without the runtime roots", () => {
    rmSync(path.join(appDirectory, "data", "documents"), { recursive: true });

    expect(() => assertIsolatedAppDirectory(appDirectory, repository)).toThrow("data/documents must be a real directory");
  });
});

describe("authenticated E2E environment", () => {
  test("derives unique role accounts from the run id", () => {
    const environment = readAuthenticatedE2eEnvironment(validEnvironment(), repository);

    expect(environment.admin.email).toBe("e2e-admin-0123abcd4567@soprotelco.test");
    expect(environment.customer.email).toBe("e2e-customer-0123abcd4567@soprotelco.test");
    expect(environment.admin.password).toBe(PASSWORD_A);
    expect(environment.customer.password).toBe(PASSWORD_B);
  });

  test("exposes the isolated app directory whose data/ roots the server writes to", () => {
    const environment = readAuthenticatedE2eEnvironment(validEnvironment(), repository);

    expect(environment.appDirectory).toBe(appDirectory);
    expect(environment.appDirectory).not.toBe(repository);
  });

  test.each(["E2E_DATABASE_URL", "E2E_RUN_ID", "E2E_ADMIN_PASSWORD", "E2E_CUSTOMER_PASSWORD", "E2E_APP_DIR"])(
    "fails closed when %s is missing",
    (variable) => {
      expect(() => readAuthenticatedE2eEnvironment(validEnvironment({ [variable]: undefined }), repository)).toThrow(
        variable,
      );
    },
  );

  test("requires passwords of at least 12 characters and names only the variable", () => {
    const short = "eleven-char";

    expect(short).toHaveLength(11);
    expect(() =>
      readAuthenticatedE2eEnvironment(validEnvironment({ E2E_ADMIN_PASSWORD: short }), repository),
    ).toThrow("E2E_ADMIN_PASSWORD must be at least 12 characters");

    try {
      readAuthenticatedE2eEnvironment(validEnvironment({ E2E_ADMIN_PASSWORD: short }), repository);
    } catch (error) {
      expect((error as Error).message).not.toContain(short);
    }
  });

  test("rejects reusing one password for both roles", () => {
    expect(() =>
      readAuthenticatedE2eEnvironment(validEnvironment({ E2E_CUSTOMER_PASSWORD: PASSWORD_A }), repository),
    ).toThrow("must differ");
  });

  test("rejects a run id that is not a lowercase hex token", () => {
    expect(() => readAuthenticatedE2eEnvironment(validEnvironment({ E2E_RUN_ID: "Prod; DROP" }), repository)).toThrow(
      "E2E_RUN_ID",
    );
  });

  test("rejects a non-isolated database before anything else runs", () => {
    expect(() =>
      readAuthenticatedE2eEnvironment(
        validEnvironment({ E2E_DATABASE_URL: "postgresql://u:p@db:5432/websoprotelco_e2e_test" }),
        repository,
      ),
    ).toThrow("host must be loopback");
  });

  test("rejects an app directory that is the repository, even with a valid database", () => {
    expect(() => readAuthenticatedE2eEnvironment(validEnvironment({ E2E_APP_DIR: repository }), repository)).toThrow(
      "must not be the repository",
    );
  });
});
