import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sanitizeMoneyInput, moneyTextToNumber } from "./money.js";
import { parseNum } from "./validation.js";

describe("valor colado ou digitado no campo", () => {
  test("colar \"1.234\" (formato do banco) é mil duzentos e trinta e quatro, não R$ 1,23", () => {
    assert.equal(sanitizeMoneyInput("1.234"), "1234");
  });
  test("colar \"1.234,56\", \"R$ 1.234,56\" e \"1,234.56\"", () => {
    assert.equal(sanitizeMoneyInput("1.234,56"), "1234,56");
    assert.equal(sanitizeMoneyInput("R$ 1.234,56"), "1234,56");
    assert.equal(sanitizeMoneyInput("1,234.56"), "1234,56");
  });
  test("milhões com vários separadores", () => {
    assert.equal(sanitizeMoneyInput("1.234.567"), "1234567");
    assert.equal(sanitizeMoneyInput("1.234.567,89"), "1234567,89");
  });
  test("ponto decimal do hábito antigo continua virando vírgula", () => {
    assert.equal(sanitizeMoneyInput("12.5"), "12,5");
    assert.equal(sanitizeMoneyInput("12.50"), "12,50");
    assert.equal(sanitizeMoneyInput("1."), "1,");
  });
  test("rascunho e limite de casas", () => {
    assert.equal(sanitizeMoneyInput("62,"), "62,");
    assert.equal(sanitizeMoneyInput("62,999"), "62,99");
    assert.equal(sanitizeMoneyInput("abc"), "");
  });
});

describe("parseNum usa a mesma regra", () => {
  test("\"1.234\" é 1234 e \"1,234.56\" é 1234,56", () => {
    assert.equal(parseNum("1.234"), 1234);
    assert.equal(parseNum("1,234.56"), 1234.56);
  });
  test("número já numérico passa direto (não vira milhar por ter 3 casas)", () => {
    assert.equal(moneyTextToNumber(12.345), 12.345);
    assert.equal(parseNum(1234.5), 1234.5);
  });
  test("CSV exportado com toFixed(2) volta igual", () => {
    assert.equal(parseNum("1234.50"), 1234.5);
  });
});

describe("digitando no campo, um separador a mais não embaralha o valor", () => {
  test("ponto ou vírgula depois da vírgula decimal é ignorado", () => {
    assert.equal(sanitizeMoneyInput("1234,5."), "1234,5");
    assert.equal(sanitizeMoneyInput("1234,5,"), "1234,5");
    assert.equal(sanitizeMoneyInput("12,"), "12,");
  });
  test("uma vírgula sozinha é sempre decimal, mesmo com 3 dígitos depois", () => {
    assert.equal(sanitizeMoneyInput("1,234"), "1,23");
  });
});
