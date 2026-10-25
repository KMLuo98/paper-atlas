begin;
create table public.author_profiles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 identity_keys text[] not null default '{}',
 first_name text not null default '' check(length(first_name)<=200),
 last_name text not null default '' check(length(last_name)<=200),
 aliases text[] not null default '{}',
 institution text not null default '' check(length(institution)<=1500),
 email text not null default '' check(length(email)<=254),
 orcid text not null default '',
 profile_url text not null default '',
 name_format text not null default 'default' check(name_format in ('default','given_family','family_given','initial_family')),
 photo_path text not null default '' check(photo_path='' or split_part(photo_path,'/',1)=user_id::text),
 photo_source text not null default '',
 photo_source_url text not null default '',
 keywords jsonb not null default '[]'::jsonb check(jsonb_typeof(keywords)='array'),
 research_summary text not null default '',
 keywords_paper_ids uuid[] not null default '{}',
 keywords_generated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index author_profiles_user_id on public.author_profiles(user_id);
alter table public.author_profiles enable row level security;
revoke all on public.author_profiles from anon,authenticated;
grant select on public.author_profiles to authenticated;
grant all on public.author_profiles to service_role;
create policy author_profiles_owner_select on public.author_profiles for select to authenticated using ((select auth.uid())=user_id);
comment on table public.author_profiles is 'Private author-directory overrides; owner-scoped authenticated Edge Function writes; original paper metadata remains intact.';
commit;
