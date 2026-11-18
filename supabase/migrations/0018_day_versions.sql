-- Versions of a day: when the group can't agree, a day can have competing versions
-- ("A: As planned" vs "B: City day"). The first version holds the day's pencilled-in plans
-- that aren't in any version (so anyone can start a version without moving other people's
-- plans); every other version holds its own. Locked-in plans are shared by all versions.
-- Everyone votes for one version per day. Locking in keeps the winner and sends the other
-- versions' plans back to Ideas.

create table if not exists public.day_versions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day date not null,
  name text not null default '' check (char_length(name) <= 60),
  sort_order double precision not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists day_versions_trip_day_idx on public.day_versions (trip_id, day);

alter table public.itinerary_items
  add column if not exists version_id uuid references public.day_versions (id) on delete set null;
create index if not exists itinerary_version_idx on public.itinerary_items (version_id) where version_id is not null;

-- One vote per person per day: voting for another version moves your vote.
create table if not exists public.day_version_votes (
  trip_id uuid not null references public.trips (id) on delete cascade,
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  version_id uuid not null references public.day_versions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, day, user_id)
);

alter table public.day_versions enable row level security;
alter table public.day_version_votes enable row level security;
grant select, insert, update, delete on public.day_versions, public.day_version_votes to authenticated;

-- Anyone in the space can suggest a version; its creator or an editor can rename or remove it.
create policy "day versions: members read" on public.day_versions
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "day versions: members suggest" on public.day_versions
  for insert to authenticated with check (created_by = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "day versions: creator or editors change" on public.day_versions
  for update to authenticated
  using (public.can_edit_trip(trip_id) or (created_by = (select auth.uid()) and public.is_trip_member(trip_id)))
  with check (public.can_edit_trip(trip_id) or (created_by = (select auth.uid()) and public.is_trip_member(trip_id)));
create policy "day versions: creator or editors delete" on public.day_versions
  for delete to authenticated
  using (public.can_edit_trip(trip_id) or (created_by = (select auth.uid()) and public.is_trip_member(trip_id)));

create policy "version votes: members read" on public.day_version_votes
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "version votes: own insert" on public.day_version_votes
  for insert to authenticated with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id)
    and exists (select 1 from public.day_versions v where v.id = version_id and v.trip_id = day_version_votes.trip_id and v.day = day_version_votes.day));
create policy "version votes: own update" on public.day_version_votes
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id)
    and exists (select 1 from public.day_versions v where v.id = version_id and v.trip_id = day_version_votes.trip_id and v.day = day_version_votes.day));
