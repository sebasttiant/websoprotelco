interface ProductImagePlaceholderProps {
  /** Larger mark on the PDP; compact mark inside catalog cards. */
  size?: "card" | "detail";
  /** Optional product name for screen readers only. */
  label?: string;
}

/**
 * Soft brand mark when a product has no photo yet. Keeps the grid visually
 * intentional instead of advertising "missing image" to shoppers.
 */
export function ProductImagePlaceholder({ size = "card", label }: ProductImagePlaceholderProps) {
  const mark = size === "detail" ? "h-28 w-28 text-5xl" : "h-24 w-24 text-4xl";

  return (
    <div
      className="relative grid h-full w-full place-items-center overflow-hidden p-6"
      role="img"
      aria-label={label ? `Imagen pendiente de ${label}` : "Imagen de producto pendiente"}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 240 240"
        className="absolute inset-0 h-full w-full text-brand-blue/15"
      >
        <circle cx="120" cy="120" r="110" fill="currentColor" opacity="0.2" />
        <circle cx="120" cy="120" r="78" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.55" />
        <circle cx="120" cy="120" r="54" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.4" />
        <path
          d="M28 168 C72 96, 108 72, 120 120 S168 188, 212 96"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M36 72 C84 128, 116 148, 120 120 S156 48, 204 140"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>

      <div className={`relative grid ${mark} place-items-center rounded-3xl border-2 border-brand-blue/20 bg-white/70 font-black text-brand-blue/40 shadow-sm backdrop-blur-sm`}>
        SP
      </div>
    </div>
  );
}
