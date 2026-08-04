// ============================================================================
// regressions.test.js
//
// Um teste por bug corrigido na revisão de QA. Cada bloco começa com o
// sintoma que o usuário via, para que uma regressão futura seja reconhecida
// pelo comportamento, não só pelo nome da função.
//
// Como rodar:  node --test src/lib/
// ============================================================================
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FinancialEngine, InsightEngine, monthKey, addMonthsStr, daysInMonth, formatMonths, MONTH_ORDER, flowOf, FLOW, monthProgress } from "./financialEngine.js";
import {
  parseNum, roundMoney, validateAmount, validateDate, validateText, validateInt,
  firstError, MAX_TX_VAL,
} from "./validation.js";

const { CashFlowAnalyzer, GoalAnalyzer } = FinancialEngine;

const today = "2026-07-20";
const tx = (over) => ({ id: 1, date: today, type: "Saída", fixed: "Variavel", cat: "Outros", desc: "x", val: 100, form: "pix", invTipo: null, ...over });

// ---------------------------------------------------------------------------
describe("BUG 1 — parcelamento derrubava o patrimônio pelo valor total", () => {
  // Sintoma: criar 12x de R$ 100 fazia o Patrimônio cair R$ 1.200 no mesmo dia,
  // e o Saldo Livre ficava negativo (a saída futura era contada duas vezes).
  const parcelas = Array.from({ length: 12 }, (_, i) => tx({
    id: 100 + i, date: addMonthsStr(today, i), val: 100, installmentId: 7,
  }));

  test("só as parcelas com data até hoje entram no saldo atual", () => {
    const realized = parcelas.filter(t => t.date <= today);
    assert.equal(realized.length, 1, "só a 1ª parcela venceu");
    const { balance } = CashFlowAnalyzer.totals(realized);
    assert.equal(balance, -100, "impacto imediato = 1 parcela, não o total");
  });

  test("saldo livre desconta as futuras uma única vez", () => {
    const realized = parcelas.filter(t => t.date <= today);
    const { balance } = CashFlowAnalyzer.totals(realized);
    const livre = CashFlowAnalyzer.freeBalance({
      transactions: parcelas, plannedExpenses: [], balance,
      todayISO: today, currentMonthKey: monthKey(today),
    });
    // saldo (-100) menos as 11 parcelas futuras (1100) = -1200. Se houvesse
    // dupla contagem (o bug), daria -2300.
    assert.equal(livre, -1200);
  });

  test("somar TODAS as transações (o bug) daria o valor total de uma vez", () => {
    const { balance } = CashFlowAnalyzer.totals(parcelas);
    assert.equal(balance, -1200, "comportamento antigo, documentado para contraste");
  });
});

