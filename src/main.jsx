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

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LacalleFinance />
  </StrictMode>
);
