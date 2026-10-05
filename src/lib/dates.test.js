import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDay, formatDayTitle } from "./dates.js";

test("datas perto de hoje viram palavras", () => {
  assert.equal(formatDay("2026-10-04", "2026-10-04"), "hoje");
  assert.equal(formatDay("2026-10-03", "2026-10-04"), "ontem");
  assert.equal(formatDay("2026-10-05", "2026-10-04"), "amanhã");
});
test("mesmo ano mostra dia da semana e DD/MM; outro ano mostra DD/MM/AAAA", () => {
  assert.equal(formatDay("2026-10-10", "2026-10-04"), "sáb, 10/10");
  assert.equal(formatDay("2025-12-31", "2026-10-04"), "31/12/2025");
});
test("virada de mês e de ano no ontem/amanhã", () => {
  assert.equal(formatDay("2026-09-30", "2026-10-01"), "ontem");
  assert.equal(formatDay("2027-01-01", "2026-12-31"), "amanhã");
});
test("data ausente ou inválida vira travessão, nunca texto quebrado", () => {
  assert.equal(formatDay(undefined, "2026-10-04"), "—");
  assert.equal(formatDay("out/26", "2026-10-04"), "—");
});
test("título de grupo começa com maiúscula", () => {
  assert.equal(formatDayTitle("2026-10-04", "2026-10-04"), "Hoje");
});

import { formatMonthKey } from "./dates.js";
test("mês por extenso", () => {
  assert.equal(formatMonthKey("out/26"), "outubro de 2026");
  assert.equal(formatMonthKey("???"), "???");
});
