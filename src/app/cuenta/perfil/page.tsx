import Link from "next/link";

import { Field, SubmitButton } from "@/components/ui/form-field";
import { getProfileDetails, updateProfile } from "@/domains/users";
import { requireSession } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

export default async function ProfilePage() {
  const session = await requireSession();
  // Scoped to the session user's own id, never a route param or search param.
  const profile = await getProfileDetails(session.id);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <Link href="/cuenta" className="text-sm font-bold text-brand-blue hover:text-brand-primary">
        ← Volver a mi cuenta
      </Link>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Cuenta</p>
        <h1 className="text-3xl font-black text-brand-navy">Editar perfil</h1>
      </div>
      <form
        action={updateProfile as unknown as FormAction}
        className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5"
      >
        <Field label="Nombre" name="name" required defaultValue={profile?.fullName ?? ""} />
        <Field
          label="Correo"
          name="email"
          type="email"
          required
          defaultValue={profile?.email ?? session.email}
        />
        <SubmitButton>Guardar perfil</SubmitButton>
      </form>
    </main>
  );
}
