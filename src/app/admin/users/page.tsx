import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { DeleteUserButton } from "@/components/admin/delete-user-button";
import { EditUserModal } from "@/components/admin/edit-user-modal";
import { InitialAvatar } from "@/components/admin/initial-avatar";
import { NewUserModal } from "@/components/admin/new-user-modal";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate, roleLabel } from "@/lib/presentation";
import { getUsersForAdmin, type AdminUserSummary } from "@/domains/users";
import { ROLES } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Listing and managing every user is admin-only. The RBAC matrix grants "admin:access"
  // to the admin role only (staff does not have it). The actor id is passed to the row
  // controls so self-delete / self-demote stays disabled in the UI as well as the server.
  const actor = await requirePermission("admin:access");

  const rows = await getUsersForAdmin();
  const columns: DataTableColumn<AdminUserSummary>[] = [
    {
      key: "email",
      header: "Correo",
      render: (row) => (
        <div className="flex items-center gap-3">
          <InitialAvatar name={row.fullName || row.email} seed={row.id} shape="circle" />
          <div className="min-w-0">
            <p className="truncate font-black text-slate-950">{row.email}</p>
            {row.fullName ? <p className="truncate text-xs font-medium text-slate-500">{row.fullName}</p> : null}
          </div>
        </div>
      ),
    },
    { key: "role", header: "Rol", render: (row) => roleLabel(row.role) },
    { key: "status", header: "Estado", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
    { key: "created", header: "Creado", render: (row) => formatDate(row.createdAt) },
    {
      key: "actions",
      header: "Acciones",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <EditUserModal user={row} roles={ROLES} actorUserId={actor.id} />
          <DeleteUserButton userId={row.id} email={row.email} disabled={row.id === actor.id} />
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">Administración</p>
          <h1 className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">Usuarios</h1>
          <p className="mt-2 text-sm font-medium text-brand-muted">Crear, editar, desactivar y eliminar accesos</p>
        </div>
        <NewUserModal roles={ROLES} />
      </div>

      <DataTable rows={rows} columns={columns} emptyMessage="No se encontraron usuarios." />

      <aside className="rounded-2xl border border-brand-line bg-brand-ice/60 p-6">
        <h2 className="text-sm font-black text-brand-navy">Sobre los roles</h2>
        <dl className="mt-3 space-y-2 text-sm text-brand-muted">
          <div className="flex gap-2">
            <dt className="font-black text-brand-navy">{roleLabel("admin")}:</dt>
            <dd>Acceso total al panel.</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-black text-brand-navy">{roleLabel("staff")}:</dt>
            <dd>Puede ver pedidos y productos.</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-black text-brand-navy">{roleLabel("customer")}:</dt>
            <dd>Perfil para clientes. Ven su propio historial y sus datos.</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}
