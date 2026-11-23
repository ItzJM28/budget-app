// PeraFlow data layer: the Supabase client and every read and write the app makes.
// Money arrives as whole centavos (bigint) and stays that way. Balances come from the
// database view account_balances, so the app never re-derives them on its own.

// Public project URL and publishable key: both are safe in the page. Row level security protects the data.
const SUPABASE_URL = "https://hxthblueuasuqlxqkwsk.supabase.co";
const SUPABASE_KEY = "sb_publishable_sRNP98itHiC_w7o_90iZtw_7NJjYp16";
const sb: any = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

type Kind = "income" | "expense" | "transfer";
interface Tx { id: string; kind: Kind; category: string; note: string | null; cents: number; happened_on: string; account_id: string | null; to_account_id: string | null; voided_at: string | null; created_at: string; }
interface Account { id: string; name: string; type: string; opening_centavos: number; archived_at: string | null; created_at: string; balance: number; }
interface Category { id: string; name: string; kind: "income" | "expense"; }
interface Budget { id: string; month: string; category: string; limit_centavos: number; }
interface Goal { id: string; name: string; target_centavos: number; target_date: string | null; archived_at: string | null; created_at: string; }
interface Contribution { id: string; goal_id: string; amount_centavos: number; happened_on: string; note: string | null; }
// A bill you pay each month (kind "expense") or money you receive each month (kind "income").
interface Bill { id: string; name: string; amount_centavos: number; due_day: number; category: string; account_id: string | null; active: boolean; kind: "expense" | "income"; }
interface BillPayment { id: string; bill_id: string; month: string; transaction_id: string; paid_on: string; }

const DEFAULT_CATEGORIES: [string, "income" | "expense"][] = [
  ["Food & Dining", "expense"], ["Groceries", "expense"], ["Transport", "expense"], ["Housing", "expense"],
  ["Bills & Utilities", "expense"], ["Shopping", "expense"], ["Health", "expense"], ["Entertainment", "expense"],
  ["Education", "expense"], ["Personal Care", "expense"], ["Gifts & Donations", "expense"], ["Other", "expense"],
  ["Salary", "income"], ["Freelance", "income"], ["Business", "income"], ["Allowance", "income"], ["Interest", "income"], ["Other Income", "income"],
];
const TX_COLS = "id,kind,category,note,amount_centavos,happened_on,account_id,to_account_id,voided_at,created_at";
const toTx = (d: any): Tx => ({ id: d.id, kind: d.kind, category: d.category, note: d.note, cents: Number(d.amount_centavos), happened_on: d.happened_on,
  account_id: d.account_id, to_account_id: d.to_account_id, voided_at: d.voided_at, created_at: d.created_at });
const big = (v: any) => Number(v); // bigint comes back as number or string; both are exact far beyond ₱10B

