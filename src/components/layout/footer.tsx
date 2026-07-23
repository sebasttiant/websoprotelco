import Image from "next/image";
import Link from "next/link";

import { toMailtoHref, toTelHref } from "@/components/layout/contact-href";
import { Container } from "@/components/ui/container";
import { getSiteSettings } from "@/domains/settings";
import type { SiteSettings } from "@/domains/settings";

const COMPANY_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/contacto", label: "Contacto" },
] as const;

const LEGAL_LINKS = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/privacidad", label: "Política de privacidad" },
] as const;

function socialLinks(settings: SiteSettings) {
  return [
    { label: "Facebook", href: settings.facebookUrl },
    { label: "Instagram", href: settings.instagramUrl },
    { label: "LinkedIn", href: settings.linkedinUrl },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));
}

export async function Footer() {
  const settings = await getSiteSettings();
  const socials = socialLinks(settings);
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-brand-navy py-16 text-white/70">
      <Container>
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-5 md:col-span-2">
            <Link href="/" className="inline-block" aria-label={`${settings.siteName} inicio`}>
              <Image
                src="/assets/brand/soprotelco-logo-white.png"
                alt={settings.siteName}
                width={2924}
                height={1878}
                className="h-14 w-auto"
              />
            </Link>
            <p className="max-w-md text-sm font-medium leading-7">{settings.siteDescription}</p>
          </div>

          <nav className="space-y-4" aria-label="Empresa">
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-accent">Empresa</h2>
            <ul className="space-y-3 text-sm font-bold">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-brand-accent">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section className="space-y-4" aria-label="Contacto">
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-accent">Contacto</h2>
            <ul className="space-y-3 text-sm font-medium">
              <li>
                <a href={toTelHref(settings.contactPhone)} className="transition-colors hover:text-brand-accent">
                  {settings.contactPhone}
                </a>
              </li>
              <li>
                <a
                  href={toMailtoHref(settings.contactEmail)}
                  className="break-all transition-colors hover:text-brand-accent"
                >
                  {settings.contactEmail}
                </a>
              </li>
              <li>{settings.address}</li>
              <li>{settings.businessHours}</li>
            </ul>

            {socials.length > 0 ? (
              <section aria-label="Redes sociales" className="flex gap-3 pt-2">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-black transition hover:border-brand-accent hover:text-brand-accent"
                  >
                    {social.label}
                  </a>
                ))}
              </section>
            ) : null}
          </section>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs font-bold text-white/50 md:flex-row md:items-center md:justify-between">
          <p>
            © {currentYear} {settings.siteName}. Todos los derechos reservados.
          </p>
          <ul className="flex gap-6">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-brand-accent">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
