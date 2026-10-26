begin;
create table public.pdf_annotations (
 user_id uuid not null references auth.users(id) on delete cascade,
 file_path text not null,
 marks jsonb not null default '[]'::jsonb check(jsonb_typeof(marks)='array' and octet_length(marks::text)<=2097152),
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 primary key(user_id,file_path)
);
alter table public.pdf_annotations enable row level security;
revoke all on public.pdf_annotations from anon,authenticated;
grant select on public.pdf_annotations to authenticated;
grant all on public.pdf_annotations to service_role;
create policy pdf_annotations_owner_read on public.pdf_annotations for select to authenticated using(user_id=(select auth.uid()));
create function public.save_pdf_annotations(p_file_path text,p_marks jsonb,p_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare pa_uid uuid:=auth.uid();pa_row public.pdf_annotations;
begin
 if pa_uid is null then raise exception 'Authentication required';end if;
 if split_part(p_file_path,'/',1)<>pa_uid::text or position('..' in p_file_path)>0 then raise exception 'Invalid file path';end if;
 if not exists(select 1 from public.papers p where p.user_id=pa_uid and p.deleted_at is null and (p.file_path=p_file_path or exists(select 1 from jsonb_array_elements(p.supplementary_files) s where s->>'path'=p_file_path))) then raise exception 'File unavailable';end if;
 if p_version is null or p_version<0 then raise exception 'Annotation version required';end if;
 if p_marks is null or jsonb_typeof(p_marks)<>'array' or octet_length(p_marks::text)>2097152 or jsonb_array_length(p_marks)>5000 then raise exception 'Annotations exceed document limit';end if;
 select * into pa_row from public.pdf_annotations a where a.user_id=pa_uid and a.file_path=p_file_path for update;
 if found then
  if pa_row.version<>p_version then raise exception 'Annotations changed in another window; reopen before saving';end if;
  update public.pdf_annotations set marks=p_marks,version=version+1,updated_at=now() where user_id=pa_uid and file_path=p_file_path returning * into pa_row;
 else
  if p_version<>0 then raise exception 'Annotation version mismatch';end if;
  insert into public.pdf_annotations(user_id,file_path,marks) values(pa_uid,p_file_path,p_marks) on conflict do nothing returning * into pa_row;
  if not found then raise exception 'Annotations changed in another window; reopen before saving';end if;
 end if;
 return jsonb_build_object('marks',pa_row.marks,'version',pa_row.version);
end;$$;
revoke all on function public.save_pdf_annotations(text,jsonb,integer) from public,anon;
grant execute on function public.save_pdf_annotations(text,jsonb,integer) to authenticated;
create function public.remove_paper_supplement(p_paper_id uuid,p_path text) returns jsonb language plpgsql security definer set search_path='' as $$
declare pa_uid uuid:=auth.uid();pa_paper public.papers;pa_items jsonb;
begin
 if pa_uid is null then raise exception 'Authentication required';end if;
 select * into pa_paper from public.papers p where p.id=p_paper_id and p.user_id=pa_uid and p.deleted_at is null for update;
 if not found then raise exception 'Paper unavailable';end if;
 if split_part(p_path,'/',1)<>pa_uid::text or p_path !~ '/sm-[0-9a-f-]{36}\.' then raise exception 'Invalid supplement path';end if;
 select coalesce(jsonb_agg(s),'[]'::jsonb) into pa_items from jsonb_array_elements(pa_paper.supplementary_files) s where s->>'path'<>p_path;
 update public.papers set supplementary_files=pa_items where id=p_paper_id and user_id=pa_uid;
 delete from public.pdf_annotations where user_id=pa_uid and file_path=p_path;
 return jsonb_build_object('id',p_paper_id,'supplementary_files',pa_items);
end;$$;
revoke all on function public.remove_paper_supplement(uuid,text) from public,anon;
grant execute on function public.remove_paper_supplement(uuid,text) to authenticated;
create function private.normalise_sm_names() returns trigger language plpgsql set search_path='' as $$
declare pa_items jsonb;
begin
 select coalesce(jsonb_agg(s||jsonb_build_object('original_name',coalesce(s->>'original_name',s->>'name'),'name','['||coalesce(nullif(new.journal_abbr,''),nullif(new.journal,''),'未发表')||' '||coalesce(to_char(new.published_at,'YYYY.MM'),'日期待定')||' SM] '||left(regexp_replace(new.title,'[\\/:*?"<>|[:cntrl:]]','_','g'),400)||'.'||lower(coalesce(substring(s->>'path' from '\.([^.]+)$'),'pdf')))),'[]'::jsonb) into pa_items from jsonb_array_elements(new.supplementary_files) s;
 new.supplementary_files:=pa_items;return new;
end;$$;
create trigger paper_sm_names before update of title,journal,journal_abbr,published_at,supplementary_files on public.papers for each row execute function private.normalise_sm_names();
update public.papers set supplementary_files=supplementary_files where jsonb_array_length(supplementary_files)>0;
create function private.paper_annotations_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.pdf_annotations a where a.user_id=old.user_id and (a.file_path=old.file_path or exists(select 1 from jsonb_array_elements(old.supplementary_files) s where s->>'path'=a.file_path));
 return old;
end;$$;
create trigger paper_annotations_cleanup after delete on public.papers for each row execute function private.paper_annotations_cleanup();
commit;
