begin;

alter table public.mail_contacts
  add column if not exists second_name text not null default '';

create or replace function public.mail_contact_correspondence(
  p_user uuid, p_contact uuid, p_query text default '', p_offset integer default 0,
  p_limit integer default 50
) returns jsonb
language sql stable security invoker set search_path = ''
as $$
with addresses as (
  select distinct lower(address) as email
  from public.mail_contacts c
  cross join lateral unnest(array[c.email,c.second_email] || c.emails) as a(address)
  where c.user_id=p_user and c.id=p_contact and c.deleted_at is null and address<>''
), filtered as (
  select m.id,m.account_id,m.folder,m.direction,m.subject,m.preview,m.received_at,m.is_read
  from public.mail_messages m
  where m.user_id=p_user and m.folder in ('inbox','sent','archive','custom','spam','trash')
    and (
      ((m.direction='sent' or m.folder='sent') and exists (
        select 1 from jsonb_array_elements(m.to_list || m.cc_list) r
        join addresses a on a.email=lower(r->>'address')
      )) or
      (m.direction<>'sent' and m.folder<>'sent' and lower(m.from_email) in (select email from addresses))
    )
    and (p_query='' or strpos(lower(m.subject),lower(p_query))>0
      or strpos(lower(m.text_body),lower(p_query))>0
      or strpos(lower(m.from_name || ' ' || m.from_email || ' ' || m.to_list::text || ' ' || m.cc_list::text),lower(p_query))>0
      or extensions.similarity(m.subject,p_query)>0.12)
), page as (
  select * from filtered order by received_at desc,id
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0)
)
select jsonb_build_object(
  'messages',coalesce((select jsonb_agg(to_jsonb(page) order by received_at desc,id) from page),'[]'::jsonb),
  'total',(select count(*) from filtered)
);
$$;

revoke all on function public.mail_contact_correspondence(uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.mail_contact_correspondence(uuid,uuid,text,integer,integer) to service_role;
notify pgrst, 'reload schema';
commit;
