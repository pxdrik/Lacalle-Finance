/**
 * LACALLE FINANCE — ARQUITETURA E GUIA DE MIGRAÇÃO
 * ============================================================================
 * Este arquivo roda como artifact único (sandbox Claude.ai): não há bundler,
 * módulos reais nem conexão de rede além de `window.storage`. A "arquitetura
 * em camadas" abaixo existe como SEÇÕES NOMEADAS dentro do mesmo arquivo —
 * cada seção foi desenhada para virar um arquivo próprio quando o projeto for
 * migrado para um repositório real (React + Vite + Netlify + Supabase).
 *
 * SPRINT ATUAL — INSIGHTS EXPLICÁVEIS (consultor financeiro auditável)
 * ----------------------------------------------------------------------------
 * A lógica de pontuação, pesos temporais, memória financeira, thresholds e
 * regras de decisão do InsightEngine e do FinancialEngine NÃO foi alterada.
 * Nenhum número que já existia mudou de valor. O que mudou nesta sprint é
 * inteiramente a camada de evidência e explicação:
 *   • FinancialEngine ganhou duas funções "detalhadas" que apenas EXPÕEM os
 *     itens que já compunham um número existente — CashFlowAnalyzer.
 *     projectionAtDetailed() e GoalAnalyzer.avgMonthlySavingsBreakdown().
 *     As funções originais (projectionAt, avgMonthlySavings) agora delegam
 *     para elas, então o valor numérico retornado é idêntico a antes, só que
 *     com um caminho de auditoria adicional;
 *   • cada insight (InsightEngine) e cada decisão automática (DecisionEngine)
 *     passou a carregar um objeto `breakdown` (linhas de cálculo + itens reais
 *     — transações, contas previstas, metas, parcelas) construído a partir dos
 *     MESMOS dados já usados para chegar naquela conclusão;
 *   • cada cartão de insight mostra, sem precisar abrir nada, os "principais
 *     responsáveis" (transações reais por trás da conclusão), e tem um
 *     "Como cheguei a essa conclusão" expansível com o cálculo linha a linha
 *     e um checklist do que foi considerado (saldo, receitas, previstos,
 *     parcelas, assinaturas, média histórica, categorias, período);
 *   • a ferramenta "Posso gastar isso?" e as 4 decisões automáticas (orçamento,
 *     reserva, fluxo de caixa, metas) passaram a mostrar essa mesma razão
 *     contábil (saldo → + receitas → − compromissos → projeção → decisão),
 *     com recomendações em tom de consultor ("eu não recomendaria" em vez de
 *     "você não pode");
 *   • filosofia adotada a partir de agora: nenhum insight apresenta uma
 *     conclusão sem mostrar o raciocínio — o que aconteceu, por que aconteceu,
 *     quais dados foram usados, o que fazer agora.
 *
 * SPRINT ANTERIOR — INSIGHTS COMO CONSULTOR FINANCEIRO (redesenho de experiência)
 * ----------------------------------------------------------------------------
 * A lógica de pesos, relevância, memória financeira e pontuação do
 * InsightEngine NÃO foi alterada nessa sprint. O que mudou foi a camada de
 * apresentação: cada insight virou um "cartão de consultor" rico (título,
 * explicação, impacto em R$, motivo, recomendação, prioridade), no máximo 4
 * por vez, ordenados por prioridade real, mais um "Resumo do mês" (hero card)
 * no topo da Home.
 *
 * SPRINT ANTERIOR — INSIGHT ENGINE (reconstrução completa)
 * ----------------------------------------------------------------------------
 * O antigo `InsightsGenerator` (comparação simples mês-a-mês) foi substituído
 * por um `InsightEngine` totalmente separado da interface — nenhuma tela
 * contém lógica de geração de insight. (O `InsightsGenerator` ficou como
 * código morto por algumas sprints e foi removido; os textos dele comparavam
 * mês parcial com mês fechado, o mesmo defeito corrigido depois no
 * InsightEngine.) O motor:
 *   • aplica peso temporal (30 dias > 3 meses > 6 meses > histórico antigo)
 *   • constrói uma "memória financeira" por descrição (hábito) e por
 *     categoria, classificando-os como ativo / inativo / emergente
 *   • detecta mudanças de comportamento (hábito cancelado, hábito novo,
 *     substituições — ex.: um gasto recorrente parar e outro começar logo
 *     depois na mesma categoria)
 *   • gera tendências comparando o mês atual com a média ponderada recente
 *     (não apenas o mês anterior), com explicação de onde veio a variação
 *     (ex.: concentração em fins de semana)
 *   • gera alertas, oportunidades, insights de metas, investimentos, fluxo
 *     de caixa e patrimônio, cada grupo com prioridade própria
 *   • pontua cada insight (recência, frequência, valor, impacto,
 *     persistência, mudança de comportamento) e filtra ruído
 *
 * SPRINT ANTERIOR — POLIMENTO DE UX E PRODUTIVIDADE
 * ----------------------------------------------------------------------------
 * Ações rápidas na Home, pesquisa global (Ctrl+K), indicadores clicáveis com
 * painel explicativo, notas com links clicáveis em Desejos/Previstos.
 *
 * SPRINT ANTERIOR — HOME INTELIGENTE (Centro de Decisões)
 * ----------------------------------------------------------------------------
 * A aba "Insights" foi removida. Todas as leituras automáticas vivem na Home
 * ("dashboard"), organizadas como um copiloto financeiro.
 *
 * FINANCIAL INTELLIGENCE ENGINE
 * ----------------------------------------------------------------------------
 * Núcleo de inteligência financeira do LaCalle Finance, 100% baseado em regras
 * (SEM IA). Vive fora do componente React, não importa nada de React/JSX e
 * não manipula estado — apenas recebe dados e devolve números/objetos.
 * Módulos: CashFlowAnalyzer, BudgetAnalyzer, ExpenseAnalyzer, IncomeAnalyzer,
 * InvestmentAnalyzer, GoalAnalyzer, ForecastEngine, HealthScoreEngine,
 * DecisionEngine, SimulationEngine, ProjectionExplainer.
 * Nenhum componente calcula indicadores diretamente: todos consomem o
 * resultado desses módulos.
 *
 * Mapa de migração sugerido:
 *   UTILS                -> src/utils/{format,date,category}.js
 *   STORAGE SERVICE       -> src/services/StorageService.js (trocar por Supabase)
 *   FINANCIAL ENGINE       -> src/engine/FinancialEngine.js (puro, testável)
 *   HOOKS (useMemo abaixo) -> src/hooks/use{Transactions,Goals,Insights,...}.js
 *   COMPONENTES DE UI      -> src/components/{Dashboard,Calendar,Timeline,...}.jsx
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { supabase, openedFromRecoveryLink } from "./lib/supabaseClient";
import { storage } from "./lib/storage";
import AuthScreen, { NewPasswordScreen } from "./components/AuthScreen";
import { FinancialEngine, InsightEngine, fmt, monthKey, addMonthsStr, daysInMonth, MONTH_ORDER, MONTHS_ARR, PlannedStatus, monthIndex, monthAt } from "./lib/financialEngine";
import ProjectionDrawer from "./components/ProjectionDrawer";
import { Signature, FinanceMark } from "./components/Brand";
import { IncomeExpenseChart, TrendChart } from "./components/charts";
import InstallmentsTab from "./components/InstallmentsTab";
import WishesTab from "./components/WishesTab";
import TransactionsTab from "./components/TransactionsTab";
import PlannedTab from "./components/PlannedTab";
import PlanningTab from "./components/PlanningTab";
import { BG, CARD, BD, BD2, TX, TX2, TX3, GOLD, HOVER, R_CARD, R_BTN, R_INPUT, R_CHIP, SH_MD, SH_LG, SI, AccentContext, NUM_FONT, EASE_OUT, ERROR_BG, DUR_PAGE, EASE_BOUNCE, PRESS_SCALE, PALETTES, MUTED, WARNING, accentSurface, accentText, SUCCESS_SURFACE, DANGER_SURFACE, WARNING_SURFACE, SUCCESS, ERROR } from "./lib/theme";
import { Card, Modal, CategoryIcon, AnimatedValue, InsightCard, Btn, BtnGhost, MoneyInput, toDecimalStr, DECISION_STATUS_COLOR, ProgressBar, LaCalleReveal, Comparison, EmptyState, TabPanel, DensityToggle, Segmented, IconButton, PageHeader, SectionTitle, Field } from "./components/ui";
import { DensityProvider } from "./lib/density";
import { parseNum, roundMoney, validateAmount, validateDate, validateText, validateInt, firstError, DATE_MIN, DATE_MAX, MAX_NOTES_LEN, MAX_PARCELAS } from "./lib/validation";
import { createSubmitGuard } from "./lib/submitGuard";
import { shouldFlushOnHide, shouldWarnBeforeUnload } from "./lib/autosaveGuard";
import { createSyncEngine, localCopy, hasPendingLocalCopy, clearLocalCopies } from "./lib/syncEngine";
import { validateBackup, buildBackup } from "./lib/backupValidation";
import { parseCsvLine, csvRowToTx, buildTxCsv } from "./lib/csv";
import { formatDay } from "./lib/dates";
import { removeTxFromInstallments, restoreTxToInstallments } from "./lib/installmentSync";
import { wishToPlannedPayload, plannedToWishPayload } from "./lib/wishPlannedTransfer";
import {
  TrendingUp, CreditCard, Calendar, Sparkles, Repeat, Undo2, Tag, Settings, LogOut, Search, X, Plus, Trash2, Upload, Download, AlertTriangle, ArrowUpCircle, ArrowDownCircle, LayoutDashboard, Receipt, PiggyBank, Cloud, CloudOff, Loader2, RefreshCw, CheckCircle2, AlertCircle, Info, Trophy, CalendarDays, Bell, Target, MoreHorizontal, ChevronRight
} from "lucide-react";

const CATS=["Lazer","Alimentação","Transporte","Desejos","Roupas","Tecnologia","Saude / Cuidados Pessoais","Educação","Salario / Entradas","Outros","Investimento","Assinaturas","Rembolsos","Presentes"];
const COLORS=["#60A5FA","#818CF8","#34D399","#FB7185","#FBBF24","#A78BFA","#FB923C","#38BDF8","#F472B6","#2DD4BF","#C084FC","#4ADE80","#FCD34D","#94A3B8"];
// MONTH_ORDER era uma lista fixa de datas hardcoded (jan/25 até jun/27) — ou
// seja, tinha uma "data de validade": a partir de jun/2027 a funcionalidade
// de "Previsto" não recorrente simplesmente pararia de encontrar mês na
// lista. Agora é uma janela rolante calculada a partir da data real do
// dispositivo: sempre 12 meses pra trás e 36 meses pra frente a partir de
// hoje, recalculada a cada carregamento do app — nunca fica velha.
const INV_TIPOS=["Aporte","Resgate","Rendimento"];
const INV_TIPO_ICONS={"Aporte":PiggyBank,"Resgate":Undo2,"Rendimento":TrendingUp};
// "gold" é a identidade fixa do Finance (Brand System V2, 10/09/2026) e o
// padrão pra conta nova — as outras seis continuam existindo como
// personalização por conta, não como identidade do produto.
// PALETTES (as sete cores do perfil) mora em lib/theme.js, com o teste de contraste.
// parseNum/DATE_MIN/DATE_MAX agora vêm de lib/validation.js (fonte única,
// compartilhada com as validações de formulário e coberta por testes).
// Gerador de ID: Date.now() sozinho pode colidir se dois itens forem criados
// no mesmo milissegundo (ex.: cliques rápidos, criação em lote). Um contador
// incremental combinado ao timestamp garante unicidade dentro da sessão sem
// mudar o tipo do id (continua number, compatível com todo o código que já
// compara id===id em outros lugares).
let _idCounter=0;
const genId=()=>{_idCounter=(_idCounter+1)%1000;return Date.now()*1000+_idCounter;};

// ==================== MAPEAMENTO: Desejo <-> Previsto ====================
// Funções puras de conversão entre os dois modelos de dado, usadas pela
// funcionalidade de "mover" um item entre as listas de Desejos e Previstos
// (ver moveWishToPlanned / movePlannedToWish no componente). Cada uma monta
// o payload do item de destino a partir do item de origem: campos
// compatíveis (nome/desc, valor, notas) são copiados diretamente; campos que
// só existem no destino recebem o valor escolhido pelo usuário (ou um
// padrão razoável); campos que só existem na origem e não têm equivalente
// no destino são preservados como uma linha extra em `notes`, para nunca
// perder informação mesmo quando o modelo de dado não bate 1:1.
//
// Conversão de payload entre Metas <-> Previstos ao transferir um item de
// um lado para o outro — extraído para src/lib/wishPlannedTransfer.js (Fase 2).

// ==================== SERVICES: StorageService ====================
const storageKey=email=>`ff6:${email.replace(/[^a-zA-Z0-9]/g,"_")}:v1`;

// ==================== UTILS: datas ====================
const MONTH_NAMES_FULL=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ==================== UTILS: links dentro de notas ====================
// Campo `notes` (Desejos e Previstos) é hoje texto simples com detecção de
// URLs. A estrutura foi pensada para evoluir para Markdown/checklist/tags/
// anexos/comentários no futuro sem quebrar o formato salvo (string única).

// ============================================================================
// FINANCIAL INTELLIGENCE ENGINE
// Núcleo de cálculo financeiro do LaCalle Finance — 100% regras de negócio, SEM IA.
// ============================================================================

const todayFn=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
// DATE_MIN/DATE_MAX vêm de lib/validation.js. Os atributos min/max do
// <input type="date"> continuam sendo usados (dão a UI certa no seletor), mas
// eles NÃO impedem digitação — por isso toda gravação passa por validateDate.



function MainApp({user,setUser}){
  const [isLoaded,setIsLoaded]=useState(false);
  // LaCalle Reveal (pág. 35): toca uma única vez, na abertura do site logo
  // depois da autenticação — nunca de novo na mesma sessão (voltou a ser
  // assim depois de testar disparando em toda troca de aba, que incomodou).
  const [revealActive,setRevealActive]=useState(true);
  const [syncStatus,setSyncStatus]=useState("loading");
  const [tab,setTab]=useState("dashboard");
  const [showMore,setShowMore]=useState(false);
  const [transactions,setTransactions]=useState([]);
  const [wishes,setWishes]=useState([]);
  const [installments,setInstallments]=useState([]);
  const [filterMonth,setFilterMonth]=useState("");const [filterCat,setFilterCat]=useState("");
  const [filterType,setFilterType]=useState("");const [search,setSearch]=useState("");
  const [showProfile,setShowProfile]=useState(false);const [newName,setNewName]=useState(user.name);
  const [profileMsg,setProfileMsg]=useState("");
  const [editingTx,setEditingTx]=useState(null);
  const [qaType,setQaType]=useState("Saída");const [qaDesc,setQaDesc]=useState("");const [qaVal,setQaVal]=useState("");
  const [qaCat,setQaCat]=useState("Alimentação");const [qaInvTipo,setQaInvTipo]=useState("Aporte");
  const [qaDate,setQaDate]=useState(todayFn);const [qaForm,setQaForm]=useState("pix");
  const [qaFixed,setQaFixed]=useState("Variavel");const [qaExpanded,setQaExpanded]=useState(false);const [qaRepeat,setQaRepeat]=useState("none");
  const [showClearConfirm,setShowClearConfirm]=useState(false);
  const [showWishForm,setShowWishForm]=useState(false);const [editingWish,setEditingWish]=useState(null);
  const [wishForm,setWishForm]=useState({name:"",price:"",saved:"",priority:"Média",monthsTarget:"",notes:""});
  const wishFormSnapshotRef=useRef(null);
  const [confirmDiscard,setConfirmDiscard]=useState(null); // "wish" | "planned" | "tx"
  const [instDraft,setInstDraft]=useState({desc:"",totalVal:"",numParcelas:"12",startDate:"",cat:"Desejos",form:"credito"});
  const [showInstForm,setShowInstForm]=useState(false);const [delInstId,setDelInstId]=useState(null);
  const [pendingImport,setPendingImport]=useState(null);

  // ---- Pesquisa global, explicação de indicadores e confirmações (novos nesta sprint) ----
  const [showSearch,setShowSearch]=useState(false);
  const [searchQuery,setSearchQuery]=useState("");
  const [explainKey,setExplainKey]=useState(null);
  // ---- Drawer de projeção: a versão "auditável" dos cartões de previsão do
  // dashboard (Quanto posso gastar / Previsto no fim do mês). Guarda só a
  // chave e o horizonte em dias — os dados em si são recalculados ao vivo
  // via ProjectionExplainer, então nunca ficam desatualizados depois de uma
  // ação rápida (marcar como pago, ignorar, excluir...) feita dentro dele.
  const [projectionDrawer,setProjectionDrawer]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);
  // Exclusão definitiva da conta (confirmação por frase digitada).
  const [deleteAccountOpen,setDeleteAccountOpen]=useState(false);
  const [deleteAccountPhrase,setDeleteAccountPhrase]=useState("");
  const [deleteAccountBusy,setDeleteAccountBusy]=useState(false);
  // Ref espelhando `busy`: o handler global de Esc é registrado com deps []
  // e enxergaria sempre o valor do primeiro render se lesse o state.
  const deleteAccountBusyRef=useRef(false);
  const cancelEditTxRef=useRef(()=>{});
  const [expandedNotes,setExpandedNotes]=useState({});
  // A ordem escolhida fica neste aparelho (conveniência de tela, não dado da conta).
  const [wishSortBy,setWishSortByState]=useState(()=>{try{return localStorage.getItem("lf.wishSort")||"progress";}catch{return"progress";}});
  const setWishSortBy=v=>{setWishSortByState(v);try{localStorage.setItem("lf.wishSort",v);}catch{/* sem armazenamento local */}};
  // Mesma ideia do sortedPlannedItemsForMonth: memoiza a ordenação da lista
  // de Desejos em vez de reordenar a cada render do componente.
  // "manual" usa o campo `order` de cada meta (e não a posição no array):
  // assim mudar a ordem carimba updatedAt e passa pela regra do mais recente.
  const sortedWishes=useMemo(()=>wishes.map((w,i)=>[w,i]).sort(([a,ia],[b,ib])=>{
    if(!!a.done!==!!b.done)return a.done?1:-1;
    if(wishSortBy==="manual")return(a.order??ia)-(b.order??ib);
    if(wishSortBy==="priority"){
      const order={"Alta":0,"Média":1,"Baixa":2};
      const diff=(order[a.priority]??1)-(order[b.priority]??1);
      if(diff!==0)return diff;
    }
    return Math.min(100,b.saved/b.price*100)-Math.min(100,a.saved/a.price*100);
  }).map(([w])=>w),[wishes,wishSortBy]);

  const [plannedExpenses,setPlannedExpenses]=useState([]);
  const [plannedMonth,setPlannedMonth]=useState(monthKey(todayFn()));
  const [showPlannedForm,setShowPlannedForm]=useState(false);const [editingPlanned,setEditingPlanned]=useState(null);
  const [plannedForm,setPlannedForm]=useState({desc:"",val:"",cat:"Assinaturas",form:"pix",recurring:false,month:monthKey(todayFn()),from:monthKey(todayFn()),hasUntil:false,until:monthKey(todayFn()),notes:""});
  const plannedFormSnapshotRef=useRef(null);

  // ---- Lixeira (trash) ----
  // Complementa o "desfazer" (que só existe durante a sessão atual e some ao
  // recarregar a página): itens excluídos ficam guardados aqui por 30 dias,
  // persistidos junto com o resto dos dados, e podem ser restaurados a
  // qualquer momento pela pessoa — mesmo depois de fechar e reabrir o app.
  const TRASH_RETENTION_DAYS=30;
  const [trash,setTrash]=useState([]); // [{trashId, type:"wish"|"planned", item, deletedAt}]
  const [showTrash,setShowTrash]=useState(false);
  const moveToTrash=(type,item)=>setTrash(p=>[{trashId:genId(),type,item,deletedAt:Date.now()},...p]);
  const restoreFromTrash=trashId=>{
    const entry=trash.find(t=>t.trashId===trashId);
    if(!entry)return;
    pushHistory();
    if(entry.type==="wish")setWishes(p=>[...p,entry.item]);
    else if(entry.type==="planned")setPlannedExpenses(p=>[...p,entry.item]);
    else if(entry.type==="tx"){
      setTransactions(p=>[entry.item,...p]);
      // Espelha exatamente o desconto feito em deleteTx: se a parcela
      // restaurada pertencia a um parcelamento que ainda existe, devolve a
      // "vaga" nele — sem isso ela voltaria órfã (installmentId apontando
      // pra um pai que não sabe mais dela).
      if(entry.item.installmentId)setInstallments(p=>restoreTxToInstallments(p,entry.item));
    }
    else if(entry.type==="installment"){
      const{_trashedTxs,...inst}=entry.item;
      setInstallments(p=>[...p,inst]);
      if(_trashedTxs?.length)setTransactions(p=>[..._trashedTxs,...p]);
    }
    setTrash(p=>p.filter(t=>t.trashId!==trashId));
    showToast("Item restaurado.","success");
  };
  const purgeTrashItem=trashId=>setTrash(p=>p.filter(t=>t.trashId!==trashId));


  // ---- Transferência Desejo <-> Previsto ----
  // transferWish: {item, form:{cat,form,recurring,month}} — modal de "completar dados" (Desejo -> Previsto)
  // transferPlanned: item — modal de confirmação simples (Previsto -> Desejo)
  const [transferWish,setTransferWish]=useState(null);
  const [transferPlanned,setTransferPlanned]=useState(null);

  const [customCats,setCustomCats]=useState([]);
  const [newCatInput,setNewCatInput]=useState("");
  const fullCats=useMemo(()=>[...CATS,...customCats],[customCats]);
  const catColor=c=>{const i=fullCats.indexOf(c);return i>=0?COLORS[i%COLORS.length]:TX3;};

  const [accentKey,setAccentKey]=useState("gold");
  const [walletName,setWalletName]=useState("LaCalle Finance");
  const [onboardingDismissed,setOnboardingDismissed]=useState(false);
  const accent=(PALETTES[accentKey]||PALETTES.gold).base;

  // ---- Planejamento (estados) ----
  const [planTab,setPlanTab]=useState("geral");
  const todayISO=todayFn();
  const todayDateObj=new Date(todayISO+"T12:00:00");
  const [calYear,setCalYear]=useState(todayDateObj.getFullYear());
  const [calMonthIdx,setCalMonthIdx]=useState(todayDateObj.getMonth());
  const [selectedCalDay,setSelectedCalDay]=useState(null);

  // ---- Decision Engine / Simulation Engine (estados de UI) ----
  const [askAmount,setAskAmount]=useState("");
  const [askResult,setAskResult]=useState(null);
  const [simType,setSimType]=useState("economizar_mais");
  const [simGoalId,setSimGoalId]=useState("");
  const [simExtra,setSimExtra]=useState("");
  const [simValue,setSimValue]=useState("");
  const [simParcelas,setSimParcelas]=useState("12");
  const [simMonths,setSimMonths]=useState("12");
  const [simReturn,setSimReturn]=useState("10");
  const [simResult,setSimResult]=useState(null);

  const [toasts,setToasts]=useState([]);
  // `action` ({label,onClick}) põe um botão no aviso, como o "Desfazer"
  // depois de excluir; com ação o aviso fica 6 s em vez de 3,8 s.
  const dismissToast=id=>setToasts(p=>p.filter(t=>t.id!==id));
  const showToast=(msg,type="info",{action}={})=>{
    const id=Date.now()+Math.random();
    setToasts(p=>[...p,{id,msg,type,action}]);
    setTimeout(()=>dismissToast(id),action?6000:3800);
  };

  const historyRef=useRef([]);
  const [historyLen,setHistoryLen]=useState(0);

  const pushHistory=()=>{
    // A lixeira entra no retrato: sem ela, desfazer uma exclusão deixava o
    // item na lista E na lixeira, e "Restaurar" depois o duplicava.
    const snap={tx:[...transactions],wishes:[...wishes],inst:[...installments],planned:[...plannedExpenses],customCats:[...customCats],trash:[...trash]};
    const newH=[...historyRef.current.slice(-14),snap];
    historyRef.current=newH;
    setHistoryLen(newH.length);
  };
  // "Desfazer" do aviso: só vale se nada aconteceu depois da exclusão; senão
  // desfaria outra coisa. Aí orienta a usar o desfazer do topo, passo a passo.
  const undoIfLast=len=>{
    if(historyRef.current.length!==len){showToast("Outra alteração aconteceu depois. Use o desfazer do topo, um passo de cada vez.","info");return;}
    undo();
    showToast("Desfeito.","success");
  };
  const deletedToast=what=>{
    const len=historyRef.current.length;
    showToast(`${what} foi para a lixeira.`,"info",{action:{label:"Desfazer",onClick:()=>undoIfLast(len)}});
  };
  const undo=()=>{
    if(!historyRef.current.length)return;
    const prev=historyRef.current[historyRef.current.length-1];
    historyRef.current=historyRef.current.slice(0,-1);
    setHistoryLen(historyRef.current.length);
    // Sem "bandeira" que pula o salvamento: o desfazer é gravado na nuvem como
    // qualquer outra mudança (antes a tela dizia "Sincronizado" e a nuvem
    // continuava com o estado anterior).
    setTransactions(prev.tx);setWishes(prev.wishes);setInstallments(prev.inst);setPlannedExpenses(prev.planned||[]);setCustomCats(prev.customCats||[]);if(prev.trash)setTrash(prev.trash);
  };

  const saveTimerRef=useRef(null);
  // ---- Carregar e salvar (lib/syncEngine.js) ----
  // Um salvamento por vez, só quando o conteúdo mudou, e conflito entre
  // aparelhos resolvido item por item: o mais recente vence (lib/sync.js).
  const engineRef=useRef(null);
  // `local`: cópia no aparelho para o modo sem rede (lib/syncEngine.js). Sem
  // localStorage (bloqueado), o app segue só com a nuvem, como antes.
  if(!engineRef.current){
    let local=null;
    try{local=localCopy(storageKey(user.email));}catch{/* sem armazenamento local */}
    engineRef.current=createSyncEngine({storage,key:storageKey(user.email),local});
  }
  const engine=engineRef.current;
  const [loadError,setLoadError]=useState(null);

  // O estado da tela no formato do documento salvo. Lido por ref pelos
  // ouvintes registrados uma vez só (visibilidade, salvar agora).
  const docRef=useRef(null);
  docRef.current={tx:transactions,wishes,inst:installments,planned:plannedExpenses,trash,customCats,name:user.name,accentKey,walletName,onboardingDismissed};

  const applyDoc=d=>{
    setTransactions(d.tx||[]);
    setWishes(d.wishes||[]);
    setInstallments(d.inst||[]);
    setPlannedExpenses(d.planned||[]);
    setCustomCats(d.customCats||[]);
    setAccentKey(d.accentKey||"gold");
    setWalletName(d.walletName||"LaCalle Finance");
    setOnboardingDismissed(!!d.onboardingDismissed);
    const cutoff=Date.now()-TRASH_RETENTION_DAYS*24*60*60*1000;
    setTrash((d.trash||[]).filter(t=>t.deletedAt>cutoff));
    if(d.name&&d.name!==user.name)setUser(u=>({...u,name:d.name}));
  };

  const loadData=async()=>{
    setLoadError(null);
    setSyncStatus("loading");
    try{
      applyDoc(await engine.load());
      setSyncStatus("saved");
      setIsLoaded(true);
    }catch(e){
      // Falha ao carregar não vira "conta vazia e sincronizada": a tela de
      // carregamento mostra o erro e um botão para tentar de novo, e nada é
      // gravado por cima do que está na nuvem.
      console.error("LaCalle Finance — erro ao carregar:",e);
      setLoadError(e);
      setSyncStatus("error");
    }
  };
  useEffect(()=>{loadData();},[user.email]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grava agora o estado atual da tela. Se a junção com a nuvem trouxe algo
  // de outro aparelho, a tela adota (sem perder o que ainda não foi salvo).
  const runSave=async()=>{
    const r=await engine.save(docRef.current);
    if(r.adopt){
      applyDoc(engine.rebase(docRef.current));
      showToast("Juntamos o que você fez em outro aparelho.","info");
    }
    if(r.status==="error"||r.status==="offline"){setSyncStatus(r.status);return r.status;}
    setSyncStatus(engine.isBusy()||saveTimerRef.current?"saving":"saved");
    return r.status;
  };
  const runSaveRef=useRef(runSave);
  runSaveRef.current=runSave;
  const syncStatusRef=useRef(syncStatus);
  syncStatusRef.current=syncStatus;

  useEffect(()=>{
    if(!isLoaded)return;
    setSyncStatus("saving");
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    saveTimerRef.current=setTimeout(async()=>{
      saveTimerRef.current=null;
      const status=await runSaveRef.current();
      if(status==="error")showToast("Falha ao salvar na nuvem. Toque no ícone de atualizar ao lado do status para tentar de novo.","error");
    },1200);
    return()=>{if(saveTimerRef.current)clearTimeout(saveTimerRef.current);};
  },[transactions,wishes,installments,plannedExpenses,customCats,user.name,accentKey,walletName,trash,onboardingDismissed,isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps -- só os dados disparam o salvamento; as funções são lidas atuais

  // ---- BUG-02: ao esconder a aba, grava na hora o que ainda estava no
  // intervalo de espera (1,2 s), em vez de arriscar perder no fechamento.
  // `visibilitychange`→hidden dispara de forma confiável antes de a página
  // ser destruída; `beforeunload` só avisa, nunca tenta salvar.
  // Ao voltar para a aba, confere se outro aparelho gravou algo e junta.
  useEffect(()=>{
    const onVisibility=async()=>{
      if(shouldFlushOnHide({visibilityState:document.visibilityState,syncStatus:syncStatusRef.current,saveInFlight:engine.isBusy()})){
        if(saveTimerRef.current){clearTimeout(saveTimerRef.current);saveTimerRef.current=null;}
        runSaveRef.current().catch(()=>{});
        return;
      }
      if(document.visibilityState==="visible"&&!saveTimerRef.current&&!engine.isBusy()){
        try{
          if(await engine.refresh()){
            applyDoc(engine.rebase(docRef.current));
            showToast("Atualizado com o que você fez em outro aparelho.","info");
          }
        }catch{/* sem rede agora; confere na próxima vez */}
      }
    };
    document.addEventListener("visibilitychange",onVisibility);
    // Voltou a conexão: envia o que ficou guardado no aparelho.
    const onOnline=()=>{if(syncStatusRef.current==="offline"||syncStatusRef.current==="error")runSaveRef.current().catch(()=>{});};
    window.addEventListener("online",onOnline);
    // Fallback: em navegadores/mobile onde `visibilitychange` não cobre a
    // navegação para fora do app (ex.: Safari iOS em alguns fluxos).
    window.addEventListener("pagehide",onVisibility);
    const warnIfDirty=e=>{
      if(!shouldWarnBeforeUnload({syncStatus:syncStatusRef.current}))return;
      e.preventDefault();
      e.returnValue="";
      return "";
    };
    window.addEventListener("beforeunload",warnIfDirty);
    return()=>{
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("pagehide",onVisibility);
      window.removeEventListener("beforeunload",warnIfDirty);
      window.removeEventListener("online",onOnline);
    };
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const retrySave=async()=>{
    if(saveTimerRef.current){clearTimeout(saveTimerRef.current);saveTimerRef.current=null;}
    setSyncStatus("saving");
    const status=await runSave();
    if(status==="saved"||status==="unchanged")showToast("Salvo na nuvem!","success");
    else if(status==="offline")showToast("Ainda sem conexão. O que você fez está guardado neste aparelho e vai para a nuvem quando a internet voltar.","info");
    else showToast("Ainda não consegui salvar na nuvem. Verifique sua conexão e tente novamente.","error");
  };


  // ---- Atalho global Ctrl+K / Cmd+K para pesquisa, Esc para fechar overlays ----
  // Esc agora fecha QUALQUER popup aberto (antes só fechava busca e "como é
  // calculado" — os outros ~9 modais só fechavam clicando fora ou no X).
  useEffect(()=>{
    const handler=e=>{
      const k=e.key.toLowerCase();
      if((e.ctrlKey||e.metaKey)&&k==="k"){e.preventDefault();setShowSearch(true);}
      else if(e.key==="Escape"){
        setShowSearch(false);
        setExplainKey(null);
        setConfirmDelete(null);
        setTransferPlanned(null);
        setTransferWish(null);
        setPendingImport(null);
        setShowClearConfirm(false);
        setDelInstId(null);
        setShowProfile(false);
        setSelectedCalDay(null);
        setShowTrash(false);
        setPendingDuplicateTx(null);
        setConfirmDiscard(null);
        // O modal de apagar conta não fecha no meio da operação (evita a
        // pessoa achar que cancelou uma exclusão que já está em andamento).
        if(!deleteAccountBusyRef.current){setDeleteAccountOpen(false);setDeleteAccountPhrase("");}
        setProjectionDrawer(null);
        cancelEditTxRef.current();
      }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[]);

  // ==================== HOOKS: leitura via Financial Intelligence Engine ====================
  // Meses disponíveis no filtro. Chaves inválidas ("???", vindas de um dado
  // legado com data corrompida) ficam de fora: elas não são selecionáveis de
  // forma útil e só sujavam o seletor.
  const months=useMemo(()=>{
    const s=new Set(transactions.map(t=>monthKey(t.date)).filter(k=>k!=="???"));
    return[...s].sort((a,b)=>monthIndex(a)-monthIndex(b));
  },[transactions]);
  const filtered=useMemo(()=>{let tx=filterMonth?transactions.filter(t=>monthKey(t.date)===filterMonth):transactions;if(filterCat)tx=tx.filter(t=>t.cat===filterCat);if(filterType)tx=tx.filter(t=>t.type===filterType);if(search.trim())tx=tx.filter(t=>t.desc.toLowerCase().includes(search.toLowerCase()));return tx;},[transactions,filterMonth,filterCat,filterType,search]);

  // ---- Escopo dos números: REALIZADO (global) x VISÃO (filtrada) ----------
  // Duas confusões moravam aqui e distorciam praticamente todos os indicadores:
  //
  // 1) O saldo saía de `filtered`, então qualquer filtro da aba Transações
  //    (mês, categoria, tipo, busca) mudava o "Saldo Atual", o Patrimônio e a
  //    saúde financeira do Dashboard — filtrar por "Lazer" fazia o usuário
  //    parecer ter só os gastos de lazer no patrimônio.
  //
  // 2) O saldo somava lançamentos com data FUTURA. Mas `freeBalance` e
  //    `projectionAt*` já assumem que o saldo contém apenas o realizado (elas
  //    subtraem/somam o futuro por conta própria). Resultado: toda saída futura
  //    era contada duas vezes. É a causa raiz do parcelamento derrubar o
  //    patrimônio pelo valor TOTAL da compra no dia da criação.
  //
  // A partir daqui: `realized` (data <= hoje, sem filtros de tela) alimenta
  // saldo/patrimônio/indicadores/projeções; `filtered` alimenta apenas o que a
  // aba Transações está exibindo (lista, gráfico de categorias e o resumo dela).
  const realized=useMemo(()=>transactions.filter(t=>t.date<=todayISO),[transactions,todayISO]);

  const invNet=useMemo(()=>FinancialEngine.CashFlowAnalyzer.investmentNet(realized),[realized]);
  const {totalIn,totalOut,balance}=useMemo(()=>FinancialEngine.CashFlowAnalyzer.totals(realized),[realized]);
  // Totais da visão filtrada — exclusivos da aba Transações.
  // Totais da visão filtrada — o único consumidor é o resumo da aba Transações.
  const viewTotals=useMemo(()=>FinancialEngine.CashFlowAnalyzer.totals(filtered),[filtered]);
  const summary=useMemo(()=>FinancialEngine.CashFlowAnalyzer.monthlySummary(transactions),[transactions]);
  // Gasto por categoria: alimenta o Dashboard ("onde seu dinheiro foi") e o
  // insight de maior categoria — ambos globais. Antes saía de `filtered`, então
  // um filtro esquecido na aba Transações reescrevia o Dashboard inteiro.
  const catDataGlobal=useMemo(()=>FinancialEngine.ExpenseAnalyzer.byCategory(realized,invNet),[realized,invNet]);
  const catDataDisplay=useMemo(()=>FinancialEngine.ExpenseAnalyzer.displayTop(catDataGlobal),[catDataGlobal]);
  const groupedByDate=useMemo(()=>{const g={};[...filtered].forEach(t=>{if(!g[t.date])g[t.date]=[];g[t.date].push(t);});return Object.entries(g).sort((a,b)=>b[0].localeCompare(a[0]));},[filtered]);
  const txMap=useMemo(()=>new Map(transactions.map(t=>[t.id,t])),[transactions]);
  const instStats=useMemo(()=>FinancialEngine.BudgetAnalyzer.installmentStats(installments,txMap,todayFn()),[installments,txMap]);
  const monthlyPreview=useMemo(()=>FinancialEngine.BudgetAnalyzer.monthlyInstallment(parseNum(instDraft.totalVal),parseInt(instDraft.numParcelas)),[instDraft.totalVal,instDraft.numParcelas]);
  // Variação percentual com base ASSINADA corretamente.
  // (cur-prev)/prev é matematicamente correto, mas inverte o sinal quando o mês
  // anterior foi negativo: sair de -154 para -103 (uma MELHORA de R$ 51) exibia
  // "-33%", e piorar de -103 para -358 exibia "+249%". Dividir pelo módulo da
  // base preserva a direção real: saldo subiu = positivo/verde, sempre.
  // prev===0 não tem variação percentual definida — devolve null para a UI
  // mostrar "—" em vez de fingir 0%.
  const pctChange=(cur,prev)=>{
    if(prev===0)return cur===0?0:null;
    return Math.round((cur-prev)/Math.abs(prev)*100);
  };

  const plannedItemsForMonth=useMemo(()=>FinancialEngine.BudgetAnalyzer.itemsForMonth(plannedExpenses,plannedMonth),[plannedExpenses,plannedMonth]);
  // Ordenação (não pagos primeiro, por valor) memoizada — antes era recalculada
  // a cada render do componente inteiro (ex.: a cada tecla digitada em
  // qualquer formulário aberto na tela), mesmo sem a lista ter mudado.
  const sortedPlannedItemsForMonth=useMemo(()=>[...plannedItemsForMonth].sort((a,b)=>{
    const pa=!!a.paid?.[plannedMonth],pb=!!b.paid?.[plannedMonth];
    if(pa!==pb)return pa?1:-1;
    return b.val-a.val;
  }),[plannedItemsForMonth,plannedMonth]);
  const plannedStats=useMemo(()=>FinancialEngine.BudgetAnalyzer.stats(plannedItemsForMonth,plannedMonth),[plannedItemsForMonth,plannedMonth]);

  const currentMonthKeyReal=monthKey(todayFn());

  const fixedVarSplit=useMemo(()=>FinancialEngine.ExpenseAnalyzer.fixedVarSplit(realized),[realized]);
  const patrimonioLiquido=balance+invNet;
  // Evolução do patrimônio no Início: até 12 meses, a partir do primeiro com lançamento.
  const patrimonySeries=useMemo(()=>{
    const all=FinancialEngine.CashFlowAnalyzer.patrimonyByMonth(realized,monthKey(todayISO));
    const start=all.findIndex(p=>p.hasData);
    return start<0?[]:all.slice(start);
  },[realized,todayISO]);
  const savingsRate=FinancialEngine.IncomeAnalyzer.savingsRate(balance,totalIn);
  const committedIncome=FinancialEngine.IncomeAnalyzer.committedRatio(totalIn,totalOut);
  const reservaFinanceira=useMemo(()=>wishes.reduce((s,w)=>s+(w.saved||0),0),[wishes]);
  const avgMonthlyOut=useMemo(()=>summary.length?summary.reduce((s,m)=>s+m.out,0)/summary.length:0,[summary]);
  const reservaMeses=avgMonthlyOut>0?Math.round((reservaFinanceira/avgMonthlyOut)*10)/10:null;

  const projection=useMemo(()=>FinancialEngine.ForecastEngine.endOfMonthProjection({transactions,plannedExpenses,currentMonthKey:currentMonthKeyReal}),[transactions,plannedExpenses,currentMonthKeyReal]);
  const subscriptions=useMemo(()=>FinancialEngine.BudgetAnalyzer.subscriptions(plannedExpenses,plannedMonth),[plannedExpenses,plannedMonth]);
  const investmentStats=useMemo(()=>FinancialEngine.InvestmentAnalyzer.stats(transactions),[transactions]);
  const investmentParticipacao=investmentStats?FinancialEngine.InvestmentAnalyzer.participacao(invNet,patrimonioLiquido):null;
  const avgMonthlySavings=useMemo(()=>FinancialEngine.GoalAnalyzer.avgMonthlySavings(summary),[summary]);
  const pendingParcelasCount=useMemo(()=>FinancialEngine.BudgetAnalyzer.pendingInstallmentsCount(installments,txMap,todayFn()),[installments,txMap]);

  // ==================== PLANEJAMENTO / FORECAST (via Engine) ====================
  const plannedById=useMemo(()=>new Map(plannedExpenses.map(p=>[p.id,p])),[plannedExpenses]);
  const eventMeta=t=>FinancialEngine.ForecastEngine.eventMeta(t,plannedById);
  const txByDate=useMemo(()=>FinancialEngine.ForecastEngine.groupByDate(transactions),[transactions]);

  const nextMonthKeyReal=useMemo(()=>{
    const idx=monthIndex(currentMonthKeyReal);
    return idx>=0?monthAt(idx+1):currentMonthKeyReal;
  },[currentMonthKeyReal]);

  const committedNextMonth=useMemo(()=>FinancialEngine.BudgetAnalyzer.committedForMonth({transactions,plannedExpenses,month:nextMonthKeyReal,todayISO}),[transactions,plannedExpenses,nextMonthKeyReal,todayISO]);
  const committedNext3Months=useMemo(()=>FinancialEngine.BudgetAnalyzer.committedNextMonths({transactions,plannedExpenses,currentMonthKey:currentMonthKeyReal,todayISO,count:3}),[transactions,plannedExpenses,currentMonthKeyReal,todayISO]);
  const cashFlowProjections=useMemo(()=>FinancialEngine.CashFlowAnalyzer.projections({transactions,plannedExpenses,balance,todayISO,currentMonthKey:currentMonthKeyReal}),[transactions,plannedExpenses,balance,currentMonthKeyReal,todayISO]);
  const enhancedWishes=useMemo(()=>FinancialEngine.GoalAnalyzer.enhance(wishes,avgMonthlySavings),[wishes,avgMonthlySavings]);
  const timelineBuckets=useMemo(()=>FinancialEngine.ForecastEngine.timeline({transactions,plannedExpenses,plannedById,todayISO,currentMonthKey:currentMonthKeyReal,nextMonthKey:nextMonthKeyReal}),[transactions,plannedExpenses,plannedById,todayISO,currentMonthKeyReal,nextMonthKeyReal]);
  const reminders=useMemo(()=>FinancialEngine.ForecastEngine.reminders({transactions,plannedExpenses,plannedById,enhancedWishes,todayISO,currentMonthKey:currentMonthKeyReal}),[transactions,plannedExpenses,plannedById,enhancedWishes,todayISO,currentMonthKeyReal]);
  const nextEvents=useMemo(()=>FinancialEngine.ForecastEngine.nextEvents({transactions,todayISO}),[transactions,todayISO]);
  const calGrid=useMemo(()=>FinancialEngine.ForecastEngine.monthGrid({year:calYear,monthIdx:calMonthIdx,txByDate,plannedById}),[calYear,calMonthIdx,txByDate,plannedById]);

  const calMonthLabel=`${MONTH_NAMES_FULL[calMonthIdx]} de ${calYear}`;
  const shiftCalMonth=delta=>{
    let m=calMonthIdx+delta,y=calYear;
    if(m<0){m=11;y--;}else if(m>11){m=0;y++;}
    setCalMonthIdx(m);setCalYear(y);
  };
  const selectedDayEvents=selectedCalDay?(txByDate[selectedCalDay]||[]).map(t=>({...t,...eventMeta(t)})):[];

  // ---- Decision Engine: respostas automáticas (agora com breakdown auditável) ----
  const decisions=useMemo(()=>[
    FinancialEngine.DecisionEngine.isWithinBudget({plannedStats,plannedItemsForMonth,month:plannedMonth}),
    FinancialEngine.DecisionEngine.isReserveHealthy({reservaMeses,reservaFinanceira,avgMonthlyOut,enhancedWishes}),
    FinancialEngine.DecisionEngine.willCashFlowGoNegative({cashFlowProjections,transactions,plannedExpenses,balance,todayISO,currentMonthKey:currentMonthKeyReal}),
    FinancialEngine.DecisionEngine.willGoalsFinishOnTime({enhancedWishes}),
  ],[plannedStats,plannedItemsForMonth,plannedMonth,reservaMeses,reservaFinanceira,avgMonthlyOut,enhancedWishes,cashFlowProjections,transactions,plannedExpenses,balance,todayISO,currentMonthKeyReal]);

  const runSimulation=()=>{
    if(simType==="economizar_mais"){
      const goal=enhancedWishes.find(w=>String(w.id)===String(simGoalId));
      if(!goal){setSimResult({type:"economizar_mais",data:null});return;}
      const data=FinancialEngine.SimulationEngine.economizarMais({extraPerMonth:parseNum(simExtra),remaining:goal.remaining,currentMonthly:avgMonthlySavings,estMonths:goal.estMonths});
      setSimResult({type:"economizar_mais",data});
    }else if(simType==="compra_grande"){
      const data=FinancialEngine.SimulationEngine.compraGrande({value:parseNum(simValue),parcelas:parseInt(simParcelas)||1,committedNextMonth});
      setSimResult({type:"compra_grande",data});
    }else if(simType==="investir_mensal"){
      const data=FinancialEngine.SimulationEngine.investirMensal({value:parseNum(simValue),months:parseInt(simMonths)||0,expectedReturnPctAnual:parseNum(simReturn)});
      setSimResult({type:"investir_mensal",data});
    }
  };

  const normDescKey=s=>{
    let x=(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    x=x.replace(/\d+/g," ");
    x=x.replace(/[^a-z\s]/g," ");
    x=x.replace(/\s+/g," ").trim();
    return x;
  };
  const frequentTx=useMemo(()=>{
    const rawGroups={};
    transactions.forEach(t=>{
      const key=normDescKey(t.desc);
      if(!key)return;
      if(!rawGroups[key])rawGroups[key]=[];
      rawGroups[key].push(t);
    });
    const sortedKeys=Object.keys(rawGroups).sort((a,b)=>b.length-a.length);
    const clusters=[];
    sortedKeys.forEach(k=>{
      let found=null;
      for(const cl of clusters){
        if(k.length>=3&&(cl.rep.includes(k)||k.includes(cl.rep))){found=cl;break;}
      }
      if(found)found.txs.push(...rawGroups[k]);
      else clusters.push({rep:k,txs:[...rawGroups[k]]});
    });
    return clusters
      .map(cl=>{
        const last=[...cl.txs].sort((a,b)=>b.date.localeCompare(a.date))[0];
        return{txs:cl.txs,last};
      })
      .filter(({txs,last})=>txs.length>=(last.fixed==="Fixa"?2:5))
      .map(({txs,last})=>{
        const avgVal=txs.reduce((s,t)=>s+t.val,0)/txs.length;
        return{desc:last.desc,cat:last.cat,val:avgVal,form:last.form,fixed:last.fixed,type:last.type,invTipo:last.invTipo,count:txs.length};
      })
      .sort((a,b)=>b.count-a.count||a.desc.localeCompare(b.desc))
      .slice(0,15);
  },[transactions]);

  const healthIndicators=useMemo(()=>FinancialEngine.HealthScoreEngine.compute({savingsRate,committedIncome,fixedVarSplit,patrimonio:patrimonioLiquido,balance,reservaMeses,reservaFinanceira}),[savingsRate,committedIncome,fixedVarSplit,patrimonioLiquido,balance,reservaMeses,reservaFinanceira]);

  // ---- Insight Engine: contexto único usado tanto pelos cartões de consultor
  // quanto pelo resumo do mês. Nesta sprint o contexto ganhou alguns campos
  // brutos adicionais (plannedExpenses, plannedItemsForMonth, plannedMonth,
  // balance, totalIn, totalOut, invNet) — não para mudar nenhuma conta, mas
  // para que os geradores consigam montar o `breakdown` (evidência real) sem
  // recalcular nada que o componente já calculou. ----
  const insightCtx=useMemo(()=>({
    transactions,
    currentMonthKey:currentMonthKeyReal,
    plannedStats,
    plannedItemsForMonth,
    plannedMonth,
    plannedExpenses,
    cashFlowProjections,
    committedIncome,
    todayISO,
    reservaMeses,
    reservaFinanceira,
    avgMonthlyOut,
    balance,
    totalIn,
    totalOut,
    invNet,
    enhancedWishes,
    avgMonthlySavings,
    summary,
    investmentParticipacao,
    patrimonio:patrimonioLiquido,
  }),[transactions,currentMonthKeyReal,plannedStats,plannedItemsForMonth,plannedMonth,plannedExpenses,cashFlowProjections,committedIncome,todayISO,reservaMeses,reservaFinanceira,avgMonthlyOut,balance,totalIn,totalOut,invNet,enhancedWishes,avgMonthlySavings,summary,investmentParticipacao,patrimonioLiquido]);

  // Máximo 4 cartões, já ordenados por prioridade real (Alta > Média > Baixa)
  const consultantInsights=useMemo(()=>InsightEngine.generate(insightCtx),[insightCtx]);
  const resumoDoMes=useMemo(()=>InsightEngine.generateSummary(insightCtx),[insightCtx]);

  // ---- Mapeamento de apresentação: o Engine devolve `type`, o componente decide ícone/cor ----
  const reminderVisual=type=>({
    parcela:{Ic:CreditCard,c:"#FBBF24"},
    assinatura:{Ic:Repeat,c:"#A78BFA"},
    conta:{Ic:Bell,c:"#F87171"},
    pagamento:{Ic:Bell,c:"#F87171"},
    previsto:{Ic:Bell,c:"#FBBF24"},
    meta:{Ic:Trophy,c:"#34D399"},
  }[type]||{Ic:Bell,c:TX2});
  const decisionColor=status=>DECISION_STATUS_COLOR[status]||TX3;

  // ==================== HOME INTELIGENTE (Centro de Decisões) ====================
  const freeBalance=useMemo(()=>FinancialEngine.CashFlowAnalyzer.freeBalance({transactions,plannedExpenses,balance,todayISO,currentMonthKey:currentMonthKeyReal}),[transactions,plannedExpenses,balance,todayISO,currentMonthKeyReal]);
  const freeBalanceBreakdown=useMemo(()=>{
    const futureOut=transactions.filter(t=>t.date>todayISO&&t.type==="Saída"&&t.cat!=="Investimento").reduce((s,t)=>s+t.val,0);
    const plannedPending=plannedExpenses.filter(p=>PlannedStatus.appliesTo(p,currentMonthKeyReal)).reduce((s,p)=>s+(PlannedStatus.isPending(p,currentMonthKeyReal)?p.val:0),0);
    return{futureOut,plannedPending};
  },[transactions,plannedExpenses,todayISO,currentMonthKeyReal]);

  const daysInCurMonth=new Date(todayDateObj.getFullYear(),todayDateObj.getMonth()+1,0).getDate();
  const daysToEndOfMonth=Math.max(0,daysInCurMonth-todayDateObj.getDate());
  const moneySteps=useMemo(()=>{
    const base={transactions,plannedExpenses,balance,todayISO,currentMonthKey:currentMonthKeyReal};
    return [
      {label:"Hoje",value:balance},
      {label:"7 dias",value:FinancialEngine.CashFlowAnalyzer.projectionAt({...base,daysAhead:7})},
      {label:"15 dias",value:FinancialEngine.CashFlowAnalyzer.projectionAt({...base,daysAhead:15})},
      {label:"Fim do mês",value:FinancialEngine.CashFlowAnalyzer.projectionAt({...base,daysAhead:daysToEndOfMonth})},
    ];
  },[transactions,plannedExpenses,balance,todayISO,currentMonthKeyReal,daysToEndOfMonth]);

  const upcomingEvents=useMemo(()=>[...transactions].filter(t=>t.date>todayISO).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6).map(t=>({...t,...FinancialEngine.ForecastEngine.eventMeta(t,plannedById)})),[transactions,todayISO,plannedById]);

  // ---- Explicação dos indicadores: gera confiança mostrando como cada número foi calculado ----
  const MAIN_EXPLAIN={
    saldoAtual:{
      title:"Saldo Atual",
      calc:"Soma de todas as receitas menos todas as despesas com data até hoje (incluindo parcelas já vencidas), descontando aportes e somando resgates de investimentos. Lançamentos com data futura NÃO entram aqui — eles aparecem no Saldo Livre e nas projeções.",
      factors:["Transações de entrada e saída com data até hoje","Aportes e resgates de investimentos já lançados","Não é afetado pelos filtros da aba Transações"],
      meaning:"É o dinheiro que efetivamente existe na sua conta neste momento.",
      improve:["Registrar as transações assim que acontecerem","Conferir se todos os lançamentos passados estão corretos"],
    },
    saldoLivre:{
      title:"Saldo Livre",
      calc:`Saldo Atual (${fmt(balance)}) menos ${fmt(freeBalanceBreakdown.futureOut)} em saídas futuras já cadastradas (parcelas e lançamentos futuros) e ${fmt(freeBalanceBreakdown.plannedPending)} em previstos deste mês ainda não pagos.`,
      factors:["Parcelamentos em aberto","Contas e assinaturas previstas para este mês ainda não pagas","Lançamentos futuros já cadastrados"],
      meaning:"Mostra quanto do seu saldo atual já está comprometido com compromissos que ainda vão sair da conta.",
      improve:["Quitar ou renegociar parcelas com juros altos","Cancelar assinaturas que você não usa mais","Manter os previstos atualizados para refletir a realidade"],
    },
  };
  // Nota: "Previsto no Fim do Mês" e "Quanto você pode gastar" deixaram de
  // usar este texto genérico — agora abrem o ProjectionDrawer (item por
  // item, agrupado por categoria, editável). Ver setProjectionDrawer abaixo.
  const HEALTH_EXPLAIN={
    "Taxa de economia":{factors:["Total de receitas do período selecionado","Total de despesas do período selecionado"],improve:["Reduzir gastos variáveis","Buscar receitas extras","Definir um valor fixo de economia mensal"]},
    "Receita comprometida":{factors:["Despesas totais, incluindo aportes","Receitas totais do período"],improve:["Renegociar dívidas e assinaturas","Reduzir despesas fixas"]},
    "Gasto fixo":{factors:["Transações marcadas como 'Fixa'"],improve:["Revisar assinaturas e contas recorrentes","Buscar planos mais baratos"]},
    "Gasto variável":{factors:["Transações marcadas como 'Variável'"],improve:["Acompanhar os gastos do dia a dia","Definir um limite mensal por categoria"]},
    "Patrimônio líquido":{factors:["Saldo disponível","Valor líquido investido (aportes menos resgates)"],improve:["Aumentar aportes mensais","Evitar resgates desnecessários"]},
    "Saldo disponível":{factors:["Receitas menos despesas do período selecionado"],improve:["Aumentar receitas","Reduzir despesas não essenciais"]},
    "Reserva financeira":{factors:["Total guardado em metas","Gasto médio mensal dos últimos meses"],improve:["Aumentar o valor guardado nas metas","Priorizar uma reserva de emergência"]},
  };
  const getExplain=key=>{
    if(!key)return null;
    if(key.startsWith("health:")){
      const label=key.slice(7);
      const h=healthIndicators.find(x=>x.label===label);
      if(!h)return null;
      const extra=HEALTH_EXPLAIN[label]||{factors:[],improve:[]};
      return{title:h.label,calc:"Calculado automaticamente a partir dos seus lançamentos, sem inteligência artificial.",factors:extra.factors,meaning:`${h.desc} Valor atual: ${h.value}.`,improve:extra.improve};
    }
    return MAIN_EXPLAIN[key]||null;
  };

  // ---- Reset do formulário de lançamento -----------------------------------
  // Antes só descrição e valor eram limpos. Data, forma de pagamento,
  // fixo/variável e repetição ficavam grudados entre lançamentos: quem lançasse
  // uma compra atrasada (ex.: 02/01) via TODOS os lançamentos seguintes — de
  // qualquer tipo, inclusive depois de trocar de Saída para Aporte — saírem
  // com aquela data, sem nenhum aviso. Um único ponto de reset garante que
  // "formulário novo" signifique sempre a mesma coisa.
  const resetQuickAddForm=()=>{
    setQaDesc("");setQaVal("");
    setQaDate(todayFn());
    setQaForm("pix");
    setQaFixed("Variavel");
    setQaRepeat("none");
    setQaExpanded(false);
  };

  // ---- Ações rápidas (Home) ----
  const qaDescRef=useRef(null);
  // Novo lançamento numa folha que sobe de baixo, de qualquer tela (antes o
  // formulário morava no topo de Transações e as ações rápidas do Início
  // levavam até lá).
  const [showNewTx,setShowNewTx]=useState(false);
  const openNewTx=(type="despesa")=>quickAction(type);
  const closeNewTx=()=>{
    if(qaDesc.trim()||qaVal){setConfirmDiscard("newtx");return;}
    setShowNewTx(false);
  };
  const quickAction=type=>{
    if(type==="meta"){
      setTab("wishes");setEditingWish(null);setWishForm({name:"",price:"",saved:"",priority:"Média",monthsTarget:"",notes:""});setShowWishForm(true);
      return;
    }
    setShowNewTx(true);
    setEditingTx(null);
    resetQuickAddForm();
    if(type==="receita"){setQaType("Entrada");setQaCat("Salario / Entradas");}
    else if(type==="despesa"){setQaType("Saída");setQaCat("Alimentação");}
    else if(type==="resgate"){setQaCat("Investimento");setQaInvTipo("Resgate");setQaExpanded(true);}
    else if(type==="investimento"){setQaCat("Investimento");setQaInvTipo("Aporte");setQaExpanded(true);}
    setTimeout(()=>{qaValRef.current?.focus();},380);
  };

  const toggleNotes=key=>setExpandedNotes(p=>({...p,[key]:!p[key]}));

  // ---- Pesquisa Global (Ctrl+K) ----
  const searchResults=useMemo(()=>{
    const q=searchQuery.trim().toLowerCase();
    if(!q)return null;
    return{
      // txTotal: quantos casaram, para o "Ver todos" (a lista mostra só 6)
      txTotal:transactions.filter(t=>t.desc.toLowerCase().includes(q)).length,
      txRes:transactions.filter(t=>t.desc.toLowerCase().includes(q)).slice(0,6),
      catRes:fullCats.filter(c=>c.toLowerCase().includes(q)).slice(0,6),
      wishRes:wishes.filter(w=>w.name.toLowerCase().includes(q)||(w.notes||"").toLowerCase().includes(q)).slice(0,6),
      plannedRes:plannedExpenses.filter(p=>!p.recurring&&(p.desc.toLowerCase().includes(q)||(p.notes||"").toLowerCase().includes(q))).slice(0,6),
      recurringRes:plannedExpenses.filter(p=>p.recurring&&(p.desc.toLowerCase().includes(q)||(p.notes||"").toLowerCase().includes(q))).slice(0,6),
      invRes:transactions.filter(t=>t.cat==="Investimento"&&t.desc.toLowerCase().includes(q)).slice(0,6),
      instRes:installments.filter(i=>i.desc.toLowerCase().includes(q)).slice(0,6),
    };
  },[searchQuery,transactions,fullCats,wishes,plannedExpenses,installments]);

  const closeSearch=()=>{setShowSearch(false);setSearchQuery("");};
  const goToTx=t=>{setTab("transactions");setSearch(t.desc);closeSearch();};
  const goToAllTx=()=>{setTab("transactions");setSearch(searchQuery.trim());closeSearch();};
  const goToCat=c=>{setTab("transactions");setFilterCat(c);closeSearch();};
  const goToWish=()=>{setTab("wishes");closeSearch();};
  const goToPlanned=p=>{setTab("planned");if(!p.recurring&&p.month)setPlannedMonth(p.month);closeSearch();};
  const goToInst=()=>{setTab("installments");closeSearch();};
  // Deriva um atalho de ação para cada insight, a partir do que ele já usou como
  // evidência (categoria envolvida, metas, fluxo de caixa...). Assim todo card
  // deixa de ser só observação e vira um caminho pra agir/investigar.
  const insightActionFor=(it)=>{
    const cats=it.evidence?.categories||[];
    const used=it.evidence?.dataUsed||[];
    if(cats.length>0&&cats[0]!=="Investimento")return{label:`Ver lançamentos de ${cats[0]}`,onClick:()=>goToCat(cats[0])};
    if(used.includes("metas"))return{label:"Ver minhas metas",onClick:goToWish};
    if(used.includes("investimentos")||cats[0]==="Investimento")return{label:"Ver investimentos",onClick:()=>goToCat("Investimento")};
    if(used.some(u=>["saldo","receitas","contas","parcelas","assinaturas","previstos"].includes(u)))return{label:"Ver planejamento",onClick:()=>setTab("planning")};
    return{label:"Ver transações",onClick:()=>setTab("transactions")};
  };

  const [pendingDuplicateTx,setPendingDuplicateTx]=useState(null);
  // ---- BUG-01: trava de reentrância contra duplo clique/duplo submit ----
  // Um clique duplo rápido chama commitQuickAdd() duas vezes ANTES do
  // primeiro setState re-renderizar — nesse instante o componente ainda lê o
  // `transactions` antigo, então a checagem de duplicidade em quickAdd() não
  // pega o próprio clique duplo. O guard vive fora do ciclo de render (ref),
  // por isso barra a segunda chamada mesmo sem um render de por meio.
  const quickAddGuardRef=useRef(null);
  if(!quickAddGuardRef.current)quickAddGuardRef.current=createSubmitGuard({cooldownMs:600});
  const [isSubmittingTx,setIsSubmittingTx]=useState(false);
  const commitQuickAdd=()=>{
    const guard=quickAddGuardRef.current;
    if(!guard.tryEnter())return;
    setIsSubmittingTx(true);
    try{
      pushHistory();
      const isInv=qaCat==="Investimento";
      const derivedType=isInv?(qaInvTipo==="Aporte"?"Saída":"Entrada"):qaType;
      const base={date:qaDate,type:derivedType,fixed:qaFixed,cat:qaCat,desc:qaDesc.trim(),val:roundMoney(parseNum(qaVal)),form:qaForm,invTipo:isInv?qaInvTipo:null};
      if(editingTx!==null){setTransactions(p=>p.map(t=>t.id===editingTx?{...t,...base}:t));setEditingTx(null);}
      else{
        const id=genId();const newTxs=[{id,...base}];
        if(qaRepeat!=="none"){const cnt=qaRepeat==="3m"?2:qaRepeat==="6m"?5:11;for(let i=1;i<=cnt;i++){newTxs.push({id:id+i,...base,date:addMonthsStr(qaDate,i)});}}
        setTransactions(p=>[...newTxs,...p]);
      }
      resetQuickAddForm();
      if(editingTx===null){
        setShowNewTx(false);
        const len=historyRef.current.length;
        showToast("Lançamento adicionado.","success",{action:{label:"Desfazer",onClick:()=>undoIfLast(len)}});
      }else showToast("Lançamento atualizado.","success");
    }catch(e){
      // Falha inesperada durante o commit: libera o lock na hora em vez de
      // deixar o botão travado até o fim do cooldown sem nenhuma transação
      // criada, e deixa o erro seguir visível (mesmo comportamento de antes).
      guard.releaseNow();
      setIsSubmittingTx(false);
      throw e;
    }
    setTimeout(()=>setIsSubmittingTx(false),600);
  };
  const quickAdd=()=>{
    const err=firstError([
      validateText(qaDesc,{label:"descrição"}),
      validateAmount(qaVal,{label:"valor"}),
      validateDate(qaDate,{label:"data"}),
    ]);
    if(err){showToast(err,"error");return;}
    // Aviso suave de possível duplicidade: só ao CRIAR (não ao editar), e só
    // quando já existe um lançamento com mesma descrição+valor+data+tipo —
    // não bloqueia (compras repetidas de propósito existem), só confirma.
    if(editingTx===null){
      const dup=transactions.find(t=>t.desc.trim().toLowerCase()===qaDesc.trim().toLowerCase()&&t.val===parseNum(qaVal)&&t.date===qaDate&&t.type===(qaCat==="Investimento"?(qaInvTipo==="Aporte"?"Saída":"Entrada"):qaType));
      if(dup){setPendingDuplicateTx({desc:qaDesc.trim(),val:parseNum(qaVal)});return;}
    }
    commitQuickAdd();
  };
  const editTxSnapshotRef=useRef(null);
  const startEditTx=t=>{
    setEditingTx(t.id);setQaType(t.type);setQaDesc(t.desc);setQaVal(toDecimalStr(t.val));setQaCat(t.cat);setQaDate(t.date);setQaForm(t.form);setQaFixed(t.fixed);if(t.invTipo)setQaInvTipo(t.invTipo);setQaExpanded(true);
    editTxSnapshotRef.current=JSON.stringify({type:t.type,desc:t.desc,val:toDecimalStr(t.val),cat:t.cat,date:t.date,form:t.form,fixed:t.fixed});
  };
  const cancelEditTx=()=>{setEditingTx(null);resetQuickAddForm();setQaType("Saída");setQaCat("Alimentação");};
  // O atalho de Esc é registrado uma vez só; lê a versão atual por ref.
  cancelEditTxRef.current=cancelEditTx;
  // Fecha o modal de editar lançamento, mas confirma antes se algo foi
  // realmente alterado (evita perder edição sem querer ao clicar fora ou no X).
  const requestCloseEditTx=()=>{
    if(!isEditing){cancelEditTx();return;}
    const current=JSON.stringify({type:qaType,desc:qaDesc,val:qaVal,cat:qaCat,date:qaDate,form:qaForm,fixed:qaFixed});
    if(editTxSnapshotRef.current&&current!==editTxSnapshotRef.current)setConfirmDiscard("tx");
    else cancelEditTx();
  };
  // As listas excluem no segundo toque (ConfirmIconButton); o painel de
  // projeção continua passando pelo modal, que mostra o impacto no saldo.
  const performDelete=req=>{
    if(req.type==="wish")deleteWish(req.id);
    else if(req.type==="planned")deletePlannedItem(req.id);
    else if(req.type==="tx")deleteTx(req.id);
  };
  const deleteTx=id=>{
    const item=transactions.find(x=>x.id===id);
    pushHistory();
    setTransactions(p=>p.filter(x=>x.id!==id));
    if(item)moveToTrash("tx",item);
    // BUG-05: se a transação excluída era uma parcela, mantém o
    // parcelamento pai consistente (txIds/numParcelas/totalVal) em vez de
    // deixá-lo com um número de parcelas que não existem mais — antes disso
    // o card do parcelamento mentia permanentemente sobre quanto ainda falta.
    if(item?.installmentId)setInstallments(p=>removeTxFromInstallments(p,item));
    deletedToast("Lançamento");
  };

  const qaValRef=useRef(null);
  const plannedValRef=useRef(null);

  const applyFrequent=item=>{
    setQaDesc(item.desc);
    setQaVal(toDecimalStr(item.val));
    // Repetir um lançamento frequente é sempre "de novo, hoje" — nunca herda a
    // data do lançamento original nem a que ficou no formulário.
    setQaDate(todayFn());
    setQaCat(item.cat);
    setQaForm(item.form);
    setQaFixed(item.fixed);
    if(item.cat==="Investimento"&&item.invTipo)setQaInvTipo(item.invTipo);
    else setQaType(item.type);
    setTimeout(()=>{qaValRef.current?.focus();qaValRef.current?.select();},50);
  };
  const applyFrequentToPlanned=item=>{
    setPlannedForm(p=>({...p,desc:item.desc,val:toDecimalStr(item.val),cat:item.cat,form:item.form}));
    setTimeout(()=>{plannedValRef.current?.focus();plannedValRef.current?.select();},50);
  };

  const saveWish=()=>{
    const priceCheck=validateAmount(wishForm.price,{label:"preço"});
    const savedCheck=validateAmount(wishForm.saved,{label:"valor já guardado",required:false,allowZero:true});
    const err=firstError([
      validateText(wishForm.name,{label:"nome",maxLen:80}),
      priceCheck,
      savedCheck,
      validateInt(wishForm.monthsTarget,{label:"a meta em meses",required:false,min:1,max:600}),
      validateText(wishForm.notes,{label:"nota",required:false,maxLen:MAX_NOTES_LEN}),
    ]);
    if(err){showToast(err,"error");return;}
    if(savedCheck.value>priceCheck.value){showToast("O valor já guardado não pode ser maior que o preço da meta.","error");return;}
    pushHistory();
    const w={...wishForm,price:priceCheck.value,saved:savedCheck.value,monthsTarget:Math.abs(parseInt(wishForm.monthsTarget,10)||0)};
    if(editingWish!==null){setWishes(p=>p.map(x=>x.id===editingWish?{...x,...w}:x));setEditingWish(null);}
    else setWishes(p=>[...p,{...w,id:genId()}]);
    setShowWishForm(false);setWishForm({name:"",price:"",saved:"",priority:"Média",monthsTarget:"",notes:""});
    showToast("Meta salva!","success");
  };
  // Fecha o formulário de Desejo, mas confirma antes se algo foi digitado/
  // alterado e ainda não foi salvo.
  const closeWishForm=()=>{
    const current=JSON.stringify(wishForm);
    if(wishFormSnapshotRef.current&&current!==wishFormSnapshotRef.current)setConfirmDiscard("wish");
    else{setShowWishForm(false);setEditingWish(null);}
  };
  const deleteWish=id=>{
    const item=wishes.find(x=>x.id===id);
    pushHistory();
    setWishes(p=>p.filter(x=>x.id!==id));
    if(item)moveToTrash("wish",item);
    deletedToast("Meta");
  };
  // Sobe ou desce uma meta na lista que está na tela; a partir daí a lista
  // fica em "Minha ordem", começando da ordem que a pessoa estava vendo.
  const moveWish=(id,dir)=>{
    const list=[...sortedWishes];
    const i=list.findIndex(w=>w.id===id),j=i+dir;
    if(i<0||j<0||j>=list.length||!!list[i].done!==!!list[j].done)return;
    [list[i],list[j]]=[list[j],list[i]];
    const pos=new Map(list.map((w,k)=>[w.id,k]));
    pushHistory();
    setWishes(p=>p.map(w=>w.order===pos.get(w.id)?w:{...w,order:pos.get(w.id)}));
    setWishSortBy("manual");
  };
  const toggleWishDone=id=>{pushHistory();setWishes(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x));};

  // ---- Transferência Desejo -> Previsto ----
  // Abre o modal para completar os campos que só existem em Previstos
  // (categoria, forma de pagamento, recorrência/mês) antes de concluir.
  const openTransferToPlanned=w=>{
    setTransferWish({item:w,form:{cat:"Desejos",form:"pix",recurring:false,month:plannedMonth}});
  };
  const confirmTransferToPlanned=()=>{
    if(!transferWish)return;
    const{item,form}=transferWish;
    if(!form.recurring&&!form.month){showToast("Escolha o mês previsto para concluir a transferência.","error");return;}
    pushHistory();
    const payload=wishToPlannedPayload(item,form);
    if(payload.recurring)payload.from=plannedMonth; // começa no mês que está sendo visto
    // remoção da origem e criação no destino no mesmo lote de atualização,
    // sobre o mesmo snapshot de histórico -> operação atômica (undo desfaz as duas juntas)
    setPlannedExpenses(p=>[...p,{...payload,id:genId()}]);
    setWishes(p=>p.filter(x=>x.id!==item.id));
    setTransferWish(null);
    showToast("Item movido para Previstos.","success");
  };

  // ---- Transferência Previsto -> Desejo ----
  // Não há campo obrigatório extra do lado de Desejos, então basta confirmar.
  const openTransferToWish=item=>setTransferPlanned(item);
  const confirmTransferToWish=()=>{
    if(!transferPlanned)return;
    pushHistory();
    const payload=plannedToWishPayload(transferPlanned);
    setWishes(p=>[...p,{...payload,id:genId()}]);
    setPlannedExpenses(p=>p.filter(x=>x.id!==transferPlanned.id));
    setTransferPlanned(null);
    showToast("Item movido para Metas.","success");
  };

  // Converte "jul/26" + dia em ISO. O dia é limitado ao último dia REAL do mês
  // (28, 29, 30 ou 31 conforme o mês/ano bissexto). Antes era travado em 28
  // "por segurança", o que fazia um previsto pago em 31/07 nascer datado de
  // 28/07 — data errada, sem explicação para o usuário.
  const monthKeyToISO=(mk,day)=>{
    const [mon,yy]=(mk||"").split("/");
    const mIdx=MONTHS_ARR.indexOf(mon);
    if(mIdx<0)return todayFn();
    const year=2000+parseInt(yy,10);
    if(isNaN(year))return todayFn();
    const last=daysInMonth(year,mIdx);
    const d=Math.min(Math.max(day,1),last);
    return `${year}-${String(mIdx+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  };
  const shiftMonth=(mk,delta)=>{
    let idx=monthIndex(mk);
    if(idx<0)idx=monthIndex(monthKey(todayFn()));
    return monthAt(idx+delta);
  };
  const savePlannedItem=()=>{
    const err=firstError([
      validateText(plannedForm.desc,{label:"descrição"}),
      validateAmount(plannedForm.val,{label:"valor"}),
      validateText(plannedForm.notes,{label:"nota",required:false,maxLen:MAX_NOTES_LEN}),
    ]);
    if(err){showToast(err,"error");return;}
    const rec=plannedForm.recurring;
    if(rec&&plannedForm.hasUntil&&plannedForm.from&&monthIndex(plannedForm.until)<monthIndex(plannedForm.from)){showToast("O último mês precisa ser igual ou depois do mês em que começa.","error");return;}
    pushHistory();
    // Recorrente: `from` é o mês em que começa a contar e `until` o último
    // (o "Até"). Ver PlannedStatus.appliesTo em lib/financialEngine.js.
    const base={desc:plannedForm.desc.trim(),val:roundMoney(parseNum(plannedForm.val)),cat:plannedForm.cat,form:plannedForm.form,recurring:rec,month:rec?null:plannedForm.month,from:rec?(plannedForm.from||null):null,until:rec&&plannedForm.hasUntil?plannedForm.until:null,notes:plannedForm.notes||""};
    if(editingPlanned!==null){
      setPlannedExpenses(p=>p.map(x=>x.id===editingPlanned?{...x,...base}:x));
      setEditingPlanned(null);
    }else{
      setPlannedExpenses(p=>[...p,{...base,id:genId(),paid:{},ignored:{}}]);
    }
    setShowPlannedForm(false);
    setPlannedForm({desc:"",val:"",cat:"Assinaturas",form:"pix",recurring:false,month:plannedMonth,from:plannedMonth,hasUntil:false,until:plannedMonth,notes:""});
    showToast("Previsto salvo!","success");
  };
  // Fecha o formulário de Previsto, mas confirma antes se algo foi digitado/
  // alterado e ainda não foi salvo.
  const closePlannedForm=()=>{
    const current=JSON.stringify(plannedForm);
    if(plannedFormSnapshotRef.current&&current!==plannedFormSnapshotRef.current)setConfirmDiscard("planned");
    else{setShowPlannedForm(false);setEditingPlanned(null);}
  };
  const startEditPlanned=item=>{
    setEditingPlanned(item.id);
    // `from` vazio = "desde sempre" (recorrentes cadastrados antes desta regra)
    const snap={desc:item.desc,val:toDecimalStr(item.val),cat:item.cat,form:item.form,recurring:item.recurring,month:item.month||plannedMonth,from:item.recurring?(item.from||""):plannedMonth,hasUntil:!!item.until,until:item.until||plannedMonth,notes:item.notes||""};
    setPlannedForm(snap);
    plannedFormSnapshotRef.current=JSON.stringify(snap);
    setShowPlannedForm(true);
  };
  const deletePlannedItem=id=>{
    const item=plannedExpenses.find(x=>x.id===id);
    pushHistory();
    setPlannedExpenses(p=>p.filter(x=>x.id!==id));
    if(item)moveToTrash("planned",item);
    deletedToast("Previsto");
  };
  // ---- Marcar/desmarcar como pago, para um mês específico -------------------
  // Recebe o mês explicitamente (em vez de sempre usar `plannedMonth`, o mês
  // selecionado na aba Previstos) porque o drawer de projeção do dashboard
  // mostra itens de vários meses ao mesmo tempo (30 dias pode atravessar a
  // virada do mês) — cada item ali sabe o próprio mês.
  const togglePlannedPaidForMonth=(item,month)=>{
    pushHistory();
    const paidTxId=item.paid?.[month];
    if(paidTxId){
      setTransactions(p=>p.filter(t=>t.id!==paidTxId));
      setPlannedExpenses(p=>p.map(x=>x.id===item.id?{...x,paid:{...x.paid,[month]:undefined}}:x));
    }else{
      const txId=genId();
      const date=monthKeyToISO(month,new Date().getDate());
      const newTx={id:txId,date,type:"Saída",fixed:item.recurring?"Fixa":"Variavel",cat:item.cat,desc:item.desc,val:item.val,form:item.form,invTipo:null,plannedId:item.id};
      setTransactions(p=>[newTx,...p]);
      setPlannedExpenses(p=>p.map(x=>x.id===item.id?{...x,paid:{...x.paid,[month]:txId}}:x));
    }
  };
  const togglePlannedPaid=item=>togglePlannedPaidForMonth(item,plannedMonth);

  // ---- Ignorar um previsto recorrente só num mês (sem apagar o cadastro) ----
  // Ex.: assinatura pausada esse mês, conta que excepcionalmente não vai
  // vencer dessa vez. Diferente de excluir (que apaga o previsto pra sempre)
  // e diferente de marcar como pago (que cria uma transação real). O item
  // continua existindo e volta a contar normalmente no mês seguinte — ou a
  // qualquer momento, se a pessoa desfizer.
  const togglePlannedIgnoredForMonth=(item,month)=>{
    pushHistory();
    const isIgnored=!!item.ignored?.[month];
    setPlannedExpenses(p=>p.map(x=>x.id===item.id?{...x,ignored:{...x.ignored,[month]:isIgnored?undefined:true}}:x));
    return!isIgnored;
  };
  // ---- Encerrar um recorrente: conta até `month` e some depois; os meses anteriores ficam ----
  const endPlannedAt=(item,month)=>{
    pushHistory();
    setPlannedExpenses(p=>p.map(x=>x.id===item.id?{...x,until:month}:x));
    const len=historyRef.current.length;
    showToast(`"${item.desc}" conta até ${month}.`,"info",{action:{label:"Desfazer",onClick:()=>undoIfLast(len)}});
  };
  // ---- Transforma um previsto de "só este mês" em recorrente todo mês ----
  const makePlannedRecurring=item=>{
    pushHistory();
    // passa a contar a partir do mês em que estava previsto
    setPlannedExpenses(p=>p.map(x=>x.id===item.id?{...x,recurring:true,month:null,from:x.month||null}:x));
    showToast(`"${item.desc}" agora é recorrente (todo mês).`,"success");
  };

  const importCSV=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const text=ev.target.result.replace(/^\uFEFF/,"");
      const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      if(lines.length===0){showToast("Arquivo vazio.","error");return;}

      const parseLine=parseCsvLine;
      const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

      const first=parseLine(lines[0]);
      const headerNorm=first.map(norm);
      const looksLikeHeader=headerNorm.some(h=>h.includes("data")||h.includes("tipo")||h.includes("descri")||h.includes("valor"));

      let colIdx={};let dataLines;
      if(looksLikeHeader){
        dataLines=lines.slice(1);
        headerNorm.forEach((h,i)=>{
          if(h.includes("valor tratado"))colIdx.valTratado=i;
          else if(h.includes("valor")&&colIdx.val===undefined)colIdx.val=i;
          else if(h.includes("data")&&colIdx.date===undefined)colIdx.date=i;
          else if((h.includes("invtipo")||h.includes("tipo invest")))colIdx.invTipo=i;
          else if(h.includes("tipo")&&colIdx.type===undefined)colIdx.type=i;
          else if((h.includes("fixa")||h.includes("fixo")||h.includes("variavel"))&&colIdx.fixed===undefined)colIdx.fixed=i;
          else if(h.includes("categoria")&&colIdx.cat===undefined)colIdx.cat=i;
          else if(h.includes("descri")&&colIdx.desc===undefined)colIdx.desc=i;
          else if(h.includes("forma")&&colIdx.form===undefined)colIdx.form=i;
        });
      }else{
        dataLines=lines;
        colIdx={date:0,type:1,invTipo:2,fixed:3,cat:4,desc:5,val:6,form:7};
      }

      if(colIdx.date===undefined||colIdx.desc===undefined||(colIdx.val===undefined&&colIdx.valTratado===undefined)){
        showToast("Não consegui identificar as colunas de Data, Descrição e Valor.","error");
        return;
      }

      const existingLower=new Map(fullCats.map(c=>[c.toLowerCase(),c]));
      const newCatsFound=new Map();
      let imported=0,skipped=0;const newTx=[];
      dataLines.forEach((line,i)=>{
        const cols=parseLine(line);
        if(cols.length<2)return;
        // Mesmas regras do formulário (data que existe, valor com teto e
        // arredondado, descrição com limite): ver lib/csv.js.
        const parsed=csvRowToTx(cols,colIdx);
        if(!parsed.ok){skipped++;return;}
        const {date,type,fixed,rawCat,desc,val,form}=parsed.row;
        let {invTipo}=parsed.row;

        let matchedCat=rawCat?(existingLower.get(rawCat.toLowerCase())||newCatsFound.get(rawCat.toLowerCase())):null;
        if(!matchedCat&&rawCat){matchedCat=rawCat;newCatsFound.set(rawCat.toLowerCase(),matchedCat);}
        const cat=matchedCat||"Outros";
        if(cat==="Investimento"&&!invTipo)invTipo=type==="Saída"?"Aporte":"Resgate";

        newTx.push({id:genId(),date,type,fixed,cat,desc,val,form,invTipo});
        imported++;
      });

      if(imported>0){
        pushHistory();
        if(newCatsFound.size>0)setCustomCats(prev=>[...prev,...newCatsFound.values()]);
        setTransactions(p=>{const keys=new Set(p.map(t=>`${t.date}|${t.desc}|${t.val}`));return[...p,...newTx.filter(t=>!keys.has(`${t.date}|${t.desc}|${t.val}`))];});
        const catMsg=newCatsFound.size>0?` ${newCatsFound.size} categoria(s) nova(s): ${[...newCatsFound.values()].join(", ")}.`:"";
        showToast(`${imported} linha(s) importada(s)!${skipped?` (${skipped} ignoradas)`:""}${catMsg}`,"success");
      }else{
        showToast("Nenhuma linha válida encontrada.","error");
      }
    };
    reader.readAsText(file,"UTF-8");e.target.value="";
  };

  const exportCSV=()=>{
    try{
      // Células entre aspas e protegidas contra fórmula (ver lib/csv.js).
      const csv=buildTxCsv(transactions);
      const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
      const url=URL.createObjectURL(blob);const a=document.createElement("a");
      a.href=url;a.download=`lacalle-finance_${filterMonth||"todos"}.csv`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
      showToast("CSV exportado!","success");
    }catch(err){showToast("Erro ao exportar: "+err.message,"error");}
  };
  const saveProfile=()=>{
    setProfileMsg("");
    if(newName.trim()){
      setUser(u=>({...u,name:newName.trim()}));
      // O nome também vive na conta (user_metadata): sem isto, a renovação da
      // sessão, mais ou menos de hora em hora, trazia o nome antigo de volta.
      supabase.auth.updateUser({data:{name:newName.trim()}}).catch(()=>{});
    }
    setProfileMsg("Salvo!");setTimeout(()=>setProfileMsg(""),2500);
  };
  // Exclusão definitiva da conta. Antes era um window.confirm — um único clique
  // em "OK" apagava conta e histórico financeiro inteiro, sem volta e sem
  // lixeira. Agora exige digitar uma frase exata: é a barreira mínima esperada
  // de um app financeiro para uma ação irreversível.
  const ACCOUNT_DELETE_PHRASE="APAGAR MINHA CONTA";
  const closeDeleteAccount=()=>{setDeleteAccountOpen(false);setDeleteAccountPhrase("");};
  const deleteAccount=()=>{
    if(deleteAccountPhrase.trim().toUpperCase()!==ACCOUNT_DELETE_PHRASE)return;
    if(deleteAccountBusyRef.current)return; // trava reentrada (duplo clique)
    deleteAccountBusyRef.current=true;
    setDeleteAccountBusy(true);
    (async()=>{
      try{
        // Chama a Edge Function (roda no servidor) que apaga os dados E a
        // conta de autenticação de verdade — não é possível fazer isso com
        // segurança direto do navegador (exigiria expor uma chave que dá
        // acesso total ao banco).
        //
        // Só tratamos como concluído quando a function realmente confirma
        // sucesso — nada de deslogar/fechar o modal "no otimismo". Se essa
        // chamada falhar (rede, CORS, function fora do ar), a pessoa
        // continua logada e vê um erro claro, podendo tentar de novo — em
        // vez de sair da tela achando que a conta sumiu quando na verdade
        // só a sessão local caiu e a conta real continua existindo.
        const{error}=await supabase.functions.invoke("delete-account");
        if(error){
          // A função só apaga com login recente (ver supabase/functions/delete-account).
          const body=await error.context?.json?.().catch(()=>null);
          if(body?.code==="reauth_required"){
            deleteAccountBusyRef.current=false;
            setDeleteAccountBusy(false);
            showToast("Por segurança, entre de novo com sua senha e apague a conta logo em seguida.","info",{action:{label:"Sair e entrar",onClick:()=>setUser(null)}});
            return;
          }
          throw error;
        }
        deleteAccountBusyRef.current=false;
        setDeleteAccountBusy(false);
        closeDeleteAccount();
        setUser(null);
      }catch(e){
        console.error("LaCalle Finance — erro ao apagar conta:",e);
        deleteAccountBusyRef.current=false;
        setDeleteAccountBusy(false);
        showToast("Não consegui apagar sua conta agora (falha de conexão com o servidor). Nada foi apagado — tente de novo em instantes.","error");
      }
    })();
  };
  const addCustomCat=()=>{
    const name=newCatInput.trim();
    if(!name)return;
    if(fullCats.some(c=>c.toLowerCase()===name.toLowerCase())){showToast("Essa categoria já existe.","error");setNewCatInput("");return;}
    pushHistory();
    setCustomCats(p=>[...p,name]);
    setNewCatInput("");
    showToast("Categoria criada!","success");
  };
  const removeCustomCat=name=>{
    pushHistory();
    setCustomCats(p=>p.filter(c=>c!==name));
  };
  const exportAllBackup=()=>{
    try{
      const data=buildBackup({tx:transactions,wishes,inst:installments,planned:plannedExpenses,customCats,name:user.name,accentKey,walletName,trash,onboardingDismissed});
      const json=JSON.stringify(data,null,2);
      const blob=new Blob([json],{type:"application/json"});
      const url=URL.createObjectURL(blob);const a=document.createElement("a");
      a.href=url;a.download=`lacalle-finance_backup_${todayFn()}.json`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
      showToast("Backup completo exportado!","success");
    }catch(err){showToast("Erro ao exportar backup: "+err.message,"error");}
  };
  const importAllBackup=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      let d;
      try{
        d=JSON.parse(ev.target.result);
      }catch{
        showToast("Arquivo inválido ou corrompido.","error");
        return;
      }
      // ---- BUG-03: fronteira de validação do backup ----
      // Antes só conferíamos a presença das chaves (`tx`/`planned`/...);
      // agora cada registro passa pelos mesmos limites usados nos
      // formulários (valor, data, tipo, categoria). Tudo-ou-nada: se
      // qualquer registro for inválido, nada é aceito — nem parcialmente —
      // e o usuário recebe um motivo concreto em vez de um dado corrompido
      // silenciosamente salvo na nuvem.
      const {ok,errors}=validateBackup(d);
      if(!ok){
        console.error("LaCalle Finance — backup rejeitado na validação:",errors);
        const first=errors[0];
        showToast(`Backup inválido (${errors.length} problema${errors.length>1?"s":""}): ${first.path} — ${first.reason}.`,"error");
        return;
      }
      setPendingImport(d);
    };
    reader.readAsText(file,"UTF-8");e.target.value="";
  };
  const confirmImportAll=()=>{
    const d=pendingImport;if(!d)return;
    pushHistory();
    const newTx=d.tx||[];
    const newWishes=d.wishes||[];
    const newInst=d.inst||[];
    const newPlanned=d.planned||[];
    const newCustomCats=d.customCats||[];
    const newAccentKey=d.accentKey||accentKey;
    const newWalletName=d.walletName||walletName;
    const newUserName=d.name||user.name;
    const newTrash=d.trash||[];
    setTransactions(newTx);
    setWishes(newWishes);
    setInstallments(newInst);
    setPlannedExpenses(newPlanned);
    setCustomCats(newCustomCats);
    setAccentKey(newAccentKey);
    setWalletName(newWalletName);
    setUser(u=>({...u,name:newUserName}));
    setTrash(newTrash);
    setPendingImport(null);
    setShowProfile(false);
    if(d.onboardingDismissed!==undefined)setOnboardingDismissed(!!d.onboardingDismissed);
    // O salvamento automático grava a troca. Importar é "substituir tudo":
    // o que não está no backup vira exclusão, e o que veio no backup ganha a
    // hora de agora, então vence qualquer versão anterior em outro aparelho.
    showToast("Backup importado. Salvando na nuvem...","success");
  };
  const openInstForm=()=>{setInstDraft(d=>({...d,startDate:todayFn()}));setShowInstForm(true);};
  const addInstallment=()=>{
    const totalCheck=validateAmount(instDraft.totalVal,{label:"valor total"});
    const numCheck=validateInt(instDraft.numParcelas,{label:"o número de parcelas",min:1,max:MAX_PARCELAS});
    const startD=instDraft.startDate||todayFn();
    const err=firstError([
      validateText(instDraft.desc,{label:"descrição"}),
      totalCheck,
      numCheck,
      validateDate(startD,{label:"data do primeiro vencimento"}),
    ]);
    if(err){showToast(err,"error");return;}
    const total=totalCheck.value,num=numCheck.value;
    // A última parcela não pode cair fora da janela de datas aceita.
    const lastDue=validateDate(addMonthsStr(startD,num-1),{label:"data da última parcela"});
    if(!lastDue.ok){showToast(`Esse parcelamento termina fora do período permitido. ${lastDue.error}`,"error");return;}
    if(total/num<0.01){showToast("Cada parcela ficaria abaixo de R$ 0,01. Reduza o número de parcelas.","error");return;}
    const instId=genId();
    // Rateio sem perder centavos: arredonda por parcela e joga a diferença
    // acumulada na ÚLTIMA. Antes, R$ 1.000 em 3x virava 3 × 333,33 = 999,99
    // (some 1 centavo do total); agora fica 333,33 + 333,33 + 333,34.
    const monthly=Math.round((total/num)*100)/100;
    const lastVal=Math.round((total-monthly*(num-1))*100)/100;
    const newTxs=[],txIds=[];
    for(let i=0;i<num;i++){
      const nd=addMonthsStr(startD,i);
      const txId=instId+i+1;txIds.push(txId);
      newTxs.push({id:txId,date:nd,type:"Saída",fixed:"Fixa",cat:instDraft.cat,desc:`${instDraft.desc.trim()} (${i+1}/${num})`,val:i===num-1?lastVal:monthly,form:instDraft.form,invTipo:null,installmentId:instId});
    }
    pushHistory();
    setTransactions(p=>[...newTxs,...p]);
    setInstallments(p=>[...p,{id:instId,desc:instDraft.desc.trim(),totalVal:total,numParcelas:num,cat:instDraft.cat,form:instDraft.form,startDate:startD,txIds}]);
    setInstDraft(d=>({...d,desc:"",totalVal:"",numParcelas:"12"}));setShowInstForm(false);
    showToast("Parcelamento criado!","success");
  };
  const deleteInstallment=(id,withTxs)=>{
    const inst=installments.find(i=>i.id===id);
    const relatedTxs=withTxs?transactions.filter(t=>t.installmentId===id):[];
    pushHistory();
    if(withTxs)setTransactions(p=>p.filter(t=>t.installmentId!==id));
    setInstallments(p=>p.filter(i=>i.id!==id));setDelInstId(null);
    if(inst)moveToTrash("installment",{...inst,_trashedTxs:relatedTxs});
    showToast("Parcelamento removido.","info");
  };

  const isEditing=editingTx!==null;const canAdd=qaDesc.trim()&&qaVal;

  // Btn/BtnGhost agora vêm de ../components/ui (usam AccentContext internamente)

  const renderFrequentPicks=(onPick)=>(
    <div>
      <div id="freq-label" style={{fontSize:12,color:TX2,fontWeight:500,marginBottom:6}}>Frequentes</div>
      <div role="group" aria-labelledby="freq-label" style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
        {frequentTx.map((item,i)=>(
          <button key={i} type="button" onClick={()=>onPick(item)} style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,background:"transparent",border:`1px solid ${BD}`,borderRadius:R_BTN,padding:"8px 12px",cursor:"pointer",minWidth:104,textAlign:"left"}}>
            <span style={{fontSize:13,fontWeight:500,color:TX,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:150}}>{item.desc}</span>
            <span className="num" style={{fontSize:12,color:TX3}}>{fmt(item.val)}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderTxForm=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {qaCat!=="Investimento"?(
        <Segmented ariaLabel="Tipo de lançamento" value={qaType} onChange={setQaType}
          options={[{value:"Saída",label:"Saída",icon:ArrowDownCircle,tone:"out"},{value:"Entrada",label:"Entrada",icon:ArrowUpCircle,tone:"in"}]}/>
      ):(
        // Aporte tira dinheiro da conta (vermelho); resgate e rendimento trazem (verde).
        <Segmented ariaLabel="Tipo de investimento" value={qaInvTipo} onChange={setQaInvTipo}
          options={INV_TIPOS.map(t=>({value:t,label:t,icon:INV_TIPO_ICONS[t],tone:t==="Aporte"?"out":"in"}))}/>
      )}
      {/* Valor primeiro, em número grande: é o que mais importa num lançamento. */}
      <Field id="qa-val" label="Valor">{p=>(
        <div className="amt-field">
          <span aria-hidden="true">R$</span>
          <MoneyInput ref={qaValRef} {...p} placeholder="0,00" value={qaVal} onChange={setQaVal} onKeyDown={e=>e.key==="Enter"&&quickAdd()}/>
        </div>
      )}</Field>
      <Field id="qa-desc" label="Descrição">{p=>(
        <input ref={qaDescRef} {...p} placeholder="Ex.: Mercado" value={qaDesc} maxLength={120} onChange={e=>setQaDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&quickAdd()} style={SI}/>
      )}</Field>
      {!isEditing&&frequentTx.length>0&&renderFrequentPicks(applyFrequent)}
      <div>
        <div id="qa-cat-label" style={{fontSize:12,color:TX2,fontWeight:500,marginBottom:6}}>Categoria</div>
        <div role="group" aria-labelledby="qa-cat-label" style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {fullCats.map(c=>{const on=qaCat===c;return(
            <button key={c} type="button" aria-pressed={on} onClick={()=>setQaCat(c)} className="cat-chip">
              <i aria-hidden="true" style={{background:catColor(c)}}/>{c}
            </button>
          );})}
        </div>
      </div>
      <details className="qa-more" open={qaExpanded} onToggle={e=>setQaExpanded(e.currentTarget.open)}>
        <summary><ChevronRight size={14} aria-hidden="true"/>Data, forma de pagamento, fixo e repetir</summary>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginTop:8}}>
          <Field id="qa-date" label="Data">{p=><input {...p} type="date" value={qaDate} min={DATE_MIN} max={DATE_MAX} onChange={e=>setQaDate(e.target.value)} style={SI}/>}</Field>
          <Field id="qa-form" label="Forma">{p=><select {...p} value={qaForm} onChange={e=>setQaForm(e.target.value)} style={SI}>{[["pix","Pix"],["debito","Débito"],["credito","Crédito"],["dinheiro","Dinheiro"],["deposito","Depósito"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>}</Field>
          <Field id="qa-fixed" label="Tipo de gasto">{p=><select {...p} value={qaFixed} onChange={e=>setQaFixed(e.target.value)} style={SI}><option value="Variavel">Variável</option><option value="Fixa">Fixo</option></select>}</Field>
          {!isEditing&&<Field id="qa-repeat" label="Repetir">{p=><select {...p} value={qaRepeat} onChange={e=>setQaRepeat(e.target.value)} style={SI}><option value="none">Não repetir</option><option value="3m">3 meses</option><option value="6m">6 meses</option><option value="12m">12 meses</option></select>}</Field>}
        </div>
      </details>
      {/* O botão parece inativo quando falta algo, mas não usa `disabled`: o
          clique sempre roda a validação, que diz exatamente o que falta. */}
      <button type="button" onClick={quickAdd} disabled={isSubmittingTx} aria-disabled={!canAdd} aria-busy={isSubmittingTx} style={{width:"100%",height:48,borderRadius:R_BTN,border:"none",cursor:isSubmittingTx?"default":"pointer",fontSize:14,fontWeight:600,background:!canAdd?MUTED:accent,color:!canAdd?TX2:BG,opacity:isSubmittingTx?0.7:1}}>
        {isSubmittingTx?"Adicionando...":isEditing?"Salvar alterações":qaCat==="Investimento"?`Adicionar ${qaInvTipo.toLowerCase()}`:`Adicionar ${qaType}`}
      </button>
    </div>
  );

  const appTabs=[
    {id:"dashboard",label:"Início",icon:LayoutDashboard,group:"Dia a dia",mobile:true},
    {id:"transactions",label:"Transações",icon:Receipt,group:"Dia a dia",mobile:true},
    {id:"wishes",label:"Metas",icon:Target,group:"Dia a dia",mobile:true},
    {id:"planning",label:"Planejamento",short:"Planos",icon:CalendarDays,group:"Planejamento",mobile:true},
    {id:"planned",label:"Previstos",icon:Calendar,group:"Planejamento",hint:"Contas que se repetem e as de um mês só"},
    {id:"installments",label:"Parcelas",icon:CreditCard,group:"Planejamento",hint:"Compras parceladas em andamento"},
  ];
  const navGroups=["Dia a dia","Planejamento"];
  const goTab=id=>{setTab(id);setShowMore(false);};
  const instToDelete=delInstId?installments.find(i=>i.id===delInstId):null;
  const instTxCount=instToDelete?instToDelete.txIds.filter(id=>txMap.has(id)).length:0;

  if(!isLoaded)return(
    <div style={{background:BG,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Sans Variable','IBM Plex Sans',system-ui,sans-serif",gap:16}}>
      <FinanceMark size={40}/>
      <div style={{color:TX,fontWeight:700,fontSize:17,letterSpacing:"-0.03em"}}>LaCalle <span style={{color:GOLD}}>Finance</span></div>
      {loadError?(
        <div role="alert" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,maxWidth:320,textAlign:"center",padding:"0 20px"}}>
          <div style={{color:TX,fontSize:14,fontWeight:600}}>Não consegui carregar seus dados.</div>
          <div style={{color:TX2,fontSize:13,lineHeight:1.5}}>Pode ser a conexão. Nada foi apagado: seus dados continuam na nuvem.</div>
          <Btn onClick={loadData} style={{paddingInline:22}}>Tentar de novo</Btn>
        </div>
      ):(
        <div style={{color:TX2,fontSize:13,display:"flex",alignItems:"center",gap:6}}><Loader2 size={14} className="spin"/>Carregando seus dados…</div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite;}`}</style>
    </div>
  );

  return(
    <AccentContext.Provider value={accent}>
    <DensityProvider>
    {revealActive&&<LaCalleReveal duration={1000} onDone={()=>setRevealActive(false)}/>}
    <div style={{background:BG,minHeight:"100vh",color:TX,fontFamily:"'IBM Plex Sans Variable','IBM Plex Sans',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`
        *{box-sizing:border-box;}
        html,body{overflow-x:hidden;max-width:100vw;}
        input,select,textarea{transition:border-color .15s ease, box-shadow .15s ease;}
        select{color-scheme:dark;}
        select option{background-color:${CARD};color:${TX};}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${accent}90;box-shadow:0 0 0 3px ${accent}22;}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${BG}}
        ::-webkit-scrollbar-thumb{background:${BD2};border-radius:4px}
        button{transition:filter .15s ease, transform .12s ease, opacity .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease;}
        button:hover:not(:disabled){filter:brightness(1.1);}
        button:active:not(:disabled){transform:scale(${PRESS_SCALE});}
        button:focus-visible{outline:2px solid ${accent}90;outline-offset:2px;}
        a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid ${accent}90;outline-offset:2px;}
        .fc-card{transition:border-color .2s ease, box-shadow .2s ease, transform .2s ease;}
        .fc-card:hover{border-color:${BD2};box-shadow:${SH_MD};}
        .chip-btn:hover{background:${HOVER}66 !important;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin 1s linear infinite;}
        @keyframes toastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes modalIn{from{opacity:0;transform:scale(.97) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes overlayIn{from{opacity:0}to{opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .bento{display:grid;grid-template-columns:1fr;gap:16px;}
        @media(min-width:720px){
          .bento{grid-template-columns:repeat(3,1fr);gap:20px;}
          .bento-hero{grid-column:span 2;}
          .bento-half{grid-column:span 1;}
          .bento-wide{grid-column:span 3;}
        }
        @media(min-width:1240px){
          .bento{grid-template-columns:repeat(4,1fr);gap:24px;}
          .bento-hero{grid-column:span 3;}
          .bento-half{grid-column:span 1;}
          .bento-wide{grid-column:span 4;}
        }
        .rg-2col{display:grid;grid-template-columns:1fr;gap:20px;}
        @media(min-width:900px){.rg-2col{grid-template-columns:1fr 1fr;}}
        .insights-grid{display:grid;grid-template-columns:1fr;gap:14px;}
        @media(min-width:720px){.insights-grid{grid-template-columns:1fr 1fr;}}
        @keyframes insightIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        .insight-card-anim{animation:insightIn .5s ${EASE_OUT} both;}
        .insight-card-anim:hover{transform:translateY(-3px);}
        @keyframes heroCardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .hero-card-anim{animation:heroCardIn .5s ${EASE_OUT} both;}
        .nav-tab{position:relative;transition:background .18s ease, color .18s ease;}
        .nav-tab:hover{color:${TX} !important;background:${HOVER}44 !important;}
        .surface-card{transition:border-color .18s ease, box-shadow .18s ease, transform .18s ease;}

        /* Bounce na entrada de aba — exceção pontual à regra "sem física de mola" (pág. 36),
           ratificada no Motion System v1 junto com o Life: reusa o keyframe fadeIn já existente,
           só com DUR_PAGE/EASE_BOUNCE em vez do EASE_OUT padrão. */
        .tab-panel-enter{animation:fadeIn ${DUR_PAGE}ms ${EASE_BOUNCE} both;}

        /* ---- Tipografia dos números: IBM Plex Mono, tabular e com tracking negativo ---- */
        .num,.stat-val,.hero-balance{font-family:${NUM_FONT};font-variant-numeric:tabular-nums;letter-spacing:-0.02em;}

        /* ---- Motion (add): entrada em cascata, indicador de aba, hover lift ---- */
        @keyframes fadeInUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes indicatorIn{from{opacity:0;transform:scaleX(.2)}to{opacity:1;transform:scaleX(1)}}
        .main-content .bento>*,.main-content .rg-2col>*,.main-content .stagger>*{animation:fadeInUp .5s ${EASE_OUT} backwards;}
        .main-content .bento>*:nth-child(1),.main-content .rg-2col>*:nth-child(1),.main-content .stagger>*:nth-child(1){animation-delay:.03s}
        .main-content .bento>*:nth-child(2),.main-content .rg-2col>*:nth-child(2),.main-content .stagger>*:nth-child(2){animation-delay:.08s}
        .main-content .bento>*:nth-child(3),.main-content .rg-2col>*:nth-child(3),.main-content .stagger>*:nth-child(3){animation-delay:.13s}
        .main-content .bento>*:nth-child(4),.main-content .rg-2col>*:nth-child(4),.main-content .stagger>*:nth-child(4){animation-delay:.18s}
        .main-content .bento>*:nth-child(5),.main-content .stagger>*:nth-child(5){animation-delay:.23s}
        .main-content .bento>*:nth-child(6),.main-content .stagger>*:nth-child(6){animation-delay:.28s}
        .main-content .bento>*:nth-child(n+7),.main-content .stagger>*:nth-child(n+7){animation-delay:.32s}
        .fc-card:hover{transform:translateY(-2px);}
        .nav-tab-underline{position:absolute;left:12px;right:12px;bottom:0;height:2.5px;border-radius:3px 3px 0 0;background:${accent};transform-origin:center bottom;animation:indicatorIn .32s ${EASE_OUT};box-shadow:0 0 12px ${accent}80;}
        @media (prefers-reduced-motion: reduce){
          .main-content,.main-content .bento>*,.main-content .rg-2col>*,.main-content .stagger>*,.insight-card-anim,.hero-card-anim,.nav-tab-underline{animation:none !important;}
          .fc-card:hover{transform:none;}
          *{transition-duration:.01ms !important;}
        }

        /* ---- Estrutura (nova cara, 05/10/2026) ----
           Computador (> 760px): barra lateral fixa de 240px com os destinos em
           dois grupos e o marcador de 3px do item atual (sidebar do Life).
           Celular: cabeçalho com a assinatura, barra de baixo com 5 destinos. */
        .side-nav{position:fixed;top:0;bottom:0;left:0;width:240px;display:flex;flex-direction:column;background:${CARD};border-right:1px solid ${BD};z-index:200;}
        .side-logo{height:64px;display:flex;align-items:center;padding:0 20px;border-bottom:1px solid ${BD};flex-shrink:0;}
        .side-groups{flex:1;overflow-y:auto;padding:12px;}
        .side-group-title{padding:20px 12px 8px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${TX3};}
        .side-groups>div:first-child .side-group-title{padding-top:8px;}
        .side-item{position:relative;width:100%;display:flex;align-items:center;gap:12px;height:40px;padding:0 12px 0 16px;border:none;border-radius:${R_BTN}px;background:transparent;color:${TX2};font-size:14px;cursor:pointer;text-align:left;margin-bottom:2px;}
        .side-item:hover{background:${MUTED};color:${TX};filter:none !important;}
        .side-item.on{background:${accentSurface(accent)};color:${accentText(accent)};font-weight:600;}
        .side-item.on::before{content:"";position:absolute;left:0;top:6px;bottom:6px;width:3px;border-radius:3px;background:${accent};}
        .side-foot{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;border-top:1px solid ${BD};}
        .side-avatar{position:relative;width:32px;height:32px;border-radius:50%;background:${MUTED};color:${TX2};border:none;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
        .side-avatar::after{content:"";position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%);}
        .app-main{margin-left:240px;min-width:0;}
        .app-header{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 32px;padding-top:env(safe-area-inset-top);border-bottom:1px solid ${BD};background:${BG};}
        .hdr-sig{display:none;}
        .hdr-sync{display:flex;align-items:center;gap:6px;margin-left:auto;font-size:12px;color:${TX3};}
        .hdr-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;}
        .hdr-btn{position:relative;display:inline-flex;align-items:center;gap:4px;background:none;border:none;border-radius:${R_BTN}px;padding:6px 8px;font-size:12px;}
        .hdr-avatar{display:none;}
        .bottom-nav{display:none;}
        .only-mobile{display:none;}
        .home-hero{display:grid;grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(0,1fr));gap:20px;align-items:center;background:${CARD};border:1px solid ${BD};border-left:3px solid ${accent};border-radius:${R_CARD}px;padding:20px 20px 20px 28px;}
        .home-metric{font-size:36px;line-height:1.1;letter-spacing:-0.02em;font-weight:600;margin-top:6px;white-space:nowrap;}
        .home-hero-num{position:relative;display:flex;flex-direction:column;gap:4px;align-items:flex-start;text-align:left;background:none;border:none;border-left:1px solid ${BD};padding:4px 0 4px 20px;cursor:pointer;min-width:0;color:${TX};}
        .home-hero-num span{font-size:12px;color:${TX3};}
        .home-hero-num b{font-size:18px;font-weight:600;white-space:nowrap;}
        .home-hero-num:hover{filter:none !important;}
        .home-hero-num:hover span{text-decoration:underline;text-underline-offset:3px;}
        .home-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:24px;align-items:start;}
        .home-col{display:flex;flex-direction:column;gap:24px;min-width:0;}
        .home-list{list-style:none;margin:0;padding:0;}
        .home-li{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid ${BD};}
        .home-li:first-child{border-top:none;}
        .home-li-name{font-size:14px;color:${TX};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .home-li-meta{font-size:12px;color:${TX3};margin-top:1px;}
        .home-li-val{font-size:13.5px;font-weight:600;white-space:nowrap;color:${TX};}
        .home-li-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:none;border:none;padding:0;cursor:pointer;text-align:left;}
        .home-li-btn:hover{filter:none !important;}
        .home-li-btn:hover .home-li-name{text-decoration:underline;text-underline-offset:3px;}
        .home-link{position:relative;background:none;border:none;font-size:12px;color:${TX2};text-decoration:underline;text-underline-offset:4px;cursor:pointer;padding:0;}
        .home-link::after{content:"";position:absolute;left:50%;top:50%;width:100%;min-width:44px;height:44px;transform:translate(-50%,-50%);}
        .amt-field{display:flex;align-items:baseline;gap:8px;height:60px;padding:0 14px;border-radius:${R_BTN}px;border:1px solid ${BD2};background:rgba(255,255,255,0.03);}
        .amt-field:focus-within{border-color:${accent}90;box-shadow:0 0 0 3px ${accent}22;}
        .amt-field span{font-family:${NUM_FONT};color:${TX3};font-size:16px;line-height:60px;}
        .amt-field.amt-sm{height:48px;}.amt-field.amt-sm span{line-height:48px;font-size:14px;}.amt-field.amt-sm input{height:46px;font-size:18px;}
        .amt-field input{flex:1;min-width:0;border:none !important;box-shadow:none !important;background:transparent;outline:none;font-family:${NUM_FONT};font-variant-numeric:tabular-nums;font-size:26px;font-weight:600;letter-spacing:-0.02em;height:58px;color:${TX};}
        .cat-chip{position:relative;height:32px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border-radius:${R_CHIP}px;border:1px solid ${BD};background:transparent;color:${TX2};font-size:12.5px;cursor:pointer;}
        .cat-chip::after{content:"";position:absolute;left:0;right:0;top:50%;height:44px;transform:translateY(-50%);}
        .cat-chip i{width:8px;height:8px;border-radius:50%;}
        .cat-chip[aria-pressed="true"]{border-color:${accent}73;background:${accentSurface(accent)};color:${accentText(accent)};font-weight:600;}
        .qa-more summary{list-style:none;cursor:pointer;font-size:13px;color:${TX2};display:flex;align-items:center;gap:6px;min-height:44px;}
        .qa-more summary::-webkit-details-marker{display:none;}
        .qa-more summary svg{transition:transform .25s ease;}
        .qa-more[open] summary svg{transform:rotate(90deg);}
        @media(max-width:1100px){
          .home-grid{grid-template-columns:minmax(0,1fr);}
          .home-hero{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:16px 16px 16px 24px;}
          .home-hero-main{grid-column:1 / -1;padding-bottom:12px;border-bottom:1px solid ${BD};margin-bottom:4px;}
          .home-hero-num{border-left:none;padding:4px 0;}
          .home-hero-num b{font-size:13px;}
          .home-hero-num span{font-size:11px;}
        }
        @media(max-width:760px){
          .only-desktop{display:none;}
          .only-mobile{display:block;}
          .home-metric{font-size:28px;}
        }
        .more-row{width:100%;display:flex;align-items:center;gap:12px;padding:12px;border:none;background:none;border-radius:${R_BTN}px;text-align:left;cursor:pointer;color:${TX};}
        .more-row:hover{background:${MUTED};filter:none !important;}
        .more-t{display:block;font-size:14px;font-weight:500;}
        .more-h{display:block;font-size:12px;color:${TX3};}
        @media(max-width:760px){
          .side-nav{display:none;}
          .app-main{margin-left:0;}
          .app-header{padding:0 12px 0 16px;padding-top:env(safe-area-inset-top);min-height:56px;}
          .hdr-sig{display:inline-flex;}
          .sync-label{display:none;}
          .hdr-avatar{display:flex;}
          .main-content{padding:20px 16px calc(84px + env(safe-area-inset-bottom)) !important;}
          .toast-wrap{bottom:calc(84px + env(safe-area-inset-bottom)) !important;}
          /* fundo sólido no tom da marca (o azul-marinho antigo sobrava aqui);
             sólido porque desfoque com posição fixa falha no WebKit */
          .bottom-nav{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:250;background:${BG};border-top:1px solid ${BD};padding:4px 4px env(safe-area-inset-bottom);}
          .bottom-nav-btn{background:none;border:none;cursor:pointer;min-width:0;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:${TX3};padding:4px 0;}
          .bottom-nav-btn[aria-current="page"]{color:${accentText(accent)};}
          .bottom-nav-ico{display:flex;align-items:center;justify-content:center;width:44px;height:26px;border-radius:999px;transition:background .25s ease;}
          .bottom-nav-btn[aria-current="page"] .bottom-nav-ico{background:${accentSurface(accent)};}
          .bottom-nav-lbl{font-size:11px;font-weight:600;line-height:1;max-width:100%;white-space:nowrap;}
        }
        @media(max-width:380px){
          .undo-count{display:none;}
        }
      `}</style>

      <div className="toast-wrap" role="status" aria-live="polite" style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:300,display:"flex",flexDirection:"column",gap:8,alignItems:"center",pointerEvents:"none",width:"100%",padding:"0 16px"}}>
        {toasts.map(t=>{
          const Ic=t.type==="error"?AlertCircle:t.type==="success"?CheckCircle2:Info;
          const col=t.type==="error"?"#F87171":t.type==="success"?"#34D399":TX2;
          return(
            <div key={t.id} style={{background:"rgba(22,25,29,0.97)",backdropFilter:"blur(12px)",border:`1px solid ${BD2}`,color:TX,padding:"13px 18px",borderRadius:R_INPUT,fontSize:13,fontWeight:600,boxShadow:SH_LG,animation:`toastIn .3s ${EASE_OUT}`,maxWidth:380,display:"flex",alignItems:"center",gap:9}}>
              <Ic size={16} color={col} style={{flexShrink:0}}/><span style={{flex:1}}>{t.msg}</span>
              {t.action&&<button type="button" className="touch-44" onClick={()=>{dismissToast(t.id);t.action.onClick();}} style={{pointerEvents:"auto",background:"none",border:"none",color:accent,fontWeight:700,fontSize:13,cursor:"pointer",padding:"2px 4px",marginLeft:4,textDecoration:"underline",textUnderlineOffset:3}}>{t.action.label}</button>}
            </div>
          );
        })}
      </div>

      {/* ---- Barra lateral (computador) ---- */}
      <aside className="side-nav" aria-label="Menu">
        <div className="side-logo"><Signature size={20}/></div>
        <nav aria-label="Seções" className="side-groups">
          {navGroups.map(g=>(
            <div key={g}>
              <div className="side-group-title">{g}</div>
              {appTabs.filter(t=>t.group===g).map(t=>{const Ic=t.icon;const on=tab===t.id;return(
                <button key={t.id} type="button" id={`app-tab-${t.id}`} aria-current={on?"page":undefined} onClick={()=>goTab(t.id)} className={`side-item${on?" on":""}`}><Ic size={18} aria-hidden="true"/>{t.label}</button>
              );})}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <button type="button" className="side-avatar" onClick={()=>setShowProfile(true)} title="Minha conta" aria-label="Minha conta">{(user.name||"?").trim().charAt(0).toUpperCase()}</button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
            <div style={{fontSize:11,color:TX3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{walletName}</div>
          </div>
          <IconButton icon={LogOut} label="Sair" onClick={()=>setUser(null)}/>
        </div>
      </aside>

      <div className="app-main">
      <header className="app-header">
        <span className="hdr-sig"><Signature size={18}/></span>
        <div className="hdr-sync" aria-live="polite">
          {syncStatus==="loading"&&<><Loader2 size={12} className="spin" color={TX3}/><span className="sync-label">Carregando</span></>}
          {syncStatus==="saving"&&<><Loader2 size={12} className="spin" color={TX3}/><span className="sync-label">Salvando</span></>}
          {syncStatus==="saved"&&<><Cloud size={12} color={TX3}/><span className="sync-label">Sincronizado</span><IconButton icon={RefreshCw} size={12} label="Salvar agora" onClick={retrySave}/></>}
          {syncStatus==="offline"&&<><CloudOff size={12} color={TX2}/><span className="sync-label">Salvo neste aparelho</span><IconButton icon={RefreshCw} size={12} label="Tentar enviar para a nuvem" onClick={retrySave}/></>}
          {syncStatus==="error"&&<><AlertTriangle size={12} color={WARNING}/><span className="sync-label" style={{color:WARNING}}>Erro ao salvar</span><IconButton icon={RefreshCw} size={12} color={WARNING} label="Tentar salvar de novo" onClick={retrySave}/></>}
        </div>
        <div className="hdr-actions">
          <button type="button" onClick={undo} disabled={historyLen===0} title={`Desfazer (${historyLen} passos)`} aria-label={historyLen?`Desfazer (${historyLen} passos)`:"Desfazer"} className="touch-44 hdr-btn" style={{color:historyLen?TX2:TX3,cursor:historyLen?"pointer":"not-allowed"}}>
            <Undo2 size={16}/>{historyLen>0&&<span className="undo-count">{historyLen}</span>}
          </button>
          <IconButton icon={Search} size={16} color={TX2} label="Pesquisar (Ctrl+K)" onClick={()=>setShowSearch(true)}/>
          <button type="button" className="side-avatar hdr-avatar" onClick={()=>setShowProfile(true)} title="Minha conta" aria-label="Minha conta">{(user.name||"?").trim().charAt(0).toUpperCase()}</button>
        </div>
      </header>

      {showNewTx&&!isEditing&&(
        <Modal align="sheet" onClose={closeNewTx} maxWidth={560} padding={20} label="Novo lançamento">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <h2 style={{margin:0,fontSize:17,fontWeight:600,color:TX,letterSpacing:"-0.01em"}}>Novo lançamento</h2>
            <IconButton icon={X} size={18} label="Fechar" onClick={closeNewTx}/>
          </div>
          {renderTxForm()}
        </Modal>
      )}
      {isEditing&&(
        <Modal onClose={requestCloseEditTx} maxWidth={420} padding={28}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{fontSize:16,fontWeight:700,color:TX,letterSpacing:"-0.01em"}}>Editar lançamento</div>
            <button onClick={requestCloseEditTx} style={{background:"none",border:"none",color:TX3,cursor:"pointer",padding:4}}><X size={20}/></button>
          </div>
          {renderTxForm()}
        </Modal>
      )}
      {pendingImport&&(
        <Modal maxWidth={360} padding={32} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:12,background:"#FBBF2418",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Upload size={20} color="#FBBF24"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em"}}>Importar backup?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:10,lineHeight:1.5}}>Isso vai <strong style={{color:TX}}>substituir</strong> todos os seus dados atuais (transações, previstos, parcelamentos, desejos, categorias) pelos dados desse arquivo.</div>
          <div style={{fontSize:12,color:TX3,marginBottom:24}}>{pendingImport.tx?.length||0} transações · {pendingImport.planned?.length||0} previstos · {pendingImport.inst?.length||0} parcelamentos · {pendingImport.wishes?.length||0} desejos</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setPendingImport(null)} style={{flex:1,paddingInline:12}}>Cancelar</BtnGhost>
            <Btn onClick={confirmImportAll} style={{flex:1,paddingInline:12,fontSize:13}}>Importar</Btn>
          </div>
        </Modal>
      )}
      {showClearConfirm&&(
        <Modal maxWidth={340} padding={32} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:12,background:"#F8717118",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Trash2 size={20} color="#F87171"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em"}}>Apagar tudo?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>Todas as transações serão removidas permanentemente.</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setShowClearConfirm(false)} style={{flex:1,paddingInline:12}}>Cancelar</BtnGhost>
            <button onClick={()=>{pushHistory();setTransactions([]);setShowClearConfirm(false);showToast("Tudo apagado.","info");}} style={{flex:1,padding:"12px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:ERROR_BG,color:"white"}}>Apagar tudo</button>
          </div>
        </Modal>
      )}
      {pendingDuplicateTx&&(
        <Modal onClose={()=>setPendingDuplicateTx(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:12,background:"#FBBF2418",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><AlertTriangle size={20} color="#FBBF24"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em"}}>Parece duplicado</div>
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>Você já tem um lançamento de "{pendingDuplicateTx.desc}" de {fmt(pendingDuplicateTx.val)} nesse mesmo dia. Quer lançar mesmo assim?</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setPendingDuplicateTx(null)} style={{flex:1,paddingInline:12}}>Cancelar</BtnGhost>
            <Btn onClick={()=>{setPendingDuplicateTx(null);commitQuickAdd();}} style={{flex:1,paddingInline:12,justifyContent:"center"}}>Lançar mesmo assim</Btn>
          </div>
        </Modal>
      )}
      {confirmDiscard&&(
        <Modal onClose={()=>setConfirmDiscard(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:12,background:"#FBBF2418",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><AlertTriangle size={20} color="#FBBF24"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em"}}>Descartar alterações?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>Você tem alterações não salvas neste formulário. Se sair agora, elas serão perdidas.</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setConfirmDiscard(null)} style={{flex:1,paddingInline:12}}>Continuar editando</BtnGhost>
            <button onClick={()=>{
              if(confirmDiscard==="wish"){setShowWishForm(false);setEditingWish(null);}
              else if(confirmDiscard==="planned"){setShowPlannedForm(false);setEditingPlanned(null);}
              else if(confirmDiscard==="newtx"){setShowNewTx(false);resetQuickAddForm();}
              else if(confirmDiscard==="tx")cancelEditTx();
              setConfirmDiscard(null);
            }} style={{flex:1,padding:"12px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:ERROR_BG,color:"white"}}>Descartar</button>
          </div>
        </Modal>
      )}
      {deleteAccountOpen&&(()=>{
        const phraseOk=deleteAccountPhrase.trim().toUpperCase()===ACCOUNT_DELETE_PHRASE;
        return(
        <Modal onClose={deleteAccountBusy?()=>{}:closeDeleteAccount} maxWidth={400} padding={30} label="Apagar sua conta">
          <div style={{width:46,height:46,borderRadius:12,background:"#F8717118",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><AlertTriangle size={20} color="#F87171"/></div>
          <div style={{fontSize:17,fontWeight:700,color:TX,marginBottom:10,textAlign:"center",letterSpacing:"-0.01em"}}>Apagar sua conta para sempre?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:14,lineHeight:1.6}}>
            Isso apaga <strong style={{color:TX}}>todos</strong> os seus lançamentos, metas, previstos e parcelamentos, além da sua conta de login. Esta ação <strong style={{color:"#F87171"}}>não passa pela lixeira e não pode ser desfeita</strong>.
          </div>
          <div style={{fontSize:12.5,color:TX2,marginBottom:16,lineHeight:1.6,background:"#F8717110",border:`1px solid #F8717130`,borderRadius:R_INPUT,padding:"10px 12px"}}>
            Se você só quer uma cópia antes, feche isto e use <strong style={{color:TX}}>Exportar dados</strong>.
          </div>
          <div style={{fontSize:12,color:TX2,marginBottom:6}}>Para confirmar, digite <strong style={{color:TX}}>{ACCOUNT_DELETE_PHRASE}</strong>:</div>
          <input
            aria-label={`Digite ${ACCOUNT_DELETE_PHRASE} para confirmar`}
            value={deleteAccountPhrase}
            onChange={e=>setDeleteAccountPhrase(e.target.value)}
            disabled={deleteAccountBusy}
            autoFocus
            maxLength={40}
            placeholder={ACCOUNT_DELETE_PHRASE}
            style={{...SI,marginBottom:20,letterSpacing:"0.04em"}}
          />
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={closeDeleteAccount} disabled={deleteAccountBusy} style={{flex:1,paddingInline:12,opacity:deleteAccountBusy?0.5:1}}>Cancelar</BtnGhost>
            <button
              onClick={deleteAccount}
              disabled={!phraseOk||deleteAccountBusy}
              style={{flex:1,padding:"12px",borderRadius:R_BTN,border:"none",cursor:(!phraseOk||deleteAccountBusy)?"not-allowed":"pointer",fontSize:13,fontWeight:700,background:(!phraseOk||deleteAccountBusy)?`${ERROR_BG}40`:ERROR_BG,color:"white"}}
            >{deleteAccountBusy?"Apagando...":"Apagar para sempre"}</button>
          </div>
        </Modal>
        );
      })()}
      {confirmDelete&&(
        <Modal onClose={()=>setConfirmDelete(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:12,background:"#F8717118",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Trash2 size={20} color="#F87171"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={confirmDelete.label}>Excluir "{confirmDelete.label}"?</div>
          {confirmDelete.impact&&(
            <div style={{fontSize:12.5,color:TX,fontWeight:600,lineHeight:1.5,background:"rgba(255,255,255,0.04)",border:`1px solid ${BD2}`,borderRadius:R_INPUT,padding:"10px 12px",marginBottom:14,textAlign:"left"}}>{confirmDelete.impact}</div>
          )}
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>Você pode usar o botão "desfazer" no topo logo em seguida, caso mude de ideia.</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setConfirmDelete(null)} style={{flex:1,paddingInline:12}}>Cancelar</BtnGhost>
            <button onClick={()=>{
              if(confirmDelete.type==="wish")deleteWish(confirmDelete.id);
              else if(confirmDelete.type==="planned")deletePlannedItem(confirmDelete.id);
              else if(confirmDelete.type==="tx")deleteTx(confirmDelete.id);
              setConfirmDelete(null);
            }} style={{flex:1,padding:"12px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:ERROR_BG,color:"white"}}>Excluir</button>
          </div>
        </Modal>
      )}
      {transferPlanned&&(
        <Modal onClose={()=>setTransferPlanned(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:12,background:accent+"18",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Sparkles size={20} color={accent}/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={transferPlanned.desc}>Mover "{transferPlanned.desc}" para Metas?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>As informações compatíveis serão preservadas. Categoria, forma de pagamento e mês previsto ficam guardados nas notas do desejo.</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setTransferPlanned(null)} style={{flex:1,paddingInline:12}}>Cancelar</BtnGhost>
            <Btn onClick={confirmTransferToWish} style={{flex:1,paddingInline:12,justifyContent:"center"}}>Mover</Btn>
          </div>
        </Modal>
      )}
      {transferWish&&(
        <Modal onClose={()=>setTransferWish(null)} maxWidth={420} padding={28}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <div style={{width:40,height:40,borderRadius:12,background:accent+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Calendar size={18} color={accent}/></div>
            <div style={{fontSize:15.5,fontWeight:700,color:TX,letterSpacing:"-0.01em",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={transferWish.item.name}>Mover "{transferWish.item.name}" para Previstos</div>
          </div>
          <div style={{fontSize:12.5,color:TX2,marginBottom:18,lineHeight:1.5}}>As informações compatíveis serão preservadas. Complete os dados que só existem em Previstos:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>
            {fullCats.filter(c=>c!=="Investimento"&&c!=="Salario / Entradas").map(c=>{const cc=catColor(c);return(
              <button key={c} onClick={()=>setTransferWish(p=>({...p,form:{...p.form,cat:c}}))} style={{padding:"7px 12px",borderRadius:R_CHIP,border:"none",fontSize:12,cursor:"pointer",background:transferWish.form.cat===c?cc+"26":"rgba(255,255,255,0.03)",color:transferWish.form.cat===c?cc:TX2,display:"flex",alignItems:"center",gap:5}}><CategoryIcon cat={c} size={13}/>{c}</button>
            );})}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
            <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Forma</div><select value={transferWish.form.form} onChange={e=>setTransferWish(p=>({...p,form:{...p.form,form:e.target.value}}))} style={SI}>{["pix","debito","credito","dinheiro","deposito"].map(o=><option key={o}>{o}</option>)}</select></div>
            <div>
              <div style={{fontSize:11,color:TX2,marginBottom:5}}>Repetição</div>
              <Segmented ariaLabel="Repetição" size="sm" value={transferWish.form.recurring} onChange={v=>setTransferWish(p=>({...p,form:{...p.form,recurring:v}}))}
                options={[{value:false,label:"Só um mês",tone:"accent"},{value:true,label:"Todo mês",icon:Repeat,tone:"accent"}]}/>
            </div>
            {!transferWish.form.recurring&&(
              <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Mês previsto *</div><select value={transferWish.form.month} onChange={e=>setTransferWish(p=>({...p,form:{...p.form,month:e.target.value}}))} style={SI}>{MONTH_ORDER.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
            )}
          </div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setTransferWish(null)} style={{flex:1,paddingInline:12}}>Cancelar</BtnGhost>
            <Btn onClick={confirmTransferToPlanned} style={{flex:1,paddingInline:12,justifyContent:"center"}}>Mover para Previstos</Btn>
          </div>
        </Modal>
      )}
      {explainKey&&(()=>{
        const ex=getExplain(explainKey);
        if(!ex)return null;
        return(
          <Modal onClose={()=>setExplainKey(null)} maxWidth={440} padding={28}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700,color:TX,display:"flex",alignItems:"center",gap:8}}><Info size={16} color={accent}/>{ex.title}</div>
              <button onClick={()=>setExplainKey(null)} style={{background:"none",border:"none",color:TX3,cursor:"pointer"}}><X size={18}/></button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:accent,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Como é calculado</div>
                <div style={{fontSize:13,color:TX2,lineHeight:1.5}}>{ex.calc}</div>
              </div>
              {ex.factors?.length>0&&(
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:accent,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Fatores que influenciam</div>
                  <ul style={{margin:0,paddingLeft:18,display:"flex",flexDirection:"column",gap:4}}>
                    {ex.factors.map((f,i)=><li key={i} style={{fontSize:13,color:TX2}}>{f}</li>)}
                  </ul>
                </div>
              )}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:accent,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>O que isso significa</div>
                <div style={{fontSize:13,color:TX2,lineHeight:1.5}}>{ex.meaning}</div>
              </div>
              {ex.improve?.length>0&&(
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#34D399",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Como melhorar</div>
                  <ul style={{margin:0,paddingLeft:18,display:"flex",flexDirection:"column",gap:4}}>
                    {ex.improve.map((f,i)=><li key={i} style={{fontSize:13,color:TX2}}>{f}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}
      {projectionDrawer&&(
        <ProjectionDrawer
          config={projectionDrawer}
          onClose={()=>setProjectionDrawer(null)}
          transactions={transactions}
          plannedExpenses={plannedExpenses}
          balance={balance}
          todayISO={todayISO}
          currentMonthKey={currentMonthKeyReal}
          accent={accent}
          catColor={catColor}
          showToast={showToast}
          onTogglePaid={(item,month)=>togglePlannedPaidForMonth(item,month)}
          onToggleIgnored={(item,month)=>togglePlannedIgnoredForMonth(item,month)}
          onMakeRecurring={makePlannedRecurring}
          onRequestDeletePlanned={(item,impact)=>setConfirmDelete({type:"planned",id:item.id,label:item.desc,impact})}
          onRequestDeleteTx={(tx,impact)=>setConfirmDelete({type:"tx",id:tx.id,label:tx.desc,impact})}
          onEditPlanned={item=>{startEditPlanned(item);setTab("planned");setProjectionDrawer(null);}}
          onEditTx={tx=>{startEditTx(tx);setTab("transactions");setProjectionDrawer(null);}}
          onViewAllPlanned={()=>{setTab("planned");setProjectionDrawer(null);}}
        />
      )}
      {showSearch&&(
        <Modal onClose={closeSearch} maxWidth={560} padding={0} align="top" scroll={false} contentStyle={{maxHeight:"70vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 18px",borderBottom:`1px solid ${BD}`,flexShrink:0}}>
              <Search size={16} color={TX3}/>
              <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Buscar transações, categorias, metas, previstos, investimentos..." style={{flex:1,background:"none",border:"none",outline:"none",color:TX,fontSize:14}}/>
              <button onClick={closeSearch} style={{background:"none",border:"none",color:TX3,cursor:"pointer"}}><X size={18}/></button>
            </div>
            <div style={{overflowY:"auto",padding:"8px 8px 16px"}}>
              {!searchResults&&<div style={{textAlign:"center",color:TX3,fontSize:13,padding:"32px 16px"}}>Digite para buscar em transações, categorias, metas, previstos, recorrências, investimentos e parcelamentos.</div>}
              {searchResults&&Object.values(searchResults).every(a=>a.length===0)&&(
                <div style={{textAlign:"center",color:TX3,fontSize:13,padding:"32px 16px"}}>Nenhum resultado encontrado para "{searchQuery}".</div>
              )}
              {searchResults&&searchResults.txRes.length>0&&(
                <div style={{padding:"10px 10px 4px"}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",padding:"0 8px 6px"}}>Transações</div>
                  {searchResults.txRes.map(t=>(
                    <button key={t.id} onClick={()=>goToTx(t)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:12,textAlign:"left"}}>
                      <CategoryIcon cat={t.cat} size={13} color={catColor(t.cat)}/>
                      <span style={{flex:1,fontSize:13,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</span>
                      <span className="num" style={{fontSize:12,color:t.type==="Entrada"?"#34D399":"#F87171",fontWeight:600}}>{fmt(t.val)}</span>
                    </button>
                  ))}
                  {searchResults.txTotal>searchResults.txRes.length&&(
                    <button type="button" onClick={goToAllTx} style={{background:"none",border:"none",color:TX2,fontSize:12,cursor:"pointer",padding:"8px 8px",textDecoration:"underline",textUnderlineOffset:3}}>Ver todos os {searchResults.txTotal} lançamentos</button>
                  )}
                </div>
              )}
              {searchResults&&searchResults.catRes.length>0&&(
                <div style={{padding:"10px 10px 4px"}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",padding:"0 8px 6px"}}>Categorias</div>
                  {searchResults.catRes.map(c=>(
                    <button key={c} onClick={()=>goToCat(c)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:12,textAlign:"left"}}>
                      <CategoryIcon cat={c} size={13} color={catColor(c)}/>
                      <span style={{flex:1,fontSize:13,color:TX}}>{c}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults&&searchResults.wishRes.length>0&&(
                <div style={{padding:"10px 10px 4px"}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",padding:"0 8px 6px"}}>Metas</div>
                  {searchResults.wishRes.map(w=>(
                    <button key={w.id} onClick={()=>goToWish(w)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:12,textAlign:"left"}}>
                      <Sparkles size={13} color={accent}/>
                      <span style={{flex:1,fontSize:13,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.name}</span>
                      <span className="num" style={{fontSize:12,color:TX2}}>{fmt(w.price)}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults&&searchResults.plannedRes.length>0&&(
                <div style={{padding:"10px 10px 4px"}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",padding:"0 8px 6px"}}>Previstos</div>
                  {searchResults.plannedRes.map(p=>(
                    <button key={p.id} onClick={()=>goToPlanned(p)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:12,textAlign:"left"}}>
                      <Calendar size={13} color={accent}/>
                      <span style={{flex:1,fontSize:13,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.desc}</span>
                      <span className="num" style={{fontSize:12,color:TX2}}>{fmt(p.val)}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults&&searchResults.recurringRes.length>0&&(
                <div style={{padding:"10px 10px 4px"}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",padding:"0 8px 6px"}}>Recorrências</div>
                  {searchResults.recurringRes.map(p=>(
                    <button key={p.id} onClick={()=>goToPlanned(p)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:12,textAlign:"left"}}>
                      <Repeat size={13} color="#A78BFA"/>
                      <span style={{flex:1,fontSize:13,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.desc}</span>
                      <span className="num" style={{fontSize:12,color:TX2}}>{fmt(p.val)}/mês</span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults&&searchResults.invRes.length>0&&(
                <div style={{padding:"10px 10px 4px"}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",padding:"0 8px 6px"}}>Investimentos</div>
                  {searchResults.invRes.map(t=>(
                    <button key={t.id} onClick={()=>goToTx(t)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:12,textAlign:"left"}}>
                      <TrendingUp size={13} color="#3B82F6"/>
                      <span style={{flex:1,fontSize:13,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</span>
                      <span className="num" style={{fontSize:12,color:TX2}}>{fmt(t.val)}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults&&searchResults.instRes.length>0&&(
                <div style={{padding:"10px 10px 4px"}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",padding:"0 8px 6px"}}>Parcelamentos</div>
                  {searchResults.instRes.map(i=>(
                    <button key={i.id} onClick={goToInst} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:12,textAlign:"left"}}>
                      <CreditCard size={13} color="#FBBF24"/>
                      <span style={{flex:1,fontSize:13,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i.desc}</span>
                      <span className="num" style={{fontSize:12,color:TX2}}>{fmt(i.totalVal)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{padding:"10px 18px",borderTop:`1px solid ${BD}`,fontSize:11,color:TX3,flexShrink:0,display:"flex",justifyContent:"space-between"}}>
              <span>Atalho: Ctrl+K</span><span>Esc para fechar</span>
            </div>
        </Modal>
      )}
      {delInstId&&instToDelete&&(
        <Modal maxWidth={360} padding={28}>
          <div style={{fontSize:15,fontWeight:700,color:TX,marginBottom:8,letterSpacing:"-0.01em"}}>Apagar "{instToDelete.desc}"?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:22}}>{instTxCount} transações vinculadas.</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <BtnGhost onClick={()=>deleteInstallment(delInstId,false)} style={{width:"100%",paddingInline:12}}>Apagar só o parcelamento</BtnGhost>
            <button onClick={()=>deleteInstallment(delInstId,true)} style={{width:"100%",padding:"12px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:ERROR_BG,color:"white"}}>Apagar tudo + {instTxCount} transações</button>
            <button onClick={()=>setDelInstId(null)} style={{width:"100%",padding:"9px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,background:"transparent",color:TX3}}>Cancelar</button>
          </div>
        </Modal>
      )}
      {showProfile&&(
        <Modal onClose={()=>setShowProfile(false)} maxWidth={380} padding={30}>
            <div style={{fontSize:17,fontWeight:700,color:TX,marginBottom:4,letterSpacing:"-0.01em"}}>Minha Conta</div>
            <div style={{fontSize:12,color:TX2,marginBottom:24}}>{user.email}</div>

            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:8}}>Nome</div>
            <input value={newName} onChange={e=>setNewName(e.target.value)} style={{...SI,marginBottom:14}}/>
            {profileMsg&&<div style={{fontSize:12,color:"#34D399",marginBottom:10}}>{profileMsg}</div>}
            <Btn onClick={saveProfile} style={{width:"100%",paddingInline:12,fontSize:13,marginBottom:26}}>Salvar nome</Btn>

            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:8}}>Nome da sua conta (aparece no topo do app)</div>
            <input value={walletName} onChange={e=>setWalletName(e.target.value)} style={{...SI,marginBottom:20}}/>

            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:10}}>Cor de destaque</div>
            <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
              {Object.entries(PALETTES).map(([key,p])=>(
                <button key={key} onClick={()=>setAccentKey(key)} title={p.name} className="touch-44" style={{width:28,height:28,borderRadius:"50%",border:accentKey===key?`2px solid ${TX}`:"2px solid transparent",background:p.base,cursor:"pointer",padding:0}}/>
              ))}
            </div>

            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:10}}>Tamanho dos botões</div>
            <div style={{marginBottom:26}}><DensityToggle/></div>

            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Tag size={12}/>Categorias personalizadas</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
              {customCats.length===0&&<div style={{fontSize:12,color:TX3}}>Nenhuma ainda — criadas automaticamente ao importar um CSV.</div>}
              {customCats.map(c=>(
                <span key={c} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_CHIP,padding:"5px 10px",fontSize:12,color:TX2}}>
                  <Tag size={11}/>{c}
                  <button onClick={()=>removeCustomCat(c)} title={`Remover categoria ${c}`} aria-label={`Remover categoria ${c}`} className="touch-44" style={{background:"none",border:"none",color:"#F87171",cursor:"pointer",padding:0,display:"flex"}}><X size={12}/></button>
                </span>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:26}}>
              <input placeholder="Nova categoria..." value={newCatInput} onChange={e=>setNewCatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomCat()} style={{...SI,flex:1}}/>
              <button onClick={addCustomCat} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${BD2}`,color:accent,borderRadius:R_INPUT,padding:"0 18px",cursor:"pointer"}}><Plus size={16}/></button>
            </div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Undo2 size={12}/>Lixeira</div>
            <div style={{fontSize:12,color:TX3,marginBottom:12,lineHeight:1.5}}>Metas e previstos excluídos ficam guardados aqui por {TRASH_RETENTION_DAYS} dias e podem ser restaurados.</div>
            <button onClick={()=>{setShowProfile(false);setShowTrash(true);}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:"rgba(255,255,255,0.03)",border:`1px solid ${BD2}`,color:TX2,padding:"11px",borderRadius:R_INPUT,cursor:"pointer",fontSize:12,fontWeight:700,marginBottom:26}}><Trash2 size={14}/>Abrir lixeira {trash.length>0?`(${trash.length})`:""}</button>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Cloud size={12}/>Backup completo</div>
            <div style={{fontSize:12,color:TX3,marginBottom:12,lineHeight:1.5}}>Transações, previstos, parcelamentos, desejos e categorias — tudo num único arquivo.</div>
            <div style={{display:"flex",gap:8,marginBottom:26}}>
              <button onClick={exportAllBackup} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:"rgba(255,255,255,0.03)",border:`1px solid ${BD2}`,color:accent,padding:"11px",borderRadius:R_INPUT,cursor:"pointer",fontSize:12,fontWeight:700}}><Download size={14}/>Exportar tudo</button>
              <label style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:"rgba(255,255,255,0.03)",border:`1px solid ${BD2}`,color:TX2,padding:"11px",borderRadius:R_INPUT,cursor:"pointer",fontSize:12,fontWeight:700}}>
                <Upload size={14}/>Importar tudo
                <input type="file" accept=".json" style={{display:"none"}} onChange={importAllBackup}/>
              </label>
            </div>
            <button onClick={()=>{setDeleteAccountPhrase("");setDeleteAccountOpen(true);}} style={{width:"100%",padding:"11px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#F8717114",color:"#F87171",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Trash2 size={14}/>Apagar conta e dados</button>
            <BtnGhost onClick={()=>setShowProfile(false)} style={{width:"100%",paddingInline:12}}>Fechar</BtnGhost>
        </Modal>
      )}
      {selectedCalDay&&(
        <Modal onClose={()=>setSelectedCalDay(null)} maxWidth={400} padding={26} contentStyle={{maxHeight:"80vh"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontSize:15,fontWeight:700,color:TX}}>{selectedCalDay}</div>
              <button onClick={()=>setSelectedCalDay(null)} style={{background:"none",border:"none",color:TX3,cursor:"pointer"}}><X size={18}/></button>
            </div>
            {selectedDayEvents.length===0?(
              <div style={{fontSize:13,color:TX3,textAlign:"center",padding:20}}>Nenhum evento neste dia.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {selectedDayEvents.map(t=>(
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:t.color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,color:TX,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</div>
                      <div style={{fontSize:11,color:TX3}}>{t.label}</div>
                    </div>
                    <div className="num" style={{fontSize:13,fontWeight:700,color:t.color,flexShrink:0}}>{fmt(t.val)}</div>
                  </div>
                ))}
              </div>
            )}
        </Modal>
      )}
      {showTrash&&(
        <Modal onClose={()=>setShowTrash(false)} maxWidth={460} padding={26}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:16,fontWeight:700,color:TX,display:"flex",alignItems:"center",gap:8}}><Trash2 size={16} color={accent}/>Lixeira</div>
              <button onClick={()=>setShowTrash(false)} style={{background:"none",border:"none",color:TX3,cursor:"pointer"}}><X size={18}/></button>
            </div>
            <div style={{fontSize:12.5,color:TX2,marginBottom:18,lineHeight:1.5}}>Itens excluídos ficam aqui por {TRASH_RETENTION_DAYS} dias antes de serem apagados de vez.</div>
            {trash.length===0?(
              <EmptyState icon={Trash2} title="A lixeira está vazia." boxed={false} padding="32px 16px" iconSize={22} style={{fontSize:13}}/>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {trash.map(entry=>{
                  const daysLeft=Math.max(0,TRASH_RETENTION_DAYS-Math.floor((Date.now()-entry.deletedAt)/(24*60*60*1000)));
                  const meta={
                    wish:{label:entry.item.name,value:entry.item.price,typeName:"Meta",Icon:Sparkles},
                    planned:{label:entry.item.desc,value:entry.item.val,typeName:"Previsto",Icon:Calendar},
                    tx:{label:entry.item.desc,value:entry.item.val,typeName:"Transação",Icon:Receipt},
                    installment:{label:entry.item.desc,value:entry.item.totalVal,typeName:"Parcelamento",Icon:CreditCard},
                  }[entry.type];
                  const{label,value,typeName,Icon}=meta;
                  return(
                    <div key={entry.trashId} style={{display:"flex",alignItems:"center",gap:10,background:CARD,border:`1px solid ${BD}`,borderRadius:R_INPUT,padding:"11px 13px"}}>
                      <Icon size={14} color={TX3}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:TX,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
                        <div style={{fontSize:11,color:TX3}}>{typeName} · {fmt(value)} · some em {daysLeft} dia{daysLeft===1?"":"s"}</div>
                      </div>
                      <button onClick={()=>restoreFromTrash(entry.trashId)} title="Restaurar" className="touch-44" style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:8,padding:"6px 10px",color:accent,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600}}><Undo2 size={13}/>Restaurar</button>
                      <button onClick={()=>purgeTrashItem(entry.trashId)} title="Excluir definitivamente" aria-label="Excluir definitivamente" style={{background:"none",border:"none",color:TX3,cursor:"pointer",padding:4}}><X size={14}/></button>
                    </div>
                  );
                })}
              </div>
            )}
        </Modal>
      )}

      {/* ---- Barra de baixo (celular) ---- */}
      <nav className="bottom-nav" aria-label="Seções no celular">
        {appTabs.filter(t=>t.mobile).map(t=>{const Ic=t.icon;const on=tab===t.id;return(
          <button key={t.id} type="button" onClick={()=>goTab(t.id)} aria-current={on?"page":undefined} className="bottom-nav-btn">
            <span className="bottom-nav-ico"><Ic size={20} aria-hidden="true"/></span>
            <span className="bottom-nav-lbl">{t.short||t.label}</span>
          </button>
        );})}
        {(()=>{const on=appTabs.some(t=>!t.mobile&&t.id===tab);return(
          <button type="button" onClick={()=>setShowMore(true)} aria-current={on?"page":undefined} aria-haspopup="dialog" className="bottom-nav-btn">
            <span className="bottom-nav-ico"><MoreHorizontal size={20} aria-hidden="true"/></span>
            <span className="bottom-nav-lbl">Mais</span>
          </button>
        );})()}
      </nav>
      {showMore&&(
        <Modal align="sheet" onClose={()=>setShowMore(false)} maxWidth={560} padding={16} label="Mais">
          <div style={{width:36,height:4,borderRadius:4,background:BD2,margin:"0 auto 14px"}} aria-hidden="true"/>
          {appTabs.filter(t=>!t.mobile).map(t=>{const Ic=t.icon;return(
            <button key={t.id} type="button" className="more-row" onClick={()=>goTab(t.id)} aria-current={tab===t.id?"page":undefined}>
              <Ic size={20} aria-hidden="true" color={TX2}/><span style={{flex:1}}><span className="more-t">{t.label}</span><span className="more-h">{t.hint}</span></span><ChevronRight size={16} color={TX3} aria-hidden="true"/>
            </button>
          );})}
          <button type="button" className="more-row" onClick={()=>{setShowMore(false);setShowProfile(true);}}>
            <Settings size={20} aria-hidden="true" color={TX2}/><span style={{flex:1}}><span className="more-t">Perfil</span><span className="more-h">Nome, cor, densidade, backup e conta</span></span><ChevronRight size={16} color={TX3} aria-hidden="true"/>
          </button>
          <button type="button" className="more-row" onClick={()=>{setShowMore(false);setShowTrash(true);}}>
            <Trash2 size={20} aria-hidden="true" color={TX2}/><span style={{flex:1}}><span className="more-t">Lixeira</span><span className="more-h">Itens apagados nos últimos {TRASH_RETENTION_DAYS} dias</span></span><ChevronRight size={16} color={TX3} aria-hidden="true"/>
          </button>
          <button type="button" className="more-row" onClick={()=>{setShowMore(false);setUser(null);}}>
            <LogOut size={20} aria-hidden="true" color={TX2}/><span style={{flex:1}}><span className="more-t">Sair</span></span>
          </button>
        </Modal>
      )}

      <div key={tab} className="main-content" style={{padding:"28px 32px",maxWidth:1600,margin:"0 auto",animation:`fadeIn .35s ${EASE_OUT}`}}>

        {tab==="dashboard"&&(
        <TabPanel id="dashboard" idPrefix="app">
        {(()=>{
          const hour=new Date().getHours();
          const greeting=hour<5?"Boa noite":hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
          const firstName=(user.name||"").split(" ")[0]||user.name;
          const proj30=cashFlowProjections.find(p=>p.days===30);
          const bestCats=catDataDisplay.slice(0,5);
          const todayLong=new Date(todayISO+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});
          const monthName=new Date(todayISO+"T12:00:00").toLocaleDateString("pt-BR",{month:"long"});
          // Gráfico: os últimos 6 meses até o atual, com zero nos meses sem lançamento.
          const curIdx=monthIndex(currentMonthKeyReal);
          const byMonth=new Map(summary.map(m=>[m.month,m]));
          const chartData=[5,4,3,2,1,0].map(i=>{const mk=monthAt(curIdx-i);const m=byMonth.get(mk);return{month:mk,in:m?.in||0,out:m?.out||0};});
          const recentTx=[...transactions].filter(t=>t.date<=todayISO).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,4);
          const row=(key,left,meta,right,rightColor)=>(
            <li key={key} className="home-li">
              <div style={{minWidth:0}}><div className="home-li-name">{left}</div>{meta&&<div className="home-li-meta">{meta}</div>}</div>
              <span className="num home-li-val" style={rightColor?{color:rightColor}:undefined}>{right}</span>
            </li>
          );
          const money=(v,isIn)=>`${isIn?"+":"−"}${fmt(Math.abs(v))}`;
          const newTxButton=(full)=>(
            <Btn onClick={()=>openNewTx()} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,...(full?{width:"100%",height:48}:{})}}><Plus size={16}/>Novo lançamento</Btn>
          );
          return(
          <div className="stagger" style={{display:"flex",flexDirection:"column",gap:24}}>
            <PageHeader icon={LayoutDashboard} title="Início" subtitle={`${todayLong.charAt(0).toUpperCase()+todayLong.slice(1)} · ${greeting}, ${firstName}`} actions={<span className="only-desktop">{newTxButton(false)}</span>}/>

            {resumoDoMes&&<p style={{margin:"-12px 0 0",fontSize:13,color:TX2,maxWidth:"70ch",lineHeight:1.55}}>{resumoDoMes.text}</p>}

            {/* ---- Primeiros passos: só para quem ainda não tem nenhum dado ---- */}
            {!onboardingDismissed&&transactions.length===0&&wishes.length===0&&plannedExpenses.length===0&&installments.length===0&&(
              <Card style={{padding:20,display:"flex",alignItems:"flex-start",gap:14,boxShadow:"none"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600,color:TX,marginBottom:6}}>Bem-vindo(a) ao {walletName}</div>
                  <div style={{fontSize:13,color:TX2,lineHeight:1.6}}>Comece com “Novo lançamento”. Contas fixas vão em <strong style={{color:TX}}>Previstos</strong> e objetivos em <strong style={{color:TX}}>Metas</strong>. As descobertas e os gráficos aparecem sozinhos conforme você usa.</div>
                </div>
                <IconButton icon={X} label="Dispensar" onClick={()=>setOnboardingDismissed(true)}/>
              </Card>
            )}

            {/* ---- Saldo: um card principal com filete (Card hero do LaCalle Life) e os três números do mês ---- */}
            <section aria-label="Saldo" className="home-hero">
              <div className="home-hero-main">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,color:TX2,fontWeight:500}}>
                  Saldo atual
                  <IconButton icon={Info} size={14} label="Como chegamos no saldo atual" onClick={()=>setExplainKey("saldoAtual")}/>
                </div>
                <div className="num home-metric" style={{color:balance<0?ERROR:TX}}><AnimatedValue value={balance}/></div>
                {resumoDoMes&&<Comparison delta={resumoDoMes.stats.economia} formatMagnitude={fmt} label={`de economia em ${monthName}`} tone={resumoDoMes.stats.economia>=0?"positive":"negative"} style={{fontSize:12,marginTop:8}}/>}
              </div>
              <button type="button" className="home-hero-num" onClick={()=>setExplainKey("saldoLivre")}>
                <span>Saldo livre</span><b className="num">{fmt(freeBalance)}</b>
              </button>
              <button type="button" className="home-hero-num" onClick={()=>setProjectionDrawer({key:"saldoPrevisto",daysAhead:daysToEndOfMonth,title:"Previsto no Fim do Mês"})}>
                <span>Previsto no fim do mês</span><b className="num" style={{color:(projection?.expected??0)<0?ERROR:TX}}>{projection?fmt(projection.expected):"—"}</b>
              </button>
              {proj30&&(
                <button type="button" className="home-hero-num" onClick={()=>setProjectionDrawer({key:"quantoPossoGastar",daysAhead:30,title:"Quanto você pode gastar"})}>
                  <span>Pode gastar em 30 dias</span><b className="num" style={{color:proj30.value<0?ERROR:accentText(accent)}}>{fmt(Math.max(0,proj30.value))}</b>
                </button>
              )}
            </section>
            {proj30&&proj30.value<0&&(
              <p role="status" style={{margin:"-12px 0 0",fontSize:13,color:ERROR,display:"flex",gap:6,alignItems:"center"}}><AlertTriangle size={14} aria-hidden="true"/>A projeção dos próximos 30 dias está negativa em {fmt(Math.abs(proj30.value))}. Evite gastos não essenciais.</p>
            )}
            <div className="only-mobile">{newTxButton(true)}</div>

            <div className="home-grid">
              <div className="home-col">
                {chartData.some(d=>d.in||d.out)&&(
                  <section>
                    <SectionTitle action={<span style={{fontSize:12,color:TX3}}>últimos 6 meses</span>}>Receitas e gastos</SectionTitle>
                    <Card style={{boxShadow:"none"}}><IncomeExpenseChart data={chartData}/></Card>
                  </section>
                )}
                <section>
                  <SectionTitle>Evolução do seu dinheiro</SectionTitle>
                  <Card style={{boxShadow:"none",padding:"6px 16px"}}>
                    <ul className="home-list">
                      {moneySteps.map(s=>row(s.label,s.label,null,fmt(s.value),s.value<0?ERROR:TX))}
                    </ul>
                  </Card>
                </section>
              </div>
              <div className="home-col">
                <section>
                  <SectionTitle>Patrimônio e metas</SectionTitle>
                  {patrimonySeries.length>=2&&<Card style={{boxShadow:"none",marginBottom:10}}><TrendChart data={patrimonySeries} color={accent}/></Card>}
                  <Card style={{boxShadow:"none",padding:"6px 16px"}}>
                    <ul className="home-list">
                      {row("pat","Patrimônio",null,resumoDoMes?fmt(resumoDoMes.stats.patrimonio):"—")}
                      {resumoDoMes?.stats?.meta&&row("meta",`Meta ${resumoDoMes.stats.meta.name}`,null,`${resumoDoMes.stats.meta.pct}%`)}
                      {row("desc","Descobertas do mês",null,String(consultantInsights.length))}
                    </ul>
                  </Card>
                </section>
                <section>
                  <SectionTitle action={<button type="button" className="home-link" onClick={()=>setTab("planning")}>Linha do tempo</button>}>Próximos eventos</SectionTitle>
                  <Card style={{boxShadow:"none",padding:"6px 16px"}}>
                    {upcomingEvents.length===0?(
                      <div style={{color:TX3,padding:"14px 0",fontSize:13}}>Nada agendado por enquanto.</div>
                    ):(
                      <ul className="home-list">
                        {upcomingEvents.map(t=>row(t.id,t.desc,`${t.label} · ${formatDay(t.date,todayISO)}`,money(t.val,t.type==="Entrada"),t.type==="Entrada"?SUCCESS:undefined))}
                      </ul>
                    )}
                  </Card>
                </section>
                {recentTx.length>0&&(
                  <section>
                    <SectionTitle action={<button type="button" className="home-link" onClick={()=>setTab("transactions")}>Ver todos</button>}>Últimos lançamentos</SectionTitle>
                    <Card style={{boxShadow:"none",padding:"6px 16px"}}>
                      <ul className="home-list">
                        {recentTx.map(t=>row(t.id,t.desc,`${t.cat} · ${formatDay(t.date,todayISO)}`,money(t.val,t.type==="Entrada"),t.type==="Entrada"?SUCCESS:undefined))}
                      </ul>
                    </Card>
                  </section>
                )}
              </div>
            </div>

            <div className="home-grid">
              {bestCats.length>0&&(
                <section>
                  <SectionTitle>Principais categorias</SectionTitle>
                  <Card style={{boxShadow:"none",padding:20,display:"flex",flexDirection:"column",gap:12}}>
                    {bestCats.map(d=>{
                      const cc=d.name==="Outras categorias"?TX3:catColor(d.name);
                      const pct=Math.round((d.value/(bestCats[0].value||1))*100);
                      return(
                        <div key={d.name}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:6}}>
                            <span style={{fontSize:13,color:TX,display:"flex",alignItems:"center",gap:8,minWidth:0}}><i aria-hidden="true" style={{width:8,height:8,borderRadius:"50%",background:cc,flexShrink:0}}/>{d.name}</span>
                            <span className="num" style={{fontSize:13,fontWeight:600,color:TX}}>{fmt(d.value)}</span>
                          </div>
                          <ProgressBar pct={pct} color={cc} height={5}/>
                        </div>
                      );
                    })}
                  </Card>
                </section>
              )}
              <section>
                <SectionTitle>Saúde financeira</SectionTitle>
                <Card style={{boxShadow:"none",padding:"6px 16px"}}>
                  <ul className="home-list">
                    {healthIndicators.slice(0,5).map(hi=>{
                      const tone={"Excelente":[SUCCESS_SURFACE,SUCCESS],"Boa":[MUTED,TX],"Atenção":[WARNING_SURFACE,WARNING],"Crítica":[DANGER_SURFACE,ERROR]}[hi.status]||[MUTED,TX2];
                      return(
                        <li key={hi.label} className="home-li">
                          <button type="button" className="home-li-btn" onClick={()=>setExplainKey(`health:${hi.label}`)} aria-label={`${hi.label}: ${hi.value}${hi.status?`, ${hi.status}`:""}. Como é calculado`}>
                            <span className="home-li-name" style={{color:TX2}}>{hi.label}</span>
                            <span style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:13,fontWeight:600,color:TX}}>{hi.value}</span>
                              {hi.status&&<span style={{fontSize:11,fontWeight:600,background:tone[0],color:tone[1],padding:"2px 8px",borderRadius:999}}>{hi.status}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </section>
            </div>

            {(investmentStats||subscriptions)&&(
              <div className="home-grid">
                {investmentStats&&(
                  <section>
                    <SectionTitle>Investimentos</SectionTitle>
                    <Card style={{boxShadow:"none",padding:"6px 16px"}}>
                      <ul className="home-list">
                        {row("inv-total","Total investido",null,fmt(investmentStats.aportes))}
                        {row("inv-rend","Rentabilidade cadastrada",null,fmt(investmentStats.rendimentos),SUCCESS)}
                        {investmentParticipacao!==null&&row("inv-part","Participação no patrimônio",null,`${investmentParticipacao}%`)}
                      </ul>
                    </Card>
                  </section>
                )}
                {subscriptions&&(
                  <section>
                    <SectionTitle>Assinaturas</SectionTitle>
                    <Card style={{boxShadow:"none",padding:"6px 16px"}}>
                      <ul className="home-list">
                        {row("sub-total","Total mensal",null,fmt(subscriptions.total))}
                        {row("sub-big","Maior assinatura",null,subscriptions.biggest?`${subscriptions.biggest.desc} · ${fmt(subscriptions.biggest.val)}`:"—")}
                        {row("sub-pend","Pendentes este mês",null,String(subscriptions.pendingCount))}
                      </ul>
                    </Card>
                  </section>
                )}
              </div>
            )}

            {/* ---- Descobertas: poucos destaques, com o raciocínio completo de cada um ---- */}
            <section>
              <SectionTitle>Descobertas do mês</SectionTitle>
              {consultantInsights.length===0?(
                <Card style={{boxShadow:"none",padding:20,display:"flex",alignItems:"center",gap:10}}>
                  <CheckCircle2 size={18} color={SUCCESS} aria-hidden="true"/>
                  <div style={{fontSize:13,color:TX2}}>Tudo certo por aqui. Nenhum destaque no momento.</div>
                </Card>
              ):(
                <div className="insights-grid">
                  {consultantInsights.map((it,i)=><InsightCard key={it.key} item={it} index={i} action={insightActionFor(it)}/>)}
                </div>
              )}
            </section>
          </div>
          );
        })()}
        </TabPanel>
        )}

        {tab==="planning"&&(
        <TabPanel id="planning" idPrefix="app">
          <PlanningTab
            accent={accent} planTab={planTab} setPlanTab={setPlanTab}
            nextEvents={nextEvents} balance={balance} cashFlowProjections={cashFlowProjections} instStats={instStats}
            pendingParcelasCount={pendingParcelasCount} subscriptions={subscriptions} committedNextMonth={committedNextMonth}
            committedNext3Months={committedNext3Months} nextMonthKeyReal={nextMonthKeyReal} reminders={reminders} reminderVisual={reminderVisual}
            shiftCalMonth={shiftCalMonth} calMonthLabel={calMonthLabel} calGrid={calGrid} todayISO={todayISO} setSelectedCalDay={setSelectedCalDay}
            timelineBuckets={timelineBuckets}
            enhancedWishes={enhancedWishes}
            decisions={decisions} askAmount={askAmount} setAskAmount={setAskAmount} askResult={askResult} setAskResult={setAskResult}
            transactions={transactions} plannedExpenses={plannedExpenses} currentMonthKeyReal={currentMonthKeyReal} decisionColor={decisionColor}
            simType={simType} setSimType={setSimType} simResult={simResult} setSimResult={setSimResult} simGoalId={simGoalId} setSimGoalId={setSimGoalId}
            simExtra={simExtra} setSimExtra={setSimExtra} simValue={simValue} setSimValue={setSimValue} simParcelas={simParcelas} setSimParcelas={setSimParcelas}
            simMonths={simMonths} setSimMonths={setSimMonths} simReturn={simReturn} setSimReturn={setSimReturn} runSimulation={runSimulation}
            summary={summary} pctChange={pctChange}
          />
        </TabPanel>
        )}

        {tab==="transactions"&&(
        <TabPanel id="transactions" idPrefix="app">
          <TransactionsTab
            onNewTx={()=>openNewTx()} accent={accent} catColor={catColor}
            filterType={filterType} search={search} filterMonth={filterMonth} months={months} filterCat={filterCat}
            fullCats={fullCats} viewTotals={viewTotals} filtered={filtered} groupedByDate={groupedByDate} editingTx={editingTx}
            setFilterType={setFilterType} setSearch={setSearch} setFilterMonth={setFilterMonth} setFilterCat={setFilterCat}
            onImportCSV={importCSV} onExportCSV={exportCSV} onClearAll={()=>setShowClearConfirm(true)}
            onStartEditTx={startEditTx} onRequestDelete={performDelete}
          />
        </TabPanel>
        )}

        {tab==="planned"&&(
        <TabPanel id="planned" idPrefix="app">
          <PlannedTab
            plannedMonth={plannedMonth} plannedStats={plannedStats} showPlannedForm={showPlannedForm}
            editingPlanned={editingPlanned} plannedForm={plannedForm} plannedValRef={plannedValRef}
            frequentTx={frequentTx} renderFrequentPicks={renderFrequentPicks} applyFrequentToPlanned={applyFrequentToPlanned}
            fullCats={fullCats} catColor={catColor}
            plannedItemsForMonth={plannedItemsForMonth} sortedPlannedItemsForMonth={sortedPlannedItemsForMonth}
            expandedNotes={expandedNotes} accent={accent}
            setPlannedForm={setPlannedForm} setEditingPlanned={setEditingPlanned} setShowPlannedForm={setShowPlannedForm}
            plannedFormSnapshotRef={plannedFormSnapshotRef}
            onShiftMonth={delta=>setPlannedMonth(m=>shiftMonth(m,delta))} onGoToday={()=>setPlannedMonth(monthKey(todayFn()))}
            onSave={savePlannedItem} onCancelForm={closePlannedForm} onTogglePaid={togglePlannedPaid}
            onToggleIgnored={togglePlannedIgnoredForMonth} onTransferToWish={openTransferToWish}
            onStartEdit={startEditPlanned} onRequestDelete={performDelete} onToggleNotes={toggleNotes} onEndAt={endPlannedAt}
            endedPlanned={plannedExpenses.filter(p=>p.recurring&&p.until&&monthIndex(plannedMonth)>monthIndex(p.until))}
          />
        </TabPanel>
        )}

        {tab==="installments"&&(
        <TabPanel id="installments" idPrefix="app">
          <InstallmentsTab
            installments={installments} instStats={instStats} showInstForm={showInstForm} instDraft={instDraft}
            monthlyPreview={monthlyPreview} fullCats={fullCats} txMap={txMap} todayFn={todayFn} accent={accent} catColor={catColor}
            onOpenForm={openInstForm} onCancelForm={()=>setShowInstForm(false)} onChangeDraft={setInstDraft}
            onAdd={addInstallment} onRequestDelete={setDelInstId}
          />
        </TabPanel>
        )}

        {tab==="wishes"&&(
        <TabPanel id="wishes" idPrefix="app">
          <WishesTab
            wishes={wishes} sortedWishes={sortedWishes} wishSortBy={wishSortBy} showWishForm={showWishForm}
            wishForm={wishForm} editingWish={editingWish} expandedNotes={expandedNotes} accent={accent}
            wishFormSnapshotRef={wishFormSnapshotRef}
            setWishSortBy={setWishSortBy} setShowWishForm={setShowWishForm} setEditingWish={setEditingWish} setWishForm={setWishForm}
            onSave={saveWish} onCancelForm={closeWishForm} onToggleDone={toggleWishDone} onMove={moveWish}
            onTransferToPlanned={openTransferToPlanned} onRequestDelete={performDelete} onToggleNotes={toggleNotes}
          />
        </TabPanel>
        )}
      </div>
    </div>
    </div>
    </DensityProvider>
    </AccentContext.Provider>
  );
}

export default function Root(){
  const [user,setUser]=useState(null);
  const [checkingSession,setCheckingSession]=useState(true);
  // Voltou pelo link de "Esqueci minha senha": antes de entrar no app, pede
  // a senha nova (ver lib/authRecovery.js).
  const [recovering,setRecovering]=useState(openedFromRecoveryLink);

  // Ao carregar a página, confere se já existe uma sessão válida (cookie do
  // Supabase) — se sim, entra direto sem pedir login de novo. Depois disso,
  // fica ouvindo mudanças de sessão (login em outra aba, logout, expiração
  // de token) e mantém `user` sempre sincronizado com a sessão real.
  useEffect(()=>{
    const deriveUser=session=>{
      if(!session?.user)return null;
      const name=session.user.user_metadata?.name||session.user.email.split("@")[0];
      return {email:session.user.email,name};
    };
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(deriveUser(session));
      setCheckingSession(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY")setRecovering(true);
      // Renovar a sessão não troca o nome que já está na tela (o nome salvo
      // no app vence o da conta, que pode estar desatualizado).
      setUser(prev=>{const next=deriveUser(session);return prev&&next&&prev.email===next.email?{...next,name:prev.name}:next;});
    });
    return ()=>subscription.unsubscribe();
  },[]);

  // O resto do app (MainApp) já sabe deslogar chamando setUser(null) — só
  // interceptamos essa chamada aqui pra também encerrar a sessão de verdade
  // no Supabase, sem precisar mudar nada dentro do MainApp.
  // Ao sair, as cópias do modo sem rede saem do aparelho junto (dado
  // financeiro não fica num aparelho compartilhado). Se alguma ainda não foi
  // para a nuvem, pergunta antes, porque sair apagaria essas edições.
  const handleSetUser=value=>{
    if(value===null){
      if(hasPendingLocalCopy()&&!window.confirm("Há alterações feitas sem internet que ainda não chegaram à nuvem. Se sair agora, elas são apagadas deste aparelho. Sair mesmo assim?"))return;
      clearLocalCopies();
      supabase.auth.signOut();
    }
    else setUser(value);
  };

  if(checkingSession){
    return(
      // Conferindo a sessão: o fundo da marca e o símbolo (antes, um azul-marinho
      // e um spinner azul que sobraram da identidade anterior).
      <div style={{background:BG,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <FinanceMark size={36}/>
      </div>
    );
  }
  if(!user)return <AuthScreen onLogin={(email,name)=>setUser({email,name})}/>;
  if(recovering)return <NewPasswordScreen onDone={()=>{
    setRecovering(false);
    // tira o "#...type=recovery" do endereço para um recarregar não pedir a senha de novo
    if(window.location.hash)window.history.replaceState(null,"",window.location.pathname+window.location.search);
  }}/>;
  return <MainApp user={user} setUser={handleSetUser}/>;
}