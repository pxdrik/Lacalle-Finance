import {
  CalendarDays, Flag, TrendingUp, Briefcase, Bell, ChevronLeft, ChevronRight,
  Clock, Calendar, Hourglass, ShieldCheck, Target, Rocket, CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import { Card, StatTile, ProgressBar, DecisionRow, MoneyInput, Btn, LedgerRows, LineItemsList, DataUsedChecklist, ChartTooltip, Table, TableRow, Comparison, Segmented } from "./ui";
import { TX, TX2, TX3, BD, CARD, R_CARD, R_INPUT, SI } from "../lib/theme";
import { fmt, FinancialEngine, formatMonths } from "../lib/financialEngine";
import { parseNum } from "../lib/validation";
import { formatDay } from "../lib/dates";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Resumo mensal (aba "Ano") — colunas numéricas sempre à direita (brandbook, seção 43). */
const YEAR_SUMMARY_COLUMNS = [
  { key: "month", label: "Mês" },
  { key: "in", label: "Receita", align: "right", width: 100, numeric: true },
  { key: "out", label: "Despesa", align: "right", width: 100, numeric: true },
  { key: "balance", label: "Saldo", align: "right", width: 110, numeric: true },
  { key: "delta", label: "Var. vs mês anterior", align: "right", width: 170, numeric: true },
];

// Aba "Planejamento" (6 sub-abas: geral/calendário/timeline/metas/decisões/
// ano) — extraída de LacalleFinance.jsx (Fase 2, código-motion puro, sem
// mudança de comportamento). Um único arquivo monolítico, conforme a
// alternativa aceitável do plano (as sub-abas têm dados quase disjuntos
// entre si, mas dividir em 7 arquivos aumentaria o risco de transcrição
// sem reduzir o acoplamento real). Estado e handlers continuam em MainApp.
export default function PlanningTab({
  accent, planTab, setPlanTab,
  // geral
  nextEvents, balance, cashFlowProjections, instStats, pendingParcelasCount, subscriptions,
  committedNextMonth, committedNext3Months, nextMonthKeyReal, reminders, reminderVisual,
  // calendário
  shiftCalMonth, calMonthLabel, calGrid, todayISO, setSelectedCalDay,
  // timeline
  timelineBuckets,
  // metas
  enhancedWishes,
  // decisões
  decisions, askAmount, setAskAmount, askResult, setAskResult, transactions, plannedExpenses, currentMonthKeyReal, decisionColor,
  simType, setSimType, simResult, setSimResult, simGoalId, setSimGoalId, simExtra, setSimExtra,
  simValue, setSimValue, simParcelas, setSimParcelas, simMonths, setSimMonths, simReturn, setSimReturn, runSimulation,
  // ano
  summary, pctChange,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: TX, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 8 }}><CalendarDays size={18} color={accent} />Planejamento</div>
        <div style={{ fontSize: 12.5, color: TX2, marginTop: 4 }}>Veja o futuro do seu dinheiro com base no que você já cadastrou.</div>
      </div>

      <Segmented ariaLabel="Seções do planejamento" scroll value={planTab} onChange={setPlanTab}
        options={[["geral", "Visão Geral"], ["calendario", "Calendário"], ["timeline", "Timeline"], ["metas", "Metas"], ["decisoes", "Decisões"], ["ano", "Visão Anual"]].map(([v, label]) => ({ value: v, label, tone: "accent" }))} />

      {planTab === "geral" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ---- Próximos Eventos: lista, não grid de 5 células ----
               Ajuste de 06/09/2026: 5 células repetindo o mesmo padrão
               rótulo+número, a maioria "Nada agendado" quando vazia. */}
          <Card style={{ padding: 26 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Flag size={16} color={accent} />Próximos Eventos</div>
            {[
              { l: "Próxima conta", ev: nextEvents.proximaConta, c: "#F87171" },
              { l: "Próxima receita", ev: nextEvents.proximaReceita, c: "#34D399" },
              { l: "Próxima parcela", ev: nextEvents.proximaParcela, c: "#FBBF24" },
              { l: "Maior pagamento futuro", ev: nextEvents.maiorPagamento, c: "#F87171" },
              { l: "Maior entrada prevista", ev: nextEvents.maiorEntrada, c: "#34D399" },
            ].map((item, i, arr) => (
              <div key={item.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${BD}` : "none" }}>
                <span style={{ fontSize: 12.5, color: TX2, fontWeight: 600 }}>{item.l}</span>
                {item.ev ? (
                  <span style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TX }}>{item.ev.desc}</span>{" "}
                    <span className="num" style={{ fontSize: 13, color: item.c, fontWeight: 700 }}>{fmt(item.ev.val)}</span>
                    <div style={{ fontSize: 11, color: TX3 }}>{formatDay(item.ev.date, todayISO)}</div>
                  </span>
                ) : <span style={{ fontSize: 12, color: TX3 }}>Nada agendado</span>}
              </div>
            ))}
          </Card>

          {/* ---- Fluxo de Caixa Futuro: lista, não grid de 5 stat-cards ---- */}
          <Card style={{ padding: 26 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={16} color={accent} />Fluxo de Caixa Futuro</div>
            <div style={{ fontSize: 12, color: TX2, marginBottom: 12 }}>Estimativa com base no saldo atual, lançamentos futuros e previstos ainda não pagos.</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${BD}` }}>
              <span style={{ fontSize: 12.5, color: TX2, fontWeight: 600 }}>Saldo atual</span>
              <span className="num" style={{ fontSize: 14, fontWeight: 700, color: balance >= 0 ? "#34D399" : "#F87171" }}>{fmt(balance)}</span>
            </div>
            {cashFlowProjections.map((cp, i) => (
              <div key={cp.days} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < cashFlowProjections.length - 1 ? `1px solid ${BD}` : "none" }}>
                <span style={{ fontSize: 12.5, color: TX2, fontWeight: 600 }}>Em {cp.days} dias</span>
                <span className="num" style={{ fontSize: 14, fontWeight: 700, color: cp.value >= 0 ? "#34D399" : "#F87171" }}>{fmt(cp.value)}</span>
              </div>
            ))}
          </Card>

          <Card style={{ padding: 26 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Briefcase size={16} color={accent} />Compromissos Financeiros</div>
            <div className="bento">
              <StatTile label="Parcelas restantes" value={fmt(instStats.remaining)} color="#FBBF24" caption={`${pendingParcelasCount} parcela(s)`} />
              {subscriptions && <StatTile label="Assinaturas" value={fmt(subscriptions.total)} color="#A78BFA" caption={`${subscriptions.count} ativa(s)`} />}
              <StatTile label="Comprometido no próximo mês" value={fmt(committedNextMonth)} color={accent} caption={nextMonthKeyReal} />
              <StatTile label="Comprometido nos próximos 3 meses" value={fmt(committedNext3Months)} color={accent} />
            </div>
          </Card>

          <Card style={{ padding: 26 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Bell size={16} color={accent} />Lembretes</div>
            {reminders.length === 0 ? (
              <div style={{ fontSize: 13, color: TX3, textAlign: "center", padding: 16 }}>Nenhum lembrete no momento.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reminders.map((r, i) => { const { Ic, c } = reminderVisual(r.type); return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: c + "1f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic size={13} color={c} /></div>
                    <div style={{ fontSize: 13, color: TX, fontWeight: 600 }}>{r.text}</div>
                  </div>
                ); })}
              </div>
            )}
          </Card>
        </div>
      )}

      {planTab === "calendario" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 18 }}>
              <button onClick={() => shiftCalMonth(-1)} className="touch-44" style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 12, width: 30, height: 30, color: TX2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={16} /></button>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: TX, minWidth: 150, textAlign: "center" }}>{calMonthLabel}</div>
              <button onClick={() => shiftCalMonth(1)} className="touch-44" style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 12, width: 30, height: 30, color: TX2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
              {WEEKDAYS_PT.map((w, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, color: TX3, fontWeight: 700, padding: "4px 0" }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {calGrid.map((cell, i) => {
                if (!cell) return <div key={i} />;
                const isToday = cell.dateStr === todayISO;
                const uniqueColors = [...new Set(cell.events.map(e => e.color))].slice(0, 4);
                return (
                  <button key={i} onClick={() => cell.events.length && setSelectedCalDay(cell.dateStr)} style={{ aspectRatio: "1", borderRadius: 12, border: isToday ? `1.5px solid ${accent}` : `1px solid ${BD}`, background: isToday ? `${accent}14` : "rgba(255,255,255,0.02)", cursor: cell.events.length ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 4, gap: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? accent : TX2 }}>{cell.day}</span>
                    {uniqueColors.length > 0 && (
                      <div style={{ display: "flex", gap: 2 }}>
                        {uniqueColors.map((c, j) => <span key={j} style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: TX2, marginBottom: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>Legenda</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[["Receitas", "#34D399"], ["Despesas", "#F87171"], ["Investimentos", "#3B82F6"], ["Parcelas", "#FBBF24"], ["Assinaturas", "#A78BFA"]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: TX2 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />{l}</div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {planTab === "timeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[["hoje", "Hoje", Clock], ["amanha", "Amanhã", Calendar], ["semana", "Esta semana", CalendarDays], ["prox_semana", "Próxima semana", CalendarDays], ["mes", "Este mês", Calendar], ["prox_mes", "Próximo mês", Calendar]].map(([id, label, Ic]) => {
            const items = timelineBuckets[id] || [];
            if (items.length === 0) return null;
            return (
              <Card key={id} style={{ padding: 22 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: TX, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}><Ic size={15} color={accent} />{label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: it.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: TX, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.data.desc}</div>
                        <div style={{ fontSize: 11, color: TX3 }}>{it.label}{it.kind === "tx" ? ` · ${formatDay(it.data.date, todayISO)}` : ` · ${it.month} (sem dia definido)`}</div>
                      </div>
                      <div className="num" style={{ fontSize: 13, fontWeight: 700, color: it.color, flexShrink: 0 }}>{fmt(it.data.val)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
          {Object.values(timelineBuckets).every(a => a.length === 0) && (
            <div style={{ textAlign: "center", color: TX3, padding: 40, fontSize: 13, background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD }}>Nada agendado para os próximos dias.</div>
          )}
        </div>
      )}

      {planTab === "metas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {enhancedWishes.length === 0 && <div style={{ textAlign: "center", color: TX3, padding: 40, fontSize: 13, background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD }}>Nenhuma meta cadastrada ainda. Adicione na aba "Metas".</div>}
          {enhancedWishes.map(w => (
            <Card key={w.id} style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: TX }}>{w.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>{w.pct}%</div>
              </div>
              <ProgressBar pct={w.pct} color={accent} style={{ marginBottom: 16 }} />
              <div className="bento">
                <div className="bento-half"><div style={{ fontSize: 11, color: TX2, marginBottom: 4 }}>Valor atual</div><div className="num" style={{ fontSize: 14, fontWeight: 700, color: TX }}>{fmt(w.saved)}</div></div>
                <div className="bento-half"><div style={{ fontSize: 11, color: TX2, marginBottom: 4 }}>Valor restante</div><div className="num" style={{ fontSize: 14, fontWeight: 700, color: TX }}>{fmt(w.remaining)}</div></div>
                <div className="bento-half"><div style={{ fontSize: 11, color: TX2, marginBottom: 4 }}>Tempo estimado</div><div style={{ fontSize: 14, fontWeight: 700, color: TX }}>{formatMonths(w.estMonths, w.estMonthsExact)}</div></div>
                <div className="bento-half"><div style={{ fontSize: 11, color: TX2, marginBottom: 4 }}>Previsão de conclusão</div><div style={{ fontSize: 14, fontWeight: 700, color: TX }}>{w.etaDate || "—"}</div></div>
                <div className="bento-half"><div style={{ fontSize: 11, color: TX2, marginBottom: 4 }}>Guardar por mês (na sua meta)</div><div className="num" style={{ fontSize: 14, fontWeight: 700, color: TX }}>{w.monthlyByTarget ? fmt(w.monthlyByTarget) : "defina um prazo em meses"}</div></div>
                <div className="bento-half"><div style={{ fontSize: 11, color: TX2, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}><Hourglass size={11} />Aportando 50% a mais</div><div style={{ fontSize: 14, fontWeight: 700, color: "#34D399" }}>{w.timeSaved ? `economiza ~${w.timeSaved} meses` : "—"}</div></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {planTab === "decisoes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card style={{ padding: 26 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={16} color={accent} />Decisões automáticas</div>
            <div style={{ fontSize: 12, color: TX2, marginBottom: 18 }}>Respostas geradas por regras, a partir dos seus dados — sem inteligência artificial. Toque em "Como cheguei a essa conclusão" em cada uma para ver o cálculo completo.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {decisions.map(d => <DecisionRow key={d.key} d={d} />)}
            </div>
          </Card>

          <Card style={{ padding: 26 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Target size={16} color={accent} />Posso gastar isso?</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <MoneyInput placeholder="Quanto você quer gastar (R$)" value={askAmount} onChange={setAskAmount} style={{ ...SI, flex: 1, minWidth: 180 }} />
              <Btn onClick={() => setAskResult(FinancialEngine.DecisionEngine.canSpend({ amount: parseNum(askAmount), transactions, plannedExpenses, balance, todayISO, currentMonthKey: currentMonthKeyReal }))} style={{ padding: "0 20px" }}>Perguntar</Btn>
            </div>
            {askResult && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  {(() => { const Ic = askResult.status === "ok" ? CheckCircle2 : askResult.status === "atencao" || askResult.status === "critico" ? AlertTriangle : Info; return <Ic size={20} color={decisionColor(askResult.status)} aria-hidden="true" />; })()}
                  <div style={{ fontSize: 14, fontWeight: 700, color: decisionColor(askResult.status) }}>{askResult.answer}</div>
                </div>
                {askResult.detail && <div style={{ fontSize: 12.5, color: TX2, marginBottom: 16, lineHeight: 1.55 }}>{askResult.detail}</div>}
                {askResult.breakdown && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}`, borderRadius: R_INPUT, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                    <LedgerRows rows={askResult.breakdown.calcRows} />
                    {askResult.breakdown.commitItems?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: TX3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Compromissos considerados</div>
                        <LineItemsList items={askResult.breakdown.commitItems} accentColor="#F87171" />
                      </div>
                    )}
                    {askResult.breakdown.incomeItems?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: TX3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Receitas futuras consideradas</div>
                        <LineItemsList items={askResult.breakdown.incomeItems} accentColor="#34D399" />
                      </div>
                    )}
                    <DataUsedChecklist tags={askResult.evidence?.dataUsed} />
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card style={{ padding: 26 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><Rocket size={16} color={accent} />Simulação (E se...)</div>
            <div style={{ fontSize: 12, color: TX2, marginBottom: 16 }}>Simulação hipotética com os números que você informar — não é recomendação de investimento nem conselho financeiro.</div>
            <Segmented ariaLabel="Tipo de simulação" size="sm" scroll value={simType} onChange={v => { setSimType(v); setSimResult(null); }} style={{ marginBottom: 16 }}
              options={[["economizar_mais", "Economizar mais"], ["compra_grande", "Comprar parcelado"], ["investir_mensal", "Investir todo mês"]].map(([v, label]) => ({ value: v, label, tone: "accent" }))} />
            {simType === "economizar_mais" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                <select value={simGoalId} onChange={e => setSimGoalId(e.target.value)} style={SI}>
                  <option value="">Selecione uma meta</option>
                  {enhancedWishes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <MoneyInput placeholder="Quanto a mais guardar por mês (R$)" value={simExtra} onChange={setSimExtra} style={SI} />
              </div>
            )}
            {simType === "compra_grande" && (
              <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <MoneyInput placeholder="Valor total (R$)" value={simValue} onChange={setSimValue} style={{ ...SI, flex: 1, minWidth: 140 }} />
                <input type="number" placeholder="Em quantas parcelas" value={simParcelas} onChange={e => setSimParcelas(e.target.value)} style={{ ...SI, flex: 1, minWidth: 140 }} />
              </div>
            )}
            {simType === "investir_mensal" && (
              <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <MoneyInput placeholder="Valor por mês (R$)" value={simValue} onChange={setSimValue} style={{ ...SI, flex: 1, minWidth: 120 }} />
                <input type="number" placeholder="Por quantos meses" value={simMonths} onChange={e => setSimMonths(e.target.value)} style={{ ...SI, flex: 1, minWidth: 120 }} />
                <MoneyInput placeholder="Retorno anual estimado (%)" value={simReturn} onChange={setSimReturn} style={{ ...SI, flex: 1, minWidth: 120 }} />
              </div>
            )}
            <Btn onClick={runSimulation} style={{ paddingInline: 20, fontSize: 13 }}>Simular</Btn>
            {simResult && (
              <div style={{ marginTop: 18, background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}`, borderRadius: R_INPUT, padding: 18 }}>
                {simResult.type === "economizar_mais" && (simResult.data ? (
                  <div style={{ fontSize: 13, color: TX }}>No novo ritmo, a meta ficaria pronta em <strong>{simResult.data.newMonths} meses</strong>{simResult.data.monthsSaved ? ` — cerca de ${simResult.data.monthsSaved} meses mais rápido que o ritmo atual.` : "."}</div>
                ) : <div style={{ fontSize: 13, color: TX3 }}>Selecione uma meta com valor restante para simular.</div>)}
                {simResult.type === "compra_grande" && (
                  <div style={{ fontSize: 13, color: TX }}>Isso adicionaria <strong>{fmt(simResult.data.monthlyImpact)}/mês</strong> aos seus compromissos. Seu comprometimento do próximo mês passaria de {fmt(committedNextMonth)} para <strong>{fmt(simResult.data.newCommittedNextMonth)}</strong>.</div>
                )}
                {simResult.type === "investir_mensal" && (
                  <div style={{ fontSize: 13, color: TX }}>Aportando {fmt(parseNum(simValue))}/mês por {simMonths} meses, a um retorno estimado de {simReturn}% ao ano: total aportado <strong>{fmt(simResult.data.aportado)}</strong>, rendimento estimado <strong>{fmt(simResult.data.rendimentoEstimado)}</strong>, total estimado <strong>{fmt(simResult.data.totalEstimado)}</strong>.</div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {planTab === "ano" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {summary.length === 0 ? (
            <div style={{ textAlign: "center", color: TX3, padding: 40, fontSize: 13, background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD }}>Ainda não há dados suficientes.</div>
          ) : (
            <>
              <Card className="chart-card" style={{ height: 340 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 16 }}>Comparativo mensal</div>
                <div className="chart-fill">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary}>
                      <CartesianGrid strokeDasharray="3 6" stroke={BD} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: TX2, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: TX2, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 12, color: TX2 }} />
                      <Bar dataKey="in" name="Receita" fill="#34D399" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="out" name="Despesa" fill="#F87171" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="balance" name="Saldo" fill={accent} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Table columns={YEAR_SUMMARY_COLUMNS} minWidth={560}>
                {summary.map((m, i) => {
                  const prev = summary[i - 1];
                  const delta = prev ? pctChange(m.balance, prev.balance) : null;
                  return (
                    <TableRow
                      key={m.month}
                      columns={YEAR_SUMMARY_COLUMNS}
                      cells={[
                        { value: m.month, style: { color: TX, fontWeight: 600 } },
                        { value: fmt(m.in), style: { color: "#34D399", fontWeight: 600 } },
                        { value: fmt(m.out), style: { color: "#F87171", fontWeight: 600 } },
                        { value: fmt(m.balance), style: { color: m.balance >= 0 ? "#34D399" : "#F87171", fontWeight: 700 } },
                        {
                          value: delta === null ? (
                            <span title="Sem base de comparação no mês anterior" style={{ color: TX3 }}>—</span>
                          ) : (
                            <span title={`Saldo ${delta >= 0 ? "melhorou" : "piorou"} ${fmt(Math.abs(m.balance - prev.balance))} em relação a ${prev.month}`}>
                              <Comparison
                                delta={delta}
                                formatMagnitude={magnitude => `${magnitude}%`}
                                label="vs. mês anterior"
                                tone={delta >= 0 ? "positive" : "negative"}
                              />
                            </span>
                          ),
                        },
                      ]}
                    />
                  );
                })}
              </Table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
