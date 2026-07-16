import * as repository from "./repository";
import type { BannerRow, HeroSettingsRow } from "./repository";
import { isSafeDesignLink, type BannerCreateInput, type BannerSummary, type BannerUpdateInput, type HeroSettings, type HeroSettingsUpdateInput } from "./schemas";

const DEFAULT_HERO_SETTINGS: HeroSettings = {
  id: null,
  backgroundImage: null,
  title: "Tu mejor aliado en productos y equipos para fibra óptica y tecnología",
  subtitle:
    "Equipos y suministros de fibra óptica y tecnología con asesoría experta. Diseño de proyectos. Stocks disponibles. Soporte a la medida. Envíos inmediatos a nivel nacional.",
  ctaText: "Ver Nuestros Productos",
  ctaLink: "/productos",
  updatedBy: null,
  updatedAt: null,
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mapBanner(row: BannerRow): BannerSummary {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imagePath: row.image_path,
    linkUrl: isSafeDesignLink(row.link_url) ? row.link_url : null,
    displayOrder: row.display_order,
    isActive: row.is_active,
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHeroSettings(row: HeroSettingsRow): HeroSettings {
  return {
    id: row.id,
    backgroundImage: row.background_image,
    title: row.title,
    subtitle: row.subtitle,
    ctaText: row.cta_text,
    ctaLink: isSafeDesignLink(row.cta_link) ? row.cta_link : DEFAULT_HERO_SETTINGS.ctaLink,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function createBanner(input: BannerCreateInput, createdBy: string | null): Promise<void> {
  await repository.createBanner(input, createdBy);
}

export async function getAdminBanners(): Promise<BannerSummary[]> {
  const rows = await repository.findAdminBanners();
  return rows.map(mapBanner);
}

export async function getPublicBanners(currentDate = new Date()): Promise<BannerSummary[]> {
  const rows = await repository.findPublicBanners(dateOnly(currentDate));
  return rows.map(mapBanner);
}

export async function deleteBanner(id: string): Promise<void> {
  await repository.deleteBannerById(id);
}

export async function updateBanner(input: BannerUpdateInput): Promise<void> {
  await repository.updateBanner(input);
}

export async function getHeroSettings(): Promise<HeroSettings> {
  const row = await repository.findHeroSettings();
  return row ? mapHeroSettings(row) : DEFAULT_HERO_SETTINGS;
}

export async function updateHeroSettings(input: HeroSettingsUpdateInput, updatedBy: string | null): Promise<void> {
  await repository.upsertHeroSettings(input, updatedBy);
}
