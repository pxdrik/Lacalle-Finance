# LaCalle Brand System V1.1 — aplicação no LaCalle Finance

O documento normativo é o **LaCalle Brand System V1.1**, em PDF — o mesmo que
`Life/docs/brandbook.md` aplica ao LaCalle Life. Este arquivo não o substitui
e não o resume: ele registra **como o Finance o aplica**, onde a aplicação
diverge (por peculiaridade própria do produto, não por descuido), e o que
ainda falta verificar.

Quando este arquivo e o brandbook discordarem, o brandbook vence — pág. 2.
Onde o Finance e o Life leem a mesma regra de formas diferentes e as duas são
defensáveis, isto fica registrado aqui e lá, para que uma auditoria futura
encontre a razão, não uma inconsistência.

O contrato técnico vive em `src/lib/theme.js`, com o contraste aferido em
`src/lib/tokens.test.js` — o mesmo método do `tokens.test.ts` do Life, lendo
os valores de produção em vez de duplicá-los no teste.

---

## Onde a marca vive

| Arquivo | Papel |
| --- | --- |
| `src/components/LogoSymbol.jsx` | O símbolo oficial (Proposta 01), traçado do raster do PDF — mesma ressalva do Life: não existe vetor oficial ainda, e o comentário do arquivo já cita a pág. 51 sobre isso. `fill="currentColor"`, nunca recolorido no acento. |
| `src/lib/theme.js` | Todos os tokens de cor, raio, sombra e motion, com a razão de cada valor comentada inline. |
| `src/lib/tokens.test.js` | Contraste de cada token e de cada opção de `PALETTES` contra WCAG 2.2. |
| `src/components/ui.jsx` | Componentes compartilhados: `Card`, `Btn`, `BtnGhost`, `StatTile`, `Modal`, contagem animada. |
| `src/components/AuthScreen.jsx` | Login/cadastro — formulário simples, sem copy de marketing. |

---

## As divergências

### 1. O acento não é único — é escolhido pela pessoa no perfil

**Atualizado em 10/09/2026 pelo Brand System V2:** o Finance agora tem
identidade de cor fixa, Gold (`#D4A017` dark mode), exportada como `GOLD` em
`theme.js` e usada na tela de login/cadastro (antes do usuário existir, não
há accent pessoal ainda) e como primeira entrada/padrão de `PALETTES`. Antes
disso, `theme.js` exportava `TEAL`/`TEAL2` — nomes enganosos, porque o valor
sempre foi azul (`#3B82F6`), nunca teal de verdade (o "Teal" real já existia
como uma das seis opções escolhíveis, uma colisão de nome à parte). A
divergência abaixo, registrada em 09/09/2026, descreve o sistema de seis
acentos escolhíveis, que continua existindo **como personalização por
conta**, não mais como a identidade do produto:

A pág. 19 do Brand System atribui um acento fixo por submarca. O Finance tem
sete (`PALETTES` em `LacalleFinance.jsx`: Gold, Azul, Teal, Roxo, Rosa,
Laranja, Verde), e a pessoa escolhe qual usa no próprio perfil — Gold é o
padrão pra conta nova — `AccentContext` expõe o valor corrente para `Btn` e
qualquer componente que precise dele.

**Por que a divergência existe e fica:** o Finance é uma ferramenta
compartilhada dentro de uma relação/família — mais de uma pessoa usa a mesma
lógica de produto em contas diferentes — e a cor de destaque é o jeito mais
simples de cada uma reconhecer a própria conta à distância, sem depender de
nome ou avatar. Isto não é "o acento virou decoração": continua havendo só
**um** acento ativo por vez, na mesma proporção de escassez que a pág. 20
pede — o que muda é qual dos sete ele é.

**O que isto exige, e já está feito:** cada uma das sete opções precisa
sustentar 4,5:1 como rótulo de botão (Ink/`BG` por cima), exatamente como o
acento único do Life precisa. `tokens.test.js` lê `PALETTES` direto do código
— igual a como lê os tokens de `theme.js` — e testa as sete, não só a
default (`GOLD`). Uma oitava opção que alguém adicionar sem medir quebra o
build sozinha.

Nota: **Verde (`#34D399`) é uma das sete opções.** Ele coincide com o acento
do Life. Não é um problema — Finance e Life não aparecem lado a lado na
mesma tela — mas vale saber que "verde LaCalle" deixou de identificar um
produto específico assim que virou uma cor escolhível aqui.

