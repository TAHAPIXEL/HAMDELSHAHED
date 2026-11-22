// ----------------------------------------------------------------------------
//  کلاس آنلاین: وضعیت شروع/پایان و مجوز صحبت
//  - مدرس (کادر) کلاس را شروع و پایان می‌دهد؛ دانش‌آموز فقط به کلاس خودش وارد می‌شود.
//  - صدا/تصویر/چت/دست بالا از طریق LiveKit جابه‌جا می‌شود؛ این سرور فقط وضعیت و مجوزها را کنترل می‌کند.
// ----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { query } from "@/db";
import { HttpError, rateLimit } from "./http";
import type { Viewer } from "./session";
import { MAX_LISTENERS, closeLiveRoom, mintLiveToken, openLiveRoom, setSpeakPermission } from "./livekit";

/** شناسه‌ی اتاق = «پایه-شعبه» مثل 9-1؛ همان مقادیر کلاس‌های سامانه */
const ROOM_RE = /^(7-[1-4]|8-[1-4]|9-[1-2]|free-[a-z0-9]{12})$/;
/** لینک ورود: ۱۲ نویسه‌ی تصادفی، بدون حروف مشابه */
const TOKEN_RE = /^[a-z0-9]{12}$/;
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** رشته‌ی تصادفی امن؛ ۳۲ نویسه‌ی ۲۵۶ تایی، پس بدون سوگیری */
export function randomCode(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return out;
}

/** ارقام فارسی و عربی را به لاتین تبدیل می‌کند و فقط رقم نگه می‌دارد */
export function normalizeDigits(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/\D/g, "");
}

export { MAX_LISTENERS };

export interface LiveState {
  roomId: string;
  live: boolean;
  chatOpen: boolean;
  teacherId: string | null;
  teacherName: string;
  startedAt: number | null;
  maxListeners: number;
  title: string;
  kind: "section" | "free";
  joinToken: string | null;
}

interface RoomRow {
  room_id: string;
  teacher_id: string;
  live: boolean;
  chat_open: boolean;
  started_ms: string;
  title: string;
  kind: string;
  join_token: string | null;
}

export interface ClassChatMsg {
  id: string;
  userId: string;
  name: string;
  text: string;
  createdAt: number;
}

const CHAT_ID_RE = /^[A-Za-z0-9_.-]{1,96}$/;
const CHAT_MAX_CHARS = 1000;
const CHAT_HISTORY = 300;

const isStaffViewer = (v: Viewer) => v.role !== "student";

export function roomIdOf(raw: unknown): string {
  const roomId = typeof raw === "string" ? raw.trim() : "";
  if (!ROOM_RE.test(roomId)) throw new HttpError(400, "شناسه‌ی کلاس نامعتبر است.");
  return roomId;
}

/** دانش‌آموز فقط به کلاس خودش دسترسی دارد؛ کادر مدرسه به همه‌ی کلاس‌ها */
export async function assertRoomAccess(viewer: Viewer, roomId: string): Promise<void> {
  if (isStaffViewer(viewer)) return;
  // کلاس آزاد: شناسه‌ی اتاق تصادفی است و ورود فقط با لینک یکتا انجام می‌شود (در resolveJoin و توکن بررسی می‌شود)
  if (roomId.startsWith("free-")) return;
  const res = await query<{ grade: string | null; section: string | null }>(
    `select data->>'grade' as grade, data->>'section' as section
       from hamdel_records where collection = 'users' and id = $1 and deleted = false`,
    [viewer.id],
  );
  const me = res.rows[0];
  if (!me || `${me.grade}-${me.section}` !== roomId) {
    throw new HttpError(403, "این کلاس آنلاین مربوط به کلاس شما نیست.");
  }
}

async function roomRow(roomId: string): Promise<RoomRow | null> {
  const res = await query<RoomRow>(
    `select room_id, teacher_id, live, chat_open, title, kind, join_token, (extract(epoch from started_at) * 1000)::bigint as started_ms
       from hamdel_live_rooms where room_id = $1`,
    [roomId],
  );
  return res.rows[0] ?? null;
}

