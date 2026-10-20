#!/usr/bin/env node
/**
 * Black-box contract test for runtime asset delivery, run against a REAL standalone production
 * server — the artifact the Docker runner ships — not against imported route functions.
 *
 * Calling `GET()` directly proves the handler works; it cannot prove the framework routes to it,
 * that `headers()` from next.config.ts is applied, or that a file written after boot is reachable
 * once Next's boot-time public-file index has been built. Those are the failures this suite exists
 * to catch, so it drives the server over HTTP.
 *
 * Canonical command:  pnpm test:contract:assets
 * The build is part of that command: testing a stale `.next/standalone` would assert yesterday's
 * behaviour and pass while the current source is broken.
 *
 * Requires no database — every route touched is a static asset, an asset route handler, the image
 * optimizer, or the plain health endpoint.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const standaloneServer = path.join(repositoryRoot, ".next", "standalone", "server.js");

const PRE_BOOT_IMAGE = "2026-01-01-11111111-1111-4111-8111-111111111111.webp";
const POST_BOOT_IMAGE = "2026-01-02-22222222-2222-4222-8222-222222222222.webp";
const LARGE_IMAGE = "2026-01-03-44444444-4444-4444-8444-444444444444.webp";
const POST_BOOT_DOCUMENT = "33333333-3333-4333-8333-333333333333_manual.pdf";
const EMPTY_IMAGE = "2026-01-04-55555555-5555-4555-8555-555555555555.webp";
const PDF_BYTES = Buffer.from(`%PDF-1.7\n${"contract-test-document-payload ".repeat(8)}\n%%EOF\n`);
const MAX_IMAGE_EDGE = 1600;

const results = { passed: 0, failed: [] };
const serverOutput = [];

function check(name, passed, detail = "") {
  if (passed) results.passed += 1;
  else results.failed.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${passed ? "  ok" : "NOT OK"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", cwd: repositoryRoot, ...options });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`))));
  });
}

/** Newest mtime across everything that can change the built output. */
async function newestSourceMtime() {
  const roots = ["src", "public", "next.config.ts", "package.json", "pnpm-lock.yaml"];
  let newest = 0;

  const walk = async (target) => {
    const entry = await stat(target).catch(() => null);
    if (!entry) return;
    if (entry.isFile()) {
      newest = Math.max(newest, entry.mtimeMs);
      return;
    }
    const { readdir } = await import("node:fs/promises");
    for (const child of await readdir(target)) await walk(path.join(target, child));
  };

  for (const target of roots) await walk(path.join(repositoryRoot, target));
  return newest;
}

