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
 * Núcleo de inteligência financeira do Lacalle Finance, 100% baseado em regras
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
import { supabase } from "./lib/supabaseClient";
import { storage } from "./lib/storage";
import AuthScreen from "./components/AuthScreen";
import { FinancialEngine, InsightEngine, fmt, monthKey, addDaysStr, addMonthsStr, daysInMonth, formatMonths, diffDays, MONTH_ORDER, MONTHS_ARR, PlannedStatus } from "./lib/financialEngine";
import ProjectionDrawer from "./components/ProjectionDrawer";
import { BG, CARD, C2, BD, BD2, TX, TX2, TX3, HDR, TEAL, TEAL2, HOVER, R_CARD, R_BTN, R_INPUT, R_CHIP, SH_SM, SH_MD, SH_LG, SI, cardStyle, AccentContext, NUM_FONT } from "./lib/theme";
import { Card, Modal, CategoryIcon, AnimatedValue, ChartTooltip, LinkifiedText, LedgerRows, LineItemsList, DataUsedChecklist, HeroNumberAnimated, ComparisonBar, InsightCard, DecisionRow, Btn, BtnGhost, MoneyInput, toDecimalStr, DECISION_STATUS_COLOR } from "./components/ui";
import { parseNum, roundMoney, validateAmount, validateDate, validateText, validateInt, firstError, DATE_MIN, DATE_MAX, MAX_DESC_LEN, MAX_NOTES_LEN, MAX_PARCELAS } from "./lib/validation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, AreaChart, Area, CartesianGrid } from "recharts";
import {
  Wallet, TrendingUp, CreditCard, Calendar, Sparkles, Gamepad2, UtensilsCrossed,
  Car, Shirt, Laptop, HeartPulse, GraduationCap, Briefcase, Package, Repeat, Undo2, Gift, Tag,
  Settings, LogOut, Search, X, Plus, Pencil, Trash2, Check, ChevronLeft, ChevronRight, ChevronDown,
  ChevronUp, Upload, Download, AlertTriangle, ArrowUpCircle, ArrowDownCircle, LayoutDashboard,
  Receipt, PiggyBank, Cloud, Loader2, RefreshCw, CheckCircle2, AlertCircle, Info, Landmark, Rocket,
  Gem, Star, Trophy, Lightbulb, ShieldCheck, Target, CalendarDays, Bell, Flag, Hourglass, Clock,
  ArrowRightLeft, EyeOff, Eye
} from "lucide-react";

const CATS=["Lazer","Alimentação","Transporte","Desejos","Roupas","Tecnologia","Saude / Cuidados Pessoais","Educação","Salario / Entradas","Outros","Investimento","Assinaturas","Rembolsos","Presentes"];
const COLORS=["#60A5FA","#818CF8","#34D399","#FB7185","#FBBF24","#A78BFA","#FB923C","#38BDF8","#F472B6","#2DD4BF","#C084FC","#4ADE80","#FCD34D","#94A3B8"];
const CAT_ICON_COMPONENTS={
  "Lazer":Gamepad2,"Alimentação":UtensilsCrossed,"Transporte":Car,"Desejos":Sparkles,"Roupas":Shirt,
  "Tecnologia":Laptop,"Saude / Cuidados Pessoais":HeartPulse,"Educação":GraduationCap,
  "Salario / Entradas":Briefcase,"Outros":Package,"Investimento":TrendingUp,"Assinaturas":Repeat,
  "Rembolsos":Undo2,"Presentes":Gift,
};
// MONTH_ORDER era uma lista fixa de datas hardcoded (jan/25 até jun/27) — ou
// seja, tinha uma "data de validade": a partir de jun/2027 a funcionalidade
// de "Previsto" não recorrente simplesmente pararia de encontrar mês na
// lista. Agora é uma janela rolante calculada a partir da data real do
// dispositivo: sempre 12 meses pra trás e 36 meses pra frente a partir de
// hoje, recalculada a cada carregamento do app — nunca fica velha.
const INV_TIPOS=["Aporte","Resgate","Rendimento"];
const INV_TIPO_COLORS={"Aporte":"#3B82F6","Resgate":"#F0A857","Rendimento":"#22C55E"};
const INV_TIPO_ICONS={"Aporte":PiggyBank,"Resgate":Undo2,"Rendimento":TrendingUp};
const PALETTES={
  blue:{name:"Azul",base:"#3B82F6",dark:"#2563EB"},
  teal:{name:"Teal",base:"#2DD4BF",dark:"#14B8A6"},
  purple:{name:"Roxo",base:"#8B5CF6",dark:"#7C3AED"},
  pink:{name:"Rosa",base:"#EC4899",dark:"#DB2777"},
  orange:{name:"Laranja",base:"#F0A857",dark:"#D97706"},
  green:{name:"Verde",base:"#22C55E",dark:"#16A34A"},
};
const AVATAR_ICONS={wallet:Wallet,piggy:PiggyBank,trending:TrendingUp,credit:CreditCard,landmark:Landmark,rocket:Rocket,gem:Gem,star:Star};
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
// Se um item for transferido de um lado para o outro várias vezes (ex.:
// Desejo -> Previsto -> Desejo -> Previsto...), só o bloco da transferência
// MAIS RECENTE é mantido nas notas — sem isso, um item transferido repetidas
// vezes acumularia um histórico infinito de blocos de texto nas notas.
// "Desejos" continua na expressão por compatibilidade: notas gravadas antes da
// padronização do nome da aba (Desejos -> Metas) precisam continuar sendo
// reconhecidas e substituídas, senão o histórico volta a acumular blocos.
const TRANSFER_NOTE_RE=/\n*— Transferido de (?:Desejos|Metas|Previstos) —\n[^\n]*$/;
const stripTransferNote=notes=>(notes||"").replace(TRANSFER_NOTE_RE,"").trim();
const wishToPlannedPayload=(wish,extra)=>{
  const kept=[];
  if(wish.priority)kept.push(`Prioridade original: ${wish.priority}`);
  if(wish.saved)kept.push(`Já guardado: ${fmt(wish.saved)}`);
  if(wish.monthsTarget)kept.push(`Meta original: ${wish.monthsTarget} meses`);
  const notes=[stripTransferNote(wish.notes),kept.length?`— Transferido de Metas —\n${kept.join(" · ")}`:""].filter(Boolean).join("\n\n");
  return{
    desc:wish.name,
    val:wish.price,
    cat:extra.cat,
    form:extra.form,
    recurring:extra.recurring,
    month:extra.recurring?null:extra.month,
    notes,
    paid:{},
  };
};
const plannedToWishPayload=planned=>{
  const kept=[
    `Categoria original: ${planned.cat}`,
    `Forma de pagamento: ${planned.form}`,
    planned.recurring?"Era um gasto recorrente (assinatura)":`Mês previsto: ${planned.month||"—"}`,
  ];
  const notes=[stripTransferNote(planned.notes),`— Transferido de Previstos —\n${kept.join(" · ")}`].filter(Boolean).join("\n\n");
  return{
    name:planned.desc,
    price:planned.val,
    saved:0,
    priority:"Média",
    monthsTarget:0,
    notes,
    done:false,
  };
};

// ==================== SERVICES: StorageService ====================
const storageKey=email=>`ff6:${email.replace(/[^a-zA-Z0-9]/g,"_")}:v1`;

