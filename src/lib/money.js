// money.js — leitura de valor em reais digitado ou colado.
//
// Um lugar só para a regra de separadores, usada pelo campo de valor
// (sanitizeMoneyInput, que mantém o rascunho "62," enquanto a pessoa digita)
// e pela conversão para número (parseNum em validation.js).
//
// Antes: o campo tratava todo ponto sozinho como vírgula decimal, então
// colar "1.234" (mil duzentos e trinta e quatro, como o banco mostra) virava
// R$ 1,23; e parseNum lia "1,234.56" como 1,23456.
//
// Regra: um separador só é de milhar quando agrupa os dígitos de 3 em 3
// ("1.234", "1.234.567", "1.234,56", "1,234.56"). Fora disso, o primeiro
// separador é o decimal, que é o que acontece enquanto a pessoa digita: o
// primeiro ponto já vira vírgula ("1." → "1,") e um separador a mais
// depois da vírgula ("1234,5." ou "1234,5,") é ignorado.

const GROUPED = { ".": /^\d{1,3}(\.\d{3})+$/, ",": /^\d{1,3}(,\d{3})+$/ };
const grouped = sep => GROUPED[sep];

/** Separa a parte inteira e a decimal (ou null) de um texto de valor. */
export function splitMoney(raw) {
  const s = String(raw ?? "").replace(/[^\d.,]/g, "");
  const hasComma = s.includes(","), hasDot = s.includes(".");
  let decSep = null;
  if (hasComma && hasDot) {
    const last = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const other = last === "," ? "." : ",";
    decSep = grouped(other).test(s.slice(0, s.lastIndexOf(last))) ? last : other;
  } else if (hasComma) {
    decSep = s.split(",").length > 2 && grouped(",").test(s) ? null : ",";
  } else if (hasDot) {
    decSep = grouped(".").test(s) ? null : ".";
  }
  if (!decSep) return { int: s.replace(/[.,]/g, ""), dec: null };
  const i = s.indexOf(decSep);
  return { int: s.slice(0, i).replace(/[.,]/g, ""), dec: s.slice(i + 1).replace(/[.,]/g, "") };
}

/** Texto do campo de valor: só dígitos e uma vírgula, no máximo 2 casas. Mantém "62," como rascunho. */
export function sanitizeMoneyInput(raw) {
  const { int, dec } = splitMoney(raw);
  return dec === null ? int : `${int},${dec.slice(0, 2)}`;
}

/** Número a partir do texto (sempre positivo; vazio ou inválido vira 0). */
export function moneyTextToNumber(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.abs(raw) : 0;
  const { int, dec } = splitMoney(raw);
  if (!int && !dec) return 0;
  const n = parseFloat(`${int || "0"}.${dec || "0"}`);
  return Number.isFinite(n) ? n : 0;
}
