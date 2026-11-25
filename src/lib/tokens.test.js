// ============================================================================
// tokens.test.js — contraste dos tokens de cor de theme.js contra o WCAG 2.2,
// e das paletas de "accent" selecionáveis pelo usuário (PALETTES, em
// LacalleFinance.jsx) contra o botão primário que elas pintam.
//
// Espelha src/design-system/tokens.test.ts do LaCalle Life: os números vêm
// dos valores que o app realmente usa (importados de theme.js, não
// reescritos aqui), então uma mudança de token só passa a falhar quando o
// contraste real cai — nunca por um valor duplicado ter ficado pra trás.
//
// Thresholds seguem WCAG 2.2: 4.5:1 para texto (1.4.3), 3:1 para partes não
// textuais de UI e gráficos que carregam significado (1.4.11) — mesmos
// critérios citados nos comentários de theme.js (pág. 48/49 do Brand System).
//
// Como rodar: node --test src/lib/tokens.test.js
// ============================================================================
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DARK, LIGHT, ON_ACCENT, ERROR_BG, SUCCESS_FILL, PALETTES, accentSurface, accentText, contrastRatio } from "./theme.js";

// Os dois temas (palette.js): o escuro de sempre e o claro, desde 24/11/2026.
const THEMES = [["escuro", DARK], ["claro", LIGHT]];
const WHITE = "#FFFFFF";

