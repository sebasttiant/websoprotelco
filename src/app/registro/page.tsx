import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { getSiteSettings } from "@/domains/settings";

import { SignUpForm } from "./sign-up-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const settings = await getSiteSettings();

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel. Decorative, so it collapses on narrow screens rather than stacking. */}
      <section className="hidden flex-col justify-between bg-brand-navy p-12 text-white lg:flex">
        <Link href="/" aria-label={`${settings.siteName} inicio`}>
          <BrandLogo alt={settings.siteName} tone="dark" size="xl" priority />
        </Link>
        <div className="space-y-5">
          <h2 className="text-3xl font-black leading-snug tracking-tight">
            Creá tu cuenta para <span className="text-brand-accent">seguir tus cotizaciones</span>
          </h2>
          <p className="max-w-md text-sm font-medium leading-7 text-white/70">{settings.siteDescription}</p>
        </div>
        <p className="text-xs font-bold text-white/40">{settings.businessHours}</p>
      </section>

      <section className="flex flex-col items-center justify-center gap-8 bg-brand-ice px-6 py-16">
        <Link href="/" className="lg:hidden" aria-label={`${settings.siteName} inicio`}>
          <BrandLogo alt={settings.siteName} tone="light" size="lg" priority />
        </Link>

        <div className="w-full max-w-sm space-y-2 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Cuenta</p>
          <h1 className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">Crear cuenta</h1>
          <p className="text-sm font-medium text-brand-muted">
            Registrate para guardar tus datos y consultar tus cotizaciones.
          </p>
          <p className="text-xs font-medium text-brand-muted">La contraseña debe tener al menos 12 caracteres.</p>
        </div>

        <SignUpForm />

        <p className="text-sm font-medium text-brand-muted">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-bold text-brand-blue hover:text-brand-primary">
            Iniciá sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