async function ensureFreshStandalone() {
  if (process.argv.includes("--no-build")) {
    if (!existsSync(standaloneServer)) throw new Error("--no-build was passed but .next/standalone/server.js does not exist");
    console.log("Skipping build (--no-build): the caller vouches for the standalone output.\n");
    return;
  }

  const built = await stat(standaloneServer).catch(() => null);
  const newestSource = await newestSourceMtime();

  if (built && built.mtimeMs >= newestSource) {
    console.log("Standalone output is newer than every source file; reusing it.\n");
    return;
  }

  console.log("Building standalone output before testing it...\n");
  await run(process.execPath, [path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next"), "build"], {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function startServer(deploymentDirectory, port) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: deploymentDirectory,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      STORAGE_PROVIDER: "local",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Kept, not discarded: on failure this output is the only explanation available.
  child.stdout.on("data", (chunk) => serverOutput.push(`[out] ${chunk}`));
  child.stderr.on("data", (chunk) => serverOutput.push(`[err] ${chunk}`));

  let exited = false;
  child.once("exit", (code, signal) => {
    exited = true;
    child.exitInfo = { code, signal };
  });
  child.hasExited = () => exited;

  return child;
}

async function waitForServer(child, baseUrl, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // A server that died during startup (port taken, bad output) must fail fast rather than
    // burning the whole timeout on a socket that will never open.
    if (child.hasExited()) {
      throw new Error(`standalone server exited during startup: ${JSON.stringify(child.exitInfo)}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
      await response.arrayBuffer();
    } catch {
      // not listening yet
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`standalone server did not become ready within ${timeoutMs}ms`);
}

/** Terminates the child and waits for the process to be genuinely gone, escalating if needed. */
async function stopServer(child) {
  if (!child || child.hasExited()) return;

  const closed = new Promise((resolve) => child.once("close", resolve));
  child.kill("SIGTERM");

  const timedOut = await Promise.race([
    closed.then(() => false),
    new Promise((resolve) => setTimeout(() => resolve(true), 5000)),
  ]);

  if (timedOut) {
    child.kill("SIGKILL");
    await closed;
  }
}

async function decodeImage(response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata().catch(() => null);

  return { bytes, metadata };
}

async function main() {
  await ensureFreshStandalone();

  const deploymentDirectory = await mkdtemp(path.join(tmpdir(), "assets-contract-"));
  let server;

  try {
    // Mirrors the Dockerfile runner stage: standalone output, then public/ and .next/static.
    await cp(path.join(repositoryRoot, ".next", "standalone"), deploymentDirectory, { recursive: true });
    await cp(path.join(repositoryRoot, "public"), path.join(deploymentDirectory, "public"), { recursive: true });
    await cp(path.join(repositoryRoot, ".next", "static"), path.join(deploymentDirectory, ".next", "static"), { recursive: true });

    // Production roots: the runner mounts its volumes at `<cwd>/data/uploads|documents`, and the
    // server reads exactly there (src/server/storage/roots.ts). `public/` holds build-time assets
    // only, so a fixture that wrote runtime files into it would test a layout nothing ships.
    const uploads = path.join(deploymentDirectory, "data", "uploads");
    const documents = path.join(deploymentDirectory, "data", "documents", "manual");
    await mkdir(uploads, { recursive: true });
    await mkdir(documents, { recursive: true });

    // Genuine WebP payloads, because /_next/image has to decode them.
    const imageBytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 20, g: 90, b: 200 } } }).webp().toBuffer();
    const largeBytes = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 200, g: 80, b: 40 } } }).webp().toBuffer();

    // PRE-BOOT: present before startup. It lives under data/, outside Next's public-file index,
    // so it must be served by the dynamic route exactly like a file written after boot.
    await writeFile(path.join(uploads, PRE_BOOT_IMAGE), imageBytes);

    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    server = startServer(deploymentDirectory, port);
    await waitForServer(server, base);

    // --- pre-boot asset ---------------------------------------------------------------------
    const preBoot = await fetch(`${base}/uploads/${PRE_BOOT_IMAGE}`);
    const preBootDecoded = await decodeImage(preBoot);
    check("pre-boot asset is retrievable", preBoot.status === 200, `HTTP ${preBoot.status}`);
    check("pre-boot asset decodes as a real image", preBootDecoded.metadata?.format === "webp", `format=${preBootDecoded.metadata?.format}`);
    check("pre-boot asset carries the global nosniff header", preBoot.headers.get("x-content-type-options") === "nosniff");
    check(
      "pre-boot asset is served by the DYNAMIC route (data/ is not in the public-file index)",
      (preBoot.headers.get("cache-control") ?? "").includes("must-revalidate"),
      `cache-control=${preBoot.headers.get("cache-control")}`,
    );

    // --- post-boot upload -------------------------------------------------------------------
    await writeFile(path.join(uploads, POST_BOOT_IMAGE), imageBytes);
    await writeFile(path.join(uploads, LARGE_IMAGE), largeBytes);
    await writeFile(path.join(uploads, EMPTY_IMAGE), "");

    const postBoot = await fetch(`${base}/uploads/${POST_BOOT_IMAGE}`);
    const postBootDecoded = await decodeImage(postBoot);
    check("post-boot upload is IMMEDIATELY retrievable", postBoot.status === 200, `HTTP ${postBoot.status}`);
    check("post-boot upload returns the stored bytes", postBootDecoded.bytes.equals(imageBytes), `${postBootDecoded.bytes.length} bytes`);
    check("post-boot upload declares image/webp", postBoot.headers.get("content-type") === "image/webp");
    check(
      "post-boot upload is served by the DYNAMIC route",
      (postBoot.headers.get("cache-control") ?? "").includes("must-revalidate"),
      `cache-control=${postBoot.headers.get("cache-control")}`,
    );
    check("post-boot upload carries the global nosniff header", postBoot.headers.get("x-content-type-options") === "nosniff");

    // --- nested document --------------------------------------------------------------------
    await writeFile(path.join(documents, POST_BOOT_DOCUMENT), PDF_BYTES);
    const document = await fetch(`${base}/documents/manual/${POST_BOOT_DOCUMENT}`);
    const documentBytes = Buffer.from(await document.arrayBuffer());
    check("nested post-boot document is immediately retrievable", document.status === 200, `HTTP ${document.status}`);
    check("document bytes are intact", documentBytes.equals(PDF_BYTES));
    check("document declares application/pdf", document.headers.get("content-type") === "application/pdf");
    check("document is forced to attachment by the global header rule", (document.headers.get("content-disposition") ?? "").includes("attachment"));

    // --- image optimizer: decoded, not merely status 200 --------------------------------------
    const optimized = await fetch(`${base}/_next/image?url=${encodeURIComponent(`/uploads/${POST_BOOT_IMAGE}`)}&w=64&q=75`);
    const optimizedDecoded = await decodeImage(optimized);
    check("/_next/image returns an image content type", (optimized.headers.get("content-type") ?? "").startsWith("image/"), optimized.headers.get("content-type"));
    check("/_next/image returns a non-empty body", optimizedDecoded.bytes.length > 0, `${optimizedDecoded.bytes.length} bytes`);
    check("/_next/image output decodes as a supported image, not an error page", Boolean(optimizedDecoded.metadata?.format), `format=${optimizedDecoded.metadata?.format}`);
    check(
      "/_next/image output has meaningful dimensions",
      (optimizedDecoded.metadata?.width ?? 0) > 0 && (optimizedDecoded.metadata?.height ?? 0) > 0,
      `${optimizedDecoded.metadata?.width}x${optimizedDecoded.metadata?.height}`,
    );

    const optimizedLarge = await fetch(`${base}/_next/image?url=${encodeURIComponent(`/uploads/${LARGE_IMAGE}`)}&w=1920&q=75`);
    const largeDecoded = await decodeImage(optimizedLarge);
    const longestEdge = Math.max(largeDecoded.metadata?.width ?? 0, largeDecoded.metadata?.height ?? 0);
    check("a large post-boot image is optimized to a bounded edge", longestEdge > 0 && longestEdge <= 1920, `longest edge ${longestEdge}`);
    check("the stored-image contract keeps the catalog edge at or under the cap", MAX_IMAGE_EDGE === 1600);

    // --- HEAD ----------------------------------------------------------------------------------
    const headPost = await fetch(`${base}/uploads/${POST_BOOT_IMAGE}`, { method: "HEAD" });
    const headPre = await fetch(`${base}/uploads/${PRE_BOOT_IMAGE}`, { method: "HEAD" });
    check("HEAD on a post-boot asset returns 200 with a content length", headPost.status === 200 && headPost.headers.get("content-length") === String(imageBytes.length));
    check("HEAD on a pre-boot asset returns 200 too", headPre.status === 200, `HTTP ${headPre.status}`);
    check("HEAD carries no body", (await headPost.text()) === "");

    // --- Range ----------------------------------------------------------------------------------
    const partial = await fetch(`${base}/documents/manual/${POST_BOOT_DOCUMENT}`, { headers: { Range: "bytes=0-9" } });
    const partialBytes = Buffer.from(await partial.arrayBuffer());
    check("valid range returns 206", partial.status === 206, `HTTP ${partial.status}`);
    check("206 carries Content-Range", partial.headers.get("content-range") === `bytes 0-9/${PDF_BYTES.length}`, partial.headers.get("content-range"));
    check("206 body is the requested slice", partialBytes.equals(PDF_BYTES.subarray(0, 10)), `${partialBytes.length} bytes`);
    check("Accept-Ranges is advertised", partial.headers.get("accept-ranges") === "bytes");

    const suffix = await fetch(`${base}/documents/manual/${POST_BOOT_DOCUMENT}`, { headers: { Range: "bytes=-6" } });
    const suffixBytes = Buffer.from(await suffix.arrayBuffer());
    check("suffix range returns the final bytes", suffix.status === 206 && suffixBytes.equals(PDF_BYTES.subarray(-6)), `HTTP ${suffix.status}`);

    const unsatisfiable = await fetch(`${base}/documents/manual/${POST_BOOT_DOCUMENT}`, { headers: { Range: "bytes=999999-" } });
    await unsatisfiable.arrayBuffer();
    check("unsatisfiable range returns 416", unsatisfiable.status === 416, `HTTP ${unsatisfiable.status}`);
    check("416 carries the complete-length Content-Range", unsatisfiable.headers.get("content-range") === `bytes */${PDF_BYTES.length}`);

    // The reproduced descriptor leak, asserted over HTTP: 416 rather than 503, every time.
    const zeroByteStatuses = new Set();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(`${base}/uploads/${EMPTY_IMAGE}`, { headers: { Range: "bytes=-1" } });
      zeroByteStatuses.add(response.status);
      await response.arrayBuffer();
    }
    check("30 zero-byte Range requests all return 416", [...zeroByteStatuses].join() === "416", `statuses=${[...zeroByteStatuses].join()}`);

    const stillHealthy = await fetch(`${base}/uploads/${POST_BOOT_IMAGE}`);
    await stillHealthy.arrayBuffer();
    check("the server still serves normally after the attack", stillHealthy.status === 200, `HTTP ${stillHealthy.status}`);

    // --- conditional ------------------------------------------------------------------------------
    const conditional = await fetch(`${base}/uploads/${POST_BOOT_IMAGE}`, { headers: { "If-None-Match": postBoot.headers.get("etag") ?? "" } });
    await conditional.arrayBuffer();
    check("matching validator returns 304", conditional.status === 304, `HTTP ${conditional.status}`);

    // --- traversal, symlinked root and cross-root ---------------------------------------------------
    const hostile = [
      "/uploads/../../etc/passwd",
      "/uploads/%2e%2e%2f%2e%2e%2fetc%2fpasswd",
      "/uploads/..%2f..%2fetc%2fpasswd.webp",
      "/uploads/%00.webp",
      "/uploads/server.js",
      "/documents/../uploads/../../etc/passwd.pdf",
      `/documents/manual/${POST_BOOT_IMAGE}`,
    ];
    for (const attempt of hostile) {
      const response = await fetch(`${base}${attempt}`, { redirect: "manual" });
      const body = await response.text().catch(() => "");
      check(`rejected: ${attempt}`, [400, 404, 301, 308].includes(response.status) && !body.includes("root:"), `HTTP ${response.status}`);
    }

    await writeFile(path.join(uploads, "cross-root.pdf"), PDF_BYTES);
    const crossRoot = await fetch(`${base}/uploads/cross-root.pdf`);
    await crossRoot.arrayBuffer().catch(() => undefined);
    check("uploads refuses to serve a PDF", crossRoot.status === 404, `HTTP ${crossRoot.status}`);

    // --- deletion -------------------------------------------------------------------------------------
    await rm(path.join(documents, POST_BOOT_DOCUMENT));
    const deleted = await fetch(`${base}/documents/manual/${POST_BOOT_DOCUMENT}`);
    await deleted.arrayBuffer().catch(() => undefined);
    check("deleted document becomes 404", deleted.status === 404, `HTTP ${deleted.status}`);
    check("the 404 is not cacheable", (deleted.headers.get("cache-control") ?? "").includes("no-store"));

    // --- restart persistence ---------------------------------------------------------------------------
    await stopServer(server);
    server = startServer(deploymentDirectory, port);
    await waitForServer(server, base);

    const afterRestart = await fetch(`${base}/uploads/${POST_BOOT_IMAGE}`);
    const afterRestartBytes = Buffer.from(await afterRestart.arrayBuffer());
    check("a file uploaded before the restart survives it", afterRestart.status === 200, `HTTP ${afterRestart.status}`);
    check("its bytes are unchanged", afterRestartBytes.equals(imageBytes));
    check(
      "after the restart it is still served by the dynamic route",
      (afterRestart.headers.get("cache-control") ?? "").includes("must-revalidate"),
      `cache-control=${afterRestart.headers.get("cache-control")}`,
    );
  } finally {
    await stopServer(server);
    await rm(deploymentDirectory, { recursive: true, force: true }).catch(() => undefined);

    if (existsSync(deploymentDirectory)) {
      results.failed.push(`temporary deployment directory could not be removed: ${deploymentDirectory}`);
    }
  }

  const total = results.passed + results.failed.length;
  console.log(`\n${results.passed}/${total} checks passed`);

  if (results.failed.length > 0) {
    console.error(`\nFAILED:\n${results.failed.map((entry) => `  - ${entry}`).join("\n")}`);
    console.error(`\nServer output:\n${serverOutput.join("")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("contract test crashed:", error);
  if (serverOutput.length > 0) console.error(`\nServer output:\n${serverOutput.join("")}`);
  process.exit(2);
});
