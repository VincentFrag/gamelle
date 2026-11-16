// Ingrédients et recettes : base fournie + modifications et créations de l'utilisateur.
// Calcul des valeurs nutritionnelles et du coût.
import * as store from './store.js';
import { INGREDIENTS } from './data/ingredients.js';
import { RECIPES } from './data/recipes.js';
import { cleanRow } from './clean.js';

export const RAYON_LABELS = {
  legumes: 'Fruits et légumes',
  viandes: 'Viandes et poissons',
  cremerie: 'Crèmerie et œufs',
  boulangerie: 'Pains',
  epicerie: 'Épicerie',
  surgeles: 'Surgelés',
  placard: 'Placard',
  autre: 'Autres',
};
export const RAYON_ORDER = ['legumes', 'viandes', 'cremerie', 'boulangerie', 'epicerie', 'surgeles', 'autre', 'placard'];

export const STYLE_LABELS = { equilibre: 'Équilibré', leger: 'Léger', plaisir: 'Plaisir' };
export const CAT_LABELS = { diner: 'Plat', petitdej: 'Petit-déjeuner', collation: 'Collation', dessert: 'Dessert', sauce: 'Sauce' };

// Dessert préparé une fois et mangé en parts (gâteau, riz au lait…)
export const isLot = (r) => Boolean(r && r.cat === 'dessert' && (r.tags || []).includes('lot'));
// Version maison d'un plat qu'on commande d'habitude
export const isMaison = (r) => Boolean(r && r.cat === 'diner' && r.style === 'plaisir');

// ---------- Assiette composée ----------
// [ingrédient, quantité par portion, comment le cuire]
export const COMPO = {
  feculent: {
    label: 'Féculent',
    items: [
      ['pates', 90, 'Pâtes : dans l’eau bouillante salée, selon le paquet.', 600],
      ['riz', 75, 'Riz : dans l’eau bouillante salée.', 660],
      ['riz_basmati', 75, 'Riz basmati : dans l’eau bouillante salée.', 660],
      ['semoule', 70, 'Semoule : verse le même volume d’eau bouillante salée, couvre 5 minutes, égraine.', 300],
      ['quinoa', 70, 'Quinoa : rince-le, puis dans l’eau bouillante salée.', 720],
      ['pdt', 250, 'Pommes de terre : en morceaux, dans l’eau froide salée portée à ébullition.', 1200],
      ['patate_douce', 250, 'Patate douce : en cubes, au four à 200 °C avec un filet d’huile.', 1500],
      ['nouilles', 80, 'Nouilles : dans l’eau bouillante, selon le paquet.', 240],
      ['lentilles_vertes', 70, 'Lentilles vertes : dans l’eau froide non salée, portée à ébullition.', 1200],
      ['pain_complet', 80, 'Pain complet : rien à cuire.', 0],
    ],
  },
  proteine: {
    label: 'Protéine',
    items: [
      ['poulet', 130, 'Poulet : en lamelles, à la poêle avec un filet d’huile, à feu vif.', 480],
      ['dinde', 130, 'Dinde : en lamelles, à la poêle avec un filet d’huile.', 420],
      ['boeuf5', 125, 'Bœuf haché : à la poêle chaude, en l’émiettant ou en steak.', 300],
      ['saumon', 130, 'Saumon : à la poêle côté peau, puis 1 minute de l’autre côté.', 480],
      ['colin', 150, 'Colin : à la poêle ou au four à 200 °C.', 600],
      ['oeuf', 2, 'Œufs : au plat, brouillés, ou durs 9 minutes.', 540],
      ['thon', 100, 'Thon : égoutté, rien à cuire.', 0],
      ['jambon', 80, 'Jambon : rien à cuire.', 0],
      ['pois_chiches', 130, 'Pois chiches : rincés, à réchauffer à la poêle avec un peu de paprika.', 300],
      ['feta', 50, 'Feta : émiettée, rien à cuire.', 0],
    ],
  },
  legume: {
    label: 'Légume',
    items: [
      ['brocoli', 200, 'Brocoli : à la vapeur ou dans l’eau bouillante salée.', 420],
      ['haricots_verts', 200, 'Haricots verts : dans l’eau bouillante salée.', 600],
      ['epinards', 150, 'Épinards : à la poêle à feu doux, encore surgelés.', 360],
      ['petits_pois', 150, 'Petits pois : dans l’eau bouillante salée.', 300],
      ['poelee_asiatique', 200, 'Légumes pour wok : à la poêle à feu vif.', 420],
      ['courgette', 1, 'Courgette : en rondelles, à la poêle avec un filet d’huile.', 480],
      ['poivron', 1, 'Poivron : en lanières, à la poêle.', 480],
      ['champignons', 150, 'Champignons : émincés, à la poêle à feu vif.', 360],
      ['carotte', 2, 'Carottes : râpées crues, ou en rondelles à la poêle.', 0],
      ['tomates_cerises', 120, 'Tomates cerises : crues, coupées en deux.', 0],
      ['salade', 50, 'Jeunes pousses : crues.', 0],
    ],
  },
};
export const COMPO_ORDER = ['feculent', 'proteine', 'legume'];

