import Link from "next/link";

import { Container } from "@/components/ui/container";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-100 py-16 text-brand-muted">
      <Container>
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-5 md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 text-brand-navy">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-navy text-xs font-black text-white">SP</span>
              <span className="font-black uppercase tracking-widest">SOPROTELCO SAS</span>
            </Link>
            <p className="max-w-md text-sm font-medium leading-7">
              Soluciones integrales en telecomunicaciones, fibra óptica, redes y conectividad para proyectos empresariales en Colombia.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-navy/40">Empresa</h2>
            <ul className="space-y-3 text-sm font-bold">
              <li><Link href="/" className="hover:text-brand-blue">Inicio</Link></li>
              <li><Link href="/productos" className="hover:text-brand-blue">Productos</Link></li>
              <li><Link href="/contacto" className="hover:text-brand-blue">Contacto</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-navy/40">Contacto</h2>
            <ul className="space-y-3 text-sm font-medium">
              <li><a href="tel:+573001234567" className="hover:text-brand-blue">+57 300 123 4567</a></li>
              <li><a href="mailto:ventas@soprotelco.com" className="break-all hover:text-brand-blue">ventas@soprotelco.com</a></li>
              <li>Bogotá, Colombia</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 pt-8 text-xs font-black uppercase tracking-widest text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>© {currentYear} SOPROTELCO SAS. Todos los derechos reservados.</p>
          <p>Conectividad · Fibra óptica · Redes</p>
        </div>
      </Container>
    </footer>
  );
}
