-- Pages: free-form shared docs inside a space, built from blocks (text, to-dos,
-- headings, embedded lists, linked items, subpages). Blocks are a jsonb array;
-- the app merges edits block by block so two people can type on one page.

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  parent_id uuid references public.pages (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  icon text not null default '📄' check (char_length(icon) <= 16),
  cover text not null default '' check (char_length(cover) <= 600),
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  sort_order double precision not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pages_trip_idx on public.pages (trip_id, sort_order);
create index pages_parent_idx on public.pages (parent_id);

-- A subpage must live in the same space as its parent.
create or replace function public.guard_page_space()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.pages p where p.id = new.parent_id and p.trip_id = new.trip_id
  ) then
    raise exception 'Parent page does not belong to this space';
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
create trigger pages_guard_space before insert or update on public.pages
  for each row execute function public.guard_page_space();
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();

alter table public.pages enable row level security;
grant select, insert, update, delete on public.pages to authenticated;
create policy "pages: members read" on public.pages for select to authenticated using (public.is_trip_member(trip_id));
create policy "pages: editors insert" on public.pages for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "pages: editors update" on public.pages for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "pages: editors delete" on public.pages for delete to authenticated using (public.can_edit_trip(trip_id));

alter table public.comments drop constraint if exists comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in ('idea', 'itinerary', 'flight', 'stay', 'expense', 'note', 'photo', 'list_item', 'page'));

alter publication supabase_realtime add table public.pages;

-- Space templates: a saved snapshot of a space's setup (features, lists and their
-- fields, optionally items, pages and a design) that anyone can start a new space from.
create table public.space_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 600),
  icon text not null default '✨' check (char_length(icon) <= 16),
  kind text not null default 'blank',
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  is_public boolean not null default false,
  share_code text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index space_templates_owner_idx on public.space_templates (owner_id);
create index space_templates_public_idx on public.space_templates (is_public) where is_public;
create trigger space_templates_touch before update on public.space_templates for each row execute function public.touch_updated_at();

alter table public.space_templates enable row level security;
grant select, insert, update, delete on public.space_templates to authenticated;
create policy "space_templates: read own or public" on public.space_templates for select to authenticated
  using (owner_id = (select auth.uid()) or is_public);
create policy "space_templates: insert own" on public.space_templates for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "space_templates: update own" on public.space_templates for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "space_templates: delete own" on public.space_templates for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Anyone with a template's link can see it and use it, even if it isn't public.
create or replace function public.get_template_by_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'description', t.description, 'icon', t.icon, 'kind', t.kind,
    'data', t.data, 'is_public', t.is_public, 'use_count', t.use_count, 'created_at', t.created_at,
    'owner_name', coalesce(p.display_name, 'Someone'),
    'mine', t.owner_id = auth.uid()
  )
  from public.space_templates t
  left join public.profiles p on p.id = t.owner_id
  where t.share_code = p_code and auth.uid() is not null;
$$;
revoke execute on function public.get_template_by_code(text) from public, anon;
grant execute on function public.get_template_by_code(text) to authenticated;

-- Count uses (by link or from the gallery) without letting people edit others' templates.
create or replace function public.note_template_use(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.space_templates set use_count = use_count + 1 where id = p_id and auth.uid() is not null;
$$;
revoke execute on function public.note_template_use(uuid) from public, anon;
grant execute on function public.note_template_use(uuid) to authenticated;
