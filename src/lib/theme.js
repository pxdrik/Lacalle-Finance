// ============================================================================
// theme.js — tokens visuais compartilhados (cores, raios, sombras) e o
// Context da cor de destaque ("accent", escolhida pela pessoa no perfil).
//
// Valores alinhados ao LaCalle Brand System V1.1 — seções "Dark mode" (pág.
// 33), "Design tokens" (pág. 49) e "Tokens de cor das submarcas" (pág. 19).
// Desde 24/11/2026 o app segue o tema do sistema: os valores de cada tema
// estão em palette.js (o escuro de sempre e o claro do LaCalle Life), e os
// tokens abaixo são os do tema escolhido ao abrir o app.
//
// Por que um Context pra "accent": os componentes Btn/BtnGhost (ver ui.jsx)
// precisam saber a cor de destaque atual, mas ela é um dado do usuário
// (guardado no Supabase), não uma constante fixa. Em vez de passar `accent`
// como prop em toda transação/uso de <Btn> espalhado pelo app (são dezenas
// de lugares), o componente principal expõe o valor atual via
// AccentContext.Provider uma única vez, e qualquer componente em qualquer
// nível consegue ler com useAccent() sem precisar receber isso por prop.
// ============================================================================
import { createContext, useContext } from "react";
import { P, DARK, LIGHT } from "./palette.js";

// ---- Dark mode — pág. 33 ---------------------------------------------------
// (valores do escuro nos comentários; os do claro, em palette.js)
export const BG = P.bg;     // Background · #0B0D0F
export const CARD = P.card; // Surface · #16191D
export const C2 = P.c2;     // Surface elevated · #1D2126
export const BD = P.bd;     // Border · #262B31
export const BD2 = P.bd2;   // Border em destaque (hover, foco, divisores fortes) · #31363D
export const TX = P.tx;     // Text primary · #F3F4F6
export const TX2 = P.tx2;   // Text secondary · #9AA3AE
// Text terciário. Era `rgba(154,163,174,0.68)` (TX2 com alfa 0.68) — a
// diluição derrubava o contraste real para ~3.68–4.06:1 contra CARD/C2/BG,
// abaixo do mínimo de 4.5:1 pra texto normal (WCAG 1.4.3), mesmo aparecendo
// como label/estado-vazio em dezenas de telas. `#848C96` é um cinza OPACO
// (sem alfa) calibrado pra ficar visivelmente mais apagado que TX2 — mantém
// a hierarquia TX > TX2 > TX3 — e ainda assim medir acima de 4.5:1 nas três
// superfícies reais onde aparece (ver tokens.test.js).
export const TX3 = P.tx3;
export const HDR = P.bg;  // Header/sidebar usam o Background, separados por borda de 1px

// LaCalle Finance accent — Brand System V2 (10/09/2026) fixa a identidade de
// cor do Finance em Gold, a mesma calibrada pra nunca colidir com WARNING
// (mesma família âmbar/marrom, Gold mais claro/saturado). Substitui o antigo
// TEAL/TEAL2 (na verdade azul, nunca teal — nome já era enganoso antes do
// V2). GOLD é o accent ativo em tela; GOLD2 é o 500 "de catálogo" (claro),
// usado onde o tom mais denso funciona melhor (gradientes, texto sobre claro).
export const GOLD = P.gold;  // Finance accent para texto e marca: #D4A017 no escuro, #846009 no claro (palette.js)
export const GOLD2 = "#A87A0E"; // Finance accent · 500 (oficial/catálogo, claro)
export const HOVER = "#8A640C"; // Finance accent · hover/pressed, mais escuro

// ---- Radius — pág. 23 (8 / 12 / 16 / 20 / 24, nunca valores intermediários)
export const R_CARD = 16;  // Card padrão
export const R_BTN = 12;   // Botões, inputs, selects
export const R_INPUT = 12;
export const R_CHIP = 8;   // Checkbox, tags, chips, badges
export const R_MODAL = 20; // Containers maiores, modais, painéis agrupadores

