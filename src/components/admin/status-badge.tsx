import { statusLabel } from "@/lib/presentation";

// Color is keyed by the raw persisted value; the visible text is always Spanish. Callers in a
// gendered domain (a quote is "Perdida", a lead is "Perdido") pass an explicit `label` resolved
// through the domain-specific helper; everyone else gets the combined default.
const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  inactive: "bg-slate-100 text-slate-700 ring-slate-200",
  new: "bg-blue-50 text-blue-700 ring-blue-200",
  contacted: "bg-amber-50 text-amber-700 ring-amber-200",
  qualified: "bg-violet-50 text-violet-700 ring-violet-200",
  converted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  received: "bg-blue-50 text-blue-700 ring-blue-200",
  in_review: "bg-amber-50 text-amber-700 ring-amber-200",
  quoted: "bg-violet-50 text-violet-700 ring-violet-200",
  won: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  lost: "bg-rose-50 text-rose-700 ring-rose-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.inactive;

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${style}`}>
      {label ?? statusLabel(status)}
    </span>
  );
}
