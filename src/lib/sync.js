// sync.js — "o mais recente vence", item por item (mesma regra do LaCalle Life).
//
// Os dados de uma pessoa continuam num JSON só (tabela user_data). O que muda
// é o que acontece quando dois aparelhos salvam ao mesmo tempo: antes o app
// parava com "Dados desatualizados" e mandava recarregar, jogando fora a
// edição local. Agora as duas versões são juntadas registro por registro:
//
// - cada registro guarda `updatedAt`, a hora da última alteração. Ninguém
//   precisa lembrar de carimbar: stampChanges compara com a última versão
//   que a tela viu e carimba o que mudou;
// - apagar deixa uma lápide (`tombstones[coleção][id] = hora`), senão o outro
//   aparelho, que ainda tem o item, faria ele voltar;
// - nome, cor, nome da carteira, categorias próprias e o aviso de boas-vindas
//   têm a hora da última alteração em `fieldsUpdatedAt`;
// - na junção, para cada id fica a versão mais recente; uma lápide mais nova
//   que o registro apaga o registro, uma edição mais nova que a lápide o mantém.
//
// Tudo aqui é puro (sem rede, sem React) para ser testado à parte.

export const SCHEMA_VERSION = 2;

// coleção → campo que identifica o registro
export const COLLECTIONS = { tx: "id", wishes: "id", inst: "id", planned: "id", trash: "trashId" };
export const FIELDS = ["name", "accentKey", "walletName", "onboardingDismissed", "customCats"];
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// tipo do item na lixeira → coleção onde ele vive quando restaurado
const TRASH_TYPE_COLLECTION = { tx: "tx", wish: "wishes", installment: "inst", planned: "planned" };

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const ts = r => (typeof r?.updatedAt === "number" ? r.updatedAt : 0);
const strip = r => { const { updatedAt: _u, ...rest } = r; return rest; };

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
  return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
}

export function emptyDoc() {
  return {
    tx: [], wishes: [], inst: [], planned: [], trash: [],
    customCats: [], name: undefined, accentKey: undefined, walletName: undefined, onboardingDismissed: false,
    tombstones: { tx: {}, wishes: {}, inst: {}, planned: {}, trash: {} },
    fieldsUpdatedAt: {},
  };
}

/**
 * Deixa um documento vindo da nuvem (ou de um formato antigo) no formato
 * esperado. Dado lido do banco não obedece o tipo: lista que não é lista vira
 * lista vazia, registro que não é objeto ou não tem id é descartado.
 */
export function normalizeDoc(raw) {
  const d = isObj(raw) ? raw : {};
  const out = emptyDoc();
  for (const [coll, key] of Object.entries(COLLECTIONS)) {
    out[coll] = (Array.isArray(d[coll]) ? d[coll] : []).filter(r => isObj(r) && (typeof r[key] === "string" || typeof r[key] === "number"));
    const t = isObj(d.tombstones) && isObj(d.tombstones[coll]) ? d.tombstones[coll] : {};
    for (const [id, when] of Object.entries(t)) if (typeof when === "number") out.tombstones[coll][id] = when;
  }
  out.customCats = Array.isArray(d.customCats) ? d.customCats.filter(c => typeof c === "string") : [];
  out.name = typeof d.name === "string" ? d.name : undefined;
  out.accentKey = typeof d.accentKey === "string" ? d.accentKey : undefined;
  out.walletName = typeof d.walletName === "string" ? d.walletName : undefined;
  out.onboardingDismissed = !!d.onboardingDismissed;
  if (isObj(d.fieldsUpdatedAt)) for (const f of FIELDS) if (typeof d.fieldsUpdatedAt[f] === "number") out.fieldsUpdatedAt[f] = d.fieldsUpdatedAt[f];
  return out;
}

/**
 * Carimba o que mudou em `cur` (o estado da tela) em relação a `seen` (a
 * última versão que a tela viu). Registro novo ou alterado ganha
 * `updatedAt = now`; registro que sumiu ganha lápide; registro igual mantém
 * o carimbo que já tinha. Só o que a tela viu e deixou de ter vira lápide,
 * então dados de outro aparelho que a tela ainda não recebeu nunca são
 * apagados por engano.
 */
