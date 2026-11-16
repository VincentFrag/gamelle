// Synchronisation avec Supabase : envoi des modifications locales, puis lecture des nouveautés.
import * as store from './store.js';

const listeners = new Set();
let client = null;
let session = null;
let running = false;
let again = false;
let timer = null;

export const state = {
  status: 'local', // local | signedout | syncing | ok | offline | error
  error: null,
  lastSync: null,
  email: null,
};

function setStatus(status, error = null) {
  state.status = status;
  state.error = error;
  for (const fn of listeners) fn(state);
}

export function onStatus(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function isConfigured() {
  const cfg = window.GAMELLE_CONFIG || {};
  return Boolean(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);
}

export function isSignedIn() {
  return Boolean(session);
}

export async function init() {
  if (!isConfigured()) {
    setStatus('local');
    return;
  }
  const cfg = window.GAMELLE_CONFIG;
  client = window.supabase.createClient(cfg.supabaseUrl.trim(), cfg.supabaseKey.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'gamelle-auth',
    },
  });

  client.auth.onAuthStateChange((event, s) => {
    session = s;
    state.email = s?.user?.email || null;
    if (!s) setStatus('signedout');
    else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') schedule(0);
  });

  const { data } = await client.auth.getSession();
  session = data.session;
  state.email = session?.user?.email || null;
  setStatus(session ? 'ok' : 'signedout');
  if (session) schedule(0);

  store.onChange((d) => {
    if (d.local) schedule(2500);
  });
  window.addEventListener('online', () => schedule(0));
  window.addEventListener('offline', () => session && setStatus('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(0);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') schedule(0);
  }, 5 * 60 * 1000);
}

export function schedule(delay = 0) {
  if (!client || !session) return;
  clearTimeout(timer);
  timer = setTimeout(run, delay);
}

async function pushTable(table, userId) {
  const dirty = store.dirtyRows(table);
  for (let i = 0; i < dirty.length; i += 200) {
    const chunk = dirty.slice(i, i + 200);
    const payload = chunk.map((r) => store.serverRow(table, r, userId));
    const { error } = await client
      .from(table)
      .upsert(payload, { onConflict: store.TABLES[table].conflict });
    if (error) throw error;
    store.markClean(table, chunk, userId);
  }
}

async function pullTable(table, userId) {
  const cursorKey = `cursor:${userId}:${table}`;
  const cursor = await store.getMeta(cursorKey);
  // Petit recouvrement de 2 minutes : sans risque (fusion idempotente) et couvre les écritures concurrentes.
  const since = cursor ? new Date(Date.parse(cursor) - 120000).toISOString() : null;
  let from = 0;
  let max = cursor || null;
  const page = 1000;
  for (;;) {
    let q = client.from(table).select('*').eq('user_id', userId);
    if (since) q = q.gt('synced_at', since);
    const { data, error } = await q.order('synced_at', { ascending: true }).range(from, from + page - 1);
    if (error) throw error;
    if (data.length) {
      store.mergeRemote(table, data);
      const last = data[data.length - 1].synced_at;
      if (!max || Date.parse(last) > Date.parse(max)) max = last;
    }
    if (data.length < page) break;
    from += page;
  }
  if (max) await store.setMeta(cursorKey, max);
}

async function run() {
  if (!client || !session) return;
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus('syncing');
  try {
    const userId = session.user.id;
    for (const t of Object.keys(store.TABLES)) {
      await pushTable(t, userId);
      await pullTable(t, userId);
    }
    state.lastSync = new Date();
    setStatus('ok');
  } catch (e) {
    console.error('Synchro', e);
    const msg = e?.message || String(e);
    setStatus(navigator.onLine ? 'error' : 'offline', msg);
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(500);
    }
  }
}

export function syncNow() {
  schedule(0);
}

// Connexion par email + mot de passe. Le compte est créé dans le tableau de bord Supabase,
// donc aucun email n'est nécessaire.
export async function signIn(email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function changePassword(password) {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch (e) {
    console.error(e);
  }
  await store.wipe();
  session = null;
  setStatus('signedout');
}
