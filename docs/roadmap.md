# Roadmap

O que vem a seguir, registrado para não depender da memória de nenhuma conversa.

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
