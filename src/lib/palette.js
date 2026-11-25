// palette.js: as cores do Finance nos dois temas, sem React.
//
// O app era só escuro; desde 24/11/2026 segue o tema do sistema. A paleta
// clara é a do LaCalle Life no claro (src/design-system/tokens.css de lá),
// para as duas apps falarem a mesma língua: canvas cinza-azulado, cartão
// branco, texto Ink, e os tons "-text" de sucesso, aviso e erro, que passam
// de 4,5:1 sobre branco. A escura é a de sempre.
//
// Sem React porque financialEngine.js também usa estas cores e roda na Edge
// Function da API (Deno), onde não há tela nem matchMedia: lá vale a escura.
//
// ponytail: o tema é escolhido quando o app abre. Trocar o tema do sistema
// com o app aberto só vale na próxima abertura. Trocar ao vivo pede que as
// cores virem variáveis CSS, e os ícones e gráficos SVG recebem cor por
// atributo, que não aceita var(): seria reescrever todos eles.

export const DARK = {
  bg: "#0B0D0F", card: "#16191D", c2: "#1D2126", bd: "#262B31", bd2: "#31363D",
  tx: "#F3F4F6", tx2: "#9AA3AE", tx3: "#848C96", muted: "#22272C",
  gold: "#D4A017", // o dourado de texto e da marca (Finance accent · dark)
  success: "#34D399", warning: "#FBBF24", error: "#F87171",
  successSurface: "#1A332E", dangerSurface: "#362529", warningSurface: "#36301E",
  blue: "#3B82F6", violet: "#A78BFA", link: "#5EA1FF",
  tint: "255,255,255", // véus de hover e de campo: branco sobre o escuro
  shadow: ["0 1px 2px rgba(0,0,0,0.32)", "0 8px 32px rgba(0,0,0,0.40)", "0 16px 48px rgba(0,0,0,0.48)"],
  // categorias: tons 400, claros, que aparecem sobre o fundo escuro
  categories: ["#60A5FA", "#818CF8", "#34D399", "#FB7185", "#FBBF24", "#A78BFA", "#FB923C", "#38BDF8", "#F472B6", "#2DD4BF", "#C084FC", "#4ADE80", "#FCD34D", "#94A3B8"],
};

export const LIGHT = {
  bg: "#E2E7ED", card: "#FFFFFF", c2: "#FFFFFF", bd: "#C2C9D2", bd2: "#76808D",
  tx: "#111111", tx2: "#374151", tx3: "#565E6B", muted: "#D6DCE4",
  // dourado de texto e da marca: o 500 oficial (#A87A0E) mede 3,2:1 no canvas; este, um passo
  // mais escuro (o hover do Finance), passa de 4,5:1 no canvas e no cartão
  gold: "#846009",
  success: "#065F46", warning: "#9A4608", error: "#B91C1C",
  successSurface: "#ECFDF5", dangerSurface: "#FEF2F2", warningSurface: "#FFFBEB",
  blue: "#1D4ED8", violet: "#6D28D9", link: "#1D4ED8",
  tint: "17,17,17",
  shadow: ["0 1px 2px rgba(17,17,17,0.06)", "0 8px 32px rgba(17,17,17,0.10)", "0 16px 48px rgba(17,17,17,0.14)"],
  // os mesmos matizes um degrau mais escuros (600; o amarelo, 700), para passar de 3:1 no branco
  categories: ["#2563EB", "#4F46E5", "#059669", "#E11D48", "#D97706", "#7C3AED", "#EA580C", "#0284C7", "#DB2777", "#0D9488", "#9333EA", "#16A34A", "#A16207", "#64748B"],
};

export const IS_LIGHT = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;
export const P = IS_LIGHT ? LIGHT : DARK;
