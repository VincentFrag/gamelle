// Point d'entrée : navigation, rendu des écrans, minuteurs de cuisine, écran allumé, mises à jour.
import * as store from './store.js';
import * as sync from './sync.js';
import * as calc from './calc.js';
import * as habits from './habits.js';
import { esc, icon, $, toast } from './ui.js';
import { renderWeek } from './views/week.js';
import { renderRecipes, renderRecipe, renderRecipeEdit } from './views/recipes.js';
import { renderCook } from './views/cook.js';
import { renderShop, renderStock } from './views/courses.js';
import { renderBilan } from './views/bilan.js';
import { renderHave, renderWhat, renderPantry } from './views/have.js';
import { renderAliments } from './views/aliments.js';
import {
  renderMore, renderProfile, renderPrefs, renderPrices, renderAccount, renderBackup, renderHelp,
} from './views/more.js';

const APP_VERSION = '1.3.0';

const routes = [
  [/^\/semaine$/, renderWeek, 'semaine'],
  [/^\/semaine\/(\d{4}-\d{2}-\d{2})$/, renderWeek, 'semaine'],
  [/^\/recettes$/, renderRecipes, 'recettes'],
  [/^\/recettes\/nouvelle$/, (v, c) => renderRecipeEdit(v, c, null), 'recettes'],
  [/^\/recettes\/([\w-]+)$/, renderRecipe, 'recettes'],
  [/^\/recettes\/([\w-]+)\/modifier$/, renderRecipeEdit, 'recettes'],
  [/^\/cuisine\/([\w-]+)$/, renderCook, 'recettes'],
  [/^\/courses$/, renderShop, 'courses'],
  [/^\/courses\/(\d{4}-\d{2}-\d{2})$/, renderShop, 'courses'],
  [/^\/reserves$/, renderStock, 'courses'],
  [/^\/frigo$/, renderHave, 'courses'],
  [/^\/quoi$/, renderWhat, 'courses'],
  [/^\/placard$/, renderPantry, 'courses'],
  [/^\/aliments$/, (v, c) => renderAliments(v, c, { back: '/recettes', title: 'Aliments' }), 'recettes'],
  [/^\/bilan$/, renderBilan, 'bilan'],
  [/^\/plus$/, renderMore, 'plus'],
  [/^\/profil$/, renderProfile, 'plus'],
  [/^\/preferences$/, renderPrefs, 'plus'],
  [/^\/prix$/, renderPrices, 'plus'],
  [/^\/compte$/, renderAccount, 'plus'],
  [/^\/sauvegarde$/, renderBackup, 'plus'],
  [/^\/aide$/, renderHelp, 'plus'],
];

const NAV = [
  ['semaine', 'Semaine'],
  ['recettes', 'Recettes'],
  ['courses', 'Courses'],
  ['bilan', 'Bilan'],
  ['plus', 'Plus'],
];

let cleanups = [];
let pendingRender = false;
let currentPath = null;
let lastDay = calc.localDay();

export const ctx = {
  version: APP_VERSION,
  query: {},
  go(path) {
    if (location.hash === `#${path}`) render();
    else location.hash = path;
  },
  render: () => render(),
  applyTheme: () => applyTheme(),
  onCleanup(fn) {
    cleanups.push(fn);
  },
  pageHead,
  timers: null,
  wake: null,
};

function syncLabel(s) {
  const pending = store.pendingCount();
  switch (s.status) {
    case 'local': return ['is-local', 'Sur cet appareil'];
    case 'signedout': return ['is-warn', 'Non connecté'];
    case 'syncing': return ['is-busy', 'Synchro…'];
    case 'offline': return ['is-warn', pending ? `Hors ligne, ${pending} en attente` : 'Hors ligne'];
    case 'error': return ['is-error', 'Erreur de synchro'];
    default: return ['is-ok', pending ? `${pending} en attente` : 'Synchronisé'];
  }
}

function syncPill() {
  const [cls, label] = syncLabel(sync.state);
  return `<a class="sync-pill ${cls}" href="#/compte" data-sync-pill><span class="dot"></span><span class="sync-text">${esc(label)}</span></a>`;
}

function pageHead(title, { back = null, actions = '', sub = '' } = {}) {
  return `<header class="page-head">
    ${back ? `<a class="icon-btn back" href="#${back}" aria-label="Retour">${icon('back')}</a>` : ''}
    <div class="page-title"><h1>${esc(title)}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>
    <div class="head-actions">${actions}${syncPill()}</div>
  </header>`;
}

