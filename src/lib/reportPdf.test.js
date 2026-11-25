import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { buildMonthlyReport } from "./report.js";
import { buildReportPdf, reportFileName } from "./reportPdf.js";

const tx = (id, desc, date, val = 10, type = "Saída") => ({ id, date, type, fixed: "Variavel", cat: "Outros", desc, val, form: "pix", invTipo: null });
const pdf = (transactions, month = "set/26") => buildReportPdf({ jsPDF, autoTable },
  buildMonthlyReport({ transactions, plannedExpenses: [], wishes: [], month, todayISO: "2026-11-24" }), { owner: "Pedro", todayISO: "2026-11-24" });

test("o PDF traz só os lançamentos do mês escolhido", () => {
  const doc = pdf([tx(1, "Mercado", "2026-10-01", 80), tx(2, "Cinema", "2026-09-12", 40), tx(3, "Salario", "2026-09-05", 1000, "Entrada")]);
  const out = doc.output();
  assert.ok(out.startsWith("%PDF-"));
  assert.ok(out.includes("(Cinema)"));
  assert.ok(out.includes("(Salario)"));
  assert.ok(!out.includes("Mercado"));
  assert.equal(doc.getNumberOfPages(), 1);
});

test("mês com muitos lançamentos quebra a página e numera todas", () => {
  const many = Array.from({ length: 120 }, (_, i) => tx(i + 1, `Item ${i + 1}`, "2026-09-10"));
  const doc = pdf(many);
  const pages = doc.getNumberOfPages();
  assert.ok(pages >= 2);
  assert.ok(doc.output().includes(`(${pages} de ${pages})`));
  assert.ok(doc.output().includes("(Item 120)"));
});

test("nome do arquivo sem acento nem espaço", () => {
  assert.equal(reportFileName("mar/26"), "relatorio-marco-de-2026.pdf");
  assert.equal(reportFileName("set/26"), "relatorio-setembro-de-2026.pdf");
});
