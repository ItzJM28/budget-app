-- PeraFlow: tighten transactions grants and align RLS policies with schema.sql.
-- No table, column or row is dropped. RLS stays on the whole time.
--
-- NOTE: the timestamp in this file name is provisional. Once the owner approves it,
-- Supabase assigns the real version; rename this file to match it.
--
-- 1) Logged-in users only need read, add, edit and delete.
--    TRUNCATE would let one user wipe every user's rows (it ignores RLS).
revoke truncate, references, trigger on public.transactions from authenticated;
revoke all on public.transactions from anon;
grant select, insert, update, delete on public.transactions to authenticated;

-- 2) Recreate the 4 policies with (select auth.uid()) (evaluated once per query, not per row)
--    and the repo's names. New policies are created BEFORE the old ones are dropped,
--    so there is never a moment without a policy. Both sets allow exactly the same rows.
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
