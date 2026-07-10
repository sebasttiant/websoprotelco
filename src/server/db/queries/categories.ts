import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  position: number;
  imageUrl: string | null;
}

interface CategoryRow extends QueryResultRow {
  id: string;
  slug: string;
  name: string;
  display_order: number;
  image_url: string | null;
}

export async function getCategories(): Promise<CategorySummary[]> {
  const rows = await query<CategoryRow>(
    `SELECT id, slug, name, display_order, image_url
     FROM categories
     ORDER BY display_order ASC, name ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    position: row.display_order,
    imageUrl: row.image_url,
  }));
}
