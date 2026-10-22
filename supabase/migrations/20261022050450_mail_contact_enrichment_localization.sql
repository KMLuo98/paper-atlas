begin;
alter table public.mail_settings
 add column localize_organizations boolean not null default true,
 add column organization_language text not null default 'auto' check(organization_language in ('auto','zh','en')),
 add column auto_contact_organizations boolean not null default true;
alter table public.mail_settings add column organization_labels_lease_until timestamptz;
alter table public.mail_contacts
 add column organization_labels jsonb not null default '{}',
 add column organization_source text not null default 'manual' check(organization_source in ('manual','auto')),
 add column info_lookup_key text not null default '',
 add column info_lookup_status text not null default '',
 add column info_lookup_at timestamptz,
 add column info_lookup_lease_until timestamptz,
 add column organization_evidence jsonb not null default '[]';
create index mail_contacts_enrichment_pending on public.mail_contacts(user_id,created_at desc) where deleted_at is null and organization='';
commit;
