import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
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
    <footer className="border-t-2 border-brand-blue bg-white py-14 text-brand-muted">
      <Container>
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-5 md:col-span-2">
            <Link href="/" className="inline-block min-w-0" aria-label={`${settings.siteName} inicio`}>
              <BrandLogo alt={settings.siteName} tone="light" size="xl" />
            </Link>
            <p className="max-w-md text-sm font-medium leading-7">{settings.siteDescription}</p>
          </div>

          <nav className="space-y-4" aria-label="Empresa">
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-blue">Empresa</h2>
            <ul className="space-y-3 text-sm font-bold text-brand-navy">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-brand-blue">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section className="space-y-4" aria-label="Contacto">
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-blue">Contacto</h2>
            <ul className="space-y-3 text-sm font-medium text-brand-navy">
              <li>
                <a
                  href={toTelHref(settings.contactPhone)}
                  className="inline-flex items-center gap-2 transition-colors hover:text-brand-blue"
                >
                  <Phone aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-blue" />
                  {settings.contactPhone}
                </a>
              </li>
              <li>
                <a
                  href={toMailtoHref(settings.contactEmail)}
                  className="inline-flex items-center gap-2 break-all transition-colors hover:text-brand-blue"
                >
                  <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-blue" />
                  {settings.contactEmail}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-blue" />
                <span>{settings.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-blue" />
                <span>{settings.businessHours}</span>
              </li>
            </ul>

            {socials.length > 0 ? (
              <section aria-label="Redes sociales" className="flex gap-3 pt-2">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full border border-brand-line px-3 py-1.5 text-xs font-black text-brand-navy transition hover:border-brand-blue hover:text-brand-blue"
                  >
                    {social.label}
                  </a>
                ))}
              </section>
            ) : null}
          </section>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-brand-line pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-[11px] font-medium leading-5 tracking-normal text-brand-muted/80">
            © {currentYear} IL Asesorías S.A.S. Todos los derechos reservados.
          </p>
          <ul className="flex gap-6 text-xs font-bold text-brand-muted">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-brand-blue">
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
