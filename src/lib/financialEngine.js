// ============================================================================
// financialEngine.js — o "cérebro" do Lacalle Finance.
//
// 100% JavaScript puro: nenhuma linha aqui importa React, JSX ou qualquer
// coisa de interface. Só regras de negócio (cálculos, projeções, geração de
// insights) a partir de dados brutos (transações, previstos, desejos etc).
//
// Por isso é o primeiro arquivo separado do componente gigante: dá pra
// testar isoladamente (ver financialEngine.test.js), reaproveitar num app
// de celular no futuro sem reescrever nada, e mexer nele sem arriscar
// quebrar nada da interface visual.
// ============================================================================

const MONTHS_ARR=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
// Posição absoluta de um mês ("out/26" → 2026*12+9), para ordenar e andar
// mês a mês sem limite. Antes tudo usava MONTH_ORDER.indexOf, uma janela de
// 12 meses para trás e 36 para frente calculada ao abrir o app: um mês fora
// dela virava -1, então quem tivesse mais de um ano de histórico via filtros
// e o resumo mensal fora de ordem. -1 continua significando "mês inválido".
export const monthIndex=mk=>{
  const m=/^([a-z]{3})\/(\d{2})$/.exec(String(mk??""));
  if(!m)return -1;
  const mi=MONTHS_ARR.indexOf(m[1]);
  return mi<0?-1:(2000+Number(m[2]))*12+mi;
};
export const monthAt=idx=>{
  if(!Number.isInteger(idx)||idx<0)return undefined;
  return `${MONTHS_ARR[idx%12]}/${String(Math.floor(idx/12)).slice(2)}`;
};
// Só para preencher seletores de mês na tela (12 para trás, 36 para frente).
// Para ordenar ou comparar, use monthIndex.
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
const fmt=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
// Chave de mês ("jul/26"). Precisa ser à prova de dado ruim porque alimenta
// os filtros, os gráficos e a ordenação por MONTH_ORDER:
//  - o try/catch original nunca disparava (new Date inválido devolve
//    "Invalid Date", não lança), então uma data corrompida virava
//    "undefined/N" e poluía o seletor de meses;
//  - String(1).slice(2) devolve "" — um lançamento no ano 1 virava "jan/",
//    exatamente o item fantasma que aparecia no filtro da aba Transações.
const monthKey=d=>{
  const dt=new Date(String(d??"")+"T12:00:00");
  if(isNaN(dt.getTime()))return"???";
  const y=dt.getFullYear();
  if(y<1000||y>9999)return"???";
  return`${MONTHS_ARR[dt.getMonth()]}/${String(y).slice(2)}`;
};
const addDaysStr=(dateStr,n)=>{const d=new Date(dateStr+"T12:00:00");d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const diffDays=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000);
const toISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const daysInMonth=(year,monthIdx)=>new Date(year,monthIdx+1,0).getDate();
// Soma meses "como um humano espera", sem o rollover do JS.
// `new Date("2026-07-31").setMonth(+2)` devolve 01/10 porque setembro não tem
// dia 31 e o Date transborda para o mês seguinte — era o que fazia as parcelas
// caírem em "jul, ago, out, out, dez, dez, jan". Aqui o dia é limitado ao
// último dia válido do mês de destino (31/jan + 1 mês = 28/fev, ou 29 em
// ano bissexto), que é a regra usada por bancos e operadoras de cartão.
// Texto de prazo em meses, com plural correto e sem prometer precisão que a
// estimativa não tem. "~1 meses" para qualquer valor restante era o sintoma.
export const formatMonths=(months,exact=null)=>{
  if(months===null||months===undefined)return"sem dados suficientes";
  if(exact!==null&&exact<1)return"menos de 1 mês";
  if(months===1)return"cerca de 1 mês";
  return`cerca de ${months} meses`;
};
export const addMonthsStr=(dateStr,n)=>{
  const d=new Date(dateStr+"T12:00:00");
  if(isNaN(d.getTime()))return dateStr;
  const day=d.getDate();
  const target=new Date(d.getFullYear(),d.getMonth()+n,1,12,0,0);
  target.setDate(Math.min(day,daysInMonth(target.getFullYear(),target.getMonth())));
  return toISO(target);
};

// ---- Status de um previsto num mês específico -------------------------------
// Um previsto pode estar, num dado mês: pago (virou uma transação real),
// ignorado (o usuário decidiu não contar com ele só naquele mês, sem apagar o
// cadastro — ex.: assinatura pausada, conta que não vai vencer dessa vez) ou
// pendente (nenhum dos dois — ainda entra nas projeções e no orçamento).
// Essa mesma pergunta ("esse previsto conta pra esse mês?") se repete em
// quase uma dezena de lugares (projeção de fluxo de caixa, saldo livre,
// orçamento do mês, lembretes, linha do tempo). Fica aqui, no escopo do
// módulo, porque FinancialEngine e InsightEngine são duas IIFEs separadas e
// ambas precisam da mesma regra — do jeito que já acontece com monthKey,
// addDaysStr etc. logo acima.
export const PlannedStatus={
  isPaid:(item,month)=>!!item.paid?.[month],
  isIgnored:(item,month)=>!!item.ignored?.[month],
  isPending:(item,month)=>!PlannedStatus.isPaid(item,month)&&!PlannedStatus.isIgnored(item,month),
  // O previsto conta neste mês? Lugar único da regra (antes eram nove
  // cópias de "p.recurring||p.month===mk"). Um recorrente conta de `from`
  // (o mês em que começa) até `until` (o último mês, o "Até"); sem `from`,
  // como os cadastrados antes desta regra, vale desde sempre; sem `until`,
  // vale para sempre.
  appliesTo:(item,month)=>{
    if(!item.recurring)return item.month===month;
    const i=monthIndex(month);
    if(i<0)return false;
    if(item.from&&i<monthIndex(item.from))return false;
    if(item.until&&i>monthIndex(item.until))return false;
    return true;
  },
};

// ---- Direção financeira de uma transação ------------------------------------
// Responde a pergunta que TEM que vir antes de qualquer texto de insight:
// esse lançamento é dinheiro entrando, saindo, ou é movimentação interna?
//
// Existia um bug de origem por não perguntar isso: a memória de hábitos
// (buildDescMemory) agrupava lançamentos só pela descrição recorrente e os
// textos assumiam "gasto". Uma RECEITA recorrente que parava virava
// "Gasto com <nome> parou" — semanticamente errado, porque o dinheiro
// entrava, não saía. A correção não pode ser por descrição ou por caso
// específico: é a classificação que precisa existir antes da redação.
//
//   receita  -> dinheiro entra (Entrada que não é investimento)
//   despesa  -> dinheiro sai   (Saída que não é investimento)
//   interna  -> aporte, resgate e qualquer movimentação de investimento.
//               NUNCA conta como receita nem como despesa: o dinheiro só
//               muda de lugar (conta <-> investimento), o patrimônio não
//               muda. Já era assim nos cálculos (isAporte/isResgate); o que
//               faltava era o texto respeitar a mesma regra.
//
// Vive aqui fora, junto de PlannedStatus, porque FinancialEngine e
// InsightEngine são IIFEs separadas e as duas precisam da mesma regra.
export const FLOW={RECEITA:"receita",DESPESA:"despesa",INTERNA:"interna"};
export const flowOf=t=>{
  if(!t)return FLOW.INTERNA;
  if(t.cat==="Investimento")return FLOW.INTERNA;
  return t.type==="Entrada"?FLOW.RECEITA:FLOW.DESPESA;
};
export const isReceita=t=>flowOf(t)===FLOW.RECEITA;
export const isDespesa=t=>flowOf(t)===FLOW.DESPESA;

