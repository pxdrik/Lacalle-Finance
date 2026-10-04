// ============================================================================
// ui.jsx — biblioteca de componentes de interface compartilhados.
//
// Tudo aqui é puramente apresentacional: recebe dados via props e não
// conhece nada sobre transações, desejos, Supabase etc. Cada aba do app
// importa daqui em vez de redefinir os mesmos componentes.
// ============================================================================
import { useState, useRef, useEffect, forwardRef } from "react";
import { Tag, Check, ChevronDown, ChevronUp, Info, Lightbulb, Gamepad2, UtensilsCrossed, Car, Sparkles, Shirt, Laptop, HeartPulse, GraduationCap, Briefcase, Package, TrendingUp, Repeat, Undo2, Gift, ArrowRight, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { fmt } from "../lib/financialEngine";
import { sanitizeMoneyInput } from "../lib/money";
import { BG, CARD, BD, BD2, TX, TX2, TX3, GOLD, R_CARD, R_BTN, R_CHIP, R_MODAL, SH_SM, SH_MD, SH_LG, cardStyle, useAccent, NUM_FONT, EASE_OUT, SUCCESS, WARNING, ERROR, DUR_DATA } from "../lib/theme";
import { DENSITIES, useDensity } from "../lib/density";
import LogoSymbol from "./LogoSymbol";

// ==================== Comparison ====================
// Um número, a direção que ele moveu, e se essa direção é boa notícia.
// Mesmo componente que o Life ganhou em design-system/components/comparison.tsx
// nesta sessão — "componente de comparação temporal" tinha sido proposto duas
// vezes (brandbook do Life e do Finance) e construído em nenhum dos dois, cada
// tela resolvendo à própria maneira (a "economia este mês" da Home usava só
// cor, sem ícone, até ser corrigida manualmente — isto formaliza o padrão pra
// não repetir o gap na próxima tela que precisar da mesma ideia).
// `tone` nunca é inferido do sinal: quanto custou um mês pode subir e ser
// ótimo (investimento) ou péssimo (gasto) com o mesmo delta positivo — só
// quem chama sabe o julgamento certo. Sem `tone`, cai em neutro (TX2), nunca
// verde/vermelho por acidente.
const COMPARISON_TONE={neutral:TX2,positive:SUCCESS,negative:ERROR};
// Nenhum utilitário sr-only existia neste projeto antes deste componente —
// o ícone de direção é aria-hidden, então sem isto a seta vira ruído puro
// pra leitor de tela (nenhuma informação, só um glifo sem nome).
const VISUALLY_HIDDEN={position:"absolute",width:1,height:1,padding:0,margin:-1,overflow:"hidden",clip:"rect(0,0,0,0)",whiteSpace:"nowrap",border:0};
export function Comparison({delta,formatMagnitude,label,whenZero="sem mudança",tone="neutral",style}){
  const color=COMPARISON_TONE[tone];
  if(delta===0){
    return (
      <span style={{display:"inline-flex",alignItems:"center",gap:4,color,...style}}>
        <Minus size={13} aria-hidden="true"/><span style={VISUALLY_HIDDEN}>estável:</span>{whenZero} {label}
      </span>
    );
  }
  const Icon=delta>0?ArrowUp:ArrowDown;
  const sign=delta>0?"+":"−";
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,color,...style}}>
      <Icon size={13} aria-hidden="true"/><span style={VISUALLY_HIDDEN}>{delta>0?"subiu":"desceu"}:</span>{sign}{formatMagnitude(Math.abs(delta))} {label}
    </span>
  );
}

