import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Brand System V2 (10/09/2026): IBM Plex Sans substitui a Inter como
// tipografia institucional da LaCalle. IBM Plex Mono (números, ver NUM_FONT
// em lib/theme.js) só carrega os quatro pesos que o app realmente usa —
// 800 (saldo em destaque) cai pro 700 mais próximo, a família não tem
// ExtraBold, e sintetizar um peso que a fonte não desenhou é pior do que
// simplesmente usar o mais próximo real.
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";
import "./index.css";
import LacalleFinance from "./LacalleFinance.jsx";
import { P, IS_LIGHT } from "./lib/palette.js";

// O tema é escolhido uma vez, ao abrir (lib/palette.js): página e campos nativos seguem o mesmo.
document.documentElement.style.setProperty("--lf-page", P.bg);
document.documentElement.style.colorScheme = IS_LIGHT ? "light" : "dark";
// No iPhone instalado, "black-translucent" escreve a hora e a bateria em branco, que somem no
// claro. ponytail: não validado no aparelho; se o iOS ignorar a troca feita depois do carregamento,
// o caminho é servir o index.html com o valor certo.
if (IS_LIGHT) document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute("content", "default");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LacalleFinance />
  </StrictMode>
);
