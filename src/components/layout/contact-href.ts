// Phone numbers are stored formatted for display ("+57 300 123 4567"), but a tel: URI must
// not carry spaces or punctuation. Shared by the header top bar and the footer.
export function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function toMailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}

// wa.me accepts digits only. A blank number has no destination, so callers omit the link.
export function toWhatsAppHref(raw: string, message?: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  const href = `https://wa.me/${digits}`;
  if (!message) return href;

  return `${href}?text=${encodeURIComponent(message)}`;
}
