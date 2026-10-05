import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateBackup, buildBackup } from "./backupValidation.js";

const validTx = { id: "t1", date: "2026-01-15", type: "Saída", fixed: "Variavel", cat: "Alimentação", desc: "Mercado", val: 150.5, form: "pix", invTipo: null };
const validInst = { id: "i1", desc: "Notebook", totalVal: 3000, numParcelas: 12, cat: "Eletrônicos", form: "credito", startDate: "2026-01-01", txIds: ["i11", "i12"] };
const validPlanned = { id: "p1", desc: "Aluguel", val: 1800, cat: "Moradia", form: "pix", recurring: true, month: null, notes: "" };
const validWish = { id: "w1", name: "Viagem", price: 5000, saved: 1200, priority: "Média", monthsTarget: 6, notes: "" };

describe("BUG-03 — invalid backup records must be rejected", () => {
  test("backup válido (todas as seções) passa", () => {
    const r = validateBackup({ tx: [validTx], inst: [validInst], planned: [validPlanned], wishes: [validWish] });
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
  });

  test("backup válido com só uma seção presente ainda passa", () => {
    const r = validateBackup({ tx: [validTx] });
    assert.equal(r.ok, true);
  });

  test("transaction com amount inválido (string) é rejeitada", () => {
    const r = validateBackup({ tx: [{ ...validTx, val: "150,50" }] });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "tx[0].val"));
  });

  test("transaction com valor absurdamente grande é rejeitada", () => {
    const r = validateBackup({ tx: [{ ...validTx, val: 999_999_999_999 }] });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "tx[0].val"));
  });

  test("transaction com valor negativo é rejeitada", () => {
    const r = validateBackup({ tx: [{ ...validTx, val: -50 }] });
    assert.equal(r.ok, false);
  });

  test("transaction com date inválida (29/02 em ano não bissexto) é rejeitada", () => {
    const r = validateBackup({ tx: [{ ...validTx, date: "2027-02-29" }] });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "tx[0].date"));
  });

  test("transaction com categoria ausente é rejeitada", () => {
    const r = validateBackup({ tx: [{ ...validTx, cat: "" }] });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "tx[0].cat"));
  });

  test('transaction com type incorreto (minúsculo) é rejeitada — evita virar "despesa" silenciosa', () => {
    const r = validateBackup({ tx: [{ ...validTx, type: "saida" }] });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "tx[0].type"));
  });

  test("estrutura ausente (objeto sem tx/planned/inst/wishes) é rejeitada", () => {
    const r = validateBackup({ accentKey: "blue" });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "$"));
  });

  test("tx como objeto em vez de array (tipo incorreto) é rejeitada", () => {
    const r = validateBackup({ tx: { 0: validTx } });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "$.tx"));
  });

  test("arquivo vazio ({}) é rejeitado", () => {
    const r = validateBackup({});
    assert.equal(r.ok, false);
  });

  test("JSON que não é objeto (array/string/null) é rejeitado", () => {
    assert.equal(validateBackup([]).ok, false);
    assert.equal(validateBackup("backup").ok, false);
    assert.equal(validateBackup(null).ok, false);
  });

  test("campos inesperados/desconhecidos são tolerados (forward-compatible)", () => {
    const r = validateBackup({ tx: [{ ...validTx, futureField: "algo que ainda não existe" }], somethingNew: 42 });
    assert.equal(r.ok, true);
  });

  test("string maliciosa na descrição não quebra a validação (React escapa; só limite de tamanho conta)", () => {
    const r = validateBackup({ tx: [{ ...validTx, desc: "<img src=x onerror=alert(1)>" }] });
    assert.equal(r.ok, true, "conteúdo de texto é seguro por design (sem dangerouslySetInnerHTML no app); só o tamanho é limitado");
  });

  test("descrição acima do limite de tamanho é rejeitada", () => {
    const r = validateBackup({ tx: [{ ...validTx, desc: "x".repeat(200) }] });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "tx[0].desc"));
  });

  test("installment com numParcelas fora do intervalo é rejeitado", () => {
    const r = validateBackup({ inst: [{ ...validInst, numParcelas: 0 }] });
    assert.equal(r.ok, false);
    const r2 = validateBackup({ inst: [{ ...validInst, numParcelas: 1000 }] });
    assert.equal(r2.ok, false);
  });

  test("planned não-recorrente sem mês é rejeitado", () => {
    const r = validateBackup({ planned: [{ ...validPlanned, recurring: false, month: null }] });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "planned[0].month"));
  });

  test("wish com price ausente é rejeitado", () => {
    const r = validateBackup({ wishes: [{ ...validWish, price: undefined }] });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.path === "wishes[0].price"));
  });

  test("backup parcialmente válido + 1 registro inválido: nenhuma alteração deve ser aplicada (ok=false, todos os erros reportados)", () => {
    const r = validateBackup({
      tx: [validTx, { ...validTx, id: "t2", val: "não é número" }],
      wishes: [validWish],
    });
    assert.equal(r.ok, false, "um único registro inválido invalida o backup inteiro");
    assert.ok(r.errors.some(e => e.path === "tx[1].val"));
  });
});

