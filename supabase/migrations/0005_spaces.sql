-- Spaces: a "trip" is now one kind of space. The table keeps its name (trips)
-- so nothing existing breaks; the app calls them spaces.
--
-- kind:    trip | wedding | podcast | household | event | blank (templates live in the app)
-- icon:    emoji shown on cards and in the nav
-- modules: [{ "id": "budget", "label": "Bills & spending" }, ...] in nav order.
--          Empty = use the template's defaults for this kind.

alter table public.trips
  add column kind text not null default 'trip' check (char_length(kind) between 1 and 40),
  add column icon text not null default '' check (char_length(icon) <= 16),
  add column modules jsonb not null default '[]'::jsonb check (jsonb_typeof(modules) = 'array');

create or replace function public.create_space(
  p_name text,
  p_kind text default 'trip',
  p_icon text default '',
  p_modules jsonb default '[]'::jsonb,
  p_destination text default '',
  p_start date default null,
  p_end date default null,
  p_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  insert into public.trips (name, kind, icon, modules, destination, start_date, end_date, currency, created_by)
  values (
    p_name,
    coalesce(nullif(p_kind, ''), 'trip'),
    coalesce(p_icon, ''),
    coalesce(p_modules, '[]'::jsonb),
    coalesce(p_destination, ''),
    p_start,
    p_end,
    coalesce(nullif(p_currency, ''), 'USD'),
    me
  )
  returning id into new_id;
  insert into public.trip_members (trip_id, user_id, role, attendance, color)
  values (new_id, me, 'owner', 'going', '#E07A5F');
  return new_id;
end;
$$;

revoke execute on function public.create_space(text, text, text, jsonb, text, date, date, text) from public, anon;
grant execute on function public.create_space(text, text, text, jsonb, text, date, date, text) to authenticated;

-- The public share page shows the space's kind and icon too.
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
                  from public.itinerary_items i where i.trip_id = t.id and i.day is not null), '[]'::jsonb),
    'stays', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'kind', s.kind, 'address', s.address,
                  'check_in', s.check_in, 'check_out', s.check_out) order by s.check_in)
                  from public.stays s where s.trip_id = t.id and s.status = 'booked'), '[]'::jsonb),
    'flights', coalesce((select jsonb_agg(jsonb_build_object('airline', f.airline, 'flight_number', f.flight_number,
                  'from_code', f.from_code, 'to_code', f.to_code, 'depart_local', f.depart_local, 'arrive_local', f.arrive_local) order by f.depart_local)
                  from public.flights f where f.trip_id = t.id and f.status = 'booked'), '[]'::jsonb)
  ) end
  from public.trips t
  where t.share_token = p_token and p_token is not null and length(p_token) >= 20;
$$;
