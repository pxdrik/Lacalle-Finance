// Testes de navegador (Vitest Browser Mode num Chromium de verdade).
//
// Os testes de lógica continuam em node:test (`npm test`, src/lib/*.test.js).
// Aqui fica o que só existe depois de a tela ser desenhada: o app montado com
// um armazenamento falso (salvar, desfazer, juntar com outro aparelho), e
// medidas de geometria (transbordo, quem recebe o toque). Mesma divisão do
// LaCalle Life: falsificar getBoundingClientRect num teste de lógica é sinal
// de que ele está no lugar errado.
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.browser.test.{js,jsx}"],
    setupFiles: ["./src/test/setup.browser.js"],
    testTimeout: 20_000,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
