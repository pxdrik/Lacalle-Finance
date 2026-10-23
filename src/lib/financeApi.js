// financeApi.js — as regras da API do Finance (supabase/functions/api), sem rede.
//
// A API existe para um agente de WhatsApp lançar e consultar gastos sem abrir
// o app. Ela lê e grava o mesmo JSON da tabela user_data, então precisa seguir
// as regras da junção (lib/sync.js) para o app não desfazer o que ela grava:
// - lançamento novo entra com `updatedAt`, e a junção mantém o mais recente;
// - apagar deixa lápide (senão o app, que ainda tem o item, o traria de volta)
//   e põe o item na lixeira do app, de onde dá para restaurar.
//
// O documento gravado é o que veio do banco com a mudança aplicada, sem passar
// por normalizeDoc: registros que o app guarda em quarentena e campos que esta
// API não conhece continuam lá como estavam.
import { normalizeDoc } from "./sync.js";
import { flowOf, FLOW, FinancialEngine } from "./financialEngine.js";
import { CATS, INV_TIPOS, MIN_TX_VAL, MAX_TX_VAL, roundMoney, validateAmount, validateDate, validateText } from "./validation.js";

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Mesmas formas do lançamento rápido (campo "Forma" em LacalleFinance.jsx).
export const FORMS = ["pix", "debito", "credito", "dinheiro", "deposito"];
const DEFAULT_ACCOUNT = "principal";
const MONTH = /^\d{4}-\d{2}$/;

// "alimentacao" acha "Alimentação"; "mercado pago" acha "Mercado Pago".
// Troca explícita em vez de depender de normalize("NFD"), que só separa o
// acento onde o runtime tem os dados Unicode completos.
const ACCENTS = { a: /[à-ä]/g, e: /[è-ë]/g, i: /[ì-ï]/g, o: /[ò-ö]/g, u: /[ù-ü]/g, c: /ç/g };
const fold = s => Object.entries(ACCENTS).reduce((t, [plain, re]) => t.replace(re, plain), String(s ?? "").toLowerCase().replace(/[̀-ͯ]/g, "")).trim();
const accountsOf = doc => (doc.accounts?.length ? doc.accounts : [{ id: DEFAULT_ACCOUNT, name: "Conta principal" }]);
const findAccount = (accounts, raw) => accounts.find(a => fold(a.id) === fold(raw) || fold(a.name) === fold(raw));
const strip = ({ updatedAt: _u, ...t }) => t;

export const todaySP = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

function accountFilter(doc, raw) {
  const accounts = accountsOf(doc);
  const ids = new Set(accounts.map(a => a.id));
  // Mesma regra do app: item de conta que não existe aparece na principal.
  const accountOfTx = t => (ids.has(t.account || DEFAULT_ACCOUNT) ? t.account || DEFAULT_ACCOUNT : DEFAULT_ACCOUNT);
  if (!raw) return { accountOfTx, match: () => true };
  const acc = findAccount(accounts, raw);
  if (!acc) throw new ApiError(400, `Conta "${raw}" não existe. Contas: ${accounts.map(a => a.name).join(", ")}.`);
  return { accountOfTx, match: t => accountOfTx(t) === acc.id };
}

function checkMonth(month) {
  if (month && !MONTH.test(month)) throw new ApiError(400, "Mês no formato AAAA-MM, por exemplo 2026-10.");
}

export function options(raw) {
  const doc = normalizeDoc(raw);
  return { categories: [...CATS, ...doc.customCats], invTipos: INV_TIPOS, forms: FORMS, accounts: accountsOf(doc) };
}

export function listTransactions(raw, { month, account, type, limit } = {}) {
  checkMonth(month);
  if (type && type !== "Entrada" && type !== "Saída") throw new ApiError(400, 'Tipo é "Entrada" ou "Saída".');
  const doc = normalizeDoc(raw);
  const { accountOfTx, match } = accountFilter(doc, account);
  const max = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
  return doc.tx
    .filter(t => match(t) && (!month || t.date.startsWith(month)) && (!type || t.type === type))
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id))
    .slice(0, max)
    .map(t => ({ ...strip(t), account: accountOfTx(t) }));
}

/**
 * Saldo atual de cada conta e totais do mês de uma conta (sem `account`, a
 * principal), com as contas do app: o Início mostra uma conta por vez, e o
 * saldo atual é CashFlowAnalyzer.totals do realizado (data até hoje), em que
 * rendimento não entra. Lançamento com data futura no mês fica em `upcoming`.
 */
export function summary(raw, { month, account } = {}, today = todaySP()) {
  const m = month || today.slice(0, 7);
  checkMonth(m);
  const doc = normalizeDoc(raw);
  const { accountOfTx } = accountFilter(doc, null);
  const acc = account ? findAccount(accountsOf(doc), account) : accountsOf(doc).find(a => a.id === DEFAULT_ACCOUNT) || accountsOf(doc)[0];
  if (!acc) accountFilter(doc, account); // lança o erro com a lista de contas
  const realized = id => doc.tx.filter(t => accountOfTx(t) === id && t.date <= today);
  const balanceOf = id => roundMoney(FinancialEngine.CashFlowAnalyzer.totals(realized(id)).balance);

  const out = { account: { id: acc.id, name: acc.name }, currentBalance: balanceOf(acc.id), month: m, income: 0, expense: 0, balance: 0, invested: 0, upcoming: { income: 0, expense: 0 }, expenseByCategory: {}, accounts: accountsOf(doc).map(a => ({ id: a.id, name: a.name, currentBalance: balanceOf(a.id) })) };
  const inMonth = doc.tx.filter(t => accountOfTx(t) === acc.id && t.date.startsWith(m));
  for (const t of inMonth) {
    const flow = flowOf(t);
    if (t.date > today) {
      if (flow === FLOW.RECEITA) out.upcoming.income += t.val;
      if (flow === FLOW.DESPESA) out.upcoming.expense += t.val;
    } else if (flow === FLOW.RECEITA) out.income += t.val;
    else if (flow === FLOW.DESPESA) {
      out.expense += t.val;
      out.expenseByCategory[t.cat] = (out.expenseByCategory[t.cat] || 0) + t.val;
    }
  }
  // Só investimentos na lista: a saída de totals é aportes menos resgates (rendimento fica de fora).
  out.invested = roundMoney(FinancialEngine.CashFlowAnalyzer.totals(inMonth.filter(t => t.cat === "Investimento" && t.date <= today)).totalOut);
  out.income = roundMoney(out.income);
  out.expense = roundMoney(out.expense);
  out.balance = roundMoney(out.income - out.expense);
  out.upcoming = { income: roundMoney(out.upcoming.income), expense: roundMoney(out.upcoming.expense) };
  for (const k of Object.keys(out.expenseByCategory)) out.expenseByCategory[k] = roundMoney(out.expenseByCategory[k]);
  return out;
}

