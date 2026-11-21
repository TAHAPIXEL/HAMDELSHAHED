// ----------------------------------------------------------------------------
//  کلاس آنلاین: اتاق صوتی زنده‌ی هر کلاس
//  - مدرس (کادر) کلاس را شروع می‌کند و صدایش برای حاضرین پخش می‌شود.
//  - دانش‌آموز فقط به کلاس خودش وارد می‌شود، دست بالا می‌برد و با اجازه‌ی مدرس صحبت می‌کند.
//  - این سرور فقط وضعیت و پیام‌های سیگنال‌دهی WebRTC را جابه‌جا می‌کند؛ صدا مستقیم بین مرورگرها می‌رود.
// ----------------------------------------------------------------------------

import { query } from "@/db";
import { HttpError } from "./http";
import type { Viewer } from "./session";

/** سقف حاضرین هم‌زمان: اتصال صوتی مستقیم از مدرس به هر دانش‌آموز (بدون سرور رسانه) */
export const MAX_LISTENERS = 40;
/** اگر این مدت دیده نشود، حاضر «آفلاین» حساب می‌شود */
const ONLINE_SECONDS = 15;
const MAX_PAYLOAD_CHARS = 20_000;
const SIGNAL_KINDS = ["offer", "answer", "ice"] as const;
/** شناسه‌ی اتاق = «پایه-شعبه» مثل 9-1؛ همان مقادیر کلاس‌های سامانه */
const ROOM_RE = /^(7-[1-4]|8-[1-4]|9-[1-2])$/;

export interface LiveMember {
  userId: string;
  name: string;
  hand: boolean;
  speaking: boolean;
  joinedAt: number;
  lastSeen: number;
  online: boolean;
}

export interface LiveSignal {
  id: number;
  from: string;
  kind: (typeof SIGNAL_KINDS)[number];
  payload: unknown;
}

export interface LiveState {
  roomId: string;
  live: boolean;
  teacherId: string | null;
  teacherName: string;
  startedAt: number | null;
  maxListeners: number;
  members: LiveMember[];
  signals: LiveSignal[];
}

interface RoomRow {
  room_id: string;
  teacher_id: string;
  live: boolean;
  started_ms: string;
}

const isStaffViewer = (v: Viewer) => v.role !== "student";

function roomIdOf(raw: unknown): string {
  const roomId = typeof raw === "string" ? raw.trim() : "";
  if (!ROOM_RE.test(roomId)) throw new HttpError(400, "شناسه‌ی کلاس نامعتبر است.");
  return roomId;
}

/** دانش‌آموز فقط به کلاس خودش دسترسی دارد؛ کادر مدرسه به همه‌ی کلاس‌ها */
async function assertRoomAccess(viewer: Viewer, roomId: string): Promise<void> {
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
    `select room_id, teacher_id, live, (extract(epoch from started_at) * 1000)::bigint as started_ms
       from hamdel_live_rooms where room_id = $1`,
    [roomId],
  );
  return res.rows[0] ?? null;
}

async function requireMember(roomId: string, userId: string): Promise<void> {
  const res = await query(`select 1 from hamdel_live_members where room_id = $1 and user_id = $2`, [roomId, userId]);
  if (res.rowCount === 0) throw new HttpError(409, "ابتدا به کلاس آنلاین بپیوندید.");
}

function requireTeacher(viewer: Viewer, room: RoomRow | null): RoomRow {
  if (!room || room.teacher_id !== viewer.id) throw new HttpError(403, "فقط مدرس این کلاس می‌تواند این کار را انجام دهد.");
  return room;
}

/** وضعیت اتاق برای یک بیننده + تحویل و حذف سیگنال‌های خوانده‌نشده‌ی او */
export async function getLiveState(viewer: Viewer, rawRoom: unknown): Promise<LiveState> {
  const roomId = roomIdOf(rawRoom);
  await assertRoomAccess(viewer, roomId);

  // آخرین دیده‌شدن (هر ~۴ ثانیه یک بار نوشته شود تا بار پایگاه‌داده کم بماند)
  await query(
    `update hamdel_live_members set last_seen = now()
      where room_id = $1 and user_id = $2 and last_seen < now() - interval '4 seconds'`,
    [roomId, viewer.id],
  );

  const room = await roomRow(roomId);
  const memberRes = await query<{
    user_id: string;
    name: string;
    hand: boolean;
    speaking: boolean;
    joined_ms: string;
    seen_ms: string;
    online: boolean;
  }>(
    `select user_id, name, hand, speaking,
            (extract(epoch from joined_at) * 1000)::bigint as joined_ms,
            (extract(epoch from last_seen) * 1000)::bigint as seen_ms,
            (last_seen > now() - make_interval(secs => $2::double precision)) as online
       from hamdel_live_members
      where room_id = $1 and last_seen > now() - interval '10 minutes'
      order by joined_at`,
    [roomId, ONLINE_SECONDS],
  );

  const sigRes = await query<{ id: number; from_id: string; kind: LiveSignal["kind"]; payload: unknown }>(
    `select id, from_id, kind, payload from hamdel_signals
      where room_id = $1 and to_id = $2 order by id limit 300`,
    [roomId, viewer.id],
  );
  if (sigRes.rows.length) {
    const maxId = sigRes.rows[sigRes.rows.length - 1].id;
    await query(`delete from hamdel_signals where room_id = $1 and to_id = $2 and id <= $3`, [roomId, viewer.id, maxId]);
  }

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
    teacherId: room?.teacher_id ?? null,
    teacherName,
    startedAt: room?.live ? Number(room.started_ms) : null,
    maxListeners: MAX_LISTENERS,
    members: memberRes.rows.map((m) => ({
      userId: m.user_id,
      name: m.name,
      hand: m.hand,
      speaking: m.speaking,
      joinedAt: Number(m.joined_ms),
      lastSeen: Number(m.seen_ms),
      online: m.online,
    })),
    signals: sigRes.rows.map((s) => ({ id: s.id, from: s.from_id, kind: s.kind, payload: s.payload })),
  };
}

