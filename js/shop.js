// Liste de courses : ingrédients des plats à cuisiner et des desserts, moins les réserves,
// arrondis aux conditionnements du commerce. Plus les fonds de placard à racheter.
import * as store from './store.js';
import * as calc from './calc.js';
import * as food from './food.js';
import * as plan from './plan.js';

export function listRow(start) {
  const r = store.get('list', start);
  return r ? r.data : { checked: [], extras: [], range: 'today' };
}

export function saveList(start, partial) {
  store.put('list', start, { ...listRow(start), ...partial });
}

// Réserve d'un ingrédient : quantité précise, ou seulement « j'en ai » (have, sans quantité).
export function stockOf(id) {
  const r = store.get('stock', id);
  if (!r) return { qty: 0, have: false, soon: false };
  return { qty: r.data.qty ?? 0, have: r.data.qty == null && !!r.data.have, soon: !!r.data.soon, place: r.data.place };
}

export function stockQty(id) {
  return stockOf(id).qty;
}

export function defaultPlace(ing) {
  if (!ing) return 'placard';
  if (ing.rayon === 'surgeles') return 'congelo';
  if (['viandes', 'cremerie'].includes(ing.rayon)) return 'frigo';
  if (ing.rayon === 'legumes') return ['pdt', 'patate_douce', 'oignon', 'ail', 'banane', 'pomme', 'clementine', 'avocat'].includes(ing.id) ? 'placard' : 'frigo';
  return 'placard';
}

// Quantité à acheter, arrondie à ce qu'on trouve en rayon.
export function buyFor(ing, need) {
  if (need <= 0) return { qty: 0, label: '', cost: 0 };
  if (ing.buy) {
    const packs = Math.max(1, Math.ceil(need / ing.buy - 1e-6));
    const label = ing.buyLabel ? (packs > 1 ? `${packs} × ${ing.buyLabel}` : ing.buyLabel) : food.fmtQty(ing, packs * ing.buy);
    return { qty: packs * ing.buy, label, cost: packs * food.costOf(ing, ing.buy) };
  }
  if (ing.unit === 'pc') {
    const n = Math.ceil(need - 0.05);
    return { qty: n, label: `${n} pièce${n > 1 ? 's' : ''}`, cost: food.costOf(ing, n) };
  }
  const step = need > 500 ? 100 : 50;
  const q = Math.ceil(need / step) * step;
  return { qty: q, label: food.fmtQty(ing, q), cost: food.costOf(ing, q) };
}

// ---------- Fonds de placard ----------
// Achats récurrents qui ne dépendent pas des recettes de la semaine. Modifiables dans l'app
// (fréquence, ajout, retrait) ; ce qui n'a jamais été modifié garde ces valeurs.
export const DEFAULT_PANTRY = {
  yaourt: 'week',
  compote: 'week',
  huile: 'month',
  huile_olive: 'month',
  sauce_soja: 'month',
  moutarde: 'month',
  concentre: 'month',
  miel: 'month',
  farine: 'month',
  sucre: 'month',
  pates: 'month',
  riz: 'month',
  whey: 'month',
  chocolat_noir: 'month',
};
export const EVERY_LABELS = { week: 'Chaque semaine', month: 'Chaque mois', off: 'Jamais' };

export function pantryList() {
  const map = new Map(Object.entries(DEFAULT_PANTRY).map(([id, every]) => [id, { id, every, last: null }]));
  for (const r of store.all('pantry')) map.set(r.id, { id: r.id, every: r.data.every, last: r.data.last || null, edited: true });
  return [...map.values()].filter((p) => food.ingredient(p.id)).map((p) => ({ ...p, ing: food.ingredient(p.id) }));
}

export function pantryDue(p, ref = calc.localDay()) {
  if (p.every === 'off') return false;
  if (!p.last) return true;
  return calc.addDays(p.last, p.every === 'week' ? 7 : 30) <= ref;
}

export function pantryNext(p) {
  if (p.every === 'off' || !p.last) return null;
  return calc.addDays(p.last, p.every === 'week' ? 7 : 30);
}

export function setPantry(id, partial) {
  const cur = pantryList().find((p) => p.id === id) || { every: 'month', last: null };
  store.put('pantry', id, { every: partial.every ?? cur.every, last: partial.last !== undefined ? partial.last : cur.last });
}

// « J'en ai encore » : repoussé à la prochaine échéance.
export function postponePantry(ids) {
  const today = calc.localDay();
  store.batch((b) => {
    for (const id of ids) {
      const cur = pantryList().find((p) => p.id === id);
      if (cur) b.put('pantry', id, { every: cur.every, last: today });
    }
  });
}

