-- Costs with units, who's doing what, paid/deposit tracking, custom splits, and households.

-- ---------------------------------------------------------------------------
-- Cost units. The existing cost columns now mean "price per unit".
-- unit: person | pair | people (per X people) | group | night | hour | car | room | custom
-- cost_unit_size: X for "per X people"
-- cost_qty: how many nights / hours / cars / rooms / custom units (null = smart default)
-- cost_unit_label: name for custom units ("locker", "ticket bundle")
-- Existing rows default to 'group' so their totals don't change.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ideas', 'itinerary_items', 'flights', 'stays'] loop
    execute format($f$
      alter table public.%I
        add column cost_unit text not null default 'group'
          check (cost_unit in ('person', 'pair', 'people', 'group', 'night', 'hour', 'car', 'room', 'custom')),
        add column cost_unit_size integer check (cost_unit_size is null or cost_unit_size > 0),
        add column cost_qty numeric(10, 2) check (cost_qty is null or cost_qty >= 0),
        add column cost_unit_label text not null default ''
    $f$, t);
  end loop;
end $$;

-- Who's doing a plan. Empty = everyone who's going.
alter table public.itinerary_items add column participants uuid[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Payments: expenses can be linked to the plan, flight or stay they pay for,
-- and marked as a deposit. Splits can be even, by shares, or exact amounts.
-- split_shares: { "<user id>": number } (weights for 'shares', amounts for 'exact')
-- ---------------------------------------------------------------------------
alter table public.expenses
  add column linked_type text check (linked_type in ('itinerary', 'flight', 'stay')),
  add column linked_id uuid,
  add column is_deposit boolean not null default false,
  add column split_mode text not null default 'equal' check (split_mode in ('equal', 'shares', 'exact')),
  add column split_shares jsonb not null default '{}'::jsonb,
  add constraint expenses_link_pair check ((linked_type is null) = (linked_id is null));
create index expenses_linked_idx on public.expenses (linked_type, linked_id);

-- ---------------------------------------------------------------------------
-- Households: people who share money (couples, families). They work across
-- every trip. Joining needs the invited person to accept.
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 80),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
-- A person belongs to at most one household at a time.
create unique index household_members_one_accepted on public.household_members (user_id) where status = 'accepted';
create index household_members_user_idx on public.household_members (user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
grant select on public.households, public.household_members to authenticated;

create or replace function public.can_see_household(h uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h
      and (m.user_id = (select auth.uid()) or public.shares_trip_with(m.user_id))
  );
$$;
revoke execute on function public.can_see_household(uuid) from public, anon;
grant execute on function public.can_see_household(uuid) to authenticated;

create policy "households: members and travel companions read" on public.households
  for select to authenticated using (public.can_see_household(id));
create policy "household members: members and travel companions read" on public.household_members
  for select to authenticated using (public.can_see_household(household_id));
-- All changes go through the functions below.

create or replace function public.create_household(p_name text, p_invitee uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  hid uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from public.household_members where user_id = me and status = 'accepted') then
    raise exception 'You''re already in a household. Leave it first or invite people to it.';
  end if;
  if p_invitee is null or p_invitee = me or not public.shares_trip_with(p_invitee) then
    raise exception 'You can only add people you share a trip with';
  end if;
  insert into public.households (name, created_by) values (coalesce(p_name, ''), me) returning id into hid;
  insert into public.household_members (household_id, user_id, status, invited_by) values (hid, me, 'accepted', me);
  insert into public.household_members (household_id, user_id, status, invited_by) values (hid, p_invitee, 'pending', me);
  return hid;
end;
$$;

create or replace function public.invite_to_household(p_household uuid, p_invitee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (select 1 from public.household_members where household_id = p_household and user_id = me and status = 'accepted') then
    raise exception 'Only household members can invite';
  end if;
  if p_invitee is null or p_invitee = me or not public.shares_trip_with(p_invitee) then
    raise exception 'You can only add people you share a trip with';
  end if;
  insert into public.household_members (household_id, user_id, status, invited_by)
  values (p_household, p_invitee, 'pending', me)
  on conflict (household_id, user_id) do nothing;
end;
$$;

create or replace function public.respond_household_invite(p_household uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (select 1 from public.household_members where household_id = p_household and user_id = me and status = 'pending') then
    raise exception 'No pending invite';
  end if;
  if p_accept then
    if exists (select 1 from public.household_members where user_id = me and status = 'accepted') then
      raise exception 'Leave your current household before joining another';
    end if;
    update public.household_members set status = 'accepted' where household_id = p_household and user_id = me;
  else
    delete from public.household_members where household_id = p_household and user_id = me;
    -- Nobody left to share with: remove the empty household.
    if (select count(*) from public.household_members where household_id = p_household and status = 'accepted') < 2
       and not exists (select 1 from public.household_members where household_id = p_household and status = 'pending') then
      delete from public.households where id = p_household;
    end if;
  end if;
end;
$$;

create or replace function public.leave_household(p_household uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  delete from public.household_members where household_id = p_household and user_id = me;
  -- A household of one isn't a household.
  if (select count(*) from public.household_members where household_id = p_household and status = 'accepted') < 2
     and not exists (select 1 from public.household_members where household_id = p_household and status = 'pending') then
    delete from public.households where id = p_household;
  end if;
end;
$$;

create or replace function public.rename_household(p_household uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.household_members where household_id = p_household and user_id = auth.uid() and status = 'accepted') then
    raise exception 'Only household members can rename it';
  end if;
  update public.households set name = left(coalesce(p_name, ''), 80) where id = p_household;
end;
$$;

revoke execute on function public.create_household(text, uuid) from public, anon;
revoke execute on function public.invite_to_household(uuid, uuid) from public, anon;
revoke execute on function public.respond_household_invite(uuid, boolean) from public, anon;
revoke execute on function public.leave_household(uuid) from public, anon;
revoke execute on function public.rename_household(uuid, text) from public, anon;
grant execute on function public.create_household(text, uuid) to authenticated;
grant execute on function public.invite_to_household(uuid, uuid) to authenticated;
grant execute on function public.respond_household_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.rename_household(uuid, text) to authenticated;
