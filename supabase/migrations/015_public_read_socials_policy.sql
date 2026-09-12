-- Phase 3 (QA fix): ensure the storefront can read published social links and settings
-- Run this in Supabase SQL Editor if the footer social icons still do not render.

alter table public.socials enable row level security;

drop policy if exists "public read visible socials" on public.socials;
create policy "public read visible socials"
  on public.socials
  for select
  using (is_visible = true);

-- Sanity check: what the storefront will actually receive
-- select id, name, link, is_visible, sort_order from public.socials order by sort_order asc, created_at asc;
