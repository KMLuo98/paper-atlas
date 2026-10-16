begin;
alter table public.profiles add column display_name text not null default '' check(length(display_name)<=60);
alter table public.profiles add column avatar_path text check(avatar_path is null or split_part(avatar_path,'/',1)=id::text);
grant update(display_name,avatar_path) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid())=id) with check ((select auth.uid())=id);

alter table public.papers add column keyword_pairs jsonb not null default '[]'::jsonb
  check(jsonb_typeof(keyword_pairs)='array' and jsonb_array_length(keyword_pairs)<=10);
alter table public.papers add column publication_status text not null default 'unknown'
  check(publication_status in ('published','unpublished','unknown'));
update public.papers set publication_status='published' where published_at is not null and journal<>'';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy avatars_read_own on storage.objects for select to authenticated
  using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatars_upload_own on storage.objects for insert to authenticated
  with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
