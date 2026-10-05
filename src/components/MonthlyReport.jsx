// Relatório mensal para imprimir ou salvar como PDF pela janela de impressão
// do navegador (sem biblioteca de PDF). Vai num portal fora do #root: na
// impressão o CSS esconde o app e mostra só isto (ver .print-report em
// index.css). Papel branco, texto preto: nada aqui depende do tema escuro.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { fmt } from "../lib/financialEngine";
import { formatMonthKey } from "../lib/dates";

const INK = "#111111", SOFT = "#555555", RULE = "#D9D9D9";
const th = { textAlign: "left", fontWeight: 600, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: SOFT, padding: "6px 8px 6px 0", borderBottom: `1px solid ${INK}` };
const td = { padding: "5px 8px 5px 0", borderBottom: `1px solid ${RULE}`, verticalAlign: "top" };
const num = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", paddingRight: 0 };

function Section({ title, children }) {
  return (
    <section style={{ marginTop: 22, breakInside: "avoid-page" }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 8px", color: INK }}>{title}</h2>
      {children}
    </section>
  );
}

/** `report` vem de lib/report.js. Ao montar, abre a impressão; `onDone` ao fechar. */
export default function MonthlyReport({ report, owner, todayISO, onDone }) {
  useEffect(() => {
    const done = () => onDone();
    window.addEventListener("afterprint", done);
    // um quadro para o navegador desenhar o relatório antes de abrir a janela
    const id = requestAnimationFrame(() => window.print());
    return () => { cancelAnimationFrame(id); window.removeEventListener("afterprint", done); };
  }, [onDone]);

  const r = report;
  const month = formatMonthKey(r.month);
  const title = month.charAt(0).toUpperCase() + month.slice(1);
  return createPortal(
    <article className="print-report" aria-label={`Relatório de ${month}`} style={{ color: INK, background: "#fff", fontFamily: "'IBM Plex Sans Variable','IBM Plex Sans',system-ui,sans-serif", fontSize: 10.5, lineHeight: 1.45 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `2px solid ${INK}`, paddingBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: SOFT }}>LaCalle Finance · Relatório mensal</div>
          <h1 style={{ fontSize: 22, margin: "4px 0 0", letterSpacing: "-0.02em" }}>{title}</h1>
        </div>
        <div style={{ textAlign: "right", fontSize: 9.5, color: SOFT }}>
          <div>{owner}</div>
          <div>Gerado em {new Date(`${todayISO}T12:00:00`).toLocaleDateString("pt-BR")}{r.partial ? " · mês em andamento, valores até hoje" : ""}</div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 16 }}>
        {[["Entradas", r.totals.totalIn], ["Saídas", r.totals.totalOut], ["Saldo do mês", r.totals.balance], ["Patrimônio no fim do mês", r.patrimony]].map(([l, v]) => (
          <div key={l} style={{ border: `1px solid ${RULE}`, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 9, color: SOFT }}>{l}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{fmt(v)}</div>
          </div>
        ))}
      </div>

      <Section title="Para onde foi o dinheiro">
        {r.categories.length === 0 ? <p style={{ color: SOFT, margin: 0 }}>Nenhuma saída neste mês.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Categoria</th><th style={{ ...th, ...num }}>Valor</th><th style={{ ...th, ...num, width: 60 }}>%</th></tr></thead>
            <tbody>{r.categories.map(c => (
              <tr key={c.name}><td style={td}>{c.name}</td><td style={{ ...td, ...num }}>{fmt(c.value)}</td><td style={{ ...td, ...num }}>{String(c.pct).replace(".", ",")}%</td></tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      {r.planned.items.length > 0 && (
        <Section title={`Previstos · ${fmt(r.planned.stats.paid)} pagos de ${fmt(r.planned.stats.total)}`}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Conta</th><th style={th}>Categoria</th><th style={th}>Situação</th><th style={{ ...th, ...num }}>Valor</th></tr></thead>
            <tbody>{r.planned.items.map((p, i) => (
              <tr key={i}><td style={td}>{p.desc}</td><td style={td}>{p.cat}</td><td style={td}>{p.status}</td><td style={{ ...td, ...num }}>{fmt(p.val)}</td></tr>
            ))}</tbody>
          </table>
        </Section>
      )}

      {r.wishes.length > 0 && (
        <Section title="Metas · situação de hoje">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Meta</th><th style={{ ...th, ...num }}>Juntado</th><th style={{ ...th, ...num }}>Valor</th><th style={{ ...th, ...num, width: 60 }}>%</th></tr></thead>
            <tbody>{r.wishes.map((w, i) => (
              <tr key={i}><td style={td}>{w.name}{w.done ? " (concluída)" : ""}</td><td style={{ ...td, ...num }}>{fmt(w.saved)}</td><td style={{ ...td, ...num }}>{fmt(w.price)}</td><td style={{ ...td, ...num }}>{w.pct}%</td></tr>
            ))}</tbody>
          </table>
        </Section>
      )}

      <Section title={`Lançamentos · ${r.tx.length}`}>
        {r.tx.length === 0 ? <p style={{ color: SOFT, margin: 0 }}>Nenhum lançamento neste mês.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ ...th, width: 62 }}>Dia</th><th style={th}>Descrição</th><th style={th}>Categoria</th><th style={{ ...th, ...num }}>Valor</th></tr></thead>
            <tbody>{r.tx.map(t => (
              <tr key={t.id} style={{ breakInside: "avoid" }}>
                <td style={td}>{t.date.slice(8, 10)}/{t.date.slice(5, 7)}</td>
                <td style={td}>{t.desc}</td>
                <td style={td}>{t.cat}{t.invTipo ? ` · ${t.invTipo}` : ""}</td>
                <td style={{ ...td, ...num }}>{t.type === "Entrada" ? "+" : "−"}{fmt(t.val)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Section>
    </article>,
    document.body,
  );
}
