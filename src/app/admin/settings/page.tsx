import {
  adminCard,
  adminEyebrow,
  adminInput,
  adminLead,
  adminPage,
  adminPrimaryBtn,
  adminTitle,
} from "@/components/admin/ui";
import { getAllSettings, updateSetting } from "@/domains/settings";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

const SETTING_LABELS: Record<string, string> = {
  site_name: "Nombre del sitio",
  site_description: "Descripción corta",
  contact_email: "Correo de contacto",
  contact_phone: "Teléfono",
  address: "Dirección",
  business_hours: "Horario de atención",
  whatsapp_number: "WhatsApp (con código de país)",
  facebook_url: "Facebook",
  instagram_url: "Instagram",
  linkedin_url: "LinkedIn",
};

const SETTING_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "Identidad del sitio",
    keys: ["site_name", "site_description"],
  },
  {
    title: "Contacto",
    keys: ["contact_email", "contact_phone", "whatsapp_number", "address", "business_hours"],
  },
  {
    title: "Redes sociales",
    keys: ["facebook_url", "instagram_url", "linkedin_url"],
  },
];

const SETTING_INPUT: Record<
  string,
  { type: "text" | "email" | "url" | "tel"; maxLength?: number; placeholder?: string }
> = {
  site_name: { type: "text", maxLength: 120 },
  site_description: { type: "text", maxLength: 500 },
  contact_email: { type: "email", maxLength: 254, placeholder: "ventas@empresa.com" },
  contact_phone: { type: "tel", maxLength: 40, placeholder: "+57 300 123 4567" },
  whatsapp_number: { type: "tel", maxLength: 20, placeholder: "+573001234567" },
  address: { type: "text", maxLength: 200 },
  business_hours: { type: "text", maxLength: 120 },
  facebook_url: { type: "url", maxLength: 500, placeholder: "https://facebook.com/..." },
  instagram_url: { type: "url", maxLength: 500, placeholder: "https://instagram.com/..." },
  linkedin_url: { type: "url", maxLength: 500, placeholder: "https://linkedin.com/..." },
};

type FormAction = (formData: FormData) => Promise<void>;

export default async function AdminSettingsPage() {
  // Settings are admin-only. The RBAC matrix grants "settings:read" to the admin
  // role only (staff does not have it), so this guard runs before any query is issued.
  await requirePermission("settings:read");

  const settings = await getAllSettings();
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const knownKeys = new Set(SETTING_GROUPS.flatMap((group) => group.keys));
  const extras = settings.filter((setting) => !knownKeys.has(setting.key));
  const saveAction = updateSetting as unknown as FormAction;

  return (
    <section className={adminPage}>
      <div className="min-w-0">
        <p className={adminEyebrow}>Administración</p>
        <h1 className={adminTitle}>Configuración</h1>
        <p className={adminLead}>
          Datos que usa la tienda: contacto, WhatsApp, horarios y redes. Guardá cada campo por separado.
          Valores inválidos (email, URL o WhatsApp) se rechazan para no romper el sitio.
        </p>
      </div>

      <div className="space-y-5">
        {SETTING_GROUPS.map((group) => {
          const rows = group.keys.map((key) => byKey.get(key)).filter(Boolean);
          if (rows.length === 0) return null;

          return (
            <section key={group.title} className={`${adminCard} space-y-1`}>
              <h2 className="pb-3 text-sm font-black text-brand-navy">{group.title}</h2>
              <div className="divide-y divide-slate-100">
                {rows.map((setting) => {
                  if (!setting) return null;
                  const field = SETTING_INPUT[setting.key] ?? { type: "text" as const, maxLength: 2000 };
                  return (
                    <form key={setting.id} action={saveAction} className="grid gap-2 py-4 first:pt-0 last:pb-0">
                      <input type="hidden" name="key" value={setting.key} />
                      <label htmlFor={`setting-${setting.key}`} className="text-sm font-bold text-slate-800">
                        {SETTING_LABELS[setting.key] ?? setting.key}
                      </label>
                      {setting.description ? (
                        <p className="text-xs font-medium text-slate-500">{setting.description}</p>
                      ) : null}
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          id={`setting-${setting.key}`}
                          name="value"
                          type={field.type}
                          defaultValue={setting.value ?? ""}
                          maxLength={field.maxLength}
                          placeholder={field.placeholder}
                          spellCheck={field.type === "text"}
                          className={`${adminInput} flex-1`}
                        />
                        <button type="submit" className={adminPrimaryBtn}>
                          Guardar
                        </button>
                      </div>
                    </form>
                  );
                })}
              </div>
            </section>
          );
        })}

        {extras.length > 0 ? (
          <section className={`${adminCard} space-y-1`}>
            <h2 className="pb-3 text-sm font-black text-brand-navy">Otras claves (solo lectura)</h2>
            <p className="pb-2 text-xs font-medium text-slate-500">
              Claves no reconocidas no se editan desde el panel para evitar dañar la configuración.
            </p>
            <div className="divide-y divide-slate-100">
              {extras.map((setting) => (
                <div key={setting.id} className="grid gap-1 py-4 first:pt-0 last:pb-0">
                  <p className="text-sm font-bold text-slate-800">{setting.key}</p>
                  {setting.description ? (
                    <p className="text-xs font-medium text-slate-500">{setting.description}</p>
                  ) : null}
                  <p className="break-words rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700">
                    {setting.value || "—"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
