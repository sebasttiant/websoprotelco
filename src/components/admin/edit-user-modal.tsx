"use client";

import { Mail, Pencil, ShieldCheck, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { updateUser, type ManageUserActionState } from "@/domains/users/actions";
import { Portal } from "@/components/ui/portal";
import { roleLabel } from "@/lib/presentation";
import type { AdminUserSummary, AssignableRole } from "@/domains/users";

interface EditUserModalProps {
  user: AdminUserSummary;
  roles: readonly AssignableRole[];
  /** Signed-in admin id — used only to disable self-destructive options in the UI. */
  actorUserId: string;
}

interface EditForm {
  fullName: string;
  email: string;
  password: string;
  role: AssignableRole;
  isActive: boolean;
}

const MIN_PASSWORD_LENGTH = 12;

export function EditUserModal({ user, roles, actorUserId }: EditUserModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(() => formFromUser(user, roles));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isSelf = user.id === actorUserId;

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

  const passwordOk = form.password === "" || form.password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit =
    form.fullName.trim().length >= 2 && form.email.includes("@") && passwordOk && !pending;

  function openModal(): void {
    setForm(formFromUser(user, roles));
    setError("");
    setOpen(true);
  }

  function close(): void {
    setOpen(false);
    setError("");
  }

  async function submit(): Promise<void> {
    setPending(true);
    setError("");

    const state: ManageUserActionState = await updateUser({
      id: user.id,
      fullName: form.fullName,
      email: form.email,
      role: form.role,
      isActive: form.isActive,
      password: form.password,
    });

    setPending(false);

    if (!state.success) {
      setError(state.message);
      return;
    }

    close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label={`Editar ${user.email}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-blue hover:bg-brand-ice"
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        Editar
      </button>

      {open ? (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" />

            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Editar usuario ${user.email}`}
              className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <header className="flex items-start justify-between border-b border-brand-line px-7 py-5">
                <div>
                  <h2 className="text-2xl font-black text-brand-navy">Editar usuario</h2>
                  <p className="text-xs font-black uppercase tracking-widest text-brand-muted">{user.email}</p>
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

              <div className="space-y-4 overflow-y-auto px-7 py-6">
                {error ? (
                  <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {error}
                  </p>
                ) : null}

                <div>
                  <label htmlFor={`edit-user-name-${user.id}`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    Nombre completo
                  </label>
                  <div className="relative mt-1.5">
                    <User aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                    <input
                      id={`edit-user-name-${user.id}`}
                      type="text"
                      required
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                      className="w-full rounded-2xl border border-brand-line bg-brand-ice py-3 pl-11 pr-4 font-bold text-brand-navy"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={`edit-user-email-${user.id}`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    Correo electrónico
                  </label>
                  <div className="relative mt-1.5">
                    <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                    <input
                      id={`edit-user-email-${user.id}`}
                      type="email"
                      required
                      autoComplete="off"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className="w-full rounded-2xl border border-brand-line bg-brand-ice py-3 pl-11 pr-4 font-bold text-brand-navy"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={`edit-user-password-${user.id}`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    Nueva contraseña (opcional)
                  </label>
                  <input
                    id={`edit-user-password-${user.id}`}
                    type="password"
                    autoComplete="new-password"
                    placeholder={`Dejá vacío para no cambiarla · mín. ${MIN_PASSWORD_LENGTH}`}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 font-bold text-brand-navy"
                  />
                </div>

                <div>
                  <label htmlFor={`edit-user-role-${user.id}`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    Rol de acceso
                  </label>
                  <div className="relative mt-1.5">
                    <ShieldCheck aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                    <select
                      id={`edit-user-role-${user.id}`}
                      value={form.role}
                      disabled={isSelf}
                      onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AssignableRole }))}
                      className="w-full appearance-none rounded-2xl border border-brand-line bg-brand-ice py-3 pl-11 pr-4 font-bold text-brand-navy disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isSelf ? (
                    <p className="mt-1.5 text-xs font-medium text-brand-muted">No podés cambiar tu propio rol.</p>
                  ) : null}
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-ice px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    disabled={isSelf}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-brand-line text-brand-blue focus:ring-brand-blue disabled:cursor-not-allowed"
                  />
                  <span className="text-sm font-bold text-brand-navy">
                    Cuenta activa
                    {isSelf ? (
                      <span className="mt-0.5 block text-xs font-medium text-brand-muted">No podés desactivar tu propia cuenta.</span>
                    ) : null}
                  </span>
                </label>
              </div>

              <footer className="border-t border-brand-line px-7 py-5">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-8 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Guardando…" : "Guardar cambios"}
                </button>
              </footer>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  );
}

function formFromUser(user: AdminUserSummary, roles: readonly AssignableRole[]): EditForm {
  const role = roles.includes(user.role as AssignableRole)
    ? (user.role as AssignableRole)
    : (roles[0] ?? "customer");

  return {
    fullName: user.fullName ?? "",
    email: user.email,
    password: "",
    role,
    isActive: user.isActive,
  };
}