### 2. A tinta sobre o acento é Ink (`BG`), não branco — mesma razão do Life

Documentado no próprio código (`ui.jsx`, comentário acima de `Btn`): branco
sobre qualquer um dos seis acentos mede entre ~2,8:1 e ~3,7:1, abaixo dos
4,5:1 que a pág. 48 exige. Ink passa em todos com folga. É a mesma
divergência 1 do Life (pág. 25), independente — encontrada e corrigida no
Finance sem referência cruzada ao Life na hora, o que é um bom sinal: as duas
aplicações convergiram sozinhas na mesma leitura da pág. 48.

### 3. Texto terciário precisa ser opaco, não translúcido — BUG-04

`TX3` (labels, estados vazios, cabeçalhos de seção) era `TX2` com alfa 0,68.
Medido, isso caía para ~3,68–4,06:1 nas superfícies reais — abaixo do
mínimo. Trocado por `#848C96`, um cinza opaco calibrado para ficar
visivelmente mais apagado que `TX2` e ainda assim passar de 4,5:1 nas três
superfícies (`BG`, `CARD`, `C2`). `tokens.test.js` também prova que a
hierarquia `TX > TX2 > TX3` continua em luminância, não só em contraste —
sem isso, a correção de acessibilidade poderia ter achatado a hierarquia
visual que ela deveria preservar.

### 4. Não existe modo claro

O Finance roda em dark mode nativo (`#0B0D0F` fixo em `index.css`, sem
`data-theme` nem media query de preferência). O Life tem os dois, com claro
como padrão. Isto não está listado como divergência do Brand System em si —
a pág. 33 descreve a escala escura como algo que qualquer produto LaCalle
pode usar — mas é uma diferença real entre as duas aplicações que vale
registrar: o Finance nunca foi validado em claro, porque não pretende
existir em claro.

### 5. Duração de contagem animada não vem de um tier nomeado

`useCountUp` (`ui.jsx:108`) tem `duration=520` como default, e um segundo
call site (`ui.jsx:312`) passa `650` explicitamente — dois valores soltos e
próximos, nenhum nomeado. É exatamente o caso que o `docs/brandbook.md` do
Life cita como origem do tier `--duration-data: 550ms` proposto (emenda
"Motion System v1", ainda não ratificada no PDF). **Quando esse tier for
ratificado, migrar os dois valores do Finance para ele junto com o Life** —
não faz sentido o token nascer só de um lado.

---

## QA — o que foi verificado nesta entrega, e o que não foi

Ao contrário do checklist do Life (rodado no navegador, pág. 53, 15/08/2026),
esta primeira versão do brandbook do Finance foi montada por leitura de
código (`theme.js`, `tokens.test.js`, `ui.jsx`, `LacalleFinance.jsx`), não por
medição no navegador nos dois temas e três larguras. Marcar algo como "passa"
sem ter visto a tela seria a mesma auto-declaração que o Life recusa fazer.
Por isso:

### Verificado (por código e teste automatizado)

- [x] Contraste de texto primário/secundário/terciário nas três superfícies
      reais — `tokens.test.js`, 3 pares × 3 níveis
- [x] Contraste do rótulo do botão primário para as seis opções de acento —
      `tokens.test.js`, lendo `PALETTES` do código-fonte
- [x] Tinta Ink sobre o acento, não branco — `Btn` em `ui.jsx`
- [x] Ícones de uma única biblioteca linear (Lucide) — único import em todo
      `LacalleFinance.jsx` e `ui.jsx`
- [x] Símbolo nunca recolorido no acento — `LogoSymbol` usa `currentColor`
- [x] Raios fixos e nomeados (8/12/16/20 — `R_CHIP`/`R_BTN`/`R_CARD`/`R_MODAL`),
      nenhum valor solto encontrado nos componentes lidos
- [x] `prefers-reduced-motion` respeitado — `index.css` força durações a
      120ms, e `useCountUp` também checa a preferência e pula a contagem
- [x] Card sem sombra difusa — `SH_SM` é `0 1px 2px rgba(0,0,0,.32)`,
      elevação equivalente à do Life, calibrada pro fundo escuro

### Verificado no navegador — QA de 10/09/2026, conta real do Pedro em produção

- [x] Único botão primário por tela — passa em Início, Transações, Previstos,
      Parcelas e Metas. As "ações rápidas" da Home (Nova Receita/Despesa/
      Aporte/Resgate/Nova Meta) são um trilho de atalhos de estilo secundário
      (borda + fundo transparente), não cinco primários competindo — só existe
      um botão de preenchimento sólido por tela.
