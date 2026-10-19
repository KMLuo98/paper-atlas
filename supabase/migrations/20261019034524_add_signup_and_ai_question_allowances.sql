begin;
create table public.signup_allowance_defaults(
 singleton boolean primary key default true check(singleton),
 storage_quota_bytes bigint not null default 268435456 check(storage_quota_bytes between 0 and 10995116277760),
 ai_question_limit integer not null default 10 check(ai_question_limit between 0 and 1000000)
);
insert into public.signup_allowance_defaults(singleton) values(true);
alter table public.signup_allowance_defaults enable row level security;
revoke all on public.signup_allowance_defaults from public,anon,authenticated;
grant all on public.signup_allowance_defaults to service_role;
-- Preserve established storage allowances before changing the signup default.
insert into public.account_storage_quotas(user_id,quota_bytes)
 select id,1073741824 from public.profiles on conflict(user_id) do nothing;
alter table public.account_storage_quotas alter column quota_bytes set default 268435456;
alter table public.account_storage_quotas add column ai_question_limit integer not null default 10 check(ai_question_limit>=0);
alter table public.account_storage_quotas add column ai_questions_used integer not null default 0 check(ai_questions_used>=0);

create function private.initialize_account_allowances() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.account_storage_quotas(user_id,quota_bytes,ai_question_limit) select new.id,storage_quota_bytes,ai_question_limit from public.signup_allowance_defaults where singleton on conflict(user_id) do nothing;
 return new;
end $$;
revoke all on function private.initialize_account_allowances() from public,anon,authenticated;
create trigger initialize_account_allowances after insert on public.profiles for each row execute function private.initialize_account_allowances();

create table public.ai_question_requests(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 status text not null check(status in ('reserved','completed','refunded')),
 expires_at timestamptz not null default now()+interval '10 minutes',
 primary key(user_id,request_id)
);
create index ai_question_requests_pending on public.ai_question_requests(user_id,expires_at) where status='reserved';
alter table public.ai_question_requests enable row level security;
revoke all on public.ai_question_requests from public,anon,authenticated;
grant all on public.ai_question_requests to service_role;

-- All callers hold the account row lock. Persisted answers survive lost HTTP responses.
create function private.reconcile_ai_questions(target_user uuid) returns void language plpgsql security invoker set search_path='' as $$
declare returned integer;
begin
 update public.ai_question_requests r set status='completed' where r.user_id=target_user and r.status='reserved' and r.expires_at<=now()
 and exists(select 1 from public.chat_messages m where m.user_id=r.user_id and m.conversation_id=r.conversation_id and m.request_id=r.request_id and m.role='assistant');
 update public.ai_question_requests set status='refunded' where user_id=target_user and status='reserved' and expires_at<=now();
 get diagnostics returned=row_count;
 if returned>0 then update public.account_storage_quotas set ai_questions_used=greatest(0,ai_questions_used-returned) where user_id=target_user; end if;
