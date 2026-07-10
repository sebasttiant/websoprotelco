import { z } from "zod";

export type DatabaseEnv = {
  DATABASE_URL: string;
  DATABASE_POOL_MAX: number;
  DATABASE_SSL: "disable" | "require";
};

const postgresSchemes = new Set(["postgresql:", "postgres:"]);

// The URL is parsed inside the predicate because Zod runs every check even after an
// earlier one fails, so a throwing refinement escapes as a raw TypeError instead of
// a validation issue.
function isPostgresConnectionString(value: string): boolean {
  try {
    return postgresSchemes.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().refine(isPostgresConnectionString, {
    error: "DATABASE_URL must be a postgresql:// or postgres:// connection string",
  }),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  DATABASE_SSL: z.enum(["disable", "require"]).default("disable"),
});

export function readDatabaseEnv(source: NodeJS.ProcessEnv = process.env): DatabaseEnv {
  const result = databaseEnvSchema.safeParse(source);

  if (!result.success) {
    // Issue messages never echo the parsed value, which keeps the connection string
    // and its password out of logs and stack traces.
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid database environment configuration: ${details}`);
  }

  return result.data;
}