create policy "version votes: own delete" on public.day_version_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Keep the winning version: its plans are locked in, the other versions' plans go back to Ideas
-- (a plan that came from an idea reopens it, keeping its votes and comments; any other becomes
-- a new idea), and the day's versions are cleared. Shared plans (no version) are locked in too.
create or replace function public.lock_day_version_internal(p_version uuid, p_auto boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.day_versions%rowtype;
  first_id uuid;
  moved integer := 0;
  r record;
begin
  select * into v from public.day_versions where id = p_version;
  if not found then
    raise exception 'That version no longer exists';
  end if;
  if not p_auto and not public.can_edit_trip(v.trip_id) then
    raise exception 'Only organizers can lock in a day';
  end if;
  select id into first_id from public.day_versions
    where trip_id = v.trip_id and day = v.day order by sort_order, created_at limit 1;

  -- Losing plans: other versions' own plans, plus the day's unversioned drafts when the
  -- first version ("as planned") didn't win.
  for r in
    select i.* from public.itinerary_items i
    where i.trip_id = v.trip_id and i.day = v.day and i.draft
      and (
        (i.version_id is not null and i.version_id <> v.id
          and exists (select 1 from public.day_versions o where o.id = i.version_id and o.trip_id = v.trip_id and o.day = v.day))
        or (i.version_id is null and v.id <> first_id)
      )
  loop
    if r.idea_id is not null and exists (select 1 from public.ideas where id = r.idea_id) then
      update public.ideas set status = 'open' where id = r.idea_id;
    else
      insert into public.ideas (trip_id, title, description, category, location, url, est_cost,
                                cost_unit, cost_unit_size, cost_qty, cost_unit_label, status, created_by)
      values (r.trip_id, r.title, r.notes, r.category, r.location, r.url, r.cost,
              r.cost_unit, r.cost_unit_size, r.cost_qty, r.cost_unit_label, 'open', r.created_by);
    end if;
    delete from public.itinerary_items where id = r.id;
    moved := moved + 1;
  end loop;

  if p_auto then
    perform set_config('driftbook.auto_lock', 'on', true);
  end if;
  update public.itinerary_items
    set draft = false, version_id = null, locked_by = case when p_auto then null else auth.uid() end
    where trip_id = v.trip_id and day = v.day and (version_id = v.id or (version_id is null and draft and v.id = first_id));
  if p_auto then
    perform set_config('driftbook.auto_lock', 'off', true);
  end if;

  delete from public.day_versions where trip_id = v.trip_id and day = v.day;
  return moved;
end;
$$;
-- Only the vote trigger may skip the organizer check (p_auto); people call lock_day_version.
revoke execute on function public.lock_day_version_internal(uuid, boolean) from public, anon, authenticated;

create or replace function public.lock_day_version(p_version uuid)
returns integer
language sql
security definer
set search_path = ''
as $$ select public.lock_day_version_internal(p_version, false); $$;
revoke execute on function public.lock_day_version(uuid) from public, anon;
grant execute on function public.lock_day_version(uuid) to authenticated;

-- A version wins on its own once most people going vote for it (needs at least two going).
create or replace function public.day_version_votes_auto_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  going int;
  votes int;
begin
  select count(*) into going from public.trip_members where trip_id = new.trip_id and attendance = 'going';
  select count(*) into votes from public.day_version_votes dv
    join public.trip_members m on m.trip_id = dv.trip_id and m.user_id = dv.user_id and m.attendance = 'going'
    where dv.version_id = new.version_id;
  if going >= 2 and votes * 2 > going then
    perform public.lock_day_version_internal(new.version_id, true);
  end if;
  return null;
end;
$$;
revoke execute on function public.day_version_votes_auto_lock() from public, anon, authenticated;
drop trigger if exists day_version_votes_auto_lock on public.day_version_votes;
create trigger day_version_votes_auto_lock after insert or update on public.day_version_votes
  for each row execute function public.day_version_votes_auto_lock();

-- Plans on a day with versions are decided with their version, not one by one.
create or replace function public.plan_votes_auto_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid := coalesce(new.item_id, old.item_id);
  v_trip uuid := coalesce(new.trip_id, old.trip_id);
  going int;
  likes int;
begin
  -- On a day with versions, plans are decided with their version.
  if exists (
    select 1 from public.itinerary_items i
    where i.id = v_item and (i.version_id is not null
      or exists (select 1 from public.day_versions d where d.trip_id = i.trip_id and d.day = i.day))
  ) then
    return null;
  end if;
  select count(*) into going from public.trip_members where trip_id = v_trip and attendance = 'going';
  select count(*) into likes from public.plan_votes v
    join public.trip_members m on m.trip_id = v.trip_id and m.user_id = v.user_id and m.attendance = 'going'
    where v.item_id = v_item and v.value = 1;
  if going >= 2 and likes * 2 > going then
    perform set_config('driftbook.auto_lock', 'on', true);
    update public.itinerary_items set draft = false, locked_by = null where id = v_item and draft;
    perform set_config('driftbook.auto_lock', 'off', true);
  end if;
  return null;
end;
$$;

alter publication supabase_realtime add table public.day_versions, public.day_version_votes;
