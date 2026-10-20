// Relative, not the "@/" alias, matching scripts/create-admin.ts and scripts/db-migrate.ts:
// these run under tsx outside Next, where the alias resolves only when the cwd sits next to
// tsconfig.json.
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, hashPassword } from "../../src/server/auth/password";
import { closePool, query } from "../../src/server/db/pool";

interface SeedUser {
  email: string;
  password: string;
  role: "admin" | "staff";
}

interface SeedUserSpec {
  role: SeedUser["role"];
  emailVariable: string;
  defaultEmail: string;
  passwordVariable: string;
}

// No password is tracked in this repository, which is public. Each account takes its password
// from an explicit environment variable, so a seeded database never has a login anyone can read
// off GitHub. Emails are not secrets and keep their defaults.
const SEED_USER_SPECS: readonly SeedUserSpec[] = [
  {
    role: "admin",
    emailVariable: "SEED_ADMIN_EMAIL",
    defaultEmail: "admin@ilasesorias.com",
    passwordVariable: "SEED_ADMIN_PASSWORD",
  },
  {
    role: "staff",
    emailVariable: "SEED_STAFF_EMAIL",
    defaultEmail: "staff@ilasesorias.com",
    passwordVariable: "SEED_STAFF_PASSWORD",
  },
];

// Fails before any database work, and names only the variables, never their values.
function readSeedUsers(env: NodeJS.ProcessEnv): readonly SeedUser[] {
  const problems: string[] = [];
  const users: SeedUser[] = [];

  for (const spec of SEED_USER_SPECS) {
    const password = env[spec.passwordVariable];

    if (!password) {
      problems.push(`${spec.passwordVariable} is required`);
      continue;
    }

    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      problems.push(`${spec.passwordVariable} must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`);
      continue;
    }

    users.push({ email: env[spec.emailVariable]?.trim() || spec.defaultEmail, password, role: spec.role });
  }

  if (problems.length > 0) {
    throw new Error(`Refusing to seed users: ${problems.join("; ")}.`);
  }

  return users;
}

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

async function runSeed(): Promise<void> {
  // Seeding is a development affordance and must never reach a production database.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed users: this script is a development affordance and must not run in production.");
  }

  const seedUsers = readSeedUsers(process.env);

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

runSeed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
