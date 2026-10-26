begin;
alter table public.author_profiles
 add column scholar_url text not null default '',
 add column researchgate_url text not null default '',
 add column academic_metrics jsonb not null default '{"sources":[],"best":{}}'::jsonb check(jsonb_typeof(academic_metrics)='object');
commit;