function requireTeacher(viewer: Viewer, room: RoomRow | null): RoomRow {
  if (!room || room.teacher_id !== viewer.id) throw new HttpError(403, "فقط مدرس این کلاس می‌تواند این کار را انجام دهد.");
  return room;
}

/** وضعیت اتاق (سبک و سریع): شروع/پایان و نام مدرس */
export async function getLiveState(viewer: Viewer, rawRoom: unknown): Promise<LiveState> {
  const roomId = roomIdOf(rawRoom);
  await assertRoomAccess(viewer, roomId);
  const room = await roomRow(roomId);

  let teacherName = "مدرس";
  if (room) {
    const t = await query<{ name: string }>(
      `select trim(coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','')) as name
         from hamdel_records where collection = 'users' and id = $1 and deleted = false`,
      [room.teacher_id],
    );
    if (t.rows[0]?.name) teacherName = t.rows[0].name;
  }

  return {
    roomId,
    live: room?.live ?? false,
    chatOpen: room ? room.chat_open : true,
    teacherId: room?.teacher_id ?? null,
    teacherName,
    startedAt: room?.live ? Number(room.started_ms) : null,
    maxListeners: MAX_LISTENERS,
    title: room?.title ?? "",
    kind: room?.kind === "free" ? "free" : "section",
    // لینک ورود فقط برای مدرس همان کلاس زنده نمایش داده می‌شود
    joinToken: room?.live && room.teacher_id === viewer.id ? room.join_token : null,
  };
}

/** نام کامل مدرس از پرونده‌ی کادر */
async function teacherNameOf(teacherId: string): Promise<string> {
  const t = await query<{ name: string }>(
    `select trim(coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','')) as name
       from hamdel_records where collection = 'users' and id = $1 and deleted = false`,
    [teacherId],
  );
  return t.rows[0]?.name || "مدرس";
}

/** توکن LiveKit برای ورود به کلاس؛ فقط وقتی کلاس زنده است */
export async function liveTokenFor(
  viewer: Viewer,
  rawRoom: unknown,
  rawJoin?: unknown,
): Promise<{ url: string; token: string; canPublish: boolean }> {
  const roomId = roomIdOf(rawRoom);
  await assertRoomAccess(viewer, roomId);
  const room = await roomRow(roomId);
  if (!room?.live) throw new HttpError(409, "کلاس هنوز شروع نشده است.");
  // کلاس آزاد: غیر از مدرس، فقط کسی که لینک یکتای همان کلاس را دارد وارد می‌شود
  if (room.kind === "free" && room.teacher_id !== viewer.id) {
    const tok = typeof rawJoin === "string" ? rawJoin.trim().toLowerCase() : "";
    if (!room.join_token || tok !== room.join_token) {
      throw new HttpError(403, "برای ورود به این کلاس، لینک کلاس را باز کنید.");
    }
  }
  const isTeacher = room.teacher_id === viewer.id;
  const { url, token } = await mintLiveToken({
    roomId,
    identity: viewer.id,
    name: viewer.name,
    isTeacher,
  });
  return { url, token, canPublish: isTeacher };
}

type ActBody = Record<string, unknown>;

