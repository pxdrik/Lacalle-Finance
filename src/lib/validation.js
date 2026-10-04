// ============================================================================
// validation.js — regras de entrada compartilhadas por TODOS os formulários.
//
// Antes cada formulário validava (ou deixava de validar) do seu jeito: o
// lançamento rápido checava só "tem descrição e valor?", o parcelamento
// checava número de parcelas, e nenhum deles checava data ou teto de valor.
// O resultado eram lançamentos com ano 0001 e saldos de -R$ 608 bilhões.
//
// Como financialEngine.js, este arquivo é JS puro (sem React), então dá para
// testar isoladamente e reaproveitar em qualquer tela — ou num app nativo.
// ============================================================================
import { moneyTextToNumber } from "./money.js";

// Teto de um lançamento individual. Não existe finança pessoal com uma única
// transação acima disso; acima daqui é quase certamente erro de digitação
// (ex.: esquecer a vírgula em "1500,00" e digitar "150000000").
export const MAX_TX_VAL = 10_000_000;
export const MIN_TX_VAL = 0.01;

export const MAX_DESC_LEN = 120;
export const MAX_NOTES_LEN = 2000;
export const MAX_PARCELAS = 360;

// Janela de datas aceitas: 10 anos para trás, 10 para frente. Cobre lançamento
// retroativo e parcelamento longo, e barra 0001-01-01 / 9999-12-31.
const yearsFromNow = n => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const DATE_MIN = yearsFromNow(-10);
export const DATE_MAX = yearsFromNow(10);

// Converte o texto do campo (pt-BR: "1.234,56") em número. A regra de
// separadores mora em money.js, a mesma do campo de valor: "1.234" é mil
// duzentos e trinta e quatro, "1234.56" do hábito antigo continua aceito.
export const parseNum = s => moneyTextToNumber(s);

// Dinheiro em ponto flutuante acumula erro (0.1+0.2 !== 0.3). Toda gravação de
// valor passa por aqui para ficar com no máximo 2 casas — assim as somas do
// engine não derivam centavos ao longo de centenas de lançamentos.
export const roundMoney = n => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Valida um campo de valor monetário.
 * @returns {{ok:boolean, value:number, error:string|null}}
 */
export const validateAmount = (raw, { label = "valor", required = true, max = MAX_TX_VAL, allowZero = false } = {}) => {
  const text = String(raw ?? "").trim();
  if (!text) {
    return required
      ? { ok: false, value: 0, error: `Informe o ${label}.` }
      : { ok: true, value: 0, error: null };
  }
  const n = parseNum(text);
  if (!isFinite(n)) return { ok: false, value: 0, error: `O ${label} informado não é um número válido.` };
  if (!allowZero && n < MIN_TX_VAL) return { ok: false, value: 0, error: `O ${label} precisa ser de pelo menos R$ 0,01.` };
  if (n > max) {
    return {
      ok: false,
      value: 0,
      error: `O ${label} parece alto demais (máximo R$ ${max.toLocaleString("pt-BR")}). Confira se a vírgula está no lugar certo.`,
    };
  }
  return { ok: true, value: roundMoney(n), error: null };
};

/**
 * Valida uma data ISO (yyyy-mm-dd) dentro da janela aceita.
 * Rejeita datas sintaticamente válidas mas absurdas (0001-01-01) e datas
 * inexistentes (2026-02-30), que o construtor Date "conserta" silenciosamente.
 */
export const validateDate = (raw, { label = "data", min = DATE_MIN, max = DATE_MAX } = {}) => {
  const text = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { ok: false, value: null, error: `Informe uma ${label} válida.` };
  const d = new Date(text + "T12:00:00");
  if (isNaN(d.getTime())) return { ok: false, value: null, error: `Informe uma ${label} válida.` };
  // Round-trip: 2026-02-30 vira 2026-03-02 no Date; se não voltar igual, não existe.
  const roundTrip = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (roundTrip !== text) return { ok: false, value: null, error: `Essa ${label} não existe no calendário.` };
  if (text < min) return { ok: false, value: null, error: `A ${label} não pode ser anterior a ${formatBR(min)}.` };
  if (text > max) return { ok: false, value: null, error: `A ${label} não pode ser posterior a ${formatBR(max)}.` };
  return { ok: true, value: text, error: null };
};

export const formatBR = iso => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return String(iso || "");
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Valida um texto obrigatório com limite de tamanho. */
export const validateText = (raw, { label = "descrição", required = true, maxLen = MAX_DESC_LEN } = {}) => {
  const text = String(raw ?? "").trim();
  if (!text) {
    return required
      ? { ok: false, value: "", error: `Informe a ${label}.` }
      : { ok: true, value: "", error: null };
  }
  if (text.length > maxLen) return { ok: false, value: "", error: `A ${label} pode ter no máximo ${maxLen} caracteres.` };
  return { ok: true, value: text, error: null };
};

/** Valida uma quantidade inteira (parcelas, meses de meta). */
export const validateInt = (raw, { label = "quantidade", required = true, min = 1, max = MAX_PARCELAS } = {}) => {
  const text = String(raw ?? "").trim();
  if (!text) {
    return required
      ? { ok: false, value: 0, error: `Informe ${label}.` }
      : { ok: true, value: 0, error: null };
  }
  const n = parseInt(text, 10);
  if (isNaN(n)) return { ok: false, value: 0, error: `${label} precisa ser um número inteiro.` };
  if (n < min || n > max) return { ok: false, value: 0, error: `${label} precisa estar entre ${min} e ${max}.` };
  return { ok: true, value: n, error: null };
};

/**
 * Roda várias validações e devolve a primeira falha.
 * Uso: const check = runChecks([[validateText, desc, {...}], ...])
 */
export const firstError = results => results.find(r => !r.ok)?.error || null;
