import { test } from "node:test";
import assert from "node:assert/strict";
import { createTransaction, deleteTransaction, listTransactions, summary, options, ApiError } from "./financeApi.js";
import { normalizeDoc, stampChanges, mergeDocs } from "./sync.js";
import { buildBackup, validateBackup } from "./backupValidation.js";

const T0 = 1_760_000_000_000;
const appDoc = () => ({
  tx: [
    { id: 1, date: "2026-10-01", type: "Entrada", cat: "Salario / Entradas", desc: "Salário", val: 3000, updatedAt: T0 },
    { id: 2, date: "2026-10-05", type: "Saída", cat: "Alimentação", desc: "Mercado", val: 250.5, account: "mp", updatedAt: T0 },
    { id: 3, date: "2026-10-30", type: "Saída", cat: "Assinaturas", desc: "Streaming", val: 40, updatedAt: T0 },
    { id: 4, date: "2026-10-06", type: "Saída", cat: "Investimento", invTipo: "Aporte", desc: "CDB", val: 500, updatedAt: T0 },
    { id: 5, date: "2026-10-07", type: "Saída", cat: "Outros", desc: "Parcela 1/3", val: 100, installmentId: 9, updatedAt: T0 },
  ],
  accounts: [{ id: "principal", name: "Conta principal" }, { id: "mp", name: "Mercado Pago" }],
  customCats: ["Pets"],
  quarantine: [{ coll: "tx", record: { id: 99, date: "ontem" } }],
  algoQueAApiNaoConhece: true,
});

test("lançamento criado pela API sobrevive ao próximo salvamento do app", () => {
  const cloudBefore = normalizeDoc(appDoc());
  const { doc, tx } = createTransaction(appDoc(), { type: "saida", val: "45,90", desc: "Almoço", cat: "alimentacao", account: "mercado pago" }, T0 + 10, "2026-10-23");
  assert.deepEqual([tx.type, tx.val, tx.cat, tx.account, tx.date, tx.form], ["Saída", 45.9, "Alimentação", "mp", "2026-10-23", "pix"]);
  assert.equal(tx.fixed, "Variavel");
  // O lançamento da API não pode quebrar o backup do app.
  assert.ok(validateBackup(buildBackup(normalizeDoc(doc))).ok);
  assert.equal(createTransaction(appDoc(), { type: "Saída", val: 1, desc: "Aluguel", cat: "Outros", fixed: "fixo" }).tx.fixed, "Fixa");
  assert.equal(doc.algoQueAApiNaoConhece, true);
  assert.equal(doc.quarantine.length, 1);
  // O app, que não viu o lançamento novo, edita outra coisa e salva: a junção mantém os dois.
  const cur = { ...cloudBefore, tx: cloudBefore.tx.map(t => (t.id === 1 ? { ...t, val: 3100 } : t)) };
  const merged = mergeDocs(stampChanges(cloudBefore, cur, T0 + 20), normalizeDoc(doc));
  assert.ok(merged.tx.some(t => t.id === tx.id));
  assert.equal(merged.tx.find(t => t.id === 1).val, 3100);
});

test("apagar pela API vence o app que ainda tem o item e põe na lixeira", () => {
  const cloudBefore = normalizeDoc(appDoc());
  const { doc } = deleteTransaction(appDoc(), "2", T0 + 10);
  assert.equal(doc.trash[0].item.id, 2);
  const merged = mergeDocs(stampChanges(cloudBefore, cloudBefore, T0 + 20), normalizeDoc(doc));
  assert.ok(!merged.tx.some(t => t.id === 2));
  assert.ok(merged.trash.some(t => t.item.id === 2));
});

test("parcela e id inexistente não são apagados", () => {
  assert.throws(() => deleteTransaction(appDoc(), 5), e => e instanceof ApiError && e.status === 409);
  assert.throws(() => deleteTransaction(appDoc(), 777), e => e.status === 404);
});

