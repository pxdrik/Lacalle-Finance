// ============================================================================
// theme.js — tokens visuais compartilhados (cores, raios, sombras) e o
// Context da cor de destaque ("accent", escolhida pela pessoa no perfil).
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

export const BG = "#071421";
export const CARD = "#11253A";
export const C2 = "#17314D";
export const BD = "rgba(255,255,255,0.08)";
export const BD2 = "rgba(255,255,255,0.14)";
export const TX = "#F8FAFC";
export const TX2 = "#A7B6C7";
export const TX3 = "rgba(167,182,199,0.68)";
export const HDR = "#0B1B2B";
export const TEAL = "#3B82F6";
export const TEAL2 = "#2563EB";
export const HOVER = "#1E3A5F";

export const R_CARD = 24;
export const R_BTN = 14;
export const R_INPUT = 14;
export const R_CHIP = 10;
export const SH_SM = "0 1px 3px rgba(2,8,16,0.4)";
export const SH_MD = "0 20px 48px -16px rgba(2,8,16,0.55)";
export const SH_LG = "0 32px 80px -20px rgba(2,8,16,0.68)";

export const SI = { background: "rgba(255,255,255,0.03)", border: `1px solid ${BD2}`, borderRadius: R_INPUT, padding: "12px 15px", color: TX, fontSize: 13.5, width: "100%", boxSizing: "border-box" };
export const cardStyle = { background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD, padding: 28, boxShadow: SH_SM };

export const AccentContext = createContext(TEAL);
export const useAccent = () => useContext(AccentContext);

// Fonte dos números em destaque (saldos, projeções, valores). Grotesca moderna
// e encorpada, com algarismos tabulares — alinha colunas de valores. Cai para
// Inter/sistema se a Hanken não carregar.
export const NUM_FONT = "'Hanken Grotesk','Inter',system-ui,sans-serif";
