import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { monthIndex, monthAt, FinancialEngine } from "./financialEngine.js";

describe("meses sem janela fixa", () => {
  test("ordem e ida e volta, inclusive anos antes e depois da janela antiga", () => {
    assert.ok(monthIndex("dez/22") < monthIndex("jan/23"));
    assert.equal(monthAt(monthIndex("out/26") + 3), "jan/27");
    assert.equal(monthAt(monthIndex("jan/30") - 1), "dez/29");
    assert.equal(monthIndex("???"), -1);
    assert.equal(monthIndex("xyz/26"), -1);
  });

  test("resumo mensal com mais de um ano de histórico sai em ordem", () => {
    // meses que ficavam fora da janela de 12 meses para trás viravam -1 e iam parar no começo
    const tx = ["2023-03-10", "2026-10-02", "2022-11-20", "2025-01-05"].map((date, i) => ({ id: i, date, type: "Saída", cat: "Outros", desc: "x", val: 10 }));
    const months = findSummary()(tx).map(r => r.month);
    assert.deepEqual(months, ["nov/22", "mar/23", "jan/25", "out/26"]);
  });
});

// o resumo mensal mora dentro de um dos motores do FinancialEngine
function findSummary() {
  for (const engine of Object.values(FinancialEngine)) if (engine && typeof engine.monthlySummary === "function") return engine.monthlySummary.bind(engine);
  throw new Error("monthlySummary não encontrado");
}

import { PlannedStatus } from "./financialEngine.js";
describe("previsto com começo e fim", () => {
  const netflix = { id: 1, desc: "Netflix", val: 55.9, cat: "Assinaturas", recurring: true, month: null, paid: {}, ignored: {} };
  test("sem começo nem fim (cadastrados antes da regra) vale em todo mês", () => {
    assert.ok(PlannedStatus.appliesTo(netflix, "jan/20"));
    assert.ok(PlannedStatus.appliesTo(netflix, "dez/35"));
  });
  test("Até: o último mês conta, o seguinte não", () => {
    const p = { ...netflix, until: "nov/26" };
    assert.ok(PlannedStatus.appliesTo(p, "nov/26"));
    assert.ok(!PlannedStatus.appliesTo(p, "dez/26"));
    assert.ok(PlannedStatus.appliesTo(p, "mar/25"), "os meses de antes continuam");
  });
  test("começa em: não aparece antes do mês do cadastro", () => {
    const p = { ...netflix, from: "out/26" };
    assert.ok(!PlannedStatus.appliesTo(p, "set/26"));
    assert.ok(PlannedStatus.appliesTo(p, "out/26"));
  });
  test("previsto de mês único continua só no seu mês", () => {
    const p = { ...netflix, recurring: false, month: "out/26" };
    assert.ok(PlannedStatus.appliesTo(p, "out/26"));
    assert.ok(!PlannedStatus.appliesTo(p, "nov/26"));
  });
  test("totais do mês respeitam o Até", () => {
    const engines = Object.values(FinancialEngine);
    const budget = engines.find(e => e && typeof e.committedForMonth === "function");
    const planned = [{ ...netflix, until: "out/26" }, { ...netflix, id: 2, desc: "Aluguel", val: 1650 }];
    assert.equal(budget.committedForMonth({ transactions: [], plannedExpenses: planned, month: "out/26", todayISO: "2026-10-04" }), 1705.9);
    assert.equal(budget.committedForMonth({ transactions: [], plannedExpenses: planned, month: "nov/26", todayISO: "2026-10-04" }), 1650);
    assert.deepEqual(budget.itemsForMonth(planned, "nov/26").map(p => p.desc), ["Aluguel"]);
    assert.equal(budget.subscriptions(planned, "nov/26").count, 1);
  });
});

describe("patrimônio mês a mês", () => {
  const t = (date, type, val, extra = {}) => ({ id: date + val, date, type, val, cat: "Outros", fixed: "Variavel", form: "pix", invTipo: null, ...extra });
  const flow = FinancialEngine.CashFlowAnalyzer;
  test("cada mês soma tudo até o seu fim; aporte não reduz o patrimônio", () => {
    const tx = [
      t("2026-08-05", "Entrada", 5000), t("2026-08-20", "Saída", 1000),
      t("2026-09-10", "Saída", 500, { cat: "Investimento", invTipo: "Aporte" }),
      t("2026-10-02", "Saída", 300),
    ];
    const s = flow.patrimonyByMonth(tx, "out/26", 4);
    assert.deepEqual(s.map(p => p.month), ["jul/26", "ago/26", "set/26", "out/26"]);
    assert.deepEqual(s.map(p => p.value), [0, 4000, 4000, 3700]);
    assert.deepEqual(s.map(p => p.hasData), [false, true, true, true]);
  });
  test("o último ponto bate com o patrimônio do Início", () => {
    const tx = [t("2025-12-01", "Entrada", 900), t("2026-10-01", "Saída", 120, { cat: "Investimento", invTipo: "Aporte" })];
    const last = flow.patrimonyByMonth(tx, "out/26").at(-1).value;
    assert.equal(last, flow.totals(tx).balance + flow.investmentNet(tx));
  });
});