// Throws the Supabase error so callers can show it.
async function q(p: Promise<any>) { const { data, error } = await p; if (error) throw error; return data; }
// Reads every row of a query, 1000 at a time (Supabase's page limit).
async function all(make: (from: number, to: number) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = await q(make(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

interface FinanceState {
  status: "loading" | "ready" | "error"; error: string;
  accounts: Account[]; categories: Category[]; txs: Tx[]; windowStart: string;
  budgets: Budget[]; goals: Goal[]; contributions: Contribution[]; bills: Bill[]; payments: BillPayment[];
}
const FinanceCtx = createContext<any>(null);
const useFinance = () => useContext(FinanceCtx);

function FinanceProvider({ user, children }: { user: any; children: any }) {
  const thisMonth = M.monthOf(M.today());
  // The app keeps the last 12 months of transactions in memory for the dashboard and charts.
  const windowStart = M.shiftMonth(thisMonth, -11) + "-01";
  const [s, setS] = useState<FinanceState>({ status: "loading", error: "", accounts: [], categories: [], txs: [], windowStart,
    budgets: [], goals: [], contributions: [], bills: [], payments: [] });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      const [accounts, balances, categories, txs, budgets, goals, contributions, bills, payments] = await Promise.all([
        q(sb.from("accounts").select("id,name,type,opening_centavos,archived_at,created_at").order("created_at")),
        q(sb.from("account_balances").select("account_id,balance_centavos")),
        q(sb.from("categories").select("id,name,kind").order("name")),
        all((a, b) => sb.from("transactions").select(TX_COLS).gte("happened_on", windowStart)
          .order("happened_on", { ascending: false }).order("created_at", { ascending: false }).range(a, b)),
        q(sb.from("budgets").select("id,month,category,limit_centavos")),
        q(sb.from("goals").select("id,name,target_centavos,target_date,archived_at,created_at").order("created_at")),
        all((a, b) => sb.from("goal_contributions").select("id,goal_id,amount_centavos,happened_on,note").order("happened_on", { ascending: false }).range(a, b)),
        q(sb.from("bills").select("id,name,amount_centavos,due_day,category,account_id,active,kind").order("due_day")),
        all((a, b) => sb.from("bill_payments").select("id,bill_id,month,transaction_id,paid_on").range(a, b)),
      ]);
      if (id !== seq.current) return; // a newer load finished first
      const bal: Record<string, number> = {};
      balances.forEach((b: any) => { bal[b.account_id] = big(b.balance_centavos); });
      let cats = categories as Category[];
      if (!cats.length) cats = await seedCategories();
      setS({
        status: "ready", error: "", windowStart,
        accounts: accounts.map((a: any) => ({ ...a, opening_centavos: big(a.opening_centavos), balance: bal[a.id] ?? big(a.opening_centavos) })),
        categories: cats, txs: txs.map(toTx),
        budgets: budgets.map((b: any) => ({ ...b, month: String(b.month).slice(0, 7), limit_centavos: big(b.limit_centavos) })),
        goals: goals.map((g: any) => ({ ...g, target_centavos: big(g.target_centavos) })),
        contributions: contributions.map((c: any) => ({ ...c, amount_centavos: big(c.amount_centavos) })),
        bills: bills.map((b: any) => ({ ...b, amount_centavos: big(b.amount_centavos) })),
        payments: payments.map((p: any) => ({ ...p, month: String(p.month).slice(0, 7) })),
      });
    } catch (e: any) {
      if (id !== seq.current) return;
      setS((x) => ({ ...x, status: x.status === "ready" ? "ready" : "error", error: friendlyError(e) }));
      throw e;
    }
  }, [windowStart]);

  useEffect(() => { load().catch(() => {}); }, [load, user?.id]);

  async function seedCategories(): Promise<Category[]> {
    const rows = await q(sb.from("categories").insert(DEFAULT_CATEGORIES.map(([name, kind]) => ({ name, kind }))).select("id,name,kind"));
    return (rows as Category[]).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Every write reloads afterwards so balances always come from the database.
  const write = (fn: () => Promise<any>) => async () => { await fn(); await load(); };
  const api = {
    reload: load,
    // Accounts
    addAccount: (a: { name: string; type: string; opening_centavos: number }) => write(() => q(sb.from("accounts").insert(a)))(),
    updateAccount: (id: string, a: any) => write(() => q(sb.from("accounts").update(a).eq("id", id)))(),
    archiveAccount: (id: string, archived: boolean) => write(() => q(sb.from("accounts").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id)))(),
    // Transactions
    addTx: (t: any) => write(() => q(sb.from("transactions").insert(t)))(),
    updateTx: (id: string, t: any) => write(() => q(sb.from("transactions").update(t).eq("id", id)))(),
    // Voiding keeps the row (history) but takes it out of every total. A bill payment's expense
    // is undone through unpay_bill so the bill goes back to unpaid in the same step.
    voidTx: (t: Tx) => write(async () => {
      const p = s.payments.find((x) => x.transaction_id === t.id);
      if (p) await q(sb.rpc("unpay_bill", { p_bill_id: p.bill_id, p_month: p.month + "-01" }));
      else await q(sb.from("transactions").update({ voided_at: new Date().toISOString() }).eq("id", t.id));
    })(),
    restoreTx: (t: Tx) => write(() => q(sb.from("transactions").update({ voided_at: null }).eq("id", t.id)))(),
    txsForMonth: async (month: string): Promise<Tx[]> => {
      const r = M.monthRange(month);
      const rows = await all((a, b) => sb.from("transactions").select(TX_COLS).gte("happened_on", r.from).lt("happened_on", r.to)
        .order("happened_on", { ascending: false }).order("created_at", { ascending: false }).range(a, b));
      return rows.map(toTx);
    },
    // Categories
    addCategory: (name: string, kind: string) => write(() => q(sb.from("categories").insert({ name, kind })))(),
    deleteCategory: (id: string) => write(() => q(sb.from("categories").delete().eq("id", id)))(),
    // Budgets: a limit of null removes the budget for that category and month
    setBudget: (month: string, category: string, limit: number | null) => write(async () => {
      if (limit == null) await q(sb.from("budgets").delete().eq("month", month + "-01").eq("category", category));
      else await q(sb.from("budgets").upsert({ month: month + "-01", category, limit_centavos: limit }, { onConflict: "user_id,month,category" }));
    })(),
    copyBudgets: (from: string, to: string) => write(async () => {
      const rows = s.budgets.filter((b) => b.month === from).map((b) => ({ month: to + "-01", category: b.category, limit_centavos: b.limit_centavos }));
      if (rows.length) await q(sb.from("budgets").upsert(rows, { onConflict: "user_id,month,category", ignoreDuplicates: true }));
    })(),
    // Goals
    addGoal: (g: any) => write(() => q(sb.from("goals").insert(g)))(),
    updateGoal: (id: string, g: any) => write(() => q(sb.from("goals").update(g).eq("id", id)))(),
    archiveGoal: (id: string, archived: boolean) => write(() => q(sb.from("goals").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id)))(),
    addContribution: (c: any) => write(() => q(sb.from("goal_contributions").insert(c)))(),
    deleteContribution: (id: string) => write(() => q(sb.from("goal_contributions").delete().eq("id", id)))(),
    // Bills
    addBill: (b: any) => write(() => q(sb.from("bills").insert(b)))(),
    updateBill: (id: string, b: any) => write(() => q(sb.from("bills").update(b).eq("id", id)))(),
    deleteBill: (id: string) => write(() => q(sb.from("bills").delete().eq("id", id)))(),
    // Saves the expense and the payment record together in one database call.
    payBill: (billId: string, month: string, accountId: string, paidOn: string, cents: number) =>
      write(() => q(sb.rpc("pay_bill", { p_bill_id: billId, p_month: month + "-01", p_account_id: accountId, p_paid_on: paidOn, p_amount_centavos: cents })))(),
    unpayBill: (billId: string, month: string) => write(() => q(sb.rpc("unpay_bill", { p_bill_id: billId, p_month: month + "-01" })))(),
  };

  const value = useMemo(() => {
    const live = s.accounts.filter((a) => !a.archived_at);
    const acctName = (id: string | null) => s.accounts.find((a) => a.id === id)?.name || "No account";
    const paidFor = (month: string) => { const m: Record<string, BillPayment> = {}; s.payments.forEach((p) => { if (p.month === month) m[p.bill_id] = p; }); return m; };
    return { ...s, api, thisMonth, live, acctName, paidFor };
  }, [s]);
  return <FinanceCtx.Provider value={value}>{children}</FinanceCtx.Provider>;
}
