import { createClient } from "@supabase/supabase-js";
import { isRecoveryUrl } from "./authRecovery.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Isso normalmente significa que o arquivo .env não foi criado ainda
  // (veja o README) ou que as variáveis não foram configuradas na Vercel.
  console.error(
    "Faltam as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
    "Copie .env.example para .env e preencha com os dados do seu projeto Supabase."
  );
}

// Lido ANTES do createClient: o Supabase consome o hash do link de
// recuperação ao iniciar e avisa com PASSWORD_RECOVERY num setTimeout, que
// pode disparar antes de o app se inscrever no onAuthStateChange.
export const openedFromRecoveryLink = typeof window !== "undefined" && isRecoveryUrl(window.location.hash);

export const supabase = createClient(url, anonKey);
