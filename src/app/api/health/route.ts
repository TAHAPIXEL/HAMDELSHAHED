import { sql } from "drizzle-orm";
import { getDb, getDbMode } from "@/db";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const db = await getDb();
    const mode = await getDbMode();
    const result = await db.execute<{ version: string }>(sql`select version()`);
    const rows = (result as unknown as { rows?: { version?: string }[] }).rows;
    const supabase = getSupabaseAdmin();
    let storageReady = false;
    if (supabase) {
      const { data } = await supabase.storage.getBucket(STORAGE_BUCKET);
      storageReady = Boolean(data);
    }
    return Response.json({
      ok: true,
      database: mode,
      storage: supabase ? (storageReady ? "supabase-ready" : "supabase-configured") : "local",
      version: rows?.[0]?.version ? "PostgreSQL" : null,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[health]", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
