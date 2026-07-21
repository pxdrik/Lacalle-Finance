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
const monthKey=d=>{try{const dt=new Date(d+"T12:00:00");return`${MONTHS_ARR[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`;}catch{return"???";}};
const addDaysStr=(dateStr,n)=>{const d=new Date(dateStr+"T12:00:00");d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const diffDays=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000);

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
    const currentIdx=MONTH_ORDER.indexOf(currentMonthKey);
    const inByIdx={},outByIdx={};
    transactions.forEach(t=>{
      const idx=MONTH_ORDER.indexOf(monthKey(t.date));
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
      let idxCur=MONTH_ORDER.indexOf(currentMonthKey);
      let idxEnd=MONTH_ORDER.indexOf(endMk);
      if(idxEnd<idxCur)idxEnd=idxCur;
      const {avgIn,avgOut}=typicalMonthly(transactions,currentMonthKey);
      const sumIf=(pred)=>sumVal(transactions.filter(pred));
      let incTotal=0,outTotal=0;
      const incomeItems=[],outItems=[],plannedItems=[];
      for(let i=idxCur;i<=idxEnd;i++){
        const mk=MONTH_ORDER[i];
        const isCur=i===idxCur;
        // Já realizado neste mês (data <= hoje): já está embutido no saldo atual.
        const alreadyIn=isCur?sumIf(t=>isEntradaReal(t)&&monthKey(t.date)===mk&&t.date<=todayISO):0;
        const alreadyOut=isCur?(sumIf(t=>(isSaidaReal(t)||isAporte(t))&&monthKey(t.date)===mk&&t.date<=todayISO)-sumIf(t=>isResgate(t)&&monthKey(t.date)===mk&&t.date<=todayISO)):0;
        // Lançamentos já cadastrados com data futura, dentro da janela.
        const futInTx=transactions.filter(t=>isEntradaReal(t)&&monthKey(t.date)===mk&&t.date>todayISO&&t.date<=endDate);
        const futOutTx=transactions.filter(t=>(isSaidaReal(t)||isAporte(t))&&monthKey(t.date)===mk&&t.date>todayISO&&t.date<=endDate);
        const futIn=sumVal(futInTx);
        const futOut=sumVal(futOutTx)-sumIf(t=>isResgate(t)&&monthKey(t.date)===mk&&t.date>todayISO&&t.date<=endDate);
        const plannedList=plannedExpenses.filter(p=>p.recurring?!p.paid?.[mk]:(p.month===mk&&!p.paid?.[mk]));
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
        futInTx.forEach(t=>incomeItems.push({label:cleanDesc(t.desc),value:t.val,date:t.date}));
        const remIn=contribIn-futIn;
        if(remIn>0.005)incomeItems.push({label:`Renda típica estimada · ${mk}`,value:remIn,date:mk,recurring:true});
        plannedList.forEach(p=>plannedItems.push({label:p.desc,value:p.val,recurring:!!p.recurring,month:mk}));
        futOutTx.forEach(t=>outItems.push({label:cleanDesc(t.desc),value:t.val,date:t.date,kind:t.installmentId?"parcela":(t.plannedId?"conta":"despesa")}));
        const remOut=contribOut-futOut-plannedPending;
        if(remOut>0.005)outItems.push({label:`Gasto típico estimado · ${mk}`,value:remOut,date:mk,kind:"estimado"});
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
      const {avgIn,avgOut}=typicalMonthly(transactions,currentMonthKey);
      if(monthTx.length===0&&plannedExpenses.length===0&&avgIn===0&&avgOut===0)return null;
      const inSoFar=sumVal(monthTx.filter(isEntradaReal));
      const outSoFar=sumVal(monthTx.filter(isSaidaReal))+sumVal(monthTx.filter(isAporte))-sumVal(monthTx.filter(isResgate));
      const plannedPending=plannedExpenses.filter(p=>p.recurring||p.month===currentMonthKey).reduce((s,p)=>s+(p.paid?.[currentMonthKey]?0:p.val),0);
      // Simétrico: renda esperada do mês = maior entre a média típica e o que já
      // entrou; gasto esperado = maior entre a média típica e (o que já saiu +
      // previstos pendentes). Assim o "previsto no fim do mês" não fica otimista
      // por só somar a renda esperada sem estimar o gasto que ainda vem.
      const inc=Math.max(avgIn,inSoFar);
      const out=Math.max(avgOut,outSoFar+plannedPending);
      return{expected:inc-out,inc,out,plannedPending};
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

export { fmt, monthKey, addDaysStr, diffDays, MONTH_ORDER, MONTHS_ARR };
