// ============================================================================
// theme.js — tokens visuais compartilhados (cores, raios, sombras) e o
// Context da cor de destaque ("accent", escolhida pela pessoa no perfil).
//
// Valores alinhados ao LaCalle Brand System V1.1 — seções "Dark mode" (pág.
// 33), "Design tokens" (pág. 49) e "Tokens de cor das submarcas" (pág. 19).
// O app roda em dark mode nativo, então os tokens aqui são a escala própria
// de dark do brandbook (Background/Surface/Border/Text), não uma inversão da
// paleta clara.
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

// ---- Dark mode — pág. 33 ---------------------------------------------------
export const BG = "#0B0D0F";   // Background
export const CARD = "#16191D"; // Surface
export const C2 = "#1D2126";   // Surface elevated
export const BD = "#262B31";   // Border
export const BD2 = "#31363D";  // Border em destaque (hover, foco, divisores fortes)
export const TX = "#F3F4F6";   // Text primary
export const TX2 = "#9AA3AE";  // Text secondary
// Text terciário. Era `rgba(154,163,174,0.68)` (TX2 com alfa 0.68) — a
// diluição derrubava o contraste real para ~3.68–4.06:1 contra CARD/C2/BG,
// abaixo do mínimo de 4.5:1 pra texto normal (WCAG 1.4.3), mesmo aparecendo
// como label/estado-vazio em dezenas de telas. `#848C96` é um cinza OPACO
// (sem alfa) calibrado pra ficar visivelmente mais apagado que TX2 — mantém
// a hierarquia TX > TX2 > TX3 — e ainda assim medir acima de 4.5:1 nas três
// superfícies reais onde aparece (ver tokens.test.js).
export const TX3 = "#848C96";
export const HDR = "#0B0D0F";  // Header/sidebar usam o Background, separados por borda de 1px

// LaCalle Finance accent — dark mode sobe um passo de luminosidade (pág. 33):
// 500 oficial #2563EB -> dark #3B82F6. TEAL é o accent ativo em tela; TEAL2 é
// o 500 "de catálogo", usado onde o tom mais denso funciona melhor (gradientes,
// texto sobre claro).
export const TEAL = "#3B82F6";  // Finance accent · dark
export const TEAL2 = "#2563EB"; // Finance accent · 500 (oficial/catálogo)
export const HOVER = "#1D4ED8"; // Finance accent · 600 (hover)

// ---- Radius — pág. 23 (8 / 12 / 16 / 20 / 24, nunca valores intermediários)
export const R_CARD = 16;  // Card padrão
export const R_BTN = 12;   // Botões, inputs, selects
export const R_INPUT = 12;
export const R_CHIP = 8;   // Checkbox, tags, chips, badges
export const R_MODAL = 20; // Containers maiores, modais, painéis agrupadores

// ---- Sombra — pág. 24/49: elevação em dark mode vem da superfície, não da
// sombra. Os valores oficiais (rgba(17,17,17,.04) / .10) são calibrados para
// fundo claro; abaixo, a mesma proporção adaptada a um fundo quase-preto.
export const SH_SM = "0 1px 2px rgba(0,0,0,0.32)";
export const SH_MD = "0 8px 32px rgba(0,0,0,0.40)";
export const SH_LG = "0 16px 48px rgba(0,0,0,0.48)";

export const SI = { background: "rgba(255,255,255,0.03)", border: `1px solid ${BD2}`, borderRadius: R_INPUT, padding: "12px 15px", color: TX, fontSize: 13.5, width: "100%", boxSizing: "border-box" };
export const cardStyle = { background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD, padding: 20, boxShadow: SH_SM };

export const AccentContext = createContext(TEAL);
export const useAccent = () => useContext(AccentContext);

// Inter é a única tipografia institucional da LaCalle (pág. 16) — inclusive
// para números. tabular-nums (aplicado onde os valores são exibidos) cuida do
// alinhamento de colunas que antes vinha de uma fonte numérica à parte.
export const NUM_FONT = "'Inter Variable','Inter',system-ui,sans-serif";

// ---- Motion — pág. 38: os quatro tiers de duração e as duas curvas oficiais.
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)"; // LaCalle Ease Out — entrada
export const EASE_IN = "cubic-bezier(0.64, 0, 0.78, 0)";  // LaCalle Ease In — saída
export const DUR_MICRO = 150;
export const DUR_STANDARD = 250;
export const DUR_SIGNATURE = 450;
export const DUR_HERO = 800;

// ---- Cores semânticas de UI e de dado — pág. 27, ajustadas um passo para
// dark mode (pág. 33). Data colors (positive/negative/neutral/comparison)
// seguem o mesmo princípio de subir luminosidade sobre fundo escuro.
export const SUCCESS = "#34D399";
export const WARNING = "#FBBF24";
export const ERROR = "#F87171";
export const INFO = TX2;
// Fundos sólidos que carregam texto/ícone branco por cima precisam de um tom
// mais escuro do que o token de texto/ícone acima (que já foi clareado um
// passo para dark mode e não sustenta branco a 4,5:1 — mesma divergência
// documentada e testada no LaCalle Life, pág. 25/48 do Brand System).
export const ERROR_BG = "#DC2626";   // botão destrutivo — branco mede ~4,83:1
export const SUCCESS_FILL = "#059669"; // indicador "concluído" — ícone branco mede ~3,77:1
export const DATA_POSITIVE = "#34D399";
export const DATA_NEGATIVE = "#F87171";
export const DATA_NEUTRAL = TX2;
export const DATA_COMPARISON = BD2;
