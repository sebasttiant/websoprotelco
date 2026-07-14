// Phone numbers are stored formatted for display ("+57 300 123 4567"), but a tel: URI must
// not carry spaces or punctuation. Shared by the header top bar and the footer.
export function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function toMailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}
