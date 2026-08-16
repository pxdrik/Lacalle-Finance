import { useState } from "react";
import { Wallet, Cloud, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { BG, CARD, BD, BD2, TX, TX2, TEAL, R_CARD, R_BTN, R_INPUT, R_CHIP, R_MODAL, SH_MD, EASE_OUT, SUCCESS, ERROR } from "../lib/theme";

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

  const friendlyError = (message) => {
    if (message.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
    if (message.includes("User already registered")) return "Já existe uma conta com esse e-mail. Tente entrar em vez de criar conta.";
    if (message.includes("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
    if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).";
    return message;
  };

  const submit = async () => {
    setErr(""); setInfo("");
    if (!email.trim() || !email.includes("@")) { setErr("Digite um e-mail válido."); return; }
    if (mode !== "forgot" && password.length < 6) { setErr("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (mode === "signup" && !name.trim()) { setErr("Digite seu nome."); return; }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          // Confirmação de e-mail desligada no projeto -> já entra direto.
          onLogin(data.user.email, name.trim());
        } else {
          setInfo("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
          setMode("login");
        }
      } else if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        const displayName = data.user.user_metadata?.name || data.user.email.split("@")[0];
        onLogin(data.user.email, displayName);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
        if (error) throw error;
        setInfo("Enviamos um link de recuperação para o seu e-mail.");
      }
    } catch (e) {
      setErr(friendlyError(e.message || "Algo deu errado. Tente de novo."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter Variable','Inter',system-ui,sans-serif", padding: 24 }}>
      <style>{`
        .wl-input:focus{outline:none;border-color:${TEAL}80 !important;box-shadow:0 0 0 3px ${TEAL}22;}
        .wl-btn{transition:filter .15s ${EASE_OUT}, transform .15s ${EASE_OUT}, box-shadow .15s ${EASE_OUT};}
        .wl-btn:hover{filter:brightness(1.1);box-shadow:0 8px 24px -8px ${TEAL}70;}
        .wl-btn:active{transform:scale(0.98);}
        .wl-btn:disabled{opacity:0.6;cursor:not-allowed;}
      `}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ background: `linear-gradient(135deg, ${TEAL}22, ${TEAL}0A)`, border: `1px solid ${TEAL}40`, borderRadius: R_MODAL, width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", boxShadow: `0 8px 24px -8px ${TEAL}45` }}>
            <Wallet size={23} color={TEAL} strokeWidth={2} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 27, color: TX, letterSpacing: "-0.025em" }}>LaCalle <span style={{ color: TEAL }}>Finance</span></div>
          <div style={{ fontSize: 13, color: TX2, marginTop: 8 }}>Sincronizado em todos os dispositivos</div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BD}`, borderRadius: R_CARD, padding: 32, boxShadow: SH_MD }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", border: `1px solid ${BD}`, borderRadius: R_INPUT, padding: 4, marginBottom: 22 }}>
            <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }} style={{ flex: 1, padding: "9px", border: "none", borderRadius: R_CHIP, cursor: "pointer", fontSize: 13, fontWeight: 600, background: mode === "login" ? TEAL : "transparent", color: mode === "login" ? "#FFFFFF" : TX2 }}>Entrar</button>
            <button onClick={() => { setMode("signup"); setErr(""); setInfo(""); }} style={{ flex: 1, padding: "9px", border: "none", borderRadius: R_CHIP, cursor: "pointer", fontSize: 13, fontWeight: 600, background: mode === "signup" ? TEAL : "transparent", color: mode === "signup" ? "#FFFFFF" : TX2 }}>Criar conta</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {mode === "signup" && (
              <div>
                <div style={{ fontSize: 12, color: TX2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.02em" }}>Seu nome</div>
                <input className="wl-input" type="text" placeholder="Como podemos te chamar" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, color: TX2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.02em" }}>Seu e-mail</div>
              <input className="wl-input" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={inputStyle} />
            </div>
            {mode !== "forgot" && (
              <div>
                <div style={{ fontSize: 12, color: TX2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.02em" }}>Senha</div>
                <input className="wl-input" type="password" placeholder="Pelo menos 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={inputStyle} />
              </div>
            )}

            {err && <div style={{ background: `${ERROR}14`, borderRadius: R_INPUT, padding: "10px 13px", fontSize: 13, color: ERROR, display: "flex", alignItems: "center", gap: 8 }}><AlertCircle size={14} />{err}</div>}
            {info && <div style={{ background: `${SUCCESS}14`, borderRadius: R_INPUT, padding: "10px 13px", fontSize: 13, color: SUCCESS, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={14} />{info}</div>}

            <button className="wl-btn" disabled={loading} onClick={submit} style={{ width: "100%", padding: "14px", borderRadius: R_BTN, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, marginTop: 4, background: TEAL, color: "#FFFFFF", boxShadow: `0 2px 8px ${TEAL}45` }}>
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
            <Cloud size={14} color={TEAL} />
            <span style={{ fontSize: 12, color: TEAL, fontWeight: 600 }}>Login real, protegido por senha — seus dados são só seus</span>
          </div>
        </div>
      </div>
    </div>
  );
}