// ---------- Calcul de la liste ----------
export function compute(start, range = 'today') {
  const today = calc.localDay();
  const end = calc.addDays(start, 6);
  const from = range === 'today' && today > start ? today : start;
  const meals = from > end ? [] : plan.mealsBetween(from, end);
  const need = new Map();
  const add = (id, q, label) => {
    const cur = need.get(id) || { qty: 0, uses: new Set() };
    cur.qty += q;
    cur.uses.add(label);
    need.set(id, cur);
  };
  let preps = 0;
  let desserts = 0;
  for (const m of meals) {
    if (plan.isCooked(m) && !m.done) {
      const l = plan.cookList(m);
      if (l.length) preps++;
      for (const [id, q, label] of l) add(id, q, label);
    }
    if (m.dessert && !m.done) {
      const r = food.recipe(m.dessert);
      if (r) {
        desserts++;
        for (const [id, q] of r.ing) add(id, (q * (m.portions ?? 1)) / (r.serves || 1), 'desserts');
      }
    }
  }
  for (const bk of plan.bakes()) {
    if (bk.done || bk.day < from || bk.day > end) continue;
    const r = food.recipe(bk.recipe);
    if (!r) continue;
    preps++;
    for (const [id, q] of r.ing) add(id, q, r.name);
  }

  const lr = listRow(start);
  const checked = new Set(lr.checked);
  const items = [];
  for (const [id, n] of need) {
    const ing = food.ingredient(id);
    if (!ing) continue;
    const st = stockOf(id);
    const rest = st.have ? 0 : Math.max(0, n.qty - st.qty);
    const buy = buyFor(ing, rest);
    items.push({
      id, ing, gross: n.qty, stock: st.qty, have: st.have, need: rest, buy, uses: [...n.uses],
      staple: !!ing.staple, covered: rest <= 0.0001, checked: checked.has(id),
    });
  }
  items.sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'fr'));
  const groups = [];
  for (const rayon of food.RAYON_ORDER) {
    const list = items.filter((i) => !i.staple && !i.covered && (i.ing.rayon || 'autre') === rayon);
    if (list.length) groups.push({ rayon, label: food.RAYON_LABELS[rayon], items: list });
  }
  const staples = items.filter((i) => i.staple && !i.covered);
  const covered = items.filter((i) => i.covered);
  const toBuy = groups.flatMap((g) => g.items);

  // Fonds de placard à racheter (sauf ceux déjà dans la liste)
  const inList = new Set(items.filter((i) => !i.covered).map((i) => i.id));
  const pantry = pantryList()
    .filter((p) => !inList.has(p.id) && pantryDue(p, from > today ? from : today))
    .map((p) => {
      const buy = buyFor(p.ing, p.ing.buy || (p.ing.unit === 'pc' ? 1 : 500));
      return { id: p.id, ing: p.ing, every: p.every, buy, checked: checked.has(p.id), have: stockOf(p.id).have || stockOf(p.id).qty > 0 };
    })
    .sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'fr'));
  const pantryChecked = pantry.filter((p) => p.checked);

  return {
    from, end, meals: preps + desserts, preps, desserts, groups, staples, covered, pantry, extras: lr.extras, range: lr.range,
    total: toBuy.reduce((n, i) => n + i.buy.cost, 0) + pantryChecked.reduce((n, i) => n + i.buy.cost, 0),
    left: toBuy.filter((i) => !i.checked).reduce((n, i) => n + i.buy.cost, 0),
    count: toBuy.length + pantryChecked.length,
    done: toBuy.filter((i) => i.checked).length + pantryChecked.length,
  };
}

// Les articles cochés passent dans les réserves (ce qui reste d'un paquet servira plus tard).
// Un fond de placard acheté repart pour une semaine ou un mois.
export function storeChecked(start, list) {
  const checked = new Set(listRow(start).checked);
  const items = [...list.groups.flatMap((g) => g.items), ...list.staples, ...list.pantry].filter((i) => checked.has(i.id));
  const pantryIds = new Set(pantryList().filter((p) => p.every !== 'off').map((p) => p.id));
  const today = calc.localDay();
  store.batch((b) => {
    for (const i of items) {
      const cur = store.get('stock', i.id);
      const place = cur?.data.place || defaultPlace(i.ing);
      b.put('stock', i.id, { qty: (cur?.data.qty || 0) + i.buy.qty, place, soon: cur?.data.soon });
      if (pantryIds.has(i.id)) {
        const p = pantryList().find((x) => x.id === i.id);
        b.put('pantry', i.id, { every: p.every, last: today });
      }
    }
    b.put('list', start, { ...listRow(start), checked: [] });
  });
  return items.length;
}

export function asText(list) {
  const lines = [`Courses du ${calc.fmtShort(list.from)} au ${calc.fmtShort(list.end)}`];
  for (const g of list.groups) {
    lines.push('', g.label);
    for (const i of g.items) lines.push(`${i.checked ? '☑' : '☐'} ${i.ing.name} : ${i.buy.label}`);
  }
  const extras = list.extras.filter((x) => !x.done);
  if (extras.length) {
    lines.push('', 'En plus');
    for (const x of extras) lines.push(`☐ ${x.name}`);
  }
  const pantry = list.pantry.filter((p) => p.checked);
  if (pantry.length) {
    lines.push('', 'Fonds de placard');
    for (const p of pantry) lines.push(`☐ ${p.ing.name} : ${p.buy.label}`);
  }
  if (list.staples.length) {
    lines.push('', 'Placard (à vérifier)');
    for (const i of list.staples) lines.push(`☐ ${i.ing.name} (${food.fmtQty(i.ing, i.need)} nécessaires)`);
  }
  lines.push('', `Estimation : ${calc.fmtEur(list.total)}`);
  return lines.join('\n');
}