// ==================== Tabs ====================
// role="tablist"/"tab" com aria-selected, aria-controls e roving tabindex —
// a semântica que faltava (brandbook, seção 43). O visual é o `.nav-tab` que
// o Finance já tinha (ícone + rótulo, fundo tingido no ativo, sublinhado que
// entra com `.nav-tab-underline`/`indicatorIn`, definidos em
// `LacalleFinance.jsx`) — só o papel ARIA e o foco por teclado são novos.
// Mesmo contrato do `Tabs` que o Life ganhou em
// design-system/components/tabs.tsx nesta sessão: foco por teclado é roving
// tabindex (só a aba ativa entra no tab order; ←/→ movem a seleção e levam o
// foco, Home/End vão pras pontas).
function tabId(prefix, id) {
  return `${prefix}-tab-${id}`;
}
export function tabPanelId(prefix, id) {
  return `${prefix}-panel-${id}`;
}
export function Tabs({ items, value, onChange, idPrefix, style }) {
  const accent = useAccent();
  const buttonsRef = useRef(new Map());

  function focusTab(id) {
    buttonsRef.current.get(id)?.focus();
  }

  function handleKeyDown(e) {
    const index = items.findIndex(item => item.id === value);
    if (index === -1) return;
    let next = null;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    const nextItem = items[next];
    onChange(nextItem.id);
    focusTab(nextItem.id);
  }

  return (
    <div role="tablist" className="top-tabs" style={{ display: "flex", gap: 4, overflowX: "auto", ...style }} onKeyDown={handleKeyDown}>
      {items.map(item => {
        const active = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            ref={el => { if (el === null) buttonsRef.current.delete(item.id); else buttonsRef.current.set(item.id, el); }}
            id={tabId(idPrefix, item.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={tabPanelId(idPrefix, item.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            className="nav-tab"
            style={{
              padding: "9px 15px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
              background: active ? `${accent}18` : "transparent", color: active ? TX : TX3,
              borderRadius: `${R_BTN}px ${R_BTN}px 0 0`,
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <Icon size={15} />{item.label}
            {active && <span className="nav-tab-underline" />}
          </button>
        );
      })}
    </div>
  );
}
/** O painel de uma aba — `aria-labelledby` fecha o par com o botão que o abriu. */
export function TabPanel({ id, idPrefix, children, style }) {
  return (
    <div id={tabPanelId(idPrefix, id)} role="tabpanel" aria-labelledby={tabId(idPrefix, id)} className="tab-panel-enter" style={style}>
      {children}
    </div>
  );
}

// ==================== DensityToggle ====================
// Três paradas fixas, não um slider — mesma razão do `DensityToggle` que o
// Life já tinha (design-system/density/density-toggle.tsx): "Compacto"
// contra um número cru não se anuncia bem pra leitor de tela, e três
// posições fixas não ganham nada sendo arrastáveis. Construído sobre radios
// nativos pela mesma razão de lá: navegação por seta e foco circulando
// vêm do próprio navegador, não de teclado customizado que pode errar.
const DENSITY_LABEL={compact:"Compacto",default:"Padrão",comfortable:"Confortável"};
export function DensityToggle(){
  const {density,setDensity}=useDensity();
  return (
    <fieldset style={{display:"inline-flex",border:`1px solid ${BD}`,borderRadius:R_BTN,background:"rgba(255,255,255,0.03)",padding:2,margin:0}}>
      <legend style={VISUALLY_HIDDEN}>Tamanho dos botões</legend>
      {DENSITIES.map(value=>{
        const active=density===value;
        return (
          <label key={value} style={{cursor:"pointer"}}>
            <input type="radio" name="density" value={value} checked={active} onChange={()=>setDensity(value)} style={VISUALLY_HIDDEN}/>
            <span style={{display:"flex",alignItems:"center",justifyContent:"center",height:32,padding:"0 12px",borderRadius:R_CHIP,fontSize:12,fontWeight:active?600:500,color:active?TX:TX2,background:active?BD2:"transparent",transition:`background .15s ${EASE_OUT}, color .15s ${EASE_OUT}`}}>{DENSITY_LABEL[value]}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

// ==================== Table ====================
// Mantém forma de planilha sem ser um <table> nativo: Card + cabeçalho de
// coluna com aria-hidden (ele rotula a lista, cada linha já lê como frase
// completa pro leitor de tela) + linhas com divide via borda superior,
// dentro de overflow-x-auto com piso de largura — rola de lado numa tela
// estreita em vez de espremer coluna até ficar ilegível (brandbook, seção
// 43). Mesma anatomia do `Tabela` que o Life ganhou em
// design-system/components/tabela.tsx nesta sessão: só o molde (cabeçalho +
// moldura + rolagem) é compartilhado — a linha em si continua escrita por
// quem chama, porque o conteúdo de cada linha é sempre específico da tela
// (aqui, o resumo mensal do Planejamento).
function colFlex(width) {
  return width === undefined ? 1 : `0 0 ${typeof width === "number" ? `${width}px` : width}`;
}
export function Table({ columns, minWidth = 480, children }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth }}>
          <div aria-hidden style={{ display: "flex", gap: 12, padding: "12px 16px 8px", borderBottom: `1px solid ${BD}` }}>
            {columns.map(({ key, label, align = "left", width }) => (
              <span key={key} style={{ flex: colFlex(width), textAlign: align, fontSize: 11, fontWeight: 700, color: TX2, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{label}</span>
            ))}
          </div>
          {children}
        </div>
      </div>
    </Card>
  );
}
/** Uma linha — mesmos `columns` (largura/alinhamento) da `Table` que a envolve, pra bater com o cabeçalho. */
export function TableRow({ columns, cells, style }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 16px", borderTop: `1px solid ${BD}`, ...style }}>
      {columns.map(({ key, align = "left", width, numeric }, i) => (
        <span key={key} className={numeric ? "num" : undefined} style={{ flex: colFlex(width), textAlign: align, whiteSpace: "nowrap", ...cells[i]?.style }}>{cells[i]?.value}</span>
      ))}
    </div>
  );
}

// ==================== EmptyState ====================
// Ícone (contido, aria-hidden) + frase de estado, sempre; legenda e ação são
// opcionais — nunca dado inventado só pra preencher o espaço (brandbook,
// seção 43). Promovido a partir da versão incompleta que quatro telas já
// repetiam à mão (InstallmentsTab, PlannedTab, WishesTab, a lixeira em
// LacalleFinance): ícone a 50% de opacidade + uma linha de texto, sem
// legenda nem ação — nunca tinha sido pensado como o padrão, só copiado.
// Mesmo componente que o Life ganhou em design-system/components/empty-state.tsx
// nesta sessão, mesma anatomia.
// `boxed=false` existe só pra lixeira: ela já mora dentro de um `Modal`, que
// já é o card — um segundo card por dentro seria "card dentro de card sem
// necessidade" (anti-padrão da seção 40).
export function EmptyState({icon:Icon,title,caption,action,boxed=true,padding=48,iconSize=26,style}){
  const ActionIcon=action?.icon;
  return (
    <div style={{
      textAlign:"center",color:TX3,padding,fontSize:14,
      ...(boxed?{background:CARD,border:`1px solid ${BD}`,borderRadius:R_CARD,boxShadow:SH_SM}:{}),
      ...style,
    }}>
      <Icon size={iconSize} aria-hidden="true" style={{marginBottom:12,opacity:0.5}}/>
      <div>{title}</div>
      {caption&&<div style={{fontSize:12,color:TX3,marginTop:6}}>{caption}</div>}
      {action&&(
        <BtnGhost onClick={action.onClick} style={{marginTop:16,paddingInline:18,fontSize:13,display:"inline-flex",alignItems:"center",gap:6}}>
          {ActionIcon&&<ActionIcon size={14}/>}{action.label}
        </BtnGhost>
      )}
    </div>
  );
}

const CAT_ICON_COMPONENTS={
  "Lazer":Gamepad2,"Alimentação":UtensilsCrossed,"Transporte":Car,"Desejos":Sparkles,"Roupas":Shirt,
  "Tecnologia":Laptop,"Saude / Cuidados Pessoais":HeartPulse,"Educação":GraduationCap,
  "Salario / Entradas":Briefcase,"Outros":Package,"Investimento":TrendingUp,"Assinaturas":Repeat,
  "Rembolsos":Undo2,"Presentes":Gift,
};

const URL_SPLIT_REGEX=/((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const URL_TEST_REGEX=/^(?:https?:\/\/|www\.)/i;

export const Card=(props)=><div {...props} className={`fc-card ${props.className||""}`} style={{...cardStyle,...props.style}}/>;

// ==================== StatTile ====================
// Rótulo + valor grande + legenda opcional, dentro de um cardStyle padrão.
// Extraído de seis blocos quase idênticos nas seções "Fluxo de Caixa Futuro"
// e "Compromissos Financeiros" (Planejamento) — cada um só variava rótulo,
// valor, cor e legenda. `size` existe porque o saldo/projeções usam 17px e
// os demais 16px; nenhum outro valor do bloco original mudava de instância
// para instância.
export function StatTile({label,value,color=TX,caption,size=16,textAlign}){
  return (
    <div className="bento-half" style={{...cardStyle,padding:18,...(textAlign?{textAlign}:{})}}>
      <div style={{fontSize:11,color:TX2,marginBottom:6}}>{label}</div>
      <div className="num" style={{fontSize:size,fontWeight:700,color}}>{value}</div>
      {caption&&<div style={{fontSize:11,color:TX3,marginTop:4}}>{caption}</div>}
    </div>
  );
}

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

function useCountUp(value,duration=DUR_DATA){
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
// autenticação (no máximo 1x por sessão). Preto com símbolo branco, fixo
// pela marca-mãe — não segue o acento escolhido pela pessoa.
export function LaCalleReveal({duration=1000,hold=250,onDone}){
  const accent="#000000";
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
export function LineItemsList({items,accentColor=GOLD,limit=5}){
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
  const display=useCountUp(value,DUR_DATA);
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
// O valor guardado no state continua string ("1234,56"); quem consome usa
// parseNum. A regra (inclusive colar "1.234" do banco, que antes virava
// R$ 1,23) mora em lib/money.js, com teste.
export const sanitizeDecimal=sanitizeMoneyInput;
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
// `paddingBlock`/`paddingInline` em vez de `padding`, de propósito: assim
// cada chamada continua livre pra ajustar só o espaçamento horizontal
// (`paddingInline` no próprio `style`) sem precisar redigitar o vertical, que
// agora vem de `useDensity()` e muda sozinho com o toggle — a mesma divisão
// que motivou `BTN_PAD_Y` existir, um passo adiante.
export const Btn=(props)=>{
  const accent=useAccent();
  const {btnPadY}=useDensity();
  return <button {...props} className={`btn-primary ${props.className||""}`} style={{background:accent,border:"none",color:BG,borderRadius:R_BTN,cursor:"pointer",fontWeight:600,fontSize:14,paddingBlock:btnPadY,paddingInline:18,boxShadow:`0 2px 10px ${accent}40`,transition:`filter .15s ${EASE_OUT}, transform .15s ${EASE_OUT}, box-shadow .15s ${EASE_OUT}`,...props.style}}/>;
};
export const BtnGhost=(props)=>{
  const {btnPadY}=useDensity();
  return <button {...props} className={`btn-ghost ${props.className||""}`} style={{background:"transparent",border:`1px solid ${BD2}`,color:TX2,borderRadius:R_BTN,cursor:"pointer",fontWeight:600,fontSize:14,paddingBlock:btnPadY,paddingInline:18,transition:`border-color .15s ${EASE_OUT}, color .15s ${EASE_OUT}, background .15s ${EASE_OUT}`,...props.style}}/>;
};
