# PROJECT_AUDIT.md

Audit of the existing **Penny Budget** app, which is becoming **PeraFlow**. This is a read-only review. No app code was changed in this pull request.

- Written for: Phase 1 (Audit and rename)
- Sources: `PERAFLOW_BRIEF.md`, `index.html` on `main`, `supabase/schema.sql`, `README.md`, and Bed's live Supabase check.
- Status labels used below: **Fully implemented**, **Partially implemented**, **Not implemented**, **Needs improvement**, **Requires investigation**.

> Limit of this audit: the file reader shows the first 20,000 of the 24,710 characters of `index.html`. That covers everything up to the start of the "Add a transaction" form. The form fields, the transaction list markup and the final render/session code were not read directly. Items that depend on them are marked **Requires investigation**.

## 1. What the app does today

A single-user-per-account budgeting page.

| Feature | Status | Notes |
|---|---|---|
| Email and password sign-in and registration | Fully implemented | `signInWithPassword` and `signUp`. Password minimum of 6 characters is checked in the page. Confirmation-email notice is shown. |
| Google sign-in | Partially implemented | The button and `signInWithOAuth` call exist. The brief says the owner is switching the provider on in Supabase, so it cannot be confirmed working. **Requires investigation.** |
| Log out | Fully implemented | Header button calls `auth.signOut()`. |
| Add an income or expense | Fully implemented | Fields: kind, amount, category, note, date. Amount is strictly validated. |
| Delete a transaction | Fully implemented | Hard delete, with a check that a row was really deleted. Conflicts with the "void, keep history" rule (see section 8). |
| Edit a transaction | Not implemented | No update call exists in the code that was read. |
| Month view | Fully implemented | Previous and next month, month picker. Only the chosen month is fetched. |
| Totals: Income, Spent, Left this month | Fully implemented | Show "Loading…" or "Not loaded" instead of a false 0. |
| Spending by category bars | Fully implemented | Sorted high to low. |
| Load error with Try again | Fully implemented | Tied to the failed month. Late answers are ignored. |
| Search, filters, CSV | Not implemented | |
| Accounts, categories table, transfers, budgets, bills, loans, goals, analytics, calendar, AI assistant, dark mode | Not implemented | Matches the brief's "Not yet built" list. |

The categories are a fixed list in code: Groceries, Rent, Transport, Bills, Eating out, Health, Fun, Salary, Other. The category is saved as free text on each transaction.

## 2. Stack and architecture

- **One file:** `index.html` holds the CSS, the markup shell and all app code. No `package.json`, no build step, no tests.
- **Libraries from jsDelivr:** React 18.3.1 and ReactDOM 18.3.1 (pinned), `@supabase/supabase-js@2` (major version only), `@babel/standalone@7` (major version only).
- **TypeScript in the browser:** `@babel/standalone` compiles the app script. A small `<script>` registers a `tsx` preset (`allExtensions:true, isTSX:true`), and the app script uses `type="text/babel" data-presets="tsx,react"`. **This must stay.** Without it the page goes blank.
- **Components:** `Auth`, `Dashboard`, small icon components (`GoogleIcon`, `Chevron`) and a root component that picks between them (root not read).
- **State:** React `useState`, `useMemo`, `useCallback`, `useRef`. No store, no router.
- **Helpers:** `money`, `parseAmount`, `monthRange`, `shiftMonth`, `monthName`, `today`.
- **Styling:** plain CSS with variables in `:root`, teal/green palette, single light theme. Good basics: 44px tap targets, focus rings, reduced-motion handling, `100dvh`, safe-area padding.
- **Files in the repo:** `index.html`, `README.md`, `PERAFLOW_BRIEF.md`, `supabase/schema.sql`. There is no `supabase/migrations/` folder yet, which the brief requires for database changes.
- **Hosting:** Vercel project `penny-budget`. A merge to `main` deploys production.

## 3. Database (Supabase)

Project "ItzJM28's Project" (ref `hxthblueuasuqlxqkwsk`, region ap-northeast-2) is **Running** (confirmed by Bed). The "paused" note in the shared memory is out of date. `doit-tasks` is paused and PeraFlow does not use it.

**Table `public.transactions`** has 0 rows and RLS **on**.

| Column | Type | Rule |
|---|---|---|
| id | uuid, primary key | `gen_random_uuid()` |
| user_id | uuid, not null | default `auth.uid()`, references `auth.users(id)` on delete cascade |
| kind | text, not null | check: `income` or `expense` only |
| category | text, not null | check: 1 to 60 characters |
| note | text, optional | check: up to 120 characters |
| amount | numeric(12,2), not null | check: `> 0` |
| happened_on | date, not null | default `current_date` |
| created_at | timestamptz, not null | default `now()` |

