import Link from "next/link";

import { Field, SubmitButton } from "@/components/ui/form-field";
import { changePassword } from "@/domains/users";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

export default function ChangePasswordPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <Link href="/cuenta" className="text-sm font-bold text-brand-blue hover:text-brand-primary">
        ← Volver a mi cuenta
      </Link>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Cuenta</p>
        <h1 className="text-3xl font-black text-brand-navy">Cambiar contraseña</h1>
      </div>
      <form
        action={changePassword as unknown as FormAction}
        className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5"
      >
        <Field
          label="Contraseña actual"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
        <Field
          label="Nueva contraseña"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
        <Field
          label="Confirmar nueva contraseña"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
        <p className="text-xs font-medium text-brand-muted">Debe tener al menos 12 caracteres.</p>
        <SubmitButton>Cambiar contraseña</SubmitButton>
      </form>
    </main>
  );
}
