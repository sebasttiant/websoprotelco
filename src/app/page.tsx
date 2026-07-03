export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-500">SOPROTELCO</p>
      <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
        Ecommerce rebuild foundation
      </h1>
      <p className="max-w-2xl text-lg leading-8 text-slate-600">
        Runtime, Docker, CI, and test harness are ready for the next SDD feature slices.
      </p>
    </main>
  );
}
