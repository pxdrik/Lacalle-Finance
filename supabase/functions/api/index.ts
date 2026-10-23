// ============================================================================
// api — Supabase Edge Function: lê e grava lançamentos do Finance por HTTP.
//
// Feita para um agente de WhatsApp lançar gastos e entradas. O agente não
// consegue entrar como a pessoa (o login exige CAPTCHA), então a API tem a
// própria chave: `Authorization: Bearer <FINANCE_API_KEY>`. Quem tem a chave
// lê e grava os dados de UMA conta, a de FINANCE_API_USER_ID.
//
// Segredos (npx supabase secrets set): FINANCE_API_KEY (32+ caracteres
// aleatórios) e FINANCE_API_USER_ID. Implantar SEM a checagem de JWT do
// Supabase, porque a chave não é um JWT:
//   npx supabase functions deploy api --no-verify-jwt
//
// As regras (validação, formato do lançamento, lápide) estão em
// src/lib/financeApi.js, testadas com o resto (npm test). Aqui fica só a rede.
// Sem CORS de propósito: é servidor falando com servidor; navegador não chama.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { ApiError, options, listTransactions, summary, createTransaction, deleteTransaction } from "../../../src/lib/financeApi.js";

const API_KEY = Deno.env.get("FINANCE_API_KEY") || "";
const USER_ID = Deno.env.get("FINANCE_API_USER_ID") || "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

// Compara os hashes, não os textos: o tempo da comparação não entrega a chave aos poucos.
async function keyMatches(given: string) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([given, API_KEY].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function read() {
  const { data, error } = await db.from("user_data").select("data, updated_at").eq("user_id", USER_ID).maybeSingle();
  if (error) throw error;
  return { doc: data?.data ?? {}, version: (data?.updated_at as string | undefined) ?? null };
}

// Mesma trava do app (lib/storage.js): só grava se ninguém gravou desde a
// leitura; se gravou, lê de novo e reaplica a mudança.
async function write(change: (doc: any) => { doc: any; tx: any }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { doc, version } = await read();
    const result = change(doc);
    if (version === null) {
      const { error } = await db.from("user_data").insert({ user_id: USER_ID, data: result.doc });
      if (!error) return result.tx;
      if (error.code !== "23505") throw error;
    } else {
      const { data, error } = await db.from("user_data").update({ data: result.doc })
        .eq("user_id", USER_ID).eq("updated_at", version).select("user_id");
      if (error) throw error;
      if (data?.length) return result.tx;
    }
  }
  throw new ApiError(409, "Os dados mudaram enquanto gravava. Tente de novo.");
}

Deno.serve(async (req) => {
  try {
    if (API_KEY.length < 32 || !USER_ID) throw new Error("FINANCE_API_KEY (32+) ou FINANCE_API_USER_ID não configurados.");
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ") || !(await keyMatches(auth.slice(7).trim()))) return json(401, { error: "Chave inválida." });

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/(functions\/v1\/)?api/, "").replace(/\/+$/, "") || "/";
    const q = Object.fromEntries(url.searchParams);
    const route = `${req.method} ${path.replace(/^\/transactions\/[^/]+$/, "/transactions/:id")}`;

    switch (route) {
      case "GET /options": return json(200, options((await read()).doc));
      case "GET /summary": return json(200, summary((await read()).doc, q));
      case "GET /transactions": return json(200, { transactions: listTransactions((await read()).doc, q) });
      case "POST /transactions": {
        const body = await req.json().catch(() => { throw new ApiError(400, "Corpo não é JSON válido."); });
        return json(201, { transaction: await write((doc) => createTransaction(doc, body)) });
      }
      case "DELETE /transactions/:id": {
        const id = decodeURIComponent(path.split("/")[2]);
        return json(200, { deleted: await write((doc) => deleteTransaction(doc, id)) });
      }
      default: return json(404, { error: "Rota não existe. Rotas: GET /options, GET /summary, GET /transactions, POST /transactions, DELETE /transactions/:id." });
    }
  } catch (e) {
    if (e instanceof ApiError) return json(e.status, { error: e.message });
    // O detalhe vai para o log da função, não para quem chamou.
    console.error("api:", e);
    return json(500, { error: "Erro interno. Tente de novo em instantes." });
  }
});
