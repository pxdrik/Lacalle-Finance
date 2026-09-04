// submitGuard.js — lock síncrono de reentrância para proteger ações de
// "submit" (ex.: adicionar transação) contra duplo clique / clique duplo
// rápido, sem depender de rede ou de qualquer timer do browser.
//
// Por que um `useState` de "salvando" sozinho não basta: o BUG-01 real era
// um clique duplo processado ANTES do primeiro `setState` re-renderizar —
// nesse instante, o componente ainda lê o `transactions` antigo da closure,
// então qualquer checagem de duplicidade baseada em ESTADO React chega tarde
// demais. Um lock guardado em `ref`/variável de módulo (mutável, síncrono,
// fora do ciclo de render) é a única forma de barrar a segunda chamada antes
// mesmo dela começar a rodar.
export function createSubmitGuard({ cooldownMs = 600, now = () => Date.now() } = {}) {
  let unlockAt = 0;

  return {
    // true = pode prosseguir (e já tranca até `cooldownMs` no futuro);
    // false = ainda trancado, o chamador deve ignorar essa tentativa.
    tryEnter() {
      const t = now();
      if (t < unlockAt) return false;
      unlockAt = t + cooldownMs;
      return true;
    },
    // Libera o lock imediatamente — usado quando a operação falha antes de
    // terminar, pra o botão não ficar travado sem motivo até o cooldown.
    releaseNow() {
      unlockAt = 0;
    },
    get isLocked() {
      return now() < unlockAt;
    },
  };
}
