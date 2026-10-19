// @vitest-environment node
import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { RUNTIME_ASSET_ROOTS, serveRuntimeAsset } from "@/server/storage/assets";
import { parseRange } from "@/server/storage/assets/http";

let workspace: string;
let baseDirectory: string;

const IMAGE = "2026-07-26-39615f86-a97e-43e8-852a-e2d97cc6108c.webp";
const EMPTY = "2026-07-26-11111111-1111-4111-8111-111111111111.webp";
const DOCUMENT = "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f_manual.pdf";
const IMAGE_BYTES = Buffer.from("RIFF____WEBPVP8 image-payload");
const PDF_BYTES = Buffer.from("%PDF-1.7 document-payload-long-enough-to-slice");

const req = (method = "GET", headers?: HeadersInit): Request => new Request("http://localhost/asset", { method, headers });

const serveImage = (segments: string[], request: Request = req()): Promise<Response> =>
  serveRuntimeAsset(RUNTIME_ASSET_ROOTS.UPLOADS, segments, request, baseDirectory);

const serveDocument = (request: Request = req()): Promise<Response> =>
  serveRuntimeAsset(RUNTIME_ASSET_ROOTS.DOCUMENTS, ["manual", DOCUMENT], request, baseDirectory);

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "assets-http-"));
  baseDirectory = path.join(workspace, "public");
  await mkdir(path.join(baseDirectory, "uploads"), { recursive: true });
  await mkdir(path.join(baseDirectory, "documents", "manual"), { recursive: true });
  await writeFile(path.join(baseDirectory, "uploads", IMAGE), IMAGE_BYTES);
  await writeFile(path.join(baseDirectory, "uploads", EMPTY), "");
  await writeFile(path.join(baseDirectory, "documents", "manual", DOCUMENT), PDF_BYTES);
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("parseRange", () => {
  test.each([
    ["no header", null, 100, { kind: "full" }],
    ["malformed units", "kilobytes=0-1", 100, { kind: "full" }],
    ["multi-range (unsupported by design)", "bytes=0-1,4-5", 100, { kind: "full" }],
    ["empty bounds", "bytes=-", 100, { kind: "full" }],
    ["closed range", "bytes=0-9", 100, { kind: "single", start: 0, end: 9 }],
    ["open-ended range", "bytes=90-", 100, { kind: "single", start: 90, end: 99 }],
    ["suffix range", "bytes=-10", 100, { kind: "single", start: 90, end: 99 }],
    ["suffix longer than the file", "bytes=-500", 100, { kind: "single", start: 0, end: 99 }],
    ["end beyond the file is clamped", "bytes=90-500", 100, { kind: "single", start: 90, end: 99 }],
    ["start beyond the file", "bytes=100-", 100, { kind: "unsatisfiable" }],
    ["inverted range", "bytes=9-4", 100, { kind: "unsatisfiable" }],
    ["zero-length suffix", "bytes=-0", 100, { kind: "unsatisfiable" }],
    // A zero-byte representation satisfies no range at all. The previous implementation produced
    // { start: 0, end: -1 } here, which threw inside stream construction and leaked a descriptor.
    ["suffix against an empty file", "bytes=-1", 0, { kind: "unsatisfiable" }],
    ["open-ended against an empty file", "bytes=0-", 0, { kind: "unsatisfiable" }],
    ["single byte against an empty file", "bytes=0-0", 0, { kind: "unsatisfiable" }],
  ])("%s", (_label, header, size, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });
});

describe("conditional requests", () => {
  test("the validator is weak, because it is derived from metadata", async () => {
    const response = await serveImage([IMAGE], req("HEAD"));

    expect(response.headers.get("etag")).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
  });

  test.each([
    ["exact validator", (etag: string) => etag],
    ["strong spelling of the same validator", (etag: string) => etag.replace("W/", "")],
    ["validator list", (etag: string) => `W/"other", ${etag}`],
    ["wildcard", () => "*"],
  ])("returns 304 for %s", async (_label, build) => {
    const etag = (await serveImage([IMAGE], req("HEAD"))).headers.get("etag") ?? "";
    const response = await serveImage([IMAGE], req("GET", { "if-none-match": build(etag) }));

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
  });

  test("returns 200 for a stale validator", async () => {
    const response = await serveImage([IMAGE], req("GET", { "if-none-match": 'W/"deadbeef-1"' }));

    expect(response.status).toBe(200);
    await response.arrayBuffer();
  });

  test("a same-size replacement invalidates the validator", async () => {
    const first = (await serveImage([IMAGE], req("HEAD"))).headers.get("etag") ?? "";
    await writeFile(path.join(baseDirectory, "uploads", IMAGE), Buffer.alloc(IMAGE_BYTES.byteLength, 0x58));
    await utimes(path.join(baseDirectory, "uploads", IMAGE), new Date(), new Date(Date.now() + 5000));

    const second = await serveImage([IMAGE], req("GET", { "if-none-match": first }));
    await second.arrayBuffer();

    expect(second.status).toBe(200);
    expect(second.headers.get("etag")).not.toBe(first);
  });
});

describe("HEAD", () => {
  test("returns the GET headers with no body", async () => {
    const response = await serveImage([IMAGE], req("HEAD"));

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers.get("content-length")).toBe(String(IMAGE_BYTES.byteLength));
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });

  test("on a zero-byte file reports a zero length", async () => {
    const response = await serveImage([EMPTY], req("HEAD"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("0");
  });
});

describe("Range", () => {
  test("a valid range returns 206 with the requested slice", async () => {
    const response = await serveDocument(req("GET", { range: "bytes=0-4" }));

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(`bytes 0-4/${PDF_BYTES.byteLength}`);
    expect(response.headers.get("content-length")).toBe("5");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PDF_BYTES.subarray(0, 5));
  });

  test("an open-ended range serves through to the last byte", async () => {
    const response = await serveDocument(req("GET", { range: "bytes=10-" }));

    expect(Buffer.from(await response.arrayBuffer())).toEqual(PDF_BYTES.subarray(10));
  });

  test("a suffix range serves the final bytes", async () => {
    const response = await serveDocument(req("GET", { range: "bytes=-6" }));

    expect(Buffer.from(await response.arrayBuffer())).toEqual(PDF_BYTES.subarray(PDF_BYTES.byteLength - 6));
  });

  test.each([["bytes=99999-"], ["bytes=5-4"], ["bytes=-0"]])("%s is unsatisfiable", async (range) => {
    const response = await serveDocument(req("GET", { range }));

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe(`bytes */${PDF_BYTES.byteLength}`);
    expect(response.body).toBeNull();
  });

  test.each([["bytes=-1"], ["bytes=0-"], ["bytes=0-0"]])("%s against a zero-byte file returns 416, not 503", async (range) => {
    const response = await serveImage([EMPTY], req("GET", { range }));

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */0");
    expect(response.body).toBeNull();
  });

  test("a zero-byte file still serves an empty 200 without a Range header", async () => {
    const response = await serveImage([EMPTY]);

    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  test.each([
    ["a multi-range request", "bytes=0-1,4-5"],
    ["a malformed range header", "kilobytes=0-1"],
  ])("serves the complete representation for %s", async (_label, range) => {
    const response = await serveDocument(req("GET", { range }));

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PDF_BYTES);
  });

  test("If-Range with a weak validator falls back to the full representation", async () => {
    const etag = (await serveDocument(req("HEAD"))).headers.get("etag") ?? "";
    const response = await serveDocument(req("GET", { range: "bytes=0-4", "if-range": etag }));

    expect(response.status).toBe(200);
    await response.arrayBuffer();
  });
});
