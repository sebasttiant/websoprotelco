import type { ReactNode } from "react";

const BADGE_VARIANT = {
  default: "bg-brand-ice text-brand-blue ring-1 ring-brand-line",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  neutral: "bg-brand-ice text-brand-muted ring-1 ring-brand-line",
} as const;

type BadgeVariant = keyof typeof BADGE_VARIANT;

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest",
        BADGE_VARIANT[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
