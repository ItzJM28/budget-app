# PeraFlow project audit

Audit of the existing app (formerly Penny Budget) before the PeraFlow work starts. Written for Phase 1 of `PERAFLOW_BRIEF.md`.

- **Audited:** 2026-11-23. Database section re-checked against the live project after migration `transactions_centavos_transfer_void` (20261123143333).
- **Sources:** `index.html` on `main` (first 20,000 of 24,710 characters; see "Limits of this audit"), `supabase/schema.sql`, `README.md`, `PERAFLOW_BRIEF.md`, and read-only queries against Supabase project "ItzJM28's Project" (ref `hxthblueuasuqlxqkwsk`).
- **Status labels:** Fully implemented · Partially implemented · Not implemented · Needs improvement · Requires investigation.

## Limits of this audit

The file reader stops at 20,000 characters, so the last ~4,700 characters of `index.html` were not read. That part holds the add-transaction form body, the transaction list, the root component (session handling) and the render call. Anything that depends on it is marked **Requires investigation**, not guessed.

## 1. Stack

| Part | What's used | Status |
|---|---|---|
| UI | React 18.3.1 (UMD from jsDelivr, pinned) | Fully implemented |
| Language | TypeScript compiled in the browser by `@babel/standalone@7` with the custom `tsx` preset | Fully implemented. **Keep the preset script.** |
| Database client | `@supabase/supabase-js@2` (UMD from jsDelivr) | Fully implemented |
| Database and auth | Supabase, project "ItzJM28's Project" | Fully implemented |
| Hosting | Vercel project `penny-budget`, merge to `main` deploys production | Fully implemented |
| Build step | None (no package.json) | By design |

**Needs improvement:** `supabase-js@2` and `@babel/standalone@7` are major-version ranges, not exact versions. A new upstream release could change the live app without any commit. Pin exact versions.

## 2. Architecture

- One file, `index.html`: CSS in a `<style>` block, all app code in one `text/babel` script.
- Components seen: `Auth`, `Dashboard`, `GoogleIcon`, `Chevron`. The root component is in the unread part.
- Data loading: one query per month (`happened_on` from the 1st up to the 1st of next month), `.limit(1000)`, with request-id guarding so a slow old answer can't overwrite a newer month.
- The publishable key is in the page. That's allowed by the brief. No service_role key was found in the part that was read.

## 3. Database (live, re-checked after `transactions_centavos_transfer_void`)

### 3.1 Migrations applied

| Version | Name | In repo? |
|---|---|---|
| 20261123040428 | `create_transactions` | Only as `supabase/schema.sql` (not as a migration file) |
| 20261123143333 | `transactions_centavos_transfer_void` | **No.** There is no `supabase/migrations/` folder on `main`. Written by Bed and approved by Bob, it ran at 14:33. Bed is saving it to the repo. |

**Breaks brief rule 3** (every change saved under `supabase/migrations/`). Status: **Needs improvement** until both migrations are in the repo.

### 3.2 Table `public.transactions` (0 rows)

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | primary key, default `gen_random_uuid()` |
| `user_id` | uuid | default `auth.uid()`, FK to `auth.users(id)` |
| `kind` | text | `income`, `expense` or **`transfer`** |
| `category` | text | 1–60 characters |
| `note` | text, nullable | up to 120 characters |
| `amount` | numeric(12,2) | > 0. **Legacy pesos value**, kept in sync by trigger |
| `amount_centavos` | **bigint, not null** | > 0. **Source of truth for money** (whole PHP centavos) |
| `voided_at` | timestamptz, nullable | null = active; a date = voided, must not count anywhere |
| `happened_on` | date | default `current_date` |
| `created_at` | timestamptz | default `now()` |

**Trigger `transactions_sync_amount`** (BEFORE INSERT, or UPDATE OF `amount`/`amount_centavos`; function has `search_path=''`, not security definer):
- Insert with only `amount`: fills `amount_centavos = round(amount * 100)`. This is why today's Add button still saves.
- Insert with only `amount_centavos`: fills `amount = amount_centavos / 100`.
- Insert with both and they disagree: rejected with an error.
- Update: whichever column changed drives the other.