// ---- Altura de controle — token novo, 10/09/2026 (brandbook, seção 43).
// Levantamento real: todo <Btn>/<BtnGhost> do app usava um padding vertical
// digitado à mão a cada chamada (10, 11, 12 ou 13px, quatro valores pra uma
// intenção só). BTN_PAD_Y consolida no valor real mais comum do levantamento
// — não é uma escolha nova, é parar de redigitar a mesma decisão sem
// precisão. Pré-requisito documentado para o sistema de densidade (que o
// Life já tem via `--control-h`; o Finance não tinha o token central que um
// toggle de densidade precisaria mudar).
export const BTN_PAD_Y = 12;

// ---- Sombra — pág. 24/49: elevação em dark mode vem da superfície, não da
// sombra. Os valores oficiais (rgba(17,17,17,.04) / .10) são calibrados para
// fundo claro; abaixo, a mesma proporção adaptada a um fundo quase-preto.
export const [SH_SM, SH_MD, SH_LG] = P.shadow;

/** Véu de hover ou de campo: branco sobre o escuro, Ink sobre o claro. */
export const tint = alpha => `rgba(${P.tint},${alpha})`;

export const SI = { background: tint(0.03), border: `1px solid ${BD2}`, borderRadius: R_INPUT, padding: "12px 15px", color: TX, fontSize: 13.5, width: "100%", boxSizing: "border-box" };
export const cardStyle = { background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD, padding: 20, boxShadow: SH_SM };

export const AccentContext = createContext(GOLD);
export const useAccent = () => useContext(AccentContext);

// IBM Plex Sans é a tipografia institucional da LaCalle — Brand System V2,
// 10/09/2026 (substitui a Inter em todo o app, ver import em main.jsx).
// Números são a exceção documentada: a marca reserva IBM Plex Mono pra dado
// numérico que precisa alinhar (saldo, valores de transação, tudo que já
// levava font-variant-numeric:tabular-nums). A família não tem peso 800 —
// os poucos lugares que pedem fontWeight:800 (saldo em destaque) caem pro
// 700 mais próximo, degradação aceitável e não um "fonte não encontrada".
export const NUM_FONT = "'IBM Plex Mono',ui-monospace,'SF Mono',monospace";

// ---- Motion — pág. 38: os quatro tiers de duração e as duas curvas oficiais.
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)"; // LaCalle Ease Out — entrada
export const EASE_IN = "cubic-bezier(0.64, 0, 0.78, 0)";  // LaCalle Ease In — saída
export const DUR_MICRO = 150;
export const DUR_STANDARD = 250;
export const DUR_SIGNATURE = 450;
export const DUR_HERO = 800;
// Tiers ratificados no Motion System v1 (Life+Finance, 17-18/09/2026):
export const DUR_DATA = 550; // contagem numérica — substitui os 520/650 soltos do useCountUp
export const DUR_PAGE = 900; // entrada de página/aba, sempre com EASE_BOUNCE abaixo
export const EASE_BOUNCE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // exceção pontual à regra "sem física de mola" — só na entrada de página/aba, nunca em outro `animate-*`
export const PRESS_SCALE = 0.95; // encolher no toque, universal — unifica os 0.97 (app) e 0.98 (login) que discordavam entre si

// ---- Cores semânticas de UI e de dado — pág. 27, ajustadas um passo para
// dark mode (pág. 33). Data colors (positive/negative/neutral/comparison)
// seguem o mesmo princípio de subir luminosidade sobre fundo escuro.
export const SUCCESS = P.success;
export const WARNING = P.warning;
export const ERROR = P.error;
// Azul de investimento, roxo de assinatura e cor de link: no claro, um tom escuro que passa de 4,5:1.
export const BLUE = P.blue;
export const VIOLET = P.violet;
export const LINK = P.link;
// Rótulo sobre o accent (botão primário): Ink nos dois temas. No escuro era
// o próprio BG; no claro o BG é claro e sumiria sobre o accent.
export const ON_ACCENT = "#0B0D0F";
export const INFO = TX2;
// Fundos sólidos que carregam texto/ícone branco por cima precisam de um tom
// mais escuro do que o token de texto/ícone acima (que já foi clareado um
// passo para dark mode e não sustenta branco a 4,5:1 — mesma divergência
// documentada e testada no LaCalle Life, pág. 25/48 do Brand System).
export const ERROR_BG = "#DC2626";   // botão destrutivo — branco mede ~4,83:1
export const SUCCESS_FILL = "#059669"; // indicador "concluído" — ícone branco mede ~3,77:1
export const DATA_POSITIVE = P.success;
export const DATA_NEGATIVE = P.error;
export const DATA_NEUTRAL = TX2;
export const DATA_COMPARISON = BD2;