- **Index:** `transactions_user_date_idx` on `(user_id, happened_on desc)`.
- **Policies:** four policies (select, insert, update, delete), all for the `authenticated` role only and limited to `user_id = (select auth.uid())`. Update has both `using` and `with check`. This is correct and efficient.
- **Supabase security advisor:** one warning, "Leaked password protection disabled" (Auth setting, not a database issue).
- **Gaps:** no `status`/void column, no `account_id`, no transfer kind, no categories table, no `updated_at`, no database functions. `schema.sql` tells the reader to paste it in the SQL Editor, but the brief requires migrations saved under `supabase/migrations/`.

## 4. Login setup

- Email and password through Supabase Auth, with `emailRedirectTo` set to the page origin.
- Google through `signInWithOAuth` with `redirectTo` set to the page origin. If the provider is off, the page shows Supabase's error plus a hint to switch it on under Authentication > Providers.
- The page ships the project URL and the **publishable** key (`sb_publishable_…`). That is allowed by the brief. No service_role key was found in the code read.
- Session handling (listening for sign-in and sign-out, showing `Auth` or `Dashboard`) is in the part of the file that was not read. **Requires investigation.**
- If the config is missing, the page has a `configured` flag. Its fallback screen was not read.
- Auth setting to fix: leaked password protection is off.

## 5. Where "$" and "Penny Budget" appear

**"Penny Budget"**
- `index.html`: `<title>Penny Budget</title>`
- `index.html`: `<h1>Penny Budget</h1>` on the sign-in card
- `index.html`: `<strong>Penny Budget</strong>` in the top header
- `README.md`: heading text "Penny Budget: a simple budgeting web app…"
- `supabase/schema.sql`: first comment line "Penny Budget: Supabase schema"
- Vercel project name `penny-budget` and the address `penny-budget-psi.vercel.app`. Renaming these is a production setting and needs the owner's approval.
- Any more occurrences in the unread tail of `index.html` (re-run a search before the rename PR).

**"$" and USD**
- `money()` uses `Intl.NumberFormat(undefined, { currency: "USD" })`. Every total, category amount and list amount goes through it. Two problems: currency is USD, and the locale is the browser's, not `en-PH`.
- `parseAmount()` strips a leading `$` and its comment lists `"$1,234"` as valid input.
- The error text "Type it like 12.50 or 1,234.56" has no currency symbol, so it stays as is.
- Code comments mention `$0.00` and "US time". They are comments only.
- The amount input label or placeholder in the unread form may contain `$`. **Requires investigation.**

## 6. Money storage versus the integer-centavo rule

The rule: store and add money as whole centavos (integers), never floats.

**Current state: does not follow the rule. Needs improvement.**

- The database stores `numeric(12,2)` pesos-style decimals (for example `12.50`), not integer centavos.
- `supabase-js` returns `numeric` as a number or string. The app does `Number(d.amount)`, which turns it into a floating-point number.
- `parseAmount()` returns `Math.round(Number(norm) * 100) / 100`, a float again. Typing `1.005` is rejected by the regex (more than 2 decimals), which is good, but the value returned is still a float.
- Totals are built with `reduce((s, t) => s + t.amount, 0)` on floats. Sums such as `0.1 + 0.2` can drift. Display rounding hides most of it, but it breaks the rule and will show up in comparisons and tests.
- The insert sends a decimal number (`amount: amt`).
- The size check `amt >= 1e10` matches `numeric(12,2)` (max just under 10 billion). It will need re-doing in centavos.
- Safe to change now: the table is empty (0 rows), so no data conversion is needed. Plan: add `amount_centavos bigint` through a migration, switch the app to it, and only then retire the old column with the owner's approval. Never drop data without that approval.

## 7. Gaps against the PeraFlow rules

| Rule | Today | Status |
|---|---|---|
| Currency is PHP (₱) | USD, browser locale | Needs improvement |
| Timezone Asia/Manila | `today()` uses the browser's local date. A phone set to another timezone, or any user abroad, gets the wrong "today" and the wrong default month around midnight in Manila. `monthName` also uses the browser locale. | Needs improvement |
| Amounts as integer centavos | Decimals and floats (section 6) | Needs improvement |
| Transfers are not income or expenses | No transfer type, and no accounts to move money between. `kind` is limited to income and expense. | Not implemented |
| Voided entries don't count | No void. Delete is permanent, which also loses history. | Not implemented |
| Keep the transaction history | Hard delete removes the row. No audit trail. | Needs improvement |
| Financial writes are atomic | Single-row inserts only, which are atomic by nature. Transfers will need a database function. | Not applicable yet |
| New tables get RLS | Existing table has RLS and correct policies. | Fully implemented |
| No service_role key in the page | None found in the code read. | Fully implemented |
| Migrations saved under `supabase/migrations/` | Folder does not exist. Only `schema.sql`. | Not implemented |
| Progress tracking in `PROJECT_PROGRESS.md` | File not yet in the repo (separate Phase 1 task). | Not implemented |

