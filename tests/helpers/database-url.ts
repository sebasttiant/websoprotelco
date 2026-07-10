import { z } from "zod";

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z.url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "postgresql:" || protocol === "postgres:";
  }, "DATABASE_URL must use the postgresql:// or postgres:// scheme"),
});

const protectedDatabaseNames = new Set(["postgres", "template0", "template1"]);

export function getDatabaseName(connectionString: string): string {
  return new URL(connectionString).pathname.replace(/^\//, "");
}

export function assertTestDatabaseUrl(connectionString: string): string {
  const databaseName = getDatabaseName(connectionString);

  if (databaseName.includes("/") || protectedDatabaseNames.has(databaseName) || !databaseName.endsWith("_test")) {
    throw new Error(`Refusing to use non-test database: ${databaseName}`);
  }

  return connectionString;
}

export function getTestDatabaseUrl(): string {
  return assertTestDatabaseUrl(databaseEnvironmentSchema.parse(process.env).DATABASE_URL);
}
