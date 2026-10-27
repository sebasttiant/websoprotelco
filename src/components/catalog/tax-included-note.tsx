interface TaxIncludedNoteProps {
  className?: string;
}

/** Platform-wide price footnote: every listed price already includes VAT. */
export function TaxIncludedNote({ className = "" }: TaxIncludedNoteProps) {
  return (
    <p className={`text-[0.7rem] font-bold uppercase tracking-wider text-brand-muted ${className}`.trim()}>
      IVA incluido
    </p>
  );
}
