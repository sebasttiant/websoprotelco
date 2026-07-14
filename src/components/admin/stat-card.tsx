import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number;
  href: string;
  hint?: string;
  /** Draws attention when the number is something to act on, e.g. stock running out. */
  alert?: boolean;
}

export function StatCard({ label, value, href, hint, alert = false }: StatCardProps) {
  return (
    <Link
      href={href}
      role="group"
      aria-label={label}
      className="rounded-[28px] border border-brand-line bg-white p-6 shadow-xl shadow-blue-950/5 transition hover:border-brand-accent"
    >
      <p className="text-xs font-black uppercase tracking-widest text-brand-muted">{label}</p>
      <p
        role="status"
        className={`mt-3 text-4xl font-black ${alert && value > 0 ? "text-amber-600" : "text-brand-navy"}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs font-medium text-brand-muted">{hint}</p> : null}
    </Link>
  );
}
