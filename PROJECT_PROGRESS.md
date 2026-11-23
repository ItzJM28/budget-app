# PeraFlow progress

PeraFlow is the new name for Penny Budget. It is the same project and the same repo, improved step by step. The full plan is in `PERAFLOW_BRIEF.md`.

**This file is updated after every merged milestone.**

## Phase checklist

We work one phase at a time, in order.

- [ ] **Phase 1: Audit and rename** (in progress)
  - [ ] `PROJECT_AUDIT.md` written (PR #8 and PR #9 open)
  - [ ] `PROJECT_PROGRESS.md` added (this file)
  - [ ] Retry-button and loading fixes merged (PR #7, waiting for Lint's review)
  - [ ] App renamed from Penny Budget to PeraFlow (title, headings, README)
  - [ ] Currency switched to PHP (₱), with Asia/Manila dates
- [ ] **Phase 2: App shell and design system** (sidebar, emerald and white look, light and dark themes, empty/loading/error states, phone layout)
- [ ] **Phase 3: Core money features** (accounts, categories, income/expense/transfer, edit, void, search, CSV, dashboard totals)
- [ ] **Phase 4: Budgets and obligations** (budgets, bills and subscriptions, loans and debts)
- [ ] **Phase 5: Planning** (savings goals, analytics, financial calendar)
- [ ] **Phase 6: AI assistant** (explains the app's own numbers)
- [ ] **Phase 7: Quality** (tests for money math, workflow checks, production readiness)

## Milestone log

One line per milestone: date, what changed, pull request.

| Date | What changed | Pull request |
|---|---|---|
| 2026-11-23 | Added this progress file and the phase checklist | This PR (docs/project-progress) |

Open pull requests not yet in the log (they get a line once merged):

- #7: retry-button and loading fixes (needs Lint's review)
- #8: database findings in the audit
- #9: project audit

## Rules to remember

- Money is stored as whole centavos, in PHP (₱), with Asia/Manila dates.
- Transfers are not income or expenses, and voided entries don't count.
- One small pull request per task. Nothing goes to `main` without review.
- Never put passwords, keys or tokens in this repo.
