import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Repeat, Calendar, Check, Eye, EyeOff, ArrowRightLeft, Pencil, Trash2, MoreHorizontal, Info, CalendarX, X } from "lucide-react";
import { Card, BtnGhost, Btn, MoneyInput, LinkifiedText, EmptyState, Segmented, PageHeader, IconButton, Modal, useArmed, Totals } from "./ui";
import { TX, TX2, TX3, BD, BD2, SI, SUCCESS, SUCCESS_FILL, WARNING, ERROR, R_BTN, R_CHIP, accentText } from "../lib/theme";
import { fmt, monthKey, MONTH_ORDER, monthIndex } from "../lib/financialEngine";
import { formatMonthKey, todayLocalISO } from "../lib/dates";

// Aba "Previstos". Cada linha tem só o quadrado de "pago" e o "...": as outras
// ações (editar, encerrar, ignorar este mês, mover para Metas, notas, excluir)
// ficam numa folha. Antes eram até seis ícones por linha, com as áreas de
// toque de 44px sobrepostas, e um toque em Editar podia cair em Excluir.
export default function PlannedTab({
  plannedMonth, plannedStats, showPlannedForm, editingPlanned, plannedForm, plannedValRef,
  frequentTx, renderFrequentPicks, applyFrequentToPlanned, fullCats, catColor,
  plannedItemsForMonth, sortedPlannedItemsForMonth, expandedNotes, accent,
  setPlannedForm, setEditingPlanned, setShowPlannedForm, plannedFormSnapshotRef,
  onShiftMonth, onGoToday, onSave, onCancelForm, onTogglePaid, onToggleIgnored,
  onTransferToWish, onStartEdit, onRequestDelete, onToggleNotes, onEndAt, endedPlanned = [],
}) {
  const [menuItem, setMenuItem] = useState(null);
  const del = useArmed();
  const months = (from, to) => monthIndex(to) - monthIndex(from) + 1;
  const untilNote = f => {
    if (!f.hasUntil) return "Conta todo mês, até você encerrar.";
    const n = f.from ? months(f.from, f.until) : null;
    return `Conta todo mês até ${f.until}${n ? ` (${n} ${n === 1 ? "mês" : "meses"} a partir de ${f.from})` : ""}. Depois some sozinho, e os meses anteriores ficam como estão.`;
  };
  const openNew = () => {
    const empty = { desc: "", val: "", cat: "Assinaturas", form: "pix", recurring: false, month: plannedMonth, from: plannedMonth, hasUntil: false, until: plannedMonth, notes: "" };
    setEditingPlanned(null); setPlannedForm(empty); plannedFormSnapshotRef.current = JSON.stringify(empty); setShowPlannedForm(true);
  };
  const closeMenu = () => { setMenuItem(null); del.disarm(); };
  const act = fn => { const it = menuItem; closeMenu(); fn(it); };
  const lbl = { display: "block", fontSize: 12, color: TX2, fontWeight: 500, marginBottom: 6 };
  const isCurrent = plannedMonth === monthKey(todayLocalISO());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader icon={Calendar} title="Previstos" subtitle="Contas que se repetem e as de um mês só"
        actions={<BtnGhost onClick={openNew} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, paddingInline: 14, color: TX }}><Plus size={15} color={accentText(accent)} />Novo previsto</BtnGhost>} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 4, border: `1px solid ${BD}`, borderRadius: R_BTN }}>
        <IconButton icon={ChevronLeft} size={16} color={TX2} label="Mês anterior" onClick={() => onShiftMonth(-1)} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <b style={{ fontSize: 14, fontWeight: 600, color: TX }}>{formatMonthKey(plannedMonth)}</b>
          {!isCurrent && <button type="button" onClick={onGoToday} style={{ background: "none", border: "none", color: TX2, fontSize: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>voltar para hoje</button>}
        </div>
        <IconButton icon={ChevronRight} size={16} color={TX2} label="Próximo mês" onClick={() => onShiftMonth(1)} />
      </div>

      <Totals items={[{ l: "No mês", v: plannedStats.total, c: TX }, { l: "Pago", v: plannedStats.paid, c: SUCCESS }, { l: "Falta pagar", v: plannedStats.pending, c: accentText(accent) }]} />

      {plannedItemsForMonth.length === 0 ? (
        <EmptyState icon={Calendar} title={`Nenhum previsto em ${formatMonthKey(plannedMonth)}.`} caption="Contas fixas, assinaturas e compromissos do mês entram aqui." action={{ label: "Novo previsto", icon: Plus, onClick: openNew }} />
      ) : (
        <Card style={{ padding: "4px 8px 4px 12px", boxShadow: "none" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {sortedPlannedItemsForMonth.map((item, i) => {
              const isPaid = !!item.paid?.[plannedMonth];
              const isIgnored = !!item.ignored?.[plannedMonth];
              const notesKey = `planned-${item.id}`;
              return (
                <li key={item.id} style={{ padding: "10px 0", borderTop: i ? `1px solid ${BD}` : "none", opacity: isIgnored ? 0.7 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button type="button" onClick={() => onTogglePaid(item)} aria-pressed={isPaid} aria-label={isPaid ? `${item.desc}: marcar como não pago` : `${item.desc}: marcar como pago`} className="touch-44" style={{ width: 22, height: 22, borderRadius: R_CHIP, border: isPaid ? "none" : `1.5px solid ${BD2}`, background: isPaid ? SUCCESS_FILL : "transparent", color: "white", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{isPaid && <Check size={13} />}</button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: isPaid ? TX2 : TX, textDecoration: isPaid || isIgnored ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</div>
                      <div style={{ fontSize: 12, color: TX3, marginTop: 1, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: catColor(item.cat) }} />{item.cat}</span>
                        {item.recurring && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>· <Repeat size={10} aria-hidden="true" />mensal{item.until ? ` até ${item.until}` : ""}</span>}
                        {isPaid && <span style={{ color: SUCCESS }}>· pago</span>}
                        {isIgnored && <span style={{ color: WARNING }}>· ignorado neste mês</span>}
                      </div>
                    </div>
                    <div className="num" style={{ fontSize: 13.5, fontWeight: 600, color: isPaid ? SUCCESS : TX, flexShrink: 0 }}>{fmt(item.val)}</div>
                    <IconButton icon={MoreHorizontal} size={18} label={`Opções de ${item.desc}`} onClick={() => setMenuItem(item)} />
                  </div>
                  {item.notes && expandedNotes[notesKey] && (
                    <div style={{ margin: "8px 0 2px 34px", fontSize: 13, color: TX2, lineHeight: 1.6 }}><LinkifiedText text={item.notes} color={accentText(accent)} /></div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {endedPlanned.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: TX3, lineHeight: 1.5 }}>
          Encerrado{endedPlanned.length > 1 ? "s" : ""} antes deste mês: {endedPlanned.map(p => `${p.desc} (contou até ${p.until})`).join(", ")}. Para voltar a contar, edite o previsto num mês em que ele aparece.
        </p>
      )}

      {/* ---- Menu "..." de um previsto ---- */}
      {menuItem && (
        <Modal align="sheet" onClose={closeMenu} maxWidth={560} padding={16} label={`Opções de ${menuItem.desc}`}>
          <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 4, background: BD2, margin: "0 auto 14px" }} />
          <h2 style={{ margin: "0 0 2px 12px", fontSize: 16, fontWeight: 600, color: TX }}>{menuItem.desc}</h2>
          <p style={{ margin: "0 0 10px 12px", fontSize: 13, color: TX2 }}>{menuItem.recurring ? (menuItem.until ? `Todo mês até ${formatMonthKey(menuItem.until)}` : "Todo mês, sem data de fim") : `Só em ${formatMonthKey(menuItem.month)}`}</p>
          <MenuRow icon={Pencil} title="Editar" hint="Valor, nome, repetição e o Até" onClick={() => act(onStartEdit)} />
          {menuItem.recurring && !menuItem.until && (
            <MenuRow icon={CalendarX} title={`Encerrar em ${formatMonthKey(plannedMonth)}`} hint="Conta até este mês e some depois; os meses anteriores ficam" onClick={() => act(it => onEndAt(it, plannedMonth))} />
          )}
          {menuItem.recurring && (
            <MenuRow icon={menuItem.ignored?.[plannedMonth] ? Eye : EyeOff} title={menuItem.ignored?.[plannedMonth] ? "Voltar a contar neste mês" : "Ignorar só neste mês"} hint={formatMonthKey(plannedMonth)} onClick={() => act(it => onToggleIgnored(it, plannedMonth))} />
          )}
          <MenuRow icon={ArrowRightLeft} title="Mover para Metas" hint="Vira um objetivo para juntar dinheiro" onClick={() => act(onTransferToWish)} />
          {menuItem.notes && <MenuRow icon={Info} title={expandedNotes[`planned-${menuItem.id}`] ? "Esconder notas" : "Ver notas"} onClick={() => act(it => onToggleNotes(`planned-${it.id}`))} />}
          <MenuRow icon={Trash2} danger title={del.armed ? "Toque de novo para excluir" : menuItem.recurring ? "Excluir de todos os meses" : "Excluir"}
            hint={menuItem.recurring ? (del.armed ? "Apaga também dos meses que já passaram" : "Para parar só daqui para frente, use Encerrar") : undefined}
            onClick={() => { if (del.armed) act(it => onRequestDelete({ type: "planned", id: it.id, label: it.desc })); else del.arm(); }} />
        </Modal>
      )}

      {/* ---- Formulário (novo e editar), numa folha ---- */}
      {showPlannedForm && (
        <Modal align="sheet" onClose={onCancelForm} maxWidth={560} padding={20} label={editingPlanned !== null ? "Editar previsto" : "Novo previsto"}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: TX }}>{editingPlanned !== null ? "Editar previsto" : "Novo previsto"}</h2>
            <IconButton icon={X} size={18} label="Fechar" onClick={onCancelForm} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label htmlFor="planned-val" style={lbl}>Valor</label>
              <div className="amt-field"><span aria-hidden="true">R$</span><MoneyInput id="planned-val" ref={plannedValRef} placeholder="0,00" value={plannedForm.val} onChange={v => setPlannedForm(p => ({ ...p, val: v }))} /></div></div>
            <div><label htmlFor="planned-desc" style={lbl}>Descrição</label>
              <input id="planned-desc" placeholder="Ex.: Smart Fit, aluguel, IPVA" value={plannedForm.desc} maxLength={120} onChange={e => setPlannedForm(p => ({ ...p, desc: e.target.value }))} style={SI} /></div>
            {editingPlanned === null && frequentTx.length > 0 && renderFrequentPicks(applyFrequentToPlanned)}
            <div>
              <div id="planned-cat-label" style={lbl}>Categoria</div>
              <div role="group" aria-labelledby="planned-cat-label" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {fullCats.filter(c => c !== "Investimento" && c !== "Salario / Entradas").map(c => (
                  <button key={c} type="button" aria-pressed={plannedForm.cat === c} onClick={() => setPlannedForm(p => ({ ...p, cat: c }))} className="cat-chip"><i aria-hidden="true" style={{ background: catColor(c) }} />{c}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
              <div><label htmlFor="planned-form" style={lbl}>Forma</label><select id="planned-form" value={plannedForm.form} onChange={e => setPlannedForm(p => ({ ...p, form: e.target.value }))} style={SI}>{[["pix", "Pix"], ["debito", "Débito"], ["credito", "Crédito"], ["dinheiro", "Dinheiro"], ["deposito", "Depósito"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><div style={lbl}>Repetição</div>
                <Segmented ariaLabel="Repetição" size="sm" value={plannedForm.recurring} onChange={v => setPlannedForm(p => ({ ...p, recurring: v }))}
                  options={[{ value: false, label: "Só um mês", tone: "accent" }, { value: true, label: "Todo mês", icon: Repeat, tone: "accent" }]} /></div>
              {!plannedForm.recurring ? (
                <div><label htmlFor="planned-month" style={lbl}>Mês</label><select id="planned-month" value={plannedForm.month} onChange={e => setPlannedForm(p => ({ ...p, month: e.target.value }))} style={SI}>{MONTH_ORDER.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              ) : (
                <div><label htmlFor="planned-from" style={lbl}>Começa em</label><select id="planned-from" value={plannedForm.from || ""} onChange={e => setPlannedForm(p => ({ ...p, from: e.target.value }))} style={SI}>{!plannedForm.from && <option value="">Desde sempre</option>}{MONTH_ORDER.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              )}
            </div>
            {plannedForm.recurring && (
              <div>
                <div style={lbl}>Até quando?</div>
                <Segmented ariaLabel="Até quando" size="sm" value={plannedForm.hasUntil} onChange={v => setPlannedForm(p => ({ ...p, hasUntil: v }))} style={{ maxWidth: 360 }}
                  options={[{ value: false, label: "Sem data de fim", tone: "accent" }, { value: true, label: "Até um mês", tone: "accent" }]} />
                {plannedForm.hasUntil && (
                  <div style={{ marginTop: 10, maxWidth: 220 }}>
                    <label htmlFor="planned-until" style={lbl}>Último mês que conta</label>
                    <select id="planned-until" value={plannedForm.until} onChange={e => setPlannedForm(p => ({ ...p, until: e.target.value }))} style={SI}>
                      {MONTH_ORDER.filter(m => !plannedForm.from || monthIndex(m) >= monthIndex(plannedForm.from)).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ fontSize: 12, color: TX2, marginTop: 8, lineHeight: 1.5 }}>{untilNote(plannedForm)}</div>
              </div>
            )}
            <div><label htmlFor="planned-notes" style={lbl}>Notas (opcional)</label>
              <textarea id="planned-notes" value={plannedForm.notes || ""} maxLength={2000} onChange={e => setPlannedForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Observações, links, planejamento..." style={{ ...SI, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <BtnGhost onClick={onCancelForm} style={{ flex: 1, fontSize: 14 }}>Cancelar</BtnGhost>
              <Btn onClick={onSave} aria-disabled={!plannedForm.desc.trim() || !plannedForm.val} style={{ flex: 2, fontSize: 14, opacity: (!plannedForm.desc.trim() || !plannedForm.val) ? 0.6 : 1 }}>{editingPlanned !== null ? "Salvar" : "Adicionar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MenuRow({ icon: Icon, title, hint, onClick, danger }) {
  return (
    <button type="button" onClick={onClick} className="more-row">
      <Icon size={20} aria-hidden="true" color={danger ? ERROR : TX2} />
      <span style={{ flex: 1 }}>
        <span className="more-t" style={danger ? { color: ERROR } : undefined}>{title}</span>
        {hint && <span className="more-h">{hint}</span>}
      </span>
    </button>
  );
}
