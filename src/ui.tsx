// PeraFlow shared UI: icons, buttons, cards, dialogs, empty and loading states, charts.
// Loaded first of the .tsx files; the files share one global scope (no imports).
const { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } = React;
const M: any = (window as any).PFMoney;

/* ── Icons (Lucide-style line icons, 24px grid) ─────────────────────── */
const ICONS: Record<string, string> = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  transactions: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  wallet: "M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3M21 12v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5M17 14h.01",
  budget: "M21.2 15.9A10 10 0 1 1 8 2.8M22 12A10 10 0 0 0 12 2v10z",
  bills: "M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-3 2-3-2-3 2-3-2-3 2zM8 8h8M8 12h8M8 16h5",
  goal: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  plus: "M12 5v14M5 12h14",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4",
  moon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  pencil: "M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z",
  ban: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM4.9 4.9l14.2 14.2",
  undo: "M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13",
  trash: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5",
  x: "M18 6 6 18M6 6l12 12",
  left: "M15 18l-6-6 6-6",
  right: "M9 18l6-6-6-6",
  down: "M6 9l6 6 6-6",
  menu: "M4 6h16M4 12h16M4 18h16",
  "arrow-in": "M17 7 7 17M17 17H7V7",
  "arrow-out": "M7 17 17 7M7 7h10v10",
  swap: "M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16",
  piggy: "M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5zM2 9v1c0 1.1.9 2 2 2h1M16 11h.01",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  check: "M20 6 9 17l-5-5",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  cash: "M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01",
  bank: "M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l9 5H3z",
  ewallet: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01",
  credit: "M2 5h20v14H2zM2 10h20M6 15h4",
  investment: "M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6",
  savings: "M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z",
  google: "M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5zM12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22zM6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9zM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3 7.5l3.4 2.6C7.2 7.8 9.4 6 12 6z",
};
function Icon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  const filled = name === "google";
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ICONS.alert} />
    </svg>
  );
}
function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 20V5h7a4.5 4.5 0 0 1 0 9H6" /><path d="M3 9.5h12M3 13h9" />
      </svg>
    </span>
  );
}

/* ── Small building blocks ────────────────────────────────────────── */
type BtnProps = { children?: any; variant?: "primary" | "danger" | "ghost" | ""; size?: "sm" | ""; icon?: string; iconOnly?: boolean; label?: string;
  onClick?: (e: any) => void; disabled?: boolean; type?: "button" | "submit"; title?: string; busy?: boolean; className?: string };
