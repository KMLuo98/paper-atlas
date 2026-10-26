begin;
alter table public.papers add column supplementary_files jsonb not null default '[]'::jsonb check(jsonb_typeof(supplementary_files)='array'),add column references_edited_at timestamptz;
update storage.buckets set allowed_mime_types=array['application/pdf','application/zip','application/x-zip-compressed','application/octet-stream','text/plain','text/csv','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg','image/webp','video/mp4'] where id='papers';
create function public.append_paper_supplement(paper_id uuid,object_name text,display_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare pa_owner_id uuid:=auth.uid();paper public.papers;object_metadata jsonb;entry jsonb;items jsonb;
begin
 if pa_owner_id is null then raise exception 'Authentication required';end if;
 select * into paper from public.papers p where p.id=paper_id and p.user_id=pa_owner_id and p.deleted_at is null for update;
 if not found then raise exception 'Paper unavailable';end if;
 if object_name !~ ('^'||pa_owner_id::text||'/sm-[0-9a-f-]{36}\.(pdf|zip|txt|csv|md|docx|xlsx|png|jpg|jpeg|webp|mp4)$') then raise exception 'Invalid supplement path';end if;
 select metadata into object_metadata from storage.objects where bucket_id='papers' and name=object_name and split_part(name,'/',1)=pa_owner_id::text;
 if not found then raise exception 'Supplement must be uploaded first';end if;
 if length(trim(display_name))<1 or length(display_name)>500 then raise exception 'Invalid supplement name';end if;
 if exists(select 1 from jsonb_array_elements(paper.supplementary_files) s where s->>'path'=object_name) then return jsonb_build_object('id',paper.id,'supplementary_files',paper.supplementary_files);end if;
 entry:=jsonb_build_object('path',object_name,'name',display_name,'size',coalesce((object_metadata->>'size')::bigint,0),'type',object_metadata->>'mimetype','created_at',now());
 items:=paper.supplementary_files||jsonb_build_array(entry);
 update public.papers set supplementary_files=items where id=paper.id and user_id=pa_owner_id;
 return jsonb_build_object('id',paper.id,'supplementary_files',items);
end;$$;
revoke all on function public.append_paper_supplement(uuid,text,text) from public,anon;
grant execute on function public.append_paper_supplement(uuid,text,text) to authenticated;
commit;
