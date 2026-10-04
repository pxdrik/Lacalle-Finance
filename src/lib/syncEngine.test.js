import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createSyncEngine } from "./syncEngine.js";
import { stampChanges, mergeDocs, normalizeDoc, emptyDoc } from "./sync.js";

// Armazenamento falso com a mesma trava do banco: gravar só passa se a
// versão esperada for a versão atual (UPDATE ... WHERE updated_at = ...).
function fakeStorage({ lose = 0 } = {}) {
  let row = null, n = 0, losses = lose;
  const s = {
    sets: 0,
    async get() { return row ? { value: row.value, version: row.version } : null; },
    async set(_k, value, expected) {
      s.sets++;
      if ((row ? row.version : null) !== (expected ?? null)) return { conflict: true };
      row = { value, version: `v${++n}` };
      // simula a resposta que se perde depois de o banco ter gravado
      if (losses > 0) { losses--; throw new Error("rede caiu depois de gravar"); }
      return { version: row.version };
    },
    peek: () => (row ? normalizeDoc(JSON.parse(row.value)) : null),
  };
  return s;
}

let clock = 1000;
const now = () => ++clock;
const engine = storage => createSyncEngine({ storage, now, retryDelayMs: 0 });
const tx = (id, desc, val = 10) => ({ id, date: "2026-10-04", type: "Saída", cat: "Outros", desc, val });
const ui = (doc, patch = {}) => ({ ...emptyDoc(), ...doc, ...patch });
const ids = doc => doc.tx.map(t => t.id).sort();

describe("o mais recente vence, item por item", () => {
  test("dois aparelhos lançando ao mesmo tempo: os dois lançamentos ficam", async () => {
    const st = fakeStorage();
    const A = engine(st), B = engine(st);
    const a0 = await A.load(), b0 = await B.load();
    await A.save(ui(a0, { tx: [tx(1, "Mercado")] }));
    const r = await B.save(ui(b0, { tx: [tx(2, "Uber")] }));
    assert.equal(r.status, "saved");
    assert.deepEqual(ids(st.peek()), [1, 2]);
    assert.ok(r.adopt, "B precisa adotar o lançamento que veio de A");
  });

  test("a edição mais recente do mesmo lançamento vence, não a última a chegar", async () => {
    const st = fakeStorage();
    const seed = createSyncEngine({ storage: st, now: () => 1000, retryDelayMs: 0 });
    await seed.save(ui(await seed.load(), { tx: [tx(1, "Mercado", 10)] }));
    // A editou às 6000 e grava primeiro; B editou às 5000 e grava por último
    const A = createSyncEngine({ storage: st, now: () => 6000, retryDelayMs: 0 });
    const B = createSyncEngine({ storage: st, now: () => 5000, retryDelayMs: 0 });
    const a0 = await A.load(), b0 = await B.load();
    await A.save(ui(a0, { tx: [tx(1, "Mercado", 30)] }));
    await B.save(ui(b0, { tx: [tx(1, "Mercado", 20)] }));
    assert.equal(st.peek().tx[0].val, 30);
  });

  test("um lançamento apagado num aparelho não volta pelo outro", async () => {
    const st = fakeStorage();
    const A = engine(st);
    const a0 = await A.load();
    await A.save(ui(a0, { tx: [tx(1, "Mercado"), tx(2, "Uber")] }));
    const B = engine(st);
    const b0 = await B.load();
    const a1 = A.rebase(ui(a0, { tx: [tx(1, "Mercado"), tx(2, "Uber")] }));
    await A.save(ui(a1, { tx: [tx(2, "Uber")] }));            // A apaga o 1
    await B.save(ui(b0, { tx: [tx(1, "Mercado"), tx(2, "Uber", 99)] })); // B, desatualizado, edita o 2
    const final = st.peek();
    assert.deepEqual(ids(final), [2]);
    assert.equal(final.tx[0].val, 99);
  });

  test("editar depois de o outro aparelho apagar mantém o lançamento", async () => {
    const st = fakeStorage();
    const A = createSyncEngine({ storage: st, now: () => 100, retryDelayMs: 0 });
    const a0 = await A.load();
    await A.save(ui(a0, { tx: [tx(1, "Mercado")] }));
    const B = createSyncEngine({ storage: st, now: () => 300, retryDelayMs: 0 });
    const b0 = await B.load();
    const A2 = createSyncEngine({ storage: st, now: () => 200, retryDelayMs: 0 });
    const a2 = await A2.load();
    await A2.save(ui(a2, { tx: [] }));                     // apagou às 200
    await B.save(ui(b0, { tx: [tx(1, "Mercado", 50)] }));  // editou às 300
    assert.deepEqual(ids(st.peek()), [1]);
  });
});

