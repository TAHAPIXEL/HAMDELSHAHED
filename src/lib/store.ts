// ----------------------------------------------------------------------------
//  لایه‌ی همگام‌سازی داده با سرور
//  - UI به صورت همگام از یک کش محلی می‌خواند (DB.users() و …).
//  - هر نوشتن محلی با «پایه‌ی آخرین وضعیت» مقایسه می‌شود و فقط تغییرات واقعی
//    به صورت گروهی به سرور فرستاده می‌شود.
//  - تغییرات کاربران دیگر هر چند ثانیه با روش rev-cursor دریافت می‌شود.
// ----------------------------------------------------------------------------

import { COLLECTION_KEYS, COLLECTION_KINDS, type CollectionKey } from "./collections";

export interface ApiErrorLike extends Error {
  status: number;
}

const SESSION_KEY = "hamdel.v1.session";
const POLL_MS = 4000;
const OVERLAP = 30; // چند rev قبلی هم دوباره خوانده شود (نوشتن‌های دیرهنگام)
const FLUSH_MS = 120;
const MAX_BATCH = 400;
const MAX_RETRIES = 4;

// ---------------------------------------------------------------------------
// نشست (فقط در مرورگر)
// ---------------------------------------------------------------------------

export interface LocalSession {
  token: string;
  dev: boolean;
  userId?: string;
}

export function getSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LocalSession;
    return s && typeof s.token === "string" ? s : null;
  } catch {
    return null;
  }
}

export function setSession(s: LocalSession | null): void {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else window.localStorage.removeItem(SESSION_KEY);
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

// ---------------------------------------------------------------------------
// فراخوانی API
// ---------------------------------------------------------------------------

export async function api<T = unknown>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown; form?: FormData; auth?: boolean; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = opts.token ?? (opts.auth === false ? null : getToken());
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, cache: "no-store" });
  } catch {
    throw makeError("ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید.", 0);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `خطای سرور (${res.status})`;
    throw makeError(msg, res.status);
  }
  return data as T;
}

function makeError(message: string, status: number): ApiErrorLike {
  const e = new Error(message) as ApiErrorLike;
  e.status = status;
  return e;
}

// ---------------------------------------------------------------------------
// کش محلی و وضعیت همگام‌سازی
// ---------------------------------------------------------------------------

type Row = { c: CollectionKey; id: string; d?: unknown; rev: number; del?: boolean };
type Op = { c: CollectionKey; id: string; d?: unknown; del?: boolean };

const isRecordKind = (c: CollectionKey) => COLLECTION_KINDS[c] === "record";
const kf = (c: string, id: string) => `${c}\u0001${id}`;

const cache = {} as Record<CollectionKey, unknown>;
/** آخرین وضعیتی که سرور دارد (یا ما فرستاده‌ایم) به‌صورت JSON */
const base = {} as Record<CollectionKey, Map<string, string>>;
/** بالاترین rev اعمال‌شده برای هر رکورد */
const serverRev = new Map<string, number>();
/** تغییرات محلی که هنوز فرستاده نشده‌اند */
const pending = new Map<string, { op: Op; seq: number }>();

let seq = 0;
let cursor = 0;
let hydrated = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let retryCount = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;
const serverMemo = new WeakMap<object, string>();

function resetAll(): void {
  for (const c of COLLECTION_KEYS) {
    cache[c] = isRecordKind(c) ? {} : [];
    base[c] = new Map();
  }
  serverRev.clear();
}
resetAll();

const emit = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("hamdel:db"));
};
const reportError = (message: string) => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("hamdel:error", { detail: message }));
};

const jsonOf = (v: unknown): string => {
  if (v && typeof v === "object") {
    const hit = serverMemo.get(v);
    if (hit !== undefined) return hit;
    const s = JSON.stringify(v);
    serverMemo.set(v, s);
    return s;
  }
  return JSON.stringify(v);
};

// ---------------------------------------------------------------------------
// خواندن و نوشتن (همگام)
// ---------------------------------------------------------------------------

export function getCollection<T>(c: CollectionKey): T {
  return cache[c] as T;
}

