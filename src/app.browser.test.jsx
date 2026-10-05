// O app inteiro num Chromium de verdade, com a conta e o armazenamento
// falsos: prova pela tela o ciclo de salvamento (lib/syncEngine.js) que os
// testes de lógica provam por função.
import { StrictMode } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { createFakeStorage } from "./test/fakeStorage.js";
import { setViewport, DESKTOP_WIDTH, PHONE_WIDTHS, overflowX, hitTargetsAcross } from "./test/geometry.js";
import { contrastRatio } from "./lib/theme.js";

const h = vi.hoisted(() => ({ storage: null, invoke: null }));

vi.mock("./lib/supabaseClient", () => ({
  openedFromRecoveryLink: false,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1", email: "pedro@exemplo.com", user_metadata: { name: "Pedro" } } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      updateUser: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
    },
    functions: { invoke: (...a) => (h.invoke ? h.invoke(...a) : Promise.resolve({ data: null, error: null })) },
  },
}));
vi.mock("./lib/storage", () => ({ storage: new Proxy({}, { get: (_t, k) => h.storage[k].bind(h.storage) }) }));

const { default: Root } = await import("./LacalleFinance.jsx");

const tx = (id, desc, val = 10) => ({ id, date: "2026-10-01", type: "Saída", fixed: "Variavel", cat: "Outros", desc, val, form: "pix", invTipo: null });
const SAVE_WAIT = { timeout: 4000 };

async function openApp() {
  render(<StrictMode><Root /></StrictMode>);
  await screen.findByRole("navigation", { name: "Seções" }, { timeout: 8000 });
}
// botão de um destino na barra lateral (computador)
const navBtn = name => within(screen.getByRole("navigation", { name: "Seções" })).getByRole("button", { name: new RegExp(name) });

// O formulário abre numa folha pelo botão "Novo lançamento" (em Transações, o discreto).
async function openNewTxSheet() {
  fireEvent.click(navBtn("Transações"));
  const main = within(document.querySelector(".main-content"));
  fireEvent.click(await main.findByRole("button", { name: "Novo lançamento" }));
  return within(await screen.findByRole("dialog", { name: "Novo lançamento" }));
}
async function addTransaction(desc, value) {
  const sheet = await openNewTxSheet();
  fireEvent.change(sheet.getByLabelText("Descrição"), { target: { value: desc } });
  fireEvent.change(sheet.getByLabelText("Valor"), { target: { value } });
  fireEvent.click(sheet.getByRole("button", { name: /Adicionar Saída/ }));
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
    expect(screen.queryByRole("navigation", { name: "Seções" })).toBeNull();
    expect(h.storage.sets).toBe(0);
    h.storage.failGet = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("navigation", { name: "Seções" }, { timeout: 8000 });
    fireEvent.click(navBtn("Transações"));
    await screen.findByText("Guardado na nuvem");
  });

  test("um lançamento estragado na nuvem não derruba o app, e não é apagado", async () => {
    h.storage = createFakeStorage({ tx: [tx(1, "Bom"), { ...tx(2, "Estragado"), date: null, val: "abc" }] });
    await openApp();
    fireEvent.click(navBtn("Transações"));
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
    fireEvent.click(navBtn("Transações"));
    const btn = await screen.findByRole("button", { name: "Excluir Mercado" });
    fireEvent.click(btn);
    expect(btn.textContent).toBe("Excluir?");
    fireEvent.blur(btn);
    expect(screen.getByRole("button", { name: "Excluir Mercado" })).toBeTruthy();
    expect(screen.getByText("Mercado")).toBeTruthy();
  });

  test("o segundo toque exclui; Desfazer no aviso devolve e não deixa cópia na lixeira", async () => {
    await openApp();
    fireEvent.click(navBtn("Transações"));
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

describe("contraste medido na tela", () => {
  beforeEach(async () => { h.storage = createFakeStorage(); await setViewport(DESKTOP_WIDTH, 900); });
  const hex = rgb => "#" + rgb.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("");
  // o fundo efetivo: a primeira cor de fundo opaca subindo pela árvore
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(.*,\s*0\)|transparent/.test(c) && !/rgba\(.*,\s*0\.\d+\)/.test(c)) return hex(c); } return "#0b0d0f"; };
  const ratio = el => contrastRatio(hex(getComputedStyle(el).color), bgOf(el));

  test("seletor Saída/Entrada escolhido e botão Adicionar passam de 4,5:1", async () => {
    await openApp();
    const sheet = await openNewTxSheet();
    const group = within(sheet.getByRole("group", { name: "Tipo de lançamento" }));
    expect(ratio(group.getByRole("button", { name: "Saída", pressed: true }))).toBeGreaterThanOrEqual(4.5);
    fireEvent.click(group.getByRole("button", { name: "Entrada" }));
    expect(ratio(group.getByRole("button", { name: "Entrada", pressed: true }))).toBeGreaterThanOrEqual(4.5);
    fireEvent.change(sheet.getByLabelText("Descrição"), { target: { value: "Teste" } });
    fireEvent.change(sheet.getByLabelText("Valor"), { target: { value: "10" } });
    // mede depois da transição de cor do botão (0,15 s), não no meio dela
    await waitFor(() => expect(ratio(sheet.getByRole("button", { name: /Adicionar Entrada/ }))).toBeGreaterThanOrEqual(4.5));
  });
});

