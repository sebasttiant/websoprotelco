"use client";

import { useActionState } from "react";

import { Field, SubmitButton } from "@/components/ui/form-field";
import { signIn, type SignInState } from "@/server/auth/actions";

const initialState: SignInState = { error: null };

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form
      action={formAction}
      className="grid w-full max-w-sm gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5"
    >
      <Field label="Correo" id="email" name="email" type="email" required autoComplete="email" />
      <Field
        label="Contraseña"
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />
      {state.error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {state.error}
        </p>
      ) : null}
      <SubmitButton disabled={isPending}>
        {isPending ? "Ingresando…" : "Iniciar sesión"}
      </SubmitButton>
    </form>
  );
}
