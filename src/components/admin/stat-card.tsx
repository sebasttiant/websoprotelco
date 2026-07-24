import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number;
  href: string;
  /**
   * Text to render instead of the raw number, for values that need units — a currency amount,
   * say. `value` stays numeric regardless, because `alert` reasons about the magnitude and a
   * pre-formatted string cannot be compared.
   */
  display?: string;
  hint?: string;
  /** Draws attention when the number is something to act on, e.g. stock running out. */
  alert?: boolean;
}

export function StatCard({ label, value, href, display, hint, alert = false }: StatCardProps) {
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
        {display ?? value}
      </p>
      {hint ? <p className="mt-2 text-xs font-medium text-brand-muted">{hint}</p> : null}
    </Link>
  );
}
