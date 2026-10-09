# Roadmap

O que vem a seguir, registrado para não depender da memória de nenhuma conversa.

---

## ✅ MUDANÇA DE HOSPEDAGEM: Netlify → Vercel (09/10/2026)

O Netlify pulou o deploy do `main` por falta de cota (de novo). O site agora
publica pela Vercel: https://lacalle-finance.vercel.app (projeto
`lacalle-finance`, ligado ao GitHub; cada push no `main` publica e cada PR
ganha prévia). `vercel.json` repete os cabeçalhos do `netlify.toml`.

Feito em 09/10/2026 nos painéis:
- Cloudflare Turnstile: `lacalle-finance.vercel.app` autorizado no widget
  "LaCalle Finance - Signup" (o mesmo widget atende o Life). O Supabase
  exige CAPTCHA no login; o widget mostra "Success!" no endereço novo.
- Supabase Auth: Site URL = Vercel; Redirect URLs com Vercel e Netlify.
- `ALLOWED_ORIGINS` da `delete-account`: só a Vercel (CORS testado).
- Netlify apagado pelo Pedro (o endereço antigo dá 404); `netlify.toml`
  removido; o endereço antigo saiu do Turnstile e dos Redirect URLs do
  Supabase (subdomínio livre não pode ficar autorizado). GitHub sem webhook
  nem chave do Netlify.

---

## ✅ EM PRODUÇÃO: contas bancárias e categorias no Início (09/10/2026)

PR #4, aprovado pelo Pedro no protótipo
(https://claude.ai/artifact/HD1CC5oowS8JaXTgPfnftE) em vez da prévia do
Netlify, que usa o banco de produção.

- **Contas bancárias:** em "Minha Conta" dá para criar contas (ex.: Itaú e
  Mercado Pago). Com mais de uma, um seletor no topo troca a conta aberta.
  Lançamentos, previstos e parcelamentos são de uma conta (campo `account`;
  sem o campo é a "principal", que é tudo o que existia antes). Metas são
  as mesmas em todas. A conta aberta fica guardada no aparelho.
- Só remove conta vazia. Item de conta que não existe mais aparece na
  principal, para dinheiro nunca sumir da tela.
- **Início:** "Principais categorias" subiu para a coluna da esquerda e
  mostra todas as categorias; "Saúde financeira" foi para o fim da direita.
- **Novo banco:** botão no topo (aparece já com uma conta só) abre uma
  janela com bancos sugeridos e "Outro" (para digitar o nome); a conta
  criada já abre.
- **Carteira:** desenho animado (`WalletArt`) no seletor do topo, na lista
  de contas e no Início de uma conta nova ainda vazia; a tela entra de novo
  ao trocar de conta.
- **Não feito:** visão "todas as contas somadas" e mover um lançamento de
  uma conta para outra.

---

## ✅ EM PRODUÇÃO: pontos do Lacalle Life no Finance (04/10/2026)

Implementado a partir do protótipo
(https://claude.ai/artifact/PVbbKMtz7Nmhy8ZiQu9fVt) e da auditoria Life →
Finance (https://claude.ai/artifact/4Qe6abrgqN2uyK9kwxkZ3C), testado pelo
Pedro na prévia do PR antes do merge.

- **Sincronização:** o mais recente vence, item por item (regra do Life),
  com quarentena para registro malformado; modo sem rede com a cópia no
  aparelho.
- **Nova cara:** barra lateral no computador, Início novo, folhas para os
  formulários, menu "..." por linha, login com a marca do Finance. As
  decisões de marca estão em `docs/brandbook.md`, seção "Nova cara".
- **Fase 4:** evolução do patrimônio, ordem manual das metas, relatório
  mensal em PDF.
- **Mantido como decidido:** as 14 categorias e o Investimento como
  categoria; "Novo lançamento" discreto abaixo do resumo em Transações.
- **No ar em 04/10/2026:** PR #3 (merge `9bfd29a`), migration
  `20261005000000` aplicada em produção, função `delete-account` versão 5.
  Falta só o Pedro ligar a proteção contra senha vazada no painel do Supabase.

---

## ✅ EM PRODUÇÃO: previsto com data de fim ("Até") (04/10/2026)

- Campo `until` (último mês que conta) e `from` (mês de início, desde o
  cadastro, como o Pedro escolheu). Uma regra só,
  `PlannedStatus.appliesTo(item, mês)`, usada em todos os totais, projeções
  e listas.
- Na aba Previstos, "..." → "Encerrar em {mês}" grava o Até com Desfazer;
  "Excluir" passou a dizer que apaga de todos os meses e aponta o Encerrar.
- Encerrados aparecem numa linha abaixo da lista nos meses seguintes.

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