## 8. Technical debt, bugs and risks

1. **Silent cut-off at 1,000 rows.** The month query uses `.limit(1000)`. A month with more rows would show totals that are too low, with no warning.
2. **Unpinned CDN versions.** `supabase-js@2` and `@babel/standalone@7` can change under the app. No integrity (SRI) hashes. A bad CDN update could blank the page. Pin exact versions.
3. **Babel compiles in the browser.** Slow first paint on phones, and a heavy dependency for production. Acceptable for now (the brief says keep it), but it is a known cost.
4. **One file.** Every phase adds code to `index.html`. Phase 2 will need clear sections inside the file to stay reviewable. Do not split it without the owner's agreement.
5. **Fixed category list in code.** Categories cannot be added, renamed or archived until the categories table exists (Phase 3).
6. **Delete has no confirmation.** Clicking the delete button removes the row at once. The brief asks for a confirm dialog.
7. **No automated tests.** Money helpers (`parseAmount`, `monthRange`, `shiftMonth`) are good candidates for the Phase 7 tests.
8. **`schema.sql` is not idempotent** and its instructions point at the SQL Editor. Replace with versioned migrations.
9. **Accessibility is mostly good** (labels, focus rings, `role="alert"`, 44px targets). Contrast of the muted text and the white-on-teal button should be re-checked when the emerald palette lands.
10. **Repo hygiene.** Several fix pull requests (#2 to #7) were opened for the same file. The team agreed to merge only #7 and close the rest. Check `main` after that merge to confirm it matches the file this audit read.

## 9. Security

- RLS on and correct for the one table. Good.
- Publishable key in the page is expected. No secret key seen.
- Leaked password protection is disabled in Supabase Auth. Turn it on (a dashboard setting, owner-side).
- Password minimum of 6 characters is weak. Raise it in Supabase Auth settings and in the form.
- User text (note, category) is rendered through React, so it is escaped. No `dangerouslySetInnerHTML` was seen in the code read.
- The CDN scripts run with full page access. Pinning versions and adding SRI hashes lowers that risk.

## 10. Prioritized fixes for later phases

**Do first (Phase 1, in progress)**
1. Rename to PeraFlow: title, both headings, README, `schema.sql` comment. Keep the Vercel project name until the owner approves a change.
2. Switch `money()` to PHP with the `en-PH` locale, and stop treating `$` as the expected input symbol.
3. Use Asia/Manila for "today", the default month and the displayed dates.
4. Write `PROJECT_PROGRESS.md`.

**Phase 2 (app shell)**
5. Sidebar layout, emerald and white design system, light and dark themes via CSS variables.
6. Shared components: card, button, input, table, empty state, skeleton, error, confirm dialog. Add the delete confirmation here.
7. Pin CDN versions and add SRI hashes, taking care not to touch the `tsx` Babel preset script.

**Phase 3 (core money)**
8. First migration, saved in `supabase/migrations/`: `accounts`, `categories`, and new `transactions` columns (`amount_centavos bigint`, `account_id`, `status` for void, `transfer_group_id`, `updated_at`), all with RLS.
9. Move the app to integer centavos end to end: parse to an integer, sum integers, format by dividing at display time only.
10. Add edit and void, and keep voided rows out of every total. Replace hard delete with void.
11. Transfers through one database function so both sides are written in one step, and counted as neither income nor expense.
12. Search, filters, CSV export and import. Raise or remove the 1,000-row limit with paging, and warn if a result is cut off.
13. Dashboard totals: balance, income, expenses, net cash flow.

**Phases 4 to 7**
14. Budgets, bills and loans (principal, interest and fees kept separate), goals, analytics, calendar, then the assistant (numbers always come from app code).
15. Unit tests for the money helpers, and a production readiness pass.

**Owner-side settings**
16. Finish switching on Google sign-in in Supabase and test it on the live address.
17. Turn on leaked password protection and raise the minimum password length.
18. Decide whether to rename the Vercel project and address from `penny-budget`.
