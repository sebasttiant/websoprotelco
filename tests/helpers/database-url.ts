import { z } from "zod";

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgresql://"),
});

export function getTestDatabaseUrl(): string {
  return databaseEnvironmentSchema.parse(process.env).DATABASE_URL;
}
