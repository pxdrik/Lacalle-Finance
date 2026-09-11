// ============================================================================
// density.jsx — o segundo eixo sobre a altura de controle (brandbook, seções
// 39 e 43). Só ficou possível depois de BTN_PAD_Y existir em theme.js: um
// toggle sem um valor central pra mudar não muda nada, e essa era exatamente
// a razão pela qual esse trabalho ficava bloqueado.
//
// Equivalente ao density-provider do Life, mas sem o script de
// pré-hidratação daquele: o Finance é SPA puro via Vite, sem server render,
// então não existe o "flash de tamanho errado antes de hidratar" que aquele
// script existe pra evitar — ler o localStorage direto no useState inicial
// já resolve, porque não há nada renderizado antes disso.
// ============================================================================
import { createContext, useContext, useState } from "react";
import { BTN_PAD_Y } from "./theme";

export const DENSITY_STORAGE_KEY = "lacalle-finance.density";
export const DENSITIES = ["compact", "default", "comfortable"];
export const DEFAULT_DENSITY = "default";

// O Life varia --control-h em passos de 8px (40/48/56). Aqui o valor que
// varia é o padding vertical do botão, que conta duas vezes (topo + base)
// pra chegar na altura final — um passo de 4px no padding produz o mesmo
// tipo de salto de 8px que o Life usa.
export const BTN_PAD_Y_BY_DENSITY = {
  compact: BTN_PAD_Y - 4,
  default: BTN_PAD_Y,
  comfortable: BTN_PAD_Y + 4,
};

function parseDensity(value) {
  return DENSITIES.includes(value) ? value : DEFAULT_DENSITY;
}

function readStoredDensity() {
  try {
    return parseDensity(window.localStorage.getItem(DENSITY_STORAGE_KEY));
  } catch {
    // Storage bloqueado (modo privado, política do navegador) — cai no padrão.
    return DEFAULT_DENSITY;
  }
}

const DensityContext = createContext({
  density: DEFAULT_DENSITY,
  setDensity: () => {},
  btnPadY: BTN_PAD_Y,
});

export function DensityProvider({ children }) {
  const [density, setDensityState] = useState(readStoredDensity);

  function setDensity(next) {
    setDensityState(next);
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      // A escolha ainda vale pra sessão atual (setDensityState já aplicou);
      // só não sobrevive a um reload.
    }
  }

  return (
    <DensityContext.Provider
      value={{ density, setDensity, btnPadY: BTN_PAD_Y_BY_DENSITY[density] }}
    >
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  return useContext(DensityContext);
}
