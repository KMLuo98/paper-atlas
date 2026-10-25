begin;
create temporary table pa_author_rls_fixture as select gen_random_uuid() as id,(select id from public.profiles order by created_at limit 1) as user_id;
grant select on pa_author_rls_fixture to authenticated;
insert into public.author_profiles(id,user_id,identity_keys,first_name,last_name) select id,user_id,array['name:qa-author-fixture'],'QA','Author' from pa_author_rls_fixture;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from pa_author_rls_fixture),'role','authenticated')::text,true);
do $$begin
 if not exists(select 1 from public.author_profiles where id=(select id from pa_author_rls_fixture)) then raise exception 'Author owner must read own profile'; end if;
 if has_table_privilege('authenticated','public.author_profiles','INSERT') or has_table_privilege('authenticated','public.author_profiles','UPDATE') then raise exception 'Direct client writes must be denied'; end if;
end$$;
select set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
do $$begin
 if exists(select 1 from public.author_profiles where id=(select id from pa_author_rls_fixture)) then raise exception 'Another account must not read the author profile'; end if;
end$$;
rollback;
