// Tests for PeraFlow's money math. Run with:  node tests/money.test.js
const assert = require("assert");
const M = require("../src/money.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error("FAIL " + name + "\n  " + e.message); process.exitCode = 1; }
}

const tx = (kind, cents, day, extra = {}) => ({ kind, cents, happened_on: day, category: extra.category || "Food", voided_at: extra.voided_at || null });

test("parseAmount reads pesos as whole centavos", () => {
  assert.strictEqual(M.parseAmount("12"), 1200);
  assert.strictEqual(M.parseAmount("12.5"), 1250);
  assert.strictEqual(M.parseAmount("0.10"), 10);
  assert.strictEqual(M.parseAmount(".75"), 75);
  assert.strictEqual(M.parseAmount("1,234.56"), 123456);
  assert.strictEqual(M.parseAmount("₱1,234"), 123400);
  assert.strictEqual(M.parseAmount(" 12,50 "), 1250);
  assert.strictEqual(M.parseAmount("19.99"), 1999); // 19.99*100 is 1998.9999 in float math
});
test("parseAmount rejects junk instead of guessing", () => {
  for (const s of ["", "abc", "12abc", "1.234.56", "1,23,4", "-5", "1.999", "12345678901234"]) assert.ok(Number.isNaN(M.parseAmount(s)), s);
});
test("amountProblem enforces positive and the ₱10B limit", () => {
  assert.ok(M.amountProblem(0));
  assert.ok(M.amountProblem(NaN));
  assert.ok(M.amountProblem(1e12));
  assert.strictEqual(M.amountProblem(999999999999), "");
});
test("peso formats centavos", () => {
  assert.strictEqual(M.peso(123456), "₱1,234.56");
  assert.strictEqual(M.toInput(123405), "1234.05");
  assert.strictEqual(M.pesoCompact(456000), "₱4.6K");
  assert.strictEqual(M.pesoCompact(4560000), "₱46K");
});
test("summarize leaves out transfers and voided rows", () => {
  const s = M.summarize([
    tx("income", 2500000, "2026-11-01"),
    tx("expense", 12345, "2026-11-02"),
    tx("transfer", 50000, "2026-11-03"),
    tx("expense", 99999, "2026-11-04", { voided_at: "2026-11-05T00:00:00Z" }),
  ]);
  assert.deepStrictEqual(s, { income: 2500000, spending: 12345, net: 2487655 });
});
test("adding many small amounts stays exact", () => {
  const list = Array.from({ length: 1000 }, (_, i) => tx("expense", 10, "2026-11-01")); // ₱0.10 x 1000
  assert.strictEqual(M.summarize(list).spending, 10000);
});
test("months roll over the year", () => {
  assert.strictEqual(M.shiftMonth("2026-12", 1), "2027-01");
  assert.strictEqual(M.shiftMonth("2026-01", -1), "2025-12");
  assert.deepStrictEqual(M.monthRange("2026-12"), { from: "2026-12-01", to: "2027-01-01" });
  assert.strictEqual(M.daysInMonth("2028-02"), 29);
});
test("today uses Manila time", () => {
  // 2026-11-30 17:30 UTC is already Dec 1 in Manila (UTC+8)
  assert.strictEqual(M.today(new Date(Date.UTC(2026, 10, 30, 17, 30))), "2026-12-01");
});
test("monthlySeries groups by month", () => {
  const s = M.monthlySeries([tx("income", 100, "2026-10-31"), tx("expense", 40, "2026-11-01")], "2026-11", 2);
  assert.deepStrictEqual(s.map(x => x.net), [100, -40]);
});
test("dailyBalanceSeries walks back from today's total", () => {
  const s = M.dailyBalanceSeries(1000, [tx("income", 300, "2026-11-10"), tx("expense", 100, "2026-11-11"), tx("transfer", 999, "2026-11-11")], "2026-11-11", 3);
  assert.deepStrictEqual(s.map(x => x.cents), [800, 1100, 1000]);
});
test("account totals: credit card debt is a debt, not spendable", () => {
  const t = M.accountTotals([
    { type: "bank", balance: 500000 }, { type: "credit", balance: -120000 },
    { type: "investment", balance: 300000 }, { type: "cash", balance: 5000, archived_at: "x" },
  ]);
  assert.deepStrictEqual(t, { assets: 800000, debts: 120000, netWorth: 680000, spendable: 500000 });
});
test("bills: due day clamps to month end and paid bills are not owed", () => {
  assert.strictEqual(M.dueDate("2026-02", 31), "2026-02-28");
  const bills = [{ id: "a", active: true, due_day: 5, amount_centavos: 100 }, { id: "b", active: true, due_day: 20, amount_centavos: 250 }, { id: "c", active: false, due_day: 1, amount_centavos: 999 }];
  const unpaid = M.unpaidBills(bills, { a: true }, "2026-11");
  assert.deepStrictEqual(unpaid.map(b => b.id), ["b"]);
  assert.strictEqual(M.safeToSpend([{ type: "bank", balance: 1000 }], bills, { a: true }, "2026-11"), 750);
  assert.strictEqual(M.billStatus(bills[1], false, "2026-11", "2026-11-25"), "overdue");
  assert.strictEqual(M.billStatus(bills[1], false, "2026-11", "2026-11-15"), "due-soon");
  assert.strictEqual(M.billStatus(bills[1], true, "2026-11", "2026-11-25"), "paid");
});
test("monthly income is expected money, never a bill you owe", () => {
  const items = [
    { id: "rent", active: true, due_day: 5, amount_centavos: 1300000 },
    { id: "sal15", kind: "income", active: true, due_day: 15, amount_centavos: 1250000 },
    { id: "sal30", kind: "income", active: true, due_day: 31, amount_centavos: 1250000 },
    { id: "old", kind: "income", active: false, due_day: 1, amount_centavos: 999 },
  ];
  assert.deepStrictEqual(M.unpaidBills(items, {}, "2026-11").map(b => b.id), ["rent"]);
  assert.strictEqual(M.safeToSpend([{ type: "bank", balance: 2000000 }], items, {}, "2026-11"), 700000);
  const p = M.incomePlan(items, { sal15: true }, "2026-11");
  assert.strictEqual(p.expected, 2500000);
  assert.strictEqual(p.stillToCome, 1250000);
  assert.deepStrictEqual(p.pending.map(b => [b.id, b.due]), [["sal30", "2026-11-30"]]);
});
test("budgetReport compares planned and actual, and lists unbudgeted spending", () => {
  const r = M.budgetReport(
    [{ category: "Food", limit_centavos: 1000 }, { category: "Rent", limit_centavos: 5000 }],
    [tx("expense", 300, "2026-11-02"), tx("expense", 700, "2026-11-03", { category: "Fun" }), tx("expense", 50, "2026-10-30")],
    "2026-11");
  assert.deepStrictEqual(r.rows.map(x => [x.category, x.spent, x.left]), [["Food", 300, 700], ["Rent", 0, 5000]]);
  assert.deepStrictEqual(r.unplanned, [{ category: "Fun", spent: 700 }]);
  assert.strictEqual(r.limit, 6000);
});
test("goalProgress estimates a finish date from the last 90 days", () => {
  const g = M.goalProgress({ target_centavos: 100000 }, [{ amount_centavos: 30000, happened_on: "2026-11-01" }], "2026-11-23");
  assert.strictEqual(g.saved, 30000);
  assert.strictEqual(g.perMonth, 10000);
  assert.ok(g.eta > "2027-05-01" && g.eta < "2027-07-01", g.eta);
  assert.strictEqual(M.goalProgress({ target_centavos: 100 }, [{ amount_centavos: 100, happened_on: "2026-11-01" }], "2026-11-23").eta, "done");
});
test("CSV cells are quoted and protected from formulas", () => {
  assert.strictEqual(M.toCSV([["a,b", 'say "hi"', "=SUM(A1)"]]), '"a,b","say ""hi""",\'=SUM(A1)');
});

console.log(passed + " tests passed" + (process.exitCode ? ", some failed" : ""));
