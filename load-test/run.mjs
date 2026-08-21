// ============================================================================
// load-test/run.mjs — teste de carga controlado contra o Supabase real.
//
// O que faz: cria N contas descartáveis (audit-loadtest-<hex>@example.com),
// e cada uma delas faz um ciclo repetido de leitura+escrita em `user_data`
// (o mesmo padrão do app: storage.get + storage.set) por um tempo definido,
// medindo p50/p95/p99 de cada operação. No final, apaga TUDO que criou:
// a linha em `user_data` e a própria conta de Auth.
//
// ATENÇÃO — leia antes de rodar:
//   - Isso gera tráfego REAL contra o seu projeto Supabase de produção.
//     Comece com poucos usuários simulados (10-20) antes de tentar centenas.
//   - Não rode isso sem antes checar os limites do seu plano Supabase
//     (conexões simultâneas, rate limits de Auth) — números grandes podem
//     esbarrar em limites da plataforma antes de qualquer limite do app.
//   - Apagar a conta de Auth (não só a linha de dados) exige a
//     "service_role key" — a mesma chave de privilégio total usada pela
//     Edge Function `delete-account`. Ela SÓ deve existir como variável de
//     ambiente local, na sua máquina, na hora de rodar este script — nunca
//     hardcoded aqui, nunca commitada, nunca logada. Ver instruções no
//     README (`load-test/README.md`).
//   - Se o script for interrompido no meio (Ctrl+C / SIGINT, ou SIGTERM de
//     quem estiver orquestrando o processo), os handlers abaixo tentam
//     limpar (user_data + conta de Auth) tudo que já foi criado até aquele
//     momento antes de encerrar. Se alguma limpeza falhar — durante a
//     interrupção ou ao final normal do script — o que ficou pendente é
//     listado explicitamente no console, com o e-mail e o motivo, para você
//     conferir/remover manualmente em Authentication → Users.
//
// Como usar:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//     node load-test/run.mjs --users=10 --duration=30
// ============================================================================

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
// Só lida via variável de ambiente local — nunca um valor literal aqui, e
// nunca impressa em nenhum console.log/erro abaixo.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NUM_USERS = parseInt(args.users || "10", 10);
const DURATION_S = parseInt(args.duration || "30", 10);

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (env vars) antes de rodar.");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    "Defina SUPABASE_SERVICE_ROLE_KEY (env var) antes de rodar — sem ela o script não " +
    "consegue apagar as contas de Auth que ele mesmo cria, e vai deixar lixo em produção. " +
    "Pegue a chave em Supabase → Project Settings → API → service_role (nunca a coloque " +
    "num arquivo versionado, só exporte na sua sessão de terminal local)."
  );
  process.exit(1);
}

const rand = () => Math.random().toString(16).slice(2);
const percentile = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

// Contas criadas nesta execução — é a partir daqui que o cleanup (normal ou
// por interrupção) sabe o que precisa apagar.
const createdAccounts = new Map(); // userId -> { email, accessToken }
let cleanupInFlight = false;

async function signup(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`signup falhou (${res.status}): ${JSON.stringify(body)}`);
  return body; // { access_token, user: { id, ... }, ... }
}

async function deleteUserData(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
    method: "DELETE",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`delete user_data falhou (${res.status})`);
}

async function deleteAuthAccount(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`delete conta de Auth falhou (${res.status})`);
}

// Apaga user_data + conta de Auth de uma conta criada por este script.
// Devolve null em sucesso total, ou uma descrição do que falhou.
async function cleanupOne(userId, { email, accessToken }) {
  const failures = [];
  try {
    await deleteUserData(accessToken);
  } catch (e) {
    failures.push(`user_data: ${e.message}`);
  }
  try {
    await deleteAuthAccount(userId);
  } catch (e) {
    failures.push(`conta de Auth: ${e.message}`);
  }
  return failures.length ? { email, userId, failures } : null;
}

// Limpa tudo que está em `createdAccounts` no momento em que é chamada.
// Usada tanto no fim normal do script quanto nos handlers de interrupção.
// Contas limpas com sucesso são removidas do Map (evita tentar de novo se
// for chamada mais de uma vez).
async function cleanupAll() {
  if (cleanupInFlight) return [];
  cleanupInFlight = true;
  const entries = [...createdAccounts.entries()];
  const results = await Promise.all(
    entries.map(async ([userId, info]) => {
      const failure = await cleanupOne(userId, info);
      if (!failure) createdAccounts.delete(userId);
      return failure;
    })
  );
  cleanupInFlight = false;
  return results.filter(Boolean);
}

