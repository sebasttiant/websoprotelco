import Link from "next/link";

import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/contacto", label: "Contacto" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl shadow-sm shadow-blue-950/5">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3" aria-label="SOPROTELCO home">
          <Logo variant="full" />
        </Link>

        <nav className="hidden items-center gap-10 text-sm font-black text-brand-navy md:flex" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-brand-blue">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-brand-line bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-blue hover:text-brand-blue"
          >
            Login
          </Link>
        </div>
      </Container>
    </header>
  );
}
