// Service worker : met l'app en cache pour qu'elle s'ouvre sans réseau.
// À CHAQUE MODIFICATION DES FICHIERS, augmente ce numéro de version
// pour que les appareils récupèrent la nouvelle version.
const VERSION = 'gamelle-v1.5.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './fonts/archivo.woff2',
  './vendor/supabase.js',
  './js/app.js',
  './js/store.js',
  './js/sync.js',
  './js/clean.js',
  './js/calc.js',
  './js/food.js',
  './js/plan.js',
  './js/shop.js',
  './js/ui.js',
  './js/charts.js',
  './js/have.js',
  './js/habits.js',
  './js/off.js',
  './js/portions.js',
  './js/favs.js',
  './js/data/ingredients.js',
  './js/data/recipes.js',
  './js/views/common.js',
  './js/views/week.js',
  './js/views/recipes.js',
  './js/views/cook.js',
  './js/views/courses.js',
  './js/views/bilan.js',
  './js/views/more.js',
  './js/views/have.js',
  './js/views/today.js',
  './js/views/aliments.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
];

// cache: 'reload' : on télécharge toujours les fichiers frais, jamais une copie
// gardée par le navigateur (GitHub Pages autorise 10 minutes de cache).
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gamelle-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase et autres : réseau direct
  if (url.pathname.endsWith('/sw.js')) return; // vérification de version : toujours le réseau

  // config.js : réseau d'abord, en contournant le cache HTTP du navigateur,
  // pour prendre en compte une modification tout de suite
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Navigation : la page de l'app depuis le cache
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((hit) => hit || fetch(req)),
    );
    return;
  }

  // Fichiers de l'app : cache d'abord, réseau sinon
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
