-- PeraFlow Phase 3: transactions get whole-centavo amounts, a 'transfer' kind and void support.
--
-- Additive only. No table, column, row or policy is dropped.
--   * amount_centavos bigint  -> the money source of truth from now on (whole centavos, > 0)
--   * kind 'transfer'         -> allowed alongside income/expense (never counted as either)
--   * voided_at timestamptz   -> set when an entry is voided; voided rows count toward nothing
--
-- The old amount numeric(12,2) column stays for now. A trigger keeps amount and
-- amount_centavos in sync, so the current app (which only writes amount) keeps
-- working, and the Phase 3 app can write amount_centavos only.
-- Row level security and the four owner-only policies are unchanged.

-- 1. New columns
alter table public.transactions
  add column if not exists amount_centavos bigint,
  add column if not exists voided_at timestamptz;

comment on column public.transactions.amount_centavos is
  'Amount in whole PHP centavos (integer, > 0). Source of truth for all money math.';
comment on column public.transactions.amount is
  'Legacy pesos value with 2 decimals. Kept in sync from amount_centavos by trigger.';
comment on column public.transactions.voided_at is
  'When the entry was voided. Null = active. Voided entries never change any total or balance.';

-- 2. Backfill existing rows (the table is empty today; this is just for safety)
update public.transactions
   set amount_centavos = round(amount * 100)::bigint
 where amount_centavos is null;

-- 3. Keep amount and amount_centavos in sync
create or replace function public.transactions_sync_amount()
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

drop trigger if exists transactions_sync_amount on public.transactions;
create trigger transactions_sync_amount
  before insert or update of amount, amount_centavos on public.transactions
  for each row execute function public.transactions_sync_amount();

-- 4. Centavos are required and positive
alter table public.transactions
  alter column amount_centavos set not null,
  add constraint transactions_amount_centavos_check check (amount_centavos > 0);

-- 5. Allow transfers
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions
  add constraint transactions_kind_check check (kind in ('income','expense','transfer'));

-- 6. Fast lookups of active (not voided) entries by month
create index if not exists transactions_user_active_date_idx
  on public.transactions (user_id, happened_on desc)
  where voided_at is null;
