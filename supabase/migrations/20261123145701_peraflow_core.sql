-- Applied 2026-11-23 14:57:01 as "peraflow_core".
-- PeraFlow core: accounts, categories, budgets, savings goals, bills.
-- Additive only: nothing is dropped and no existing rows change.
-- Every table is owner-only (RLS with user_id = auth.uid()), and composite foreign keys
-- (id, user_id) make sure a row can only point at the same person's accounts, goals and bills.

-- Lets other tables reference a transaction together with its owner.
alter table public.transactions add constraint transactions_id_user_key unique (id, user_id);

-- ── Accounts ─────────────────────────────────────────────────────────────────────
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('cash', 'bank', 'savings', 'ewallet', 'credit', 'investment')),
  -- Balance on the day the account was added, in centavos. Negative for money owed (credit cards).
  opening_centavos bigint not null default 0 check (abs(opening_centavos) < 1000000000000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index accounts_user_idx on public.accounts (user_id);

-- Which account money came from or went to. A transfer uses both columns.
alter table public.transactions
  add column account_id uuid,
  add column to_account_id uuid;
alter table public.transactions
  add constraint transactions_account_fk foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  add constraint transactions_to_account_fk foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  add constraint transactions_transfer_accounts_check check (
    (kind = 'transfer' and account_id is not null and to_account_id is not null and account_id <> to_account_id)
    or (kind <> 'transfer' and to_account_id is null)
  );
create index transactions_account_idx on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id) where to_account_id is not null;

-- ── Categories ───────────────────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('income', 'expense')),
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

-- ── Budgets (one spending limit per category per month) ──────────────────
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  category text not null check (char_length(category) between 1 and 60),
  limit_centavos bigint not null check (limit_centavos >= 0 and limit_centavos < 1000000000000),
  created_at timestamptz not null default now(),
  unique (user_id, month, category)
);

-- ── Savings goals ────────────────────────────────────────────────────────────────
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  target_centavos bigint not null check (target_centavos > 0 and target_centavos < 1000000000000),
  target_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
-- Positive = money put in, negative = money taken out.
create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  amount_centavos bigint not null check (amount_centavos <> 0 and abs(amount_centavos) < 1000000000000),
  happened_on date not null default current_date,
  note text check (note is null or char_length(note) <= 120),
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id);

-- ── Bills and subscriptions ───────────────────────────────────────────────────────────
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount_centavos bigint not null check (amount_centavos > 0 and amount_centavos < 1000000000000),
  due_day smallint not null check (due_day between 1 and 31),
  category text not null check (char_length(category) between 1 and 60),
  account_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict
);
-- One payment per bill per month. The payment's expense lives in transactions.
create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bill_id uuid not null,
  month date not null check (extract(day from month) = 1),
  transaction_id uuid not null,
  paid_on date not null,
  created_at timestamptz not null default now(),
  unique (bill_id, month),
  foreign key (bill_id, user_id) references public.bills (id, user_id) on delete cascade,
  foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete restrict
);
create index bill_payments_transaction_idx on public.bill_payments (transaction_id);

-- ── Row level security: owner-only on every new table ────────────────────
do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'budgets', 'goals', 'goal_contributions', 'bills', 'bill_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('create policy "Read own %1$s" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "Add own %1$s" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "Edit own %1$s" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "Delete own %1$s" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ── Account balances, calculated by the database ─────────────────────────
-- opening + income − expenses − transfers out + transfers in. Voided rows never count.
-- security_invoker: the view runs with the caller's rights, so RLS still applies.
create view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  (a.opening_centavos + coalesce(sum(
    case
      when t.account_id = a.id and t.kind = 'income' then t.amount_centavos
      when t.account_id = a.id and t.kind in ('expense', 'transfer') then -t.amount_centavos
      when t.to_account_id = a.id and t.kind = 'transfer' then t.amount_centavos
      else 0
    end), 0))::bigint as balance_centavos
from public.accounts a
left join public.transactions t
  on t.voided_at is null and (t.account_id = a.id or t.to_account_id = a.id)
group by a.id;
revoke all on public.account_balances from anon, authenticated;
grant select on public.account_balances to authenticated;

-- ── Paying a bill: the expense and the payment record are saved together or not at all ──
create function public.pay_bill(p_bill_id uuid, p_month date, p_account_id uuid, p_paid_on date, p_amount_centavos bigint)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b public.bills;
  t_id uuid;
begin
  select * into b from public.bills where id = p_bill_id;
  if not found then raise exception 'Bill not found'; end if;
  if extract(day from p_month) <> 1 then raise exception 'Month must be the first day of the month'; end if;
  if exists (select 1 from public.bill_payments where bill_id = p_bill_id and month = p_month) then
    raise exception 'This bill is already marked paid for that month';
  end if;
  if coalesce(p_account_id, b.account_id) is null then raise exception 'Choose the account the bill was paid from'; end if;
  insert into public.transactions (kind, category, note, amount_centavos, happened_on, account_id)
  values ('expense', b.category, left(b.name, 120), coalesce(p_amount_centavos, b.amount_centavos),
          coalesce(p_paid_on, current_date), coalesce(p_account_id, b.account_id))
  returning id into t_id;
  insert into public.bill_payments (bill_id, month, transaction_id, paid_on)
  values (p_bill_id, p_month, t_id, coalesce(p_paid_on, current_date));
  return t_id;
end;
$$;

-- Undo a payment: removes the payment record and voids its expense (history is kept).
create function public.unpay_bill(p_bill_id uuid, p_month date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p public.bill_payments;
begin
  select * into p from public.bill_payments where bill_id = p_bill_id and month = p_month for update;
  if not found then raise exception 'That bill is not marked paid for this month'; end if;
  delete from public.bill_payments where id = p.id;
  update public.transactions set voided_at = now() where id = p.transaction_id and voided_at is null;
end;
$$;

revoke execute on function public.pay_bill(uuid, date, uuid, date, bigint) from public, anon;
revoke execute on function public.unpay_bill(uuid, date) from public, anon;
grant execute on function public.pay_bill(uuid, date, uuid, date, bigint) to authenticated;
grant execute on function public.unpay_bill(uuid, date) to authenticated;
