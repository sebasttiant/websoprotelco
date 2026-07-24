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
      className="rounded-[28px] border border-brand-line bg-white p-6 shadow-xl shadow-blue-950/5 transition hover:border-brand-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-widest text-brand-muted">{label}</p>
        {Icon ? (
          // Decorative: the label beside it already names the metric, so a second announcement
          // of the icon would only repeat it for a screen reader.
          <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${TONE_ICON_CLASSES[tone]}`}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
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
