import Link from "next/link";

import { getQuotesForUser } from "@/domains/quote-order";
import { getAccountOverview } from "@/domains/users";
import { requireSession } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession();
  // Both reads are scoped to the session user only: the account is fetched by the
  // session id, and quotes are then scoped by that same account's email — never by
  // an id or email taken from the request.
  const account = await getAccountOverview(session.id);
  const quotes = account ? await getQuotesForUser(session.id) : [];

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <section className="rounded-[32px] bg-brand-navy p-8 text-white shadow-2xl shadow-blue-950/20">
        <p className="text-xs font-black uppercase tracking-widest text-brand-accent">Cuenta</p>
        <h1 className="mt-3 text-4xl font-black">Mi cuenta</h1>
        <p className="mt-3 max-w-2xl text-sm font-medium text-white/70">
          Consulta tus datos de perfil y el estado de las cotizaciones asociadas a tu correo.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
          <h2 className="text-2xl font-black text-brand-navy">Perfil</h2>
          <dl className="mt-6 grid gap-4 text-sm">
            <div>
              <dt className="font-black text-brand-muted">Nombre</dt>
              <dd className="font-bold text-brand-navy">{account?.fullName ?? "Sin configurar"}</dd>
            </div>
            <div>
              <dt className="font-black text-brand-muted">Correo</dt>
              <dd className="font-bold text-brand-navy">{account?.email ?? session.email}</dd>
            </div>
            <div>
              <dt className="font-black text-brand-muted">Rol</dt>
              <dd className="font-bold text-brand-navy">{account?.role ?? session.role}</dd>
            </div>
          </dl>
        </div>

        <div className="grid content-start gap-3 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link
            href="/cuenta/perfil"
            className="rounded-full bg-brand-blue px-5 py-3 text-center text-sm font-black text-white transition hover:bg-brand-primary"
          >
            Editar perfil
          </Link>
          <Link
            href="/cuenta/password"
            className="rounded-full border border-brand-line px-5 py-3 text-center text-sm font-black text-brand-navy transition hover:border-brand-accent hover:text-brand-blue"
          >
            Cambiar contraseña
          </Link>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <h2 className="text-2xl font-black text-brand-navy">Cotizaciones recientes</h2>
        {quotes.length > 0 ? (
          <div className="mt-5 divide-y divide-brand-line">
            {quotes.map((quote) => (
              <article key={quote.id} className="grid gap-2 py-4 md:grid-cols-[160px_1fr_140px] md:items-center">
                <p className="text-sm font-black text-brand-blue">{quote.reference}</p>
                <p className="text-sm font-medium text-brand-muted">{quote.message || "Sin mensaje."}</p>
                <p className="rounded-full bg-brand-ice px-3 py-1 text-center text-xs font-black text-brand-navy">
                  {quote.status}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm font-medium text-brand-muted">
            Aún no tienes cotizaciones asociadas al correo de tu cuenta.{" "}
            <Link href="/productos" className="font-black text-brand-blue hover:text-brand-primary">
              Explora el catálogo
            </Link>{" "}
            para solicitar la primera.
          </p>
        )}
      </section>
    </main>
  );
}
