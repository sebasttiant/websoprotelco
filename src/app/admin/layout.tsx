import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/sidebar";
import { signOut } from "@/server/auth/actions";
import { getCurrentUser, requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requirePermission("admin:access");
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-brand-ice md:grid md:grid-cols-[15rem_1fr]">
      <aside className="bg-brand-navy text-white md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <Link href="/admin" className="flex items-center gap-3 px-4 pt-6">
          <Image
            src="/assets/img/sp-logo-white.png"
            alt="SOPROTELCO"
            width={2924}
            height={1878}
            className="h-9 w-auto"
          />
          <span className="text-xs font-black uppercase tracking-widest text-brand-accent">Admin</span>
        </Link>
        <AdminSidebar />
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-brand-line bg-white px-6 py-4">
          <Link href="/" className="text-xs font-black uppercase tracking-widest text-brand-muted transition hover:text-brand-blue">
            ← View site
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <span className="hidden text-xs font-bold text-brand-muted sm:block">
                {user.email} · <span className="text-brand-blue">{user.role}</span>
              </span>
            ) : null}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full border border-brand-line px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent hover:text-brand-blue"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
