import { NO_STORE, errorResponse, readJson } from "@/lib/server/http";
import { applySyncOps } from "@/lib/server/records";
import { requireViewer } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const viewer = await requireViewer(req);
    const body = await readJson<{ ops?: unknown }>(req);
    const head = await applySyncOps(viewer, body.ops);
    return Response.json({ ok: true, head }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
