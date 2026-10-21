begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists mail_private;
revoke all on schema mail_private from public,anon,authenticated;

create table public.mail_accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 email text not null, label text not null check(length(label) between 1 and 40), color text not null default '#3b6b62' check(color ~ '^#[0-9a-fA-F]{6}$'),
 provider text not null default 'imap' check(provider in ('imap','gmail','outlook')), config jsonb not null default '{}',
 enabled boolean not null default true, sync_state jsonb not null default '{}', last_sync timestamptz, sync_error text,
 lease_until timestamptz, created_at timestamptz not null default now(), unique(user_id,email), unique(id,user_id)
);
create table public.mail_categories (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 name text not null check(length(name) between 1 and 60), description text not null default '', color text not null default '#668c83',
 created_at timestamptz not null default now(), unique(user_id,name),unique(id,user_id)
);
create table public.mail_contacts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 email text not null, name text not null default '', second_email text not null default '', photo_path text not null default '',
 organization text not null default '', phone text not null default '', notes text not null default '',
 group_name text not null default '未分类', manual_group boolean not null default false, created_at timestamptz not null default now(),
 unique(user_id,email),unique(id,user_id)
);
create table public.mail_messages (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 account_id uuid not null,remote_id text not null,remote_folder text not null default 'INBOX',message_id text not null default '',
 folder text not null default 'inbox' check(folder in ('inbox','sent','archive','trash')),
 from_email text not null default '',from_name text not null default '',to_list jsonb not null default '[]',cc_list jsonb not null default '[]',
 reply_to text not null default '',subject text not null default '',received_at timestamptz not null default now(),
 preview text not null default '',text_body text not null default '',html_body text not null default '',
 is_read boolean not null default false,starred boolean not null default false,category_id uuid,category_source text,
 ai_error text,classified_at timestamptz,raw_path text not null default '',attachments jsonb not null default '[]',
 created_at timestamptz not null default now(),unique(account_id,remote_id), unique(id,user_id),
 foreign key(account_id,user_id) references public.mail_accounts(id,user_id) on delete cascade,
 foreign key(category_id,user_id) references public.mail_categories(id,user_id)
);
create index mail_messages_list on public.mail_messages(user_id,folder,received_at desc,id);
create index mail_messages_category on public.mail_messages(user_id,category_id);
create index mail_messages_account on public.mail_messages(account_id,user_id);
create index mail_messages_sender on public.mail_messages(user_id,from_email);
create index mail_messages_pending on public.mail_messages(user_id,created_at) where classified_at is null and category_source is distinct from 'manual';
create index mail_messages_subject on public.mail_messages using gin(subject extensions.gin_trgm_ops);
create index mail_accounts_sync on public.mail_accounts(last_sync) where enabled;
create table public.mail_translations (
 message_id uuid not null,user_id uuid not null references auth.users on delete cascade,language text not null,
 content text not null,created_at timestamptz not null default now(),primary key(message_id,language),
 foreign key(message_id,user_id) references public.mail_messages(id,user_id) on delete cascade
);
create table public.mail_settings (
 user_id uuid primary key references auth.users on delete cascade,auto_classify boolean not null default true,
 contact_groups text[] not null default array['学术交流','机构通知','商业服务','其他'],signature text not null default '',
 translation_language text not null default '简体中文'
);
create table public.mail_drafts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 data jsonb not null default '{}',updated_at timestamptz not null default now()
);
create index mail_drafts_owner on public.mail_drafts(user_id,updated_at desc);
create table mail_private.credentials(account_id uuid primary key references public.mail_accounts on delete cascade,secret_id uuid not null);
create table mail_private.oauth_states(state_hash text primary key,user_id uuid not null references auth.users on delete cascade,account_id uuid not null references public.mail_accounts on delete cascade,expires_at timestamptz not null,verifier text not null);
create table mail_private.sends(user_id uuid not null references auth.users on delete cascade,key uuid not null,status text not null default 'sending',result jsonb,created_at timestamptz not null default now(),primary key(user_id,key));
create table mail_private.internal(key text primary key,value text not null);
insert into mail_private.internal values('cron_token',encode(extensions.gen_random_bytes(32),'hex'));

