begin;
alter table public.mail_contacts add column emails text[] not null default '{}';
update public.mail_contacts set emails=array(select distinct lower(x) from unnest(array[email,second_email]) x where x<>'');
create index mail_contacts_email_aliases on public.mail_contacts using gin(emails);
create table public.mail_photo_candidates(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,photo_path text not null,source text not null,title text not null default '',exact boolean not null default false,identity_key text not null,created_at timestamptz not null default now());
alter table public.mail_photo_candidates enable row level security;
revoke all on public.mail_photo_candidates from public,anon,authenticated;
grant all on public.mail_photo_candidates to service_role;
create index mail_photo_candidates_owner on public.mail_photo_candidates(user_id,created_at);
create function mail_private.contact_alias_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare addresses text[];begin
 perform 1 from public.mail_settings where user_id=new.user_id for update;
 select array_agg(value order by pos) into addresses from (select lower(value) value,min(pos) pos from unnest(array[new.email]||new.emails||array[new.second_email]) with ordinality t(value,pos) where value<>'' group by lower(value)) e;
 new.email=lower(new.email);new.emails=addresses;new.second_email=coalesce(addresses[2],'');
 if exists(select 1 from public.mail_contacts c where c.user_id=new.user_id and c.id<>new.id and c.emails && addresses) then raise exception '邮箱已属于其他联系人，请合并' using errcode='23505';end if;
 return new;
end$$;
revoke all on function mail_private.contact_alias_guard() from public,anon,authenticated;
grant execute on function mail_private.contact_alias_guard() to service_role;
create trigger contact_alias_guard before insert or update of email,second_email,emails on public.mail_contacts for each row execute function mail_private.contact_alias_guard();
create function public.mail_contact_merge(p_user uuid,p_source uuid,p_target uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare a public.mail_contacts; b public.mail_contacts; merged text[];begin
 if p_source=p_target then raise exception '请选择两个不同联系人';end if;
 perform 1 from public.mail_settings where user_id=p_user for update;
 perform 1 from public.mail_contacts where user_id=p_user and id in(p_source,p_target) order by id for update;
 select * into strict a from public.mail_contacts where id=p_source and user_id=p_user;
 select * into strict b from public.mail_contacts where id=p_target and user_id=p_user;
 select array_agg(value order by pos) into merged from (select lower(value) value,min(pos) pos from unnest(array[a.email]||a.emails||array[a.second_email,b.email]||b.emails||array[b.second_email]) with ordinality t(value,pos) where value<>'' group by lower(value)) e;
 delete from public.mail_contacts where id=b.id and user_id=p_user;
 update public.mail_contacts set emails=merged,second_email=coalesce(merged[2],''),manual_group=true where id=a.id and user_id=p_user;
 return a.id;
end$$;
revoke all on function public.mail_contact_merge(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.mail_contact_merge(uuid,uuid,uuid) to service_role;
create or replace function public.mail_search(p_user uuid,p_folder text default 'inbox',p_account uuid default null,p_category uuid default null,p_sender text default '',p_query text default '',p_unread boolean default false,p_starred boolean default false,p_offset integer default 0,p_limit integer default 50,p_remote_folder text default '',p_direction text default '',p_unanswered boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
with filtered as (select m.* from public.mail_message_status m where m.user_id=p_user
 and (p_folder='all' and m.folder in ('inbox','archive','custom') and m.direction='received'
   or p_folder='category_all' and m.folder in ('inbox','sent','archive','custom') or m.folder=p_folder)
 and (p_account is null or m.account_id=p_account) and (p_category is null or m.category_id=p_category)
 and (p_direction='' or m.direction=p_direction)
 and (not p_unanswered or m.direction='received' and not m.is_replied)
 and (p_remote_folder='' or m.remote_folder=p_remote_folder)
 and (p_sender='' or lower(m.from_email)=lower(p_sender) or exists(select 1 from public.mail_contacts c where c.user_id=p_user and (lower(c.email)=lower(p_sender) or c.emails @> array[lower(p_sender)]) and (lower(c.email)=lower(m.from_email) or c.emails @> array[lower(m.from_email)]))) and (not p_unread or not m.is_read) and (not p_starred or m.starred)
 and (p_query='' or m.subject ilike '%'||p_query||'%' or m.from_name ilike '%'||p_query||'%' or m.from_email ilike '%'||p_query||'%' or m.text_body ilike '%'||p_query||'%' or m.to_list::text ilike '%'||p_query||'%' or extensions.similarity(m.subject,p_query)>0.12)
),page as (select id,account_id,from_email,from_name,to_list,subject,received_at,preview,is_read,starred,category_id,category_source,folder,remote_folder,attachments,ai_error,direction,is_replied from filtered order by received_at desc,id limit least(greatest(p_limit,1),100) offset greatest(p_offset,0))
select jsonb_build_object('messages',coalesce((select jsonb_agg(page) from page),'[]'::jsonb),'total',(select count(*) from filtered))
$$;
revoke all on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text,boolean) from public,anon,authenticated;
grant execute on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text,boolean) to service_role;


commit;
