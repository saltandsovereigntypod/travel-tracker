-- Driftbook core schema
-- Shared trip information lives in normal tables that every trip member can see.
-- Each person's visual layout lives in trip_views and is private to them.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Traveler',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'Traveler'), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Trips and membership
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  destination text not null default '',
  description text not null default '',
  start_date date,
  end_date date,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  budget numeric(12, 2) not null default 0 check (budget >= 0),
  cover_image text,
  lat double precision,
  lng double precision,
  share_token text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  attendance text not null default 'going' check (attendance in ('going', 'maybe', 'not_going')),
  color text not null default '#E07A5F',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members (user_id);

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  label text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked boolean not null default false,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);
create index trip_invites_trip_idx on public.trip_invites (trip_id);

-- Membership helpers. SECURITY DEFINER so policies can call them without recursion.
create or replace function public.is_trip_member(t uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = t and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit_trip(t uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = t and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor')
  );
$$;

create or replace function public.is_trip_owner(t uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = t and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create or replace function public.shares_trip_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members a
    join public.trip_members b on a.trip_id = b.trip_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

-- Only owners may turn the public share link on or off.
create or replace function public.guard_trip_share_token()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.share_token is distinct from old.share_token and not public.is_trip_owner(old.id) then
    raise exception 'Only the trip owner can change the share link';
  end if;
  return new;
end;
$$;

create trigger trips_guard_share before update on public.trips
  for each row execute function public.guard_trip_share_token();

-- The last owner cannot leave or be demoted, so a trip is never orphaned.
create or replace function public.guard_last_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  remaining integer;
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    -- Deleting the whole trip cascades here; allow that.
    if not exists (select 1 from public.trips where id = old.trip_id) then
      return coalesce(new, old);
    end if;
    select count(*) into remaining from public.trip_members
      where trip_id = old.trip_id and role = 'owner' and user_id <> old.user_id;
    if remaining = 0 then
      raise exception 'A trip needs at least one owner';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trip_members_guard_owner
  before update or delete on public.trip_members
  for each row execute function public.guard_last_owner();

-- ---------------------------------------------------------------------------
-- Shared planning tables
-- ---------------------------------------------------------------------------
-- location jsonb shape: { "name": text, "address": text, "lat": number, "lng": number }

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  url text,
  image_url text,
  category text not null default 'activity',
  est_cost numeric(12, 2),
  location jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'planned', 'maybe', 'passed')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ideas_trip_idx on public.ideas (trip_id);

create table public.idea_votes (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);
create index idea_votes_trip_idx on public.idea_votes (trip_id);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day date,
  start_time time,
  end_time time,
  title text not null check (char_length(title) between 1 and 200),
  notes text not null default '',
  category text not null default 'activity',
  location jsonb not null default '{}'::jsonb,
  url text,
  cost numeric(12, 2),
  idea_id uuid references public.ideas (id) on delete set null,
  sort_order double precision not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index itinerary_trip_day_idx on public.itinerary_items (trip_id, day, sort_order);

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  airline text not null default '',
  flight_number text not null default '',
  from_code text not null default '',
  from_name text not null default '',
  to_code text not null default '',
  to_name text not null default '',
  depart_local timestamp,
  arrive_local timestamp,
  confirmation text not null default '',
  seats text not null default '',
  status text not null default 'booked' check (status in ('idea', 'booked', 'cancelled')),
  travelers uuid[] not null default '{}',
  cost numeric(12, 2),
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flights_trip_idx on public.flights (trip_id, depart_local);

create table public.stays (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  kind text not null default 'hotel' check (kind in ('hotel', 'hostel', 'rental', 'bnb', 'friends', 'camping', 'other')),
  address text not null default '',
  location jsonb not null default '{}'::jsonb,
  check_in date,
  check_out date,
  check_in_time time,
  check_out_time time,
  confirmation text not null default '',
  url text,
  phone text not null default '',
  status text not null default 'booked' check (status in ('idea', 'booked', 'cancelled')),
  guests uuid[] not null default '{}',
  cost numeric(12, 2),
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stays_trip_idx on public.stays (trip_id, check_in);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  amount_home numeric(12, 2),
  category text not null default 'other',
  paid_by uuid references auth.users (id) on delete set null,
  split_between uuid[] not null default '{}',
  spent_on date,
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_trip_idx on public.expenses (trip_id, spent_on);

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  category text not null default 'General',
  owner_id uuid references auth.users (id) on delete cascade,
  assigned_to uuid references auth.users (id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  packed boolean not null default false,
  sort_order double precision not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index packing_trip_idx on public.packing_items (trip_id);
comment on column public.packing_items.owner_id is 'NULL = shared group list. Set = that person''s private list.';

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  kind text not null default 'note' check (kind in ('note', 'journal')),
  entry_date date,
  is_private boolean not null default false,
  pinned boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_trip_idx on public.notes (trip_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  storage_path text not null unique,
  caption text not null default '',
  taken_on date,
  width integer,
  height integer,
  favorite boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index photos_trip_idx on public.photos (trip_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  entity_type text not null check (entity_type in ('idea', 'itinerary', 'flight', 'stay', 'expense', 'note', 'photo')),
  entity_id uuid not null,
  body text not null check (char_length(body) between 1 and 4000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index comments_entity_idx on public.comments (entity_type, entity_id);
create index comments_trip_idx on public.comments (trip_id);

do $$
declare t text;
begin
  foreach t in array array['ideas', 'itinerary_items', 'flights', 'stays', 'expenses', 'packing_items', 'notes'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Personal (private) design layer
-- ---------------------------------------------------------------------------
create table public.trip_views (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  mode text not null default 'page' check (mode in ('page', 'board')),
  theme jsonb not null default '{}'::jsonb,
  page_layout jsonb not null default '[]'::jsonb,
  board_layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
create trigger trip_views_touch before update on public.trip_views
  for each row execute function public.touch_updated_at();

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  theme jsonb not null default '{}'::jsonb,
  page_layout jsonb not null default '[]'::jsonb,
  board_layout jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index templates_owner_idx on public.templates (owner_id);

create table public.user_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  storage_path text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);
create index user_assets_user_idx on public.user_assets (user_id);
