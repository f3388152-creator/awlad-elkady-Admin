-- إضافة موعد العودة المتوقع لشاشة الصيانة.
-- نفّذ هذا الاستعلام يدوياً في Supabase SQL Editor قبل استخدام حقل الموعد من Admin.
begin;

alter table public.site_settings
  add column if not exists maintenance_end_at timestamptz;

commit;
