/**
 * پاک‌کردن پایگاه‌داده‌ی محلی PGlite (داده‌ی نمونه در اجرای بعدی از نو ساخته می‌شود).
 *   npm run db:reset
 */
import { rmSync } from "node:fs";
import { join } from "node:path";

const dir = process.env.PGLITE_DATA_DIR?.trim() || "./.data/pglite";
rmSync(join(process.cwd(), dir), { recursive: true, force: true });
console.log(`✓ پایگاه‌داده‌ی محلی پاک شد: ${dir}`);