// Ida e volta: o backup que o próprio app exporta precisa voltar. Os testes
// acima usavam só previstos recorrentes (`month: null`) e nenhum rendimento,
// e por isso nunca viram que um backup real era recusado. Os registros abaixo
// copiam o formato que o app grava de verdade (monthKey "out/26", paid/ignored
// por mês, invTipo "Rendimento", lixeira).
describe("backup exportado pelo app volta na importação", () => {
  const appState = {
    tx: [
      { id: 1759600000001, date: "2026-10-04", type: "Saída", fixed: "Variavel", cat: "Alimentação", desc: "Mercado", val: 286.4, form: "pix", invTipo: null },
      { id: 1759600000002, date: "2026-10-03", type: "Entrada", fixed: "Variavel", cat: "Investimento", desc: "Rendimento CDB", val: 180, form: "deposito", invTipo: "Rendimento" },
      { id: 1759600000003, date: "2026-10-01", type: "Saída", fixed: "Fixa", cat: "Assinaturas", desc: "Netflix", val: 55.9, form: "credito", invTipo: null, plannedId: 1759500000001 },
    ],
    planned: [
      { id: 1759500000001, desc: "Netflix", val: 55.9, cat: "Assinaturas", form: "credito", recurring: true, month: null, notes: "", paid: { "out/26": 1759600000003 }, ignored: {} },
      { id: 1759500000002, desc: "IPVA", val: 412.3, cat: "Outros", form: "pix", recurring: false, month: "out/26", notes: "", paid: {}, ignored: {} },
    ],
    inst: [{ id: 1759400000001, desc: "Notebook", totalVal: 3899, numParcelas: 10, cat: "Tecnologia", form: "credito", startDate: "2026-08-10", txIds: [1759400000002] }],
    wishes: [{ id: 1759300000001, name: "Viagem Chile", price: 5000, saved: 3100, priority: "Alta", monthsTarget: 8, notes: "", done: false }],
    customCats: ["Pet"],
    name: "Pedro", accentKey: "gold", walletName: "Carteira do Pedro", onboardingDismissed: true,
    trash: [{ trashId: "x1", type: "wish", deletedAt: 1759000000000, item: { id: 9, name: "Fone", price: 180, saved: 180 } }],
  };

  test("exportar → JSON → importar passa na validação", () => {
    const file = JSON.stringify(buildBackup(appState));
    const r = validateBackup(JSON.parse(file));
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
  });

  test("previsto de mês único gravado como monthKey é aceito", () => {
    const r = validateBackup({ planned: [{ ...validPlanned, recurring: false, month: "out/26" }] });
    assert.equal(r.ok, true);
  });

  test("formato antigo AAAA-MM continua aceito", () => {
    const r = validateBackup({ planned: [{ ...validPlanned, recurring: false, month: "2026-10" }] });
    assert.equal(r.ok, true);
  });

  test("mês inexistente é recusado", () => {
    assert.equal(validateBackup({ planned: [{ ...validPlanned, recurring: false, month: "abc/26" }] }).ok, false);
    assert.equal(validateBackup({ planned: [{ ...validPlanned, recurring: false, month: "2026-13" }] }).ok, false);
  });

  test("lançamento de Rendimento é aceito", () => {
    const r = validateBackup({ tx: [{ ...validTx, type: "Entrada", invTipo: "Rendimento" }] });
    assert.equal(r.ok, true);
  });

  test("o backup leva onboardingDismissed", () => {
    assert.equal(buildBackup(appState).onboardingDismissed, true);
  });
});

describe("previsto com começo e fim no backup", () => {
  test("from e until em monthKey passam; formato inválido é recusado", () => {
    assert.equal(validateBackup({ planned: [{ ...validPlanned, from: "out/26", until: "mar/27" }] }).ok, true);
    assert.equal(validateBackup({ planned: [{ ...validPlanned, until: "março" }] }).ok, false);
  });
});
