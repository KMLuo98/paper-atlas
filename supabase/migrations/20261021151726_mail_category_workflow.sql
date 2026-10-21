begin;
alter table public.mail_categories add column sort_order integer not null default 0, add column icon text not null default 'folder';
with ranked as (select id,row_number() over(partition by user_id order by created_at,id)-1 pos from public.mail_categories)
update public.mail_categories c set sort_order=r.pos from ranked r where c.id=r.id;
create index mail_category_order on public.mail_categories(user_id,sort_order,created_at,id);
alter table public.mail_contacts add column photo_lookup_reason text not null default '';
alter table public.mail_messages add column in_reply_to text not null default '', add column reference_ids text[] not null default '{}',
 add column reply_headers_loaded boolean not null default false, add column is_answered boolean not null default false,
 add column direction text not null default 'received' check(direction in ('received','sent'));
update public.mail_messages m set direction='sent' where m.folder='sent' or exists(select 1 from public.mail_accounts a where a.user_id=m.user_id and lower(a.email)=lower(m.from_email));
create index mail_reply_id on public.mail_messages(user_id,in_reply_to) where direction='sent';
create index mail_reply_references on public.mail_messages using gin(reference_ids) where direction='sent';
create index mail_reply_backfill on public.mail_messages(user_id,created_at) where not reply_headers_loaded;

create function public.mail_category_reorder(p_user uuid,p_ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.mail_settings where user_id=p_user for update;
 perform 1 from public.mail_categories where user_id=p_user for update;
 if cardinality(p_ids)<>(select count(*) from public.mail_categories where user_id=p_user)
 or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x)
 or exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.mail_categories c where c.user_id=p_user and c.id=x))
 then raise exception '类别列表已变化，请刷新后重新排序' using errcode='40001';end if;
 update public.mail_categories c set sort_order=x.pos-1 from unnest(p_ids) with ordinality as x(id,pos) where c.user_id=p_user and c.id=x.id;
end$$;
revoke all on function public.mail_category_reorder(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.mail_category_reorder(uuid,uuid[]) to service_role;

create view public.mail_message_status with(security_invoker=true) as
select m.*,(m.is_answered or (m.message_id<>'' and exists(
 select 1 from public.mail_messages s where s.user_id=m.user_id and s.direction='sent' and s.folder<>'drafts'
 and s.received_at>=m.received_at and (s.in_reply_to=m.message_id or s.reference_ids@>array[m.message_id])
))) as is_replied from public.mail_messages m;
revoke all on public.mail_message_status from public,anon,authenticated;
grant select on public.mail_message_status to service_role;

create or replace function public.mail_stats(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(t),'[]'::jsonb) from (
 select account_id,category_id,is_read,folder,starred,direction,is_replied,reply_headers_loaded,count(*) as total
 from public.mail_message_status where user_id=p_user group by account_id,category_id,is_read,folder,starred,direction,is_replied,reply_headers_loaded)t
$$;

drop function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text);
create function public.mail_search(p_user uuid,p_folder text default 'inbox',p_account uuid default null,p_category uuid default null,p_sender text default '',p_query text default '',p_unread boolean default false,p_starred boolean default false,p_offset integer default 0,p_limit integer default 50,p_remote_folder text default '',p_direction text default '',p_unanswered boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
with filtered as (select m.* from public.mail_message_status m where m.user_id=p_user
 and (p_folder='all' and m.folder in ('inbox','archive','custom') and m.direction='received'
   or p_folder='category_all' and m.folder in ('inbox','sent','archive','custom') or m.folder=p_folder)
 and (p_account is null or m.account_id=p_account) and (p_category is null or m.category_id=p_category)
 and (p_direction='' or m.direction=p_direction)
 and (not p_unanswered or m.direction='received' and not m.is_replied)
 and (p_remote_folder='' or m.remote_folder=p_remote_folder)
 and (p_sender='' or m.from_email=p_sender) and (not p_unread or not m.is_read) and (not p_starred or m.starred)
 and (p_query='' or m.subject ilike '%'||p_query||'%' or m.from_name ilike '%'||p_query||'%' or m.from_email ilike '%'||p_query||'%' or m.text_body ilike '%'||p_query||'%' or m.to_list::text ilike '%'||p_query||'%' or extensions.similarity(m.subject,p_query)>0.12)
),page as (select id,account_id,from_email,from_name,to_list,subject,received_at,preview,is_read,starred,category_id,category_source,folder,remote_folder,attachments,ai_error,direction,is_replied from filtered order by received_at desc,id limit least(greatest(p_limit,1),100) offset greatest(p_offset,0))
select jsonb_build_object('messages',coalesce((select jsonb_agg(page) from page),'[]'::jsonb),'total',(select count(*) from filtered))
$$;
revoke all on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text,boolean) from public,anon,authenticated;
grant execute on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text,boolean) to service_role;

create or replace function public.mail_apply_flags(p_user uuid,p_account uuid,p_flags jsonb) returns void language sql security invoker set search_path='' as $$
 update public.mail_messages m set is_read=f.is_read,starred=f.starred,is_answered=coalesce(f.is_answered,m.is_answered)
 from jsonb_to_recordset(p_flags) as f(remote_id text,is_read boolean,starred boolean,is_answered boolean)
 where m.user_id=p_user and m.account_id=p_account and m.remote_id=f.remote_id
$$;
commit;
