import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { shouldFlushOnHide, shouldWarnBeforeUnload } from "./autosaveGuard.js";

describe("BUG-02 — pending autosave must not silently lose user changes", () => {
  test("editar + esconder a aba imediatamente deve disparar o flush", () => {
    const decision = shouldFlushOnHide({
      visibilityState: "hidden",
      syncStatus: "saving", // ainda dentro do debounce de 1200ms
      saveInFlight: false,
    });
    assert.equal(decision, true);
  });

  test("não flusha se a aba continua visível (evita chamadas redundantes)", () => {
    const decision = shouldFlushOnHide({
      visibilityState: "visible",
      syncStatus: "saving",
      saveInFlight: false,
    });
    assert.equal(decision, false);
  });

  test("não flusha se já está tudo salvo (nada pendente)", () => {
    const decision = shouldFlushOnHide({
      visibilityState: "hidden",
      syncStatus: "saved",
      saveInFlight: false,
    });
    assert.equal(decision, false);
  });

  test("edição + erro de persistência: não flusha de novo sozinho (evita loop); o retry manual continua disponível", () => {
    // syncStatus "error" significa que já tentamos e falhou (com retry
    // automático incluso em doSave) — não é mais "saving", então o flush de
    // hide não deve tentar de novo sem o usuário pedir.
    const decision = shouldFlushOnHide({
      visibilityState: "hidden",
      syncStatus: "error",
      saveInFlight: false,
    });
    assert.equal(decision, false);
  });

  test("edição + navegação (múltiplas edições rápidas, ainda salvando): não duplica a chamada se já há uma escrita em voo", () => {
    const decision = shouldFlushOnHide({
      visibilityState: "hidden",
      syncStatus: "saving",
      saveInFlight: true,
    });
    assert.equal(decision, false, "não deve disparar uma segunda escrita por cima da que já está em curso");
  });

  test("beforeunload avisa o usuário quando há alteração não confirmada como salva", () => {
    assert.equal(shouldWarnBeforeUnload({ syncStatus: "saving" }), true);
  });

  test("beforeunload não avisa quando já está tudo salvo", () => {
    assert.equal(shouldWarnBeforeUnload({ syncStatus: "saved" }), false);
  });

  test("beforeunload não avisa em estado inicial/offline sem edição pendente", () => {
    assert.equal(shouldWarnBeforeUnload({ syncStatus: "idle" }), false);
    assert.equal(shouldWarnBeforeUnload({ syncStatus: "loading" }), false);
  });
});
