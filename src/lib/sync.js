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
export const FIELDS = ["name", "accentKey", "walletName", "onboardingDismissed", "customCats", "accounts"];
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// tipo do item na lixeira → coleção onde ele vive quando restaurado
const TRASH_TYPE_COLLECTION = { tx: "tx", wish: "wishes", installment: "inst", planned: "planned" };

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = v => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const str = (v, fallback = "") => (typeof v === "string" ? v : v === undefined || v === null ? fallback : String(v));

/**
 * Conserta o que dá para consertar sem mudar o sentido (número guardado como
 * texto, descrição ausente) e devolve null para o que quebraria as contas e
 * as telas (data que não é data, valor que não é número). Dado lido do banco
 * não obedece o tipo: um registro assim derrubava o app inteiro, porque os
 * cálculos rodam antes de qualquer tela protegida.
 */
function repairRecord(coll, r) {
  if (coll === "tx") {
    const val = num(r.val);
    if (!ISO_DAY.test(str(r.date)) || !Number.isFinite(val)) return null;
    return { ...r, val, desc: str(r.desc), cat: str(r.cat, "Outros") || "Outros", type: r.type === "Entrada" ? "Entrada" : "Saída" };
  }
  if (coll === "planned") {
    const val = num(r.val);
    if (!Number.isFinite(val)) return null;
    return { ...r, val, desc: str(r.desc), cat: str(r.cat, "Outros") || "Outros", recurring: !!r.recurring, paid: isObj(r.paid) ? r.paid : {}, ignored: isObj(r.ignored) ? r.ignored : {} };
  }
  if (coll === "inst") {
    const totalVal = num(r.totalVal);
    if (!Number.isFinite(totalVal) || !ISO_DAY.test(str(r.startDate))) return null;
    return { ...r, totalVal, desc: str(r.desc), txIds: Array.isArray(r.txIds) ? r.txIds : [] };
  }
  if (coll === "wishes") {
    const price = num(r.price), saved = r.saved === undefined ? 0 : num(r.saved);
    if (!Number.isFinite(price) || !Number.isFinite(saved)) return null;
    return { ...r, price, saved, name: str(r.name) };
  }
  if (coll === "trash") return isObj(r.item) ? r : null;
  return r;
}
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
    customCats: [], name: undefined, accentKey: undefined, walletName: undefined, onboardingDismissed: false, accounts: undefined,
    tombstones: { tx: {}, wishes: {}, inst: {}, planned: {}, trash: {} },
    fieldsUpdatedAt: {},
    // registros que não dá para mostrar sem quebrar as contas: guardados
    // como vieram (nada é apagado), fora das telas e dos cálculos
    quarantine: [],
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
    const list = [];
    for (const r of Array.isArray(d[coll]) ? d[coll] : []) {
      if (!isObj(r) || (typeof r[key] !== "string" && typeof r[key] !== "number")) continue;
      const fixed = repairRecord(coll, r);
      if (fixed) list.push(fixed);
      else out.quarantine.push({ coll, record: r });
    }
    out[coll] = list;
    const t = isObj(d.tombstones) && isObj(d.tombstones[coll]) ? d.tombstones[coll] : {};
    for (const [id, when] of Object.entries(t)) if (typeof when === "number") out.tombstones[coll][id] = when;
  }
  if (Array.isArray(d.quarantine)) out.quarantine.push(...d.quarantine.filter(q => isObj(q) && isObj(q.record)));
  out.customCats = Array.isArray(d.customCats) ? d.customCats.filter(c => typeof c === "string") : [];
  out.name = typeof d.name === "string" ? d.name : undefined;
  out.accentKey = typeof d.accentKey === "string" ? d.accentKey : undefined;
  out.walletName = typeof d.walletName === "string" ? d.walletName : undefined;
  out.onboardingDismissed = !!d.onboardingDismissed;
  // contas bancárias: [{id, name}]; registro sem `account` é da conta "principal"
  if (Array.isArray(d.accounts)) out.accounts = d.accounts.filter(a => isObj(a) && typeof a.id === "string" && typeof a.name === "string");
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
  const out = { ...emptyDoc(), tombstones: {}, fieldsUpdatedAt: { ...seen.fieldsUpdatedAt }, quarantine: seen.quarantine || [] };
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
  const seenQ = new Set();
  const quarantine = [...(a.quarantine || []), ...(b.quarantine || [])].filter(q => { const k = JSON.stringify(q); if (seenQ.has(k)) return false; seenQ.add(k); return true; });
  const out = { ...emptyDoc(), tombstones: {}, fieldsUpdatedAt: {}, quarantine };
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
  return FIELDS.every(f => deepEqual(a[f], b[f])) && deepEqual(a.fieldsUpdatedAt, b.fieldsUpdatedAt) && deepEqual(a.quarantine || [], b.quarantine || []);
}
