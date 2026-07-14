// Relative, not the "@/" alias, matching scripts/create-admin.ts and scripts/db-migrate.ts:
// these run under tsx outside Next, where the alias resolves only when the cwd sits next to
// tsconfig.json.
import { hashPassword } from "../../src/server/auth/password";
import { closePool, query } from "../../src/server/db/pool";

interface SeedUser {
  email: string;
  password: string;
  role: "admin" | "staff";
}

// Development credentials. They are committed on purpose so the team shares one login, which
// is also why this script refuses to touch a production database below.
const SEED_USERS: readonly SeedUser[] = [
  { email: "admin@ilasesorias.com", password: "Infoseg.002026", role: "admin" },
  { email: "staff@ilasesorias.com", password: "Infoseg.002026", role: "staff" },
];

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
  // A committed password must never reach a real database. Seeding is a development affordance.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed users: this script ships committed credentials and must not run in production.");
  }

  let failed = false;

  try {
    for (const user of SEED_USERS) {
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
