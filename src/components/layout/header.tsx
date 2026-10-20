import Link from "next/link";
import { LogIn, LogOut, User } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { HeaderCartLink } from "@/components/layout/header-cart-link";
import { HeaderMobileMenu, type HeaderNavLink } from "@/components/layout/header-mobile-menu";
import { HeaderProductsMenu } from "@/components/layout/header-products-menu";
import { HeaderSearch } from "@/components/layout/header-search";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { Container } from "@/components/ui/container";
import { getCategories } from "@/domains/catalog";
import { getSiteSettings } from "@/domains/settings";
import { signOut } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/guards";

const NAV_LINKS: readonly HeaderNavLink[] = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/contacto", label: "Contáctanos" },
];

export async function Header() {
  const [settings, user, categories] = await Promise.all([
    getSiteSettings(),
    getCurrentUser(),
    getCategories(),
  ]);

  return (
    <>
      {/* Sticky brand chrome: navy bar stays fixed; page content stays white. */}
      <header className="sticky top-0 z-50 bg-brand-navy text-white shadow-sm shadow-blue-950/20">
        <Container className="relative flex min-w-0 items-center justify-between gap-4 py-3">
          <Link href="/" className="min-w-0 shrink-0" aria-label={`${settings.siteName} inicio`}>
            <BrandLogo alt={settings.siteName} tone="dark" variant="symbol" size="lg" priority />
          </Link>

          <nav
            className="hidden items-center gap-7 text-sm font-black text-white lg:flex"
            aria-label="Navegación principal"
          >
            <Link href="/" className="transition-colors hover:text-brand-accent">
              Inicio
            </Link>
            <HeaderProductsMenu categories={categories} tone="dark" />
            <Link href="/contacto" className="transition-colors hover:text-brand-accent">
              Contáctanos
            </Link>
          </nav>

          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <HeaderSearch tone="dark" />
            <HeaderCartLink whatsappNumber={settings.whatsappNumber} tone="dark" />

            {user ? (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/cuenta"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-3.5 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:border-brand-accent hover:text-brand-accent"
                >
                  <User aria-hidden="true" className="h-4 w-4" />
                  Mi cuenta
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/70 transition hover:text-brand-accent"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden items-center gap-2 rounded-xl border border-white/25 px-3.5 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:border-brand-accent hover:text-brand-accent sm:inline-flex"
              >
                <LogIn aria-hidden="true" className="h-4 w-4" />
                Iniciar sesión
              </Link>
            )}

            <HeaderMobileMenu links={NAV_LINKS} categories={categories} isSignedIn={Boolean(user)} tone="dark" />
          </div>
        </Container>
      </header>
      <WhatsAppFloat whatsappNumber={settings.whatsappNumber} />
    </>
  );
}
