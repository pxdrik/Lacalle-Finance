import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isRecoveryUrl, checkNewPassword } from "./authRecovery.js";

describe("recuperação de senha", () => {
  test("reconhece o hash do link de recuperação do Supabase", () => {
    assert.equal(isRecoveryUrl("#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery"), true);
  });
  test("não confunde com login comum, confirmação de cadastro ou endereço sem hash", () => {
    assert.equal(isRecoveryUrl("#access_token=abc&type=signup"), false);
    assert.equal(isRecoveryUrl("#access_token=abc&type=magiclink"), false);
    assert.equal(isRecoveryUrl(""), false);
    assert.equal(isRecoveryUrl(undefined), false);
  });
  test("senha curta é recusada", () => {
    assert.match(checkNewPassword("123", "123"), /pelo menos 6/);
  });
  test("confirmação diferente é recusada", () => {
    assert.match(checkNewPassword("senha123", "senha124"), /não são iguais/);
  });
  test("senha válida e igual passa", () => {
    assert.equal(checkNewPassword("senha123", "senha123"), "");
  });
});
