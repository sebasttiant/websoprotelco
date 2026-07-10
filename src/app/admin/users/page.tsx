import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { getUsersForAdmin, type AdminUserSummary } from "@/domains/users";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Listing every user is an admin-only capability. The RBAC matrix grants
  // "admin:access" to the admin role only (staff does not have it), so this guard
  // keeps the directory admin-only. It runs before any query is issued.
  await requirePermission("admin:access");

  const rows = await getUsersForAdmin();
  const columns: DataTableColumn<AdminUserSummary>[] = [
    { key: "email", header: "Email", render: (row) => <span className="font-black text-slate-950">{row.email}</span> },
    { key: "role", header: "Role", render: (row) => row.role },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
    { key: "created", header: "Created", render: (row) => new Date(row.createdAt).toLocaleDateString("es-CO") },
  ];

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Administration</p>
        <h1 className="text-3xl font-black text-slate-950">Users</h1>
      </div>
      <DataTable rows={rows} columns={columns} emptyMessage="No users found." />
    </section>
  );
}
