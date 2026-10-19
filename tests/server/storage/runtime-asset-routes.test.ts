// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GET as getDocument, HEAD as headDocument } from "@/app/documents/[...path]/route";
import { GET as getUpload, HEAD as headUpload } from "@/app/uploads/[...path]/route";

// Wiring only. Policy, containment, ranges, validators and descriptor lifecycle are covered once
// in runtime-assets.test.ts; duplicating them here would test the same module twice. What is
// asserted here is what only the route layer can get wrong: which root each handler is bound to,
// that awaited params reach it, and that HEAD is exported.
let workspace: string;

const WEBP = "2026-07-26-39615f86-a97e-43e8-852a-e2d97cc6108c.webp";
const PDF = "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f_manual.pdf";

const params = (segments: string[]) => ({ params: Promise.resolve({ path: segments }) });

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "runtime-asset-routes-"));
  await mkdir(path.join(workspace, "public", "uploads"), { recursive: true });
  await mkdir(path.join(workspace, "public", "documents", "manual"), { recursive: true });
  await writeFile(path.join(workspace, "public", "uploads", WEBP), "RIFF____WEBPdata");
  await writeFile(path.join(workspace, "public", "documents", "manual", PDF), "%PDF-1.7 data");
  // The handlers resolve their root from `process.cwd()/public`, exactly as in the container.
  vi.spyOn(process, "cwd").mockReturnValue(workspace);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(workspace, { recursive: true, force: true });
});

describe("route wiring", () => {
  test("GET /uploads serves from the uploads root", async () => {
    const response = await getUpload(new Request(`http://localhost/uploads/${WEBP}`), params([WEBP]));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
  });

  test("GET /documents serves from the documents root", async () => {
    const response = await getDocument(new Request(`http://localhost/documents/manual/${PDF}`), params(["manual", PDF]));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
  });

  test("each handler is bound to its own root and cannot read the other", async () => {
    const crossToUploads = await getDocument(new Request("http://localhost/documents/x"), params(["..", "uploads", WEBP]));
    const crossToDocuments = await getUpload(new Request("http://localhost/uploads/x"), params(["..", "documents", "manual", PDF]));

    expect(crossToUploads.status).toBe(404);
    expect(crossToDocuments.status).toBe(404);
  });

  test("HEAD is exported by both routes and returns headers without a body", async () => {
    const image = await headUpload(new Request(`http://localhost/uploads/${WEBP}`, { method: "HEAD" }), params([WEBP]));
    const document = await headDocument(new Request(`http://localhost/documents/manual/${PDF}`, { method: "HEAD" }), params(["manual", PDF]));

    expect([image.status, document.status]).toEqual([200, 200]);
    expect(image.body).toBeNull();
    expect(document.headers.get("content-length")).toBe("13");
  });
});
