interface WhatsAppCtaProps {
  whatsappNumber: string;
  productName: string;
  sku: string;
}

// wa.me accepts digits only — no plus sign, spaces or dashes.
function toWaNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function WhatsAppCta({ whatsappNumber, productName, sku }: WhatsAppCtaProps) {
  const number = toWaNumber(whatsappNumber);

  // Settings can legitimately have no WhatsApp number, and a wa.me link without one is a
  // dead end, so the button is omitted rather than rendered broken.
  if (!number) return null;

  const message = `Hola, me interesa el producto ${productName} (SKU ${sku}). ¿Me pueden dar más información?`;
  const href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="rounded-full bg-emerald-500 px-8 py-4 text-center text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-600"
    >
      Consultar por WhatsApp
    </a>
  );
}
