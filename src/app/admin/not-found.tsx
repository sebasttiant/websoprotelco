import Link from "next/link";

// Rendered whenever an admin route calls notFound() — e.g. a malformed uuid param or a record
// that does not exist. Spanish, calm, and it never reveals why the lookup failed.
export default function AdminNotFound() {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-[28px] bg-white p-10 text-center shadow-xl shadow-blue-950/5">
      <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Error 404</p>
      <h1 className="text-2xl font-black text-slate-950">No encontramos lo que buscás</h1>
      <p className="text-sm font-medium text-slate-500">
        El recurso no existe o fue movido. Verificá el enlace e intentá de nuevo.
      </p>
      <Link href="/admin" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">
        Volver al panel
      </Link>
    </section>
  );
}
