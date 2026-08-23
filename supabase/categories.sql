create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories disable row level security;

alter table public.site_settings
  add column if not exists address text,
  add column if not exists logo_url text,
  add column if not exists footer_description text;

notify pgrst, 'reload schema';
