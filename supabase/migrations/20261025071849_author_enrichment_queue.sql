begin;
alter table public.author_profiles
 add column source_key text default gen_random_uuid()::text,
 add column photo_lookup_key text not null default '',
 add column photo_lookup_status text not null default '',
 add column photo_lookup_at timestamptz,
 add column photo_lookup_lease_until timestamptz,
 add column keywords_lookup_key text not null default '',
 add column keywords_lookup_status text not null default '',
 add column keywords_lookup_at timestamptz,
 add column keywords_lookup_lease_until timestamptz,
 add column keywords_manual boolean not null default false;
update public.author_profiles set source_key=coalesce(identity_keys[1],id::text);
alter table public.author_profiles alter column source_key set not null;
alter table public.author_profiles add constraint author_profiles_owner_source_unique unique(user_id,source_key);
update public.author_profiles set keywords_manual=true where jsonb_array_length(keywords)>0 and keywords_generated_at is null;
commit;
