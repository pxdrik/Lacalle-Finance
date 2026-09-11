import { Plus, ChevronLeft, ChevronRight, Repeat, Calendar, Check, Info, Eye, EyeOff, ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { Card, Btn, BtnGhost, MoneyInput, CategoryIcon, AnimatedValue, LinkifiedText } from "./ui";
import { TX, TX2, TX3, BD, BD2, CARD, R_INPUT, R_CARD, R_CHIP, SH_SM, SI, SUCCESS_FILL } from "../lib/theme";
import { fmt, monthKey, MONTH_ORDER } from "../lib/financialEngine";

const todayFn = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// Aba "Previstos" — extraída de LacalleFinance.jsx (Fase 2, código-motion
// puro, sem mudança de comportamento). Estado e handlers continuam em
// MainApp; este componente só recebe dados já calculados e callbacks.
export default function PlannedTab({
  plannedMonth, plannedStats, showPlannedForm, plannedFormRef, editingPlanned, plannedForm, plannedValRef,
  frequentTx, renderFrequentPicks, applyFrequentToPlanned, fullCats, catColor,
  plannedItemsForMonth, sortedPlannedItemsForMonth, expandedNotes, accent,
  setPlannedForm, setEditingPlanned, setShowPlannedForm, plannedFormSnapshotRef,
  onShiftMonth, onGoToday, onSave, onCancelForm, onTogglePaid, onToggleIgnored,
  onTransferToWish, onStartEdit, onRequestDelete, onToggleNotes,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: TX, letterSpacing: "-0.01em" }}>Gastos Previstos</div>
        <Btn onClick={() => { const empty = { desc: "", val: "", cat: "Assinaturas", form: "pix", recurring: false, month: plannedMonth, notes: "" }; setEditingPlanned(null); setPlannedForm(empty); plannedFormSnapshotRef.current = JSON.stringify(empty); setShowPlannedForm(p => !p); }} style={{ padding: "10px 18px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} />Adicionar</Btn>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, background: CARD, border: `1px solid ${BD}`, borderRadius: R_INPUT, padding: "10px 14px", boxShadow: SH_SM }}>
        <button onClick={() => onShiftMonth(-1)} className="touch-44" style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 12, width: 28, height: 28, color: TX2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={15} /></button>
        <div style={{ fontSize: 14, fontWeight: 700, color: TX, minWidth: 70, textAlign: "center" }}>{plannedMonth}</div>
        <button onClick={() => onShiftMonth(1)} className="touch-44" style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 12, width: 28, height: 28, color: TX2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={15} /></button>
        {plannedMonth !== monthKey(todayFn()) && <button onClick={onGoToday} style={{ background: "none", border: "none", color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer", marginLeft: 4 }}>hoje</button>}
      </div>
      {/* ---- Resumo: 1 linha, não 3 cards (ajuste de 06/09/2026) ---- */}
      <Card style={{ padding: "14px 18px", display: "flex", gap: 22, flexWrap: "wrap" }}>
        {[{ l: "Previsto", v: plannedStats.total, c: accent }, { l: "Já pago", v: plannedStats.paid, c: "#34D399" }, { l: "Falta pagar", v: plannedStats.pending, c: "#F87171" }].map(c => (
          <div key={c.l} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 11, color: TX2 }}>{c.l}</span>
            <span className="num" style={{ fontSize: 14.5, fontWeight: 700, color: c.c }}><AnimatedValue value={c.v} /></span>
          </div>
        ))}
      </Card>
      {showPlannedForm && (
        <div ref={plannedFormRef}>
        <Card style={{ padding: 26 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: TX, marginBottom: 18, letterSpacing: "-0.01em" }}>{editingPlanned !== null ? "Editar previsto" : "Novo gasto previsto"}</div>
          {editingPlanned === null && frequentTx.length > 0 && renderFrequentPicks(applyFrequentToPlanned)}
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <input placeholder="Ex: Kart, Smart Fit, Game Pass..." value={plannedForm.desc} maxLength={120} onChange={e => setPlannedForm(p => ({ ...p, desc: e.target.value }))} style={{ ...SI, flex: 2 }} />
            <MoneyInput ref={plannedValRef} placeholder="R$" value={plannedForm.val} onChange={v => setPlannedForm(p => ({ ...p, val: v }))} style={{ ...SI, flex: 1 }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {fullCats.filter(c => c !== "Investimento" && c !== "Salario / Entradas").map(c => { const cc = catColor(c); return (
              <button key={c} onClick={() => setPlannedForm(p => ({ ...p, cat: c }))} className="chip-btn" style={{ padding: "7px 12px", borderRadius: R_CHIP, border: "none", fontSize: 12, cursor: "pointer", background: plannedForm.cat === c ? cc + "26" : "rgba(255,255,255,0.03)", color: plannedForm.cat === c ? cc : TX2, display: "flex", alignItems: "center", gap: 5 }}><CategoryIcon cat={c} size={13} />{c}</button>
            ); })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 16 }}>
            <div><div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Forma</div><select value={plannedForm.form} onChange={e => setPlannedForm(p => ({ ...p, form: e.target.value }))} style={SI}>{["pix", "debito", "credito", "dinheiro", "deposito"].map(o => <option key={o}>{o}</option>)}</select></div>
            <div>
              <div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Repetição</div>
              <div style={{ display: "flex", borderRadius: R_INPUT, overflow: "hidden", background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}` }}>
                <button onClick={() => setPlannedForm(p => ({ ...p, recurring: false }))} style={{ flex: 1, padding: "9px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: !plannedForm.recurring ? accent : "transparent", color: !plannedForm.recurring ? "white" : TX2 }}>Só este mês</button>
                <button onClick={() => setPlannedForm(p => ({ ...p, recurring: true }))} style={{ flex: 1, padding: "9px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: plannedForm.recurring ? accent : "transparent", color: plannedForm.recurring ? "white" : TX2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Repeat size={12} />Todo mês</button>
              </div>
            </div>
            {!plannedForm.recurring && (
              <div><div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Mês</div><select value={plannedForm.month} onChange={e => setPlannedForm(p => ({ ...p, month: e.target.value }))} style={SI}>{MONTH_ORDER.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Notas / Descrição (opcional)</div>
            <textarea value={plannedForm.notes || ""} maxLength={2000} onChange={e => setPlannedForm(p => ({ ...p, notes: e.target.value }))} rows={4} placeholder="Motivo do lançamento, observações, links, planejamento..." style={{ ...SI, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={onSave} aria-disabled={!plannedForm.desc.trim() || !plannedForm.val} style={{ padding: "10px 20px", fontSize: 13, opacity: (!plannedForm.desc.trim() || !plannedForm.val) ? 0.5 : 1, cursor: "pointer" }}>{editingPlanned !== null ? "Salvar" : "Adicionar"}</Btn>
            <BtnGhost onClick={onCancelForm} style={{ padding: "10px 18px", fontSize: 13 }}>Cancelar</BtnGhost>
          </div>
        </Card>
        </div>
      )}
      {plannedItemsForMonth.length === 0 && (
        <div style={{ textAlign: "center", color: TX3, padding: 48, fontSize: 14, background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD, boxShadow: SH_SM }}>
          <Calendar size={26} style={{ marginBottom: 12, opacity: 0.5 }} /><div>Nenhum gasto previsto para {plannedMonth}.</div>
          <div style={{ fontSize: 12, color: TX3, marginTop: 6 }}>Toque em "Adicionar" para planejar contas, assinaturas ou compromissos deste mês.</div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sortedPlannedItemsForMonth.map(item => {
          const itemColor = catColor(item.cat);
          const isPaid = !!item.paid?.[plannedMonth];
          const isIgnored = !!item.ignored?.[plannedMonth];
          const notesKey = `planned-${item.id}`;
          return (
            <div key={item.id} style={{ background: isPaid ? "#34D39912" : isIgnored ? "#FBBF2412" : CARD, border: `1px solid ${isPaid ? "#34D39930" : isIgnored ? "#FBBF2430" : BD}`, borderRadius: R_INPUT, padding: "14px 16px", boxShadow: SH_SM, opacity: isIgnored ? 0.75 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <button onClick={() => onTogglePaid(item)} title={isPaid ? "Marcar como não pago" : "Marcar como pago"} className="touch-44" style={{ width: 24, height: 24, borderRadius: 8, border: isPaid ? "none" : `1.5px solid ${BD2}`, background: isPaid ? SUCCESS_FILL : "transparent", color: "white", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{isPaid && <Check size={13} />}</button>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: itemColor + "1f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CategoryIcon cat={item.cat} size={15} color={itemColor} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isPaid ? TX2 : TX, textDecoration: isPaid || isIgnored ? "line-through" : "none", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word", lineHeight: 1.3 }}>{item.desc}</div>
                  <div style={{ fontSize: 11, color: TX2, marginTop: 3, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ color: itemColor, fontWeight: 600 }}>{item.cat}</span>
                    {item.recurring && <span style={{ display: "flex", alignItems: "center", gap: 3, color: accent }}>· <Repeat size={10} />mensal</span>}
                    <span>· {item.form}</span>
                    {isIgnored && <span style={{ color: "#FBBF24", fontWeight: 600 }}>· ignorado este mês</span>}
                  </div>
                </div>
                <div className="num" style={{ fontSize: 14, fontWeight: 700, color: isPaid ? "#34D399" : TX, flexShrink: 0 }}>{fmt(item.val)}</div>
                <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  {item.notes && <button onClick={() => onToggleNotes(notesKey)} title="Ver notas" className="touch-44" style={{ background: "none", border: "none", color: expandedNotes[notesKey] ? accent : TX3, cursor: "pointer", flexShrink: 0, padding: 4 }}><Info size={14} /></button>}
                  {item.recurring && <button onClick={() => onToggleIgnored(item, plannedMonth)} title={isIgnored ? "Reativar este mês" : "Ignorar apenas este mês"} className="touch-44" style={{ background: "none", border: "none", color: isIgnored ? "#FBBF24" : TX3, cursor: "pointer", flexShrink: 0, padding: 4 }}>{isIgnored ? <Eye size={14} /> : <EyeOff size={14} />}</button>}
                  <button onClick={() => onTransferToWish(item)} title="Mover para Metas" aria-label="Mover para Metas" className="touch-44" style={{ background: "none", border: "none", color: TX3, cursor: "pointer", flexShrink: 0, padding: 4 }}><ArrowRightLeft size={14} /></button>
                  <button onClick={() => onStartEdit(item)} title="Editar" className="touch-44" style={{ background: "none", border: "none", color: TX3, cursor: "pointer", flexShrink: 0, padding: 4 }}><Pencil size={14} /></button>
                  <button onClick={() => onRequestDelete({ type: "planned", id: item.id, label: item.desc })} title="Excluir" className="touch-44" style={{ background: "none", border: "none", color: TX3, cursor: "pointer", flexShrink: 0, padding: 4 }}><Trash2 size={14} /></button>
                </div>
              </div>
              {item.notes && expandedNotes[notesKey] && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BD}`, fontSize: 12.5, color: TX2, lineHeight: 1.6 }}>
                  <LinkifiedText text={item.notes} color={accent} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
