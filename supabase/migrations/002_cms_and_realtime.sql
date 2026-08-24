-- ملف محلي للمراجعة والتنفيذ لاحقاً بعد موافقة المالك فقط.
-- لا يتم تشغيله تلقائياً من المتصفح ولا يحتوي على حذف أو تغيير لأنواع البيانات.
begin;

alter table public.site_settings add column if not exists page_title text;
alter table public.site_settings add column if not exists address text;
alter table public.site_settings add column if not exists phone text;
alter table public.site_settings add column if not exists hero_tagline text;
alter table public.site_settings add column if not exists catalog_title text;
alter table public.site_settings add column if not exists catalog_subtitle text;
alter table public.site_settings add column if not exists trust_cards jsonb not null default '[]'::jsonb;
alter table public.site_settings add column if not exists testimonials jsonb not null default '[]'::jsonb;
alter table public.site_settings add column if not exists section_visibility jsonb not null default '{}'::jsonb;

alter table public.products add column if not exists material text;
alter table public.products add column if not exists size text;

-- Add only missing tables to Supabase's Realtime publication.
do $$
declare
  item text;
begin
  foreach item in array array['products','categories','site_settings','faqs','socials'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = item
    ) then
      execute format('alter publication supabase_realtime add table public.%I', item);
    end if;
  end loop;
exception when undefined_object then
  raise notice 'supabase_realtime publication is not available yet; enable it from Supabase Realtime settings.';
end $$;

commit;
