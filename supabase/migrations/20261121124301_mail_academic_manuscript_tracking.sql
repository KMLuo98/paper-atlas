create table public.mail_academic_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 version bigint not null default 0,
 data jsonb not null default '{"manuscripts":[],"tombstones":[],"stats_offsets":{},"cursor":null,"last_day":""}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint academic_data_object check (jsonb_typeof(data)='object')
);
alter table public.mail_academic_workspaces enable row level security;
revoke all on public.mail_academic_workspaces from public,anon,authenticated;
grant select on public.mail_academic_workspaces to authenticated;
grant all on public.mail_academic_workspaces to service_role;
create policy "Read own manuscript workspace" on public.mail_academic_workspaces for select to authenticated using ((select auth.uid())=user_id);