**Indexes:**
- `transactions_pkey` (id)
- `transactions_user_date_idx` (user_id, happened_on desc)
- `transactions_user_active_date_idx` (user_id, happened_on desc) **where `voided_at is null`**, the active-rows index for totals

### 3.3 Row level security

RLS is **on**. Four policies, each limited to the row owner:

| Live policy name | Command | Check |
|---|---|---|
| Users can read their own transactions | SELECT | `user_id = auth.uid()` |
| Users can add their own transactions | INSERT | `user_id = auth.uid()` |
| Users can edit their own transactions | UPDATE | `user_id = auth.uid()` (using and with check) |
| Users can delete their own transactions | DELETE | `user_id = auth.uid()` |

Status: **Fully implemented** for access control.

**Needs improvement: policy wording drifts from `schema.sql`.** The repo file names them "Read/Add/Edit/Delete own transactions" and uses `(select auth.uid())`, which Postgres evaluates once per query instead of once per row. Live and repo should match. Fix in a migration (drop and recreate the policies with the same meaning inside one transaction, with no gap in protection), then update `schema.sql`.

### 3.4 Grants

| Role | Live grants | `schema.sql` grants |
|---|---|---|
| `authenticated` | SELECT, INSERT, UPDATE, DELETE, **TRUNCATE, REFERENCES, TRIGGER** | SELECT, INSERT, UPDATE, DELETE |
| `anon` | none | none |

**Needs improvement (security):** TRUNCATE ignores RLS and could wipe every user's rows. The web client (PostgREST) can't send TRUNCATE, so the real risk is low, but the grant shouldn't exist. Revoke TRUNCATE, REFERENCES and TRIGGER from `authenticated` in a migration. Bed drafted this earlier; it has not been applied.

### 3.5 Schema vs. app

`supabase/schema.sql` still describes the pre-migration table (`kind` only income/expense, no `amount_centavos`, no `voided_at`). It must be updated when the migration files land.

## 4. Auth

| Feature | Status | Notes |
|---|---|---|
| Email + password sign-in and sign-up | Fully implemented | 6-character minimum checked in the app; confirmation email message shown |
| Google sign-in | Partially implemented | Button and `signInWithOAuth` exist. Whether the Google provider is switched on in Supabase is **Requires investigation** (brief says the owner is doing it). |
| Log out | Fully implemented | Header button |
| Session handling (restore on reload, auth state listener) | Requires investigation | In the unread part of `index.html` |
| Leaked password protection | Not implemented | Supabase security warning `auth_leaked_password_protection`. Switch on in Auth settings. |

## 5. UI

| Feature | Status | Notes |
|---|---|---|
| Layout | Partially implemented | Single column with top header. No sidebar (Phase 2). |
| Design tokens | Partially implemented | CSS variables, teal accent `#0f6b63`, not the emerald system from the brief |
| Dark mode | Not implemented | |
| Loading, failed-load with Try again, empty states | Fully implemented | Totals show "Loading…" / "Not loaded", never a fake 0 |
| Focus rings, 44px targets, reduced motion | Fully implemented | |
| Mobile | Partially implemented | Grids collapse under 760px; full phone check after Phase 2 |
| Add-transaction form layout and transaction list layout | Requires investigation | Unread part |

## 6. Modules

| Module | Status | Notes |
|---|---|---|
| Month picker (prev/next, month input) | Fully implemented | |
| Dashboard totals: Income, Spent, Left this month | Partially implemented | Float math, counts voided rows (see 8) |
| Spending by category | Partially implemented | Same issues |
| Add transaction | Partially implemented | Income/expense only, fixed category list, sends pesos in `amount` |
| Delete transaction | Partially implemented | Hard delete. Brief wants void + keep history. |
| Delete confirm step | **Requires investigation** | `remove()` itself doesn't ask. The button that calls it is in the unread part and may ask. |
| Edit transaction | Not implemented | |
| Void transaction | Not implemented in the app | Column exists in the database |
| Transfer | Not implemented in the app | Allowed by the database |
| Search, filters, CSV import/export | Not implemented | |
| Accounts, categories table, split, recurring | Not implemented | |
| Budgets, bills, loans, goals, analytics, calendar, AI assistant | Not implemented | Phases 4–6 |

## 7. Missing features

