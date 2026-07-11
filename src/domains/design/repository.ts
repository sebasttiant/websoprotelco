import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

import type { BannerCreateInput, BannerUpdateInput, HeroSettingsUpdateInput } from "./schemas";

export interface BannerRow extends QueryResultRow {
  id: string;
  title: string;
  subtitle: string | null;
  image_path: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HeroSettingsRow extends QueryResultRow {
  id: string;
  background_image: string | null;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  updated_by: string | null;
  updated_at: string;
}

const BANNER_SELECT = `
  SELECT id, title, subtitle, image_path, link_url, display_order, is_active,
         start_date, end_date, created_by, created_at, updated_at
  FROM banners
`;

export async function createBanner(input: BannerCreateInput, createdBy: string | null): Promise<void> {
  await query(
    `INSERT INTO banners (title, subtitle, image_path, link_url, display_order, is_active, start_date, end_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.title,
      input.subtitle ?? null,
      input.imagePath,
      input.linkUrl ?? null,
      input.displayOrder,
      input.isActive,
      input.startDate ?? null,
      input.endDate ?? null,
      createdBy,
    ],
  );
}

export async function findAdminBanners(): Promise<BannerRow[]> {
  return query<BannerRow>(`${BANNER_SELECT} ORDER BY display_order ASC, created_at DESC`);
}

export async function findPublicBanners(currentDate: string): Promise<BannerRow[]> {
  return query<BannerRow>(
    `${BANNER_SELECT}
     WHERE is_active = true
       AND (start_date IS NULL OR start_date <= $1::date)
       AND (end_date IS NULL OR end_date >= $1::date)
     ORDER BY display_order ASC, created_at DESC
     LIMIT 5`,
    [currentDate],
  );
}

export async function updateBanner(input: BannerUpdateInput): Promise<void> {
  await query(
    `UPDATE banners
     SET title = $2,
         subtitle = $3,
         image_path = $4,
         link_url = $5,
         display_order = $6,
         is_active = $7,
         start_date = $8,
         end_date = $9,
         updated_at = NOW()
     WHERE id = $1`,
    [
      input.id,
      input.title,
      input.subtitle ?? null,
      input.imagePath,
      input.linkUrl ?? null,
      input.displayOrder,
      input.isActive,
      input.startDate ?? null,
      input.endDate ?? null,
    ],
  );
}

export async function deleteBannerById(id: string): Promise<void> {
  await query("DELETE FROM banners WHERE id = $1", [id]);
}

export async function findHeroSettings(): Promise<HeroSettingsRow | null> {
  const rows = await query<HeroSettingsRow>(
    `SELECT id, background_image, title, subtitle, cta_text, cta_link, updated_by, updated_at
     FROM hero_settings
     ORDER BY updated_at DESC
     LIMIT 1`,
  );

  return rows[0] ?? null;
}

export async function upsertHeroSettings(input: HeroSettingsUpdateInput, updatedBy: string | null): Promise<void> {
  await query(
    `INSERT INTO hero_settings (background_image, title, subtitle, cta_text, cta_link, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT ((id IS NOT NULL)) DO UPDATE SET
       background_image = EXCLUDED.background_image,
       title = EXCLUDED.title,
       subtitle = EXCLUDED.subtitle,
       cta_text = EXCLUDED.cta_text,
       cta_link = EXCLUDED.cta_link,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [input.backgroundImage, input.title, input.subtitle, input.ctaText, input.ctaLink, updatedBy],
  );
}