function parseVal(v) {
  // Número em JSON vale como está: "1.234" em texto é mil e duzentos (money.js), 1.234 em número não.
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < MIN_TX_VAL || v > MAX_TX_VAL) throw new ApiError(400, `Valor entre ${MIN_TX_VAL} e ${MAX_TX_VAL}.`);
    return roundMoney(v);
  }
  const r = validateAmount(v);
  if (!r.ok) throw new ApiError(400, r.error);
  return r.value;
}

const genId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

/** Devolve {doc, tx}: o documento com o lançamento novo, e o lançamento. */
export function createTransaction(raw, body, now = Date.now(), today = todaySP()) {
  if (!body || typeof body !== "object") throw new ApiError(400, "Corpo JSON obrigatório.");
  const doc = normalizeDoc(raw);
  const opts = options(raw);

  const cat = opts.categories.find(c => fold(c) === fold(body.cat));
  if (!cat) throw new ApiError(400, `Categoria "${body.cat ?? ""}" não existe. Categorias: ${opts.categories.join(", ")}.`);

  let type = body.type, invTipo = null;
  if (cat === "Investimento") {
    invTipo = INV_TIPOS.find(t => fold(t) === fold(body.invTipo));
    if (!invTipo) throw new ApiError(400, `Investimento precisa de invTipo: ${INV_TIPOS.join(", ")}.`);
    type = invTipo === "Aporte" ? "Saída" : "Entrada";
  } else if (fold(type) === "entrada") type = "Entrada";
  else if (fold(type) === "saida") type = "Saída";
  else throw new ApiError(400, 'Tipo é "Entrada" ou "Saída".');

  const desc = validateText(body.desc);
  if (!desc.ok) throw new ApiError(400, desc.error);
  const date = validateDate(body.date ?? today);
  if (!date.ok) throw new ApiError(400, date.error);

  const form = body.form === undefined ? "pix" : FORMS.find(f => fold(f) === fold(body.form));
  if (!form) throw new ApiError(400, `Forma é uma destas: ${FORMS.join(", ")}.`);

  // Mesmos valores do campo "Tipo de gasto" do app (o backup recusa outros).
  const fixed = body.fixed === undefined ? "Variavel" : fold(body.fixed).startsWith("fix") ? "Fixa" : fold(body.fixed).startsWith("variav") ? "Variavel" : null;
  if (!fixed) throw new ApiError(400, 'fixed é "Fixa" ou "Variavel".');

  let account = DEFAULT_ACCOUNT;
  if (body.account !== undefined) {
    const acc = findAccount(accountsOf(doc), body.account);
    if (!acc) throw new ApiError(400, `Conta "${body.account}" não existe. Contas: ${accountsOf(doc).map(a => a.name).join(", ")}.`);
    account = acc.id;
  }

  const tx = { id: genId(), date: date.value, type, fixed, cat, desc: desc.value, val: parseVal(body.val), form, invTipo, account, source: "api", updatedAt: now };
  const base = raw && typeof raw === "object" ? raw : {};
  return { doc: { ...base, tx: [...(Array.isArray(base.tx) ? base.tx : []), tx] }, tx: strip(tx) };
}

/** Devolve {doc, tx}: o documento sem o lançamento (com lápide e o item na lixeira), e o lançamento. */
export function deleteTransaction(raw, id, now = Date.now()) {
  const base = raw && typeof raw === "object" ? raw : {};
  const list = Array.isArray(base.tx) ? base.tx : [];
  const item = list.find(t => t && String(t.id) === String(id));
  if (!item) throw new ApiError(404, `Lançamento ${id} não encontrado.`);
  // Parcela mexe no parcelamento (lib/installmentSync.js); isso fica com o app.
  if (item.installmentId) throw new ApiError(409, "Esse lançamento é parcela de um parcelamento. Apague pelo app.");
  const tombstones = base.tombstones && typeof base.tombstones === "object" ? base.tombstones : {};
  // A lápide só apaga o que for mais velho que ela; o relógio de um aparelho adiantado não pode salvar o item.
  const when = Math.max(now, (typeof item.updatedAt === "number" ? item.updatedAt : 0) + 1);
  return {
    doc: {
      ...base,
      tx: list.filter(t => t !== item),
      tombstones: { ...tombstones, tx: { ...(tombstones.tx || {}), [String(item.id)]: when } },
      trash: [{ trashId: genId(), type: "tx", item, deletedAt: now, updatedAt: now }, ...(Array.isArray(base.trash) ? base.trash : [])],
    },
    tx: strip(item),
  };
}
