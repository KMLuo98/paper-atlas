begin;
alter table public.mail_messages drop constraint mail_messages_folder_check;
alter table public.mail_messages add constraint mail_messages_folder_check check(folder in ('inbox','sent','archive','trash','drafts','spam','custom'));
create index mail_messages_remote_folder on public.mail_messages(user_id,account_id,remote_folder,received_at desc);
drop function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer);
create function public.mail_search(p_user uuid,p_folder text default 'inbox',p_account uuid default null,p_category uuid default null,p_sender text default '',p_query text default '',p_unread boolean default false,p_starred boolean default false,p_offset integer default 0,p_limit integer default 50,p_remote_folder text default '')
returns jsonb language sql stable security invoker set search_path='' as $$
with filtered as (select m.* from public.mail_messages m where m.user_id=p_user
 and (p_folder='all' and m.folder in ('inbox','archive','custom') or m.folder=p_folder)
 and (p_account is null or m.account_id=p_account) and (p_category is null or m.category_id=p_category)
 and (p_remote_folder='' or m.remote_folder=p_remote_folder)
 and (p_sender='' or m.from_email=p_sender) and (not p_unread or not m.is_read) and (not p_starred or m.starred)
 and (p_query='' or m.subject ilike '%'||p_query||'%' or m.from_name ilike '%'||p_query||'%' or m.from_email ilike '%'||p_query||'%' or m.text_body ilike '%'||p_query||'%' or m.to_list::text ilike '%'||p_query||'%' or extensions.similarity(m.subject,p_query)>0.12)
),page as (select id,account_id,from_email,from_name,to_list,subject,received_at,preview,is_read,starred,category_id,category_source,folder,remote_folder,attachments,ai_error from filtered order by received_at desc,id limit least(greatest(p_limit,1),100) offset greatest(p_offset,0))
select jsonb_build_object('messages',coalesce((select jsonb_agg(page) from page),'[]'::jsonb),'total',(select count(*) from filtered))
$$;
revoke all on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text) from public,anon,authenticated;
grant execute on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text) to service_role;
commit;
