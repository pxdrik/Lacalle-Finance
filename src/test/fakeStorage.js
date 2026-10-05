// Armazenamento falso com a mesma trava do banco (UPDATE ... WHERE
// updated_at = versão esperada). Serve aos testes de navegador, no lugar de
// lib/storage.js.
export function createFakeStorage(initial = null) {
  let row = initial ? { value: JSON.stringify(initial), version: "v0" } : null;
  let n = 0;
  const s = {
    failGet: false,
    offline: false, // sem rede: ler e gravar falham
    sets: 0,
    async get() {
      if (s.failGet || s.offline) throw new Error("sem conexão (simulado)");
      return row ? { key: "k", value: row.value, version: row.version } : null;
    },
    async set(_k, value, expected) {
      if (s.offline) throw new Error("sem conexão (simulado)");
      s.sets++;
      if ((row ? row.version : null) !== (expected ?? null)) return { conflict: true };
      row = { value, version: `v${++n}` };
      return { key: "k", value, version: row.version };
    },
    async forceSet(_k, value) { row = { value, version: `v${++n}` }; return { version: row.version }; },
    async delete() { row = null; return { deleted: true }; },
    /** O que está gravado agora, já como objeto. */
    peek() { return row ? JSON.parse(row.value) : null; },
    /** Outro aparelho grava por fora (muda a versão). */
    writeFromElsewhere(mutate) {
      const doc = row ? JSON.parse(row.value) : {};
      mutate(doc);
      row = { value: JSON.stringify(doc), version: `v${++n}` };
    },
  };
  return s;
}