// Point sur l'onglet Semaine tant que la créatine ou le shaker du jour n'est pas coché.
function updateNavDot() {
  const a = document.querySelector('[data-nav="semaine"]');
  if (!a) return;
  const n = habits.pending().length;
  a.classList.toggle('has-dot', n > 0);
  a.setAttribute('aria-label', n ? `Semaine, ${n === 2 ? 'créatine et whey' : 'une habitude'} à prendre aujourd’hui` : 'Semaine');
}

function updateSyncPills() {
  const [cls, label] = syncLabel(sync.state);
  for (const el of document.querySelectorAll('[data-sync-pill]')) {
    el.className = `sync-pill ${cls}`;
    el.querySelector('.sync-text').textContent = label;
  }
}

// ---------- Rendu ----------
function render() {
  const [rawPath, rawQuery = ''] = (location.hash.replace(/^#/, '') || '/semaine').split('?');
  const path = rawPath;
  ctx.query = Object.fromEntries(new URLSearchParams(rawQuery));
  const main = $('#main');
  for (const fn of cleanups) {
    try { fn(); } catch (e) { console.error(e); }
  }
  cleanups = [];
  pendingRender = false;

  let match = null;
  for (const [re, fn, tab] of routes) {
    const m = path.match(re);
    if (m) {
      match = { fn, tab, params: m.slice(1) };
      break;
    }
  }
  if (!match) {
    location.hash = '/semaine';
    return;
  }
  for (const a of document.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === match.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.body.dataset.tab = match.tab;
  updateNavDot();
  document.body.classList.toggle('is-cooking', path.startsWith('/cuisine/'));
  if (!path.startsWith('/cuisine/')) wake.disable();
  const view = document.createElement('div');
  view.className = 'view';
  main.replaceChildren(view);
  const samePage = currentPath === path;
  currentPath = path;
  try {
    match.fn(view, ctx, ...match.params);
  } catch (e) {
    console.error(e);
    view.innerHTML = `${pageHead('Erreur')}<p class="empty">Cet écran n’a pas pu s’afficher : ${esc(e.message)}</p>`;
  }
  if (!samePage) window.scrollTo(0, 0);
}

function renderWhenIdle() {
  const a = document.activeElement;
  if (a && a.matches('input, textarea, select') && $('#main').contains(a)) {
    if (pendingRender) return;
    pendingRender = true;
    a.addEventListener('blur', () => setTimeout(() => pendingRender && render(), 50), { once: true });
    return;
  }
  if (document.querySelector('.sheet-wrap')) {
    pendingRender = true;
    return;
  }
  render();
}

// ---------- Minuteurs de cuisine (plusieurs à la fois) ----------
const TIMERS_KEY = 'gamelle-timers';
let audioCtx = null;

function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

function tones(list) {
  if (!calc.settings().sound || !audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    for (const [d, f, len] of list) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + len);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + d);
      o.stop(t0 + d + len + 0.02);
    }
  } catch {}
}

const timers = {
  list: [],
  tick: null,
  save() {
    try { localStorage.setItem(TIMERS_KEY, JSON.stringify(this.list)); } catch {}
  },
  start(seconds, label) {
    if (!seconds) return;
    unlockAudio();
    this.list.push({ id: Math.random().toString(36).slice(2), label: label || 'Minuteur', endsAt: Date.now() + seconds * 1000, duration: seconds, rang: false });
    this.save();
    this.loop();
  },
  add(id, sec) {
    const t = this.list.find((x) => x.id === id);
    if (!t) return;
    if (t.endsAt < Date.now()) t.endsAt = Date.now();
    t.endsAt += sec * 1000;
    t.duration += sec;
    t.rang = false;
    this.save();
    this.draw();
  },
  stop(id) {
    this.list = this.list.filter((x) => x.id !== id);
    this.save();
    this.draw();
  },
  restore() {
    try {
      const l = JSON.parse(localStorage.getItem(TIMERS_KEY) || '[]');
      this.list = Array.isArray(l) ? l.filter((t) => t && t.endsAt > Date.now() - 10 * 60000) : [];
      if (this.list.length) this.loop();
    } catch {}
  },
  loop() {
    clearInterval(this.tick);
    this.tick = setInterval(() => this.draw(), 250);
    this.draw();
  },
  draw() {
    const bar = $('#timer-bar');
    if (!this.list.length) {
      bar.hidden = true;
      bar.innerHTML = '';
      clearInterval(this.tick);
      this.tick = null;
      return;
    }
    bar.hidden = false;
    const now = Date.now();
    let html = '';
    for (const t of this.list) {
      const left = (t.endsAt - now) / 1000;
      const over = left <= 0;
      if (over && !t.rang) {
        t.rang = true;
        this.save();
        tones([[0, 880, 0.18], [0.22, 880, 0.18], [0.44, 1175, 0.3], [1.2, 880, 0.18], [1.42, 880, 0.18], [1.64, 1175, 0.3]]);
        if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
        toast(`${t.label} : c’est prêt.`, { kind: 'done' });
      }
      html += `<div class="timer ${over ? 'is-over' : ''}">
        <span class="timer-progress" style="transform:scaleX(${over ? 0 : Math.max(0, Math.min(1, left / t.duration))})"></span>
        <span class="timer-label">${esc(t.label)}</span>
        <span class="timer-time">${over ? 'Prêt' : calc.fmtClock(left)}</span>
        <button class="timer-btn" data-timer-add="${t.id}" aria-label="Ajouter une minute">+1 min</button>
        <button class="timer-btn" data-timer-stop="${t.id}" aria-label="Arrêter le minuteur">${icon('close')}</button>
      </div>`;
    }
    bar.innerHTML = html;
  },
};
ctx.timers = timers;

