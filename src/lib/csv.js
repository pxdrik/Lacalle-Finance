// csv.js — exportar e importar lançamentos em CSV.
//
// Antes, a importação gravava o que viesse na planilha: valor sem teto e sem
// arredondar, data sem conferir se existe, descrição de qualquer tamanho.
// Esse dado depois fazia o backup inteiro ser recusado na validação. E a
// exportação punha a descrição entre aspas sem escapar aspas internas, e não
// protegia contra fórmula: uma descrição começando com "=" vira fórmula ao
// abrir o arquivo no Excel ou no Google Planilhas.
//
// Agora cada linha passa pelas mesmas regras do formulário (validation.js), e
// toda célula de texto exportada sai entre aspas, com aspas dobradas e um
// apóstrofo na frente de = + - @ (que a importação tira de volta).
import { validateDate, validateAmount, MAX_DESC_LEN } from "./validation.js";

const FORMS = ["pix", "debito", "credito", "dinheiro", "deposito"];
const INV_TIPOS = ["Aporte", "Resgate", "Rendimento"];
const FORMULA_START = /^[=+\-@\t\r]/;

export const CSV_HEADER = "Data,Tipo,InvTipo,Fixo/Variavel,Categoria,Descrição,Valor,Forma";

/** Uma célula de texto segura para planilha. */
export function csvCell(value) {
  let s = String(value ?? "");
  if (FORMULA_START.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** CSV completo dos lançamentos, ordenado por data, com BOM para o Excel abrir em UTF-8. */
export function buildTxCsv(transactions) {
  const rows = [...transactions]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(t => [
      csvCell(t.date), csvCell(t.type), csvCell(t.invTipo || ""), csvCell(t.fixed), csvCell(t.cat), csvCell(t.desc),
      (Number(t.val) || 0).toFixed(2), csvCell(t.form),
    ].join(","));
  return "\uFEFF" + [CSV_HEADER, ...rows].join("\n");
}

/** Divide uma linha em colunas (vírgula com aspas, ou tabulação). Entende "" dentro de aspas. */
export function parseCsvLine(line) {
  if (line.includes("\t")) return line.split("\t").map(c => c.trim().replace(/^"|"$/g, ""));
  const cols = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

/** "04/10/2026" ou "04/10/26" vira "2026-10-04"; ISO passa direto. */
export function csvDateToISO(date) {
  const s = String(date || "").trim();
  if (!s.includes("/")) return s;
  const p = s.split("/");
  if (p.length !== 3) return s;
  const yyyy = p[2].length === 4 ? p[2] : `20${p[2]}`;
  return `${yyyy}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
}

/**
 * Converte uma linha já dividida em colunas num lançamento validado.
 * A categoria volta crua (`rawCat`): quem chama decide se ela existe ou é nova.
 * @returns {{ok:true,row:object}|{ok:false,reason:string}}
 */
export function csvRowToTx(cols, colIdx) {
  const get = k => (colIdx[k] !== undefined ? cols[colIdx[k]] : undefined);
  const date = validateDate(csvDateToISO(get("date")));
  if (!date.ok) return { ok: false, reason: "data" };
  const amount = validateAmount(get("valTratado") ?? get("val"));
  if (!amount.ok) return { ok: false, reason: "valor" };
  let desc = String(get("desc") || "").trim();
  if (/^'[=+\-@]/.test(desc)) desc = desc.slice(1);
  if (!desc) return { ok: false, reason: "descrição" };
  if (desc.length > MAX_DESC_LEN) desc = desc.slice(0, MAX_DESC_LEN);

  const type = String(get("type") || "").toLowerCase().includes("entrada") ? "Entrada" : "Saída";
  const fixed = /fix/i.test(String(get("fixed") || "")) ? "Fixa" : "Variavel";
  let form = String(get("form") || "pix").toLowerCase();
  if (!FORMS.includes(form)) form = "pix";
  let rawCat = String(get("cat") || "").trim();
  if (/^'[=+\-@]/.test(rawCat)) rawCat = rawCat.slice(1);
  let invTipo = get("invTipo");
  if (!INV_TIPOS.includes(invTipo)) invTipo = null;
  return { ok: true, row: { date: date.value, type, fixed, rawCat, desc, val: amount.value, form, invTipo } };
}
