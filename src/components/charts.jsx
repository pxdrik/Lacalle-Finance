// Gráficos em SVG feitos à mão, como no LaCalle Life (trend-chart.tsx,
// volume-chart.tsx), no lugar do recharts.
//
// Por quê: o recharts pesava no pacote (o app inteiro era um arquivo de 1 MB)
// e o gráfico usava degradê nas barras, que o brandbook reserva para
// superfície, nunca para dado. Aqui: barras sólidas, o mês atual em destaque
// com o valor escrito, uma linha de resumo sempre visível (tooltip não abre no
// celular) e uma tabela escondida para leitor de tela.
import { useLayoutEffect, useRef, useState } from "react";
import { BD, TX, TX2, TX3, SUCCESS, ERROR, NUM_FONT } from "../lib/theme";
import { fmt } from "../lib/financialEngine";

const VISUALLY_HIDDEN = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 };

/** Largura real do contêiner, para desenhar o SVG em escala 1:1 (texto não estica). */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const short = v => {
  const a = Math.abs(v);
  if (a >= 1000) return `${(v / 1000).toFixed(a >= 10000 ? 0 : 1).replace(".", ",")}k`;
  return String(Math.round(v));
};

/** Escala "redonda" para o eixo: 3 marcas, a de cima é a primeira acima do maior valor. */
function niceMax(v) {
  if (v <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

/**
 * Receitas e gastos por mês. `data`: [{month:"out/26", in, out}], do mais
 * antigo para o mais recente; o último é o mês atual (até hoje).
 */
export function IncomeExpenseChart({ data, height = 180 }) {
  const [ref, W] = useWidth();
  const H = height, L = 34, B = 22, T = 18;
  const max = niceMax(Math.max(0, ...data.flatMap(d => [d.in, d.out])));
  const y = v => T + (H - T - B) * (1 - v / max);
  const step = W > L ? (W - L) / Math.max(1, data.length) : 0;
  const bw = Math.max(4, Math.min(W > 500 ? 22 : 14, step * 0.26));
  const last = data[data.length - 1];
  return (
    <div>
      <div ref={ref} style={{ width: "100%" }}>
        {W > 0 && (
          <svg width={W} height={H} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
            {[0, max / 2, max].map(v => (
              <g key={v}>
                <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke={BD} />
                <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill={TX3} fontFamily={NUM_FONT}>{short(v)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = L + step * i + step / 2, isLast = i === data.length - 1, op = isLast ? 1 : 0.45;
              return (
                <g key={d.month}>
                  <rect x={cx - bw - 1} y={y(d.in)} width={bw} height={Math.max(0, y(0) - y(d.in))} rx={3} fill={SUCCESS} opacity={op} />
                  <rect x={cx + 1} y={y(d.out)} width={bw} height={Math.max(0, y(0) - y(d.out))} rx={3} fill={ERROR} opacity={op} />
                  <text x={cx} y={H - 6} textAnchor="middle" fontSize="10.5" fill={isLast ? TX : TX3} fontWeight={isLast ? 600 : 400}>{d.month.split("/")[0]}</text>
                  {isLast && d.in > 0 && <text x={cx - 1 - bw / 2} y={y(d.in) - 5} textAnchor="end" fontSize="9.5" fill={SUCCESS} fontFamily={NUM_FONT}>{short(d.in)}</text>}
                  {isLast && d.out > 0 && <text x={cx + 1 + bw / 2} y={y(d.out) - 5} textAnchor="start" fontSize="9.5" fill={ERROR} fontFamily={NUM_FONT}>{short(d.out)}</text>}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", fontSize: 12, color: TX2, marginTop: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: SUCCESS }} />Receitas</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: ERROR }} />Gastos</span>
        {last && <span style={{ marginLeft: "auto", color: TX3 }}>{last.month}: entrou <b style={{ color: TX, fontFamily: NUM_FONT, fontWeight: 600 }}>{fmt(last.in)}</b>, saiu <b style={{ color: TX, fontFamily: NUM_FONT, fontWeight: 600 }}>{fmt(last.out)}</b></span>}
      </div>
      <table style={VISUALLY_HIDDEN}>
        <caption>Receitas e gastos por mês</caption>
        <thead><tr><th>Mês</th><th>Receitas</th><th>Gastos</th></tr></thead>
        <tbody>{data.map(d => <tr key={d.month}><td>{d.month}</td><td>{fmt(d.in)}</td><td>{fmt(d.out)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
