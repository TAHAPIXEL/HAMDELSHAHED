// ----------------------------------------------------------------------------
//  طرح پایگاه‌داده‌ی همدل (PostgreSQL / Supabase)
//  تمام اسکریپت‌ها idempotent هستند و با قفل advisory از اجرای هم‌زمان جلوگیری می‌شود.
// ----------------------------------------------------------------------------

export const SCHEMA_VERSION = "2026-11-17-v2";

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
alter table hamdel_records enable row level security;
alter table hamdel_sessions enable row level security;
alter table hamdel_media enable row level security;

commit;
`;
