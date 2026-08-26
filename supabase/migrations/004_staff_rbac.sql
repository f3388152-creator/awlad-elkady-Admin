-- Awlad El-Kady Admin: staff accounts and granular permissions
-- Additive only: no existing table or data is removed.

create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  phone text not null unique check (phone ~ '^01[0125][0-9]{8}$'),
  display_name text not null,
  login_email text not null unique,
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_accounts_phone_idx on public.staff_accounts(phone);
create index if not exists staff_accounts_auth_user_idx on public.staff_accounts(auth_user_id);

create or replace function public.touch_staff_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists staff_accounts_updated_at on public.staff_accounts;
create trigger staff_accounts_updated_at
before update on public.staff_accounts
for each row execute function public.touch_staff_accounts_updated_at();

alter table public.staff_accounts enable row level security;

-- Staff records are accessed only through server-side service-role endpoints.
-- No public/anon policy is intentionally created.