describe("ciclo de salvamento", () => {
  test("desfazer é gravado na nuvem", async () => {
    const st = fakeStorage();
    const A = engine(st);
    const a0 = await A.load();
    await A.save(ui(a0, { tx: [tx(1, "Mercado")] }));
    await A.save(ui(a0, { tx: [tx(1, "Mercado"), tx(2, "Errado")] }));
    await A.save(ui(a0, { tx: [tx(1, "Mercado")] })); // desfez
    assert.deepEqual(ids(st.peek()), [1]);
  });

  test("nada mudou, nada é gravado", async () => {
    const st = fakeStorage();
    const A = engine(st);
    const a0 = await A.load();
    await A.save(ui(a0, { tx: [tx(1, "Mercado")] }));
    const before = st.sets;
    const r = await A.save(ui(a0, { tx: [tx(1, "Mercado")] }));
    assert.equal(r.status, "unchanged");
    assert.equal(st.sets, before);
  });

  test("dois pedidos seguidos não geram falso conflito: vão em fila e o último vence", async () => {
    const st = fakeStorage();
    const A = engine(st);
    const a0 = await A.load();
    const p1 = A.save(ui(a0, { tx: [tx(1, "Mercado")] }));
    const p2 = A.save(ui(a0, { tx: [tx(1, "Mercado"), tx(2, "Uber")] }));
    const p3 = A.save(ui(a0, { tx: [tx(1, "Mercado"), tx(2, "Uber"), tx(3, "Pão")] }));
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    assert.equal(r1, r2); assert.equal(r2, r3); // a mesma fila
    assert.equal(r3.status, "saved");
    assert.equal(r3.adopt, null, "nada veio de fora; a tela não precisa adotar");
    assert.deepEqual(ids(st.peek()), [1, 2, 3]);
  });

  test("resposta perdida depois de gravar: a nova tentativa termina sem duplicar", async () => {
    const st = fakeStorage({ lose: 1 });
    const A = engine(st);
    const a0 = await A.load();
    const r = await A.save(ui(a0, { tx: [tx(1, "Mercado")] }));
    assert.equal(r.status, "saved");
    assert.deepEqual(ids(st.peek()), [1]);
  });

  test("falha ao carregar é um erro, não uma conta vazia", async () => {
    const A = createSyncEngine({ storage: { async get() { throw new Error("offline"); } }, now });
    await assert.rejects(() => A.load());
  });

  test("adotar dados de outro aparelho não perde a edição local ainda não salva", async () => {
    const st = fakeStorage();
    const A = engine(st), B = engine(st);
    const a0 = await A.load(), b0 = await B.load();
    await B.save(ui(b0, { tx: [tx(2, "Do outro aparelho")] }));
    assert.equal(await A.refresh(), true);
    const view = A.rebase(ui(a0, { tx: [tx(1, "Digitado agora")] }));
    assert.deepEqual(ids(view), [1, 2]);
    await A.save(view);
    assert.deepEqual(ids(st.peek()), [1, 2]);
  });

  test("dados que a tela ainda não adotou nunca viram exclusão", async () => {
    const st = fakeStorage();
    const A = engine(st), B = engine(st);
    const a0 = await A.load(), b0 = await B.load();
    await B.save(ui(b0, { tx: [tx(2, "Do outro aparelho")] }));
    await A.save(ui(a0, { tx: [tx(1, "Meu")] }));                 // junta e pede para adotar
    await A.save(ui(a0, { tx: [tx(1, "Meu"), tx(3, "Mais um")] })); // tela ainda sem o 2
    await A.save(ui(a0, { tx: [tx(1, "Meu"), tx(3, "Mais um")] }));
    assert.deepEqual(ids(st.peek()), [1, 2, 3]);
  });
});

describe("junção", () => {
  test("restaurar ou desfazer não deixa o item também na lixeira", () => {
    const a = normalizeDoc({ tx: [tx(1, "Mercado")], trash: [{ trashId: "t1", type: "tx", deletedAt: 1, item: tx(1, "Mercado") }] });
    assert.equal(mergeDocs(a, emptyDoc()).trash.length, 0);
  });

  test("documento antigo, sem carimbos, junta sem perder nada", () => {
    const legacy = normalizeDoc({ tx: [tx(1, "Antigo")], name: "Pedro" });
    const mine = stampChanges(legacy, { ...legacy, tx: [tx(1, "Antigo"), tx(2, "Novo")] }, 50);
    const merged = mergeDocs(mine, legacy);
    assert.deepEqual(ids(merged), [1, 2]);
    assert.equal(merged.name, "Pedro");
  });

  test("nome e cor: vale a alteração mais recente", () => {
    const base = normalizeDoc({ accentKey: "gold", name: "Pedro" });
    const a = stampChanges(base, { ...base, accentKey: "blue" }, 10);
    const b = stampChanges(base, { ...base, accentKey: "green", name: "Pedro F." }, 20);
    const m = mergeDocs(a, b);
    assert.equal(m.accentKey, "green");
    assert.equal(m.name, "Pedro F.");
  });

  test("dado malformado da nuvem é descartado, não derruba", () => {
    const d = normalizeDoc({ tx: [null, "x", { desc: "sem id" }, tx(1, "Ok")], wishes: "não é lista" });
    assert.deepEqual(ids(d), [1]);
    assert.deepEqual(d.wishes, []);
  });
});
