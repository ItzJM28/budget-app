-- PeraFlow Phase 3: transactions get whole-centavo amounts, a 'transfer' kind and void support.
-- Additive only. No table, column, row or policy is dropped.

alter table public.transactions
  add column if not exists amount_centavos bigint,
  add column if not exists voided_at timestamptz;

comment on column public.transactions.amount_centavos is
  'Amount in whole PHP centavos (integer, > 0). Source of truth for all money math.';
comment on column public.transactions.amount is
  'Legacy pesos value with 2 decimals. Kept in sync from amount_centavos by trigger.';
comment on column public.transactions.voided_at is
  'When the entry was voided. Null = active. Voided entries never change any total or balance.';

update public.transactions
   set amount_centavos = round(amount * 100)::bigint
 where amount_centavos is null;

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

alter table public.transactions
  alter column amount_centavos set not null,
  add constraint transactions_amount_centavos_check check (amount_centavos > 0);

alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions
  add constraint transactions_kind_check check (kind in ('income','expense','transfer'));

create index if not exists transactions_user_active_date_idx
  on public.transactions (user_id, happened_on desc)
  where voided_at is null;
