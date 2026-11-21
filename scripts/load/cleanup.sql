-- ----------------------------------------------------------------------------
--  پاک‌سازی داده‌ی آزمون بار (نرم‌حذف با rev تا کاربران فعال تغییر را ببینند)
--  فقط ردیف‌های تستی (data.loadTest = true یا وضعیت خوانده‌شدن lt_) و نشست‌های lt_
--  را حذف می‌کند؛ داده‌ی واقعی دست‌نخورده می‌ماند.
-- ----------------------------------------------------------------------------
update public.hamdel_records
   set deleted = true, data = '{}'::jsonb, rev = nextval('hamdel_rev_seq'), updated_at = now()
 where deleted = false
   and (data->>'loadTest' = 'true' or (collection = 'seen' and id like 'lt\_%'));

delete from public.hamdel_sessions where user_id like 'lt\_%';
