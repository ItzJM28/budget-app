// PeraFlow forms: transactions, accounts, bills, payments, goals and contributions.
// Every amount is typed as text and parsed to whole centavos with PFMoney.parseAmount.

function useAmount(initial = "") {
  const [text, setText] = useState(initial);
  const [err, setErr] = useState("");
  const cents = M.parseAmount(text);
  const check = () => { const p = M.amountProblem(cents); setErr(p); return !p; };
  return { text, setText: (v: string) => { setText(v); setErr(""); }, cents, err, check };
}
function AmountInput({ id, amt, label = "Amount", autoFocus }: { id: string; amt: any; label?: string; autoFocus?: boolean }) {
  return (
    <Field label={label} id={id} error={amt.err}>
      <input id={id} className="input num" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amt.text} autoFocus={autoFocus}
        aria-invalid={!!amt.err} onChange={(e: any) => amt.setText(e.target.value)} />
    </Field>
  );
}
function AccountSelect({ id, value, onChange, accounts, label, exclude }: { id: string; value: string; onChange: (v: string) => void; accounts: Account[]; label: string; exclude?: string }) {
  return (
    <Field label={label} id={id}>
      <select id={id} className="input" value={value} onChange={(e: any) => onChange(e.target.value)}>
        {accounts.filter((a) => a.id !== exclude).map((a) => <option key={a.id} value={a.id}>{a.name} · {M.ACCOUNT_TYPES[a.type]}</option>)}
      </select>
    </Field>
  );
}

