import { describe, expect, test, vi } from "vitest";

const getCategories = vi.hoisted(() => vi.fn());

vi.mock("@/domains/catalog", () => ({ getCategories }));

import { generateMetadata } from "@/app/productos/[category]/page";

describe("category page metadata", () => {
  test("titles the page after the category and canonicalizes to its path", async () => {
    getCategories.mockResolvedValue([
      { id: "c1", slug: "fusionadoras", name: "Fusionadoras", position: 1, imageUrl: null },
    ]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ category: "fusionadoras" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe("Fusionadoras");
    expect(metadata.alternates?.canonical).toBe("/productos/fusionadoras");
    expect(metadata.description).toContain("fusionadoras");
  });

  test("an unknown slug still gets a title, matching what the page renders", async () => {
    getCategories.mockResolvedValue([]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ category: "no-existe" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe("no-existe");
    expect(metadata.alternates?.canonical).toBe("/productos/no-existe");
  });
});