/** sRGB hex (#RRGGBB) → linear sRGB. */
function hexToLinearSrgb(hex) {
  return [1, 3, 5].map((at) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
}

/** WCAG relative luminance. */
function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(hexA, hexB) {
  const [lighter, darker] = [
    luminance(hexToLinearSrgb(hexA)),
    luminance(hexToLinearSrgb(hexB)),
  ].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

// [foreground, background, mínimo, o que o par é] — os valores vêm de
// palette.js via theme.js; nada é redigitado aqui.
const pairsOf = p => [
  [p.tx, p.bg, 4.5, "texto primário na página"],
  [p.tx, p.card, 4.5, "texto primário num card"],
  [p.tx, p.c2, 4.5, "texto primário numa superfície elevada"],
  [p.tx2, p.bg, 4.5, "texto secundário na página"],
  [p.tx2, p.card, 4.5, "texto secundário num card"],
  [p.tx2, p.c2, 4.5, "texto secundário numa superfície elevada"],
  // BUG-04: TX3 (labels, estados vazios, cabeçalhos de seção) precisa dos
  // mesmos 4,5:1 nas três superfícies onde é usado como texto.
  [p.tx3, p.bg, 4.5, "texto terciário na página"],
  [p.tx3, p.card, 4.5, "texto terciário num card"],
  [p.tx3, p.c2, 4.5, "texto terciário numa superfície elevada"],
  // Dourado de texto: o "Finance" do logotipo e os textos da marca.
  [p.gold, p.bg, 4.5, "dourado de texto na página"],
  [p.gold, p.card, 4.5, "dourado de texto num card"],
  // Estados sólidos: branco não sustenta 4,5:1 sobre o token de ícone (mesma divergência do Life).
  [WHITE, ERROR_BG, 4.5, "rótulo do botão destrutivo"],
  [WHITE, SUCCESS_FILL, 3, "ícone \"concluído\" sobre o preenchimento (gráfico, não texto)"],
  // Sucesso, aviso e erro aparecem como texto (valores, avisos) nos cards e na página.
  [p.success, p.card, 4.5, "texto de sucesso num card"],
  [p.warning, p.card, 4.5, "texto de aviso num card"],
  [p.error, p.card, 4.5, "texto de erro num card"],
  [p.success, p.bg, 3, "ícone/borda de sucesso"],
  [p.warning, p.bg, 3, "ícone/borda de aviso"],
  [p.error, p.bg, 3, "ícone/borda de erro"],
  // Investimento, assinatura e link aparecem como texto e ícone.
  [p.blue, p.card, 3, "ícone de investimento"],
  [p.violet, p.card, 4.5, "valor de assinaturas"],
  [p.link, p.card, 4.5, "link"],
  [p.bd2, p.card, p === LIGHT ? 3 : 1.4, "contorno de campo (no claro, os 3:1 da WCAG 1.4.11, como no Life)"],
  ...p.categories.map(c => [c, p.card, 3, "ponto/barra de categoria"]),
];

for (const [name, p] of THEMES) {
  describe(`theme — contraste dos tokens no ${name}`, () => {
    for (const [fg, bg, minimum, label] of pairsOf(p)) {
      test(`${fg} sobre ${bg} atinge ${minimum}:1 — ${label}`, () => {
        assert.ok(contrast(fg, bg) >= minimum, `${label}: ${fg} sobre ${bg} mede ${contrast(fg, bg).toFixed(2)}:1, abaixo de ${minimum}:1`);
      });
    }
    // A correção de contraste não pode achatar a hierarquia: TX3 continua o mais apagado.
    test("hierarquia de texto preservada: TX > TX2 > TX3 em contraste com o card", () => {
      assert.ok(contrast(p.tx, p.card) > contrast(p.tx2, p.card));
      assert.ok(contrast(p.tx2, p.card) > contrast(p.tx3, p.card));
    });
  });
}

/**
 * PALETTES (theme.js) é a lista de accents que a pessoa escolhe no perfil.
 * Cada uma pinta o botão primário (BG por cima, cf. Btn em ui.jsx) e, desde
 * a troca dos seletores feitos à mão por Segmented, o fundo tingido do item
 * escolhido, com o texto em accentText(accent).
 */
describe("PALETTES — contraste por accent", () => {
  for (const [key, { base }] of Object.entries(PALETTES)) {
    test(`accent "${key}" (${base}): rótulo Ink sobre o accent atinge 4.5:1`, () => {
      assert.ok(contrast(ON_ACCENT, base) >= 4.5, `Ink sobre ${base} mede ${contrast(ON_ACCENT, base).toFixed(2)}:1`);
    });
    for (const [name, p] of THEMES) {
      test(`accent "${key}" no ${name}: texto do item escolhido sobre o fundo tingido atinge 4.5:1`, () => {
        const fg = accentText(base, p), bg = accentSurface(base, p);
        assert.ok(contrast(fg, bg) >= 4.5, `${fg} sobre ${bg} mede ${contrast(fg, bg).toFixed(2)}:1`);
      });
      test(`accent "${key}" no ${name}: texto em accent sobre o card atinge 4.5:1`, () => {
        const fg = accentText(base, p);
        assert.ok(contrast(fg, p.card) >= 4.5, `${fg} sobre ${p.card} mede ${contrast(fg, p.card).toFixed(2)}:1`);
      });
    }
  }
});

for (const [name, p] of THEMES) {
  describe(`seletores e filtros (Segmented) no ${name} — superfícies de estado`, () => {
    const SEG = [
      [p.success, p.successSurface, "Entrada escolhida"],
      [p.error, p.dangerSurface, "Saída escolhida"],
      [p.warning, p.warningSurface, "selo de mudança (Descobertas)"],
      [p.tx, p.muted, "opção neutra escolhida"],
      [p.tx2, p.card, "opção não escolhida"],
    ];
    for (const [fg, bg, label] of SEG) {
      test(`${label}: ${fg} sobre ${bg} atinge 4.5:1`, () => {
        assert.ok(contrast(fg, bg) >= 4.5, `mede ${contrast(fg, bg).toFixed(2)}:1`);
      });
    }
  });
}

test("a fórmula do app (contrastRatio) bate com a do teste", () => {
  assert.equal(contrastRatio(DARK.tx, DARK.bg).toFixed(4), contrast(DARK.tx, DARK.bg).toFixed(4));
});
