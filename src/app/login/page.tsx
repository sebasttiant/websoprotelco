import Link from "next/link";

import { SignInForm } from "./sign-in-form";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6 py-16">
      {/* Patrón hexagonal de fondo */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg id='hexagons' fill='%23000000' fill-opacity='1' fill-rule='nonzero'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Card de login */}
        <div className="rounded-3xl bg-white p-8 shadow-2xl shadow-blue-950/10">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <Logo variant="icon" className="h-16 w-16" />
          </div>

          {/* Título */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black text-brand-navy">
              Acceso Administrativo
            </h1>
            <p className="mt-3 text-sm font-medium text-brand-muted">
              Ingresa tus credenciales para gestionar el catálogo de{" "}
              <span className="font-bold text-brand-blue">Soprotelco</span>.
            </p>
          </div>

          {/* Formulario */}
          <SignInForm />

          {/* Soporte */}
          <div className="mt-8 text-center">
            <p className="text-xs text-brand-muted">
              ¿Problemas de acceso?{" "}
              <a
                href="mailto:soporte@soprotelco.com"
                className="font-bold text-brand-blue hover:underline"
              >
                Contacta a soporte
              </a>
            </p>
          </div>
        </div>

        {/* Volver al inicio */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-brand-muted transition hover:text-brand-blue"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