// ---- Superfícies de estado (padrão do LaCalle Life) ------------------------
// Seletor e filtro escolhidos não pintam a cor cheia com texto branco por
// cima (branco sobre verde, vermelho ou Gold claros media de 1,67:1 a
// 2,77:1). Pintam um fundo escuro do mesmo tom, com o texto na cor cheia.
export const MUTED = P.muted;                    // neutro escolhido / hover
export const SUCCESS_SURFACE = P.successSurface; // verde sobre isto: 7,02:1 no escuro
export const DANGER_SURFACE = P.dangerSurface;   // vermelho sobre isto: 5,22:1 no escuro
export const WARNING_SURFACE = P.warningSurface; // amarelo sobre isto

// ---- Contraste e mistura de cor ------------------------------------------
// Fórmula WCAG de verdade (luminância relativa), usada aqui para derivar o
// tom de texto de cada accent e nos testes para conferir todos os pares.
function hexToLinear(hex) {
  return [1, 3, 5].map(at => {
    const v = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
}
export function contrastRatio(a, b) {
  const lum = h => { const [r, g, bl] = hexToLinear(h); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** `fg` misturada sobre `bg` na proporção `t` (0 a 1), em #RRGGBB. */
export function mixHex(fg, bg, t) {
  return "#" + [1, 3, 5].map(at => {
    const v = Math.round(Number.parseInt(fg.slice(at, at + 2), 16) * t + Number.parseInt(bg.slice(at, at + 2), 16) * (1 - t));
    return v.toString(16).padStart(2, "0");
  }).join("").toUpperCase();
}

// ---- Accent escolhido pela pessoa ------------------------------------------
// As sete opções do perfil. Gold é a identidade do Finance e o padrão de
// conta nova (Brand System V2); as outras seis são personalização.
export const PALETTES = {
  gold: { name: "Gold", base: "#D4A017", dark: "#8A640C" },
  blue: { name: "Azul", base: "#3B82F6", dark: "#2563EB" },
  teal: { name: "Teal", base: "#2DD4BF", dark: "#14B8A6" },
  purple: { name: "Roxo", base: "#8B5CF6", dark: "#7C3AED" },
  pink: { name: "Rosa", base: "#EC4899", dark: "#DB2777" },
  orange: { name: "Laranja", base: "#FBBF24", dark: "#FBBF24" },
  green: { name: "Verde", base: "#34D399", dark: "#16A34A" },
};

/** Fundo tingido do accent: 14% sobre o card, mesma conta do accent-surface do Life. */
export const accentSurface = (accent, p = P) => mixHex(accent, p.card, 0.14);

/**
 * Tom do accent para TEXTO sobre o fundo tingido. Azul, roxo e rosa na cor
 * cheia ficam abaixo de 4,5:1 ali (4,04, 3,61 e 4,28); então o tom clareia
 * em direção ao branco até passar de 4,75:1. Mesmo princípio do accent-700
 * do Life no escuro. Accents que já passam ficam como são.
 */
export function accentText(accent, p = P) {
  const surface = accentSurface(accent, p);
  // no escuro o tom clareia em direção ao branco; no claro, escurece em direção ao Ink
  const toward = p === LIGHT ? "#000000" : "#FFFFFF";
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mixHex(toward, accent, t);
    if (contrastRatio(c, surface) >= 4.75) return c;
  }
  return p.tx;
}

export { P, DARK, LIGHT };
