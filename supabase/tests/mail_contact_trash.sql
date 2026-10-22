-- Isolated rollback-only check; no real contacts are modified.
begin;
do $$
declare owner_id uuid; wrong_user uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); snapshot jsonb; actual jsonb; deleted_time timestamptz; merged boolean:=false;
begin
 select user_id into strict owner_id from public.mail_settings limit 1;
 insert into public.mail_contacts(id,user_id,email,emails,name,photo_path,notes,group_name) values
 (a,owner_id,a::text||'@trash-test.invalid',array[a::text||'@trash-test.invalid',a::text||'-alias@trash-test.invalid'],'Trash QA','preserved-photo','preserved notes','未分类'),
 (b,owner_id,b::text||'@trash-test.invalid',array[b::text||'@trash-test.invalid'],'Active QA','','','未分类');
 select to_jsonb(c)-'deleted_at' into snapshot from public.mail_contacts c where id=a;
 if public.mail_contact_trash(wrong_user,a,false) is not null then raise exception 'Cross-owner deletion allowed';end if;
 perform public.mail_contact_trash(owner_id,a,false);
 select deleted_at,to_jsonb(c)-'deleted_at' into deleted_time,actual from public.mail_contacts c where id=a;
 if deleted_time is null or snapshot<>actual then raise exception 'Delete lost contact data';end if;
 if exists(select 1 from public.mail_contacts where id=a and deleted_at is null) then raise exception 'Trash visible in active list';end if;
 if not exists(select 1 from public.mail_contacts where user_id=owner_id and emails @> array[a::text||'-alias@trash-test.invalid']) then raise exception 'Sync can recreate trashed alias';end if;
 perform public.mail_contact_trash(owner_id,a,false);
 if (select deleted_at from public.mail_contacts where id=a)<>deleted_time then raise exception 'Repeat delete changed date';end if;
 begin perform public.mail_contact_merge(owner_id,b,a);merged:=true;exception when no_data_found then null;end;
 if merged then raise exception 'Merged a trashed contact';end if;
 if public.mail_contact_trash(wrong_user,a,true) is not null then raise exception 'Cross-owner restore allowed';end if;
 perform public.mail_contact_trash(owner_id,a,true);
 perform public.mail_contact_trash(owner_id,a,true);
 select to_jsonb(c)-'deleted_at' into actual from public.mail_contacts c where id=a and deleted_at is null;
 if actual is null or snapshot<>actual then raise exception 'Restore lost contact data';end if;
 if has_function_privilege('authenticated','public.mail_contact_trash(uuid,uuid,boolean)','execute') or has_function_privilege('anon','public.mail_contact_trash(uuid,uuid,boolean)','execute') then raise exception 'Unsafe RPC grant';end if;
end$$;
rollback;
