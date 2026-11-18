-- Tentative itinerary: plans can be pencilled in, voted on, moved around and commented on
-- until they're locked in. Drafts stay off Today, reminders and the public share page.

alter table public.itinerary_items
  add column if not exists draft boolean not null default false,
  -- Recent moves while pencilled in: [{ at, by, from_day, to_day, from_time, to_time }], newest last.
  add column if not exists history jsonb not null default '[]'::jsonb,
  add column if not exists locked_at timestamptz,
  -- Who locked it in; null with locked_at set means the group's votes did.
  add column if not exists locked_by uuid references auth.users (id) on delete set null;
create index if not exists itinerary_drafts_idx on public.itinerary_items (trip_id) where draft;

-- 👍 / 👎 on plans (everyone in the space can vote, viewers included).
create table if not exists public.plan_votes (
  item_id uuid not null references public.itinerary_items (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
create index if not exists plan_votes_trip_idx on public.plan_votes (trip_id);
alter table public.plan_votes enable row level security;
grant select, insert, update, delete on public.plan_votes to authenticated;

create policy "plan votes: members read" on public.plan_votes
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "plan votes: own insert" on public.plan_votes
  for insert to authenticated with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id)
    and exists (select 1 from public.itinerary_items i where i.id = item_id and i.trip_id = plan_votes.trip_id));
create policy "plan votes: own update" on public.plan_votes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "plan votes: own delete" on public.plan_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Viewers can suggest: pencil plans in, and move or delete the ones they pencilled in.
-- (Editors keep their existing full access; these policies add to it.)
create policy "itinerary_items: members pencil in" on public.itinerary_items
  for insert to authenticated
  with check (draft and created_by = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "itinerary_items: members move own drafts" on public.itinerary_items
  for update to authenticated
  using (draft and created_by = (select auth.uid()) and public.is_trip_member(trip_id))
  with check (draft and created_by = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "itinerary_items: members delete own drafts" on public.itinerary_items
  for delete to authenticated
  using (draft and created_by = (select auth.uid()) and public.is_trip_member(trip_id));

-- Remember moves of pencilled-in plans (last 20), and stamp locking in.
create or replace function public.itinerary_draft_track()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.draft and (new.day is distinct from old.day or new.start_time is distinct from old.start_time) then
    new.history := (
      select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) from (
        select e, ord from jsonb_array_elements(
          coalesce(old.history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'at', now(), 'by', auth.uid(),
            'from_day', old.day, 'to_day', new.day,
            'from_time', old.start_time, 'to_time', new.start_time))
        ) with ordinality as x(e, ord)
        order by ord desc limit 20
      ) last20
    );
  end if;
  if old.draft and not new.draft then
    new.locked_at := now();
    -- Auto-locking (by votes) clears locked_by itself; a person locking in is recorded.
    if new.locked_by is null and auth.uid() is not null and current_setting('driftbook.auto_lock', true) is distinct from 'on' then
      new.locked_by := auth.uid();
    end if;
  elsif new.draft and not old.draft then
    new.locked_at := null;
    new.locked_by := null;
  end if;
  return new;
end;
$$;
drop trigger if exists itinerary_draft_track on public.itinerary_items;
create trigger itinerary_draft_track before update on public.itinerary_items
  for each row execute function public.itinerary_draft_track();

-- Lock a pencilled-in plan once most of the people going like it (needs at least two people going).
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
revoke execute on function public.plan_votes_auto_lock() from public, anon, authenticated;
drop trigger if exists plan_votes_auto_lock on public.plan_votes;
create trigger plan_votes_auto_lock after insert or update on public.plan_votes
  for each row execute function public.plan_votes_auto_lock();

alter publication supabase_realtime add table public.plan_votes;

-- The public share page only shows plans that are locked in.
create or replace function public.get_shared_trip(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when t.id is null then null else jsonb_build_object(
    'trip', jsonb_build_object('name', t.name, 'destination', t.destination, 'description', t.description,
                               'start_date', t.start_date, 'end_date', t.end_date, 'cover_image', t.cover_image,
                               'kind', t.kind, 'icon', t.icon),
    'travelers', coalesce((select jsonb_agg(jsonb_build_object('name', p.display_name, 'color', m.color) order by m.joined_at)
                  from public.trip_members m join public.profiles p on p.id = m.user_id
                  where m.trip_id = t.id and m.attendance <> 'not_going'), '[]'::jsonb),
    'itinerary', coalesce((select jsonb_agg(jsonb_build_object('day', i.day, 'start_time', i.start_time, 'end_time', i.end_time,
                  'title', i.title, 'category', i.category, 'location', i.location) order by i.day, i.start_time nulls last, i.sort_order)
                  from public.itinerary_items i where i.trip_id = t.id and i.day is not null and not i.draft), '[]'::jsonb),
    'stays', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'kind', s.kind, 'address', s.address,
                  'check_in', s.check_in, 'check_out', s.check_out) order by s.check_in)
                  from public.stays s where s.trip_id = t.id and s.status = 'booked'), '[]'::jsonb),
    'flights', coalesce((select jsonb_agg(jsonb_build_object('mode', f.mode, 'airline', f.airline, 'flight_number', f.flight_number,
                  'from_code', f.from_code, 'from_name', f.from_name, 'to_code', f.to_code, 'to_name', f.to_name,
                  'depart_local', f.depart_local, 'arrive_local', f.arrive_local,
                  'stops', coalesce((select jsonb_agg(jsonb_build_object('name', s->>'name', 'code', s->>'code')) from jsonb_array_elements(f.stops) s), '[]'::jsonb)) order by f.depart_local)
                  from public.flights f where f.trip_id = t.id and f.status = 'booked'), '[]'::jsonb)
  ) end
  from public.trips t
  where t.share_token = p_token and p_token is not null and length(p_token) >= 20;
$$;
