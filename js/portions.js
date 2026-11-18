// Mesures « à l'œil » : un carré de chocolat, un pot de yaourt, une cuillère de crème, une pincée d'ail…
// Chaque mesure vaut une quantité dans l'unité de l'aliment (g, ml ou pièce).
// On stocke toujours la quantité réelle ; la mesure ne sert qu'à choisir et à afficher.
import * as food from './food.js';

const M = (one, many, q, step = 1) => ({ one, many, q, step });
const CAF = (q) => M('c. à café', 'c. à café', q, 0.5);
const CAS = (q) => M('c. à soupe', 'c. à soupe', q, 0.5);

// Féculents secs : la valeur est celle de l'aliment cru. Rendement à la cuisson (cuit / cru).
// Repéré au nom et à la densité (un riz « cuit » en sachet fait ~130 kcal pour 100 g, le sec ~350).
const SWELL = [[/riz|quinoa|boulgour|lentille|pois chiche|haricot sec|sarrasin|orge|epeautre|millet/, 2.6], [/pate|spaghetti|tagliatelle|penne|coquillette|macaroni|fusilli|semoule|couscous|vermicelle|nouille/, 2.2]];
export function swell(ing) {
  if (!ing || ing.unit !== 'g' || (ing.kcal || 0) < 300) return null;
  const n = food.norm(ing.name);
  const hit = SWELL.find(([re]) => re.test(n));
  return hit ? hit[1] : null;
}

// Desserts : ce qu'on prend sans recette
export const DESSERT = {
  chocolat_noir: M('carré', 'carrés', 5),
  yaourt: M('pot', 'pots', 125),
  yaourt_grec: M('pot', 'pots', 150),
  skyr: M('pot', 'pots', 150),
  compote: M('pot', 'pots', 100),
  fromage_blanc: M('bol', 'bols', 100, 0.5),
  cottage: M('bol', 'bols', 100, 0.5),
  pomme: M('', '', 1, 0.5), banane: M('', '', 1, 0.5), clementine: M('', '', 1), kiwi: M('', '', 1),
  poire: M('', '', 1, 0.5), orange: M('', '', 1, 0.5),
  fruits_rouges: M('poignée', 'poignées', 60, 0.5),
  amandes: M('poignée', 'poignées', 20, 0.5),
  noix: M('poignée', 'poignées', 20, 0.5),
  granola: M('poignée', 'poignées', 30, 0.5),
  miel: CAF(7),
  beurre_cacahuete: CAS(15),
  cacao: CAF(5),
  whey: M('dose', 'doses', 30, 0.5),
  chocolat_patissier: M('carré', 'carrés', 5),
  // petit-déj et collation
  flocons: M('portion', 'portions', 40, 0.5),
  lait: M('verre', 'verres', 200, 0.5), lait_ecreme: M('verre', 'verres', 200, 0.5),
  pain_complet: M('tranche', 'tranches', 35), pain_mie: M('tranche', 'tranches', 25), baguette: M('', '', 0.25, 1),
  beurre: M('noisette', 'noisettes', 5), oeuf: M('', '', 1), jambon: M('tranche', 'tranches', 40),
  blanc_poulet: M('tranche', 'tranches', 20), emmental: M('portion', 'portions', 20), avocat: M('', '', 0.5, 1),
  ricotta: M('c. à soupe', 'c. à soupe', 20, 0.5), philadelphia: M('c. à soupe', 'c. à soupe', 20, 0.5),
};
export const BREAKFAST_ORDER = ['flocons', 'lait', 'skyr', 'fromage_blanc', 'yaourt', 'banane', 'pomme', 'fruits_rouges', 'pain_complet',
  'beurre', 'miel', 'beurre_cacahuete', 'oeuf', 'jambon', 'emmental', 'avocat', 'granola', 'amandes', 'whey', 'compote'];
export const SNACK_ORDER = ['skyr', 'yaourt', 'fromage_blanc', 'compote', 'banane', 'pomme', 'clementine', 'amandes', 'noix',
  'chocolat_noir', 'pain_complet', 'beurre_cacahuete', 'whey', 'granola', 'cottage', 'oeuf'];
export const DESSERT_ORDER = ['chocolat_noir', 'yaourt', 'skyr', 'yaourt_grec', 'compote', 'fromage_blanc', 'pomme', 'banane',
  'clementine', 'kiwi', 'poire', 'fruits_rouges', 'miel', 'amandes', 'granola', 'beurre_cacahuete', 'whey'];

