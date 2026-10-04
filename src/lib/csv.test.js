import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { csvCell, buildTxCsv, parseCsvLine, csvRowToTx, csvDateToISO } from "./csv.js";

const COLS = { date: 0, type: 1, invTipo: 2, fixed: 3, cat: 4, desc: 5, val: 6, form: 7 };

describe("exportar CSV", () => {
  test("descrição começando com = não vira fórmula na planilha", () => {
    assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
    assert.equal(csvCell("+55 11 9999"), "\"'+55 11 9999\"");
    assert.equal(csvCell("-200"), "\"'-200\"");
    assert.equal(csvCell("@soma"), "\"'@soma\"");
  });
  test("aspas dentro da descrição saem dobradas", () => {
    assert.equal(csvCell('Livro "Dom Casmurro"'), '"Livro ""Dom Casmurro"""');
  });
  test("categoria com vírgula não quebra a coluna", () => {
    const csv = buildTxCsv([{ date: "2026-10-04", type: "Saída", invTipo: null, fixed: "Variavel", cat: "Casa, móveis", desc: "Mesa", val: 300, form: "pix" }]);
    const line = csv.split("\n")[1];
    assert.equal(parseCsvLine(line).length, 8);
  });
});

describe("importar CSV", () => {
  test("ida e volta: o que o app exporta volta igual, inclusive com aspas e fórmula", () => {
    const tx = [
      { date: "2026-10-04", type: "Saída", invTipo: null, fixed: "Variavel", cat: "Alimentação", desc: '=SOMA(1;2) "teste"', val: 286.4, form: "pix" },
      { date: "2026-10-03", type: "Entrada", invTipo: "Rendimento", fixed: "Fixa", cat: "Investimento", desc: "Rendimento CDB", val: 180, form: "deposito" },
    ];
    const lines = buildTxCsv(tx).replace(/^\uFEFF/, "").split("\n").slice(1);
    const back = lines.map(l => csvRowToTx(parseCsvLine(l), COLS));
    assert.ok(back.every(r => r.ok));
    const byDate = Object.fromEntries(back.map(r => [r.row.date, r.row]));
    assert.equal(byDate["2026-10-04"].desc, '=SOMA(1;2) "teste"');
    assert.equal(byDate["2026-10-04"].val, 286.4);
    assert.equal(byDate["2026-10-03"].invTipo, "Rendimento");
    assert.equal(byDate["2026-10-03"].fixed, "Fixa");
  });
  test("data que não existe é recusada", () => {
    assert.equal(csvRowToTx(["30/02/2026", "Saída", "", "", "Outros", "x", "10", "pix"], COLS).ok, false);
  });
  test("valor absurdo é recusado; valor é arredondado a centavos", () => {
    assert.equal(csvRowToTx(["2026-10-04", "Saída", "", "", "Outros", "x", "999999999999", "pix"], COLS).ok, false);
    assert.equal(csvRowToTx(["2026-10-04", "Saída", "", "", "Outros", "x", "10,005", "pix"], COLS).row.val, 10.01);
  });
  test("valor no formato do banco (1.234,56) é lido certo", () => {
    assert.equal(csvRowToTx(["04/10/2026", "Saída", "", "", "Outros", "x", "1.234,56", "pix"], COLS).row.val, 1234.56);
  });
  test("descrição vazia é recusada e descrição longa é cortada no limite", () => {
    assert.equal(csvRowToTx(["2026-10-04", "Saída", "", "", "Outros", "", "10", "pix"], COLS).ok, false);
    assert.equal(csvRowToTx(["2026-10-04", "Saída", "", "", "Outros", "x".repeat(500), "10", "pix"], COLS).row.desc.length, 120);
  });
  test("data em DD/MM/AA vira ISO", () => {
    assert.equal(csvDateToISO("04/10/26"), "2026-10-04");
  });
});
