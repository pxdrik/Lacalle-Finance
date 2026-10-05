// syncEngine.js — o ciclo de carregar e salvar, fora do componente.
//
// Antes, carregar, salvar, desfazer e recarregar moravam dentro do
// LacalleFinance.jsx, controlados por três "bandeiras" (justLoaded,
// isUndoing, isReloading) que pulavam o salvamento. Isso causou:
// - desfazer que nunca era salvo, com a tela dizendo "Sincronizado";
// - dois salvamentos ao mesmo tempo acusando conflito contra o próprio app,
//   com a orientação de recarregar, que apagava a edição recém-feita;
// - falha ao carregar aparecendo como conta vazia e "Sincronizada".
//
// Aqui:
// - salva um de cada vez; o que chega no meio espera e vai na sequência;
// - só grava quando o conteúdo mudou de fato (então desfazer grava, e
//   aplicar dados da nuvem não grava de volta à toa);
// - conflito não para o app: busca a versão da nuvem, junta item por item
//   (lib/sync.js, o mais recente vence) e grava de novo;
// - falha de carregamento é um erro de verdade, para a tela mostrar.
//
// - sem rede (opcional, `local`): o documento com os carimbos fica guardado
//   no aparelho antes de cada envio. Se o envio falha, a edição não se perde
//   ao fechar o app; ao abrir de novo ela é juntada com a nuvem (mesma regra
//   do mais recente vence) e enviada. Sem rede ao abrir, o app abre com a
//   cópia do aparelho. Uma cópia só basta como fila: a junção é por item, então
//   ela já carrega todas as edições feitas sem conexão.
//
// `storage` é o de lib/storage.js (get/set com versão), ou um falso nos testes.
// `local` é {read(), write({doc, pending})}; ver localCopy() abaixo.
import { SCHEMA_VERSION, emptyDoc, normalizeDoc, stampChanges, mergeDocs, sameContent } from "./sync.js";

