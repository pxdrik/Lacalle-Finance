import { Upload, Download, Trash2, Search, CreditCard, Calendar, Pencil, X } from "lucide-react";
import { Card, BtnGhost, AnimatedValue, CategoryIcon } from "./ui";
import { TX, TX2, TX3, BD, CARD, R_BTN, R_INPUT, BTN_PAD_Y, SH_SM, SI } from "../lib/theme";
import { fmt } from "../lib/financialEngine";

const INV_TIPOS = ["Aporte", "Resgate", "Rendimento"];
const INV_TIPO_COLORS = { "Aporte": "#3B82F6", "Resgate": "#FBBF24", "Rendimento": "#34D399" };

// Aba "Transações" — extraída de LacalleFinance.jsx (Fase 2, código-motion
// puro, sem mudança de comportamento). O formulário de lançamento
// (renderTxForm) continua vivendo em MainApp e é passado como render-prop —
// é o trecho mais sensível do app (lida direto com dinheiro), não vale abrir
// uma frente extra de risco extraindo-o nesta fase.
export default function TransactionsTab({
  renderTxForm, accent, catColor,
  filterType, search, filterMonth, months, filterCat, fullCats, viewTotals, filtered, groupedByDate, editingTx,
  setFilterType, setSearch, setFilterMonth, setFilterCat,
  onImportCSV, onExportCSV, onClearAll, onStartEditTx, onRequestDelete,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card style={{ padding: 26 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: TX, marginBottom: 18, letterSpacing: "-0.01em" }}>Adicionar lançamento</div>
        {renderTxForm()}
      </Card>
      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: CARD, border: `1px solid ${BD}`, color: accent, padding: "12px", borderRadius: R_BTN, cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: SH_SM }}>
          <Upload size={15} />Importar CSV<input type="file" accept=".csv" style={{ display: "none" }} onChange={onImportCSV} />
        </label>
        <button onClick={onExportCSV} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: CARD, border: `1px solid ${BD}`, color: TX2, padding: "12px", borderRadius: R_BTN, cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: SH_SM }}><Download size={15} />Exportar</button>
        <button onClick={onClearAll} title="Apagar todas as transações" className="touch-44" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: CARD, border: `1px solid ${BD}`, color: "#F87171", padding: "12px 17px", borderRadius: R_BTN, cursor: "pointer", boxShadow: SH_SM }}><Trash2 size={15} /></button>
      </div>
      <div style={{ display: "flex", borderRadius: R_INPUT, overflow: "hidden", background: CARD, border: `1px solid ${BD}`, width: "fit-content" }}>
        {[["", "Todos"], ["Entrada", "Entrada"], ["Saída", "Saída"]].map(([val, label]) => (
          <button key={val || "all"} onClick={() => setFilterType(val)} style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", background: filterType === val ? (val === "Entrada" ? "#34D399" : val === "Saída" ? "#F87171" : accent) : "transparent", color: filterType === val ? "white" : TX2 }}>{label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <Search size={14} color={TX3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...SI, paddingLeft: 34 }} />
        </div>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...SI, width: "auto" }}>
          <option value="">Todos os meses</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...SI, width: "auto" }}>
          <option value="">Todas as categorias</option>
          {fullCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterMonth || filterCat || filterType || search) && <button onClick={() => { setFilterMonth(""); setFilterCat(""); setFilterType(""); setSearch(""); }} style={{ background: CARD, border: `1px solid ${BD}`, color: TX2, padding: "8px 13px", borderRadius: R_INPUT, cursor: "pointer" }}><X size={13} /></button>}
      </div>
      {/* ---- Resumo: 1 linha, não 3 cards (ajuste de 06/09/2026) ---- */}
      <Card style={{ padding: "14px 18px", display: "flex", gap: 22, flexWrap: "wrap" }}>
        {[{ l: "Entradas", v: viewTotals.totalIn, c: "#34D399" }, { l: "Saídas", v: viewTotals.totalOut, c: "#F87171" }, { l: "Saldo", v: viewTotals.balance, c: viewTotals.balance >= 0 ? "#34D399" : "#F87171" }].map(c => (
          <div key={c.l} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 11, color: TX2 }}>{c.l}</span>
            <span className="num" style={{ fontSize: 14.5, fontWeight: 700, color: c.c }}><AnimatedValue value={c.v} /></span>
          </div>
        ))}
      </Card>
      {filtered.length === 0 && (() => {
        const hasActiveFilter = !!(filterMonth || filterCat || filterType || search.trim());
        return hasActiveFilter ? (
          <div style={{ textAlign: "center", color: TX2, padding: 40, fontSize: 14 }}>
            <div style={{ marginBottom: 12 }}>Nenhuma transação encontrada com esse filtro.</div>
            <BtnGhost onClick={() => { setFilterMonth(""); setFilterCat(""); setFilterType(""); setSearch(""); }} style={{ padding: `${BTN_PAD_Y}px 16px`, fontSize: 12.5 }}>Limpar filtros</BtnGhost>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: TX2, padding: 40, fontSize: 14 }}>Você ainda não tem nenhuma transação. Use o formulário acima para lançar a primeira.</div>
        );
      })()}
      {groupedByDate.map(([date, txs]) => (
        <div key={date}>
          <div style={{ fontSize: 11, color: TX3, fontWeight: 700, marginBottom: 10, paddingLeft: 2 }}>{date}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...txs].reverse().map(t => {
              const isIn = t.type === "Entrada"; const bEdited = editingTx === t.id;
              const rowColor = catColor(t.cat);
              const invLabel = t.invTipo && INV_TIPOS.includes(t.invTipo) ? t.invTipo : null;
              return (
                <div key={t.id} style={{ background: bEdited ? `${accent}14` : CARD, border: `1px solid ${bEdited ? accent + "45" : BD}`, borderRadius: R_INPUT, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: SH_SM, transition: "background .15s, border-color .15s" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: rowColor + "1f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CategoryIcon cat={t.cat} size={15} color={rowColor} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TX, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.desc}</div>
                    <div style={{ fontSize: 11, color: TX2, marginTop: 3, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ color: rowColor, fontWeight: 600 }}>{t.cat}</span>
                      {invLabel && <span style={{ color: INV_TIPO_COLORS[invLabel] }}>· {invLabel}</span>}
                      {t.installmentId && <span style={{ display: "flex", alignItems: "center", gap: 3, color: accent }}>· <CreditCard size={10} />parcelado</span>}
                      {t.plannedId && <span style={{ display: "flex", alignItems: "center", gap: 3, color: accent }}>· <Calendar size={10} />previsto</span>}
                      <span>· {t.form}</span>
                    </div>
                  </div>
                  <div className="num" style={{ fontSize: 14, fontWeight: 700, color: isIn ? "#34D399" : "#F87171", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{isIn ? "+" : "-"}{fmt(t.val)}</div>
                  <button onClick={() => onStartEditTx(t)} title="Editar" className="touch-44" style={{ background: "none", border: "none", color: TX3, cursor: "pointer", flexShrink: 0, padding: 4 }}><Pencil size={14} /></button>
                  <button onClick={() => onRequestDelete({ type: "tx", id: t.id, label: t.desc })} title="Excluir" aria-label={`Excluir ${t.desc}`} className="touch-44" style={{ background: "none", border: "none", color: TX3, cursor: "pointer", flexShrink: 0, padding: 4 }}><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
