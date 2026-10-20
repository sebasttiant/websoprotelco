// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import packageJson from "../../package.json";

// The workflow is configuration, not behaviour, so the only way to keep it honest is to read it.
// These checks pin WHICH validations CI performs and that every command it names really exists;
// they do not (and cannot) prove a green run on GitHub.

const ROOT = process.cwd();
const workflow = readFileSync(resolve(ROOT, ".github/workflows/ci.yml"), "utf8");
const vitestConfig = readFileSync(resolve(ROOT, "vitest.config.ts"), "utf8");

const JOB_NAMES = {
  QUALITY: "quality",
  CONTAINER: "container",
  AUTHENTICATED_E2E: "e2e-authenticated",
} as const;

// Jobs are the two-space-indented keys under `jobs:`; a block runs until the next such key.
function jobBlock(name: string): string {
  const jobsSection = workflow.slice(workflow.indexOf("\njobs:\n"));
  const start = jobsSection.search(new RegExp(`^  ${name}:$`, "m"));

  expect(start, `job "${name}" is missing from ci.yml`).toBeGreaterThanOrEqual(0);

  const rest = jobsSection.slice(start + 1);
  const next = rest.slice(rest.indexOf("\n") + 1).search(/^ {2}[\w-]+:$/m);

  return next === -1 ? rest : rest.slice(0, rest.indexOf("\n") + 1 + next);
}

function runCommands(block: string): string[] {
  return [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => match[1].trim());
}

describe("CI workflow contract", () => {
  test("keeps the triggers and least-privilege permissions", () => {
    expect(workflow).toMatch(/^on:\n {2}pull_request:\n {2}push:\n {4}branches:\n {6}- main\n {6}- "feature\/\*\*"/m);
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m);
  });

  test("aligns pnpm and Node.js with package.json in every job that installs dependencies", () => {
    const packageManagerVersion = packageJson.packageManager.replace("pnpm@", "");

    for (const name of [JOB_NAMES.QUALITY, JOB_NAMES.AUTHENTICATED_E2E]) {
      const block = jobBlock(name);

      expect(block, name).toContain(`version: ${packageManagerVersion}`);
      expect(block, name).toContain(`node-version: ${packageJson.engines.node}`);
      expect(block, name).toContain("cache: pnpm");
      expect(runCommands(block), name).toContain("pnpm install --frozen-lockfile");
    }
  });

  test("quality job keeps lint, typecheck, unit tests, build and the standalone asset contract", () => {
    const commands = runCommands(jobBlock(JOB_NAMES.QUALITY));

    expect(commands).toContain("pnpm lint");
    expect(commands).toContain("pnpm typecheck");
    expect(commands).toContain("pnpm test:coverage");
    expect(commands).toContain("pnpm build");
    expect(commands).toContain("pnpm test:contract:assets");
  });

  test("quality job runs the unit suite once, with coverage, and publishes the report", () => {
    const block = jobBlock(JOB_NAMES.QUALITY);

    expect(runCommands(block)).not.toContain("pnpm test");
    expect(block).toMatch(/uses: actions\/upload-artifact@v\d+/);
    expect(block).toContain("path: coverage/");
  });

  test("coverage is reported without an invented repository-wide threshold", () => {
    expect(packageJson.scripts["test:coverage"]).toBe("vitest run --coverage");
    expect(vitestConfig).toContain('include: ["src/**/*.{ts,tsx}"]');
    expect(vitestConfig).not.toMatch(/thresholds|lines:\s*\d|statements:\s*\d|branches:\s*\d|functions:\s*\d/);
  });

  test("container job runs the deploy, Compose and runtime shell contracts and builds both images", () => {
    const commands = runCommands(jobBlock(JOB_NAMES.CONTAINER));

    expect(commands).toContain("bash tests/deploy/run-all.sh");
    expect(commands).toContain("bash tests/deploy/compose-contract.sh");
    expect(commands).toContain("bash tests/deploy/runtime-manifest.sh");
    expect(commands.some((command) => command.includes("--target runner"))).toBe(true);
    expect(commands.some((command) => command.includes("--target migrator"))).toBe(true);
  });

  test("authenticated E2E runs the isolated runner with Chromium and without repository secrets", () => {
    const block = jobBlock(JOB_NAMES.AUTHENTICATED_E2E);
    const commands = runCommands(block);

    expect(commands).toContain("pnpm exec playwright install --with-deps chromium");
    expect(commands).toContain("pnpm test:e2e:auth");
    expect(block).not.toContain("secrets.");
    expect(block).not.toContain("DATABASE_URL");
    expect(block).toMatch(/timeout-minutes: \d+/);
  });

  test("every pnpm script and shell contract that CI names exists in the repository", () => {
    const scripts = new Set(Object.keys(packageJson.scripts));

    for (const [, script] of workflow.matchAll(/run: pnpm (?!exec|install)([\w:-]+)/g)) {
      expect(scripts.has(script), `package.json has no "${script}" script`).toBe(true);
    }

    for (const [, file] of workflow.matchAll(/run: bash (tests\/[\w./-]+\.sh)/g)) {
      expect(existsSync(resolve(ROOT, file)), `${file} does not exist`).toBe(true);
    }
  });
});

describe("deploy contract entry points", () => {
  test("exposes the offline deploy shell contracts as one command", () => {
    expect(packageJson.scripts["test:contract:deploy"]).toBe("bash tests/deploy/run-all.sh");
  });

  test("the runner covers every offline deploy shell contract", () => {
    const runner = readFileSync(resolve(ROOT, "tests/deploy/run-all.sh"), "utf8");

    for (const file of [
      "run.sh",
      "deploy-abort.sh",
      "deploy-reexec.sh",
      "deploy-state-contract.sh",
      "deploy-verify-fail.sh",
      "rollback-unset-db.sh",
    ]) {
      expect(runner, file).toContain(file);
    }
  });
});
