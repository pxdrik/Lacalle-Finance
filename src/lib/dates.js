// dates.js — como uma data aparece na tela.
//
// A lista de Transações, os próximos eventos e a linha do tempo mostravam a
// data crua ("2026-10-04"), enquanto o painel de projeção mostrava "4 out".
// Uma função só, para todo lugar falar a mesma língua.

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const pad = n => String(n).padStart(2, "0");
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (iso, days) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + days); return toISO(d); };

/**
 * "hoje", "ontem", "amanhã", "sáb, 04/10" (mesmo ano) ou "04/10/2025".
 * Valor ausente ou inválido vira "—", nunca "Invalid Date".
 */
export function formatDay(iso, todayISO) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  if (todayISO) {
    if (iso === todayISO) return "hoje";
    if (iso === shift(todayISO, -1)) return "ontem";
    if (iso === shift(todayISO, 1)) return "amanhã";
  }
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return "—";
  const [y, m, day] = iso.split("-");
  if (todayISO && todayISO.slice(0, 4) === y) return `${WEEK[d.getDay()]}, ${day}/${m}`;
  return `${day}/${m}/${y}`;
}

/** Mesmo texto com a primeira letra maiúscula, para título de grupo. */
export const formatDayTitle = (iso, todayISO) => { const s = formatDay(iso, todayISO); return s.charAt(0).toUpperCase() + s.slice(1); };

/** Hoje no fuso local, no formato das datas do app (AAAA-MM-DD). */
export const todayLocalISO = () => toISO(new Date());

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTH_KEYS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "out/26" vira "outubro de 2026" (chave inválida volta como veio). */
export function formatMonthKey(mk) {
  const [m, y] = String(mk || "").split("/");
  const i = MONTH_KEYS.indexOf(m);
  return i < 0 || !y ? String(mk || "") : `${MONTH_NAMES[i]} de 20${y}`;
}
