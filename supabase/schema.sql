create extension if not exists pgcrypto;

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Developer',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles insert self" on public.profiles for insert to authenticated with check(id=auth.uid());
create policy "profiles update self" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1),'Developer')) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

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
  role text not null default 'member' check(role in('owner','member')),
  joined_at timestamptz not null default now(),
  primary key(meeting_id,user_id)
);
alter table public.meetings enable row level security;
alter table public.meeting_members enable row level security;
create policy "meetings read members" on public.meetings for select to authenticated using(exists(select 1 from public.meeting_members mm where mm.meeting_id=meetings.id and mm.user_id=auth.uid()));
create policy "meetings insert owner" on public.meetings for insert to authenticated with check(owner_id=auth.uid());
create policy "meetings update owner" on public.meetings for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy "meetings delete owner" on public.meetings for delete to authenticated using(owner_id=auth.uid());
create policy "members read" on public.meeting_members for select to authenticated using(exists(select 1 from public.meeting_members x where x.meeting_id=meeting_members.meeting_id and x.user_id=auth.uid()));
create policy "members insert self" on public.meeting_members for insert to authenticated with check(user_id=auth.uid());
create policy "members delete self" on public.meeting_members for delete to authenticated using(user_id=auth.uid());

create or replace function public.create_meeting(p_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid; begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 insert into public.meetings(name,owner_id) values(coalesce(nullif(trim(p_name),''),'Untitled Meeting'),auth.uid()) returning id into mid;
 insert into public.meeting_members(meeting_id,user_id,role) values(mid,auth.uid(),'owner');
 return mid;
end; $$;
grant execute on function public.create_meeting(text) to authenticated;

create or replace function public.join_meeting_by_invite(p_token uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid; begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select id into mid from public.meetings where invite_token=p_token;
 if mid is null then raise exception 'invalid invite'; end if;
 insert into public.meeting_members(meeting_id,user_id,role) values(mid,auth.uid(),'member') on conflict do nothing;
 return mid;
end; $$;
grant execute on function public.join_meeting_by_invite(uuid) to authenticated;

create table if not exists public.files(
 id uuid primary key default gen_random_uuid(), meeting_id uuid not null references public.meetings(id) on delete cascade,
 name text not null, language text not null default 'plaintext', content text not null default '', path text not null default '/',
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.files enable row level security;
create policy "files read members" on public.files for select to authenticated using(exists(select 1 from public.meeting_members mm where mm.meeting_id=files.meeting_id and mm.user_id=auth.uid()));
create policy "files insert members" on public.files for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.meeting_members mm where mm.meeting_id=files.meeting_id and mm.user_id=auth.uid()));
create policy "files update members" on public.files for update to authenticated using(exists(select 1 from public.meeting_members mm where mm.meeting_id=files.meeting_id and mm.user_id=auth.uid())) with check(exists(select 1 from public.meeting_members mm where mm.meeting_id=files.meeting_id and mm.user_id=auth.uid()));
create policy "files delete members" on public.files for delete to authenticated using(exists(select 1 from public.meeting_members mm where mm.meeting_id=files.meeting_id and mm.user_id=auth.uid()));

insert into storage.buckets(id,name,public) values('project-assets','project-assets',false) on conflict(id) do nothing;
create policy "assets read members" on storage.objects for select to authenticated using(bucket_id='project-assets' and exists(select 1 from public.meeting_members mm where mm.meeting_id::text=split_part(name,'/',1) and mm.user_id=auth.uid()));
create policy "assets insert members" on storage.objects for insert to authenticated with check(bucket_id='project-assets' and exists(select 1 from public.meeting_members mm where mm.meeting_id::text=split_part(name,'/',1) and mm.user_id=auth.uid()));
create policy "assets update members" on storage.objects for update to authenticated using(bucket_id='project-assets' and exists(select 1 from public.meeting_members mm where mm.meeting_id::text=split_part(name,'/',1) and mm.user_id=auth.uid())) with check(bucket_id='project-assets' and exists(select 1 from public.meeting_members mm where mm.meeting_id::text=split_part(name,'/',1) and mm.user_id=auth.uid()));
create policy "assets delete members" on storage.objects for delete to authenticated using(bucket_id='project-assets' and exists(select 1 from public.meeting_members mm where mm.meeting_id::text=split_part(name,'/',1) and mm.user_id=auth.uid()));

-- Realtime Authorization. In Supabase Realtime settings, disable public channel access so these private policies are enforced.
create policy "devsync realtime read" on realtime.messages for select to authenticated using(
  realtime.messages.extension in ('broadcast','presence') and (
    exists(select 1 from public.meeting_members mm where realtime.topic()='meeting:'||mm.meeting_id::text and mm.user_id=auth.uid())
    or exists(select 1 from public.files f join public.meeting_members mm on mm.meeting_id=f.meeting_id where realtime.topic()='file:'||f.id::text and mm.user_id=auth.uid())
  )
);
create policy "devsync realtime write" on realtime.messages for insert to authenticated with check(
  realtime.messages.extension in ('broadcast','presence') and (
    exists(select 1 from public.meeting_members mm where realtime.topic()='meeting:'||mm.meeting_id::text and mm.user_id=auth.uid())
    or exists(select 1 from public.files f join public.meeting_members mm on mm.meeting_id=f.meeting_id where realtime.topic()='file:'||f.id::text and mm.user_id=auth.uid())
  )
);
