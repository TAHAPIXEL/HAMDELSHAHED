import { query } from "@/db";
import { NO_STORE, errorResponse } from "@/lib/server/http";
import { storageStatus } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await query("select 1");
    return Response.json(
      {
        ok: true,
        database: "postgres",
        storage: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "missing",
        media: await storageStatus(),
        latencyMs: Date.now() - started,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
