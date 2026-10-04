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
// `storage` é o de lib/storage.js (get/set com versão), ou um falso nos testes.
import { SCHEMA_VERSION, emptyDoc, normalizeDoc, stampChanges, mergeDocs, sameContent } from "./sync.js";

export function createSyncEngine({ storage, key = "data", now = () => Date.now(), maxMergeAttempts = 3, retryDelayMs = 800 }) {
  let cloud = null;    // o que sabemos estar na nuvem (com carimbos)
  let version = null;  // updated_at da linha na nuvem
  let seen = null;     // a última versão que a tela adotou
  let latest = null;   // pedido de salvamento ainda não processado
  let running = null;  // promessa do salvamento em andamento

  const parse = r => (r?.value ? normalizeDoc(JSON.parse(r.value)) : emptyDoc());
  const toPayload = doc => JSON.stringify({ ...doc, updatedAt: now(), v: SCHEMA_VERSION });

  /** Carrega da nuvem. Lança erro se falhar: a tela deve mostrar, não fingir conta vazia. */
  async function load() {
    const r = await storage.get(key);
    cloud = parse(r);
    version = r?.version ?? null;
    seen = cloud;
    return cloud;
  }

  async function writeOnce(cur) {
    // o que a tela tem, com carimbos; e isso junto com o que está na nuvem
    const shownToUser = stampChanges(seen, cur, now());
    let doc = mergeDocs(shownToUser, cloud);
    if (sameContent(doc, cloud)) return { status: "unchanged", adopt: null };
    let expected = version;
    for (let attempt = 0; attempt <= maxMergeAttempts; attempt++) {
      const r = await storage.set(key, toPayload(doc), expected);
      if (r && !r.conflict) {
        cloud = doc;
        version = r.version;
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
      try { return await writeOnce(cur); } catch (e2) { return { status: "error", error: e2 || e, adopt: null }; }
    }
  }

  /**
   * Pede para salvar o estado atual da tela. Salva um de cada vez: se já
   * houver um em andamento, este vai na sequência (e só o mais novo conta).
   * Retorna {status:"saved"|"unchanged"|"error", adopt: doc|null}.
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
            if (r.status === "error") { error = r.error; break; }
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

  return { load, save, rebase, refresh, isBusy: () => !!running || !!latest };
}