type ActBody = Record<string, unknown>;

/** همه‌ی تغییرات کلاس آنلاین: شروع/پایان، ورود/خروج، دست بالا، اجازه‌ی صحبت، سیگنال WebRTC */
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
    await query(
      `insert into hamdel_live_rooms (room_id, teacher_id, live, started_at, updated_at)
            values ($1, $2, true, now(), now())
       on conflict (room_id) do update
              set teacher_id = excluded.teacher_id,
                  started_at = case when hamdel_live_rooms.live then hamdel_live_rooms.started_at else now() end,
                  live = true, updated_at = now()`,
      [roomId, viewer.id],
    );
    // شروع تازه: حاضران قبلی باید دوباره وارد شوند و سیگنال‌های قدیمی حذف شود
    await query(`delete from hamdel_live_members where room_id = $1`, [roomId]);
    await query(`delete from hamdel_signals where room_id = $1`, [roomId]);
    return;
  }

  if (action === "end") {
    const room = requireTeacher(viewer, await roomRow(roomId));
    await query(`update hamdel_live_rooms set live = false, updated_at = now() where room_id = $1`, [room.room_id]);
    await query(`delete from hamdel_live_members where room_id = $1`, [roomId]);
    await query(`delete from hamdel_signals where room_id = $1`, [roomId]);
    return;
  }

  if (action === "join") {
    const room = await roomRow(roomId);
    if (!room?.live) throw new HttpError(409, "کلاس هنوز شروع نشده است.");
    if (room.teacher_id === viewer.id) throw new HttpError(409, "شما مدرس این کلاس هستید.");
    const others = await query<{ n: number }>(
      `select count(*)::int as n from hamdel_live_members
        where room_id = $1 and user_id <> $2 and last_seen > now() - make_interval(secs => $3::double precision)`,
      [roomId, viewer.id, ONLINE_SECONDS],
    );
    if ((others.rows[0]?.n ?? 0) >= MAX_LISTENERS) {
      throw new HttpError(409, `ظرفیت این کلاس آنلاین (${MAX_LISTENERS} نفر) تکمیل است.`);
    }
    await query(`delete from hamdel_live_members where room_id = $1 and last_seen < now() - interval '10 minutes'`, [roomId]);
    await query(
      `insert into hamdel_live_members (room_id, user_id, name, hand, speaking, joined_at, last_seen)
            values ($1, $2, $3, false, false, now(), now())
       on conflict (room_id, user_id) do update
              set name = excluded.name, hand = false, speaking = false, joined_at = now(), last_seen = now()`,
      [roomId, viewer.id, viewer.name],
    );
    return;
  }

  if (action === "leave") {
    await query(`delete from hamdel_live_members where room_id = $1 and user_id = $2`, [roomId, viewer.id]);
    return;
  }

  if (action === "hand") {
    await requireMember(roomId, viewer.id);
    await query(`update hamdel_live_members set hand = $3 where room_id = $1 and user_id = $2`, [
      roomId,
      viewer.id,
      body.raised === true,
    ]);
    return;
  }

  if (action === "speak") {
    const room = requireTeacher(viewer, await roomRow(roomId));
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) throw new HttpError(400, "درخواست نامعتبر است.");
    await query(
      `update hamdel_live_members set speaking = $3, hand = false where room_id = $1 and user_id = $2`,
      [room.room_id, userId, body.allowed === true],
    );
    return;
  }

  if (action === "signal") {
    const room = await roomRow(roomId);
    if (!room?.live) throw new HttpError(409, "کلاس هنوز شروع نشده است.");
    const kind = body.kind;
    if (!SIGNAL_KINDS.includes(kind as LiveSignal["kind"])) throw new HttpError(400, "نوع سیگنال نامعتبر است.");
    const to = typeof body.to === "string" ? body.to : "";
    if (!to || to === viewer.id) throw new HttpError(400, "گیرنده‌ی سیگنال نامعتبر است.");
    const payloadText = JSON.stringify(body.payload ?? null);
    if (payloadText.length > MAX_PAYLOAD_CHARS) throw new HttpError(413, "سیگنال بیش از حد بزرگ است.");

    // فقط بین مدرس و حاضر همین کلاس (دانش‌آموزان مستقیم با هم صحبت WebRTC ندارند)
    const isTeacher = (id: string) => id === room.teacher_id;
    if (!isTeacher(viewer.id) && !isTeacher(to)) {
      throw new HttpError(403, "سیگنال صوتی فقط بین مدرس و حاضران کلاس رد و بدل می‌شود.");
    }
    if (!isTeacher(viewer.id)) await requireMember(roomId, viewer.id);
    if (!isTeacher(to)) {
      const res = await query(`select 1 from hamdel_live_members where room_id = $1 and user_id = $2`, [roomId, to]);
      if (res.rowCount === 0) throw new HttpError(409, "گیرنده در این کلاس حاضر نیست.");
    }
    await query(
      `insert into hamdel_signals (room_id, from_id, to_id, kind, payload) values ($1, $2, $3, $4, $5::jsonb)`,
      [roomId, viewer.id, to, kind, payloadText],
    );
    // پاک‌سازی سیگنال‌های قدیمی (تقریباً گاهی)
    if (Math.random() < 0.02) {
      await query(`delete from hamdel_signals where created_at < now() - interval '10 minutes'`);
    }
    return;
  }

  throw new HttpError(400, "درخواست نامعتبر است.");
}
