// ============================================================================
// financialEngine.test.js
//
// Testes do "cérebro" do Lacalle Finance: projeções de saldo, cálculo de
// metas, orçamento, health score etc. Usa só o test runner nativo do Node
// (node:test + node:assert/strict) — sem instalar nada.
//
// Como rodar (dentro da pasta do projeto):
//   node --test src/lib/financialEngine.test.js
//
// Importa DIRETO do arquivo de verdade usado pelo app (financialEngine.js)
// — não existe mais nenhuma cópia duplicada pra manter sincronizada.
// ============================================================================
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FinancialEngine, monthKey, addDaysStr } from "./financialEngine.js";

const { CashFlowAnalyzer, BudgetAnalyzer, GoalAnalyzer, HealthScoreEngine } = FinancialEngine;

// ---- Helpers de dados de teste ----
const today = "2026-07-20"; // mesma data "hoje" usada no resto da conversa
const tx = (over) => ({ id: 1, date: today, type: "Saída", fixed: "Variavel", cat: "Outros", desc: "x", val: 100, form: "pix", invTipo: null, ...over });

describe("CashFlowAnalyzer.projectionAt", () => {
  test("soma entradas futuras e subtrai saídas futuras do saldo atual", () => {
    const transactions = [
      tx({ id: 1, date: addDaysStr(today, 5), type: "Entrada", val: 1000, cat: "Salario / Entradas" }),
      tx({ id: 2, date: addDaysStr(today, 10), type: "Saída", val: 300 }),
    ];
    const value = CashFlowAnalyzer.projectionAt({
      transactions, plannedExpenses: [], balance: 500, todayISO: today,
      currentMonthKey: monthKey(today), daysAhead: 30,
    });
    // 500 (saldo atual) + 1000 (entrada futura) - 300 (saída futura) = 1200
    assert.equal(value, 1200);
  });

  test("ignora transações de investimento no fluxo de caixa comum (entram como aporte/resgate)", () => {
    const transactions = [
      tx({ id: 1, date: addDaysStr(today, 5), cat: "Investimento", invTipo: "Aporte", val: 200, type: "Saída" }),
    ];
    const value = CashFlowAnalyzer.projectionAt({
      transactions, plannedExpenses: [], balance: 1000, todayISO: today,
      currentMonthKey: monthKey(today), daysAhead: 30,
    });
    // Aporte reduz o saldo disponível assim como uma saída normal
    assert.equal(value, 800);
  });

  test("transações de hoje ou passadas não entram na projeção futura", () => {
    const transactions = [
      tx({ id: 1, date: today, type: "Entrada", val: 5000 }), // é "hoje", não conta como futuro (filtro é date>todayISO)
    ];
    const value = CashFlowAnalyzer.projectionAt({
      transactions, plannedExpenses: [], balance: 300, todayISO: today,
      currentMonthKey: monthKey(today), daysAhead: 30,
    });
    assert.equal(value, 300);
  });

  test("considera contas previstas pendentes dentro da janela de dias", () => {
    const mk = monthKey(today);
    const plannedExpenses = [
      { id: 1, desc: "Aluguel", val: 400, cat: "Outros", form: "pix", recurring: true, month: null, notes: "", paid: {} },
    ];
    const value = CashFlowAnalyzer.projectionAt({
      transactions: [], plannedExpenses, balance: 1000, todayISO: today,
      currentMonthKey: mk, daysAhead: 5, // dentro do mesmo mês, evita contar o aluguel 2x
    });
    assert.equal(value, 600); // 1000 - 400 (aluguel recorrente ainda não pago)
  });

  test("uma conta recorrente pendente é descontada uma vez por mês dentro da janela projetada", () => {
    const mk = monthKey(today);
    const plannedExpenses = [
      { id: 1, desc: "Aluguel", val: 400, cat: "Outros", form: "pix", recurring: true, month: null, notes: "", paid: {} },
    ];
    // 30 dias a partir de 20/jul cruzam para agosto, então o aluguel recorrente
    // é descontado uma vez em jul/26 e outra em ago/26 — comportamento
    // intencional do motor (uma assinatura recorrente vence todo mês).
    const value = CashFlowAnalyzer.projectionAt({
      transactions: [], plannedExpenses, balance: 1000, todayISO: today,
      currentMonthKey: mk, daysAhead: 30,
    });
    assert.equal(value, 200); // 1000 - 400 (jul) - 400 (ago)
  });
});

