alter table public.staff_accounts
  add column if not exists avatar_url text,
  add column if not exists last_user_agent text,
  add column if not exists last_login_at timestamptz,
  add column if not exists session_version integer not null default 1;

update public.staff_accounts
set session_version = 1
where session_version is null;

create index if not exists staff_accounts_session_version_idx
  on public.staff_accounts(session_version);
