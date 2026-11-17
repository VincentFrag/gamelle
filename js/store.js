// Stockage local (IndexedDB) + état en mémoire.
// Toutes les données vivent d'abord sur l'appareil ; la synchro les envoie ensuite au cloud.
//
// Une seule table, `gamelle` : une ligne par objet, repérée par (kind, id). Le contenu est dans data (JSON).
//   kinds : meal (repas planifié), recipe (recette perso), ingredient (prix modifié ou ingrédient perso),
//           stock (réserves), list (liste de courses d'une semaine), settings (réglages),
//           weight (journal du jour : id = le jour, data = { weight, creatine, shakes }), bake (dessert de la semaine, en parts),
//           pantry (fond de placard racheté chaque semaine ou chaque mois)
// Gamelle ne lit ni n'écrit aucune table de Fonte.

import { cleanRow } from './clean.js';

const DB_NAME = 'gamelle';
const DB_VERSION = 1;

export const KINDS = ['meal', 'recipe', 'ingredient', 'stock', 'list', 'settings', 'weight', 'bake', 'pantry'];

export const TABLES = {
  gamelle: {
    conflict: 'user_id,kind,id',
    keyOf: (r) => `${r.kind}|${r.id}`,
    columns: ['user_id', 'kind', 'id', 'data', 'updated_at', 'deleted'],
  },
};

const STORES = [...Object.keys(TABLES), 'meta'];

