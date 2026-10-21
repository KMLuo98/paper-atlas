begin;
create function public.mail_apply_flags(p_user uuid,p_account uuid,p_flags jsonb) returns void language sql security invoker set search_path='' as $$
 update public.mail_messages m set is_read=f.is_read,starred=f.starred from jsonb_to_recordset(p_flags) as f(remote_id text,is_read boolean,starred boolean)
 where m.user_id=p_user and m.account_id=p_account and m.remote_id=f.remote_id
$$;
revoke all on function public.mail_apply_flags(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mail_apply_flags(uuid,uuid,jsonb) to service_role;
create or replace function mail_private.dispatch() returns void language plpgsql security definer set search_path='' as $$begin
 perform net.http_post(url:='https://fubuikclgsgcxviymshr.supabase.co/functions/v1/mail-api',headers:='{"Content-Type":"application/json"}'::jsonb,
 body:=jsonb_build_object('action','cron','token',(select value from mail_private.internal where key='cron_token')),timeout_milliseconds:=5000);
end$$;
create index mail_translations_owner on public.mail_translations(user_id);
commit;
