import { toWhatsAppHref } from "@/components/layout/contact-href";

const GREETING = "Hola, quiero información sobre productos SOPROTELCO.";

export function WhatsAppFloat({ whatsappNumber }: { whatsappNumber: string }) {
  const href = toWhatsAppHref(whatsappNumber, GREETING);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-900/20 transition hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-emerald-400/40 motion-safe:animate-ping"
      />
      <svg viewBox="0 0 24 24" aria-hidden="true" className="relative h-7 w-7 fill-current">
        <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.4a10 10 0 0 0 4.65 1.14h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2Zm5.76 14.04c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.41-.14-.95-.31-1.64-.61-2.88-1.24-4.76-4.14-4.9-4.33-.14-.2-1.16-1.54-1.16-2.94s.73-2.08.99-2.37c.26-.28.57-.35.76-.35h.55c.17 0 .41-.07.64.49.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.2-.15.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.12.58.17.28.74 1.22 1.59 1.98.1.9 1.78 1.16 2.04 1.29.26.13.41.11.56-.07.15-.17.64-.74.81-1 .17-.26.34-.21.57-.13.23.08 1.46.69 1.71.81.25.13.42.19.48.3.06.1.06.6-.18 1.28Z" />
      </svg>
    </a>
  );
}
