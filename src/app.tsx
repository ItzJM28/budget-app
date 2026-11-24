// PeraFlow app shell: sign-in, sidebar navigation, theme, routing and dialogs.

/* ── Theme (light, dark or follow the device) ── */
function readTheme() { try { return localStorage.getItem("pf-theme") || "system"; } catch { return "system"; } }
function applyTheme(t: string) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
function useTheme() {
  const [theme, setTheme] = useState(readTheme());
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem("pf-theme", theme); } catch {}
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => theme === "system" && applyTheme("system");
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [theme]);
  return [theme, setTheme] as const;
}

/* ── Routing: #/page?key=value ── */
const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "transactions", label: "Transactions", icon: "transactions" },
  { id: "accounts", label: "Accounts", icon: "wallet" },
  { id: "income", label: "Monthly income", icon: "arrow-in" },
  { id: "budgets", label: "Budgets", icon: "budget" },
  { id: "bills", label: "Bills", icon: "bills" },
  { id: "goals", label: "Savings goals", icon: "goal" },
];
function parseHash() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const params: Record<string, string> = {};
  new URLSearchParams(query).forEach((v, k) => (params[k] = v));
  const page = [...PAGES.map((p) => p.id), "settings"].includes(path) ? path : "dashboard";
  return { page, params };
}
function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => {
    const on = () => { setR(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}

/* ── Sign in ── */
function Auth() {
  const [mode, setMode] = useState("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  async function submit(e: any) {
    e.preventDefault(); setErr(""); setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr("Enter a valid email address."); return; }
    if (pw.length < 6) { setErr("Your password needs at least 6 characters."); return; }
    setBusy(true);
    try {
      const res = mode === "in"
        ? await sb.auth.signInWithPassword({ email: email.trim(), password: pw })
        : await sb.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: location.origin } });
      if (res.error) setErr(res.error.message);
      else if (mode === "up" && !res.data.session) setInfo("Account created. Check your email for the confirmation link, then log in.");
    } catch (x) { setErr(friendlyError(x)); }
    setBusy(false);
  }
  async function google() {
    setErr("");
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } });
    if (error) setErr(error.message);
  }
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="brand"><BrandMark /><div><b>PeraFlow</b><small>Personal finance</small></div></div>
        <div>
          <h2>Every peso, in one calm place.</h2>
          <p>Track your accounts, spending, budgets, bills and savings goals. Built for the Philippines, in pesos.</p>
        </div>
        <ul>
          <li><Icon name="check" /> Balances from all your accounts and e-wallets</li>
          <li><Icon name="check" /> Budgets that show what's left, as you spend</li>
          <li><Icon name="check" /> Bills and goals that never sneak up on you</li>
        </ul>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="brand" style={{ padding: 0 }}><BrandMark size={32} /><div><b>PeraFlow</b></div></div>
          <div><h1>{mode === "in" ? "Welcome back" : "Create your account"}</h1><p className="muted" style={{ marginTop: 4 }}>{mode === "in" ? "Log in to see your money." : "It takes less than a minute."}</p></div>
          <Seg full label="Log in or register" value={mode} onChange={(v) => { setMode(v); setErr(""); setInfo(""); }} options={[["in", "Log in"], ["up", "Register"]]} />
          <Button onClick={google} icon="google">Continue with Google</Button>
          <div className="divider">or use email</div>
          {err && <div className="alert" role="alert"><Icon name="alert" /><span className="grow">{err}</span></div>}
          {info && <div className="alert info" role="status"><Icon name="check" /><span className="grow">{info}</span></div>}
          <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Email" id="au-email"><input id="au-email" className="input" type="email" autoComplete="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
            <Field label="Password" id="au-pw"><input id="au-pw" className="input" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={pw} onChange={(e: any) => setPw(e.target.value)} placeholder="At least 6 characters" /></Field>
            <Button type="submit" variant="primary" busy={busy}>{busy ? "Please wait…" : mode === "in" ? "Log in" : "Create account"}</Button>
          </form>
        </div>
      </main>
    </div>
  );
}

