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

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");
  return user.id;
}

export const storage = {
  // Retorna {key, value, shared} | null — igual ao window.storage original.
  // `value` é sempre uma STRING (o app faz JSON.parse nela por conta própria).
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
    return { key, value: JSON.stringify(data.data), shared: false };
  },

  // Recebe `value` como STRING (o app já manda JSON.stringify(payload)).
  async set(key, value) {
    const userId = await getUserId();
    const parsed = JSON.parse(value);
    const { error } = await supabase
      .from("user_data")
      .upsert({ user_id: userId, data: parsed }, { onConflict: "user_id" });
    if (error) throw error;
    return { key, value, shared: false };
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
