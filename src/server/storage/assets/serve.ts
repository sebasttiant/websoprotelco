import path from "node:path";
import { Readable } from "node:stream";
import type { FileHandle } from "node:fs/promises";

import { errorCode, logAssetFailure } from "./diagnostics";
import { buildValidator, matchesValidator, parseRange, type ByteRange } from "./http";
import { openRuntimeAsset } from "./open";
import {
  ASSET_CACHE_CONTROL,
  MISS_CACHE_CONTROL,
  STORAGE_RETRY_AFTER_SECONDS,
  type RuntimeAssetRoot,
} from "./policy";

/**
 * Response construction for runtime assets: takes an opened descriptor and turns it into an HTTP
 * response, owning the descriptor's lifetime end to end.
 */

function dataDirectory(): string {
  return path.join(process.cwd(), "data");
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": MISS_CACHE_CONTROL },
  });
}

/**
 * A missing, unreadable or failing mount is an OPERATIONAL fault, not a missing file. Answering
 * 404 there would tell a monitor "this product has no image" while the real story is "the uploads
 * volume is gone", and the deploy gate would stay green through it.
 */
function storageUnavailable(): Response {
  return new Response("Storage Unavailable", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": MISS_CACHE_CONTROL,
      "Retry-After": STORAGE_RETRY_AFTER_SECONDS,
    },
  });
}

/**
 * Streams from the already-open handle and closes it exactly once — on completion, on error, and
 * on consumer cancellation.
 *
 * All three events are needed: with `autoClose: false` a stream that finishes normally emits `end`
 * and is never destroyed (so `close` never fires), while a client that aborts destroys the stream
 * without ever reaching `end`.
 *
 * A failure after the first byte cannot change the status code, so it is logged with enough
 * structure to be diagnosed in production and nothing that identifies customer content.
 */
function streamFrom(handle: FileHandle, root: RuntimeAssetRoot, range?: ByteRange): ReadableStream<Uint8Array> {
  const nodeStream = handle.createReadStream({
    autoClose: false,
    ...(range ? { start: range.start, end: range.end } : {}),
  });

  let released = false;
  const release = (): void => {
    if (released) {
      return;
    }

    released = true;
    void handle.close().catch(() => undefined);
  };

  nodeStream.once("end", release);
  nodeStream.once("close", release);
  nodeStream.once("error", (error: unknown) => {
    // Headers are already committed at this point; this log is the only signal that a download
    // was truncated by an I/O fault rather than by the client.
    logAssetFailure(root, "stream", errorCode(error));
    release();
  });

  return Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
}

/**
 * Serves an asset written at runtime.
 *
 * The descriptor is opened and verified BEFORE any response is constructed, and ownership passes
 * to the response stream only once that stream has been constructed successfully — so a stream
 * constructor that throws cannot strand an open descriptor.
 *
 * `baseDirectory` is injectable so tests drive real files through the real code path instead of
 * mocking the filesystem.
 */
export async function serveRuntimeAsset(
  root: RuntimeAssetRoot,
  segments: readonly string[],
  request: Request,
  baseDirectory: string = dataDirectory(),
): Promise<Response> {
  const opened = await openRuntimeAsset(root, segments, baseDirectory);

  if (opened.outcome === "absent") {
    return notFound();
  }

  if (opened.outcome === "unavailable") {
    logAssetFailure(root, opened.operation, opened.code);

    return storageUnavailable();
  }

  const { handle, stats, contentType } = opened;
  let streamOwnsHandle = false;

  try {
    const validator = buildValidator(stats);
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": ASSET_CACHE_CONTROL,
      ETag: validator,
      "Last-Modified": new Date(stats.mtimeMs).toUTCString(),
      "Accept-Ranges": "bytes",
    });

    if (matchesValidator(request.headers.get("if-none-match"), validator)) {
      return new Response(null, { status: 304, headers });
    }

    if (request.method === "HEAD") {
      headers.set("Content-Length", String(stats.size));

      return new Response(null, { status: 200, headers });
    }

    // `If-Range` with a weak validator can never authorise a partial response (RFC 9110 §13.1.5),
    // and ours is weak by construction, so any If-Range request falls back to the full body.
    const range = request.headers.get("if-range")
      ? ({ kind: "full" } as const)
      : parseRange(request.headers.get("range"), stats.size);

    if (range.kind === "unsatisfiable") {
      headers.set("Content-Range", `bytes */${stats.size}`);

      return new Response(null, { status: 416, headers });
    }

    const slice = range.kind === "single" ? range : undefined;

    if (slice) {
      headers.set("Content-Range", `bytes ${slice.start}-${slice.end}/${stats.size}`);
      headers.set("Content-Length", String(slice.end - slice.start + 1));
    } else {
      headers.set("Content-Length", String(stats.size));
    }

    // Construct first, transfer ownership only on success: if this throws, the `finally` below is
    // still the owner and closes the descriptor.
    const body = streamFrom(handle, root, slice);
    streamOwnsHandle = true;

    return new Response(body, { status: slice ? 206 : 200, headers });
  } catch (error) {
    logAssetFailure(root, "read", errorCode(error));

    return storageUnavailable();
  } finally {
    // Every path that did not hand the descriptor to a stream closes it here: 304, HEAD, 416, or a
    // throw during response construction.
    if (!streamOwnsHandle) {
      await handle.close().catch(() => undefined);
    }
  }
}
