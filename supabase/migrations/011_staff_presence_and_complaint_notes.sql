alter table public.staff_accounts
  add column if not exists last_seen_at timestamptz,
  add column if not exists is_online boolean not null default false;

alter table public.complaints
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists staff_accounts_presence_idx
  on public.staff_accounts (is_online, last_seen_at desc);