- [ ] **Alvos de toque de 44×44 em mobile — FALHA real, sistemática.** Ver
      achado detalhado abaixo.
- [ ] Grid/breakpoints em largura real de celular — não verificado nesta
      sessão: a janela do navegador não aceitou redimensionar abaixo da
      resolução de desktop neste ambiente. O código tem breakpoints reais
      (`@media(max-width:760px)` troca abas por bottom nav, `560px` e `380px`
      ajustam tipografia/espaçamento) e um comentário próprio (`BUG-08`) já
      documentando a preocupação com 44px na bottom nav — mas isso não foi
      visto renderizado, só lido.
- [x] Os 3 testes de identidade — ver abaixo, agora medidos, não só lidos.

### Achado real: alvos de toque abaixo de 44×44, em quase toda lista

O Finance não tem nenhum equivalente ao utilitário `touch-44` que o Life já
usa (área de toque ampliada por `::after`, sem crescer o ícone visual). Toda
ação de linha é só `padding` em volta do ícone, e o padding não chega nem
nos 24×24 que a pág. 23 aceita fora de ação primária no desktop:

| Onde | Ação | Medido (desktop) |
| --- | --- | --- |
| `TransactionsTab.jsx:95-96` | Editar / Excluir, em toda linha de transação | 22&times;25px |
| Previstos (linha de gasto previsto) | Ignorar mês / Mover pra Metas / Editar / Excluir | 22&times;25px |
| Previstos (linha de gasto previsto) | Marcar como pago / não pago | 24&times;24px |
| Metas (linha de meta) | Transferir / Editar / Excluir | mesmo padrão, 22&times;25px |
| `LacalleFinance.jsx:1745` | "Salvar agora" (retry de sync, cabeçalho) | **11&times;11px** — o pior caso |

Medido com `getBoundingClientRect()` direto no DOM em produção
(lacalle-finance.netlify.app), não estimado. Repete em pelo menos três telas
(Transações, Previstos, Metas), então não é um botão esquecido, é um padrão
sem solução — o Finance nunca ganhou o equivalente ao `touch-44`. Correção
proposta, não implementada ainda: mesma técnica do Life (pseudo-elemento
`::after` com `max(100%, 2.75rem)`), aplicada em CSS puro já que este projeto
não usa Tailwind.

---

## Os três testes de identidade — pág. 52 (medidos em produção, 10/09/2026)

**Teste 01 · logo removida. Passa.** Cards de raio 16 com borda de 1px, hero
único do "Saldo" (ver auditoria abaixo), listas em vez de grade pros dados
secundários — confirmado nas cinco telas.

**Teste 02 · cor removida. Passa, com uma correção já feita mas não publicada.**
A "economia este mês" (`LacalleFinance.jsx`, perto da linha 2284) usava só
cor pra dizer se o resultado do mês foi bom ou ruim — corrigido nesta mesma
sessão com `ArrowUpCircle`/`ArrowDownCircle` ao lado do valor, mesmo ícone já
usado em "Nova Receita"/"Nova Despesa". Ainda não está no ar: o site em
produção (Netlify) reflete o build anterior a esta correção. As cores
"Entradas"/"Saídas" nas listas não entram nessa regra — sempre vêm com o
rótulo de texto ao lado, nunca cor sozinha.

**Teste 03 · motion removido. Passa** — `prefers-reduced-motion` implementado
globalmente (`index.css`) e no hook de contagem (`useCountUp`); nenhuma
informação nova depende só da animação. Não testado com a preferência do SO
ligada de verdade nesta sessão, só confirmado por leitura do código.

---

## Auditoria visual externa — as mesmas duas referências, aplicadas ao Finance (09/09/2026)

Pedro pediu para verificar onde a auditoria feita no Life (duas referências:
um redesign de produto e uma landing institucional) também se aplica aqui.
Resultado, por item:

### Já resolvido, independentemente — vale citar como precedente

**Home consolidada como hero único.** Antes de qualquer referência externa
entrar na conversa, o Finance já tinha feito exatamente o movimento que a
Referência 1 mostrou para o Life: `LacalleFinance.jsx:2265-2283` registra que
"Resumo do mês" + 3 cards de saldo (7 repetições do padrão ícone+número+
legenda antes de qualquer conteúdo real) viraram um card único, em
04-06/09/2026. Ao aplicar a mesma ideia na Home do Life, vale usar esta
consolidação do Finance como o exemplo já validado em produção, não só a
referência externa.

