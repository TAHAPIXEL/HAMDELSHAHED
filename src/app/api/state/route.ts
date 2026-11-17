import { NO_STORE, errorResponse } from "@/lib/server/http";
import { loadAll } from "@/lib/server/records";
import { requireViewer } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const viewer = await requireViewer(req);
    const { head, rows } = await loadAll(viewer);
    return Response.json({ head, rows }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