export function stampChanges(seen, cur, now) {
  const out = { ...emptyDoc(), tombstones: {}, fieldsUpdatedAt: { ...seen.fieldsUpdatedAt } };
  for (const [coll, key] of Object.entries(COLLECTIONS)) {
    const tomb = { ...(seen.tombstones[coll] || {}) };
    const seenMap = new Map(seen[coll].map(r => [String(r[key]), r]));
    const curIds = new Set();
    out[coll] = (cur[coll] || []).map(r => {
      const id = String(r[key]);
      curIds.add(id);
      const prev = seenMap.get(id);
      if (prev && deepEqual(strip(r), strip(prev))) return prev.updatedAt === undefined ? strip(r) : { ...strip(r), updatedAt: prev.updatedAt };
      delete tomb[id]; // recriado (desfazer, restaurar da lixeira)
      return { ...strip(r), updatedAt: now };
    });
    for (const id of seenMap.keys()) if (!curIds.has(id)) tomb[id] = now;
    for (const [id, when] of Object.entries(tomb)) if (now - when > TOMBSTONE_TTL_MS) delete tomb[id];
    out.tombstones[coll] = tomb;
  }
  for (const f of FIELDS) {
    out[f] = cur[f];
    if (!deepEqual(cur[f], seen[f])) out.fieldsUpdatedAt[f] = now;
  }
  return out;
}

/**
 * Junta duas versões, registro por registro: fica o mais recente. Em empate
 * exato, fica `b` (a versão da nuvem), para os dois aparelhos chegarem ao
 * mesmo resultado. Lápide mais nova que o registro apaga o registro.
 */
export function mergeDocs(a, b) {
  const out = { ...emptyDoc(), tombstones: {}, fieldsUpdatedAt: {} };
  for (const [coll, key] of Object.entries(COLLECTIONS)) {
    const tomb = { ...a.tombstones[coll] };
    for (const [id, when] of Object.entries(b.tombstones[coll] || {})) if (!(tomb[id] >= when)) tomb[id] = when;
    const bMap = new Map(b[coll].map(r => [String(r[key]), r]));
    const aIds = new Set();
    const pick = (id, ra, rb) => {
      const chosen = !ra ? rb : !rb ? ra : ts(ra) > ts(rb) ? ra : rb;
      if (tomb[id] !== undefined && tomb[id] >= ts(chosen)) return null;
      delete tomb[id];
      return chosen;
    };
    const list = [];
    for (const ra of a[coll]) { const id = String(ra[key]); aIds.add(id); const r = pick(id, ra, bMap.get(id)); if (r) list.push(r); }
    for (const rb of b[coll]) { const id = String(rb[key]); if (aIds.has(id)) continue; const r = pick(id, null, rb); if (r) list.push(r); }
    out[coll] = list;
    out.tombstones[coll] = tomb;
  }
  for (const f of FIELDS) {
    const ta = a.fieldsUpdatedAt[f] || 0, tb = b.fieldsUpdatedAt[f] || 0;
    out[f] = ta > tb ? a[f] : b[f];
    if (Math.max(ta, tb)) out.fieldsUpdatedAt[f] = Math.max(ta, tb);
  }
  // Um item que está vivo não fica também na lixeira: senão "Restaurar"
  // depois o duplicaria (mesmo id duas vezes, dinheiro contado em dobro).
  out.trash = out.trash.filter(t => {
    const coll = TRASH_TYPE_COLLECTION[t.type];
    return !(coll && t.item && out[coll].some(r => String(r.id) === String(t.item.id)));
  });
  return out;
}

/** Duas versões têm o mesmo conteúdo (registros, carimbos, lápides e campos)? */
export function sameContent(a, b) {
  for (const coll of Object.keys(COLLECTIONS)) {
    if (!deepEqual(a[coll], b[coll]) || !deepEqual(a.tombstones[coll], b.tombstones[coll])) return false;
  }
  return FIELDS.every(f => deepEqual(a[f], b[f])) && deepEqual(a.fieldsUpdatedAt, b.fieldsUpdatedAt);
}
