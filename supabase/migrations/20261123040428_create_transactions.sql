-- Penny Budget: transactions table
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('income', 'expense')),
  category    text not null check (char_length(category) between 1 and 60),
  note        text check (note is null or char_length(note) <= 120),
  amount      numeric(12,2) not null check (amount > 0),
  happened_on date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, happened_on desc);

alter table public.transactions enable row level security;

-- Logged-in users only; anonymous visitors get nothing
revoke all on public.transactions from anon;
grant select, insert, update, delete on public.transactions to authenticated;

create policy "Users can read their own transactions"
  on public.transactions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can add their own transactions"
  on public.transactions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can edit their own transactions"
  on public.transactions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own transactions"
  on public.transactions for delete
  to authenticated
  using (user_id = auth.uid());
