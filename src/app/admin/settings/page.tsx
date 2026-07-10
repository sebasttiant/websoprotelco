import { getAllSettings, updateSetting } from "@/domains/settings";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // Settings are admin-only. The RBAC matrix grants "settings:read" to the admin
  // role only (staff does not have it), so this guard runs before any query is issued.
  await requirePermission("settings:read");

  const settings = await getAllSettings();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Administration</p>
        <h1 className="text-3xl font-black text-slate-950">Settings</h1>
      </div>
      <div className="space-y-4">
        {settings.map((setting) => (
          <form
            key={setting.id}
            action={async (formData) => {
              "use server";
              await updateSetting(formData);
            }}
            className="space-y-2 rounded-lg border border-slate-200 p-4"
          >
            <input type="hidden" name="key" value={setting.key} />
            <label htmlFor={`setting-${setting.key}`} className="block text-sm font-black text-slate-950">
              {setting.key}
            </label>
            {setting.description ? <p className="text-xs text-slate-500">{setting.description}</p> : null}
            <input
              id={`setting-${setting.key}`}
              name="value"
              type="text"
              defaultValue={setting.value ?? ""}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white"
            >
              Save
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