// ---------- Écran allumé en cuisine ----------
const wake = {
  lock: null,
  want: false,
  async enable() {
    this.want = true;
    if (!calc.settings().wakeLock || !('wakeLock' in navigator) || this.lock) return;
    try {
      this.lock = await navigator.wakeLock.request('screen');
      this.lock.addEventListener('release', () => { this.lock = null; });
    } catch {}
  },
  disable() {
    this.want = false;
    if (this.lock) this.lock.release().catch(() => {});
    this.lock = null;
  },
};
ctx.wake = wake;

// ---------- Thème ----------
function applyTheme() {
  const th = calc.settings().theme;
  if (th === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = th;
}

// ---------- Service worker (hors ligne + mises à jour) ----------
const UPDATED_KEY = 'gamelle-updated';
const HARD_KEY = 'gamelle-hard-refresh';
let swReg = null;
let applyUpdate = null;

function canUpdateSilently() {
  if (location.hash.startsWith('#/cuisine/')) return false;
  if (timers.list.length) return false;
  if (document.querySelector('.sheet-wrap')) return false;
  const a = document.activeElement;
  return !(a && a.matches('input, textarea, select'));
}

async function publishedSw() {
  const res = await fetch(`./sw.js?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const version = (text.match(/VERSION = 'gamelle-v([^']+)'/) || [])[1] || null;
  return { text, version };
}

// Secours si le navigateur ne voit pas la nouvelle version (iPhone).
async function hardRefresh(swText) {
  try {
    const last = Number(localStorage.getItem(HARD_KEY) || 0);
    if (Date.now() - last < 5 * 60 * 1000) return false;
    localStorage.setItem(HARD_KEY, String(Date.now()));
    sessionStorage.setItem(UPDATED_KEY, '1');
  } catch {}
  const list = (swText.match(/const ASSETS = \[([\s\S]*?)\];/) || [])[1] || '';
  const assets = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  await Promise.all(assets.map((u) => fetch(u, { cache: 'reload' }).catch(() => {})));
  // Seulement le service worker de Gamelle : Fonte peut être installée sur le même domaine.
  const regs = await navigator.serviceWorker.getRegistrations();
  const scope = new URL('./', location.href).href;
  await Promise.all(regs.filter((r) => r.scope === scope).map((r) => r.unregister()));
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith('gamelle-')).map((k) => caches.delete(k)));
  location.reload();
  return true;
}

let checking = false;
async function checkPublished({ force = false } = {}) {
  if (checking || !swReg || !navigator.onLine) return 'skip';
  checking = true;
  try {
    const pub = await publishedSw();
    if (!pub.version || pub.version === APP_VERSION) return 'uptodate';
    if (!swReg.waiting) {
      await swReg.update().catch(() => {});
      const w = swReg.installing;
      if (w) {
        await new Promise((res) => {
          const tm = setTimeout(res, 15000);
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' || w.state === 'redundant') {
              clearTimeout(tm);
              res();
            }
          });
        });
      }
    }
    if (swReg.waiting) {
      if (force || canUpdateSilently()) {
        applyUpdate(swReg.waiting);
        return 'applying';
      }
      return 'waiting';
    }
    if (force || canUpdateSilently()) {
      if (await hardRefresh(pub.text)) return 'applying';
    }
    return 'waiting';
  } catch {
    return 'error';
  } finally {
    checking = false;
  }
}

ctx.checkUpdate = async () => {
  if (!swReg) return 'unsupported';
  if (swReg.waiting) {
    applyUpdate(swReg.waiting);
    return 'applying';
  }
  try { localStorage.removeItem(HARD_KEY); } catch {}
  const r = await checkPublished({ force: true });
  if (r === 'error') throw new Error('réseau');
  return r === 'skip' ? 'uptodate' : r;
};

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let updating = false;
  const apply = (worker) => {
    updating = true;
    try { sessionStorage.setItem(UPDATED_KEY, '1'); } catch {}
    worker.postMessage('skipWaiting');
  };
  applyUpdate = (worker) => apply(worker);
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    swReg = reg;
    let asked = false;
    const ask = (worker) => {
      if (canUpdateSilently()) return apply(worker);
      if (asked) return;
      asked = true;
      toast('Nouvelle version disponible.', { action: 'Mettre à jour', duration: 0, onAction: () => apply(worker) });
    };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w);
      });
    });
    let lastCheck = 0;
    const check = async () => {
      if (reg.waiting && navigator.serviceWorker.controller) return ask(reg.waiting);
      if (Date.now() - lastCheck < 15 * 1000) return;
      lastCheck = Date.now();
      const r = await checkPublished();
      if (r === 'waiting') {
        if (reg.waiting) ask(reg.waiting);
        else if (!asked) {
          asked = true;
          toast('Nouvelle version disponible.', { action: 'Mettre à jour', duration: 0, onAction: () => ctx.checkUpdate() });
        }
      }
    };
    setTimeout(check, 3000);
    window.addEventListener('pageshow', (e) => e.persisted && check());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    setInterval(() => document.visibilityState === 'visible' && check(), 10 * 60 * 1000);
  }).catch((e) => console.warn('SW', e));

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !updating) return;
    reloaded = true;
    location.reload();
  });
}

function announceUpdate() {
  try {
    if (sessionStorage.getItem(UPDATED_KEY)) {
      sessionStorage.removeItem(UPDATED_KEY);
      toast(`Gamelle mise à jour (version ${APP_VERSION}).`, { duration: 2500 });
    }
  } catch {}
}

// ---------- Démarrage ----------
function shell() {
  const nav = NAV.map(([id, label]) => `<a href="#/${id}" data-nav="${id}">${icon(id)}<span>${label}</span></a>`).join('');
  document.body.innerHTML = `
    <a class="skip" href="#main">Aller au contenu</a>
    <div class="app">
      <nav class="nav" aria-label="Navigation principale">
        <div class="brand" aria-hidden="true"><span class="brand-mark"></span>Gamelle</div>
        ${nav}
      </nav>
      <main id="main" tabindex="-1"></main>
    </div>
    <div id="timer-bar" class="timer-bar" hidden aria-live="off"></div>`;
  $('#timer-bar').addEventListener('click', (e) => {
    const a = e.target.closest('[data-timer-add]');
    if (a) return timers.add(a.dataset.timerAdd, 60);
    const s = e.target.closest('[data-timer-stop]');
    if (s) timers.stop(s.dataset.timerStop);
  });
}

async function start() {
  if (window.top !== window.self) {
    document.body.textContent = 'Gamelle ne peut pas s’afficher dans un cadre.';
    return;
  }
  shell();
  try {
    await store.load();
  } catch (e) {
    $('#main').innerHTML = `<div class="view"><p class="empty">Le stockage local est indisponible (${esc(e.message)}). Vérifie que la navigation privée est désactivée.</p></div>`;
    return;
  }
  applyTheme();
  window.addEventListener('hashchange', render);
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  store.onChange((d) => {
    if (d.silent) return;
    if (d.remote || d.wipe) renderWhenIdle();
  });
  sync.onStatus(updateSyncPills);
  store.onChange(() => { updateSyncPills(); updateNavDot(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      timers.draw();
      updateNavDot();
      // la journée a changé depuis la dernière ouverture : on redessine pour la carte « Aujourd'hui »
      if (lastDay !== calc.localDay()) { lastDay = calc.localDay(); renderWhenIdle(); }
      if (wake.want) wake.enable();
    }
  });
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - lastW) < 40) return;
    lastW = window.innerWidth;
    if (document.querySelector('[data-chart]')) renderWhenIdle();
  });
  timers.restore();
  render();
  registerSW();
  announceUpdate();
  sync.init().catch((e) => console.error(e));
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

start();
