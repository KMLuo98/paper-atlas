begin;
alter table public.papers drop constraint papers_keyword_pairs_check;
alter table public.papers add constraint papers_keyword_pairs_check check(jsonb_typeof(keyword_pairs)='array');
commit;