/** عملیات کلاس: شروع/پایان و اجازه‌ی صحبت */
export async function actLive(viewer: Viewer, body: ActBody): Promise<{ room: string } | void> {
  const action = body.action;
  // کلاس آزاد جدید: شناسه‌ی اتاق را سرور می‌سازد و برمی‌گرداند
  const newFree = action === "start" && body.kind === "free" && body.room === "new";
  const roomId = newFree ? `free-${randomCode(12)}` : roomIdOf(body.room);
  await assertRoomAccess(viewer, roomId);

  if (action === "start") {
    if (!isStaffViewer(viewer)) throw new HttpError(403, "فقط کادر مدرسه می‌تواند کلاس آنلاین را شروع کند.");
    const title = typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
    if (!title) throw new HttpError(400, "عنوان کلاس الزامی است.");
    if (title.length > 80) throw new HttpError(400, "عنوان کلاس حداکثر ۸۰ نویسه است.");
    const kind = roomId.startsWith("free-") ? "free" : "section";
    const room = await roomRow(roomId);
    if (room?.live && room.teacher_id !== viewer.id) {
      throw new HttpError(409, "این کلاس هم‌اکنون توسط مدرس دیگری در حال برگزاری است.");
    }
    // اول اتاق رسانه ساخته می‌شود تا اگر سرویس تنظیم نباشد، کلاس نیمه‌باز نماند
    await openLiveRoom(roomId);
    // کلاس زنده‌ی در حال اجرا: عنوان و لینک قبلی حفظ می‌شود؛ هر کلاس تازه لینک یکتای خودش را می‌گیرد
    await query(
      `insert into hamdel_live_rooms (room_id, teacher_id, live, started_at, updated_at, title, kind, join_token)
            values ($1, $2, true, now(), now(), $3, $4, $5)
       on conflict (room_id) do update
              set teacher_id = excluded.teacher_id,
                  started_at = case when hamdel_live_rooms.live then hamdel_live_rooms.started_at else now() end,
                  chat_open = case when hamdel_live_rooms.live then hamdel_live_rooms.chat_open else true end,
                  title = case when hamdel_live_rooms.live then hamdel_live_rooms.title else excluded.title end,
                  kind = excluded.kind,
                  join_token = case when hamdel_live_rooms.live and hamdel_live_rooms.join_token is not null
                                    then hamdel_live_rooms.join_token else excluded.join_token end,
                  live = true, updated_at = now()`,
      [roomId, viewer.id, title, kind, randomCode(12)],
    );
    return { room: roomId };
  }

  if (action === "end") {
    const room = requireTeacher(viewer, await roomRow(roomId));
    // پایان کلاس، لینک ورود را باطل می‌کند
    await query(`update hamdel_live_rooms set live = false, join_token = null, updated_at = now() where room_id = $1`, [room.room_id]);
    await closeLiveRoom(roomId);
    return;
  }

  if (action === "chat") {
    requireTeacher(viewer, await roomRow(roomId));
    await query(`update hamdel_live_rooms set chat_open = $2, updated_at = now() where room_id = $1`, [roomId, body.open === true]);
    return;
  }

  if (action === "speak") {
    const room = requireTeacher(viewer, await roomRow(roomId));
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId || userId === room.teacher_id) throw new HttpError(400, "درخواست نامعتبر است.");
    await setSpeakPermission(roomId, userId, body.allowed === true);
    return;
  }

  throw new HttpError(400, "درخواست نامعتبر است.");
}

/**
 * تاریخچه‌ی چت کلاس (ماندگار در پایگاه‌داده) و وضعیت باز/بسته‌ی چت.
 * هر کسی که به کلاس دسترسی دارد (دانش‌آموزان همان کلاس و کادر) می‌تواند بخواند.
 */
export async function classChatHistory(viewer: Viewer, rawRoom: unknown): Promise<{ chatOpen: boolean; messages: ClassChatMsg[] }> {
  const roomId = roomIdOf(rawRoom);
  await assertRoomAccess(viewer, roomId);
  const room = await roomRow(roomId);
  const res = await query<{ id: string; user_id: string; name: string; body: string; created_at: number }>(
    `select id, user_id, name, body, created_at from (
       select id, user_id, name, body, created_at from hamdel_live_chat
        where room_id = $1 order by created_at desc, id desc limit $2
     ) recent order by created_at asc, id asc`,
    [roomId, CHAT_HISTORY],
  );
  return {
    chatOpen: room ? room.chat_open : true,
    messages: res.rows.map((r) => ({ id: r.id, userId: r.user_id, name: r.name, text: r.body, createdAt: r.created_at })),
  };
}

