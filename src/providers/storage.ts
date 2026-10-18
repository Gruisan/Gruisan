// Stockage clé/valeur du navigateur : IndexedDB, puis localStorage en repli, puis mémoire.
// Chaque backend est testé (écriture + relecture) avant d'être retenu.

import type { ModePersistance } from './DataProvider';

export interface KeyValueStore {
  readonly mode: ModePersistance;
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const DB_NAME = 'magasin3d';
const STORE = 'kv';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function ouvrirIndexedDB(factory: IDBFactory = indexedDB): Promise<KeyValueStore> {
  const db = await new Promise<IDBDatabase>((res, rej) => {
    const o = factory.open(DB_NAME, 1);
    o.onupgradeneeded = () => o.result.createObjectStore(STORE);
    o.onsuccess = () => res(o.result);
    o.onerror = () => rej(o.error);
    o.onblocked = () => rej(new Error('IndexedDB bloquée'));
  });
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  const done = (t: IDBTransaction) =>
    new Promise<void>((res, rej) => {
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error ?? new Error('Transaction annulée'));
    });
  return {
    mode: 'indexeddb',
    get: async <T,>(k: string) => (await req(tx('readonly').get(k))) as T | undefined,
    set: async <T,>(k: string, v: T) => {
      const s = tx('readwrite');
      s.put(v, k);
      await done(s.transaction);
    },
    remove: async (k: string) => {
      const s = tx('readwrite');
      s.delete(k);
      await done(s.transaction);
    },
  };
}

export function localStorageStore(ls: Storage = localStorage): KeyValueStore {
  const p = (k: string) => `${DB_NAME}:${k}`;
  return {
    mode: 'localstorage',
    get: async <T,>(k: string) => {
      const v = ls.getItem(p(k));
      return v == null ? undefined : (JSON.parse(v) as T);
    },
    set: async <T,>(k: string, v: T) => ls.setItem(p(k), JSON.stringify(v)),
    remove: async (k: string) => ls.removeItem(p(k)),
  };
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, unknown>();
  return {
    mode: 'memoire',
    get: async <T,>(k: string) => structuredClone(m.get(k)) as T | undefined,
    set: async <T,>(k: string, v: T) => void m.set(k, structuredClone(v)),
    remove: async (k: string) => void m.delete(k),
  };
}

async function verifier(s: KeyValueStore): Promise<KeyValueStore> {
  const k = '__test__';
  const v = { t: Date.now() };
  await s.set(k, v);
  const r = await s.get<{ t: number }>(k);
  if (!r || r.t !== v.t) throw new Error('relecture incorrecte');
  await s.remove(k);
  return s;
}

/** Retourne le meilleur stockage disponible et la liste des échecs rencontrés. */
export async function ouvrirMeilleurStockage(): Promise<{ store: KeyValueStore; echecs: string[] }> {
  const echecs: string[] = [];
  try {
    if (typeof indexedDB === 'undefined') throw new Error('indisponible');
    return { store: await verifier(await ouvrirIndexedDB()), echecs };
  } catch (e) {
    echecs.push(`IndexedDB : ${(e as Error)?.message ?? e}`);
  }
  try {
    if (typeof localStorage === 'undefined') throw new Error('indisponible');
    return { store: await verifier(localStorageStore()), echecs };
  } catch (e) {
    echecs.push(`localStorage : ${(e as Error)?.message ?? e}`);
  }
  return { store: memoryStore(), echecs };
}
