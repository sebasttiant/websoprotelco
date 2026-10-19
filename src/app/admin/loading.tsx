// Admin route loading skeleton. Shown while a server component streams. Mirrors the common admin
// layout (title, stat row, content block) so the transition is calm rather than a blank flash.
export default function AdminLoading() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Cargando">
      <div className="h-7 w-48 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
      <span className="sr-only">Cargando contenido…</span>
    </div>
  );
}
