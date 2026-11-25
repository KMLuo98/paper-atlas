create table public.mail_scheduled_sends (
 id uuid primary key,
 user_id uuid not null references auth.users on delete cascade,
 account_id uuid not null,
 send_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','cancelled','failed','uncertain')),
 raw_path text not null,
 metadata jsonb not null default '{}',
 claim_token uuid,
 started_at timestamptz,
 delivery_started_at timestamptz,
 finished_at timestamptz,
 last_error text not null default '',
 warning text not null default '',
 result jsonb,
 created_at timestamptz not null default now(),
 foreign key(account_id,user_id) references public.mail_accounts(id,user_id) on delete cascade
);
create index mail_scheduled_owner on public.mail_scheduled_sends(user_id,send_at desc);
create index mail_scheduled_account on public.mail_scheduled_sends(account_id,user_id);
create index mail_scheduled_due on public.mail_scheduled_sends(send_at,id) where status='pending';
create index mail_scheduled_stale on public.mail_scheduled_sends(started_at) where status='sending';
alter table public.mail_scheduled_sends enable row level security;
revoke all on public.mail_scheduled_sends from public,anon,authenticated;
grant select on public.mail_scheduled_sends to authenticated;
grant all on public.mail_scheduled_sends to service_role;
create policy read_own on public.mail_scheduled_sends for select to authenticated using ((select auth.uid())=user_id);

-- Reserve the same idempotency key used by immediate delivery in the same transaction.
-- A lost enqueue response cannot turn a queued message into an immediate duplicate send.
create function public.mail_enqueue_scheduled(p_row jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare saved public.mail_scheduled_sends; locked jsonb;
begin
 select * into saved from public.mail_scheduled_sends where id=(p_row->>'id')::uuid and user_id=(p_row->>'user_id')::uuid;
 if found then return to_jsonb(saved); end if;
 if (p_row->>'send_at')::timestamptz < now()+interval '30 seconds' then raise exception 'Scheduled time has passed';end if;
 if not exists(select 1 from public.mail_accounts where id=(p_row->>'account_id')::uuid and user_id=(p_row->>'user_id')::uuid) then raise exception 'Not owned';end if;
 select public.mail_send_lock((p_row->>'user_id')::uuid,(p_row->>'id')::uuid) into locked;
 if not (locked->>'acquired')::boolean then
  select * into saved from public.mail_scheduled_sends where id=(p_row->>'id')::uuid and user_id=(p_row->>'user_id')::uuid;
  if found then return to_jsonb(saved);end if;
  raise exception 'This delivery request is already in use';
 end if;
 insert into public.mail_scheduled_sends(id,user_id,account_id,send_at,raw_path,metadata)
 values((p_row->>'id')::uuid,(p_row->>'user_id')::uuid,(p_row->>'account_id')::uuid,(p_row->>'send_at')::timestamptz,p_row->>'raw_path',p_row->'metadata') returning * into saved;
 return to_jsonb(saved);
end $$;

create function public.mail_claim_scheduled() returns setof public.mail_scheduled_sends
language plpgsql security invoker set search_path='' as $$
begin
 -- A crashed worker which never crossed the send boundary can be reclaimed safely.
 update public.mail_scheduled_sends set status='pending',claim_token=null,started_at=null
 where status='sending' and delivery_started_at is null and started_at<now()-interval '10 minutes';
 update public.mail_scheduled_sends set status='uncertain',last_error='投递结果尚未确认，请先到原邮箱核实；系统不会自动重复发送'
 where status='sending' and delivery_started_at is not null and started_at<now()-interval '10 minutes';
 return query update public.mail_scheduled_sends q set status='sending',claim_token=gen_random_uuid(),started_at=now()
 where q.id in (select s.id from public.mail_scheduled_sends s where s.status='pending' and s.send_at<=now() order by s.send_at,s.id limit 3 for update skip locked)
 returning q.*;
end $$;
revoke all on function public.mail_enqueue_scheduled(jsonb),public.mail_claim_scheduled() from public,anon,authenticated;
grant execute on function public.mail_enqueue_scheduled(jsonb),public.mail_claim_scheduled() to service_role;

-- Independent of the user's mailbox polling interval; no browser session is involved.
create function mail_private.dispatch_scheduled() returns void language plpgsql security definer set search_path='' as $$
begin
 perform net.http_post(url:='https://fubuikclgsgcxviymshr.supabase.co/functions/v1/scheduled-mail',headers:='{"Content-Type":"application/json"}'::jsonb,
 body:=jsonb_build_object('action','cron','token',(select value from mail_private.internal where key='cron_token')),timeout_milliseconds:=5000);
end $$;
revoke all on function mail_private.dispatch_scheduled() from public,anon,authenticated;
select cron.schedule('mail-atlas-scheduled-send','* * * * *','select mail_private.dispatch_scheduled()');
