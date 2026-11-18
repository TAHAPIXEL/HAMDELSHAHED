// ----------------------------------------------------------------------------
//  خواندن و نوشتن رکوردهای همدل در PostgreSQL
//  - هر کاربر فقط داده‌هایی را می‌بیند که طبق نقش و عضویتش مجاز است.
//  - هر تغییر قبل از ذخیره اعتبارسنجی و بررسی دسترسی می‌شود.
// ----------------------------------------------------------------------------

import { query } from "@/db";
import {
  COLLECTION_KINDS,
  PRIVATE_USER_FIELDS,
  isCollectionKey,
  isManagerRole,
  isSensitiveViewerRole,
  type CollectionKey,
} from "@/lib/collections";
import { HttpError } from "./http";
import { isStoredImageUrl } from "./storage";
import type { Viewer } from "./session";

export interface RecordRow {
  c: CollectionKey;
  id: string;
  d?: unknown;
  rev: number;
  del?: boolean;
}

export interface SyncOp {
  c: CollectionKey;
  id: string;
  d?: unknown;
  del?: boolean;
}

const MAX_OPS_PER_REQUEST = 400;
const MAX_RECORD_CHARS = 300_000;
const CHANGES_PAGE = 1000;

/** کلیدهایی که دسترسی‌شان محدود است */
const RESTRICTED = ["chats", "messages", "subs", "hwsubs", "attendance", "seen", "noticeReads"] as const;

/**
 * فیلتر دسترسی در سطح پایگاه‌داده.
 * $1 = شناسه بیننده، $2 = آیا کادر است، $3 = آیا بیننده دسترسی حساس دارد
 */
const VISIBLE_SQL = `(
  r.deleted = true
  or r.collection not in ('chats','messages','subs','hwsubs','attendance','seen','noticeReads')
  or (r.collection = 'chats' and ((r.data->'memberIds') ? $1 or ($2 and r.data->>'type' <> 'direct')))
  or (r.collection = 'messages' and exists (
        select 1 from hamdel_records c
         where c.collection = 'chats' and c.id = r.data->>'chatId' and c.deleted = false
           and ((c.data->'memberIds') ? $1 or ($2 and c.data->>'type' <> 'direct'))
      ))
  or (r.collection in ('subs','hwsubs') and ($3 or r.data->>'studentId' = $1))
  or (r.collection = 'attendance' and ($3 or r.data->>'studentId' = $1))
  or (r.collection = 'noticeReads' and ($3 or left(r.id, length($1) + 1) = $1 || ':'))
  -- زمان آخرین بازدید گفتگو: خود کاربر، کادر، و اعضای همان گفتگو (برای تیک خوانده‌شدن)
  or (r.collection = 'seen' and (
        $3
        or left(r.id, length($1) + 1) = $1 || ':'
        or exists (
          select 1 from hamdel_records c
           where c.collection = 'chats' and c.deleted = false
             and c.id = substring(r.id from position(':' in r.id) + 1)
             and (c.data->'memberIds') ? $1
        )
      ))
)`;

function visibilityParams(viewer: Viewer): unknown[] {
  return [viewer.id, viewer.role !== "student", isSensitiveViewerRole(viewer.role)];
}

/** فیلدهای خصوصی هر کاربر را برای بیننده‌ی غیرمجاز حذف می‌کند */
export function shapeValue(viewer: Viewer, collection: string, id: string, value: unknown): unknown {
  if (collection !== "users" || !value || typeof value !== "object") return value;
  if (isSensitiveViewerRole(viewer.role) || viewer.id === id) return value;
  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const field of PRIVATE_USER_FIELDS) delete copy[field];
  return copy;
}

/** کل داده‌ی قابل‌مشاهده + شماره‌ی سر (head) که قبل از خواندن ردیف‌ها گرفته می‌شود */
export async function loadAll(viewer: Viewer): Promise<{ head: number; rows: RecordRow[] }> {
  const head = await query<{ head: number }>(
    `select coalesce(max(rev), 0) as head from hamdel_records`,
  );
  const { rows } = await query<{ collection: string; id: string; data: unknown; rev: number }>(
    `select r.collection, r.id, r.data, r.rev
       from hamdel_records r
      where r.deleted = false and ${VISIBLE_SQL}
      order by r.rev`,
    visibilityParams(viewer),
  );
  const out: RecordRow[] = [];
  for (const row of rows) {
    if (!isCollectionKey(row.collection)) continue;
    out.push({
      c: row.collection,
      id: row.id,
      d: shapeValue(viewer, row.collection, row.id, row.data),
      rev: row.rev,
    });
  }
  return { head: head.rows[0]?.head ?? 0, rows: out };
}

