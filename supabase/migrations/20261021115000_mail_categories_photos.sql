begin;
alter table public.mail_messages add column category_version text;
alter table public.mail_contacts
 add column photo_source text not null default '',
 add column photo_source_url text not null default '',
 add column photo_lookup_key text not null default '',
 add column photo_lookup_status text not null default '',
 add column photo_lookup_at timestamptz,
 add column photo_lookup_lease_until timestamptz;
update public.mail_contacts set photo_source='manual' where photo_path<>'';
alter table public.mail_settings add column auto_contact_photos boolean not null default true;
create index mail_messages_category_version on public.mail_messages(user_id,category_version) where category_source is distinct from 'manual';
commit;
