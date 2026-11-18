// Petits outils d'interface : échappement HTML, feuilles modales, confirmations, notifications.

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ICONS = {
  semaine: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  recettes: '<path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2z"/><path d="M6 18a2 2 0 0 1 2-2h10M10 8h5"/>',
  courses: '<path d="M4 6h2l2 10h10l2-7H7.2"/><circle cx="9.5" cy="19.5" r="1.2"/><circle cx="16.5" cy="19.5" r="1.2"/>',
  bilan: '<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>',
  plus: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  more: '<circle cx="12" cy="5.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="18.5" r="1.2"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.6L20 16M20 20v-4h-4"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M10 3h4"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  shuffle: '<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.5M14 9.5c.8-1.4 1.8-2.5 3.5-2.5H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>',
  box: '<rect x="3.5" y="8" width="17" height="11" rx="2.5"/><path d="M3.5 12h17M8 8V6.5A1.5 1.5 0 0 1 9.5 5h5A1.5 1.5 0 0 1 16 6.5V8"/>',
  bag: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  pot: '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h2M20 10h2M9 6c0-1.2 1-1.2 1-2.4M14 6c0-1.2 1-1.2 1-2.4"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  scale: '<path d="M5 20h14l-1.5-11h-11z"/><circle cx="12" cy="6" r="2.2"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  euro: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10.5h9M4 13.5h9"/>',
  sliders: '<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  save: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7"/><circle cx="12" cy="17" r=".6"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  cart: '<path d="M4 6h2l2 10h10l2-7H7.2"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9 8.5 6H7M13 6h2"/>',
  fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M16 3c-1.7 0-3 2.4-3 5.5S14 13 16 13v8"/>',
  scoop: '<path d="M3.5 10h11v2.5a5.5 5.5 0 0 1-11 0z"/><path d="M14.5 11.2h6"/>',
  shaker: '<path d="M7.5 9h9l-1.2 11H8.7z"/><path d="M8 9V6.5h8V9M10 4h4"/>',
  spark: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M6 18l2.6-2.6M15.4 8.6 18 6"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><circle cx="16" cy="13.5" r="1.2"/>',
  barcode: '<path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
};

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

// ---------- Feuille modale ----------
let sheetStack = [];

// Clavier de l'iPhone : la fenêtre se cale sur la partie visible de l'écran (au-dessus du clavier),
// pour que le haut (titre, recherche) ne sorte jamais de l'écran.
let vvBound = false;
function bindViewport() {
  if (vvBound || !window.visualViewport) return;
  vvBound = true;
  const vv = window.visualViewport;
  const set = () => {
    const r = document.documentElement.style;
    r.setProperty('--vvh', `${Math.round(vv.height)}px`);
    r.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`);
  };
  // Champ touché dans une fenêtre : une fois le clavier ouvert (la fenêtre a rétréci),
  // on fait défiler la fenêtre pour mettre le champ au milieu de la partie visible.
  let focused = null;
  const reveal = () => {
    if (!focused || !document.contains(focused) || document.activeElement !== focused) return;
    const body = focused.closest('.sheet-body');
    if (!body) return;
    const b = body.getBoundingClientRect();
    const r = focused.getBoundingClientRect();
    const visibleBottom = Math.min(b.bottom, vv.offsetTop + vv.height);
    if (r.top < b.top + 8 || r.bottom > visibleBottom - 8) {
      body.scrollTop += r.top - b.top - (visibleBottom - b.top) / 2 + r.height / 2;
    }
  };
  vv.addEventListener('resize', () => { set(); requestAnimationFrame(reveal); });
  vv.addEventListener('scroll', set);
  document.addEventListener('focusin', (e) => {
    if (!e.target.matches('input, textarea, select') || !e.target.closest('.sheet')) return;
    focused = e.target;
    // le clavier met environ 300 ms à monter ; on vérifie après, et encore une fois par sécurité
    setTimeout(reveal, 320);
    setTimeout(reveal, 650);
  });
  set();
}

// top : contenu fixe sous le titre (recherche), qui ne défile pas avec la liste.
export function openSheet({ title, body, actions = [], onMount, wide = false, top = '' }) {
  bindViewport();
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `
      <div class="sheet-backdrop" data-close></div>
      <div class="sheet ${wide ? 'sheet-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header class="sheet-head">
          <h2 id="sheet-title">${esc(title)}</h2>
          <button class="icon-btn" data-close aria-label="${esc('Fermer')}">${icon('close')}</button>
        </header>
        ${top ? `<div class="sheet-top">${top}</div>` : ''}
        <div class="sheet-body">${body || ''}</div>
        ${actions.length ? `<footer class="sheet-actions">${actions
          .map((a, i) => `<button class="btn ${a.kind || ''}" data-action="${i}" type="${a.submit ? 'submit' : 'button'}">${esc(a.label)}</button>`)
          .join('')}</footer>` : ''}
      </div>`;
    document.body.appendChild(wrap);
    const prevFocus = document.activeElement;
    const close = (value) => {
      wrap.classList.add('closing');
      setTimeout(() => wrap.remove(), 160);
      sheetStack = sheetStack.filter((s) => s !== api);
      document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      resolve(value);
    };
    const api = { el: wrap, close };
    sheetStack.push(api);
    const onKey = (e) => {
      if (e.key === 'Escape' && sheetStack[sheetStack.length - 1] === api) close(null);
    };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]')) return close(null);
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const a = actions[Number(btn.dataset.action)];
      if (!a) return;
      if (a.handler) {
        const res = await a.handler(wrap, api);
        if (res === false) return;
        return close(res === undefined ? a.value ?? true : res);
      }
      close(a.value ?? true);
    });
    if (onMount) onMount(wrap, api);
    requestAnimationFrame(() => {
      wrap.classList.add('open');
      // Sur téléphone, pas de clavier qui s'ouvre tout seul : on touche la recherche quand on veut.
      const touch = window.matchMedia('(pointer: coarse)').matches;
      const first = (!touch && wrap.querySelector('[autofocus]')) || wrap.querySelector('.sheet-head button');
      if (first) first.focus({ preventScroll: true });
    });
  });
}

export function confirmSheet(title, message, { ok = 'Confirmer', danger = false } = {}) {
  return openSheet({
    title,
    body: `<p class="sheet-text">${esc(message)}</p>`,
    actions: [
      { label: 'Annuler', value: false },
      { label: ok, kind: danger ? 'danger' : 'primary', value: true },
    ],
  }).then(Boolean);
}

// Menu d'actions simple. items : [{label, value, danger}]
export function menuSheet(title, items) {
  return openSheet({
    title,
    body: `<div class="menu-list">${items
      .map((it, i) => `<button class="menu-item ${it.danger ? 'is-danger' : ''}" data-menu="${i}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span></button>`)
      .join('')}</div>`,
    onMount(el, api) {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-menu]');
        if (b) api.close(items[Number(b.dataset.menu)].value);
      });
    },
  });
}

// ---------- Notifications ----------
export function toast(message, { action, onAction, duration = 3500, kind = '' } = {}) {
  let host = $('#toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="toast-btn">${esc(action)}</button>` : ''}`;
  host.appendChild(t);
  const remove = () => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 200);
  };
  if (action) t.querySelector('button').addEventListener('click', () => { remove(); onAction?.(); });
  if (duration) setTimeout(remove, duration);
  return remove;
}

// Lecture d'un formulaire
export function formData(root) {
  const out = {};
  for (const el of root.querySelectorAll('input[name], select[name], textarea[name]')) {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else out[el.name] = el.value;
  }
  return out;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
