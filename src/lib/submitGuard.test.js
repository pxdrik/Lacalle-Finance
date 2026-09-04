import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createSubmitGuard } from "./submitGuard.js";

describe("submitGuard — BUG-01 double click must not create duplicate transaction", () => {
  test("second synchronous call is blocked while the first is still in its cooldown", () => {
    let clock = 1000;
    const guard = createSubmitGuard({ cooldownMs: 600, now: () => clock });

    let commits = 0;
    const commit = () => {
      if (!guard.tryEnter()) return false;
      commits++;
      return true;
    };

    // Simula duas submissões rápidas (dois cliques processados antes de
    // qualquer re-render) — exatamente uma transação deve ser criada.
    const first = commit();
    const second = commit();

    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(commits, 1, "exatamente uma transação deve ser criada");
  });

  test("a third click a few ms later is still blocked (within cooldown)", () => {
    let clock = 0;
    const guard = createSubmitGuard({ cooldownMs: 600, now: () => clock });
    assert.equal(guard.tryEnter(), true);
    clock += 50;
    assert.equal(guard.tryEnter(), false, "50ms depois ainda está no cooldown de 600ms");
  });

  test("a genuinely new click after the cooldown elapses is allowed (button returns to normal)", () => {
    let clock = 0;
    const guard = createSubmitGuard({ cooldownMs: 600, now: () => clock });
    assert.equal(guard.tryEnter(), true);
    clock += 601;
    assert.equal(guard.tryEnter(), true, "depois do cooldown, uma nova intenção real do usuário deve funcionar");
  });

  test("releaseNow unblocks immediately after a failure, so retrying right away works", () => {
    let clock = 0;
    const guard = createSubmitGuard({ cooldownMs: 600, now: () => clock });
    assert.equal(guard.tryEnter(), true);
    // Simula uma falha síncrona durante a operação: o chamador libera o lock
    // no `catch`/`finally` em vez de deixar o usuário travado por 600ms.
    guard.releaseNow();
    assert.equal(guard.tryEnter(), true, "depois de releaseNow, o próximo clique deve funcionar imediatamente");
  });

  test("isLocked reflects the current state without consuming the lock", () => {
    let clock = 0;
    const guard = createSubmitGuard({ cooldownMs: 600, now: () => clock });
    assert.equal(guard.isLocked, false);
    guard.tryEnter();
    assert.equal(guard.isLocked, true);
    clock += 601;
    assert.equal(guard.isLocked, false);
  });
});
