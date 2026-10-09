-- =====================================================================
-- DevSync — complete, idempotent database setup (v0.5: adds meeting capacity)
-- Run this ONCE in Supabase → SQL Editor. It is safe to re-run, and it
-- also repairs databases created with the older schema / repair scripts.
--
-- ROOT CAUSE of "won't create meetings": the old `meeting_members` read
-- policy queried `meeting_members` from inside its own policy, which
-- Postgres rejects with "infinite recursion detected in policy". Every
-- query that touched meetings/members then failed. All membership checks
-- now go through the SECURITY DEFINER helper `is_meeting_member()`.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- profiles -------------------------------------------------
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Developer',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1), 'Developer'))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who signed up before the trigger existed.
insert into public.profiles(id, name)
select u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1), 'Developer')
from auth.users u
on conflict (id) do nothing;

-- ---------- core tables ----------------------------------------------
create table if not exists public.meetings(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invite_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Maximum number of people (owner included) who may be in a meeting.
alter table public.meetings add column if not exists max_members int not null default 10;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'meetings_max_members_range') then
    alter table public.meetings add constraint meetings_max_members_range check (max_members between 2 and 50);
  end if;
end $$;

create table if not exists public.meeting_members(
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create table if not exists public.folders(
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.files(
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  language text not null default 'plaintext',
  content text not null default '',
  path text not null default '/',
  folder_id uuid references public.folders(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.files add column if not exists folder_id uuid references public.folders(id) on delete cascade;

create index if not exists files_meeting_folder_idx on public.files(meeting_id, folder_id, created_at);
create index if not exists folders_meeting_idx on public.folders(meeting_id, created_at);
create index if not exists members_user_idx on public.meeting_members(user_id);

-- ---------- membership helper (breaks the recursion) -----------------
create or replace function public.is_meeting_member(p_meeting uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.meeting_members mm
    where mm.meeting_id = p_meeting and mm.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_meeting_member(uuid) from public;
grant execute on function public.is_meeting_member(uuid) to authenticated;

-- ---------- RLS: drop every old policy on our tables, then recreate ---
alter table public.profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_members enable row level security;
alter table public.folders enable row level security;
alter table public.files enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','meetings','meeting_members','folders','files')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.meetings, public.meeting_members,
  public.folders, public.files to authenticated;

-- profiles
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- meetings
create policy "meetings read" on public.meetings for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_meeting_member(id));
create policy "meetings insert" on public.meetings for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "meetings update" on public.meetings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "meetings delete" on public.meetings for delete to authenticated
  using (owner_id = (select auth.uid()));

-- meeting_members (people join through join_meeting_by_invite(); the only
-- direct insert allowed is the owner adding themselves to their own meeting)
create policy "members read" on public.meeting_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_meeting_member(meeting_id));
create policy "members insert owner" on public.meeting_members for insert to authenticated
  with check (
    user_id = (select auth.uid()) and role = 'owner'
    and exists(select 1 from public.meetings m where m.id = meeting_id and m.owner_id = (select auth.uid()))
  );
create policy "members delete self" on public.meeting_members for delete to authenticated
  using (user_id = (select auth.uid()));

-- folders
create policy "folders read" on public.folders for select to authenticated
  using (public.is_meeting_member(meeting_id));
create policy "folders insert" on public.folders for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_meeting_member(meeting_id));
create policy "folders update" on public.folders for update to authenticated
  using (public.is_meeting_member(meeting_id)) with check (public.is_meeting_member(meeting_id));
create policy "folders delete" on public.folders for delete to authenticated
  using (public.is_meeting_member(meeting_id));

-- files
create policy "files read" on public.files for select to authenticated
  using (public.is_meeting_member(meeting_id));
create policy "files insert" on public.files for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_meeting_member(meeting_id));
create policy "files update" on public.files for update to authenticated
  using (public.is_meeting_member(meeting_id)) with check (public.is_meeting_member(meeting_id));
create policy "files delete" on public.files for delete to authenticated
  using (public.is_meeting_member(meeting_id));

-- ---------- RPCs ------------------------------------------------------
drop function if exists public.create_meeting(text);
drop function if exists public.create_meeting(text, int);
create function public.create_meeting(p_name text, p_max int default 10) returns uuid
language plpgsql security definer set search_path = '' as $$
declare mid uuid; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_max is null or p_max < 2 or p_max > 50 then raise exception 'Capacity must be between 2 and 50'; end if;
  insert into public.profiles(id, name) values (uid, 'Developer') on conflict (id) do nothing;
  insert into public.meetings(name, owner_id, max_members)
    values (coalesce(nullif(trim(p_name), ''), 'Untitled Meeting'), uid, p_max) returning id into mid;
  insert into public.meeting_members(meeting_id, user_id, role) values (mid, uid, 'owner');
  return mid;
end; $$;
revoke all on function public.create_meeting(text, int) from public;
grant execute on function public.create_meeting(text, int) to authenticated;

-- Capacity can't be lowered below the number of people already in the meeting.
create or replace function public.check_meeting_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.max_members < (select count(*) from public.meeting_members where meeting_id = new.id) then
    raise exception 'Capacity cannot be lower than the current number of members';
  end if;
  return new;
end; $$;
drop trigger if exists meetings_capacity on public.meetings;
create trigger meetings_capacity before update of max_members on public.meetings
  for each row execute function public.check_meeting_capacity();

drop function if exists public.join_meeting_by_invite(uuid);
create function public.join_meeting_by_invite(p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare mid uuid; cap int; taken int; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  -- lock the meeting row so two people can't take the last seat at the same time
  select id, max_members into mid, cap from public.meetings where invite_token = p_token for update;
  if mid is null then raise exception 'Invalid invite'; end if;
  if not exists (select 1 from public.meeting_members where meeting_id = mid and user_id = uid) then
    select count(*) into taken from public.meeting_members where meeting_id = mid;
    if taken >= cap then
      raise exception 'This meeting is full (% of % seats taken)', taken, cap;
    end if;
    insert into public.meeting_members(meeting_id, user_id, role) values (mid, uid, 'member')
      on conflict (meeting_id, user_id) do nothing;
  end if;
  return mid;
end; $$;
revoke all on function public.join_meeting_by_invite(uuid) from public;
grant execute on function public.join_meeting_by_invite(uuid) to authenticated;

-- ---------- Storage (private bucket for binary assets) ---------------
insert into storage.buckets(id, name, public) values ('project-assets','project-assets', false)
  on conflict (id) do nothing;

drop policy if exists "assets read members" on storage.objects;
drop policy if exists "assets insert members" on storage.objects;
drop policy if exists "assets update members" on storage.objects;
drop policy if exists "assets delete members" on storage.objects;

create policy "assets read members" on storage.objects for select to authenticated
  using (bucket_id = 'project-assets' and exists(
    select 1 from public.meeting_members mm
    where mm.meeting_id::text = split_part(name,'/',1) and mm.user_id = (select auth.uid())));
create policy "assets insert members" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-assets' and exists(
    select 1 from public.meeting_members mm
    where mm.meeting_id::text = split_part(name,'/',1) and mm.user_id = (select auth.uid())));
