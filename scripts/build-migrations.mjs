/**
 * SQL مهاجرت‌های تولیدشده توسط drizzle-kit را داخل یک ماژول TypeScript
 * جاسازی می‌کند تا در زمان اجرا (بدون نیاز به دسترسی به فایل‌سیستم) اجرا شود.
 *
 *   npm run db:generate && npm run db:embed
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "drizzle");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const migrations = files.map((file) => {
  const sql = readFileSync(join(dir, file), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  return { name: file.replace(/\.sql$/, ""), statements };
});

const body = `/* این فایل به‌صورت خودکار توسط scripts/build-migrations.mjs ساخته می‌شود. */
export type Migration = { name: string; statements: string[] };

export const migrations: Migration[] = ${JSON.stringify(migrations, null, 2)};
`;

writeFileSync(join(process.cwd(), "src/db/migrations.ts"), body, "utf8");
console.log(`embedded ${migrations.length} migration(s) / ${migrations.reduce((n, m) => n + m.statements.length, 0)} statements`);
