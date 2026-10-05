import { Plus, CreditCard, X, Trash2 } from "lucide-react";
import { Card, BtnGhost, Btn, MoneyInput, ProgressBar, EmptyState, PageHeader, IconButton, Modal, Totals } from "./ui";
import { TX, TX2, TX3, BD, SI, SUCCESS, accentText } from "../lib/theme";
import { fmt, monthKey } from "../lib/financialEngine";
import { DATE_MIN, DATE_MAX } from "../lib/validation";

// Aba "Parcelas". Mesmo cabeçalho e totais de Transações e Previstos; o
// formulário de compra parcelada abre numa folha.
export default function InstallmentsTab({
  installments, instStats, showInstForm, instDraft, monthlyPreview, fullCats,
  txMap, todayFn, accent, catColor,
  onOpenForm, onCancelForm, onChangeDraft, onAdd, onRequestDelete,
}) {
  const lbl = { display: "block", fontSize: 12, color: TX2, fontWeight: 500, marginBottom: 6 };
  const canAdd = instDraft.desc && instDraft.totalVal;
  const today = todayFn();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader icon={CreditCard} title="Parcelas" subtitle="Compras divididas e quanto ainda falta"
        actions={<BtnGhost onClick={onOpenForm} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, paddingInline: 14, color: TX }}><Plus size={15} color={accentText(accent)} />Nova compra</BtnGhost>} />

      {installments.length > 0 && (
        <Totals items={[{ l: "Falta pagar", v: instStats.remaining, c: TX }, { l: "Já pago", v: instStats.paid, c: SUCCESS }, { l: instStats.active === 1 ? "Ativa" : "Ativas", v: instStats.active, c: accentText(accent), count: true }]} />
      )}

      {installments.length === 0 && (
        <EmptyState icon={CreditCard} title="Nenhuma compra parcelada." caption="Cadastre uma vez e as parcelas entram sozinhas em cada mês." action={{ label: "Nova compra", icon: Plus, onClick: onOpenForm }} />
      )}

      {installments.length > 0 && (
        <Card style={{ padding: "4px 8px 4px 16px", boxShadow: "none" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {[...installments].reverse().map((inst, i) => {
              const instTxs = inst.txIds.map(id => txMap.get(id)).filter(Boolean);
              const paidTxs = instTxs.filter(t => t.date <= today);
              const pendingTxs = instTxs.filter(t => t.date > today);
              const remainingVal = pendingTxs.reduce((s, t) => s + t.val, 0);
              const totalPaidVal = paidTxs.reduce((s, t) => s + t.val, 0);
              const pct = inst.numParcelas > 0 ? Math.round((paidTxs.length / inst.numParcelas) * 100) : 0;
              const isComplete = pendingTxs.length === 0 && instTxs.length > 0;
              const monthly = inst.totalVal / inst.numParcelas;
              const endTx = [...instTxs].sort((a, b) => b.date.localeCompare(a.date))[0];
              const endDate = endTx ? monthKey(endTx.date) : "?";
              return (
                <li key={inst.id} style={{ padding: "14px 0", borderTop: i ? `1px solid ${BD}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: TX, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inst.desc}</span>
                        {isComplete
                          ? <span style={{ fontSize: 12, color: SUCCESS, fontWeight: 600, flexShrink: 0 }}>Quitado</span>
                          : <span className="num" style={{ fontSize: 13.5, fontWeight: 600, color: TX, flexShrink: 0 }}>{fmt(remainingVal)}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: TX3, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: catColor(inst.cat) }} />{inst.cat}</span>
                        <span className="num">· {fmt(monthly)}/mês</span>
                        <span>· até {endDate}</span>
                      </div>
                      <ProgressBar pct={pct} color={isComplete ? SUCCESS : accent} height={6} style={{ marginTop: 10 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12, color: TX3, marginTop: 6 }}>
                        <span>{paidTxs.length} de {inst.numParcelas} pagas · {fmt(totalPaidVal)}</span>
                        <span className="num">total {fmt(inst.totalVal)}</span>
                      </div>
                    </div>
                    <IconButton icon={Trash2} size={16} label={`Remover ${inst.desc}`} onClick={() => onRequestDelete(inst.id)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {showInstForm && (
        <Modal align="sheet" onClose={onCancelForm} maxWidth={560} padding={20} label="Nova compra parcelada">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: TX }}>Nova compra parcelada</h2>
            <IconButton icon={X} size={18} label="Fechar" onClick={onCancelForm} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label htmlFor="inst-total" style={lbl}>Valor total</label>
              <div className="amt-field"><span aria-hidden="true">R$</span><MoneyInput id="inst-total" placeholder="0,00" value={instDraft.totalVal} onChange={v => onChangeDraft(d => ({ ...d, totalVal: v }))} /></div></div>
            <div><label htmlFor="inst-desc" style={lbl}>Descrição</label>
              <input id="inst-desc" placeholder="Ex.: iPhone, geladeira" value={instDraft.desc} maxLength={120} onChange={e => onChangeDraft(d => ({ ...d, desc: e.target.value }))} style={SI} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
              <div><label htmlFor="inst-n" style={lbl}>Parcelas</label>
                <input id="inst-n" type="number" inputMode="numeric" min="1" max="360" placeholder="12" value={instDraft.numParcelas} onChange={e => onChangeDraft(d => ({ ...d, numParcelas: e.target.value }))} style={SI} /></div>
              <div><label htmlFor="inst-start" style={lbl}>Primeira parcela</label>
                <input id="inst-start" type="date" value={instDraft.startDate} min={DATE_MIN} max={DATE_MAX} onChange={e => onChangeDraft(d => ({ ...d, startDate: e.target.value }))} style={SI} /></div>
              <div><label htmlFor="inst-form" style={lbl}>Forma</label>
                <select id="inst-form" value={instDraft.form} onChange={e => onChangeDraft(d => ({ ...d, form: e.target.value }))} style={SI}>{[["credito", "Crédito"], ["debito", "Débito"], ["pix", "Pix"], ["dinheiro", "Dinheiro"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </div>
            {monthlyPreview && <p className="num" style={{ margin: 0, fontSize: 13, color: TX2 }}>{instDraft.numParcelas}x de <b style={{ color: TX }}>{fmt(monthlyPreview)}</b> por mês</p>}
            <div>
              <div id="inst-cat-label" style={lbl}>Categoria</div>
              <div role="group" aria-labelledby="inst-cat-label" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {fullCats.filter(c => c !== "Investimento" && c !== "Salario / Entradas").map(c => (
                  <button key={c} type="button" aria-pressed={instDraft.cat === c} onClick={() => onChangeDraft(d => ({ ...d, cat: c }))} className="cat-chip"><i aria-hidden="true" style={{ background: catColor(c) }} />{c}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <BtnGhost onClick={onCancelForm} style={{ flex: 1, fontSize: 14 }}>Cancelar</BtnGhost>
              <Btn onClick={onAdd} aria-disabled={!canAdd} style={{ flex: 2, fontSize: 14, opacity: canAdd ? 1 : 0.6 }}>{monthlyPreview ? `Criar ${instDraft.numParcelas}x de ${fmt(monthlyPreview)}` : "Criar parcelamento"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
