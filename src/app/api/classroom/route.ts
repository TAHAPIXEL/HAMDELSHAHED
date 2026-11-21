import { HttpError, NO_STORE, errorResponse, readJson } from "@/lib/server/http";
import { actLive, getLiveState } from "@/lib/server/classroom";
import { requireViewer } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** وضعیت کلاس آنلاین + سیگنال‌های خوانده‌نشده‌ی بیننده: GET /api/classroom?room=9-1 */
export async function GET(req: Request) {
  try {
    const viewer = await requireViewer(req);
    const room = new URL(req.url).searchParams.get("room");
    const state = await getLiveState(viewer, room);
    return Response.json(state, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

/** عملیات کلاس آنلاین: POST /api/classroom  { room, action, ... } */
export async function POST(req: Request) {
  try {
    const viewer = await requireViewer(req);
    const body = await readJson(req);
    if (typeof body.action !== "string") throw new HttpError(400, "درخواست نامعتبر است.");
    await actLive(viewer, body);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