Everything in Phases 3–6 of the brief that isn't listed above as implemented: accounts with opening balances, categories table, transfers, edit, void, search, CSV, split/recurring, safe-to-spend, budgets, bills and subscriptions, loans and debts, savings goals, analytics, financial calendar, AI assistant. Plus dark mode and the sidebar shell (Phase 2).

## 8. Technical debt and bugs

1. **Money math uses floats.** `load()` maps rows to `Number(d.amount)` and totals add JavaScript decimals. `parseAmount` returns pesos rounded to 2 decimals. The database now has `amount_centavos`, but the app neither reads nor writes it. **Needs improvement (Phase 3):** select `amount_centavos`, add integers, convert only at display.
2. **Voided rows still count.** The load query selects `id,kind,category,note,amount,happened_on`. It neither selects nor filters `voided_at`, so once voiding exists, voided entries would appear in the list and in Income, Spent and the category breakdown. Safe today (0 rows, no way to void yet). **Must be fixed in Phase 3 before the Void button ships:** add `.is("voided_at", null)` to totals queries.
3. **The `Kind` type is `"income" | "expense"`.** Totals filter by kind, so a transfer row wouldn't be counted as income or spending (correct), but how the list would show it is **Requires investigation**.
4. **Currency is USD.** `money()` uses `Intl.NumberFormat(undefined, { currency: "USD" })`; `parseAmount` strips a leading `$`. Phase 1 rename task switches to PHP (₱).
5. **Dates follow the browser, not Asia/Manila.** `today()` builds the date from the device clock, and `monthName()` formats with `toLocaleDateString(undefined, …)`, so the device's locale and time zone apply. Both should use `Asia/Manila` (and a fixed `en-PH` locale for `monthName`).
6. **1,000-row cap per month.** `.limit(1000)` silently cuts off larger months. Whether the user gets a warning is **Requires investigation**.
7. **Fixed category list** (`CATS`) in code. Replaced by a categories table in Phase 3.
8. **Name is still "Penny Budget"** in `<title>`, the sign-in heading, the header, `README.md` and the comment at the top of `schema.sql`. Other mentions in the unread part: **Requires investigation**.
9. **Unpinned CDN versions** (see 1).

## 9. Security

| Item | Status |
|---|---|
| RLS on `transactions`, owner-only policies | Fully implemented |
| Only the publishable key in the page | Fully implemented (in the part read) |
| `anon` has no table grants | Fully implemented |
| Extra `authenticated` grants: TRUNCATE, REFERENCES, TRIGGER | Needs improvement: revoke in a migration |
| Policy wording differs from `schema.sql` (`auth.uid()` vs `(select auth.uid())`, different names) | Needs improvement |
| Migrations not saved under `supabase/migrations/` | Needs improvement |
| Leaked password protection off | Needs improvement |
| Trigger function `transactions_sync_amount` | OK: not security definer, `search_path` locked to `''` |

## 10. Recommendations (in order)

1. **Phase 1 (now):** merge this audit and `PROJECT_PROGRESS.md`. Rename to PeraFlow and switch to ₱ with Asia/Manila for both `today()` and `monthName()`. That needs the full `index.html` read first.
2. **Repo hygiene (Bed):** add `supabase/migrations/20261123040428_create_transactions.sql` and `supabase/migrations/20261123143333_transactions_centavos_transfer_void.sql` with the exact SQL that ran. Update `schema.sql` to match the live table.
3. **Small security migration (Bed):** revoke TRUNCATE, REFERENCES and TRIGGER from `authenticated`, and recreate the four policies with `(select auth.uid())` and the repo's names. Ship it as one reviewed migration, also saved in the repo.
4. **Owner:** switch on leaked password protection, and confirm Google is enabled under Authentication > Providers.
5. **Phase 3 money work:** read/write `amount_centavos` only, integer math, filter `voided_at is null` everywhere totals are computed, replace hard delete with void, and add transfers as one atomic database function.
6. Pin `supabase-js` and `@babel/standalone` to exact versions.

## Requires investigation (summary)

- Delete has a confirm step or not (button is in the unread part).
- Warning when a month hits the 1,000-row limit.
- Add-form and list layout; how a `transfer` row would render.
- Session restore and auth listener.
- Further "Penny Budget" or "$" text in the unread part.
- Google provider switched on in Supabase.
