-- Applied 2026-11-23 14:42:48 (copied from the database's migration history).
-- Removes TRUNCATE/REFERENCES/TRIGGER from signed-in users (TRUNCATE skips RLS) and recreates
-- the four owner-only policies with (select auth.uid()), new policies first so the table is never unprotected.
revoke truncate, references, trigger on public.transactions from authenticated;
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

drop policy if exists "Users can read their own transactions" on public.transactions;
drop policy if exists "Users can add their own transactions" on public.transactions;
drop policy if exists "Users can edit their own transactions" on public.transactions;
drop policy if exists "Users can delete their own transactions" on public.transactions;
