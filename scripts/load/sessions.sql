-- ----------------------------------------------------------------------------
--  نشست‌های آزمون بار برای ۵۰۰ دانش‌آموز تستی (فقط حساب‌های lt_)
--  توکن هر دانش‌آموز: loadtest-token-000001 تا loadtest-token-000500
--  اعتبار: ۶ ساعت. با cleanup.sql حذف می‌شوند.
--  دلیل وجود: ورود واقعی برای هر IP فقط ۳۰ بار در ۱۰ دقیقه مجاز است؛ آزمون بار
--  روی حساب‌های تستی بدون این محدودیت، مسیر /api/state را واقعاً می‌سنجد.
-- ----------------------------------------------------------------------------
insert into public.hamdel_sessions (token_hash, user_id, is_dev, expires_at)
select encode(sha256(convert_to('loadtest-token-' || lpad(i::text, 6, '0'), 'UTF8')), 'hex'),
       'lt_s' || lpad(i::text, 4, '0'),
       false,
       now() + interval '6 hours'
  from generate_series(1, 500) i
on conflict (token_hash) do nothing;
