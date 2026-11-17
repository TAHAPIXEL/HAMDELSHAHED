import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { mediaFiles } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id || id.length > 64) {
    return new Response("Not found", { status: 404 });
  }
  const db = await getDb();
  const [row] = await db
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.id, id))
    .limit(1);

  if (!row) {
    return new Response("Not found", { status: 404 });
  }
  if (!row.fallbackData) {
    return Response.redirect(row.publicUrl, 302);
  }
  const bytes = Buffer.from(row.fallbackData, "base64");
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": row.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