/* ── Transaction ─────────────────────────────────────────────────────── */
function TxForm({ tx, preset, onClose }: { tx?: Tx; preset?: { kind?: Kind; account_id?: string }; onClose: () => void }) {
  const f = useFinance(), toast = useToast();
  const accounts: Account[] = f.live.length ? f.live : f.accounts;
  const [kind, setKind] = useState<Kind>(tx?.kind || preset?.kind || "expense");
  const amt = useAmount(tx ? M.toInput(tx.cents) : "");
  const [date, setDate] = useState(tx?.happened_on || M.today());
  const [acct, setAcct] = useState(tx?.account_id || preset?.account_id || accounts[0]?.id || "");
  const [toAcct, setToAcct] = useState(tx?.to_account_id || accounts.find((a) => a.id !== (tx?.account_id || preset?.account_id || accounts[0]?.id))?.id || "");
  const cats = f.categories.filter((c: Category) => c.kind === (kind === "income" ? "income" : "expense"));
  const [cat, setCat] = useState(tx && tx.kind !== "transfer" ? tx.category : "");
  const [note, setNote] = useState(tx?.note || "");
  const catValue = cats.some((c: Category) => c.name === cat) || (tx && cat === tx.category) ? cat : cats[0]?.name || "";

  async function save() {
    if (!amt.check()) return "Check the amount.";
    if (!date) return "Pick a date.";
    if (!acct) return "Choose an account.";
    if (kind === "transfer" && (!toAcct || toAcct === acct)) return "Choose two different accounts for a transfer.";
    if (kind !== "transfer" && !catValue) return "Choose a category.";
    const row: any = {
      kind, amount_centavos: amt.cents, happened_on: date, account_id: acct, note: note.trim() || null,
      category: kind === "transfer" ? "Transfer" : catValue, to_account_id: kind === "transfer" ? toAcct : null,
    };
    if (tx) await f.api.updateTx(tx.id, row); else await f.api.addTx(row);
    toast(tx ? "Transaction updated." : kind === "transfer" ? "Transfer saved." : "Transaction saved.");
  }
  if (!accounts.length) return <Modal title="Add an account first" onClose={onClose}><div className="modal-b"><p className="muted">Every transaction belongs to an account, like Cash, your bank or GCash. Add one on the Accounts page first.</p></div></Modal>;
  return (
    <FormModal title={tx ? "Edit transaction" : "Add transaction"} onClose={onClose} onSubmit={save} submitLabel={tx ? "Save changes" : "Save"}>
      <Seg full label="Type" value={kind} onChange={(v) => setKind(v as Kind)} options={[["expense", "Expense"], ["income", "Income"], ...(accounts.length > 1 || kind === "transfer" ? [["transfer", "Transfer"]] as [string, string][] : [])]} />
      <div className="form-grid">
        <AmountInput id="tx-amt" amt={amt} autoFocus />
        <Field label="Date" id="tx-date"><input id="tx-date" type="date" className="input" value={date} onChange={(e: any) => setDate(e.target.value)} /></Field>
        <AccountSelect id="tx-acct" label={kind === "transfer" ? "From account" : kind === "income" ? "Into account" : "Paid from"} value={acct} onChange={setAcct} accounts={accounts} />
        {kind === "transfer"
          ? <AccountSelect id="tx-to" label="To account" value={toAcct} onChange={setToAcct} accounts={accounts} exclude={acct} />
          : <Field label="Category" id="tx-cat">
              <select id="tx-cat" className="input" value={catValue} onChange={(e: any) => setCat(e.target.value)}>
                {tx && !cats.some((c: Category) => c.name === tx.category) && tx.kind !== "transfer" && <option value={tx.category}>{tx.category}</option>}
                {cats.map((c: Category) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>}
        <Field className="full" label="Note (optional)" id="tx-note" hint={kind === "transfer" ? "Transfers move money between your accounts. They don't count as income or spending." : undefined}>
          <input id="tx-note" className="input" maxLength={120} value={note} onChange={(e: any) => setNote(e.target.value)} placeholder={kind === "income" ? "e.g. November salary" : kind === "transfer" ? "e.g. Cash in to GCash" : "e.g. Weekly groceries"} />
        </Field>
      </div>
    </FormModal>
  );
}

/* ── Account ─────────────────────────────────────────────────────────── */
function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const f = useFinance(), toast = useToast();
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState(account?.type || "bank");
  const owed = type === "credit";
  const amt = useAmount(account ? M.toInput(account.opening_centavos) : "0");
  async function save() {
    const n = name.trim();
    if (!n) return "Give the account a name.";
    const c = M.parseAmount(amt.text || "0");
    if (Number.isNaN(c)) return "Check the starting balance. Type it like 1,500 or 0.";
    if (c >= M.MAX_CENTAVOS) return "That balance is too large.";
    // A credit card's starting balance is money owed, so it's stored as a negative number.
    const opening = owed ? -c : c;
    if (account) await f.api.updateAccount(account.id, { name: n, type, opening_centavos: opening });
    else await f.api.addAccount({ name: n, type, opening_centavos: opening });
    toast(account ? "Account updated." : `${n} added.`);
  }
  return (
    <FormModal title={account ? "Edit account" : "Add account"} onClose={onClose} onSubmit={save} submitLabel={account ? "Save changes" : "Add account"}>
      <div className="form-grid">
        <Field label="Name" id="ac-name"><input id="ac-name" className="input" maxLength={60} value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. BPI Savings, GCash, Wallet" /></Field>
        <Field label="Type" id="ac-type">
          <select id="ac-type" className="input" value={type} onChange={(e: any) => setType(e.target.value)}>
            {Object.keys(M.ACCOUNT_TYPES).map((k) => <option key={k} value={k}>{M.ACCOUNT_TYPES[k]}</option>)}
          </select>
        </Field>
        <Field className="full" label={owed ? "Amount owed when you added it" : "Starting balance"} id="ac-open"
          hint={owed ? "What you owed on this card on the day you started tracking it." : "What's in this account today, before any transactions you add here."}>
          <input id="ac-open" className="input num" inputMode="decimal" value={amt.text} onChange={(e: any) => amt.setText(e.target.value)} />
        </Field>
      </div>
    </FormModal>
  );
}

/* ── Bill ───────────────────────────────────────────────────────────── */
function BillForm({ bill, onClose }: { bill?: Bill; onClose: () => void }) {
  const f = useFinance(), toast = useToast();
  const cats = f.categories.filter((c: Category) => c.kind === "expense");
  const [name, setName] = useState(bill?.name || "");
  const amt = useAmount(bill ? M.toInput(bill.amount_centavos) : "");
  const [day, setDay] = useState(String(bill?.due_day || 15));
  const [cat, setCat] = useState(bill?.category || (cats.find((c: Category) => /bill/i.test(c.name)) || cats[0])?.name || "Bills & Utilities");
  const [acct, setAcct] = useState(bill?.account_id || f.live[0]?.id || "");
  const [active, setActive] = useState(bill ? bill.active : true);
  async function save() {
    if (!name.trim()) return "Give the bill a name.";
    if (!amt.check()) return "Check the amount.";
    const d = Number(day);
    if (!(d >= 1 && d <= 31)) return "The due day must be between 1 and 31.";
    const row = { name: name.trim(), amount_centavos: amt.cents, due_day: d, category: cat, account_id: acct || null, active };
    if (bill) await f.api.updateBill(bill.id, row); else await f.api.addBill(row);
    toast(bill ? "Bill updated." : `${row.name} added.`);
  }
  return (
    <FormModal title={bill ? "Edit bill" : "Add bill or subscription"} onClose={onClose} onSubmit={save} submitLabel={bill ? "Save changes" : "Add bill"}>
      <div className="form-grid">
        <Field className="full" label="Name" id="bl-name"><input id="bl-name" className="input" maxLength={60} value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Meralco, PLDT, Netflix, Rent" /></Field>
        <AmountInput id="bl-amt" amt={amt} label="Usual amount" />
        <Field label="Due every month on day" id="bl-day" hint="Day 31 falls on the last day in shorter months.">
          <input id="bl-day" className="input num" type="number" min={1} max={31} value={day} onChange={(e: any) => setDay(e.target.value)} />
        </Field>
        <Field label="Category" id="bl-cat"><select id="bl-cat" className="input" value={cat} onChange={(e: any) => setCat(e.target.value)}>{cats.map((c: Category) => <option key={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Usually paid from" id="bl-acct">
          <select id="bl-acct" className="input" value={acct} onChange={(e: any) => setAcct(e.target.value)}>
            <option value="">Choose when paying</option>
            {f.live.map((a: Account) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <label className="check full"><input type="checkbox" checked={active} onChange={(e: any) => setActive(e.target.checked)} /> Active (shows up every month)</label>
      </div>
    </FormModal>
  );
}
function PayBillForm({ bill, month, onClose }: { bill: Bill; month: string; onClose: () => void }) {
  const f = useFinance(), toast = useToast();
  const amt = useAmount(M.toInput(bill.amount_centavos));
  const [date, setDate] = useState(M.today());
  const [acct, setAcct] = useState(bill.account_id || f.live[0]?.id || "");
  async function save() {
    if (!amt.check()) return "Check the amount.";
    if (!acct) return "Choose the account you paid from.";
    await f.api.payBill(bill.id, month, acct, date, amt.cents);
    toast(`${bill.name} marked paid.`);
  }
  if (!f.live.length) return <Modal title="Add an account first" onClose={onClose}><div className="modal-b"><p className="muted">Paying a bill records an expense from one of your accounts. Add an account first.</p></div></Modal>;
  return (
    <FormModal title={`Pay ${bill.name}`} onClose={onClose} onSubmit={save} submitLabel="Mark as paid">
      <p className="muted">This records the payment as an expense for {M.monthName(month)}. You can undo it later.</p>
      <div className="form-grid">
        <AmountInput id="pb-amt" amt={amt} label="Amount paid" autoFocus />
        <Field label="Paid on" id="pb-date"><input id="pb-date" type="date" className="input" value={date} onChange={(e: any) => setDate(e.target.value)} /></Field>
        <AccountSelect id="pb-acct" label="Paid from" value={acct} onChange={setAcct} accounts={f.live} />
      </div>
    </FormModal>
  );
}

/* ── Goals ──────────────────────────────────────────────────────────── */
function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const f = useFinance(), toast = useToast();
  const [name, setName] = useState(goal?.name || "");
  const amt = useAmount(goal ? M.toInput(goal.target_centavos) : "");
  const [date, setDate] = useState(goal?.target_date || "");
  async function save() {
    if (!name.trim()) return "Give the goal a name.";
    if (!amt.check()) return "Check the target amount.";
    const row = { name: name.trim(), target_centavos: amt.cents, target_date: date || null };
    if (goal) await f.api.updateGoal(goal.id, row); else await f.api.addGoal(row);
    toast(goal ? "Goal updated." : `${row.name} goal added.`);
  }
  return (
    <FormModal title={goal ? "Edit goal" : "New savings goal"} onClose={onClose} onSubmit={save} submitLabel={goal ? "Save changes" : "Create goal"}>
      <div className="form-grid">
        <Field className="full" label="Goal name" id="gl-name"><input id="gl-name" className="input" maxLength={60} value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Emergency fund, Japan trip, Laptop" /></Field>
        <AmountInput id="gl-amt" amt={amt} label="Target amount" />
        <Field label="Target date (optional)" id="gl-date"><input id="gl-date" type="date" className="input" value={date} min={M.today()} onChange={(e: any) => setDate(e.target.value)} /></Field>
      </div>
    </FormModal>
  );
}
function ContributeForm({ goal, saved, withdraw, onClose }: { goal: Goal; saved: number; withdraw?: boolean; onClose: () => void }) {
  const f = useFinance(), toast = useToast();
  const amt = useAmount("");
  const [date, setDate] = useState(M.today());
  const [note, setNote] = useState("");
  async function save() {
    if (!amt.check()) return "Check the amount.";
    if (withdraw && amt.cents > saved) return `You can take out at most ${M.peso(saved)}.`;
    await f.api.addContribution({ goal_id: goal.id, amount_centavos: withdraw ? -amt.cents : amt.cents, happened_on: date, note: note.trim() || null });
    toast(withdraw ? "Withdrawal recorded." : `Added to ${goal.name}.`);
  }
  return (
    <FormModal title={withdraw ? `Take money out of ${goal.name}` : `Add money to ${goal.name}`} onClose={onClose} onSubmit={save} submitLabel={withdraw ? "Record withdrawal" : "Add money"}>
      <div className="form-grid">
        <AmountInput id="ct-amt" amt={amt} autoFocus />
        <Field label="Date" id="ct-date"><input id="ct-date" type="date" className="input" value={date} onChange={(e: any) => setDate(e.target.value)} /></Field>
        <Field className="full" label="Note (optional)" id="ct-note"><input id="ct-note" className="input" maxLength={120} value={note} onChange={(e: any) => setNote(e.target.value)} /></Field>
      </div>
    </FormModal>
  );
}
