// سرور آزمایشی PostgreSQL (PGlite) روی پروتکل سیم PostgreSQL — فقط برای آزمون محلی
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.PGLITE_PORT ?? 55432);
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
await server.start();
console.log(`PGLITE_READY ${port}`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
