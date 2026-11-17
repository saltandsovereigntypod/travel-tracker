-- Each person's scrapbook design (style, chapters, what's included, cover), private to them.
alter table public.trip_views add column if not exists scrapbook jsonb not null default '{}'::jsonb;
