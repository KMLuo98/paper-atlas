begin;
-- Retain named-argument compatibility for older clients through the final default.
drop function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text,boolean);
create or replace function public.mail_search(p_user uuid,p_folder text default 'inbox',p_account uuid default null,p_category uuid default null,p_sender text default '',p_query text default '',p_unread boolean default false,p_starred boolean default false,p_offset integer default 0,p_limit integer default 50,p_remote_folder text default '',p_direction text default '',p_unanswered boolean default false,p_hide_ads boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
with filtered as (select m.* from public.mail_message_status m where m.user_id=p_user
 and (p_folder='all' and m.folder in ('inbox','archive','custom') and m.direction='received'
   or p_folder='category_all' and m.folder in ('inbox','sent','archive','custom') or m.folder=p_folder)
 and (p_account is null or m.account_id=p_account) and (p_category is null or m.category_id=p_category)
 and (not p_hide_ads or p_category is not null or not exists(select 1 from public.mail_categories ad where ad.user_id=p_user and ad.id=m.category_id and lower(regexp_replace(ad.name,'[[:space:]]','','g')) in ('广告','广告邮件','ads','advertising','advertisement','advertisements')))
 and (p_direction='' or m.direction=p_direction)
 and (not p_unanswered or m.direction='received' and not m.is_replied)
 and (p_remote_folder='' or m.remote_folder=p_remote_folder)
 and (p_sender='' or lower(m.from_email)=lower(p_sender) or exists(select 1 from public.mail_contacts c where c.user_id=p_user and (lower(c.email)=lower(p_sender) or c.emails @> array[lower(p_sender)]) and (lower(c.email)=lower(m.from_email) or c.emails @> array[lower(m.from_email)]))) and (not p_unread or not m.is_read) and (not p_starred or m.starred)
 and (p_query='' or m.subject ilike '%'||p_query||'%' or m.from_name ilike '%'||p_query||'%' or m.from_email ilike '%'||p_query||'%' or m.text_body ilike '%'||p_query||'%' or m.to_list::text ilike '%'||p_query||'%' or extensions.similarity(m.subject,p_query)>0.12)
),page as (select id,account_id,from_email,from_name,to_list,subject,received_at,preview,is_read,starred,category_id,category_source,folder,remote_folder,attachments,ai_error,direction,is_replied from filtered order by received_at desc,id limit least(greatest(p_limit,1),100) offset greatest(p_offset,0))
select jsonb_build_object('messages',coalesce((select jsonb_agg(page) from page),'[]'::jsonb),'total',(select count(*) from filtered))
$$;
revoke all on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.mail_search(uuid,text,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text,boolean,boolean) to service_role;


notify pgrst, 'reload schema';
commit;