do $$declare t text;begin
 foreach t in array array['mail_accounts','mail_categories','mail_contacts','mail_messages','mail_translations','mail_settings','mail_drafts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy read_own on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end$$;
-- Service-only credential access. Decrypted secrets never enter any browser-readable table.
create function public.mail_secret(p_account uuid,p_user uuid,p_value jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid; result jsonb;begin
 if not exists(select 1 from public.mail_accounts where id=p_account and user_id=p_user) then raise exception 'Account not owned';end if;
 select secret_id into sid from mail_private.credentials where account_id=p_account;
 if p_value is not null then
 if sid is null then select vault.create_secret(p_value::text) into sid;insert into mail_private.credentials values(p_account,sid);
 else perform vault.update_secret(sid,p_value::text);end if;return '{}'::jsonb;
 end if;
 select decrypted_secret::jsonb into result from vault.decrypted_secrets where id=sid;return result;
end$$;
create function mail_private.remove_secret() returns trigger language plpgsql security definer set search_path='' as $$begin delete from vault.secrets where id=old.secret_id;return old;end$$;
create trigger cleanup_mail_secret after delete on mail_private.credentials for each row execute function mail_private.remove_secret();
create function public.mail_claim(p_account uuid) returns boolean language sql security definer set search_path='' as $$
with claimed as (update public.mail_accounts set lease_until=now()+interval '110 seconds' where id=p_account and (lease_until is null or lease_until<now()) returning id) select exists(select 1 from claimed)
$$;
create function public.mail_oauth_state(p_hash text,p_user uuid default null,p_account uuid default null,p_verifier text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 delete from mail_private.oauth_states where expires_at<now();
 if p_user is not null then
 if not exists(select 1 from public.mail_accounts where id=p_account and user_id=p_user) then raise exception 'Not owned';end if;
 insert into mail_private.oauth_states values(p_hash,p_user,p_account,now()+interval '10 minutes',p_verifier);return '{}'::jsonb;
 end if;
 delete from mail_private.oauth_states where state_hash=p_hash returning jsonb_build_object('user_id',user_id,'account_id',account_id,'verifier',verifier) into result;return result;
end$$;
create function public.mail_send_lock(p_user uuid,p_key uuid,p_result jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$declare s record;begin
 if p_result is not null then update mail_private.sends set status='sent',result=p_result where user_id=p_user and key=p_key;return p_result;end if;
 insert into mail_private.sends(user_id,key) values(p_user,p_key) on conflict do nothing;
 if found then return jsonb_build_object('acquired',true);end if;
 select * into s from mail_private.sends where user_id=p_user and key=p_key;
 return jsonb_build_object('acquired',false,'status',s.status,'result',s.result);
end$$;
create function public.mail_cron_check(p_token text) returns boolean language sql security definer set search_path='' as $$select value=p_token from mail_private.internal where key='cron_token'$$;
create function mail_private.dispatch() returns void language plpgsql security definer set search_path='' as $$begin
 perform net.http_post(url:='https://fubuikclgsgcxviymshr.supabase.co/functions/v1/mail-api',headers:='{"Content-Type":"application/json"}'::jsonb,
 body:=jsonb_build_object('action','cron','token',(select value from mail_private.internal where key='cron_token')),timeout_milliseconds:=1000);
end$$;
revoke all on function public.mail_secret(uuid,uuid,jsonb),public.mail_claim(uuid),public.mail_oauth_state(text,uuid,uuid,text),public.mail_send_lock(uuid,uuid,jsonb),public.mail_cron_check(text) from public,anon,authenticated;
grant execute on function public.mail_secret(uuid,uuid,jsonb),public.mail_claim(uuid),public.mail_oauth_state(text,uuid,uuid,text),public.mail_send_lock(uuid,uuid,jsonb),public.mail_cron_check(text) to service_role;
revoke all on function mail_private.dispatch(),mail_private.remove_secret() from public,anon,authenticated;
select cron.schedule('mail-atlas-sync','*/5 * * * *','select mail_private.dispatch()');
create function public.mail_search(p_user uuid,p_folder text default 'inbox',p_account uuid default null,p_category uuid default null,p_sender text default '',p_query text default '',p_unread boolean default false,p_starred boolean default false,p_offset integer default 0,p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path='' as $$
with filtered as (select m.* from public.mail_messages m where m.user_id=p_user
 and (p_folder='all' and m.folder in ('inbox','archive') or m.folder=p_folder)
 and (p_account is null or m.account_id=p_account) and (p_category is null or m.category_id=p_category)
 and (p_sender='' or m.from_email=p_sender) and (not p_unread or not m.is_read) and (not p_starred or m.starred)
 and (p_query='' or m.subject ilike '%'||p_query||'%' or m.from_name ilike '%'||p_query||'%' or m.from_email ilike '%'||p_query||'%' or m.text_body ilike '%'||p_query||'%' or extensions.similarity(m.subject,p_query)>0.12)
),page as (select id,account_id,from_email,from_name,subject,received_at,preview,is_read,starred,category_id,category_source,folder,attachments,ai_error from filtered order by received_at desc,id limit least(greatest(p_limit,1),100) offset greatest(p_offset,0))
select jsonb_build_object('messages',coalesce((select jsonb_agg(page) from page),'[]'::jsonb),'total',(select count(*) from filtered))
$$;
revoke all on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer) to service_role;
create function public.mail_stats(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(t),'[]'::jsonb) from (select account_id,category_id,is_read,folder,starred,count(*) as total from public.mail_messages where user_id=p_user group by account_id,category_id,is_read,folder,starred)t
$$;
revoke all on function public.mail_stats(uuid) from public,anon,authenticated;
grant execute on function public.mail_stats(uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('mail-files','mail-files',false,26214400);
commit;
