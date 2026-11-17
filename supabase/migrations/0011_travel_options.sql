-- Unbooked flights and stays you're comparing.
-- date_flex: how rough a considered flight's date is (± days; 0 = exact).
-- option_group: options that compete with each other ("Outbound", "Week 1 hotel").
-- Left empty, the app groups flights by route and stays by dates.
alter table public.flights
  add column if not exists date_flex smallint not null default 0 check (date_flex between 0 and 30),
  add column if not exists option_group text not null default '' check (char_length(option_group) <= 80);
alter table public.stays
  add column if not exists option_group text not null default '' check (char_length(option_group) <= 80);
