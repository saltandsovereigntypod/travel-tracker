-- Each person's own way of looking at each list (view type, grouping, sorting, filters).
-- Lives on their private trip_views row, so it never changes anyone else's view.
alter table public.trip_views add column list_prefs jsonb not null default '{}'::jsonb;
