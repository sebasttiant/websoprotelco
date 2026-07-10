import Link from "next/link";

import { changePassword } from "@/app/cuenta/actions";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

export default function ChangePasswordPage() {
  const inputClass = "rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900";

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <Link href="/cuenta" className="text-sm font-bold text-brand-blue">← Back to account</Link>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Account</p>
        <h1 className="text-3xl font-black text-slate-950">Change password</h1>
      </div>
      <form action={changePassword as unknown as FormAction} className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <label className="grid gap-2 text-sm font-bold text-slate-700">Current password<input name="currentPassword" type="password" required className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">New password<input name="newPassword" type="password" minLength={12} required className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Confirm password<input name="confirmPassword" type="password" minLength={12} required className={inputClass} /></label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">Change password</button>
      </form>
    </main>
  );
}
