-- Each person's choice of what shows on cards (comments, links, about…), per kind of card.
alter table public.trip_views add column if not exists card_prefs jsonb not null default '{}'::jsonb;
