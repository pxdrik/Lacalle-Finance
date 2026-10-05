// Marca do LaCalle Finance: a Proposta 02 (o L construído por planos), em
// Gold, como o Brand System V2 define desde 10/09/2026. Vetor oficial
// fornecido pelo Pedro (logo2_lacalle.svg). O símbolo antigo (LogoSymbol, a
// Proposta 01 traçada do PDF) continua só no LaCalleReveal, que é da
// marca-mãe.
import { GOLD, TX } from "../lib/theme";

const PATH = "M224.69,230.58l-82.1-.09c-3.71,0-9.16-4.57-9.06-8.21l20.37-20.87.3-9.27c-17.91,1.01-39.22,4.83-34.35-6.9l27.53-66.3,26.66-64.19c4.27-10.28,12.71-18.22,24.43-18.28,12.91-.07,24.44-.19,38.77.83l-34.74,82.96c-5.76,13.76-10.76,27.16-17.59,40.38s-18.63,23.58-27.14,37.38c12.59-5.73,23.34-12.99,36.52-12.92l84.73.46c-11.44,14.29-23.33,22.78-34.59,34.53-5.01,5.23-11.83,10.49-19.72,10.48Z";

/** Só o símbolo. Altura em px; a largura segue a proporção do desenho. */
export function FinanceMark({ size = 18, color = GOLD, title }) {
  return (
    <svg viewBox="113 34 168 199" height={size} width={Math.round(size * 168 / 199)} fill={color} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ flexShrink: 0, display: "block" }}>
      <path d={PATH} />
    </svg>
  );
}

/** Símbolo + "LaCalle Finance" (padrão da assinatura do Life: produto na cor da marca). */
export function Signature({ size = 18 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.5), whiteSpace: "nowrap" }}>
      <FinanceMark size={size} />
      <span style={{ fontWeight: 700, fontSize: Math.round(size * 0.89), letterSpacing: "-0.03em", lineHeight: 1, color: TX }}>LaCalle <span style={{ color: GOLD }}>Finance</span></span>
    </span>
  );
}
