-- DevSync v0.3.2 repair: robust meeting creation + session-safe policies.
-- Run this once in Supabase SQL Editor for an existing DevSync database.

create extension if not exists pgcrypto;

-- Required tables.
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Developer',
  created_at timestamptz not null default now()
);

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
  role text not null default 'member' check(role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key(meeting_id,user_id)
);

alter table public.profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_members enable row level security;

-- Rebuild the meeting policies without duplicate-policy errors.
drop policy if exists "meetings read members" on public.meetings;
drop policy if exists "meetings insert owner" on public.meetings;
drop policy if exists "meetings update owner" on public.meetings;
drop policy if exists "meetings delete owner" on public.meetings;

create policy "meetings read members" on public.meetings
for select to authenticated
using (
  exists(
    select 1 from public.meeting_members mm
    where mm.meeting_id = meetings.id
      and mm.user_id = (select auth.uid())
  )
);

create policy "meetings insert owner" on public.meetings
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "meetings update owner" on public.meetings
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "meetings delete owner" on public.meetings
for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "members read" on public.meeting_members;
drop policy if exists "members insert self" on public.meeting_members;
drop policy if exists "members delete self" on public.meeting_members;

create policy "members read" on public.meeting_members
for select to authenticated
using (
  exists(
    select 1 from public.meeting_members x
    where x.meeting_id = meeting_members.meeting_id
      and x.user_id = (select auth.uid())
  )
);

create policy "members insert self" on public.meeting_members
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "members delete self" on public.meeting_members
for delete to authenticated
using (user_id = (select auth.uid()));

-- Ensure the browser role can perform the table operations. RLS remains the gate.
grant select, insert, update, delete on public.meetings to authenticated;
grant select, insert, update, delete on public.meeting_members to authenticated;

-- Robust database RPC fallback. Keep the function out of client trust assumptions.
drop function if exists public.create_meeting(text);
create function public.create_meeting(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.meetings(name, owner_id)
  values (
    coalesce(nullif(trim(p_name), ''), 'Untitled Meeting'),
    (select auth.uid())
  )
  returning id into mid;

  insert into public.meeting_members(meeting_id, user_id, role)
  values(mid, (select auth.uid()), 'owner');

  return mid;
end;
$$;

revoke all on function public.create_meeting(text) from public;
grant execute on function public.create_meeting(text) to authenticated;

-- Invite joining fallback used by invite links.
drop function if exists public.join_meeting_by_invite(uuid);
create function public.join_meeting_by_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select id into mid
  from public.meetings
  where invite_token = p_token;

  if mid is null then
    raise exception 'Invalid invite';
  end if;

  insert into public.meeting_members(meeting_id, user_id, role)
  values(mid, (select auth.uid()), 'member')
  on conflict(meeting_id,user_id) do nothing;

  return mid;
end;
$$;

revoke all on function public.join_meeting_by_invite(uuid) from public;
grant execute on function public.join_meeting_by_invite(uuid) to authenticated;
