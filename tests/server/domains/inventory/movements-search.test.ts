// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

import { getAllMovements } from "@/domains/inventory/service";
import { MOVEMENT_PAGE_SIZE } from "@/domains/inventory/service";

afterEach(() => {
  mockQuery.mockReset();
});

/** getAllMovements issues the rows query first, then the count, via Promise.all. */
function stubEmptyResults(): void {
  mockQuery.mockResolvedValueOnce([]);
  mockQuery.mockResolvedValueOnce([{ total: 0 }]);
}

function rowsQuery(): [string, unknown[]] {
  return mockQuery.mock.calls[0] as [string, unknown[]];
}

describe("getAllMovements filtering", () => {
  test("omits the WHERE clause entirely when no search term is given", async () => {
    stubEmptyResults();

    await getAllMovements("", 1);

    const [sql, values] = rowsQuery();
    expect(sql).not.toContain("WHERE");
    // Only LIMIT and OFFSET remain.
    expect(values).toEqual([MOVEMENT_PAGE_SIZE, 0]);
  });

  test("matches the product name and the note, not just the product", async () => {
    stubEmptyResults();

    await getAllMovements("carrete", 1);

    const [sql] = rowsQuery();
    expect(sql).toContain("p.name ILIKE $1");
    expect(sql).toContain("m.notes ILIKE $1");
  });

  // A `%` typed into the search box means the literal character. Passed through unescaped it
  // is a LIKE wildcard, so "50%" would match every row and the search would silently stop
  // filtering while still looking like it worked.
  test("escapes LIKE wildcards so a typed % filters instead of matching everything", async () => {
    stubEmptyResults();

    await getAllMovements("50%", 1);

    const [, values] = rowsQuery();
    expect(values[0]).toBe("%50\\%%");
  });

  test("escapes the single-character wildcard too", async () => {
    stubEmptyResults();

    await getAllMovements("a_b", 1);

    const [, values] = rowsQuery();
    expect(values[0]).toBe("%a\\_b%");
  });

  // Backslash must be escaped FIRST, or it would go on to escape the escapes added after it.
  test("escapes a literal backslash without corrupting the other escapes", async () => {
    stubEmptyResults();

    await getAllMovements("a\\%b", 1);

    const [, values] = rowsQuery();
    expect(values[0]).toBe("%a\\\\\\%b%");
  });

  test("trims the term so a stray space does not become a filter", async () => {
    stubEmptyResults();

    await getAllMovements("   ", 1);

    const [sql] = rowsQuery();
    expect(sql).not.toContain("WHERE");
  });

  test("clamps a non-positive page to the first page instead of a negative OFFSET", async () => {
    stubEmptyResults();

    await getAllMovements("", -5);

    const [, values] = rowsQuery();
    expect(values[1]).toBe(0);
  });

  test("offsets by whole pages", async () => {
    stubEmptyResults();

    await getAllMovements("", 3);

    const [, values] = rowsQuery();
    expect(values[1]).toBe(MOVEMENT_PAGE_SIZE * 2);
  });
});
