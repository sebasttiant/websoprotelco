// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import packageJson from "../../package.json";
import { ROLES, permissionsForRole } from "../../src/server/auth/rbac";

// Documentation drifts silently: the README once named Node.js 24.16.0, pnpm 11.9.0 and a role
// model that no longer existed. These checks tie the facts that rot fastest to the files that own
// them. They do not judge prose quality.

const ROOT = process.cwd();
const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");
const gitignore = readFileSync(resolve(ROOT, ".gitignore"), "utf8");
const deployScript = readFileSync(resolve(ROOT, "deploy.sh"), "utf8");
const composeConfig = readFileSync(resolve(ROOT, "compose.yaml"), "utf8");

describe("README facts", () => {
  test("names the runtime and framework versions pinned by package.json", () => {
    expect(readme).toContain(`Node.js \`${packageJson.engines.node}\``);
    expect(readme).toContain(`pnpm \`${packageJson.engines.pnpm}\``);
    expect(readme).toContain(`Next.js \`${packageJson.dependencies.next}\``);
    expect(readme).toContain(`React \`${packageJson.dependencies.react}\``);
    expect(readme).toContain(`TypeScript \`${packageJson.devDependencies.typescript}\``);
  });

  test("does not mention versions the repository no longer pins", () => {
    expect(readme).not.toMatch(/24\.16\.0|pnpm `?11\.9\.0|16\.2\.10/);
  });

  test("only references pnpm scripts that exist", () => {
    const scripts = new Set(Object.keys(packageJson.scripts));

    for (const [, script] of readme.matchAll(/pnpm ((?:test|db|seed|lint|typecheck|build|dev|start)[\w:-]*)/g)) {
      expect(scripts.has(script), `README mentions "pnpm ${script}", which package.json does not define`).toBe(true);
    }
  });

  test("only references repository files that exist", () => {
    for (const [, file] of readme.matchAll(/`((?:tests|docs|src|db|scripts)\/[\w./[\]-]+\.\w+)`/g)) {
      expect(existsSync(resolve(ROOT, file)), `README points at missing ${file}`).toBe(true);
    }
  });

  test("documents the validation commands and the isolated authenticated E2E command", () => {
    for (const command of [
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test:coverage",
      "pnpm build",
      "pnpm test:contract:assets",
      "pnpm test:contract:deploy",
      "pnpm test:e2e:auth",
    ]) {
      expect(readme, command).toContain(command);
    }
  });
});

describe("README authorization and credentials", () => {
  test("documents every role and the /admin permission model", () => {
    for (const role of ROLES) {
      expect(readme, role).toContain(`\`${role}\``);
    }

    expect(readme).toContain("`admin:access`");
    expect(readme).toContain("requirePermission");
  });

  test("lists exactly the permissions the staff role holds", () => {
    for (const permission of permissionsForRole("staff")) {
      expect(readme, permission).toContain(`\`${permission}\``);
    }
  });

  test("states the 12-character policy without denying tracked local database placeholders", () => {
    expect(readme).toMatch(/12.{0,3}200 characters/);
    expect(readme).toContain("SEED_ADMIN_PASSWORD");
    expect(readme).toContain("SEED_STAFF_PASSWORD");
    expect(readme).toContain("No reusable application-account password is tracked");
    expect(readme).not.toContain("No password is tracked in this repository");
    expect(readme).not.toContain("change-me-please");
  });

  test("does not present local agent instructions or retired seed credentials as repository facts", () => {
    expect(readme).not.toContain("AGENTS.md");
    expect(deployScript).not.toMatch(/seed.{0,120}credentials comm(?:it|itt)ed/is);
    expect(composeConfig).not.toMatch(/seed.{0,120}credentials comm(?:it|itt)ed/is);
  });

  test("documents the data/ runtime asset roots and the first-deploy .env scaffold", () => {
    expect(readme).toContain("data/uploads");
    expect(readme).toContain("data/documents");
    expect(readme).toContain("CHANGE_ME");
    expect(readme).toContain("KNOWN_UPLOAD_URL");
    expect(readme).toContain("MAINTENANCE_WINDOW_CONFIRMED");
  });

  test("ignores local runtime assets instead of relying on operator discipline", () => {
    expect(gitignore).toMatch(/^data\/$/m);
    expect(readme).toContain("`data/` is ignored by Git");
  });

  test("keeps observed limitations explicit and avoids a production-readiness claim", () => {
    expect(readme).toMatch(/host-resolvable `DATABASE_URL`/);
    expect(readme).toMatch(/credential rotation/i);
    expect(readme).not.toMatch(/\bproduction[- ]ready\b/i);
  });
});
