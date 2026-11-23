-- PeraFlow: Supabase schema snapshot (project "ItzJM28's Project")
-- This file shows what the live database looks like after every migration in
-- supabase/migrations/ has run. It is a reference, not a script to run by hand:
-- all changes go through a new file in supabase/migrations/.
--
-- Row level security is on: each signed-in person can only see and change their own rows.
-- No passwords, keys or tokens belong in this file.

create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind            text not null
                  constraint transactions_kind_check check (kind in ('income','expense','transfer')),
  category        text not null check (char_length(category) between 1 and 60),
  note            text check (note is null or char_length(note) <= 120),
  amount          numeric(12,2) not null check (amount > 0),         -- legacy pesos, kept in sync by trigger
  happened_on     date not null default current_date,
  created_at      timestamptz not null default now(),
  amount_centavos bigint not null
                  constraint transactions_amount_centavos_check check (amount_centavos > 0), -- source of truth
  voided_at       timestamptz                                           -- null = active
);

comment on column public.transactions.amount_centavos is
  'Amount in whole PHP centavos (integer, > 0). Source of truth for all money math.';
comment on column public.transactions.amount is
  'Legacy pesos value with 2 decimals. Kept in sync from amount_centavos by trigger.';
comment on column public.transactions.voided_at is
  'When the entry was voided. Null = active. Voided entries never change any total or balance.';

create index transactions_user_date_idx
  on public.transactions (user_id, happened_on desc);
create index transactions_user_active_date_idx
  on public.transactions (user_id, happened_on desc)
  where voided_at is null;

-- Keeps amount (pesos) and amount_centavos matching. If only one is sent, fills the other.
-- If both are sent on insert and disagree, the save is rejected.
create function public.transactions_sync_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.amount_centavos is null and new.amount is not null then
      new.amount_centavos := round(new.amount * 100)::bigint;
    elsif new.amount is null and new.amount_centavos is not null then
      new.amount := new.amount_centavos / 100.0;
    elsif new.amount is not null and new.amount_centavos is not null
          and new.amount_centavos <> round(new.amount * 100)::bigint then
      raise exception 'amount (%) and amount_centavos (%) do not match', new.amount, new.amount_centavos;
    end if;
  else
    if new.amount_centavos is distinct from old.amount_centavos then
      new.amount := new.amount_centavos / 100.0;
    elsif new.amount is distinct from old.amount then
      new.amount_centavos := round(new.amount * 100)::bigint;
    end if;
  end if;
  return new;
end;
$$;

create trigger transactions_sync_amount
  before insert or update of amount, amount_centavos on public.transactions
  for each row execute function public.transactions_sync_amount();

alter table public.transactions enable row level security;

revoke all on public.transactions from anon;
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
