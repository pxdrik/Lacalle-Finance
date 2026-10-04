// O app inteiro num Chromium de verdade, com a conta e o armazenamento
// falsos: prova pela tela o ciclo de salvamento (lib/syncEngine.js) que os
// testes de lógica provam por função.
import { StrictMode } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createFakeStorage } from "./test/fakeStorage.js";
import { setViewport, DESKTOP_WIDTH } from "./test/geometry.js";

const h = vi.hoisted(() => ({ storage: null }));

vi.mock("./lib/supabaseClient", () => ({
  openedFromRecoveryLink: false,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1", email: "pedro@exemplo.com", user_metadata: { name: "Pedro" } } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      updateUser: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));
vi.mock("./lib/storage", () => ({ storage: new Proxy({}, { get: (_t, k) => h.storage[k].bind(h.storage) }) }));

const { default: Root } = await import("./LacalleFinance.jsx");

const tx = (id, desc, val = 10) => ({ id, date: "2026-10-01", type: "Saída", fixed: "Variavel", cat: "Outros", desc, val, form: "pix", invTipo: null });
const SAVE_WAIT = { timeout: 4000 };

async function openApp() {
  render(<StrictMode><Root /></StrictMode>);
  await screen.findByRole("tab", { name: /Transações/ }, { timeout: 8000 });
}

async function addTransaction(desc, value) {
  fireEvent.click(screen.getByRole("tab", { name: /Transações/ }));
  const descInput = await screen.findByPlaceholderText("Descrição...");
  fireEvent.change(descInput, { target: { value: desc } });
  fireEvent.change(screen.getByPlaceholderText("R$"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar Saída/ }));
}

describe("ciclo de salvamento pela tela", () => {
  // Fluxos medidos no computador: no celular as abas viram a barra de baixo.
  beforeEach(async () => { h.storage = createFakeStorage(); await setViewport(DESKTOP_WIDTH, 900); });

  test("um lançamento novo chega na nuvem", async () => {
    await openApp();
    await addTransaction("Mercado", "45,00");
    await waitFor(() => expect(h.storage.peek()?.tx?.map(t => t.desc)).toEqual(["Mercado"]), SAVE_WAIT);
    expect(h.storage.peek().tx[0].val).toBe(45);
  });

  test("desfazer é gravado na nuvem, não só na tela", async () => {
    await openApp();
    await addTransaction("Lançado sem querer", "10,00");
    await waitFor(() => expect(h.storage.peek()?.tx?.length).toBe(1), SAVE_WAIT);
    fireEvent.click(screen.getByTitle(/Desfazer/));
    await waitFor(() => expect(h.storage.peek().tx.length).toBe(0), SAVE_WAIT);
  });

  test("outro aparelho gravou no meio: os dois lançamentos ficam, sem pedir para recarregar", async () => {
    h.storage = createFakeStorage({ tx: [tx(1, "Antigo")] });
    await openApp();
    h.storage.writeFromElsewhere(d => { d.tx.push(tx(999, "Do celular")); });
    await addTransaction("Do computador", "20,00");
    await waitFor(() => expect(h.storage.peek().tx.map(t => t.desc).sort()).toEqual(["Antigo", "Do celular", "Do computador"]), SAVE_WAIT);
    expect(screen.queryByText(/Dados desatualizados/)).toBeNull();
    await screen.findByText("Do celular", {}, SAVE_WAIT); // a tela adotou o que veio do outro aparelho
  });

  test("falha ao carregar mostra o erro e tentar de novo, não uma conta vazia", async () => {
    h.storage = createFakeStorage({ tx: [tx(1, "Guardado na nuvem")] });
    h.storage.failGet = true;
    render(<StrictMode><Root /></StrictMode>);
    await screen.findByText("Não consegui carregar seus dados.", {}, { timeout: 8000 });
    expect(screen.queryByRole("tab", { name: /Transações/ })).toBeNull();
    expect(h.storage.sets).toBe(0);
    h.storage.failGet = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("tab", { name: /Transações/ }, { timeout: 8000 });
    fireEvent.click(screen.getByRole("tab", { name: /Transações/ }));
    await screen.findByText("Guardado na nuvem");
  });

  test("um lançamento estragado na nuvem não derruba o app, e não é apagado", async () => {
    h.storage = createFakeStorage({ tx: [tx(1, "Bom"), { ...tx(2, "Estragado"), date: null, val: "abc" }] });
    await openApp();
    fireEvent.click(screen.getByRole("tab", { name: /Transações/ }));
    await screen.findByText("Bom");
    expect(screen.queryByText("Estragado")).toBeNull();
    await addTransaction("Depois", "5,00");
    await waitFor(() => expect(h.storage.peek()?.tx?.map(t => t.desc).sort()).toEqual(["Bom", "Depois"]), SAVE_WAIT);
    expect(h.storage.peek().quarantine.map(q => q.record.id)).toEqual([2]);
  });
});

describe("tela de erro por seção", () => {
  test("uma seção que quebra mostra o aviso e o resto continua; tentar de novo volta a desenhar", async () => {
    const { TabPanel } = await import("./components/ui.jsx");
    vi.spyOn(console, "error").mockImplementation(() => {});
    let broken = true;
    function Fragile() { if (broken) throw new Error("quebrou de propósito"); return <p>Voltou</p>; }
    render(<div><nav>Navegação</nav><TabPanel id="x" idPrefix="t"><Fragile /></TabPanel></div>);
    await screen.findByText("Algo deu errado nesta parte.");
    expect(screen.getByText("Navegação")).toBeTruthy();
    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("Voltou");
  });
});

describe("excluir em dois toques e desfazer pelo aviso", () => {
  beforeEach(async () => { h.storage = createFakeStorage({ tx: [tx(1, "Mercado")] }); await setViewport(DESKTOP_WIDTH, 900); });

  test("o primeiro toque só arma; sair do botão desarma", async () => {
    await openApp();
    fireEvent.click(screen.getByRole("tab", { name: /Transações/ }));
    const btn = await screen.findByRole("button", { name: "Excluir Mercado" });
    fireEvent.click(btn);
    expect(btn.textContent).toBe("Excluir?");
    fireEvent.blur(btn);
    expect(screen.getByRole("button", { name: "Excluir Mercado" })).toBeTruthy();
    expect(screen.getByText("Mercado")).toBeTruthy();
  });

  test("o segundo toque exclui; Desfazer no aviso devolve e não deixa cópia na lixeira", async () => {
    await openApp();
    fireEvent.click(screen.getByRole("tab", { name: /Transações/ }));
    const btn = await screen.findByRole("button", { name: "Excluir Mercado" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(h.storage.peek()?.tx?.length ?? 1).toBe(0), SAVE_WAIT);
    expect(h.storage.peek().trash.length).toBe(1);
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(h.storage.peek().tx.map(t => t.desc)).toEqual(["Mercado"]), SAVE_WAIT);
    expect(h.storage.peek().trash.length).toBe(0);
  });
});
