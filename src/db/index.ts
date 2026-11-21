// ----------------------------------------------------------------------------
//  اتصال به PostgreSQL (Supabase) از طریق DATABASE_URL
// ----------------------------------------------------------------------------

import { Pool, types, type QueryResultRow } from "pg";
import { SCHEMA_SQL } from "./schema";

// bigint (rev و زمان‌ها) به عدد تبدیل شود نه رشته
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

type Globals = {
  __hamdelPool?: Pool;
  __hamdelSchema?: Promise<void>;
};
const globals = globalThis as unknown as Globals;

function createPool(): Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("متغیر DATABASE_URL تنظیم نشده است.");
  }
  const host = new URL(url).hostname;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  const useSsl = !isLocal || process.env.PG_SSL === "true";
  const onVercel = Boolean(process.env.VERCEL);
  return new Pool({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PG_POOL_MAX ?? (onVercel ? 3 : 10)),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: onVercel,
  });
}

export function getPool(): Pool {
  globals.__hamdelPool ??= createPool();
  return globals.__hamdelPool;
}

function ensureSchema(): Promise<void> {
  globals.__hamdelSchema ??= getPool()
    .query(SCHEMA_SQL)
    .then(() => undefined)
    .catch((err: unknown) => {
      globals.__hamdelSchema = undefined;
      throw err;
    });
  return globals.__hamdelSchema;
}

/** اجرای یک کوئری؛ قبل از اولین کوئری، طرح پایگاه‌داده تضمین می‌شود. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  await ensureSchema();
  const res = await getPool().query<T>(text, params);
  return { rows: res.rows, rowCount: res.rowCount ?? 0 };
}