/**
 * ثبت یک پیام چت کلاس. نام فرستنده از نشست خوانده می‌شود (نه از درخواست).
 * وقتی چت بسته است فقط مدرس می‌تواند بنویسد.
 */
export async function postClassChat(viewer: Viewer, body: ActBody): Promise<void> {
  const roomId = roomIdOf(body.room);
  await assertRoomAccess(viewer, roomId);
  const id = typeof body.id === "string" ? body.id : "";
  if (!CHAT_ID_RE.test(id)) throw new HttpError(400, "شناسه‌ی پیام نامعتبر است.");
  const text = typeof body.text === "string" ? body.text.trim().slice(0, CHAT_MAX_CHARS) : "";
  if (!text) throw new HttpError(400, "متن پیام خالی است.");
  rateLimit(`classchat:${viewer.id}`, 120, 60_000);

  const room = await roomRow(roomId);
  if (!room?.live) throw new HttpError(409, "کلاس هم‌اکنون فعال نیست.");
  const isTeacher = room.teacher_id === viewer.id;
  if (!isTeacher && !room.chat_open) throw new HttpError(403, "چت توسط مدرس بسته شده است.");

  await query(
    `insert into hamdel_live_chat (id, room_id, user_id, name, body, created_at)
          values ($1, $2, $3, $4, $5, (extract(epoch from clock_timestamp()) * 1000)::bigint)
     on conflict (id) do nothing`,
    [id, roomId, viewer.id, viewer.name.slice(0, 60), text],
  );
}


export interface JoinInfo {
  roomId: string;
  title: string;
  kind: "section" | "free";
  teacherName: string;
  /** کلاس آزاد: هنوز کد ملی وارد نشده است */
  needsCode: boolean;
  /** کلاس آزاد با کد ملی تأییدشده: نام کاربر برای نمایش */
  name: string | null;
}

/**
 * بررسی لینک ورود: فقط برای کلاس زنده.
 * - کلاس پایه/شعبه: فقط دانش‌آموزان همان شعبه (و کادر) بدون کد وارد می‌شوند.
 * - کلاس آزاد: کد ملی کاربر باید با حساب او یکی باشد تا نامش نشان داده شود.
 */
export async function resolveJoin(viewer: Viewer, rawToken: unknown, rawCode: unknown): Promise<JoinInfo> {
  const token = typeof rawToken === "string" ? rawToken.trim().toLowerCase() : "";
  if (!TOKEN_RE.test(token)) throw new HttpError(404, "این لینک معتبر نیست.");
  rateLimit(`join:${viewer.id}`, 60, 60_000);
  const res = await query<RoomRow>(
    `select room_id, teacher_id, live, chat_open, title, kind, join_token,
            (extract(epoch from started_at) * 1000)::bigint as started_ms
       from hamdel_live_rooms where join_token = $1 and live = true`,
    [token],
  );
  const room = res.rows[0];
  if (!room) throw new HttpError(410, "این لینک دیگر معتبر نیست؛ کلاس پایان یافته است.");
  await assertRoomAccess(viewer, room.room_id);

  const kind = room.kind === "free" ? "free" : "section";
  const base = { roomId: room.room_id, title: room.title, kind, teacherName: await teacherNameOf(room.teacher_id) } as const;
  if (kind !== "free") return { ...base, needsCode: false, name: null };

  const code = normalizeDigits(rawCode);
  if (!code) return { ...base, needsCode: true, name: null };
  const me = await query<{ nid: string | null; name: string }>(
    `select data->>'nationalId' as nid,
            trim(coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','')) as name
       from hamdel_records where collection = 'users' and id = $1 and deleted = false`,
    [viewer.id],
  );
  const row = me.rows[0];
  if (!row?.nid || normalizeDigits(row.nid) !== code) {
    throw new HttpError(403, "کد ملی با حساب شما یکسان نیست.");
  }
  return { ...base, needsCode: false, name: row.name || viewer.name };
}
