# PeraFlow progress

The full spec is in `PERAFLOW_BRIEF.md`. Update this file after every merged milestone.

_Last updated: 2026-11-23._

## Phase status

| Phase | Status |
|---|---|
| 1. Audit and rename | Mostly done. Renamed to PeraFlow, ₱ and Asia/Manila. The audit is in PR #9 (not merged yet). |
| 2. App shell and design system | **Done.** Sidebar layout, light/dark themes, cards, tables, dialogs, empty/loading/error states, phone layout. |
| 3. Core money features | **Mostly done.** Accounts, categories, income/expense/transfer, edit, void/restore, search, filters, CSV export, dashboard. Missing: CSV import, split and recurring transactions, attachments. |
| 4. Budgets and obligations | **Partly done.** Monthly budgets and bills/subscriptions are built. Missing: weekly budgets, rollover, envelopes, reminders, loans and debts. |
| 5. Planning | **Partly done.** Savings goals are built. Missing: analytics/reports page, financial calendar. |
| 6. AI assistant | Not started. |
| 7. Quality | **Started.** 15 money-math tests; database math checked with SQL. |

## Modules

| Module | Status | Notes |
|---|---|---|
| Dashboard | Done | Total balance, safe to spend, income, spending, net saved with 6-month sparklines, cash-flow chart (3M/6M/1Y), spending plan, goals, recent transactions, upcoming bills, category donut, month picker. |
| Transactions | Done, partly | Add, edit, void and restore. Search, type/account/category filters, show voided, CSV export. **To do:** CSV import, splits, recurring, attachments. |
| Accounts | Done | Six account types (cash, bank, savings, e-wallet, credit card, investment). Opening balance. Balances come from the database view. Transfers, history link, archive and restore. Net worth, assets and debts. |
| Categories | Done | 18 defaults are added on first sign-in. Add and remove in Settings. |
| Budgets | Done, partly | Monthly limit per category, planned versus actual, unbudgeted spending, "left to assign" (zero-based), copy from last month. **To do:** weekly budgets, rollover, envelopes, alerts. |
| Bills and subscriptions | Done, partly | Due day, usual amount, paid/unpaid/overdue/due-soon status. Pay and undo are each one atomic database call. **To do:** reminders, a payment history view. |
| Loans and debts | Not started | Credit-card debt shows on Accounts. Loans need their own tables. |
| Savings goals | Done | Target, target date, add/withdraw, segmented progress, estimated finish date at the last 90 days' pace, the monthly amount needed to hit the date. |
| Analytics and reports | Not started | The dashboard covers the basics. |
| Financial calendar | Not started | |
| AI assistant | Not started | Must explain numbers from `src/money.js` and the database, never compute its own. |
| Settings | Done | Theme (system/light/dark), categories, account and sign out. |

## Architecture (as built)

**No build step.** Vercel serves the files as they are.

- **index.html:** loads React 18, supabase-js, Babel standalone and the `tsx` preset fix, then the app files in this order:
  1. `src/money.js`
  2. `src/ui.tsx`
  3. `src/data.tsx`
  4. `src/forms.tsx`
  5. `src/pages.tsx`
  6. `src/app.tsx`

  The `.tsx` files share one global scope, so there are no imports. Don't declare the same name twice.
- **src/money.js:** all money and date math, in plain JavaScript. Whole centavos, Asia/Manila. It's tested by `node tests/money.test.js`.
- **src/data.tsx:** the Supabase client and every read and write. Every write reloads data so balances always come from the database.
- **Account balances:** the view `account_balances` (security_invoker) works out opening + income − expenses − transfers out + transfers in. It skips voided rows.
- **Bill payments:** `pay_bill()` and `unpay_bill()` save the expense and the payment record together in one database call.

## Database changes

All migrations are in `supabase/migrations/`, copied from the live migration history.

- `20261123145701_peraflow_core`:
  - **New tables:** `accounts`, `categories`, `budgets`, `goals`, `goal_contributions`, `bills`, `bill_payments`.
  - **New transaction columns:** `transactions.account_id` and `transactions.to_account_id`, with transfer rules.
  - **New view and functions:** the `account_balances` view, and the `pay_bill` and `unpay_bill` functions.
  - **Additive only.** Every new table is owner-only (RLS). Composite foreign keys stop rows from pointing at another person's accounts, goals or bills.
  - **Checked live** inside a rolled-back test: balances, transfers, voids, and pay/unpay all came out right.

## Bugs fixed

- **Blank page:** Babel ignored the TypeScript preset (fixed in PR #7).
- **Penny Budget leftovers:** the old app had USD, float money math and no accounts. All replaced.

## Tests

- `node tests/money.test.js`: 15 tests covering parsing, formatting, transfers, voids, exact sums, Manila dates, month rollover, bills, budgets, goals, and CSV safety.
- **Browser checks** against an in-memory stand-in for Supabase: every page in light and dark mode, the phone layout (no sideways scroll), adding a transfer (balances moved by exactly ₱1,500.50), voiding (totals dropped), paying a bill then voiding its expense (the bill went back to unpaid), budget edits (exact centavos; junk input refused), and the first-run state.

## Known limitations

- **Not yet clicked through with a real signed-in account.** The owner should do this once.
- **Google sign-in** needs the Google provider switched on in Supabase. **Leaked-password protection** is off in Supabase Auth (security advisor warning).
- **Transactions keep the category name as text.** Removing a category doesn't change past transactions.
- **Older months:** the dashboard keeps the last 12 months in memory. The Transactions page fetches older months when you open them.
- **Speed:** Babel compiles the app in the browser on every load, which takes about a second. A build step would make it faster. That's a deployment change, so it needs the owner's approval.

## Next recommended tasks

1. Loans and debts: a `loans` table, a `loan_payments` table with principal and interest kept separate, an amortization schedule, and snowball/avalanche strategies.
2. Recurring transactions, and CSV import with a preview step.
3. A Reports page: monthly and yearly comparisons, net worth over time, budget performance.
4. A financial calendar that brings together bills, goal contributions and expected income.
5. Budget rollover and spending alerts.
6. The AI assistant, working on top of `src/money.js` results.
