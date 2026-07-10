"use client";

import { useActionState } from "react";

import { signIn, type SignInState } from "@/server/auth/actions";

const initialState: SignInState = { error: null };

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Email */}
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-xs font-black uppercase tracking-wider text-brand-navy">
          Email Corporativo
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg className="h-5 w-5 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </div>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@empresa.com"
            className="w-full rounded-2xl border border-brand-line bg-brand-ice p-4 pl-12 font-medium outline-none transition focus:border-brand-blue"
          />
        </div>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-black uppercase tracking-wider text-brand-navy">
            Contraseña
          </label>
          <a href="#" className="text-xs font-bold text-brand-blue hover:underline">
            ¿La olvidaste?
          </a>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg className="h-5 w-5 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-2xl border border-brand-line bg-brand-ice p-4 pl-12 font-medium outline-none transition focus:border-brand-blue"
          />
        </div>
      </div>

      {/* Recordarme */}
      <label className="flex items-center gap-3 text-sm font-medium text-brand-muted">
        <input type="checkbox" name="remember" className="h-5 w-5 rounded border-brand-line text-brand-blue focus:ring-brand-blue" />
        Recordarme
      </label>

      {/* Error */}
      {state.error ? (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
          {state.error}
        </div>
      ) : null}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-brand-blue px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Accediendo…" : "Acceder al Panel"}
      </button>
    </form>
  );
}
