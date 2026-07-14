import Image from "next/image";

import { DesignImageUploadField } from "@/components/admin/design-image-upload-field";
import { createBanner, deleteBanner, getAdminBanners, getHeroSettings, isSafeDesignImagePath, updateBanner, updateHeroSettings } from "@/domains/design";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}

export default async function AdminDesignPage() {
  await requirePermission("design:read");

  const [banners, hero] = await Promise.all([getAdminBanners(), getHeroSettings()]);

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Administration</p>
        <h1 className="text-3xl font-black text-slate-950">Design</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <form action={updateHeroSettings as unknown as FormAction} className="space-y-4 rounded-lg border border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Hero settings</h2>
            <p className="text-sm font-medium text-slate-500">Customize the homepage hero content.</p>
          </div>
          <DesignImageUploadField name="backgroundImage" label="Hero background" target="hero" defaultValue={hero.backgroundImage} />
          <div>
            <label htmlFor="hero-title" className="block text-xs font-bold text-slate-500">
              Title
            </label>
            <input id="hero-title" name="title" type="text" defaultValue={hero.title} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="hero-subtitle" className="block text-xs font-bold text-slate-500">
              Subtitle
            </label>
            <textarea id="hero-subtitle" name="subtitle" defaultValue={hero.subtitle} required className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="ctaText" className="block text-xs font-bold text-slate-500">
                CTA text
              </label>
              <input id="ctaText" name="ctaText" type="text" defaultValue={hero.ctaText} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="ctaLink" className="block text-xs font-bold text-slate-500">
                CTA link
              </label>
              <input id="ctaLink" name="ctaLink" type="text" defaultValue={hero.ctaLink} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white">
            Save hero
          </button>
        </form>

        <form action={createBanner as unknown as FormAction} className="space-y-4 rounded-lg border border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Create banner</h2>
            <p className="text-sm font-medium text-slate-500">Active scheduled banners appear on the homepage, limited to five.</p>
          </div>
          <DesignImageUploadField name="imagePath" label="Banner image" target="banners" />
          <div>
            <label htmlFor="banner-title" className="block text-xs font-bold text-slate-500">
              Title
            </label>
            <input id="banner-title" name="title" type="text" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="subtitle" className="block text-xs font-bold text-slate-500">
              Subtitle
            </label>
            <textarea id="subtitle" name="subtitle" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="displayOrder" className="block text-xs font-bold text-slate-500">
                Display order
              </label>
              <input id="displayOrder" name="displayOrder" type="number" defaultValue={0} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="linkUrl" className="block text-xs font-bold text-slate-500">
                Link URL
              </label>
              <input id="linkUrl" name="linkUrl" type="url" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="startDate" className="block text-xs font-bold text-slate-500">
                Start date
              </label>
              <input id="startDate" name="startDate" type="date" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-xs font-bold text-slate-500">
                End date
              </label>
              <input id="endDate" name="endDate" type="date" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input name="isActive" type="checkbox" defaultChecked className="size-4" />
            Active
          </label>
          <button type="submit" className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white">
            Save banner
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">Banners</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {banners.length > 0 ? (
                banners.map((banner) => (
                  <tr key={banner.id}>
                    <td className="px-4 py-3">
                      {isSafeDesignImagePath(banner.imagePath) ? (
                        <div className="relative h-16 w-28 overflow-hidden rounded-lg border border-slate-200">
                          <Image src={banner.imagePath} alt="" fill sizes="112px" className="object-cover" />
                        </div>
                      ) : (
                        <span className="font-bold text-slate-400">Unavailable</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{banner.title}</p>
                      <p className="text-xs font-medium text-slate-500">{banner.subtitle ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <form action={updateBanner as unknown as FormAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={banner.id} />
                        <input type="hidden" name="title" value={banner.title} />
                        <input type="hidden" name="subtitle" value={banner.subtitle ?? ""} />
                        <input type="hidden" name="imagePath" value={banner.imagePath} />
                        <input type="hidden" name="linkUrl" value={banner.linkUrl ?? ""} />
                        <input type="hidden" name="startDate" value={banner.startDate?.slice(0, 10) ?? ""} />
                        <input type="hidden" name="endDate" value={banner.endDate?.slice(0, 10) ?? ""} />
                        {banner.isActive ? <input type="hidden" name="isActive" value="on" /> : null}
                        <input name="displayOrder" type="number" defaultValue={banner.displayOrder} className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
                        <button type="submit" className="font-bold text-brand-blue hover:underline">
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(banner.startDate)} → {formatDate(banner.endDate)}
                    </td>
                    <td className="px-4 py-3">{banner.isActive ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-3">
                      <form action={deleteBanner as unknown as FormAction}>
                        <input type="hidden" name="id" value={banner.id} />
                        <button type="submit" className="font-bold text-red-600 hover:underline">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center font-medium text-slate-500">
                    No banners found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
