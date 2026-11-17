// اجرای کامل آزمون‌ها: PGlite → ساخت Next.js → سرور تولید → آزمون API → آزمون کلاینت
import { spawn, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = Number(process.env.E2E_PORT ?? 3100);
const PG_PORT = Number(process.env.PGLITE_PORT ?? 55432);
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

const env = {
  ...process.env,
  PGLITE_PORT: String(PG_PORT),
  DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`,
  PG_POOL_MAX: "1",
  HAMDEL_STAFF_KEY_HASH: sha("staff-test-key"),
  HAMDEL_DEV_LOGIN_HASH: sha("09000000000|dev-test-pass"),
  HAMDEL_WIPE_HASH: sha("wipe-test"),
  BASE_URL: `http://127.0.0.1:${PORT}`,
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.SUPABASE_URL;
delete env.SUPABASE_SERVICE_ROLE_KEY;

const children = [];
function start(cmd, args, label) {
  const child = spawn(cmd, args, { cwd: root, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  child.stdout.on("data", (d) => process.env.E2E_VERBOSE && process.stdout.write(`[${label}] ${d}`));
  child.stderr.on("data", (d) => process.env.E2E_VERBOSE && process.stderr.write(`[${label}] ${d}`));
  return child;
}
function cleanup() {
  // هر فرایند در گروه خودش است؛ کل گروه (از جمله next-server فرزند npx) بسته می‌شود
  for (const c of children) {
    try {
      process.kill(-c.pid, "SIGTERM");
    } catch {
      // از قبل بسته شده است
    }
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

async function waitForPort(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      return true;
    } catch {
      await sleep(300);
    }
  }
  throw new Error(`port ${port} did not open`);
}

let code = 1;
try {
  execSync("node scripts/e2e/transpile.mjs", { cwd: root, env, stdio: "inherit" });

  const pg = start("node", ["scripts/e2e/pglite-server.mjs"], "pglite");
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("pglite did not start")), 60000);
    pg.stdout.on("data", (d) => {
      if (String(d).includes("PGLITE_READY")) {
        clearTimeout(t);
        resolve();
      }
    });
    pg.on("exit", () => reject(new Error("pglite exited")));
  });

  execSync("npx next build", { cwd: root, env, stdio: "inherit" });

  start("npx", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], "next");
  await waitForPort(PORT, 120000);

  execSync("node scripts/e2e/api.test.mjs", { cwd: root, env, stdio: "inherit" });
  execSync("node scripts/e2e/store.test.mjs", { cwd: root, env, stdio: "inherit" });
  code = 0;
} catch (err) {
  console.error(String(err.message ?? err));
  code = 1;
} finally {
  cleanup();
}
process.exit(code);
