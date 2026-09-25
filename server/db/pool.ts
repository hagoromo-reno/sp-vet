import { Pool, PoolConfig } from 'pg';

let isDbTemporarilyUnreachable = false;
let lastUnreachableCheckTime = 0;
const RETRY_INTERVAL_MS = 30000; // 30 seconds

// Configuration prioritized for PgBouncer pooler or DATABASE_URL inside PetSoftNet network
function getPoolConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }

  return {
    host: process.env.DB_HOST || 'postgres-pool',
    port: Number(process.env.DB_PORT || 6432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '19dd7b730f9dd8a558ceb1d94dce7e8b',
    database: process.env.DB_NAME || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 1500,
  };
}

export const pool = new Pool(getPoolConfig());

// Direct pool for DDL migrations (bypasses PgBouncer when DIRECT_URL is defined)
export const directPool = process.env.DIRECT_URL
  ? new Pool({
      connectionString: process.env.DIRECT_URL,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 3000,
    })
  : pool;

// Helper function with fast circuit breaker when DB host is unreachable
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const now = Date.now();
  if (isDbTemporarilyUnreachable && now - lastUnreachableCheckTime < RETRY_INTERVAL_MS) {
    throw new Error('PostgreSQL temporariamente inacessível (utilizando fallback em memória).');
  }

  try {
    const res = await pool.query(text, params);
    isDbTemporarilyUnreachable = false;
    return { rows: res.rows, rowCount: res.rowCount };
  } catch (error: any) {
    if (error?.code === 'ENOTFOUND' || error?.message?.includes('timeout') || error?.code === 'ECONNREFUSED') {
      isDbTemporarilyUnreachable = true;
      lastUnreachableCheckTime = Date.now();
    }
    throw error;
  }
}
