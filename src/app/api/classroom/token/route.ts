import { HttpError, NO_STORE, errorResponse, readJson } from "@/lib/server/http";
import { liveTokenFor } from "@/lib/server/classroom";
import { requireViewer } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** توکن ورود به کلاس زنده‌ی LiveKit: POST /api/classroom/token  { room } */
export async function POST(req: Request) {
  try {
    const viewer = await requireViewer(req);
    const body = await readJson(req);
    if (typeof body.room !== "string") throw new HttpError(400, "درخواست نامعتبر است.");
    const res = await liveTokenFor(viewer, body.room);
    return Response.json(res, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