// ---- Vocabulário por direção -------------------------------------------------
// Centraliza as palavras para que nenhum insight escreva "gasto"/"economia"
// sobre uma entrada, nem "receita"/"recebeu" sobre uma saída. Quem gera texto
// pede o termo aqui em vez de escrever a palavra na mão.
export const FLOW_WORDS={
  [FLOW.RECEITA]:{
    noun:"receita",nounPlural:"receitas",
    // "Você não recebeu mais valores de X desde abril."
    stoppedSentence:(desc,when)=>`Você não recebeu mais valores de ${desc} desde ${when}.`,
    stoppedTitle:desc=>`Receita de ${desc} foi interrompida`,
    stoppedDetail:desc=>`As entradas provenientes de ${desc} deixaram de ocorrer.`,
    startedTitle:desc=>`Nova receita recorrente: ${desc}`,
    startedSentence:(desc,n)=>`Já são ${n} ${n===1?"mês":"meses"} seguidos recebendo de ${desc} — parece ser uma entrada recorrente.`,
    verbPast:"recebeu",
  },
  [FLOW.DESPESA]:{
    noun:"gasto",nounPlural:"gastos",
    stoppedSentence:(desc,when)=>`Você não teve mais gastos com ${desc} desde ${when}.`,
    stoppedTitle:desc=>`Gasto com ${desc} parou`,
    stoppedDetail:desc=>`O gasto com ${desc} deixou de ocorrer.`,
    startedTitle:desc=>`Novo gasto recorrente: ${desc}`,
    startedSentence:(desc,n)=>`Já são ${n} ${n===1?"mês":"meses"} seguidos com gastos em ${desc} — parece estar virando hábito.`,
    verbPast:"gastou",
  },
};
export const wordsFor=flow=>FLOW_WORDS[flow]||FLOW_WORDS[FLOW.DESPESA];

// ---- Contexto temporal: o mês de referência já terminou? --------------------
// Segunda pergunta obrigatória antes de escrever um insight comparativo (a
// primeira é a direção do dinheiro, acima): esse mês já fechou?
//
// Existia um bug de origem por não perguntar isso: no dia 4 de agosto, com
// R$ 10 em Lazer contra uma média mensal de R$ 294,71, o motor anunciava
// "Economia em Lazer: R$ 284,71". Mas agosto não acabou — o dinheiro ainda
// pode ser gasto. Era uma projeção apresentada como fato consumado, e o erro
// vinha de comparar um mês PARCIAL contra meses COMPLETOS.
//
// Regra: enquanto o mês corre, só se compara período equivalente (1–4 de
// agosto contra 1–4 de julho, 1–4 de junho...) e o texto fala em tendência.
// Economia consolidada só depois do fechamento.
export const dayOfMonthOf=dateStr=>{
  const d=parseInt(String(dateStr??"").split("-")[2],10);
  return Number.isFinite(d)?d:null;
};
export const monthProgress=(todayISO,refMonthKey)=>{
  const dt=new Date(String(todayISO??"")+"T12:00:00");
  if(isNaN(dt.getTime()))return{isComplete:true,dayOfMonth:31,daysInMonth:31,elapsedRatio:1};
  const totalDays=daysInMonth(dt.getFullYear(),dt.getMonth());
  const day=dayOfMonthOf(todayISO)||1;
  const curIdx=monthIndex(monthKey(todayISO));
  const refIdx=monthIndex(refMonthKey);
  // Um mês anterior ao corrente já fechou — comparação plena é legítima.
  if(refIdx>=0&&curIdx>=0&&refIdx<curIdx)return{isComplete:true,dayOfMonth:totalDays,daysInMonth:totalDays,elapsedRatio:1};
  return{isComplete:day>=totalDays,dayOfMonth:day,daysInMonth:totalDays,elapsedRatio:totalDays>0?day/totalDays:1};
};

