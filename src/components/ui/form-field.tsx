import type { ComponentPropsWithoutRef } from "react";

// The account and login forms all repeated the same input and button class strings. Keeping
// them here means a change to the field style lands everywhere at once.
export function Field({
  label,
  ...inputProps
}: { label: string } & ComponentPropsWithoutRef<"input">) {
  return (
    <label className="grid gap-2 text-sm font-bold text-brand-navy">
      {label}
      <input
        {...inputProps}
        className="rounded-2xl border border-brand-line px-4 py-3 text-sm font-medium text-brand-navy transition focus:border-brand-accent focus:outline-none"
      />
    </label>
  );
}

export function SubmitButton({ children, ...buttonProps }: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="submit"
      {...buttonProps}
      className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white transition hover:bg-brand-primary disabled:opacity-50"
    >
      {children}
    </button>
  );
}
