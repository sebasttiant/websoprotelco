import Image from "next/image";
import Link from "next/link";
import { LogIn, LogOut, Phone, User } from "lucide-react";

import { toTelHref } from "@/components/layout/contact-href";
import { HeaderCartLink } from "@/components/layout/header-cart-link";
import { HeaderMobileMenu, type HeaderNavLink } from "@/components/layout/header-mobile-menu";
import { Container } from "@/components/ui/container";
import { getSiteSettings } from "@/domains/settings";
import { signOut } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/guards";

// Cart is intentionally not here: it renders as a dedicated icon with a live count on the
// right, matching the previous site. These stay as text/menu links.
const NAV_LINKS: readonly HeaderNavLink[] = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/contacto", label: "Contáctanos" },
];

export async function Header() {
  // getCurrentUser resolves to null rather than redirecting, so the header stays usable for
  // signed-out visitors.
  const [settings, user] = await Promise.all([getSiteSettings(), getCurrentUser()]);

  return (
    <header className="sticky top-0 z-50 shadow-sm shadow-blue-950/5">
      <aside aria-label="Información de contacto" className="bg-brand-navy text-white">
        <Container className="flex items-center justify-between gap-4 py-2 text-xs font-bold">
          <a
            href={toTelHref(settings.contactPhone)}
            className="inline-flex items-center gap-2 transition-colors hover:text-brand-accent"
          >
            <Phone aria-hidden="true" className="h-3.5 w-3.5" />
            {settings.contactPhone}
          </a>
          <span className="hidden text-white/70 sm:block">{settings.businessHours}</span>
        </Container>
      </aside>

      <div className="relative border-b border-brand-line bg-white/90 backdrop-blur-xl">
        <Container className="flex items-center justify-between gap-4 py-4">
          <Link href="/" className="flex items-center" aria-label={`${settings.siteName} inicio`}>
            <Image
              src="/assets/img/sp-logo.png"
              alt={settings.siteName}
              width={394}
              height={238}
              priority
              className="h-12 w-auto md:h-14"
            />
          </Link>

          <nav
            className="hidden items-center gap-10 text-sm font-black text-brand-navy md:flex"
            aria-label="Navegación principal"
          >
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-brand-blue">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <HeaderCartLink />
            {user ? (
              <div className="hidden items-center gap-3 sm:flex">
                <Link
                  href="/cuenta"
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent hover:text-brand-blue"
                >
                  <User aria-hidden="true" className="h-4 w-4" />
                  Mi cuenta
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-muted transition hover:text-brand-blue"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent hover:text-brand-blue sm:inline-flex"
              >
                <LogIn aria-hidden="true" className="h-4 w-4" />
                Iniciar sesión
              </Link>
            )}
            <HeaderMobileMenu links={NAV_LINKS} isSignedIn={Boolean(user)} />
          </div>
        </Container>
      </div>
    </header>
  );
}
