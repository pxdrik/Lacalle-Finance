// ============================================================================
// ui.jsx — biblioteca de componentes de interface compartilhados.
//
// Tudo aqui é puramente apresentacional: recebe dados via props e não
// conhece nada sobre transações, desejos, Supabase etc. Cada aba do app
// importa daqui em vez de redefinir os mesmos componentes.
// ============================================================================
import { useState, useRef, useEffect, forwardRef } from "react";
import { Tag, Check, ChevronDown, ChevronUp, Info, Lightbulb, Gamepad2, UtensilsCrossed, Car, Sparkles, Shirt, Laptop, HeartPulse, GraduationCap, Briefcase, Package, TrendingUp, Repeat, Undo2, Gift, ArrowRight } from "lucide-react";
import { fmt } from "../lib/financialEngine";
import { BG, CARD, C2, BD, BD2, TX, TX2, TX3, HDR, TEAL, TEAL2, R_BTN, R_INPUT, R_CHIP, R_MODAL, SH_SM, SH_MD, SH_LG, SI, cardStyle, useAccent, NUM_FONT, EASE_OUT, SUCCESS, WARNING, ERROR } from "../lib/theme";
import LogoSymbol from "./LogoSymbol";

const CAT_ICON_COMPONENTS={
  "Lazer":Gamepad2,"Alimentação":UtensilsCrossed,"Transporte":Car,"Desejos":Sparkles,"Roupas":Shirt,
  "Tecnologia":Laptop,"Saude / Cuidados Pessoais":HeartPulse,"Educação":GraduationCap,
  "Salario / Entradas":Briefcase,"Outros":Package,"Investimento":TrendingUp,"Assinaturas":Repeat,
  "Rembolsos":Undo2,"Presentes":Gift,
};

