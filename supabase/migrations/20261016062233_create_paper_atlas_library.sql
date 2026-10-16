begin;

create extension if not exists pg_trgm with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  email text not null,
  created_at timestamptz not null default now()
);
create unique index profiles_username_unique on public.profiles (lower(username));
alter table public.profiles enable row level security;
create policy profiles_read_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,username,email) values(new.id,trim(new.raw_user_meta_data->>'username'),new.email);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.sync_profile_email() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger on_auth_email_updated after update of email on auth.users for each row execute function public.sync_profile_email();

create function public.username_available(candidate text) returns boolean language sql stable security definer set search_path = '' as $$
  select candidate ~ '^[A-Za-z0-9_]{3,24}$' and not exists(select 1 from public.profiles where lower(username) = lower(candidate));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 1000),
  journal text not null default '',
  journal_abbr text not null default '',
  published_at date,
  doi text not null default '',
  volume text not null default '',
  issue text not null default '',
  pages text not null default '',
  authors jsonb not null default '[]'::jsonb check (jsonb_typeof(authors) = 'array'),
  keywords text[] not null default '{}',
  tags text[] not null default '{}',
  search_terms text[] not null default '{}',
  "references" jsonb not null default '[]'::jsonb check (jsonb_typeof("references") = 'array'),
  summary text not null default '',
  full_text text not null default '' check (length(full_text) <= 600000),
  file_path text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 31457280),
  original_filename text not null,
  favorite boolean not null default false,
  status text not null default 'pending' check (status in ('pending','ready','error')),
  analysis_error text,
  analysis_coverage text,
  analyzed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (split_part(file_path, '/', 1) = user_id::text)
);
create index papers_user_created on public.papers(user_id,created_at desc);
create index papers_title_trgm on public.papers using gin (title extensions.gin_trgm_ops);
create index papers_tags on public.papers using gin (tags);
alter table public.papers enable row level security;
create policy papers_read_own on public.papers for select to authenticated using ((select auth.uid()) = user_id);
create policy papers_insert_own on public.papers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy papers_update_own on public.papers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.papers from anon, authenticated;
grant select, insert, update on public.papers to authenticated;

create function public.update_timestamp() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger papers_updated before update on public.papers for each row execute function public.update_timestamp();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('papers','papers',false,31457280,array['application/pdf'])
on conflict(id) do nothing;
create policy pdf_read_own on storage.objects for select to authenticated
  using (bucket_id='papers' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy pdf_upload_own on storage.objects for insert to authenticated
  with check (bucket_id='papers' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy pdf_remove_own on storage.objects for delete to authenticated
  using (bucket_id='papers' and (storage.foldername(name))[1]=(select auth.uid())::text);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  key_hash text not null unique,
  prefix text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
alter table public.api_keys enable row level security;
create policy keys_read_own on public.api_keys for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.api_keys from anon, authenticated;
grant select(id,user_id,name,prefix,created_at,expires_at) on public.api_keys to authenticated;

create table public.api_rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;
create function public.consume_rate_limit(bucket_key text, maximum integer, window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_hits integer;
begin
  insert into public.api_rate_limits(bucket,window_start,hits) values(bucket_key,now(),1)
  on conflict(bucket) do update set
    hits=case when public.api_rate_limits.window_start < now()-make_interval(secs=>window_seconds) then 1 else public.api_rate_limits.hits+1 end,
    window_start=case when public.api_rate_limits.window_start < now()-make_interval(secs=>window_seconds) then now() else public.api_rate_limits.window_start end
  returning hits into current_hits;
  -- Bounded opportunistic cleanup of expired anonymous buckets.
  delete from public.api_rate_limits where bucket in
    (select bucket from public.api_rate_limits where window_start < now()-interval '2 days' limit 100);
  return current_hits <= maximum;
end;
$$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.sync_profile_email() from public,anon,authenticated;

commit;
