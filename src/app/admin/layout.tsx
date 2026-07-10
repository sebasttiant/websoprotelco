import type { ReactNode } from "react";
import Link from "next/link";

import { requirePermission } from "@/server/auth/guards";
import { signOut } from "@/server/auth/actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requirePermission("admin:access");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-500">
            SOPROTELCO Admin
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-bold text-slate-700 md:flex">
            <Link href="/admin/products" className="hover:text-brand-blue">Products</Link>
            <Link href="/admin/categories" className="hover:text-brand-blue">Categories</Link>
            <Link href="/admin/quotes" className="hover:text-brand-blue">Quotes</Link>
            <Link href="/admin/users" className="hover:text-brand-blue">Users</Link>
            <Link href="/admin/settings" className="hover:text-brand-blue">Settings</Link>
          </nav>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm font-medium text-slate-700 underline">
            Sign out
          </button>
        </form>
      </header>
      <main className="px-6 py-10">{children}</main>
    </div>
  );
}
