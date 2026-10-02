-- DevSync meeting repair / compatibility patch
-- Run this once in Supabase SQL Editor if meeting creation was failing.

create extension if not exists pgcrypto;

create table if not exists public.meetings(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invite_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_members(
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key(meeting_id,user_id)
);

alter table public.meetings enable row level security;
alter table public.meeting_members enable row level security;

drop policy if exists "meetings_read_members" on public.meetings;
drop policy if exists "meetings_select_members" on public.meetings;
drop policy if exists "meetings_insert_self" on public.meetings;
drop policy if exists "meetings_insert_owner" on public.meetings;
drop policy if exists "meetings_update_owner" on public.meetings;
drop policy if exists "meetings_delete_owner" on public.meetings;

create policy "devsync_meetings_read_member"
on public.meetings for select
to authenticated
using (
  owner_id = auth.uid()
  or exists(
    select 1 from public.meeting_members mm
    where mm.meeting_id = meetings.id
      and mm.user_id = auth.uid()
  )
);

create policy "devsync_meetings_insert_owner"
on public.meetings for insert
to authenticated
with check (owner_id = auth.uid());

create policy "devsync_meetings_update_owner"
on public.meetings for update
to authenticated
using(owner_id = auth.uid())
with check(owner_id = auth.uid());

create policy "devsync_meetings_delete_owner"
on public.meetings for delete
to authenticated
using(owner_id = auth.uid());

drop policy if exists "members_read_members" on public.meeting_members;
drop policy if exists "meeting_members_select_members" on public.meeting_members;
drop policy if exists "members_insert_self" on public.meeting_members;
drop policy if exists "meeting_members_insert_self" on public.meeting_members;
drop policy if exists "members_delete_self" on public.meeting_members;
drop policy if exists "meeting_members_delete_self" on public.meeting_members;

create policy "devsync_members_read_member"
on public.meeting_members for select
to authenticated
using(
  user_id = auth.uid()
  or exists(
    select 1 from public.meeting_members me
    where me.meeting_id = meeting_members.meeting_id
      and me.user_id = auth.uid()
  )
);

create policy "devsync_members_insert_self"
on public.meeting_members for insert
to authenticated
with check(user_id = auth.uid());

create policy "devsync_members_delete_self"
on public.meeting_members for delete
to authenticated
using(user_id = auth.uid());

create or replace function public.create_meeting(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  mid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.meetings(name,owner_id)
  values(coalesce(nullif(trim(p_name),''),'Untitled Meeting'),auth.uid())
  returning id into mid;

  insert into public.meeting_members(meeting_id,user_id,role)
  values(mid,auth.uid(),'owner')
  on conflict (meeting_id,user_id) do nothing;

  return mid;
end;
$$;

grant execute on function public.create_meeting(text) to authenticated;
