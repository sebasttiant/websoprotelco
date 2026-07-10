import Link from "next/link";

import { getQuotesForCustomer } from "@/domains/quote-order";
import { getAccountOverview } from "@/domains/users";
import { requireSession } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession();
  // Both reads are scoped to the session user only: the account is fetched by the
  // session id, and quotes are then scoped by that same account's email — never by
  // an id or email taken from the request.
  const account = await getAccountOverview(session.id);
  const quotes = account ? await getQuotesForCustomer(account.email) : [];

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <section className="rounded-[32px] bg-slate-950 p-8 text-white shadow-2xl shadow-blue-950/20">
        <p className="text-xs font-black uppercase tracking-widest text-brand-yellow">Account</p>
        <h1 className="mt-3 text-4xl font-black">Your SOPROTELCO account</h1>
        <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300">Review your profile details and track recent quote requests linked to your email address.</p>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
          <h2 className="text-2xl font-black text-slate-950">Profile</h2>
          <dl className="mt-6 grid gap-4 text-sm">
            <div><dt className="font-black text-slate-500">Name</dt><dd className="font-bold text-slate-950">{account?.fullName ?? "Not configured"}</dd></div>
            <div><dt className="font-black text-slate-500">Email</dt><dd className="font-bold text-slate-950">{account?.email ?? session.email}</dd></div>
            <div><dt className="font-black text-slate-500">Role</dt><dd className="font-bold text-slate-950">{account?.role ?? session.role}</dd></div>
          </dl>
        </div>

        <div className="grid gap-3 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/cuenta/perfil" className="rounded-full bg-brand-blue px-5 py-3 text-center text-sm font-black text-white">Update profile</Link>
          <Link href="/cuenta/password" className="rounded-full border border-slate-200 px-5 py-3 text-center text-sm font-black text-slate-800">Change password</Link>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <h2 className="text-2xl font-black text-slate-950">Recent quotes</h2>
        {quotes.length > 0 ? (
          <div className="mt-5 divide-y divide-slate-100">
            {quotes.map((quote) => (
              <article key={quote.id} className="grid gap-2 py-4 md:grid-cols-[160px_1fr_140px] md:items-center">
                <p className="text-sm font-black text-brand-blue">{quote.reference}</p>
                <p className="text-sm font-medium text-slate-600">{quote.message || "No message provided."}</p>
                <p className="rounded-full bg-slate-100 px-3 py-1 text-center text-xs font-black text-slate-700">{quote.status}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm font-medium text-slate-600">No quote requests are linked to your account email yet.</p>
        )}
      </section>
    </main>
  );
}