create policy "assets update members" on storage.objects for update to authenticated
  using (bucket_id = 'project-assets' and exists(
    select 1 from public.meeting_members mm
    where mm.meeting_id::text = split_part(name,'/',1) and mm.user_id = (select auth.uid())));
create policy "assets delete members" on storage.objects for delete to authenticated
  using (bucket_id = 'project-assets' and exists(
    select 1 from public.meeting_members mm
    where mm.meeting_id::text = split_part(name,'/',1) and mm.user_id = (select auth.uid())));

-- ---------- Realtime authorization (private channels) ----------------
-- Topics: meeting:<id> (chat/presence/file events), call:<id> (WebRTC
-- signaling), file:<id> (Yjs document updates).
create or replace function public.can_access_topic(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(p_topic, ':', 1) in ('meeting','call')
         and split_part(p_topic, ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_meeting_member(split_part(p_topic, ':', 2)::uuid)
    when split_part(p_topic, ':', 1) = 'file'
         and split_part(p_topic, ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists(
        select 1 from public.files f
        where f.id = split_part(p_topic, ':', 2)::uuid and public.is_meeting_member(f.meeting_id))
    else false
  end;
$$;
revoke all on function public.can_access_topic(text) from public;
grant execute on function public.can_access_topic(text) to authenticated;

drop policy if exists "devsync realtime read" on realtime.messages;
drop policy if exists "devsync realtime write" on realtime.messages;
drop policy if exists "devsync realtime read v2" on realtime.messages;
drop policy if exists "devsync realtime write v2" on realtime.messages;
drop policy if exists "devsync realtime read v3" on realtime.messages;
drop policy if exists "devsync realtime write v3" on realtime.messages;

create policy "devsync realtime read v3" on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('broadcast','presence') and public.can_access_topic((select realtime.topic())));
create policy "devsync realtime write v3" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension in ('broadcast','presence') and public.can_access_topic((select realtime.topic())));

-- Ask PostgREST to reload its schema cache so the new functions are visible.
notify pgrst, 'reload schema';
