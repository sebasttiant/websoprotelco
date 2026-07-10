import { getCurrentUser } from "@/server/auth/guards";

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold text-slate-950">Dashboard</h1>
      {user ? (
        <p className="text-sm text-slate-600">
          Signed in as <span className="font-medium">{user.email}</span> ({user.role})
        </p>
      ) : null}
    </section>
  );
}
