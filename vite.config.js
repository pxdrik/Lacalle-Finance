import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Atualiza o app sozinho quando uma nova versão é publicada (deploy).
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Lacalle Finance",
        short_name: "Lacalle",
        description:
          "Controle financeiro pessoal: saldos, projeções, previstos e metas.",
        lang: "pt-BR",
        theme_color: "#071421",
        background_color: "#071421",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache do "casco" do app (JS/CSS/HTML/ícones/fontes locais) para
        // abrir rápido e funcionar offline. Dados vêm do Supabase/localStorage.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