### Aplica, com um gap real a fechar

**Componente de comparação temporal (cor + ícone + texto).** O Finance já
tem `ComparisonBar` (duas barras, média vs. mês atual) e o token
`DATA_COMPARISON`. A "economia este mês", que usava só cor num texto solto
sem ícone, foi corrigida em 10/09/2026 — ver Teste 02 acima. O componente
formal de comparação (nomeado, reutilizável) proposto no `docs/brandbook.md`
do Life segue sem existir nos dois produtos; a correção pontual daqui não o
substitui.

**Duração de contagem sem tier nomeado.** Já registrado na divergência 5
acima; é a mesma pendência, só repetida aqui por completude da auditoria.

### Não se aplica, ou se aplica ao contrário do Life

- **Tema escuro com glow decorativo — rejeitado no Life, aqui é mais sutil e
  aceitável.** O Finance é dark-only por natureza, não por divergência. Dois
  usos de gradiente/glow existem e são **contidos, não ambientais**: o botão
  primário tem `box-shadow: 0 2px 10px accent40` (`ui.jsx:482`, um brilho de
  10px sob o botão, na cor do acento — indica a ação, não decora a página), e
  o card "Quanto você pode gastar" (`LacalleFinance.jsx:2309`) usa um
  gradiente de 14% de opacidade contido dentro do próprio card, não vazando
  para o fundo. Nenhum dos dois é o halo de página inteira que a Referência 1
  do Life propunha e que foi rejeitado — mas é o ponto mais próximo que o
  sistema já tem disso. **Não deixar crescer**: se algum dia um card pedir
  glow mais forte ou um segundo gradiente na mesma tela, é hora de revisar
  contra a mesma regra que rejeitou o halo do Life, não de assumir que "aqui
  já é dark, então vale mais".
- **Landing institucional com criação de conta — invertido em relação ao
  Life.** No Life isso foi rejeitado porque o produto não tem conta. **O
  Finance já tem** (`AuthScreen.jsx`), e hoje é só um formulário funcional,
  sem copy de marketing. Se um dia fizer sentido uma landing para o Finance,
  é aqui — não no Life — que ela teria um produto real para descrever. Não é
  uma recomendação para construir uma agora, só o registro de que a rejeição
  do Life não se transfere ao Finance pela razão oposta.
- **Confetti cotidiano** — nenhum uso encontrado no Finance. A rejeição vale
  igual à do Life, por ser regra de marca (pág. 36), não peculiaridade de um
  produto.
- **Fotografia como dado** — não se aplica; o Finance não tem uma superfície
  equivalente à "refeição registrada" do Life.
- **Nav por pílula segmentada / tela anotada como documentação** — não
  investigado nesta leitura; candidatos a revisão quando o Finance tiver sua
  própria passada de UI, não uma prioridade da auditoria de marca.

---

## Lacunas conhecidas

- **QA no navegador feito em 10/09/2026** (conta real do Pedro em produção),
  no molde do que o Life já tinha feito em 15/08/2026 — ver seção própria
  acima. Ficou pendente só a largura real de celular (o navegador não
  redimensionou abaixo de desktop neste ambiente) e o teste de
  `prefers-reduced-motion` com a preferência do SO de fato ligada.
- **Alvos de toque abaixo de 44×44 em praticamente toda lista** — achado real
  desta sessão, com números medidos, não estimados. Ver seção própria acima.
  Correção proposta (mesma técnica do Life, `touch-44`), ainda não
  implementada — decisão do Pedro foi registrar primeiro, priorizar depois.
- **"Economia este mês" sem ícone** — corrigido no código nesta sessão, ainda
  não publicado no Netlify.
- **`R_BTN`, `R_INPUT`, alturas de controle** não foram conferidos linha a
  linha nesta leitura — só os raios de card/modal, que
  aparecem em `cardStyle`/`Modal` de forma centralizada e fácil de verificar.
  Uma auditoria de controles (botão, input, chip) fica pendente.
- **Seis acentos escolhíveis** é uma decisão de produto que o Brand System
  V1.1 não prevê — não é lacuna do Finance, é lacuna do documento normativo,
  que hoje só descreve um acento fixo por submarca. Candidato a uma nota na
  V1.2 do próprio Brand System: "quando a submarca permite acento
  escolhível pelo usuário, cada opção precisa do mesmo tratamento de
  contraste do acento único."
