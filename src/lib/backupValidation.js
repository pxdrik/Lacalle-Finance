// backupValidation.js — fronteira de validação do import de backup (BUG-03).
//
// Antes, `importAllBackup` só conferia se o JSON tinha uma das chaves
// esperadas (`tx`/`planned`/`inst`/`wishes`) — os registros DENTRO desses
// arrays nunca passavam pela mesma validação usada pelos formulários. Um
// backup adulterado (ou corrompido por um editor de texto) podia inserir
// `val: "abc"` ou uma data inexistente direto na nuvem.
//
// Fronteira aplicada aqui: arquivo → parse → validação de schema/domínio →
// normalização → só então o chamador decide persistir. Esta função NUNCA
// executa código nem interpreta o conteúdo — só lê campos e compara com os
// mesmos limites de `validation.js`.
//
// Regra crítica: a validação é tudo-ou-nada. Se qualquer registro for
// inválido, `ok` vem `false` e a lista de `errors` explica cada problema —
// o chamador não deve persistir nada parcialmente.
import { validateDate, MAX_TX_VAL, MIN_TX_VAL, MAX_DESC_LEN, MAX_PARCELAS } from "./validation.js";

const TX_TYPES = ["Entrada", "Saída"];
const TX_FIXED = ["Fixa", "Variavel"];
// "Rendimento" é um tipo de investimento que o formulário grava desde sempre
// (INV_TIPOS em LacalleFinance.jsx); ficar fora daqui fazia qualquer backup
// com um rendimento lançado ser recusado inteiro.
const INV_TIPOS = ["Aporte", "Resgate", "Rendimento"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// O app grava o mês de um previsto como `monthKey` ("out/26", ver
// financialEngine.js). A validação exigia "AAAA-MM", um formato que o app
// nunca escreveu, então todo backup com um previsto de mês único era
// recusado ao reimportar. "AAAA-MM" continua aceito por compatibilidade.
const isMonthKey = v => {
  if (typeof v !== "string") return false;
  const m = /^([a-z]{3})\/(\d{2})$/.exec(v);
  if (m) return MONTHS.includes(m[1]);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
};

const isPlainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
const isNonEmptyString = (v, maxLen = Infinity) => typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;

const err = (path, reason) => ({ path, reason });

// Valor JÁ NUMÉRICO (backup grava números prontos, não texto digitado pelo
// usuário) — mesmos limites de `validateAmount`, sem depender de `parseNum`.
function checkAmount(val, path, { allowZero = false, max = MAX_TX_VAL } = {}) {
  if (typeof val !== "number" || !isFinite(val)) return err(path, "precisa ser um número");
  if (val < 0) return err(path, "não pode ser negativo");
  if (!allowZero && val < MIN_TX_VAL) return err(path, `precisa ser de pelo menos R$ ${MIN_TX_VAL.toFixed(2)}`);
  if (val > max) return err(path, "valor absurdamente grande");
  return null;
}

function checkDate(val, path) {
  if (typeof val !== "string") return err(path, "precisa ser uma data em texto (AAAA-MM-DD)");
  const r = validateDate(val, { label: path });
  return r.ok ? null : err(path, r.error);
}

function checkText(val, path, { required = true, maxLen = MAX_DESC_LEN } = {}) {
  if (val === undefined || val === null || val === "") {
    return required ? err(path, "obrigatório") : null;
  }
  if (typeof val !== "string") return err(path, "precisa ser texto");
  if (val.length > maxLen) return err(path, `excede o tamanho máximo (${maxLen})`);
  return null;
}

function checkId(val, path) {
  if (typeof val !== "string" && typeof val !== "number") return err(path, "id ausente ou inválido");
  return null;
}

function checkArray(val, path) {
  if (val === undefined) return null; // campo opcional ausente é aceitável
  if (!Array.isArray(val)) return err(path, "precisa ser uma lista");
  return null;
}

function checkTransaction(t, i) {
  const p = `tx[${i}]`;
  if (!isPlainObject(t)) return [err(p, "registro não é um objeto")];
  const errs = [];
  const idErr = checkId(t.id, `${p}.id`); if (idErr) errs.push(idErr);
  const dateErr = checkDate(t.date, `${p}.date`); if (dateErr) errs.push(dateErr);
  if (!TX_TYPES.includes(t.type)) errs.push(err(`${p}.type`, `precisa ser "Entrada" ou "Saída"`));
  if (t.fixed !== undefined && !TX_FIXED.includes(t.fixed)) errs.push(err(`${p}.fixed`, `precisa ser "Fixa" ou "Variavel"`));
  const descErr = checkText(t.desc, `${p}.desc`, { maxLen: MAX_DESC_LEN }); if (descErr) errs.push(descErr);
  const amtErr = checkAmount(t.val, `${p}.val`); if (amtErr) errs.push(amtErr);
  if (!isNonEmptyString(t.cat, 60)) errs.push(err(`${p}.cat`, "categoria ausente/inválida"));
  if (t.invTipo != null && !INV_TIPOS.includes(t.invTipo)) errs.push(err(`${p}.invTipo`, `precisa ser "Aporte", "Resgate" ou "Rendimento"`));
  return errs;
}

function checkInstallment(inst, i) {
  const p = `inst[${i}]`;
  if (!isPlainObject(inst)) return [err(p, "registro não é um objeto")];
  const errs = [];
  const idErr = checkId(inst.id, `${p}.id`); if (idErr) errs.push(idErr);
  const descErr = checkText(inst.desc, `${p}.desc`); if (descErr) errs.push(descErr);
  const amtErr = checkAmount(inst.totalVal, `${p}.totalVal`); if (amtErr) errs.push(amtErr);
  if (!Number.isInteger(inst.numParcelas) || inst.numParcelas < 1 || inst.numParcelas > MAX_PARCELAS) {
    errs.push(err(`${p}.numParcelas`, `precisa ser um inteiro entre 1 e ${MAX_PARCELAS}`));
  }
  const dateErr = checkDate(inst.startDate, `${p}.startDate`); if (dateErr) errs.push(dateErr);
  if (!isNonEmptyString(inst.cat, 60)) errs.push(err(`${p}.cat`, "categoria ausente/inválida"));
  const txIdsErr = checkArray(inst.txIds, `${p}.txIds`); if (txIdsErr) errs.push(txIdsErr);
  return errs;
}

function checkPlanned(pl, i) {
  const p = `planned[${i}]`;
  if (!isPlainObject(pl)) return [err(p, "registro não é um objeto")];
  const errs = [];
  const idErr = checkId(pl.id, `${p}.id`); if (idErr) errs.push(idErr);
  const descErr = checkText(pl.desc, `${p}.desc`); if (descErr) errs.push(descErr);
  const amtErr = checkAmount(pl.val, `${p}.val`); if (amtErr) errs.push(amtErr);
  if (!isNonEmptyString(pl.cat, 60)) errs.push(err(`${p}.cat`, "categoria ausente/inválida"));
  if (typeof pl.recurring !== "boolean") errs.push(err(`${p}.recurring`, "precisa ser verdadeiro/falso"));
  if (!pl.recurring) {
    if (!isMonthKey(pl.month)) errs.push(err(`${p}.month`, "precisa ser um mês (ex.: out/26)"));
  }
  return errs;
}

function checkWish(w, i) {
  const p = `wishes[${i}]`;
  if (!isPlainObject(w)) return [err(p, "registro não é um objeto")];
  const errs = [];
  const idErr = checkId(w.id, `${p}.id`); if (idErr) errs.push(idErr);
  const nameErr = checkText(w.name, `${p}.name`, { maxLen: 80 }); if (nameErr) errs.push(nameErr);
  const priceErr = checkAmount(w.price, `${p}.price`); if (priceErr) errs.push(priceErr);
  if (w.saved !== undefined) {
    const savedErr = checkAmount(w.saved, `${p}.saved`, { allowZero: true }); if (savedErr) errs.push(savedErr);
  }
  return errs;
}

/**
 * Monta o objeto de backup a partir do estado do app. Mora aqui, ao lado da
 * validação, para o teste de ida e volta usar exatamente o mesmo formato que
 * o botão "Exportar backup" grava.
 */
export function buildBackup({ tx, wishes, inst, planned, customCats, name, accentKey, walletName, trash, onboardingDismissed }, exportedAt = new Date().toISOString()) {
  return { tx, wishes, inst, planned, customCats, name, accentKey, walletName, trash, onboardingDismissed, exportedAt };
}

/**
 * Valida um objeto de backup já parseado (JSON.parse já deve ter rodado
 * antes de chamar isto — erro de parse é tratado separadamente pelo
 * chamador, que já sabia lidar com "arquivo inválido ou corrompido").
 * @returns {{ok:boolean, errors:{path:string,reason:string}[]}}
 */
export function validateBackup(data) {
  if (!isPlainObject(data)) return { ok: false, errors: [err("$", "o arquivo não é um objeto de backup")] };

  const hasAnyKnownSection = ["tx", "planned", "inst", "wishes"].some(k => data[k] !== undefined);
  if (!hasAnyKnownSection) {
    return { ok: false, errors: [err("$", "esse arquivo não parece ser um backup válido do LaCalle Finance")] };
  }

  const errors = [];
  for (const key of ["tx", "planned", "inst", "wishes", "customCats", "trash"]) {
    const arrErr = checkArray(data[key], `$.${key}`);
    if (arrErr) errors.push(arrErr);
  }
  // Se algum campo que deveria ser lista já veio com o tipo errado, não dá
  // pra nem tentar iterar os registros dele — para por aqui e reporta.
  if (errors.length) return { ok: false, errors };

  (data.tx || []).forEach((t, i) => errors.push(...checkTransaction(t, i)));
  (data.inst || []).forEach((inst, i) => errors.push(...checkInstallment(inst, i)));
  (data.planned || []).forEach((pl, i) => errors.push(...checkPlanned(pl, i)));
  (data.wishes || []).forEach((w, i) => errors.push(...checkWish(w, i)));

  if (data.customCats !== undefined) {
    (data.customCats || []).forEach((c, i) => {
      if (typeof c !== "string" || !c.trim()) errors.push(err(`$.customCats[${i}]`, "categoria personalizada inválida"));
    });
  }

  return { ok: errors.length === 0, errors };
}
