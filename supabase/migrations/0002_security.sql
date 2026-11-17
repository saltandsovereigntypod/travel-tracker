-- Driftbook access rules.
-- Viewers can read. Editors and owners can change shared trip information.
-- Personal views, private notes, personal packing lists and uploads stay private.

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.flights enable row level security;
alter table public.stays enable row level security;
alter table public.expenses enable row level security;
alter table public.packing_items enable row level security;
alter table public.notes enable row level security;
alter table public.photos enable row level security;
alter table public.comments enable row level security;
alter table public.trip_views enable row level security;
alter table public.templates enable row level security;
alter table public.user_assets enable row level security;

-- Tables are not exposed automatically in this project, so grant explicitly.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles, public.trips, public.trip_members, public.trip_invites,
  public.ideas, public.idea_votes, public.itinerary_items, public.flights, public.stays,
  public.expenses, public.packing_items, public.notes, public.photos, public.comments,
  public.trip_views, public.templates, public.user_assets
to authenticated;

-- Profiles -----------------------------------------------------------------
create policy "profiles: read self and travel companions" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_trip_with(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Trips --------------------------------------------------------------------
create policy "trips: members read" on public.trips
  for select to authenticated using (public.is_trip_member(id));
create policy "trips: editors update" on public.trips
  for update to authenticated using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));
create policy "trips: owners delete" on public.trips
  for delete to authenticated using (public.is_trip_owner(id));
-- Trips are created through create_trip() so the creator becomes owner atomically.

-- Members ------------------------------------------------------------------
create policy "members: members read" on public.trip_members
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "members: owners manage, self updates attendance/color" on public.trip_members
  for update to authenticated
  using (public.is_trip_owner(trip_id) or user_id = (select auth.uid()))
  with check (public.is_trip_owner(trip_id) or user_id = (select auth.uid()));
create policy "members: owners remove, anyone leaves" on public.trip_members
  for delete to authenticated
  using (public.is_trip_owner(trip_id) or user_id = (select auth.uid()));

-- Non-owners may only change their own attendance and color, never their role.
create or replace function public.guard_member_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_trip_owner(old.trip_id) then
    raise exception 'Only the trip owner can change roles';
  end if;
  if new.trip_id <> old.trip_id or new.user_id <> old.user_id then
    raise exception 'Membership identity cannot change';
  end if;
  return new;
end;
$$;
create trigger trip_members_guard_role before update on public.trip_members
  for each row execute function public.guard_member_role();

-- Invites ------------------------------------------------------------------
create policy "invites: editors read" on public.trip_invites
  for select to authenticated using (public.can_edit_trip(trip_id));
create policy "invites: editors create" on public.trip_invites
  for insert to authenticated with check (public.can_edit_trip(trip_id) and created_by = (select auth.uid()));
create policy "invites: editors revoke" on public.trip_invites
  for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "invites: editors delete" on public.trip_invites
  for delete to authenticated using (public.can_edit_trip(trip_id));

-- Standard shared tables: members read, editors write ------------------------
do $$
declare t text;
begin
  foreach t in array array['ideas', 'itinerary_items', 'flights', 'stays', 'expenses', 'photos'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t || ': members read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_trip(trip_id))', t || ': editors insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id))', t || ': editors update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_edit_trip(trip_id))', t || ': editors delete', t);
  end loop;
end $$;

-- Votes: members read; each person manages their own vote (viewers can vote too).
create policy "votes: members read" on public.idea_votes
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "votes: own insert" on public.idea_votes
  for insert to authenticated with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "votes: own update" on public.idea_votes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "votes: own delete" on public.idea_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Comments: any member (viewers included) can comment; authors edit/delete their own.
create policy "comments: members read" on public.comments
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "comments: members write own" on public.comments
  for insert to authenticated with check (created_by = (select auth.uid()) and public.is_trip_member(trip_id));
create policy "comments: authors delete" on public.comments
  for delete to authenticated using (created_by = (select auth.uid()) or public.is_trip_owner(trip_id));

-- Packing: shared list (owner_id null) acts like a shared table; personal lists are private.
create policy "packing: read shared or own" on public.packing_items
  for select to authenticated
  using (public.is_trip_member(trip_id) and (owner_id is null or owner_id = (select auth.uid())));
create policy "packing: insert shared (editors) or own" on public.packing_items
  for insert to authenticated
  with check (
    (owner_id is null and public.can_edit_trip(trip_id))
    or (owner_id = (select auth.uid()) and public.is_trip_member(trip_id))
  );
create policy "packing: update shared (editors) or own" on public.packing_items
  for update to authenticated
  using ((owner_id is null and public.can_edit_trip(trip_id)) or owner_id = (select auth.uid()))
  with check ((owner_id is null and public.can_edit_trip(trip_id)) or (owner_id = (select auth.uid()) and public.is_trip_member(trip_id)));
create policy "packing: delete shared (editors) or own" on public.packing_items
  for delete to authenticated
  using ((owner_id is null and public.can_edit_trip(trip_id)) or owner_id = (select auth.uid()));

-- Notes: shared notes behave like shared tables; private notes belong to their author.
create policy "notes: read shared or own" on public.notes
  for select to authenticated
  using (public.is_trip_member(trip_id) and (not is_private or created_by = (select auth.uid())));
