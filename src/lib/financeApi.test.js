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
  assert.deepEqual([s.income, s.expense, s.balance, s.invested, s.upcoming.expense], [3000, 350.5, 2649.5, 500, 40]);
  assert.deepEqual(s.expenseByCategory, { "Alimentação": 250.5, Outros: 100 });
  assert.ok(options(appDoc()).categories.includes("Pets"));
  assert.throws(() => summary(appDoc(), { month: "10/2026" }), ApiError);
});