function reportPending(pending) {
  if (!pending.length) {
    console.log("Cleanup: todas as contas de teste (user_data + Auth) foram removidas com sucesso.");
    return;
  }
  console.error(`\nATENÇÃO — ${pending.length} conta(s) de teste NÃO foram limpas completamente:`);
  for (const p of pending) {
    console.error(`  - ${p.email} (user_id: ${p.userId}): ${p.failures.join("; ")}`);
  }
  console.error(
    "Remova manualmente em Authentication → Users no painel do Supabase (procure por " +
    "'audit-loadtest-*'), e confira também a tabela user_data para linhas órfãs."
  );
}

let interrupted = false;
async function handleInterruption(signal) {
  if (interrupted) return; // segundo Ctrl+C etc. — não trava esperando de novo
  interrupted = true;
  console.log(`\n${signal} recebido — interrompendo e limpando ${createdAccounts.size} conta(s) já criada(s)...`);
  const pending = await cleanupAll();
  reportPending(pending);
  process.exit(pending.length ? 1 : 0);
}
process.on("SIGINT", () => handleInterruption("SIGINT"));
process.on("SIGTERM", () => handleInterruption("SIGTERM"));

async function virtualUser(id, stopAt, stats) {
  const email = `audit-loadtest-${rand()}@example.com`;
  const password = `Lt-${rand()}Aa1!`;
  let accessToken, userId;
  try {
    const signupRes = await signup(email, password);
    accessToken = signupRes.access_token;
    userId = signupRes.user?.id;
    if (!userId) throw new Error("signup não devolveu user.id");
    createdAccounts.set(userId, { email, accessToken });
  } catch (e) {
    stats.errors.push(`signup: ${e.message}`);
    return;
  }

  let payload = JSON.stringify({ tx: [], wishes: [], inst: [], planned: [], updatedAt: Date.now() });

  while (!interrupted && Date.now() < stopAt) {
    // GET (equivalente a storage.get)
    let t0 = Date.now();
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/user_data?select=data,updated_at`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
      });
      await r.json();
      stats.getMs.push(Date.now() - t0);
      if (!r.ok) stats.errors.push(`get ${r.status}`);
    } catch (e) {
      stats.errors.push(`get: ${e.message}`);
    }

    // UPSERT (equivalente a storage.set/forceSet — sem checar conflito aqui
    // de propósito, o objetivo é medir throughput bruto de escrita)
    t0 = Date.now();
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({ data: JSON.parse(payload) }),
      });
      await r.text();
      stats.setMs.push(Date.now() - t0);
      if (!r.ok) stats.errors.push(`set ${r.status}`);
    } catch (e) {
      stats.errors.push(`set: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
  }
}

async function main() {
  console.log(`Iniciando load test: ${NUM_USERS} usuários simulados por ${DURATION_S}s contra ${SUPABASE_URL}`);
  const stats = { getMs: [], setMs: [], errors: [] };
  const stopAt = Date.now() + DURATION_S * 1000;

  await Promise.all(Array.from({ length: NUM_USERS }, (_, i) => virtualUser(i, stopAt, stats)));
  if (interrupted) return; // handleInterruption já está cuidando do cleanup e do exit

  console.log(`\nLimpando ${createdAccounts.size} conta(s) de teste (user_data + Auth)...`);
  const pending = await cleanupAll();

  console.log(`
Resultado (${stats.getMs.length} GETs, ${stats.setMs.length} SETs, ${stats.errors.length} erros)
GET  p50=${percentile(stats.getMs, 50)}ms  p95=${percentile(stats.getMs, 95)}ms  p99=${percentile(stats.getMs, 99)}ms
SET  p50=${percentile(stats.setMs, 50)}ms  p95=${percentile(stats.setMs, 95)}ms  p99=${percentile(stats.setMs, 99)}ms
`);
  if (stats.errors.length) {
    console.log("Amostra de erros:", stats.errors.slice(0, 10));
  }
  reportPending(pending);
  process.exit(pending.length ? 1 : 0);
}

main();
