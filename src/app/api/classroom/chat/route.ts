import { HttpError, NO_STORE, errorResponse, readJson } from "@/lib/server/http";
import { classChatHistory, postClassChat } from "@/lib/server/classroom";
import { requireViewer } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** تاریخچه‌ی چت کلاس و وضعیت باز/بسته: GET /api/classroom/chat?room=9-1 */
export async function GET(req: Request) {
  try {
    const viewer = await requireViewer(req);
    const room = new URL(req.url).searchParams.get("room");
    const res = await classChatHistory(viewer, room);
    return Response.json(res, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

/** ثبت پیام چت کلاس: POST /api/classroom/chat  { room, id, text } */
export async function POST(req: Request) {
  try {
    const viewer = await requireViewer(req);
    const body = await readJson(req);
    if (typeof body.room !== "string") throw new HttpError(400, "درخواست نامعتبر است.");
    await postClassChat(viewer, body);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
