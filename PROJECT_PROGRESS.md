# PeraFlow progress

PeraFlow (formerly Penny Budget) is a personal finance app for PHP (₱), using Asia/Manila time.
This file tracks every phase from `PERAFLOW_BRIEF.md`. It's updated after each merged milestone.

- **Repo:** ItzJM28/budget-app (`index.html`, React + TypeScript compiled in the browser with the `tsx` Babel preset)
- **Database:** Supabase "ItzJM28's Project", table `public.transactions`, row level security on
- **Hosting:** Vercel project `penny-budget`, https://penny-budget-psi.vercel.app (a merge to `main` deploys production)

Last updated: 2026-11-23

## Legend

- [x] done and merged to `main`
- [ ] not done yet
- *In review* means there's an open pull request

## Done before PeraFlow

| PR | What | Status |
|----|------|--------|
| #1 | Supabase schema for the `transactions` table | Merged |
| #7 | Supabase keys, PR #5/#6 fixes, separate retry banner, blank-page fix (`tsx` Babel preset) | **Merged 2026-11-23** (07:58 UTC / 15:58 Asia/Manila), live in production |
| #2–#6 | Earlier tries at the same fixes | Closed, replaced by #7 |

## Phase 1: Audit and rename

- [ ] `PROJECT_AUDIT.md`: *in review* in PR #9 (PR #8's findings folded in; #8 to be closed)
- [ ] `PROJECT_PROGRESS.md`: *in review* in PR #10 (this file)
- [ ] Rename Penny Budget to PeraFlow (page title, headings, README, schema comment)
- [ ] Switch the currency to PHP (₱) and dates to Asia/Manila

Phase 1 is ticked off only once #9 and #10 are merged and the rename and ₱ switch are live.

## Phase 2: App shell and design system

- [ ] Left sidebar: Dashboard, Transactions, Accounts, Budgets, Bills, Loans, Goals, Reports, Calendar, Assistant, Settings
- [ ] Emerald and white design system, light and dark themes
- [ ] Shared card, button, input, table, empty-state, loading-skeleton, error and confirm-dialog styles
- [ ] Works on phones

## Phase 3: Core money features

- [ ] Accounts (cash, bank, savings, e-wallet, credit card, investment) with opening balances
- [ ] Categories table
- [ ] Transactions: income, expense and transfer; edit and void; search and filters; CSV import and export; split and recurring
- [ ] Dashboard: total balance, safe-to-spend, income, expenses, net cash flow, category breakdown, recent transactions, date filters

**Database groundwork already applied (early, ahead of Phase 3):**

- Migration `transactions_centavos_transfer_void` is **applied** on ItzJM28's Project (2026-11-23 14:33:33 UTC).
  - `amount_centavos` (bigint, whole centavos, required, above 0) is now the amount all money math uses.
  - `voided_at`: if it's empty, the entry counts; if it has a date, the entry is voided and counts toward nothing.
  - `kind` now allows `income`, `expense` and `transfer`.
  - The old peso column `amount` stays for now. A trigger keeps it matching `amount_centavos`, so today's app keeps working.
- The migration file is in **PR #11** (`db/phase3-centavos-migration`). The exact SQL from the live history is also in PR #12 (`chore/save-centavos-migration`). Neither is merged yet, so `supabase/migrations/` doesn't exist on `main` yet.
- The app doesn't use these columns yet. It still adds up `amount` and doesn't skip voided rows. That gets fixed in the ₱ switch and the Phase 3 transaction work.

## Phase 4: Budgets and obligations

- [ ] Budgets: monthly and weekly, category allocations, zero-based and envelope, rollover, alerts, planned vs actual
- [ ] Bills and subscriptions: due dates, expected vs actual, paid/unpaid, payment history, reminders
- [ ] Loans and debts: principal, balance, interest, installments, partial payments, principal and interest kept separate, amortization, snowball and avalanche

## Phase 5: Planning

- [ ] Savings goals: targets, contributions, target dates, estimated completion dates
- [ ] Analytics: income vs expenses, cash flow, categories, budget performance, debt, savings growth, net worth, monthly and yearly comparisons
- [ ] Financial calendar: bills, loan payments, salary, recurring expenses, goal contributions

## Phase 6: AI assistant

- [ ] Answers questions, spending insights, budget suggestions, forecasts, affordability checks, monthly summaries
- [ ] All numbers come from the app's own calculations. The assistant only explains them.

## Phase 7: Quality

- [ ] Tests for the money math
- [ ] Every critical workflow checked
- [ ] Production readiness pass

## Open items outside the phases

- [ ] Remove TRUNCATE, REFERENCES and TRIGGER on `transactions` from signed-in users (database migration, Bed)
- [ ] Turn on leaked password protection (owner, Supabase > Authentication > Passwords)
- [ ] Merge PR #11/#12 so the centavos migration is saved under `supabase/migrations/`

## Rules we work by

- Money is stored and added as whole centavos, never floating-point. PHP (₱), Asia/Manila.
- Transfers are not income or expenses. Voided entries don't count.
- Database changes go out as migrations and are saved under `supabase/migrations/`. Never drop data. Every new table gets RLS.
- No service_role key in the page or the repo.
- One small pull request per task. Update this file after each milestone.