/* ── Dialog host: one place that opens every form ── */
function Dialogs({ modal, close }: { modal: any; close: () => void }) {
  if (!modal) return null;
  switch (modal.type) {
    case "tx": return <TxForm tx={modal.tx} preset={modal.preset} onClose={close} />;
    case "account": return <AccountForm account={modal.account} onClose={close} />;
    case "bill": return <BillForm bill={modal.bill} kind={modal.kind} onClose={close} />;
    case "pay": return <PayBillForm bill={modal.bill} month={modal.month} onClose={close} />;
    case "goal": return <GoalForm goal={modal.goal} onClose={close} />;
    case "contribute": return <ContributeForm goal={modal.goal} saved={modal.saved} withdraw={modal.withdraw} onClose={close} />;
    default: return null;
  }
}

/* ── Signed-in layout ── */
function Shell({ user, theme, setTheme }: { user: any; theme: string; setTheme: (t: string) => void }) {
  const f = useFinance();
  const { page, params } = useRoute();
  const [modal, setModal] = useState<any>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [page]);
  useEffect(() => { document.title = (page === "dashboard" ? "" : (PAGES.find((p) => p.id === page)?.label || "Settings") + " · ") + "PeraFlow"; }, [page]);
  const paid = f.paidFor(f.thisMonth);
  const today = M.today();
  const dueSoon = f.bills.filter((b: Bill) => !M.isIncomeItem(b) && b.active && !paid[b.id] && ["overdue", "due-soon"].includes(M.billStatus(b, false, f.thisMonth, today))).length;
  const budget = M.budgetReport(f.budgets.filter((b: Budget) => b.month === f.thisMonth), f.txs, f.thisMonth);
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const open = (m: any) => setModal(m);
  // Collapsed sidebar (icons only) on wide screens; remembered on this device.
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("pf-side") === "1"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("pf-side", collapsed ? "1" : "0"); } catch {} }, [collapsed]);
  // Sliding highlights for the main menu and the Settings link. They re-measure when the page or the sidebar width changes.
  const [mainNav, mainBox] = useIndicator(page + collapsed);
  const [footNav, footBox] = useIndicator(page + collapsed);
  const nav = (p: { id: string; label: string; icon: string }) => (
    <a key={p.id} href={"#/" + p.id} aria-current={page === p.id ? "page" : undefined} title={collapsed ? p.label : undefined}>
      <Icon name={p.icon} /><span className="lbl">{p.label}</span>{p.id === "bills" && dueSoon > 0 && <span className="badge" title="Due within 7 days or overdue">{dueSoon}</span>}
    </a>
  );
  return (
    <div className={"app" + (collapsed ? " collapsed" : "")}>
      <aside className={"sidebar" + (menu ? " open" : "")} aria-label="Main navigation">
        <div className="brand"><BrandMark /><div className="lbl"><b>PeraFlow</b><small>Personal finance</small></div></div>
        <nav className="nav" ref={mainNav as any}>
          <Pill box={mainBox} />
          <div className="nav-label">Workspace</div>
          {PAGES.map(nav)}
        </nav>
        {budget.limit > 0 && (
          <div className="side-card">
            <h4><Icon name="shield" size={16} />Budget check</h4>
            <div className="money" style={{ fontWeight: 700, fontSize: 15, margin: "6px 0 8px" }}>{budget.limit - budget.spent >= 0 ? `${M.peso(budget.limit - budget.spent)} left` : `${M.peso(budget.spent - budget.limit)} over`}</div>
            <Progress value={M.percent(budget.spent, budget.limit)} tone={budget.spent > budget.limit ? "over" : ""} />
            <div className="hint" style={{ marginTop: 6 }}>{M.percent(budget.spent, budget.limit)}% of {M.monthName(f.thisMonth)} plan used</div>
          </div>
        )}
        {f.live.length > 0 && (
          <nav className="nav side-accounts" aria-label="Accounts">
            <div className="nav-label">Accounts</div>
            {f.live.slice(0, 4).map((a: Account) => (
              <a key={a.id} href={`#/transactions?account=${a.id}`}><AcctIcon type={a.type} /><span style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span><small className="money muted" style={{ fontWeight: 500 }}>{M.peso(a.balance)}</small></span></a>
            ))}
          </nav>
        )}
        <div className="side-foot">
          <nav className="nav" ref={footNav as any}>
            <Pill box={footBox} />
            <a href="#/settings" aria-current={page === "settings" ? "page" : undefined} title={collapsed ? "Settings" : undefined}><Icon name="settings" /><span className="lbl">Settings</span></a>
            <a href="#" title={collapsed ? (dark ? "Light mode" : "Dark mode") : undefined} onClick={(e) => { e.preventDefault(); setTheme(dark ? "light" : "dark"); }}><Icon name={dark ? "sun" : "moon"} /><span className="lbl">{dark ? "Light mode" : "Dark mode"}</span></a>
            <a href="#" className="collapse-toggle" aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : undefined} onClick={(e) => { e.preventDefault(); setCollapsed(!collapsed); }}>
              <Icon name={collapsed ? "panel-open" : "panel-close"} /><span className="lbl">Collapse sidebar</span>
            </a>
          </nav>
          <div className="user-row" title={collapsed ? user.email : undefined}><span className="avatar">{(user.email || "?").slice(0, 2).toUpperCase()}</span><div className="who"><b>{user.email}</b><small>{f.status === "error" ? "Offline" : "All accounts synced"}</small></div>
            <Button size="sm" variant="ghost" iconOnly icon="logout" label="Log out" onClick={() => sb.auth.signOut()} /></div>
        </div>
      </aside>
      <div className={"scrim" + (menu ? " open" : "")} onClick={() => setMenu(false)} />
      <div className="main">
        <div className="topbar">
          <Button variant="ghost" iconOnly icon="menu" label="Open menu" onClick={() => setMenu(true)} />
          <div className="brand" style={{ padding: 0 }}><BrandMark size={28} /><b>PeraFlow</b></div>
          <span style={{ flex: 1 }} />
          <Button size="sm" variant="primary" iconOnly icon="plus" label="Add transaction" onClick={() => open({ type: "tx" })} />
        </div>
        {f.status === "error" && !f.accounts.length
          ? <div className="page"><LoadError msg={f.error} onRetry={() => f.api.reload().catch(() => {})} /></div>
          : page === "transactions" ? <Transactions open={open} params={params} />
          : page === "accounts" ? <Accounts open={open} />
          : page === "income" ? <Income open={open} />
          : page === "budgets" ? <Budgets />
          : page === "bills" ? <Bills open={open} />
          : page === "goals" ? <Goals open={open} />
          : page === "settings" ? <Settings user={user} theme={theme} setTheme={setTheme} />
          : <Dashboard open={open} />}
      </div>
      <Dialogs modal={modal} close={() => setModal(null)} />
    </div>
  );
}

function App() {
  const [theme, setTheme] = useTheme();
  const [session, setSession] = useState<any>(undefined);
  useEffect(() => {
    sb.auth.getSession().then(({ data }: any) => setSession(data.session)).catch(() => setSession(null));
    const { data } = sb.auth.onAuthStateChange((_e: any, s: any) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div className="auth-main" style={{ minHeight: "100dvh" }}><div className="brand"><BrandMark /><b>PeraFlow</b></div></div>;
  if (!session) return <ToastHost><Auth /></ToastHost>;
  // key: a different person signing in gets a fresh app, so one account's data never shows for another.
  return <ToastHost><FinanceProvider key={session.user.id} user={session.user}><Shell user={session.user} theme={theme} setTheme={setTheme} /></FinanceProvider></ToastHost>;
}
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
