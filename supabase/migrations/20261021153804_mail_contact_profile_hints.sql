begin;
alter table public.mail_contacts add column profile_url text not null default '';
commit;
