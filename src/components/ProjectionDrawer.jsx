// ============================================================================
// ProjectionDrawer.jsx — a versão auditável dos cartões de projeção do
// dashboard ("Quanto você pode gastar" e "Previsto no Fim do Mês").
//
// Por que um componente à parte (e não mais um caso dentro do modal de
// explicação genérico que já existia): esses dois números são compostos por
// uma LISTA de lançamentos reais (parcelas, previstos, contas), não por uma
// frase. A pergunta do usuário não é só "como isso é calculado", é "quais
// itens exatos formam esse total, e o que eu faço se um deles mudar". Isso
// pede uma lista editável, agrupada, não um parágrafo.
//
// Toda a matemática (quais itens entram, quanto cada um vale, o que muda se
// um item sair) vem pronta de FinancialEngine.ProjectionExplainer — este
// arquivo só apresenta e oferece as ações rápidas. Nenhum valor é
// recalculado aqui "no olho".
// ============================================================================
import { useMemo, useState } from "react";
import {
  X, Info, ChevronDown, ChevronRight, Pencil, Trash2, Check, EyeOff, Eye,
  Repeat, ArrowRight, Wallet, Sparkles,
} from "lucide-react";
import { FinancialEngine, fmt } from "../lib/financialEngine";
import { CategoryIcon, LineItemsList } from "./ui";
import { BG, CARD, BD, BD2, TX, TX2, TX3, HOVER, R_CARD, R_BTN, R_INPUT, R_CHIP, SH_LG, NUM_FONT, EASE_OUT } from "../lib/theme";

const MONTH_NAME_SHORT = { jan: "jan", fev: "fev", mar: "mar", abr: "abr", mai: "mai", jun: "jun", jul: "jul", ago: "ago", set: "set", out: "out", nov: "nov", dez: "dez" };

const formatItemDate = (item) => {
  if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
    const [, m, d] = item.date.split("-");
    const idx = parseInt(m, 10) - 1;
    const names = Object.values(MONTH_NAME_SHORT);
    return `${parseInt(d, 10)} ${names[idx] || ""}`;
  }
  return item.month || "";
};

const INCLUDED = [
  "Despesas recorrentes (assinaturas, contas fixas)",
  "Contas e lançamentos previstos ainda pendentes",
  "Parcelas futuras de compras parceladas",
  "Lançamentos já cadastrados com data futura",
];
const NOT_INCLUDED = [
  "Gastos variáveis do dia a dia ainda não lançados",
  "Compras futuras que você ainda não cadastrou",
  "Metas e reservas que não representam saída de dinheiro",
  "Itens marcados como \"ignorar este mês\"",
];

