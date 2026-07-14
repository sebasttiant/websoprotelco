import { Container } from "@/components/ui/container";

const MESSAGES = [
  "Asesoría en proyectos de fibra óptica",
  "Despachos a nivel nacional",
  "Equipos de medición",
  "Cables y conectores",
  "Garantía y soporte directo",
] as const;

export function Ticker() {
  return (
    <section className="overflow-hidden border-y-2 border-brand-navy bg-blue-50 text-brand-navy" aria-label="Avisos importantes">
      <Container className="overflow-hidden py-3">
        <div className="flex w-max animate-[ticker_24s_linear_infinite] gap-12 whitespace-nowrap text-xs font-black uppercase tracking-widest motion-reduce:animate-none">
          {[...MESSAGES, ...MESSAGES].map((message, index) => (
            <span key={`${message}-${index}`}>{message}</span>
          ))}
        </div>
      </Container>
    </section>
  );
}