/** نوشتن کل مجموعه: تفاوت با پایه محاسبه و در صف ارسال قرار می‌گیرد */
export function setCollection(c: CollectionKey, next: unknown): void {
  const b = base[c];
  if (isRecordKind(c)) {
    const obj = (next ?? {}) as Record<string, number>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const j = JSON.stringify(v);
      if (b.get(k) === j) continue;
      b.set(k, j);
      enqueue({ c, id: k, d: v });
    }
    for (const k of [...b.keys()]) {
      if (!(k in obj)) {
        b.delete(k);
        enqueue({ c, id: k, del: true });
      }
    }
  } else {
    const arr = (next ?? []) as { id: string }[];
    const ids = new Set<string>();
    for (const item of arr) {
      ids.add(item.id);
      const j = JSON.stringify(item);
      if (b.get(item.id) === j) continue;
      b.set(item.id, j);
      enqueue({ c, id: item.id, d: item });
    }
    for (const id of [...b.keys()]) {
      if (!ids.has(id)) {
        b.delete(id);
        enqueue({ c, id, del: true });
      }
    }
  }
  cache[c] = next;
  emit();
}

function enqueue(op: Op): void {
  pending.set(kf(op.c, op.id), { op, seq: ++seq });
  scheduleFlush(FLUSH_MS);
}

/** افزودن فوری یک رکورد که قبلاً در سرور ثبت شده (مثلاً پاسخ ثبت‌نام) */
export function cacheUpsert(c: CollectionKey, item: { id: string }): void {
  const arr = [...(cache[c] as { id: string }[])];
  const idx = arr.findIndex((x) => x.id === item.id);
  if (idx >= 0) arr[idx] = item;
  else arr.push(item);
  cache[c] = arr;
  base[c].set(item.id, JSON.stringify(item));
  emit();
}

// ---------------------------------------------------------------------------
// اعمال تغییرات دریافتی از سرور
// ---------------------------------------------------------------------------

function applyRows(rows: Row[], overlayOnly = false): void {
  const maps = new Map<CollectionKey, Map<string, { id: string }>>();
  const touched = new Set<CollectionKey>();
  const recs = new Map<CollectionKey, Record<string, number>>();
  for (const row of rows) {
    if (!overlayOnly) {
      const k = kf(row.c, row.id);
      if ((serverRev.get(k) ?? 0) >= row.rev) continue;
      serverRev.set(k, row.rev);
      if (pending.has(k)) continue; // تغییر محلی جدید دارد؛ آن را نگه می‌داریم
    }
    touched.add(row.c);
    const b = base[row.c];
    if (isRecordKind(row.c)) {
      let obj = recs.get(row.c);
      if (!obj) {
        obj = { ...(cache[row.c] as Record<string, number>) };
        recs.set(row.c, obj);
      }
      if (row.del) {
        delete obj[row.id];
        b.delete(row.id);
      } else {
        obj[row.id] = row.d as number;
        b.set(row.id, JSON.stringify(row.d));
      }
    } else {
      let m = maps.get(row.c);
      if (!m) {
        m = new Map((cache[row.c] as { id: string }[]).map((x) => [x.id, x]));
        maps.set(row.c, m);
      }
      if (row.del) {
        m.delete(row.id);
        b.delete(row.id);
      } else {
        m.set(row.id, row.d as { id: string });
        b.set(row.id, JSON.stringify(row.d));
      }
    }
  }
  for (const [c, m] of maps) cache[c] = [...m.values()];
  for (const [c, obj] of recs) cache[c] = obj;
  if (touched.size) emit();
}

/** پاک کردن کامل کش (خروج یا پاک‌سازی) */
export function clearLocal(): void {
  stopSync();
  pending.clear();
  cursor = 0;
  hydrated = false;
  resetAll();
  emit();
}

/** بارگذاری کامل داده‌های قابل مشاهده برای کاربر جاری */
export async function hydrate(): Promise<void> {
  const res = await api<{ head: number; rows: Row[] }>("/api/state");
  // کش را از نو بسازیم، ولی تغییرات محلی هنوز ارسال‌نشده را روی آن بگذاریم
  for (const c of COLLECTION_KEYS) {
    cache[c] = isRecordKind(c) ? {} : [];
    base[c] = new Map();
  }
  serverRev.clear();
  applyRows(res.rows);
  overlayPending();
  cursor = res.head;
  hydrated = true;
  startSync();
  emit();
}

