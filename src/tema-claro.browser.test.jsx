// O app no tema claro (desde 24/11/2026 ele segue o tema do sistema).
// Roda numa instância própria do Chromium com prefers-color-scheme: light
// (vitest.config.js); a suíte principal roda no escuro. O axe mede o
// contraste de verdade, tela por tela, com as cores já desenhadas.
import { StrictMode } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { createFakeStorage } from "./test/fakeStorage.js";
import { setViewport, DESKTOP_WIDTH } from "./test/geometry.js";
import { axeViolations } from "./test/axe.js";

const h = vi.hoisted(() => ({ storage: null }));
vi.mock("./lib/supabaseClient", () => ({
  openedFromRecoveryLink: false,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1", email: "pedro@exemplo.com", user_metadata: { name: "Pedro" } } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));
vi.mock("./lib/storage", () => ({ storage: new Proxy({}, { get: (_t, k) => h.storage[k].bind(h.storage) }) }));

const { default: Root } = await import("./LacalleFinance.jsx");
const { default: AuthScreen } = await import("./components/AuthScreen.jsx");
const { IS_LIGHT, LIGHT } = await import("./lib/palette.js");

const tx = (id, desc, val, over = {}) => ({ id, date: "2026-10-01", type: "Saída", fixed: "Variavel", cat: "Alimentação", desc, val, form: "pix", invTipo: null, ...over });
const data = {
  tx: [tx(1, "Salário", 3000, { type: "Entrada", cat: "Salario / Entradas" }), tx(2, "Mercado", 245), tx(3, "CDB", 500, { cat: "Investimento", invTipo: "Aporte" })],
  wishes: [{ id: 1, name: "Viagem", price: 5000, saved: 1000, priority: "Média", monthsTarget: 0, notes: "", done: false }],
  planned: [{ id: 1, desc: "Aluguel", val: 1500, cat: "Outros", form: "pix", recurring: true, month: null, paid: {}, ignored: {} }],
};
const navBtn = name => within(screen.getByRole("navigation", { name: "Seções" })).getByRole("button", { name: new RegExp(name) });
const animationsDone = () => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
const rgb = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

async function openApp() {
  render(<StrictMode><Root /></StrictMode>);
  await screen.findByRole("navigation", { name: "Seções" }, { timeout: 8000 });
}

describe("tema claro", () => {
  beforeEach(async () => { h.storage = createFakeStorage(data); await setViewport(DESKTOP_WIDTH, 900); });

  test("o sistema em claro abre o app em claro: fundo da página e cartões", async () => {
    expect(IS_LIGHT).toBe(true);
    await openApp();
    expect(getComputedStyle(document.body).backgroundColor).toBe(rgb(LIGHT.bg));
    expect(getComputedStyle(document.documentElement).colorScheme).toBe("light");
  });

  for (const section of ["Início", "Transações", "Metas", "Previstos", "Parcelas", "Planejamento"]) {
    test(`computador: ${section}, sem problema de contraste`, async () => {
      await openApp();
      fireEvent.click(navBtn(section));
      await waitFor(() => expect(navBtn(section).getAttribute("aria-current")).toBe("page"));
      await animationsDone();
      expect(await axeViolations()).toEqual([]);
    });
  }

  test("Perfil aberto", async () => {
    await openApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Minha conta" })[0]);
    await screen.findByRole("button", { name: /Apagar conta e dados/ });
    await animationsDone();
    expect(await axeViolations()).toEqual([]);
  });

  test("folha de novo lançamento aberta", async () => {
    await openApp();
    fireEvent.click(navBtn("Transações"));
    fireEvent.click(await within(document.querySelector(".main-content")).findByRole("button", { name: "Novo lançamento" }));
    await screen.findByRole("dialog", { name: "Novo lançamento" });
    await animationsDone();
    expect(await axeViolations()).toEqual([]);
  });

  test("celular 390px: Início com a barra de baixo", async () => {
    await setViewport(390, 800);
    render(<StrictMode><Root /></StrictMode>);
    await screen.findByRole("navigation", { name: "Seções no celular" }, { timeout: 8000 });
    await animationsDone();
    expect(await axeViolations()).toEqual([]);
  });

  test("tela de entrar", async () => {
    render(<AuthScreen onLogin={vi.fn()} />);
    await animationsDone();
    expect(await axeViolations()).toEqual([]);
  });
});