export const FinancialEngine=(()=>{
  const isSaidaReal=t=>t.type==="Saída"&&t.cat!=="Investimento";
  const isEntradaReal=t=>t.type==="Entrada"&&t.cat!=="Investimento";
  const isAporte=t=>t.cat==="Investimento"&&((t.invTipo==="Aporte")||(!t.invTipo&&t.type==="Saída"));
  const isResgate=t=>t.cat==="Investimento"&&((t.invTipo==="Resgate")||(!t.invTipo&&t.type==="Entrada"));
  const sumVal=arr=>arr.reduce((s,t)=>s+t.val,0);
  const cleanDesc=d=>(d||"").replace(/\s*\(\d+\/\d+\)$/,"");

  // ---- Médias típicas do mês (base da projeção simétrica) -------------------
  // Calcula a renda e o gasto MÉDIOS por mês, a partir dos meses FECHADOS
  // recentes (até 6 atrás; ignora o mês atual, que está incompleto). A projeção
  // usa isso para estimar tanto o quanto ainda deve ENTRAR quanto o quanto ainda
  // deve SAIR. Antes a projeção só estimava renda, o que inflava o "quanto posso
  // gastar"; e somava salário por descrição, contando em dobro quando ele mudava
  // de nome (ex.: "Conexa" vs "Salario Conexa"). Média mensal resolve os dois.
  const typicalMonthly=(transactions,currentMonthKey)=>{
    const currentIdx=monthIndex(currentMonthKey);
    const inByIdx={},outByIdx={};
    transactions.forEach(t=>{
      const idx=monthIndex(monthKey(t.date));
      if(idx<0||idx>=currentIdx||currentIdx-idx>6)return; // só meses fechados recentes
      if(isEntradaReal(t))inByIdx[idx]=(inByIdx[idx]||0)+t.val;
      else if(isSaidaReal(t))outByIdx[idx]=(outByIdx[idx]||0)+t.val;
      else if(isAporte(t))outByIdx[idx]=(outByIdx[idx]||0)+t.val;
      else if(isResgate(t))outByIdx[idx]=(outByIdx[idx]||0)-t.val;
    });
    const idxs=new Set([...Object.keys(inByIdx),...Object.keys(outByIdx)]);
    const n=idxs.size||1;
    const avgIn=Object.values(inByIdx).reduce((a,b)=>a+b,0)/n;
    const avgOut=Object.values(outByIdx).reduce((a,b)=>a+b,0)/n;
    return{avgIn:Math.max(0,avgIn),avgOut:Math.max(0,avgOut),monthsUsed:idxs.size};
  };

  // ---- Média típica de gasto POR CATEGORIA, mesma janela de typicalMonthly ---
  // typicalMonthly só devolve um número único (avgOut) — quando a projeção
  // usa a média porque ela é maior que o já cadastrado, a diferença ("Gasto
  // típico estimado") não tinha de onde vir uma categoria e caía tudo em
  // "Outros" por padrão. Isso é enganoso: o gasto médio histórico claramente
  // teve categoria (Alimentação, Transporte etc.), só não tinha sido
  // atribuído. Aqui a mesma média é recalculada categoria a categoria, na
  // MESMA janela (meses fechados, até 6 atrás) e com o MESMO sinal (Saída
  // conta, Aporte conta como saída, Resgate abate) — a soma de todas as
  // categorias bate exatamente com o avgOut de typicalMonthly.
  const typicalMonthlyByCategory=(transactions,currentMonthKey)=>{
    const currentIdx=monthIndex(currentMonthKey);
    const sumByIdxCat={};
    transactions.forEach(t=>{
      const idx=monthIndex(monthKey(t.date));
      if(idx<0||idx>=currentIdx||currentIdx-idx>6)return;
      let delta=0;
      if(isSaidaReal(t))delta=t.val;
      else if(isAporte(t))delta=t.val;
      else if(isResgate(t))delta=-t.val;
      else return;
      if(!sumByIdxCat[idx])sumByIdxCat[idx]={};
      sumByIdxCat[idx][t.cat]=(sumByIdxCat[idx][t.cat]||0)+delta;
    });
    const n=Object.keys(sumByIdxCat).length||1;
    const totalByCat={};
    Object.values(sumByIdxCat).forEach(catMap=>{
      Object.entries(catMap).forEach(([cat,v])=>{totalByCat[cat]=(totalByCat[cat]||0)+v;});
    });
    const avgByCat={};
    Object.entries(totalByCat).forEach(([cat,v])=>{avgByCat[cat]=v/n;});
    return avgByCat;
  };
  // Distribui um valor (o "resto" que a média típica ainda não teve como
  // atribuir a um lançamento real) proporcionalmente ao peso histórico de
  // cada categoria — em vez de um único item genérico em "Outros". Sempre
  // soma exatamente `total`, então não quebra a invariante usada em
  // ProjectionExplainer.impactOfRemoving.
  const splitEstimateByCategory=(total,avgByCat,labelFor)=>{
    if(total<=0.005)return[];
    const positive=Object.entries(avgByCat).filter(([,v])=>v>0.005);
    const sum=positive.reduce((s,[,v])=>s+v,0);
    if(sum<=0.005)return[{label:labelFor("Outros"),value:total,cat:"Outros",kind:"estimado"}];
    return positive.map(([cat,v])=>({label:labelFor(cat),value:total*(v/sum),cat,kind:"estimado"}));
  };

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
    // Patrimônio (saldo + líquido investido, a mesma conta do Início) no fim
    // de cada um dos `n` meses que terminam em `endMonthKey`. Só o realizado:
    // quem chama passa as transações com data <= hoje.
    // ponytail: refaz as contas para cada mês (O(n·meses)); acumular numa
    // passada só se o histórico ficar grande a ponto de pesar.
    patrimonyByMonth(tx,endMonthKey,n=12){
      const end=monthIndex(endMonthKey);
      const byIdx=tx.map(t=>[monthIndex(monthKey(t.date)),t]);
      return Array.from({length:n},(_,i)=>{
        const idx=end-n+1+i;
        const upTo=byIdx.filter(([m])=>m<=idx).map(([,t])=>t);
        return{month:monthAt(idx),value:this.totals(upTo).balance+this.investmentNet(upTo),hasData:upTo.length>0};
      });
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
      return Object.values(m).sort((a,b)=>monthIndex(a.month)-monthIndex(b.month));
    },
    // ---- Projeção simétrica de saldo -----------------------------------------
    // Estima o saldo daqui a `daysAhead` dias combinando o saldo atual com o que
    // ainda deve ENTRAR e SAIR em cada mês do horizonte. Para cada mês usa o
    // MAIOR entre a média histórica e o que já está lançado (assim uma conta
    // grande já cadastrada, ou uma renda extra, também contam), descontando o
    // que já aconteceu no mês atual (que já está no saldo). Antes a projeção só
    // somava renda futura sem estimar o gasto, deixando o "quanto posso gastar"
    // irrealista (positivo demais).
    projectionAtDetailed({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead}){
      const endDate=addDaysStr(todayISO,daysAhead);
      const endMk=monthKey(endDate);
      let idxCur=monthIndex(currentMonthKey);
      let idxEnd=monthIndex(endMk);
      if(idxEnd<idxCur)idxEnd=idxCur;
      const {avgIn,avgOut}=typicalMonthly(transactions,currentMonthKey);
      const avgByCat=typicalMonthlyByCategory(transactions,currentMonthKey);
      const sumIf=(pred)=>sumVal(transactions.filter(pred));
      let incTotal=0,outTotal=0;
      const incomeItems=[],outItems=[],plannedItems=[];
      for(let i=idxCur;i<=idxEnd;i++){
        const mk=monthAt(i);
        const isCur=i===idxCur;
        // Já realizado neste mês (data <= hoje): já está embutido no saldo atual.
        const alreadyIn=isCur?sumIf(t=>isEntradaReal(t)&&monthKey(t.date)===mk&&t.date<=todayISO):0;
        const alreadyOut=isCur?(sumIf(t=>(isSaidaReal(t)||isAporte(t))&&monthKey(t.date)===mk&&t.date<=todayISO)-sumIf(t=>isResgate(t)&&monthKey(t.date)===mk&&t.date<=todayISO)):0;
        // Lançamentos já cadastrados com data futura, dentro da janela.
        const futInTx=transactions.filter(t=>isEntradaReal(t)&&monthKey(t.date)===mk&&t.date>todayISO&&t.date<=endDate);
        const futOutTx=transactions.filter(t=>(isSaidaReal(t)||isAporte(t))&&monthKey(t.date)===mk&&t.date>todayISO&&t.date<=endDate);
        const futIn=sumVal(futInTx);
        const futOut=sumVal(futOutTx)-sumIf(t=>isResgate(t)&&monthKey(t.date)===mk&&t.date>todayISO&&t.date<=endDate);
        const plannedList=plannedExpenses.filter(p=>PlannedStatus.appliesTo(p,mk)&&PlannedStatus.isPending(p,mk));
        const plannedPending=plannedList.reduce((s,p)=>s+p.val,0);
        // Total esperado do mês = o maior entre a média típica e o já conhecido.
        const fullIn=Math.max(avgIn,alreadyIn+futIn);
        const fullOut=Math.max(avgOut,alreadyOut+futOut+plannedPending);
        const contribIn=Math.max(0,fullIn-alreadyIn);   // só o que ainda falta entrar
        const contribOut=Math.max(0,fullOut-alreadyOut); // só o que ainda falta sair
        incTotal+=contribIn;outTotal+=contribOut;
        // ---- Itemização (detalhamento): lista os lançamentos futuros e os
        // previstos concretos, e mostra o restante como estimativa típica. A soma
        // dos itens é igual à contribuição do mês — não duplica no total.
        futInTx.forEach(t=>incomeItems.push({label:cleanDesc(t.desc),value:t.val,date:t.date,id:t.id,cat:t.cat}));
        const remIn=contribIn-futIn;
        if(remIn>0.005)incomeItems.push({label:`Renda típica estimada · ${mk}`,value:remIn,date:mk,recurring:true});
        plannedList.forEach(p=>plannedItems.push({label:p.desc,value:p.val,recurring:!!p.recurring,month:mk,id:p.id,cat:p.cat}));
        futOutTx.forEach(t=>outItems.push({label:cleanDesc(t.desc),value:t.val,date:t.date,kind:t.installmentId?"parcela":(t.plannedId?"conta":"despesa"),id:t.id,cat:t.cat}));
        const remOut=contribOut-futOut-plannedPending;
        outItems.push(...splitEstimateByCategory(remOut,avgByCat,cat=>`Estimativa (média) · ${cat} · ${mk}`).map(it=>({...it,date:mk})));
      }
      const value=balance+incTotal-outTotal;
      return{value,incomeItems,outItems,plannedItems,totals:{inc:incTotal,outReal:outTotal,plannedOut:0,invAp:0,invRe:0}};
    },
    projectionAt(args){
      return CashFlowAnalyzer.projectionAtDetailed(args).value;
    },
    projections({transactions,plannedExpenses,balance,todayISO,currentMonthKey,horizons=[7,30,60,90]}){
      return horizons.map(d=>({days:d,value:CashFlowAnalyzer.projectionAt({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead:d})}));
    },
    freeBalance({transactions,plannedExpenses,balance,todayISO,currentMonthKey}){
      const futureOut=transactions.filter(t=>t.date>todayISO&&t.type==="Saída"&&t.cat!=="Investimento").reduce((s,t)=>s+t.val,0);
      const plannedPending=plannedExpenses.filter(p=>PlannedStatus.appliesTo(p,currentMonthKey)).reduce((s,p)=>s+(PlannedStatus.isPending(p,currentMonthKey)?p.val:0),0);
      return balance-futureOut-plannedPending;
    },
  };

  // ---- Explicação da projeção para a interface --------------------------
  // Não recalcula nada: pega os MESMOS outItems/plannedItems que já compõem
  // matematicamente o total de projectionAtDetailed (a soma deles bate exato
  // com outTotal — ver comentário acima) e só reorganiza isso pra virar algo
  // que a tela consegue mostrar de forma auditável — agrupado por categoria,
  // com a origem de cada item em português, pronto pra receber ações rápidas.
  // Como a soma dos itens é sempre igual ao total, o impacto de remover um
  // item é uma subtração exata: nenhum risco de esse número divergir da
  // projeção real por arredondamento ou por regra de negócio esquecida.
  const originInfo=item=>{
    if(item.sourceType==="planned")return item.recurring?{code:"recorrente",label:"Despesa recorrente"}:{code:"previsto_mes",label:"Lançamento previsto"};
    if(item.kind==="parcela")return{code:"parcela",label:"Compra parcelada"};
    if(item.kind==="conta")return{code:"conta_lancada",label:"Conta prevista (já lançada)"};
    if(item.kind==="estimado")return{code:"estimativa",label:"Estimativa (média dos últimos meses)"};
    return{code:"lancamento",label:"Lançamento futuro cadastrado"};
  };
  const ProjectionExplainer={
    // mode "window" (padrão): projeção de saldo em N dias (usada em "Quanto
    // você pode gastar"), inclui o saldo atual — netProjection é o saldo
    // projetado nessa data.
    // mode "endOfMonth": resultado esperado do mês corrente (usada em
    // "Previsto no Fim do Mês"), NÃO inclui o saldo — netProjection aqui é
    // receitas menos despesas esperadas do mês, exatamente o que já era
    // mostrado nesse cartão antes de existir este drawer. Cada modo usa a
    // sua própria função "detalhada" do engine, mas os dois convergem pro
    // mesmo formato normalizado logo abaixo — por isso o resto do drawer
    // (agrupamento por categoria, ações rápidas, "e se eu remover") não
    // precisa saber qual dos dois está olhando.
    build({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead,mode="window"}){
      let detailed,netProjection,outTotal,incTotal;
      if(mode==="endOfMonth"){
        const d=ForecastEngine.endOfMonthProjectionDetailed({transactions,plannedExpenses,currentMonthKey});
        detailed={outItems:d?d.outItems:[],plannedItems:d?d.plannedItems:[],incomeItems:d?d.incomeItems:[]};
        incTotal=d?d.inc:0;
        outTotal=d?d.out:0;
        netProjection=d?d.expected:0;
      }else{
        const d=CashFlowAnalyzer.projectionAtDetailed({transactions,plannedExpenses,balance,todayISO,currentMonthKey,daysAhead});
        detailed=d;
        incTotal=d.totals.inc;
        outTotal=d.totals.outReal;
        netProjection=balance+d.totals.inc-d.totals.outReal;
      }
      const normalized=[
        ...detailed.plannedItems.map(i=>({...i,sourceType:"planned"})),
        ...detailed.outItems.map(i=>({...i,sourceType:i.kind==="estimado"?"estimate":"transaction"})),
      ].map((i,idx)=>{
        const origin=originInfo(i);
        return{
          key:`${i.sourceType}-${i.id??"x"}-${i.month??i.date??idx}`,
          id:i.id??null,
          label:i.label,
          value:i.value,
          cat:i.cat||"Outros",
          date:i.date||null,
          month:i.month||currentMonthKey,
          recurring:!!i.recurring,
          kind:i.kind||null,
          sourceType:i.sourceType,
          originCode:origin.code,
          originLabel:origin.label,
          editable:i.sourceType!=="estimate",
        };
      });
      const groupsMap={};
      normalized.forEach(i=>{
        if(!groupsMap[i.cat])groupsMap[i.cat]={cat:i.cat,total:0,items:[]};
        groupsMap[i.cat].total+=i.value;
        groupsMap[i.cat].items.push(i);
      });
      const groups=Object.values(groupsMap).sort((a,b)=>b.total-a.total).map(g=>({...g,items:[...g.items].sort((a,b)=>b.value-a.value)}));
      return{
        mode,
        daysAhead,
        balance,
        incTotal,
        outTotal,
        netProjection,
        items:normalized,
        groups,
        incomeItems:detailed.incomeItems,
      };
    },
    // Soma dos itens === outTotal sempre, então tirar um item específico do
    // total é subtração direta — não precisa reprocessar a projeção inteira
    // (e por isso não tem como esse "e se" divergir do valor real depois).
    // Vale para os dois modos: em "window" o saldo entra igual dos dois
    // lados e cancela; em "endOfMonth" nem existe saldo na conta.
    impactOfRemoving(explain,item){
      return{outTotal:explain.outTotal-item.value,netProjection:explain.netProjection+item.value};
    },
  };

  const BudgetAnalyzer={
    itemsForMonth(plannedExpenses,month){return plannedExpenses.filter(p=>PlannedStatus.appliesTo(p,month));},
    stats(items,month){
      let total=0,paid=0,ignored=0;
      items.forEach(p=>{
        total+=p.val;
        if(PlannedStatus.isPaid(p,month))paid+=p.val;
        else if(PlannedStatus.isIgnored(p,month))ignored+=p.val;
      });
      return{total,paid,ignored,pending:total-paid-ignored};
    },
    committedForMonth({transactions,plannedExpenses,month,todayISO}){
      let total=0;
      transactions.forEach(t=>{if(t.installmentId&&monthKey(t.date)===month&&t.date>=todayISO)total+=t.val;});
      plannedExpenses.forEach(p=>{
        if(PlannedStatus.appliesTo(p,month)&&PlannedStatus.isPending(p,month))total+=p.val;
      });
      return total;
    },
    committedNextMonths({transactions,plannedExpenses,currentMonthKey,todayISO,count}){
      const idx=monthIndex(currentMonthKey);
      let total=0;
      for(let i=0;i<count;i++){const mk=monthAt(idx+i);if(mk)total+=BudgetAnalyzer.committedForMonth({transactions,plannedExpenses,month:mk,todayISO});}
      return total;
    },
    subscriptions(plannedExpenses,month){
      // assinaturas em vigor neste mês (as encerradas pelo "Até" saem do total)
      const recurring=plannedExpenses.filter(p=>p.recurring&&PlannedStatus.appliesTo(p,month));
      if(recurring.length===0)return null;
      const total=sumVal(recurring);
      const biggest=[...recurring].sort((a,b)=>b.val-a.val)[0];
      const pendingThisMonth=recurring.filter(p=>PlannedStatus.isPending(p,month));
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
    fixedVarSplit(filteredTx){
      let fixed=0,variavel=0;
      filteredTx.forEach(t=>{
        if(t.type!=="Saída"||t.cat==="Investimento")return;
        if(t.fixed==="Fixa")fixed+=t.val;else variavel+=t.val;
      });
      return{fixed,variavel};
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
        // Quantos meses "de verdade" (fracionário). estMonths arredonda pra cima,
        // então metas de R$ 27 e de R$ 260 caíam ambas em "~1 meses" quando o
        // ritmo de economia cobre as duas dentro do mesmo mês. Guardar a fração
        // deixa a UI distinguir "menos de 1 mês" de "cerca de 1 mês".
        const estMonthsExact=monthlyByAvg&&remaining>0?remaining/monthlyByAvg:null;
        let etaDate=null;
        if(estMonths){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+estMonths);etaDate=`${MONTHS_ARR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;}
        const fasterMonths=(monthlyByAvg&&remaining>0)?Math.ceil(remaining/(monthlyByAvg*1.5)):null;
        const timeSaved=(estMonths!==null&&fasterMonths!==null)?Math.max(0,estMonths-fasterMonths):null;
        return{...w,remaining,pct,monthlyByTarget,estMonths,estMonthsExact,etaDate,fasterMonths,timeSaved};
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
          if(!mk||!PlannedStatus.appliesTo(p,mk)||!PlannedStatus.isPending(p,mk))return;
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
          const isRelevant=PlannedStatus.appliesTo(p,currentMonthKey);
          if(isRelevant&&PlannedStatus.isPending(p,currentMonthKey))list.push({type:"previsto",text:`${p.desc} ainda não foi paga este mês.`});
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
    // ---- Versão "detalhada": expõe os MESMOS itens que já compõem inc/out
    // (mesmo padrão de CashFlowAnalyzer.projectionAtDetailed — ver comentário
    // lá em cima). endOfMonthProjection() abaixo passou a DELEGAR pra cá, então
    // o valor numérico que ela devolve continua idêntico a antes (mesmos
    // testes, mesmo resultado); o que ganhamos é um caminho de auditoria para
    // a interface montar o drawer de "Previsto no Fim do Mês".
    endOfMonthProjectionDetailed({transactions,plannedExpenses,currentMonthKey}){
      const monthTx=transactions.filter(t=>monthKey(t.date)===currentMonthKey);
      const {avgIn,avgOut}=typicalMonthly(transactions,currentMonthKey);
      const avgByCat=typicalMonthlyByCategory(transactions,currentMonthKey);
      if(monthTx.length===0&&plannedExpenses.length===0&&avgIn===0&&avgOut===0)return null;
      const inSoFar=sumVal(monthTx.filter(isEntradaReal));
      const outSoFar=sumVal(monthTx.filter(isSaidaReal))+sumVal(monthTx.filter(isAporte))-sumVal(monthTx.filter(isResgate));
      const plannedList=plannedExpenses.filter(p=>PlannedStatus.appliesTo(p,currentMonthKey)&&PlannedStatus.isPending(p,currentMonthKey));
      const plannedPending=plannedList.reduce((s,p)=>s+p.val,0);
      const inc=Math.max(avgIn,inSoFar);
      const out=Math.max(avgOut,outSoFar+plannedPending);
      const incomeItems=monthTx.filter(isEntradaReal).map(t=>({label:cleanDesc(t.desc),value:t.val,date:t.date,id:t.id,cat:t.cat}));
      const remIn=inc-inSoFar;
      if(remIn>0.005)incomeItems.push({label:`Renda típica estimada · ${currentMonthKey}`,value:remIn,date:currentMonthKey,recurring:true});
      // Mesma forma de CashFlowAnalyzer.projectionAtDetailed: outItems são
      // transações reais, plannedItems são os previstos — separados, pra
      // ProjectionExplainer.build tratar os dois modos (por dias / fim do mês)
      // com o mesmo código de agrupamento.
      const outItems=monthTx.filter(t=>isSaidaReal(t)||isAporte(t)).map(t=>({label:cleanDesc(t.desc),value:t.val,date:t.date,id:t.id,cat:t.cat,kind:t.installmentId?"parcela":(t.plannedId?"conta":"despesa")}));
      const plannedItems=plannedList.map(p=>({label:p.desc,value:p.val,recurring:!!p.recurring,month:currentMonthKey,id:p.id,cat:p.cat}));
      // Igual ao remOut de projectionAtDetailed: se resgates de investimento
      // caíram nesse mês, eles reduzem outSoFar sem virar um item visível —
      // a diferença aparece embutida nesta estimativa, do mesmo jeito que já
      // acontece (mesma limitação, não uma nova) na projeção por dias.
      const remOut=out-outSoFar-plannedPending;
      outItems.push(...splitEstimateByCategory(remOut,avgByCat,cat=>`Estimativa (média) · ${cat} · restante do mês`));
      return{expected:inc-out,inc,out,plannedPending,incomeItems,outItems,plannedItems};
    },
    // Simétrico: renda esperada do mês = maior entre a média típica e o que já
    // entrou; gasto esperado = maior entre a média típica e (o que já saiu +
    // previstos pendentes). Assim o "previsto no fim do mês" não fica otimista
    // por só somar a renda esperada sem estimar o gasto que ainda vem.
    endOfMonthProjection({transactions,plannedExpenses,currentMonthKey}){
      const d=ForecastEngine.endOfMonthProjectionDetailed({transactions,plannedExpenses,currentMonthKey});
      if(!d)return null;
      return{expected:d.expected,inc:d.inc,out:d.out,plannedPending:d.plannedPending};
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
      const pendingItems=items.filter(p=>PlannedStatus.isPending(p,month)).map(p=>({label:p.desc,value:p.val,tag:p.recurring?"Assinatura":"Conta prevista"})).sort((a,b)=>b.value-a.value);
      const paidItems=items.filter(p=>PlannedStatus.isPaid(p,month)).map(p=>({label:p.desc,value:p.val,tag:"Pago"})).sort((a,b)=>b.value-a.value);
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
        value:w.estMonths!==null?formatMonths(w.estMonths,w.estMonthsExact):"sem estimativa",
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

  return{CashFlowAnalyzer,BudgetAnalyzer,ExpenseAnalyzer,IncomeAnalyzer,InvestmentAnalyzer,GoalAnalyzer,ForecastEngine,HealthScoreEngine,DecisionEngine,SimulationEngine,ProjectionExplainer};
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
export const InsightEngine=(()=>{
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
  // Agrupa por descrição normalizada E por direção financeira. A direção faz
  // parte da identidade do hábito: "Brasileiríssimo" entrando é uma receita
  // recorrente, "Brasileiríssimo" saindo seria um gasto recorrente — são dois
  // hábitos diferentes, mesmo com o nome igual, e nunca podem cair no mesmo
  // cluster (senão o `type` do grupo passa a depender de qual lançamento veio
  // por último, que foi exatamente como nascia o texto errado). Movimentação
  // interna (investimento) fica fora: não é hábito de consumo nem de renda.
  const buildDescMemory=(transactions,currentMonthKey)=>{
    const currentIdx=monthIndex(currentMonthKey);
    const rawGroups={};
    transactions.forEach(t=>{
      const flow=flowOf(t);
      if(flow===FLOW.INTERNA)return;
      const key=normKey(t.desc);
      if(!key)return;
      const groupKey=`${flow}::${key}`;
      if(!rawGroups[groupKey])rawGroups[groupKey]={flow,key,txs:[]};
      rawGroups[groupKey].txs.push(t);
    });
    const sortedKeys=Object.keys(rawGroups).sort((a,b)=>rawGroups[b].txs.length-rawGroups[a].txs.length);
    const clusters=[];
    sortedKeys.forEach(gk=>{
      const g=rawGroups[gk];
      let found=null;
      for(const cl of clusters){
        // Só funde descrições parecidas se forem da MESMA direção.
        if(cl.flow===g.flow&&g.key.length>=3&&(cl.rep.includes(g.key)||g.key.includes(cl.rep))){found=cl;break;}
      }
      if(found)found.txs.push(...g.txs);
      else clusters.push({rep:g.key,flow:g.flow,txs:[...g.txs]});
    });
    return clusters.map(cl=>{
      const txs=[...cl.txs].sort((a,b)=>a.date.localeCompare(b.date));
      const monthsPresent=[...new Set(txs.map(t=>monthKey(t.date)))];
      const monthIdxs=monthsPresent.map(mk=>monthIndex(mk)).filter(i=>i>=0);
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
        // `flow` vem do cluster, não do último lançamento: todos os itens do
        // grupo têm a mesma direção por construção, então isso é estável.
        flow:cl.flow,words:wordsFor(cl.flow),
        isHabitLike,status,count:txs.length,lastVal:last.val,avgVal,sampleTxs,
      };
    }).filter(Boolean);
  };

  // ---- Ciclo de vida das categorias: ativa / inativa / emergente ----
  const buildCategoryLifecycle=(transactions,currentMonthKey)=>{
    const currentIdx=monthIndex(currentMonthKey);
    const byCat={};
    transactions.forEach(t=>{
      if(t.type!=="Saída"||t.cat==="Investimento")return;
      if(!byCat[t.cat])byCat[t.cat]={monthly:{}};
      const mk=monthKey(t.date);
      byCat[t.cat].monthly[mk]=(byCat[t.cat].monthly[mk]||0)+t.val;
    });
    return Object.entries(byCat).map(([cat,d])=>{
      const idxs=Object.keys(d.monthly).map(mk=>monthIndex(mk)).filter(i=>i>=0);
      if(idxs.length===0)return null;
      const lastIdx=Math.max(...idxs);
      const firstIdx=Math.min(...idxs);
      const gap=currentIdx-lastIdx;
      let status="ativa";
      if(gap>=3)status="inativa";
      else if(idxs.length<=2&&firstIdx>=currentIdx-1)status="emergente";
      const lastMonthKey=Object.keys(d.monthly).find(mk=>monthIndex(mk)===lastIdx);
      return{cat,firstIdx,lastIdx,gap,status,monthsCount:idxs.length,lastVal:lastMonthKey?d.monthly[lastMonthKey]:0};
    }).filter(Boolean);
  };

  // `maxDay` recorta TODOS os meses no mesmo dia — é o que torna a comparação
  // "1–4 de agosto vs 1–4 de julho vs 1–4 de junho" possível. Sem ele, o mês
  // corrente (parcial) era comparado com meses inteiros.
  const monthlyCategoryTotals=(transactions,maxDay=null)=>{
    const m={};
    transactions.forEach(t=>{
      if(t.type!=="Saída"||t.cat==="Investimento")return;
      if(maxDay!==null){
        const d=dayOfMonthOf(t.date);
        if(d===null||d>maxDay)return;
      }
      const mk=monthKey(t.date);
      if(!m[t.cat])m[t.cat]={};
      m[t.cat][mk]=(m[t.cat][mk]||0)+t.val;
    });
    return m;
  };

  const catWeightedAvg=(catMonthly,currentIdx)=>{
    let wsum=0,vsum=0,n=0;
    Object.entries(catMonthly).forEach(([mk,val])=>{
      const idx=monthIndex(mk);
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
    const{transactions,currentMonthKey,catMonthly,catMonthlyToDate,monthProg}=ctx;
    const currentIdx=monthIndex(currentMonthKey);
    const monthLabel=monthNameMap[currentMonthKey.split("/")[0]]||currentMonthKey;
    const out=[];
    // Mês em andamento -> base recortada no mesmo dia em todos os meses, e o
    // texto fala em tendência. Mês fechado -> base cheia e texto de fato
    // consumado. A escolha da BASE e a escolha das PALAVRAS saem da mesma
    // condição, então é impossível uma divergir da outra.
    const done=!!monthProg?.isComplete;
    const base=done?catMonthly:(catMonthlyToDate||catMonthly);
    const dayN=monthProg?.dayOfMonth??null;
    const periodLabel=done?monthLabel:`até o dia ${dayN} de ${monthLabel}`;
    const sameWindow=done?"":` (mesmo período: dias 1 a ${dayN})`;
    const analyzed=Object.keys(base).map(cat=>{
      const monthly=base[cat];
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
          title:done?`${a.cat} acima do normal`:`${a.cat} acima do ritmo normal`,
          heroNumber:{value:a.delta,format:"currency",sign:"+"},
          comparison:{aLabel:done?"Sua média":"Média até o dia "+dayN,aValue:a.avg,bLabel:done?monthLabel:`Dia ${dayN}`,bValue:a.curVal},
          explanation:done
            ?`Você gastou ${fmt(a.curVal)} em ${a.cat} neste mês — ${a.pct}% acima da sua média recente de ${fmt(a.avg)}.`
            :`Até o dia ${dayN}, você gastou ${fmt(a.curVal)} em ${a.cat} — ${a.pct}% acima do que costuma ter gasto a essa altura do mês (${fmt(a.avg)}). ${monthLabel} ainda não terminou, então isso é um ritmo, não um resultado final.`,
          reason:topTx.length>0
            ?`O aumento foi causado principalmente por ${topTx.map(t=>t.label).slice(0,2).join(" e ")}.${wknd>=0.5?` ${Math.round(wknd*100)}% desses gastos aconteceram em finais de semana.`:""}`
            :(wknd>=0.5?`Boa parte aconteceu em gastos concentrados nos finais de semana (${Math.round(wknd*100)}% do total).`:"O aumento se espalhou ao longo do mês, sem um padrão claro de dia."),
          recommendation:done
            ?`Se voltar para sua média de ${fmt(a.avg)}, você poderia economizar cerca de ${fmt(suggestion)} por mês.`
            :`Segurando o ritmo daqui pra frente, dá pra fechar o mês perto da sua média habitual.`,
          confidence:a.monthsUsed>=4?"alta":"media",
          breakdown:{
            lineItems:topTx,
            calcRows:[
              {label:done?"Sua média recente":`Sua média até o dia ${dayN}`,value:fmt(a.avg)},
              {label:done?`Gasto em ${monthLabel}`:`Gasto até o dia ${dayN}`,value:fmt(a.curVal)},
              {label:"Diferença",value:`+${fmt(a.delta)} (${a.pct}%)`,highlight:true,color:"#EF4444"},
            ],
          },
          evidence:{period:`${periodLabel}${sameWindow}`,categories:[a.cat],dataUsed:["categorias","media","transacoes","periodo"]},
          score:55+Math.min(30,a.pct),
        });
      });

    analyzed.map(a=>({...a,delta:a.avg-a.curVal,pct:a.avg>0?Math.round(((a.avg-a.curVal)/a.avg)*100):null}))
      .filter(a=>a.delta>=50&&a.pct!==null&&a.pct>=20)
      .sort((a,b)=>b.delta-a.delta).slice(0,1)
      .forEach(a=>{
        out.push({
          category:"oportunidade",priority:"baixa",
          // Enquanto o mês corre isso é TENDÊNCIA: o dinheiro ainda pode ser
          // gasto. Nada de "economia", "economizou" ou "deixou de gastar" —
          // essas palavras só entram depois do fechamento, quando viram fato.
          title:done?`Economia em ${a.cat}`:`Tendência: ${a.cat} abaixo da média`,
          heroNumber:{value:a.delta,format:"currency",sign:"-"},
          comparison:{aLabel:done?"Sua média":`Média até o dia ${dayN}`,aValue:a.avg,bLabel:done?monthLabel:`Dia ${dayN}`,bValue:a.curVal},
          explanation:done
            ?`Você gastou ${fmt(a.curVal)} em ${a.cat} neste mês — ${a.pct}% abaixo da sua média recente de ${fmt(a.avg)}. Um bom sinal de controle.`
            :`Até o momento você gastou menos em ${a.cat} do que costuma gastar neste período do mês: ${fmt(a.curVal)} contra ${fmt(a.avg)} de média até o dia ${dayN}. Mantendo esse ritmo, você poderá terminar ${monthLabel} gastando menos que sua média.`,
          reason:done
            ?`Isso é ${a.pct}% a menos que seu padrão recente nessa categoria.`
            :`Comparação feita sobre o mesmo período (dias 1 a ${dayN}) dos meses anteriores. Como ${monthLabel} ainda está em andamento, esse valor pode mudar até o fim do mês.`,
          recommendation:done
            ?`Vale direcionar essa sobra de aproximadamente ${fmt(a.delta)} para sua reserva ou para uma meta.`
            :`Se o ritmo se mantiver até o fim do mês, essa diferença pode virar uma sobra real para sua reserva ou uma meta.`,
          confidence:done?(a.monthsUsed>=4?"alta":"media"):"nova",
          breakdown:{
            calcRows:[
              {label:done?"Sua média recente":`Sua média até o dia ${dayN}`,value:fmt(a.avg)},
              {label:done?`Gasto em ${monthLabel}`:`Gasto até o dia ${dayN}`,value:fmt(a.curVal)},
              {label:done?"Economizado":"Diferença até agora",value:`-${fmt(a.delta)} (${a.pct}%)`,highlight:true,color:"#22C55E"},
            ],
          },
          evidence:{period:`${periodLabel}${sameWindow}`,categories:[a.cat],dataUsed:["categorias","media","periodo"]},
          // Tendência não confirmada vale menos que um fato: pontua abaixo
          // para não ocupar o lugar de um insight consolidado.
          score:(done?45:30)+Math.min(25,a.pct),
        });
      });

    return out;
  };

  // ---- Mudanças de comportamento: hábito cancelado, novo hábito, substituição ----
  const genBehaviorChanges=ctx=>{
    const{descMemory,catLifecycle,currentMonthKey}=ctx;
    const currentIdx=monthIndex(currentMonthKey);
    const out=[];
    const discontinued=descMemory.filter(m=>m.isHabitLike&&m.status==="inativo");
    const emergent=descMemory.filter(m=>m.status==="emergente"||(m.isHabitLike&&m.firstIdx>=currentIdx-2));
    discontinued.forEach(d=>{
      const w=d.words;
      const isRec=d.flow===FLOW.RECEITA;
      // A substituição só faz sentido entre hábitos da MESMA direção: um gasto
      // que vira outro gasto, uma receita que vira outra receita. Trocar uma
      // receita perdida por um gasto novo não é "troca de hábito", é outra
      // coisa — e o texto de troca não descreveria isso corretamente.
      const match=emergent.find(e=>e.cat===d.cat&&e.key!==d.key&&e.flow===d.flow&&e.firstIdx>=d.lastIdx&&e.firstIdx<=d.lastIdx+2);
      const monthLabel=monthNameMap[(monthAt(d.lastIdx)||"").split("/")[0]]||monthAt(d.lastIdx)||"";
      if(match){
        out.push({
          category:"mudanca",priority:"media",
          title:isRec?"Sua fonte de receita mudou":"Novo hábito financeiro detectado",
          heroNumber:match.lastVal?{value:match.lastVal,format:"currency",sign:"none"}:{value:d.count,format:"plain",suffix:" meses",sign:"none"},
          explanation:isRec
            ?`Você deixou de receber de ${d.desc} e passou a receber de ${match.desc}, mantido desde ${monthLabel}.`
            :`Você deixou de gastar com ${d.desc} e passou a ter gastos com ${match.desc}, mantido desde ${monthLabel}.`,
          reason:isRec
            ?"Uma entrada recorrente parou e outra começou logo em seguida, na mesma categoria — por isso entendemos como uma troca de fonte de renda."
            :"Um gasto recorrente parou e outro começou logo em seguida, na mesma categoria — por isso entendemos como uma troca de hábito.",
          recommendation:isRec
            ?`Vale conferir se ${match.desc} substitui integralmente o que você recebia de ${d.desc}.`
            :`Vale conferir se ${match.desc} realmente compensa financeiramente frente ao que era gasto antes com ${d.desc}.`,
          confidence:d.isHabitLike?"alta":"media",
          breakdown:{
            lineItems:[...(d.sampleTxs||[]).map(t=>({...t,tag:"antigo"})),...(match.sampleTxs||[]).map(t=>({...t,tag:"novo"}))],
          },
          evidence:{period:`desde ${monthLabel}`,categories:[d.cat],dataUsed:["transacoes","categorias","periodo"]},
          score:70,
        });
      }else{
        out.push({
          category:isRec?"atencao":"mudanca",
          // Perder uma receita recorrente é mais relevante que perder um gasto:
          // gasto que some é dinheiro que sobra, receita que some é dinheiro
          // que falta. Por isso prioridade e pontuação maiores nesse caso.
          priority:isRec?"media":"baixa",
          title:w.stoppedTitle(d.desc),
          heroNumber:d.lastVal?{value:d.lastVal,format:"currency",sign:isRec?"none":"-"}:{value:d.count,format:"plain",suffix:" meses",sign:"none"},
          explanation:`${w.stoppedSentence(d.desc,monthLabel)} ${w.stoppedDetail(d.desc)}`,
          reason:`Essa ${isRec?"entrada":"saída"} apareceu em ${d.count} lançamento(s) ao longo de vários meses e não aparece mais recentemente.`,
          recommendation:isRec
            ?`Se essa receita não vai voltar, vale rever seu orçamento — ele provavelmente contava com ela.`
            :`Considere realocar o valor que ia para ${d.desc} para uma meta ou investimento.`,
          confidence:d.isHabitLike?"alta":"media",
          breakdown:{lineItems:d.sampleTxs||[]},
          evidence:{period:`desde ${monthLabel}`,categories:[d.cat],dataUsed:["transacoes","periodo"]},
          score:isRec?72:50,
        });
      }
    });
    descMemory.filter(m=>m.isHabitLike&&m.status==="ativo"&&m.firstIdx>=currentIdx-3).slice(0,2).forEach(h=>{
      const n=currentIdx-h.firstIdx+1;
      const w=h.words;
      const isRec=h.flow===FLOW.RECEITA;
      out.push({
        category:isRec?"oportunidade":"mudanca",priority:"baixa",
        title:w.startedTitle(h.desc),
        // Uma receita nova é dinheiro a mais (sinal "+"); um gasto novo é
        // dinheiro a menos. O sinal estava "+" para os dois — errado para gasto.
        heroNumber:h.lastVal?{value:h.lastVal,format:"currency",sign:isRec?"+":"-"}:{value:n,format:"plain",suffix:" meses",sign:"none"},
        explanation:w.startedSentence(h.desc,n),
        reason:isRec
          ?"Detectamos a mesma descrição de entrada se repetindo em meses consecutivos."
          :"Detectamos a mesma descrição de gasto se repetindo em meses consecutivos.",
        recommendation:isRec
          ?`Se essa entrada for fixa, dá pra contar com ela no seu planejamento mensal.`
          :`Se for um gasto fixo, vale já planejá-lo no seu orçamento mensal.`,
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
        const pendingItems=(plannedItemsForMonth||[]).filter(p=>PlannedStatus.isPending(p,plannedMonth)).map(p=>({label:p.desc,value:p.val,tag:p.recurring?"Assinatura":"Conta prevista"})).sort((a,b)=>b.value-a.value);
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
      const currentIdx=monthIndex(currentMonthKey);
      const prevMk=monthAt(currentIdx-1);
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
    const currentIdx=monthIndex(currentMonthKey);
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
    const closed=summary.filter(m=>monthIndex(m.month)<currentIdx).slice(-4);
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
    const currentIdx=monthIndex(currentMonthKey);
    const aporteByMonth={};
    transactions.forEach(t=>{
      if(t.cat==="Investimento"&&(t.invTipo==="Aporte"||(!t.invTipo&&t.type==="Saída"))){
        const mk=monthKey(t.date);
        aporteByMonth[mk]=(aporteByMonth[mk]||0)+t.val;
      }
    });
    let streak=0;
    for(let i=currentIdx;i>=0;i--){if(aporteByMonth[monthAt(i)]){streak++;}else break;}
    if(streak>=3){
      const streakMonths=[];
      for(let i=currentIdx;i>currentIdx-streak;i--)streakMonths.push({label:monthAt(i),value:aporteByMonth[monthAt(i)]||0,tag:"aporte"});
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
    const{summary,currentMonthKey,patrimonio,monthProg}=ctx;
    const out=[];
    const currentIdx=monthIndex(currentMonthKey);
    const curEntry=summary.find(m=>m.month===currentMonthKey);
    const closed=summary.filter(m=>monthIndex(m.month)<currentIdx).slice(-4);
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
    // "Recorde" é, por definição, um fato de fechamento. Com o mês em
    // andamento o saldo parcial é enganoso — o salário já entrou e boa parte
    // das despesas ainda não saiu, então quase todo início de mês pareceria
    // recorde. Só afirmamos depois que o mês fecha.
    if(curEntry&&closed.length>=2&&monthProg?.isComplete){
      const bestPrev=Math.max(...closed.map(m=>m.balance));
      if(curEntry.balance>0&&curEntry.balance>bestPrev){
        out.push({
          category:"conquista",priority:"alta",
          title:"Novo recorde de saldo mensal",
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
    // Enquanto o mês corre, as comparações usam a base recortada no dia de
    // hoje (mesmo dia em todos os meses). Quando o mês fecha, as duas bases
    // coincidem e a comparação plena volta a valer sozinha.
    const prog=monthProgress(ctx.todayISO,currentMonthKey);
    const catMonthlyToDate=prog.isComplete?catMonthly:monthlyCategoryTotals(ctx.transactions,prog.dayOfMonth);
    const fullCtx={...ctx,descMemory,catLifecycle,catMonthly,catMonthlyToDate,monthProg:prog};

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
    const{transactions,currentMonthKey,summary,enhancedWishes,plannedStats,patrimonio,todayISO}=ctx;
    const currentIdx=monthIndex(currentMonthKey);
    const curEntry=summary.find(m=>m.month===currentMonthKey);
    if(!curEntry)return null;
    // Mesma regra temporal dos insights: com o mês em andamento o saldo
    // parcial não pode ser narrado como resultado fechado ("foi um mês...",
    // "você economizou"). Vira leitura de andamento.
    const prog=monthProgress(todayISO,currentMonthKey);
    const done=prog.isComplete;
    const descMemory=buildDescMemory(transactions,currentMonthKey);
    const monthName=monthNameMap[currentMonthKey.split("/")[0]]||currentMonthKey;

    const closed=summary.filter(m=>monthIndex(m.month)<currentIdx).slice(-6);
    const histAvgBalance=closed.length?closed.reduce((s,m)=>s+m.balance,0)/closed.length:null;
    const bestPrev=closed.length?Math.max(...closed.map(m=>m.balance)):null;

    let sentence1=done
      ?`${monthName} foi um mês ${curEntry.balance>=0?"positivo":"mais apertado"}.`
      :`Até aqui, ${monthName} vem sendo um mês ${curEntry.balance>=0?"positivo":"mais apertado"}.`;
    let sentence2=null;
    // Patrimônio é um saldo do momento (estoque), não um resultado do mês:
    // dizer que ele "está" em um recorde é verdade em qualquer dia. Já
    // "economizou" descreve o fechamento de um fluxo — só depois do mês.
    if(bestPrev!==null&&curEntry.balance>0&&curEntry.balance>bestPrev&&done){
      sentence2="Seu patrimônio atingiu um novo recorde neste mês.";
    }else if(histAvgBalance!==null&&curEntry.balance>histAvgBalance){
      sentence2=done
        ?"Você economizou mais do que sua média histórica recente."
        :"No ritmo atual, seu saldo está acima da sua média histórica para este ponto do mês.";
    }else if(histAvgBalance!==null&&curEntry.balance<histAvgBalance*0.7){
      sentence2=done
        ?"Você economizou menos do que costuma economizar em média."
        :"No ritmo atual, seu saldo está abaixo do que você costuma ter guardado nesta altura.";
    }else{
      const habitChange=descMemory.find(m=>m.isHabitLike&&m.status==="inativo");
      if(habitChange){
        sentence2=habitChange.flow===FLOW.RECEITA
          ?`Percebemos uma mudança: as entradas de ${habitChange.desc} deixaram de ocorrer.`
          :`Percebemos um novo hábito financeiro: os gastos com ${habitChange.desc} pararam.`;
      }
    }
    if(!sentence2&&plannedStats&&plannedStats.total>0){
      const usedPct=Math.round((plannedStats.paid/plannedStats.total)*100);
      sentence2=done
        ?(usedPct<100?"Você permaneceu dentro do orçamento previsto para o mês.":"Você ultrapassou o orçamento previsto para o mês.")
        :(usedPct<100?`Você já usou ${usedPct}% do orçamento previsto para o mês.`:"Você já ultrapassou o orçamento previsto para o mês.");
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

export { fmt, monthKey, addDaysStr, diffDays, MONTH_ORDER, MONTHS_ARR };
