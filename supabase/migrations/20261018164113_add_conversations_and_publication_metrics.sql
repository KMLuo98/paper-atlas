alter table public.papers
 add column citation_count integer check (citation_count >= 0),
 add column citation_source text,
 add column citation_url text,
 add column citation_checked_at timestamptz,
 add column arxiv_id text,
 add column arxiv_date date,
 add column preprint_url text,
 add column publication_lookup_at timestamptz,
 add column publication_lookup_status text;

create table public.conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default '新对话' check (length(title) between 1 and 120),
 use_library boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 inflight_until timestamptz,
 unique(id,user_id)
);
create index conversations_owner_updated on public.conversations(user_id,updated_at desc);
alter table public.conversations enable row level security;
revoke all on public.conversations from anon,authenticated;
grant select,insert,delete on public.conversations to authenticated;
grant update(title,use_library,updated_at) on public.conversations to authenticated;
grant all on public.conversations to service_role;
create policy conversations_owner_select on public.conversations for select to authenticated using ((select auth.uid())=user_id);
create policy conversations_owner_insert on public.conversations for insert to authenticated with check ((select auth.uid())=user_id);
create policy conversations_owner_update on public.conversations for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy conversations_owner_delete on public.conversations for delete to authenticated using ((select auth.uid())=user_id);

create table public.chat_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 conversation_id uuid not null,
 role text not null check (role in ('user','assistant')),
 content text not null check (length(content)<=60000),
 attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments)='array'),
 request_id uuid,
 created_at timestamptz not null default now(),
 foreign key(conversation_id,user_id) references public.conversations(id,user_id) on delete cascade,
 unique(conversation_id,request_id,role)
);
create index chat_messages_owner_conversation on public.chat_messages(user_id,conversation_id,created_at);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon,authenticated;
grant select,delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
create policy messages_owner_select on public.chat_messages for select to authenticated using ((select auth.uid())=user_id);
create policy messages_owner_delete on public.chat_messages for delete to authenticated using ((select auth.uid())=user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('chat-files','chat-files',false,31457280,array['application/pdf','text/plain','text/markdown','text/csv','application/json','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp']);
create policy chat_files_owner_select on storage.objects for select to authenticated using (bucket_id='chat-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy chat_files_owner_insert on storage.objects for insert to authenticated with check (bucket_id='chat-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy chat_files_owner_delete on storage.objects for delete to authenticated using (bucket_id='chat-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
