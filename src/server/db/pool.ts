import { Pool, type PoolClient, type QueryResultRow } from "pg";

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

/**
 * A single database session inside an open transaction. Every statement issued through it
 * runs on the SAME pooled connection, which is what makes BEGIN/COMMIT meaningful — the
 * module-level `query` above grabs an arbitrary client per call and would leave statements
 * scattered across connections, outside the transaction entirely.
 */
export interface TransactionClient {
  query<Row extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<Row[]>;
}

function toTransactionClient(client: PoolClient): TransactionClient {
  return {
    async query<Row extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<Row[]> {
      const result = await client.query<Row>(text, values as unknown[] | undefined);
      return result.rows;
    },
  };
}

/**
 * Runs `handler` inside a transaction, committing on success and rolling back on any thrown
 * error. Use it whenever two or more writes only make sense together — an order and its line
 * items, say: a half-written order with no lines is worse than no order at all.
 *
 * The client is released in `finally` so a failure can never leak a connection out of the
 * pool; leak enough of them and every later request blocks on connectionTimeoutMillis.
 */
export async function withTransaction<Result>(
  handler: (client: TransactionClient) => Promise<Result>,
): Promise<Result> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await handler(toTransactionClient(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    // A ROLLBACK can itself fail when the connection is already broken. Swallow that failure
    // so it cannot mask the original error, which is the one that explains what went wrong.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Transaction rollback failed:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
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
