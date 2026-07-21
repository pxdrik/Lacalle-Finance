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
 * contém lógica de geração de insight. O motor:
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
 * InsightsGenerator, DecisionEngine, SimulationEngine.
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, AreaChart, Area, CartesianGrid } from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, CreditCard, Calendar, Sparkles, Gamepad2, UtensilsCrossed,
  Car, Shirt, Laptop, HeartPulse, GraduationCap, Briefcase, Package, Repeat, Undo2, Gift, Tag,
  Settings, LogOut, Search, X, Plus, Pencil, Trash2, Check, ChevronLeft, ChevronRight, ChevronDown,
  ChevronUp, Upload, Download, AlertTriangle, ArrowUpCircle, ArrowDownCircle, LayoutDashboard,
  Receipt, PiggyBank, Cloud, Loader2, RefreshCw, CheckCircle2, AlertCircle, Info, Landmark, Rocket,
  Gem, Star, Trophy, Lightbulb, ShieldCheck, Target, Percent, Activity, CalendarDays, Bell, Flag, Hourglass, Clock,
  ArrowRightLeft
} from "lucide-react";

const CATS=["Lazer","Alimentação","Transporte","Desejos","Roupas","Tecnologia","Saude / Cuidados Pessoais","Educação","Salario / Entradas","Outros","Investimento","Assinaturas","Rembolsos","Presentes"];
const COLORS=["#60A5FA","#818CF8","#34D399","#FB7185","#FBBF24","#A78BFA","#FB923C","#38BDF8","#F472B6","#2DD4BF","#C084FC","#4ADE80","#FCD34D","#94A3B8"];
const MONTHS_ARR=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
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
const MONTH_ORDER=(()=>{
  const arr=[];
  const d=new Date();
  d.setDate(1);
  d.setMonth(d.getMonth()-12);
  for(let i=0;i<48;i++){
    arr.push(`${MONTHS_ARR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`);
    d.setMonth(d.getMonth()+1);
  }
  return arr;
})();
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
const fmt=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const monthKey=d=>{try{const dt=new Date(d+"T12:00:00");return`${MONTHS_ARR[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`;}catch{return"???";}};
const parseNum=s=>{if(!s)return 0;let c=String(s).replace(/[R$\s]/g,"");if(c.includes(",")&&c.includes("."))c=c.replace(/\./g,"").replace(",",".");else if(c.includes(","))c=c.replace(",",".");const n=parseFloat(c);return isNaN(n)?0:Math.abs(n);};
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
const TRANSFER_NOTE_RE=/\n*— Transferido de (?:Desejos|Previstos) —\n[^\n]*$/;
const stripTransferNote=notes=>(notes||"").replace(TRANSFER_NOTE_RE,"").trim();
const wishToPlannedPayload=(wish,extra)=>{
  const kept=[];
  if(wish.priority)kept.push(`Prioridade original: ${wish.priority}`);
  if(wish.saved)kept.push(`Já guardado: ${fmt(wish.saved)}`);
  if(wish.monthsTarget)kept.push(`Meta original: ${wish.monthsTarget} meses`);
  const notes=[stripTransferNote(wish.notes),kept.length?`— Transferido de Desejos —\n${kept.join(" · ")}`:""].filter(Boolean).join("\n\n");
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
const addDaysStr=(dateStr,n)=>{const d=new Date(dateStr+"T12:00:00");d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const diffDays=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000);
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
const FinancialEngine=(()=>{
  const isSaidaReal=t=>t.type==="Saída"&&t.cat!=="Investimento";
  const isEntradaReal=t=>t.type==="Entrada"&&t.cat!=="Investimento";
  const isAporte=t=>t.cat==="Investimento"&&((t.invTipo==="Aporte")||(!t.invTipo&&t.type==="Saída"));
  const isResgate=t=>t.cat==="Investimento"&&((t.invTipo==="Resgate")||(!t.invTipo&&t.type==="Entrada"));
  const sumVal=arr=>arr.reduce((s,t)=>s+t.val,0);
  const cleanDesc=d=>(d||"").replace(/\s*\(\d+\/\d+\)$/,"");

  const CashFlowAnalyzer={
    investmentNet(tx){
      const inv=[...tx.filter(t=>t.cat==="Investimento")].sort((a,b)=>a.date.localeCompare(b.date));
      let pool=0,net=0;
      for(const t of inv){
        const a=isAporte(t),r=isResgate(t);
        if(r)pool+=t.val;
        else if(a){const fp=Math.min(pool,t.val);pool-=fp;net+=t.val-fp;}
      }
      return Math.max(0,net);
    },
    totals(tx){
      const totalIn=sumVal(tx.filter(isEntradaReal));
      const nI=sumVal(tx.filter(isSaidaReal));
      const ap=sumVal(tx.filter(isAporte));
      const re=sumVal(tx.filter(isResgate));
      const totalOut=nI+ap-re;
      return{totalIn,totalOut,balance:totalIn-totalOut};
    },
    monthlySummary(tx){
      const m={};
      tx.forEach(t=>{
        const mk=monthKey(t.date);
        if(!m[mk])m[mk]={month:mk,in:0,out:0,balance:0};
        if(t.cat==="Investimento"){if(t.invTipo==="Aporte")m[mk].out+=t.val;}
        else{if(t.type==="Entrada")m[mk].in+=t.val;else m[mk].out+=t.val;}
      });
      Object.values(m).forEach(r=>r.balance=r.in-r.out);
      return Object.values(m).sort((a,b)=>MONTH_ORDER.indexOf(a.month)-MONTH_ORDER.indexOf(b.month));
    },
    // ---- Versão detalhada da projeção: MESMA matemática de projectionAt, mas
    // expõe os itens (transações e previstos) que compõem o resultado, para uso
    // em explicações/evidências. projectionAt() abaixo apenas delega para cá —
    // nenhum número muda, só ganhamos um caminho de auditoria.
    projectionAtDetailed({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead}){
      const endDate=addDaysStr(todayISO,daysAhead);
      const future=transactions.filter(t=>t.date>todayISO&&t.date<=endDate);
      const incomeTx=future.filter(isEntradaReal);
      const inc=sumVal(incomeTx);
      const incomeItems=incomeTx.map(t=>({label:cleanDesc(t.desc),value:t.val,date:t.date}));
      const invApTx=future.filter(isAporte);
      const invReTx=future.filter(isResgate);
      const invAp=sumVal(invApTx);
      const invRe=sumVal(invReTx);
      const outTx=future.filter(isSaidaReal);
      const outReal=sumVal(outTx)+invAp-invRe;
      const outItems=outTx.map(t=>({label:cleanDesc(t.desc),value:t.val,date:t.date,kind:t.installmentId?"parcela":(t.plannedId?"conta":"despesa")}));
      const endMk=monthKey(endDate);
      let idxCur=MONTH_ORDER.indexOf(currentMonthKey);
      let idxEnd=MONTH_ORDER.indexOf(endMk);
      if(idxEnd<idxCur)idxEnd=idxCur;
      let plannedOut=0;const plannedItems=[];
      for(let i=idxCur;i<=idxEnd;i++){
        const mk=MONTH_ORDER[i];
        plannedExpenses.forEach(p=>{
          const pending=p.recurring?!p.paid?.[mk]:(p.month===mk&&!p.paid?.[mk]);
          if(pending){plannedOut+=p.val;plannedItems.push({label:p.desc,value:p.val,recurring:!!p.recurring,month:mk});}
        });
      }
      const value=balance+inc-outReal-plannedOut;
      return{value,incomeItems,outItems,plannedItems,totals:{inc,outReal,plannedOut,invAp,invRe}};
    },
    projectionAt(args){
      return CashFlowAnalyzer.projectionAtDetailed(args).value;
    },
    projections({transactions,plannedExpenses,balance,todayISO,currentMonthKey,horizons=[7,30,60,90]}){
      return horizons.map(d=>({days:d,value:CashFlowAnalyzer.projectionAt({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead:d})}));
    },
    freeBalance({transactions,plannedExpenses,balance,todayISO,currentMonthKey}){
      const futureOut=transactions.filter(t=>t.date>todayISO&&t.type==="Saída"&&t.cat!=="Investimento").reduce((s,t)=>s+t.val,0);
      const plannedPending=plannedExpenses.filter(p=>p.recurring||p.month===currentMonthKey).reduce((s,p)=>s+(p.paid?.[currentMonthKey]?0:p.val),0);
      return balance-futureOut-plannedPending;
    },
  };

  const BudgetAnalyzer={
    itemsForMonth(plannedExpenses,month){return plannedExpenses.filter(p=>p.recurring||p.month===month);},
    stats(items,month){
      let total=0,paid=0;
      items.forEach(p=>{total+=p.val;if(p.paid?.[month])paid+=p.val;});
      return{total,paid,pending:total-paid};
    },
    committedForMonth({transactions,plannedExpenses,month,todayISO}){
      let total=0;
      transactions.forEach(t=>{if(t.installmentId&&monthKey(t.date)===month&&t.date>=todayISO)total+=t.val;});
      plannedExpenses.forEach(p=>{
        if(p.recurring){if(!p.paid?.[month])total+=p.val;}
        else if(p.month===month&&!p.paid?.[month])total+=p.val;
      });
      return total;
    },
    committedNextMonths({transactions,plannedExpenses,currentMonthKey,todayISO,count}){
      const idx=MONTH_ORDER.indexOf(currentMonthKey);
      let total=0;
      for(let i=0;i<count;i++){const mk=MONTH_ORDER[idx+i];if(mk)total+=BudgetAnalyzer.committedForMonth({transactions,plannedExpenses,month:mk,todayISO});}
      return total;
    },
    subscriptions(plannedExpenses,month){
      const recurring=plannedExpenses.filter(p=>p.recurring);
      if(recurring.length===0)return null;
      const total=sumVal(recurring);
      const biggest=[...recurring].sort((a,b)=>b.val-a.val)[0];
      const pendingThisMonth=recurring.filter(p=>!p.paid?.[month]);
      return{count:recurring.length,total,biggest,pendingCount:pendingThisMonth.length};
    },
    installmentStats(installments,txMap,todayISO){
      let remaining=0,paid=0,active=0;
      installments.forEach(inst=>{
        inst.txIds.forEach(id=>{const t=txMap.get(id);if(t){if(t.date<=todayISO)paid+=t.val;else remaining+=t.val;}});
        if(inst.txIds.some(id=>{const t=txMap.get(id);return t&&t.date>todayISO;}))active++;
      });
      return{remaining,paid,active};
    },
    pendingInstallmentsCount(installments,txMap,todayISO){
      return installments.reduce((s,i)=>s+i.txIds.filter(id=>{const t=txMap.get(id);return t&&t.date>todayISO;}).length,0);
    },
    monthlyInstallment(total,num){return(!isNaN(total)&&!isNaN(num)&&num>0)?total/num:null;},
  };

  const ExpenseAnalyzer={
    byCategory(filteredTx,invNet){
      const m={};
      filteredTx.filter(isSaidaReal).forEach(t=>{m[t.cat]=(m[t.cat]||0)+t.val;});
      if(invNet>0)m["Investimento"]=invNet;
      return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    },
    displayTop(catData,limit=8){
      if(catData.length<=limit)return catData;
      const top=catData.slice(0,limit-1);
      const restSum=catData.slice(limit-1).reduce((s,d)=>s+d.value,0);
      return [...top,{name:"Outras categorias",value:restSum}];
    },
    fixedVarSplit(filteredTx){
      let fixed=0,variavel=0;
      filteredTx.forEach(t=>{
        if(t.type!=="Saída"||t.cat==="Investimento")return;
        if(t.fixed==="Fixa")fixed+=t.val;else variavel+=t.val;
      });
      return{fixed,variavel};
    },
    categoryTrend({transactions,curM,prevM}){
      if(!curM||!prevM)return null;
      const catMonth=mk=>{
        const m={};
        transactions.forEach(t=>{if(t.type!=="Saída"||t.cat==="Investimento")return;if(monthKey(t.date)!==mk)return;m[t.cat]=(m[t.cat]||0)+t.val;});
        return m;
      };
      const curCats=catMonth(curM.month),prevCats=catMonth(prevM.month);
      const allCats=new Set([...Object.keys(curCats),...Object.keys(prevCats)]);
      let grew=null,shrank=null;
      allCats.forEach(c=>{
        const delta=(curCats[c]||0)-(prevCats[c]||0);
        if(grew===null||delta>grew.delta)grew={cat:c,delta};
        if(shrank===null||delta<shrank.delta)shrank={cat:c,delta};
      });
      return{grew,shrank};
    },
    dailyAverage({transactions,currentMonthKey,todayISO}){
      const day=parseInt(todayISO.split("-")[2],10);
      const txThisMonth=transactions.filter(t=>monthKey(t.date)===currentMonthKey&&t.date<=todayISO);
      const outSoFar=sumVal(txThisMonth.filter(isSaidaReal));
      return{outSoFar,avgDaily:day>0?outSoFar/day:0,day};
    },
  };

  const IncomeAnalyzer={
    committedRatio(totalIn,totalOut){return totalIn>0?Math.round((totalOut/totalIn)*1000)/10:null;},
    savingsRate(balance,totalIn){return totalIn>0?Math.round((balance/totalIn)*1000)/10:null;},
  };

  const InvestmentAnalyzer={
    stats(transactions){
      const invTx=transactions.filter(t=>t.cat==="Investimento");
      if(invTx.length===0)return null;
      const aportes=sumVal(invTx.filter(isAporte));
      const resgates=sumVal(invTx.filter(isResgate));
      const rendimentos=sumVal(invTx.filter(t=>t.invTipo==="Rendimento"));
      return{aportes,resgates,rendimentos};
    },
    participacao(invNet,patrimonio){return patrimonio>0?Math.round((invNet/patrimonio)*1000)/10:null;},
  };

  const GoalAnalyzer={
    enhance(wishes,avgMonthlySavings){
      return wishes.map(w=>{
        const remaining=Math.max(0,w.price-w.saved);
        const pct=w.price>0?Math.min(100,Math.round((w.saved/w.price)*100)):0;
        const monthlyByTarget=w.monthsTarget>0?remaining/w.monthsTarget:null;
        const monthlyByAvg=avgMonthlySavings&&avgMonthlySavings>0?avgMonthlySavings:null;
        const estMonths=monthlyByAvg&&remaining>0?Math.ceil(remaining/monthlyByAvg):null;
        let etaDate=null;
        if(estMonths){const d=new Date();d.setMonth(d.getMonth()+estMonths);etaDate=`${MONTHS_ARR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;}
        const fasterMonths=(monthlyByAvg&&remaining>0)?Math.ceil(remaining/(monthlyByAvg*1.5)):null;
        const timeSaved=(estMonths!==null&&fasterMonths!==null)?Math.max(0,estMonths-fasterMonths):null;
        return{...w,remaining,pct,monthlyByTarget,estMonths,etaDate,fasterMonths,timeSaved};
      });
    },
    // ---- Versão detalhada: MESMA matemática de avgMonthlySavings, expondo os
    // meses usados no cálculo (últimos 6 meses fechados com saldo positivo).
    avgMonthlySavingsBreakdown(summary){
      const positive=summary.filter(m=>m.balance>0).slice(-6);
      if(positive.length===0)return{avg:null,months:[]};
      const avg=positive.reduce((s,m)=>s+m.balance,0)/positive.length;
      return{avg,months:positive.map(m=>({month:m.month,balance:m.balance}))};
    },
    avgMonthlySavings(summary){
      return GoalAnalyzer.avgMonthlySavingsBreakdown(summary).avg;
    },
  };

  const ForecastEngine={
    eventMeta(t,plannedById){
      if(t.cat==="Investimento")return{color:"#3B82F6",label:"Investimento"};
      if(t.installmentId)return{color:"#F0A857",label:"Parcela"};
      if(t.plannedId){
        const pl=plannedById.get(t.plannedId);
        if(pl?.recurring)return{color:"#A78BFA",label:"Assinatura"};
        return{color:"#EF4444",label:"Despesa"};
      }
      if(t.type==="Entrada")return{color:"#22C55E",label:"Receita"};
      return{color:"#EF4444",label:"Despesa"};
    },
    groupByDate(tx){
      const m={};tx.forEach(t=>{if(!m[t.date])m[t.date]=[];m[t.date].push(t);});return m;
    },
    monthGrid({year,monthIdx,txByDate,plannedById}){
      const firstWeekday=new Date(year,monthIdx,1).getDay();
      const daysInMonth=new Date(year,monthIdx+1,0).getDate();
      const cells=[];
      for(let i=0;i<firstWeekday;i++)cells.push(null);
      for(let d=1;d<=daysInMonth;d++){
        const dateStr=`${year}-${String(monthIdx+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const evs=(txByDate[dateStr]||[]).map(t=>({...t,...ForecastEngine.eventMeta(t,plannedById)}));
        cells.push({day:d,dateStr,events:evs});
      }
      return cells;
    },
    bucketForDate({dateStr,todayISO,currentMonthKey,nextMonthKey}){
      if(dateStr===todayISO)return"hoje";
      const tomorrow=addDaysStr(todayISO,1);
      if(dateStr===tomorrow)return"amanha";
      const in7=addDaysStr(todayISO,7);
      const in14=addDaysStr(todayISO,14);
      if(dateStr<=in7)return"semana";
      if(dateStr<=in14)return"prox_semana";
      if(monthKey(dateStr)===currentMonthKey)return"mes";
      if(monthKey(dateStr)===nextMonthKey)return"prox_mes";
      return"depois";
    },
    timeline({transactions,plannedExpenses,plannedById,todayISO,currentMonthKey,nextMonthKey}){
      const b={hoje:[],amanha:[],semana:[],prox_semana:[],mes:[],prox_mes:[]};
      [...transactions].filter(t=>t.date>=todayISO).sort((a,b2)=>a.date.localeCompare(b2.date)).forEach(t=>{
        const bk=ForecastEngine.bucketForDate({dateStr:t.date,todayISO,currentMonthKey,nextMonthKey});
        if(b[bk])b[bk].push({kind:"tx",data:t,...ForecastEngine.eventMeta(t,plannedById)});
      });
      plannedExpenses.forEach(p=>{
        const relevantMonths=p.recurring?[currentMonthKey,nextMonthKey]:[p.month];
        relevantMonths.forEach(mk=>{
          if(!mk||p.paid?.[mk])return;
          const bk=mk===currentMonthKey?"mes":mk===nextMonthKey?"prox_mes":null;
          if(bk)b[bk].push({kind:"planned",data:p,color:p.recurring?"#A78BFA":"#EF4444",label:p.recurring?"Assinatura":"Conta",month:mk});
        });
      });
      return b;
    },
    reminders({transactions,plannedExpenses,plannedById,enhancedWishes,todayISO,currentMonthKey}){
      const list=[];
      const in3=addDaysStr(todayISO,3);
      transactions.forEach(t=>{
        if(t.date>todayISO&&t.date<=in3){
          const d=diffDays(todayISO,t.date);
          const when=d===1?"amanhã":`em ${d} dias`;
          const cleanDescLocal=t.desc.replace(/\s*\(\d+\/\d+\)$/,"");
          if(t.installmentId)list.push({type:"parcela",text:`Parcela de ${cleanDescLocal} vence ${when}.`});
          else if(t.plannedId){
            const pl=plannedById.get(t.plannedId);
            if(pl?.recurring)list.push({type:"assinatura",text:`Assinatura ${cleanDescLocal} será cobrada ${when}.`});
            else list.push({type:"conta",text:`Conta ${cleanDescLocal} vence ${when}.`});
          }else if(t.type==="Saída")list.push({type:"pagamento",text:`Pagamento de ${cleanDescLocal} vence ${when}.`});
        }
      });
      const todayDateObj=new Date(todayISO+"T12:00:00");
      const todayMonthDays=new Date(todayDateObj.getFullYear(),todayDateObj.getMonth()+1,0).getDate();
      const dayOfMonth=todayDateObj.getDate();
      if(todayMonthDays-dayOfMonth<=5){
        plannedExpenses.forEach(p=>{
          const isRelevant=p.recurring||p.month===currentMonthKey;
          if(isRelevant&&!p.paid?.[currentMonthKey])list.push({type:"previsto",text:`${p.desc} ainda não foi paga este mês.`});
        });
      }
      enhancedWishes.forEach(w=>{if(w.pct>=90&&w.pct<100)list.push({type:"meta",text:`Meta "${w.name}" está a ${100-w.pct}% de ser concluída!`});});
      return list;
    },
    nextEvents({transactions,todayISO}){
      const futureSorted=[...transactions].filter(t=>t.date>todayISO).sort((a,b)=>a.date.localeCompare(b.date));
      const proximaConta=futureSorted.find(t=>t.type==="Saída"&&t.cat!=="Investimento"&&!t.installmentId);
      const proximaReceita=futureSorted.find(t=>t.type==="Entrada"&&t.cat!=="Investimento");
      const proximaParcela=futureSorted.find(t=>t.installmentId);
      const saidas=futureSorted.filter(t=>t.type==="Saída"&&t.cat!=="Investimento");
      const maiorPagamento=saidas.length?[...saidas].sort((a,b)=>b.val-a.val)[0]:null;
      const entradas=futureSorted.filter(t=>t.type==="Entrada"&&t.cat!=="Investimento");
      const maiorEntrada=entradas.length?[...entradas].sort((a,b)=>b.val-a.val)[0]:null;
      return{proximaConta,proximaReceita,proximaParcela,maiorPagamento,maiorEntrada};
    },
    endOfMonthProjection({transactions,plannedExpenses,currentMonthKey}){
      const monthTx=transactions.filter(t=>monthKey(t.date)===currentMonthKey);
      if(monthTx.length===0&&plannedExpenses.length===0)return null;
      const inc=sumVal(monthTx.filter(isEntradaReal));
      const invAp=sumVal(monthTx.filter(isAporte));
      const invRe=sumVal(monthTx.filter(isResgate));
      const out=sumVal(monthTx.filter(isSaidaReal))+invAp-invRe;
      const plannedPending=plannedExpenses.filter(p=>p.recurring||p.month===currentMonthKey).reduce((s,p)=>s+(p.paid?.[currentMonthKey]?0:p.val),0);
      return{expected:inc-out-plannedPending,inc,out,plannedPending};
    },
  };

  const HealthScoreEngine={
    compute({savingsRate,committedIncome,fixedVarSplit,patrimonio,balance,reservaMeses,reservaFinanceira}){
      return[
        savingsRate!==null&&{label:"Taxa de economia",value:`${savingsRate}%`,desc:"Percentual da renda que sobrou no período.",status:savingsRate>=20?"Excelente":savingsRate>=10?"Boa":savingsRate>=0?"Atenção":"Crítica"},
        committedIncome!==null&&{label:"Receita comprometida",value:`${committedIncome}%`,desc:"Quanto da sua renda já está comprometido com gastos.",status:committedIncome<=50?"Excelente":committedIncome<=70?"Boa":committedIncome<=90?"Atenção":"Crítica"},
        {label:"Gasto fixo",value:fmt(fixedVarSplit.fixed),desc:"Total de despesas fixas no período.",status:null},
        {label:"Gasto variável",value:fmt(fixedVarSplit.variavel),desc:"Total de despesas variáveis no período.",status:null},
        {label:"Patrimônio líquido",value:fmt(patrimonio),desc:"Saldo disponível somado aos investimentos.",status:patrimonio>0?"Boa":"Atenção"},
        {label:"Saldo disponível",value:fmt(balance),desc:"Quanto sobrou no período selecionado.",status:balance>0?"Boa":"Crítica"},
        reservaMeses!==null&&{label:"Reserva financeira",value:`${fmt(reservaFinanceira)} (${reservaMeses}x gastos)`,desc:"Total guardado em metas, em meses de gasto médio.",status:reservaMeses>=6?"Excelente":reservaMeses>=3?"Boa":reservaMeses>=1?"Atenção":"Crítica"},
      ].filter(Boolean);
    },
  };

  const InsightsGenerator={
    generate({curM,prevM,categoryTrend,currentMonthStats,plannedStats,topCat,transactions,pendingParcelasCount,investmentStats,patrimonio,currentMonthKey}){
      const pctChangeLocal=(cur,prev)=>prev===0?0:Math.round((cur-prev)/prev*100);
      const list=[];
      if(curM&&prevM){
        const outDelta=pctChangeLocal(curM.out,prevM.out);
        if(outDelta<0)list.push({type:"gasto_menor",text:`Você gastou ${Math.abs(outDelta)}% menos que no mês passado.`});
        else if(outDelta>0)list.push({type:"gasto_maior",text:`Você gastou ${outDelta}% mais que no mês passado.`});
        if(curM.balance>prevM.balance)list.push({type:"economia_maior",text:`Você economizou mais que no mês anterior: ${fmt(curM.balance)} agora contra ${fmt(prevM.balance)} no mês passado.`});
        const incDelta=pctChangeLocal(curM.in,prevM.in);
        if(incDelta>0)list.push({type:"renda_maior",text:`Sua receita aumentou ${incDelta}%.`});
        else if(incDelta<0)list.push({type:"renda_menor",text:`Sua receita caiu ${Math.abs(incDelta)}%.`});
      }
      if(categoryTrend?.grew&&categoryTrend.grew.delta>0)list.push({type:"categoria_cresceu",text:`Sua categoria que mais cresceu foi ${categoryTrend.grew.cat}.`});
      if(currentMonthStats.avgDaily>0)list.push({type:"gasto_medio",text:`Seu gasto médio diário é de ${fmt(currentMonthStats.avgDaily)}.`});
      if(plannedStats.total>0){
        const usedPct=Math.round((plannedStats.paid/plannedStats.total)*100);
        list.push({type:"orcamento_usado",text:`Você já utilizou ${usedPct}% do seu orçamento previsto do mês.`,critical:usedPct>=90});
      }
      if(topCat)list.push({type:"maior_gasto",text:`Seu maior gasto foi com ${topCat.name}.`});
      const recorrentes=transactions.filter(t=>t.fixed==="Fixa"&&monthKey(t.date)===(curM?curM.month:currentMonthKey)).length;
      if(recorrentes>0)list.push({type:"recorrentes",text:`Você possui ${recorrentes} despesa(s) recorrente(s) este mês.`});
      if(pendingParcelasCount>0)list.push({type:"parcelas",text:`Você possui ${pendingParcelasCount} parcela(s) restante(s).`});
      if(investmentStats&&prevM&&curM){
        const curAportes=transactions.filter(t=>t.cat==="Investimento"&&monthKey(t.date)===curM.month&&isAporte(t)).reduce((s,t)=>s+t.val,0);
        const prevAportes=transactions.filter(t=>t.cat==="Investimento"&&monthKey(t.date)===prevM.month&&isAporte(t)).reduce((s,t)=>s+t.val,0);
        if(curAportes>prevAportes)list.push({type:"investiu_mais",text:`Você aportou mais em investimentos este mês: ${fmt(curAportes)} (mês passado foi ${fmt(prevAportes)}).`});
      }
      if(patrimonio>0)list.push({type:"patrimonio_positivo",text:`Seu patrimônio líquido está positivo: ${fmt(patrimonio)}.`});
      return list;
    },
  };

  // ---- DecisionEngine ----------------------------------------------------
  // Continua respondendo com as MESMAS regras/limiares de antes (ok / atenção
  // / crítico). O que mudou: cada resposta agora vem acompanhada de um
  // `breakdown` (linhas de cálculo + itens reais que entraram na conta) e a
  // redação ficou em tom de consultor em vez de "sim/não" seco.
  const DecisionEngine={
    isWithinBudget({plannedStats,plannedItemsForMonth,month}){
      if(!plannedStats||plannedStats.total<=0)return{
        key:"orcamento",question:"Estou dentro do orçamento previsto?",
        answer:"Ainda não sei dizer",status:"neutro",
        detail:"Cadastre gastos previstos para este mês para eu poder responder com números reais.",
        breakdown:null,evidence:{period:month||"",categories:[],dataUsed:["previstos"]},
      };
      const usedPct=Math.round((plannedStats.paid/plannedStats.total)*100);
      const items=plannedItemsForMonth||[];
      const pendingItems=items.filter(p=>!p.paid?.[month]).map(p=>({label:p.desc,value:p.val,tag:p.recurring?"Assinatura":"Conta prevista"})).sort((a,b)=>b.value-a.value);
      const paidItems=items.filter(p=>p.paid?.[month]).map(p=>({label:p.desc,value:p.val,tag:"Pago"})).sort((a,b)=>b.value-a.value);
      return{
        key:"orcamento",question:"Estou dentro do orçamento previsto?",
        answer:plannedStats.pending>=0?"Sim, ainda dentro do previsto":"Você já passou do previsto",
        status:usedPct>=100?"critico":usedPct>=90?"atencao":"ok",
        detail:`Você já usou ${usedPct}% do previsto para este mês (${fmt(plannedStats.paid)} de ${fmt(plannedStats.total)}).`,
        breakdown:{
          calcRows:[
            {label:"Total previsto no mês",value:fmt(plannedStats.total)},
            {label:"Já pago",value:fmt(plannedStats.paid),color:"#22C55E"},
            {label:"Ainda pendente",value:fmt(plannedStats.pending),color:plannedStats.pending>=0?undefined:"#EF4444"},
            {label:"Percentual já utilizado",value:`${usedPct}%`,highlight:true,color:usedPct>=100?"#EF4444":usedPct>=90?"#F0A857":"#22C55E"},
          ],
          commitItems:pendingItems,
          paidItems,
        },
        evidence:{period:month||"",categories:[],dataUsed:["previstos","assinaturas","contas"]},
      };
    },
    isReserveHealthy({reservaMeses,reservaFinanceira,avgMonthlyOut,enhancedWishes}){
      if(reservaMeses===null)return{
        key:"reserva",question:"Minha reserva está saudável?",
        answer:"Ainda não sei dizer",status:"neutro",
        detail:"Cadastre metas com valores guardados para eu poder avaliar sua reserva.",
        breakdown:null,evidence:{period:"",categories:[],dataUsed:["metas"]},
      };
      const goalItems=(enhancedWishes||[]).filter(w=>w.saved>0).map(w=>({label:w.name,value:w.saved,tag:"Meta"})).sort((a,b)=>b.value-a.value);
      return{
        key:"reserva",question:"Minha reserva está saudável?",
        answer:reservaMeses>=3?"Sim, está num nível saudável":"Ainda vale reforçar essa reserva",
        status:reservaMeses>=6?"ok":reservaMeses>=3?"atencao":"critico",
        detail:`Sua reserva cobre ${reservaMeses}x seu gasto médio mensal (${fmt(reservaFinanceira)} guardados).`,
        breakdown:{
          calcRows:[
            {label:"Total guardado em metas",value:fmt(reservaFinanceira)},
            {label:"Seu gasto médio mensal",value:fmt(avgMonthlyOut||0)},
            {label:"Meses de cobertura",value:`${reservaMeses}x`,highlight:true,color:reservaMeses>=6?"#22C55E":reservaMeses>=3?"#F0A857":"#EF4444"},
          ],
          commitItems:goalItems,
        },
        evidence:{period:"posição atual",categories:[],dataUsed:["metas","media"]},
      };
    },
    willCashFlowGoNegative({cashFlowProjections,transactions,plannedExpenses,balance,todayISO,currentMonthKey}){
      const neg=cashFlowProjections.find(p=>p.value<0);
      if(!neg)return{
        key:"fluxo",question:"Meu fluxo de caixa pode ficar negativo?",
        answer:"Não, suas projeções continuam positivas",status:"ok",
        detail:"Nenhuma das projeções (7/30/60/90 dias) fica negativa com os dados atuais.",
        breakdown:null,evidence:{period:"próximos 90 dias",categories:[],dataUsed:["saldo","receitas","contas","parcelas","assinaturas"]},
      };
      const detailed=CashFlowAnalyzer.projectionAtDetailed({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead:neg.days});
      const commitItems=[
        ...detailed.outItems.map(i=>({label:i.label,value:i.value,tag:i.kind==="parcela"?"Parcela":i.kind==="conta"?"Conta":"Despesa"})),
        ...detailed.plannedItems.map(i=>({label:i.label,value:i.value,tag:i.recurring?"Assinatura":"Conta prevista"})),
      ].sort((a,b)=>b.value-a.value);
      return{
        key:"fluxo",question:"Meu fluxo de caixa pode ficar negativo?",
        answer:`Sim, em ${neg.days} dias`,status:"critico",
        detail:`Em ${neg.days} dias sua projeção de saldo é ${fmt(neg.value)}. Isso aumenta o risco de faltar dinheiro antes do esperado.`,
        breakdown:{
          calcRows:[
            {label:"Saldo atual",value:fmt(balance)},
            {label:"Receitas previstas no período",value:`+ ${fmt(detailed.totals.inc)}`,color:"#22C55E"},
            {label:"Compromissos previstos no período",value:`- ${fmt(detailed.totals.outReal+detailed.totals.plannedOut)}`,color:"#EF4444"},
            {label:`Projeção em ${neg.days} dias`,value:fmt(neg.value),highlight:true,color:"#EF4444"},
          ],
          commitItems,
        },
        evidence:{period:`próximos ${neg.days} dias`,categories:[],dataUsed:["saldo","receitas","contas","parcelas","assinaturas"]},
      };
    },
    canSpend({amount,transactions,plannedExpenses,balance,todayISO,currentMonthKey}){
      if(!amount||amount<=0)return{
        key:"gastar",question:"Posso gastar esse valor?",
        answer:"Informe um valor para eu calcular",status:"neutro",detail:"",
        breakdown:null,evidence:{period:"",categories:[],dataUsed:[]},
      };
      const detailed=CashFlowAnalyzer.projectionAtDetailed({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead:30});
      const after=detailed.value-amount;
      const ok=after>=0;
      const commitItems=[
        ...detailed.outItems.map(i=>({label:i.label,value:i.value,tag:i.kind==="parcela"?"Parcela":i.kind==="conta"?"Conta":"Despesa"})),
        ...detailed.plannedItems.map(i=>({label:i.label,value:i.value,tag:i.recurring?"Assinatura":"Conta prevista"})),
      ].sort((a,b)=>b.value-a.value);
      const incomeItems=detailed.incomeItems.map(i=>({label:i.label,value:i.value,tag:"Receita"})).sort((a,b)=>b.value-a.value);
      return{
        key:"gastar",question:`Posso gastar ${fmt(amount)} este mês?`,
        answer:ok?"Dá para fazer esse gasto":"Eu não recomendaria esse gasto agora",
        status:ok?"ok":"atencao",
        detail:ok
          ?`Mesmo considerando seus compromissos e receitas dos próximos 30 dias, sua projeção de saldo continuaria positiva: ${fmt(after)}.`
          :`Depois desse gasto, sua projeção de saldo em 30 dias ficaria negativa em ${fmt(Math.abs(after))}. Isso aumenta o risco de faltar dinheiro antes do seu próximo recebimento.`,
        breakdown:{
          calcRows:[
            {label:"Saldo atual",value:fmt(balance)},
            {label:"Receitas previstas (30 dias)",value:`+ ${fmt(detailed.totals.inc)}`,color:"#22C55E"},
            {label:"Compromissos futuros (30 dias)",value:`- ${fmt(detailed.totals.outReal+detailed.totals.plannedOut)}`,color:"#EF4444"},
            {label:"Projeção em 30 dias (sem esse gasto)",value:fmt(detailed.value)},
            {label:`Se gastar ${fmt(amount)} agora`,value:fmt(after),highlight:true,color:ok?"#22C55E":"#EF4444"},
          ],
          commitItems,
          incomeItems,
        },
        evidence:{period:"próximos 30 dias",categories:[],dataUsed:["saldo","receitas","contas","parcelas","assinaturas"]},
      };
    },
    willGoalsFinishOnTime({enhancedWishes}){
      const withTarget=enhancedWishes.filter(w=>w.monthsTarget>0);
      if(withTarget.length===0)return{
        key:"metas",question:"Minhas metas serão concluídas no prazo?",
        answer:"Ainda não sei dizer",status:"neutro",
        detail:"Defina um prazo em meses nas suas metas para eu poder avaliar.",
        breakdown:null,evidence:{period:"",categories:[],dataUsed:["metas"]},
      };
      const late=withTarget.filter(w=>w.estMonths!==null&&w.estMonths>w.monthsTarget);
      const items=withTarget.map(w=>({
        label:w.name,
        value:w.estMonths!==null?`~${w.estMonths} meses`:"sem estimativa",
        tag:w.monthsTarget?`prazo: ${w.monthsTarget}m`:undefined,
      }));
      return{
        key:"metas",question:"Minhas metas serão concluídas no prazo?",
        answer:late.length===0?"Sim, no ritmo atual de economia":`${late.length} meta(s) podem atrasar`,
        status:late.length===0?"ok":"atencao",
        detail:late.length===0?"No ritmo atual de economia, todas as metas com prazo definido devem ser cumpridas.":`${late.map(w=>w.name).join(", ")} podem atrasar no ritmo atual de economia.`,
        breakdown:{calcRows:[],commitItems:items},
        evidence:{period:"projeção com base na sua economia recente",categories:[],dataUsed:["metas","media"]},
      };
    },
  };

  const SimulationEngine={
    economizarMais({extraPerMonth,remaining,currentMonthly,estMonths}){
      if(!remaining||remaining<=0)return null;
      const newMonthly=(currentMonthly||0)+extraPerMonth;
      if(newMonthly<=0)return null;
      const newMonths=Math.ceil(remaining/newMonthly);
      return{newMonths,monthsSaved:estMonths!==null?Math.max(0,estMonths-newMonths):null};
    },
    compraGrande({value,parcelas,committedNextMonth}){
      const monthly=parcelas>0?value/parcelas:value;
      return{monthlyImpact:monthly,newCommittedNextMonth:committedNextMonth+monthly};
    },
    investirMensal({value,months,expectedReturnPctAnual}){
      const monthlyRate=(expectedReturnPctAnual/100)/12;
      let total=0;
      for(let i=0;i<months;i++){total=(total+value)*(1+monthlyRate);}
      const aportado=value*months;
      return{totalEstimado:total,aportado,rendimentoEstimado:total-aportado};
    },
  };

  return{CashFlowAnalyzer,BudgetAnalyzer,ExpenseAnalyzer,IncomeAnalyzer,InvestmentAnalyzer,GoalAnalyzer,ForecastEngine,HealthScoreEngine,InsightsGenerator,DecisionEngine,SimulationEngine};
})();

// ============================================================================
// INSIGHT ENGINE — totalmente separado da interface e do FinancialEngine.
// Não usa React, não recebe estado do componente, apenas dados brutos.
// A lógica de pesos, memória financeira e pontuação NÃO foi alterada nesta
// sprint nem na anterior. O que mudou: além do objeto estruturado (título,
// explicação, impacto em R$, recomendação, prioridade), cada insight agora
// carrega um `breakdown` (linhas de cálculo + itens reais — transações,
// contas previstas, metas) que usa os MESMOS dados já considerados na
// decisão, para que qualquer pessoa consiga auditar o raciocínio.
// ============================================================================
const InsightEngine=(()=>{
  const stdev=arr=>{
    if(!arr.length)return 0;
    const avg=arr.reduce((a,b)=>a+b,0)/arr.length;
    const variance=arr.reduce((s,v)=>s+(v-avg)**2,0)/arr.length;
    return Math.sqrt(variance);
  };

  // ---- Peso temporal: quanto mais recente, maior a importância ----
  const monthWeight=monthsAgo=>{
    if(monthsAgo<=1)return 1.0;   // últimos 30 dias
    if(monthsAgo<=3)return 0.75;  // últimos 3 meses
    if(monthsAgo<=6)return 0.45;  // últimos 6 meses
    return 0.15;                  // histórico antigo
  };

  const normKey=s=>{
    let x=(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    x=x.replace(/\d+/g," ");
    x=x.replace(/[^a-z\s]/g," ");
    x=x.replace(/\s+/g," ").trim();
    return x;
  };

  const monthNameMap={jan:"Janeiro",fev:"Fevereiro",mar:"Março",abr:"Abril",mai:"Maio",jun:"Junho",jul:"Julho",ago:"Agosto",set:"Setembro",out:"Outubro",nov:"Novembro",dez:"Dezembro"};

  // ---- Memória financeira: agrupa transações por "hábito" (descrição normalizada) ----
  const buildDescMemory=(transactions,currentMonthKey)=>{
    const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
    const rawGroups={};
    transactions.forEach(t=>{
      if(t.cat==="Investimento")return;
      const key=normKey(t.desc);
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
    return clusters.map(cl=>{
      const txs=[...cl.txs].sort((a,b)=>a.date.localeCompare(b.date));
      const monthsPresent=[...new Set(txs.map(t=>monthKey(t.date)))];
      const monthIdxs=monthsPresent.map(mk=>MONTH_ORDER.indexOf(mk)).filter(i=>i>=0);
      if(monthIdxs.length===0)return null;
      const firstIdx=Math.min(...monthIdxs);
      const lastIdx=Math.max(...monthIdxs);
      const lastGapMonths=currentIdx-lastIdx;
      const spanMonths=lastIdx-firstIdx+1;
      const monthsCoveredRatio=spanMonths>0?monthsPresent.length/spanMonths:0;
      const isHabitLike=monthsPresent.length>=3&&monthsCoveredRatio>=0.6;
      let status="ocasional";
      if(isHabitLike){
        if(lastGapMonths<=1)status="ativo";
        else if(lastGapMonths<=2)status="enfraquecendo";
        else status="inativo";
      }else if(monthsPresent.length<=2&&firstIdx>=currentIdx-1){
        status="emergente";
      }
      const last=txs[txs.length-1];
      const avgVal=txs.reduce((s,t)=>s+t.val,0)/txs.length;
      // ---- Amostra real de lançamentos: usada nos cartões para mostrar
      // "principais responsáveis" em vez de uma frase genérica ----
      const sampleTxs=txs.slice(-3).reverse().map(t=>({label:t.desc.replace(/\s*\(\d+\/\d+\)$/,""),value:t.val,date:t.date}));
      return{
        key:cl.rep,desc:last.desc.replace(/\s*\(\d+\/\d+\)$/,""),cat:last.cat,
        monthsPresent,firstIdx,lastIdx,lastGapMonths,type:last.type,
        isHabitLike,status,count:txs.length,lastVal:last.val,avgVal,sampleTxs,
      };
    }).filter(Boolean);
  };

  // ---- Ciclo de vida das categorias: ativa / inativa / emergente ----
  const buildCategoryLifecycle=(transactions,currentMonthKey)=>{
    const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
    const byCat={};
    transactions.forEach(t=>{
      if(t.type!=="Saída"||t.cat==="Investimento")return;
      if(!byCat[t.cat])byCat[t.cat]={monthly:{}};
      const mk=monthKey(t.date);
      byCat[t.cat].monthly[mk]=(byCat[t.cat].monthly[mk]||0)+t.val;
    });
    return Object.entries(byCat).map(([cat,d])=>{
      const idxs=Object.keys(d.monthly).map(mk=>MONTH_ORDER.indexOf(mk)).filter(i=>i>=0);
      if(idxs.length===0)return null;
      const lastIdx=Math.max(...idxs);
      const firstIdx=Math.min(...idxs);
      const gap=currentIdx-lastIdx;
      let status="ativa";
      if(gap>=3)status="inativa";
      else if(idxs.length<=2&&firstIdx>=currentIdx-1)status="emergente";
      const lastMonthKey=Object.keys(d.monthly).find(mk=>MONTH_ORDER.indexOf(mk)===lastIdx);
      return{cat,firstIdx,lastIdx,gap,status,monthsCount:idxs.length,lastVal:lastMonthKey?d.monthly[lastMonthKey]:0};
    }).filter(Boolean);
  };

  const monthlyCategoryTotals=transactions=>{
    const m={};
    transactions.forEach(t=>{
      if(t.type!=="Saída"||t.cat==="Investimento")return;
      const mk=monthKey(t.date);
      if(!m[t.cat])m[t.cat]={};
      m[t.cat][mk]=(m[t.cat][mk]||0)+t.val;
    });
    return m;
  };

  const catWeightedAvg=(catMonthly,currentIdx)=>{
    let wsum=0,vsum=0,n=0;
    Object.entries(catMonthly).forEach(([mk,val])=>{
      const idx=MONTH_ORDER.indexOf(mk);
      if(idx<0||idx>=currentIdx)return;
      const gap=currentIdx-idx;
      if(gap>6)return;
      const w=monthWeight(gap);
      wsum+=w;vsum+=w*val;n++;
    });
    return{avg:wsum>0?vsum/wsum:null,monthsUsed:n};
  };

  const weekendShare=(transactions,cat,currentMonthKey)=>{
    const txs=transactions.filter(t=>t.cat===cat&&t.type==="Saída"&&monthKey(t.date)===currentMonthKey);
    if(txs.length===0)return 0;
    const total=txs.reduce((s,t)=>s+t.val,0);
    if(total===0)return 0;
    const weekend=txs.filter(t=>{const d=new Date(t.date+"T12:00:00").getDay();return d===0||d===6;}).reduce((s,t)=>s+t.val,0);
    return weekend/total;
  };

  const topTxForCategory=(transactions,cat,currentMonthKey,limit=3)=>transactions
    .filter(t=>t.cat===cat&&t.type==="Saída"&&monthKey(t.date)===currentMonthKey)
    .sort((a,b)=>b.val-a.val).slice(0,limit)
    .map(t=>({label:t.desc.replace(/\s*\(\d+\/\d+\)$/,""),value:t.val,tag:t.form}));

  // Categoria de exibição (não muda pontuação/relevância — só como o cartão é rotulado)
  const CAT_META={
    atencao:{emoji:"🔴",label:"Atenção",color:"#EF4444"},
    mudanca:{emoji:"🟡",label:"Mudança",color:"#F0A857"},
    oportunidade:{emoji:"🟢",label:"Oportunidade",color:"#22C55E"},
    conquista:{emoji:"🔵",label:"Conquista",color:"#3B82F6"},
  };
  const PRIORITY_RANK={alta:3,media:2,baixa:1};

  // ---- Tendências: mês atual vs média ponderada recente ----
  const genTrends=ctx=>{
    const{transactions,currentMonthKey,catMonthly}=ctx;
    const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
    const monthLabel=monthNameMap[currentMonthKey.split("/")[0]]||currentMonthKey;
    const out=[];
    const analyzed=Object.keys(catMonthly).map(cat=>{
      const monthly=catMonthly[cat];
      const curVal=monthly[currentMonthKey]||0;
      const{avg,monthsUsed}=catWeightedAvg(monthly,currentIdx);
      return{cat,curVal,avg,monthsUsed};
    }).filter(a=>a.avg!==null&&a.monthsUsed>=2);

    analyzed.map(a=>({...a,delta:a.curVal-a.avg,pct:a.avg>0?Math.round(((a.curVal-a.avg)/a.avg)*100):null}))
      .filter(a=>a.delta>=50&&a.pct!==null&&a.pct>=15)
      .sort((a,b)=>b.delta-a.delta).slice(0,2)
      .forEach(a=>{
        const wknd=weekendShare(transactions,a.cat,currentMonthKey);
        const suggestion=Math.max(30,Math.round((a.delta*0.55)/10)*10);
        const topTx=topTxForCategory(transactions,a.cat,currentMonthKey);
        out.push({
          category:"atencao",priority:a.pct>=35?"alta":"media",
          title:`${a.cat} acima do normal`,
          heroNumber:{value:a.delta,format:"currency",sign:"+"},
          comparison:{aLabel:"Sua média",aValue:a.avg,bLabel:monthLabel,bValue:a.curVal},
          explanation:`Você gastou ${fmt(a.curVal)} em ${a.cat} neste mês — ${a.pct}% acima da sua média recente de ${fmt(a.avg)}.`,
          reason:topTx.length>0
            ?`O aumento foi causado principalmente por ${topTx.map(t=>t.label).slice(0,2).join(" e ")}.${wknd>=0.5?` ${Math.round(wknd*100)}% desses gastos aconteceram em finais de semana.`:""}`
            :(wknd>=0.5?`Boa parte aconteceu em gastos concentrados nos finais de semana (${Math.round(wknd*100)}% do total).`:"O aumento se espalhou ao longo do mês, sem um padrão claro de dia."),
          recommendation:`Se voltar para sua média de ${fmt(a.avg)}, você poderia economizar cerca de ${fmt(suggestion)} por mês.`,
          confidence:a.monthsUsed>=4?"alta":"media",
          breakdown:{
            lineItems:topTx,
            calcRows:[
              {label:"Sua média recente",value:fmt(a.avg)},
              {label:`Gasto em ${monthLabel}`,value:fmt(a.curVal)},
              {label:"Diferença",value:`+${fmt(a.delta)} (${a.pct}%)`,highlight:true,color:"#EF4444"},
            ],
          },
          evidence:{period:monthLabel,categories:[a.cat],dataUsed:["categorias","media","transacoes","periodo"]},
          score:55+Math.min(30,a.pct),
        });
      });

    analyzed.map(a=>({...a,delta:a.avg-a.curVal,pct:a.avg>0?Math.round(((a.avg-a.curVal)/a.avg)*100):null}))
      .filter(a=>a.delta>=50&&a.pct!==null&&a.pct>=20)
      .sort((a,b)=>b.delta-a.delta).slice(0,1)
      .forEach(a=>{
        out.push({
          category:"oportunidade",priority:"baixa",
          title:`Economia em ${a.cat}`,
          heroNumber:{value:a.delta,format:"currency",sign:"-"},
          comparison:{aLabel:"Sua média",aValue:a.avg,bLabel:monthLabel,bValue:a.curVal},
          explanation:`Você gastou ${fmt(a.curVal)} em ${a.cat} neste mês — ${a.pct}% abaixo da sua média recente de ${fmt(a.avg)}. Um bom sinal de controle.`,
          reason:`Isso é ${a.pct}% a menos que seu padrão recente nessa categoria.`,
          recommendation:`Vale direcionar essa sobra de aproximadamente ${fmt(a.delta)} para sua reserva ou para uma meta.`,
          confidence:a.monthsUsed>=4?"alta":"media",
          breakdown:{
            calcRows:[
              {label:"Sua média recente",value:fmt(a.avg)},
              {label:`Gasto em ${monthLabel}`,value:fmt(a.curVal)},
              {label:"Economizado",value:`-${fmt(a.delta)} (${a.pct}%)`,highlight:true,color:"#22C55E"},
            ],
          },
          evidence:{period:monthLabel,categories:[a.cat],dataUsed:["categorias","media","periodo"]},
          score:45+Math.min(25,a.pct),
        });
      });

    return out;
  };

  // ---- Mudanças de comportamento: hábito cancelado, novo hábito, substituição ----
  const genBehaviorChanges=ctx=>{
    const{descMemory,catLifecycle,currentMonthKey}=ctx;
    const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
    const out=[];
    const discontinued=descMemory.filter(m=>m.isHabitLike&&m.status==="inativo");
    const emergent=descMemory.filter(m=>m.status==="emergente"||(m.isHabitLike&&m.firstIdx>=currentIdx-2));
    discontinued.forEach(d=>{
      const match=emergent.find(e=>e.cat===d.cat&&e.key!==d.key&&e.firstIdx>=d.lastIdx&&e.firstIdx<=d.lastIdx+2);
      const monthLabel=monthNameMap[(MONTH_ORDER[d.lastIdx]||"").split("/")[0]]||MONTH_ORDER[d.lastIdx]||"";
      if(match){
        out.push({
          category:"mudanca",priority:"media",
          title:"Novo hábito financeiro detectado",
          heroNumber:match.lastVal?{value:match.lastVal,format:"currency",sign:"none"}:{value:d.count,format:"plain",suffix:" meses",sign:"none"},
          explanation:`Você deixou de gastar com ${d.desc} e passou a ter gastos com ${match.desc}, mantido desde ${monthLabel}.`,
          reason:"Um gasto recorrente parou e outro começou logo em seguida, na mesma categoria — por isso entendemos como uma troca de hábito.",
          recommendation:`Vale conferir se ${match.desc} realmente compensa financeiramente frente ao que era gasto antes com ${d.desc}.`,
          confidence:d.isHabitLike?"alta":"media",
          breakdown:{
            lineItems:[...(d.sampleTxs||[]).map(t=>({...t,tag:"antigo"})),...(match.sampleTxs||[]).map(t=>({...t,tag:"novo"}))],
          },
          evidence:{period:`desde ${monthLabel}`,categories:[d.cat],dataUsed:["transacoes","categorias","periodo"]},
          score:70,
        });
      }else{
        out.push({
          category:"mudanca",priority:"baixa",
          title:`Gasto com ${d.desc} parou`,
          heroNumber:d.lastVal?{value:d.lastVal,format:"currency",sign:"-"}:{value:d.count,format:"plain",suffix:" meses",sign:"none"},
          explanation:`Você não tem mais gastos com ${d.desc} desde ${monthLabel}. Esse gasto deixou de fazer parte da sua rotina.`,
          reason:`Esse hábito apareceu em ${d.count} lançamento(s) ao longo de vários meses e não aparece mais recentemente.`,
          recommendation:`Considere realocar o valor que ia para ${d.desc} para uma meta ou investimento.`,
          confidence:d.isHabitLike?"alta":"media",
          breakdown:{lineItems:d.sampleTxs||[]},
          evidence:{period:`desde ${monthLabel}`,categories:[d.cat],dataUsed:["transacoes","periodo"]},
          score:50,
        });
      }
    });
    descMemory.filter(m=>m.isHabitLike&&m.status==="ativo"&&m.firstIdx>=currentIdx-3).slice(0,2).forEach(h=>{
      const n=currentIdx-h.firstIdx+1;
      out.push({
        category:"mudanca",priority:"baixa",
        title:`Novo gasto recorrente: ${h.desc}`,
        heroNumber:h.lastVal?{value:h.lastVal,format:"currency",sign:"+"}:{value:n,format:"plain",suffix:" meses",sign:"none"},
        explanation:`Já são ${n} ${n===1?"mês":"meses"} seguidos com gastos em ${h.desc} — parece estar virando hábito.`,
        reason:"Detectamos a mesma descrição de gasto se repetindo em meses consecutivos.",
        recommendation:`Se for um gasto fixo, vale já planejá-lo no seu orçamento mensal.`,
        confidence:n>=3?"media":"nova",
        breakdown:{lineItems:h.sampleTxs||[]},
        evidence:{period:`últimos ${n} meses`,categories:[h.cat],dataUsed:["transacoes","periodo"]},
        score:40,
      });
    });
    catLifecycle.filter(c=>c.status==="inativa").slice(0,1).forEach(c=>{
      out.push({
        category:"mudanca",priority:"baixa",
        title:`Categoria ${c.cat} sumiu do orçamento`,
        heroNumber:{value:c.lastVal||0,format:"currency",sign:"-"},
        explanation:`Seus gastos com ${c.cat} praticamente desapareceram nos últimos meses.`,
        reason:"Não há gastos nessa categoria há pelo menos três meses.",
        recommendation:`Bom momento para redirecionar esse espaço a uma prioridade financeira.`,
        confidence:"media",
        breakdown:null,
        evidence:{period:"últimos 3+ meses",categories:[c.cat],dataUsed:["categorias","periodo"]},
        score:22,
      });
    });
    catLifecycle.filter(c=>c.status==="emergente").slice(0,1).forEach(c=>{
      out.push({
        category:"mudanca",priority:"baixa",
        title:`Nova categoria de gasto: ${c.cat}`,
        heroNumber:{value:c.lastVal||0,format:"currency",sign:"+"},
        explanation:`Você começou a ter gastos com ${c.cat} recentemente.`,
        reason:"Essa categoria não aparecia no seu histórico até os últimos meses.",
        recommendation:`Vale acompanhar se isso vira um hábito nos próximos meses.`,
        confidence:"nova",
        breakdown:null,
        evidence:{period:"últimos 1-2 meses",categories:[c.cat],dataUsed:["categorias","periodo"]},
        score:22,
      });
    });
    return out;
  };

  // ---- Alertas importantes ----
  const genRiskAlerts=ctx=>{
    const{plannedStats,plannedItemsForMonth,plannedMonth,cashFlowProjections,committedIncome,catMonthly,currentMonthKey,todayISO,transactions,plannedExpenses,balance,totalIn,totalOut}=ctx;
    const monthLabel=monthNameMap[currentMonthKey.split("/")[0]]||currentMonthKey;
    const out=[];
    if(plannedStats&&plannedStats.total>0){
      const usedPct=Math.round((plannedStats.paid/plannedStats.total)*100);
      if(usedPct>=90){
        const pendingItems=(plannedItemsForMonth||[]).filter(p=>!p.paid?.[plannedMonth]).map(p=>({label:p.desc,value:p.val,tag:p.recurring?"Assinatura":"Conta prevista"})).sort((a,b)=>b.value-a.value);
        out.push({
          category:"atencao",priority:"alta",
          title:"Orçamento do mês quase no limite",
          heroNumber:{value:usedPct,format:"percent",sign:"none"},
          comparison:{aLabel:"Previsto",aValue:plannedStats.total,bLabel:"Usado",bValue:plannedStats.paid},
          explanation:`Você já comprometeu ${usedPct}% do valor previsto para este mês (${fmt(plannedStats.paid)} de ${fmt(plannedStats.total)}).`,
          reason:pendingItems.length>0?`Ainda restam ${fmt(plannedStats.pending)} em contas e assinaturas previstas pendentes.`:"O valor previsto para o mês está praticamente todo utilizado.",
          recommendation:`Eu seguraria os gastos variáveis pelo restante do mês para não estourar o previsto.`,
          confidence:"alta",
          breakdown:{
            lineItems:pendingItems,
            calcRows:[
              {label:"Total previsto",value:fmt(plannedStats.total)},
              {label:"Já utilizado",value:fmt(plannedStats.paid)},
              {label:"Percentual usado",value:`${usedPct}%`,highlight:true,color:"#EF4444"},
            ],
          },
          evidence:{period:plannedMonth||monthLabel,categories:[],dataUsed:["previstos","assinaturas","contas"]},
          score:80,
        });
      }
    }
    const neg=cashFlowProjections.find(p=>p.value<0);
    if(neg){
      const detailed=FinancialEngine.CashFlowAnalyzer.projectionAtDetailed({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead:neg.days});
      const commitItems=[
        ...detailed.outItems.map(i=>({label:i.label,value:i.value,tag:i.kind==="parcela"?"Parcela":i.kind==="conta"?"Conta":"Despesa"})),
        ...detailed.plannedItems.map(i=>({label:i.label,value:i.value,tag:i.recurring?"Assinatura":"Conta prevista"})),
      ].sort((a,b)=>b.value-a.value);
      out.push({
        category:"atencao",priority:"alta",
        title:`Saldo pode ficar negativo em ${neg.days} dias`,
        heroNumber:{value:neg.value,format:"currency",sign:"-"},
        explanation:`Considerando o que já está previsto para esse período, sua projeção de saldo em ${neg.days} dias fica em ${fmt(neg.value)}.`,
        reason:commitItems.length>0?`Isso acontece porque ${commitItems[0].label}${commitItems[1]?` e ${commitItems[1].label}`:""} já estão programados para sair antes disso.`:"Contas, parcelas e assinaturas já cadastradas superam o saldo disponível nesse horizonte.",
        recommendation:`Eu revisaria ou adiaria algum gasto previsto, ou anteciparia um recebível se possível.`,
        confidence:"alta",
        breakdown:{
          lineItems:commitItems,
          calcRows:[
            {label:"Saldo atual",value:fmt(balance)},
            {label:"Receitas previstas no período",value:`+ ${fmt(detailed.totals.inc)}`,color:"#22C55E"},
            {label:"Compromissos previstos no período",value:`- ${fmt(detailed.totals.outReal+detailed.totals.plannedOut)}`,color:"#EF4444"},
            {label:`Projeção em ${neg.days} dias`,value:fmt(neg.value),highlight:true,color:"#EF4444"},
          ],
        },
        evidence:{period:`próximos ${neg.days} dias`,categories:[],dataUsed:["saldo","receitas","contas","parcelas","assinaturas"]},
        score:85,
      });
    }
    if(committedIncome!==null&&committedIncome>=90){
      out.push({
        category:"atencao",priority:"alta",
        title:"Renda quase toda comprometida",
        heroNumber:{value:committedIncome,format:"percent",sign:"none"},
        comparison:{aLabel:"Renda",aValue:100,bLabel:"Comprometido",bValue:committedIncome},
        explanation:`Suas despesas somam ${fmt(totalOut)} contra ${fmt(totalIn)} de receitas — ${committedIncome}% da sua renda já está comprometida.`,
        reason:"O total de despesas já se aproxima do total de receitas do período.",
        recommendation:`Eu evitaria assumir novos compromissos fixos até esse número cair.`,
        confidence:"alta",
        breakdown:{
          calcRows:[
            {label:"Receitas do período",value:fmt(totalIn)},
            {label:"Despesas do período",value:fmt(totalOut)},
            {label:"Percentual comprometido",value:`${committedIncome}%`,highlight:true,color:"#EF4444"},
          ],
        },
        evidence:{period:monthLabel,categories:[],dataUsed:["receitas","previstos"]},
        score:75,
      });
    }else if(committedIncome!==null&&committedIncome>=75){
      out.push({
        category:"atencao",priority:"media",
        title:"Renda com pouca folga",
        heroNumber:{value:committedIncome,format:"percent",sign:"none"},
        comparison:{aLabel:"Renda",aValue:100,bLabel:"Comprometido",bValue:committedIncome},
        explanation:`Suas despesas já somam ${committedIncome}% das suas receitas neste período.`,
        reason:"Ainda há folga, mas o espaço está diminuindo.",
        recommendation:`Vale ficar de olho para não passar do ponto nos próximos gastos.`,
        confidence:"alta",
        breakdown:{
          calcRows:[
            {label:"Receitas do período",value:fmt(totalIn)},
            {label:"Despesas do período",value:fmt(totalOut)},
            {label:"Percentual comprometido",value:`${committedIncome}%`,highlight:true,color:"#F0A857"},
          ],
        },
        evidence:{period:monthLabel,categories:[],dataUsed:["receitas","previstos"]},
        score:50,
      });
    }
    const dayOfMonth=parseInt(todayISO.split("-")[2],10);
    const daysInMonth=new Date(parseInt(todayISO.slice(0,4)),parseInt(todayISO.slice(5,7)),0).getDate();
    if(daysInMonth-dayOfMonth>=5){
      const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
      const prevMk=MONTH_ORDER[currentIdx-1];
      Object.entries(catMonthly).forEach(([cat,monthly])=>{
        const cur=monthly[currentMonthKey]||0;
        const prev=prevMk?(monthly[prevMk]||0):0;
        if(prev>=100&&cur>prev*1.1){
          const topTx=topTxForCategory(transactions,cat,currentMonthKey);
          out.push({
            category:"atencao",priority:"media",
            title:`${cat} já passou o mês inteiro anterior`,
            heroNumber:{value:cur-prev,format:"currency",sign:"+"},
            comparison:{aLabel:"Mês passado",aValue:prev,bLabel:"Este mês",bValue:cur},
            explanation:`Ainda faltam ${daysInMonth-dayOfMonth} dias para o fim do mês e você já superou o total gasto em ${cat} no mês passado (${fmt(prev)}).`,
            reason:"O ritmo de gastos nessa categoria acelerou em relação ao mês anterior.",
            recommendation:`Vale rever os próximos gastos previstos em ${cat}.`,
            confidence:"alta",
            breakdown:{
              lineItems:topTx,
              calcRows:[
                {label:"Mês passado (fechado)",value:fmt(prev)},
                {label:"Este mês (em andamento)",value:fmt(cur),highlight:true,color:"#EF4444"},
              ],
            },
            evidence:{period:monthLabel,categories:[cat],dataUsed:["categorias","transacoes","periodo"]},
            score:45,
          });
        }
      });
    }
    return out.sort((a,b)=>b.score-a.score).slice(0,4);
  };

  // ---- Oportunidades ----
  const genOpportunities=ctx=>{
    const{cashFlowProjections,reservaMeses,reservaFinanceira,avgMonthlyOut,enhancedWishes,avgMonthlySavings,currentMonthKey,transactions,summary,plannedExpenses,balance,todayISO}=ctx;
    const out=[];
    const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
    const proj30=cashFlowProjections.find(p=>p.days===30);
    const investedThisMonth=transactions.some(t=>t.cat==="Investimento"&&(t.invTipo==="Aporte"||(!t.invTipo&&t.type==="Saída"))&&monthKey(t.date)===currentMonthKey);
    if(proj30&&proj30.value>0&&!investedThisMonth){
      const detailed=FinancialEngine.CashFlowAnalyzer.projectionAtDetailed({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead:30});
      const commitItems=[
        ...detailed.outItems.map(i=>({label:i.label,value:i.value,tag:i.kind==="parcela"?"Parcela":i.kind==="conta"?"Conta":"Despesa"})),
        ...detailed.plannedItems.map(i=>({label:i.label,value:i.value,tag:i.recurring?"Assinatura":"Conta prevista"})),
      ].sort((a,b)=>b.value-a.value);
      out.push({
        category:"oportunidade",priority:"media",
        title:"Você pode investir este mês",
        heroNumber:{value:proj30.value,format:"currency",sign:"+"},
        explanation:`Ainda não há nenhum aporte registrado neste mês, e mesmo considerando seus compromissos futuros, sua projeção de 30 dias está positiva em ${fmt(proj30.value)}.`,
        reason:commitItems.length>0?`Esse valor já desconta compromissos como ${commitItems[0].label}.`:"Esse valor está disponível sem comprometer os próximos 30 dias.",
        recommendation:`Considere fazer um aporte antes do fim do mês.`,
        confidence:"alta",
        breakdown:{
          lineItems:commitItems,
          calcRows:[
            {label:"Saldo atual",value:fmt(balance)},
            {label:"Projeção em 30 dias",value:fmt(proj30.value),highlight:true,color:"#22C55E"},
          ],
        },
        evidence:{period:"próximos 30 dias",categories:["Investimento"],dataUsed:["saldo","receitas","contas","parcelas","assinaturas","investimentos"]},
        score:60,
      });
    }
    if(reservaMeses!==null&&reservaMeses>=6){
      const goalItems=(enhancedWishes||[]).filter(w=>w.saved>0).map(w=>({label:w.name,value:w.saved,tag:"Meta"})).sort((a,b)=>b.value-a.value);
      out.push({
        category:"conquista",priority:"baixa",
        title:"Reserva financeira sólida",
        heroNumber:{value:reservaMeses,format:"plain",suffix:"x",sign:"none"},
        comparison:{aLabel:"Ideal mínimo",aValue:6,bLabel:"Sua reserva",bValue:reservaMeses},
        explanation:`Você tem ${fmt(reservaFinanceira)} guardados, o suficiente para cobrir ${reservaMeses}x seu gasto médio mensal de ${fmt(avgMonthlyOut||0)}.`,
        reason:"Isso está numa posição bastante confortável frente ao seu padrão de gastos.",
        recommendation:`Você pode arriscar um pouco mais nos investimentos ou acelerar outras metas.`,
        confidence:"alta",
        breakdown:{
          lineItems:goalItems,
          calcRows:[
            {label:"Total guardado em metas",value:fmt(reservaFinanceira)},
            {label:"Gasto médio mensal",value:fmt(avgMonthlyOut||0)},
            {label:"Meses de cobertura",value:`${reservaMeses}x`,highlight:true,color:"#22C55E"},
          ],
        },
        evidence:{period:"histórico de metas",categories:[],dataUsed:["metas","media"]},
        score:35,
      });
    }
    if(avgMonthlySavings&&avgMonthlySavings>0){
      const candidate=[...enhancedWishes].filter(w=>w.remaining>0).sort((a,b)=>(a.priority==="Alta"?0:1)-(b.priority==="Alta"?0:1)||b.pct-a.pct)[0];
      if(candidate){
        const suggestedExtra=Math.max(50,Math.round((avgMonthlySavings*0.15)/50)*50);
        const sim=FinancialEngine.SimulationEngine.economizarMais({extraPerMonth:suggestedExtra,remaining:candidate.remaining,currentMonthly:avgMonthlySavings,estMonths:candidate.estMonths});
        if(sim&&sim.monthsSaved&&sim.monthsSaved>0){
          const savBreak=FinancialEngine.GoalAnalyzer.avgMonthlySavingsBreakdown(summary);
          out.push({
            category:"oportunidade",priority:"media",
            title:`Meta "${candidate.name}" pode ser antecipada`,
            heroNumber:{value:sim.monthsSaved,format:"plain",suffix:` ${sim.monthsSaved===1?"mês":"meses"}`,sign:"-"},
            explanation:`Guardando ${fmt(suggestedExtra)} a mais por mês, você chega em "${candidate.name}" bem antes do previsto.`,
            reason:`Sua média de economia nos últimos meses foi de ${fmt(avgMonthlySavings)}.`,
            recommendation:`Vale reservar esse valor extra assim que possível.`,
            confidence:"media",
            breakdown:{
              lineItems:(savBreak.months||[]).map(m=>({label:m.month,value:m.balance,tag:"economizado"})),
              calcRows:[
                {label:"Sua economia média mensal",value:fmt(avgMonthlySavings)},
                {label:"Valor extra sugerido",value:fmt(suggestedExtra)},
                {label:"Meses ganhos",value:`${sim.monthsSaved}`,highlight:true,color:"#22C55E"},
              ],
            },
            evidence:{period:"projeção baseada nos últimos meses",categories:[],dataUsed:["metas","media"]},
            score:55,
          });
        }
      }
    }
    const closed=summary.filter(m=>MONTH_ORDER.indexOf(m.month)<currentIdx).slice(-4);
    if(closed.length>=3){
      const incomes=closed.map(m=>m.in);
      const outs=closed.map(m=>m.out);
      const incomeGrew=incomes[incomes.length-1]>incomes[0]*1.1;
      const avgOut=outs.reduce((a,b)=>a+b,0)/outs.length||1;
      const outStable=stdev(outs)/avgOut<0.15;
      if(incomeGrew&&outStable){
        const growthPct=Math.round(((incomes[incomes.length-1]-incomes[0])/incomes[0])*100);
        out.push({
          category:"oportunidade",priority:"baixa",
          title:"Boa hora para investir mais",
          heroNumber:{value:growthPct,format:"percent",sign:"+"},
          explanation:`Sua renda cresceu ${growthPct}% nos últimos ${closed.length} meses (de ${fmt(incomes[0])} para ${fmt(incomes[incomes.length-1])}) e seus gastos seguem estáveis.`,
          reason:"Crescimento de renda sem aumento proporcional de despesas.",
          recommendation:`Aproveite para aumentar sua reserva ou seus aportes.`,
          confidence:"media",
          breakdown:{
            lineItems:closed.map(m=>({label:m.month,value:m.in,tag:"receita"})),
            calcRows:[
              {label:`Receita em ${closed[0].month}`,value:fmt(incomes[0])},
              {label:`Receita em ${closed[closed.length-1].month}`,value:fmt(incomes[incomes.length-1]),highlight:true,color:"#22C55E"},
            ],
          },
          evidence:{period:`últimos ${closed.length} meses`,categories:[],dataUsed:["receitas","periodo"]},
          score:40,
        });
      }
    }
    return out;
  };

  const genGoalInsights=ctx=>{
    const{enhancedWishes}=ctx;
    return enhancedWishes.filter(w=>w.monthsTarget>0&&w.estMonths!==null&&w.estMonths>w.monthsTarget+1).slice(0,2)
      .map(w=>{
        const gapMonths=w.estMonths-w.monthsTarget;
        return{
          category:"atencao",priority:"media",
          title:`Meta "${w.name}" pode atrasar`,
          heroNumber:{value:gapMonths,format:"plain",suffix:` ${gapMonths===1?"mês":"meses"}`,sign:"+"},
          explanation:`No ritmo atual de economia, "${w.name}" deve levar cerca de ${w.estMonths} meses — ${gapMonths} a mais que o prazo de ${w.monthsTarget} meses que você definiu.`,
          reason:"Sua economia mensal recente está abaixo do necessário para cumprir o prazo definido.",
          recommendation:`Aumente o valor guardado por mês para essa meta, ou revise o prazo.`,
          confidence:"media",
          breakdown:{
            calcRows:[
              {label:"Valor restante",value:fmt(w.remaining)},
              {label:"Prazo definido",value:`${w.monthsTarget} meses`},
              {label:"Estimativa no ritmo atual",value:`${w.estMonths} meses`,highlight:true,color:"#F0A857"},
            ],
          },
          evidence:{period:"projeção baseada nos últimos meses",categories:[],dataUsed:["metas","media"]},
          score:50,
        };
      });
  };

  const genInvestmentInsights=ctx=>{
    const{transactions,currentMonthKey,investmentParticipacao,invNet,patrimonio}=ctx;
    const out=[];
    const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
    const aporteByMonth={};
    transactions.forEach(t=>{
      if(t.cat==="Investimento"&&(t.invTipo==="Aporte"||(!t.invTipo&&t.type==="Saída"))){
        const mk=monthKey(t.date);
        aporteByMonth[mk]=(aporteByMonth[mk]||0)+t.val;
      }
    });
    let streak=0;
    for(let i=currentIdx;i>=0;i--){if(aporteByMonth[MONTH_ORDER[i]]){streak++;}else break;}
    if(streak>=3){
      const streakMonths=[];
      for(let i=currentIdx;i>currentIdx-streak;i--)streakMonths.push({label:MONTH_ORDER[i],value:aporteByMonth[MONTH_ORDER[i]]||0,tag:"aporte"});
      out.push({
        category:"mudanca",priority:"baixa",
        title:"Hábito de investir consolidado",
        heroNumber:{value:streak,format:"plain",suffix:` ${streak===1?"mês":"meses"}`,sign:"none"},
        explanation:`Você vem fazendo aportes em investimentos por ${streak} meses seguidos — isso já faz parte do seu perfil financeiro.`,
        reason:"Aportes registrados em todos os meses recentes, sem interrupção.",
        recommendation:`Continue nesse ritmo — é uma das bases mais fortes para o longo prazo.`,
        confidence:streak>=6?"alta":"media",
        breakdown:{lineItems:streakMonths},
        evidence:{period:`últimos ${streak} meses`,categories:["Investimento"],dataUsed:["investimentos","transacoes","periodo"]},
        score:45,
      });
    }
    if(investmentParticipacao!==null&&investmentParticipacao>=30){
      out.push({
        category:"conquista",priority:"baixa",
        title:"Investimentos ganhando peso no patrimônio",
        heroNumber:{value:investmentParticipacao,format:"percent",sign:"none"},
        explanation:`Seus investimentos (${fmt(invNet||0)}) já representam ${investmentParticipacao}% do seu patrimônio líquido de ${fmt(patrimonio||0)}.`,
        reason:"Boa parte do seu patrimônio já vem de investimentos, não apenas de saldo em conta.",
        recommendation:`Uma base sólida para seguir construindo seu futuro financeiro.`,
        confidence:"alta",
        breakdown:{
          calcRows:[
            {label:"Valor líquido investido",value:fmt(invNet||0)},
            {label:"Patrimônio líquido total",value:fmt(patrimonio||0)},
            {label:"Participação",value:`${investmentParticipacao}%`,highlight:true,color:"#3B82F6"},
          ],
        },
        evidence:{period:"posição atual",categories:["Investimento"],dataUsed:["investimentos","saldo"]},
        score:30,
      });
    }
    return out;
  };

  const genCashFlowAndNetWorth=ctx=>{
    const{summary,currentMonthKey,patrimonio}=ctx;
    const out=[];
    const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
    const curEntry=summary.find(m=>m.month===currentMonthKey);
    const closed=summary.filter(m=>MONTH_ORDER.indexOf(m.month)<currentIdx).slice(-4);
    if(closed.length>=3){
      const balances=closed.map(m=>m.balance);
      const rising=balances.every((v,i)=>i===0||v>=balances[i-1]-0.01);
      const falling=balances.every((v,i)=>i===0||v<=balances[i-1]+0.01);
      const firstLabel=monthNameMap[(closed[0].month||"").split("/")[0]]||closed[0].month;
      const lastLabel=monthNameMap[(closed[closed.length-1].month||"").split("/")[0]]||closed[closed.length-1].month;
      const monthItems=closed.map(m=>({label:m.month,value:m.balance,tag:"saldo"}));
      if(rising&&balances[balances.length-1]>balances[0]){
        out.push({
          category:"conquista",priority:"media",
          title:"Saldo mensal em trajetória de alta",
          heroNumber:{value:balances[balances.length-1]-balances[0],format:"currency",sign:"+"},
          comparison:{aLabel:firstLabel,aValue:balances[0],bLabel:lastLabel,bValue:balances[balances.length-1]},
          explanation:`Seu saldo mensal vem melhorando de forma consistente nos últimos ${closed.length} meses, de ${fmt(balances[0])} para ${fmt(balances[balances.length-1])}.`,
          reason:"Cada mês fechou igual ou melhor que o anterior nesse período.",
          recommendation:`Continuar nesse ritmo fortalece sua reserva e suas metas.`,
          confidence:closed.length>=4?"alta":"media",
          breakdown:{lineItems:monthItems},
          evidence:{period:`últimos ${closed.length} meses`,categories:[],dataUsed:["saldo","periodo"]},
          score:35,
        });
      }else if(falling&&balances[balances.length-1]<balances[0]){
        out.push({
          category:"atencao",priority:"alta",
          title:"Saldo mensal em queda",
          heroNumber:{value:balances[balances.length-1]-balances[0],format:"currency",sign:"-"},
          comparison:{aLabel:firstLabel,aValue:balances[0],bLabel:lastLabel,bValue:balances[balances.length-1]},
          explanation:`Seu saldo mensal vem piorando de forma consistente nos últimos ${closed.length} meses, de ${fmt(balances[0])} para ${fmt(balances[balances.length-1])}.`,
          reason:"Cada mês fechou igual ou pior que o anterior nesse período.",
          recommendation:`Vale entender o que mudou nas suas receitas ou despesas recentes.`,
          confidence:closed.length>=4?"alta":"media",
          breakdown:{lineItems:monthItems},
          evidence:{period:`últimos ${closed.length} meses`,categories:[],dataUsed:["saldo","periodo"]},
          score:45,
        });
      }
    }
    if(curEntry&&closed.length>=2){
      const bestPrev=Math.max(...closed.map(m=>m.balance));
      if(curEntry.balance>0&&curEntry.balance>bestPrev){
        out.push({
          category:"conquista",priority:"alta",
          title:"Novo recorde de saldo mensal! 🎉",
          heroNumber:{value:patrimonio,format:"currency",sign:"+"},
          explanation:`Este mês seu saldo fechou em ${fmt(curEntry.balance)} — o melhor resultado dos últimos ${closed.length+1} meses (recorde anterior: ${fmt(bestPrev)}).`,
          reason:"Nenhum dos meses recentes teve um saldo tão bom quanto este.",
          recommendation:`Aproveite o embalo para reforçar sua reserva ou uma meta importante.`,
          confidence:closed.length>=4?"alta":"media",
          breakdown:{
            lineItems:[...closed.map(m=>({label:m.month,value:m.balance,tag:"anterior"})),{label:currentMonthKey,value:curEntry.balance,tag:"atual"}],
            calcRows:[
              {label:"Melhor saldo anterior",value:fmt(bestPrev)},
              {label:"Saldo deste mês",value:fmt(curEntry.balance),highlight:true,color:"#22C55E"},
            ],
          },
          evidence:{period:`últimos ${closed.length+1} meses`,categories:[],dataUsed:["saldo","periodo"]},
          score:65,
        });
      }
    }
    return out;
  };

  // ---- Orquestração: gera, pontua, remove ruído e ordena por prioridade real ----
  // No máximo 3 cards; um 4º só entra se o item nº1 for verdadeiramente crítico
  // (prioridade alta + pontuação alta) — nunca vira uma lista infinita.
  const generate=ctx=>{
    const currentMonthKey=ctx.currentMonthKey;
    const descMemory=buildDescMemory(ctx.transactions,currentMonthKey);
    const catLifecycle=buildCategoryLifecycle(ctx.transactions,currentMonthKey);
    const catMonthly=monthlyCategoryTotals(ctx.transactions);
    const fullCtx={...ctx,descMemory,catLifecycle,catMonthly};

    let all=[
      ...genRiskAlerts(fullCtx),
      ...genTrends(fullCtx),
      ...genBehaviorChanges(fullCtx),
      ...genOpportunities(fullCtx),
      ...genGoalInsights(fullCtx),
      ...genInvestmentInsights(fullCtx),
      ...genCashFlowAndNetWorth(fullCtx),
    ];

    all=all.filter(it=>it.score>=20);
    const seen=new Set();
    all=all.filter(it=>{if(seen.has(it.title))return false;seen.add(it.title);return true;});

    all.sort((a,b)=>{
      const pr=(PRIORITY_RANK[b.priority]||0)-(PRIORITY_RANK[a.priority]||0);
      if(pr!==0)return pr;
      return b.score-a.score;
    });

    const hasSomethingCritical=all.length>0&&all[0].priority==="alta"&&all[0].score>=75;
    const limit=hasSomethingCritical?4:3;

    return all.slice(0,limit).map((it,i)=>{
      const meta=CAT_META[it.category]||CAT_META.mudanca;
      return{
        key:`insight-${i}`,
        category:it.category,
        categoryLabel:meta.label,
        categoryEmoji:meta.emoji,
        categoryColor:meta.color,
        priority:it.priority,
        title:it.title,
        heroNumber:it.heroNumber||{value:0,format:"plain",suffix:"",sign:"none"},
        comparison:it.comparison||null,
        explanation:it.explanation,
        reason:it.reason||"",
        recommendation:it.recommendation,
        confidence:it.confidence||"media",
        breakdown:it.breakdown||null,
        evidence:it.evidence||{period:"",categories:[],dataUsed:[]},
      };
    });
  };

  // ---- Resumo do mês: estatísticas de destaque + narrativa curta (máx. 2 frases) ----
  const generateSummary=ctx=>{
    const{transactions,currentMonthKey,summary,enhancedWishes,plannedStats,patrimonio}=ctx;
    const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
    const curEntry=summary.find(m=>m.month===currentMonthKey);
    if(!curEntry)return null;
    const descMemory=buildDescMemory(transactions,currentMonthKey);
    const monthName=monthNameMap[currentMonthKey.split("/")[0]]||currentMonthKey;

    const closed=summary.filter(m=>MONTH_ORDER.indexOf(m.month)<currentIdx).slice(-6);
    const histAvgBalance=closed.length?closed.reduce((s,m)=>s+m.balance,0)/closed.length:null;
    const bestPrev=closed.length?Math.max(...closed.map(m=>m.balance)):null;

    let sentence1=`${monthName} foi um mês ${curEntry.balance>=0?"positivo":"mais apertado"}.`;
    let sentence2=null;
    if(bestPrev!==null&&curEntry.balance>0&&curEntry.balance>bestPrev){
      sentence2="Seu patrimônio atingiu um novo recorde neste mês.";
    }else if(histAvgBalance!==null&&curEntry.balance>histAvgBalance){
      sentence2="Você economizou mais do que sua média histórica recente.";
    }else if(histAvgBalance!==null&&curEntry.balance<histAvgBalance*0.7){
      sentence2="Você economizou menos do que costuma economizar em média.";
    }else{
      const habitChange=descMemory.find(m=>m.isHabitLike&&m.status==="inativo");
      if(habitChange)sentence2=`Percebemos um novo hábito financeiro: os gastos com ${habitChange.desc} pararam.`;
    }
    if(!sentence2&&plannedStats&&plannedStats.total>0){
      const usedPct=Math.round((plannedStats.paid/plannedStats.total)*100);
      sentence2=usedPct<100?"Você permaneceu dentro do orçamento previsto para o mês.":"Você ultrapassou o orçamento previsto para o mês.";
    }
    if(!sentence2)sentence2="Continue acompanhando de perto para manter o ritmo.";

    const bestGoal=[...enhancedWishes].filter(w=>w.remaining>0).sort((a,b)=>b.pct-a.pct)[0];

    return{
      text:`${sentence1} ${sentence2}`,
      stats:{
        economia:curEntry.balance,
        patrimonio:patrimonio,
        meta:bestGoal?{name:bestGoal.name,pct:bestGoal.pct}:null,
      },
    };
  };

  return{generate,generateSummary};
})();

const todayFn=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
// Limites razoáveis para os seletores de data (evita "1900" ou "2999" digitados
// sem querer, que distorciam gráficos e projeções sem nenhum aviso). Calculado
// a partir de hoje, não hardcoded — não fica velho como o MONTH_ORDER estava.
const DATE_MIN=(()=>{const d=new Date();d.setFullYear(d.getFullYear()-10);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})();
const DATE_MAX=(()=>{const d=new Date();d.setFullYear(d.getFullYear()+10);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})();

const BG="#071421";const CARD="#11253A";const C2="#17314D";const BD="rgba(255,255,255,0.08)";const BD2="rgba(255,255,255,0.14)";
const TX="#F8FAFC";const TX2="#A7B6C7";const TX3="rgba(167,182,199,0.68)";const HDR="#0B1B2B";
const TEAL="#3B82F6";const TEAL2="#2563EB";
const HOVER="#1E3A5F";

const R_CARD=24;const R_BTN=14;const R_INPUT=14;const R_CHIP=10;
const SH_SM="0 1px 3px rgba(2,8,16,0.4)";
const SH_MD="0 20px 48px -16px rgba(2,8,16,0.55)";
const SH_LG="0 32px 80px -20px rgba(2,8,16,0.68)";

const SI={background:"rgba(255,255,255,0.03)",border:`1px solid ${BD2}`,borderRadius:R_INPUT,padding:"12px 15px",color:TX,fontSize:13.5,width:"100%",boxSizing:"border-box"};

const cardStyle={background:CARD,border:`1px solid ${BD}`,borderRadius:R_CARD,padding:28,boxShadow:SH_SM};
const Card=(props)=><div {...props} className={`fc-card ${props.className||""}`} style={{...cardStyle,...props.style}}/>;

// ==================== Modal reutilizável ====================
// Antes, cada popup (excluir, transferir, editar lançamento, busca, perfil,
// dia do calendário...) repetia manualmente o mesmo par de <div> (overlay
// fixo + card central) com pequenas variações de zIndex/largura/alinhamento.
// Esse componente concentra esse padrão num único lugar: menos código
// duplicado e qualquer ajuste visual futuro (ex.: mudar a animação do
// overlay) passa a valer para todos os popups de uma vez.
const Modal=({onClose,children,maxWidth=420,align="center",zIndex=170,padding=28,scroll=true,contentStyle})=>(
  <div
    style={{position:"fixed",inset:0,background:"rgba(2,7,14,0.78)",zIndex,display:"flex",alignItems:align==="top"?"flex-start":"center",justifyContent:"center",padding:align==="top"?"10vh 20px 20px":20,animation:"overlayIn .15s ease-out"}}
    onClick={onClose}
  >
    <div
      onClick={e=>e.stopPropagation()}
      style={{background:CARD,border:`1px solid ${BD2}`,borderRadius:R_CARD,padding,width:"100%",maxWidth,...(scroll?{maxHeight:"85vh",overflowY:"auto"}:{}),boxShadow:SH_LG,animation:"modalIn .25s cubic-bezier(.2,.8,.2,1)",...contentStyle}}
    >
      {children}
    </div>
  </div>
);

function CategoryIcon({cat,size=14,color,catIconMap}){
  const Icon=(catIconMap&&catIconMap[cat])||CAT_ICON_COMPONENTS[cat]||Tag;
  return <Icon size={size} color={color} strokeWidth={2.2}/>;
}

function AnimatedValue({value}){
  const [display,setDisplay]=useState(value);
  const prevRef=useRef(value);
  useEffect(()=>{
    const start=prevRef.current;
    const end=value;
    if(start===end){setDisplay(end);return;}
    const startTime=performance.now();
    const duration=600;
    let raf;
    const step=now=>{
      const t=Math.min(1,(now-startTime)/duration);
      const eased=1-Math.pow(1-t,3);
      setDisplay(start+(end-start)*eased);
      if(t<1)raf=requestAnimationFrame(step);
      else{prevRef.current=end;setDisplay(end);}
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[value]);
  return <span style={{fontVariantNumeric:"tabular-nums"}}>{fmt(display)}</span>;
}

function ChartTooltip({active,payload,label}){
  if(!active||!payload||!payload.length)return null;
  return(
    <div style={{background:"rgba(11,27,43,0.96)",backdropFilter:"blur(12px)",borderRadius:14,padding:"13px 17px",boxShadow:SH_MD,border:`1px solid ${BD2}`}}>
      {label&&<div style={{fontSize:11,color:TX2,marginBottom:6,fontWeight:600,letterSpacing:"0.02em"}}>{label}</div>}
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:TX,fontWeight:600,marginTop:i>0?4:0}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:p.color||p.fill,flexShrink:0}}/>
          <span style={{color:TX2,fontWeight:500}}>{p.name}:</span> {fmt(p.value)}
        </div>
      ))}
    </div>
  );
}

// Renderiza texto com URLs detectadas automaticamente como links clicáveis.
// Usado nas notas de Desejos e Previstos. Campo salvo é texto puro (string);
// esta função é o único lugar que precisa mudar quando Markdown for suportado.
function LinkifiedText({text,color}){
  if(!text)return null;
  const parts=text.split(URL_SPLIT_REGEX);
  return(
    <span style={{whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
      {parts.map((part,i)=>{
        if(part&&URL_TEST_REGEX.test(part)){
          const href=part.startsWith("http")?part:`https://${part}`;
          return <a key={i} href={href} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:color||"#5EA1FF",textDecoration:"underline",wordBreak:"break-all"}}>{part}</a>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ---- Razão contábil: mini "linha de raciocínio" que expõe os números por
// trás de uma conclusão (ex.: Saldo atual → + Receitas → − Compromissos →
// Projeção). Usado tanto nos cartões de insight quanto nas decisões. ----
function LedgerRows({rows}){
  if(!rows||rows.length===0)return null;
  return(
    <div>
      {rows.map((r,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 0",borderTop:i>0?`1px solid ${BD}`:"none"}}>
          <span style={{fontSize:12,color:r.highlight?TX:TX2,fontWeight:r.highlight?700:500}}>{r.label}</span>
          <span style={{fontSize:r.highlight?14.5:12.5,fontWeight:r.highlight?800:700,color:r.color||(r.highlight?TX:TX2),whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums"}}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Itens reais que compõem uma conclusão (transações, contas previstas,
// metas, parcelas...) — o "quais dados foram utilizados", com números de
// verdade em vez de frases genéricas. ----
function LineItemsList({items,accentColor=TEAL,limit=5}){
  if(!items||items.length===0)return null;
  const shown=items.slice(0,limit);
  const restCount=items.length-shown.length;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:7}}>
      {shown.map((it,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,color:TX2,display:"flex",alignItems:"center",gap:7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:accentColor,flexShrink:0}}/>
            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.label}</span>
            {it.tag&&<span style={{fontSize:10,color:TX3,flexShrink:0}}>· {it.tag}</span>}
          </span>
          <span style={{fontSize:12.5,color:TX,fontWeight:700,flexShrink:0,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{typeof it.value==="number"?fmt(it.value):it.value}</span>
        </div>
      ))}
      {restCount>0&&<div style={{fontSize:11,color:TX3,paddingLeft:12}}>+{restCount} outro{restCount>1?"s":""} {restCount>1?"itens":"item"}</div>}
    </div>
  );
}

// ---- Checklist de transparência: quais dados reais entraram nessa conclusão.
// Qualquer pessoa deve conseguir auditar o raciocínio olhando esses chips. ----
const DATA_TAG_LABELS={
  saldo:"Saldo atual",receitas:"Receitas futuras",contas:"Contas previstas",parcelas:"Parcelas futuras",
  assinaturas:"Assinaturas",previstos:"Gastos previstos do mês",media:"Média histórica utilizada",
  categorias:"Categorias analisadas",periodo:"Período considerado",transacoes:"Transações individuais",
  metas:"Metas e reservas",investimentos:"Investimentos",
};
function DataUsedChecklist({tags}){
  if(!tags||tags.length===0)return null;
  return(
    <div>
      <div style={{fontSize:10,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:9}}>Dados usados nessa conclusão</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
        {tags.map(t=>(
          <span key={t} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:TX2,background:"rgba(255,255,255,0.04)",border:`1px solid ${BD}`,borderRadius:20,padding:"5px 11px",fontWeight:600}}>
            <Check size={10} color="#22C55E"/>{DATA_TAG_LABELS[t]||t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Número-herói animado: conta de 0 até o valor, dominando visualmente o card ----
function HeroNumberAnimated({heroNumber,color}){
  const{value=0,format="plain",suffix="",sign="none"}=heroNumber||{};
  const [display,setDisplay]=useState(0);
  useEffect(()=>{
    const end=value;
    const startTime=performance.now();
    const duration=750;
    let raf;
    const step=now=>{
      const t=Math.min(1,(now-startTime)/duration);
      const eased=1-Math.pow(1-t,3);
      setDisplay(end*eased);
      if(t<1)raf=requestAnimationFrame(step);
      else setDisplay(end);
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[value]);
  let formatted;
  if(format==="currency")formatted=fmt(Math.abs(display));
  else if(format==="percent")formatted=`${Math.round(display)}%`;
  else formatted=`${Math.round(display)}${suffix||""}`;
  const prefix=sign==="+"?"+":sign==="-"?"-":"";
  return <span style={{fontSize:32,fontWeight:800,color,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums",lineHeight:1}}>{prefix}{formatted}</span>;
}

// ---- Comparação visual: duas barras (média vs. mês atual, etc.) em vez de texto ----
function ComparisonBar({aLabel,aValue,bLabel,bValue,color}){
  const max=Math.max(Math.abs(aValue),Math.abs(bValue),1);
  const aPct=Math.min(100,Math.round((Math.abs(aValue)/max)*100));
  const bPct=Math.min(100,Math.round((Math.abs(bValue)/max)*100));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:7,margin:"14px 0"}}>
      <div style={{display:"flex",alignItems:"center",gap:9}}>
        <span style={{fontSize:10.5,color:TX3,width:76,flexShrink:0,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{aLabel}</span>
        <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:7,height:8,overflow:"hidden"}}><div style={{width:`${aPct}%`,height:"100%",background:TX3,borderRadius:7,transition:"width .6s cubic-bezier(.2,.8,.2,1)"}}/></div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:9}}>
        <span style={{fontSize:10.5,color:TX,width:76,flexShrink:0,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bLabel}</span>
        <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:7,height:8,overflow:"hidden"}}><div style={{width:`${bPct}%`,height:"100%",background:color,borderRadius:7,transition:"width .6s cubic-bezier(.2,.8,.2,1)"}}/></div>
      </div>
    </div>
  );
}

const CONFIDENCE_LABEL={alta:"Alta confiança",media:"Média confiança",nova:"Nova tendência"};
const DECISION_STATUS_COLOR={ok:"#22C55E",atencao:"#F0A857",critico:"#EF4444",neutro:TX3};

// ---- Cartão de consultor financeiro ------------------------------------
// Título → número-herói → comparação visual → o que aconteceu (explanation)
// → por que aconteceu (reason) → "principais responsáveis" (transações reais,
// visível sem precisar abrir nada) → recomendação → "Como cheguei a essa
// conclusão" (expansível: cálculo linha a linha + checklist de dados usados).
function InsightCard({item,index=0}){
  const [expanded,setExpanded]=useState(false);
  const bd=item.breakdown||{};
  const lineItems=bd.lineItems||[];
  const calcRows=bd.calcRows||[];
  return(
    <div className="fc-card insight-card-anim" style={{...cardStyle,padding:24,borderTop:`3px solid ${item.categoryColor}`,animationDelay:`${index*80}ms`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:8}}>
        <span style={{fontSize:10.5,fontWeight:700,color:item.categoryColor,display:"flex",alignItems:"center",gap:5,letterSpacing:"0.03em",textTransform:"uppercase"}}>{item.categoryEmoji} {item.categoryLabel}</span>
        <span style={{fontSize:10,color:TX3,fontWeight:600,whiteSpace:"nowrap"}}>{CONFIDENCE_LABEL[item.confidence]||""}</span>
      </div>
      <div style={{fontSize:14.5,fontWeight:700,color:TX,marginBottom:14,lineHeight:1.3,letterSpacing:"-0.01em"}}>{item.title}</div>
      <HeroNumberAnimated heroNumber={item.heroNumber} color={item.categoryColor}/>
      {item.comparison&&<ComparisonBar {...item.comparison} color={item.categoryColor}/>}
      <div style={{fontSize:12.5,color:TX2,lineHeight:1.55,marginTop:item.comparison?12:14}}>{item.explanation}</div>
      {item.reason&&<div style={{fontSize:11.5,color:TX3,lineHeight:1.5,marginTop:6}}>{item.reason}</div>}
      {lineItems.length>0&&(
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${BD}`}}>
          <div style={{fontSize:10,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:9}}>Principais responsáveis</div>
          <LineItemsList items={lineItems} accentColor={item.categoryColor}/>
        </div>
      )}
      {item.recommendation&&(
        <div style={{marginTop:16,padding:"12px 14px",background:`${item.categoryColor}12`,border:`1px solid ${item.categoryColor}2a`,borderRadius:14,display:"flex",alignItems:"flex-start",gap:9}}>
          <Lightbulb size={13} color={item.categoryColor} style={{flexShrink:0,marginTop:1}}/>
          <div style={{fontSize:12,color:TX,fontWeight:600,lineHeight:1.5}}>{item.recommendation}</div>
        </div>
      )}
      <button onClick={()=>setExpanded(p=>!p)} style={{marginTop:14,background:"none",border:"none",color:TX3,fontSize:11,fontWeight:600,cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:4}}>
        <Info size={11}/>Como cheguei a essa conclusão{expanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
      </button>
      {expanded&&(
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${BD}`,display:"flex",flexDirection:"column",gap:14}}>
          {calcRows.length>0&&<LedgerRows rows={calcRows}/>}
          <DataUsedChecklist tags={item.evidence?.dataUsed}/>
          <div style={{fontSize:11,color:TX3}}>Período considerado: {item.evidence?.period||"—"}{item.evidence?.categories?.length>0?` · Categorias: ${item.evidence.categories.join(", ")}`:""}</div>
        </div>
      )}
    </div>
  );
}

// ---- Uma decisão automática (orçamento / reserva / fluxo / metas), com o
// mesmo "Como cheguei a essa conclusão" expansível dos cartões de insight. ----
function DecisionRow({d}){
  const [expanded,setExpanded]=useState(false);
  const bd=d.breakdown||{};
  const calcRows=bd.calcRows||[];
  const commitItems=bd.commitItems||[];
  const paidItems=bd.paidItems||[];
  const color=DECISION_STATUS_COLOR[d.status]||TX3;
  return(
    <div style={{borderLeft:`3px solid ${color}`,paddingLeft:14}}>
      <div style={{fontSize:13,fontWeight:700,color:TX}}>{d.question}</div>
      <div style={{fontSize:13,fontWeight:700,color,marginTop:3}}>{d.answer}</div>
      {d.detail&&<div style={{fontSize:12,color:TX2,marginTop:3,lineHeight:1.5}}>{d.detail}</div>}
      <button onClick={()=>setExpanded(p=>!p)} style={{marginTop:9,background:"none",border:"none",color:TX3,fontSize:11,fontWeight:600,cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:4}}>
        <Info size={11}/>Como cheguei a essa conclusão{expanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
      </button>
      {expanded&&(
        <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:14,maxWidth:520}}>
          {calcRows.length>0&&<LedgerRows rows={calcRows}/>}
          {commitItems.length>0&&(
            <div>
              <div style={{fontSize:10,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Itens considerados</div>
              <LineItemsList items={commitItems} accentColor={color}/>
            </div>
          )}
          {paidItems.length>0&&(
            <div>
              <div style={{fontSize:10,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Já pagos este mês</div>
              <LineItemsList items={paidItems} accentColor="#22C55E"/>
            </div>
          )}
          <DataUsedChecklist tags={d.evidence?.dataUsed}/>
        </div>
      )}
    </div>
  );
}


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
  const [confirmDelete,setConfirmDelete]=useState(null);
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
        cancelEditTx();
      }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[]);

  // ==================== HOOKS: leitura via Financial Intelligence Engine ====================
  const months=useMemo(()=>{const s=new Set(transactions.map(t=>monthKey(t.date)));return[...s].sort((a,b)=>MONTH_ORDER.indexOf(a)-MONTH_ORDER.indexOf(b));},[transactions]);
  const filtered=useMemo(()=>{let tx=filterMonth?transactions.filter(t=>monthKey(t.date)===filterMonth):transactions;if(filterCat)tx=tx.filter(t=>t.cat===filterCat);if(filterType)tx=tx.filter(t=>t.type===filterType);if(search.trim())tx=tx.filter(t=>t.desc.toLowerCase().includes(search.toLowerCase()));return tx;},[transactions,filterMonth,filterCat,filterType,search]);

  const invNet=useMemo(()=>FinancialEngine.CashFlowAnalyzer.investmentNet(filtered),[filtered]);
  const {totalIn,totalOut,balance}=useMemo(()=>FinancialEngine.CashFlowAnalyzer.totals(filtered),[filtered]);
  const summary=useMemo(()=>FinancialEngine.CashFlowAnalyzer.monthlySummary(transactions),[transactions]);
  const catData=useMemo(()=>FinancialEngine.ExpenseAnalyzer.byCategory(filtered,invNet),[filtered,invNet]);
  const catDataDisplay=useMemo(()=>FinancialEngine.ExpenseAnalyzer.displayTop(catData),[catData]);
  const topCat=useMemo(()=>catData[0]||null,[catData]);
  const groupedByDate=useMemo(()=>{const g={};[...filtered].forEach(t=>{if(!g[t.date])g[t.date]=[];g[t.date].push(t);});return Object.entries(g).sort((a,b)=>b[0].localeCompare(a[0]));},[filtered]);
  const txMap=useMemo(()=>new Map(transactions.map(t=>[t.id,t])),[transactions]);
  const instStats=useMemo(()=>FinancialEngine.BudgetAnalyzer.installmentStats(installments,txMap,todayFn()),[installments,txMap]);
  const monthlyPreview=useMemo(()=>FinancialEngine.BudgetAnalyzer.monthlyInstallment(parseFloat(instDraft.totalVal),parseInt(instDraft.numParcelas)),[instDraft.totalVal,instDraft.numParcelas]);
  const curM=summary[summary.length-1];const prevM=summary[summary.length-2];
  const pctChange=(cur,prev)=>prev===0?0:Math.round((cur-prev)/prev*100);

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

  const categoryTrend=useMemo(()=>FinancialEngine.ExpenseAnalyzer.categoryTrend({transactions,curM,prevM}),[transactions,curM,prevM]);
  const fixedVarSplit=useMemo(()=>FinancialEngine.ExpenseAnalyzer.fixedVarSplit(filtered),[filtered]);
  const patrimonioLiquido=balance+invNet;
  const savingsRate=FinancialEngine.IncomeAnalyzer.savingsRate(balance,totalIn);
  const committedIncome=FinancialEngine.IncomeAnalyzer.committedRatio(totalIn,totalOut);
  const reservaFinanceira=useMemo(()=>wishes.reduce((s,w)=>s+(w.saved||0),0),[wishes]);
  const avgMonthlyOut=useMemo(()=>summary.length?summary.reduce((s,m)=>s+m.out,0)/summary.length:0,[summary]);
  const reservaMeses=avgMonthlyOut>0?Math.round((reservaFinanceira/avgMonthlyOut)*10)/10:null;

  const currentMonthStats=useMemo(()=>FinancialEngine.ExpenseAnalyzer.dailyAverage({transactions,currentMonthKey:currentMonthKeyReal,todayISO}),[transactions,currentMonthKeyReal,todayISO]);
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

  const insights=useMemo(()=>FinancialEngine.InsightsGenerator.generate({curM,prevM,categoryTrend,currentMonthStats,plannedStats,topCat,transactions,pendingParcelasCount,investmentStats,patrimonio:patrimonioLiquido,currentMonthKey:currentMonthKeyReal}),[curM,prevM,categoryTrend,currentMonthStats,plannedStats,topCat,transactions,pendingParcelasCount,investmentStats,patrimonioLiquido,currentMonthKeyReal]);
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
  const insightVisual=(type,critical)=>({
    gasto_menor:{Ic:TrendingDown,c:"#22C55E"},
    gasto_maior:{Ic:TrendingUp,c:"#EF4444"},
    economia_maior:{Ic:PiggyBank,c:"#22C55E"},
    renda_maior:{Ic:TrendingUp,c:"#22C55E"},
    renda_menor:{Ic:TrendingDown,c:"#EF4444"},
    categoria_cresceu:{Ic:TrendingUp,c:"#F0A857"},
    gasto_medio:{Ic:Activity,c:accent},
    orcamento_usado:{Ic:Percent,c:critical?"#EF4444":accent},
    maior_gasto:{Ic:Trophy,c:"#F0A857"},
    recorrentes:{Ic:Repeat,c:accent},
    parcelas:{Ic:CreditCard,c:accent},
    investiu_mais:{Ic:TrendingUp,c:"#22C55E"},
    patrimonio_positivo:{Ic:Landmark,c:"#22C55E"},
  }[type]||{Ic:Info,c:TX2});
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
    const plannedPending=plannedExpenses.filter(p=>p.recurring||p.month===currentMonthKeyReal).reduce((s,p)=>s+(p.paid?.[currentMonthKeyReal]?0:p.val),0);
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
      calc:"Soma de todas as receitas menos todas as despesas já lançadas até hoje (incluindo parcelas), descontando aportes e somando resgates de investimentos.",
      factors:["Transações de entrada e saída já registradas","Aportes e resgates de investimentos já lançados"],
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
    saldoPrevisto:{
      title:"Previsto no Fim do Mês",
      calc:projection?`Receitas do mês (${fmt(projection.inc)}) menos despesas já ocorridas e futuras (${fmt(projection.out)})${projection.plannedPending>0?` menos previstos pendentes (${fmt(projection.plannedPending)})`:""}.`:"Ainda não há dados suficientes neste mês.",
      factors:["Receitas já recebidas e futuras do mês","Despesas já pagas e futuras do mês","Previstos ainda não pagos"],
      meaning:"É uma estimativa de como seu saldo deve fechar ao final do mês atual, considerando o que já está cadastrado.",
      improve:["Reduzir despesas variáveis que ainda podem ser evitadas","Antecipar recebíveis quando possível","Cadastrar previstos que ainda faltam para uma projeção mais precisa"],
    },
    quantoPossoGastar:{
      title:"Quanto você pode gastar",
      calc:"Projeção de saldo em 30 dias, considerando o saldo atual, receitas e despesas futuras já cadastradas e previstos ainda pendentes.",
      factors:["Saldo atual","Receitas e despesas futuras já cadastradas","Previstos pendentes nos próximos 30 dias"],
      meaning:"É o valor que você pode gastar sem comprometer os próximos 30 dias, de acordo com o que já está cadastrado.",
      improve:["Evitar grandes compras não planejadas","Cadastrar todos os previstos para uma projeção mais precisa","Revisar essa estimativa sempre que fizer um lançamento grande"],
    },
  };
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

  // ---- Ações rápidas (Home) ----
  const qaDescRef=useRef(null);
  const quickAction=type=>{
    if(type==="meta"){
      setTab("wishes");setEditingWish(null);setWishForm({name:"",price:"",saved:"",priority:"Média",monthsTarget:"",notes:""});setShowWishForm(true);
      return;
    }
    setTab("transactions");
    setEditingTx(null);
    setQaExpanded(false);
    setQaDesc("");setQaVal("");
    if(type==="receita"){setQaType("Entrada");setQaCat("Salario / Entradas");}
    else if(type==="despesa"){setQaType("Saída");setQaCat("Alimentação");}
    else if(type==="transferencia"){setQaCat("Investimento");setQaInvTipo("Aporte");}
    else if(type==="investimento"){setQaCat("Investimento");setQaInvTipo("Aporte");}
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

  const [pendingDuplicateTx,setPendingDuplicateTx]=useState(null);
  const commitQuickAdd=()=>{
    pushHistory();
    const isInv=qaCat==="Investimento";
    const derivedType=isInv?(qaInvTipo==="Aporte"?"Saída":"Entrada"):qaType;
    const base={date:qaDate,type:derivedType,fixed:qaFixed,cat:qaCat,desc:qaDesc.trim(),val:parseNum(qaVal),form:qaForm,invTipo:isInv?qaInvTipo:null};
    if(editingTx!==null){setTransactions(p=>p.map(t=>t.id===editingTx?{...t,...base}:t));setEditingTx(null);}
    else{
      const id=genId();const newTxs=[{id,...base}];
      if(qaRepeat!=="none"){const cnt=qaRepeat==="3m"?2:qaRepeat==="6m"?5:11;for(let i=1;i<=cnt;i++){const d=new Date(qaDate+"T12:00:00");d.setMonth(d.getMonth()+i);const nd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;newTxs.push({id:id+i,...base,date:nd});}}
      setTransactions(p=>[...newTxs,...p]);
    }
    setQaDesc("");setQaVal("");setQaExpanded(false);setQaRepeat("none");
    showToast(editingTx!==null?"Lançamento atualizado!":"Lançamento adicionado!","success");
  };
  const quickAdd=()=>{
    if(!qaDesc.trim()||!qaVal){showToast("Preencha descrição e valor para lançar.","error");return;}
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
    setEditingTx(t.id);setQaType(t.type);setQaDesc(t.desc);setQaVal(String(t.val));setQaCat(t.cat);setQaDate(t.date);setQaForm(t.form);setQaFixed(t.fixed);if(t.invTipo)setQaInvTipo(t.invTipo);setQaExpanded(true);
    editTxSnapshotRef.current=JSON.stringify({type:t.type,desc:t.desc,val:String(t.val),cat:t.cat,date:t.date,form:t.form,fixed:t.fixed});
  };
  const cancelEditTx=()=>{setEditingTx(null);setQaDesc("");setQaVal("");setQaType("Saída");setQaCat("Alimentação");setQaExpanded(false);};
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
    setQaVal(String(item.val));
    setQaCat(item.cat);
    setQaForm(item.form);
    setQaFixed(item.fixed);
    if(item.cat==="Investimento"&&item.invTipo)setQaInvTipo(item.invTipo);
    else setQaType(item.type);
    setTimeout(()=>{qaValRef.current?.focus();qaValRef.current?.select();},50);
  };
  const applyFrequentToPlanned=item=>{
    setPlannedForm(p=>({...p,desc:item.desc,val:String(item.val),cat:item.cat,form:item.form}));
    setTimeout(()=>{plannedValRef.current?.focus();plannedValRef.current?.select();},50);
  };

  const saveWish=()=>{
    if(!wishForm.name||!wishForm.price){showToast("Preencha nome e preço para salvar o desejo.","error");return;}
    pushHistory();
    const w={...wishForm,price:parseNum(wishForm.price),saved:parseNum(wishForm.saved),monthsTarget:Math.abs(parseInt(wishForm.monthsTarget)||0)};
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
    showToast("✅ Item movido para Desejos.","success");
  };

  const monthKeyToISO=(mk,day)=>{
    const [mon,yy]=(mk||"").split("/");
    const mIdx=MONTHS_ARR.indexOf(mon);
    if(mIdx<0)return todayFn();
    const year=2000+parseInt(yy);
    const d=Math.min(Math.max(day,1),28);
    return `${year}-${String(mIdx+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  };
  const shiftMonth=(mk,delta)=>{
    let idx=MONTH_ORDER.indexOf(mk);
    if(idx<0)idx=MONTH_ORDER.indexOf(monthKey(todayFn()));
    const ni=Math.max(0,Math.min(MONTH_ORDER.length-1,idx+delta));
    return MONTH_ORDER[ni];
  };
  const savePlannedItem=()=>{
    if(!plannedForm.desc.trim()||!plannedForm.val){showToast("Preencha descrição e valor do gasto previsto.","error");return;}
    pushHistory();
    const base={desc:plannedForm.desc.trim(),val:parseNum(plannedForm.val),cat:plannedForm.cat,form:plannedForm.form,recurring:plannedForm.recurring,month:plannedForm.recurring?null:plannedForm.month,notes:plannedForm.notes||""};
    if(editingPlanned!==null){
      setPlannedExpenses(p=>p.map(x=>x.id===editingPlanned?{...x,...base}:x));
      setEditingPlanned(null);
    }else{
      setPlannedExpenses(p=>[...p,{...base,id:genId(),paid:{}}]);
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
    const snap={desc:item.desc,val:String(item.val),cat:item.cat,form:item.form,recurring:item.recurring,month:item.month||plannedMonth,notes:item.notes||""};
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
  const togglePlannedPaid=item=>{
    pushHistory();
    const paidTxId=item.paid?.[plannedMonth];
    if(paidTxId){
      setTransactions(p=>p.filter(t=>t.id!==paidTxId));
      setPlannedExpenses(p=>p.map(x=>x.id===item.id?{...x,paid:{...x.paid,[plannedMonth]:undefined}}:x));
    }else{
      const txId=genId();
      const date=monthKeyToISO(plannedMonth,new Date().getDate());
      const newTx={id:txId,date,type:"Saída",fixed:item.recurring?"Fixa":"Variavel",cat:item.cat,desc:item.desc,val:item.val,form:item.form,invTipo:null,plannedId:item.id};
      setTransactions(p=>[newTx,...p]);
      setPlannedExpenses(p=>p.map(x=>x.id===item.id?{...x,paid:{...x.paid,[plannedMonth]:txId}}:x));
    }
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
  const deleteAccount=()=>{
    if(!window.confirm("Tem certeza? Todos os seus dados serão apagados."))return;
    (async()=>{
      try{await storage.delete(storageKey(user.email));}catch{}
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
    if(!instDraft.desc.trim()||!instDraft.totalVal||!instDraft.numParcelas){showToast("Preencha descrição, valor total e número de parcelas.","error");return;}
    const total=parseNum(instDraft.totalVal),num=parseInt(instDraft.numParcelas);
    if(isNaN(total)||isNaN(num)||num<1||num>360){showToast("Valor total ou número de parcelas inválido (máx. 360 parcelas).","error");return;}
    const monthly=Math.round((total/num)*100)/100;
    const instId=genId(),startD=instDraft.startDate||todayFn();
    const newTxs=[],txIds=[];
    for(let i=0;i<num;i++){
      const d=new Date(startD+"T12:00:00");d.setMonth(d.getMonth()+i);
      const nd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const txId=instId+i+1;txIds.push(txId);
      newTxs.push({id:txId,date:nd,type:"Saída",fixed:"Fixa",cat:instDraft.cat,desc:`${instDraft.desc.trim()} (${i+1}/${num})`,val:monthly,form:instDraft.form,invTipo:null,installmentId:instId});
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

  const Btn=(props)=><button {...props} className={`btn-primary ${props.className||""}`} style={{background:accent,border:"none",color:"white",borderRadius:R_BTN,cursor:"pointer",fontWeight:700,fontSize:13.5,boxShadow:`0 2px 10px ${accent}40`,transition:"filter .15s ease, transform .15s ease, box-shadow .15s ease",...props.style}}/>;
  const BtnGhost=(props)=><button {...props} className={`btn-ghost ${props.className||""}`} style={{background:"transparent",border:`1px solid ${BD2}`,color:TX2,borderRadius:R_BTN,cursor:"pointer",fontWeight:600,fontSize:13.5,transition:"border-color .15s ease, color .15s ease, background .15s ease",...props.style}}/>;

  const renderFrequentPicks=(onPick)=>(
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:TX2,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Repeat size={12}/>Frequentes</div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {frequentTx.map((item,i)=>(
          <button key={i} onClick={()=>onPick(item)} className="chip-btn" style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_CHIP,padding:"9px 13px",cursor:"pointer",minWidth:112}}>
            <span style={{fontSize:12,fontWeight:600,color:TX,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:140,display:"flex",alignItems:"center",gap:5}}><CategoryIcon cat={item.cat} size={12}/>{item.desc}</span>
            <span style={{fontSize:12,color:TX2,fontVariantNumeric:"tabular-nums"}}>{fmt(item.val)}</span>
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
        <input ref={qaValRef} type="number" placeholder="R$" min="0" step="0.01" value={qaVal} onChange={e=>setQaVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&quickAdd()} style={{...SI,flex:1,fontVariantNumeric:"tabular-nums"}}/>
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
      <button onClick={quickAdd} disabled={!canAdd} style={{width:"100%",padding:"14px",borderRadius:R_BTN,border:"none",cursor:canAdd?"pointer":"not-allowed",fontSize:14,fontWeight:700,background:!canAdd?"rgba(255,255,255,0.04)":isEditing?"#F0A857":accent,color:!canAdd?TX3:"white",boxShadow:canAdd?`0 2px 10px ${isEditing?"#F0A857":accent}40`:"none",transition:"filter .15s ease, box-shadow .15s ease"}}>
        {isEditing?"Salvar alterações":qaCat==="Investimento"?`+ ${qaInvTipo}`:`+ Adicionar ${qaType}`}
      </button>
    </>
  );

  const appTabs=[
    {id:"dashboard",label:"Início",icon:LayoutDashboard},
    {id:"planning",label:"Planejamento",icon:CalendarDays},
    {id:"transactions",label:"Transações",icon:Receipt},
    {id:"planned",label:"Previstos",icon:Calendar},
    {id:"installments",label:"Parcelas",icon:CreditCard},
    {id:"wishes",label:"Desejos",icon:Sparkles},
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
    <div style={{background:BG,minHeight:"100vh",color:TX,fontFamily:"'Inter',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
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
        .nav-tab{position:relative;}
        .nav-tab:hover{color:${TX} !important;background:${HOVER}44 !important;}
        .surface-card{transition:border-color .18s ease, box-shadow .18s ease, transform .18s ease;}

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
      `}</style>

      <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:300,display:"flex",flexDirection:"column",gap:8,alignItems:"center",pointerEvents:"none",width:"100%",padding:"0 16px"}}>
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
      {confirmDelete&&(
        <Modal onClose={()=>setConfirmDelete(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:"#EF444418",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Trash2 size={20} color="#EF4444"/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={confirmDelete.label}>Excluir "{confirmDelete.label}"?</div>
          <div style={{fontSize:13,color:TX2,marginBottom:24,lineHeight:1.5}}>Você pode usar o botão "desfazer" no topo logo em seguida, caso mude de ideia.</div>
          <div style={{display:"flex",gap:10}}>
            <BtnGhost onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:"12px"}}>Cancelar</BtnGhost>
            <button onClick={()=>{
              if(confirmDelete.type==="wish")deleteWish(confirmDelete.id);
              else if(confirmDelete.type==="planned")deletePlannedItem(confirmDelete.id);
              setConfirmDelete(null);
            }} style={{flex:1,padding:"12px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#EF4444",color:"white"}}>Excluir</button>
          </div>
        </Modal>
      )}
      {transferPlanned&&(
        <Modal onClose={()=>setTransferPlanned(null)} maxWidth={340} padding={30} contentStyle={{textAlign:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:accent+"18",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Sparkles size={20} color={accent}/></div>
          <div style={{fontSize:16,fontWeight:700,color:TX,marginBottom:10,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={transferPlanned.desc}>Mover "{transferPlanned.desc}" para Desejos?</div>
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
                      <span style={{fontSize:12,color:t.type==="Entrada"?"#22C55E":"#EF4444",fontWeight:600}}>{fmt(t.val)}</span>
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
                      <span style={{fontSize:12,color:TX2}}>{fmt(w.price)}</span>
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
                      <span style={{fontSize:12,color:TX2}}>{fmt(p.val)}</span>
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
                      <span style={{fontSize:12,color:TX2}}>{fmt(p.val)}/mês</span>
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
                      <span style={{fontSize:12,color:TX2}}>{fmt(t.val)}</span>
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
                      <span style={{fontSize:12,color:TX2}}>{fmt(i.totalVal)}</span>
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
            <div style={{fontSize:12,color:TX3,marginBottom:12,lineHeight:1.5}}>Desejos e previstos excluídos ficam guardados aqui por {TRASH_RETENTION_DAYS} dias e podem ser restaurados.</div>
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
            <button onClick={deleteAccount} style={{width:"100%",padding:"11px",borderRadius:R_BTN,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#EF444414",color:"#EF4444",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Trash2 size={14}/>Apagar conta e dados</button>
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
                    <div style={{fontSize:13,fontWeight:700,color:t.color,flexShrink:0}}>{fmt(t.val)}</div>
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
                    wish:{label:entry.item.name,value:entry.item.price,typeName:"Desejo",Icon:Sparkles},
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

      <div style={{display:"flex",gap:4,padding:"8px 20px 0",overflowX:"auto",background:HDR,borderBottom:`1px solid ${BD}`}}>
        {appTabs.map(t=>{const Ic=t.icon;return(
          <button key={t.id} className="nav-tab" onClick={()=>setTab(t.id)} style={{
            padding:"9px 15px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap",
            background:tab===t.id?`${accent}18`:"transparent",color:tab===t.id?TX:TX3,
            borderRadius:"12px 12px 0 0",marginBottom:tab===t.id?0:0,
            display:"flex",alignItems:"center",gap:7,
          }}><Ic size={15}/>{t.label}</button>
        );})}
      </div>

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
                  <div style={{fontSize:13,color:TX2,lineHeight:1.6,marginBottom:4}}>Pra começar: lance sua primeira <strong style={{color:TX}}>transação</strong> na aba "Transações", cadastre contas fixas em <strong style={{color:TX}}>"Previstos"</strong> e sonhos grandes em <strong style={{color:TX}}>"Desejos"</strong>. Os Insights e os gráficos vão aparecer sozinhos conforme você for usando.</div>
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
                      <div style={{fontSize:20,fontWeight:800,color:resumoDoMes.stats.economia>=0?"#22C55E":"#EF4444",letterSpacing:"-0.01em"}}>{resumoDoMes.stats.economia>=0?"+":""}{fmt(resumoDoMes.stats.economia)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:22,marginBottom:6}}>📈</div>
                      <div style={{fontSize:10.5,color:TX2,fontWeight:600,marginBottom:3}}>Patrimônio</div>
                      <div style={{fontSize:20,fontWeight:800,color:accent,letterSpacing:"-0.01em"}}>{fmt(resumoDoMes.stats.patrimonio)}</div>
                    </div>
                    {resumoDoMes.stats.meta&&(
                      <div>
                        <div style={{fontSize:22,marginBottom:6}}>🎯</div>
                        <div style={{fontSize:10.5,color:TX2,fontWeight:600,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Meta {resumoDoMes.stats.meta.name}</div>
                        <div style={{fontSize:20,fontWeight:800,color:"#22C55E",letterSpacing:"-0.01em"}}>{resumoDoMes.stats.meta.pct}%</div>
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
                {label:"Transferência",icon:Repeat,color:"#A78BFA",title:"Mover dinheiro para investimentos (aporte)",action:()=>quickAction("transferencia")},
                {label:"Nova Meta",icon:Sparkles,color:accent,title:"Criar uma nova meta/desejo",action:()=>quickAction("meta")},
                {label:"Investimento",icon:TrendingUp,color:"#3B82F6",title:"Registrar aporte, resgate ou rendimento",action:()=>quickAction("investimento")},
              ].map(qa=>(
                <button key={qa.label} onClick={qa.action} title={qa.title} style={{flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"11px 16px",borderRadius:R_BTN,border:`1px solid ${BD2}`,background:"rgba(255,255,255,0.03)",color:TX,cursor:"pointer",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>
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
              <div className="bento-half fc-card" onClick={()=>setExplainKey("saldoPrevisto")} title="Toque para entender este número" style={{...cardStyle,padding:24,cursor:"pointer"}}>
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
              <div onClick={()=>setExplainKey("quantoPossoGastar")} className="fc-card" title="Toque para entender este número" style={{...cardStyle,padding:26,cursor:"pointer",background:proj30.value>=0?`linear-gradient(120deg, ${accent}14, ${CARD} 70%)`:`linear-gradient(120deg, #EF444414, ${CARD} 70%)`,border:`1px solid ${proj30.value>=0?accent+"30":"#EF444440"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:32,height:32,borderRadius:10,background:(proj30.value>=0?accent:"#EF4444")+"1f",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{proj30.value>=0?<Check size={16} color={accent}/>:<AlertTriangle size={16} color="#EF4444"/>}</div>
                  <div style={{fontSize:13.5,fontWeight:700,color:TX,flex:1}}>Quanto você pode gastar?</div>
                  <Info size={12} color={TX3}/>
                </div>
                <div style={{fontSize:30,fontWeight:800,color:proj30.value>=0?accent:"#EF4444",letterSpacing:"-0.02em"}}>{fmt(Math.max(0,proj30.value))}</div>
                <div style={{fontSize:12.5,color:TX2,marginTop:6,lineHeight:1.5}}>{proj30.value>=0?"nos próximos 30 dias, sem comprometer contas e parcelas já previstas.":`Sua projeção para os próximos 30 dias está negativa em ${fmt(Math.abs(proj30.value))}. Evite gastos não essenciais.`}</div>
              </div>
            )}

            {/* ---- Cartões de consultor: poucos, ricos, ordenados por prioridade real ---- */}
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
                  {consultantInsights.map((it,i)=><InsightCard key={it.key} item={it} index={i}/>)}
                </div>
              )}
            </div>

            {/* ---- Evolução do dinheiro ---- */}
            <Card style={{padding:26}}>
              <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:20,display:"flex",alignItems:"center",gap:8}}><TrendingUp size={16} color={accent}/>Evolução do seu dinheiro</div>
              <div style={{display:"flex",alignItems:"center",gap:6,overflowX:"auto",paddingBottom:4}}>
                {moneySteps.flatMap((s,i)=>{
                  const nodes=[
                    <div key={`step-${s.label}`} style={{flex:"1 1 120px",minWidth:110,textAlign:"center",background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_INPUT,padding:"14px 10px"}}>
                      <div style={{fontSize:11,color:TX2,marginBottom:6,fontWeight:600}}>{s.label}</div>
                      <div style={{fontSize:15,fontWeight:700,color:s.value>=0?"#22C55E":"#EF4444"}}>{fmt(s.value)}</div>
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
                      <div style={{fontSize:13,fontWeight:700,color:t.color,flexShrink:0}}>{fmt(t.val)}</div>
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
                            <span style={{fontSize:12.5,fontWeight:700,color:TX}}>{fmt(d.value)}</span>
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
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Total investido</span><span style={{fontSize:13,fontWeight:700,color:TX}}>{fmt(investmentStats.aportes)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Rentabilidade cadastrada</span><span style={{fontSize:13,fontWeight:700,color:"#22C55E"}}>{fmt(investmentStats.rendimentos)}</span></div>
                      {investmentParticipacao!==null&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Participação no patrimônio</span><span style={{fontSize:13,fontWeight:700,color:accent}}>{investmentParticipacao}%</span></div>}
                    </div>
                  </Card>
                )}
                {subscriptions&&(
                  <Card style={{padding:24}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:TX,marginBottom:14,display:"flex",alignItems:"center",gap:8}}><Repeat size={15} color={accent}/>Assinaturas e recorrências</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Total mensal</span><span style={{fontSize:13,fontWeight:700,color:"#EF4444"}}>{fmt(subscriptions.total)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Maior assinatura</span><span style={{fontSize:13,fontWeight:700,color:TX}}>{subscriptions.biggest?.desc}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12.5,color:TX2}}>Pendentes este mês</span><span style={{fontSize:13,fontWeight:700,color:"#F0A857"}}>{subscriptions.pendingCount}</span></div>
                    </div>
                  </Card>
                )}
              </div>
            )}
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
                            <div style={{fontSize:12,color:item.c,fontWeight:700,marginTop:4}}>{fmt(item.ev.val)}</div>
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
                      <div style={{fontSize:17,fontWeight:700,color:balance>=0?"#22C55E":"#EF4444"}}>{fmt(balance)}</div>
                    </div>
                    {cashFlowProjections.map(cp=>(
                      <div key={cp.days} className="bento-half" style={{...cardStyle,padding:18,textAlign:"center"}}>
                        <div style={{fontSize:11,color:TX2,marginBottom:6}}>Em {cp.days} dias</div>
                        <div style={{fontSize:17,fontWeight:700,color:cp.value>=0?"#22C55E":"#EF4444"}}>{fmt(cp.value)}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card style={{padding:26}}>
                  <div style={{fontSize:14,fontWeight:700,color:TX,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><Briefcase size={16} color={accent}/>Compromissos Financeiros</div>
                  <div className="bento">
                    <div className="bento-half" style={{...cardStyle,padding:18}}><div style={{fontSize:11,color:TX2,marginBottom:6}}>Parcelas restantes</div><div style={{fontSize:16,fontWeight:700,color:"#F0A857"}}>{fmt(instStats.remaining)}</div><div style={{fontSize:11,color:TX3,marginTop:4}}>{pendingParcelasCount} parcela(s)</div></div>
                    {subscriptions&&<div className="bento-half" style={{...cardStyle,padding:18}}><div style={{fontSize:11,color:TX2,marginBottom:6}}>Assinaturas</div><div style={{fontSize:16,fontWeight:700,color:"#A78BFA"}}>{fmt(subscriptions.total)}</div><div style={{fontSize:11,color:TX3,marginTop:4}}>{subscriptions.count} ativa(s)</div></div>}
                    <div className="bento-half" style={{...cardStyle,padding:18}}><div style={{fontSize:11,color:TX2,marginBottom:6}}>Comprometido no próximo mês</div><div style={{fontSize:16,fontWeight:700,color:accent}}>{fmt(committedNextMonth)}</div><div style={{fontSize:11,color:TX3,marginTop:4}}>{nextMonthKeyReal}</div></div>
                    <div className="bento-half" style={{...cardStyle,padding:18}}><div style={{fontSize:11,color:TX2,marginBottom:6}}>Comprometido nos próximos 3 meses</div><div style={{fontSize:16,fontWeight:700,color:accent}}>{fmt(committedNext3Months)}</div></div>
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
                            <div style={{fontSize:13,fontWeight:700,color:it.color,flexShrink:0}}>{fmt(it.data.val)}</div>
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
                {enhancedWishes.length===0&&<div style={{textAlign:"center",color:TX3,padding:40,fontSize:13,background:CARD,border:`1px solid ${BD}`,borderRadius:R_CARD}}>Nenhuma meta cadastrada ainda. Adicione em "Desejos".</div>}
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
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Valor atual</div><div style={{fontSize:14,fontWeight:700,color:TX}}>{fmt(w.saved)}</div></div>
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Valor restante</div><div style={{fontSize:14,fontWeight:700,color:TX}}>{fmt(w.remaining)}</div></div>
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Tempo estimado</div><div style={{fontSize:14,fontWeight:700,color:TX}}>{w.estMonths?`~${w.estMonths} meses`:"sem dados suficientes"}</div></div>
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Previsão de conclusão</div><div style={{fontSize:14,fontWeight:700,color:TX}}>{w.etaDate||"—"}</div></div>
                      <div className="bento-half"><div style={{fontSize:11,color:TX2,marginBottom:4}}>Guardar por mês (na sua meta)</div><div style={{fontSize:14,fontWeight:700,color:TX}}>{w.monthlyByTarget?fmt(w.monthlyByTarget):"defina um prazo em meses"}</div></div>
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
                    <input type="number" placeholder="Quanto você quer gastar (R$)" value={askAmount} onChange={e=>setAskAmount(e.target.value)} style={{...SI,flex:1,minWidth:180}}/>
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
                      <input type="number" placeholder="Quanto a mais guardar por mês (R$)" value={simExtra} onChange={e=>setSimExtra(e.target.value)} style={SI}/>
                    </div>
                  )}
                  {simType==="compra_grande"&&(
                    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                      <input type="number" placeholder="Valor total (R$)" value={simValue} onChange={e=>setSimValue(e.target.value)} style={{...SI,flex:1,minWidth:140}}/>
                      <input type="number" placeholder="Em quantas parcelas" value={simParcelas} onChange={e=>setSimParcelas(e.target.value)} style={{...SI,flex:1,minWidth:140}}/>
                    </div>
                  )}
                  {simType==="investir_mensal"&&(
                    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                      <input type="number" placeholder="Valor por mês (R$)" value={simValue} onChange={e=>setSimValue(e.target.value)} style={{...SI,flex:1,minWidth:120}}/>
                      <input type="number" placeholder="Por quantos meses" value={simMonths} onChange={e=>setSimMonths(e.target.value)} style={{...SI,flex:1,minWidth:120}}/>
                      <input type="number" placeholder="Retorno anual estimado (%)" value={simReturn} onChange={e=>setSimReturn(e.target.value)} style={{...SI,flex:1,minWidth:120}}/>
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
                                  <td style={{padding:"12px 16px",color:"#22C55E",fontWeight:600,whiteSpace:"nowrap"}}>{fmt(m.in)}</td>
                                  <td style={{padding:"12px 16px",color:"#EF4444",fontWeight:600,whiteSpace:"nowrap"}}>{fmt(m.out)}</td>
                                  <td style={{padding:"12px 16px",color:m.balance>=0?"#22C55E":"#EF4444",fontWeight:700,whiteSpace:"nowrap"}}>{fmt(m.balance)}</td>
                                  <td style={{padding:"12px 16px",color:delta===null?TX3:delta>=0?"#22C55E":"#EF4444",fontWeight:600,whiteSpace:"nowrap"}}>{delta===null?"—":`${delta>0?"+":""}${delta}%`}</td>
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
              {[{l:"Entradas",v:totalIn,c:"#22C55E"},{l:"Saídas",v:totalOut,c:"#EF4444"},{l:"Saldo",v:balance,c:balance>=0?"#22C55E":"#EF4444"}].map(c=>(
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
                        <div style={{fontSize:14,fontWeight:700,color:isIn?"#22C55E":"#EF4444",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{isIn?"+":"-"}{fmt(t.val)}</div>
                        <button onClick={()=>startEditTx(t)} title="Editar" style={{background:"none",border:"none",color:TX3,cursor:"pointer",flexShrink:0,padding:4}}><Pencil size={14}/></button>
                        <button onClick={()=>deleteTx(t.id)} title="Excluir" style={{background:"none",border:"none",color:TX3,cursor:"pointer",flexShrink:0,padding:4}}><Trash2 size={14}/></button>
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
                  <input ref={plannedValRef} type="number" placeholder="R$" min="0" step="0.01" value={plannedForm.val} onChange={e=>setPlannedForm(p=>({...p,val:e.target.value}))} style={{...SI,flex:1}}/>
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
                  <Btn onClick={savePlannedItem} disabled={!plannedForm.desc.trim()||!plannedForm.val} style={{padding:"10px 20px",fontSize:13,opacity:(!plannedForm.desc.trim()||!plannedForm.val)?0.5:1,cursor:(!plannedForm.desc.trim()||!plannedForm.val)?"not-allowed":"pointer"}}>{editingPlanned!==null?"Salvar":"Adicionar"}</Btn>
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
                const notesKey=`planned-${item.id}`;
                return(
                  <div key={item.id} style={{background:isPaid?"#22C55E12":CARD,border:`1px solid ${isPaid?"#22C55E30":BD}`,borderRadius:R_INPUT,padding:"14px 16px",boxShadow:SH_SM}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <button onClick={()=>togglePlannedPaid(item)} title={isPaid?"Marcar como não pago":"Marcar como pago"} style={{width:24,height:24,borderRadius:8,border:isPaid?"none":`1.5px solid ${BD2}`,background:isPaid?"#22C55E":"transparent",color:"white",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{isPaid&&<Check size={13}/>}</button>
                      <div style={{width:34,height:34,borderRadius:11,background:itemColor+"1f",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CategoryIcon cat={item.cat} size={15} color={itemColor}/></div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:isPaid?TX2:TX,textDecoration:isPaid?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.desc}</div>
                        <div style={{fontSize:11,color:TX2,marginTop:3,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{color:itemColor,fontWeight:600}}>{item.cat}</span>
                          {item.recurring&&<span style={{display:"flex",alignItems:"center",gap:3,color:accent}}>· <Repeat size={10}/>mensal</span>}
                          <span>· {item.form}</span>
                        </div>
                      </div>
                      <div style={{fontSize:14,fontWeight:700,color:isPaid?"#22C55E":TX,flexShrink:0}}>{fmt(item.val)}</div>
                      {item.notes&&<button onClick={()=>toggleNotes(notesKey)} title="Ver notas" style={{background:"none",border:"none",color:expandedNotes[notesKey]?accent:TX3,cursor:"pointer",flexShrink:0,padding:4}}><Info size={14}/></button>}
                      <button onClick={()=>openTransferToWish(item)} title="Mover para Desejos" aria-label="Mover para Desejos" style={{background:"none",border:"none",color:TX3,cursor:"pointer",flexShrink:0,padding:4}}><ArrowRightLeft size={14}/></button>
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
                  <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Valor total (R$)</div><input type="number" placeholder="6000" value={instDraft.totalVal} onChange={e=>setInstDraft(d=>({...d,totalVal:e.target.value}))} style={SI}/></div>
                  <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Nº de parcelas</div><input type="number" min="1" max="360" placeholder="12" value={instDraft.numParcelas} onChange={e=>setInstDraft(d=>({...d,numParcelas:e.target.value}))} style={SI}/></div>
                  {monthlyPreview&&(
                    <div style={{gridColumn:"1/-1",background:"rgba(255,255,255,0.03)",border:`1px solid ${BD}`,borderRadius:R_INPUT,padding:"10px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                      <span style={{fontSize:12,color:TX2}}>Valor por parcela</span>
                      <span style={{fontSize:16,fontWeight:700,color:accent}}>{fmt(monthlyPreview)}/mês</span>
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
                  <button onClick={addInstallment} disabled={!instDraft.desc||!instDraft.totalVal} style={{flex:2,padding:"11px",borderRadius:R_BTN,border:"none",cursor:(!instDraft.desc||!instDraft.totalVal)?"not-allowed":"pointer",fontSize:13,fontWeight:700,background:(!instDraft.desc||!instDraft.totalVal)?"rgba(255,255,255,0.04)":accent,color:(!instDraft.desc||!instDraft.totalVal)?TX3:"white",minWidth:180}}>
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
                        {isComplete?<div style={{fontSize:12,color:"#22C55E",fontWeight:700}}>Quitado</div>:<div style={{fontSize:13,fontWeight:700,color:"#EF4444"}}>{fmt(remainingVal)}</div>}
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
              <div style={{fontSize:17,fontWeight:700,color:TX,letterSpacing:"-0.01em"}}>Meus Desejos Futuros</div>
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
                  {[{l:"Nome",k:"name",t:"text"},{l:"Preço (R$)",k:"price",t:"number"},{l:"Já guardei (R$)",k:"saved",t:"number"},{l:"Meta (meses)",k:"monthsTarget",t:"number"}].map(f=>(
                    <div key={f.k}><div style={{fontSize:11,color:TX2,marginBottom:5}}>{f.l}</div><input type={f.t} value={wishForm[f.k]} maxLength={f.t==="text"?80:undefined} onChange={e=>setWishForm(p=>({...p,[f.k]:e.target.value}))} style={SI}/></div>
                  ))}
                  <div><div style={{fontSize:11,color:TX2,marginBottom:5}}>Prioridade</div><select value={wishForm.priority} onChange={e=>setWishForm(p=>({...p,priority:e.target.value}))} style={SI}>{["Alta","Média","Baixa"].map(o=><option key={o}>{o}</option>)}</select></div>
                  <div style={{gridColumn:"1/-1"}}>
                    <div style={{fontSize:11,color:TX2,marginBottom:5}}>Notas / Descrição (opcional)</div>
                    <textarea value={wishForm.notes||""} maxLength={2000} onChange={e=>setWishForm(p=>({...p,notes:e.target.value}))} rows={4} placeholder="Detalhes, observações, planejamento, links de produtos..." style={{...SI,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}/>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"flex-end",gridColumn:"1/-1",flexWrap:"wrap"}}>
                    <Btn onClick={saveWish} disabled={!wishForm.name||!wishForm.price} style={{padding:"10px 20px",fontSize:13,opacity:(!wishForm.name||!wishForm.price)?0.5:1,cursor:(!wishForm.name||!wishForm.price)?"not-allowed":"pointer"}}>{editingWish!==null?"Salvar":"Adicionar"}</Btn>
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
                      <button onClick={()=>{const snap={name:w.name,price:String(w.price),saved:String(w.saved),priority:w.priority,monthsTarget:String(w.monthsTarget||""),notes:w.notes||""};setEditingWish(w.id);setWishForm(snap);wishFormSnapshotRef.current=JSON.stringify(snap);setShowWishForm(true);}} title="Editar" aria-label="Editar" style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:8,padding:"5px 8px",color:TX2,cursor:"pointer"}}><Pencil size={12}/></button>
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