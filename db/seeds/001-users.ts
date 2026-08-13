// Relative, not the "@/" alias, matching scripts/create-admin.ts and scripts/db-migrate.ts:
// these run under tsx outside Next, where the alias resolves only when the cwd sits next to
// tsconfig.json.
import { hashPassword } from "../../src/server/auth/password";
import { closePool, query } from "../../src/server/db/pool";
import { getSeedUsers, type SeedUser } from "./seed-policy";

interface InsertedUserRow {
  email: string;
  role: string;
}

async function seedUser(user: SeedUser): Promise<"created" | "skipped"> {
  const email = user.email.trim().toLowerCase();
  const passwordHash = await hashPassword(user.password);

  // DO NOTHING + RETURNING rather than SELECT-then-INSERT: the conflict target matches the
  // users_email_lower_idx expression index, so an existing row is skipped atomically instead
  // of racing two concurrent runs. An empty result means the user was already there — and
  // crucially, an existing password is never overwritten.
  const rows = await query<InsertedUserRow>(
    `INSERT INTO users (email, password_hash, role, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT ((lower(email))) DO NOTHING
     RETURNING email, role`,
    [email, passwordHash, user.role],
  );

  return rows.length > 0 ? "created" : "skipped";
}

async function seedUsers(): Promise<void> {
  const seedUsers = getSeedUsers();

  let failed = false;

  try {
    for (const user of seedUsers) {
      try {
        const outcome = await seedUser(user);

        console.log(
          outcome === "created"
            ? `created  ${user.email} (role: ${user.role})`
            : `skipped  ${user.email} (already exists)`,
        );
      } catch (error: unknown) {
        failed = true;
        console.error(`error    ${user.email}:`, error instanceof Error ? error.message : error);
      }
    }
  } finally {
    await closePool();
  }

  if (failed) {
    throw new Error("One or more users could not be seeded.");
  }
}

seedUsers().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