// Sauces : pour une portion, à l'œil
export const SAUCE = {
  creme: CAS(15), creme_epaisse: CAS(15), philadelphia: CAS(20), ricotta: CAS(20), fromage_blanc: CAS(20),
  yaourt_grec: CAS(20), lait_coco: CAS(15), moutarde: CAF(5), miso: CAF(6), concentre: CAS(15),
  coulis: M('louche', 'louches', 60, 0.5), tomates_concassees: M('louche', 'louches', 60, 0.5),
  sauce_soja: CAS(15), pesto: CAS(15), ketchup: CAS(15), huile_olive: M('filet', 'filets', 5),
  beurre: M('noisette', 'noisettes', 5), parmesan: CAS(6), citron: M('filet', 'filets', 0.25), miel: CAF(7),
  ail_poudre: M('pincée', 'pincées', 0.5), ail: M('gousse', 'gousses', 1, 0.5), curry: CAF(2), paprika: CAF(2),
  cumin: CAF(2), herbes: CAF(1), oignon: M('', '', 0.25, 1), poivron: M('', '', 0.25, 1), tomate: M('', '', 0.5, 1),
  champignons: M('poignée', 'poignées', 40, 0.5), gingembre: CAF(3),
};
export const SAUCE_ORDER = ['creme', 'philadelphia', 'fromage_blanc', 'yaourt_grec', 'moutarde', 'miso', 'concentre', 'sauce_soja',
  'ail_poudre', 'poivron', 'oignon', 'citron', 'huile_olive', 'pesto', 'lait_coco', 'coulis', 'parmesan', 'miel', 'curry', 'paprika', 'herbes'];

// Mesure d'un aliment dans un contexte (dessert ou sauce), avec une valeur par défaut raisonnable.
export function measureOf(id, ctx = 'dessert') {
  const table = ctx === 'sauce' ? SAUCE : DESSERT;
  if (table[id]) return table[id];
  const ing = food.ingredient(id);
  if (!ing) return M('', '', 1);
  // produit du commerce compté par portion (paquet)
  if (ing.unit === 'pc' && ing.custom && ing.pw) return M('portion', 'portions', 1, 0.5);
  if (ing.unit === 'pc') return M('', '', ctx === 'sauce' ? 0.25 : 1, ctx === 'sauce' ? 1 : 0.5);
  if (ctx === 'sauce') return CAS(15);
  return M('portion', 'portions', ing.unit === 'ml' ? 100 : 30, 0.5);
}

export function defaultQty(id, ctx = 'dessert') {
  const m = measureOf(id, ctx);
  const first = { chocolat_noir: 2, chocolat_patissier: 2, creme: 2, philadelphia: 1, moutarde: 1, miso: 1, concentre: 1, pain_complet: 2, oeuf: 2 }[id];
  return m.q * (first ?? 1);
}

// « 2 carrés », « ½ c. à café », « ½ poivron »… Pour les pièces, la quantité seule (le nom suit).
export function fmtMeasure(id, qty, ctx = 'dessert') {
  const m = measureOf(id, ctx);
  const n = qty / m.q;
  if (!m.one) return food.fmtQty(food.ingredient(id), qty);
  return `${food.fmtCount(Math.round(n * 4) / 4)} ${n > 1 ? m.many : m.one}`;
}

export function step(id, qty, dir, ctx = 'dessert') {
  const m = measureOf(id, ctx);
  const n = Math.round((qty / m.q) / m.step) * m.step + dir * m.step;
  return n <= 0 ? 0 : Math.min(n * m.q, 5000);
}

// « 2 carrés de chocolat noir », « yaourt nature », « 2 Kinder Bueno »
export function itemLabel(id, qty, ctx = 'dessert') {
  const ing = food.ingredient(id);
  if (!ing) return '';
  // les produits du commerce gardent leur majuscule (marques)
  const name = ing.custom ? ing.name : ing.name.charAt(0).toLowerCase() + ing.name.slice(1);
  const m = measureOf(id, ctx);
  const n = qty / m.q;
  if (!m.one) return Math.abs(qty - 1) < 0.01 && ing.unit === 'pc' ? name : `${food.fmtQty(ing, qty)} ${name}`;
  if (Math.abs(n - 1) < 0.01 && ['pot', 'bol', 'portion', 'dose'].includes(m.one)) return name;
  const de = /^[aeiouyéèêhœ]/i.test(name) ? 'd’' : 'de ';
  return `${fmtMeasure(id, qty, ctx)} ${de}${name}`;
}
