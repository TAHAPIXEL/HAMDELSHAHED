-- ----------------------------------------------------------------------------
--  داده‌ی تستی ظرفیت: ۵۰۰ دانش‌آموز + ۱ معلم + گروه/کانال/گفتگوی شخصی/پیام/
--  نظرسنجی/تصویر/آزمون/تکلیف/حضور و غیاب/اطلاعیه
--  - همه‌ی ردیف‌ها با data.loadTest = true یا شناسه‌ی lt_ مشخص شده‌اند.
--  - شماره‌ی تلفن دانش‌آموزان: 0990 + ۷ رقم (۰۹۹۰۰۰۰۰۰۰۱ تا ۰۹۹۰۰۰۰۰۵۰۰)، رمز: 1234
--  - معلم تستی: 09910000001 با رمز 1234
--  - فقط پایه‌های ۷ و ۸ استفاده شده‌اند تا تکلیف و آزمون تستی به دانش‌آموزان واقعی پایه‌ی ۹ نرسد.
--  - اجرای دوباره‌ی این فایل، داده‌ی تستی قبلی را (به‌صورت سخت) پاک و دوباره می‌سازد.
--  - برای پاک‌سازی روی سامانه‌ی زنده از cleanup.sql استفاده کنید (نرم‌حذف با rev).
-- ----------------------------------------------------------------------------

-- ۰) پاک‌سازی داده‌ی تستی قبلی
delete from public.hamdel_records
 where data->>'loadTest' = 'true' or (collection = 'seen' and id like 'lt\_%');

-- ۱) کاربران: ۵۰۰ دانش‌آموز و یک معلم
with st as (
  select i, 'lt_s' || lpad(i::text, 4, '0') as sid, (case when (i-1) % 8 < 4 then 7 else 8 end) as g, ((i-1) % 8) % 4 + 1 as s
    from generate_series(1, 500) i
)
insert into public.hamdel_records (collection, id, data, rev, deleted, updated_at)
select 'users', sid,
       jsonb_build_object('id', sid, 'role', 'student',
         'firstName', (array['علی','محمد','حسین','زهرا','فاطمه','مریم','نرگس','سارا','رضا','امیر','پریسا','نیلوفر','یاسین','کیان','ستاره','مهدی'])[1 + (i % 16)],
         'lastName', 'تستی ' || i, 'phone', '0990' || lpad(i::text, 7, '0'), 'password', '1234',
         'grade', g, 'section', s::text, 'createdAt', (extract(epoch from now()) * 1000)::bigint, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from st;

insert into public.hamdel_records (collection, id, data, rev, deleted, updated_at)
values ('users', 'lt_t01',
        jsonb_build_object('id', 'lt_t01', 'role', 'teacher', 'staffRole', 'teacher', 'firstName', 'معلم', 'lastName', 'تستی',
          'phone', '09910000001', 'password', '1234', 'createdAt', (extract(epoch from now()) * 1000)::bigint, 'loadTest', true),
        nextval('hamdel_rev_seq'), false, now());

-- ۲) گفتگوها: ۸ گروه کلاسی، ۲ کانال، ۱۰۰ گفتگوی شخصی با معلم تستی
with ms as (select (extract(epoch from now()) * 1000)::bigint as now_ms),
     st as (select i, 'lt_s' || lpad(i::text, 4, '0') as sid, (case when (i-1) % 8 < 4 then 7 else 8 end) as g, ((i-1) % 8) % 4 + 1 as s
              from generate_series(1, 500) i),
     grp as (select g, s from (values (7,1),(7,2),(7,3),(7,4),(8,1),(8,2),(8,3),(8,4)) v(g,s))
