begin;
alter table public.mail_contacts add column deleted_at timestamptz;
create index mail_contacts_active_owner on public.mail_contacts(user_id,id) where deleted_at is null;
create index mail_contacts_trash_owner on public.mail_contacts(user_id,deleted_at desc,id) where deleted_at is not null;
-- Retain aliases and photos while trashed. Incoming mail must not recreate this person.
create function public.mail_contact_trash(p_user uuid,p_id uuid,p_restore boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
declare found_id uuid;
begin
 perform 1 from public.mail_settings where user_id=p_user for update;
 update public.mail_contacts set deleted_at=case when p_restore then null else coalesce(deleted_at,now()) end
 where id=p_id and user_id=p_user returning id into found_id;
 return found_id;
end$$;
revoke all on function public.mail_contact_trash(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.mail_contact_trash(uuid,uuid,boolean) to service_role;
create or replace function public.mail_contact_merge(p_user uuid,p_source uuid,p_target uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare a public.mail_contacts; b public.mail_contacts; merged text[];begin
 if p_source=p_target then raise exception '请选择两个不同联系人';end if;
 perform 1 from public.mail_settings where user_id=p_user for update;
 perform 1 from public.mail_contacts where user_id=p_user and id in(p_source,p_target) order by id for update;
 select * into strict a from public.mail_contacts where id=p_source and user_id=p_user and deleted_at is null;
 select * into strict b from public.mail_contacts where id=p_target and user_id=p_user and deleted_at is null;
 select array_agg(value order by pos) into merged from (select lower(value) value,min(pos) pos from unnest(array[a.email]||a.emails||array[a.second_email,b.email]||b.emails||array[b.second_email]) with ordinality t(value,pos) where value<>'' group by lower(value)) e;
 delete from public.mail_contacts where id=b.id and user_id=p_user;
 update public.mail_contacts set emails=merged,second_email=coalesce(merged[2],''),manual_group=true where id=a.id and user_id=p_user;
 return a.id;
end$$;
revoke all on function public.mail_contact_merge(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.mail_contact_merge(uuid,uuid,uuid) to service_role;
commit;
