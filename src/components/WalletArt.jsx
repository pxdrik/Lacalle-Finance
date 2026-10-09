// Desenho da carteira das contas bancárias: um cartão entra pela abertura e,
// na versão grande, uma moeda cai em seguida. A animação toca quando o
// componente monta; para tocar de novo na troca de conta, quem usa muda a
// `key`. As classes wl-* têm as animações no <style> do app (LacalleFinance.jsx).
import { BG, CARD, BD, accentText } from "../lib/theme";

export default function WalletArt({ size = 96, accent, compact = false, animate = true }) {
  const a = animate ? "" : " wl-still";
  return (
    <svg viewBox="0 0 64 56" width={size} height={Math.round(size * 56 / 64)} aria-hidden="true" style={{ flexShrink: 0, display: "block", overflow: "visible" }}>
      {!compact && <ellipse cx="32" cy="53" rx="22" ry="2.5" fill={BG} opacity="0.8" />}
      <g className={`wl-card${a}`}>
        <rect x="15" y="5" width="32" height="21" rx="3" fill={accent} />
        <rect x="15" y="10" width="32" height="4" fill={BG} opacity="0.35" />
      </g>
      {!compact && (
        <g className={`wl-coin${a}`}>
          <circle cx="23" cy="13" r="6" fill={accentText(accent)} stroke={CARD} strokeWidth="1.5" />
          <circle cx="23" cy="13" r="3" fill="none" stroke={BG} strokeWidth="1" opacity="0.4" />
        </g>
      )}
      <g className={`wl-body${a}`}>
        <rect x="6" y="16" width="52" height="34" rx="7" fill={CARD} stroke={accent} strokeWidth={compact ? 3.5 : 2} />
        {!compact && <rect x="10" y="20" width="44" height="26" rx="4" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="2 3" opacity="0.3" />}
        <path d="M58 27H45a6 6 0 0 0 0 12h13z" fill={BD} stroke={accent} strokeWidth={compact ? 3.5 : 2} />
        <circle cx="45.5" cy="33" r={compact ? 2.5 : 2} fill={accent} />
      </g>
    </svg>
  );
}
