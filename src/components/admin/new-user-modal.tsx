"use client";

import { Mail, ShieldCheck, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// From ./actions, never the domain barrel: the barrel re-exports the service, which reaches the
// repository's `import "server-only"` and fails the client build. See domains/users/index.ts.
import { createUser, type CreateUserActionState } from "@/domains/users/actions";
import { Portal } from "@/components/ui/portal";
import { roleLabel } from "@/lib/presentation";
import type { AssignableRole } from "@/domains/users";

interface NewUserModalProps {
  // Passed from the server so the option list is the single rbac ROLES tuple, never a second
  // hand-typed copy that could drift from what the action accepts.
  roles: readonly AssignableRole[];
}

interface UserForm {
  fullName: string;
  email: string;
  password: string;
  role: AssignableRole;
}

const MIN_PASSWORD_LENGTH = 8;

export function NewUserModal({ roles }: NewUserModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UserForm>({
    fullName: "",
    email: "",
    password: "",
    // Least-privilege default: a new account is a customer unless the admin deliberately raises
    // it, so a hurried click never mints staff or an admin by accident.
    role: roles.includes("customer") ? "customer" : (roles[0] ?? "customer"),
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  const canSubmit =
    form.fullName.trim().length >= 2 && form.email.includes("@") && form.password.length >= MIN_PASSWORD_LENGTH;

  function close(): void {
    setOpen(false);
    setForm({ fullName: "", email: "", password: "", role: roles.includes("customer") ? "customer" : (roles[0] ?? "customer") });
    setError("");
  }

  async function submit(): Promise<void> {
    setPending(true);
    setError("");

    const state: CreateUserActionState = await createUser({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      role: form.role,
    });

    setPending(false);

    if (!state.success) {
      setError(state.message);
      return;
    }

    close();
    // The list is a server component, so the new row appears only after an explicit refresh.
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary"
      >
        <User aria-hidden="true" className="h-4 w-4" />
        Nuevo usuario
      </button>

      {open ? (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Nuevo usuario"
              className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <header className="flex items-start justify-between border-b border-brand-line px-7 py-5">
                <div>
                  <h2 className="text-2xl font-black text-brand-navy">Nuevo usuario</h2>
                  <p className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    Acceso al panel administrativo
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="rounded-full p-2 text-brand-muted transition hover:bg-brand-ice hover:text-brand-navy"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </header>

              <div className="space-y-4 px-7 py-6">
                {error ? (
                  <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {error}
                  </p>
                ) : null}

                <div>
                  <label htmlFor="new-user-name" className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    Nombre completo
                  </label>
                  <div className="relative mt-1.5">
                    <User aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                    <input
                      id="new-user-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Ej: Juan Pérez"
                      value={form.fullName}
                      onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                      className="w-full rounded-2xl border border-brand-line bg-brand-ice py-3 pl-11 pr-4 font-bold text-brand-navy"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="new-user-email" className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    Correo electrónico
                  </label>
                  <div className="relative mt-1.5">
                    <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                    <input
                      id="new-user-email"
                      type="email"
                      required
                      autoComplete="off"
                      placeholder="correo@ejemplo.com"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className="w-full rounded-2xl border border-brand-line bg-brand-ice py-3 pl-11 pr-4 font-bold text-brand-navy"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="new-user-password" className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    Contraseña
                  </label>
                  <input
                    id="new-user-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 font-bold text-brand-navy"
                  />
                </div>

                <div>
                  <label htmlFor="new-user-role" className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    Rol de acceso
                  </label>
                  <div className="relative mt-1.5">
                    <ShieldCheck aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                    <select
                      id="new-user-role"
                      value={form.role}
                      onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AssignableRole }))}
                      className="w-full appearance-none rounded-2xl border border-brand-line bg-brand-ice py-3 pl-11 pr-4 font-bold text-brand-navy"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <footer className="border-t border-brand-line px-7 py-5">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit || pending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-8 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Registrando…" : "Registrar usuario"}
                </button>
              </footer>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  );
}
