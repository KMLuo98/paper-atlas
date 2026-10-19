begin;
create table public.account_storage_quotas (
 user_id uuid primary key references auth.users(id) on delete cascade,
 quota_bytes bigint not null check(quota_bytes between 0 and 10995116277760),
 updated_at timestamptz not null default now()
);
alter table public.account_storage_quotas enable row level security;
revoke all on public.account_storage_quotas from public,anon,authenticated;
grant select on public.account_storage_quotas to authenticated;
grant all on public.account_storage_quotas to service_role;
create policy quota_read_own on public.account_storage_quotas for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.account_storage_stats(target_ids uuid[])
returns table(user_id uuid,quota_bytes bigint,used_bytes bigint)
language sql stable security invoker set search_path='' as $$
 select u.id,coalesce(q.quota_bytes,1073741824::bigint),coalesce(s.bytes,0)::bigint
 from unnest(target_ids) u(id) left join public.account_storage_quotas q on q.user_id=u.id
 left join lateral (select sum(coalesce((o.metadata->>'size')::bigint,0)) bytes from storage.objects o where o.bucket_id in ('papers','avatars','chat-files') and split_part(o.name,'/',1)=u.id::text) s on true
$$;
revoke all on function public.account_storage_stats(uuid[]) from public,anon,authenticated;
grant execute on function public.account_storage_stats(uuid[]) to service_role;

create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create or replace function private.storage_quota_allows(bucket text,object_name text,object_metadata jsonb)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare uid uuid:=auth.uid(); allowed bigint; used bigint; incoming bigint;
begin
 if uid is null or split_part(object_name,'/',1)<>uid::text then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended('paper-atlas-storage:'||uid::text,0));
 select quota_bytes into allowed from public.account_storage_quotas where user_id=uid;
 allowed:=coalesce(allowed,1073741824);
 select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) into used from storage.objects where bucket_id in ('papers','avatars','chat-files') and split_part(name,'/',1)=uid::text and not(bucket_id=bucket and name=object_name);
 incoming:=greatest(0,coalesce((object_metadata->>'size')::bigint,(object_metadata->>'contentLength')::bigint,0));
 return allowed>0 and used+incoming<=allowed;
end $$;
revoke all on function private.storage_quota_allows(text,text,jsonb) from public,anon;
grant execute on function private.storage_quota_allows(text,text,jsonb) to authenticated;
create policy enforce_account_upload_quota on storage.objects as restrictive for insert to authenticated
 with check(bucket_id not in ('papers','avatars','chat-files') or private.storage_quota_allows(bucket_id,name,metadata));
create policy enforce_account_update_quota on storage.objects as restrictive for update to authenticated
 using(bucket_id not in ('papers','avatars','chat-files') or split_part(name,'/',1)=(select auth.uid())::text)
 with check(bucket_id not in ('papers','avatars','chat-files') or private.storage_quota_allows(bucket_id,name,metadata));
commit;
