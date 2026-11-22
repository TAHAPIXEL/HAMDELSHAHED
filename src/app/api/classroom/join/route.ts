import { HttpError, NO_STORE, errorResponse, readJson } from "@/lib/server/http";
import { resolveJoin } from "@/lib/server/classroom";
import { requireViewer } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** ورود با لینک کلاس: POST /api/classroom/join  { token, code? } */
export async function POST(req: Request) {
  try {
    const viewer = await requireViewer(req);
    const body = await readJson(req);
    if (typeof body.token !== "string") throw new HttpError(404, "این لینک معتبر نیست.");
    const res = await resolveJoin(viewer, body.token, body.code);
    return Response.json(res, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
