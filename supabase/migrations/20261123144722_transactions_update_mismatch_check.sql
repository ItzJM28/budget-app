-- Applied 2026-11-23 14:47:22 (copied from the database's migration history).
-- On UPDATE, if both amount and amount_centavos change, they must agree.
create or replace function public.transactions_sync_amount()
returns trigger
language plpgsql
set search_path to ''
as $function$
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
    if new.amount_centavos is distinct from old.amount_centavos
       and new.amount is distinct from old.amount then
      -- both columns changed: they must agree
      if new.amount is not null and new.amount_centavos is not null
         and new.amount_centavos <> round(new.amount * 100)::bigint then
        raise exception 'amount (%) and amount_centavos (%) do not match', new.amount, new.amount_centavos;
      end if;
    elsif new.amount_centavos is distinct from old.amount_centavos then
      new.amount := new.amount_centavos / 100.0;
    elsif new.amount is distinct from old.amount then
      new.amount_centavos := round(new.amount * 100)::bigint;
    end if;
  end if;
  return new;
end;
$function$;
