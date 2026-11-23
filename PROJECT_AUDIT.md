# PeraFlow project audit

An audit of the existing Penny Budget app (being renamed to PeraFlow), as required by Phase 1 of `PERAFLOW_BRIEF.md`.

Status labels used below: **Fully implemented**, **Partially implemented**, **Not implemented**, **Needs improvement**, **Requires investigation**.

> This file is being filled in section by section. The **Database** and **Security** sections were checked against the live Supabase project on 2026-11-23. The other sections are placeholders for the rest of the Phase 1 audit, and nothing in them should be read as a finding yet.

## Stack

_To be completed in the Phase 1 audit._

## Architecture

_To be completed in the Phase 1 audit._

## Database

**Checked:** 2026-11-23, read-only queries against the live project. Nothing was changed.

### Project

| Item | Value |
|---|---|
| Supabase project | ItzJM28's Project |
| Project ref | `hxthblueuasuqlxqkwsk` |
| Region | ap-northeast-2 |
| Status | **Running** and reachable |

The other Supabase project, `doit-tasks`, is paused. PeraFlow doesn't use it.

### Table `public.transactions`

This is the only app table. It holds **0 rows**.

| Column | Type | Default / rule |
|---|---|---|
| `id` | uuid, primary key | `gen_random_uuid()` |
| `user_id` | uuid, not null | `auth.uid()`; foreign key to `auth.users(id)`, on delete cascade |
| `kind` | text, not null | check: `income` or `expense` only |
| `category` | text, not null | check: 1 to 60 characters |
| `note` | text, optional | check: up to 120 characters |
| `amount` | numeric(12,2), not null | check: `> 0` |
| `happened_on` | date, not null | `current_date` |
| `created_at` | timestamptz, not null | `now()` |

Index: `transactions_user_date_idx` on `(user_id, happened_on desc)` (as defined in `supabase/schema.sql`).

### Row level security

RLS is **on**. It is not forced, which is normal; forcing only affects the table owner.

All four policies apply to the `authenticated` role only, and each one is limited to `user_id = auth.uid()`:

| Policy (live name) | Action | Rule |
|---|---|---|
| Users can read their own transactions | SELECT | using `user_id = auth.uid()` |
| Users can add their own transactions | INSERT | with check `user_id = auth.uid()` |
| Users can edit their own transactions | UPDATE | using and with check `user_id = auth.uid()` |
| Users can delete their own transactions | DELETE | using `user_id = auth.uid()` |

Signed-out visitors can't read or write anything, and each signed-in person only sees their own rows.

### Findings

| Area | Status | Notes |
|---|---|---|
| Transactions table with owner-only access | **Fully implemented** | RLS on, 4 owner-only policies. |
| Money stored as integer centavos | **Needs improvement** | `amount` is `numeric(12,2)` (pesos with two decimals). The brief requires whole centavos (integers). The table is empty, so switching now carries no data risk. |
| Transfers | **Not implemented** | `kind` allows only `income` and `expense`. There's no `transfer` kind and no way to link the two sides of a transfer. |
| Void transactions | **Not implemented** | There is no `voided_at` or status column. Rows can only be deleted, which loses history. |
| Accounts | **Not implemented** | No accounts table, and transactions have no account link. |
| Categories table | **Not implemented** | `category` is free text, not a link to a categories table. |
| Migrations folder | **Not implemented** | Only `supabase/schema.sql` exists. The brief requires every change to also be saved under `supabase/migrations/`. |
| `schema.sql` matches the live database | **Needs improvement** | Same columns and rules, but the live policy names differ (for example "Users can read their own transactions" live vs "Read own transactions" in the file). The file also uses `(select auth.uid())` while the live policies use `auth.uid()` directly. Both are equally secure; the `(select ...)` form is faster on big tables. The file should be updated to match whatever the Phase 3 migration ends up with. |

### Recommended next step (Phase 3)

Because the table is empty, one additive migration is safe. It would:

1. Add `amount_centavos bigint` (whole centavos, check `> 0`).
2. Allow `transfer` as a `kind`.
3. Add a `voided_at timestamptz` column so voided entries stay in history but don't count.

Nothing gets dropped. The migration goes to the owner for approval in the Supabase tab and is also saved under `supabase/migrations/`. Accounts and categories tables follow in the same phase, each with RLS and `user_id = auth.uid()` policies.

## Auth

_To be completed in the Phase 1 audit._

## UI

_To be completed in the Phase 1 audit._

## Modules

_To be completed in the Phase 1 audit._

## Missing features

_To be completed in the Phase 1 audit._

## Technical debt

_To be completed in the Phase 1 audit._

## Bugs

_To be completed in the Phase 1 audit._

## Security

**Checked:** 2026-11-23 with the Supabase security advisor and a direct look at the table.

| Area | Status | Notes |
|---|---|---|
| RLS on every app table | **Fully implemented** | The advisor found no tables without RLS. `transactions` has RLS on with 4 owner-only policies. |
| Leaked-password protection | **Needs improvement** | **Off.** The advisor flags it as a warning. When it's on, Supabase rejects passwords that have shown up in known data leaks (checked against HaveIBeenPwned). It's a single switch in Supabase under Authentication > Sign In / Providers > Email (password security). Recommended: turn it on. |
| No secret key in the page | **Fully implemented** | Only the publishable (public) key belongs in `index.html`. No service_role key was used, requested or found during this check, and none should ever go in the page or the repo. |

## Recommendations

_To be completed in the Phase 1 audit. Database and security recommendations are listed in their sections above._
