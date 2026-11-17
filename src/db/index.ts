import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";
import { migrations } from "./migrations";
import { seedDatabase } from "./seed";

/**
 * لایه‌ی داده‌ی هَمدِل
 * ---------------------------------------------------------------
 * - در استقرار ابری (Vercel + Supabase): اتصال مستقیم و امن با SSL به
 *   PostgreSQL سرور Supabase از طریق Supavisor Pooler (سازگار با IPv4 و Serverless).
 * - در توسعه‌ی محلی بدون DATABASE_URL: استفاده از PGlite روی دیسک.
 */
export type Database = PgliteDatabase<typeof schema>;

type SqlRunner = {
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
};

const MIGRATION_LOCK_KEY = 7_250_011;

async function withLock<T>(runner: SqlRunner, fn: () => Promise<T>): Promise<T> {
  await runner.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  try {
    return await fn();
  } finally {
    await runner.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
  }
}

/** بررسی و اجرای مهاجرت‌ها به‌صورت idempotent و سریع در محیط Serverless */
async function ensureSchemaAndBootstrap(runner: SqlRunner, db: Database) {
  // مسیر سریع: اگر جدول __migrations همه‌ی مهاجرت‌ها را دارد و مدیر ثبت شده، نیازی به قفل نیست.
  try {
    const applied = await runner.query<{ name: string }>("select name from __migrations");
    const done = new Set(applied.rows.map((r) => r.name));
    const allApplied = migrations.every((m) => done.has(m.name));
    if (allApplied) {
      await seedDatabase(db);
      return;
    }
  } catch {
    // جدول __migrations هنوز ساخته نشده؛ وارد مسیر مهاجرت می‌شویم.
  }

  const runMigrations = async () => {
    await runner.exec(`
      CREATE TABLE IF NOT EXISTS __migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const applied = await runner.query<{ name: string }>("select name from __migrations");
    const done = new Set(applied.rows.map((r) => r.name));

    for (const migration of migrations) {
      if (done.has(migration.name)) continue;
      for (const statement of migration.statements) {
        await runner.exec(statement);
      }
      await runner.query("insert into __migrations (name) values ($1) on conflict do nothing", [
        migration.name,
      ]);
    }

    await seedDatabase(db);
  };

  await withLock(runner, runMigrations);
}

/** پاک‌سازی پارامتر sslmode از رشته‌ی اتصال تا تنظیم ssl در pg به‌درستی اعمال شود */
function normalizeConnectionString(raw: string): { connectionString: string; useSsl: boolean } {
  try {
    const url = new URL(raw);
    const sslMode = url.searchParams.get("sslmode");
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isSupabase =
      url.hostname.endsWith(".supabase.com") || url.hostname.endsWith(".supabase.co");
    url.searchParams.delete("sslmode");
    url.searchParams.delete("supa");
    url.searchParams.delete("pgbouncer");
    const useSsl =
      process.env.PG_SSL === "true" ||
      isSupabase ||
      (sslMode !== null && sslMode !== "disable") ||
      (!isLocal && process.env.PG_SSL !== "false");
    return { connectionString: url.toString(), useSsl };
  } catch {
    return { connectionString: raw, useSsl: process.env.PG_SSL !== "false" };
  }
}

/** ساخت فهرست کاندیدهای اتصال PostgreSQL (از جمله تشخیص خودکار Pooler در Supabase) */
function buildCandidateUrls(): string[] {
  const candidates: string[] = [];
  const primary =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim();
  if (primary) candidates.push(primary);

  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  const dbPass = process.env.SUPABASE_DB_PASSWORD?.trim();
  const region = process.env.SUPABASE_REGION?.trim() || "eu-central-1";

  if (projectRef && dbPass) {
    const encPass = encodeURIComponent(dbPass);
    const hosts = [
      `aws-1-${region}.pooler.supabase.com`,
      `aws-0-${region}.pooler.supabase.com`,
    ];
    for (const host of hosts) {
      const sessionUrl = `postgresql://postgres.${projectRef}:${encPass}@${host}:5432/postgres`;
      const txUrl = `postgresql://postgres.${projectRef}:${encPass}@${host}:6543/postgres`;
      if (!candidates.includes(sessionUrl)) candidates.push(sessionUrl);
      if (!candidates.includes(txUrl)) candidates.push(txUrl);
    }
  }

  return candidates;
}

