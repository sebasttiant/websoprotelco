import { Pool, type QueryResultRow } from "pg";

import { readDatabaseEnv } from "./env";

interface DatabaseGlobalCache {
  pool: Pool | undefined;
}

const globalCacheKey = Symbol.for("websoprotelco.db.pool");

interface GlobalWithDatabaseCache {
  [globalCacheKey]?: DatabaseGlobalCache;
}

function getGlobalCache(): DatabaseGlobalCache {
  const globalWithCache = globalThis as GlobalWithDatabaseCache;

  globalWithCache[globalCacheKey] ??= { pool: undefined };

  return globalWithCache[globalCacheKey];
}

export function getPool(): Pool {
  const cache = getGlobalCache();

  if (!cache.pool) {
    const env = readDatabaseEnv();

    cache.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      ssl: env.DATABASE_SSL === "require" ? { rejectUnauthorized: true } : undefined,
      // Bounds how long a caller waits for a pooled client. Without it, requests past
      // `max` queue indefinitely, so unauthenticated /api/health?check=db traffic can
      // starve real requests. No statement timeout is set here on purpose: the same
      // pool runs migrations, and a long index build must not be aborted.
      connectionTimeoutMillis: 5_000,
    });
  }

  return cache.pool;
}

export async function query<Row extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<Row[]> {
  const result = await getPool().query<Row>(text, values as unknown[] | undefined);

  return result.rows;
}

export async function closePool(): Promise<void> {
  const cache = getGlobalCache();

  if (cache.pool) {
    await cache.pool.end();
    cache.pool = undefined;
  }
}

export async function checkDatabaseConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await query("SELECT 1");
    return { ok: true };
  } catch (error) {
    console.error("Database connection check failed:", error);
    return { ok: false, error: "Database connection check failed." };
  }
}