function overlayPending(): void {
  const maps = new Map<CollectionKey, Map<string, { id: string }>>();
  const recs = new Map<CollectionKey, Record<string, number>>();
  for (const { op } of pending.values()) {
    if (isRecordKind(op.c)) {
      let obj = recs.get(op.c);
      if (!obj) {
        obj = { ...(cache[op.c] as Record<string, number>) };
        recs.set(op.c, obj);
      }
      if (op.del) delete obj[op.id];
      else obj[op.id] = op.d as number;
    } else {
      let m = maps.get(op.c);
      if (!m) {
        m = new Map((cache[op.c] as { id: string }[]).map((x) => [x.id, x]));
        maps.set(op.c, m);
      }
      if (op.del) m.delete(op.id);
      else m.set(op.id, op.d as { id: string });
    }
  }
  for (const [c, m] of maps) cache[c] = [...m.values()];
  for (const [c, obj] of recs) cache[c] = obj;
}

// ---------------------------------------------------------------------------
// ارسال به سرور
// ---------------------------------------------------------------------------

function scheduleFlush(ms: number): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, ms);
}

async function flush(): Promise<void> {
  if (flushing || pending.size === 0) return;
  const token = getToken();
  if (!token) return;
  flushing = true;
  const batch = [...pending.entries()].slice(0, MAX_BATCH);
  const ops = batch.map(([, v]) => v.op);
  try {
    await api("/api/state/sync", { method: "POST", body: { ops } });
    for (const [k, v] of batch) if (pending.get(k)?.seq === v.seq) pending.delete(k);
    retryCount = 0;
    flushing = false;
    if (pending.size) scheduleFlush(0);
  } catch (err) {
    flushing = false;
    const status = (err as ApiErrorLike).status ?? 0;
    if (status === 401) return expireSession();
    const transient = status === 0 || status === 429 || status >= 500;
    if (transient && retryCount < MAX_RETRIES) {
      retryCount++;
      scheduleFlush(1000 * retryCount);
      return;
    }
    // داده‌ی رد‌شده: از سرور دوباره بخوان تا کش با واقعیت یکی شود
    retryCount = 0;
    for (const [k, v] of batch) if (pending.get(k)?.seq === v.seq) pending.delete(k);
    reportError((err as Error).message);
    await resync();
  }
}

/** بازخوانی کامل از سرور بدون حذف تغییرات محلی هنوز ارسال‌نشده */
async function resync(): Promise<void> {
  try {
    await hydrate();
  } catch (err) {
    if ((err as ApiErrorLike).status === 401) expireSession();
  }
}

function expireSession(): void {
  setSession(null);
  clearLocal();
  if (typeof window !== "undefined") window.location.reload();
}

// ---------------------------------------------------------------------------
// دریافت زنده‌ی تغییرات
// ---------------------------------------------------------------------------

async function poll(): Promise<void> {
  if (!hydrated || polling || !getToken()) return;
  polling = true;
  try {
    let since = Math.max(0, cursor - OVERLAP);
    for (let guard = 0; guard < 50; guard++) {
      const res = await api<{ changes: Row[]; head: number; hasMore: boolean }>(`/api/state/changes?since=${since}`);
      applyRows(res.changes);
      cursor = Math.max(cursor, res.head);
      if (!res.hasMore || res.changes.length === 0) break;
      since = res.changes[res.changes.length - 1].rev;
    }
  } catch (err) {
    if ((err as ApiErrorLike).status === 401) expireSession();
  } finally {
    polling = false;
  }
}

function startSync(): void {
  if (pollTimer || typeof window === "undefined") return;
  pollTimer = setInterval(() => {
    if (document.visibilityState === "visible") void poll();
  }, POLL_MS);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onVisible);
}

function onVisible(): void {
  if (document.visibilityState === "visible") {
    void poll();
    if (pending.size) scheduleFlush(0);
  }
}

function stopSync(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  if (typeof window !== "undefined") window.removeEventListener("online", onVisible);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}

export const isHydrated = () => hydrated;
