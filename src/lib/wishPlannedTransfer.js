// wishPlannedTransfer.js — conversão de payload entre Metas (wishes) e
// Previstos (plannedExpenses) quando um item é transferido de um lado para
// o outro. Extraído de LacalleFinance.jsx (Fase 2) sem mudar nenhuma regra.
//
// Se um item for transferido de um lado para o outro várias vezes (ex.:
// Desejo -> Previsto -> Desejo -> Previsto...), só o bloco da transferência
// MAIS RECENTE é mantido nas notas — sem isso, um item transferido repetidas
// vezes acumularia um histórico infinito de blocos de texto nas notas.
// "Desejos" continua na expressão por compatibilidade: notas gravadas antes da
// padronização do nome da aba (Desejos -> Metas) precisam continuar sendo
// reconhecidas e substituídas, senão o histórico volta a acumular blocos.
import { fmt } from "./financialEngine.js";

const TRANSFER_NOTE_RE = /\n*— Transferido de (?:Desejos|Metas|Previstos) —\n[^\n]*$/;
export const stripTransferNote = notes => (notes || "").replace(TRANSFER_NOTE_RE, "").trim();

export const wishToPlannedPayload = (wish, extra) => {
  const kept = [];
  if (wish.priority) kept.push(`Prioridade original: ${wish.priority}`);
  if (wish.saved) kept.push(`Já guardado: ${fmt(wish.saved)}`);
  if (wish.monthsTarget) kept.push(`Meta original: ${wish.monthsTarget} meses`);
  const notes = [stripTransferNote(wish.notes), kept.length ? `— Transferido de Metas —\n${kept.join(" · ")}` : ""].filter(Boolean).join("\n\n");
  return {
    desc: wish.name,
    val: wish.price,
    cat: extra.cat,
    form: extra.form,
    recurring: extra.recurring,
    month: extra.recurring ? null : extra.month,
    notes,
    paid: {},
  };
};

export const plannedToWishPayload = planned => {
  const kept = [
    `Categoria original: ${planned.cat}`,
    `Forma de pagamento: ${planned.form}`,
    planned.recurring ? "Era um gasto recorrente (assinatura)" : `Mês previsto: ${planned.month || "—"}`,
  ];
  const notes = [stripTransferNote(planned.notes), `— Transferido de Previstos —\n${kept.join(" · ")}`].filter(Boolean).join("\n\n");
  return {
    name: planned.desc,
    price: planned.val,
    saved: 0,
    priority: "Média",
    monthsTarget: 0,
    notes,
    done: false,
  };
};
