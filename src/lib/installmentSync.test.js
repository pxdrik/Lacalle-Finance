import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { removeTxFromInstallments, restoreTxToInstallments } from "./installmentSync.js";

// Parcelamento de referência: R$ 1.200 em 12x de R$ 100 (sem resto de
// centavos, pra manter as contas simples de conferir à mão).
function make12x() {
  const txIds = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
  return { id: "inst1", desc: "Notebook", totalVal: 1200, numParcelas: 12, cat: "Eletrônicos", form: "credito", startDate: "2026-01-01", txIds };
}
function txFor(instId, id, val = 100) {
  return { id, installmentId: instId, val, date: "2026-01-01", type: "Saída", cat: "Eletrônicos", desc: "Notebook (x/12)" };
}

describe("BUG-05 — deleting installment transaction keeps parent consistent", () => {
  test("excluir a primeira parcela: numParcelas e totalVal caem por exatamente 1 parcela", () => {
    const installments = [make12x()];
    const result = removeTxFromInstallments(installments, txFor("inst1", "p1"));
    const inst = result.find(i => i.id === "inst1");
    assert.equal(inst.numParcelas, 11);
    assert.equal(inst.totalVal, 1100);
    assert.equal(inst.txIds.includes("p1"), false);
    assert.equal(inst.txIds.length, 11);
  });

  test("excluir uma parcela do meio: só ela some, as outras 11 continuam intactas", () => {
    const installments = [make12x()];
    const result = removeTxFromInstallments(installments, txFor("inst1", "p6"));
    const inst = result.find(i => i.id === "inst1");
    assert.equal(inst.txIds.includes("p6"), false);
    assert.deepEqual(inst.txIds, ["p1", "p2", "p3", "p4", "p5", "p7", "p8", "p9", "p10", "p11", "p12"]);
    assert.equal(inst.numParcelas, 11);
  });

  test("excluir a última parcela: comportamento idêntico às demais", () => {
    const installments = [make12x()];
    const result = removeTxFromInstallments(installments, txFor("inst1", "p12"));
    const inst = result.find(i => i.id === "inst1");
    assert.equal(inst.numParcelas, 11);
    assert.equal(inst.txIds.includes("p12"), false);
  });

  test("excluir todas as parcelas uma por uma remove o parcelamento inteiro no final (0 parcelas = sem parcelamento)", () => {
    let installments = [make12x()];
    for (let i = 1; i <= 12; i++) {
      installments = removeTxFromInstallments(installments, txFor("inst1", `p${i}`));
    }
    assert.equal(installments.length, 0);
  });

  test("progresso (paidTxs/numParcelas) consegue chegar a 100% depois da exclusão — antes ficava travado abaixo disso", () => {
    // Cenário do BUG-05 original: 12x, exclui a parcela 6 (ainda não paga).
    // As 11 parcelas restantes são pagas ao longo do tempo — o progresso
    // precisa conseguir chegar a 100%, não travar em 11/12 (91.67%).
    let installments = [make12x()];
    installments = removeTxFromInstallments(installments, txFor("inst1", "p6"));
    const inst = installments[0];
    const allRemainingPaid = inst.txIds.length; // as 11 que sobraram, todas pagas
    const pct = Math.round((allRemainingPaid / inst.numParcelas) * 100);
    assert.equal(pct, 100, "com numParcelas sincronizado, pagar todas as parcelas restantes fecha em 100%");
  });

  test("transação sem installmentId não mexe em nada", () => {
    const installments = [make12x()];
    const result = removeTxFromInstallments(installments, { id: "avulsa", val: 50 });
    assert.deepEqual(result, installments);
  });

  test("excluir parcela de um parcelamento que não existe mais (id órfão) não quebra nem inventa um parcelamento", () => {
    const result = removeTxFromInstallments([], txFor("inst-inexistente", "p1"));
    assert.deepEqual(result, []);
  });

  test("restaurar da lixeira: devolve exatamente a vaga que a exclusão tinha tirado (mesmo numParcelas/totalVal/conjunto de parcelas — a ordem de txIds não importa pra nenhum cálculo)", () => {
    const installments = [make12x()];
    const removed = removeTxFromInstallments(installments, txFor("inst1", "p6"));
    const restored = restoreTxToInstallments(removed, txFor("inst1", "p6"))[0];
    const original = installments[0];
    assert.equal(restored.numParcelas, original.numParcelas);
    assert.equal(restored.totalVal, original.totalVal);
    assert.deepEqual([...restored.txIds].sort(), [...original.txIds].sort());
  });

  test("restaurar uma parcela cujo parcelamento pai já foi excluído por inteiro não recria o pai do nada", () => {
    const result = restoreTxToInstallments([], txFor("inst1", "p1"));
    assert.deepEqual(result, [], "sem o pai, a restauração não inventa um novo registro de parcelamento");
  });

  test("restaurar duas vezes a mesma parcela não soma a vaga em dobro (idempotente)", () => {
    const installments = [make12x()];
    const removed = removeTxFromInstallments(installments, txFor("inst1", "p6"));
    const restoredOnce = restoreTxToInstallments(removed, txFor("inst1", "p6"));
    const restoredTwice = restoreTxToInstallments(restoredOnce, txFor("inst1", "p6"));
    assert.deepEqual(restoredTwice, restoredOnce);
  });

  test("excluir + editar depois: o histórico de txIds/numParcelas reflete só a exclusão real, edição de outra parcela não interfere", () => {
    let installments = [make12x()];
    installments = removeTxFromInstallments(installments, txFor("inst1", "p3"));
    // "editar" uma parcela remanescente não deve envolver installmentSync —
    // é só uma edição de valor/data da transação em si (fora deste módulo).
    // Confirma que o parcelamento continua com as 11 parcelas certas.
    const inst = installments[0];
    assert.equal(inst.numParcelas, 11);
    assert.ok(!inst.txIds.includes("p3"));
    assert.ok(inst.txIds.includes("p7"));
  });
});
