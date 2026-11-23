# PeraFlow product brief

The owner's brief for turning Penny Budget into **PeraFlow**. Every bot working on this repo reads this file before starting a task.

PeraFlow continues the **existing** project. Do not start a new one.

## Where things stand today (checked 2026-11-23)

- **Code:** one file, `index.html`. React 18 from a CDN, TypeScript compiled in the browser by `@babel/standalone`, and `supabase-js` v2 from a CDN. There is no build step and no package.json.
- **Keep the Babel fix.** The small `<script>` that registers the `tsx` preset (`allExtensions:true,isTSX:true`) must stay, and the app script must stay `data-presets="tsx,react"`. Without it the page goes blank, which is what happened before PR #7.
- **Supabase:** project "ItzJM28's Project" (ref `hxthblueuasuqlxqkwsk`). There is one table, `public.transactions`, with these columns:
  - `id` uuid
  - `user_id` uuid (default `auth.uid()`)
  - `kind` text
  - `category` text
  - `note` text
  - `amount` numeric(12,2)
  - `happened_on` date
  - `created_at` timestamptz

  Row level security is on, with select/insert/update/delete policies limited to `user_id = auth.uid()`. The setup SQL is in `supabase/schema.sql`.
- **Sign-in:** email and password work. Google sign-in is being switched on by the owner in Supabase.
- **Hosting:** Vercel project `penny-budget`. Live at https://penny-budget-psi.vercel.app. A merge to `main` deploys production.
- **Not yet built:** accounts, categories table, transfers, budgets, bills, loans, goals, analytics, calendar, AI assistant, dark mode, PHP currency (the app shows USD today).

## Working rules for the bots

1. **Small pull requests.** Make one focused pull request per task, and never push to `main` directly. Close or update your own older pull request instead of opening a near-copy of it.
2. **Keep the page loading.** Before you ask for a merge, re-read your whole `index.html` and check that every TypeScript feature you used still compiles with the `tsx` preset.
3. **Database changes:**
   - Make every change as a migration, and also save it as a file under `supabase/migrations/`.
   - Never drop tables or columns, disable RLS, or delete data without the owner's approval.
   - Every new table gets RLS with `user_id = auth.uid()` policies.
4. **No secrets in the page.** The publishable key is fine to ship in the page. The service_role key never goes in the page or the repo.
5. **Track progress.** Update `PROJECT_PROGRESS.md` after every merged milestone.

## Phases (plan one phase at a time, in order)

1. **Audit and rename.**
   - Write `PROJECT_AUDIT.md`: stack, architecture, database, auth, UI, modules, missing features, technical debt, bugs, security, recommendations. Mark each feature as fully implemented, partially implemented, not implemented, needs improvement, or requires investigation. Don't invent features that don't exist.
   - Write `PROJECT_PROGRESS.md`.
   - Rename the app from Penny Budget to **PeraFlow** in the title, headings and README.
   - Switch the currency to PHP (₱), with Asia/Manila dates.
2. **App shell and design system.**
   - A left sidebar layout with: Dashboard, Transactions, Accounts, Budgets, Bills, Loans, Goals, Reports, Calendar, Assistant, Settings.
   - Light and dark themes.
   - Shared card, button, input, table, empty-state, loading-skeleton, error and confirm-dialog styles.
   - Must work on phones.
3. **Core money features.**
   - Accounts: cash, bank, savings, e-wallet, credit card and investment accounts, each with an opening balance.
   - A categories table.
   - Transactions:
     - Income, expense and transfer.
     - Edit and void.
     - Search and filters.
     - CSV import and export.
     - Split and recurring transactions.
   - Dashboard:
     - Total balance and safe-to-spend.
     - Income, expenses and net cash flow.
     - Category breakdown and recent transactions.
     - Date filters.
4. **Budgets and obligations.**
   - Budgets: monthly and weekly, category allocations, zero-based and envelope budgeting, rollover, alerts, and planned versus actual.
   - Bills and subscriptions: due dates, expected versus actual amounts, paid and unpaid status, payment history and reminders.
   - Loans and debts: principal, balance, interest rate, installments, partial payments, principal and interest kept separate, amortization schedule, and snowball and avalanche strategies.
5. **Planning.**
   - Savings goals: targets, contributions, target dates and estimated completion dates.
   - Analytics: income versus expenses, cash flow, categories, budget performance, debt, savings growth, net worth, and monthly and yearly comparisons.
   - A financial calendar showing bills, loan payments, salary, recurring expenses and goal contributions.
6. **AI assistant.**
   - Answers questions, gives spending insights and budget suggestions, makes forecasts, checks whether a purchase is affordable, and writes monthly summaries.
   - All numbers come from the app's own calculations. The AI only explains them.
7. **Quality.**
   - Tests for the money math.
   - Check every critical workflow.
   - Do a production readiness pass.

## Money rules (top priority)

- **Amounts:**
  - Store and add money as whole centavos (integers), never as floating-point numbers.
  - Currency: PHP (₱). Timezone: Asia/Manila.
- **What counts as income or spending:**
  - Transfers between the owner's own accounts are not income or expenses.
  - Voided transactions don't change any balance.
  - Paid bills are not unpaid obligations.
  - Never count the same obligation twice.
- **Loans:** keep principal, interest and fees separate.
- **Writes and history:**
  - Financial writes must be atomic, for example a transfer done in one database function.
  - Keep the transaction history.

## Design direction

The look is a clean, minimal fintech style, not a generic admin template.

- **Colors and type:** white and neutral backgrounds, an emerald green accent, clean type with a clear size hierarchy, and subtle borders and shadows.
- **Shapes and icons:** rounded cards and simple line icons in the Lucide style.
- **Usability over decoration.** All states (empty, loading, error, success) are handled. Forms are accessible.

The owner shared three reference screens:

1. **"Money" overview dashboard.**
   - A light sage sidebar with workspace navigation, connected accounts, and a "Budget check" card.
   - A dark-green "Available balance" hero card with a sparkline.
   - Income, Spending and Net saved cards, each with a small trend line.
   - A cash-flow bar chart (income versus spending, with a net-saved line) with 3M/6M/1Y tabs.
   - A spending plan made of per-category progress bars showing "X left".
   - Savings goals drawn as segmented progress bars.
   - A recent-transactions table with status dots.
   - "Upcoming payments" cards showing date chips, amounts and autopay status.
2. **"Coinest" dashboard.**
   - Four stat cards with +/- percentage chips.
   - A smooth income and expense area chart with a hover tooltip.
   - An expense breakdown donut with category percentages.
   - A "Finance score" bar.
   - Card-style account balances.
   - Saving-plan progress bars.
   - A recent-activities timeline.
3. **"Finopia" transactions page.**
   - A full-width table with a mint header row.
   - Columns: date, amount (green + and red −), payment name, method, category.
   - A date-range filter and a green "Add new transaction" button.
   - A light/dark toggle in the header.

Take the layout ideas, spacing and calm green palette from these. Don't copy them exactly.

## Out of bounds

- Don't start a new project.
- Don't replace Supabase, the database or the sign-in system.
- Don't remove working features.
- Don't add dependencies without a clear reason.
- Don't change Vercel production settings without the owner's approval.
- Don't use fake figures or leave buttons that don't do anything.