// ==================== UTILS: datas ====================
const WEEKDAYS_PT=["D","S","T","Q","Q","S","S"];
const MONTH_NAMES_FULL=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ==================== UTILS: links dentro de notas ====================
// Campo `notes` (Desejos e Previstos) é hoje texto simples com detecção de
// URLs. A estrutura foi pensada para evoluir para Markdown/checklist/tags/
// anexos/comentários no futuro sem quebrar o formato salvo (string única).
const URL_SPLIT_REGEX=/((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const URL_TEST_REGEX=/^(?:https?:\/\/|www\.)/i;

// ============================================================================
// FINANCIAL INTELLIGENCE ENGINE
// Núcleo de cálculo financeiro do Lacalle Finance — 100% regras de negócio, SEM IA.
// ============================================================================

const todayFn=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
// DATE_MIN/DATE_MAX vêm de lib/validation.js. Os atributos min/max do
// <input type="date"> continuam sendo usados (dão a UI certa no seletor), mas
// eles NÃO impedem digitação — por isso toda gravação passa por validateDate.



function MainApp({user,setUser}){
  const [isLoaded,setIsLoaded]=useState(false);
  const [syncStatus,setSyncStatus]=useState("loading");
  const [tab,setTab]=useState("dashboard");
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
  const [expandedNotes,setExpandedNotes]=useState({});
  const [wishSortBy,setWishSortBy]=useState("progress");
  // Mesma ideia do sortedPlannedItemsForMonth: memoiza a ordenação da lista
  // de Desejos em vez de reordenar a cada render do componente.
  const sortedWishes=useMemo(()=>[...wishes].sort((a,b)=>{
    if(!!a.done!==!!b.done)return a.done?1:-1;
    if(wishSortBy==="priority"){
      const order={"Alta":0,"Média":1,"Baixa":2};
      const diff=(order[a.priority]??1)-(order[b.priority]??1);
      if(diff!==0)return diff;
    }
    return Math.min(100,b.saved/b.price*100)-Math.min(100,a.saved/a.price*100);
  }),[wishes,wishSortBy]);
  const [showDetails,setShowDetails]=useState(false);

  const [plannedExpenses,setPlannedExpenses]=useState([]);
  const [plannedMonth,setPlannedMonth]=useState(monthKey(todayFn()));
  const [showPlannedForm,setShowPlannedForm]=useState(false);const [editingPlanned,setEditingPlanned]=useState(null);
  const [plannedForm,setPlannedForm]=useState({desc:"",val:"",cat:"Assinaturas",form:"pix",recurring:false,month:monthKey(todayFn()),notes:""});
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
    else if(entry.type==="tx")setTransactions(p=>[entry.item,...p]);
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

  const [accentKey,setAccentKey]=useState("blue");
  const [walletName,setWalletName]=useState("Lacalle Finance");
  const [avatarIcon,setAvatarIcon]=useState("wallet");
  const [onboardingDismissed,setOnboardingDismissed]=useState(false);
  const accent=(PALETTES[accentKey]||PALETTES.blue).base;
  const accentDark=(PALETTES[accentKey]||PALETTES.blue).dark;
  const AvatarIconComp=AVATAR_ICONS[avatarIcon]||Wallet;

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
  const showToast=(msg,type="info")=>{
    const id=Date.now()+Math.random();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3800);
  };

  const historyRef=useRef([]);
  const [historyLen,setHistoryLen]=useState(0);
  const isUndoingRef=useRef(false);

  const pushHistory=()=>{
    const snap={tx:[...transactions],wishes:[...wishes],inst:[...installments],planned:[...plannedExpenses],customCats:[...customCats]};
    const newH=[...historyRef.current.slice(-14),snap];
    historyRef.current=newH;
    setHistoryLen(newH.length);
  };
  const undo=()=>{
    if(!historyRef.current.length)return;
    const prev=historyRef.current[historyRef.current.length-1];
    historyRef.current=historyRef.current.slice(0,-1);
    setHistoryLen(historyRef.current.length);
    isUndoingRef.current=true;
    setTransactions(prev.tx);setWishes(prev.wishes);setInstallments(prev.inst);setPlannedExpenses(prev.planned||[]);setCustomCats(prev.customCats||[]);
  };

  const saveTimerRef=useRef(null);
  const loadedAtRef=useRef(0);
  const justLoadedRef=useRef(true);
  // ---- Detecção de conflito entre abas/dispositivos ----
  // Antes, salvar era sempre "quem salva por último apaga o resto" — sem
  // nenhum aviso. Agora guardamos a "versão" (timestamp) dos dados que
  // sabemos estar salvos na nuvem; antes de sobrescrever, conferimos se
  // ninguém mudou isso por baixo do nosso pé (outra aba/outro aparelho). Se
  // mudou, avisamos em vez de sobrescrever silenciosamente.
  const remoteVersionRef=useRef(0);
  const isReloadingRef=useRef(false);

  const applyRemoteData=d=>{
    setTransactions(d.tx||[]);
    setWishes(d.wishes||[]);
    setInstallments(d.inst||[]);
    setPlannedExpenses(d.planned||[]);
    setCustomCats(d.customCats||[]);
    setAccentKey(d.accentKey||"blue");
    setWalletName(d.walletName||"Lacalle Finance");
    setAvatarIcon(d.avatarIcon||"wallet");
    setOnboardingDismissed(!!d.onboardingDismissed);
    const cutoff=Date.now()-TRASH_RETENTION_DAYS*24*60*60*1000;
    setTrash((d.trash||[]).filter(t=>t.deletedAt>cutoff));
    remoteVersionRef.current=d.updatedAt||0;
  };

  useEffect(()=>{
    const load=async()=>{
      setSyncStatus("loading");
      try{
        const r=await storage.get(storageKey(user.email));
        if(r?.value){
          const d=JSON.parse(r.value);
          applyRemoteData(d);
          if(d.name&&d.name!==user.name)setUser(u=>({...u,name:d.name}));
        }
        setSyncStatus("saved");
      }catch{
        setSyncStatus("idle");
      }
      loadedAtRef.current=Date.now();
      setIsLoaded(true);
    };
    load();
  },[user.email]);

  // Recarrega a versão mais recente da nuvem (usado quando um conflito é
  // detectado): a pessoa perde a edição não salva localmente, mas ganha a
  // versão mais atual em vez de sobrescrevê-la sem querer.
  const reloadFromRemote=async()=>{
    try{
      const r=await storage.get(storageKey(user.email));
      isReloadingRef.current=true;
      if(r?.value)applyRemoteData(JSON.parse(r.value));
      setSyncStatus("saved");
      showToast("Dados atualizados com a versão mais recente da nuvem.","success");
    }catch{
      showToast("Não consegui recarregar os dados agora. Tente de novo.","error");
    }
  };

  // Função de salvamento compartilhada entre o autosave (debounced) e o
  // botão manual de "salvar agora" — evita duplicar a lógica de conflito.
  const doSave=async()=>{
    try{
      const check=await storage.get(storageKey(user.email));
      const remoteUpdatedAt=check?.value?(JSON.parse(check.value).updatedAt||0):0;
      if(remoteUpdatedAt&&remoteVersionRef.current&&remoteUpdatedAt!==remoteVersionRef.current){
        setSyncStatus("conflict");
        return "conflict";
      }
    }catch{/* se a checagem falhar, segue com o salvamento normal — não trava por causa disso */}
    const newUpdatedAt=Date.now();
    const payload=JSON.stringify({tx:transactions,wishes,inst:installments,planned:plannedExpenses,customCats,name:user.name,accentKey,walletName,avatarIcon,trash,onboardingDismissed,updatedAt:newUpdatedAt});
    try{
      const result=await storage.set(storageKey(user.email),payload,false);
      if(!result)throw new Error("Sem resposta do armazenamento");
      remoteVersionRef.current=newUpdatedAt;
      setSyncStatus("saved");
      return "saved";
    }catch(e){
      console.error("Lacalle Finance — erro ao salvar na nuvem:",e);
      // ---- Uma nova tentativa automática antes de avisar o usuário: cobre
      // falhas passageiras de rede/rate limit sem exigir ação manual. ----
      try{
        const retryResult=await storage.set(storageKey(user.email),payload,false);
        if(retryResult){remoteVersionRef.current=newUpdatedAt;setSyncStatus("saved");return "saved";}
      }catch(e2){console.error("Lacalle Finance — nova tentativa de salvar também falhou:",e2);}
      setSyncStatus("error");
      return "error";
    }
  };

  useEffect(()=>{
    if(!isLoaded)return;
    if(justLoadedRef.current){justLoadedRef.current=false;setSyncStatus("saved");return;}
    if(isUndoingRef.current){isUndoingRef.current=false;setSyncStatus("saved");return;}
    if(isReloadingRef.current){isReloadingRef.current=false;setSyncStatus("saved");return;}
    setSyncStatus("saving");
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    saveTimerRef.current=setTimeout(async()=>{
      const status=await doSave();
      if(status==="error")showToast("Falha ao salvar na nuvem. Toque no ícone de atualizar ao lado de \"Sincronizado\" para tentar de novo.","error");
      else if(status==="conflict")showToast("Esses dados foram atualizados em outra aba ou aparelho. Toque em \"Recarregar\" ao lado do status antes de continuar editando, pra não perder a versão mais recente.","error");
    },1200);
    return()=>{if(saveTimerRef.current)clearTimeout(saveTimerRef.current);};
  },[transactions,wishes,installments,plannedExpenses,customCats,user.name,accentKey,walletName,avatarIcon,trash,onboardingDismissed,isLoaded]);

  const retrySave=async()=>{
    setSyncStatus("saving");
    const status=await doSave();
    if(status==="saved")showToast("Salvo na nuvem!","success");
    else if(status==="error")showToast("Ainda não consegui salvar na nuvem. Verifique sua conexão e tente novamente.","error");
    else if(status==="conflict")showToast("Esses dados foram atualizados em outra aba ou aparelho. Toque em \"Recarregar\" para ver a versão mais recente.","error");
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
        cancelEditTx();
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
    return[...s].sort((a,b)=>MONTH_ORDER.indexOf(a)-MONTH_ORDER.indexOf(b));
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
    const idx=MONTH_ORDER.indexOf(currentMonthKeyReal);
    return idx>=0&&idx+1<MONTH_ORDER.length?MONTH_ORDER[idx+1]:currentMonthKeyReal;
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
    parcela:{Ic:CreditCard,c:"#F0A857"},
    assinatura:{Ic:Repeat,c:"#A78BFA"},
    conta:{Ic:Bell,c:"#EF4444"},
    pagamento:{Ic:Bell,c:"#EF4444"},
    previsto:{Ic:Bell,c:"#F0A857"},
    meta:{Ic:Trophy,c:"#22C55E"},
  }[type]||{Ic:Bell,c:TX2});
  const decisionColor=status=>DECISION_STATUS_COLOR[status]||TX3;

  // ==================== HOME INTELIGENTE (Centro de Decisões) ====================
  const freeBalance=useMemo(()=>FinancialEngine.CashFlowAnalyzer.freeBalance({transactions,plannedExpenses,balance,todayISO,currentMonthKey:currentMonthKeyReal}),[transactions,plannedExpenses,balance,todayISO,currentMonthKeyReal]);
  const freeBalanceBreakdown=useMemo(()=>{
    const futureOut=transactions.filter(t=>t.date>todayISO&&t.type==="Saída"&&t.cat!=="Investimento").reduce((s,t)=>s+t.val,0);
    const plannedPending=plannedExpenses.filter(p=>p.recurring||p.month===currentMonthKeyReal).reduce((s,p)=>s+(PlannedStatus.isPending(p,currentMonthKeyReal)?p.val:0),0);
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

  const upcomingEvents=useMemo(()=>[...transactions].filter(t=>t.date>todayISO).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6).map(t=>({...t,...eventMeta(t)})),[transactions,todayISO,plannedById]);

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
  const quickAction=type=>{
    if(type==="meta"){
      setTab("wishes");setEditingWish(null);setWishForm({name:"",price:"",saved:"",priority:"Média",monthsTarget:"",notes:""});setShowWishForm(true);
      return;
    }
    setTab("transactions");
    setEditingTx(null);
    resetQuickAddForm();
    if(type==="receita"){setQaType("Entrada");setQaCat("Salario / Entradas");}
    else if(type==="despesa"){setQaType("Saída");setQaCat("Alimentação");}
    else if(type==="resgate"){setQaCat("Investimento");setQaInvTipo("Resgate");setQaExpanded(true);}
    else if(type==="investimento"){setQaCat("Investimento");setQaInvTipo("Aporte");setQaExpanded(true);}
    setTimeout(()=>{qaDescRef.current?.focus();},80);
  };

  const toggleNotes=key=>setExpandedNotes(p=>({...p,[key]:!p[key]}));

  // ---- Pesquisa Global (Ctrl+K) ----
  const searchResults=useMemo(()=>{
    const q=searchQuery.trim().toLowerCase();
    if(!q)return null;
    return{
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
  const commitQuickAdd=()=>{
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
    showToast(editingTx!==null?"Lançamento atualizado!":"Lançamento adicionado!","success");
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
  // Fecha o modal de editar lançamento, mas confirma antes se algo foi
  // realmente alterado (evita perder edição sem querer ao clicar fora ou no X).
  const requestCloseEditTx=()=>{
    if(!isEditing){cancelEditTx();return;}
    const current=JSON.stringify({type:qaType,desc:qaDesc,val:qaVal,cat:qaCat,date:qaDate,form:qaForm,fixed:qaFixed});
    if(editTxSnapshotRef.current&&current!==editTxSnapshotRef.current)setConfirmDiscard("tx");
    else cancelEditTx();
  };
  const deleteTx=id=>{
    const item=transactions.find(x=>x.id===id);
    pushHistory();
    setTransactions(p=>p.filter(x=>x.id!==id));
    if(item)moveToTrash("tx",item);
    showToast("Transação removida.","info");
  };

  const qaValRef=useRef(null);
  const plannedValRef=useRef(null);

  // ---- Scroll automático até o formulário ao abrir (Adicionar OU Editar) ----
  // Sem isso, ao clicar em "Editar" num item lá embaixo da lista, o formulário
  // abre no topo da seção e fica fora da área visível.
  const wishFormRef=useRef(null);
  const plannedFormRef=useRef(null);
  useEffect(()=>{
    if(showWishForm)requestAnimationFrame(()=>wishFormRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));
  },[showWishForm]);
  useEffect(()=>{
    if(showPlannedForm)requestAnimationFrame(()=>plannedFormRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));
  },[showPlannedForm]);
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
    showToast("Meta excluída.","info");
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
    // remoção da origem e criação no destino no mesmo lote de atualização,
    // sobre o mesmo snapshot de histórico -> operação atômica (undo desfaz as duas juntas)
    setPlannedExpenses(p=>[...p,{...payload,id:genId()}]);
    setWishes(p=>p.filter(x=>x.id!==item.id));
    setTransferWish(null);
    showToast("✅ Item movido para Previstos.","success");
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
    showToast("✅ Item movido para Metas.","success");
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
    let idx=MONTH_ORDER.indexOf(mk);
    if(idx<0)idx=MONTH_ORDER.indexOf(monthKey(todayFn()));
    const ni=Math.max(0,Math.min(MONTH_ORDER.length-1,idx+delta));
    return MONTH_ORDER[ni];
  };
  const savePlannedItem=()=>{
    const err=firstError([
      validateText(plannedForm.desc,{label:"descrição"}),
      validateAmount(plannedForm.val,{label:"valor"}),
      validateText(plannedForm.notes,{label:"nota",required:false,maxLen:MAX_NOTES_LEN}),
    ]);
    if(err){showToast(err,"error");return;}
    pushHistory();
    const base={desc:plannedForm.desc.trim(),val:roundMoney(parseNum(plannedForm.val)),cat:plannedForm.cat,form:plannedForm.form,recurring:plannedForm.recurring,month:plannedForm.recurring?null:plannedForm.month,notes:plannedForm.notes||""};
    if(editingPlanned!==null){
      setPlannedExpenses(p=>p.map(x=>x.id===editingPlanned?{...x,...base}:x));
      setEditingPlanned(null);
    }else{
      setPlannedExpenses(p=>[...p,{...base,id:genId(),paid:{},ignored:{}}]);
    }
    setShowPlannedForm(false);
    setPlannedForm({desc:"",val:"",cat:"Assinaturas",form:"pix",recurring:false,month:plannedMonth,notes:""});
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
    const snap={desc:item.desc,val:toDecimalStr(item.val),cat:item.cat,form:item.form,recurring:item.recurring,month:item.month||plannedMonth,notes:item.notes||""};
    setPlannedForm(snap);
    plannedFormSnapshotRef.current=JSON.stringify(snap);
    setShowPlannedForm(true);
  };
  const deletePlannedItem=id=>{
    const item=plannedExpenses.find(x=>x.id===id);
    pushHistory();
    setPlannedExpenses(p=>p.filter(x=>x.id!==id));
    if(item)moveToTrash("planned",item);
    showToast("Previsto excluído.","info");
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
  // ---- Transforma um previsto de "só este mês" em recorrente todo mês ----
  const makePlannedRecurring=item=>{
    pushHistory();
    setPlannedExpenses(p=>p.map(x=>x.id===item.id?{...x,recurring:true,month:null}:x));
    showToast(`"${item.desc}" agora é recorrente (todo mês).`,"success");
  };

  const importCSV=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const text=ev.target.result.replace(/^\uFEFF/,"");
      const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      if(lines.length===0){showToast("Arquivo vazio.","error");return;}

      const parseLine=line=>{
        if(line.includes("\t"))return line.split("\t").map(c=>c.trim().replace(/^"|"$/g,""));
        const cols=[];let cur="",inQ=false;
        for(const ch of line){if(ch==='"'){inQ=!inQ;}else if(ch===","&&!inQ){cols.push(cur.trim());cur="";}else cur+=ch;}
        cols.push(cur.trim());
        return cols.map(c=>c.replace(/^"|"$/g,""));
      };
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
        let date=cols[colIdx.date]||"";
        let type=colIdx.type!==undefined?(cols[colIdx.type]||""):"";
        let invTipo=colIdx.invTipo!==undefined?cols[colIdx.invTipo]:null;
        let fixed=colIdx.fixed!==undefined?cols[colIdx.fixed]:"Variavel";
        let cat=colIdx.cat!==undefined?(cols[colIdx.cat]||""):"";
        let desc=colIdx.desc!==undefined?(cols[colIdx.desc]||""):"";
        let valRaw=colIdx.valTratado!==undefined?cols[colIdx.valTratado]:cols[colIdx.val];
        let val=parseNum(valRaw);
        let form=colIdx.form!==undefined?(cols[colIdx.form]||"pix").toLowerCase():"pix";

        if(date.includes("/")){
          const p=date.split("/");
          if(p.length===3){
            const yyyy=p[2].length===4?p[2]:`20${p[2]}`;
            date=`${yyyy}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
          }
        }
        if(!date||!desc||val===0){skipped++;return;}

        type=type.toLowerCase().includes("entrada")?"Entrada":"Saída";
        const rawCat=(cat||"").trim();
        let matchedCat=rawCat?(existingLower.get(rawCat.toLowerCase())||newCatsFound.get(rawCat.toLowerCase())):null;
        if(!matchedCat&&rawCat){matchedCat=rawCat;newCatsFound.set(rawCat.toLowerCase(),matchedCat);}
        cat=matchedCat||"Outros";
        if(!["pix","debito","credito","dinheiro","deposito"].includes(form))form="pix";
        if(!INV_TIPOS.includes(invTipo))invTipo=null;
        if(cat==="Investimento"&&!invTipo)invTipo=type==="Saída"?"Aporte":"Resgate";

        newTx.push({id:genId(),date,type,fixed:fixed||"Variavel",cat,desc,val,form,invTipo});
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
      const header="Data,Tipo,InvTipo,Fixo/Variavel,Categoria,Descrição,Valor,Forma";
      const rows=[...transactions].sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[t.date,t.type,t.invTipo||"",t.fixed,t.cat,`"${t.desc}"`,t.val.toFixed(2),t.form].join(","));
      const csv="\uFEFF"+[header,...rows].join("\n");
      const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
      const url=URL.createObjectURL(blob);const a=document.createElement("a");
      a.href=url;a.download=`lacalle-finance_${filterMonth||"todos"}.csv`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
      showToast("CSV exportado!","success");
    }catch(err){showToast("Erro ao exportar: "+err.message,"error");}
  };
  const saveProfile=()=>{
    setProfileMsg("");
    if(newName.trim())setUser(u=>({...u,name:newName.trim()}));
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
        const{error}=await supabase.functions.invoke("delete-account");
        if(error)throw error;
      }catch(e){
        console.error("Lacalle Finance — erro ao apagar conta:",e);
        // Mesmo se a Edge Function falhar (ex.: ainda não foi criada no
        // painel do Supabase), ao menos apaga os dados locais/remotos como
        // rede de segurança, pra não deixar a pessoa "presa".
        try{await storage.delete(storageKey(user.email));}catch{}
      }
      deleteAccountBusyRef.current=false;
      setDeleteAccountBusy(false);
      closeDeleteAccount();
      setUser(null);
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
      const data={tx:transactions,wishes,inst:installments,planned:plannedExpenses,customCats,name:user.name,accentKey,walletName,avatarIcon,trash,exportedAt:new Date().toISOString()};
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
      try{
        const d=JSON.parse(ev.target.result);
        if(!d||typeof d!=="object"||(!d.tx&&!d.planned&&!d.inst&&!d.wishes)){
          showToast("Esse arquivo não parece ser um backup válido do Lacalle Finance.","error");
          return;
        }
        setPendingImport(d);
      }catch(err){
        showToast("Arquivo inválido ou corrompido.","error");
      }
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
    const newAvatarIcon=d.avatarIcon||avatarIcon;
    const newUserName=d.name||user.name;
    const newTrash=d.trash||[];
    setTransactions(newTx);
    setWishes(newWishes);
    setInstallments(newInst);
    setPlannedExpenses(newPlanned);
    setCustomCats(newCustomCats);
    setAccentKey(newAccentKey);
    setWalletName(newWalletName);
    setAvatarIcon(newAvatarIcon);
    setUser(u=>({...u,name:newUserName}));
    setTrash(newTrash);
    setPendingImport(null);
    setShowProfile(false);
    (async()=>{
      setSyncStatus("saving");
      try{
        const newUpdatedAt=Date.now();
        const payload=JSON.stringify({tx:newTx,wishes:newWishes,inst:newInst,planned:newPlanned,customCats:newCustomCats,name:newUserName,accentKey:newAccentKey,walletName:newWalletName,avatarIcon:newAvatarIcon,trash:newTrash,updatedAt:newUpdatedAt});
        const result=await storage.set(storageKey(user.email),payload,false);
        if(!result)throw new Error("Sem resposta do armazenamento");
        remoteVersionRef.current=newUpdatedAt;
        setSyncStatus("saved");
        showToast("Backup importado e salvo na nuvem!","success");
      }catch(err){
        console.error("Lacalle Finance — erro ao salvar backup importado:",err);
        setSyncStatus("error");
        showToast("Importado, mas falhou ao salvar na nuvem. Use 'Salvar agora' no topo.","error");
      }
    })();
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
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:TX2,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Repeat size={12}/>Frequentes</div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {frequentTx.map((item,i)=>(
          <button key={i} onClick={()=>onPick(item)} className="chip-btn" style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_CHIP,padding:"9px 13px",cursor:"pointer",minWidth:112}}>
            <span style={{fontSize:12,fontWeight:600,color:TX,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:140,display:"flex",alignItems:"center",gap:5}}><CategoryIcon cat={item.cat} size={12}/>{item.desc}</span>
            <span className="num" style={{fontSize:12,color:TX2,fontVariantNumeric:"tabular-nums"}}>{fmt(item.val)}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderTxForm=()=>(
    <>
      {!isEditing&&frequentTx.length>0&&renderFrequentPicks(applyFrequent)}
      {qaCat!=="Investimento"?(
        <div style={{display:"flex",marginBottom:16,borderRadius:R_INPUT,overflow:"hidden",background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`}}>
          {["Saída","Entrada"].map(t=>(
            <button key={t} onClick={()=>setQaType(t)} style={{flex:1,padding:"11px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:qaType===t?(t==="Saída"?"#EF4444":"#22C55E"):"transparent",color:qaType===t?"white":TX2,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {t==="Saída"?<ArrowDownCircle size={15}/>:<ArrowUpCircle size={15}/>}{t}
            </button>
          ))}
        </div>
      ):(
        <div style={{display:"flex",marginBottom:16,borderRadius:R_INPUT,overflow:"hidden",background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`}}>
          {INV_TIPOS.map(t=>{const Ic=INV_TIPO_ICONS[t];return(
            <button key={t} onClick={()=>setQaInvTipo(t)} style={{flex:1,padding:"11px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:qaInvTipo===t?INV_TIPO_COLORS[t]:"transparent",color:qaInvTipo===t?"white":TX2,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Ic size={14}/>{t}
            </button>
          );})}
        </div>
      )}
      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <input ref={qaDescRef} placeholder="Descrição..." value={qaDesc} maxLength={120} onChange={e=>setQaDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&quickAdd()} style={{...SI,flex:2}}/>
        <MoneyInput ref={qaValRef} placeholder="R$" value={qaVal} onChange={setQaVal} onKeyDown={e=>e.key==="Enter"&&quickAdd()} style={{...SI,flex:1}}/>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:12}}>
        {fullCats.map(c=>{const cc=catColor(c);return(
          <button key={c} onClick={()=>setQaCat(c)} className="chip-btn" style={{padding:"7px 12px",borderRadius:R_CHIP,border:"none",fontSize:12,cursor:"pointer",background:qaCat===c?cc+"26":"rgba(255,255,255,0.03)",color:qaCat===c?cc:TX2,fontWeight:qaCat===c?700:500,display:"flex",alignItems:"center",gap:5}}><CategoryIcon cat={c} size={13}/>{c}</button>
        );})}
      </div>
      <button onClick={()=>setQaExpanded(p=>!p)} style={{background:"none",border:"none",color:accent,fontSize:12,fontWeight:600,cursor:"pointer",padding:"4px 0",marginBottom:qaExpanded?12:4,display:"flex",alignItems:"center",gap:4}}>
        {qaExpanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>} data, forma, fixo/variável, repetir
      </button>
      {qaExpanded&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:12}}>
          <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Data</div><input type="date" value={qaDate} min={DATE_MIN} max={DATE_MAX} onChange={e=>setQaDate(e.target.value)} style={SI}/></div>
          <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Forma</div><select value={qaForm} onChange={e=>setQaForm(e.target.value)} style={SI}>{["pix","debito","credito","dinheiro","deposito"].map(o=><option key={o}>{o}</option>)}</select></div>
          <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Fixo/Variável</div><select value={qaFixed} onChange={e=>setQaFixed(e.target.value)} style={SI}><option value="Variavel">Variável</option><option value="Fixa">Fixa</option></select></div>
          {!isEditing&&<div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Repetir</div><select value={qaRepeat} onChange={e=>setQaRepeat(e.target.value)} style={SI}><option value="none">Não repetir</option><option value="3m">3 meses</option><option value="6m">6 meses</option><option value="12m">12 meses</option></select></div>}
        </div>
      )}
      {/* O botão continua com aparência "inativa" quando falta preencher algo,
          mas NÃO usa `disabled`: um botão desabilitado engole o clique sem
          explicar nada — quem chegava aqui achava que estava quebrado. Assim o
          clique sempre roda a validação, que diz exatamente o que falta. */}
      <button onClick={quickAdd} aria-disabled={!canAdd} style={{width:"100%",padding:"14px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:14,fontWeight:700,background:!canAdd?"rgba(255,255,255,0.04)":isEditing?"#F0A857":accent,color:!canAdd?TX3:"white",boxShadow:canAdd?`0 2px 10px ${isEditing?"#F0A857":accent}40`:"none",transition:"filter .15s ease, box-shadow .15s ease"}}>
        {isEditing?"Salvar alterações":qaCat==="Investimento"?`+ ${qaInvTipo}`:`+ Adicionar ${qaType}`}
      </button>
    </>
  );

  const appTabs=[
    {id:"dashboard",label:"Início",icon:LayoutDashboard},
    {id:"planning",label:"Planejamento",short:"Planos",icon:CalendarDays},
    {id:"transactions",label:"Transações",icon:Receipt},
    {id:"planned",label:"Previstos",icon:Calendar},
    {id:"installments",label:"Parcelas",icon:CreditCard},
    {id:"wishes",label:"Metas",icon:Sparkles},
  ];
  const instToDelete=delInstId?installments.find(i=>i.id===delInstId):null;
  const instTxCount=instToDelete?instToDelete.txIds.filter(id=>txMap.has(id)).length:0;

  if(!isLoaded)return(
    <div style={{background:BG,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",gap:16}}>
      <div style={{background:`linear-gradient(135deg, ${TEAL}22, ${TEAL}0A)`,border:`1px solid ${TEAL}40`,borderRadius:18,width:54,height:54,display:"flex",alignItems:"center",justifyContent:"center"}}><Wallet size={23} color={TEAL}/></div>
      <div style={{color:TX,fontWeight:700,fontSize:17}}>Lacalle Finance</div>
      <div style={{color:TX2,fontSize:13,display:"flex",alignItems:"center",gap:6}}><Loader2 size={14} className="spin"/>Carregando seus dados…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite;}`}</style>
    </div>
  );

  return(
    <AccentContext.Provider value={accent}>
    <div style={{background:BG,minHeight:"100vh",color:TX,fontFamily:"'Inter',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap');
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
        button:active:not(:disabled){transform:scale(0.97);}
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
        .chart-card{display:flex;flex-direction:column;}
        .chart-card .chart-fill{flex:1;min-height:0;}
        .rg-2col{display:grid;grid-template-columns:1fr;gap:20px;}
        @media(min-width:900px){.rg-2col{grid-template-columns:1fr 1fr;}}
        .insights-grid{display:grid;grid-template-columns:1fr;gap:14px;}
        @media(min-width:720px){.insights-grid{grid-template-columns:1fr 1fr;}}
        @keyframes insightIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        .insight-card-anim{animation:insightIn .5s cubic-bezier(.2,.8,.2,1) both;}
        .insight-card-anim:hover{transform:translateY(-3px);}
        @keyframes heroCardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .hero-card-anim{animation:heroCardIn .5s cubic-bezier(.2,.8,.2,1) both;}
        .nav-tab{position:relative;transition:background .18s ease, color .18s ease;}
        .nav-tab:hover{color:${TX} !important;background:${HOVER}44 !important;}
        .surface-card{transition:border-color .18s ease, box-shadow .18s ease, transform .18s ease;}

        /* ---- Tipografia dos números: Hanken Grotesk, encorpada e tabular ---- */
        .num,.stat-val,.hero-balance{font-family:${NUM_FONT};font-variant-numeric:tabular-nums;letter-spacing:-0.02em;}

        /* ---- Motion (add): entrada em cascata, indicador de aba, hover lift ---- */
        @keyframes fadeInUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes indicatorIn{from{opacity:0;transform:scaleX(.2)}to{opacity:1;transform:scaleX(1)}}
        .main-content .bento>*,.main-content .rg-2col>*,.main-content .stagger>*{animation:fadeInUp .5s cubic-bezier(.2,.8,.2,1) backwards;}
        .main-content .bento>*:nth-child(1),.main-content .rg-2col>*:nth-child(1),.main-content .stagger>*:nth-child(1){animation-delay:.03s}
        .main-content .bento>*:nth-child(2),.main-content .rg-2col>*:nth-child(2),.main-content .stagger>*:nth-child(2){animation-delay:.08s}
        .main-content .bento>*:nth-child(3),.main-content .rg-2col>*:nth-child(3),.main-content .stagger>*:nth-child(3){animation-delay:.13s}
        .main-content .bento>*:nth-child(4),.main-content .rg-2col>*:nth-child(4),.main-content .stagger>*:nth-child(4){animation-delay:.18s}
        .main-content .bento>*:nth-child(5),.main-content .stagger>*:nth-child(5){animation-delay:.23s}
        .main-content .bento>*:nth-child(6),.main-content .stagger>*:nth-child(6){animation-delay:.28s}
        .main-content .bento>*:nth-child(n+7),.main-content .stagger>*:nth-child(n+7){animation-delay:.32s}
        .fc-card:hover{transform:translateY(-2px);}
        .nav-tab-underline{position:absolute;left:12px;right:12px;bottom:0;height:2.5px;border-radius:3px 3px 0 0;background:${accent};transform-origin:center bottom;animation:indicatorIn .32s cubic-bezier(.2,.8,.2,1);box-shadow:0 0 12px ${accent}80;}
        @media (prefers-reduced-motion: reduce){
          .main-content,.main-content .bento>*,.main-content .rg-2col>*,.main-content .stagger>*,.insight-card-anim,.hero-card-anim,.nav-tab-underline{animation:none !important;}
          .fc-card:hover{transform:none;}
          *{transition-duration:.01ms !important;}
        }

        /* ---- Mobile responsiveness ---- */
        .app-header{display:flex;align-items:center;gap:14px;}
        .hdr-info{flex:1;min-width:0;}
        .hdr-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}
        @media(max-width:560px){
          .main-content{padding:16px !important;}
          .app-header{padding:12px 16px !important;gap:10px;}
          .hero-balance{font-size:36px !important;}
          .hdr-username{display:none;}
          .sync-label{display:none;}
          .stat3{grid-template-columns:repeat(3,1fr) !important;gap:8px !important;}
          .stat3 .stat-card{padding:12px 8px !important;}
          .stat3 .stat-val{font-size:13px !important;}
          .stat3 .stat-label{font-size:10px !important;}
        }
        @media(max-width:380px){
          .hdr-actions .undo-count{display:none;}
        }

        /* ---- Navegação inferior (bottom nav) no celular ---- */
        .bottom-nav{display:none;}
        .bottom-nav-btn{background:none;border:none;cursor:pointer;flex:1 1 0;min-width:0;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 1px 4px;transition:color .15s ease;}
        .bottom-nav-ico{display:flex;align-items:center;justify-content:center;width:40px;height:26px;border-radius:13px;transition:background .18s ease;flex-shrink:0;}
        .bottom-nav-lbl{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        @media(max-width:760px){
          .top-tabs{display:none !important;}
          .bottom-nav{
            display:flex;position:fixed;left:0;right:0;bottom:0;z-index:250;
            background:rgba(11,27,43,0.97);backdrop-filter:blur(14px);
            border-top:1px solid ${BD2};
            padding:4px 4px calc(4px + env(safe-area-inset-bottom));
          }
          .main-content{padding-bottom:calc(84px + env(safe-area-inset-bottom)) !important;}
          .toast-wrap{bottom:calc(86px + env(safe-area-inset-bottom)) !important;}
        }

        /* ---- Margem de segurança no topo (notch/barra de status do celular) ---- */
        .app-header{padding-top:calc(14px + env(safe-area-inset-top)) !important;}
        @media(max-width:560px){
          .app-header{padding-top:calc(12px + env(safe-area-inset-top)) !important;}
        }
      `}</style>

      <div className="toast-wrap" style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:300,display:"flex",flexDirection:"column",gap:8,alignItems:"center",pointerEvents:"none",width:"100%",padding:"0 16px"}}>
        {toasts.map(t=>{
          const Ic=t.type==="error"?AlertCircle:t.type==="success"?CheckCircle2:Info;
          const col=t.type==="error"?"#EF4444":t.type==="success"?"#22C55E":TX2;
          return(
            <div key={t.id} style={{background:"rgba(11,27,43,0.97)",backdropFilter:"blur(12px)",border:`1px solid ${BD2}`,color:TX,padding:"13px 18px",borderRadius:R_INPUT,fontSize:13,fontWeight:600,boxShadow:SH_LG,animation:"toastIn .3s cubic-bezier(.2,.8,.2,1)",maxWidth:380,display:"flex",alignItems:"center",gap:9}}>
              <Ic size={16} color={col}/>{t.msg}
            </div>
          );
        })}
      </div>

      <div className="app-header" style={{background:HDR,padding:"14px 24px",borderBottom:`1px solid ${BD}`}}>
        <div style={{background:`linear-gradient(135deg, ${accent}26, ${accent}0C)`,border:`1px solid ${accent}38`,borderRadius:12,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <AvatarIconComp size={16} color={accent} strokeWidth={2}/>
        </div>
        <div className="hdr-info">
          <div style={{fontWeight:700,fontSize:14.5,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:"-0.01em"}}>{walletName}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:1}}>
            {syncStatus==="loading"&&<><Loader2 size={11} className="spin" color={TX3}/><span className="sync-label" style={{fontSize:11,color:TX3}}>Carregando</span></>}
            {syncStatus==="saving"&&<><Loader2 size={11} className="spin" color={TX3}/><span className="sync-label" style={{fontSize:11,color:TX3}}>Salvando</span></>}
            {syncStatus==="saved"&&<><Cloud size={11} color={accent}/><span className="sync-label" style={{fontSize:11,color:TX2}}>Sincronizado</span><button onClick={retrySave} title="Salvar agora" style={{background:"none",border:"none",color:TX3,cursor:"pointer",padding:0,display:"flex"}}><RefreshCw size={11}/></button></>}
            {syncStatus==="error"&&<><AlertTriangle size={11} color="#F0A857"/><span className="sync-label" style={{fontSize:11,color:"#F0A857"}}>Erro</span><button onClick={retrySave} style={{background:"none",border:"none",color:"#F0A857",cursor:"pointer",padding:0}}><RefreshCw size={11}/></button></>}
            {syncStatus==="conflict"&&<><AlertTriangle size={11} color="#EF4444"/><span className="sync-label" style={{fontSize:11,color:"#EF4444"}} title="Esses dados foram alterados em outra aba ou aparelho">Dados desatualizados</span><button onClick={reloadFromRemote} title="Recarregar dados mais recentes" style={{background:"none",border:"none",color:"#EF4444",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:3,fontSize:11,fontWeight:600}}><RefreshCw size={11}/>Recarregar</button></>}
          </div>
        </div>
        <div className="hdr-actions">
          <button onClick={undo} disabled={historyLen===0} title={`Desfazer (${historyLen} passos)`} style={{background:historyLen>0?"rgba(255,255,255,0.05)":"transparent",border:"none",borderRadius:10,padding:"7px 10px",color:historyLen>0?TX2:TX3,cursor:historyLen>0?"pointer":"not-allowed",fontSize:12,flexShrink:0,display:"flex",alignItems:"center",gap:5}}>
            <Undo2 size={14}/><span className="undo-count">{historyLen>0?historyLen:""}</span>
          </button>
          <button onClick={()=>setShowSearch(true)} title="Pesquisar (Ctrl+K)" style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:10,padding:"7px 9px",color:TX2,cursor:"pointer",flexShrink:0}}><Search size={14}/></button>
          <div className="hdr-username" style={{fontSize:12,color:TX2,flexShrink:0,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
          <button onClick={()=>setShowProfile(true)} title="Minha conta" style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:10,padding:"7px 9px",color:TX2,cursor:"pointer",flexShrink:0}}><Settings size={14}/></button>
          <button onClick={()=>setUser(null)} title="Sair" style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:10,padding:"7px 9px",color:TX2,cursor:"pointer",flexShrink:0}}><LogOut size={14}/></button>
        </div>
      </div>

      {isEditing&&(
        <Modal onClose={requestCloseEditTx} maxWidth={420} padding={28} zIndex={100}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{fontSize:16,fontWeight:700,color:TX,letterSpacing:"-0.01em"}}>Editar lançamento</div>
            <button onClick={requestCloseEditTx} style={{background:"none",border:"none",color:TX3,cursor:"pointer",padding:4}}><X size={20}/></button>
          </div>
          {renderTxForm()}
        </Modal>
      )}
      {pendingImport&&(
        <Modal maxWidth={360} padding={32} zIndex={190} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:"#F0A85718",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Upload size={20} color="#F0A857"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em"}}>Importar backup?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:10,lineHeight:1.5}}>Isso vai <strong style={{color:TX}}>substituir</strong> todos os seus dados atuais (transações, previstos, parcelamentos, desejos, categorias) pelos dados desse arquivo.</div>
          <div style={{fontSize:12,color:TX3,marginBottom:24}}>{pendingImport.tx?.length||0} transações · {pendingImport.planned?.length||0} previstos · {pendingImport.inst?.length||0} parcelamentos · {pendingImport.wishes?.length||0} desejos</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setPendingImport(null)} style={{flex:1,padding:"12px"}}>Cancelar</BtnGhost>
            <Btn onClick={confirmImportAll} style={{flex:1,padding:"12px",fontSize:13}}>Importar</Btn>
          </div>
        </Modal>
      )}
      {showClearConfirm&&(
        <Modal maxWidth={340} padding={32} zIndex={100} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:"#EF444418",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Trash2 size={20} color="#EF4444"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em"}}>Apagar tudo?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>Todas as transações serão removidas permanentemente.</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setShowClearConfirm(false)} style={{flex:1,padding:"12px"}}>Cancelar</BtnGhost>
            <button onClick={()=>{pushHistory();setTransactions([]);setShowClearConfirm(false);showToast("Tudo apagado.","info");}} style={{flex:1,padding:"12px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#EF4444",color:"white"}}>Apagar tudo</button>
          </div>
        </Modal>
      )}
      {pendingDuplicateTx&&(
        <Modal onClose={()=>setPendingDuplicateTx(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:"#F0A85718",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><AlertTriangle size={20} color="#F0A857"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em"}}>Parece duplicado</div>
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>Você já tem um lançamento de "{pendingDuplicateTx.desc}" de {fmt(pendingDuplicateTx.val)} nesse mesmo dia. Quer lançar mesmo assim?</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setPendingDuplicateTx(null)} style={{flex:1,padding:"12px"}}>Cancelar</BtnGhost>
            <Btn onClick={()=>{setPendingDuplicateTx(null);commitQuickAdd();}} style={{flex:1,padding:"12px",justifyContent:"center"}}>Lançar mesmo assim</Btn>
          </div>
        </Modal>
      )}
      {confirmDiscard&&(
        <Modal onClose={()=>setConfirmDiscard(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:"#F0A85718",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><AlertTriangle size={20} color="#F0A857"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em"}}>Descartar alterações?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>Você tem alterações não salvas neste formulário. Se sair agora, elas serão perdidas.</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setConfirmDiscard(null)} style={{flex:1,padding:"12px"}}>Continuar editando</BtnGhost>
            <button onClick={()=>{
              if(confirmDiscard==="wish"){setShowWishForm(false);setEditingWish(null);}
              else if(confirmDiscard==="planned"){setShowPlannedForm(false);setEditingPlanned(null);}
              else if(confirmDiscard==="tx")cancelEditTx();
              setConfirmDiscard(null);
            }} style={{flex:1,padding:"12px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#EF4444",color:"white"}}>Descartar</button>
          </div>
        </Modal>
      )}
      {deleteAccountOpen&&(()=>{
        const phraseOk=deleteAccountPhrase.trim().toUpperCase()===ACCOUNT_DELETE_PHRASE;
        return(
        <Modal onClose={deleteAccountBusy?()=>{}:closeDeleteAccount} maxWidth={400} padding={30} zIndex={200}>
          <div style={{width:46,height:46,borderRadius:14,background:"#EF444418",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><AlertTriangle size={20} color="#EF4444"/></div>
          <div style={{fontSize:17,fontWeight:700,color:TX,marginBottom:10,textAlign:"center",letterSpacing:"-0.01em"}}>Apagar sua conta para sempre?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:14,lineHeight:1.6}}>
            Isso apaga <strong style={{color:TX}}>todos</strong> os seus lançamentos, metas, previstos e parcelamentos, além da sua conta de login. Esta ação <strong style={{color:"#EF4444"}}>não passa pela lixeira e não pode ser desfeita</strong>.
          </div>
          <div style={{fontSize:12.5,color:TX2,marginBottom:16,lineHeight:1.6,background:"#EF444410",border:`1px solid #EF444430`,borderRadius:R_INPUT,padding:"10px 12px"}}>
            Se você só quer uma cópia antes, feche isto e use <strong style={{color:TX}}>Exportar dados</strong>.
          </div>
          <div style={{fontSize:12,color:TX2,marginBottom:6}}>Para confirmar, digite <strong style={{color:TX}}>{ACCOUNT_DELETE_PHRASE}</strong>:</div>
          <input
            value={deleteAccountPhrase}
            onChange={e=>setDeleteAccountPhrase(e.target.value)}
            disabled={deleteAccountBusy}
            autoFocus
            maxLength={40}
            aria-label={`Digite ${ACCOUNT_DELETE_PHRASE} para confirmar`}
            placeholder={ACCOUNT_DELETE_PHRASE}
            style={{...SI,marginBottom:20,letterSpacing:"0.04em"}}
          />
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={closeDeleteAccount} disabled={deleteAccountBusy} style={{flex:1,padding:"12px",opacity:deleteAccountBusy?0.5:1}}>Cancelar</BtnGhost>
            <button
              onClick={deleteAccount}
              disabled={!phraseOk||deleteAccountBusy}
              style={{flex:1,padding:"12px",borderRadius:R_BTN,border:"none",cursor:(!phraseOk||deleteAccountBusy)?"not-allowed":"pointer",fontSize:13,fontWeight:700,background:(!phraseOk||deleteAccountBusy)?"rgba(239,68,68,0.25)":"#EF4444",color:"white"}}
            >{deleteAccountBusy?"Apagando...":"Apagar para sempre"}</button>
          </div>
        </Modal>
        );
      })()}
      {confirmDelete&&(
        <Modal onClose={()=>setConfirmDelete(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:"#EF444418",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Trash2 size={20} color="#EF4444"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={confirmDelete.label}>Excluir "{confirmDelete.label}"?</div>
          {confirmDelete.impact&&(
            <div style={{fontSize:12.5,color:TX,fontWeight:600,lineHeight:1.5,background:"rgba(255,255,255,0.04)",border:`1px solid ${BD2}`,borderRadius:R_INPUT,padding:"10px 12px",marginBottom:14,textAlign:"left"}}>{confirmDelete.impact}</div>
          )}
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>Você pode usar o botão "desfazer" no topo logo em seguida, caso mude de ideia.</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:"12px"}}>Cancelar</BtnGhost>
            <button onClick={()=>{
              if(confirmDelete.type==="wish")deleteWish(confirmDelete.id);
              else if(confirmDelete.type==="planned")deletePlannedItem(confirmDelete.id);
              else if(confirmDelete.type==="tx")deleteTx(confirmDelete.id);
              setConfirmDelete(null);
            }} style={{flex:1,padding:"12px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#EF4444",color:"white"}}>Excluir</button>
          </div>
        </Modal>
      )}
      {transferPlanned&&(
        <Modal onClose={()=>setTransferPlanned(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:accent+"18",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Sparkles size={20} color={accent}/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={transferPlanned.desc}>Mover "{transferPlanned.desc}" para Metas?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>As informações compatíveis serão preservadas. Categoria, forma de pagamento e mês previsto ficam guardados nas notas do desejo.</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setTransferPlanned(null)} style={{flex:1,padding:"12px"}}>Cancelar</BtnGhost>
            <Btn onClick={confirmTransferToWish} style={{flex:1,padding:"12px",justifyContent:"center"}}>Mover</Btn>
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
              <div style={{display:"flex",borderRadius:R_INPUT,overflow:"hidden",background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`}}>
                <button onClick={()=>setTransferWish(p=>({...p,form:{...p.form,recurring:false}}))} style={{flex:1,padding:"9px",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:!transferWish.form.recurring?accent:"transparent",color:!transferWish.form.recurring?"white":TX2}}>Só um mês</button>
                <button onClick={()=>setTransferWish(p=>({...p,form:{...p.form,recurring:true}}))} style={{flex:1,padding:"9px",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:transferWish.form.recurring?accent:"transparent",color:transferWish.form.recurring?"white":TX2,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Repeat size={12}/>Todo mês</button>
              </div>
            </div>
            {!transferWish.form.recurring&&(
              <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Mês previsto *</div><select value={transferWish.form.month} onChange={e=>setTransferWish(p=>({...p,form:{...p.form,month:e.target.value}}))} style={SI}>{MONTH_ORDER.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
            )}
          </div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setTransferWish(null)} style={{flex:1,padding:"12px"}}>Cancelar</BtnGhost>
            <Btn onClick={confirmTransferToPlanned} style={{flex:1,padding:"12px",justifyContent:"center"}}>Mover para Previstos</Btn>
          </div>
        </Modal>
      )}
      {explainKey&&(()=>{
        const ex=getExplain(explainKey);
        if(!ex)return null;
        return(
          <Modal onClose={()=>setExplainKey(null)} maxWidth={440} padding={28} zIndex={180}>
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
                  <div style={{fontSize:11,fontWeight:700,color:"#22C55E",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>Como melhorar</div>
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
        <Modal onClose={closeSearch} maxWidth={560} padding={0} align="top" scroll={false} contentStyle={{maxHeight:"70vh",display:"flex",flexDirection:"column",overflow:"hidden"}} zIndex={200}>
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
                    <button key={t.id} onClick={()=>goToTx(t)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:10,textAlign:"left"}}>
                      <CategoryIcon cat={t.cat} size={13} color={catColor(t.cat)}/>
                      <span style={{flex:1,fontSize:13,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</span>
                      <span className="num" style={{fontSize:12,color:t.type==="Entrada"?"#22C55E":"#EF4444",fontWeight:600}}>{fmt(t.val)}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults&&searchResults.catRes.length>0&&(
                <div style={{padding:"10px 10px 4px"}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",padding:"0 8px 6px"}}>Categorias</div>
                  {searchResults.catRes.map(c=>(
                    <button key={c} onClick={()=>goToCat(c)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:10,textAlign:"left"}}>
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
                    <button key={w.id} onClick={()=>goToWish(w)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:10,textAlign:"left"}}>
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
                    <button key={p.id} onClick={()=>goToPlanned(p)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:10,textAlign:"left"}}>
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
                    <button key={p.id} onClick={()=>goToPlanned(p)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:10,textAlign:"left"}}>
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
                    <button key={t.id} onClick={()=>goToTx(t)} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:10,textAlign:"left"}}>
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
                    <button key={i.id} onClick={goToInst} className="chip-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:10,textAlign:"left"}}>
                      <CreditCard size={13} color="#F0A857"/>
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
        <Modal maxWidth={360} padding={28} zIndex={100}>
          <div style={{fontSize:15,fontWeight:700,color:TX,marginBottom:8,letterSpacing:"-0.01em"}}>Apagar "{instToDelete.desc}"?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:22}}>{instTxCount} transações vinculadas.</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <BtnGhost onClick={()=>deleteInstallment(delInstId,false)} style={{width:"100%",padding:"12px"}}>Apagar só o parcelamento</BtnGhost>
            <button onClick={()=>deleteInstallment(delInstId,true)} style={{width:"100%",padding:"12px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#EF4444",color:"white"}}>Apagar tudo + {instTxCount} transações</button>
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
            {profileMsg&&<div style={{fontSize:12,color:"#22C55E",marginBottom:10}}>{profileMsg}</div>}
            <Btn onClick={saveProfile} style={{width:"100%",padding:"11px",fontSize:13,marginBottom:26}}>Salvar nome</Btn>

            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:8}}>Nome da sua conta (aparece no topo do app)</div>
            <input value={walletName} onChange={e=>setWalletName(e.target.value)} style={{...SI,marginBottom:20}}/>

            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:10}}>Avatar</div>
            <div style={{display:"flex",gap:8,marginBottom:22,flexWrap:"wrap"}}>
              {Object.entries(AVATAR_ICONS).map(([key,Ic])=>(
                <button key={key} onClick={()=>setAvatarIcon(key)} style={{width:38,height:38,borderRadius:11,border:avatarIcon===key?`1px solid ${accent}55`:`1px solid ${BD}`,background:avatarIcon===key?`${accent}22`:"rgba(255,255,255,0.03)",color:avatarIcon===key?accent:TX2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic size={17}/></button>
              ))}
            </div>

            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:10}}>Cor de destaque</div>
            <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
              {Object.entries(PALETTES).map(([key,p])=>(
                <button key={key} onClick={()=>setAccentKey(key)} title={p.name} style={{width:28,height:28,borderRadius:"50%",border:accentKey===key?`2px solid ${TX}`:"2px solid transparent",background:p.base,cursor:"pointer",padding:0}}/>
              ))}
            </div>

            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:TX2,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Tag size={12}/>Categorias personalizadas</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
              {customCats.length===0&&<div style={{fontSize:12,color:TX3}}>Nenhuma ainda — criadas automaticamente ao importar um CSV.</div>}
              {customCats.map(c=>(
                <span key={c} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_CHIP,padding:"5px 10px",fontSize:12,color:TX2}}>
                  <Tag size={11}/>{c}
                  <button onClick={()=>removeCustomCat(c)} style={{background:"none",border:"none",color:"#EF4444",cursor:"pointer",padding:0,display:"flex"}}><X size={12}/></button>
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
            <button onClick={()=>{setDeleteAccountPhrase("");setDeleteAccountOpen(true);}} style={{width:"100%",padding:"11px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#EF444414",color:"#EF4444",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Trash2 size={14}/>Apagar conta e dados</button>
            <BtnGhost onClick={()=>setShowProfile(false)} style={{width:"100%",padding:"10px"}}>Fechar</BtnGhost>
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
              <div style={{textAlign:"center",color:TX3,fontSize:13,padding:"32px 16px"}}><Trash2 size={22} style={{marginBottom:10,opacity:0.5}}/><div>A lixeira está vazia.</div></div>
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
                      <button onClick={()=>restoreFromTrash(entry.trashId)} title="Restaurar" style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:8,padding:"6px 10px",color:accent,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600}}><Undo2 size={13}/>Restaurar</button>
                      <button onClick={()=>purgeTrashItem(entry.trashId)} title="Excluir definitivamente" aria-label="Excluir definitivamente" style={{background:"none",border:"none",color:TX3,cursor:"pointer",padding:4}}><X size={14}/></button>
                    </div>
                  );
                })}
              </div>
            )}
        </Modal>
      )}

      <div className="top-tabs" style={{display:"flex",gap:4,padding:"8px 20px 0",overflowX:"auto",background:HDR,borderBottom:`1px solid ${BD}`}}>
        {appTabs.map(t=>{const Ic=t.icon;return(
          <button key={t.id} className="nav-tab" onClick={()=>setTab(t.id)} style={{
            padding:"9px 15px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap",
            background:tab===t.id?`${accent}18`:"transparent",color:tab===t.id?TX:TX3,
            borderRadius:"12px 12px 0 0",marginBottom:tab===t.id?0:0,
            display:"flex",alignItems:"center",gap:7,
          }}><Ic size={15}/>{t.label}{tab===t.id&&<span className="nav-tab-underline"/>}</button>
        );})}
      </div>

      {/* ---- Navegação inferior (só no celular) ---- */}
      <nav className="bottom-nav">
        {appTabs.map(t=>{const Ic=t.icon;const active=tab===t.id;return(
          <button key={t.id} onClick={()=>setTab(t.id)} className="bottom-nav-btn" style={{color:active?accent:TX3}}>
            <span className="bottom-nav-ico" style={{background:active?`${accent}1f`:"transparent"}}><Ic size={20}/></span>
            <span className="bottom-nav-lbl" style={{fontSize:9.5,fontWeight:600,letterSpacing:"-0.02em"}}>{t.short||t.label}</span>
          </button>
        );})}
      </nav>

      <div key={tab} className="main-content" style={{padding:"28px 32px",maxWidth:1600,margin:"0 auto",animation:"fadeIn .35s cubic-bezier(.2,.8,.2,1)"}}>

        {tab==="dashboard"&&(()=>{
          const hour=new Date().getHours();
          const greeting=hour<5?"Boa noite":hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
          const firstName=(user.name||"").split(" ")[0]||user.name;
          const proj30=cashFlowProjections.find(p=>p.days===30);
          const bestCats=catDataDisplay.slice(0,5);
          const heroMonthLabel=(()=>{const mm={jan:"Janeiro",fev:"Fevereiro",mar:"Março",abr:"Abril",mai:"Maio",jun:"Junho",jul:"Julho",ago:"Agosto",set:"Setembro",out:"Outubro",nov:"Novembro",dez:"Dezembro"};return mm[currentMonthKeyReal.split("/")[0]]||currentMonthKeyReal;})();
          return(
          <div style={{display:"flex",flexDirection:"column",gap:26}}>

            <div>
              <div style={{fontSize:22,fontWeight:800,color:TX,letterSpacing:"-0.02em"}}>{greeting}, {firstName} 👋</div>
              <div style={{fontSize:13.5,color:TX2,marginTop:6}}>Aqui está o que importa hoje na sua vida financeira.</div>
            </div>

            {/* ---- Onboarding leve: só aparece pra quem ainda não tem nenhum dado cadastrado ---- */}
            {!onboardingDismissed&&transactions.length===0&&wishes.length===0&&plannedExpenses.length===0&&installments.length===0&&(
              <div style={{background:`linear-gradient(135deg, ${accent}18, ${CARD} 70%)`,border:`1px solid ${accent}30`,borderRadius:R_CARD,padding:22,display:"flex",alignItems:"flex-start",gap:14}}>
                <div style={{width:38,height:38,borderRadius:11,background:accent+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Sparkles size={18} color={accent}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14.5,fontWeight:700,color:TX,marginBottom:6}}>Bem-vindo(a) ao {walletName}!</div>
                  <div style={{fontSize:13,color:TX2,lineHeight:1.6,marginBottom:4}}>Pra começar: lance sua primeira <strong style={{color:TX}}>transação</strong> na aba "Transações", cadastre contas fixas em <strong style={{color:TX}}>"Previstos"</strong> e metas de longo prazo em <strong style={{color:TX}}>"Metas"</strong>. Os Insights e os gráficos vão aparecer sozinhos conforme você for usando.</div>
                </div>
                <button onClick={()=>setOnboardingDismissed(true)} title="Dispensar" style={{background:"none",border:"none",color:TX3,cursor:"pointer",padding:4,flexShrink:0}}><X size={16}/></button>
              </div>
            )}

            {/* ---- Resumo do mês: hero card visual estilo Wrapped/Duolingo ---- */}
            {resumoDoMes&&(
              <div className="fc-card hero-card-anim" style={{...cardStyle,padding:32,background:`linear-gradient(135deg, ${accent}24, ${CARD} 62%)`,border:`1px solid ${accent}35`,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-50,right:-50,width:190,height:190,borderRadius:"50%",background:`${accent}18`,filter:"blur(16px)"}}/>
                <div style={{position:"relative"}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:accent,marginBottom:22,display:"flex",alignItems:"center",gap:7}}><Sparkles size={13}/>Resumo do seu mês</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:22,marginBottom:24}}>
                    <div>
                      <div style={{fontSize:22,marginBottom:6}}>💰</div>
                      <div style={{fontSize:10.5,color:TX2,fontWeight:600,marginBottom:3}}>Economia</div>
                      <div className="num" style={{fontSize:20,fontWeight:800,color:resumoDoMes.stats.economia>=0?"#22C55E":"#EF4444",letterSpacing:"-0.01em"}}>{resumoDoMes.stats.economia>=0?"+":""}{fmt(resumoDoMes.stats.economia)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:22,marginBottom:6}}>📈</div>
                      <div style={{fontSize:10.5,color:TX2,fontWeight:600,marginBottom:3}}>Patrimônio</div>
                      <div className="num" style={{fontSize:20,fontWeight:800,color:accent,letterSpacing:"-0.01em"}}>{fmt(resumoDoMes.stats.patrimonio)}</div>
                    </div>
                    {resumoDoMes.stats.meta&&(
                      <div>
                        <div style={{fontSize:22,marginBottom:6}}>🎯</div>
                        <div style={{fontSize:10.5,color:TX2,fontWeight:600,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Meta {resumoDoMes.stats.meta.name}</div>
                        <div className="num" style={{fontSize:20,fontWeight:800,color:"#22C55E",letterSpacing:"-0.01em"}}>{resumoDoMes.stats.meta.pct}%</div>
                      </div>
                    )}
                    <div>
                      <div style={{fontSize:22,marginBottom:6}}>🧠</div>
                      <div style={{fontSize:10.5,color:TX2,fontWeight:600,marginBottom:3}}>Descobertas</div>
                      <div style={{fontSize:20,fontWeight:800,color:TX,letterSpacing:"-0.01em"}}>{consultantInsights.length}</div>
                    </div>
                  </div>
                  <div style={{fontSize:13.5,color:TX2,lineHeight:1.6,fontWeight:500,maxWidth:640}}>{resumoDoMes.text}</div>
                </div>
              </div>
            )}

            {/* ---- Ações rápidas ---- */}
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:2}}>
              {[
                {label:"Nova Receita",icon:ArrowUpCircle,color:"#22C55E",title:"Registrar uma nova receita",action:()=>quickAction("receita")},
                {label:"Nova Despesa",icon:ArrowDownCircle,color:"#EF4444",title:"Registrar uma nova despesa",action:()=>quickAction("despesa")},
                // "Transferência" abria exatamente a mesma coisa que
                // "Investimento" (um aporte) — dois botões diferentes para a
                // mesma ação, o que fazia um deles parecer quebrado. O app não
                // tem modelo de contas/carteiras, então transferência entre
                // contas não existe aqui; o par que existe de verdade é
                // aporte (dinheiro sai da conta) e resgate (dinheiro volta).
                {label:"Aporte",icon:TrendingUp,color:"#3B82F6",title:"Investir: tirar da conta e aplicar",action:()=>quickAction("investimento")},
                {label:"Resgate",icon:Repeat,color:"#A78BFA",title:"Resgatar: trazer dinheiro do investimento de volta para a conta",action:()=>quickAction("resgate")},
                {label:"Nova Meta",icon:Sparkles,color:accent,title:"Criar uma nova meta",action:()=>quickAction("meta")},
              ].map(qa=>(
                <button key={qa.label} onClick={qa.action} title={qa.title} aria-label={qa.title} style={{flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"11px 16px",borderRadius:R_BTN,border:`1px solid ${BD2}`,background:"rgba(255,255,255,0.03)",color:TX,cursor:"pointer",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>
                  <qa.icon size={14} color={qa.color}/>{qa.label}
                </button>
              ))}
            </div>

            {/* ---- 3 saldos (clicáveis: explicam como foram calculados) ---- */}
            <div className="bento">
              <div className="bento-half fc-card" onClick={()=>setExplainKey("saldoAtual")} title="Toque para entender este número" style={{...cardStyle,padding:24,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:28,height:28,borderRadius:9,background:accent+"1f",display:"flex",alignItems:"center",justifyContent:"center"}}><Wallet size={14} color={accent}/></div>
                  <div style={{fontSize:11.5,color:TX2,fontWeight:600,flex:1}}>Saldo Atual</div>
                  <Info size={12} color={TX3}/>
                </div>
                <div style={{fontSize:24,fontWeight:800,color:balance>=0?"#22C55E":"#EF4444",letterSpacing:"-0.02em"}}><AnimatedValue value={balance}/></div>
                <div style={{fontSize:11,color:TX3,marginTop:6,lineHeight:1.4}}>Dinheiro que existe na conta agora.</div>
              </div>
              <div className="bento-half fc-card" onClick={()=>setExplainKey("saldoLivre")} title="Toque para entender este número" style={{...cardStyle,padding:24,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:28,height:28,borderRadius:9,background:"#F0A8571f",display:"flex",alignItems:"center",justifyContent:"center"}}><ShieldCheck size={14} color="#F0A857"/></div>
                  <div style={{fontSize:11.5,color:TX2,fontWeight:600,flex:1}}>Saldo Livre</div>
                  <Info size={12} color={TX3}/>
                </div>
                <div style={{fontSize:24,fontWeight:800,color:freeBalance>=0?"#22C55E":"#EF4444",letterSpacing:"-0.02em"}}><AnimatedValue value={freeBalance}/></div>
                <div style={{fontSize:11,color:TX3,marginTop:6,lineHeight:1.4}}>{(freeBalanceBreakdown.futureOut+freeBalanceBreakdown.plannedPending)>0?`Já descontando ${fmt(freeBalanceBreakdown.futureOut+freeBalanceBreakdown.plannedPending)} em parcelas, contas e recorrências.`:"Nenhum compromisso futuro cadastrado ainda."}</div>
              </div>
              <div className="bento-half fc-card" onClick={()=>setProjectionDrawer({key:"saldoPrevisto",daysAhead:daysToEndOfMonth,title:"Previsto no Fim do Mês"})} title="Toque para ver de onde vem esse número" style={{...cardStyle,padding:24,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:28,height:28,borderRadius:9,background:"#3B82F61f",display:"flex",alignItems:"center",justifyContent:"center"}}><Target size={14} color="#3B82F6"/></div>
                  <div style={{fontSize:11.5,color:TX2,fontWeight:600,flex:1}}>Previsto no Fim do Mês</div>
                  <Info size={12} color={TX3}/>
                </div>
                <div style={{fontSize:24,fontWeight:800,color:(projection?projection.expected:0)>=0?"#22C55E":"#EF4444",letterSpacing:"-0.02em"}}>{projection?<AnimatedValue value={projection.expected}/>:"—"}</div>
                <div style={{fontSize:11,color:TX3,marginTop:6,lineHeight:1.4}}>{projection?`Receitas ${fmt(projection.inc)} · Despesas ${fmt(projection.out)}${projection.plannedPending>0?` · Previstos ${fmt(projection.plannedPending)}`:""}`:`Projeção com receitas e despesas restantes de ${currentMonthKeyReal}.`}</div>
              </div>
            </div>

            {/* ---- Quanto posso gastar ---- */}
            {proj30&&(
              <div onClick={()=>setProjectionDrawer({key:"quantoPossoGastar",daysAhead:30,title:"Quanto você pode gastar"})} className="fc-card" title="Toque para ver de onde vem esse número" style={{...cardStyle,padding:26,cursor:"pointer",background:proj30.value>=0?`linear-gradient(120deg, ${accent}14, ${CARD} 70%)`:`linear-gradient(120deg, #EF444414, ${CARD} 70%)`,border:`1px solid ${proj30.value>=0?accent+"30":"#EF444440"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:32,height:32,borderRadius:10,background:(proj30.value>=0?accent:"#EF4444")+"1f",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{proj30.value>=0?<Check size={16} color={accent}/>:<AlertTriangle size={16} color="#EF4444"/>}</div>
                  <div style={{fontSize:13.5,fontWeight:700,color:TX,flex:1}}>Quanto você pode gastar?</div>
                  <Info size={12} color={TX3}/>
                </div>
                <div className="num" style={{fontSize:30,fontWeight:800,color:proj30.value>=0?accent:"#EF4444",letterSpacing:"-0.02em"}}>{fmt(Math.max(0,proj30.value))}</div>
                <div style={{fontSize:12.5,color:TX2,marginTop:6,lineHeight:1.5}}>{proj30.value>=0?"nos próximos 30 dias, sem comprometer contas e parcelas já previstas.":`Sua projeção para os próximos 30 dias está negativa em ${fmt(Math.abs(proj30.value))}. Evite gastos não essenciais.`}</div>
              </div>
            )}

            {/* ---- Evolução do dinheiro ---- */}
            <Card style={{padding:26}}>
              <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:20,display:"flex",alignItems:"center",gap:8}}><TrendingUp size={16} color={accent}/>Evolução do seu dinheiro</div>
              <div style={{display:"flex",alignItems:"center",gap:6,overflowX:"auto",paddingBottom:4}}>
                {moneySteps.flatMap((s,i)=>{
                  const nodes=[
                    <div key={`step-${s.label}`} style={{flex:"1 1 120px",minWidth:110,textAlign:"center",background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_INPUT,padding:"14px 10px"}}>
                      <div style={{fontSize:11,color:TX2,marginBottom:6,fontWeight:600}}>{s.label}</div>
                      <div className="num" style={{fontSize:15,fontWeight:700,color:s.value>=0?"#22C55E":"#EF4444"}}>{fmt(s.value)}</div>
                    </div>
                  ];
                  if(i<moneySteps.length-1)nodes.push(<ChevronRight key={`arrow-${i}`} size={16} color={TX3} style={{flexShrink:0}}/>);
                  return nodes;
                })}
              </div>
            </Card>

            {/* ---- Próximos eventos ---- */}
            <Card style={{padding:26}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:700,color:TX,display:"flex",alignItems:"center",gap:8}}><CalendarDays size={16} color={accent}/>Próximos eventos</div>
                <button onClick={()=>setTab("planning")} style={{background:"none",border:"none",color:accent,fontSize:12,fontWeight:600,cursor:"pointer"}}>ver linha do tempo</button>
              </div>
              {upcomingEvents.length===0?(
                <div style={{textAlign:"center",color:TX3,padding:20,fontSize:13}}>Nenhum evento futuro cadastrado.</div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {upcomingEvents.map(t=>(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:t.color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</div>
                        <div style={{fontSize:11,color:TX3,marginTop:2}}>{t.label} · {t.date}</div>
                      </div>
                      <div className="num" style={{fontSize:13,fontWeight:700,color:t.color,flexShrink:0}}>{fmt(t.val)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* ---- Segundo plano: gráficos e detalhes ---- */}
            <div style={{marginTop:6,fontSize:11.5,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:TX3}}>Detalhes e gráficos</div>

            {summary.length>0&&(
              <div className="chart-card" style={{...cardStyle,height:340}}>
                <div style={{fontSize:13.5,fontWeight:700,color:TX,marginBottom:16}}>Receitas vs Gastos</div>
                <div className="chart-fill">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary}>
                      <defs>
                        <linearGradient id="barInGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity={1}/><stop offset="100%" stopColor="#16A34A" stopOpacity={0.85}/></linearGradient>
                        <linearGradient id="barOutGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF4444" stopOpacity={1}/><stop offset="100%" stopColor="#DC2626" stopOpacity={0.85}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke={BD} vertical={false}/>
                      <XAxis dataKey="month" tick={{fill:TX2,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:TX2,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                      <Tooltip content={<ChartTooltip/>}/><Legend wrapperStyle={{fontSize:12,color:TX2}}/>
                      <Bar dataKey="in" name="Receitas" fill="url(#barInGrad)" radius={[6,6,0,0]} animationDuration={900}/>
                      <Bar dataKey="out" name="Gastos" fill="url(#barOutGrad)" radius={[6,6,0,0]} animationDuration={900}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="rg-2col">
              {bestCats.length>0&&(
                <Card style={{padding:24}}>
                  <div style={{fontSize:13.5,fontWeight:700,color:TX,marginBottom:16}}>Principais categorias</div>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {bestCats.map(d=>{
                      const cc=d.name==="Outras categorias"?TX3:catColor(d.name);
                      const maxV=bestCats[0].value||1;
                      const pct=Math.round((d.value/maxV)*100);
                      return(
                        <div key={d.name}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                            <span style={{fontSize:12.5,color:TX,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>{d.name==="Outras categorias"?<Package size={12} color={cc}/>:<CategoryIcon cat={d.name} size={12} color={cc}/>}{d.name}</span>
                            <span className="num" style={{fontSize:12.5,fontWeight:700,color:TX}}>{fmt(d.value)}</span>
                          </div>
                          <div style={{background:"rgba(255,255,255,0.06)",borderRadius:20,height:5,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:cc,borderRadius:20}}/></div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              <Card style={{padding:24}}>
                <div style={{fontSize:13.5,fontWeight:700,color:TX,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><ShieldCheck size={15} color={accent}/>Saúde financeira</div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {healthIndicators.slice(0,5).map(h=>{
                    const statusColor={"Excelente":"#22C55E","Boa":accent,"Atenção":"#F0A857","Crítica":"#EF4444"}[h.status]||TX3;
                    return(
                      <div key={h.label} onClick={()=>setExplainKey(`health:${h.label}`)} title="Toque para entender este número" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,cursor:"pointer"}}>
                        <div style={{fontSize:12.5,color:TX2,display:"flex",alignItems:"center",gap:5}}>{h.label}<Info size={10} color={TX3}/></div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:13,fontWeight:700,color:TX}}>{h.value}</span>
                          {h.status&&<span style={{fontSize:10,fontWeight:700,color:statusColor,background:statusColor+"1f",padding:"2px 8px",borderRadius:20}}>{h.status}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {(investmentStats||subscriptions)&&(
              <div className="rg-2col">
                {investmentStats&&(
                  <Card style={{padding:24}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:TX,marginBottom:14,display:"flex",alignItems:"center",gap:8}}><TrendingUp size={15} color={accent}/>Investimentos</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Total investido</span><span className="num" style={{fontSize:13,fontWeight:700,color:TX}}>{fmt(investmentStats.aportes)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Rentabilidade cadastrada</span><span className="num" style={{fontSize:13,fontWeight:700,color:"#22C55E"}}>{fmt(investmentStats.rendimentos)}</span></div>
                      {investmentParticipacao!==null&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Participação no patrimônio</span><span style={{fontSize:13,fontWeight:700,color:accent}}>{investmentParticipacao}%</span></div>}
                    </div>
                  </Card>
                )}
                {subscriptions&&(
                  <Card style={{padding:24}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:TX,marginBottom:14,display:"flex",alignItems:"center",gap:8}}><Repeat size={15} color={accent}/>Assinaturas e recorrências</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Total mensal</span><span className="num" style={{fontSize:13,fontWeight:700,color:"#EF4444"}}>{fmt(subscriptions.total)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Maior assinatura</span><span style={{fontSize:13,fontWeight:700,color:TX}}>{subscriptions.biggest?.desc}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Pendentes este mês</span><span style={{fontSize:13,fontWeight:700,color:"#F0A857"}}>{subscriptions.pendingCount}</span></div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ---- Cartões de consultor: agora abaixo dos gráficos ---- */}
            <div>
              <div style={{fontSize:15,fontWeight:700,color:TX,marginBottom:4,display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.01em"}}><Lightbulb size={17} color={accent}/>O que merece sua atenção hoje</div>
              <div style={{fontSize:12,color:TX3,marginBottom:18}}>Poucos destaques, com o raciocínio completo por trás de cada um — não só a conclusão.</div>
              {consultantInsights.length===0?(
                <div style={{...cardStyle,padding:20,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>🟢</span>
                  <div style={{fontSize:13,color:TX2,fontWeight:600}}>Tudo certo por aqui! Nenhum destaque no momento.</div>
                </div>
              ):(
                <div className="insights-grid">
                  {consultantInsights.map((it,i)=><InsightCard key={it.key} item={it} index={i} action={insightActionFor(it)}/>)}
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {tab==="planning"&&(
          <div style={{display:"flex",flexDirection:"column",gap:24}}>
            <div>
              <div style={{fontSize:17,fontWeight:700,color:TX,letterSpacing:"-0.01em",display:"flex",alignItems:"center",gap:8}}><CalendarDays size={18} color={accent}/>Planejamento</div>
              <div style={{fontSize:12.5,color:TX2,marginTop:4}}>Veja o futuro do seu dinheiro com base no que você já cadastrou.</div>
            </div>

            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
              {[["geral","Visão Geral"],["calendario","Calendário"],["timeline","Timeline"],["metas","Metas"],["decisoes","Decisões"],["ano","Visão Anual"]].map(([id,label])=>(
                <button key={id} onClick={()=>setPlanTab(id)} style={{padding:"9px 15px",borderRadius:R_CHIP,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",background:planTab===id?accent:"rgba(255,255,255,0.03)",color:planTab===id?"white":TX2}}>{label}</button>
              ))}
            </div>

            {planTab==="geral"&&(
              <div style={{display:"flex",flexDirection:"column",gap:20}}>
                <Card style={{padding:26}}>
                  <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><Flag size={16} color={accent}/>Próximos Eventos</div>
                  <div className="bento">
                    {[
                      {l:"Próxima conta",ev:nextEvents.proximaConta,c:"#EF4444"},
                      {l:"Próxima receita",ev:nextEvents.proximaReceita,c:"#22C55E"},
                      {l:"Próxima parcela",ev:nextEvents.proximaParcela,c:"#F0A857"},
                      {l:"Maior pagamento futuro",ev:nextEvents.maiorPagamento,c:"#EF4444"},
                      {l:"Maior entrada prevista",ev:nextEvents.maiorEntrada,c:"#22C55E"},
                    ].map(item=>(
                      <div key={item.l} className="bento-half" style={{...cardStyle,padding:18}}>
                        <div style={{fontSize:11,color:TX2,marginBottom:8}}>{item.l}</div>
                        {item.ev?(
                          <>
                            <div style={{fontSize:13,fontWeight:700,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.ev.desc}</div>
                            <div className="num" style={{fontSize:12,color:item.c,fontWeight:700,marginTop:4}}>{fmt(item.ev.val)}</div>
                            <div style={{fontSize:11,color:TX3,marginTop:2}}>{item.ev.date}</div>
                          </>
                        ):<div style={{fontSize:12,color:TX3}}>Nada agendado</div>}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card style={{padding:26}}>
                  <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:6,display:"flex",alignItems:"center",gap:8}}><TrendingUp size={16} color={accent}/>Fluxo de Caixa Futuro</div>
                  <div style={{fontSize:12,color:TX2,marginBottom:16}}>Estimativa com base no saldo atual, lançamentos futuros e previstos ainda não pagos.</div>
                  <div className="bento">
                    <div className="bento-half" style={{...cardStyle,padding:18,textAlign:"center"}}>
                      <div style={{fontSize:11,color:TX2,marginBottom:6}}>Saldo atual</div>
                      <div className="num" style={{fontSize:17,fontWeight:700,color:balance>=0?"#22C55E":"#EF4444"}}>{fmt(balance)}</div>
                    </div>
                    {cashFlowProjections.map(cp=>(
                      <div key={cp.days} className="bento-half" style={{...cardStyle,padding:18,textAlign:"center"}}>
                        <div style={{fontSize:11,color:TX2,marginBottom:6}}>Em {cp.days} dias</div>
                        <div className="num" style={{fontSize:17,fontWeight:700,color:cp.value>=0?"#22C55E":"#EF4444"}}>{fmt(cp.value)}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card style={{padding:26}}>
                  <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><Briefcase size={16} color={accent}/>Compromissos Financeiros</div>
                  <div className="bento">
                    <div className="bento-half" style={{...cardStyle,padding:18}}><div style={{fontSize:11,color:TX2,marginBottom:6}}>Parcelas restantes</div><div className="num" style={{fontSize:16,fontWeight:700,color:"#F0A857"}}>{fmt(instStats.remaining)}</div><div style={{fontSize:11,color:TX3,marginTop:4}}>{pendingParcelasCount} parcela(s)</div></div>
                    {subscriptions&&<div className="bento-half" style={{...cardStyle,padding:18}}><div style={{fontSize:11,color:TX2,marginBottom:6}}>Assinaturas</div><div className="num" style={{fontSize:16,fontWeight:700,color:"#A78BFA"}}>{fmt(subscriptions.total)}</div><div style={{fontSize:11,color:TX3,marginTop:4}}>{subscriptions.count} ativa(s)</div></div>}
                    <div className="bento-half" style={{...cardStyle,padding:18}}><div style={{fontSize:11,color:TX2,marginBottom:6}}>Comprometido no próximo mês</div><div className="num" style={{fontSize:16,fontWeight:700,color:accent}}>{fmt(committedNextMonth)}</div><div style={{fontSize:11,color:TX3,marginTop:4}}>{nextMonthKeyReal}</div></div>
                    <div className="bento-half" style={{...cardStyle,padding:18}}><div style={{fontSize:11,color:TX2,marginBottom:6}}>Comprometido nos próximos 3 meses</div><div className="num" style={{fontSize:16,fontWeight:700,color:accent}}>{fmt(committedNext3Months)}</div></div>
                  </div>
                </Card>

                <Card style={{padding:26}}>
                  <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><Bell size={16} color={accent}/>Lembretes</div>
                  {reminders.length===0?(
                    <div style={{fontSize:13,color:TX3,textAlign:"center",padding:16}}>Nenhum lembrete no momento.</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {reminders.map((r,i)=>{const{Ic,c}=reminderVisual(r.type);return(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:28,height:28,borderRadius:9,background:c+"1f",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic size={13} color={c}/></div>
                          <div style={{fontSize:13,color:TX,fontWeight:600}}>{r.text}</div>
                        </div>
                      );})}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {planTab==="calendario"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <Card style={{padding:22}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:18}}>
                    <button onClick={()=>shiftCalMonth(-1)} style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:10,width:30,height:30,color:TX2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronLeft size={16}/></button>
                    <div style={{fontSize:14.5,fontWeight:700,color:TX,minWidth:150,textAlign:"center"}}>{calMonthLabel}</div>
                    <button onClick={()=>shiftCalMonth(1)} style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:10,width:30,height:30,color:TX2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronRight size={16}/></button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
                    {WEEKDAYS_PT.map((w,i)=><div key={i} style={{textAlign:"center",fontSize:11,color:TX3,fontWeight:700,padding:"4px 0"}}>{w}</div>)}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
                    {calGrid.map((cell,i)=>{
                      if(!cell)return <div key={i}/>;
                      const isToday=cell.dateStr===todayISO;
                      const uniqueColors=[...new Set(cell.events.map(e=>e.color))].slice(0,4);
                      return(
                        <button key={i} onClick={()=>cell.events.length&&setSelectedCalDay(cell.dateStr)} style={{aspectRatio:"1",borderRadius:10,border:isToday?`1.5px solid ${accent}`:`1px solid ${BD}`,background:isToday?`${accent}14`:"rgba(255,255,255,0.02)",cursor:cell.events.length?"pointer":"default",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:4,gap:3}}>
                          <span style={{fontSize:12,fontWeight:isToday?800:600,color:isToday?accent:TX2}}>{cell.day}</span>
                          {uniqueColors.length>0&&(
                            <div style={{display:"flex",gap:2}}>
                              {uniqueColors.map((c,j)=><span key={j} style={{width:5,height:5,borderRadius:"50%",background:c}}/>)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Card>
                <Card style={{padding:20}}>
                  <div style={{fontSize:11,fontWeight:700,color:TX2,marginBottom:12,letterSpacing:"0.04em",textTransform:"uppercase"}}>Legenda</div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                    {[["Receitas","#22C55E"],["Despesas","#EF4444"],["Investimentos","#3B82F6"],["Parcelas","#F0A857"],["Assinaturas","#A78BFA"]].map(([l,c])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:TX2}}><span style={{width:8,height:8,borderRadius:"50%",background:c}}/>{l}</div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {planTab==="timeline"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {[["hoje","Hoje",Clock],["amanha","Amanhã",Calendar],["semana","Esta semana",CalendarDays],["prox_semana","Próxima semana",CalendarDays],["mes","Este mês",Calendar],["prox_mes","Próximo mês",Calendar]].map(([id,label,Ic])=>{
                  const items=timelineBuckets[id]||[];
                  if(items.length===0)return null;
                  return(
                    <Card key={id} style={{padding:22}}>
                      <div style={{fontSize:13.5,fontWeight:700,color:TX,marginBottom:14,display:"flex",alignItems:"center",gap:7}}><Ic size={15} color={accent}/>{label}</div>
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {items.map((it,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{width:8,height:8,borderRadius:"50%",background:it.color,flexShrink:0}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,color:TX,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.data.desc}</div>
                              <div style={{fontSize:11,color:TX3}}>{it.label}{it.kind==="tx"?` · ${it.data.date}`:` · ${it.month} (sem dia definido)`}</div>
                            </div>
                            <div className="num" style={{fontSize:13,fontWeight:700,color:it.color,flexShrink:0}}>{fmt(it.data.val)}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
                {Object.values(timelineBuckets).every(a=>a.length===0)&&(
                  <div style={{textAlign:"center",color:TX3,padding:40,fontSize:13,background:CARD,border:`1px solid ${BD}`,borderRadius:R_CARD}}>Nada agendado para os próximos dias.</div>
                )}
              </div>
            )}

            {planTab==="metas"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {enhancedWishes.length===0&&<div style={{textAlign:"center",color:TX3,padding:40,fontSize:13,background:CARD,border:`1px solid ${BD}`,borderRadius:R_CARD}}>Nenhuma meta cadastrada ainda. Adicione na aba "Metas".</div>}
                {enhancedWishes.map(w=>(
                  <Card key={w.id} style={{padding:24}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
                      <div style={{fontSize:15,fontWeight:700,color:TX}}>{w.name}</div>
                      <div style={{fontSize:13,fontWeight:700,color:accent}}>{w.pct}%</div>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.06)",borderRadius:20,height:8,overflow:"hidden",marginBottom:16}}>
                      <div style={{width:`${w.pct}%`,height:"100%",background:accent,borderRadius:20,transition:"width .5s"}}/>
                    </div>
                    <div className="bento">
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Valor atual</div><div className="num" style={{fontSize:14,fontWeight:700,color:TX}}>{fmt(w.saved)}</div></div>
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Valor restante</div><div className="num" style={{fontSize:14,fontWeight:700,color:TX}}>{fmt(w.remaining)}</div></div>
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Tempo estimado</div><div style={{fontSize:14,fontWeight:700,color:TX}}>{formatMonths(w.estMonths,w.estMonthsExact)}</div></div>
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Previsão de conclusão</div><div style={{fontSize:14,fontWeight:700,color:TX}}>{w.etaDate||"—"}</div></div>
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Guardar por mês (na sua meta)</div><div className="num" style={{fontSize:14,fontWeight:700,color:TX}}>{w.monthlyByTarget?fmt(w.monthlyByTarget):"defina um prazo em meses"}</div></div>
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4,display:"flex",alignItems:"center",gap:5}}><Hourglass size={11}/>Aportando 50% a mais</div><div style={{fontSize:14,fontWeight:700,color:"#22C55E"}}>{w.timeSaved?`economiza ~${w.timeSaved} meses`:"—"}</div></div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {planTab==="decisoes"&&(
              <div style={{display:"flex",flexDirection:"column",gap:20}}>
                <Card style={{padding:26}}>
                  <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:6,display:"flex",alignItems:"center",gap:8}}><ShieldCheck size={16} color={accent}/>Decisões automáticas</div>
                  <div style={{fontSize:12,color:TX2,marginBottom:18}}>Respostas geradas por regras, a partir dos seus dados — sem inteligência artificial. Toque em "Como cheguei a essa conclusão" em cada uma para ver o cálculo completo.</div>
                  <div style={{display:"flex",flexDirection:"column",gap:20}}>
                    {decisions.map(d=><DecisionRow key={d.key} d={d}/>)}
                  </div>
                </Card>

                <Card style={{padding:26}}>
                  <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><Target size={16} color={accent}/>Posso gastar isso?</div>
                  <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                    <MoneyInput placeholder="Quanto você quer gastar (R$)" value={askAmount} onChange={setAskAmount} style={{...SI,flex:1,minWidth:180}}/>
                    <Btn onClick={()=>setAskResult(FinancialEngine.DecisionEngine.canSpend({amount:parseNum(askAmount),transactions,plannedExpenses,balance,todayISO,currentMonthKey:currentMonthKeyReal}))} style={{padding:"0 20px"}}>Perguntar</Btn>
                  </div>
                  {askResult&&(
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <span style={{fontSize:19}}>{askResult.status==="ok"?"✅":askResult.status==="atencao"?"❌":"ℹ️"}</span>
                        <div style={{fontSize:14,fontWeight:700,color:decisionColor(askResult.status)}}>{askResult.answer}</div>
                      </div>
                      {askResult.detail&&<div style={{fontSize:12.5,color:TX2,marginBottom:16,lineHeight:1.55}}>{askResult.detail}</div>}
                      {askResult.breakdown&&(
                        <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_INPUT,padding:18,display:"flex",flexDirection:"column",gap:16}}>
                          <LedgerRows rows={askResult.breakdown.calcRows}/>
                          {askResult.breakdown.commitItems?.length>0&&(
                            <div>
                              <div style={{fontSize:10,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Compromissos considerados</div>
                              <LineItemsList items={askResult.breakdown.commitItems} accentColor="#EF4444"/>
                            </div>
                          )}
                          {askResult.breakdown.incomeItems?.length>0&&(
                            <div>
                              <div style={{fontSize:10,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Receitas futuras consideradas</div>
                              <LineItemsList items={askResult.breakdown.incomeItems} accentColor="#22C55E"/>
                            </div>
                          )}
                          <DataUsedChecklist tags={askResult.evidence?.dataUsed}/>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                <Card style={{padding:26}}>
                  <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:6,display:"flex",alignItems:"center",gap:8}}><Rocket size={16} color={accent}/>Simulação (E se...)</div>
                  <div style={{fontSize:12,color:TX2,marginBottom:16}}>Simulação hipotética com os números que você informar — não é recomendação de investimento nem conselho financeiro.</div>
                  <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
                    {[["economizar_mais","Economizar mais"],["compra_grande","Comprar parcelado"],["investir_mensal","Investir todo mês"]].map(([id,label])=>(
                      <button key={id} onClick={()=>{setSimType(id);setSimResult(null);}} style={{padding:"8px 14px",borderRadius:R_CHIP,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:600,background:simType===id?accent:"rgba(255,255,255,0.03)",color:simType===id?"white":TX2}}>{label}</button>
                    ))}
                  </div>
                  {simType==="economizar_mais"&&(
                    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                      <select value={simGoalId} onChange={e=>setSimGoalId(e.target.value)} style={SI}>
                        <option value="">Selecione uma meta</option>
                        {enhancedWishes.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <MoneyInput placeholder="Quanto a mais guardar por mês (R$)" value={simExtra} onChange={setSimExtra} style={SI}/>
                    </div>
                  )}
                  {simType==="compra_grande"&&(
                    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                      <MoneyInput placeholder="Valor total (R$)" value={simValue} onChange={setSimValue} style={{...SI,flex:1,minWidth:140}}/>
                      <input type="number" placeholder="Em quantas parcelas" value={simParcelas} onChange={e=>setSimParcelas(e.target.value)} style={{...SI,flex:1,minWidth:140}}/>
                    </div>
                  )}
                  {simType==="investir_mensal"&&(
                    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                      <MoneyInput placeholder="Valor por mês (R$)" value={simValue} onChange={setSimValue} style={{...SI,flex:1,minWidth:120}}/>
                      <input type="number" placeholder="Por quantos meses" value={simMonths} onChange={e=>setSimMonths(e.target.value)} style={{...SI,flex:1,minWidth:120}}/>
                      <MoneyInput placeholder="Retorno anual estimado (%)" value={simReturn} onChange={setSimReturn} style={{...SI,flex:1,minWidth:120}}/>
                    </div>
                  )}
                  <Btn onClick={runSimulation} style={{padding:"10px 20px",fontSize:13}}>Simular</Btn>
                  {simResult&&(
                    <div style={{marginTop:18,background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_INPUT,padding:18}}>
                      {simResult.type==="economizar_mais"&&(simResult.data?(
                        <div style={{fontSize:13,color:TX}}>No novo ritmo, a meta ficaria pronta em <strong>{simResult.data.newMonths} meses</strong>{simResult.data.monthsSaved?` — cerca de ${simResult.data.monthsSaved} meses mais rápido que o ritmo atual.`:"."}</div>
                      ):<div style={{fontSize:13,color:TX3}}>Selecione uma meta com valor restante para simular.</div>)}
                      {simResult.type==="compra_grande"&&(
                        <div style={{fontSize:13,color:TX}}>Isso adicionaria <strong>{fmt(simResult.data.monthlyImpact)}/mês</strong> aos seus compromissos. Seu comprometimento do próximo mês passaria de {fmt(committedNextMonth)} para <strong>{fmt(simResult.data.newCommittedNextMonth)}</strong>.</div>
                      )}
                      {simResult.type==="investir_mensal"&&(
                        <div style={{fontSize:13,color:TX}}>Aportando {fmt(parseNum(simValue))}/mês por {simMonths} meses, a um retorno estimado de {simReturn}% ao ano: total aportado <strong>{fmt(simResult.data.aportado)}</strong>, rendimento estimado <strong>{fmt(simResult.data.rendimentoEstimado)}</strong>, total estimado <strong>{fmt(simResult.data.totalEstimado)}</strong>.</div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {planTab==="ano"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {summary.length===0?(
                  <div style={{textAlign:"center",color:TX3,padding:40,fontSize:13,background:CARD,border:`1px solid ${BD}`,borderRadius:R_CARD}}>Ainda não há dados suficientes.</div>
                ):(
                  <>
                    <Card className="chart-card" style={{height:340}}>
                      <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:16}}>Comparativo mensal</div>
                      <div className="chart-fill">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={summary}>
                            <CartesianGrid strokeDasharray="3 6" stroke={BD} vertical={false}/>
                            <XAxis dataKey="month" tick={{fill:TX2,fontSize:11}} axisLine={false} tickLine={false}/>
                            <YAxis tick={{fill:TX2,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                            <Tooltip content={<ChartTooltip/>}/><Legend wrapperStyle={{fontSize:12,color:TX2}}/>
                            <Bar dataKey="in" name="Receita" fill="#22C55E" radius={[6,6,0,0]}/>
                            <Bar dataKey="out" name="Despesa" fill="#EF4444" radius={[6,6,0,0]}/>
                            <Bar dataKey="balance" name="Saldo" fill={accent} radius={[6,6,0,0]}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                    <Card style={{padding:0,overflow:"hidden"}}>
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                          <thead><tr style={{background:C2}}>
                            {["Mês","Receita","Despesa","Saldo","Var. vs mês anterior"].map(h=>(
                              <th key={h} style={{padding:"12px 16px",textAlign:"left",color:TX2,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.03em",whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {summary.map((m,i)=>{
                              const prev=summary[i-1];
                              const delta=prev?pctChange(m.balance,prev.balance):null;
                              return(
                                <tr key={m.month} style={{borderTop:`1px solid ${BD}`}}>
                                  <td style={{padding:"12px 16px",color:TX,fontWeight:600,whiteSpace:"nowrap"}}>{m.month}</td>
                                  <td className="num" style={{padding:"12px 16px",color:"#22C55E",fontWeight:600,whiteSpace:"nowrap"}}>{fmt(m.in)}</td>
                                  <td className="num" style={{padding:"12px 16px",color:"#EF4444",fontWeight:600,whiteSpace:"nowrap"}}>{fmt(m.out)}</td>
                                  <td className="num" style={{padding:"12px 16px",color:m.balance>=0?"#22C55E":"#EF4444",fontWeight:700,whiteSpace:"nowrap"}}>{fmt(m.balance)}</td>
                                  <td title={delta===null?"Sem base de comparação no mês anterior":`Saldo ${delta>=0?"melhorou":"piorou"} ${fmt(Math.abs(m.balance-prev.balance))} em relação a ${prev.month}`} style={{padding:"12px 16px",color:delta===null?TX3:delta>=0?"#22C55E":"#EF4444",fontWeight:600,whiteSpace:"nowrap"}}>{delta===null?"—":`${delta>0?"+":""}${delta}%`}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {tab==="transactions"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <Card style={{padding:26}}>
              <div style={{fontSize:14.5,fontWeight:700,color:TX,marginBottom:18,letterSpacing:"-0.01em"}}>Adicionar lançamento</div>
              {renderTxForm()}
            </Card>
            <div style={{display:"flex",gap:10}}>
              <label style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:CARD,border:`1px solid ${BD}`,color:accent,padding:"12px",borderRadius:R_BTN,cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:SH_SM}}>
                <Upload size={15}/>Importar CSV<input type="file" accept=".csv" style={{display:"none"}} onChange={importCSV}/>
              </label>
              <button onClick={exportCSV} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:CARD,border:`1px solid ${BD}`,color:TX2,padding:"12px",borderRadius:R_BTN,cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:SH_SM}}><Download size={15}/>Exportar</button>
              <button onClick={()=>setShowClearConfirm(true)} title="Apagar todas as transações" style={{display:"flex",alignItems:"center",justifyContent:"center",background:CARD,border:`1px solid ${BD}`,color:"#EF4444",padding:"12px 17px",borderRadius:R_BTN,cursor:"pointer",boxShadow:SH_SM}}><Trash2 size={15}/></button>
            </div>
            <div style={{display:"flex",borderRadius:R_INPUT,overflow:"hidden",background:CARD,border:`1px solid ${BD}`,width:"fit-content"}}>
              {[["","Todos"],["Entrada","Entrada"],["Saída","Saída"]].map(([val,label])=>(
                <button key={val||"all"} onClick={()=>setFilterType(val)} style={{padding:"8px 16px",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap",background:filterType===val?(val==="Entrada"?"#22C55E":val==="Saída"?"#EF4444":accent):"transparent",color:filterType===val?"white":TX2}}>{label}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <div style={{position:"relative",flex:1,minWidth:160}}>
                <Search size={14} color={TX3} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}/>
                <input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{...SI,paddingLeft:34}}/>
              </div>
              <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{...SI,width:"auto"}}>
                <option value="">Todos os meses</option>
                {months.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...SI,width:"auto"}}>
                <option value="">Todas as categorias</option>
                {fullCats.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              {(filterMonth||filterCat||filterType||search)&&<button onClick={()=>{setFilterMonth("");setFilterCat("");setFilterType("");setSearch("");}} style={{background:CARD,border:`1px solid ${BD}`,color:TX2,padding:"8px 13px",borderRadius:R_INPUT,cursor:"pointer"}}><X size={13}/></button>}
            </div>
            <div className="stat3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[{l:"Entradas",v:viewTotals.totalIn,c:"#22C55E"},{l:"Saídas",v:viewTotals.totalOut,c:"#EF4444"},{l:"Saldo",v:viewTotals.balance,c:viewTotals.balance>=0?"#22C55E":"#EF4444"}].map(c=>(
                <Card key={c.l} className="stat-card" style={{padding:18,textAlign:"center",overflow:"hidden"}}>
                  <div className="stat-label" style={{fontSize:11,color:TX2}}>{c.l}</div>
                  <div className="stat-val" style={{fontSize:18,fontWeight:700,color:c.c,marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}><AnimatedValue value={c.v}/></div>
                </Card>
              ))}
            </div>
            {filtered.length===0&&(()=>{
              const hasActiveFilter=!!(filterMonth||filterCat||filterType||search.trim());
              return hasActiveFilter?(
                <div style={{textAlign:"center",color:TX2,padding:40,fontSize:14}}>
                  <div style={{marginBottom:12}}>Nenhuma transação encontrada com esse filtro.</div>
                  <BtnGhost onClick={()=>{setFilterMonth("");setFilterCat("");setFilterType("");setSearch("");}} style={{padding:"9px 16px",fontSize:12.5}}>Limpar filtros</BtnGhost>
                </div>
              ):(
                <div style={{textAlign:"center",color:TX2,padding:40,fontSize:14}}>Você ainda não tem nenhuma transação. Use o formulário acima para lançar a primeira.</div>
              );
            })()}
            {groupedByDate.map(([date,txs])=>(
              <div key={date}>
                <div style={{fontSize:11,color:TX3,fontWeight:700,marginBottom:10,paddingLeft:2}}>{date}</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[...txs].reverse().map(t=>{
                    const isIn=t.type==="Entrada";const bEdited=editingTx===t.id;
                    const rowColor=catColor(t.cat);
                    const invLabel=t.invTipo&&INV_TIPOS.includes(t.invTipo)?t.invTipo:null;
                    return(
                      <div key={t.id} style={{background:bEdited?`${accent}14`:CARD,border:`1px solid ${bEdited?accent+"45":BD}`,borderRadius:R_INPUT,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:SH_SM,transition:"background .15s, border-color .15s"}}>
                        <div style={{width:34,height:34,borderRadius:11,background:rowColor+"1f",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CategoryIcon cat={t.cat} size={15} color={rowColor}/></div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</div>
                          <div style={{fontSize:11,color:TX2,marginTop:3,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                            <span style={{color:rowColor,fontWeight:600}}>{t.cat}</span>
                            {invLabel&&<span style={{color:INV_TIPO_COLORS[invLabel]}}>· {invLabel}</span>}
                            {t.installmentId&&<span style={{display:"flex",alignItems:"center",gap:3,color:accent}}>· <CreditCard size={10}/>parcelado</span>}
                            {t.plannedId&&<span style={{display:"flex",alignItems:"center",gap:3,color:accent}}>· <Calendar size={10}/>previsto</span>}
                            <span>· {t.form}</span>
                          </div>
                        </div>
                        <div className="num" style={{fontSize:14,fontWeight:700,color:isIn?"#22C55E":"#EF4444",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{isIn?"+":"-"}{fmt(t.val)}</div>
                        <button onClick={()=>startEditTx(t)} title="Editar" style={{background:"none",border:"none",color:TX3,cursor:"pointer",flexShrink:0,padding:4}}><Pencil size={14}/></button>
                        <button onClick={()=>setConfirmDelete({type:"tx",id:t.id,label:t.desc})} title="Excluir" aria-label={`Excluir ${t.desc}`} style={{background:"none",border:"none",color:TX3,cursor:"pointer",flexShrink:0,padding:4}}><Trash2 size={14}/></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="planned"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
              <div style={{fontSize:17,fontWeight:700,color:TX,letterSpacing:"-0.01em"}}>Gastos Previstos</div>
              <Btn onClick={()=>{const empty={desc:"",val:"",cat:"Assinaturas",form:"pix",recurring:false,month:plannedMonth,notes:""};setEditingPlanned(null);setPlannedForm(empty);plannedFormSnapshotRef.current=JSON.stringify(empty);setShowPlannedForm(p=>!p);}} style={{padding:"10px 18px",fontSize:13,display:"flex",alignItems:"center",gap:6}}><Plus size={14}/>Adicionar</Btn>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,background:CARD,border:`1px solid ${BD}`,borderRadius:R_INPUT,padding:"10px 14px",boxShadow:SH_SM}}>
              <button onClick={()=>setPlannedMonth(m=>shiftMonth(m,-1))} style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:10,width:28,height:28,color:TX2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronLeft size={15}/></button>
              <div style={{fontSize:14,fontWeight:700,color:TX,minWidth:70,textAlign:"center"}}>{plannedMonth}</div>
              <button onClick={()=>setPlannedMonth(m=>shiftMonth(m,1))} style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:10,width:28,height:28,color:TX2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronRight size={15}/></button>
              {plannedMonth!==monthKey(todayFn())&&<button onClick={()=>setPlannedMonth(monthKey(todayFn()))} style={{background:"none",border:"none",color:accent,fontSize:11,fontWeight:700,cursor:"pointer",marginLeft:4}}>hoje</button>}
            </div>
            <div className="stat3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[{l:"Previsto",v:plannedStats.total,c:accent},{l:"Já pago",v:plannedStats.paid,c:"#22C55E"},{l:"Falta pagar",v:plannedStats.pending,c:"#EF4444"}].map(c=>(
                <Card key={c.l} className="stat-card" style={{padding:18,textAlign:"center",overflow:"hidden"}}>
                  <div className="stat-label" style={{fontSize:11,color:TX2}}>{c.l}</div>
                  <div className="stat-val" style={{fontSize:18,fontWeight:700,color:c.c,marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}><AnimatedValue value={c.v}/></div>
                </Card>
              ))}
            </div>
            {showPlannedForm&&(
              <div ref={plannedFormRef}>
              <Card style={{padding:26}}>
                <div style={{fontSize:14.5,fontWeight:700,color:TX,marginBottom:18,letterSpacing:"-0.01em"}}>{editingPlanned!==null?"Editar previsto":"Novo gasto previsto"}</div>
                {editingPlanned===null&&frequentTx.length>0&&renderFrequentPicks(applyFrequentToPlanned)}
                <div style={{display:"flex",gap:10,marginBottom:12}}>
                  <input placeholder="Ex: Kart, Smart Fit, Game Pass..." value={plannedForm.desc} maxLength={120} onChange={e=>setPlannedForm(p=>({...p,desc:e.target.value}))} style={{...SI,flex:2}}/>
                  <MoneyInput ref={plannedValRef} placeholder="R$" value={plannedForm.val} onChange={v=>setPlannedForm(p=>({...p,val:v}))} style={{...SI,flex:1}}/>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>
                  {fullCats.filter(c=>c!=="Investimento"&&c!=="Salario / Entradas").map(c=>{const cc=catColor(c);return(
                    <button key={c} onClick={()=>setPlannedForm(p=>({...p,cat:c}))} className="chip-btn" style={{padding:"7px 12px",borderRadius:R_CHIP,border:"none",fontSize:12,cursor:"pointer",background:plannedForm.cat===c?cc+"26":"rgba(255,255,255,0.03)",color:plannedForm.cat===c?cc:TX2,display:"flex",alignItems:"center",gap:5}}><CategoryIcon cat={c} size={13}/>{c}</button>
                  );})}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
                  <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Forma</div><select value={plannedForm.form} onChange={e=>setPlannedForm(p=>({...p,form:e.target.value}))} style={SI}>{["pix","debito","credito","dinheiro","deposito"].map(o=><option key={o}>{o}</option>)}</select></div>
                  <div>
                    <div style={{fontSize:11,color:TX2,marginBottom:5}}>Repetição</div>
                    <div style={{display:"flex",borderRadius:R_INPUT,overflow:"hidden",background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`}}>
                      <button onClick={()=>setPlannedForm(p=>({...p,recurring:false}))} style={{flex:1,padding:"9px",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:!plannedForm.recurring?accent:"transparent",color:!plannedForm.recurring?"white":TX2}}>Só este mês</button>
                      <button onClick={()=>setPlannedForm(p=>({...p,recurring:true}))} style={{flex:1,padding:"9px",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:plannedForm.recurring?accent:"transparent",color:plannedForm.recurring?"white":TX2,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Repeat size={12}/>Todo mês</button>
                    </div>
                  </div>
                  {!plannedForm.recurring&&(
                    <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Mês</div><select value={plannedForm.month} onChange={e=>setPlannedForm(p=>({...p,month:e.target.value}))} style={SI}>{MONTH_ORDER.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                  )}
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:TX2,marginBottom:5}}>Notas / Descrição (opcional)</div>
                  <textarea value={plannedForm.notes||""} maxLength={2000} onChange={e=>setPlannedForm(p=>({...p,notes:e.target.value}))} rows={4} placeholder="Motivo do lançamento, observações, links, planejamento..." style={{...SI,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}/>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <Btn onClick={savePlannedItem} aria-disabled={!plannedForm.desc.trim()||!plannedForm.val} style={{padding:"10px 20px",fontSize:13,opacity:(!plannedForm.desc.trim()||!plannedForm.val)?0.5:1,cursor:"pointer"}}>{editingPlanned!==null?"Salvar":"Adicionar"}</Btn>
                  <BtnGhost onClick={closePlannedForm} style={{padding:"10px 18px",fontSize:13}}>Cancelar</BtnGhost>
                </div>
              </Card>
              </div>
            )}
            {plannedItemsForMonth.length===0&&(
              <div style={{textAlign:"center",color:TX3,padding:48,fontSize:14,background:CARD,border:`1px solid ${BD}`,borderRadius:R_CARD,boxShadow:SH_SM}}>
                <Calendar size={26} style={{marginBottom:12,opacity:0.5}}/><div>Nenhum gasto previsto para {plannedMonth}.</div>
                <div style={{fontSize:12,color:TX3,marginTop:6}}>Toque em "Adicionar" para planejar contas, assinaturas ou compromissos deste mês.</div>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sortedPlannedItemsForMonth.map(item=>{
                const itemColor=catColor(item.cat);
                const isPaid=!!item.paid?.[plannedMonth];
                const isIgnored=!!item.ignored?.[plannedMonth];
                const notesKey=`planned-${item.id}`;
                return(
                  <div key={item.id} style={{background:isPaid?"#22C55E12":isIgnored?"#F0A85712":CARD,border:`1px solid ${isPaid?"#22C55E30":isIgnored?"#F0A85730":BD}`,borderRadius:R_INPUT,padding:"14px 16px",boxShadow:SH_SM,opacity:isIgnored?0.75:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <button onClick={()=>togglePlannedPaid(item)} title={isPaid?"Marcar como não pago":"Marcar como pago"} style={{width:24,height:24,borderRadius:8,border:isPaid?"none":`1.5px solid ${BD2}`,background:isPaid?"#22C55E":"transparent",color:"white",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{isPaid&&<Check size={13}/>}</button>
                      <div style={{width:34,height:34,borderRadius:11,background:itemColor+"1f",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CategoryIcon cat={item.cat} size={15} color={itemColor}/></div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:isPaid?TX2:TX,textDecoration:isPaid||isIgnored?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.desc}</div>
                        <div style={{fontSize:11,color:TX2,marginTop:3,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{color:itemColor,fontWeight:600}}>{item.cat}</span>
                          {item.recurring&&<span style={{display:"flex",alignItems:"center",gap:3,color:accent}}>· <Repeat size={10}/>mensal</span>}
                          <span>· {item.form}</span>
                          {isIgnored&&<span style={{color:"#F0A857",fontWeight:600}}>· ignorado este mês</span>}
                        </div>
                      </div>
                      <div className="num" style={{fontSize:14,fontWeight:700,color:isPaid?"#22C55E":TX,flexShrink:0}}>{fmt(item.val)}</div>
                      {item.notes&&<button onClick={()=>toggleNotes(notesKey)} title="Ver notas" style={{background:"none",border:"none",color:expandedNotes[notesKey]?accent:TX3,cursor:"pointer",flexShrink:0,padding:4}}><Info size={14}/></button>}
                      {item.recurring&&<button onClick={()=>togglePlannedIgnoredForMonth(item,plannedMonth)} title={isIgnored?"Reativar este mês":"Ignorar apenas este mês"} style={{background:"none",border:"none",color:isIgnored?"#F0A857":TX3,cursor:"pointer",flexShrink:0,padding:4}}>{isIgnored?<Eye size={14}/>:<EyeOff size={14}/>}</button>}
                      <button onClick={()=>openTransferToWish(item)} title="Mover para Metas" aria-label="Mover para Metas" style={{background:"none",border:"none",color:TX3,cursor:"pointer",flexShrink:0,padding:4}}><ArrowRightLeft size={14}/></button>
                      <button onClick={()=>startEditPlanned(item)} title="Editar" style={{background:"none",border:"none",color:TX3,cursor:"pointer",flexShrink:0,padding:4}}><Pencil size={14}/></button>
                      <button onClick={()=>setConfirmDelete({type:"planned",id:item.id,label:item.desc})} title="Excluir" style={{background:"none",border:"none",color:TX3,cursor:"pointer",flexShrink:0,padding:4}}><Trash2 size={14}/></button>
                    </div>
                    {item.notes&&expandedNotes[notesKey]&&(
                      <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${BD}`,fontSize:12.5,color:TX2,lineHeight:1.6}}>
                        <LinkifiedText text={item.notes} color={accent}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab==="installments"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div className="stat3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[{l:"A pagar",v:instStats.remaining,c:"#EF4444",f:true},{l:"Já pago",v:instStats.paid,c:"#22C55E",f:true},{l:"Ativas",v:instStats.active,c:accent,f:false}].map(({l,v,c,f})=>(
                <Card key={l} className="stat-card" style={{padding:18,textAlign:"center",overflow:"hidden"}}>
                  <div className="stat-label" style={{fontSize:11,color:TX2,marginBottom:5}}>{l}</div>
                  <div className="stat-val" style={{fontSize:19,fontWeight:700,color:c,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f?<AnimatedValue value={v}/>:v}</div>
                </Card>
              ))}
            </div>
            {!showInstForm&&<BtnGhost onClick={openInstForm} style={{width:"100%",padding:"13px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Plus size={14}/>Nova compra parcelada</BtnGhost>}
            {showInstForm&&(
              <Card style={{padding:26}}>
                <div style={{fontSize:14.5,fontWeight:700,color:TX,marginBottom:18,letterSpacing:"-0.01em"}}>Nova compra parcelada</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:14}}>
                  <div style={{gridColumn:"1/-1"}}><div style={{fontSize:11,color:TX2,marginBottom:5}}>Descrição</div><input placeholder="Ex: iPhone" value={instDraft.desc} maxLength={120} onChange={e=>setInstDraft(d=>({...d,desc:e.target.value}))} style={SI}/></div>
                  <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Valor total (R$)</div><MoneyInput placeholder="6000" value={instDraft.totalVal} onChange={v=>setInstDraft(d=>({...d,totalVal:v}))} style={SI}/></div>
                  <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Nº de parcelas</div><input type="number" min="1" max="360" placeholder="12" value={instDraft.numParcelas} onChange={e=>setInstDraft(d=>({...d,numParcelas:e.target.value}))} style={SI}/></div>
                  {monthlyPreview&&(
                    <div style={{gridColumn:"1/-1",background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_INPUT,padding:"10px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                      <span style={{fontSize:12,color:TX2}}>Valor por parcela</span>
                      <span className="num" style={{fontSize:16,fontWeight:700,color:accent}}>{fmt(monthlyPreview)}/mês</span>
                    </div>
                  )}
                  <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Primeiro vencimento</div><input type="date" value={instDraft.startDate} min={DATE_MIN} max={DATE_MAX} onChange={e=>setInstDraft(d=>({...d,startDate:e.target.value}))} style={SI}/></div>
                  <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Forma de pagamento</div><select value={instDraft.form} onChange={e=>setInstDraft(d=>({...d,form:e.target.value}))} style={SI}>{["credito","debito","pix","dinheiro"].map(o=><option key={o}>{o}</option>)}</select></div>
                </div>
                <div style={{fontSize:11,color:TX2,marginBottom:10}}>Categoria</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:16}}>
                  {fullCats.filter(c=>c!=="Investimento"&&c!=="Salario / Entradas").map(c=>{const cc=catColor(c);return(
                    <button key={c} onClick={()=>setInstDraft(d=>({...d,cat:c}))} className="chip-btn" style={{padding:"6px 12px",borderRadius:R_CHIP,border:"none",fontSize:12,cursor:"pointer",background:instDraft.cat===c?cc+"26":"rgba(255,255,255,0.03)",color:instDraft.cat===c?cc:TX2,display:"flex",alignItems:"center",gap:5}}>
                      <CategoryIcon cat={c} size={13}/>{c}
                    </button>
                  );})}
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <BtnGhost onClick={()=>setShowInstForm(false)} style={{flex:1,padding:"11px",minWidth:100}}>Cancelar</BtnGhost>
                  <button onClick={addInstallment} aria-disabled={!instDraft.desc||!instDraft.totalVal} style={{flex:2,padding:"11px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:(!instDraft.desc||!instDraft.totalVal)?"rgba(255,255,255,0.04)":accent,color:(!instDraft.desc||!instDraft.totalVal)?TX3:"white",minWidth:180}}>
                    {monthlyPreview?`Criar ${instDraft.numParcelas}x de ${fmt(monthlyPreview)}`:"Criar parcelamento"}
                  </button>
                </div>
              </Card>
            )}
            {installments.length===0&&(
              <div style={{textAlign:"center",color:TX3,padding:48,fontSize:14,background:CARD,border:`1px solid ${BD}`,borderRadius:R_CARD,boxShadow:SH_SM}}>
                <CreditCard size={26} style={{marginBottom:12,opacity:0.5}}/><div>Nenhum parcelamento cadastrado.</div>
              </div>
            )}
            {[...installments].reverse().map(inst=>{
              const today=todayFn();
              const instTxs=inst.txIds.map(id=>txMap.get(id)).filter(Boolean);
              const paidTxs=instTxs.filter(t=>t.date<=today);
              const pendingTxs=instTxs.filter(t=>t.date>today);
              const remainingVal=pendingTxs.reduce((s,t)=>s+t.val,0);
              const totalPaidVal=paidTxs.reduce((s,t)=>s+t.val,0);
              const pct=inst.numParcelas>0?Math.round((paidTxs.length/inst.numParcelas)*100):0;
              const isComplete=pendingTxs.length===0&&instTxs.length>0;
              const monthly=inst.totalVal/inst.numParcelas;
              const dotColor=catColor(inst.cat);
              const endTx=[...instTxs].sort((a,b)=>b.date.localeCompare(a.date))[0];
              const endDate=endTx?monthKey(endTx.date):"?";
              return(
                <Card key={inst.id} style={{padding:"20px 22px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
                    <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:30,height:30,borderRadius:10,background:dotColor+"1f",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CategoryIcon cat={inst.cat} size={14} color={dotColor}/></div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inst.desc}</div>
                        <div style={{fontSize:11,color:TX2,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fmt(monthly)}/mês · {inst.form} · até {endDate}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"flex-start",flexShrink:0,marginLeft:10}}>
                      <div style={{textAlign:"right"}}>
                        {isComplete?<div style={{fontSize:12,color:"#22C55E",fontWeight:700}}>Quitado</div>:<div className="num" style={{fontSize:13,fontWeight:700,color:"#EF4444"}}>{fmt(remainingVal)}</div>}
                        <div style={{fontSize:11,color:TX2,marginTop:3}}>{paidTxs.length}/{inst.numParcelas}x pagas</div>
                      </div>
                      <button onClick={()=>setDelInstId(inst.id)} title="Remover parcelamento" style={{background:"none",border:"none",color:TX3,cursor:"pointer",padding:2}}><X size={16}/></button>
                    </div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.06)",borderRadius:20,height:6,overflow:"hidden",marginBottom:12}}>
                    <div style={{width:`${pct}%`,height:"100%",background:isComplete?"#22C55E":dotColor,borderRadius:20,transition:"width .5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:TX2,flexWrap:"wrap",gap:4}}>
                    <span>pago: {fmt(totalPaidVal)}</span><span style={{color:accent,fontWeight:700}}>{pct}%</span><span>total: {fmt(inst.totalVal)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab==="wishes"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
              <div style={{fontSize:17,fontWeight:700,color:TX,letterSpacing:"-0.01em"}}>Minhas Metas</div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",borderRadius:R_INPUT,overflow:"hidden",background:CARD,border:`1px solid ${BD}`}}>
                  <button onClick={()=>setWishSortBy("progress")} title="Ordenar por progresso" style={{padding:"8px 14px",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:wishSortBy==="progress"?accent:"transparent",color:wishSortBy==="progress"?"white":TX2}}>Progresso</button>
                  <button onClick={()=>setWishSortBy("priority")} title="Ordenar por prioridade" style={{padding:"8px 14px",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:wishSortBy==="priority"?accent:"transparent",color:wishSortBy==="priority"?"white":TX2}}>Prioridade</button>
                </div>
                <Btn onClick={()=>{const empty={name:"",price:"",saved:"",priority:"Média",monthsTarget:"",notes:""};setEditingWish(null);setWishForm(empty);wishFormSnapshotRef.current=JSON.stringify(empty);setShowWishForm(p=>!p);}} style={{padding:"10px 18px",fontSize:13,display:"flex",alignItems:"center",gap:6}}><Plus size={14}/>Adicionar</Btn>
              </div>
            </div>
            {showWishForm&&(
              <div ref={wishFormRef}>
              <Card style={{padding:26}}>
                <div style={{fontSize:14.5,fontWeight:700,color:TX,marginBottom:18,letterSpacing:"-0.01em"}}>{editingWish!==null?"Editar":"Novo desejo"}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
                  {[{l:"Nome",k:"name",t:"text"},{l:"Preço (R$)",k:"price",t:"money"},{l:"Já guardei (R$)",k:"saved",t:"money"},{l:"Meta (meses)",k:"monthsTarget",t:"number"}].map(f=>(
                    <div key={f.k}><div style={{fontSize:11,color:TX2,marginBottom:5}}>{f.l}</div>{f.t==="money"
                      ?<MoneyInput value={wishForm[f.k]} onChange={v=>setWishForm(p=>({...p,[f.k]:v}))} style={SI}/>
                      :<input type={f.t} value={wishForm[f.k]} maxLength={f.t==="text"?80:undefined} onChange={e=>setWishForm(p=>({...p,[f.k]:e.target.value}))} style={SI}/>}</div>
                  ))}
                  <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Prioridade</div><select value={wishForm.priority} onChange={e=>setWishForm(p=>({...p,priority:e.target.value}))} style={SI}>{["Alta","Média","Baixa"].map(o=><option key={o}>{o}</option>)}</select></div>
                  <div style={{gridColumn:"1/-1"}}>
                    <div style={{fontSize:11,color:TX2,marginBottom:5}}>Notas / Descrição (opcional)</div>
                    <textarea value={wishForm.notes||""} maxLength={2000} onChange={e=>setWishForm(p=>({...p,notes:e.target.value}))} rows={4} placeholder="Detalhes, observações, planejamento, links de produtos..." style={{...SI,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}/>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"flex-end",gridColumn:"1/-1",flexWrap:"wrap"}}>
                    <Btn onClick={saveWish} aria-disabled={!wishForm.name||!wishForm.price} style={{padding:"10px 20px",fontSize:13,opacity:(!wishForm.name||!wishForm.price)?0.5:1,cursor:"pointer"}}>{editingWish!==null?"Salvar":"Adicionar"}</Btn>
                    <BtnGhost onClick={closeWishForm} style={{padding:"10px 18px",fontSize:13}}>Cancelar</BtnGhost>
                  </div>
                </div>
              </Card>
              </div>
            )}
            {wishes.length===0&&<div style={{textAlign:"center",color:TX3,padding:48,fontSize:14}}><Sparkles size={26} style={{marginBottom:12,opacity:0.5}}/><div>Nenhum desejo ainda!</div><div style={{fontSize:12,color:TX3,marginTop:6}}>Adicione uma meta para começar a acompanhar seu progresso.</div></div>}
            {sortedWishes.map(w=>{
              const pct2=Math.min(100,Math.round(w.saved/w.price*100));
              const pColor={"Alta":"#EF4444","Média":"#F0A857","Baixa":"#22C55E"}[w.priority];
              const remaining=w.price-w.saved;
              const monthly=w.monthsTarget>0?Math.ceil(remaining/w.monthsTarget):null;
              const notesKey=`wish-${w.id}`;
              return(
                <Card key={w.id} style={{padding:22,opacity:w.done?0.7:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12,minWidth:0}}>
                      <button onClick={()=>toggleWishDone(w.id)} title={w.done?"Marcar como não conquistado":"Marcar como conquistado"} style={{width:24,height:24,borderRadius:8,border:w.done?"none":`1.5px solid ${BD2}`,background:w.done?"#22C55E":"transparent",color:"white",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",marginTop:2}}>{w.done&&<Check size={13}/>}</button>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:14.5,fontWeight:700,color:w.done?TX2:TX,textDecoration:w.done?"line-through":"none",letterSpacing:"-0.01em"}}>{w.name}</div>
                        <div style={{fontSize:11,color:TX2,marginTop:5}}>{fmt(w.saved)} de {fmt(w.price)} · faltam {fmt(remaining)}</div>
                        {monthly&&<div style={{fontSize:11,color:accent,marginTop:5,fontWeight:700}}>Poupe {fmt(monthly)}/mês por {w.monthsTarget} meses</div>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                      <span style={{background:pColor+"22",color:pColor,fontSize:11,padding:"4px 10px",borderRadius:R_CHIP,fontWeight:700}}>{w.priority}</span>
                      <button onClick={()=>openTransferToPlanned(w)} title="Mover para Previstos" aria-label="Mover para Previstos" style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:8,padding:"5px 8px",color:TX2,cursor:"pointer"}}><ArrowRightLeft size={12}/></button>
                      <button onClick={()=>{const snap={name:w.name,price:toDecimalStr(w.price),saved:toDecimalStr(w.saved),priority:w.priority,monthsTarget:String(w.monthsTarget||""),notes:w.notes||""};setEditingWish(w.id);setWishForm(snap);wishFormSnapshotRef.current=JSON.stringify(snap);setShowWishForm(true);}} title="Editar" aria-label="Editar" style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:8,padding:"5px 8px",color:TX2,cursor:"pointer"}}><Pencil size={12}/></button>
                      <button onClick={()=>setConfirmDelete({type:"wish",id:w.id,label:w.name})} title="Excluir" style={{background:"none",border:"none",color:TX3,cursor:"pointer",padding:4}}><Trash2 size={14}/></button>
                    </div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.06)",borderRadius:20,height:7,overflow:"hidden"}}>
                    <div style={{width:`${pct2}%`,height:"100%",background:accent,borderRadius:20,transition:"width .5s"}}/>
                  </div>
                  <div style={{fontSize:11,color:TX2,marginTop:8}}>{pct2}% conquistado</div>
                  {w.notes&&(
                    <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${BD}`}}>
                      <button onClick={()=>toggleNotes(notesKey)} style={{background:"none",border:"none",color:accent,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:0,marginBottom:expandedNotes[notesKey]?10:0}}>
                        {expandedNotes[notesKey]?<ChevronUp size={13}/>:<ChevronDown size={13}/>} Notas e planejamento
                      </button>
                      {expandedNotes[notesKey]&&<div style={{fontSize:12.5,color:TX2,lineHeight:1.6}}><LinkifiedText text={w.notes} color={accent}/></div>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </AccentContext.Provider>
  );
}

export default function Root(){
  const [user,setUser]=useState(null);
  const [checkingSession,setCheckingSession]=useState(true);

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
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setUser(deriveUser(session));
    });
    return ()=>subscription.unsubscribe();
  },[]);

  // O resto do app (MainApp) já sabe deslogar chamando setUser(null) — só
  // interceptamos essa chamada aqui pra também encerrar a sessão de verdade
  // no Supabase, sem precisar mudar nada dentro do MainApp.
  const handleSetUser=value=>{
    if(value===null)supabase.auth.signOut();
    else setUser(value);
  };

  if(checkingSession){
    return(
      <div style={{background:"#071421",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <style>{`@keyframes rootspin{to{transform:rotate(360deg)}}`}</style>
        <div style={{width:28,height:28,border:"3px solid rgba(59,130,246,0.25)",borderTopColor:"#3B82F6",borderRadius:"50%",animation:"rootspin .8s linear infinite"}}/>
      </div>
    );
  }
  if(!user)return <AuthScreen onLogin={(email,name)=>setUser({email,name})}/>;
  return <MainApp user={user} setUser={handleSetUser}/>;
}