import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyReport } from "./report.js";

const t = (id, date, type, val, cat = "Outros", extra = {}) => ({ id, date, type, val, cat, desc: `t${id}`, fixed: "Variavel", form: "pix", invTipo: null, ...extra });

describe("relatório mensal", () => {
  const transactions = [
    t(1, "2026-09-30", "Entrada", 1000, "Salario / Entradas"),
    t(2, "2026-10-01", "Entrada", 5000, "Salario / Entradas"),
    t(3, "2026-10-02", "Saída", 300, "Alimentação"),
    t(4, "2026-10-03", "Saída", 100, "Transporte"),
    t(5, "2026-10-03", "Saída", 600, "Investimento", { invTipo: "Aporte" }),
    t(6, "2026-10-20", "Saída", 999, "Lazer"), // futura: fora do "até hoje"
  ];
  const plannedExpenses = [
    { id: 11, desc: "Netflix", val: 55, cat: "Assinaturas", recurring: true, paid: { "out/26": true }, ignored: {} },
    { id: 12, desc: "Aluguel", val: 1500, cat: "Outros", recurring: true, paid: {}, ignored: {} },
    { id: 13, desc: "IPVA", val: 800, cat: "Transporte", recurring: false, month: "set/26", paid: {}, ignored: {} },
  ];
  const wishes = [{ id: 21, name: "Viagem", price: 2000, saved: 500 }];
  const r = buildMonthlyReport({ transactions, plannedExpenses, wishes, month: "out/26", todayISO: "2026-10-04" });

  test("só o mês pedido e só até hoje, em ordem de data", () => {
    assert.deepEqual(r.tx.map(x => x.id), [2, 3, 4, 5]);
    assert.equal(r.partial, true);
  });
  test("totais do mês: aporte conta como saída do caixa, e o patrimônio não cai com ele", () => {
    assert.deepEqual(r.totals, { totalIn: 5000, totalOut: 1000, balance: 4000 });
    assert.equal(r.patrimony, 1000 + 4000 + 600);
  });
  test("categorias com o percentual do que saiu (sem investimento)", () => {
    assert.deepEqual(r.categories, [{ name: "Alimentação", value: 300, pct: 75 }, { name: "Transporte", value: 100, pct: 25 }]);
  });
  test("previstos do mês com situação; o de setembro não entra", () => {
    assert.deepEqual(r.planned.items.map(p => [p.desc, p.status]), [["Netflix", "pago"], ["Aluguel", "pendente"]]);
    assert.equal(r.planned.stats.pending, 1500);
  });
  test("metas com percentual", () => {
    assert.deepEqual(r.wishes, [{ name: "Viagem", saved: 500, price: 2000, done: false, pct: 25 }]);
  });
  test("mês passado é completo", () => {
    assert.equal(buildMonthlyReport({ transactions, plannedExpenses, wishes, month: "set/26", todayISO: "2026-10-04" }).partial, false);
  });
});