describe("modal sobre <dialog>", () => {
  beforeEach(async () => { h.storage = createFakeStorage(); await setViewport(DESKTOP_WIDTH, 900); });

  test("prende o foco, trava a página de trás, fecha com Esc e destrava", async () => {
    const { userEvent } = await import("vitest/browser");
    await openApp();
    fireEvent.click(screen.getByRole("button", { name: "Minha conta" }));
    const dialog = await waitFor(() => { const d = document.querySelector("dialog[open]"); if (!d) throw new Error("sem dialog"); return d; });
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.keyboard("{Tab}");
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.querySelector("dialog[open]")).toBeNull());
    expect(document.body.style.overflow).toBe("");
  });

  test("modal sem onClose (importar backup) não fecha com Esc", async () => {
    const { Modal } = await import("./components/ui.jsx");
    const { userEvent } = await import("vitest/browser");
    render(<Modal><p>Confirma a importação?</p><button>Importar</button></Modal>);
    await screen.findByText("Confirma a importação?");
    await userEvent.keyboard("{Escape}");
    expect(document.querySelector("dialog[open]")).not.toBeNull();
  });
});

describe("previsto com Até", () => {
  beforeEach(async () => { h.storage = createFakeStorage(); await setViewport(DESKTOP_WIDTH, 900); });

  test("cadastrar com Até: conta até o mês escolhido e some depois, com a linha de encerrado", async () => {
    const { monthKey, monthIndex, monthAt } = await import("./lib/financialEngine.js");
    const now = new Date();
    const thisMonth = monthKey(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`);
    const nextMonth = monthAt(monthIndex(thisMonth) + 1);
    await openApp();
    fireEvent.click(navBtn("Previstos"));
    fireEvent.click((await screen.findAllByRole("button", { name: "Adicionar" }))[0]);
    fireEvent.change(screen.getByPlaceholderText(/Smart Fit/), { target: { value: "Netflix" } });
    fireEvent.change(screen.getAllByPlaceholderText("R$").at(-1), { target: { value: "55,90" } });
    fireEvent.click(within(screen.getByRole("group", { name: "Repetição" })).getByRole("button", { name: /Todo mês/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "Até quando" })).getByRole("button", { name: "Até um mês" }));
    fireEvent.change(screen.getByLabelText("Último mês que conta"), { target: { value: nextMonth } });
    expect(screen.getByText(/Conta todo mês até/).textContent).toContain("2 meses");
    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" }).at(-1));
    await waitFor(() => expect(h.storage.peek()?.planned?.[0]).toMatchObject({ desc: "Netflix", recurring: true, from: thisMonth, until: nextMonth }), SAVE_WAIT);
    // mês seguinte: ainda conta
    const next = () => fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    next();
    await screen.findByText(`mensal até ${nextMonth}`, { exact: false });
    // dois meses depois: sumiu, e aparece a linha de encerrado
    next();
    await screen.findByText(/Encerrado antes deste mês: Netflix/);
    expect(screen.queryByText("Netflix")).toBeNull(); // saiu da lista do mês
  });
});

describe("apagar a conta pede login recente", () => {
  beforeEach(async () => { h.storage = createFakeStorage(); await setViewport(DESKTOP_WIDTH, 900); });

  test("se o servidor pede login recente, nada some e o aviso oferece sair e entrar", async () => {
    h.invoke = async () => ({ data: null, error: { context: { json: async () => ({ code: "reauth_required" }) } } });
    await openApp();
    fireEvent.click(screen.getByRole("button", { name: "Minha conta" }));
    fireEvent.click(await screen.findByRole("button", { name: /Apagar conta e dados/ }));
    fireEvent.change(await screen.findByLabelText("Digite APAGAR MINHA CONTA para confirmar"), { target: { value: "apagar minha conta" } });
    fireEvent.click(screen.getByRole("button", { name: "Apagar para sempre" }));
    await screen.findByText(/entre de novo com sua senha/);
    expect(screen.getByRole("button", { name: "Sair e entrar" })).toBeTruthy();
    expect(navBtn("Transações")).toBeTruthy(); // continua logado
    h.invoke = null;
  });
});

describe("lista longa e busca", () => {
  const many = Array.from({ length: 100 }, (_, i) => tx(i + 1, `Café ${i + 1}`, 5));
  beforeEach(async () => { h.storage = createFakeStorage({ tx: many }); await setViewport(DESKTOP_WIDTH, 900); });

  test("Transações desenha 40 de cada vez e libera mais ao rolar até o fim", async () => {
    await openApp();
    fireEvent.click(navBtn("Transações"));
    await screen.findAllByRole("button", { name: /^Excluir Café/ });
    expect(screen.getAllByRole("button", { name: /^Excluir Café/ }).length).toBe(40);
    window.scrollTo(0, document.body.scrollHeight);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Excluir Café/ }).length).toBeGreaterThan(40));
  });

  test("a busca mostra 6 e oferece ver todos, que leva a Transações filtrada", async () => {
    await openApp();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(await screen.findByPlaceholderText(/Buscar|Pesquisar/), { target: { value: "café" } });
    fireEvent.click(await screen.findByRole("button", { name: "Ver todos os 100 lançamentos" }));
    await waitFor(() => expect(navBtn("Transações").getAttribute("aria-current")).toBe("page"));
  });
});

describe("geometria da navegação", () => {
  beforeEach(() => { h.storage = createFakeStorage(); });

  for (const width of PHONE_WIDTHS) {
    test(`celular ${width}px: 5 destinos, rótulo de 11px sem transbordar, cada botão recebe o próprio toque`, async () => {
      await setViewport(width, 800);
      render(<StrictMode><Root /></StrictMode>);
      const nav = await screen.findByRole("navigation", { name: "Seções no celular" }, { timeout: 8000 });
      const buttons = within(nav).getAllByRole("button");
      expect(buttons.map(b => b.textContent)).toEqual(["Início", "Transações", "Metas", "Planos", "Mais"]);
      for (const b of buttons) {
        const label = b.querySelector(".bottom-nav-lbl");
        expect(getComputedStyle(label).fontSize).toBe("11px");
        expect(overflowX(b)).toBeLessThanOrEqual(0);
        expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(b.getBoundingClientRect().width);
        for (const hit of hitTargetsAcross(b)) expect(b.contains(hit)).toBe(true);
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    });
  }

  test("computador: barra lateral com os dois grupos e o item atual marcado", async () => {
    await setViewport(DESKTOP_WIDTH, 900);
    await openApp();
    const side = screen.getByRole("navigation", { name: "Seções" });
    expect(within(side).getByText("Dia a dia")).toBeTruthy();
    expect(within(side).getByText("Planejamento", { selector: ".side-group-title" })).toBeTruthy();
    expect(navBtn("Início").getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("navigation", { name: "Seções no celular" })).toBeNull();
  });

  test("celular: Previstos e Parcelas abrem pelo Mais", async () => {
    await setViewport(390, 800);
    render(<StrictMode><Root /></StrictMode>);
    const nav = await screen.findByRole("navigation", { name: "Seções no celular" }, { timeout: 8000 });
    fireEvent.click(within(nav).getByRole("button", { name: "Mais" }));
    fireEvent.click(await screen.findByRole("button", { name: /Previstos/ }));
    await waitFor(() => expect(within(nav).getByRole("button", { name: "Mais" }).getAttribute("aria-current")).toBe("page"));
  });
});
