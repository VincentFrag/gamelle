// Open Food Facts : base ouverte de produits alimentaires (licence ODbL).
// Sert à remplir les valeurs nutritionnelles d'un aliment ajouté, par nom ou par code-barres.
// Rien n'est envoyé d'autre que le texte cherché ou le code-barres. Les réponses sont
// ramenées à quelques nombres et un nom, puis contrôlées comme toute donnée entrante.
import { num } from './clean.js';

const FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,quantity,nutriments,categories_tags,serving_size,serving_quantity';
const TIMEOUT = 9000;

async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const text = (v, max = 80) => {
  if (v == null) return '';
  if (Array.isArray(v)) v = v.filter(Boolean).join(', ');
  else if (typeof v === 'object') v = v.fr || v.main || Object.values(v).find((x) => typeof x === 'string') || '';
  return String(v).replace(/\s+/g, ' ').trim().slice(0, max);
};

// Valeurs pour 100 g. kcal : à défaut, déduites des kJ.
function nutrition(n = {}) {
  const v = (k) => num(n[`${k}_100g`] ?? n[k], 0, 1000);
  let kcal = v('energy-kcal');
  if (kcal == null && v('energy-kj') != null) kcal = v('energy-kj') / 4.184;
  if (kcal == null && v('energy') != null) kcal = v('energy') / 4.184;
  return {
    kcal: kcal == null ? null : Math.min(900, Math.round(kcal)),
    p: v('proteins'), c: v('carbohydrates'), f: v('fat'), fib: v('fiber'),
  };
}

// Rayon deviné à partir des catégories du produit
function rayonOf(tags = []) {
  const t = (Array.isArray(tags) ? tags : []).join(' ');
  if (/frozen|surgel/.test(t)) return 'surgeles';
  if (/meats|poultry|fishes|seafood|viande|poisson|ham/.test(t)) return 'viandes';
  if (/dairies|cheeses|yogurts|eggs|milks|desserts-lactes|fresh-cream/.test(t)) return 'cremerie';
  if (/breads|viennoiseries|pain/.test(t)) return 'boulangerie';
  if (/fruits|vegetables|legumes|salads/.test(t) && !/canned|conserve|dried|juices/.test(t)) return 'legumes';
  if (/condiments|sauces|spices|oils|sugars|flours|baking/.test(t)) return 'placard';
  return 'epicerie';
}

export function toIngredient(p) {
  if (!p || typeof p !== 'object') return null;
  const code = /^\d{6,14}$/.test(String(p.code || '')) ? String(p.code) : '';
  const name = text(p.product_name_fr) || text(p.product_name) || text(p.generic_name_fr);
  if (!name) return null;
  const n = nutrition(p.nutriments);
  if (n.kcal == null && n.p == null) return null;
  // Portion indiquée sur le paquet (« 1 barre (43 g) »)
  const sq = Number(p.serving_quantity);
  const serving = Number.isFinite(sq) && sq > 0 && sq <= 1000 ? sq : null;
  return {
    code,
    name,
    brand: text(p.brands, 40).split(',')[0].trim(),
    quantity: text(p.quantity, 30),
    serving: serving ? Math.round(serving * 10) / 10 : null,
    servingLabel: text(p.serving_size, 40),
    rayon: rayonOf(p.categories_tags),
    ...n,
  };
}

// Recherche par nom. Le nouveau moteur de recherche d'Open Food Facts d'abord, l'ancien en secours.
export async function search(q) {
  const query = String(q || '').trim().slice(0, 80);
  if (query.length < 2) return [];
  const out = [];
  const seen = new Set();
  const add = (list) => {
    for (const p of Array.isArray(list) ? list : []) {
      const it = toIngredient(p);
      const key = it && (it.code || `${it.name}|${it.brand}`);
      if (it && !seen.has(key)) { seen.add(key); out.push(it); }
    }
  };
  let failed = 0;
  try {
    const u = new URL('https://search.openfoodfacts.org/search');
    u.search = new URLSearchParams({ q: query, langs: 'fr', page_size: '24', fields: FIELDS }).toString();
    const j = await getJson(u.href);
    add(j.hits);
  } catch { failed++; /* on passe au moteur historique */ }
  if (out.length < 5) {
    try {
      const u = new URL('https://world.openfoodfacts.org/cgi/search.pl');
      u.search = new URLSearchParams({ search_terms: query, search_simple: '1', action: 'process', json: '1', page_size: '24', lc: 'fr', cc: 'fr', fields: FIELDS }).toString();
      const j = await getJson(u.href);
      add(j.products);
    } catch (e) {
      // les deux moteurs injoignables : on le dit ; sinon on garde ce qu'on a trouvé
      if (failed && !out.length) throw e;
    }
  }
  return out.slice(0, 24);
}

// Produit par code-barres (EAN-8 à EAN-14)
export async function byCode(code) {
  const c = String(code || '').replace(/\D/g, '');
  if (!/^\d{8,14}$/.test(c)) throw new Error('code');
  const j = await getJson(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=${FIELDS}&lc=fr`);
  if (!j || (j.status !== 1 && j.status !== 'success') || !j.product) return null;
  return toIngredient({ code: c, ...j.product });
}
