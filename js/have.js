// « Ce que j'ai » : ingrédients disponibles à la maison et ce qu'on peut cuisiner avec.
// Un ingrédient est disponible s'il est dans les réserves (quantité ou simple « j'en ai »),
// ou s'il est marqué « toujours là » (produits de placard : huile, épices, sauce soja…).
import * as store from './store.js';
import * as calc from './calc.js';
import * as food from './food.js';
import { defaultPlace } from './shop.js';

export function state(id) {
  const r = store.get('stock', id);
  if (!r) return 'none';
  return r.data.soon ? 'soon' : 'have';
}

export function has(id) {
  const ing = food.ingredient(id);
  return Boolean(ing && (ing.staple || store.get('stock', id)));
}

export function isSoon(id) {
  return Boolean(store.get('stock', id)?.data.soon);
}

// Cycle d'un ingrédient dans « Ce que j'ai » : pas là → j'en ai → à finir vite → pas là.
// Une quantité précise déjà enregistrée est conservée tant que l'ingrédient reste coché.
export function cycle(id) {
  const ing = food.ingredient(id);
  const r = store.get('stock', id);
  if (!r) {
    store.put('stock', id, { have: true, place: defaultPlace(ing) });
    return 'have';
  }
  if (!r.data.soon) {
    store.put('stock', id, { ...r.data, have: true, soon: true });
    return 'soon';
  }
  store.remove('stock', id);
  return 'none';
}

// Ingrédients d'une recette qui comptent (les produits « toujours là » sont supposés présents)
function needed(r) {
  return (r.ing || []).map(([id]) => id).filter((id, i, a) => a.indexOf(id) === i && !food.ingredient(id)?.staple);
}

// Recettes classées selon ce qu'il y a à la maison : d'abord celles où il ne manque rien
// (ou presque), en favorisant celles qui utilisent les produits « à finir vite ».
export function rank({ cats = ['diner'] } = {}) {
  const s = calc.settings();
  const out = [];
  for (const r of food.recipes()) {
    if (!cats.includes(r.cat) || !food.usable(r, s)) continue;
    const ids = needed(r);
    if (!ids.length) continue;
    const missing = ids.filter((id) => !has(id));
    const soon = ids.filter((id) => isSoon(id));
    const ratio = (ids.length - missing.length) / ids.length;
    out.push({ r, missing, soon, ratio, score: ratio * 10 + soon.length * 2.5 - missing.length * 1.5 });
  }
  return out.filter((x) => x.ratio > 0).sort((a, b) => b.score - a.score || a.r.name.localeCompare(b.r.name, 'fr'));
}

// Assiette simple faite avec ce qu'il y a : un féculent, une protéine, un légume et la sauce
// pour laquelle il manque le moins de choses. Renvoie null s'il n'y a pas de protéine.
export function plateFromStock() {
  const pick = (group) => {
    const list = food.COMPO[group].items.filter(([id]) => has(id));
    list.sort((a, b) => isSoon(b[0]) - isSoon(a[0]));
    return list[0] || null;
  };
  const f = pick('feculent');
  const p = pick('proteine');
  const l = pick('legume');
  if (!p) return null;
  const sauces = rank({ cats: ['sauce'] });
  const sauce = sauces.find((x) => !x.missing.length) || null;
  const parts = [f, p, l].filter(Boolean).map(([id, q]) => [id, q]);
  return { parts, sauce: sauce ? sauce.r.id : null };
}
