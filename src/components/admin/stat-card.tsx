import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// A card's accent, chosen by meaning rather than by hand at each call site: revenue reads as
// positive, an alert as warning, a shortage as danger. Keeping the palette here is what stops
// the dashboard drifting into a dozen slightly different blues.
export type StatTone = "brand" | "positive" | "warning" | "danger" | "neutral";

const TONE_ICON_CLASSES: Record<StatTone, string> = {
  brand: "bg-brand-blue/10 text-brand-blue",
  positive: "bg-emerald-500/10 text-emerald-600",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-red-500/10 text-red-600",
  neutral: "bg-slate-500/10 text-slate-600",
};

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
  icon?: LucideIcon;
  /** Accent for the icon badge. Defaults to the brand blue. */
  tone?: StatTone;
}

export function StatCard({ label, value, href, display, hint, alert = false, icon: Icon, tone = "brand" }: StatCardProps) {
  return (
    <Link
      href={href}
      role="group"
      aria-label={label}
      className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm shadow-blue-950/5 transition hover:border-brand-accent sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-muted">{label}</p>
        {Icon ? (
          <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE_ICON_CLASSES[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p
        role="status"
        className={`mt-2 text-3xl font-black tracking-tight ${alert && value > 0 ? "text-amber-600" : "text-brand-navy"}`}
      >
        {display ?? value}
      </p>
      {hint ? <p className="mt-1.5 text-xs font-medium text-brand-muted">{hint}</p> : null}
    </Link>
  );
}
