// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

vi.mock("@/server/storage", () => ({
  createDocumentStorageAdapter: vi.fn(),
}));

import { getDocuments } from "@/domains/documents/service";

afterEach(() => {
  mockQuery.mockReset();
});

/** getDocuments runs the rows query and the count query via Promise.all; rows is first. */
function stubResults(): void {
  mockQuery.mockResolvedValueOnce([]);
  mockQuery.mockResolvedValueOnce([{ total: 0 }]);
}

function rowsQuery(): [string, unknown[]] {
  return mockQuery.mock.calls[0] as [string, unknown[]];
}

describe("getDocuments title search", () => {
  test("adds no title condition when no search term is given", async () => {
    stubResults();

    await getDocuments({}, 1);

    const [sql] = rowsQuery();
    expect(sql).not.toContain("d.title ILIKE");
  });

  test("matches the title when a term is given", async () => {
    stubResults();

    await getDocuments({ search: "catálogo" }, 1);

    const [sql, values] = rowsQuery();
    expect(sql).toContain("d.title ILIKE");
    expect(values[0]).toBe("%catálogo%");
  });

  // A typed "%" must filter literally; unescaped it is a wildcard matching every row, silently
  // disabling the filter while still looking like it worked.
  test("escapes LIKE wildcards in the search term", async () => {
    stubResults();

    await getDocuments({ search: "100%" }, 1);

    const [, values] = rowsQuery();
    expect(values[0]).toBe("%100\\%%");
  });

  test("combines the title search with a category filter using AND", async () => {
    stubResults();

    await getDocuments({ category: "manual", search: "router" }, 1);

    const [sql] = rowsQuery();
    expect(sql).toContain("d.category = $1");
    expect(sql).toContain("d.title ILIKE $2");
    expect(sql).toContain(" AND ");
  });
});
