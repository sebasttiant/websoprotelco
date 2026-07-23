// Admin route loading skeleton. Shown while a server component streams. Mirrors the common admin
// layout (title, stat row, content block) so the transition is calm rather than a blank flash.
export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-56 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-[28px] bg-slate-100 motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[28px] bg-slate-100 motion-reduce:animate-none" />
      <span className="sr-only">Cargando contenido…</span>
    </div>
  );
}
