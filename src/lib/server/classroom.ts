// ----------------------------------------------------------------------------
//  کلاس آنلاین: وضعیت شروع/پایان و مجوز صحبت
//  - مدرس (کادر) کلاس را شروع و پایان می‌دهد؛ دانش‌آموز فقط به کلاس خودش وارد می‌شود.
//  - صدا/تصویر/چت/دست بالا از طریق LiveKit جابه‌جا می‌شود؛ این سرور فقط وضعیت و مجوزها را کنترل می‌کند.
// ----------------------------------------------------------------------------

import { query } from "@/db";
import { HttpError, rateLimit } from "./http";
import type { Viewer } from "./session";
import { MAX_LISTENERS, closeLiveRoom, mintLiveToken, openLiveRoom, setSpeakPermission } from "./livekit";

/** شناسه‌ی اتاق = «پایه-شعبه» مثل 9-1؛ همان مقادیر کلاس‌های سامانه */
const ROOM_RE = /^(7-[1-4]|8-[1-4]|9-[1-2])$/;

export { MAX_LISTENERS };

export interface LiveState {
  roomId: string;
  live: boolean;
  chatOpen: boolean;
  teacherId: string | null;
  teacherName: string;
  startedAt: number | null;
  maxListeners: number;
}

interface RoomRow {
  room_id: string;
  teacher_id: string;
  live: boolean;
  chat_open: boolean;
  started_ms: string;
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
    `select room_id, teacher_id, live, chat_open, (extract(epoch from started_at) * 1000)::bigint as started_ms
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
  };
}

/** توکن LiveKit برای ورود به کلاس؛ فقط وقتی کلاس زنده است */
export async function liveTokenFor(viewer: Viewer, rawRoom: unknown): Promise<{ url: string; token: string; canPublish: boolean }> {
  const roomId = roomIdOf(rawRoom);
  await assertRoomAccess(viewer, roomId);
  const room = await roomRow(roomId);
  if (!room?.live) throw new HttpError(409, "کلاس هنوز شروع نشده است.");
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
export async function actLive(viewer: Viewer, body: ActBody): Promise<void> {
  const roomId = roomIdOf(body.room);
  await assertRoomAccess(viewer, roomId);
  const action = body.action;

  if (action === "start") {
    if (!isStaffViewer(viewer)) throw new HttpError(403, "فقط کادر مدرسه می‌تواند کلاس آنلاین را شروع کند.");
    const room = await roomRow(roomId);
    if (room?.live && room.teacher_id !== viewer.id) {
      throw new HttpError(409, "این کلاس هم‌اکنون توسط مدرس دیگری در حال برگزاری است.");
    }
    // اول اتاق رسانه ساخته می‌شود تا اگر سرویس تنظیم نباشد، کلاس نیمه‌باز نماند
    await openLiveRoom(roomId);
    await query(
      `insert into hamdel_live_rooms (room_id, teacher_id, live, started_at, updated_at)
            values ($1, $2, true, now(), now())
       on conflict (room_id) do update
              set teacher_id = excluded.teacher_id,
                  started_at = case when hamdel_live_rooms.live then hamdel_live_rooms.started_at else now() end,
                  chat_open = case when hamdel_live_rooms.live then hamdel_live_rooms.chat_open else true end,
                  live = true, updated_at = now()`,
      [roomId, viewer.id],
    );
    return;
  }

  if (action === "end") {
    const room = requireTeacher(viewer, await roomRow(roomId));
    await query(`update hamdel_live_rooms set live = false, updated_at = now() where room_id = $1`, [room.room_id]);
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