create policy "notes: insert" on public.notes
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and ((not is_private and public.can_edit_trip(trip_id)) or (is_private and public.is_trip_member(trip_id)))
  );
create policy "notes: update" on public.notes
  for update to authenticated
  using ((not is_private and public.can_edit_trip(trip_id)) or created_by = (select auth.uid()))
  with check ((not is_private and public.can_edit_trip(trip_id)) or (created_by = (select auth.uid()) and public.is_trip_member(trip_id)));
create policy "notes: delete" on public.notes
  for delete to authenticated
  using ((not is_private and public.can_edit_trip(trip_id)) or created_by = (select auth.uid()));

-- Personal views: strictly private.
create policy "views: own only" on public.trip_views
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));

-- Templates: own, plus anything marked public.
create policy "templates: read own or public" on public.templates
  for select to authenticated using (owner_id = (select auth.uid()) or is_public);
create policy "templates: write own" on public.templates
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "templates: update own" on public.templates
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "templates: delete own" on public.templates
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Personal uploads (stickers, backgrounds).
create policy "assets: own only" on public.user_assets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_trip(
  p_name text,
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
  insert into public.trips (name, destination, start_date, end_date, currency, created_by)
  values (p_name, coalesce(p_destination, ''), p_start, p_end, coalesce(nullif(p_currency, ''), 'USD'), me)
  returning id into new_id;
  insert into public.trip_members (trip_id, user_id, role, attendance, color)
  values (new_id, me, 'owner', 'going', '#E07A5F');
  return new_id;
end;
$$;

-- Safe, minimal preview so the invite page can say "Join Salem 2027" before sign-in.
create or replace function public.get_invite_preview(p_token text)
returns table (trip_name text, destination text, start_date date, end_date date, invited_by text, role text, valid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.name, t.destination, t.start_date, t.end_date,
         coalesce(p.display_name, 'A friend'), i.role,
         (not i.revoked and i.expires_at > now())
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token;
$$;

create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.trip_invites;
  me uuid := auth.uid();
  palette text[] := array['#E07A5F', '#3D5A80', '#81B29A', '#F2CC8F', '#9B5DE5', '#F15BB5', '#00BBF9', '#6D597A'];
  member_count integer;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  select * into inv from public.trip_invites where token = p_token for update;
  if not found or inv.revoked or inv.expires_at < now() then
    raise exception 'This invite link is invalid or has expired';
  end if;
  if exists (select 1 from public.trip_members where trip_id = inv.trip_id and user_id = me) then
    return inv.trip_id;
  end if;
  select count(*) into member_count from public.trip_members where trip_id = inv.trip_id;
  insert into public.trip_members (trip_id, user_id, role, attendance, color)
  values (inv.trip_id, me, inv.role, 'going', palette[(member_count % array_length(palette, 1)) + 1]);
  update public.trip_invites set uses = uses + 1 where id = inv.id;
  return inv.trip_id;
end;
$$;

create or replace function public.set_share_link(p_trip uuid, p_enabled boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok text;
begin
  if not public.is_trip_owner(p_trip) then
    raise exception 'Only the trip owner can change the share link';
  end if;
  if p_enabled then
    tok := encode(extensions.gen_random_bytes(18), 'hex');
  else
    tok := null;
  end if;
  update public.trips set share_token = tok where id = p_trip;
  return tok;
end;
$$;

-- Read-only public itinerary. Leaves out confirmation codes, costs, private items.
create or replace function public.get_shared_trip(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when t.id is null then null else jsonb_build_object(
    'trip', jsonb_build_object('name', t.name, 'destination', t.destination, 'description', t.description,
                               'start_date', t.start_date, 'end_date', t.end_date, 'cover_image', t.cover_image),
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

revoke execute on function public.create_trip(text, text, date, date, text) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.set_share_link(uuid, boolean) from public, anon;
grant execute on function public.create_trip(text, text, date, date, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.set_share_link(uuid, boolean) to authenticated;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
grant execute on function public.is_trip_member(uuid), public.can_edit_trip(uuid), public.is_trip_owner(uuid), public.shares_trip_with(uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- trip-media/<trip_id>/<file>   : shared trip photos (members read, editors write)
-- user-assets/<user_id>/<file>  : personal stickers and backgrounds (owner only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('trip-media', 'trip-media', false, 15728640, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/avif']),
  ('user-assets', 'user-assets', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'])
on conflict (id) do nothing;

create or replace function public.path_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create policy "trip-media: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'trip-media' and public.is_trip_member(public.path_uuid(name)));
create policy "trip-media: editors upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trip-media' and public.can_edit_trip(public.path_uuid(name)));
create policy "trip-media: editors delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trip-media' and public.can_edit_trip(public.path_uuid(name)));

create policy "user-assets: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-assets' and public.path_uuid(name) = (select auth.uid()));
create policy "user-assets: owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-assets' and public.path_uuid(name) = (select auth.uid()));
create policy "user-assets: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-assets' and public.path_uuid(name) = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime: live updates for shared tables (RLS still applies)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.trips, public.trip_members, public.ideas, public.idea_votes, public.itinerary_items,
  public.flights, public.stays, public.expenses, public.packing_items, public.notes,
  public.photos, public.comments;
