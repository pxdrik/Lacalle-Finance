// eslint.config.js — checagem mínima e objetiva (BUG-07).
//
// Objetivo é pegar erro real (variável não definida, hook usado fora de
// regra, dependência de useEffect/useMemo esquecida — a classe de bug mais
// fácil de introduzir sem querer num componente deste tamanho), não abrir
// uma guerra de estilo. Por isso: regras recomendadas do JS + hooks do
// React, nada de regras de formatação/preferência.
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "load-test/**", "_drafts/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Sem isto, no-unused-vars não enxerga uso dentro de JSX e acusava
      // todo componente importado (223 avisos falsos que escondiam os reais).
      "react/jsx-uses-vars": "error",
      "react-refresh/only-export-components": "off", // não é um projeto de biblioteca de componentes
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
