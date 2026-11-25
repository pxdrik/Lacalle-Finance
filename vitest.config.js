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
      headless: true,
      // O app segue o tema do sistema (lib/palette.js). A suíte roda no escuro,
      // como sempre rodou; tema-claro.browser.test.jsx roda no claro.
      instances: [
        { browser: "chromium", name: "escuro", provider: playwright({ contextOptions: { colorScheme: "dark" } }), exclude: ["src/tema-claro.browser.test.jsx"] },
        { browser: "chromium", name: "claro", provider: playwright({ contextOptions: { colorScheme: "light" } }), include: ["src/tema-claro.browser.test.jsx"] },
      ],
    },
  },
});
