// ----------------------------------------------------------------------------
//  طرح پایگاه‌داده‌ی همدل (PostgreSQL / Supabase)
//  تمام اسکریپت‌ها idempotent هستند و با قفل advisory از اجرای هم‌زمان جلوگیری می‌شود.
// ----------------------------------------------------------------------------

export const SCHEMA_VERSION = "2026-11-22-v4";

export const SCHEMA_SQL = `
begin;
select pg_advisory_xact_lock(724211);

-- همه‌ی داده‌های سامانه (کاربران، گفتگوها، پیام‌ها، آزمون‌ها، تکالیف، حضور، اطلاعیه‌ها، …)
-- هر رکورد یک ردیف است؛ rev شماره‌ی ترتیب تغییر برای همگام‌سازی بین کاربران است.
create table if not exists hamdel_records (
  collection text not null,
  id         text not null,
  data       jsonb not null,
  rev        bigint not null,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists hamdel_records_rev_idx on hamdel_records (rev);

-- شماره‌ی تلفن هر کاربر فعال یکتاست (ثبت‌نام هم‌زمان دو کاربر با یک شماره ممکن نیست)
create unique index if not exists hamdel_users_phone_uq
  on hamdel_records ((data->>'phone'))
  where collection = 'users' and deleted = false;

create sequence if not exists hamdel_rev_seq;

-- نشست‌های ورود (توکن به صورت هش ذخیره می‌شود)
create table if not exists hamdel_sessions (
  token_hash   text primary key,
  user_id      text not null,
  is_dev       boolean not null default false,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists hamdel_sessions_expires_idx on hamdel_sessions (expires_at);

-- فهرست فایل‌های تصویری که در Supabase Storage ذخیره شده‌اند (برای پاک‌سازی کامل)
create table if not exists hamdel_media (
  path       text primary key,
  public_url text not null,
  created_at timestamptz not null default now()
);

-- دسترسی مستقیم از کلیدهای عمومی (anon / authenticated) به جداول بسته است؛
-- فقط سرور با اتصال مستقیم PostgreSQL به داده‌ها دسترسی دارد.
-- کلاس آنلاین: وضعیت اتاق هر کلاس (شناسه‌ی اتاق «پایه-شعبه»، مثلاً 9-1)
create table if not exists hamdel_live_rooms (
  room_id    text primary key,
  teacher_id text not null,
  live       boolean not null default false,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- حاضرین کلاس آنلاین: دست بالا، اجازه‌ی صحبت و آخرین زمان دیده‌شدن
create table if not exists hamdel_live_members (
  room_id   text not null,
  user_id   text not null,
  name      text not null default '',
  hand      boolean not null default false,
  speaking  boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- پیام‌های سیگنال‌دهی WebRTC (پیشنهاد، پاسخ، ICE) بین مدرس و هر دانش‌آموز.
-- پس از خوانده‌شدن حذف می‌شوند.
create table if not exists hamdel_signals (
  id         bigserial primary key,
  room_id    text not null,
  from_id    text not null,
  to_id      text not null,
  kind       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists hamdel_signals_to_idx on hamdel_signals (to_id, id);

-- وضعیت چت کلاس (باز/بسته) روی خود اتاق ذخیره می‌شود تا ورود دوباره‌ی مدرس یا دانش‌آموز همان را ببیند
alter table hamdel_live_rooms add column if not exists chat_open boolean not null default true;

-- پیام‌های چت کلاس آنلاین؛ ارسال زنده از LiveKit می‌رود و این جدول تاریخچه‌ی ماندگار است
create table if not exists hamdel_live_chat (
  id         text primary key,
  room_id    text not null,
  user_id    text not null,
  name       text not null default '',
  body       text not null,
  created_at bigint not null
);
create index if not exists hamdel_live_chat_room_idx on hamdel_live_chat (room_id, created_at);

alter table hamdel_live_chat enable row level security;
alter table hamdel_live_rooms enable row level security;
alter table hamdel_live_members enable row level security;
alter table hamdel_signals enable row level security;
alter table hamdel_records enable row level security;
alter table hamdel_sessions enable row level security;
alter table hamdel_media enable row level security;

commit;
`;