function Button({ children, variant = "", size = "", icon, iconOnly, label, onClick, disabled, type = "button", title, busy, className = "" }: BtnProps) {
  return (
    <button type={type} className={["btn", variant, size, iconOnly ? "icon" : "", className].join(" ").trim()} onClick={onClick}
      disabled={disabled || busy} aria-label={iconOnly ? label : undefined} title={title || (iconOnly ? label : undefined)} aria-busy={busy || undefined}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {!iconOnly && children}
    </button>
  );
}
function Card({ title, subtitle, action, children, className = "", style }: { title?: any; subtitle?: any; action?: any; children?: any; className?: string; style?: any }) {
  return (
    <section className={"card " + className} style={style}>
      {(title || action) && (
        <div className="card-h">
          <div style={{ minWidth: 0 }}>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function Money({ cents, kind, signed, className = "" }: { cents: number; kind?: string; signed?: boolean; className?: string }) {
  const cls = kind === "income" ? "inc" : kind === "expense" ? "exp" : "";
  const sign = signed ? (kind === "income" ? "+" : kind === "expense" ? "−" : "") : "";
  return <span className={["money", cls, className].join(" ").trim()}>{sign}{M.peso(cents)}</span>;
}
function Empty({ icon = "wallet", title, text, action }: { icon?: string; title: string; text?: string; action?: any }) {
  return (
    <div className="empty">
      <span className="ic"><Icon name={icon} size={20} /></span>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
function Skeleton({ h = 16, w = "100%", r = 8, style }: { h?: number; w?: any; r?: number; style?: any }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}
function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Skeleton h={14} w="40%" /><Skeleton h={28} w="60%" />
      {Array.from({ length: lines - 1 }).map((_, i) => <Skeleton key={i} h={10} w={i % 2 ? "70%" : "90%"} />)}
    </div>
  );
}
function Field({ label, id, hint, error, children, className = "" }: { label: string; id: string; hint?: string; error?: string; children: any; className?: string }) {
  return (
    <div className={"field " + className}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <span className="error-text" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
function Seg({ value, options, onChange, label, full }: { value: string; options: [string, string][]; onChange: (v: string) => void; label: string; full?: boolean }) {
  return (
    <div className={"seg" + (full ? " full" : "")} role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}
function Progress({ value, tone }: { value: number; tone?: "over" | "warn" | "" }) {
  const v = Math.max(0, Math.min(100, value));
  return <div className={"bar " + (tone || "")} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}><i style={{ transform: `scaleX(${v / 100})` }} /></div>;
}
function Segments({ value, count = 16 }: { value: number; count?: number }) {
  const on = Math.round((Math.max(0, Math.min(100, value)) / 100) * count);
  return <div className="segs" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>{Array.from({ length: count }).map((_, i) => <i key={i} className={i < on ? "on" : ""} />)}</div>;
}
function MonthPicker({ month, onChange, max }: { month: string; onChange: (m: string) => void; max?: string }) {
  return (
    <div className="month-pick">
      <Button size="sm" variant="ghost" iconOnly icon="left" label="Previous month" onClick={() => onChange(M.shiftMonth(month, -1))} />
      <span aria-live="polite">{M.monthName(month)}</span>
      <Button size="sm" variant="ghost" iconOnly icon="right" label="Next month" disabled={!!max && month >= max} onClick={() => onChange(M.shiftMonth(month, 1))} />
    </div>
  );
}
function AcctIcon({ type }: { type: string }) { return <Icon name={type === "cash" ? "cash" : type === "ewallet" ? "ewallet" : type === "credit" ? "credit" : type === "investment" ? "investment" : type === "savings" ? "savings" : "bank"} />; }

/* ── Dialogs ────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children, footer, width }: { title: string; onClose: () => void; children: any; footer?: any; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input,select,textarea,button:not(.close)");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) { // keep keyboard focus inside the dialog
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href]")).filter((x) => !(x as any).disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, []);
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref} style={width ? { maxWidth: width } : undefined}>
        <div className="modal-h"><h2 id="modal-title">{title}</h2><Button className="close" variant="ghost" size="sm" iconOnly icon="x" label="Close" onClick={onClose} /></div>
        {children}
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
// A form inside a modal: handles busy state and shows the error from onSubmit.
function FormModal({ title, onClose, onSubmit, submitLabel = "Save", danger, children, width }: { title: string; onClose: () => void; onSubmit: () => Promise<string | void>; submitLabel?: string; danger?: boolean; children: any; width?: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(e: any) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const msg = await onSubmit(); if (msg) setErr(msg); else onClose(); }
    catch (x: any) { setErr(friendlyError(x)); }
    setBusy(false);
  }
  return (
    <Modal title={title} onClose={onClose} width={width}>
      <form onSubmit={go} noValidate>
        <div className="modal-b">{err && <div className="alert" role="alert"><Icon name="alert" /><span className="grow">{err}</span></div>}{children}</div>
        <div className="modal-f">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} busy={busy}>{busy ? "Saving…" : submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
function Confirm({ title, text, confirmLabel, danger = true, onConfirm, onClose }: { title: string; text: any; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<string | void>; onClose: () => void }) {
  return <FormModal title={title} onClose={onClose} onSubmit={onConfirm} submitLabel={confirmLabel} danger={danger} width={420}><p className="muted">{text}</p></FormModal>;
}

/* ── Toasts ─────────────────────────────────────────────────────────── */
const ToastCtx = createContext<(msg: string, bad?: boolean) => void>(() => {});
function ToastHost({ children }: { children: any }) {
  const [items, setItems] = useState<{ id: number; msg: string; bad?: boolean }[]>([]);
  const push = useCallback((msg: string, bad?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, msg, bad }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), bad ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{items.map((t) => <div key={t.id} className={"toast" + (t.bad ? " bad" : "")}>{t.msg}</div>)}</div>
    </ToastCtx.Provider>
  );
}
const useToast = () => useContext(ToastCtx);

// Turns database and network errors into plain sentences.
function friendlyError(e: any): string {
  const m = String(e?.message || e || "Something went wrong.");
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
  if (/duplicate key|already exists|unique/i.test(m)) return "That one already exists.";
  if (/violates foreign key|still referenced/i.test(m)) return "It's still used by other records, so it can't be removed. Archive it instead.";
  if (/JWT|not authenticated|permission denied/i.test(m)) return "Your session ended. Log in again.";
  return m.replace(/^error:\s*/i, "");
}

/* ── Charts (plain SVG) ───────────────────────────────────────────── */
function Sparkline({ values, color = "var(--accent)", height = 34, fill = true, dot = true }: { values: number[]; color?: string; height?: number; fill?: boolean; dot?: boolean }) {
  const w = 200, h = height, pad = 3;
  const gid = useMemo(() => "g" + Math.random().toString(36).slice(2, 8), []);
  if (values.length < 2) return <svg className="chart" viewBox={`0 0 ${w} ${h}`} style={{ height }} aria-hidden="true" />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (w - pad * 2), h - pad - ((v - min) / span) * (h - pad * 2)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      {fill && <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>}
      {fill && <path d={`${d} L${last[0]} ${h} L${pts[0][0]} ${h}Z`} fill={`url(#${gid})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {dot && <circle cx={last[0]} cy={last[1]} r="3" fill="var(--surface)" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
// Width of an element in CSS pixels, so charts draw at real size and their text stays readable.
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(Math.round(e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
// Grouped bars (income vs spending) with a net line, one group per month.
function CashflowChart({ series }: { series: { month: string; income: number; spending: number; net: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, width] = useWidth();
  const W = Math.max(300, width || 640), H = 240, L = 54, R = 8, T = 14, B = 26;
  const maxV = Math.max(100000, ...series.map((s) => Math.max(s.income, s.spending))); // at least a ₱1,000 scale
  const minV = Math.min(0, ...series.map((s) => s.net));
  const step = niceStep((maxV - minV) / 4);
  const top = Math.ceil(maxV / step) * step, bottom = Math.floor(minV / step) * step;
  const y = (v: number) => T + ((top - v) / (top - bottom || 1)) * (H - T - B);
  const gw = (W - L - R) / series.length, bw = Math.min(18, gw * 0.26);
  const ticks: number[] = []; for (let v = bottom; v <= top + 1; v += step) ticks.push(v);
  const cx = (i: number) => L + gw * i + gw / 2;
  const line = series.map((s, i) => (i ? "L" : "M") + cx(i).toFixed(1) + " " + y(s.net).toFixed(1)).join(" ");
  const h = hover != null ? series[hover] : null;
  return (
    <div style={{ position: "relative" }} ref={box}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label="Monthly income, spending and net saved" onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => <g key={v}><line className="grid-line" x1={L} x2={W - R} y1={y(v)} y2={y(v)} strokeDasharray={v === 0 ? "" : "3 4"} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{M.pesoCompact(v)}</text></g>)}
        {series.map((s, i) => (
          <g key={s.month} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${M.monthName(s.month)}: income ${M.peso(s.income)}, spending ${M.peso(s.spending)}, net ${M.peso(s.net)}`}>
            <rect x={L + gw * i + 2} y={T} width={gw - 4} height={H - T - B} rx="8" fill={hover === i ? "var(--accent-softer)" : "transparent"} />
            <rect x={cx(i) - bw - 2} y={y(s.income)} width={bw} height={Math.max(0, y(0) - y(s.income))} rx="4" fill="var(--income)" />
            <rect x={cx(i) + 2} y={y(s.spending)} width={bw} height={Math.max(0, y(0) - y(s.spending))} rx="4" fill="var(--spend)" opacity=".85" />
            <text x={cx(i)} y={H - 6} textAnchor="middle" style={{ fontWeight: hover === i ? 700 : 500, fill: hover === i ? "var(--ink)" : undefined }}>{M.monthName(s.month, true)}</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="var(--net)" strokeWidth="2" strokeLinejoin="round" />
        {series.map((s, i) => <circle key={i} cx={cx(i)} cy={y(s.net)} r="3.5" fill="var(--surface)" stroke="var(--net)" strokeWidth="2" />)}
      </svg>
      {h && hover != null && (
        <div className="chart-tip" style={{ left: `${(cx(hover) / W) * 100}%`, top: `${(Math.min(y(h.income), y(h.spending), y(h.net)) / H) * 100}%` }}>
          <b>{M.monthName(h.month)}</b><br />
          Income {M.peso(h.income)}<br />Spending {M.peso(h.spending)}<br />Net saved {M.peso(h.net)}
        </div>
      )}
    </div>
  );
}
function niceStep(raw: number) {
  if (raw <= 0) return 100000; // ₱1,000
  const p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const DONUT_COLORS = ["var(--accent)", "var(--spend)", "var(--net)", "var(--warn)", "#8b6fd1", "#3aa3c4", "var(--faint)"];
function Donut({ data, total, label }: { data: { label: string; cents: number }[]; total: number; label: string }) {
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={label}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
        {total > 0 && data.map((d, i) => {
          const len = (d.cents / total) * C, off = acc; acc += len;
          return <circle key={d.label} cx="70" cy="70" r={R} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="16"
            strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" strokeLinecap="butt" />;
        })}
        <text x="70" y="66" textAnchor="middle" style={{ fontSize: 11, fill: "var(--muted)" }}>Total</text>
        <text x="70" y="84" textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: "var(--ink)" }}>{M.pesoCompact(total)}</text>
      </svg>
      <div className="donut-legend">
        {data.map((d, i) => (
          <div key={d.label}><span className="dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} /><span>{d.label}</span><b className="num">{M.percent(d.cents, total)}%</b></div>
        ))}
      </div>
    </div>
  );
}