end $$;
revoke all on function private.reconcile_ai_questions(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.reconcile_ai_questions(uuid) to service_role;

create function public.account_ai_stats(target_ids uuid[])
returns table(user_id uuid,ai_question_limit integer,ai_questions_used integer,ai_questions_remaining integer)
language plpgsql volatile security invoker set search_path='' as $$
declare target uuid;
begin
 for target in select distinct x from unnest(target_ids) x order by x loop
  perform 1 from public.account_storage_quotas q where q.user_id=target for update;
  perform private.reconcile_ai_questions(target);
 end loop;
 return query select u.id,coalesce(q.ai_question_limit,10),coalesce(q.ai_questions_used,0),greatest(0,coalesce(q.ai_question_limit,10)-coalesce(q.ai_questions_used,0))
 from unnest(target_ids) u(id) left join public.account_storage_quotas q on q.user_id=u.id;
end $$;

create function public.reserve_ai_question(target_user uuid,request_uuid uuid,conversation_uuid uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare allowance public.account_storage_quotas%rowtype; existing public.ai_question_requests%rowtype;
begin
 if not exists(select 1 from public.conversations where id=conversation_uuid and user_id=target_user) then return 'forbidden'; end if;
 insert into public.account_storage_quotas(user_id,quota_bytes,ai_question_limit) select target_user,storage_quota_bytes,ai_question_limit from public.signup_allowance_defaults where singleton on conflict(user_id) do nothing;
 select * into allowance from public.account_storage_quotas where user_id=target_user for update;
 perform private.reconcile_ai_questions(target_user);
 select * into existing from public.ai_question_requests where user_id=target_user and request_id=request_uuid;
 if found then
  if existing.conversation_id<>conversation_uuid then return 'conflict'; end if;
  if existing.status='completed' then return 'completed'; end if;
  if existing.status='reserved' then return 'inflight'; end if;
 end if;
 select * into allowance from public.account_storage_quotas where user_id=target_user;
 if allowance.ai_questions_used>=allowance.ai_question_limit then return 'exhausted'; end if;
 update public.account_storage_quotas set ai_questions_used=ai_questions_used+1 where user_id=target_user;
 insert into public.ai_question_requests(user_id,request_id,conversation_id,status,expires_at)
 values(target_user,request_uuid,conversation_uuid,'reserved',now()+interval '10 minutes')
 on conflict(user_id,request_id) do update set status='reserved',expires_at=excluded.expires_at;
 return 'reserved';
end $$;

create function public.finish_ai_question(target_user uuid,request_uuid uuid,succeeded boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 perform 1 from public.account_storage_quotas where user_id=target_user for update;
 if not succeeded and exists(select 1 from public.ai_question_requests r join public.chat_messages m on m.user_id=r.user_id and m.conversation_id=r.conversation_id and m.request_id=r.request_id and m.role='assistant' where r.user_id=target_user and r.request_id=request_uuid) then succeeded:=true; end if;
 update public.ai_question_requests set status=case when succeeded then 'completed' else 'refunded' end
 where user_id=target_user and request_id=request_uuid and status='reserved';
 get diagnostics changed=row_count;
 if changed>0 and not succeeded then update public.account_storage_quotas set ai_questions_used=greatest(0,ai_questions_used-1) where user_id=target_user; end if;
 return changed>0;
end $$;

create function public.set_ai_question_remaining(target_user uuid,remaining integer)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if remaining<0 or remaining>1000000 then raise exception 'Invalid allowance'; end if;
 insert into public.account_storage_quotas(user_id,quota_bytes,ai_question_limit) select target_user,storage_quota_bytes,ai_question_limit from public.signup_allowance_defaults where singleton on conflict(user_id) do nothing;
 perform 1 from public.account_storage_quotas where user_id=target_user for update;
 perform private.reconcile_ai_questions(target_user);
 update public.account_storage_quotas set ai_question_limit=ai_questions_used+remaining,updated_at=now() where user_id=target_user;
 return found;
end $$;

revoke all on function public.account_ai_stats(uuid[]),public.reserve_ai_question(uuid,uuid,uuid),public.finish_ai_question(uuid,uuid,boolean),public.set_ai_question_remaining(uuid,integer) from public,anon,authenticated;
grant execute on function public.account_ai_stats(uuid[]),public.reserve_ai_question(uuid,uuid,uuid),public.finish_ai_question(uuid,uuid,boolean),public.set_ai_question_remaining(uuid,integer) to service_role;

create or replace function public.account_storage_stats(target_ids uuid[])
returns table(user_id uuid,quota_bytes bigint,used_bytes bigint)
language sql stable security invoker set search_path='' as $$
 select u.id,coalesce(q.quota_bytes,268435456::bigint),coalesce(s.bytes,0)::bigint
 from unnest(target_ids) u(id) left join public.account_storage_quotas q on q.user_id=u.id
 left join lateral (select sum(coalesce((o.metadata->>'size')::bigint,0)) bytes from storage.objects o where o.bucket_id in ('papers','avatars','chat-files') and split_part(o.name,'/',1)=u.id::text) s on true
$$;
create or replace function private.storage_quota_allows(bucket text,object_name text,object_metadata jsonb)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare uid uuid:=auth.uid(); allowed bigint; used bigint; incoming bigint;
begin
 if uid is null or split_part(object_name,'/',1)<>uid::text then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended('paper-atlas-storage:'||uid::text,0));
 select quota_bytes into allowed from public.account_storage_quotas where user_id=uid;
 allowed:=coalesce(allowed,268435456);
 select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) into used from storage.objects where bucket_id in ('papers','avatars','chat-files') and split_part(name,'/',1)=uid::text and not(bucket_id=bucket and name=object_name);
 incoming:=greatest(0,coalesce((object_metadata->>'size')::bigint,(object_metadata->>'contentLength')::bigint,0));
 return allowed>0 and used+incoming<=allowed;
end $$;
commit;
