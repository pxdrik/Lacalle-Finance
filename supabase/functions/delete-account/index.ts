// ============================================================================
// delete-account — Supabase Edge Function
//
// Por que isso precisa rodar num servidor e não no navegador: apagar a conta
// de autenticação de alguém (auth.users) exige a "service_role key", que dá
// acesso total ao banco — ela NUNCA pode ficar exposta no código do site
// (qualquer pessoa que abrisse o "inspecionar elemento" a veria). Por isso
// essa chave só existe aqui, rodando no servidor do Supabase, nunca no
// navegador da pessoa.
//
// O que ela faz: confere quem está chamando (pelo token de login de quem
// fez a requisição) e apaga SÓ a conta dessa própria pessoa — nunca de
// outra. Isso impede alguém de apagar a conta de outro usuário.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

// Origem(ns) autorizada(s) a chamar esta função a partir do navegador. Ajuste
// para o domínio real de produção (e, se quiser, o preview do Netlify) antes
// de implantar — nunca use "*" aqui: essa função aceita credenciais
// (Authorization), então uma origem coringa permitiria qualquer site chamar
// a API em nome de quem estiver logado nele.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    // O SDK supabase-js sempre manda "apikey" e "x-client-info" em toda
    // chamada (inclusive functions.invoke) — sem eles aqui, o preflight do
    // navegador rejeita a requisição antes de sair (bloqueio client-side,
    // nunca chega no servidor). "content-type" fica por segurança, embora
    // o app hoje não mande body nessa chamada.
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  // Só ecoa Access-Control-Allow-Origin quando a origem está na allowlist.
  // Para origens não autorizadas, o header fica de fora de propósito — sem
  // ele, o navegador bloqueia a resposta independente do que mais viermos a
  // devolver. Nunca usar "*" aqui (a função aceita Authorization) nem cair
  // de volta para ALLOWED_ORIGINS[0]: isso responderia a qualquer origem
  // com a origem errada, em vez de simplesmente não autorizar.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsHeaders(origin);

  // Preflight do navegador — precisa responder aqui, sem exigir auth, senão
  // o navegador nunca chega a enviar a requisição real (POST) com o token.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Cliente "normal" (com a mesma permissão da pessoa que chamou), só pra
    // confirmar quem é ela a partir do token enviado.
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Cliente com privilégio total (service_role) — só usado aqui dentro,
    // no servidor, pra de fato apagar a conta.
    // Login recente obrigatório: uma sessão roubada é renovada sem senha, e
    // a renovação não muda last_sign_in_at. Só quem entrou com a senha nos
    // últimos 15 minutos apaga a conta. (Pedir a senha aqui esbarraria no
    // CAPTCHA do Supabase, que barra login feito pelo servidor.)
    const RECENT_LOGIN_MS = 15 * 60 * 1000;
    const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
    if (!(Date.now() - lastSignIn <= RECENT_LOGIN_MS)) {
      return new Response(JSON.stringify({ code: "reauth_required", error: "Por segurança, entre de novo com sua senha e apague a conta logo em seguida." }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Apaga primeiro os dados (a linha em user_data), depois a conta de
    // login em si. Se um dia a pessoa tiver dados em mais tabelas, adicione
    // a exclusão delas aqui também, antes de apagar o usuário.
    const { error: dataError } = await supabaseAdmin.from("user_data").delete().eq("user_id", user.id);
    if (dataError) throw dataError;
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    // O detalhe vai para o log da função, não para o navegador.
    console.error("delete-account:", e);
    return new Response(JSON.stringify({ error: "Erro ao apagar a conta. Tente de novo em instantes." }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
