// authRecovery.js — o caminho de "Esqueci minha senha" até a senha nova.
//
// O e-mail de recuperação do Supabase traz o usuário de volta com
// `#...type=recovery` no endereço e já logado. Antes o app tratava isso como
// um login comum: entrava direto, sem nunca pedir a senha nova, então o
// fluxo terminava num beco sem saída.

/** O endereço veio do link de recuperação de senha? (lido antes do Supabase limpar o hash) */
export function isRecoveryUrl(hash) {
  if (typeof hash !== "string" || !hash) return false;
  return new URLSearchParams(hash.replace(/^#/, "")).get("type") === "recovery";
}

export const MIN_PASSWORD_LEN = 6; // mesmo mínimo do cadastro (AuthScreen)

/** Valida a senha nova e a confirmação. Retorna a mensagem de erro, ou "" se estiver tudo certo. */
export function checkNewPassword(password, confirm) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LEN) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LEN} caracteres.`;
  if (password !== confirm) return "As duas senhas não são iguais. Digite a mesma senha nos dois campos.";
  return "";
}
