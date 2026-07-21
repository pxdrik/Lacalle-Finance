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

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401 });
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
      return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401 });
    }

    // Cliente com privilégio total (service_role) — só usado aqui dentro,
    // no servidor, pra de fato apagar a conta.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Apaga primeiro os dados (a linha em user_data), depois a conta de
    // login em si. Se um dia a pessoa tiver dados em mais tabelas, adicione
    // a exclusão delas aqui também, antes de apagar o usuário.
    await supabaseAdmin.from("user_data").delete().eq("user_id", user.id);
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Erro ao apagar a conta." }), { status: 500 });
  }
});
