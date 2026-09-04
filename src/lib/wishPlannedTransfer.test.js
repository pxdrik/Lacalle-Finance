import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { wishToPlannedPayload, plannedToWishPayload, stripTransferNote } from "./wishPlannedTransfer.js";

describe("wishToPlannedPayload", () => {
  test("mapeia campos básicos da meta para o formato de previsto", () => {
    const wish = { name: "Notebook", price: 5000, saved: 0, priority: "Média", monthsTarget: 0, notes: "" };
    const extra = { cat: "Desejos", form: "pix", recurring: false, month: "2026-10" };
    const p = wishToPlannedPayload(wish, extra);
    assert.equal(p.desc, "Notebook");
    assert.equal(p.val, 5000);
    assert.equal(p.cat, "Desejos");
    assert.equal(p.recurring, false);
    assert.equal(p.month, "2026-10");
    assert.deepEqual(p.paid, {});
  });

  test("recorrente força month para null mesmo se extra.month vier preenchido", () => {
    const wish = { name: "Academia", price: 100, saved: 0, priority: "", monthsTarget: 0, notes: "" };
    const p = wishToPlannedPayload(wish, { cat: "Assinaturas", form: "pix", recurring: true, month: "2026-10" });
    assert.equal(p.month, null);
  });

  test("preserva prioridade/valor guardado/meta original nas notas quando existem", () => {
    const wish = { name: "Viagem", price: 3000, saved: 500, priority: "Alta", monthsTarget: 6, notes: "" };
    const p = wishToPlannedPayload(wish, { cat: "Desejos", form: "pix", recurring: false, month: "2026-11" });
    assert.match(p.notes, /Prioridade original: Alta/);
    assert.match(p.notes, /Já guardado: R\$\s*500,00/);
    assert.match(p.notes, /Meta original: 6 meses/);
    assert.match(p.notes, /— Transferido de Metas —/);
  });

  test("não inventa bloco de transferência quando não há nada relevante a preservar", () => {
    const wish = { name: "Item simples", price: 50, saved: 0, priority: "", monthsTarget: 0, notes: "" };
    const p = wishToPlannedPayload(wish, { cat: "Outros", form: "pix", recurring: false, month: "2026-10" });
    assert.equal(p.notes, "");
  });
});

describe("plannedToWishPayload", () => {
  test("mapeia campos básicos do previsto para o formato de meta", () => {
    const planned = { desc: "Assinatura X", val: 40, cat: "Assinaturas", form: "credito", recurring: true, month: null, notes: "" };
    const w = plannedToWishPayload(planned);
    assert.equal(w.name, "Assinatura X");
    assert.equal(w.price, 40);
    assert.equal(w.saved, 0);
    assert.equal(w.priority, "Média");
    assert.equal(w.done, false);
    assert.match(w.notes, /Era um gasto recorrente \(assinatura\)/);
  });

  test("previsto não recorrente registra o mês original nas notas", () => {
    const planned = { desc: "Conta de luz", val: 200, cat: "Contas", form: "pix", recurring: false, month: "2026-09", notes: "" };
    const w = plannedToWishPayload(planned);
    assert.match(w.notes, /Mês previsto: 2026-09/);
  });
});

describe("stripTransferNote — não acumula histórico em transferências repetidas", () => {
  test("remove o bloco de transferência mais recente, mantendo o resto da nota", () => {
    const notes = "Nota original do usuário\n\n— Transferido de Metas —\nPrioridade original: Alta";
    assert.equal(stripTransferNote(notes), "Nota original do usuário");
  });

  test("ida e volta (Meta -> Previsto -> Meta) não acumula blocos de transferência", () => {
    const wish = { name: "Fone", price: 300, saved: 0, priority: "Baixa", monthsTarget: 0, notes: "" };
    const toPlanned = wishToPlannedPayload(wish, { cat: "Desejos", form: "pix", recurring: false, month: "2026-10" });
    const backToWish = plannedToWishPayload({ ...toPlanned, id: 1 });
    const matches = backToWish.notes.match(/— Transferido de/g) || [];
    assert.equal(matches.length, 1, "só deve haver um bloco de transferência, não um acumulado dos dois sentidos");
  });

  test("string vazia/nula não quebra", () => {
    assert.equal(stripTransferNote(""), "");
    assert.equal(stripTransferNote(null), "");
    assert.equal(stripTransferNote(undefined), "");
  });
});
