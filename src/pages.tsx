// PeraFlow pages. All totals come from PFMoney (whole centavos) or the database's account_balances view.

function PageHead({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: any }) {
  return (
    <header className="page-head">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  );
}
function TxIcon({ t }: { t: Tx }) {
  const name = t.kind === "income" ? "arrow-in" : t.kind === "transfer" ? "swap" : "arrow-out";
  const color = t.kind === "income" ? "var(--income)" : t.kind === "transfer" ? "var(--net)" : "var(--spend)";
  return <span className="ic" style={{ color }}><Icon name={name} size={16} /></span>;
}
function txTitle(t: Tx, f: any) { return t.kind === "transfer" ? `${f.acctName(t.account_id)} → ${f.acctName(t.to_account_id)}` : t.category; }
function LoadError({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return <div className="alert" role="alert"><Icon name="alert" /><span className="grow">Couldn't load your data: {msg}</span><Button size="sm" onClick={onRetry}>Try again</Button></div>;
}

/* ── Dashboard ────────────────────────────────────────────────────────────────── */
function Dashboard({ open }: { open: (m: any) => void }) {
  const f = useFinance();
  const [month, setMonth] = useState(f.thisMonth);
  const [range, setRange] = useState("6");
  const minMonth = M.monthOf(f.windowStart);
  const today = M.today();
  const monthTx = useMemo(() => M.inMonth(f.txs, month), [f.txs, month]);
  const sum = M.summarize(monthTx);
  const series = useMemo(() => M.monthlySeries(f.txs, month, 6), [f.txs, month]);
  const chart = useMemo(() => M.monthlySeries(f.txs, month, Number(range)), [f.txs, month, range]);
  const totals = M.accountTotals(f.accounts);
  const paid = f.paidFor(month);
  const paidIds: Record<string, boolean> = {}; Object.keys(paid).forEach((k) => (paidIds[k] = true));
  const unpaid = M.unpaidBills(f.bills, paidIds, month);
  const safe = M.safeToSpend(f.accounts, f.bills, paidIds, month);
  const balanceLine = useMemo(() => M.dailyBalanceSeries(totals.netWorth, f.txs, today, 30).map((x: any) => x.cents), [f.txs, totals.netWorth]);
  const budget = M.budgetReport(f.budgets.filter((b: Budget) => b.month === month), f.txs, month);
  const cats = M.byCategory(monthTx);
  const catTop = cats.slice(0, 5), catRest = M.sumBy(cats.slice(5), "cents");
  const donut = [...catTop.map((c: any) => ({ label: c.category, cents: c.cents })), ...(catRest ? [{ label: "Everything else", cents: catRest }] : [])];
  const goals = f.goals.filter((g: Goal) => !g.archived_at);
  const recent = M.active(f.txs).slice(0, 6);
  const avg = (k: string) => Math.round(M.sumBy(chart, k) / chart.length);

  if (f.status === "loading") return <div className="page"><PageHead eyebrow="Overview" title="Your money, in focus." /><div className="grid g-stats">{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div><div className="grid g-main"><SkeletonCard lines={6} /><SkeletonCard lines={6} /><SkeletonCard lines={6} /></div></div>;
  return (
    <div className="page">
      <PageHead eyebrow="Overview" title="Your money, in focus." sub="Balances, plans and what's coming up, all in pesos.">
        <MonthPicker month={month} onChange={(m) => setMonth(m < minMonth ? minMonth : m)} max={f.thisMonth} />
        <Button variant="primary" icon="plus" onClick={() => open({ type: "tx" })}>Add transaction</Button>
      </PageHead>
      {f.error && <LoadError msg={f.error} onRetry={() => f.api.reload().catch(() => {})} />}
      {!f.accounts.length && (
        <Card className="hero">
          <div className="label">Welcome to PeraFlow</div>
          <div className="big" style={{ fontSize: 26 }}>Start by adding where your money lives.</div>
          <p style={{ color: "var(--hero-muted)", marginTop: 8, maxWidth: 560 }}>Add your cash, bank, e-wallet or credit card with today's balance. Then record income and spending, set a budget, and track bills and goals.</p>
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="primary" icon="plus" onClick={() => open({ type: "account" })}>Add your first account</Button></div>
        </Card>
      )}
      <div className="grid g-stats">
        <Card className="hero">
          <div className="label">Total balance</div>
          <div className="big money">{M.peso(totals.netWorth)}<small>PHP</small></div>
          <div className="spark"><Sparkline values={balanceLine} color="#7fe0b7" height={44} /></div>
          <div className="split">
            <div>Safe to spend<b className="money">{M.peso(safe)}</b></div>
            <div>Bills left this month<b className="money">{M.peso(M.sumBy(unpaid, "amount_centavos"))}</b></div>
            {totals.debts > 0 && <div>Owed on cards<b className="money">{M.peso(totals.debts)}</b></div>}
          </div>
        </Card>
        <StatCard icon="arrow-in" tone="var(--income)" label="Income" value={sum.income} sub={`${monthTx.filter((t: Tx) => t.kind === "income" && !t.voided_at).length} entries in ${M.monthName(month, true)}`} line={series.map((s: any) => s.income)} />
        <StatCard icon="arrow-out" tone="var(--spend)" label="Spending" value={sum.spending}
          sub={budget.limit ? `${M.percent(budget.spent, budget.limit)}% of ${M.pesoShort(budget.limit)} budget` : "No budget set for this month"} line={series.map((s: any) => s.spending)} />
        <StatCard icon="piggy" tone="var(--net)" label="Net saved" value={sum.net} sub={sum.income ? `${M.percent(sum.net, sum.income)}% of income` : "Income minus spending"} line={series.map((s: any) => s.net)} />
      </div>

      <div className="grid g-main">
        <Card className="span-2" title="Cash flow" subtitle="Monthly income, spending and net saved"
          action={<Seg label="Range" value={range} onChange={setRange} options={[["3", "3M"], ["6", "6M"], ["12", "1Y"]]} />}>
          <div className="legend" style={{ marginBottom: 8 }}><span><i style={{ background: "var(--income)" }} />Income</span><span><i style={{ background: "var(--spend)" }} />Spending</span><span><i style={{ background: "var(--net)", borderRadius: 99 }} />Net saved</span></div>
          <CashflowChart series={chart} />
          <div className="totals-row"><div>Average income<b className="money">{M.peso(avg("income"))}</b></div><div>Average spending<b className="money">{M.peso(avg("spending"))}</b></div><div>{M.monthName(month, true)} savings rate<b>{sum.income ? M.percent(sum.net, sum.income) + "%" : "—"}</b></div></div>
        </Card>
        <Card title="Spending plan" subtitle={`${M.monthName(month)} budget`} action={budget.limit ? <span className={"chip" + (budget.spent > budget.limit ? " danger" : "")}>{M.percent(budget.spent, budget.limit)}% used</span> : undefined}>
          {budget.rows.length ? (
            <>
              {budget.rows.slice(0, 5).map((r: any) => (
                <div className="plan-row" key={r.category}>
                  <div className="top"><span>{r.category}</span><span className="num">{M.pesoShort(r.spent)} / {M.pesoShort(r.limit)}</span></div>
                  <Progress value={M.percent(r.spent, r.limit)} tone={r.spent > r.limit ? "over" : r.spent > r.limit * 0.9 ? "warn" : ""} />
                  <div className="left num">{r.left >= 0 ? `${M.pesoShort(r.left)} left` : `${M.pesoShort(-r.left)} over`}</div>
                </div>
              ))}
              <div className="totals-row" style={{ justifyContent: "space-between" }}><div>Spent of plan<b className="money">{M.pesoShort(budget.spent)} / {M.pesoShort(budget.limit)}</b></div><a className="linkbtn" href="#/budgets">Open budgets</a></div>
            </>
          ) : <Empty icon="budget" title="No budget yet" text="Give each category a monthly limit and see what's left as you spend." action={<a className="btn sm" href="#/budgets">Set a budget</a>} />}
        </Card>
        <Card title="Savings goals" subtitle="Small steps, clear progress" action={<Button size="sm" variant="ghost" iconOnly icon="plus" label="New goal" onClick={() => open({ type: "goal" })} />}>
          {goals.length ? goals.slice(0, 3).map((g: Goal) => {
            const p = M.goalProgress(g, f.contributions.filter((c: Contribution) => c.goal_id === g.id), today);
            return (
              <div className="plan-row" key={g.id}>
                <div className="top"><span>{g.name}</span><span className="chip" style={{ padding: "1px 8px" }}>{Math.floor(p.pct)}%</span></div>
                <div className="hint num">{M.pesoShort(p.saved)} of {M.pesoShort(g.target_centavos)}</div>
                <Segments value={p.pct} />
              </div>
            );
          }) : <Empty icon="goal" title="No goals yet" text="Save toward an emergency fund, a trip or a big purchase." action={<Button size="sm" onClick={() => open({ type: "goal" })}>Create a goal</Button>} />}
        </Card>
      </div>

      <div className="grid g-bottom">
        <Card title="Recent transactions" subtitle="Latest entries across your accounts" action={<a className="linkbtn" href="#/transactions">View all</a>}>
          {recent.length ? (
            <ul className="list">
              {recent.map((t: Tx) => (
                <li className="li" key={t.id}>
                  <TxIcon t={t} />
                  <div className="m"><b>{t.note || txTitle(t, f)}</b><small>{M.dayLabel(t.happened_on)} · {t.note ? txTitle(t, f) + " · " : ""}{f.acctName(t.account_id)}</small></div>
                  <Money className="amt" cents={t.cents} kind={t.kind} signed />
                </li>
              ))}
            </ul>
          ) : <Empty icon="transactions" title="No transactions yet" text="Record your first income or expense to fill this in." action={f.accounts.length ? <Button size="sm" onClick={() => open({ type: "tx" })}>Add transaction</Button> : undefined} />}
        </Card>
        <Card title="Upcoming payments" subtitle={`Unpaid bills for ${M.monthName(month)}`} action={<a className="linkbtn" href="#/bills">Manage bills</a>}>
          {unpaid.length ? (
            <>
              <div className="pay-grid">
                {unpaid.slice(0, 4).map((b: any) => {
                  const st = M.billStatus(b, false, month, today);
                  return (
                    <div className="pay-card" key={b.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div className="date-chip"><b>{b.due.slice(8)}</b><small>{M.monthName(month, true)}</small></div>
                        <span className={"chip " + (st === "overdue" ? "danger" : st === "due-soon" ? "warn" : "neutral")}>{st === "overdue" ? "Overdue" : st === "due-soon" ? "Due soon" : "Upcoming"}</span>
                      </div>
                      <div><b style={{ display: "block" }}>{b.name}</b><span className="money" style={{ fontSize: 17, fontWeight: 700 }}>{M.peso(b.amount_centavos)}</span></div>
                      <Button size="sm" onClick={() => open({ type: "pay", bill: b, month })}>Mark paid</Button>
                    </div>
                  );
                })}
              </div>
              <div className="totals-row" style={{ justifyContent: "space-between" }}><div>{unpaid.length} {unpaid.length === 1 ? "payment" : "payments"} due</div><div style={{ textAlign: "right" }}>Total due<b className="money">{M.peso(M.sumBy(unpaid, "amount_centavos"))}</b></div></div>
            </>
          ) : <Empty icon="bills" title={f.bills.length ? "All paid for this month" : "No bills yet"} text={f.bills.length ? "Nothing left to pay. Nice." : "Add rent, utilities and subscriptions so nothing sneaks up on you."} action={!f.bills.length ? <Button size="sm" onClick={() => open({ type: "bill" })}>Add a bill</Button> : undefined} />}
        </Card>
        <Card title="Where your money went" subtitle={`Spending by category, ${M.monthName(month, true)}`}>
          {cats.length ? <Donut data={donut} total={sum.spending} label={`Spending by category in ${M.monthName(month)}`} /> : <Empty icon="budget" title="No spending yet" text="Your categories will show up here once you record expenses." />}
        </Card>
      </div>
    </div>
  );
}
function StatCard({ icon, tone, label, value, sub, line }: { icon: string; tone: string; label: string; value: number; sub: string; line: number[] }) {
  return (
    <section className="card stat">
      <div className="stat-h"><span className="stat-ic" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}><Icon name={icon} size={16} /></span>{label}</div>
      <div className="val money">{M.peso(value)}</div>
      <div className="spark"><Sparkline values={line} color={tone} height={34} fill={false} /></div>
      <div className="sub">{sub}</div>
    </section>
  );
}

/* ── Transactions ──────────────────────────────────────────────────────────────── */
function Transactions({ open, params }: { open: (m: any) => void; params: Record<string, string> }) {
  const f = useFinance(), toast = useToast();
  const [month, setMonth] = useState(f.thisMonth);
  const [qText, setQ] = useState("");
  const [type, setType] = useState("all");
  const [acct, setAcct] = useState(params.account || "all");
  const [cat, setCat] = useState("all");
  const [showVoid, setShowVoid] = useState(false);
  const [older, setOlder] = useState<{ month: string; rows: Tx[] | null; err: string }>({ month: "", rows: null, err: "" });
  const inWindow = month >= M.monthOf(f.windowStart);
  useEffect(() => { setAcct(params.account || "all"); }, [params.account]);
  useEffect(() => {
    if (inWindow) return;
    let live = true;
    setOlder({ month, rows: null, err: "" });
    f.api.txsForMonth(month).then((rows: Tx[]) => live && setOlder({ month, rows, err: "" })).catch((e: any) => live && setOlder({ month, rows: [], err: friendlyError(e) }));
    return () => { live = false; };
  }, [month, inWindow, f.txs]);
  const base: Tx[] = inWindow ? M.inMonth(f.txs, month) : older.month === month && older.rows ? older.rows : [];
  const loading = f.status === "loading" || (!inWindow && (older.month !== month || !older.rows));
  const needle = qText.trim().toLowerCase();
  const rows = base.filter((t) => (showVoid || !t.voided_at) && (type === "all" || t.kind === type) && (cat === "all" || t.category === cat)
    && (acct === "all" || t.account_id === acct || t.to_account_id === acct)
    && (!needle || [t.category, t.note || "", f.acctName(t.account_id), f.acctName(t.to_account_id), M.toInput(t.cents)].join(" ").toLowerCase().includes(needle)));
  const sum = M.summarize(rows);
  const catNames = Array.from(new Set(base.filter((t) => t.kind !== "transfer").map((t) => t.category))).sort();
  const [confirm, setConfirm] = useState<Tx | null>(null);

  function exportCSV() {
    const out = [["Date", "Type", "Category", "Note", "Account", "To account", "Amount (PHP)", "Status"],
      ...rows.map((t) => [t.happened_on, t.kind, t.category, t.note || "", f.acctName(t.account_id), t.to_account_id ? f.acctName(t.to_account_id) : "",
        (t.kind === "expense" ? "-" : "") + M.toInput(t.cents), t.voided_at ? "Voided" : "Active"])];
    const blob = new Blob(["﻿" + M.toCSV(out)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `peraflow-${month}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <div className="page">
      <PageHead eyebrow="Records" title="Transactions" sub="Every peso in and out. Voided entries stay in your history but never count.">
        <Button icon="download" onClick={exportCSV} disabled={!rows.length}>Export CSV</Button>
        <Button variant="primary" icon="plus" onClick={() => open({ type: "tx" })}>Add transaction</Button>
      </PageHead>
      {f.error && <LoadError msg={f.error} onRetry={() => f.api.reload().catch(() => {})} />}
      <Card>
        <div className="filters" style={{ marginBottom: 14 }}>
          <MonthPicker month={month} onChange={setMonth} />
          <div className="search"><Icon name="search" size={16} /><label className="sr" htmlFor="tx-q">Search</label><input id="tx-q" className="input" placeholder="Search notes, categories, accounts" value={qText} onChange={(e: any) => setQ(e.target.value)} /></div>
          <label className="sr" htmlFor="tx-type">Type</label>
          <select id="tx-type" className="input" value={type} onChange={(e: any) => setType(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option><option value="transfer">Transfers</option></select>
          <label className="sr" htmlFor="tx-acctf">Account</label>
          <select id="tx-acctf" className="input" value={acct} onChange={(e: any) => setAcct(e.target.value)}><option value="all">All accounts</option>{f.accounts.map((a: Account) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <label className="sr" htmlFor="tx-catf">Category</label>
          <select id="tx-catf" className="input" value={cat} onChange={(e: any) => setCat(e.target.value)}><option value="all">All categories</option>{catNames.map((c) => <option key={c}>{c}</option>)}</select>
          <label className="check"><input type="checkbox" checked={showVoid} onChange={(e: any) => setShowVoid(e.target.checked)} /> Show voided</label>
        </div>
        {older.err && !inWindow && <div className="alert" style={{ marginBottom: 12 }}>{older.err}</div>}
        {loading ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={36} />)}</div>
          : rows.length ? (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Type</th><th className="r">Amount</th><th className="r"><span className="sr">Actions</span></th></tr></thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className={t.voided_at ? "voided" : ""}>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>{M.dayLabel(t.happened_on, true)}</td>
                      <td><div className="tx-name"><TxIcon t={t} /><div style={{ minWidth: 0 }}><b>{txTitle(t, f)}</b>{t.note && <small title={t.note}>{t.note}</small>}</div></div></td>
                      <td>{t.kind === "transfer" ? `${f.acctName(t.account_id)} → ${f.acctName(t.to_account_id)}` : f.acctName(t.account_id)}</td>
                      <td><span className="status"><span className="dot" style={{ background: t.voided_at ? "var(--faint)" : t.kind === "income" ? "var(--income)" : t.kind === "transfer" ? "var(--net)" : "var(--spend)" }} />{t.voided_at ? "Voided" : t.kind === "income" ? "Income" : t.kind === "transfer" ? "Transfer" : "Expense"}</span></td>
                      <td className="r"><Money className="amt" cents={t.cents} kind={t.kind} signed /></td>
                      <td className="r"><div className="row-actions">
                        {t.voided_at
                          ? <Button size="sm" variant="ghost" iconOnly icon="undo" label="Restore" onClick={async () => { try { await f.api.restoreTx(t); toast("Transaction restored."); } catch (e) { toast(friendlyError(e), true); } }} />
                          : <><Button size="sm" variant="ghost" iconOnly icon="pencil" label="Edit" onClick={() => open({ type: "tx", tx: t })} /><Button size="sm" variant="ghost" iconOnly icon="ban" label="Void" onClick={() => setConfirm(t)} /></>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon="transactions" title={base.length ? "Nothing matches these filters" : `No transactions in ${M.monthName(month)}`} text={base.length ? "Try another search or clear the filters." : "Record income, spending or a transfer between your accounts."}
              action={base.length ? <Button size="sm" onClick={() => { setQ(""); setType("all"); setAcct("all"); setCat("all"); }}>Clear filters</Button> : f.accounts.length ? <Button size="sm" onClick={() => open({ type: "tx" })}>Add transaction</Button> : <a className="btn sm" href="#/accounts">Add an account first</a>} />}
        {!loading && rows.length > 0 && (
          <div className="totals-row"><div>Income<b className="money inc">{M.peso(sum.income)}</b></div><div>Spending<b className="money exp">{M.peso(sum.spending)}</b></div><div>Net<b className="money">{M.peso(sum.net)}</b></div><div>Entries<b>{rows.length}</b></div></div>
        )}
      </Card>
      {confirm && <Confirm title="Void this transaction?" confirmLabel="Void it" onClose={() => setConfirm(null)}
        text={<>It stays in your history but stops counting toward balances and totals.{f.payments.some((p: BillPayment) => p.transaction_id === confirm.id) ? " This was a bill payment, so the bill goes back to unpaid." : ""} You can restore it from "Show voided".</>}
        onConfirm={async () => { await f.api.voidTx(confirm); toast("Transaction voided."); }} />}
    </div>
  );
}

/* ── Accounts ───────────────────────────────────────────────────────────────── */
function Accounts({ open }: { open: (m: any) => void }) {
  const f = useFinance(), toast = useToast();
  const totals = M.accountTotals(f.accounts);
  const archived = f.accounts.filter((a: Account) => a.archived_at);
  const [showArchived, setShowArchived] = useState(false);
  const [confirm, setConfirm] = useState<Account | null>(null);
  const card = (a: Account) => (
    <section className="card acct" key={a.id}>
      <div className="acct-top"><span className="ic"><AcctIcon type={a.type} /></span><div style={{ minWidth: 0, flex: 1 }}><b>{a.name}</b><small>{M.ACCOUNT_TYPES[a.type]}{a.archived_at ? " · Archived" : ""}</small></div></div>
      <div><div className="hint">{a.type === "credit" ? (a.balance < 0 ? "Amount owed" : "Credit balance") : "Balance"}</div><div className={"bal money" + (a.balance < 0 ? " exp" : "")}>{M.peso(a.type === "credit" ? Math.abs(a.balance) : a.balance)}</div></div>
      <div className="hint num">Started at {M.peso(a.opening_centavos)}</div>
      <div className="acct-foot">
        <a className="btn sm ghost" href={`#/transactions?account=${a.id}`}>History</a>
        <Button size="sm" variant="ghost" iconOnly icon="pencil" label={`Edit ${a.name}`} onClick={() => open({ type: "account", account: a })} />
        {a.archived_at
          ? <Button size="sm" variant="ghost" icon="undo" onClick={async () => { try { await f.api.archiveAccount(a.id, false); toast(`${a.name} is active again.`); } catch (e) { toast(friendlyError(e), true); } }}>Restore</Button>
          : <Button size="sm" variant="ghost" iconOnly icon="trash" label={`Archive ${a.name}`} onClick={() => setConfirm(a)} />}
      </div>
    </section>
  );
  return (
    <div className="page">
      <PageHead eyebrow="Accounts" title="Where your money lives" sub="Cash, banks, e-wallets, cards and investments, with balances worked out by the database.">
        <Button icon="swap" onClick={() => open({ type: "tx", preset: { kind: "transfer" } })} disabled={f.live.length < 2}>Transfer</Button>
        <Button variant="primary" icon="plus" onClick={() => open({ type: "account" })}>Add account</Button>
      </PageHead>
      {f.error && <LoadError msg={f.error} onRetry={() => f.api.reload().catch(() => {})} />}
      <div className="grid g-stats">
        <Card className="hero"><div className="label">Net worth</div><div className="big money">{M.peso(totals.netWorth)}</div><div className="split"><div>Assets<b className="money">{M.peso(totals.assets)}</b></div><div>Debts<b className="money">{M.peso(totals.debts)}</b></div></div></Card>
        <Card><div className="stat-h muted">Spendable now</div><div className="val money" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{M.peso(totals.spendable)}</div><div className="hint" style={{ marginTop: 6 }}>Cash, bank, savings and e-wallets</div></Card>
        <Card><div className="stat-h muted">Owed on credit cards</div><div className="val money exp" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{M.peso(-M.sumBy(f.live.filter((a: Account) => a.type === "credit" && a.balance < 0), "balance"))}</div><div className="hint" style={{ marginTop: 6 }}>Pay it down with a transfer</div></Card>
        <Card><div className="stat-h muted">Accounts</div><div className="val" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{f.live.length}</div><div className="hint" style={{ marginTop: 6 }}>{archived.length ? `${archived.length} archived` : "All active"}</div></Card>
      </div>
      {f.status === "loading" ? <div className="grid g-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        : f.live.length ? <div className="grid g-3">{f.live.map(card)}</div>
        : <Card><Empty icon="wallet" title="No accounts yet" text="Add the places your money lives, with today's balance. Every transaction is recorded against one." action={<Button variant="primary" icon="plus" onClick={() => open({ type: "account" })}>Add account</Button>} /></Card>}
      {archived.length > 0 && (
        <div>
          <button className="linkbtn" onClick={() => setShowArchived(!showArchived)} aria-expanded={showArchived}>{showArchived ? "Hide" : "Show"} archived accounts ({archived.length})</button>
          {showArchived && <div className="grid g-3" style={{ marginTop: 12 }}>{archived.map(card)}</div>}
        </div>
      )}
      {confirm && <Confirm title={`Archive ${confirm.name}?`} confirmLabel="Archive" danger={false} onClose={() => setConfirm(null)}
        text="It disappears from your lists and totals, but its transactions stay in your history. You can restore it any time."
        onConfirm={async () => { await f.api.archiveAccount(confirm.id, true); toast(`${confirm.name} archived.`); }} />}
    </div>
  );
}

/* ── Budgets ────────────────────────────────────────────────────────────────── */
function Budgets() {
  const f = useFinance(), toast = useToast();
  const [month, setMonth] = useState(f.thisMonth);
  const monthBudgets = f.budgets.filter((b: Budget) => b.month === month);
  const rep = M.budgetReport(monthBudgets, f.txs, month);
  const income = M.summarize(M.inMonth(f.txs, month)).income;
  const expenseCats: Category[] = f.categories.filter((c: Category) => c.kind === "expense");
  const prev = M.shiftMonth(month, -1);
  const prevCount = f.budgets.filter((b: Budget) => b.month === prev).length;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");
  useEffect(() => { setDraft({}); }, [month]);
  const spentBy: Record<string, number> = {}; M.byCategory(M.inMonth(f.txs, month)).forEach((r: any) => (spentBy[r.category] = r.cents));
  const names = Array.from(new Set([...expenseCats.map((c) => c.name), ...monthBudgets.map((b: Budget) => b.category), ...Object.keys(spentBy)]));

  async function commit(category: string) {
    const text = draft[category];
    if (text === undefined) return;
    const current = monthBudgets.find((b: Budget) => b.category === category);
    const cents = text.trim() === "" ? null : M.parseAmount(text);
    if (cents !== null && (Number.isNaN(cents) || cents >= M.MAX_CENTAVOS)) { toast(`Check the amount for ${category}.`, true); return; }
    if ((current?.limit_centavos ?? null) === cents) { setDraft((d) => { const n = { ...d }; delete n[category]; return n; }); return; }
    setSaving(category);
    try { await f.api.setBudget(month, category, cents); setDraft((d) => { const n = { ...d }; delete n[category]; return n; }); }
    catch (e) { toast(friendlyError(e), true); }
    setSaving("");
  }
  return (
    <div className="page">
      <PageHead eyebrow="Plan" title="Budgets" sub="Give every category a monthly limit. Planned versus actual updates as you spend.">
        <MonthPicker month={month} onChange={setMonth} />
        <Button icon="undo" disabled={!prevCount} title={prevCount ? undefined : "Last month has no budget"} onClick={async () => { try { await f.api.copyBudgets(prev, month); toast(`Copied ${M.monthName(prev)}'s budget.`); } catch (e) { toast(friendlyError(e), true); } }}>Copy last month</Button>
      </PageHead>
      <div className="grid g-stats">
        <Card className="hero"><div className="label">Left to spend</div><div className="big money">{M.peso(rep.limit - rep.spent)}</div><div className="split"><div>Planned<b className="money">{M.peso(rep.limit)}</b></div><div>Spent in plan<b className="money">{M.peso(rep.spent)}</b></div></div></Card>
        <Card><div className="stat-h muted">Income this month</div><div className="val money" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{M.peso(income)}</div><div className="hint" style={{ marginTop: 6 }}>Money you can give a job</div></Card>
        <Card><div className="stat-h muted">Left to assign</div><div className={"val money" + (income - rep.limit < 0 ? " exp" : "")} style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{M.peso(income - rep.limit)}</div><div className="hint" style={{ marginTop: 6 }}>Zero-based: aim for ₱0.00</div></Card>
        <Card><div className="stat-h muted">Spent outside the plan</div><div className="val money" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{M.peso(rep.unplannedSpent)}</div><div className="hint" style={{ marginTop: 6 }}>{rep.unplanned.length ? rep.unplanned.map((u: any) => u.category).slice(0, 3).join(", ") : "Everything is budgeted"}</div></Card>
      </div>
      <Card title={`Category limits for ${M.monthName(month)}`} subtitle="Type a limit and press Enter, or leave it empty for no budget.">
        {f.status === "loading" ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={44} />)}</div> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Category</th><th style={{ width: 170 }}>Monthly limit</th><th className="r">Spent</th><th style={{ width: "28%" }}>Progress</th><th className="r">Left</th></tr></thead>
              <tbody>
                {names.map((c) => {
                  const b = monthBudgets.find((x: Budget) => x.category === c), spent = spentBy[c] || 0;
                  const value = draft[c] ?? (b ? M.toInput(b.limit_centavos) : "");
                  return (
                    <tr key={c}>
                      <td><b style={{ fontWeight: 600 }}>{c}</b></td>
                      <td><label className="sr" htmlFor={"bd-" + c}>Limit for {c}</label>
                        <input id={"bd-" + c} className="input num" inputMode="decimal" placeholder="No budget" value={value} disabled={saving === c}
                          onChange={(e: any) => setDraft((d) => ({ ...d, [c]: e.target.value }))} onBlur={() => commit(c)} onKeyDown={(e: any) => { if (e.key === "Enter") e.target.blur(); }} style={{ minHeight: 36 }} /></td>
                      <td className="r money">{M.peso(spent)}</td>
                      <td>{b ? <Progress value={M.percent(spent, b.limit_centavos)} tone={spent > b.limit_centavos ? "over" : spent > b.limit_centavos * 0.9 ? "warn" : ""} /> : <span className="hint">{spent ? "Not budgeted" : "—"}</span>}</td>
                      <td className="r money">{b ? (b.limit_centavos - spent >= 0 ? M.peso(b.limit_centavos - spent) : <span className="exp">{M.peso(spent - b.limit_centavos)} over</span>) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Bills ──────────────────────────────────────────────────────────────────── */
function Bills({ open }: { open: (m: any) => void }) {
  const f = useFinance(), toast = useToast();
  const [month, setMonth] = useState(f.thisMonth);
  const today = M.today();
  const paid = f.paidFor(month);
  const list = f.bills.map((b: Bill) => ({ ...b, due: M.dueDate(month, b.due_day), st: b.active ? M.billStatus(b, !!paid[b.id], month, today) : "inactive" }))
    .sort((a: any, b: any) => (a.st === "inactive" ? 1 : 0) - (b.st === "inactive" ? 1 : 0) || a.due.localeCompare(b.due));
  const activeBills = list.filter((b: any) => b.active);
  const unpaidTotal = M.sumBy(activeBills.filter((b: any) => !paid[b.id]), "amount_centavos");
  const paidTotal = Object.values(paid).reduce((s: number, p: any) => s + (f.txs.find((t: Tx) => t.id === p.transaction_id)?.cents || 0), 0);
  const [confirm, setConfirm] = useState<any>(null);
  const label: Record<string, [string, string]> = { paid: ["Paid", ""], overdue: ["Overdue", "danger"], "due-soon": ["Due soon", "warn"], upcoming: ["Upcoming", "neutral"], inactive: ["Paused", "neutral"] };
  return (
    <div className="page">
      <PageHead eyebrow="Obligations" title="Bills & subscriptions" sub="Know what's due, what's paid and what's left for the month.">
        <MonthPicker month={month} onChange={setMonth} />
        <Button variant="primary" icon="plus" onClick={() => open({ type: "bill" })}>Add bill</Button>
      </PageHead>
      <div className="grid g-3">
        <Card className="hero"><div className="label">Still to pay in {M.monthName(month, true)}</div><div className="big money">{M.peso(unpaidTotal)}</div><div className="split"><div>Bills<b>{activeBills.length}</b></div><div>Unpaid<b>{activeBills.filter((b: any) => !paid[b.id]).length}</b></div></div></Card>
        <Card><div className="stat-h muted">Paid this month</div><div className="val money" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{M.peso(paidTotal)}</div><div className="hint" style={{ marginTop: 6 }}>{Object.keys(paid).length} payments recorded</div></Card>
        <Card><div className="stat-h muted">Monthly total</div><div className="val money" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{M.peso(M.sumBy(activeBills, "amount_centavos"))}</div><div className="hint" style={{ marginTop: 6 }}>Usual amounts of active bills</div></Card>
      </div>
      <Card title={`Bills for ${M.monthName(month)}`}>
        {f.status === "loading" ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={48} />)}</div>
          : list.length ? (
            <ul className="list">
              {list.map((b: any) => (
                <li className="li" key={b.id}>
                  <div className="date-chip"><b>{b.due.slice(8)}</b><small>{M.monthName(month, true)}</small></div>
                  <div className="m"><b>{b.name}</b><small>{b.category} · {b.account_id ? f.acctName(b.account_id) : "No default account"}{paid[b.id] ? ` · paid ${M.dayLabel(paid[b.id].paid_on)}` : ""}</small></div>
                  <span className={"chip " + label[b.st][1]}>{label[b.st][0]}</span>
                  <span className="amt money" style={{ minWidth: 96, textAlign: "right" }}>{M.peso(b.amount_centavos)}</span>
                  <div className="row-actions" style={{ display: "flex", gap: 4 }}>
                    {b.active && (paid[b.id]
                      ? <Button size="sm" icon="undo" onClick={() => setConfirm({ kind: "unpay", b })}>Undo</Button>
                      : <Button size="sm" variant="primary" icon="check" onClick={() => open({ type: "pay", bill: b, month })}>Pay</Button>)}
                    <Button size="sm" variant="ghost" iconOnly icon="pencil" label={`Edit ${b.name}`} onClick={() => open({ type: "bill", bill: b })} />
                    <Button size="sm" variant="ghost" iconOnly icon="trash" label={`Delete ${b.name}`} onClick={() => setConfirm({ kind: "delete", b })} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty icon="bills" title="No bills yet" text="Add rent, electricity, water, internet, phone and subscriptions. PeraFlow shows what's due each month." action={<Button variant="primary" icon="plus" onClick={() => open({ type: "bill" })}>Add bill</Button>} />}
      </Card>
      {confirm?.kind === "unpay" && <Confirm title={`Undo the ${confirm.b.name} payment?`} confirmLabel="Undo payment" onClose={() => setConfirm(null)}
        text={`The bill goes back to unpaid for ${M.monthName(month)} and its expense is voided (kept in history, not counted).`}
        onConfirm={async () => { await f.api.unpayBill(confirm.b.id, month); toast("Payment undone."); }} />}
      {confirm?.kind === "delete" && <Confirm title={`Delete ${confirm.b.name}?`} confirmLabel="Delete bill" onClose={() => setConfirm(null)}
        text="The bill and its payment records are removed. Expenses already recorded for it stay in your transactions."
        onConfirm={async () => { await f.api.deleteBill(confirm.b.id); toast("Bill deleted."); }} />}
    </div>
  );
}

/* ── Goals ──────────────────────────────────────────────────────────────────── */
function Goals({ open }: { open: (m: any) => void }) {
  const f = useFinance(), toast = useToast();
  const today = M.today();
  const goals = f.goals.filter((g: Goal) => !g.archived_at);
  const archived = f.goals.filter((g: Goal) => g.archived_at);
  const contribs = (id: string) => f.contributions.filter((c: Contribution) => c.goal_id === id);
  const totalSaved = M.sumBy(f.contributions.filter((c: Contribution) => goals.some((g: Goal) => g.id === c.goal_id)), "amount_centavos");
  const totalTarget = M.sumBy(goals, "target_centavos");
  const [confirm, setConfirm] = useState<Goal | null>(null);
  return (
    <div className="page">
      <PageHead eyebrow="Plan" title="Savings goals" sub="Small steps, clear progress. Estimates use your pace over the last 90 days.">
        <Button variant="primary" icon="plus" onClick={() => open({ type: "goal" })}>New goal</Button>
      </PageHead>
      <div className="grid g-3">
        <Card className="hero"><div className="label">Saved toward goals</div><div className="big money">{M.peso(totalSaved)}</div><div className="split"><div>Target<b className="money">{M.peso(totalTarget)}</b></div><div>Progress<b>{M.percent(totalSaved, totalTarget)}%</b></div></div></Card>
        <Card><div className="stat-h muted">Active goals</div><div className="val" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{goals.length}</div><div className="hint" style={{ marginTop: 6 }}>{archived.length ? `${archived.length} archived` : "Keep it to a few that matter"}</div></Card>
        <Card><div className="stat-h muted">Added in the last 30 days</div><div className="val money" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{M.peso(M.sumBy(f.contributions.filter((c: Contribution) => c.happened_on > M.addDays(today, -30)), "amount_centavos"))}</div><div className="hint" style={{ marginTop: 6 }}>Across all goals</div></Card>
      </div>
      {f.status === "loading" ? <div className="grid g-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        : goals.length ? (
          <div className="grid g-3">
            {goals.map((g: Goal) => {
              const p = M.goalProgress(g, contribs(g.id), today);
              const monthsLeft = g.target_date ? Math.max(1, Math.ceil(M.daysBetween(today, g.target_date) / 30.44)) : 0;
              const needed = g.target_date && p.left ? Math.ceil(p.left / monthsLeft) : 0;
              return (
                <section className="card acct" key={g.id}>
                  <div className="acct-top"><span className="ic"><Icon name="goal" /></span><div style={{ flex: 1, minWidth: 0 }}><b>{g.name}</b><small>{g.target_date ? `Target ${M.dayLabel(g.target_date, true)}` : "No target date"}</small></div><span className="chip">{Math.floor(p.pct)}%</span></div>
                  <div><div className="bal money">{M.peso(p.saved)}</div><div className="hint num">of {M.peso(g.target_centavos)} · {M.peso(p.left)} to go</div></div>
                  <Segments value={p.pct} count={20} />
                  <div className="hint">
                    {p.eta === "done" ? "Goal reached. 🎉" : p.eta ? `At your pace (${M.pesoShort(p.perMonth)}/month) you'll get there around ${M.dayLabel(p.eta, true)}.` : "Add money regularly to see an estimated finish date."}
                    {needed > 0 && <><br />To hit your date, save about {M.pesoShort(needed)} a month.</>}
                  </div>
                  <div className="acct-foot">
                    <Button size="sm" variant="primary" icon="plus" onClick={() => open({ type: "contribute", goal: g, saved: p.saved })}>Add money</Button>
                    <Button size="sm" disabled={p.saved <= 0} onClick={() => open({ type: "contribute", goal: g, saved: p.saved, withdraw: true })}>Withdraw</Button>
                    <Button size="sm" variant="ghost" iconOnly icon="pencil" label={`Edit ${g.name}`} onClick={() => open({ type: "goal", goal: g })} />
                    <Button size="sm" variant="ghost" iconOnly icon="trash" label={`Archive ${g.name}`} onClick={() => setConfirm(g)} />
                  </div>
                </section>
              );
            })}
          </div>
        ) : <Card><Empty icon="goal" title="No savings goals yet" text="An emergency fund of 3 to 6 months of expenses is a good first goal." action={<Button variant="primary" icon="plus" onClick={() => open({ type: "goal" })}>Create a goal</Button>} /></Card>}
      {archived.length > 0 && <Card title="Archived goals">{archived.map((g: Goal) => (
        <div className="li" key={g.id}><div className="m"><b>{g.name}</b><small>{M.peso(M.sumBy(contribs(g.id), "amount_centavos"))} saved of {M.peso(g.target_centavos)}</small></div>
          <Button size="sm" icon="undo" onClick={async () => { try { await f.api.archiveGoal(g.id, false); toast(`${g.name} restored.`); } catch (e) { toast(friendlyError(e), true); } }}>Restore</Button></div>))}</Card>}
      {confirm && <Confirm title={`Archive ${confirm.name}?`} confirmLabel="Archive" danger={false} onClose={() => setConfirm(null)}
        text="The goal and its history are kept, and you can restore it later." onConfirm={async () => { await f.api.archiveGoal(confirm.id, true); toast("Goal archived."); }} />}
    </div>
  );
}

/* ── Settings ────────────────────────────────────────────────────────────────── */
function Settings({ user, theme, setTheme }: { user: any; theme: string; setTheme: (t: string) => void }) {
  const f = useFinance(), toast = useToast();
  const [name, setName] = useState({ expense: "", income: "" } as Record<string, string>);
  const [confirm, setConfirm] = useState<Category | null>(null);
  async function add(kind: "expense" | "income") {
    const n = name[kind].trim();
    if (!n) return;
    if (f.categories.some((c: Category) => c.kind === kind && c.name.toLowerCase() === n.toLowerCase())) { toast("That category already exists.", true); return; }
    try { await f.api.addCategory(n.slice(0, 60), kind); setName({ ...name, [kind]: "" }); toast(`${n} added.`); } catch (e) { toast(friendlyError(e), true); }
  }
  const list = (kind: "expense" | "income") => (
    <Card title={kind === "expense" ? "Spending categories" : "Income categories"}>
      <form className="filters" style={{ marginBottom: 10 }} onSubmit={(e: any) => { e.preventDefault(); add(kind); }}>
        <label className="sr" htmlFor={"cat-" + kind}>New {kind} category</label>
        <input id={"cat-" + kind} className="input" style={{ flex: 1 }} maxLength={60} placeholder="New category" value={name[kind]} onChange={(e: any) => setName({ ...name, [kind]: e.target.value })} />
        <Button type="submit" icon="plus">Add</Button>
      </form>
      <ul className="list">{f.categories.filter((c: Category) => c.kind === kind).map((c: Category) => (
        <li className="li" key={c.id} style={{ padding: "7px 0" }}><div className="m"><b style={{ fontWeight: 500 }}>{c.name}</b></div><Button size="sm" variant="ghost" iconOnly icon="trash" label={`Remove ${c.name}`} onClick={() => setConfirm(c)} /></li>
      ))}</ul>
    </Card>
  );
  return (
    <div className="page">
      <PageHead eyebrow="Settings" title="Preferences" sub="Appearance, categories and your account." />
      <div className="grid g-2">
        <Card title="Appearance" subtitle="Light, dark, or follow your device.">
          <Seg label="Theme" value={theme} onChange={setTheme} options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} />
        </Card>
        <Card title="Your account" subtitle="Currency is Philippine peso (₱). Dates use Asia/Manila time.">
          <div className="li"><span className="avatar">{(user.email || "?").slice(0, 2).toUpperCase()}</span><div className="m"><b>{user.email}</b><small>Signed in{user.app_metadata?.provider === "google" ? " with Google" : " with email"}</small></div>
            <Button icon="logout" onClick={() => sb.auth.signOut()}>Log out</Button></div>
        </Card>
        {list("expense")}
        {list("income")}
      </div>
      {confirm && <Confirm title={`Remove ${confirm.name}?`} confirmLabel="Remove" onClose={() => setConfirm(null)}
        text="It's removed from the category list. Transactions and budgets that already use it keep their category name."
        onConfirm={async () => { await f.api.deleteCategory(confirm.id); toast("Category removed."); }} />}
    </div>
  );
}
