import { Headphones, MapPinned, MessageCircle, PackageCheck } from "lucide-react";

import { Container } from "@/components/ui/container";

const TRUST_ITEMS = [
  { label: "Envíos nacionales", icon: MapPinned },
  { label: "Stock disponible", icon: PackageCheck },
  { label: "Asesoría técnica", icon: Headphones },
  { label: "Cotización WhatsApp", icon: MessageCircle },
] as const;

/**
 * One-line trust signals under the hero. Kept flat (no cards) so the page stays
 * fast and the SOPROTELCO logo in the header remains the dominant brand mark.
 */
export function TrustStrip() {
  return (
    <section aria-label="Respaldo comercial" className="border-b border-brand-line bg-white">
      <Container>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-4 py-5 sm:py-6 md:grid-cols-4 md:gap-6">
          {TRUST_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-ice text-brand-blue">
                  <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <span className="text-[0.65rem] font-black uppercase tracking-widest text-brand-navy">
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
