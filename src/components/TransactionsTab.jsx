import { Upload, Download, FileText, Trash2, Search, CreditCard, Calendar, Pencil, X, Receipt, Plus } from "lucide-react";
import { Card, BtnGhost, ConfirmIconButton, Segmented, useIncrementalReveal, PageHeader, IconButton, Totals } from "./ui";
import { TX, TX2, TX3, BD, BD2, R_BTN, R_CARD, SI, SUCCESS, ERROR, MUTED, accentText } from "../lib/theme";
import { fmt } from "../lib/financialEngine";
import { formatDayTitle, todayLocalISO } from "../lib/dates";

const INV_TIPOS = ["Aporte", "Resgate", "Rendimento"];

// Aba "Transações". O formulário de lançamento abre numa folha a partir do
// botão "Novo lançamento" (onNewTx), logo abaixo do resumo do mês.
export default function TransactionsTab({
  accent, catColor,
  filterType, search, filterMonth, months, filterCat, fullCats, viewTotals, filtered, groupedByDate, editingTx,
  setFilterType, setSearch, setFilterMonth, setFilterCat,
  onImportCSV, onExportCSV, onClearAll, onStartEditTx, onRequestDelete, onNewTx, onReport,
}) {
  // Desenha os lançamentos em blocos de 40 conforme a rolagem (ver useIncrementalReveal).
  const { visible: revealed, sentinelRef } = useIncrementalReveal(filtered.length, { resetKey: `${filterMonth}|${filterCat}|${filterType}|${search}` });
  const shownGroups = [];
  let budget = revealed;
  for (const [date, txs] of groupedByDate) {
    if (budget <= 0) break;
    shownGroups.push([date, txs.slice(0, budget)]);
    budget -= txs.length;
  }
  const hasActiveFilter = !!(filterMonth || filterCat || filterType || search.trim());
  const clearFilters = () => { setFilterMonth(""); setFilterCat(""); setFilterType(""); setSearch(""); };
  const today = todayLocalISO();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        icon={Receipt}
        title="Transações"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "lançamento" : "lançamentos"}${filterMonth ? ` em ${filterMonth}` : ""}`}
        actions={<>
          <label className="touch-44" title="Importar CSV" style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: R_BTN, color: TX2, cursor: "pointer" }}>
            <Upload size={16} aria-hidden="true" /><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>Importar CSV</span>
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={onImportCSV} />
          </label>
          <IconButton icon={FileText} size={16} color={TX2} label="Relatório do mês em PDF" onClick={onReport} />
          <IconButton icon={Download} size={16} color={TX2} label="Exportar CSV" onClick={onExportCSV} />
          <IconButton icon={Trash2} size={16} color={ERROR} label="Apagar todas as transações" onClick={onClearAll} />
        </>}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Segmented ariaLabel="Filtrar por tipo" size="sm" value={filterType} onChange={setFilterType} style={{ width: "fit-content" }}
          options={[{ value: "", label: "Todos", tone: "accent" }, { value: "Entrada", label: "Entrada", tone: "in" }, { value: "Saída", label: "Saída", tone: "out" }]} />
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <Search size={14} color={TX3} aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input aria-label="Buscar lançamentos" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...SI, paddingLeft: 34 }} />
        </div>
        <select aria-label="Mês" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...SI, width: "auto" }}>
          <option value="">Todos os meses</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select aria-label="Categoria" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...SI, width: "auto" }}>
          <option value="">Todas as categorias</option>
          {fullCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasActiveFilter && <BtnGhost onClick={clearFilters} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, paddingInline: 12, height: 40, paddingBlock: 0 }}><X size={14} />Limpar</BtnGhost>}
      </div>

      {/* ---- Resumo do que está filtrado ---- */}
      <Totals items={[{ l: "Saldo", v: viewTotals.balance, c: viewTotals.balance >= 0 ? accentText(accent) : ERROR }, { l: "Entradas", v: viewTotals.totalIn, c: SUCCESS }, { l: "Saídas", v: viewTotals.totalOut, c: TX }]} />
      {/* Mesmo botão do Início, em versão discreta: só contorno (pedido de 04/10/2026). */}
      <button type="button" onClick={onNewTx} className="btn-quiet-new" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, width: "100%", borderRadius: R_BTN, border: `1px solid ${BD2}`, background: "transparent", color: TX, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
        <Plus size={16} color={accentText(accent)} aria-hidden="true" />Novo lançamento
      </button>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: TX2, padding: 40, fontSize: 14, border: `1px dashed ${BD}`, borderRadius: R_CARD }}>
          {hasActiveFilter ? (<>
            <div style={{ marginBottom: 12 }}>Nenhum lançamento com esse filtro.</div>
            <BtnGhost onClick={clearFilters} style={{ paddingInline: 16, fontSize: 13 }}>Limpar filtros</BtnGhost>
          </>) : "Nenhum lançamento ainda. Toque em “Novo lançamento” para fazer o primeiro."}
        </div>
      )}

      {shownGroups.map(([date, txs]) => (
        <section key={date} aria-label={formatDayTitle(date, today)}>
          <h2 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: TX3 }}>{formatDayTitle(date, today)}</h2>
          <Card style={{ padding: "4px 12px 4px 16px", boxShadow: "none" }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {[...txs].reverse().map((t, i) => {
                const isIn = t.type === "Entrada";
                const editing = editingTx === t.id;
                const invLabel = t.invTipo && INV_TIPOS.includes(t.invTipo) ? t.invTipo : null;
                return (
                  <li key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? `1px solid ${BD}` : "none", background: editing ? MUTED : "transparent" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: TX, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.desc}</div>
                      <div style={{ fontSize: 12, color: TX3, marginTop: 1, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: catColor(t.cat) }} />{t.cat}</span>
                        {invLabel && <span>· {invLabel}</span>}
                        {t.installmentId && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>· <CreditCard size={10} aria-hidden="true" />parcelado</span>}
                        {t.plannedId && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>· <Calendar size={10} aria-hidden="true" />previsto</span>}
                        <span>· {t.form}</span>
                      </div>
                    </div>
                    <div className="num" style={{ fontSize: 13.5, fontWeight: 600, color: isIn ? SUCCESS : TX, flexShrink: 0 }}>{isIn ? "+" : "−"}{fmt(t.val)}</div>
                    <IconButton icon={Pencil} label={`Editar ${t.desc}`} onClick={() => onStartEditTx(t)} />
                    <ConfirmIconButton icon={Trash2} label={`Excluir ${t.desc}`} onConfirm={() => onRequestDelete({ type: "tx", id: t.id, label: t.desc })} />
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ))}
      {revealed < filtered.length && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
    </div>
  );
}