let db = null;
const data = Object.fromEntries(Object.keys(TABLES).map((t) => [t, new Map()]));
const listeners = new Set();
let version = 0;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function tx(store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

function persist(table, row) {
  return req(tx(table, 'readwrite').put(row, TABLES[table].keyOf(row))).catch((e) => console.error('IndexedDB', e));
}

export async function load() {
  db = await openDb();
  for (const t of Object.keys(TABLES)) {
    const rows = await req(tx(t).getAll());
    for (const r of rows) {
      const c = cleanRow(t, r);
      if (c) data[t].set(TABLES[t].keyOf(c), { ...c, _dirty: r._dirty === true });
    }
  }
  version++;
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getVersion() {
  return version;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(detail) {
  version++;
  for (const fn of listeners) {
    try { fn(detail); } catch (e) { console.error(e); }
  }
}

// ---------- Objets Gamelle (kind + id + data) ----------
export function all(kind) {
  const out = [];
  for (const r of data.gamelle.values()) if (r.kind === kind && !r.deleted) out.push(r);
  return out;
}

export function get(kind, id) {
  const r = data.gamelle.get(`${kind}|${id}`);
  return r && !r.deleted ? r : null;
}

function write(table, row, opts = {}) {
  const r = { ...row, updated_at: new Date().toISOString(), _dirty: true };
  if (r.deleted === undefined) r.deleted = false;
  const c = cleanRow(table, r);
  if (!c) {
    console.warn('Ligne refusée', table, row);
    return null;
  }
  const final = { ...c, _dirty: true };
  data[table].set(TABLES[table].keyOf(final), final);
  persist(table, final);
  if (!opts.batch) emit({ table, local: true, silent: opts.silent });
  return final;
}

// Enregistre (création ou remplacement) les données d'un objet.
export function put(kind, id, value, opts) {
  return write('gamelle', { kind, id, data: value }, opts);
}

// Modifie une partie des données d'un objet existant (ou le crée).
export function patch(kind, id, partial, opts) {
  const cur = get(kind, id);
  return put(kind, id, { ...(cur ? cur.data : {}), ...partial }, opts);
}

export function remove(kind, id, opts) {
  const r = data.gamelle.get(`${kind}|${id}`);
  if (!r || r.deleted) return;
  write('gamelle', { ...r, deleted: true }, opts);
}

// Plusieurs écritures, une seule notification.
export function batch(fn) {
  const res = fn({
    put: (k, id, v) => put(k, id, v, { batch: true }),
    patch: (k, id, v) => patch(k, id, v, { batch: true }),
    remove: (k, id) => remove(k, id, { batch: true }),
  });
  emit({ table: 'gamelle', local: true });
  return res;
}

// ---------- Journal du jour : pesée, créatine, shakers ----------
// Une ligne par jour (kind « weight », id = AAAA-MM-JJ). Les champs sont indépendants :
// modifier la créatine ne touche pas à la pesée, et inversement.
export function dayLog(day) {
  const r = get('weight', day);
  return r ? { ...r.data } : {};
}

export function patchDayLog(day, partial) {
  const next = { ...dayLog(day), ...partial };
  for (const k of Object.keys(next)) if (next[k] == null || next[k] === false || next[k] === 0 || (Array.isArray(next[k]) && !next[k].length)) delete next[k];
  if (!Object.keys(next).length) {
    remove('weight', day);
    return true;
  }
  return Boolean(put('weight', day, next));
}

export function weights() {
  return all('weight')
    .filter((r) => r.data && r.data.weight != null)
    .map((r) => ({ day: r.id, weight: r.data.weight }));
}

export function saveWeight(day, weight) {
  return patchDayLog(day, { weight });
}

export function removeWeight(day) {
  return patchDayLog(day, { weight: null });
}

// ---------- Synchronisation ----------
export function dirtyRows(table) {
  return [...data[table].values()].filter((r) => r._dirty);
}

export function pendingCount() {
  return Object.keys(TABLES).reduce((n, t) => n + dirtyRows(t).length, 0);
}

export function markClean(table, sentRows, userId) {
  for (const s of sentRows) {
    const key = TABLES[table].keyOf(s);
    const local = data[table].get(key);
    if (local && local.updated_at === s.updated_at) {
      const clean = { ...local, user_id: userId, _dirty: false };
      data[table].set(key, clean);
      persist(table, clean);
    }
  }
}

// Fusionne des lignes reçues du serveur. La version la plus récente gagne.
export function mergeRemote(table, rows) {
  let changed = false;
  for (const remote of rows) {
    const row = cleanRow(table, remote);
    if (!row) continue;
    const key = TABLES[table].keyOf(row);
    const local = data[table].get(key);
    if (local && local._dirty && Date.parse(local.updated_at) > Date.parse(row.updated_at)) continue;
    if (local && !local._dirty && local.updated_at && Date.parse(local.updated_at) === Date.parse(row.updated_at)) continue;
    row._dirty = false;
    data[table].set(key, row);
    persist(table, row);
    changed = true;
  }
  if (changed) emit({ table, remote: true });
  return changed;
}

export function serverRow(table, row, userId) {
  const out = {};
  for (const c of TABLES[table].columns) out[c] = row[c] === undefined ? null : row[c];
  out.user_id = userId;
  if (out.deleted === null) out.deleted = false;
  return out;
}

// Import d'une sauvegarde : chaque ligne est réenregistrée et sera synchronisée.
export function importRows(table, rows) {
  let n = 0;
  for (const src of rows) {
    const row = cleanRow(table, src);
    if (!row || row.deleted) continue;
    delete row.user_id;
    const key = TABLES[table].keyOf(row);
    const local = data[table].get(key);
    if (local && !local.deleted && Date.parse(local.updated_at) >= Date.parse(row.updated_at || 0)) continue;
    const r = { ...row, deleted: false, updated_at: new Date().toISOString(), _dirty: true };
    data[table].set(key, r);
    persist(table, r);
    n++;
  }
  if (n) emit({ table, local: true });
  return n;
}

export function exportRows(table) {
  return [...data[table].values()].filter((r) => !r.deleted).map(({ _dirty, user_id, ...r }) => r);
}

export async function getMeta(key) {
  return req(tx('meta').get(key));
}

export async function setMeta(key, value) {
  return req(tx('meta', 'readwrite').put(value, key));
}

export async function wipe() {
  for (const s of STORES) await req(tx(s, 'readwrite').clear());
  for (const t of Object.keys(TABLES)) data[t].clear();
  emit({ wipe: true });
}
