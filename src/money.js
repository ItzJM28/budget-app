/* PeraFlow money and date math.
 * Plain JavaScript so it runs in the browser (window.PFMoney) and in Node tests (require).
 * Rules: money is always whole centavos (integers). Transfers are never income or spending.
 * Voided rows never count. Dates are "YYYY-MM-DD" strings in Asia/Manila time.
 */
(function (root) {
  "use strict";
  var TZ = "Asia/Manila";
  var MAX_CENTAVOS = 1e12; // ₱10,000,000,000 — the legacy numeric(12,2) column's limit

  /* ── Amounts ─────────────────────────────────────────── */

  // Text the person typed -> whole centavos, or NaN. Done on the text, never with float math.
  //   "12" "12.5" "12.50" ".75" -> 1200 1250 1250 75
  //   "1,234" "1,234.56" "₱1,234" -> commas are thousands separators
  //   "12,5" "12,50" -> one comma with 1-2 digits after is a decimal comma
  //   "12abc" "1.234.56" "1,23,4" "" -> NaN
  function parseAmount(raw) {
    var s = String(raw == null ? "" : raw).trim().replace(/^(₱|PHP|P)\s*/i, "").replace(/\s+/g, "");
    var norm = null;
    if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) norm = s.replace(/,/g, "");
    else if (/^\d+,\d{1,2}$/.test(s)) norm = s.replace(",", ".");
    else if (/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(s)) norm = s;
    if (norm === null) return NaN;
    var parts = norm.split(".");
    var whole = parts[0] || "0", frac = (parts[1] || "") + "00";
    if (whole.length > 13) return NaN;
    return Number(whole) * 100 + Number(frac.slice(0, 2));
  }

  // Checks an amount for a form. Returns an error message, or "" when it's fine.
  function amountProblem(cents) {
    if (!(cents > 0)) return "Enter an amount like 250 or 1,234.50.";
    if (cents >= MAX_CENTAVOS) return "That amount is too large. Keep it under ₱10,000,000,000.";
    return "";
  }

  var PESO = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
  var PESO0 = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
  // 123456 -> "₱1,234.56". Division is for display only.
  function peso(cents) { return PESO.format(Number.isFinite(cents) ? cents / 100 : 0); }
  // 123456 -> "₱1,235" (whole pesos, for chart labels and tight spaces)
  function pesoShort(cents) { return PESO0.format(Number.isFinite(cents) ? Math.round(cents / 100) : 0); }
  // 1234567800 -> "₱12.3M", 4560000 -> "₱45.6K"
  function pesoCompact(cents) {
    var p = Math.abs(cents) / 100, sign = cents < 0 ? "−" : "";
    if (p >= 1e6) return sign + "₱" + (p / 1e6).toFixed(p >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (p >= 1e3) return sign + "₱" + (p / 1e3).toFixed(p >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
    return sign + "₱" + Math.round(p);
  }
  // Centavos -> the text to put back in an input: 123450 -> "1234.50"
  function toInput(cents) {
    var c = Math.abs(Math.round(cents || 0));
    return Math.floor(c / 100) + "." + String(c % 100).padStart(2, "0");
  }
  function percent(part, whole) { return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0; }

  /* ── Dates (Asia/Manila) ─────────────────────────────── */

  var DAY = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  function today(now) {
    var p = {};
    DAY.formatToParts(now || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + "-" + p.month + "-" + p.day;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function monthOf(day) { return String(day).slice(0, 7); } // "2026-11-23" -> "2026-11"
  function shiftMonth(m, by) {
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
    var t = y * 12 + (mo - 1) + by;
    return Math.floor(t / 12) + "-" + pad((t % 12) + 1);
  }
  // "2026-02" -> { from: "2026-02-01", to: "2026-03-01" } (to is exclusive)
  function monthRange(m) { return { from: m + "-01", to: shiftMonth(m, 1) + "-01" }; }
  function daysInMonth(m) {
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
    return new Date(Date.UTC(y, mo, 0)).getUTCDate();
  }
  function monthName(m, short) {
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-PH", { month: short ? "short" : "long", year: short ? undefined : "numeric", timeZone: "UTC" });
  }
  function dayLabel(d, withYear) {
    var y = Number(d.slice(0, 4)), mo = Number(d.slice(5, 7)), da = Number(d.slice(8, 10));
    if (!y || !mo || !da) return d;
    return new Date(Date.UTC(y, mo - 1, da)).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined, timeZone: "UTC" });
  }
  // Whole days from a to b ("YYYY-MM-DD"), b - a
  function daysBetween(a, b) {
    var pa = a.split("-").map(Number), pb = b.split("-").map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }
  function addDays(d, n) {
    var p = d.split("-").map(Number);
    var x = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return x.getUTCFullYear() + "-" + pad(x.getUTCMonth() + 1) + "-" + pad(x.getUTCDate());
  }

  /* ── Totals ──────────────────────────────────────────── */

  function active(txs) { return (txs || []).filter(function (t) { return !t.voided_at; }); }
  function inMonth(txs, m) { return (txs || []).filter(function (t) { return monthOf(t.happened_on) === m; }); }

  // Income, spending and net for a list of transactions. Transfers and voided rows are left out.
  function summarize(txs) {
    var income = 0, spending = 0;
    active(txs).forEach(function (t) {
      if (t.kind === "income") income += t.cents;
      else if (t.kind === "expense") spending += t.cents;
    });
    return { income: income, spending: spending, net: income - spending };
  }

  // Spending per category, largest first: [{ category, cents }]
  function byCategory(txs) {
    var m = {};
    active(txs).forEach(function (t) { if (t.kind === "expense") m[t.category] = (m[t.category] || 0) + t.cents; });
    return Object.keys(m).map(function (k) { return { category: k, cents: m[k] }; })
      .sort(function (a, b) { return b.cents - a.cents || (a.category < b.category ? -1 : 1); });
  }

  // The last n months up to endMonth: [{ month, income, spending, net }]
  function monthlySeries(txs, endMonth, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var m = shiftMonth(endMonth, -i);
      var s = summarize(inMonth(txs, m));
      out.push({ month: m, income: s.income, spending: s.spending, net: s.net });
    }
    return out;
  }

  // How much money moved into or out of the person's accounts on each day (transfers move
  // money between their own accounts, so they don't change the total). Used to draw the
  // balance line backwards from today's real total.
  function dailyBalanceSeries(totalNow, txs, endDay, days) {
    var change = {};
    active(txs).forEach(function (t) {
      if (t.kind === "income") change[t.happened_on] = (change[t.happened_on] || 0) + t.cents;
      else if (t.kind === "expense") change[t.happened_on] = (change[t.happened_on] || 0) - t.cents;
    });
    // Anything dated after endDay is already in totalNow; take it back out first.
    var bal = totalNow;
    Object.keys(change).forEach(function (d) { if (d > endDay) bal -= change[d]; });
    var out = [];
    for (var i = 0; i < days; i++) {
      var d = addDays(endDay, -i);
      out.push({ day: d, cents: bal });
      bal -= change[d] || 0;
    }
    return out.reverse();
  }

  /* ── Accounts ────────────────────────────────────────── */

  var ACCOUNT_TYPES = {
    cash: "Cash", bank: "Bank", savings: "Savings", ewallet: "E-wallet", credit: "Credit card", investment: "Investment"
  };
  // Money you can spend from right away. Credit cards and investments don't count.
  function isSpendable(type) { return type === "cash" || type === "bank" || type === "savings" || type === "ewallet"; }
  function accountTotals(accounts) {
    var assets = 0, debts = 0, spendable = 0;
    (accounts || []).forEach(function (a) {
      if (a.archived_at) return;
      if (a.balance >= 0) assets += a.balance; else debts += -a.balance;
      if (isSpendable(a.type)) spendable += a.balance;
    });
    return { assets: assets, debts: debts, netWorth: assets - debts, spendable: spendable };
  }

  /* ── Bills ───────────────────────────────────────────── */

  // A bill's due date in a month. Day 31 in a 30-day month becomes the 30th.
  function dueDate(month, dueDay) { return month + "-" + pad(Math.min(dueDay, daysInMonth(month))); }
  // "paid" | "overdue" | "due-soon" (within 7 days) | "upcoming"
  function billStatus(bill, paid, month, todayStr) {
    if (paid) return "paid";
    var d = dueDate(month, bill.due_day), left = daysBetween(todayStr, d);
    if (left < 0) return "overdue";
    if (left <= 7) return "due-soon";
    return "upcoming";
  }
  // The bills table also holds monthly income schedules (kind "income"). Older rows have no kind: they're bills.
  function isIncomeItem(b) { return b.kind === "income"; }
  function withDue(list, month) {
    return list.map(function (b) { return Object.assign({}, b, { due: dueDate(month, b.due_day) }); })
      .sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
  }
  // Unpaid, active bills for a month. Paid bills are never counted as owed, and income is never a bill.
  function unpaidBills(bills, paidIds, month) {
    return withDue((bills || []).filter(function (b) { return !isIncomeItem(b) && b.active && !paidIds[b.id]; }), month);
  }
  // Monthly income for a month: what's expected from active schedules, what's in, and what's still to come.
  function incomePlan(bills, paidIds, month) {
    var items = withDue((bills || []).filter(function (b) { return isIncomeItem(b) && b.active; }), month);
    var pending = items.filter(function (b) { return !paidIds[b.id]; });
    return {
      items: items,
      pending: pending,
      expected: sumBy(items, "amount_centavos"),
      stillToCome: sumBy(pending, "amount_centavos")
    };
  }
  function sumBy(list, key) { return (list || []).reduce(function (s, x) { return s + (x[key] || 0); }, 0); }

  // Safe to spend: spendable balances minus this month's bills that are still unpaid.
  function safeToSpend(accounts, bills, paidIds, month) {
    return accountTotals(accounts).spendable - sumBy(unpaidBills(bills, paidIds, month), "amount_centavos");
  }

  /* ── Budgets ─────────────────────────────────────────── */

  // Planned vs actual for one month: rows for every budgeted category plus any spending without a budget.
  function budgetReport(budgets, txs, month) {
    var spent = {};
    byCategory(inMonth(txs, month)).forEach(function (r) { spent[r.category] = r.cents; });
    var rows = (budgets || []).map(function (b) {
      var s = spent[b.category] || 0;
      return { category: b.category, limit: b.limit_centavos, spent: s, left: b.limit_centavos - s };
    });
    var planned = {};
    rows.forEach(function (r) { planned[r.category] = true; });
    var unplanned = Object.keys(spent).filter(function (c) { return !planned[c]; })
      .map(function (c) { return { category: c, spent: spent[c] }; });
    return {
      rows: rows,
      unplanned: unplanned,
      limit: sumBy(rows, "limit"),
      spent: sumBy(rows, "spent"),
      unplannedSpent: sumBy(unplanned, "spent")
    };
  }

  /* ── Savings goals ─────────────────────────────────── */

  // When a goal will be reached at the pace of the last 90 days of contributions.
  // Returns { saved, left, pct, perMonth, eta } where eta is "YYYY-MM-DD", "done" or null (no pace yet).
  function goalProgress(goal, contributions, todayStr) {
    var saved = 0, recent = 0, since = addDays(todayStr, -90);
    (contributions || []).forEach(function (c) {
      saved += c.amount_centavos;
      if (c.happened_on > since && c.happened_on <= todayStr) recent += c.amount_centavos;
    });
    var left = Math.max(0, goal.target_centavos - saved);
    var perMonth = Math.round(recent / 3);
    var eta = null;
    if (left === 0) eta = "done";
    else if (perMonth > 0) eta = addDays(todayStr, Math.ceil((left / perMonth) * 30.44));
    return { saved: saved, left: left, pct: Math.min(100, percent(saved, goal.target_centavos)), perMonth: perMonth, eta: eta };
  }

  /* ── CSV ─────────────────────────────────────────────── */

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    // Stop spreadsheet formula injection, then quote when needed.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(rows) { return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"); }

  var PF = {
    TZ: TZ, MAX_CENTAVOS: MAX_CENTAVOS, ACCOUNT_TYPES: ACCOUNT_TYPES,
    parseAmount: parseAmount, amountProblem: amountProblem, peso: peso, pesoShort: pesoShort, pesoCompact: pesoCompact,
    toInput: toInput, percent: percent,
    today: today, monthOf: monthOf, shiftMonth: shiftMonth, monthRange: monthRange, daysInMonth: daysInMonth,
    monthName: monthName, dayLabel: dayLabel, daysBetween: daysBetween, addDays: addDays,
    active: active, inMonth: inMonth, summarize: summarize, byCategory: byCategory, monthlySeries: monthlySeries,
    dailyBalanceSeries: dailyBalanceSeries, isSpendable: isSpendable, accountTotals: accountTotals,
    dueDate: dueDate, billStatus: billStatus, unpaidBills: unpaidBills, isIncomeItem: isIncomeItem, incomePlan: incomePlan,
    sumBy: sumBy, safeToSpend: safeToSpend,
    budgetReport: budgetReport, goalProgress: goalProgress, csvCell: csvCell, toCSV: toCSV
  };
  if (typeof module === "object" && module.exports) module.exports = PF;
  else root.PFMoney = PF;
})(typeof self !== "undefined" ? self : this);
