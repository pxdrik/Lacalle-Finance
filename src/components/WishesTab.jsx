import { useState } from "react";
import { Plus, Check, ArrowRightLeft, Pencil, Trash2, Target, MoreHorizontal, X, Eye, EyeOff } from "lucide-react";
import { Card, Btn, BtnGhost, MoneyInput, ProgressBar, LinkifiedText, toDecimalStr, EmptyState, Segmented, PageHeader, IconButton, Modal, useArmed, MenuRow } from "./ui";
import { TX, TX2, TX3, BD, BD2, R_CHIP, SI, SUCCESS, SUCCESS_FILL, SUCCESS_SURFACE, WARNING, WARNING_SURFACE, ERROR, DANGER_SURFACE, accentText } from "../lib/theme";
import { fmt } from "../lib/financialEngine";

const PRIORITY = { Alta: { color: ERROR, background: DANGER_SURFACE }, Média: { color: WARNING, background: WARNING_SURFACE }, Baixa: { color: SUCCESS, background: SUCCESS_SURFACE } };

// Aba "Metas". Mesma gramática de Previstos: cada meta mostra o progresso e
// só o "...", e as ações (editar, mover para Previstos, notas, excluir em
// dois toques) ficam numa folha. O formulário também abre numa folha.
export default function WishesTab({
  wishes, sortedWishes, wishSortBy, showWishForm, wishForm, editingWish, expandedNotes, accent,
  wishFormSnapshotRef,
  setWishSortBy, setShowWishForm, setEditingWish, setWishForm,
  onSave, onCancelForm, onToggleDone, onTransferToPlanned, onRequestDelete, onToggleNotes,
}) {
  const [menuItem, setMenuItem] = useState(null);
  const del = useArmed();
  const closeMenu = () => { setMenuItem(null); del.disarm(); };
  const act = fn => { const it = menuItem; closeMenu(); fn(it); };
  const openForm = (id, form) => { setEditingWish(id); setWishForm(form); wishFormSnapshotRef.current = JSON.stringify(form); setShowWishForm(true); };
  const openNew = () => openForm(null, { name: "", price: "", saved: "", priority: "Média", monthsTarget: "", notes: "" });
  const startEdit = w => openForm(w.id, { name: w.name, price: toDecimalStr(w.price), saved: toDecimalStr(w.saved), priority: w.priority, monthsTarget: String(w.monthsTarget || ""), notes: w.notes || "" });
  const lbl = { display: "block", fontSize: 12, color: TX2, fontWeight: 500, marginBottom: 6 };
  const doneCount = wishes.filter(w => w.done).length;
  const canSave = wishForm.name && wishForm.price;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader icon={Target} title="Metas"
        subtitle={wishes.length ? `${wishes.length} ${wishes.length === 1 ? "meta" : "metas"}${doneCount ? `, ${doneCount} ${doneCount === 1 ? "concluída" : "concluídas"}` : ""}` : "O que você está juntando dinheiro para ter"}
        actions={<BtnGhost onClick={openNew} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, paddingInline: 14, color: TX }}><Plus size={15} color={accentText(accent)} />Nova meta</BtnGhost>} />

      {wishes.length > 1 && (
        <Segmented ariaLabel="Ordenar metas" size="sm" value={wishSortBy} onChange={setWishSortBy} style={{ width: "fit-content" }}
          options={[{ value: "progress", label: "Progresso", tone: "accent" }, { value: "priority", label: "Prioridade", tone: "accent" }]} />
      )}

      {wishes.length === 0 && (
        <EmptyState icon={Target} title="Nenhuma meta ainda." caption="Uma viagem, um curso, a reserva de emergência: cadastre e acompanhe quanto falta." action={{ label: "Nova meta", icon: Plus, onClick: openNew }} />
      )}

      {sortedWishes.length > 0 && (
        <Card style={{ padding: "4px 8px 4px 16px", boxShadow: "none" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {sortedWishes.map((w, i) => {
              const pct = Math.min(100, Math.round(w.saved / w.price * 100));
              const remaining = Math.max(0, w.price - w.saved);
              const monthly = !w.done && w.monthsTarget > 0 && remaining > 0 ? Math.ceil(remaining / w.monthsTarget) : null;
              const notesKey = `wish-${w.id}`;
              const pr = PRIORITY[w.priority] || PRIORITY.Média;
              return (
                <li key={w.id} style={{ padding: "14px 0", borderTop: i ? `1px solid ${BD}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <button type="button" onClick={() => onToggleDone(w.id)} aria-pressed={!!w.done} aria-label={w.done ? `${w.name}: marcar como não concluída` : `${w.name}: marcar como concluída`} className="touch-44" style={{ marginTop: 1, width: 22, height: 22, borderRadius: R_CHIP, border: w.done ? "none" : `1.5px solid ${BD2}`, background: w.done ? SUCCESS_FILL : "transparent", color: "white", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{w.done && <Check size={13} />}</button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: w.done ? TX2 : TX, minWidth: 0, overflowWrap: "anywhere" }}>{w.name}</span>
                        {w.done
                          ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: R_CHIP, color: SUCCESS, background: SUCCESS_SURFACE }}>Concluída</span>
                          : <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: R_CHIP, ...pr }}>{w.priority}</span>}
                      </div>
                      <div className="num" style={{ fontSize: 12, color: TX2, marginTop: 4 }}>{fmt(w.saved)} de {fmt(w.price)}</div>
                      <ProgressBar pct={pct} color={w.done ? SUCCESS : accent} height={6} style={{ marginTop: 10 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12, color: TX3, marginTop: 6 }}>
                        <span>{pct}%{w.done ? " · concluída" : remaining > 0 ? ` · faltam ${fmt(remaining)}` : ""}</span>
                        {monthly && <span style={{ color: accentText(accent), fontWeight: 600 }}>{fmt(monthly)}/mês por {w.monthsTarget} {w.monthsTarget === 1 ? "mês" : "meses"}</span>}
                      </div>
                      {w.notes && expandedNotes[notesKey] && (
                        <div style={{ marginTop: 10, fontSize: 13, color: TX2, lineHeight: 1.6 }}><LinkifiedText text={w.notes} color={accentText(accent)} /></div>
                      )}
                    </div>
                    <IconButton icon={MoreHorizontal} size={18} label={`Opções de ${w.name}`} onClick={() => setMenuItem(w)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ---- Menu "..." de uma meta ---- */}
      {menuItem && (
        <Modal align="sheet" onClose={closeMenu} maxWidth={560} padding={16} label={`Opções de ${menuItem.name}`}>
          <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 4, background: BD2, margin: "0 auto 14px" }} />
          <h2 style={{ margin: "0 0 2px 12px", fontSize: 16, fontWeight: 600, color: TX }}>{menuItem.name}</h2>
          <p style={{ margin: "0 0 10px 12px", fontSize: 13, color: TX2 }}>{fmt(menuItem.saved)} de {fmt(menuItem.price)}</p>
          <MenuRow icon={Pencil} title="Editar" hint="Nome, valores, prazo e prioridade" onClick={() => act(startEdit)} />
          <MenuRow icon={ArrowRightLeft} title="Mover para Previstos" hint="Vira uma conta prevista num mês" onClick={() => act(onTransferToPlanned)} />
          {menuItem.notes && <MenuRow icon={expandedNotes[`wish-${menuItem.id}`] ? EyeOff : Eye} title={expandedNotes[`wish-${menuItem.id}`] ? "Esconder notas" : "Ver notas"} onClick={() => act(it => onToggleNotes(`wish-${it.id}`))} />}
          <MenuRow icon={Trash2} danger title={del.armed ? "Toque de novo para excluir" : "Excluir"} hint={del.armed ? "Vai para a lixeira, com Desfazer no aviso" : undefined}
            onClick={() => { if (del.armed) act(it => onRequestDelete({ type: "wish", id: it.id, label: it.name })); else del.arm(); }} />
        </Modal>
      )}

      {/* ---- Formulário (nova e editar), numa folha ---- */}
      {showWishForm && (
        <Modal align="sheet" onClose={onCancelForm} maxWidth={560} padding={20} label={editingWish !== null ? "Editar meta" : "Nova meta"}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: TX }}>{editingWish !== null ? "Editar meta" : "Nova meta"}</h2>
            <IconButton icon={X} size={18} label="Fechar" onClick={onCancelForm} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label htmlFor="wish-name" style={lbl}>Nome</label>
              <input id="wish-name" placeholder="Ex.: Viagem para o Chile" value={wishForm.name} maxLength={80} onChange={e => setWishForm(p => ({ ...p, name: e.target.value }))} style={SI} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
              <div><label htmlFor="wish-price" style={lbl}>Quanto custa</label>
                <div className="amt-field amt-sm"><span aria-hidden="true">R$</span><MoneyInput id="wish-price" placeholder="0,00" value={wishForm.price} onChange={v => setWishForm(p => ({ ...p, price: v }))} /></div></div>
              <div><label htmlFor="wish-saved" style={lbl}>Já juntei</label>
                <div className="amt-field amt-sm"><span aria-hidden="true">R$</span><MoneyInput id="wish-saved" placeholder="0,00" value={wishForm.saved} onChange={v => setWishForm(p => ({ ...p, saved: v }))} /></div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
              <div><label htmlFor="wish-months" style={lbl}>Prazo em meses (opcional)</label>
                <input id="wish-months" type="number" inputMode="numeric" min="1" max="600" value={wishForm.monthsTarget} onChange={e => setWishForm(p => ({ ...p, monthsTarget: e.target.value }))} style={SI} /></div>
              <div><div style={lbl}>Prioridade</div>
                <Segmented ariaLabel="Prioridade" size="sm" value={wishForm.priority} onChange={v => setWishForm(p => ({ ...p, priority: v }))}
                  options={["Alta", "Média", "Baixa"].map(v => ({ value: v, label: v, tone: "accent" }))} /></div>
            </div>
            <div><label htmlFor="wish-notes" style={lbl}>Notas (opcional)</label>
              <textarea id="wish-notes" value={wishForm.notes || ""} maxLength={2000} onChange={e => setWishForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Detalhes, links de produtos, planejamento..." style={{ ...SI, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <BtnGhost onClick={onCancelForm} style={{ flex: 1, fontSize: 14 }}>Cancelar</BtnGhost>
              <Btn onClick={onSave} aria-disabled={!canSave} style={{ flex: 2, fontSize: 14, opacity: canSave ? 1 : 0.6 }}>{editingWish !== null ? "Salvar" : "Adicionar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
