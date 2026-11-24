-- Applied 2026-11-23 15:33:18 as "monthly_income".
-- Monthly income: the bills table also holds income schedules (salary, allowance, rent you receive).
-- kind = 'expense' is a bill you pay; kind = 'income' is money you expect to receive.
-- Additive only: every existing row becomes 'expense', which is what it already was.
alter table public.bills
  add column kind text not null default 'expense' check (kind in ('expense', 'income'));

-- pay_bill now records the schedule's own kind, so "Mark received" on an income schedule
-- saves an income transaction (and its receipt record) in one step.
create or replace function public.pay_bill(p_bill_id uuid, p_month date, p_account_id uuid, p_paid_on date, p_amount_centavos bigint)
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
    raise exception 'This is already marked % for that month', case when b.kind = 'income' then 'received' else 'paid' end;
  end if;
  if coalesce(p_account_id, b.account_id) is null then raise exception 'Choose the account'; end if;
  insert into public.transactions (kind, category, note, amount_centavos, happened_on, account_id)
  values (b.kind, b.category, left(b.name, 120), coalesce(p_amount_centavos, b.amount_centavos),
          coalesce(p_paid_on, current_date), coalesce(p_account_id, b.account_id))
  returning id into t_id;
  insert into public.bill_payments (bill_id, month, transaction_id, paid_on)
  values (p_bill_id, p_month, t_id, coalesce(p_paid_on, current_date));
  return t_id;
end;
$$;
