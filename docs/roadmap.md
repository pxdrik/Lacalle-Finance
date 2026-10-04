# Roadmap

O que vem a seguir, registrado para não depender da memória de nenhuma conversa.

---

## ⏳ PENDENTE: trazer pontos do Lacalle Life para o Finance (04/10/2026)

Decidido em 04/10/2026, para fazer depois. Ainda não há lista fechada de
quais pontos do Life entram: a escolha é o primeiro passo quando o item for
retomado.

- **Protótipo antes de publicar.** Cada ponto escolhido vira protótipo e só
  vai para o `main` (que publica direto no Netlify) depois de aprovado. O
  protótipo parte dos componentes reais do Finance (`src/components/ui.jsx`,
  `src/lib/theme.js`), não de um mockup genérico.
- **Já portado, não repetir:** bounce de aba e press-scale do Motion System
  v1 do Life (`d6bca30`).
- Vale o mesmo filtro do item de motion abaixo: o Finance fica mais contido
  que o Life, sem gamificação em metas ou saldo.

---

## ⏳ PENDENTE — Motion System v1 (pesquisa entregue, sem código) — 07/09/2026

Pesquisa de motion feita contra seis fontes (60fps.design, React Bits,
Uiverse, Curated, Motion Sites, GetLayers), lida contra o Brandbook LaCalle e
o que já existe em `src/lib/theme.js` (`EASE_OUT`, `useCountUp`,
`ProgressBar`, `LaCalleReveal`). Nenhum arquivo foi alterado, nenhuma
dependência instalada.

**Relatório completo:** https://claude.ai/code/artifact/ff5fc5a5-3f99-477b-9080-c15e90cac5e7
(mesmo relatório está anotado no roadmap do Life, é a mesma pesquisa para os
dois produtos.)

O que sair daqui quando for retomado:

- **Token novo de baixo risco:** formalizar um `--duration-data` (~550ms) em
  `theme.js` e migrar os números soltos que hoje fazem esse papel
  (`useCountUp(value, duration=520)` e `ProgressBar(duration=600)` em
  `src/components/ui.jsx`) para ele — sem mudar comportamento visível.
- **Finance deve ficar deliberadamente mais contido que o Life** — nada de
  linguagem de gamificação (streak, badge, confete) em metas ou saldo
  batido: é informação de controle financeiro, não conquista de jogo. O
  `LaCalleReveal` no login continua sendo a única exceção legítima de motion
  grande, porque só o Finance tem tela de sessão.
- **Padrões priorizados** (seção 12 do relatório): toast de confirmação,
  cross-fade ao trocar filtro/período, entrada de item novo na lista de
  transações, progresso de parcelamento (`InstallmentsTab`) e de metas
  (`WishesTab`) — todos Level 2-3, nenhum exige dependência nova.
- **Decisão já tomada, não reabrir:** nada de spring physics como token —
  mesma regra do Life, para os dois produtos lerem como um sistema só.
  **Atualização, 18/09/2026:** o Life reabriu isto pra si mesmo — não pra
  esta regra em geral, mas como uma exceção pontual e documentada, só na
  transição de página (`--ease-bounce`). Ver `docs/brandbook.md`,
  divergência 6, pra decidir se o Finance ganha o mesmo tipo de exceção
  quando este item for retomado.
- **Restrição confirmada, 07/09/2026: só plano gratuito das seis fontes.**
  Nenhuma recomendação depende de 60fps PRO, React Bits Pro, Curated Pro ou
  GetLayers Unlimited/Full Stack — checado fonte a fonte na seção 01b do
  relatório. Duas conferências pendentes na hora de implementar: Count
  Up/Carousel/Dock do React Bits ainda no tier Starter, e o gradiente de
  hero do GetLayers vindo do conjunto gratuito (não dos templates pagos
  citados só como referência de tom).
