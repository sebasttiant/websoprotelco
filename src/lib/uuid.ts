import { z } from "zod";

const uuidSchema = z.uuid();

// Route params like `/admin/products/<id>` flow into `WHERE id = $1` against a uuid column. A
// value such as "not-a-uuid" would otherwise reach Postgres and crash the request with
// "invalid input syntax for type uuid". Validate at the boundary so an invalid id becomes a
// clean not-found instead of a 500. Centralized so every route guards the same way.
export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