export function compoItem(id) {
  for (const k of COMPO_ORDER) {
    const it = COMPO[k].items.find((x) => x[0] === id);
    if (it) return { group: k, id: it[0], qty: it[1], how: it[2], s: it[3] };
  }
  return null;
}
export const EQUIP_LABELS = { plaques: 'Plaques', four: 'Four', mc: 'Monsieur Cuisine', micro: 'Micro-ondes' };
export const UNIT_LABELS = { g: 'grammes', ml: 'millilitres', pc: 'pièces' };

const BASE_ING = new Map(INGREDIENTS.map((i) => [i.id, i]));
const BASE_REC = new Map(RECIPES.map((r) => [r.id, cleanRecipe(r)]));

function cleanRecipe(r) {
  const c = cleanRow('gamelle', { kind: 'recipe', id: r.id, data: r }).data;
  if (r.mc) c.mc = r.mc;
  return { ...c, id: r.id, base: true };
}

// ---------- Cache recalculé à chaque modification des données ----------
let cache = null;
let cacheVersion = -1;

function build() {
  if (cache && cacheVersion === store.getVersion()) return cache;
  const ing = new Map();
  for (const [id, b] of BASE_ING) ing.set(id, { ...b, basePrice: b.price });
  for (const row of store.all('ingredient')) {
    const d = row.data;
    const b = ing.get(row.id);
    if (b) {
      ing.set(row.id, {
        ...b,
        price: d.price ?? b.price,
        buy: d.buy ?? b.buy,
        buyLabel: d.buy != null ? d.buyLabel || '' : b.buyLabel,
        staple: d.staple ?? b.staple,
        edited: true,
      });
    } else if (d.custom) {
      ing.set(row.id, {
        id: row.id, custom: true, name: d.name || 'Ingrédient', rayon: d.rayon || 'autre', unit: d.unit || 'g',
        kcal: d.kcal || 0, p: d.p || 0, c: d.c || 0, f: d.f || 0, fib: d.fib || 0,
        pw: d.pw || (d.unit === 'pc' ? 100 : undefined), price: d.price || 0, buy: d.buy, buyLabel: d.buyLabel || '',
        staple: d.staple || false, src: 'ajouté par toi',
      });
    }
  }
  const rec = new Map(BASE_REC);
  for (const row of store.all('recipe')) rec.set(row.id, { ...row.data, id: row.id, base: false });
  cache = { ing, rec, stats: new Map() };
  cacheVersion = store.getVersion();
  return cache;
}

export function ingredient(id) {
  return build().ing.get(id) || null;
}

export function ingredients() {
  return [...build().ing.values()];
}

export function baseIngredient(id) {
  return BASE_ING.get(id) || null;
}

export function recipe(id) {
  return build().rec.get(id) || null;
}

export function recipes() {
  return [...build().rec.values()];
}

export function isBaseRecipe(id) {
  return BASE_REC.has(id);
}

// ---------- Quantités ----------
export function grams(ing, qty) {
  if (!ing) return 0;
  if (ing.unit === 'pc') return qty * (ing.pw || 100);
  if (ing.unit === 'ml') return qty * (ing.density || 1);
  return qty;
}

export function costOf(ing, qty) {
  if (!ing) return 0;
  if (ing.unit === 'pc') return qty * (ing.price || 0);
  return (qty / 1000) * (ing.price || 0);
}

function nutritionOf(ing, qty) {
  const g = grams(ing, qty) / 100;
  return { kcal: ing.kcal * g, p: ing.p * g, c: ing.c * g, f: ing.f * g, fib: (ing.fib || 0) * g };
}

