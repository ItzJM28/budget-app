# PeraFlow project audit

Audit of the existing app (still branded Penny Budget) before the PeraFlow work. Phase 1 of `PERAFLOW_BRIEF.md`.

- **Checked:** 2026-11-23, against `main`, `supabase/schema.sql`, `README.md` and the live Supabase project (read-only queries only).
- **Supersedes PR #8.** The database and security findings from #8 are merged into this file, so #8 can be closed.
- **Status labels:** Fully implemented · Partially implemented · Not implemented · Needs improvement · Requires investigation.
- **Limit of this audit:** the file reader returns the first 20,000 of `index.html`'s 24,710 characters. The last part (rest of the add form, the transaction list, the sign-in session handling and the render call) was not read. Anything that depends on it is marked *Requires investigation* instead of guessed.

---

## 1. Stack

| Part | What it is | Status |
|---|---|---|
| Page | One file, `index.html`. No build step, no `package.json`. | Fully implemented |
| UI | React 18.3.1 (UMD from jsDelivr) | Fully implemented |
| Language | TypeScript compiled in the browser by `@babel/standalone@7` | Fully implemented |
| Babel fix | Inline script registers the `tsx` preset (`allExtensions:true,isTSX:true`); app script uses `data-presets="tsx,react"`. Must stay (see PR #7). | Fully implemented |
| Database and auth | `@supabase/supabase-js@2` (UMD from jsDelivr), project "ItzJM28's Project" (ref `hxthblueuasuqlxqkwsk`) | Fully implemented |
| Hosting | Vercel project `penny-budget`, https://penny-budget-psi.vercel.app. A merge to `main` deploys production. | Fully implemented |

**Needs improvement:** `supabase-js@2` and `@babel/standalone@7` are pinned to a major version only, so a new minor release reaches production without anyone checking it. In-browser Babel also makes first load slower. That's fine for now, and the brief keeps it.

## 2. Architecture

- One `<script type="text/babel">` with every component: `Auth`, `Dashboard`, small icon components, and helpers (`money`, `today`, `parseAmount`, `monthRange`, `shiftMonth`, `monthName`).
- Supabase client created in the page with the **publishable** key. That's allowed; RLS protects the data. No service_role key appears in the readable part of the page.
- Data loading: `Dashboard` fetches one month (`happened_on >= 1st` and `< 1st of next month`), newest first, up to 1,000 rows. A request counter (`reqId`) ignores out-of-date answers.
- Totals are calculated in the browser from the loaded rows.

## 3. Database (live, checked 2026-11-23)

One table: `public.transactions`. **0 rows.** **RLS on.**

| Column | Type | Rules | Notes |
|---|---|---|---|
| `id` | uuid | primary key, default `gen_random_uuid()` | |
| `user_id` | uuid | default `auth.uid()`, FK to `auth.users(id)` | |
| `kind` | text | `income`, `expense` or `transfer` | `transfer` added by the Phase 3 migration |
| `category` | text | 1 to 60 characters | free text, no categories table yet |
| `note` | text | nullable, up to 120 characters | |
| `amount_centavos` | bigint | not null, `> 0` | **Source of truth for all money math.** Whole PHP centavos. |
| `amount` | numeric(12,2) | not null, `> 0` | **Legacy** peso value. Kept only so today's app keeps working. Filled by the sync trigger. |
| `voided_at` | timestamptz | nullable | Null = entry counts. A date = voided; must not change any total or balance. |
| `happened_on` | date | default `current_date` | `current_date` is the database's date (UTC), not Asia/Manila; the app always sends its own date, so this only matters if that ever changes. |
| `created_at` | timestamptz | default `now()` | |

### Sync trigger `transactions_sync_amount`

Runs `BEFORE INSERT OR UPDATE OF amount, amount_centavos`.

- **Insert:** if only `amount` is sent, it fills `amount_centavos = round(amount * 100)`. If only `amount_centavos` is sent, it fills `amount = amount_centavos / 100`. If both are sent and disagree, the insert is **rejected**. This is why today's Add button (which sends `amount` in pesos) still works.
- **Update:** if `amount_centavos` changed, `amount` is recalculated from it. Otherwise, if `amount` changed, `amount_centavos` is recalculated. **Needs improvement:** an update that changes both to values that disagree is not rejected. `amount_centavos` silently wins. The new edit form must send `amount_centavos` only.

### Indexes

- `transactions_pkey` on `id`
- `transactions_user_date_idx` on `(user_id, happened_on desc)`
- `transactions_user_active_date_idx` on `(user_id, happened_on desc) where voided_at is null` (added for non-voided lists and totals)

### Policies (live)

All for role `authenticated`, all limited to the row owner:

| Policy | Command | Check |
|---|---|---|
| Users can read their own transactions | SELECT | `user_id = auth.uid()` |
| Users can add their own transactions | INSERT | `user_id = auth.uid()` |
| Users can edit their own transactions | UPDATE | `user_id = auth.uid()` (using and with check) |
| Users can delete their own transactions | DELETE | `user_id = auth.uid()` |

### Migrations

Supabase lists two migrations, both **applied**:

| Version | Name | Status |
|---|---|---|
| 20261123040428 | `create_transactions` | Applied |
| 20261123143333 | `transactions_centavos_transfer_void` | **Applied.** Written by Bed, approved on the owner's behalf by Bob (their approver). Not on hold. |

### Database findings

| # | Finding | Status |
|---|---|---|
| D1 | **Migrations aren't saved in the repo.** There is no `supabase/migrations/` folder. Both applied migrations need saving as files (brief rule 3). Bed has taken this. | Needs improvement |
| D2 | **`supabase/schema.sql` is out of date.** It still has `kind in ('income','expense')`, no `amount_centavos`, no `voided_at`, no sync trigger, no partial index, and different policy names and wording (`(select auth.uid())`) from the live ones. Running it on a fresh project would build the old table. | Needs improvement |
| D3 | **Policy wording.** Live policies call `auth.uid()` per row; `(select auth.uid())` lets Postgres call it once per query. Same result, slower on big tables. Low priority while the table is small. | Needs improvement |
| D4 | **Old `amount` column.** Keep until every reader and writer uses `amount_centavos`, then retire it with a migration. Never drop it without the owner's approval. | Partially implemented |
| D5 | **No atomic transfer.** `transfer` is allowed as a kind, but there's no accounts table and no database function that writes both sides of a transfer in one step (brief money rule). Phase 3. | Not implemented |

## 4. Security (folded in from PR #8)

| # | Finding | Status |
|---|---|---|
| S1 | **Leaked password protection is off.** Supabase's security check reports `auth_leaked_password_protection` (WARN): sign-ups aren't checked against known leaked passwords (HaveIBeenPwned). The owner can switch it on in Supabase under Authentication > Passwords. It's a settings change, not code. | Needs improvement |
| S2 | **Extra table rights for signed-in users.** Role `authenticated` has `TRUNCATE`, `REFERENCES` and `TRIGGER` on `public.transactions`, besides the `SELECT, INSERT, UPDATE, DELETE` that `schema.sql` grants. **TRUNCATE ignores RLS**, so any signed-in user with a direct API connection that allows it could empty the whole table, including other people's rows. These come from Supabase's default grants. Fix: a migration revoking `TRUNCATE, REFERENCES, TRIGGER` from `authenticated` (and `anon`, if present). Still not applied, checked 2026-11-23. | Needs improvement (high) |
| S3 | **RLS is on** with owner-only policies for all four commands. | Fully implemented |
| S4 | **Only the publishable key is in the page.** No service_role key in the readable part of `index.html` or in the repo. | Fully implemented (last 4,700 chars: Requires investigation) |
| S5 | **Password minimum is 6 characters** (checked in the page and Supabase's default). Consider 8+ with S1. | Needs improvement |

## 5. Auth

| Feature | Status |
|---|---|
| Email + password log in and register, with "check your email" message when confirmation is required | Fully implemented |
| Google sign-in button (`signInWithOAuth`, redirect to the site) with a helpful error if the provider is off | Partially implemented (the owner is still switching Google on in Supabase) |
| Session handling and the switch between `Auth` and `Dashboard` | Requires investigation (in the unread part) |
| Log out button | Fully implemented |
| Password reset | Not implemented |

## 6. UI

- Single page: dark teal header (`#0f3d3e`), month picker with previous/next, three stat cards (Income, Spent, Left this month), add-transaction form, category breakdown bars, transaction list.
- Good: 44px tap targets, visible focus ring, `100dvh`, safe-area padding, reduced-motion support, tabular numbers, Loading / Not loaded states that never show a fake 0, a Try again box for failed loads.
- **Not implemented:** sidebar navigation, dark theme, shared component styles, skeletons, confirm dialog (Phase 2). Colour is teal, not the emerald/white system in the brief.

## 7. Modules

| Module | Status |
|---|---|
| Monthly dashboard totals | Partially implemented (income/expense only; ignores transfers and voids, see B1, B2) |
| Add transaction (income/expense) | Fully implemented for 2 kinds; transfer Not implemented in the UI |
| Delete transaction | Fully implemented (checks rows really were deleted). Confirm step: Requires investigation |
| Edit transaction | Not implemented |
| Void transaction | Not implemented in the UI (column exists) |
| Category breakdown (expenses) | Fully implemented |
| Search, filters, CSV import/export | Not implemented |
| Accounts, categories table, split and recurring transactions | Not implemented |
| Budgets, bills, loans, goals, analytics, calendar, AI assistant | Not implemented |

## 8. Bugs and money-rule gaps

| # | Issue | Status |
|---|---|---|
| B1 | **Voided entries would still count.** The load selects `id,kind,category,note,amount,happened_on`, without `voided_at`, and doesn't filter `voided_at is null`. Nothing is voided yet (0 rows), so no wrong totals today, but this must be fixed before any Void button ships. | Needs improvement (blocks Void) |
| B2 | **Money math uses floating-point pesos.** The app reads `amount` and adds with `Number`. The brief requires whole centavos: read `amount_centavos`, add integers, divide by 100 only for display. | Needs improvement |
| B3 | **Transfers would break totals.** The `Kind` type is `"income" | "expense"`. A `transfer` row would be skipped by both totals today (correct by accident), but the list styling and category breakdown don't know about it. | Needs improvement |
| B4 | **Dates use the browser's time zone**, not Asia/Manila: `today()` uses local `Date`, and `monthName()` uses the browser's language and time zone. Someone travelling or with a mis-set clock files entries on the wrong day/month. | Needs improvement |
| B5 | 1,000-row limit per month with no notice when it's hit. | Needs improvement |

## 9. Rename, ₱ and Asia/Manila: what still has to change

Nothing below is done on `main` yet. This is the checklist for the "Rename to PeraFlow and switch to ₱" task. That task is blocked only on reading the last 4,700 characters of `index.html` safely before committing the whole file.

**Rename (Penny Budget → PeraFlow)**
- [ ] `<title>Penny Budget</title>`
- [ ] `<h1>Penny Budget</h1>` on the sign-in card
- [ ] `<strong>Penny Budget</strong>` in the header
- [ ] Any other mentions in the unread end of `index.html` (Requires investigation)
- [ ] `README.md` (title line and description)
- [ ] `supabase/schema.sql` header comment
- [ ] Vercel project name stays `penny-budget` (changing it would change the address; owner decision)

**Currency (USD → PHP ₱)**
- [ ] `money()` uses `currency: "USD"` with the browser locale → `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })`, taking **centavos** and dividing by 100 only for display
- [ ] `parseAmount()` strips a leading `$` → accept `₱` (and `PHP`), return whole centavos
- [ ] Error text "Type it like 12.50 or 1,234.56" and the 10,000,000,000 limit → re-express in ₱; limit in centavos
- [ ] Insert sends `amount` (pesos) → send `amount_centavos` only
- [ ] Load selects `amount` → select `amount_centavos` and `voided_at`; filter `voided_at is null` for totals

**Dates (browser → Asia/Manila)**
- [ ] `today()` → `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })`
- [ ] `monthName()` → `en-PH` with `timeZone: "Asia/Manila"`
- [ ] Default month on open (`today().slice(0, 7)`) follows from the fixed `today()`
- [ ] Any date shown in the list (unread part): Requires investigation

## 10. Technical debt

- Everything in one file; fine for now, will get long in Phase 3. Split into clear sections inside the file rather than adding a build step.
- Categories are a hard-coded list (`CATS`) shared by income and expense.
- `any` types for Supabase results and events.
- Supabase table rights and schema file drift (D1, D2, S2).

## 11. Recommendations, in order

1. **Close PR #8**; this file replaces it.
2. **Revoke the extra grants (S2)** with a small migration, saved under `supabase/migrations/`. Bed.
3. **Save both applied migrations** as files and bring `schema.sql` up to date (D1, D2). Bed.
4. **Owner: switch on leaked password protection (S1)** in Supabase.
5. **Do the rename/₱/Asia-Manila change (section 9)** as one PR, once the full `index.html` can be read.
6. **Phase 3:** read `amount_centavos`, filter voided rows, then add Edit, Void and Transfer (with an atomic transfer function).
