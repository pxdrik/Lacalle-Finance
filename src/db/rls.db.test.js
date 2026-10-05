// As regras de acesso de verdade, num Postgres de verdade (src/db/testDb.js),
// com as migrações de supabase/migrations. Até aqui o isolamento entre contas
// era conferido só lendo o SQL.
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "./testDb.js";

let t, ana, bia;
before(async () => {
  t = await createTestDb();
  ana = await t.createUser("ana@exemplo.com");
  bia = await t.createUser("bia@exemplo.com");
  await t.as(ana, tx => tx.query("insert into public.user_data (user_id, data) values ($1, $2)", [ana, { tx: [{ id: 1, desc: "Salário da Ana", val: 9000 }] }]));
});

const rowsOf = r => r.rows;

describe("cada conta só enxerga e mexe na própria linha", () => {
  test("a dona lê a própria linha", async () => {
    const r = await t.as(ana, tx => tx.query("select data from public.user_data"));
    assert.equal(rowsOf(r).length, 1);
    assert.equal(rowsOf(r)[0].data.tx[0].desc, "Salário da Ana");
  });

  test("outra conta não lê nada da Ana, nem pedindo pelo id", async () => {
    const r = await t.as(bia, tx => tx.query("select * from public.user_data where user_id = $1", [ana]));
    assert.equal(rowsOf(r).length, 0);
  });

  test("sem login não lê nada", async () => {
    const r = await t.as(null, tx => tx.query("select * from public.user_data"));
    assert.equal(rowsOf(r).length, 0);
  });

  test("outra conta não altera nem apaga a linha da Ana", async () => {
    const up = await t.as(bia, tx => tx.query("update public.user_data set data = '{}'::jsonb where user_id = $1", [ana]));
    const del = await t.as(bia, tx => tx.query("delete from public.user_data where user_id = $1", [ana]));
    assert.equal(up.affectedRows, 0);
    assert.equal(del.affectedRows, 0);
    const still = await t.as(ana, tx => tx.query("select data from public.user_data"));
    assert.equal(rowsOf(still)[0].data.tx.length, 1);
  });

  test("ninguém cria linha em nome de outra conta", async () => {
    await assert.rejects(t.as(bia, tx => tx.query("insert into public.user_data (user_id, data) values ($1, '{}')", [ana])), /row-level security/);
    await assert.rejects(t.as(null, tx => tx.query("insert into public.user_data (user_id, data) values ($1, '{}')", [bia])), /row-level security/);
  });

  test("não dá para esvaziar a tabela", async () => {
    await assert.rejects(t.as(bia, tx => tx.query("truncate public.user_data")), /permission denied/);
  });
});

describe("a trava de versão do salvamento (storage.set)", () => {
  test("o banco carimba updated_at a cada gravação; gravar com a versão velha não afeta nada", async () => {
    const v1 = rowsOf(await t.as(ana, tx => tx.query("select updated_at from public.user_data")))[0].updated_at;
    await new Promise(r => setTimeout(r, 5));
    const ok = await t.as(ana, tx => tx.query("update public.user_data set data = $1 where user_id = $2 and updated_at = $3 returning updated_at", [{ tx: [] }, ana, v1]));
    assert.equal(ok.affectedRows, 1);
    assert.notEqual(rowsOf(ok)[0].updated_at.getTime(), v1.getTime());
    // outro aparelho ainda com a versão v1: zero linhas, que o app trata como conflito
    const stale = await t.as(ana, tx => tx.query("update public.user_data set data = $1 where user_id = $2 and updated_at = $3", [{ tx: [{ id: 9 }] }, ana, v1]));
    assert.equal(stale.affectedRows, 0);
  });

  test("o JSON precisa ser um objeto", async () => {
    await assert.rejects(t.as(ana, tx => tx.query("update public.user_data set data = '[]'::jsonb where user_id = $1", [ana])), /user_data_is_object/);
  });
});

describe("avisos de segurança corrigidos", () => {
  test("a função do gatilho tem search_path fixo", async () => {
    const r = await t.db.query("select proconfig from pg_proc where proname = 'set_updated_at'");
    assert.deepEqual(rowsOf(r)[0].proconfig, ['search_path=""']);
  });
});
