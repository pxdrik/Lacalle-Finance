// installmentSync.js — mantém o registro de um parcelamento (`installments`)
// consistente com as transações-parcela que ele realmente tem, quando uma
// parcela é excluída ou restaurada individualmente pela lista de transações
// genérica (BUG-05).
//
// Modelo confirmado pelo comportamento existente do app: uma parcela É uma
// transação normal (aparece na lista, pode ser editada como qualquer outra),
// mas carrega `installmentId` apontando pro pai. O pai guarda `txIds`,
// `numParcelas` e `totalVal` como um retrato de "as parcelas que existem
// agora" — não um total histórico congelado (é assim que ele nasce: os três
// campos são preenchidos juntos, na mesma operação, em createInstallment).
// Excluir/restaurar uma parcela individual, portanto, deve manter esse
// mesmo retrato coerente, em vez de deixar `numParcelas`/`totalVal` se
// referindo a parcelas que não existem mais (ou ainda não voltaram).
import { roundMoney } from "./validation.js";

/**
 * Remove `tx` (uma transação com `installmentId`) do parcelamento pai.
 * Se o parcelamento ficar sem nenhuma parcela, ele é removido da lista —
 * um parcelamento com 0 parcelas não tem mais sentido de existir.
 * Transações sem `installmentId` deixam a lista de parcelamentos intacta.
 */
export function removeTxFromInstallments(installments, tx) {
  if (!tx?.installmentId) return installments;
  return installments
    .map(inst => {
      if (inst.id !== tx.installmentId) return inst;
      const txIds = inst.txIds.filter(id => id !== tx.id);
      return { ...inst, txIds, numParcelas: txIds.length, totalVal: roundMoney(inst.totalVal - tx.val) };
    })
    .filter(inst => inst.txIds.length > 0);
}

/**
 * Inverso de `removeTxFromInstallments` — usado ao restaurar uma parcela da
 * lixeira, pra ela voltar a "contar" no parcelamento pai em vez de virar uma
 * transação órfã com `installmentId` apontando pra um pai que não sabe dela.
 * Não faz nada se o parcelamento pai não existir mais (foi excluído por
 * inteiro nesse meio-tempo) ou se a parcela já constar nele.
 */
export function restoreTxToInstallments(installments, tx) {
  if (!tx?.installmentId) return installments;
  return installments.map(inst => {
    if (inst.id !== tx.installmentId) return inst;
    if (inst.txIds.includes(tx.id)) return inst;
    return { ...inst, txIds: [...inst.txIds, tx.id], numParcelas: inst.numParcelas + 1, totalVal: roundMoney(inst.totalVal + tx.val) };
  });
}
