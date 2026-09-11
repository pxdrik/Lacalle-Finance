import { Plus, CreditCard, X } from "lucide-react";
import { Card, BtnGhost, AnimatedValue, MoneyInput, CategoryIcon, ProgressBar, EmptyState } from "./ui";
import { TX, TX2, TX3, BD, R_INPUT, R_BTN, R_CHIP, SI } from "../lib/theme";
import { fmt, monthKey } from "../lib/financialEngine";
import { DATE_MIN, DATE_MAX } from "../lib/validation";

// Aba "Parcelas" — extraída de LacalleFinance.jsx (Fase 2, código-motion puro,
// sem mudança de comportamento). Todo o estado e handlers continuam em
// MainApp; este componente só recebe dados já calculados e callbacks.
export default function InstallmentsTab({
  installments, instStats, showInstForm, instDraft, monthlyPreview, fullCats,
  txMap, todayFn, accent, catColor,
  onOpenForm, onCancelForm, onChangeDraft, onAdd, onRequestDelete,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="stat3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[{ l: "A pagar", v: instStats.remaining, c: "#F87171", f: true }, { l: "Já pago", v: instStats.paid, c: "#34D399", f: true }, { l: "Ativas", v: instStats.active, c: accent, f: false }].map(({ l, v, c, f }) => (
          <Card key={l} className="stat-card" style={{ padding: 18, textAlign: "center", overflow: "hidden" }}>
            <div className="stat-label" style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>{l}</div>
            <div className="stat-val" style={{ fontSize: 19, fontWeight: 700, color: c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f ? <AnimatedValue value={v} /> : v}</div>
          </Card>
        ))}
      </div>
      {!showInstForm && <BtnGhost onClick={onOpenForm} style={{ width: "100%", paddingInline: 12, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Plus size={14} />Nova compra parcelada</BtnGhost>}
      {showInstForm && (
        <Card style={{ padding: 26 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: TX, marginBottom: 18, letterSpacing: "-0.01em" }}>Nova compra parcelada</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
            <div style={{ gridColumn: "1/-1" }}><div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Descrição</div><input placeholder="Ex: iPhone" value={instDraft.desc} maxLength={120} onChange={e => onChangeDraft(d => ({ ...d, desc: e.target.value }))} style={SI} /></div>
            <div><div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Valor total (R$)</div><MoneyInput placeholder="6000" value={instDraft.totalVal} onChange={v => onChangeDraft(d => ({ ...d, totalVal: v }))} style={SI} /></div>
            <div><div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Nº de parcelas</div><input type="number" min="1" max="360" placeholder="12" value={instDraft.numParcelas} onChange={e => onChangeDraft(d => ({ ...d, numParcelas: e.target.value }))} style={SI} /></div>
            {monthlyPreview && (
              <div style={{ gridColumn: "1/-1", background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}`, borderRadius: R_INPUT, padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 12, color: TX2 }}>Valor por parcela</span>
                <span className="num" style={{ fontSize: 16, fontWeight: 700, color: accent }}>{fmt(monthlyPreview)}/mês</span>
              </div>
            )}
            <div><div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Primeiro vencimento</div><input type="date" value={instDraft.startDate} min={DATE_MIN} max={DATE_MAX} onChange={e => onChangeDraft(d => ({ ...d, startDate: e.target.value }))} style={SI} /></div>
            <div><div style={{ fontSize: 11, color: TX2, marginBottom: 5 }}>Forma de pagamento</div><select value={instDraft.form} onChange={e => onChangeDraft(d => ({ ...d, form: e.target.value }))} style={SI}>{["credito", "debito", "pix", "dinheiro"].map(o => <option key={o}>{o}</option>)}</select></div>
          </div>
          <div style={{ fontSize: 11, color: TX2, marginBottom: 10 }}>Categoria</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
            {fullCats.filter(c => c !== "Investimento" && c !== "Salario / Entradas").map(c => { const cc = catColor(c); return (
              <button key={c} onClick={() => onChangeDraft(d => ({ ...d, cat: c }))} className="chip-btn" style={{ padding: "6px 12px", borderRadius: R_CHIP, border: "none", fontSize: 12, cursor: "pointer", background: instDraft.cat === c ? cc + "26" : "rgba(255,255,255,0.03)", color: instDraft.cat === c ? cc : TX2, display: "flex", alignItems: "center", gap: 5 }}>
                <CategoryIcon cat={c} size={13} />{c}
              </button>
            ); })}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <BtnGhost onClick={onCancelForm} style={{ flex: 1, paddingInline: 12, minWidth: 100 }}>Cancelar</BtnGhost>
            <button onClick={onAdd} aria-disabled={!instDraft.desc || !instDraft.totalVal} style={{ flex: 2, padding: "11px", borderRadius: R_BTN, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: (!instDraft.desc || !instDraft.totalVal) ? "rgba(255,255,255,0.04)" : accent, color: (!instDraft.desc || !instDraft.totalVal) ? TX3 : "white", minWidth: 180 }}>
              {monthlyPreview ? `Criar ${instDraft.numParcelas}x de ${fmt(monthlyPreview)}` : "Criar parcelamento"}
            </button>
          </div>
        </Card>
      )}
      {installments.length === 0 && (
        <EmptyState icon={CreditCard} title="Nenhum parcelamento cadastrado." />
      )}
      {[...installments].reverse().map(inst => {
        const today = todayFn();
        const instTxs = inst.txIds.map(id => txMap.get(id)).filter(Boolean);
        const paidTxs = instTxs.filter(t => t.date <= today);
        const pendingTxs = instTxs.filter(t => t.date > today);
        const remainingVal = pendingTxs.reduce((s, t) => s + t.val, 0);
        const totalPaidVal = paidTxs.reduce((s, t) => s + t.val, 0);
        const pct = inst.numParcelas > 0 ? Math.round((paidTxs.length / inst.numParcelas) * 100) : 0;
        const isComplete = pendingTxs.length === 0 && instTxs.length > 0;
        const monthly = inst.totalVal / inst.numParcelas;
        const dotColor = catColor(inst.cat);
        const endTx = [...instTxs].sort((a, b) => b.date.localeCompare(a.date))[0];
        const endDate = endTx ? monthKey(endTx.date) : "?";
        return (
          <Card key={inst.id} style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: dotColor + "1f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CategoryIcon cat={inst.cat} size={14} color={dotColor} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TX, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inst.desc}</div>
                  <div style={{ fontSize: 11, color: TX2, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmt(monthly)}/mês · {inst.form} · até {endDate}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ textAlign: "right" }}>
                  {isComplete ? <div style={{ fontSize: 12, color: "#34D399", fontWeight: 700 }}>Quitado</div> : <div className="num" style={{ fontSize: 13, fontWeight: 700, color: "#F87171" }}>{fmt(remainingVal)}</div>}
                  <div style={{ fontSize: 11, color: TX2, marginTop: 3 }}>{paidTxs.length}/{inst.numParcelas}x pagas</div>
                </div>
                <button onClick={() => onRequestDelete(inst.id)} title="Remover parcelamento" className="touch-44" style={{ background: "none", border: "none", color: TX3, cursor: "pointer", padding: 2 }}><X size={16} /></button>
              </div>
            </div>
            <ProgressBar pct={pct} color={isComplete ? "#34D399" : dotColor} height={6} style={{ marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: TX2, flexWrap: "wrap", gap: 4 }}>
              <span>pago: {fmt(totalPaidVal)}</span><span style={{ color: accent, fontWeight: 700 }}>{pct}%</span><span>total: {fmt(inst.totalVal)}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
