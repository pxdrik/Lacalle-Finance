// ============================================================================
// storage.js — substituto do `window.storage` do artifact, com a MESMA
// assinatura (get/set/delete), só que gravando de verdade no Supabase em vez
// do armazenamento interno do Claude.ai.
//
// Por que fazer assim: o app inteiro (LacalleFinance.jsx) já fala com
// `window.storage.get/set/delete(chave, valor)`. Em vez de reescrever toda a
// lógica de carregar/salvar dentro do componente gigante, criamos aqui uma
// "camada compatível" com a mesma forma — assim a migração vira, na prática,
// trocar `window.storage.` por `storage.` e pronto, o resto do app nem
// percebe a diferença.
//
// Cada usuário logado tem UMA linha na tabela `user_data` (ver
// supabase-schema.sql), guardando um JSON com tudo — igual ao que já
// acontecia. `key` aqui não é realmente usado pra nada além de manter a
// assinatura parecida, já que hoje o app só usa uma chave por usuário mesmo
// (o RLS do Supabase já garante que cada usuário só vê a própria linha, então
// nem precisamos da "chave por e-mail" que existia antes).
// ============================================================================
import { supabase } from "./supabaseClient";

// getSession lê a sessão guardada no aparelho; getUser ia até o servidor a
// cada leitura e gravação só para descobrir o próprio id. Quem garante que
// cada pessoa só lê e grava a própria linha é o RLS no banco, não este id.
async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Usuário não autenticado.");
  return session.user.id;
}

export const storage = {
  // Retorna {key, value, shared, version} | null — igual ao window.storage
  // original, com um campo a mais: `version` é o `updated_at` que o BANCO
  // controla (a coluna, não o campo `updatedAt` de dentro do JSON — esse é
  // só um espelho pro frontend exibir, o banco nunca confia nele). É esse
  // `version` que o `set()` usa para detectar conflito de forma atômica.
  async get(key) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from("user_data")
      .select("data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    // Guardamos o JSON já "achatado" numa string, pra bater exatamente com o
    // comportamento anterior (window.storage.set recebia um JSON.stringify
    // e window.storage.get devolvia essa mesma string em `.value`).
    return { key, value: JSON.stringify(data.data), shared: false, version: data.updated_at };
  },

  // Recebe `value` como STRING (o app já manda JSON.stringify(payload)).
  //
  // `expectedVersion` é o `version` (updated_at do banco) que veio do último
  // `get()`/`set()` bem-sucedido — é a "trava" de concorrência otimista:
  //   - undefined/null  → não existe linha ainda (primeiro save do usuário):
  //     tenta um INSERT puro. Se já existir uma linha (outra aba criou
  //     primeiro), o INSERT falha por violar a chave primária → conflito.
  //   - uma string (o updated_at conhecido) → tenta um UPDATE condicional
  //     (`WHERE user_id = ... AND updated_at = expectedVersion`), que só
  //     afeta a linha se ninguém mexeu nela desde a última leitura. Zero
  //     linhas afetadas = outra aba/aparelho salvou por baixo do nosso pé.
  //
  // Isso substitui o antigo padrão "ler pra checar, depois escrever" (que
  // tinha uma janela de corrida entre o check e o write) por uma única
  // operação atômica no banco.
  async set(key, value, expectedVersion) {
    const userId = await getUserId();
    const parsed = JSON.parse(value);

    if (expectedVersion === undefined || expectedVersion === null) {
      const { data, error } = await supabase
        .from("user_data")
        .insert({ user_id: userId, data: parsed })
        .select("updated_at")
        .single();
      if (error) {
        if (error.code === "23505") return { conflict: true }; // já existe linha
        throw error;
      }
      return { key, value, shared: false, version: data.updated_at };
    }

    const { data, error } = await supabase
      .from("user_data")
      .update({ data: parsed })
      .eq("user_id", userId)
      .eq("updated_at", expectedVersion)
      .select("updated_at");
    if (error) throw error;
    if (!data || data.length === 0) return { conflict: true };
    return { key, value, shared: false, version: data[0].updated_at };
  },

  // Sobrescreve sem checar conflito — só para ações explícitas do próprio
  // usuário que já significam "quero substituir tudo" (ex.: importar um
  // backup). Continua devolvendo `version` pra sincronizar a trava depois.
  async forceSet(key, value) {
    const userId = await getUserId();
    const parsed = JSON.parse(value);
    const { data, error } = await supabase
      .from("user_data")
      .upsert({ user_id: userId, data: parsed }, { onConflict: "user_id" })
      .select("updated_at")
      .single();
    if (error) throw error;
    return { key, value, shared: false, version: data.updated_at };
  },

  async delete(key) {
    const userId = await getUserId();
    const { error } = await supabase
      .from("user_data")
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
    return { key, deleted: true, shared: false };
  },
};
