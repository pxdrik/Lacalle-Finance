// autosaveGuard.js — regras puras de quando fazer flush do autosave pendente
// e quando avisar o usuário antes de fechar a aba (BUG-02).
//
// Ficam aqui, fora do componente, só pra serem testáveis sem precisar de um
// DOM/browser real — a integração (listeners de verdade em `document`/
// `window`) continua em LacalleFinance.jsx.
export function shouldFlushOnHide({ visibilityState, syncStatus, saveInFlight }) {
  if (visibilityState !== "hidden") return false; // só flusha ao esconder/fechar
  if (syncStatus !== "saving") return false; // nada pendente pra salvar
  if (saveInFlight) return false; // já tem uma escrita em voo, não duplica
  return true;
}

export function shouldWarnBeforeUnload({ syncStatus }) {
  // "saving" cobre tanto o debounce ainda não disparado quanto uma escrita
  // em voo — nos dois casos, a mudança do usuário ainda não está confirmada
  // como persistida, então vale avisar antes de deixar a aba fechar.
  return syncStatus === "saving";
}