function makePool(rawUrl: string): Pool {
  const { connectionString, useSsl } = normalizeConnectionString(rawUrl);
  const isServerless = Boolean(process.env.VERCEL);
  const defaultMax = isServerless ? 3 : 10;
  const config: PoolConfig = {
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? defaultMax),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: isServerless,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
  return new Pool(config);
}

async function connectPostgres(candidates: string[]): Promise<Pool> {
  let lastError: unknown = null;
  for (const raw of candidates) {
    const pool = makePool(raw);
    try {
      await pool.query("select 1");
      return pool;
    } catch (err) {
      lastError = err;
      await pool.end().catch(() => {});
    }
  }
  throw lastError instanceof Error ? lastError : new Error("اتصال به پایگاه‌داده‌ی PostgreSQL برقرار نشد");
}

type DbState = {
  db: Database;
  runner: SqlRunner;
  mode: "postgres" | "pglite";
  ready: Promise<void>;
  close?: () => Promise<void>;
};

const globalForDb = globalThis as unknown as { __hamdelDb?: Promise<DbState> };

async function createState(): Promise<DbState> {
  const candidates = buildCandidateUrls();

  if (candidates.length > 0) {
    const pool = await connectPostgres(candidates);
    const runner: SqlRunner = {
      exec: async (sql) => {
        await pool.query(sql);
      },
      query: async <T,>(sql: string, params?: unknown[]) => {
        const result = await pool.query(sql, params as unknown[]);
        return { rows: result.rows as T[] };
      },
    };
    const db = drizzleNode(pool, { schema }) as unknown as Database;
    const ready = ensureSchemaAndBootstrap(runner, db);
    await ready;
    return { db, runner, mode: "postgres", ready, close: () => pool.end() };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "متغیر DATABASE_URL در Vercel تنظیم نشده است. لطفاً اتصال Supabase را بررسی کنید.",
    );
  }

  const dataDir = process.env.PGLITE_DATA_DIR?.trim() || "./.data/pglite";
  await mkdir(dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  await client.waitReady;
  const runner: SqlRunner = {
    exec: async (sql) => {
      await client.exec(sql);
    },
    query: async <T,>(sql: string, params?: unknown[]) => {
      const result = await client.query<T>(sql, params as unknown[]);
      return { rows: result.rows };
    },
  };
  const db = drizzlePglite(client, { schema });
  const ready = ensureSchemaAndBootstrap(runner, db);
  await ready;
  return { db, runner, mode: "pglite", ready, close: () => client.close() };
}

function getState(): Promise<DbState> {
  if (!globalForDb.__hamdelDb) {
    globalForDb.__hamdelDb = createState().catch((err) => {
      // اگر اتصال موقتاً خطا داد، کش نشود تا درخواست بعدی دوباره تلاش کند
      globalForDb.__hamdelDb = undefined;
      throw err;
    });
  }
  return globalForDb.__hamdelDb;
}

/** دیتابیس آماده‌ی استفاده (بعد از اطمینان از اجرای مهاجرت‌ها و راه‌اندازی اولیه) */
export async function getDb(): Promise<Database> {
  const state = await getState();
  await state.ready;
  return state.db;
}

export async function getDbMode(): Promise<"postgres" | "pglite"> {
  const state = await getState();
  return state.mode;
}

/** فقط برای تست/خاموشی گراسیوس */
export async function closeDb(): Promise<void> {
  if (!globalForDb.__hamdelDb) return;
  const state = await globalForDb.__hamdelDb;
  globalForDb.__hamdelDb = undefined;
  await state.close?.();
}

export { schema };
