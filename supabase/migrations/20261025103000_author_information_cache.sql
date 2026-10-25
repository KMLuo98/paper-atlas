begin;
alter table public.author_profiles
 add column information_lookup_key text not null default '',
 add column information_lookup_status text not null default '',
 add column information_lookup_at timestamptz;
comment on column public.author_profiles.information_lookup_key is 'Identity and library-paper fingerprint; unchanged failed lookups are not repeated.';
commit;
