# PeraFlow

Personal finance for the Philippines. Track your accounts, spending, budgets, bills and savings goals, all in pesos.

Live at https://peraflowph.vercel.app (the old https://penny-budget-psi.vercel.app address still works). The app is hosted on Vercel and uses Supabase for sign-in and data.

## Files

| Path | What it is |
|---|---|
| `index.html` | Loads the libraries and the app files. Keep the `tsx` Babel preset script, or the page goes blank. |
| `styles.css` | The design system: light and dark themes, an emerald accent. |
| `src/money.js` | Money and date math, in whole centavos and Asia/Manila time. |
| `src/ui.tsx` | Icons, buttons, cards, dialogs and charts. |
| `src/data.tsx` | The Supabase client and every read and write. |
| `src/forms.tsx` | Forms for transactions, accounts, bills, goals and payments. |
| `src/pages.tsx` | The Dashboard, Transactions, Accounts, Monthly income, Budgets, Bills, Goals and Settings pages. |
| `src/app.tsx` | Sign-in, the sidebar, routing and the theme. |
| `supabase/migrations/` | Every database change, in order. |
| `tests/money.test.js` | Run with `node tests/money.test.js`. |

There's no build step. Vercel serves these files as they are, and the browser compiles the `.tsx` files.

See `PERAFLOW_BRIEF.md` for the product spec and `PROJECT_PROGRESS.md` for what's done.
