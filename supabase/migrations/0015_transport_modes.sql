-- Flights become any way of getting from A to B: trains, buses, ferries, rental cars,
-- rideshares, driving. The table keeps its name; `mode` says what kind of trip it is.
-- Airports have their own lookup; other places store a pin so they show on the map.
alter table public.flights
  add column if not exists mode text not null default 'flight'
    check (mode in ('flight', 'train', 'bus', 'ferry', 'rental', 'rideshare', 'drive', 'other')),
  add column if not exists from_lat double precision,
  add column if not exists from_lng double precision,
  add column if not exists to_lat double precision,
  add column if not exists to_lng double precision;

-- The public share page labels each trip by how you're getting there.
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
    'flights', coalesce((select jsonb_agg(jsonb_build_object('mode', f.mode, 'airline', f.airline, 'flight_number', f.flight_number,
                  'from_code', f.from_code, 'from_name', f.from_name, 'to_code', f.to_code, 'to_name', f.to_name,
                  'depart_local', f.depart_local, 'arrive_local', f.arrive_local) order by f.depart_local)
                  from public.flights f where f.trip_id = t.id and f.status = 'booked'), '[]'::jsonb)
  ) end
  from public.trips t
  where t.share_token = p_token and p_token is not null and length(p_token) >= 20;
$$;
