// ============================================================================
// ui.jsx — biblioteca de componentes de interface compartilhados.
//
// Tudo aqui é puramente apresentacional: recebe dados via props e não
// conhece nada sobre transações, desejos, Supabase etc. Cada aba do app
// importa daqui em vez de redefinir os mesmos componentes.
// ============================================================================
import { useState, useRef, useEffect } from "react";
import { Tag, Check, ChevronDown, ChevronUp, Info, Lightbulb, Gamepad2, UtensilsCrossed, Car, Sparkles, Shirt, Laptop, HeartPulse, GraduationCap, Briefcase, Package, TrendingUp, Repeat, Undo2, Gift } from "lucide-react";
import { fmt } from "../lib/financialEngine";
import { BG, CARD, C2, BD, BD2, TX, TX2, TX3, HDR, TEAL, TEAL2, R_CARD, R_BTN, R_INPUT, R_CHIP, SH_SM, SH_MD, SH_LG, SI, cardStyle, useAccent, NUM_FONT } from "../lib/theme";

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
export const Modal=({onClose,children,maxWidth=420,align="center",zIndex=170,padding=28,scroll=true,contentStyle})=>(
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

export function CategoryIcon({cat,size=14,color,catIconMap}){
  const Icon=(catIconMap&&catIconMap[cat])||CAT_ICON_COMPONENTS[cat]||Tag;
  return <Icon size={size} color={color} strokeWidth={2.2}/>;
}

export function AnimatedValue({value}){
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
  return <span style={{fontFamily:NUM_FONT,fontVariantNumeric:"tabular-nums"}}>{fmt(display)}</span>;
}

export function ChartTooltip({active,payload,label}){
  if(!active||!payload||!payload.length)return null;
  return(
    <div style={{background:"rgba(11,27,43,0.96)",backdropFilter:"blur(12px)",borderRadius:14,padding:"13px 17px",boxShadow:SH_MD,border:`1px solid ${BD2}`}}>
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
          <span key={t} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:TX2,background:"rgba(255,255,255,0.04)",border:`1px solid ${BD}`,borderRadius:20,padding:"5px 11px",fontWeight:600}}>
            <Check size={10} color="#22C55E"/>{DATA_TAG_LABELS[t]||t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Número-herói animado: conta de 0 até o valor, dominando visualmente o card ----
export function HeroNumberAnimated({heroNumber,color}){
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
export function InsightCard({item,index=0}){
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
              <LineItemsList items={paidItems} accentColor="#22C55E"/>
            </div>
          )}
          <DataUsedChecklist tags={d.evidence?.dataUsed}/>
        </div>
      )}
    </div>
  );
}

export const Btn=(props)=>{
  const accent=useAccent();
  return <button {...props} className={`btn-primary ${props.className||""}`} style={{background:accent,border:"none",color:"white",borderRadius:R_BTN,cursor:"pointer",fontWeight:700,fontSize:13.5,boxShadow:`0 2px 10px ${accent}40`,transition:"filter .15s ease, transform .15s ease, box-shadow .15s ease",...props.style}}/>;
};
export const BtnGhost=(props)=><button {...props} className={`btn-ghost ${props.className||""}`} style={{background:"transparent",border:`1px solid ${BD2}`,color:TX2,borderRadius:R_BTN,cursor:"pointer",fontWeight:600,fontSize:13.5,transition:"border-color .15s ease, color .15s ease, background .15s ease",...props.style}}/>;