const URL_SPLIT_REGEX=/((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const URL_TEST_REGEX=/^(?:https?:\/\/|www\.)/i;

export const Card=(props)=><div {...props} className={`fc-card ${props.className||""}`} style={{...cardStyle,...props.style}}/>;

// ==================== Modal reutilizável ====================
// Antes, cada popup (excluir, transferir, editar lançamento, busca, perfil,
// dia do calendário...) repetia manualmente o mesmo par de <div> (overlay
// fixo + card central) com pequenas variações de zIndex/largura/alinhamento.
// Esse componente concentra esse padrão num único lugar: menos código
// duplicado e qualquer ajuste visual futuro (ex.: mudar a animação do
// overlay) passa a valer para todos os popups de uma vez.
// Fechar clicando fora precisa considerar ONDE o clique COMEÇOU, não onde
// terminou. Com `onClick={onClose}` no overlay, dois casos fechavam o popup
// sem o usuário pedir:
//   1) durante os 0,25s da animação de entrada o card ainda está deslocado
//      8px e com scale .97 — um clique mirado no botão final cai no overlay e
//      fecha o modal. É o "cliquei em Excluir e não aconteceu nada".
//   2) selecionar texto de dentro do modal e soltar o mouse fora também
//      disparava o fechamento, perdendo o que estava preenchido.
// Guardando o alvo do mousedown, só fecha quem realmente começou o gesto fora.
export const Modal=({onClose,children,maxWidth=420,align="center",zIndex=170,padding=28,scroll=true,contentStyle,label})=>{
  const pressedOnOverlay=useRef(false);
  return(
    <div
      role="presentation"
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",zIndex,display:"flex",alignItems:align==="top"?"flex-start":"center",justifyContent:"center",padding:align==="top"?"10vh 20px 20px":20,animation:"overlayIn .15s ease-out"}}
      onMouseDown={e=>{pressedOnOverlay.current=e.target===e.currentTarget;}}
      onMouseUp={e=>{
        if(pressedOnOverlay.current&&e.target===e.currentTarget)onClose?.();
        pressedOnOverlay.current=false;
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={e=>e.stopPropagation()}
        style={{background:CARD,border:`1px solid ${BD2}`,borderRadius:R_MODAL,padding,width:"100%",maxWidth,...(scroll?{maxHeight:"85vh",overflowY:"auto"}:{}),boxShadow:SH_LG,animation:`modalIn .2s ${EASE_OUT}`,...contentStyle}}
      >
        {children}
      </div>
    </div>
  );
};

export function CategoryIcon({cat,size=14,color,catIconMap}){
  const Icon=(catIconMap&&catIconMap[cat])||CAT_ICON_COMPONENTS[cat]||Tag;
  return <Icon size={size} color={color} strokeWidth={2.2}/>;
}

// ---- Contagem animada de números ------------------------------------------
// Um único hook para os dois componentes de número animado, porque os dois
// tinham defeitos distintos com a mesma origem (não guardar o valor exibido):
//
//  * AnimatedValue só atualizava `prevRef` quando a animação chegava ao fim.
//    Se o valor mudasse no meio (salvar dois lançamentos seguidos), a próxima
//    animação recomeçava do valor ANTIGO — dava um salto pra trás na tela.
//
//  * HeroNumberAnimated animava sempre a partir de ZERO. Toda vez que um card
//    de insight recalculava, o número piscava "R$ 0,00" e subia de novo. É o
//    efeito que dava a impressão de que o valor tinha zerado logo após salvar.
//
// Também respeita `prefers-reduced-motion`: quem pediu menos animação no
// sistema recebe o valor final direto, sem contagem.
const prefersReducedMotion=()=>
  typeof window!=="undefined"&&
  typeof window.matchMedia==="function"&&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useCountUp(value,duration=520){
  const target=Number.isFinite(value)?value:0;
  const [display,setDisplay]=useState(target);
  const displayRef=useRef(target);
  useEffect(()=>{
    const start=displayRef.current;
    if(start===target)return;
    if(prefersReducedMotion()){displayRef.current=target;setDisplay(target);return;}
    const startTime=performance.now();
    let raf;
    const step=now=>{
      const t=Math.min(1,(now-startTime)/duration);
      const eased=1-Math.pow(1-t,3);
      const next=start+(target-start)*eased;
      displayRef.current=next;   // sempre atualizado, mesmo se interrompido
      setDisplay(next);
      if(t<1)raf=requestAnimationFrame(step);
      else{displayRef.current=target;setDisplay(target);}
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[target,duration]);
  return display;
}

export function AnimatedValue({value}){
  const display=useCountUp(value);
  return <span style={{fontFamily:NUM_FONT,fontVariantNumeric:"tabular-nums"}}>{fmt(display)}</span>;
}

// ---- Progress motion (pág. 37) ----------------------------------------
// "Dados não aparecem prontos: eles se constroem." A barra nunca nasce já
// preenchida — na primeira vez que aparece na tela ela parte de 0% e sobe
// até o valor real em 600ms com LaCalle Ease Out. Atualizações depois disso
// (usuário editou o valor) só fazem a barra deslizar do width antigo pro
// novo — sem resetar a animação de novo, senão toda edição faria a barra
// "piscar" de volta a zero.
export function ProgressBar({pct,color,trackColor,height=8,radius=R_CHIP,duration=600,style}){
  const target=Math.max(0,Math.min(100,Number.isFinite(pct)?pct:0));
  const [width,setWidth]=useState(0);
  const mountedRef=useRef(false);
  useEffect(()=>{
    if(prefersReducedMotion()){mountedRef.current=true;setWidth(target);return;}
    if(!mountedRef.current){
      mountedRef.current=true;
      setWidth(0);
      let raf1,raf2;
      raf1=requestAnimationFrame(()=>{raf2=requestAnimationFrame(()=>setWidth(target));});
      return()=>{cancelAnimationFrame(raf1);cancelAnimationFrame(raf2);};
    }
    setWidth(target);
  },[target]);
  return(
    <div style={{background:trackColor||"rgba(255,255,255,0.06)",borderRadius:radius,height,overflow:"hidden",...style}}>
      <div style={{width:`${width}%`,height:"100%",background:color,borderRadius:radius,transition:`width ${duration}ms ${EASE_OUT}`}}/>
    </div>
  );
}

// ---- LaCalle Reveal (pág. 35) -------------------------------------------
// A transição de identidade da marca: o símbolo expande em círculo até
// cobrir a tela e recua revelando o conteúdo por baixo — nunca em
// navegação comum, só em splash, login e abertura do dashboard após
// autenticação (no máximo 1x por sessão). Cor do acento porque quem decide
// o acento é a pessoa, na aba Minha Conta — a marca-mãe não fixa uma cor.
export function LaCalleReveal({accent,duration=1000,hold=250,onDone}){
  const [phase,setPhase]=useState("start"); // start -> in -> hold -> out
  useEffect(()=>{
    if(prefersReducedMotion()){
      const t0=setTimeout(()=>setPhase("out"),10);
      const t1=setTimeout(()=>onDone?.(),130);
      return()=>{clearTimeout(t0);clearTimeout(t1);};
    }
    const outDuration=Math.round(duration*0.7);
    let raf1,raf2;
    raf1=requestAnimationFrame(()=>{raf2=requestAnimationFrame(()=>setPhase("in"));});
    // A expansão termina de verdade (cobre a tela por completo) antes de
    // começar a recuar — interromper no meio, como fazia antes, deixava o
    // círculo mal terminar de crescer e já ir embora, o que no celular (tela
    // menor, então a mesma % de clip-path cobre tudo mais rápido) passava
    // rápido demais pra dar tempo do olho perceber.
    const t1=setTimeout(()=>setPhase("out"),duration+hold);
    const t2=setTimeout(()=>onDone?.(),duration+hold+outDuration+40);
    return()=>{cancelAnimationFrame(raf1);cancelAnimationFrame(raf2);clearTimeout(t1);clearTimeout(t2);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[duration,hold]);

  if(prefersReducedMotion()){
    return <div aria-hidden style={{position:"fixed",inset:0,zIndex:600,background:accent,opacity:phase==="out"?0:1,transition:"opacity 120ms linear",pointerEvents:"none"}}/>;
  }
  const clip=phase==="out"?"circle(0% at 50% 50%)":"circle(75% at 50% 50%)";
  const clipDuration=phase==="out"?Math.round(duration*0.7):duration;
  return(
    <div aria-hidden style={{position:"fixed",inset:0,zIndex:600,background:accent,clipPath:clip,transition:phase==="start"?"none":`clip-path ${clipDuration}ms ${EASE_OUT}`,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
      <div style={{opacity:phase==="out"?0:1,transform:phase==="out"?"scale(0.85)":"scale(1)",transition:`opacity 200ms ${EASE_OUT}, transform 200ms ${EASE_OUT}`}}>
        <LogoSymbol size={64} color="#FFFFFF"/>
      </div>
    </div>
  );
}

export function ChartTooltip({active,payload,label}){
  if(!active||!payload||!payload.length)return null;
  return(
    <div style={{background:"rgba(22,25,29,0.96)",backdropFilter:"blur(12px)",borderRadius:R_BTN,padding:"13px 17px",boxShadow:SH_MD,border:`1px solid ${BD2}`}}>
      {label&&<div style={{fontSize:11,color:TX2,marginBottom:6,fontWeight:600,letterSpacing:"0.02em"}}>{label}</div>}
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:TX,fontWeight:600,marginTop:i>0?4:0}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:p.color||p.fill,flexShrink:0}}/>
          <span style={{color:TX2,fontWeight:500}}>{p.name}:</span> <span style={{fontFamily:NUM_FONT}}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Renderiza texto com URLs detectadas automaticamente como links clicáveis.
// Usado nas notas de Desejos e Previstos. Campo salvo é texto puro (string);
// esta função é o único lugar que precisa mudar quando Markdown for suportado.
export function LinkifiedText({text,color}){
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
export function LedgerRows({rows}){
  if(!rows||rows.length===0)return null;
  return(
    <div>
      {rows.map((r,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 0",borderTop:i>0?`1px solid ${BD}`:"none"}}>
          <span style={{fontSize:12,color:r.highlight?TX:TX2,fontWeight:r.highlight?700:500}}>{r.label}</span>
          <span style={{fontFamily:NUM_FONT,fontSize:r.highlight?14.5:12.5,fontWeight:r.highlight?800:700,color:r.color||(r.highlight?TX:TX2),whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums"}}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Itens reais que compõem uma conclusão (transações, contas previstas,
// metas, parcelas...) — o "quais dados foram utilizados", com números de
// verdade em vez de frases genéricas. ----
export function LineItemsList({items,accentColor=TEAL,limit=5}){
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
          <span style={{fontFamily:NUM_FONT,fontSize:12.5,color:TX,fontWeight:700,flexShrink:0,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{typeof it.value==="number"?fmt(it.value):it.value}</span>
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
export function DataUsedChecklist({tags}){
  if(!tags||tags.length===0)return null;
  return(
    <div>
      <div style={{fontSize:10,fontWeight:700,color:TX3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:9}}>Dados usados nessa conclusão</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
        {tags.map(t=>(
          <span key={t} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:TX2,background:"rgba(255,255,255,0.04)",border:`1px solid ${BD}`,borderRadius:R_CHIP,padding:"5px 11px",fontWeight:600}}>
            <Check size={10} color={SUCCESS}/>{DATA_TAG_LABELS[t]||t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Número-herói animado: conta de 0 até o valor, dominando visualmente o card ----
export function HeroNumberAnimated({heroNumber,color}){
  const{value=0,format="plain",suffix="",sign="none"}=heroNumber||{};
  const display=useCountUp(value,650);
  let formatted;
  if(format==="currency")formatted=fmt(Math.abs(display));
  else if(format==="percent")formatted=`${Math.round(display)}%`;
  else formatted=`${Math.round(display)}${suffix||""}`;
  const prefix=sign==="+"?"+":sign==="-"?"-":"";
  return <span style={{fontFamily:NUM_FONT,fontSize:32,fontWeight:800,color,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums",lineHeight:1}}>{prefix}{formatted}</span>;
}

// ---- Comparação visual: duas barras (média vs. mês atual, etc.) em vez de texto ----
export function ComparisonBar({aLabel,aValue,bLabel,bValue,color}){
  const max=Math.max(Math.abs(aValue),Math.abs(bValue),1);
  const aPct=Math.min(100,Math.round((Math.abs(aValue)/max)*100));
  const bPct=Math.min(100,Math.round((Math.abs(bValue)/max)*100));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:7,margin:"14px 0"}}>
      <div style={{display:"flex",alignItems:"center",gap:9}}>
        <span style={{fontSize:10.5,color:TX3,width:76,flexShrink:0,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{aLabel}</span>
        <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:R_CHIP,height:8,overflow:"hidden"}}><div style={{width:`${aPct}%`,height:"100%",background:TX3,borderRadius:R_CHIP,transition:`width .6s ${EASE_OUT}`}}/></div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:9}}>
        <span style={{fontSize:10.5,color:TX,width:76,flexShrink:0,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bLabel}</span>
        <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:R_CHIP,height:8,overflow:"hidden"}}><div style={{width:`${bPct}%`,height:"100%",background:color,borderRadius:R_CHIP,transition:`width .6s ${EASE_OUT}`}}/></div>
      </div>
    </div>
  );
}

const CONFIDENCE_LABEL={alta:"Alta confiança",media:"Média confiança",nova:"Nova tendência"};
// Exportado porque LacalleFinance também precisa da mesma escala de cor no
// resultado do "Posso gastar?". Enquanto ficou só aqui, aquele arquivo
// referenciava um nome inexistente e o clique em "Perguntar" derrubava a tela
// com ReferenceError.
export const DECISION_STATUS_COLOR={ok:SUCCESS,atencao:WARNING,critico:ERROR,neutro:TX3};

// ---- Cartão de consultor financeiro ------------------------------------
// Título → número-herói → comparação visual → o que aconteceu (explanation)
// → por que aconteceu (reason) → "principais responsáveis" (transações reais,
// visível sem precisar abrir nada) → recomendação → "Como cheguei a essa
// conclusão" (expansível: cálculo linha a linha + checklist de dados usados).
export function InsightCard({item,index=0,action}){
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
        <div style={{marginTop:16,padding:"12px 14px",background:`${item.categoryColor}12`,border:`1px solid ${item.categoryColor}2a`,borderRadius:R_BTN,display:"flex",alignItems:"flex-start",gap:9}}>
          <Lightbulb size={13} color={item.categoryColor} style={{flexShrink:0,marginTop:1}}/>
          <div style={{fontSize:12,color:TX,fontWeight:600,lineHeight:1.5}}>{item.recommendation}</div>
        </div>
      )}
      {action&&(
        <button onClick={action.onClick} style={{marginTop:16,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:`${item.categoryColor}1a`,border:`1px solid ${item.categoryColor}45`,color:item.categoryColor,borderRadius:R_BTN,padding:"10px 14px",fontSize:13,fontWeight:600,cursor:"pointer",transition:`filter .15s ${EASE_OUT}`}}>
          {action.label}<ArrowRight size={14}/>
        </button>
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
export function DecisionRow({d}){
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
              <LineItemsList items={paidItems} accentColor={SUCCESS}/>
            </div>
          )}
          <DataUsedChecklist tags={d.evidence?.dataUsed}/>
        </div>
      )}
    </div>
  );
}

// ==================== Campo de valor (decimal com vírgula) ====================
// <input type="number"> obriga o usuário a digitar ponto como separador
// decimal (o navegador rejeita a vírgula em value/valueAsNumber). Como o app
// é pt-BR, aqui usamos um input de texto com inputMode="decimal" — o teclado
// numérico continua aparecendo no celular, mas quem manda no formato somos
// nós: a vírgula é o separador decimal e o ponto digitado vira vírgula
// automaticamente (quem tem o hábito antigo não precisa reaprender).
// O valor guardado no state continua string ("1.234,56"); quem consome usa
// parseNum, que já entendia os dois formatos.
export const sanitizeDecimal=v=>{
  let s=String(v??"").replace(/[^\d.,]/g,"");
  // "1.234,56" (colado do banco/planilha): ponto é milhar, descarta.
  // "1.5" (digitado no hábito antigo): ponto é decimal, vira vírgula.
  if(s.includes(".")&&s.includes(","))s=s.replace(/\./g,"");
  else s=s.replace(/\./g,",");
  const i=s.indexOf(",");
  if(i>=0)s=s.slice(0,i+1)+s.slice(i+1).replace(/,/g,"");
  const [int,dec]=s.split(",");
  return dec===undefined?int:`${int},${dec.slice(0,2)}`;
};
// Número -> texto do campo (3.5 => "3,5"), para preencher formulários de edição.
export const toDecimalStr=n=>(n===null||n===undefined||n==="")?"":String(n).replace(".",",");

export const MoneyInput=forwardRef(({value,onChange,style,...rest},ref)=>(
  <input
    {...rest}
    ref={ref}
    type="text"
    inputMode="decimal"
    autoComplete="off"
    value={value}
    onChange={e=>onChange(sanitizeDecimal(e.target.value))}
    style={{fontVariantNumeric:"tabular-nums",...style}}
  />
));
MoneyInput.displayName="MoneyInput";

// Ink (BG) e não branco: os seis acentos do app (pág. 19/49 do Brand System)
// são todos tons médios/claros — branco sobre eles mede entre ~2,8:1 e ~3,7:1,
// abaixo dos 4,5:1 que a pág. 48 exige de texto abaixo de 18px. Ink passa em
// todos com folga. Mesma divergência já documentada e testada no LaCalle Life
// (pág. 25 do Brand System, "tinta sobre o acento").
export const Btn=(props)=>{
  const accent=useAccent();
  return <button {...props} className={`btn-primary ${props.className||""}`} style={{background:accent,border:"none",color:BG,borderRadius:R_BTN,cursor:"pointer",fontWeight:600,fontSize:14,boxShadow:`0 2px 10px ${accent}40`,transition:`filter .15s ${EASE_OUT}, transform .15s ${EASE_OUT}, box-shadow .15s ${EASE_OUT}`,...props.style}}/>;
};
export const BtnGhost=(props)=><button {...props} className={`btn-ghost ${props.className||""}`} style={{background:"transparent",border:`1px solid ${BD2}`,color:TX2,borderRadius:R_BTN,cursor:"pointer",fontWeight:600,fontSize:14,transition:`border-color .15s ${EASE_OUT}, color .15s ${EASE_OUT}, background .15s ${EASE_OUT}`,...props.style}}/>;
