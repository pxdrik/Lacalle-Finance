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
import {
  BG, CARD, C2, TX, TX2, TX3,
  GOLD,
  SUCCESS, WARNING, ERROR,
  ERROR_BG, SUCCESS_FILL,
  MUTED, SUCCESS_SURFACE, DANGER_SURFACE, WARNING_SURFACE, PALETTES, accentSurface, accentText, contrastRatio,
} from "./theme.js";

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

// [foreground, background, mínimo, o que o par é] — os valores literais vêm
// direto de theme.js, importados acima; nada é redigitado aqui.
const PAIRS = [
  [TX, BG, 4.5, "texto primário na página"],
  [TX, CARD, 4.5, "texto primário num card"],
  [TX, C2, 4.5, "texto primário numa superfície elevada"],
  [TX2, BG, 4.5, "texto secundário na página"],
  [TX2, CARD, 4.5, "texto secundário num card"],
  [TX2, C2, 4.5, "texto secundário numa superfície elevada"],

  // BUG-04: TX3 (texto terciário — labels, estados vazios, cabeçalhos de
  // seção) precisa dos mesmos 4,5:1 nas três superfícies reais onde é usado
  // como texto — antes tinha alfa e caía pra ~3,68–4,06:1 nelas.
  [TX3, BG, 4.5, "texto terciário na página"],
  [TX3, CARD, 4.5, "texto terciário num card"],
  [TX3, C2, 4.5, "texto terciário numa superfície elevada"],

  // Botão primário: rótulo BG sobre o accent (Btn, em ui.jsx) — o comentário
  // de theme.js já assume esse par ao subir GOLD 500->dark. GOLD2 e HOVER
  // ficam de fora: nenhum dos dois pinta um fundo sólido com BG por cima na
  // base de código hoje (GOLD2 não é usado; HOVER só aparece com alfa baixo
  // por trás de texto TX) — testar esses pares seria inventar um uso que não
  // existe.
  [BG, GOLD, 4.5, "rótulo do botão primário sobre o accent padrão"],

  // Estados sólidos — pág. 27/33, mesma divergência já documentada e testada
  // no LaCalle Life (branco não sustenta 4.5:1 sobre o token de ícone).
  [WHITE, ERROR_BG, 4.5, "rótulo do botão destrutivo"],
  [WHITE, SUCCESS_FILL, 3, "ícone \"concluído\" sobre o preenchimento (gráfico, não texto)"],

  // Ícone/borda de estado direto sobre o fundo — gráfico, limiar 3:1.
  [SUCCESS, BG, 3, "ícone/borda de sucesso"],
  [WARNING, BG, 3, "ícone/borda de aviso"],
  [ERROR, BG, 3, "ícone/borda de erro"],
];

describe("theme.js — contraste dos tokens", () => {
  for (const [fg, bg, minimum, label] of PAIRS) {
    test(`${fg} sobre ${bg} atinge ${minimum}:1 — ${label}`, () => {
      assert.ok(
        contrast(fg, bg) >= minimum,
        `${label}: ${fg} sobre ${bg} mede ${contrast(fg, bg).toFixed(2)}:1, abaixo de ${minimum}:1`,
      );
    });
  }

  // BUG-04: a correção de contraste não pode achatar a hierarquia visual —
  // TX3 precisa continuar sendo o mais apagado dos três, mesmo agora opaco
  // e acima do mínimo de AA.
  test("hierarquia de texto preservada: TX (primário) > TX2 (secundário) > TX3 (terciário) em luminância", () => {
    const lum = hex => luminance(hexToLinearSrgb(hex));
    assert.ok(lum(TX) > lum(TX2), `TX (${lum(TX).toFixed(3)}) deveria ser mais claro que TX2 (${lum(TX2).toFixed(3)})`);
    assert.ok(lum(TX2) > lum(TX3), `TX2 (${lum(TX2).toFixed(3)}) deveria ser mais claro que TX3 (${lum(TX3).toFixed(3)})`);
  });
});

/**
 * PALETTES (theme.js) é a lista de accents que a pessoa escolhe no perfil.
 * Cada uma pinta o botão primário (BG por cima, cf. Btn em ui.jsx) e, desde
 * a troca dos seletores feitos à mão por Segmented, o fundo tingido do item
 * escolhido, com o texto em accentText(accent).
 */
describe("PALETTES — contraste por accent", () => {
  for (const [key, { base }] of Object.entries(PALETTES)) {
    test(`accent "${key}" (${base}): rótulo BG sobre o accent atinge 4.5:1`, () => {
      assert.ok(contrast(BG, base) >= 4.5, `BG sobre ${base} mede ${contrast(BG, base).toFixed(2)}:1`);
    });
    test(`accent "${key}": texto do item escolhido sobre o fundo tingido atinge 4.5:1`, () => {
      const fg = accentText(base), bg = accentSurface(base);
      assert.ok(contrast(fg, bg) >= 4.5, `${fg} sobre ${bg} mede ${contrast(fg, bg).toFixed(2)}:1`);
    });
  }
});

describe("seletores e filtros (Segmented) — superfícies de estado", () => {
  const SEG = [
    [SUCCESS, SUCCESS_SURFACE, "Entrada escolhida"],
    [ERROR, DANGER_SURFACE, "Saída escolhida"],
    [WARNING, WARNING_SURFACE, "selo de mudança (Descobertas)"],
    [TX, MUTED, "opção neutra escolhida"],
    [TX2, CARD, "opção não escolhida"],
  ];
  for (const [fg, bg, label] of SEG) {
    test(`${label}: ${fg} sobre ${bg} atinge 4.5:1`, () => {
      assert.ok(contrast(fg, bg) >= 4.5, `mede ${contrast(fg, bg).toFixed(2)}:1`);
    });
  }
  test("a fórmula do app (contrastRatio) bate com a do teste", () => {
    assert.equal(contrastRatio(TX, BG).toFixed(4), contrast(TX, BG).toFixed(4));
  });
});
