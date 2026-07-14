// Relative, not the "@/" alias: these scripts run under tsx outside Next, where path
// mapping depends on tsconfig.json being present next to the current working directory.
import { closePool, query } from "../src/server/db/pool";
import { hashPassword } from "../src/server/auth/password";

interface UpsertedAdminRow {
  email: string;
  role: string;
}

async function createAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  try {
    // The conflict target matches the users_email_lower_idx expression index, so this
    // upsert is atomic: no separate SELECT-then-write race between concurrent runs.
    const rows = await query<UpsertedAdminRow>(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, 'admin', true)
       ON CONFLICT ((lower(email)))
       DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true
       RETURNING email, role`,
      [normalizedEmail, passwordHash],
    );

    const admin = rows[0];

    if (!admin) {
      throw new Error("Failed to create or update the admin user.");
    }

    console.log(`Admin user ready: ${admin.email} (role: ${admin.role})`);
  } finally {
    await closePool();
  }
}

createAdmin().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
