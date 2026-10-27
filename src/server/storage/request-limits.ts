/**
 * Bounded multipart reading.
 *
 * `request.formData()` buffers the WHOLE body before any `File.size` check can run, so a
 * per-file cap is validation, not protection: an oversized or length-spoofing body is already
 * in memory by the time it is rejected. A declared `content-length` is only a hint — it can be
 * omitted or forged — so the byte count is enforced while the body streams, and the producer is
 * cancelled the moment it crosses the limit instead of being drained.
 *
 * Memory is therefore bounded by `maxBytes`, which is the point; this is deliberately not a
 * streaming multipart parser, because the per-field work downstream needs the complete part.
 */

export class RequestBodyTooLargeError extends Error {
  constructor(message = "Request body exceeds the configured limit.") {
    super(message);
    this.name = "RequestBodyTooLargeError";
  }
}

function concat(chunks: readonly Uint8Array[], total: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

async function collectBounded(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let seen = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!value) continue;

      seen += value.byteLength;

      if (seen > maxBytes) {
        // Cancelling is what makes this a bound rather than a late verdict: an endless producer
        // is cut off here instead of filling memory until the limit check "wins".
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return concat(chunks, seen);
}

/**
 * Parses multipart form data, refusing anything past `maxBytes` before it is buffered.
 *
 * Throws {@link RequestBodyTooLargeError} for an oversized body — declared or not — and lets a
 * genuine parse failure surface unchanged, so a malformed body is never reported as too large.
 */
export async function readBoundedFormData(request: Request, maxBytes: number): Promise<FormData> {
  const declared = Number(request.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  const body = request.body;

  if (!body) {
    return request.formData();
  }

  const bytes = await collectBounded(body, maxBytes);
  const contentType = request.headers.get("content-type");

  return new Response(bytes, {
    headers: contentType ? { "content-type": contentType } : undefined,
  }).formData();
}
