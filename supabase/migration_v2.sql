-- DevSync v0.3 migration: folders, realtime call-channel auth, safer project structure.

create table if not exists public.folders(
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.folders enable row level security;

drop policy if exists "folders read members" on public.folders;
create policy "folders read members" on public.folders for select to authenticated
using (exists(select 1 from public.meeting_members mm where mm.meeting_id=folders.meeting_id and mm.user_id=auth.uid()));

drop policy if exists "folders insert members" on public.folders;
create policy "folders insert members" on public.folders for insert to authenticated
with check (created_by=auth.uid() and exists(select 1 from public.meeting_members mm where mm.meeting_id=folders.meeting_id and mm.user_id=auth.uid()));

drop policy if exists "folders update members" on public.folders;
create policy "folders update members" on public.folders for update to authenticated
using (exists(select 1 from public.meeting_members mm where mm.meeting_id=folders.meeting_id and mm.user_id=auth.uid()))
with check (exists(select 1 from public.meeting_members mm where mm.meeting_id=folders.meeting_id and mm.user_id=auth.uid()));

drop policy if exists "folders delete members" on public.folders;
create policy "folders delete members" on public.folders for delete to authenticated
using (exists(select 1 from public.meeting_members mm where mm.meeting_id=folders.meeting_id and mm.user_id=auth.uid()));

alter table public.files add column if not exists folder_id uuid references public.folders(id) on delete set null;
create index if not exists files_meeting_folder_idx on public.files(meeting_id,folder_id,created_at);
create index if not exists folders_meeting_idx on public.folders(meeting_id,created_at);

-- Realtime: allow meeting collaboration and WebRTC signaling topics.
drop policy if exists "devsync realtime read" on realtime.messages;
drop policy if exists "devsync realtime write" on realtime.messages;

drop policy if exists "devsync realtime read v2" on realtime.messages;
create policy "devsync realtime read v2" on realtime.messages for select to authenticated
using(
  realtime.messages.extension in ('broadcast','presence') and (
    exists(select 1 from public.meeting_members mm where realtime.topic() in ('meeting:'||mm.meeting_id::text,'call:'||mm.meeting_id::text) and mm.user_id=auth.uid())
    or exists(select 1 from public.files f where realtime.topic()='file:'||f.id::text and exists(select 1 from public.meeting_members mm where mm.meeting_id=f.meeting_id and mm.user_id=auth.uid()))
  )
);

drop policy if exists "devsync realtime write v2" on realtime.messages;
create policy "devsync realtime write v2" on realtime.messages for insert to authenticated
with check(
  realtime.messages.extension in ('broadcast','presence') and (
    exists(select 1 from public.meeting_members mm where realtime.topic() in ('meeting:'||mm.meeting_id::text,'call:'||mm.meeting_id::text) and mm.user_id=auth.uid())
    or exists(select 1 from public.files f where realtime.topic()='file:'||f.id::text and exists(select 1 from public.meeting_members mm where mm.meeting_id=f.meeting_id and mm.user_id=auth.uid()))
  )
);