export default function ProjectionDrawer({
  config, onClose, transactions, plannedExpenses, balance, todayISO, currentMonthKey,
  accent, catColor, onTogglePaid, onToggleIgnored, onMakeRecurring,
  onRequestDeletePlanned, onRequestDeleteTx, onEditPlanned, onEditTx, onViewAllPlanned, showToast,
}) {
  const [collapsedCats, setCollapsedCats] = useState({});
  const [showIncome, setShowIncome] = useState(false);

  const mode = config?.key === "saldoPrevisto" ? "endOfMonth" : "window";
  const explain = useMemo(() => {
    if (!config) return null;
    return FinancialEngine.ProjectionExplainer.build({
      transactions, plannedExpenses, balance, todayISO, currentMonthKey,
      daysAhead: config.daysAhead, mode,
    });
  }, [config, transactions, plannedExpenses, balance, todayISO, currentMonthKey, mode]);

  if (!config || !explain) return null;

  const headline = mode === "window" ? Math.max(0, explain.netProjection) : explain.netProjection;
  const headlineColor = explain.netProjection >= 0 ? "#34D399" : "#F87171";
  const horizonLabel = mode === "window"
    ? `Próximos ${config.daysAhead} dias`
    : `Restante de ${currentMonthKey}`;

  const toggleCat = (cat) => setCollapsedCats((p) => ({ ...p, [cat]: !p[cat] }));

  const impactText = (item) => {
    const impact = FinancialEngine.ProjectionExplainer.impactOfRemoving(explain, item);
    const beforeTotal = mode === "window" ? Math.max(0, explain.netProjection) : explain.netProjection;
    const afterTotal = mode === "window" ? Math.max(0, impact.netProjection) : impact.netProjection;
    const noun = mode === "window" ? "Quanto você pode gastar" : "Resultado previsto do mês";
    return `${noun} passa de ${fmt(beforeTotal)} para ${fmt(afterTotal)}.`;
  };

  const handleDeletePlanned = (item) => {
    onRequestDeletePlanned({ id: item.id, desc: item.label }, impactText(item));
  };
  const handleDeleteTx = (item) => {
    const tx = transactions.find((t) => t.id === item.id);
    if (!tx) return;
    onRequestDeleteTx(tx, impactText(item));
  };
  const handleEditTx = (item) => {
    const tx = transactions.find((t) => t.id === item.id);
    if (tx) onEditTx(tx);
  };
  const handleEditPlanned = (item) => {
    const planned = plannedExpenses.find((p) => p.id === item.id);
    if (planned) onEditPlanned(planned);
  };
  const handleToggleIgnored = (item) => {
    const planned = plannedExpenses.find((p) => p.id === item.id);
    if (!planned) return;
    const willIgnore = onToggleIgnored(planned, item.month);
    const impact = FinancialEngine.ProjectionExplainer.impactOfRemoving(explain, item);
    const beforeTotal = mode === "window" ? Math.max(0, explain.netProjection) : explain.netProjection;
    const afterTotal = mode === "window" ? Math.max(0, impact.netProjection) : impact.netProjection;
    const noun = mode === "window" ? "Quanto você pode gastar" : "Resultado previsto do mês";
    if (willIgnore) showToast(`"${item.label}" ignorado em ${item.month}. ${noun}: ${fmt(beforeTotal)} → ${fmt(afterTotal)}.`, "info");
    else showToast(`"${item.label}" reativado em ${item.month}.`, "success");
  };
  const handleTogglePaid = (item) => {
    const planned = plannedExpenses.find((p) => p.id === item.id);
    if (planned) onTogglePaid(planned, item.month);
  };
  const handleMakeRecurring = (item) => {
    const planned = plannedExpenses.find((p) => p.id === item.id);
    if (planned) onMakeRecurring(planned);
  };

  const isItemPaid = (item) => {
    if (item.sourceType !== "planned") return false;
    const planned = plannedExpenses.find((p) => p.id === item.id);
    return !!planned?.paid?.[item.month];
  };
  const isItemIgnored = (item) => {
    if (item.sourceType !== "planned") return false;
    const planned = plannedExpenses.find((p) => p.id === item.id);
    return !!planned?.ignored?.[item.month];
  };

  return (
    <>
      <style>{`
        .proj-drawer-overlay{position:fixed;inset:0;background:rgba(2,7,14,0.72);z-index:190;animation:overlayIn .15s ease-out;}
        .proj-drawer-panel{position:fixed;top:0;right:0;bottom:0;width:min(480px,100vw);background:${CARD};border-left:1px solid ${BD2};box-shadow:${SH_LG};z-index:191;display:flex;flex-direction:column;animation:projDrawerInRight .28s ${EASE_OUT};}
        @keyframes projDrawerInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @media(max-width:760px){
          .proj-drawer-panel{top:auto;right:0;left:0;width:100%;max-height:88vh;border-left:none;border-top:1px solid ${BD2};border-radius:24px 24px 0 0;animation:projDrawerInUp .28s ${EASE_OUT};}
          @keyframes projDrawerInUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        }
        .proj-drawer-body{overflow-y:auto;flex:1;}
        .proj-item-row{display:flex;align-items:center;gap:9px;padding:9px 0;}
        .proj-item-actions button{position:relative;background:none;border:none;color:${TX3};cursor:pointer;padding:5px;border-radius:8px;display:flex;align-items:center;justify-content:center;}
        .proj-item-actions button:hover{background:${HOVER}55;color:${TX};}
        .proj-item-actions button::after{content:"";position:absolute;top:50%;left:50%;translate:-50% -50%;width:max(100%,2.75rem);height:max(100%,2.75rem);}
        .proj-cat-header{display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 0;}
        .proj-drag-handle{display:none;}
        @media(max-width:760px){.proj-drag-handle{display:block;width:36px;height:4px;border-radius:3px;background:${BD2};margin:10px auto 2px;}}
      `}</style>
      <div className="proj-drawer-overlay" onClick={onClose} />
      <div className="proj-drawer-panel" role="dialog" aria-modal="true" aria-label={config.title}>
        <div className="proj-drag-handle" />
        <div style={{ padding: "20px 22px 14px", borderBottom: `1px solid ${BD}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{horizonLabel}</div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: TX }}>{config.title}</div>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="touch-44" style={{ background: "none", border: "none", color: TX3, cursor: "pointer", padding: 4, flexShrink: 0 }}><X size={18} /></button>
          </div>
          <div style={{ marginTop: 14, fontFamily: NUM_FONT, fontSize: 32, fontWeight: 800, color: headlineColor, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmt(headline)}</div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {mode === "window" && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: TX2 }}>
                <span>Saldo atual</span><span style={{ fontFamily: NUM_FONT, color: TX }}>{fmt(explain.balance)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: TX2 }}>
              <span>+ Receitas previstas</span><span style={{ fontFamily: NUM_FONT, color: "#34D399" }}>{fmt(explain.incTotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: TX2 }}>
              <span>− Gastos previstos</span><span style={{ fontFamily: NUM_FONT, color: "#F87171" }}>{fmt(explain.outTotal)}</span>
            </div>
          </div>
          {explain.incomeItems?.length > 0 && (
            <button onClick={() => setShowIncome((p) => !p)} style={{ marginTop: 10, background: "none", border: "none", color: TX3, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
              {showIncome ? "Ocultar" : "Ver"} receitas previstas<ChevronDown size={12} style={{ transform: showIncome ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
          )}
          {showIncome && explain.incomeItems?.length > 0 && (
            <div style={{ marginTop: 8 }}><LineItemsList items={explain.incomeItems} accentColor="#34D399" limit={8} /></div>
          )}
        </div>

        <div className="proj-drawer-body" style={{ padding: "6px 22px 18px" }}>
          {explain.groups.length === 0 && (
            <div style={{ textAlign: "center", color: TX3, padding: "32px 8px", fontSize: 13 }}>Nenhum gasto previsto para este período. 🎉</div>
          )}
          {explain.groups.map((g) => {
            const gColor = catColor(g.cat);
            const collapsed = !!collapsedCats[g.cat];
            return (
              <div key={g.cat} style={{ borderBottom: `1px solid ${BD}` }}>
                <div className="proj-cat-header" onClick={() => toggleCat(g.cat)}>
                  <div style={{ width: 28, height: 28, borderRadius: R_CHIP, background: gColor + "1f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <CategoryIcon cat={g.cat} size={13} color={gColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: TX }}>{g.cat}</div>
                  <div style={{ fontFamily: NUM_FONT, fontSize: 13.5, fontWeight: 700, color: TX }}>{fmt(g.total)}</div>
                  <ChevronRight size={14} color={TX3} style={{ transform: collapsed ? "none" : "rotate(90deg)", transition: "transform .15s", flexShrink: 0 }} />
                </div>
                {!collapsed && (
                  <div style={{ paddingBottom: 8 }}>
                    {g.items.map((item) => {
                      const paid = isItemPaid(item);
                      const ignored = isItemIgnored(item);
                      return (
                        <div key={item.key} className="proj-item-row" style={{ opacity: ignored ? 0.5 : 1 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: gColor, flexShrink: 0, marginLeft: 4 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, color: TX, fontWeight: 600, textDecoration: paid || ignored ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
                            <div style={{ fontSize: 10.5, color: TX3, marginTop: 2, display: "flex", gap: 5, flexWrap: "wrap" }}>
                              <span>{item.originLabel}</span>
                              {formatItemDate(item) && <span>· {formatItemDate(item)}</span>}
                              {ignored && <span style={{ color: "#FBBF24", fontWeight: 600 }}>· ignorado este mês</span>}
                              {paid && <span style={{ color: "#34D399", fontWeight: 600 }}>· pago</span>}
                            </div>
                          </div>
                          <div style={{ fontFamily: NUM_FONT, fontSize: 13, fontWeight: 700, color: TX, flexShrink: 0, whiteSpace: "nowrap" }}>{fmt(item.value)}</div>
                          {item.editable && (
                            <div className="proj-item-actions" style={{ display: "flex", flexShrink: 0 }}>
                              {item.sourceType === "planned" && !item.recurring && (
                                <button title="Transformar em recorrente" onClick={() => handleMakeRecurring(item)}><Repeat size={13} /></button>
                              )}
                              {item.sourceType === "planned" && item.recurring && (
                                <button title={ignored ? "Reativar este mês" : "Ignorar apenas este mês"} onClick={() => handleToggleIgnored(item)}>{ignored ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                              )}
                              {item.sourceType === "planned" && (
                                <button title={paid ? "Desfazer pagamento" : "Marcar como pago"} onClick={() => handleTogglePaid(item)} style={paid ? { color: "#34D399" } : undefined}><Check size={13} /></button>
                              )}
                              <button title="Editar" onClick={() => (item.sourceType === "planned" ? handleEditPlanned(item) : handleEditTx(item))}><Pencil size={13} /></button>
                              <button title="Excluir" onClick={() => (item.sourceType === "planned" ? handleDeletePlanned(item) : handleDeleteTx(item))}><Trash2 size={13} /></button>
                            </div>
                          )}
                          {!item.editable && <Info size={12} color={TX3} title="Estimativa — não é um lançamento real" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: 18, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}`, borderRadius: R_INPUT }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: TX3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Como este valor foi calculado</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
              {INCLUDED.map((t) => (
                <div key={t} style={{ display: "flex", gap: 7, fontSize: 11.5, color: TX2, lineHeight: 1.4 }}><Check size={12} color="#34D399" style={{ flexShrink: 0, marginTop: 2 }} />{t}</div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {NOT_INCLUDED.map((t) => (
                <div key={t} style={{ display: "flex", gap: 7, fontSize: 11.5, color: TX3, lineHeight: 1.4 }}><X size={12} color="#F87171" style={{ flexShrink: 0, marginTop: 2 }} />{t}</div>
              ))}
            </div>
          </div>

          <button onClick={onViewAllPlanned} style={{ marginTop: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: `1px solid ${BD2}`, color: accent, borderRadius: R_BTN, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            Ver todos os previstos<ArrowRight size={13} />
          </button>
        </div>
      </div>
    </>
  );
}
