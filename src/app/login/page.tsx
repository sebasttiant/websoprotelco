import Image from "next/image";
import Link from "next/link";

import { getSiteSettings } from "@/domains/settings";

import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const settings = await getSiteSettings();

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel. Decorative, so it collapses on narrow screens rather than stacking. */}
      <section className="hidden flex-col justify-between bg-brand-navy p-12 text-white lg:flex">
        <Link href="/" aria-label={`${settings.siteName} inicio`}>
          <Image
            src="/assets/img/sp-logo-white.png"
            alt={settings.siteName}
            width={2924}
            height={1878}
            className="h-14 w-auto"
          />
        </Link>
        <div className="space-y-6">
          <h2 className="text-4xl font-black leading-tight">
            Tu cuenta para proyectos de <span className="text-brand-accent">fibra óptica</span>
          </h2>
          <p className="max-w-md text-sm font-medium leading-7 text-white/70">{settings.siteDescription}</p>
        </div>
        <p className="text-xs font-bold text-white/40">{settings.businessHours}</p>
      </section>

      <section className="flex flex-col items-center justify-center gap-8 bg-brand-ice px-6 py-16">
        <Link href="/" className="lg:hidden" aria-label={`${settings.siteName} inicio`}>
          <Image
            src="/assets/img/sp-logo.png"
            alt={settings.siteName}
            width={394}
            height={238}
            className="h-14 w-auto"
          />
        </Link>

        <div className="w-full max-w-sm space-y-2 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Cuenta</p>
          <h1 className="text-3xl font-black text-brand-navy">Iniciar sesión</h1>
          <p className="text-sm font-medium text-brand-muted">
            Accede para consultar tus cotizaciones y tus datos de perfil.
          </p>
        </div>

        <SignInForm />

        <Link href="/" className="text-sm font-bold text-brand-blue hover:text-brand-primary">
          ← Volver al inicio
        </Link>
      </section>
    </main>
  );
}
