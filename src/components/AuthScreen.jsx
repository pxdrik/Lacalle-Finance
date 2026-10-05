import { useEffect, useRef, useState } from "react";
import { Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { BG, CARD, BD, BD2, TX, TX2, TX3, GOLD, R_CARD, R_BTN, R_INPUT, EASE_OUT, SUCCESS, ERROR, PRESS_SCALE, SUCCESS_SURFACE, DANGER_SURFACE } from "../lib/theme";
import { FinanceMark } from "./Brand";
import { Segmented } from "./ui";
import { checkNewPassword } from "../lib/authRecovery";

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
        // redirectTo traz a pessoa de volta para este mesmo endereço, onde o app
        // reconhece o link de recuperação e mostra a tela de senha nova.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin, ...captchaOptions });
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

  const switchMode = m => { setMode(m); setErr(""); setInfo(""); };
  const onSubmit = e => { e.preventDefault(); submit(); };

  return (
    <AuthShell>
      <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {mode === "forgot" ? (
          <div>
            <h1 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: TX, letterSpacing: "-0.02em" }}>Recuperar a senha</h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: TX2, lineHeight: 1.5 }}>Mandamos um link para o seu e-mail. Ele traz você de volta aqui para criar uma senha nova.</p>
          </div>
        ) : (
          <Segmented ariaLabel="Entrar ou criar conta" value={mode} onChange={switchMode}
            options={[{ value: "login", label: "Entrar", tone: "neutral" }, { value: "signup", label: "Criar conta", tone: "neutral" }]} />
        )}
        {mode === "signup" && (
          <div>
            <label htmlFor="auth-name" style={labelStyle}>Seu nome</label>
            <input id="auth-name" className="wl-input" type="text" autoComplete="name" placeholder="Como podemos te chamar" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" style={labelStyle}>Seu e-mail</label>
          <input id="auth-email" className="wl-input" type="email" inputMode="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        </div>
        {mode !== "forgot" && (
          <div>
            <label htmlFor="auth-password" style={labelStyle}>Senha</label>
            <input id="auth-password" className="wl-input" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Pelo menos 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
          </div>
        )}

        {err && <Notice tone="error">{err}</Notice>}
        {info && <Notice tone="info">{info}</Notice>}

        {TURNSTILE_SITE_KEY && <div ref={turnstileRef} />}

        <button type="submit" className="wl-btn" disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)} style={primaryStyle}>
          {loading ? "Um momento..." : mode === "signup" ? "Criar conta" : mode === "forgot" ? "Enviar link de recuperação" : "Entrar"}
        </button>

        {mode === "login" && <button type="button" onClick={() => switchMode("forgot")} style={linkStyle}>Esqueci minha senha</button>}
        {mode === "forgot" && <button type="button" onClick={() => switchMode("login")} style={linkStyle}>Voltar para o login</button>}
      </form>
    </AuthShell>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: TX2, marginBottom: 6, fontWeight: 500 };
const primaryStyle = { width: "100%", height: 48, borderRadius: R_BTN, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, marginTop: 4, background: GOLD, color: BG };
const linkStyle = { background: "none", border: "none", color: TX2, fontSize: 13, cursor: "pointer", textAlign: "center", minHeight: 44, textDecoration: "underline", textUnderlineOffset: 3 };

/** Aviso de erro ou de informação: superfície do estado e texto na cor dele (padrão do Life). */
function Notice({ tone, children }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div role={tone === "error" ? "alert" : "status"} style={{ background: tone === "error" ? DANGER_SURFACE : SUCCESS_SURFACE, borderRadius: R_INPUT, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, color: tone === "error" ? ERROR : SUCCESS, display: "flex", alignItems: "flex-start", gap: 8 }}>
      <Icon size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />{children}
    </div>
  );
}

/** Moldura das telas sem login: assinatura no alto, cartão sem sombra e a nota do cadeado embaixo. */
function AuthShell({ children }) {
  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans Variable','IBM Plex Sans',system-ui,sans-serif", padding: "32px 16px" }}>
      <style>{`
        .wl-input:focus{outline:none;border-color:${GOLD}80 !important;box-shadow:0 0 0 3px ${GOLD}22;}
        .wl-btn{transition:filter .15s ${EASE_OUT}, transform .15s ${EASE_OUT};}
        .wl-btn:hover{filter:brightness(1.08);}
        .wl-btn:active{transform:scale(${PRESS_SCALE});}
        .wl-btn:disabled{opacity:0.6;cursor:not-allowed;}
        /* Autofill do navegador pinta fundo branco por cima do card escuro.
           O box-shadow inset devolve o fundo do CARD e o texto em TX. */
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
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <FinanceMark size={44} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 24, color: TX, letterSpacing: "-0.03em" }}>LaCalle <span style={{ color: GOLD }}>Finance</span></div>
            <div style={{ fontSize: 13, color: TX2, marginTop: 6 }}>Seu dinheiro, em todos os seus aparelhos</div>
          </div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD, padding: 24 }}>{children}</div>
        <p style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: TX3, textAlign: "center" }}>
          <Lock size={13} aria-hidden="true" />Conta protegida por senha. Seus dados são só seus.
        </p>
      </div>
    </div>
  );
}

// Tela de senha nova, mostrada quando a pessoa volta pelo link de
// "Esqueci minha senha". Ela já está logada nesse momento (o link cria a
// sessão); falta só trocar a senha com updateUser.
export function NewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    const problem = checkNewPassword(password, confirm);
    setErr(problem);
    if (problem) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (e2) {
      const m = e2?.message || "";
      setErr(m.includes("different from the old") ? "A senha nova precisa ser diferente da antiga." : "Não consegui salvar a senha nova. Tente de novo; se continuar, peça outro link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: TX, letterSpacing: "-0.02em" }}>Crie uma senha nova</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: TX2, lineHeight: 1.5 }}>Você entrou pelo link de recuperação. Escolha a senha que vai usar daqui para frente.</p>
        </div>
        <div>
          <label htmlFor="new-password" style={labelStyle}>Senha nova</label>
          <input id="new-password" className="wl-input" type="password" autoComplete="new-password" autoFocus value={password} onChange={e => setPassword(e.target.value)} placeholder="Pelo menos 6 caracteres" style={inputStyle} aria-describedby={err ? "new-password-err" : undefined} />
        </div>
        <div>
          <label htmlFor="new-password-confirm" style={labelStyle}>Repita a senha nova</label>
          <input id="new-password-confirm" className="wl-input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} aria-describedby={err ? "new-password-err" : undefined} />
        </div>
        {err && <div id="new-password-err"><Notice tone="error">{err}</Notice></div>}
        <button type="submit" disabled={loading} className="wl-btn" style={primaryStyle}>{loading ? "Salvando..." : "Salvar senha nova"}</button>
      </form>
    </AuthShell>
  );
}
