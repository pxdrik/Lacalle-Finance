// As réguas dos testes de navegador (portadas de LaCalle Life, src/test/geometry.ts).
// Tudo aqui devolve número, nunca "parece certo".
import { page } from "vitest/browser";

/** 320 (pior caso real), 360 (Android comum), 375 (iPhone SE), 390 (iPhone base), 414 (Plus/Max). */
export const PHONE_WIDTHS = [320, 360, 375, 390, 414];
export const DESKTOP_WIDTH = 1280;

export async function setViewport(width, height = 800) {
  await page.viewport(width, height);
}

/** Quanto o conteúdo passa da caixa, em px (desconta 1px de arredondamento). Zero ou menos é o único resultado aceitável. */
export function overflowX(element) {
  return element.scrollWidth - element.clientWidth - 1;
}

/** O elemento que o ponteiro de fato atinge numa fração (0 a 1) da largura de `element`. */
export function hitTargetAt(element, fraction) {
  const box = element.getBoundingClientRect();
  const inset = Math.min(1, box.width / 4);
  const x = box.left + inset + (box.width - inset * 2) * fraction;
  const y = box.top + box.height / 2;
  return document.elementFromPoint(x, y);
}

/** Quem recebe o toque em cada parada da largura de `element`. Um controle correto devolve ele mesmo em todas. */
export function hitTargetsAcross(element, stops = [0, 0.25, 0.5, 0.75, 1]) {
  return stops.map(f => hitTargetAt(element, f));
}
