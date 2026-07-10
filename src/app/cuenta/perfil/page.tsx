import Link from "next/link";

import { updateProfile } from "@/app/cuenta/actions";
import { requireSession } from "@/server/auth/guards";
import { query } from "@/server/db/pool";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface ProfileRow {
  email: string;
  full_name: string | null;
}

async function getProfile(userId: string): Promise<ProfileRow | null> {
  const rows = await query<ProfileRow>("SELECT email, full_name FROM users WHERE id = $1 LIMIT 1", [userId]);

  return rows[0] ?? null;
}

export default async function ProfilePage() {
  const session = await requireSession();
  const profile = await getProfile(session.id);
  const inputClass = "rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900";

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <Link href="/cuenta" className="text-sm font-bold text-brand-blue">← Back to account</Link>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Account</p>
        <h1 className="text-3xl font-black text-slate-950">Update profile</h1>
      </div>
      <form action={updateProfile as unknown as FormAction} className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <label className="grid gap-2 text-sm font-bold text-slate-700">Name<input name="name" required defaultValue={profile?.full_name ?? ""} className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Email<input name="email" type="email" required defaultValue={profile?.email ?? session.email} className={inputClass} /></label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">Save profile</button>
      </form>
    </main>
  );
}
