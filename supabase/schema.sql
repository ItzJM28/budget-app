-- Penny Budget: Supabase schema
-- Creates the transactions table the app reads and writes.
-- Row level security is on: each signed-in person can only see and change their own rows.
--
-- How to run (once, on a restored project):
--   Supabase dashboard > SQL Editor > New query > paste this file > Run
--   Expected result: "Success. No rows returned."
--   Running it a second time will fail because the table already exists. That's harmless.
--
-- No passwords, keys or tokens belong in this file.

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  category text not null check (char_length(category) between 1 and 60),
  note text check (note is null or char_length(note) <= 120),
  amount numeric(12,2) not null check (amount > 0),
  happened_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx
  on public.transactions (user_id, happened_on desc);

alter table public.transactions enable row level security;

grant select, insert, update, delete on public.transactions to authenticated;

create policy "Read own transactions" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Add own transactions" on public.transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Edit own transactions" on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own transactions" on public.transactions
  for delete to authenticated using (user_id = (select auth.uid()));
