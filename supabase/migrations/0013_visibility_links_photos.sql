-- Who can see notes, journal entries and photos: everyone in the space, only me,
-- or people I choose. Enforced here, so hidden things never reach anyone else's device.
-- Notes and photos can also be linked to a plan, stay, flight, idea or list item,
-- and photos keep the date, time and place they were taken (from the camera).

alter table public.notes
  add column if not exists visibility text not null default 'everyone' check (visibility in ('everyone', 'private', 'people')),
  add column if not exists visible_to uuid[] not null default '{}',
  add column if not exists linked_type text check (linked_type in ('itinerary', 'flight', 'stay', 'idea', 'list_item')),
  add column if not exists linked_id uuid;
update public.notes set visibility = 'private' where is_private and visibility = 'everyone';

alter table public.photos
  add column if not exists visibility text not null default 'everyone' check (visibility in ('everyone', 'private', 'people')),
  add column if not exists visible_to uuid[] not null default '{}',
  add column if not exists linked_type text check (linked_type in ('itinerary', 'flight', 'stay', 'idea', 'list_item')),
  add column if not exists linked_id uuid,
  add column if not exists taken_at timestamptz,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists album text not null default '' check (char_length(album) <= 80);
create index if not exists photos_linked_idx on public.photos (linked_type, linked_id);
create index if not exists notes_linked_idx on public.notes (linked_type, linked_id);

-- Keep the old is_private flag in step, and only the owner may change who can see something.
create or replace function public.guard_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.created_by is distinct from auth.uid()
     and (new.visibility is distinct from old.visibility or new.visible_to is distinct from old.visible_to) then
    raise exception 'Only the person who added this can change who sees it';
  end if;
  if new.visibility <> 'people' then
    new.visible_to := '{}';
  end if;
  if tg_table_name = 'notes' then
    new.is_private := new.visibility <> 'everyone';
  end if;
  return new;
end;
$$;
drop trigger if exists notes_guard_visibility on public.notes;
create trigger notes_guard_visibility before insert or update on public.notes for each row execute function public.guard_visibility();
drop trigger if exists photos_guard_visibility on public.photos;
create trigger photos_guard_visibility before insert or update on public.photos for each row execute function public.guard_visibility();

-- Notes ----------------------------------------------------------------------------
drop policy if exists "notes: read shared or own" on public.notes;
drop policy if exists "notes: insert" on public.notes;
drop policy if exists "notes: update" on public.notes;
drop policy if exists "notes: delete" on public.notes;

create policy "notes: read if visible" on public.notes for select to authenticated
  using (public.is_trip_member(trip_id) and (
    visibility = 'everyone' or created_by = (select auth.uid())
    or (visibility = 'people' and (select auth.uid()) = any (visible_to))));
create policy "notes: insert" on public.notes for insert to authenticated
  with check (
    created_by = (select auth.uid()) and public.is_trip_member(trip_id)
    and (visibility <> 'everyone' or public.can_edit_trip(trip_id)));
create policy "notes: update" on public.notes for update to authenticated
  using (
    created_by = (select auth.uid())
    or (public.can_edit_trip(trip_id) and (visibility = 'everyone' or (visibility = 'people' and (select auth.uid()) = any (visible_to)))))
  with check (public.is_trip_member(trip_id));
create policy "notes: delete" on public.notes for delete to authenticated
  using (created_by = (select auth.uid()) or (visibility = 'everyone' and public.can_edit_trip(trip_id)));

-- Photos ---------------------------------------------------------------------------
drop policy if exists "photos: members read" on public.photos;
drop policy if exists "photos: editors update" on public.photos;
drop policy if exists "photos: editors delete" on public.photos;

create policy "photos: read if visible" on public.photos for select to authenticated
  using (public.is_trip_member(trip_id) and (
    visibility = 'everyone' or created_by = (select auth.uid())
    or (visibility = 'people' and (select auth.uid()) = any (visible_to))));
create policy "photos: editors update visible" on public.photos for update to authenticated
  using (public.can_edit_trip(trip_id) and (
    visibility = 'everyone' or created_by = (select auth.uid())
    or (visibility = 'people' and (select auth.uid()) = any (visible_to))))
  with check (public.can_edit_trip(trip_id));
create policy "photos: delete own or shared" on public.photos for delete to authenticated
  using (public.can_edit_trip(trip_id) and (created_by = (select auth.uid()) or visibility = 'everyone'));

-- Comments on hidden notes and photos stay hidden too ------------------------------
create or replace function public.can_see_item(p_type text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'note' then exists (select 1 from public.notes n where n.id = p_id and (
      n.visibility = 'everyone' or n.created_by = auth.uid() or (n.visibility = 'people' and auth.uid() = any (n.visible_to))))
    when 'photo' then exists (select 1 from public.photos p where p.id = p_id and (
      p.visibility = 'everyone' or p.created_by = auth.uid() or (p.visibility = 'people' and auth.uid() = any (p.visible_to))))
    else true
  end;
$$;
revoke execute on function public.can_see_item(text, uuid) from public, anon;
grant execute on function public.can_see_item(text, uuid) to authenticated;

drop policy if exists "comments: members read" on public.comments;
create policy "comments: members read visible" on public.comments for select to authenticated
  using (public.is_trip_member(trip_id) and public.can_see_item(entity_type, entity_id));