// ---------------------------------------------------------------------------
describe("BUG datas — rollover de mês com dia 31", () => {
  // Sintoma: parcelas saíam em jul, ago, out, out, dez, dez, jan.
  test("31/07 + n meses nunca pula um mês", () => {
    const esperado = ["2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31"];
    esperado.forEach((iso, i) => assert.equal(addMonthsStr("2026-07-31", i), iso));
  });

  test("31/01 + 1 mês respeita fevereiro (28 e 29 em bissexto)", () => {
    assert.equal(addMonthsStr("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonthsStr("2028-01-31", 1), "2028-02-29", "2028 é bissexto");
  });

  test("daysInMonth cobre 28/29/30/31", () => {
    assert.equal(daysInMonth(2026, 1), 28);
    assert.equal(daysInMonth(2028, 1), 29);
    assert.equal(daysInMonth(2026, 3), 30);
    assert.equal(daysInMonth(2026, 6), 31);
  });

  test("12 parcelas a partir de 31/01 caem todas no dia certo, virando o ano", () => {
    const datas = Array.from({ length: 13 }, (_, i) => addMonthsStr("2026-01-31", i));
    assert.equal(datas[12], "2027-01-31", "13ª parcela = mesmo dia, ano seguinte");
    assert.equal(new Set(datas.map(monthKey)).size, 13, "um mês distinto por parcela");
  });
});

// ---------------------------------------------------------------------------
describe("BUG 3 — variação percentual com base negativa", () => {
  // Sintoma: melhorar de -154,02 para -102,67 exibia "-33%" (parecia piora).
  const pctChange = (cur, prev) => {
    if (prev === 0) return cur === 0 ? 0 : null;
    return Math.round((cur - prev) / Math.abs(prev) * 100);
  };

  test("prejuízo menor conta como melhora (positivo)", () => {
    assert.ok(pctChange(-102.67, -154.02) > 0);
  });

  test("prejuízo maior conta como piora (negativo)", () => {
    assert.ok(pctChange(-358.18, -102.67) < 0);
  });

  test("continua correto com base positiva", () => {
    assert.equal(pctChange(150, 100), 50);
    assert.equal(pctChange(50, 100), -50);
  });

  test("base zero não inventa 0% — devolve null para a UI mostrar '—'", () => {
    assert.equal(pctChange(100, 0), null);
    assert.equal(pctChange(0, 0), 0);
  });
});

// ---------------------------------------------------------------------------
describe("BUG 4 — vírgula como separador decimal", () => {
  test("aceita vírgula, ponto e valor formatado", () => {
    assert.equal(parseNum("12,34"), 12.34);
    assert.equal(parseNum("12.34"), 12.34);
    assert.equal(parseNum("1.234,56"), 1234.56);
    assert.equal(parseNum("R$ 89,90"), 89.9);
  });

  test("valor vazio ou lixo não vira NaN", () => {
    assert.equal(parseNum(""), 0);
    assert.equal(parseNum(null), 0);
    assert.equal(parseNum("abc"), 0);
  });

  test("valor negativo é normalizado (BUG 11)", () => {
    assert.equal(parseNum("-50"), 50);
  });
});

// ---------------------------------------------------------------------------
describe("BUG 5 — teto de valor", () => {
  test("rejeita valor absurdo com mensagem clara", () => {
    const r = validateAmount("999999999999");
    assert.equal(r.ok, false);
    assert.match(r.error, /alto demais/);
  });

  test("aceita valor no limite e rejeita logo acima", () => {
    assert.equal(validateAmount(String(MAX_TX_VAL)).ok, true);
    assert.equal(validateAmount(String(MAX_TX_VAL + 1)).ok, false);
  });

  test("rejeita zero e valores abaixo de um centavo", () => {
    assert.equal(validateAmount("0").ok, false);
    assert.equal(validateAmount("0,004").ok, false);
  });

  test("aceita exatamente um centavo", () => {
    const r = validateAmount("0,01");
    assert.equal(r.ok, true);
    assert.equal(r.value, 0.01);
  });

  test("campo opcional aceita vazio", () => {
    assert.equal(validateAmount("", { required: false }).ok, true);
  });
});

// ---------------------------------------------------------------------------
describe("BUG 6 — validação de datas", () => {
  test("rejeita ano 0001", () => {
    const r = validateDate("0001-01-01");
    assert.equal(r.ok, false);
  });

  test("rejeita data que não existe no calendário", () => {
    assert.equal(validateDate("2026-02-30").ok, false);
    assert.equal(validateDate("2027-02-29").ok, false, "2027 não é bissexto");
  });

  test("aceita 29/02 em ano bissexto", () => {
    assert.equal(validateDate("2028-02-29").ok, true);
  });

  test("rejeita formato inválido", () => {
    assert.equal(validateDate("abc").ok, false);
    assert.equal(validateDate("").ok, false);
  });

  test("monthKey não produz mais 'jan/' nem 'undefined/N'", () => {
    assert.equal(monthKey("0001-01-01"), "???");
    assert.equal(monthKey("abc"), "???");
    assert.equal(monthKey("2026-07-31"), "jul/26");
  });
});

// ---------------------------------------------------------------------------
describe("Precisão financeira", () => {
  test("rateio de parcelas não perde centavos", () => {
    const total = 1000, num = 3;
    const monthly = roundMoney(total / num);
    const last = roundMoney(total - monthly * (num - 1));
    assert.equal(monthly, 333.33);
    assert.equal(last, 333.34);
    assert.equal(roundMoney(monthly * 2 + last), total);
  });

  test("rateio fecha o total para vários números de parcelas", () => {
    for (const [total, num] of [[100, 3], [0.05, 3], [1234.56, 7], [999.99, 11]]) {
      const monthly = roundMoney(total / num);
      const last = roundMoney(total - monthly * (num - 1));
      const soma = roundMoney(monthly * (num - 1) + last);
      assert.equal(soma, roundMoney(total), `${total} em ${num}x`);
    }
  });

  test("roundMoney corta a deriva do ponto flutuante", () => {
    assert.equal(roundMoney(0.1 + 0.2), 0.3);
  });
});

// ---------------------------------------------------------------------------
describe("BUG 12 — '~1 meses' para qualquer valor", () => {
  test("distingue 'menos de 1 mês' de 'cerca de 1 mês'", () => {
    assert.equal(formatMonths(1, 0.05), "menos de 1 mês");
    assert.equal(formatMonths(1, 1), "cerca de 1 mês");
    assert.equal(formatMonths(3, 2.4), "cerca de 3 meses");
  });

  test("sem estimativa não mente um número", () => {
    assert.equal(formatMonths(null), "sem dados suficientes");
  });

  test("GoalAnalyzer expõe a fração para a UI decidir o texto", () => {
    const [meta] = GoalAnalyzer.enhance([{ name: "m", price: 300, saved: 273.02, monthsTarget: 0 }], 500);
    assert.equal(meta.estMonths, 1);
    assert.ok(meta.estMonthsExact < 1, "R$ 26,98 restantes com R$ 500/mês leva menos de um mês");
  });
});

// ---------------------------------------------------------------------------
describe("Validações de texto e inteiros", () => {
  test("descrição obrigatória e com limite", () => {
    assert.equal(validateText("").ok, false);
    assert.equal(validateText("   ").ok, false, "só espaços não conta");
    assert.equal(validateText("a".repeat(121)).ok, false);
    assert.equal(validateText("Mercado").ok, true);
  });

  test("número de parcelas dentro do intervalo", () => {
    assert.equal(validateInt("0", { min: 1, max: 360 }).ok, false);
    assert.equal(validateInt("361", { min: 1, max: 360 }).ok, false);
    assert.equal(validateInt("12", { min: 1, max: 360 }).value, 12);
  });

  test("firstError devolve a primeira falha, na ordem informada", () => {
    const err = firstError([validateText("ok"), validateAmount(""), validateDate("0001-01-01")]);
    assert.match(err, /Informe o valor/);
  });

  test("firstError devolve null quando tudo passa", () => {
    assert.equal(firstError([validateText("ok"), validateAmount("10,50"), validateDate(today)]), null);
  });
});

// ---------------------------------------------------------------------------
describe("Escopo do saldo — filtros não podem contaminar o patrimônio", () => {
  // Sintoma (não estava no relatório): filtrar por categoria na aba Transações
  // mudava o Saldo Atual e o Patrimônio no Dashboard.
  const transactions = [
    tx({ id: 1, type: "Entrada", cat: "Salario / Entradas", val: 5000 }),
    tx({ id: 2, type: "Saída", cat: "Lazer", val: 200 }),
    tx({ id: 3, type: "Saída", cat: "Alimentação", val: 800 }),
  ];

  test("o saldo global independe de qualquer filtro de visão", () => {
    const global = CashFlowAnalyzer.totals(transactions).balance;
    const filtradoPorLazer = CashFlowAnalyzer.totals(transactions.filter(t => t.cat === "Lazer")).balance;
    assert.equal(global, 4000);
    assert.equal(filtradoPorLazer, -200);
    assert.notEqual(global, filtradoPorLazer, "por isso o Dashboard nunca pode usar a lista filtrada");
  });
});

// ---------------------------------------------------------------------------
describe("BUG semântico — insight tratava RECEITA recorrente como gasto", () => {
  // Sintoma: uma receita recorrente ("Brasileiríssimo") que parou de entrar
  // gerava o card "Gasto com Brasileiríssimo parou". O motor agrupava por
  // descrição recorrente e assumia "gasto", sem nunca perguntar se o dinheiro
  // entrava ou saía. A correção é na origem (flowOf + buildDescMemory), não
  // no texto: qualquer transação, atual ou futura, é classificada antes de
  // qualquer frase ser escrita.
  const cur = MONTH_ORDER[12];
  const at = (idx, day) => {
    const [mon, yy] = MONTH_ORDER[idx].split("/");
    const mi = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"].indexOf(mon);
    return `20${yy}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const baseCtx = (transactions) => ({
    transactions, currentMonthKey: cur,
    plannedStats: { total: 0, paid: 0, pending: 0 }, plannedItemsForMonth: [], plannedMonth: cur,
    plannedExpenses: [], cashFlowProjections: [{ days: 30, value: 5000 }], committedIncome: 20,
    todayISO: at(12, 20), reservaMeses: 3, reservaFinanceira: 5000, avgMonthlyOut: 1000,
    balance: 5000, totalIn: 40000, totalOut: 10000, invNet: 0, enhancedWishes: [],
    avgMonthlySavings: 500, summary: [], investmentParticipacao: 0, patrimonioLiquido: 5000, patrimonio: 5000,
  });
  const allText = (insights) => insights
    .map(i => `${i.title} ${i.explanation} ${i.reason} ${i.recommendation}`).join(" ").toLowerCase();

  test("classificação por direção acontece antes de qualquer texto", () => {
    assert.equal(flowOf({ type: "Entrada", cat: "Salario / Entradas" }), FLOW.RECEITA);
    assert.equal(flowOf({ type: "Saída", cat: "Assinaturas" }), FLOW.DESPESA);
    // Movimentação interna nunca é receita nem despesa.
    assert.equal(flowOf({ type: "Saída", cat: "Investimento", invTipo: "Aporte" }), FLOW.INTERNA);
    assert.equal(flowOf({ type: "Entrada", cat: "Investimento", invTipo: "Resgate" }), FLOW.INTERNA);
  });

  test("receita recorrente interrompida NÃO é descrita como gasto", () => {
    const transactions = [
      ...[5, 6, 7, 8].map((i, n) => tx({ id: 200 + n, date: at(i, 10), type: "Entrada", cat: "Salario / Entradas", desc: "Brasileiríssimo", val: 1200 })),
      ...Array.from({ length: 7 }, (_, k) => tx({ id: 300 + k, date: at(6 + k, 5), type: "Entrada", cat: "Salario / Entradas", desc: "Salario Empresa", val: 5000 })),
    ];
    const card = InsightEngine.generate(baseCtx(transactions)).find(i => i.title.includes("Brasileiríssimo"));
    assert.ok(card, "o insight sobre a receita interrompida deve existir");
    const text = `${card.title} ${card.explanation} ${card.reason} ${card.recommendation}`.toLowerCase();
    for (const proibida of ["gasto", "gastos", "despesa", "economia"]) {
      assert.ok(!text.includes(proibida), `receita não pode usar a palavra "${proibida}": ${text}`);
    }
    assert.match(card.explanation, /não recebeu mais valores/i);
  });

  test("despesa recorrente interrompida continua sendo descrita como gasto", () => {
    const transactions = [
      ...[5, 6, 7, 8].map((i, n) => tx({ id: 400 + n, date: at(i, 15), type: "Saída", cat: "Assinaturas", desc: "Netflix", val: 39.9 })),
      ...Array.from({ length: 7 }, (_, k) => tx({ id: 500 + k, date: at(6 + k, 5), type: "Entrada", cat: "Salario / Entradas", desc: "Salario Empresa", val: 5000 })),
    ];
    const card = InsightEngine.generate(baseCtx(transactions)).find(i => i.title.includes("Netflix"));
    assert.ok(card, "o insight sobre o gasto interrompido deve existir");
    const text = `${card.title} ${card.explanation}`.toLowerCase();
    for (const proibida of ["receita", "recebeu", "rendimento"]) {
      assert.ok(!text.includes(proibida), `despesa não pode usar a palavra "${proibida}": ${text}`);
    }
    assert.match(card.explanation, /não teve mais gastos/i);
  });

  test("mesma descrição com entrada e saída não vira um hábito só", () => {
    // Antes, os dois caíam no mesmo cluster e o texto seguia o ÚLTIMO
    // lançamento — o mesmo nome podia ser descrito como gasto ou receita
    // dependendo da ordem das datas.
    const transactions = [
      ...[5, 6, 7, 8].map((i, n) => tx({ id: 600 + n, date: at(i, 10), type: "Entrada", cat: "Rembolsos", desc: "Mercado X", val: 300 })),
      ...[5, 6, 7, 8].map((i, n) => tx({ id: 700 + n, date: at(i, 12), type: "Saída", cat: "Rembolsos", desc: "Mercado X", val: 800 })),
    ];
    const insights = InsightEngine.generate(baseCtx(transactions));
    const card = insights.find(i => i.title.includes("Mercado X"));
    assert.ok(card, "deve gerar um insight para o hábito interrompido");
    // Seja qual for a direção escolhida, o texto tem que ser internamente
    // coerente: nunca misturar vocabulário de receita e de despesa.
    const text = `${card.title} ${card.explanation}`.toLowerCase();
    const falaDeReceita = /recebeu|receita|entradas/.test(text);
    const falaDeGasto = /gasto|gastos|despesa/.test(text);
    assert.ok(falaDeReceita !== falaDeGasto, `texto misturou as duas direções: ${text}`);
  });

  test("aporte recorrente que para não vira 'gasto parou' nem 'receita parou'", () => {
    const transactions = [
      ...[5, 6, 7, 8].map((i, n) => tx({ id: 800 + n, date: at(i, 20), type: "Saída", cat: "Investimento", invTipo: "Aporte", desc: "Tesouro Direto", val: 500 })),
      ...Array.from({ length: 7 }, (_, k) => tx({ id: 900 + k, date: at(6 + k, 5), type: "Entrada", cat: "Salario / Entradas", desc: "Salario Empresa", val: 5000 })),
    ];
    const insights = InsightEngine.generate(baseCtx(transactions));
    assert.equal(insights.filter(i => i.title.includes("Tesouro Direto")).length, 0,
      "movimentação interna não pode gerar insight de hábito de consumo/renda");
    assert.ok(!allText(insights).includes("gasto com tesouro"));
  });
});

// ---------------------------------------------------------------------------
describe("BUG temporal — economia anunciada com o mês ainda em andamento", () => {
  // Sintoma: dia 4 de agosto, R$ 10 em Lazer contra média mensal de R$ 294,71
  // → "Economia em Lazer: R$ 284,71". Mas agosto não acabou: o dinheiro ainda
  // pode ser gasto. O motor comparava um mês PARCIAL contra meses COMPLETOS e
  // apresentava a projeção como fato consumado.
  const cur = MONTH_ORDER[12];
  const at = (idx, day) => {
    const [mon, yy] = MONTH_ORDER[idx].split("/");
    const mi = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"].indexOf(mon);
    return `20${yy}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const lastDayOfCur = () => {
    const [mon, yy] = cur.split("/");
    const mi = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"].indexOf(mon);
    return new Date(2000 + parseInt(yy, 10), mi + 1, 0).getDate();
  };
  const ctxWith = (transactions, todayISO) => ({
    transactions, currentMonthKey: cur, todayISO,
    plannedStats: { total: 0, paid: 0, pending: 0 }, plannedItemsForMonth: [], plannedMonth: cur,
    plannedExpenses: [], cashFlowProjections: [{ days: 30, value: 5000 }], committedIncome: 20,
    reservaMeses: 3, reservaFinanceira: 5000, avgMonthlyOut: 1000, balance: 5000,
    totalIn: 40000, totalOut: 10000, invNet: 0, enhancedWishes: [], avgMonthlySavings: 500,
    summary: [], investmentParticipacao: 0, patrimonioLiquido: 5000, patrimonio: 5000,
  });
  // Histórico: Lazer gasto no FIM do mês (dia 18 e 24) — exatamente o padrão
  // que produzia o falso positivo no dia 4.
  const historicoTardio = () => {
    const out = [];
    [7, 8, 9, 10, 11].forEach((i, n) => {
      out.push(tx({ id: 1000 + n * 3, date: at(i, 18), type: "Saída", cat: "Lazer", desc: "Show", val: 200 }));
      out.push(tx({ id: 1001 + n * 3, date: at(i, 24), type: "Saída", cat: "Lazer", desc: "Bar", val: 94.71 }));
      out.push(tx({ id: 1002 + n * 3, date: at(i, 5), type: "Entrada", cat: "Salario / Entradas", desc: "Salario", val: 5000 }));
    });
    return out;
  };
  // Histórico: Lazer gasto CEDO (dia 2) — aí a diferença no dia 4 é real.
  const historicoCedo = () => {
    const out = [];
    [7, 8, 9, 10, 11].forEach((i, n) => {
      out.push(tx({ id: 2000 + n * 2, date: at(i, 2), type: "Saída", cat: "Lazer", desc: "Show", val: 300 }));
      out.push(tx({ id: 2001 + n * 2, date: at(i, 5), type: "Entrada", cat: "Salario / Entradas", desc: "Salario", val: 5000 }));
    });
    return out;
  };

  test("não inventa economia comparando mês parcial com meses completos", () => {
    const transactions = [...historicoTardio(), tx({ id: 3000, date: at(12, 3), type: "Saída", cat: "Lazer", desc: "Cafe", val: 10 })];
    const cards = InsightEngine.generate(ctxWith(transactions, at(12, 4)));
    const lazer = cards.find(c => c.title.includes("Lazer"));
    assert.equal(lazer, undefined,
      "no mesmo período (dias 1–4) não há diferença relevante — o card não deve existir");
  });

  test("com o mês em andamento, fala em tendência e nunca em economia consolidada", () => {
    const transactions = [...historicoCedo(), tx({ id: 3100, date: at(12, 3), type: "Saída", cat: "Lazer", desc: "Cafe", val: 10 })];
    const card = InsightEngine.generate(ctxWith(transactions, at(12, 4))).find(c => c.title.includes("Lazer"));
    assert.ok(card, "com diferença real no mesmo período, o card deve aparecer");
    const texto = `${card.title} ${card.explanation} ${card.reason} ${card.recommendation}`.toLowerCase();
    for (const proibida of ["você economizou", "economia de", "deixou de gastar"]) {
      assert.ok(!texto.includes(proibida), `mês em andamento não pode afirmar "${proibida}": ${texto}`);
    }
    assert.match(card.title, /tend[êe]ncia/i, "o título deve comunicar tendência, não conclusão");
    assert.match(card.explanation, /ainda|ritmo|mantendo|at[ée] o momento/i);
  });

  test("a comparação usa o mesmo recorte de dias em todos os meses", () => {
    const transactions = [...historicoCedo(), tx({ id: 3200, date: at(12, 3), type: "Saída", cat: "Lazer", desc: "Cafe", val: 10 })];
    const card = InsightEngine.generate(ctxWith(transactions, at(12, 4))).find(c => c.title.includes("Lazer"));
    // A média exibida tem de ser a do período 1–4 (R$ 300), não a do mês
    // inteiro. Se voltasse a comparar com mês cheio, o número mudaria.
    assert.match(card.explanation, /R\$\s*300,00/, `média deveria ser a do mesmo período: ${card.explanation}`);
    assert.match(card.reason, /dias 1 a 4/i);
  });

  test("depois do fechamento do mês, a economia vira fato e pode ser afirmada", () => {
    const transactions = [...historicoCedo(), tx({ id: 3300, date: at(12, 3), type: "Saída", cat: "Lazer", desc: "Cafe", val: 10 })];
    const card = InsightEngine.generate(ctxWith(transactions, at(12, lastDayOfCur()))).find(c => c.title.includes("Lazer"));
    assert.ok(card);
    assert.match(card.title, /^Economia em/, "mês fechado pode afirmar economia");
    assert.doesNotMatch(card.title, /tend[êe]ncia/i);
  });

  test("monthProgress distingue mês em andamento de mês encerrado", () => {
    const emAndamento = monthProgress(at(12, 4), cur);
    assert.equal(emAndamento.isComplete, false);
    assert.equal(emAndamento.dayOfMonth, 4);
    assert.equal(monthProgress(at(12, lastDayOfCur()), cur).isComplete, true);
    // Um mês anterior ao corrente já fechou.
    assert.equal(monthProgress(at(12, 4), MONTH_ORDER[11]).isComplete, true);
  });
});
