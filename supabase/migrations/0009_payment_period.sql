-- For repeating items (rent, subscriptions), which occurrence a payment covers,
-- so paying January's rent doesn't count toward February's.
alter table public.expenses add column period date;
