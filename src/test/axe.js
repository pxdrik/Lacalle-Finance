// Acessibilidade medida pelo axe-core, no Chromium dos testes de navegador.
//
// Mesmo conjunto de regras da auditoria de 09/10/2026 (WCAG 2.2 AA e as boas
// práticas do axe): o que ela achou ao vivo passa a derrubar o teste antes de
// chegar a alguém. A tela inteira é medida (document), porque regiões como
// <main> só fazem sentido olhando a página toda.
import axe from "axe-core";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** As violações, uma linha por elemento: regra, impacto e onde. */
export async function axeViolations(context = document) {
  const result = await axe.run(context, { runOnly: { type: "tag", values: TAGS }, resultTypes: ["violations"] });
  return result.violations.flatMap(v => v.nodes.map(n => `${v.id} (${v.impact}): ${n.target.join(" ")}`));
}
