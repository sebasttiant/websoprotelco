// @vitest-environment node
import { describe, expect, test } from "vitest";

import { readBoundedFormData, RequestBodyTooLargeError } from "@/server/storage/request-limits";

/** A body whose length the server cannot know in advance: no `content-length` is sent. */
function streamedRequest(chunks: readonly Uint8Array[], headers: Record<string, string> = {}): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

  return new Request("http://localhost:8585/api/upload", {
    method: "POST",
    headers: { "content-type": "application/octet-stream", ...headers },
    body,
    // @ts-expect-error -- `duplex` is required by undici for a stream body and absent from the DOM types.
    duplex: "half",
  });
}

function multipartRequest(byteLength: number): Request {
  const formData = new FormData();
  const bytes = new Uint8Array(new ArrayBuffer(byteLength));
  formData.set("file", new File([bytes], "product.png", { type: "image/png" }));

  return new Request("http://localhost:8585/api/upload", { method: "POST", body: formData });
}

describe("readBoundedFormData", () => {
  test("parses a body that stays within the limit", async () => {
    const formData = await readBoundedFormData(multipartRequest(64), 1024 * 1024);
    const file = formData.get("file");

    expect(file).toBeInstanceOf(File);
    expect((file as File).size).toBe(64);
  });

  test("refuses a declared content-length over the limit before parsing", async () => {
    // The body is never produced: rejecting on the declared length is the cheap path.
    const request = streamedRequest([new Uint8Array(8)], { "content-length": String(10 * 1024) });

    await expect(readBoundedFormData(request, 1024)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  test("refuses an undeclared body that exceeds the limit while it streams", async () => {
    // No content-length at all: the only way to bound this is to count bytes as they arrive,
    // which is exactly the memory-exhaustion case a post-parse file check cannot prevent.
    const chunks = Array.from({ length: 4 }, () => new Uint8Array(512));
    const request = streamedRequest(chunks);

    await expect(readBoundedFormData(request, 1024)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  test("refuses a body that lies about its content-length while it streams", async () => {
    const chunks = Array.from({ length: 4 }, () => new Uint8Array(512));
    const request = streamedRequest(chunks, { "content-length": "8" });

    await expect(readBoundedFormData(request, 1024)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  test("stops reading at the limit instead of draining the whole body", async () => {
    let produced = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        produced += 1;
        controller.enqueue(new Uint8Array(512));
      },
    });
    const request = new Request("http://localhost:8585/api/upload", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body,
      // @ts-expect-error -- `duplex` is required by undici for a stream body and absent from the DOM types.
      duplex: "half",
    });

    await expect(readBoundedFormData(request, 1024)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    // An unbounded producer must be cut off, not consumed forever.
    expect(produced).toBeLessThan(32);
  });
});
