// reportPdf.js: o relatório mensal (lib/report.js) como arquivo PDF.
//
// Antes o relatório abria a janela de impressão do navegador para "Salvar
// como PDF", fluxo ruim no celular (teste de 24/11/2026). Agora o arquivo é
// gerado aqui e baixado direto. O jsPDF só é carregado quando alguém pede o
// relatório (import dinâmico), então não pesa na abertura do app.
//
// ponytail: fonte Helvetica do próprio PDF, não a IBM Plex do app; embutir a
// Plex soma uns 200 KB por arquivo. Trocar se o relatório virar peça de marca.
import { fmt } from "./financialEngine.js";
import { formatMonthKey } from "./dates.js";

const INK = 17, SOFT = 85, RULE = 217;
const M = 14; // margem, em mm

/** Monta o documento. `jsPDF` e `autoTable` entram por parâmetro para o teste rodar no Node. */
export function buildReportPdf({ jsPDF, autoTable }, report, { owner, todayISO }) {
  const r = report;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const month = formatMonthKey(r.month);
  doc.setProperties({ title: `Relatório de ${month}`, author: owner || "", creator: "LaCalle Finance" });

  // cabeçalho
  doc.setTextColor(SOFT).setFontSize(8).setFont("helvetica", "normal");
  doc.text("LACALLE FINANCE · RELATÓRIO MENSAL", M, M + 3);
  doc.setTextColor(INK).setFontSize(20).setFont("helvetica", "bold");
  doc.text(month.charAt(0).toUpperCase() + month.slice(1), M, M + 12);
  doc.setTextColor(SOFT).setFontSize(8.5).setFont("helvetica", "normal");
  const generated = `Gerado em ${todayISO.slice(8, 10)}/${todayISO.slice(5, 7)}/${todayISO.slice(0, 4)}`;
  doc.text([owner || "", r.partial ? `${generated} · mês em andamento, valores até hoje` : generated], W - M, M + 7, { align: "right" });
  doc.setDrawColor(INK).setLineWidth(0.6).line(M, M + 16, W - M, M + 16);

  // totais
  const boxes = [["Entradas", r.totals.totalIn], ["Saídas", r.totals.totalOut], ["Saldo do mês", r.totals.balance], ["Patrimônio no fim do mês", r.patrimony]];
  const gap = 3, bw = (W - 2 * M - gap * 3) / 4, by = M + 21;
  boxes.forEach(([label, value], i) => {
    const x = M + i * (bw + gap);
    doc.setDrawColor(RULE).setLineWidth(0.3).roundedRect(x, by, bw, 15, 1.5, 1.5);
    doc.setTextColor(SOFT).setFontSize(7.5).setFont("helvetica", "normal").text(label, x + 3, by + 5);
    doc.setTextColor(INK).setFontSize(11).setFont("helvetica", "bold").text(fmt(value), x + 3, by + 11.5);
  });

  let y = by + 15;
  const section = (title, head, body, numCols, empty) => {
    if (y > H - 40) { doc.addPage(); y = M; }
    y += 9;
    doc.setTextColor(INK).setFontSize(9).setFont("helvetica", "bold").text(title.toUpperCase(), M, y);
    y += 2;
    if (!body.length) {
      doc.setTextColor(SOFT).setFontSize(9).setFont("helvetica", "normal").text(empty, M, y + 5);
      y += 6;
      return;
    }
    const right = Object.fromEntries(numCols.map(c => [c, { halign: "right" }]));
    autoTable(doc, {
      startY: y, head: [head], body, theme: "plain", margin: { left: M, right: M },
      styles: { fontSize: 8.5, textColor: INK, cellPadding: { top: 1.4, bottom: 1.4, left: 0, right: 2 }, lineColor: RULE, lineWidth: { bottom: 0.2 } },
      headStyles: { fontSize: 7, textColor: SOFT, fontStyle: "bold", lineColor: INK, lineWidth: { bottom: 0.3 } },
      columnStyles: right,
      didParseCell: c => { if (c.section === "head" && right[c.column.index]) c.cell.styles.halign = "right"; },
    });
    y = doc.lastAutoTable.finalY;
  };

  section("Para onde foi o dinheiro", ["Categoria", "Valor", "%"],
    r.categories.map(c => [c.name, fmt(c.value), `${String(c.pct).replace(".", ",")}%`]), [1, 2], "Nenhuma saída neste mês.");
  if (r.planned.items.length)
    section(`Previstos · ${fmt(r.planned.stats.paid)} pagos de ${fmt(r.planned.stats.total)}`, ["Conta", "Categoria", "Situação", "Valor"],
      r.planned.items.map(p => [p.desc, p.cat, p.status, fmt(p.val)]), [3]);
  if (r.wishes.length)
    section("Metas · situação de hoje", ["Meta", "Juntado", "Valor", "%"],
      r.wishes.map(w => [w.name + (w.done ? " (concluída)" : ""), fmt(w.saved), fmt(w.price), `${w.pct}%`]), [1, 2, 3]);
  section(`Lançamentos · ${r.tx.length}`, ["Dia", "Descrição", "Categoria", "Valor"],
    r.tx.map(t => [`${t.date.slice(8, 10)}/${t.date.slice(5, 7)}`, t.desc, t.cat + (t.invTipo ? ` · ${t.invTipo}` : ""), `${t.type === "Entrada" ? "+" : "-"}${fmt(t.val)}`]), [3], "Nenhum lançamento neste mês.");

  // rodapé com a página, em todas
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setTextColor(SOFT).setFontSize(7.5).setFont("helvetica", "normal").text(`${i} de ${pages}`, W - M, H - 8, { align: "right" });
  }
  return doc;
}

/** Nome do arquivo: "relatorio-setembro-de-2026.pdf". */
export const reportFileName = month => `relatorio-${formatMonthKey(month).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")}.pdf`;

/** Carrega o jsPDF, gera e baixa o arquivo. */
export async function downloadReportPdf(report, opts) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  buildReportPdf({ jsPDF, autoTable }, report, opts).save(reportFileName(report.month));
}
