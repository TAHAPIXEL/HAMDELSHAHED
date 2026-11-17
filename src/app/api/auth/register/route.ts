import { randomBytes } from "node:crypto";
import { query } from "@/db";
import { REGISTRABLE_ROLES, isManagerRole } from "@/lib/collections";
import { verifyStaffKey } from "@/lib/secrets";
import { HttpError, NO_STORE, clientIp, errorResponse, rateLimit, readJson } from "@/lib/server/http";
import { viewerFromRequest } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const STR_FIELDS = ["firstName", "lastName", "fatherName", "nationalId", "address", "birthDate", "section", "bio"] as const;
const MAX_LEN = 200;

function cleanText(v: unknown, field: string, required = false): string | undefined {
  if (v === undefined || v === null || v === "") {
    if (required) throw new HttpError(400, `فیلد «${field}» الزامی است.`);
    return undefined;
  }
  if (typeof v !== "string") throw new HttpError(400, `فیلد «${field}» نامعتبر است.`);
  const t = v.trim();
  if (!t) {
    if (required) throw new HttpError(400, `فیلد «${field}» الزامی است.`);
    return undefined;
  }
  if (t.length > MAX_LEN) throw new HttpError(400, `فیلد «${field}» بیش از حد طولانی است.`);
  return t;
}

export async function POST(req: Request) {
  try {
    rateLimit(`register:${clientIp(req)}`, 30, 10 * 60 * 1000);
    const body = await readJson<{ user?: Record<string, unknown>; staffKey?: unknown }>(req);
    const input = body.user;
    if (!input || typeof input !== "object") throw new HttpError(400, "اطلاعات کاربر ارسال نشده است.");

    const role = String(input.role ?? "");
    if (!(REGISTRABLE_ROLES as readonly string[]).includes(role)) {
      throw new HttpError(400, "نقش کاربری نامعتبر است.");
    }
    const firstName = cleanText(input.firstName, "نام", true)!;
    const lastName = cleanText(input.lastName, "نام خانوادگی", true)!;
    const phone = cleanText(input.phone, "شماره تلفن", true)!;
    const password = cleanText(input.password, "رمز عبور", true)!;
    if (!/^\d{7,15}$/.test(phone)) throw new HttpError(400, "شماره تلفن معتبر نیست.");
    if (password.length > 100) throw new HttpError(400, "رمز عبور بیش از حد طولانی است.");

    const viewer = await viewerFromRequest(req);
    const managed = Boolean(viewer && isManagerRole(viewer.role));
    if (role !== "student" && !managed) {
      const key = typeof body.staffKey === "string" ? body.staffKey : "";
      if (!key || !(await verifyStaffKey(key))) {
        throw new HttpError(403, "کد ثبت‌نام کادر اشتباه است.");
      }
    }

    const record: Record<string, unknown> = {
      id: `u_${Date.now().toString(36)}${randomBytes(4).toString("hex")}`,
      role,
      firstName,
      lastName,
      phone,
      password,
      createdAt: Date.now(),
    };
    for (const f of STR_FIELDS) {
      const v = cleanText(input[f], f);
      if (v !== undefined) record[f] = v;
    }
    if (role === "student") {
      const grade = Number(input.grade);
      if (![7, 8, 9].includes(grade)) throw new HttpError(400, "پایه‌ی تحصیلی نامعتبر است.");
      record.grade = grade;
      if (!record.section) throw new HttpError(400, "شعبه‌ی کلاس الزامی است.");
      if (!/^\d{10}$/.test(String(record.nationalId ?? ""))) throw new HttpError(400, "کد ملی باید ۱۰ رقم باشد.");
    } else {
      const staffRole = String(input.staffRole ?? role);
      record.staffRole = staffRole;
    }
    if (typeof input.avatar === "string" && input.avatar) {
      if (!/^https:\/\/[^\s]+$/.test(input.avatar) || input.avatar.length > 1000) {
        throw new HttpError(400, "آدرس تصویر پروفایل نامعتبر است.");
      }
      record.avatar = input.avatar;
    }

    await query(
      `insert into hamdel_records (collection, id, data, rev, deleted, updated_at)
       values ('users', $1, $2::jsonb, nextval('hamdel_rev_seq'), false, now())`,
      [record.id, JSON.stringify(record)],
    );
    return Response.json({ user: record }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
