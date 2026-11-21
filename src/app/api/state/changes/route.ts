import { HttpError, NO_STORE, errorResponse } from "@/lib/server/http";
import { changesSince } from "@/lib/server/records";
import { requireViewer } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const viewer = await requireViewer(req);
    const raw = new URL(req.url).searchParams.get("since") ?? "0";
    const since = Number(raw);
    if (!Number.isInteger(since) || since < 0) throw new HttpError(400, "پارامتر since نامعتبر است.");
    const result = await changesSince(viewer, since);
    return Response.json(result, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
