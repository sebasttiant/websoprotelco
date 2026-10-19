import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { AdminFlashBanner } from "@/components/admin/flash-banner";
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
    <div className="min-h-screen overflow-x-clip bg-brand-bg md:grid md:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="bg-brand-navy text-white print:hidden md:sticky md:top-0 md:flex md:h-screen md:flex-col md:overflow-y-auto">
        <AdminSidebar role={user.role} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip">
        <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between gap-3 border-b border-brand-line/80 bg-white/95 px-4 backdrop-blur-xl print:hidden sm:px-6">
          <Link
            href="/"
            className="shrink-0 text-[0.65rem] font-black uppercase tracking-widest text-brand-muted transition hover:text-brand-blue"
          >
            ← Ver sitio
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="hidden min-w-0 text-right leading-tight sm:block">
              <p className="text-sm font-black text-brand-navy">{roleLabel(user.role)}</p>
              <p className="max-w-[14rem] truncate text-xs font-medium text-brand-muted">{user.email}</p>
            </div>
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-ice text-sm font-black uppercase text-brand-blue ring-1 ring-brand-line"
            >
              {user.email.charAt(0)}
            </span>
            <form action={signOut} className="shrink-0 md:hidden">
              <button
                type="submit"
                className="rounded-full border border-brand-line px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent hover:text-brand-blue"
              >
                Salir
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-clip px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <Suspense fallback={null}>
            <AdminFlashBanner />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