describe("BudgetAnalyzer", () => {
  test("itemsForMonth traz recorrentes + itens específicos do mês", () => {
    const plannedExpenses = [
      { id: 1, month: "jul/26", recurring: false, desc: "Viagem" },
      { id: 2, month: null, recurring: true, desc: "Assinatura" },
      { id: 3, month: "ago/26", recurring: false, desc: "Outro mês" },
    ];
    const items = BudgetAnalyzer.itemsForMonth(plannedExpenses, "jul/26");
    assert.deepEqual(items.map(i => i.desc).sort(), ["Assinatura", "Viagem"]);
  });

  test("stats soma total pago vs pendente corretamente", () => {
    const month = "jul/26";
    const items = [
      { val: 100, paid: { [month]: true } },
      { val: 250, paid: {} },
    ];
    const stats = BudgetAnalyzer.stats(items, month);
    assert.equal(stats.total, 350);
    assert.equal(stats.paid, 100);
    assert.equal(stats.pending, 250);
  });

  test("monthlyInstallment divide o valor total pelas parcelas", () => {
    assert.equal(BudgetAnalyzer.monthlyInstallment(1000, 4), 250);
  });

  test("monthlyInstallment retorna null para entradas inválidas", () => {
    assert.equal(BudgetAnalyzer.monthlyInstallment(NaN, 4), null);
    assert.equal(BudgetAnalyzer.monthlyInstallment(1000, 0), null);
  });
});

describe("GoalAnalyzer.enhance (metas/Desejos)", () => {
  test("calcula percentual guardado e valor restante", () => {
    const wishes = [{ id: 1, name: "Notebook", price: 5000, saved: 1000, priority: "Alta", monthsTarget: 5, notes: "", done: false }];
    const [w] = GoalAnalyzer.enhance(wishes, null);
    assert.equal(w.remaining, 4000);
    assert.equal(w.pct, 20);
    assert.equal(w.monthlyByTarget, 800); // 4000 / 5 meses
  });

  test("estima data de conquista quando há uma média mensal de economia", () => {
    const wishes = [{ id: 1, name: "Viagem", price: 3000, saved: 0, priority: "Média", monthsTarget: 0, notes: "", done: false }];
    const [w] = GoalAnalyzer.enhance(wishes, 500); // guarda R$500/mês em média
    assert.equal(w.estMonths, 6); // 3000 / 500
    assert.ok(w.etaDate); // deve ter calculado uma data estimada
  });

  test("meta já alcançada (saved >= price) não fica com percentual acima de 100", () => {
    const wishes = [{ id: 1, name: "Fone", price: 200, saved: 500, priority: "Baixa", monthsTarget: 0, notes: "", done: true }];
    const [w] = GoalAnalyzer.enhance(wishes, null);
    assert.equal(w.pct, 100);
    assert.equal(w.remaining, 0);
  });

  test("avgMonthlySavings usa só os últimos 6 meses com saldo positivo", () => {
    const summary = [
      { month: "jan/26", balance: -100 },
      { month: "fev/26", balance: 200 },
      { month: "mar/26", balance: 400 },
    ];
    const avg = GoalAnalyzer.avgMonthlySavings(summary);
    assert.equal(avg, 300); // média de (200+400)/2, ignorando o mês negativo
  });

  test("avgMonthlySavings retorna null se nenhum mês teve saldo positivo", () => {
    const summary = [{ month: "jan/26", balance: -50 }];
    assert.equal(GoalAnalyzer.avgMonthlySavings(summary), null);
  });
});

describe("HealthScoreEngine.compute", () => {
  test("classifica taxa de economia alta como Excelente", () => {
    const scores = HealthScoreEngine.compute({
      savingsRate: 25, committedIncome: null, fixedVarSplit: { fixed: 0, variavel: 0 },
      patrimonio: 100, balance: 100, reservaMeses: null, reservaFinanceira: 0,
    });
    const item = scores.find(s => s.label === "Taxa de economia");
    assert.equal(item.status, "Excelente");
  });

  test("saldo negativo é classificado como Crítica", () => {
    const scores = HealthScoreEngine.compute({
      savingsRate: null, committedIncome: null, fixedVarSplit: { fixed: 0, variavel: 0 },
      patrimonio: -50, balance: -200, reservaMeses: null, reservaFinanceira: 0,
    });
    const item = scores.find(s => s.label === "Saldo disponível");
    assert.equal(item.status, "Crítica");
  });

  test("indicadores com valor null (ex.: sem transações suficientes) não aparecem na lista", () => {
    const scores = HealthScoreEngine.compute({
      savingsRate: null, committedIncome: null, fixedVarSplit: { fixed: 0, variavel: 0 },
      patrimonio: 0, balance: 0, reservaMeses: null, reservaFinanceira: 0,
    });
    assert.ok(!scores.some(s => s.label === "Taxa de economia"));
    assert.ok(!scores.some(s => s.label === "Reserva financeira"));
  });
});
