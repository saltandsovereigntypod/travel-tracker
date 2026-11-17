-- Custom lists: the linked engine.
-- A list belongs to a space and defines its own fields (jsonb). Each item has a
-- title plus values keyed by field id. Field meaning (money, date, place, person,
-- link to another list) is interpreted by the app, which is what lets lists feed
-- the budget, calendar and map automatically.

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text not null default '📋' check (char_length(icon) <= 16),
  description text not null default '',
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  settings jsonb not null default '{}'::jsonb,
  sort_order double precision not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_trip_idx on public.lists (trip_id, sort_order);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 300),
  values jsonb not null default '{}'::jsonb check (jsonb_typeof(values) = 'object'),
  sort_order double precision not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index list_items_list_idx on public.list_items (list_id, sort_order);
create index list_items_trip_idx on public.list_items (trip_id);

-- An item must live in a list from the same space.
create or replace function public.guard_list_item_space()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.lists l where l.id = new.list_id and l.trip_id = new.trip_id) then
    raise exception 'List does not belong to this space';
  end if;
  return new;
end;
$$;
create trigger list_items_guard_space before insert or update on public.list_items
  for each row execute function public.guard_list_item_space();

create trigger lists_touch before update on public.lists for each row execute function public.touch_updated_at();
create trigger list_items_touch before update on public.list_items for each row execute function public.touch_updated_at();

alter table public.lists enable row level security;
alter table public.list_items enable row level security;
grant select, insert, update, delete on public.lists, public.list_items to authenticated;

do $$
declare t text;
begin
  foreach t in array array['lists', 'list_items'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t || ': members read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_trip(trip_id))', t || ': editors insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id))', t || ': editors update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_edit_trip(trip_id))', t || ': editors delete', t);
  end loop;
end $$;

-- Payments and comments can point at list items too.
alter table public.expenses drop constraint if exists expenses_linked_type_check;
alter table public.expenses add constraint expenses_linked_type_check
  check (linked_type in ('itinerary', 'flight', 'stay', 'list_item'));

alter table public.comments drop constraint if exists comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in ('idea', 'itinerary', 'flight', 'stay', 'expense', 'note', 'photo', 'list_item'));

alter publication supabase_realtime add table public.lists, public.list_items;
