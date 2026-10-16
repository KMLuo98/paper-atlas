begin;
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public,anon,authenticated;
grant all on public.admin_users to service_role;
commit;
