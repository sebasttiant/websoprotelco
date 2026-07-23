import Image from "next/image";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DesignImageUploadField } from "@/components/admin/design-image-upload-field";
import { createBanner, deleteBanner, getAdminBanners, getHeroSettings, isSafeDesignImagePath, updateBanner, updateHeroSettings } from "@/domains/design";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}

export default async function AdminDesignPage({ searchParams }: { searchParams?: Promise<{ error?: string }> } = {}) {
  await requirePermission("design:read");

  const [banners, hero] = await Promise.all([getAdminBanners(), getHeroSettings()]);
  const error = (await searchParams)?.error;

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Administración</p>
        <h1 className="text-3xl font-black text-slate-950">Diseño del sitio</h1>
      </div>
      {error ? <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">No se pudo guardar el diseño. Usá una ruta interna o una URL http(s).</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <form action={updateHeroSettings as unknown as FormAction} className="space-y-4 rounded-lg border border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Configuración del hero</h2>
            <p className="text-sm font-medium text-slate-500">Personaliza el contenido del hero de la página de inicio.</p>
          </div>
          <DesignImageUploadField name="backgroundImage" label="Fondo del hero" target="hero" defaultValue={hero.backgroundImage} />
          <div>
            <label htmlFor="hero-title" className="block text-xs font-bold text-slate-500">
              Título
            </label>
            <input id="hero-title" name="title" type="text" defaultValue={hero.title} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="hero-subtitle" className="block text-xs font-bold text-slate-500">
              Subtítulo
            </label>
            <textarea id="hero-subtitle" name="subtitle" defaultValue={hero.subtitle} required className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="ctaText" className="block text-xs font-bold text-slate-500">
                Texto del botón
              </label>
              <input id="ctaText" name="ctaText" type="text" defaultValue={hero.ctaText} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="ctaLink" className="block text-xs font-bold text-slate-500">
                Enlace del botón
              </label>
              <input id="ctaLink" name="ctaLink" type="text" defaultValue={hero.ctaLink} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white">
            Guardar hero
          </button>
        </form>

        <form action={createBanner as unknown as FormAction} className="space-y-4 rounded-lg border border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Crear banner</h2>
            <p className="text-sm font-medium text-slate-500">Los banners activos y programados aparecen en la página de inicio (máximo cinco).</p>
          </div>
          <DesignImageUploadField name="imagePath" label="Imagen del banner" target="banners" />
          <div>
            <label htmlFor="banner-title" className="block text-xs font-bold text-slate-500">
              Título
            </label>
            <input id="banner-title" name="title" type="text" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="subtitle" className="block text-xs font-bold text-slate-500">
              Subtítulo
            </label>
            <textarea id="subtitle" name="subtitle" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="displayOrder" className="block text-xs font-bold text-slate-500">
                Orden de visualización
              </label>
              <input id="displayOrder" name="displayOrder" type="number" defaultValue={0} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="linkUrl" className="block text-xs font-bold text-slate-500">
                URL de enlace
              </label>
              <input id="linkUrl" name="linkUrl" type="text" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="startDate" className="block text-xs font-bold text-slate-500">
                Fecha de inicio
              </label>
              <input id="startDate" name="startDate" type="date" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-xs font-bold text-slate-500">
                Fecha de fin
              </label>
              <input id="endDate" name="endDate" type="date" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input name="isActive" type="checkbox" defaultChecked className="size-4" />
            Activo
          </label>
          <button type="submit" className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white">
            Guardar banner
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">Banners</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Imagen</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Orden</th>
                <th className="px-4 py-3">Programación</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
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
                        <span className="font-bold text-slate-400">No disponible</span>
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
                          Guardar
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(banner.startDate)} → {formatDate(banner.endDate)}
                    </td>
                    <td className="px-4 py-3">{banner.isActive ? "Activo" : "Inactivo"}</td>
                    <td className="px-4 py-3">
                      <form action={deleteBanner as unknown as FormAction}>
                        <input type="hidden" name="id" value={banner.id} />
                        <ConfirmDialog
                          message={`¿Eliminar el banner "${banner.title}"? Esta acción no se puede deshacer.`}
                          triggerClassName="font-bold text-rose-600 hover:underline"
                        >
                          Eliminar
                        </ConfirmDialog>
                      </form>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center font-medium text-slate-500">
                    No se encontraron banners.
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
