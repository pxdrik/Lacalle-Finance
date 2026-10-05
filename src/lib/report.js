// report.js: os números do relatório mensal (PDF), sem tela. O componente
// MonthlyReport só desenha o que sai daqui, e os testes conferem as contas.
import { FinancialEngine, monthKey, PlannedStatus } from "./financialEngine.js";

const { CashFlowAnalyzer, ExpenseAnalyzer, BudgetAnalyzer } = FinancialEngine;

/**
 * Relatório de `month` ("out/26"). Só o realizado (data <= hoje): no mês
 * atual, o relatório vale "até hoje".
 */
export function buildMonthlyReport({ transactions, plannedExpenses, wishes, month, todayISO }) {
  const realized = transactions.filter(t => t.date <= todayISO);
  const monthTx = realized.filter(t => monthKey(t.date) === month).sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  const totals = CashFlowAnalyzer.totals(monthTx);
  const categories = ExpenseAnalyzer.byCategory(monthTx, 0);
  const spent = categories.reduce((s, c) => s + c.value, 0);
  const plannedItems = BudgetAnalyzer.itemsForMonth(plannedExpenses, month).map(p => ({
    desc: p.desc, val: p.val, cat: p.cat,
    status: PlannedStatus.isPaid(p, month) ? "pago" : PlannedStatus.isIgnored(p, month) ? "ignorado" : "pendente",
  }));
  return {
    month,
    partial: monthKey(todayISO) === month,
    totals,
    patrimony: CashFlowAnalyzer.patrimonyByMonth(realized, month, 1)[0].value,
    categories: categories.map(c => ({ ...c, pct: spent > 0 ? Math.round(c.value / spent * 1000) / 10 : 0 })),
    planned: { items: plannedItems, stats: BudgetAnalyzer.stats(BudgetAnalyzer.itemsForMonth(plannedExpenses, month), month) },
    tx: monthTx,
    wishes: wishes.map(w => ({ name: w.name, saved: w.saved || 0, price: w.price, done: !!w.done, pct: Math.min(100, Math.round((w.saved || 0) / w.price * 100)) })),
  };
}