/** تغییرات بعد از یک شماره‌ی rev (برای همگام‌سازی زنده) */
export async function changesSince(
  viewer: Viewer,
  since: number,
): Promise<{ changes: RecordRow[]; head: number; hasMore: boolean }> {
  const head = await query<{ head: number }>(
    `select coalesce(max(rev), 0) as head from hamdel_records`,
  );
  const params = [...visibilityParams(viewer), since, CHANGES_PAGE + 1];
  const { rows } = await query<{
    collection: string;
    id: string;
    data: unknown;
    rev: number;
    deleted: boolean;
  }>(
    `select r.collection, r.id, r.data, r.rev, r.deleted
       from hamdel_records r
      where r.rev > $4 and ${VISIBLE_SQL}
      order by r.rev
      limit $5`,
    params,
  );
  const hasMore = rows.length > CHANGES_PAGE;
  const page = hasMore ? rows.slice(0, CHANGES_PAGE) : rows;
  const changes: RecordRow[] = [];
  for (const row of page) {
    if (!isCollectionKey(row.collection)) continue;
    changes.push(
      row.deleted
        ? { c: row.collection, id: row.id, rev: row.rev, del: true }
        : {
            c: row.collection,
            id: row.id,
            d: shapeValue(viewer, row.collection, row.id, row.data),
            rev: row.rev,
          },
    );
  }
  return { changes, head: head.rows[0]?.head ?? 0, hasMore };
}

function badOp(message = "داده‌ی ارسالی نامعتبر است."): HttpError {
  return new HttpError(400, message);
}

/** اعتبارسنجی و اعمال گروهی تغییرات (upsert / delete) */
export async function applySyncOps(viewer: Viewer, raw: unknown): Promise<number> {
  if (!Array.isArray(raw)) throw badOp();
  if (raw.length > MAX_OPS_PER_REQUEST) {
    throw new HttpError(413, "تعداد تغییرات در یک درخواست بیش از حد مجاز است.");
  }

  // اگر یک رکورد چند بار در یک درخواست بیاید، آخرین مقدار معتبر است
  const latest = new Map<string, SyncOp>();
  for (const item of raw) {
    if (!item || typeof item !== "object") throw badOp();
    const { c, id, d, del } = item as Record<string, unknown>;
    if (!isCollectionKey(c)) throw badOp("بخش داده‌ی نامعتبر است.");
    if (typeof id !== "string" || id.length === 0 || id.length > 160) throw badOp("شناسه‌ی نامعتبر است.");
    const key = `${c}\u0001${id}`;
    if (del === true) {
      latest.set(key, { c, id, del: true });
      continue;
    }
    if (COLLECTION_KINDS[c] === "record") {
      if (typeof d !== "number" || !Number.isFinite(d)) throw badOp("مقدار نامعتبر است.");
    } else {
      if (!d || typeof d !== "object" || Array.isArray(d)) throw badOp();
      if ((d as { id?: unknown }).id !== id) throw badOp("شناسه‌ی رکورد با داده هم‌خوان نیست.");
    }
    if (JSON.stringify(d).length > MAX_RECORD_CHARS) {
      throw new HttpError(413, "یکی از رکوردها بیش از حد بزرگ است.");
    }
    latest.set(key, { c, id, d });
  }

  const ops = [...latest.values()];
  if (ops.length === 0) return 0;

  await enforceRules(viewer, ops);

  const { rows } = await query<{ rev: number }>(
    `insert into hamdel_records (collection, id, data, rev, deleted, updated_at)
     select t.c, t.i, t.d::jsonb, nextval('hamdel_rev_seq'), t.dl, now()
       from unnest($1::text[], $2::text[], $3::text[], $4::boolean[]) as t(c, i, d, dl)
     on conflict (collection, id) do update
        set data = excluded.data,
            deleted = excluded.deleted,
            rev = excluded.rev,
            updated_at = excluded.updated_at
     returning rev`,
    [
      ops.map((o) => o.c),
      ops.map((o) => o.id),
      ops.map((o) => (o.del ? "{}" : JSON.stringify(o.d))),
      ops.map((o) => o.del === true),
    ],
  );
  return rows.reduce((max, r) => Math.max(max, r.rev), 0);
}

/** خواندن رکوردهای فعلی برای بررسی مالکیت */
async function existingRows(ops: SyncOp[]): Promise<Map<string, { data: Record<string, unknown>; deleted: boolean }>> {
  const map = new Map<string, { data: Record<string, unknown>; deleted: boolean }>();
  const targets = ops.filter((o) => RESTRICTED.includes(o.c as (typeof RESTRICTED)[number]) || o.c === "users");
  if (targets.length === 0) return map;
  const { rows } = await query<{ collection: string; id: string; data: Record<string, unknown>; deleted: boolean }>(
    `select r.collection, r.id, r.data, r.deleted
       from hamdel_records r
      where (r.collection, r.id) in (select * from unnest($1::text[], $2::text[]))`,
    [targets.map((o) => o.c), targets.map((o) => o.id)],
  );
  for (const r of rows) map.set(`${r.collection}\u0001${r.id}`, { data: r.data, deleted: r.deleted });
  return map;
}

