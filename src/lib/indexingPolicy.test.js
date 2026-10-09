import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Auditoria de 09/10/2026, F5: o app é privado, e a tela de login não deve
// aparecer no Google. Quem impede a indexação é o "noindex", dito duas vezes:
// no cabeçalho de toda resposta (vercel.json) e na página (index.html). O
// robots.txt tem que DEIXAR o buscador entrar: se ele bloqueasse, o buscador
// nunca leria o "noindex", e o endereço podia aparecer nos resultados mesmo
// assim, sem conteúdo. Antes não existia robots.txt e /robots.txt devolvia a
// página do app (HTML), que o Lighthouse marcava como inválido.
const root = new URL("../../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");

describe("política de indexação", () => {
  test("toda resposta da Vercel leva X-Robots-Tag noindex", () => {
    const config = JSON.parse(read("vercel.json"));
    const all = config.headers.find(h => h.source === "/(.*)");
    const tag = all?.headers.find(h => h.key === "X-Robots-Tag");
    assert.match(tag?.value ?? "", /\bnoindex\b/);
  });

  test("a página diz noindex por conta própria, para quando o cabeçalho faltar", () => {
    assert.match(read("index.html"), /<meta\s+name="robots"\s+content="[^"]*\bnoindex\b[^"]*"/);
  });

  test("robots.txt é texto e não bloqueia o buscador de ler o noindex", () => {
    const robots = read("public/robots.txt");
    assert.doesNotMatch(robots, /<html/i);
    assert.match(robots, /^User-agent: \*$/m);
    assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/m);
  });
});
