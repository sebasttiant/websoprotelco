import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/sidebar";
import { roleLabel } from "@/lib/presentation";
import { signOut } from "@/server/auth/actions";
import { requireSession } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Only a session is required here. Gating the chrome on "admin:access" ran before every page
  // guard and 404'd staff out of the whole admin, which made the per-page permissions — the
  // things that actually distinguish the roles — unreachable. Authorization belongs on the
  // pages, each of which declares the permission it needs.
  const user = await requireSession();

  return (
    <div className="min-h-screen bg-brand-ice md:grid md:grid-cols-[15rem_1fr]">
      {/* A flex column so the nav can take the leftover space and push sign-out to the bottom
          edge, as the mockups place it. */}
      <aside className="bg-brand-navy text-white md:sticky md:top-0 md:flex md:h-screen md:flex-col md:overflow-y-auto">
        <Link href="/admin" className="flex shrink-0 items-center gap-3 px-4 pt-6">
          <Image
            src="/assets/img/sp-logo-white.png"
            alt="SOPROTELCO"
            width={2924}
            height={1878}
            className="h-9 w-auto"
          />
          <span className="text-xs font-black uppercase tracking-widest text-brand-accent">Panel</span>
        </Link>
        <AdminSidebar role={user.role} />
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-brand-line bg-white px-6 py-4">
          <Link href="/" className="text-xs font-black uppercase tracking-widest text-brand-muted transition hover:text-brand-blue">
            ← Ver sitio
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-black text-brand-navy">{roleLabel(user.role)}</p>
              <p className="text-xs font-medium text-brand-muted">{user.email}</p>
            </div>
            {/* Decorative: the identity is already stated in the text beside it, so announcing
                a bare initial again would only add noise for a screen reader. */}
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-ice text-sm font-black uppercase text-brand-blue ring-1 ring-brand-line"
            >
              {user.email.charAt(0)}
            </span>
            {/* Only below md, where the sidebar's own sign-out control is hidden. */}
            <form action={signOut} className="md:hidden">
              <button
                type="submit"
                className="rounded-full border border-brand-line px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent hover:text-brand-blue"
              >
                Salir
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
