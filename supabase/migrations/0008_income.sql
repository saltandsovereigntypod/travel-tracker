-- Money can come in as well as go out: sponsor payments, gifts, reimbursements.
-- For income, paid_by = who received it; split_between = who it belongs to.
alter table public.expenses add column kind text not null default 'expense' check (kind in ('expense', 'income'));
