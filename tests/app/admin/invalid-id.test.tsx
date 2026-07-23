// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

// These pages take a route param that flows into a uuid column. The guarantee under test:
// a malformed id must short-circuit to notFound() BEFORE any repository call, so Postgres
// never sees "not-a-uuid" and the page never 500s.

const { mockNotFound, mockRequirePermission } = vi.hoisted(() => ({
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  mockRequirePermission: vi.fn().mockResolvedValue({ id: "u1", email: "a@b.co", role: "admin" }),
}));

vi.mock("next/navigation", () => ({ notFound: mockNotFound }));
vi.mock("@/server/auth/guards", () => ({ requirePermission: mockRequirePermission }));

const catalogGetters = vi.hoisted(() => ({
  getProductByIdForAdmin: vi.fn().mockResolvedValue(null),
  getCategoryByIdForAdmin: vi.fn().mockResolvedValue(null),
  getCategoryOptions: vi.fn().mockResolvedValue([]),
  getCategoryOptionsExcluding: vi.fn().mockResolvedValue([]),
}));
const leadGetters = vi.hoisted(() => ({
  getLead: vi.fn().mockResolvedValue(null),
  getLeadNotes: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/domains/catalog", () => ({
  ...catalogGetters,
  updateProduct: vi.fn(),
  updateCategory: vi.fn(),
}));
vi.mock("@/domains/leads", () => ({
  ...leadGetters,
  assignLead: vi.fn(),
  addLeadNote: vi.fn(),
}));

const { default: EditProductPage } = await import("@/app/admin/products/[id]/page");
const { default: EditCategoryPage } = await import("@/app/admin/categories/[id]/page");
const { default: LeadDetailPage } = await import("@/app/admin/leads/[id]/page");

afterEach(() => {
  vi.clearAllMocks();
});

async function expectNotFound(render: () => Promise<unknown>) {
  await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mockNotFound).toHaveBeenCalled();
}

describe("invalid uuid route params render not-found without touching the repository", () => {
  test("product edit page", async () => {
    await expectNotFound(() => EditProductPage({ params: Promise.resolve({ id: "not-a-uuid" }) }));
    expect(catalogGetters.getProductByIdForAdmin).not.toHaveBeenCalled();
  });

  test("category edit page", async () => {
    await expectNotFound(() => EditCategoryPage({ params: Promise.resolve({ id: "not-a-uuid" }) }));
    expect(catalogGetters.getCategoryByIdForAdmin).not.toHaveBeenCalled();
  });

  test("lead detail page", async () => {
    await expectNotFound(() => LeadDetailPage({ params: Promise.resolve({ id: "not-a-uuid" }) }));
    expect(leadGetters.getLead).not.toHaveBeenCalled();
  });
});

describe("a well-formed but missing id still renders not-found", () => {
  const validMissing = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  test("product edit page queries then 404s", async () => {
    await expectNotFound(() => EditProductPage({ params: Promise.resolve({ id: validMissing }) }));
    // With a valid id the repository IS consulted; it just returns null here.
    expect(catalogGetters.getProductByIdForAdmin).toHaveBeenCalledWith(validMissing);
  });
});
