import type { Stats } from "node:fs";

/**
 * HTTP conditional-request and Range semantics. Pure functions over metadata — no filesystem, no
 * descriptors — so every edge case is testable without touching disk.
 */

/**
 * A WEAK validator, deliberately. It is derived from size and mtime, which is exactly what a weak
 * validator is for; calling it strong would be a lie the moment two writes landed in the same
 * millisecond with the same length, and hashing megabytes of image on every request to earn the
 * word "strong" buys nothing here — stored files are immutable under a fresh UUID name.
 */
export function buildValidator(stats: Stats): string {
  return `W/"${stats.size.toString(16)}-${Math.trunc(stats.mtimeMs).toString(16)}"`;
}

/**
 * `If-None-Match` per RFC 9110 §13.1.2: a list, or `*`, compared with the weak comparison
 * function — so `W/"x"` and `"x"` both match `W/"x"`.
 */
export function matchesValidator(headerValue: string | null, validator: string): boolean {
  if (!headerValue) {
    return false;
  }

  const candidates = headerValue.split(",").map((value) => value.trim());

  if (candidates.includes("*")) {
    return true;
  }

  const strip = (value: string): string => (value.startsWith("W/") ? value.slice(2) : value);

  return candidates.some((candidate) => strip(candidate) === strip(validator));
}

export interface ByteRange {
  start: number;
  end: number;
}

export type RangeOutcome = { kind: "full" } | { kind: "unsatisfiable" } | ({ kind: "single" } & ByteRange);

/**
 * Single `bytes=` range only — enough for a PDF viewer paging through a document, which is the one
 * client that actually asks. A multi-range request is answered with the full representation
 * (RFC 9110 §14.2 permits ignoring an unsupported Range) rather than a wrong 206, and a
 * syntactically broken header is ignored the same way. Only a well-formed range that cannot be
 * satisfied earns a 416.
 *
 * A zero-byte representation can satisfy NO range at all: every `bytes=` request against it is
 * unsatisfiable. Getting this wrong previously produced `{ start: 0, end: -1 }`, which threw
 * inside stream construction and leaked a descriptor on every request.
 */
export function parseRange(headerValue: string | null, size: number): RangeOutcome {
  if (!headerValue) {
    return { kind: "full" };
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(headerValue.trim());

  if (!match) {
    return { kind: "full" };
  }

  const [, rawStart = "", rawEnd = ""] = match;

  if (rawStart === "" && rawEnd === "") {
    return { kind: "full" };
  }

  if (size === 0) {
    return { kind: "unsatisfiable" };
  }

  if (rawStart === "") {
    const suffixLength = Number(rawEnd);

    return suffixLength === 0 ? { kind: "unsatisfiable" } : { kind: "single", start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);

  if (start >= size || start > end) {
    return { kind: "unsatisfiable" };
  }

  return { kind: "single", start, end };
}
