import { useEffect, useRef, useState } from "react";
import { Cloud, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { BG, CARD, BD, BD2, TX, TX2, GOLD, R_CARD, R_BTN, R_INPUT, R_CHIP, R_MODAL, SH_MD, EASE_OUT, SUCCESS, ERROR } from "../lib/theme";
import LogoSymbol from "./LogoSymbol";

// CAPTCHA (Cloudflare Turnstile) é OPCIONAL e fica totalmente desligado até
// alguém configurar VITE_TURNSTILE_SITE_KEY — sem isso, o login/cadastro
// funciona exatamente como antes, sem widget nenhum. Para ativar:
//   1. Crie um site key gratuito em https://dash.cloudflare.com/?to=/:account/turnstile
//   2. Cole o "Secret key" em Supabase → Authentication → Attack Protection
//      → Enable CAPTCHA protection.
//   3. Coloque o "Site key" em VITE_TURNSTILE_SITE_KEY no .env e nas
//      variáveis de ambiente do Netlify, e faça um novo deploy.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

function useTurnstile(onToken) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };

    if (window.turnstile) {
      render();
    } else if (!document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    } else {
      document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`).addEventListener("load", render);
    }

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current !== null) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* já removido */ }
      }
    };
  }, [onToken]);

  return containerRef;
}

const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${BD2}`,
  borderRadius: R_INPUT,
  padding: "13px 16px",
  color: TX,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

// `onLogin(email, name)` é chamado depois que a autenticação real dá certo —
// mesma assinatura que o WelcomeScreen antigo usava, então o resto do app
// (Root/MainApp) não precisa saber que por trás agora tem login de verdade.
export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useTurnstile(setCaptchaToken);

  // Mensagem única, sempre igual, para o caminho de "cadastro" — não importa
  // se o e-mail já tem conta ou não. Isso evita enumeração de usuários: um
  // atacante que tentasse cadastrar e-mails-alvo em massa não consegue
  // distinguir "e-mail livre" de "e-mail já cadastrado" pela resposta.
  const SIGNUP_GENERIC_MESSAGE =
    "Se esse e-mail ainda não tem conta, você vai poder entrar em instantes. Se já existir uma conta com ele, faça login em vez de criar outra.";

  const friendlyError = (message) => {
    if (message.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
    if (message.includes("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
    if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).";
    if (message.includes("captcha")) return "Não foi possível confirmar que você não é um robô. Tente novamente.";
    return message;
  };

  const submit = async () => {
    setErr(""); setInfo("");
    if (!email.trim() || !email.includes("@")) { setErr("Digite um e-mail válido."); return; }
    if (mode !== "forgot" && password.length < 6) { setErr("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (mode === "signup" && !name.trim()) { setErr("Digite seu nome."); return; }
    if (TURNSTILE_SITE_KEY && !captchaToken) { setErr("Confirme que você não é um robô antes de continuar."); return; }

    setLoading(true);
    const captchaOptions = captchaToken ? { captchaToken } : undefined;
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim() }, ...captchaOptions },
        });
        if (error) {
          // "User already registered" nunca vira uma mensagem diferente do
          // caminho de sucesso — ver SIGNUP_GENERIC_MESSAGE acima.
          if (error.message.includes("User already registered")) {
            setInfo(SIGNUP_GENERIC_MESSAGE);
            setMode("login");
            return;
          }
          throw error;
        }
        if (data.session) {
          // Confirmação de e-mail desligada no projeto -> já entra direto.
          onLogin(data.user.email, name.trim());
        } else {
          setInfo(SIGNUP_GENERIC_MESSAGE);
          setMode("login");
        }
      } else if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
          options: captchaOptions,
        });
        if (error) throw error;
        const displayName = data.user.user_metadata?.name || data.user.email.split("@")[0];
        onLogin(data.user.email, displayName);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), captchaOptions);
        if (error) throw error;
        setInfo("Se esse e-mail tiver uma conta, enviamos um link de recuperação para ele.");
      }
    } catch (e) {
      setErr(friendlyError(e.message || "Algo deu errado. Tente de novo."));
    } finally {
      setLoading(false);
      if (window.turnstile) { try { window.turnstile.reset(); } catch { /* ok */ } setCaptchaToken(""); }
    }
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter Variable','Inter',system-ui,sans-serif", padding: 24 }}>
      <style>{`
        .wl-input:focus{outline:none;border-color:${GOLD}80 !important;box-shadow:0 0 0 3px ${GOLD}22;}
        .wl-btn{transition:filter .15s ${EASE_OUT}, transform .15s ${EASE_OUT}, box-shadow .15s ${EASE_OUT};}
        .wl-btn:hover{filter:brightness(1.1);box-shadow:0 8px 24px -8px ${GOLD}70;}
        .wl-btn:active{transform:scale(0.98);}
        .wl-btn:disabled{opacity:0.6;cursor:not-allowed;}
        /* P0: autofill do navegador (email/senha salvos) pinta fundo branco
           por cima do card escuro, ignorando o background inline do input.
           Forçamos o fundo de volta pro CARD com o truque do box-shadow
           inset gigante (não dá pra sobrescrever "background" direto em
           :-webkit-autofill) e a cor do texto de volta pro TX. */
        .wl-input:-webkit-autofill,
        .wl-input:-webkit-autofill:hover,
        .wl-input:-webkit-autofill:focus {
          -webkit-text-fill-color: ${TX};
          -webkit-box-shadow: 0 0 0 1000px ${CARD} inset;
          box-shadow: 0 0 0 1000px ${CARD} inset;
          caret-color: ${TX};
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ background: "#111111", borderRadius: R_MODAL, width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", boxShadow: `0 8px 24px -8px ${GOLD}45` }}>
            <LogoSymbol size={25} color="#FFFFFF" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 27, color: TX, letterSpacing: "-0.025em" }}>LaCalle <span style={{ color: GOLD }}>Finance</span></div>
          <div style={{ fontSize: 13, color: TX2, marginTop: 8 }}>Sincronizado em todos os dispositivos</div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD, padding: 32, boxShadow: SH_MD }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}`, borderRadius: R_INPUT, padding: 4, marginBottom: 22 }}>
            <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }} style={{ flex: 1, padding: "9px", border: "none", borderRadius: R_CHIP, cursor: "pointer", fontSize: 13, fontWeight: 600, background: mode === "login" ? GOLD : "transparent", color: mode === "login" ? BG : TX2 }}>Entrar</button>
            <button onClick={() => { setMode("signup"); setErr(""); setInfo(""); }} style={{ flex: 1, padding: "9px", border: "none", borderRadius: R_CHIP, cursor: "pointer", fontSize: 13, fontWeight: 600, background: mode === "signup" ? GOLD : "transparent", color: mode === "signup" ? BG : TX2 }}>Criar conta</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* BUG-09: <label htmlFor> associado ao input por id — antes só
                havia um <div> visual acima do campo, sem ligação semântica
                nenhuma, então leitor de tela caía pro `placeholder` como
                nome acessível (e ele some ao digitar/focar). O texto visível
                continua exatamente igual; só ganhou a marcação certa. */}
            {mode === "signup" && (
              <div>
                <label htmlFor="auth-name" style={{ display: "block", fontSize: 12, color: TX2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.02em" }}>Seu nome</label>
                <input id="auth-name" className="wl-input" type="text" autoComplete="name" placeholder="Como podemos te chamar" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" style={{ display: "block", fontSize: 12, color: TX2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.02em" }}>Seu e-mail</label>
              <input id="auth-email" className="wl-input" type="email" inputMode="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={inputStyle} />
            </div>
            {mode !== "forgot" && (
              <div>
                <label htmlFor="auth-password" style={{ display: "block", fontSize: 12, color: TX2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.02em" }}>Senha</label>
                <input id="auth-password" className="wl-input" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Pelo menos 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={inputStyle} />
              </div>
            )}

            {err && <div role="alert" style={{ background: `${ERROR}14`, borderRadius: R_INPUT, padding: "10px 13px", fontSize: 13, color: ERROR, display: "flex", alignItems: "center", gap: 8 }}><AlertCircle size={14} />{err}</div>}
            {info && <div role="status" style={{ background: `${SUCCESS}14`, borderRadius: R_INPUT, padding: "10px 13px", fontSize: 13, color: SUCCESS, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={14} />{info}</div>}

            {TURNSTILE_SITE_KEY && <div ref={turnstileRef} />}

            <button className="wl-btn" disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)} onClick={submit} style={{ width: "100%", padding: "14px", borderRadius: R_BTN, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, marginTop: 4, background: GOLD, color: BG, boxShadow: `0 2px 8px ${GOLD}45` }}>
              {loading ? "Um momento..." : mode === "signup" ? "Criar conta" : mode === "forgot" ? "Enviar link de recuperação" : "Entrar"}
            </button>

            {mode === "login" && (
              <button onClick={() => { setMode("forgot"); setErr(""); setInfo(""); }} style={{ background: "none", border: "none", color: TX2, fontSize: 12.5, cursor: "pointer", textAlign: "center" }}>Esqueci minha senha</button>
            )}
            {mode === "forgot" && (
              <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }} style={{ background: "none", border: "none", color: TX2, fontSize: 12.5, cursor: "pointer", textAlign: "center" }}>Voltar para o login</button>
            )}
          </div>

          <div style={{ marginTop: 22, padding: "13px 15px", background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}`, borderRadius: R_INPUT, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Cloud size={14} color={GOLD} />
            <span style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>Login real, protegido por senha — seus dados são só seus</span>
          </div>
        </div>
      </div>
    </div>
  );
}