test("valida o que o agente manda", () => {
  const bad = body => assert.throws(() => createTransaction(appDoc(), { type: "Saída", val: 10, desc: "x", cat: "Outros", ...body }), ApiError);
  bad({ cat: "Inventada" });
  bad({ type: "Talvez" });
  bad({ val: 0 });
  bad({ val: "abc" });
  bad({ val: 20_000_000 });
  bad({ desc: "" });
  bad({ date: "2026-02-30" });
  bad({ account: "Banco X" });
  bad({ form: "boleto" });
  bad({ fixed: "sim" });
  bad({ cat: "Investimento" }); // sem invTipo
  // número em JSON não passa pela leitura de texto: 1.234 é R$ 1,23, não mil
  assert.equal(createTransaction(appDoc(), { type: "Saída", val: 1.234, desc: "x", cat: "Pets" }).tx.val, 1.23);
  const inv = createTransaction(appDoc(), { val: 100, desc: "Resgate", cat: "Investimento", invTipo: "resgate" }).tx;
  assert.equal(inv.type, "Entrada");
  assert.equal(createTransaction(null, { type: "Entrada", val: 1, desc: "x", cat: "Outros" }).doc.tx.length, 1);
});

test("leitura: lista, resumo e opções", () => {
  assert.deepEqual(listTransactions(appDoc(), { account: "Mercado Pago" }).map(t => t.id), [2]);
  assert.deepEqual(listTransactions(appDoc(), { month: "2026-10", limit: 2 }).map(t => t.id), [3, 5]);
  assert.ok(!("updatedAt" in listTransactions(appDoc())[0]));
  const s = summary(appDoc(), { month: "2026-10" }, "2026-10-23");
  // conta principal: o Mercado Pago (id 2) fica de fora
  assert.equal(s.account.id, "principal");
  assert.deepEqual([s.income, s.expense, s.balance, s.invested, s.upcoming.expense], [3000, 100, 2900, 500, 40]);
  assert.deepEqual(s.expenseByCategory, { Outros: 100 });
  const mp = summary(appDoc(), { month: "2026-10", account: "mercado pago" }, "2026-10-23");
  assert.deepEqual([mp.account.id, mp.expense, mp.currentBalance], ["mp", 250.5, -250.5]);
  assert.ok(options(appDoc()).categories.includes("Pets"));
  assert.throws(() => summary(appDoc(), { month: "10/2026" }), ApiError);
});

test("acento funciona mesmo onde normalize não separa o acento", () => {
  const original = String.prototype.normalize;
  String.prototype.normalize = function () { return String(this); };
  try {
    const ok = body => createTransaction(appDoc(), { val: 1, desc: "x", cat: "Outros", type: "Saída", ...body }).tx;
    assert.equal(ok({}).type, "Saída");
    assert.equal(ok({ type: "SAÍDA" }).type, "Saída");
    assert.equal(ok({ cat: "alimentacao" }).cat, "Alimentação");
    assert.equal(ok({ cat: "SAUDE / CUIDADOS PESSOAIS" }).cat, "Saude / Cuidados Pessoais");
    assert.equal(ok({ type: "Sáida" }).type, "Saída"); // acento já separado
  } finally {
    String.prototype.normalize = original;
  }
});

test("saldo atual igual ao do app: por conta, sem rendimento e sem data futura", () => {
  const doc = appDoc();
  doc.tx.push(
    { id: 10, date: "2026-10-08", type: "Entrada", cat: "Investimento", invTipo: "Rendimento", desc: "Rendeu", val: 900, updatedAt: T0 },
    { id: 11, date: "2026-10-09", type: "Entrada", cat: "Investimento", invTipo: "Resgate", desc: "Resgate", val: 200, updatedAt: T0 },
  );
  const s = summary(doc, { month: "2026-10" }, "2026-10-23");
  // 3000 de entrada - 100 de saída - 500 de aporte + 200 de resgate; o rendimento e o streaming do dia 30 não entram
  assert.equal(s.currentBalance, 2600);
  assert.equal(s.invested, 300);
  assert.deepEqual(s.accounts.map(a => [a.id, a.currentBalance]), [["principal", 2600], ["mp", -250.5]]);
  assert.throws(() => summary(doc, { account: "Banco X" }), ApiError);
});
