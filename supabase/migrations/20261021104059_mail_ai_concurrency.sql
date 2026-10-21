begin;
alter table public.mail_settings add column classify_lease_until timestamptz;
alter table public.mail_contacts add column classified_at timestamptz, add column ai_error text;
create function public.mail_classify_claim(p_user uuid) returns boolean language sql security invoker set search_path='' as $$
with claimed as (update public.mail_settings set classify_lease_until=now()+interval '110 seconds' where user_id=p_user and (classify_lease_until is null or classify_lease_until<now()) returning user_id) select exists(select 1 from claimed)
$$;
revoke all on function public.mail_classify_claim(uuid) from public,anon,authenticated;
grant execute on function public.mail_classify_claim(uuid) to service_role;
commit;
