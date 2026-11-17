import { defineConfig } from "drizzle-kit";

/**
 * برای تولید مهاجرت‌ها:  npm run db:generate
 * اگر روی Postgres واقعی کار می‌کنید، DATABASE_URL را ست کنید و از
 * npm run db:push استفاده کنید.
 */
export default defineConfig({
  dialect: "postgresql",
  ...(process.env.DATABASE_URL ? {} : { driver: "pglite" as const }),
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./.data/pglite",
  },
  verbose: true,
  strict: true,
});
