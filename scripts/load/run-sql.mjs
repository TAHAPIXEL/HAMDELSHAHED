#!/usr/bin/env node
// ----------------------------------------------------------------------------
//  اجرای یک فایل SQL روی DATABASE_URL (برای seed-500.sql، sessions.sql، cleanup.sql)
//  استفاده:  DATABASE_URL=postgresql://... node scripts/load/run-sql.mjs scripts/load/seed-500.sql
// ----------------------------------------------------------------------------
import { readFile } from "node:fs/promises";
import pg from "pg";

const file = process.argv[2];
const url = process.env.DATABASE_URL?.trim();
if (!file || !url) {
  console.error("استفاده: DATABASE_URL=... node scripts/load/run-sql.mjs <file.sql>");
  process.exit(2);
}

const sql = await readFile(file, "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
const started = Date.now();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`انجام شد: ${file} (${Math.round((Date.now() - started) / 1000)} ثانیه)`);
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error(`خطا در ${file}:`, err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