// Valeurs d'une recette pour 1 portion (nutrition et coût).
export function recipeStats(r) {
  if (!r) return null;
  const c = build();
  const key = r.id;
  if (key && c.stats.has(key)) return c.stats.get(key);
  const tot = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, cost: 0 };
  const missing = [];
  for (const [id, q] of r.ing || []) {
    const ing = c.ing.get(id);
    if (!ing) {
      missing.push(id);
      continue;
    }
    const n = nutritionOf(ing, q);
    tot.kcal += n.kcal; tot.p += n.p; tot.c += n.c; tot.f += n.f; tot.fib += n.fib;
    tot.cost += costOf(ing, q);
  }
  const serves = r.serves || 1;
  const out = {};
  for (const k of Object.keys(tot)) out[k] = tot[k] / serves;
  out.missing = missing;
  if (key) c.stats.set(key, out);
  return out;
}

// Valeurs d'une liste d'ingrédients [id, quantité] (sans division par portion).
export function sumOf(pairs) {
  const c = build();
  const tot = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, cost: 0 };
  for (const [id, q] of pairs || []) {
    const ing = c.ing.get(id);
    if (!ing) continue;
    const n = nutritionOf(ing, q);
    tot.kcal += n.kcal; tot.p += n.p; tot.c += n.c; tot.f += n.f; tot.fib += n.fib;
    tot.cost += costOf(ing, q);
  }
  return tot;
}

// Valeurs d'une assiette composée, pour 1 portion.
export function compoStats(parts, sauceId) {
  const out = sumOf(parts);
  const sauce = sauceId ? recipeStats(recipe(sauceId)) : null;
  if (sauce) for (const k of ['kcal', 'p', 'c', 'f', 'fib', 'cost']) out[k] += sauce[k];
  return out;
}

export function compoTitle(parts, sauceId) {
  const names = (parts || []).map(([id]) => ingredient(id)?.name).filter(Boolean)
    .map((n, i) => (i ? n.charAt(0).toLowerCase() + n.slice(1) : n));
  const sauce = sauceId ? recipe(sauceId) : null;
  const base = names.join(', ');
  if (!sauce) return base || 'Assiette composée';
  const sname = sauce.name.replace(/^Sauce\s+/i, '');
  return base ? `${base}, sauce ${sname.charAt(0).toLowerCase()}${sname.slice(1)}` : sauce.name;
}

// ---------- Affichage des quantités ----------
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const FRACTIONS = [[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [0.33, '⅓'], [0.67, '⅔']];

function fmtCount(n) {
  const whole = Math.floor(n + 0.001);
  const rest = n - whole;
  if (rest < 0.05) return String(whole);
  for (const [v, s] of FRACTIONS) if (Math.abs(rest - v) < 0.05) return whole ? `${whole} ${s}` : s;
  return nf.format(Math.round(n * 10) / 10);
}

export function roundQty(unit, q) {
  if (unit === 'pc') return Math.round(q * 4) / 4;
  if (q >= 100) return Math.round(q / 5) * 5;
  if (q >= 10) return Math.round(q);
  return Math.round(q * 10) / 10;
}

export function fmtQty(ing, q) {
  if (!ing) return nf.format(q);
  const unit = ing.unit;
  q = roundQty(unit, q);
  if (unit === 'pc') return fmtCount(q);
  if (unit === 'ml') return q >= 1000 ? `${nf.format(q / 1000)} L` : `${nf.format(q)} ml`;
  return q >= 1000 ? `${nf.format(q / 1000)} kg` : `${nf.format(q)} g`;
}

// « 300 g de filet de poulet », « 2 oignons »… en restant simple : quantité + nom.
export function ingLine(id, q) {
  const ing = ingredient(id);
  return { ing, qty: fmtQty(ing, q), name: ing ? ing.name : `Ingrédient inconnu (${id})` };
}

export function priceUnit(ing) {
  return ing.unit === 'pc' ? 'la pièce' : ing.unit === 'ml' ? 'le litre' : 'le kg';
}

// Recherche sans accents ni majuscules
export function norm(s) {
  return String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Recettes compatibles avec le matériel et les aliments exclus
export function usable(r, s) {
  for (const e of r.equip || []) if (e !== 'mc' && s.equip[e] === false) return false;
  if ((r.equip || []).includes('mc') && !s.equip.mc && !(r.equip || []).some((e) => e !== 'mc')) return false;
  for (const [id] of r.ing || []) if (s.exclude.includes(id)) return false;
  return true;
}