/**
 * قوانین دسترسی برای نوشتن:
 * - کاربران: مدیران همه را مدیریت می‌کنند؛ دیگران فقط پروفایل خود را (بدون تغییر نقش/سمت).
 * - پیام: فقط با فرستنده‌ی خود؛ فرستنده‌ی پیام قابل تغییر نیست.
 * - تحویل تکلیف و آزمون و حضور: فقط برای خود دانش‌آموز یا کادر آموزشی.
 * - وضعیت خوانده‌شدن: فقط کلیدهایی که با شناسه‌ی خود کاربر شروع می‌شوند.
 */
async function enforceRules(viewer: Viewer, ops: SyncOp[]): Promise<void> {
  const existing = await existingRows(ops);
  const manager = isManagerRole(viewer.role);
  const sensitive = isSensitiveViewerRole(viewer.role);

  for (const op of ops) {
    const key = `${op.c}\u0001${op.id}`;
    const before = existing.get(key);
    const prev = before && !before.deleted ? before.data : undefined;

    switch (op.c) {
      case "users": {
        if (op.del) {
          if (!manager) throw new HttpError(403, "فقط مدیریت می‌تواند کاربر را حذف کند.");
          if (op.id === viewer.id) throw new HttpError(403, "حذف حساب خودتان مجاز نیست.");
          if (prev?.role === "developer") throw new HttpError(403, "حساب مدیر ارشد قابل حذف نیست.");
          break;
        }
        const next = op.d as Record<string, unknown>;
        if (next.role === "developer") throw new HttpError(403, "نقش مدیر ارشد قابل تخصیص نیست.");
        if (next.avatar !== undefined && next.avatar !== null && next.avatar !== "" && !isStoredImageUrl(next.avatar)) {
          throw new HttpError(400, "آدرس تصویر پروفایل نامعتبر است.");
        }
        if (manager) break;
        if (op.id !== viewer.id || !prev) {
          throw new HttpError(403, "اجازه‌ی تغییر این کاربر را ندارید.");
        }
        if (next.role !== prev.role || next.staffRole !== prev.staffRole) {
          throw new HttpError(403, "تغییر نقش و سمت فقط توسط مدیریت انجام می‌شود.");
        }
        break;
      }
      case "chats": {
        // غیرکادر فقط گفتگوهایی را تغییر می‌دهد که عضو یا سازنده‌ی آن است
        if (sensitive) break;
        if (op.del) {
          if (prev && !chatAccess(prev, viewer.id)) throw new HttpError(403, "اجازه‌ی حذف این گفتگو را ندارید.");
          break;
        }
        const next = op.d as Record<string, unknown>;
        if (prev) {
          if (!chatAccess(prev, viewer.id)) throw new HttpError(403, "اجازه‌ی تغییر این گفتگو را ندارید.");
        } else if (next.createdBy !== viewer.id) {
          throw new HttpError(403, "گفتگو باید به نام خودتان ساخته شود.");
        }
        break;
      }
      case "messages": {
        if (op.del) {
          if (!sensitive && prev && prev.senderId !== viewer.id) {
            throw new HttpError(403, "فقط پیام‌های خودتان را می‌توانید حذف کنید.");
          }
          break;
        }
        const next = op.d as Record<string, unknown>;
        if (prev && prev.senderId !== next.senderId) throw new HttpError(403, "فرستنده‌ی پیام قابل تغییر نیست.");
        if (!prev && next.senderId !== viewer.id && !sensitive) {
          throw new HttpError(403, "پیام باید به نام خودتان ثبت شود.");
        }
        break;
      }
      case "subs":
      case "hwsubs":
      case "attendance": {
        if (op.del) {
          if (!sensitive && prev && prev.studentId !== viewer.id) throw new HttpError(403, "اجازه‌ی حذف ندارید.");
          break;
        }
        const next = op.d as Record<string, unknown>;
        const owner = next.studentId;
        if (!sensitive && owner !== viewer.id) throw new HttpError(403, "اجازه‌ی ثبت برای این دانش‌آموز را ندارید.");
        if (!sensitive && prev && prev.studentId !== viewer.id) throw new HttpError(403, "اجازه‌ی تغییر این رکورد را ندارید.");
        break;
      }
      case "seen":
      case "noticeReads": {
        if (!sensitive && !op.id.startsWith(`${viewer.id}:`)) {
          throw new HttpError(403, "اجازه‌ی تغییر این وضعیت را ندارید.");
        }
        break;
      }
      default:
        break;
    }
  }
}

function chatAccess(chat: Record<string, unknown>, userId: string): boolean {
  const members = Array.isArray(chat.memberIds) ? (chat.memberIds as unknown[]) : [];
  return members.includes(userId) || chat.createdBy === userId || chat.ownerId === userId;
}

/** حذف نرم همه‌ی رکوردها (برای پاک‌سازی کامل توسط مدیر) */
export async function softDeleteAllRecords(): Promise<number> {
  const { rowCount } = await query(
    `update hamdel_records
        set deleted = true, data = '{}'::jsonb, rev = nextval('hamdel_rev_seq'), updated_at = now()
      where deleted = false`,
  );
  return rowCount;
}