export function createSyncEngine({ storage, key = "data", local = null, now = () => Date.now(), maxMergeAttempts = 3, retryDelayMs = 800 }) {
  let cloud = null;    // o que sabemos estar na nuvem (com carimbos)
  let version = null;  // updated_at da linha na nuvem
  let seen = null;     // a última versão que a tela adotou
  let latest = null;   // pedido de salvamento ainda não processado
  let running = null;  // promessa do salvamento em andamento

  const parse = r => (r?.value ? normalizeDoc(JSON.parse(r.value)) : emptyDoc());
  // Cópia no aparelho: falhar aqui (sem espaço, modo privado) só desliga o modo sem rede.
  const keep = (doc, pending) => { try { local?.write({ doc, pending }); return !!local; } catch { return false; } };
  const kept = () => { try { return local?.read() ?? null; } catch { return null; } };
  const toPayload = doc => JSON.stringify({ ...doc, updatedAt: now(), v: SCHEMA_VERSION });

  /**
   * Carrega da nuvem e junta o que ficou no aparelho sem ser enviado. Sem rede,
   * abre com a cópia do aparelho se houver; sem cópia, lança o erro (a tela
   * mostra, não finge conta vazia).
   */
  async function load() {
    const saved = kept();
    let r;
    try {
      r = await storage.get(key);
    } catch (e) {
      if (!saved?.doc) throw e;
      cloud = null; // lida de novo antes de gravar
      version = null;
      seen = normalizeDoc(saved.doc);
      return seen;
    }
    cloud = parse(r);
    version = r?.version ?? null;
    // Edições guardadas sem rede entram pela junção; o salvamento seguinte as envia.
    seen = saved?.pending && saved.doc ? mergeDocs(normalizeDoc(saved.doc), cloud) : cloud;
    if (!saved?.pending) keep(cloud, false);
    return seen;
  }

  async function writeOnce(cur) {
    // o que a tela tem, com carimbos; e isso junto com o que está na nuvem
    const shownToUser = stampChanges(seen, cur, now());
    if (cloud && sameContent(mergeDocs(shownToUser, cloud), cloud)) return { status: "unchanged", adopt: null };
    keep(cloud ? mergeDocs(shownToUser, cloud) : shownToUser, true);
    if (!cloud) {
      // aberto sem rede: primeiro lê a nuvem, para juntar em vez de sobrescrever
      const r = await storage.get(key);
      cloud = parse(r);
      version = r?.version ?? null;
    }
    let doc = mergeDocs(shownToUser, cloud);
    if (sameContent(doc, cloud)) { keep(cloud, false); return { status: "unchanged", adopt: null }; }
    let expected = version;
    for (let attempt = 0; attempt <= maxMergeAttempts; attempt++) {
      const r = await storage.set(key, toPayload(doc), expected);
      if (r && !r.conflict) {
        cloud = doc;
        version = r.version;
        keep(doc, false);
        // O que foi gravado é o que a tela já mostra, a menos que a junção
        // tenha trazido algo de outro aparelho: aí a tela precisa adotar.
        const fromElsewhere = !sameContent(doc, shownToUser);
        if (!fromElsewhere) seen = doc;
        return { status: "saved", adopt: fromElsewhere ? doc : null };
      }
      // Outro aparelho gravou antes: junta com a versão da nuvem e tenta de novo.
      const remote = await storage.get(key);
      const remoteDoc = parse(remote);
      cloud = remoteDoc;
      version = remote?.version ?? null;
      doc = mergeDocs(doc, remoteDoc);
      expected = version;
    }
    throw new Error("Conflito persistente ao salvar");
  }

  async function writeWithRetry(cur) {
    try {
      return await writeOnce(cur);
    } catch (e) {
      // Uma nova tentativa automática cobre falha passageira de rede. Se a
      // primeira gravação chegou ao banco mas a resposta se perdeu, a versão
      // ficou velha: a nova tentativa cai em conflito, junta com a própria
      // gravação (conteúdo igual) e termina sem duplicar nada.
      await new Promise(res => setTimeout(res, retryDelayMs));
      try { return await writeOnce(cur); } catch (e2) {
        // Sem rede: se a cópia do aparelho guardou, nada se perde; a tela avisa "neste aparelho".
        return { status: kept()?.pending ? "offline" : "error", error: e2 || e, adopt: null };
      }
    }
  }

  /**
   * Pede para salvar o estado atual da tela. Salva um de cada vez: se já
   * houver um em andamento, este vai na sequência (e só o mais novo conta).
   * Retorna {status:"saved"|"unchanged"|"offline"|"error", adopt: doc|null}.
   * "offline": não chegou à nuvem, mas ficou guardado no aparelho.
   */
  function save(cur) {
    latest = cur;
    if (!running) {
      running = (async () => {
        let status = "unchanged", adopt = null, error;
        try {
          while (latest) {
            const doc = latest;
            latest = null;
            const r = await writeWithRetry(doc);
            if (r.status !== "unchanged" || status === "unchanged") status = r.status;
            if (r.adopt) adopt = r.adopt;
            if (r.status === "error" || r.status === "offline") { error = r.error; break; }
          }
        } finally {
          running = null;
        }
        return { status, adopt, error };
      })();
    }
    return running;
  }

  /**
   * Junta o estado atual da tela com o que já se sabe da nuvem, para a tela
   * adotar sem perder edições ainda não salvas. Usar depois de `adopt`.
   */
  function rebase(cur) {
    const doc = mergeDocs(stampChanges(seen, cur, now()), cloud);
    seen = doc;
    return doc;
  }

  /**
   * Confere se outro aparelho gravou algo (ao voltar para a aba). Retorna
   * true se a nuvem mudou e a tela deve chamar `rebase`. Não faz nada se
   * houver salvamento em andamento.
   */
  async function refresh() {
    if (running || latest) return false;
    const r = await storage.get(key);
    if ((r?.version ?? null) === version) return false;
    cloud = parse(r);
    version = r?.version ?? null;
    return true;
  }

  return { load, save, rebase, refresh, isBusy: () => !!running || !!latest, hasPending: () => !!kept()?.pending };
}

/** Cópia no localStorage, uma por conta. Apagada ao sair (ver clearLocalCopies). */
const LOCAL_PREFIX = "lf.offline.";
export function localCopy(key, store = globalThis.localStorage) {
  return {
    read: () => { const v = store.getItem(LOCAL_PREFIX + key); return v ? JSON.parse(v) : null; },
    write: v => store.setItem(LOCAL_PREFIX + key, JSON.stringify(v)),
  };
}
export function hasPendingLocalCopy(store = globalThis.localStorage) {
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(LOCAL_PREFIX) && JSON.parse(store.getItem(k))?.pending) return true;
    }
  } catch { /* sem armazenamento local */ }
  return false;
}
export function clearLocalCopies(store = globalThis.localStorage) {
  try {
    for (let i = store.length - 1; i >= 0; i--) { const k = store.key(i); if (k?.startsWith(LOCAL_PREFIX)) store.removeItem(k); }
  } catch { /* sem armazenamento local */ }
}
