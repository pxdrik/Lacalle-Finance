import { Plus, Check, ArrowRightLeft, Pencil, Trash2, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { Card, Btn, BtnGhost, MoneyInput, ProgressBar, LinkifiedText, toDecimalStr, EmptyState, ConfirmIconButton } from "./ui";
import { TX, TX2, BD, BD2, CARD, R_INPUT, R_CHIP, SI, SUCCESS_FILL } from "../lib/theme";
import { fmt } from "../lib/financialEngine";

// Aba "Metas" (Desejos/Wishes) — extraída de LacalleFinance.jsx (Fase 2,
// código-motion puro, sem mudança de comportamento). Estado e handlers
// continuam em MainApp; este componente só recebe dados e callbacks.
export default function WishesTab({
  wishes, sortedWishes, wishSortBy, showWishForm, wishForm, editingWish, expandedNotes, accent,
  wishFormRef, wishFormSnapshotRef,
  setWishSortBy, setShowWishForm, setEditingWish, setWishForm,
  onSave, onCancelForm, onToggleDone, onTransferToPlanned, onRequestDelete, onToggleNotes,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: TX, letterSpacing: "-0.01em" }}>Minhas Metas</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", borderRadius: R_INPUT, overflow: "hidden", background: CARD, border: `1px solid ${BD}` }}>
            <button onClick={() => setWishSortBy("progress")} title="Ordenar por progresso" style={{ padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: wishSortBy === "progress" ? accent : "transparent", color: wishSortBy === "progress" ? "white" : TX2 }}>Progresso</button>
            <button onClick={() => setWishSortBy("priority")} title="Ordenar por prioridade" style={{ padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: wishSortBy === "priority" ? accent : "transparent", color: wishSortBy === "priority" ? "white" : TX2 }}>Prioridade</button>
          </div>
          <Btn onClick={() => { const empty = { name: "", price: "", saved: "", priority: "Média", monthsTarget: "", notes: "" }; setEditingWish(null); setWishForm(empty); wishFormSnapshotRef.current = JSON.stringify(empty); setShowWishForm(p => !p); }} style={{ paddingInline: 18, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} />Adicionar</Btn>
        </div>
      </div>
      {showWishForm && (
        <div ref={wishFormRef}>
        <Card style={{ padding: 26 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: TX, marginBottom: 18, letterSpacing: "-0.01em" }}>{editingWish !== null ? "Editar" : "Novo desejo"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
            {[{ l: "Nome", k: "name", t: "text" }, { l: "Preço (R$)", k: "price", t: "money" }, { l: "Já guardei (R$)", k: "saved", t: "money" }, { l: "Meta (meses)", k: "monthsTarget", t: "number" }].map(f => (
              <div key={f.k}><div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>{f.l}</div>{f.t === "money"
                ? <MoneyInput value={wishForm[f.k]} onChange={v => setWishForm(p => ({ ...p, [f.k]: v }))} style={SI} />
                : <input type={f.t} value={wishForm[f.k]} maxLength={f.t === "text" ? 80 : undefined} onChange={e => setWishForm(p => ({ ...p, [f.k]: e.target.value }))} style={SI} />}</div>
            ))}
            <div><div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Prioridade</div><select value={wishForm.priority} onChange={e => setWishForm(p => ({ ...p, priority: e.target.value }))} style={SI}>{["Alta", "Média", "Baixa"].map(o => <option key={o}>{o}</option>)}</select></div>
            <div style={{ gridColumn: "1/-1" }}>
              <div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Notas / Descrição (opcional)</div>
              <textarea value={wishForm.notes || ""} maxLength={2000} onChange={e => setWishForm(p => ({ ...p, notes: e.target.value }))} rows={4} placeholder="Detalhes, observações, planejamento, links de produtos..." style={{ ...SI, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", gridColumn: "1/-1", flexWrap: "wrap" }}>
              <Btn onClick={onSave} aria-disabled={!wishForm.name || !wishForm.price} style={{ paddingInline: 20, fontSize: 13, opacity: (!wishForm.name || !wishForm.price) ? 0.5 : 1, cursor: "pointer" }}>{editingWish !== null ? "Salvar" : "Adicionar"}</Btn>
              <BtnGhost onClick={onCancelForm} style={{ paddingInline: 18, fontSize: 13 }}>Cancelar</BtnGhost>
            </div>
          </div>
        </Card>
        </div>
      )}
      {wishes.length === 0 && (
        <EmptyState
          icon={Sparkles}
          title="Nenhum desejo ainda!"
          caption="Adicione uma meta para começar a acompanhar seu progresso."
        />
      )}
      {/* ---- Cada meta era um Card próprio (moldura dentro de lista de
           molduras) — ajuste de 06/09/2026: agora é uma lista, uma única
           Card externa e uma borda inferior fina separando as metas. ---- */}
      {sortedWishes.length > 0 && (
      <Card style={{ padding: 0 }}>
      {sortedWishes.map((w, wIdx) => {
        const pct2 = Math.min(100, Math.round(w.saved / w.price * 100));
        const pColor = { "Alta": "#F87171", "Média": "#FBBF24", "Baixa": "#34D399" }[w.priority];
        const remaining = w.price - w.saved;
        const monthly = w.monthsTarget > 0 ? Math.ceil(remaining / w.monthsTarget) : null;
        const notesKey = `wish-${w.id}`;
        return (
          <div key={w.id} style={{ padding: 22, opacity: w.done ? 0.7 : 1, borderBottom: wIdx < sortedWishes.length - 1 ? `1px solid ${BD}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
                <button onClick={() => onToggleDone(w.id)} title={w.done ? "Marcar como não conquistado" : "Marcar como conquistado"} className="touch-44" style={{ width: 24, height: 24, borderRadius: 8, border: w.done ? "none" : `1.5px solid ${BD2}`, background: w.done ? SUCCESS_FILL : "transparent", color: "white", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>{w.done && <Check size={13} />}</button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: w.done ? TX2 : TX, textDecoration: w.done ? "line-through" : "none", letterSpacing: "-0.01em" }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: TX2, marginTop: 5 }}>{fmt(w.saved)} de {fmt(w.price)} · faltam {fmt(remaining)}</div>
                  {monthly && <div style={{ fontSize: 11, color: accent, marginTop: 5, fontWeight: 700 }}>Poupe {fmt(monthly)}/mês por {w.monthsTarget} meses</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <span style={{ background: pColor + "22", color: pColor, fontSize: 11, padding: "4px 10px", borderRadius: R_CHIP, fontWeight: 700 }}>{w.priority}</span>
                <button onClick={() => onTransferToPlanned(w)} title="Mover para Previstos" aria-label="Mover para Previstos" className="touch-44" style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, padding: "5px 8px", color: TX2, cursor: "pointer" }}><ArrowRightLeft size={12} /></button>
                <button onClick={() => { const snap = { name: w.name, price: toDecimalStr(w.price), saved: toDecimalStr(w.saved), priority: w.priority, monthsTarget: String(w.monthsTarget || ""), notes: w.notes || "" }; setEditingWish(w.id); setWishForm(snap); wishFormSnapshotRef.current = JSON.stringify(snap); setShowWishForm(true); }} title="Editar" aria-label="Editar" className="touch-44" style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, padding: "5px 8px", color: TX2, cursor: "pointer" }}><Pencil size={12} /></button>
                <ConfirmIconButton icon={Trash2} label={`Excluir ${w.name}`} onConfirm={() => onRequestDelete({ type: "wish", id: w.id, label: w.name })} />
              </div>
            </div>
            <ProgressBar pct={pct2} color={accent} height={7} />
            <div style={{ fontSize: 11, color: TX2, marginTop: 8 }}>{pct2}% conquistado</div>
            {w.notes && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BD}` }}>
                <button onClick={() => onToggleNotes(notesKey)} style={{ background: "none", border: "none", color: accent, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: 0, marginBottom: expandedNotes[notesKey] ? 10 : 0 }}>
                  {expandedNotes[notesKey] ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Notas e planejamento
                </button>
                {expandedNotes[notesKey] && <div style={{ fontSize: 12.5, color: TX2, lineHeight: 1.6 }}><LinkifiedText text={w.notes} color={accent} /></div>}
              </div>
            )}
          </div>
        );
      })}
      </Card>
      )}
    </div>
  );
}