insert into public.hamdel_records (collection, id, data, rev, deleted, updated_at)
select 'chats', 'lt_g' || grp.g || grp.s,
       jsonb_build_object('id', 'lt_g' || grp.g || grp.s, 'type', 'group', 'title', '[تست ظرفیت] کلاس ' || grp.g || '-' || grp.s,
         'description', 'گروه تستی بار',
         'memberIds', (select jsonb_agg(sid order by sid) from st where st.g = grp.g and st.s = grp.s) || '["lt_t01"]'::jsonb,
         'createdBy', 'lt_t01', 'ownerId', 'lt_t01', 'admins', '["lt_t01"]'::jsonb,
         'createdAt', (select now_ms from ms)::bigint, 'lastActivity', (select now_ms from ms)::bigint, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from grp
union all
select 'chats', 'lt_c' || c,
       jsonb_build_object('id', 'lt_c' || c, 'type', 'channel', 'title', '[تست ظرفیت] کانال اطلاعیه ' || c,
         'description', 'کانال تستی بار',
         'memberIds', (select jsonb_agg(sid order by sid) from st) || '["lt_t01"]'::jsonb,
         'createdBy', 'lt_t01', 'ownerId', 'lt_t01', 'admins', '["lt_t01"]'::jsonb,
         'createdAt', (select now_ms from ms)::bigint, 'lastActivity', (select now_ms from ms)::bigint, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from generate_series(1, 2) c
union all
select 'chats', 'lt_d' || lpad(i::text, 3, '0'),
       jsonb_build_object('id', 'lt_d' || lpad(i::text, 3, '0'), 'type', 'direct', 'title', 'گفتگوی تستی',
         'memberIds', jsonb_build_array(sid, 'lt_t01'), 'createdBy', sid, 'directKey', sid || '|lt_t01',
         'createdAt', (select now_ms from ms)::bigint, 'lastActivity', (select now_ms from ms)::bigint, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from st where i <= 100;

-- ۳) پیام‌های گروه‌ها: هر گروه ۸۰ پیام؛ هر سومی تصویر (SVG تولیدشده)
with ms as (select (extract(epoch from now()) * 1000)::bigint as now_ms),
     grp as (select g, s from (values (7,1),(7,2),(7,3),(7,4),(8,1),(8,2),(8,3),(8,4)) v(g,s)),
     mm as (select grp.g, grp.s, 'lt_g' || grp.g || grp.s as cid, n,
                   (case when grp.g = 7 then 0 else 4 end + (grp.s - 1)) as slot
              from grp cross join generate_series(1, 80) n),
     snd as (select mm.*, 'lt_s' || lpad((slot + 1 + 8 * floor(random() * 62))::int::text, 4, '0') as sid from mm),
     txt as (select snd.*, (array['سلام بچه‌ها','تکلیف امروز چیه؟','آزمون فردا رو یادتون نره','ممنون از معلم','کسی کتاب علوم داره؟',
                 'امروز انشاءالله مدرسه هستیم','لینک جلسه رو بفرستید','تمرین ریاضی صفحهٔ ۲۰ رو حل کردم',
                 'برای امتحان علوم درس بخونید','ساعت ورزش تغییر کرد؟'])[1 + floor(random() * 10)::int] as body
              from snd)
insert into public.hamdel_records (collection, id, data, rev, deleted, updated_at)
select 'messages', cid || '_m' || lpad(n::text, 3, '0'),
       jsonb_build_object('id', cid || '_m' || lpad(n::text, 3, '0'), 'chatId', cid, 'senderId', sid,
         'text', case when n % 3 = 0 then '' else body end,
         'createdAt', (select now_ms from ms) - (80 - n) * 300000, 'loadTest', true)
       || (case when n % 3 = 0 then jsonb_build_object('image',
            'data:image/svg+xml;base64,' || encode(convert_to(
              '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="hsl(' || (n * 37 % 360) || ',70%,60%)"/>'
              || (select string_agg('<circle cx="' || floor(random() * 640) || '" cy="' || floor(random() * 400) || '" r="' || (10 + floor(random() * 60))
                   || '" fill="hsl(' || floor(random() * 360) || ',80%,50%)" opacity="0.7"/>', '') from generate_series(1, 25))
              || '<text x="20" y="50" font-size="32" fill="#fff">تصویر تستی</text></svg>', 'UTF8'), 'base64'))
          else '{}'::jsonb end),
       nextval('hamdel_rev_seq'), false, now()
  from txt;

-- ۴) کانال‌ها (۴۰ اطلاعیه برای هر کانال)، ۲۰ نظرسنجی، و ۴۰۰ پیام گفتگوی شخصی
with ms as (select (extract(epoch from now()) * 1000)::bigint as now_ms)
insert into public.hamdel_records (collection, id, data, rev, deleted, updated_at)
select 'messages', 'lt_c' || c || '_m' || lpad(n::text, 3, '0'),
       jsonb_build_object('id', 'lt_c' || c || '_m' || lpad(n::text, 3, '0'), 'chatId', 'lt_c' || c, 'senderId', 'lt_t01',
         'text', 'اطلاعیه‌ی شماره ' || n, 'createdAt', (select now_ms from ms) - (40 - n) * 600000, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from generate_series(1, 2) c cross join generate_series(1, 40) n
union all
select 'messages', 'lt_c1_poll' || lpad(p::text, 2, '0'),
       jsonb_build_object('id', 'lt_c1_poll' || lpad(p::text, 2, '0'), 'chatId', 'lt_c1', 'senderId', 'lt_t01', 'text', '',
         'createdAt', (select now_ms from ms) - (20 - p) * 600000, 'loadTest', true,
         'poll', jsonb_build_object('question', 'نظر شما دربارهٔ زمان آزمون چیست؟',
                                    'options', jsonb_build_array('صبح', 'ظهر', 'عصر'),
                                    'votes', jsonb_build_object('lt_s0001', 0, 'lt_s0002', 1, 'lt_s0003', 2, 'lt_s0004', 0))),
       nextval('hamdel_rev_seq'), false, now()
  from generate_series(1, 20) p
union all
select 'messages', 'lt_d' || lpad(i::text, 3, '0') || '_m' || n,
       jsonb_build_object('id', 'lt_d' || lpad(i::text, 3, '0') || '_m' || n, 'chatId', 'lt_d' || lpad(i::text, 3, '0'),
         'senderId', case when n % 2 = 1 then 'lt_s' || lpad(i::text, 4, '0') else 'lt_t01' end,
         'text', 'پیام تستی شمارهٔ ' || n, 'createdAt', (select now_ms from ms) - (4 - n) * 60000, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from generate_series(1, 100) i cross join generate_series(1, 4) n;

-- ۵) وضعیت خوانده‌شدن: هر دانش‌آموز برای گروه خودش و گفتگوی شخصی‌اش
with ms as (select (extract(epoch from now()) * 1000)::bigint as now_ms),
     st as (select i, 'lt_s' || lpad(i::text, 4, '0') as sid, (case when (i-1) % 8 < 4 then 7 else 8 end) as g, ((i-1) % 8) % 4 + 1 as s
              from generate_series(1, 500) i)
insert into public.hamdel_records (collection, id, data, rev, deleted, updated_at)
select 'seen', sid || ':lt_g' || g || s, to_jsonb((select now_ms from ms) - 600000), nextval('hamdel_rev_seq'), false, now() from st
union all
select 'seen', 'lt_s' || lpad(i::text, 4, '0') || ':lt_d' || lpad(i::text, 3, '0'), to_jsonb((select now_ms from ms) - 120000),
       nextval('hamdel_rev_seq'), false, now()
  from generate_series(1, 100) i;

-- ۶) آزمون‌ها و تکالیف (هر پایه و بخش یک مورد)
with ms as (select (extract(epoch from now()) * 1000)::bigint as now_ms),
     grp as (select g, s from (values (7,'1'),(7,'2'),(7,'3'),(7,'4'),(8,'1'),(8,'2'),(8,'3'),(8,'4')) v(g,s))
insert into public.hamdel_records (collection, id, data, rev, deleted, updated_at)
select 'exams', 'lt_ex' || g || s,
       jsonb_build_object('id', 'lt_ex' || g || s, 'grade', g, 'section', s, 'title', '[تست ظرفیت] آزمون علوم ' || g || '-' || s,
         'description', 'آزمون تستی برای سنجش ظرفیت', 'durationMin', 30, 'status', 'published', 'createdBy', 'lt_t01',
         'createdAt', (select now_ms from ms), 'loadTest', true,
         'questions', jsonb_build_array(
           jsonb_build_object('id', 'lt_ex' || g || s || '_q1', 'type', 'mcq', 'text', 'پایتخت ایران کدام است؟', 'score', 5,
                              'options', jsonb_build_array('تهران', 'اصفهان', 'شیراز', 'تبریز')),
           jsonb_build_object('id', 'lt_ex' || g || s || '_q2', 'type', 'tf', 'text', 'آب در ۱۰۰ درجه می‌جوشد.', 'score', 1),
           jsonb_build_object('id', 'lt_ex' || g || s || '_q3', 'type', 'blank', 'text', 'پایتخت ایران ....... است.', 'score', 2),
           jsonb_build_object('id', 'lt_ex' || g || s || '_q4', 'type', 'short', 'text', 'نام عنصر شیمیایی آب چیست؟', 'score', 2),
           jsonb_build_object('id', 'lt_ex' || g || s || '_q5', 'type', 'descriptive', 'text', 'دربارهٔ چرخهٔ آب توضیح دهید.', 'score', 10))),
       nextval('hamdel_rev_seq'), false, now()
  from grp
union all
select 'homeworks', 'lt_hw' || g || s,
       jsonb_build_object('id', 'lt_hw' || g || s, 'title', '[تست ظرفیت] تکلیف علوم ' || g || '-' || s,
         'description', 'تکلیف تستی برای سنجش ظرفیت', 'grade', g, 'section', s, 'due', '1405/9/10', 'createdBy', 'lt_t01',
         'createdAt', (select now_ms from ms), 'closed', false, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from grp;

-- ۷) پاسخ آزمون (۵۰۰ مورد، تصحیح‌شده) و پاسخ تکلیف (۵۰۰ مورد، ۱۰۰ تای آن با تصویر)
with ms as (select (extract(epoch from now()) * 1000)::bigint as now_ms),
     st as (select i, 'lt_s' || lpad(i::text, 4, '0') as sid, (case when (i-1) % 8 < 4 then 7 else 8 end) as g, (((i-1) % 8) % 4 + 1)::text as s,
                   floor(random() * 2)::int * 5 as g1, floor(random() * 2)::int as g2, floor(random() * 3)::int as g3,
                   floor(random() * 3)::int as g4, floor(random() * 11)::int as g5
              from generate_series(1, 500) i)
insert into public.hamdel_records (collection, id, data, rev, deleted, updated_at)
select 'subs', 'lt_sub' || lpad(i::text, 4, '0'),
       jsonb_build_object('id', 'lt_sub' || lpad(i::text, 4, '0'), 'examId', 'lt_ex' || g || s, 'studentId', sid,
         'answers', jsonb_build_object('lt_ex' || g || s || '_q1', '0', 'lt_ex' || g || s || '_q2', 'درست',
                                       'lt_ex' || g || s || '_q3', 'تهران', 'lt_ex' || g || s || '_q4', 'آسید',
                                       'lt_ex' || g || s || '_q5', 'پاسخ تستی'),
         'grades', jsonb_build_object('lt_ex' || g || s || '_q1', g1, 'lt_ex' || g || s || '_q2', g2, 'lt_ex' || g || s || '_q3', g3,
                                      'lt_ex' || g || s || '_q4', g4, 'lt_ex' || g || s || '_q5', g5),
         'total', g1 + g2 + g3 + g4 + g5, 'graded', true, 'feedback', 'بازخورد تستی',
         'startedAt', (select now_ms from ms) - 3600000, 'submittedAt', (select now_ms from ms) - 3500000, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from st
union all
select 'hwsubs', 'lt_hws' || lpad(i::text, 4, '0'),
       jsonb_build_object('id', 'lt_hws' || lpad(i::text, 4, '0'), 'homeworkId', 'lt_hw' || g || s, 'studentId', sid,
         'text', 'پاسخ تستی شمارهٔ ' || i, 'status', 'submitted', 'submittedAt', (select now_ms from ms) - (i % 500) * 1000,
         'loadTest', true)
       || (case when i % 5 = 0 then jsonb_build_object('images', jsonb_build_array(
            'data:image/svg+xml;base64,' || encode(convert_to(
              '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#eef"/>'
              || (select string_agg('<circle cx="' || floor(random() * 640) || '" cy="' || floor(random() * 400) || '" r="' || (10 + floor(random() * 60))
                   || '" fill="hsl(' || floor(random() * 360) || ',80%,50%)"/>', '') from generate_series(1, 25))
              || '</svg>', 'UTF8'), 'base64')))
          else '{}'::jsonb end),
       nextval('hamdel_rev_seq'), false, now()
  from st;

-- ۸) حضور و غیاب: ۱۴ روز برای ۵۰۰ دانش‌آموز، اطلاعیه‌ی کادر، و پیام سنجاق‌شده در یک گروه
with ms as (select (extract(epoch from now()) * 1000)::bigint as now_ms),
     days as (select to_char(d, 'YYYY-MM-DD') as day from generate_series(date '2026-11-03', date '2026-11-16', interval '1 day') d)
insert into public.hamdel_records (collection, id, data, rev, deleted, updated_at)
select 'attendance', day || ':lt_s' || lpad(i::text, 4, '0'),
       jsonb_build_object('id', day || ':lt_s' || lpad(i::text, 4, '0'), 'date', day, 'studentId', 'lt_s' || lpad(i::text, 4, '0'),
         'status', (case when random() < 0.85 then 'present' when random() < 0.7 then 'absent' else 'excused' end),
         'auto', true, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from days cross join generate_series(1, 500) i
union all
select 'notices', 'lt_n' || n,
       jsonb_build_object('id', 'lt_n' || n, 'title', '[تست ظرفیت] اطلاعیهٔ تستی ' || n,
         'body', 'این یک اطلاعیهٔ تستی برای سنجش ظرفیت است.', 'audience', 'staff', 'createdBy', 'lt_t01',
         'createdAt', (select now_ms from ms) - n * 60000, 'loadTest', true),
       nextval('hamdel_rev_seq'), false, now()
  from generate_series(1, 2) n;

-- ۹) عکس پروفایل تستی: همه به یک فایل موجود و عمومی اشاره می‌کنند (فایل جدیدی ساخته نمی‌شود)
update public.hamdel_records
   set data = jsonb_set(data, '{avatar}', to_jsonb('https://musmyiwumgeffafxsmdd.supabase.co/storage/v1/object/public/hamdel-media/2026/11/6884e7d1-09fe-4b9b-b805-4df87cb0c98b.jpg'::text)),
       rev = nextval('hamdel_rev_seq'), updated_at = now()
 where collection = 'users' and data->>'loadTest' = 'true' and data->>'role' = 'student';

update public.hamdel_records
   set data = jsonb_set(data, '{pinnedId}', to_jsonb('lt_g71_m010'::text)), rev = nextval('hamdel_rev_seq'), updated_at = now()
 where collection = 'chats' and id = 'lt_g71';
