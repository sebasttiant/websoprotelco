import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePermission } from "@/server/auth/guards";
import { query } from "@/server/db/pool";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

async function getUsers(): Promise<UserRow[]> {
  await requirePermission("admin:access");
  return query<UserRow>("SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC, email ASC");
}

export default async function AdminUsersPage() {
  const rows = await getUsers();
  const columns: DataTableColumn<UserRow>[] = [
    { key: "email", header: "Email", render: (row) => <span className="font-black text-slate-950">{row.email}</span> },
    { key: "role", header: "Role", render: (row) => row.role },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.is_active ? "active" : "inactive"} /> },
    { key: "created", header: "Created", render: (row) => new Date(row.created_at).toLocaleDateString("es-CO") },
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
