import Image from "next/image";
import Link from "next/link";

import { toTelHref } from "@/components/layout/contact-href";
import { HeaderMobileMenu, type HeaderNavLink } from "@/components/layout/header-mobile-menu";
import { Container } from "@/components/ui/container";
import { getSiteSettings } from "@/domains/settings";
import { signOut } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/guards";

const NAV_LINKS: readonly HeaderNavLink[] = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/carrito", label: "Carrito" },
  { href: "/contacto", label: "Contacto" },
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
            className="transition-colors hover:text-brand-accent"
          >
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
            {user ? (
              <div className="hidden items-center gap-3 sm:flex">
                <Link
                  href="/cuenta"
                  className="rounded-full border border-brand-line bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent hover:text-brand-blue"
                >
                  Mi cuenta
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="text-xs font-black uppercase tracking-widest text-brand-muted transition hover:text-brand-blue"
                  >
                    Cerrar sesión
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden rounded-full border border-brand-line bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent hover:text-brand-blue sm:block"
              >
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
