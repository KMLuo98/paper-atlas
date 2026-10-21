begin;
alter table public.mail_settings add column sync_interval_minutes integer not null default 5 check(sync_interval_minutes between 1 and 1440),add column contact_groups_revision integer not null default 0;
alter table public.mail_accounts add column last_check_at timestamptz;
update public.mail_accounts set last_check_at=last_sync;
create index mail_accounts_check_due on public.mail_accounts(last_check_at) where enabled;
alter table public.mail_contacts add column group_revision integer not null default 0;
create function public.mail_due_accounts() returns setof public.mail_accounts language sql stable security invoker set search_path='' as $$
 select a.* from public.mail_accounts a join public.mail_settings s on s.user_id=a.user_id
 where a.enabled and (a.lease_until is null or a.lease_until<now()) and (a.last_check_at is null or a.last_check_at<=now()-make_interval(mins=>s.sync_interval_minutes))
 order by a.last_check_at asc nulls first,a.id limit 4
$$;
revoke all on function public.mail_due_accounts() from public,anon,authenticated;
grant execute on function public.mail_due_accounts() to service_role;
create function public.mail_contact_groups_save(p_user uuid,p_rows jsonb,p_revision integer) returns integer language plpgsql security invoker set search_path='' as $$
declare current_revision integer; next_revision integer; names text[]; originals text[]; known text[];begin
 select contact_groups_revision into strict current_revision from public.mail_settings where user_id=p_user for update;
 if current_revision<>p_revision then raise exception '分组已在其他页面更新，请刷新后重试' using errcode='40001';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>100 then raise exception '分组无效';end if;
 select coalesce(array_agg(r.name order by pos) filter(where r.name is not null),'{}'::text[]),coalesce(array_agg(r.original) filter(where r.original is not null),'{}'::text[]) into names,originals from jsonb_array_elements(p_rows) with ordinality t(item,pos) cross join lateral jsonb_to_record(t.item) as r(original text,name text);
 select array_agg(distinct g) into known from (select unnest(contact_groups) g from public.mail_settings where user_id=p_user union select group_name from public.mail_contacts where user_id=p_user and group_name<>'未分类') x;
 if cardinality(names)>30 or exists(select 1 from unnest(names) n where length(n) not between 1 and 50 or n='未分类') or cardinality(names)<>(select count(distinct n) from unnest(names) n) or cardinality(originals)<>(select count(distinct n) from unnest(originals) n) or exists(select 1 from unnest(originals) n where n='未分类' or not(n=any(coalesce(known,'{}'::text[])))) then raise exception '分组名称或原分组无效';end if;
 next_revision=current_revision+1;
 update public.mail_contacts c set group_name=case when c.group_name='未分类' then '未分类' else coalesce((select r.name from jsonb_to_recordset(p_rows) r(original text,name text) where r.original=c.group_name),'未分类') end,
 manual_group=case when c.group_name<>'未分类' and not exists(select 1 from jsonb_to_recordset(p_rows) r(original text,name text) where r.original=c.group_name and r.name is not null) then false else c.manual_group end,
 classified_at=case when not c.manual_group or c.group_name<>'未分类' and not exists(select 1 from jsonb_to_recordset(p_rows) r(original text,name text) where r.original=c.group_name and r.name is not null) then null else c.classified_at end,
 group_revision=next_revision where c.user_id=p_user;
 update public.mail_settings set contact_groups=names,contact_groups_revision=next_revision where user_id=p_user;
 return next_revision;
end$$;
revoke all on function public.mail_contact_groups_save(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.mail_contact_groups_save(uuid,jsonb,integer) to service_role;
select cron.schedule('mail-atlas-sync','* * * * *','select mail_private.dispatch()');
commit;
