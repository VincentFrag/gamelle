// Aliments favoris : ce que tu ajoutes toi-même (« Autre », produit du commerce) reste proposé
// la fois suivante, dans la même famille. 12 au plus par famille, le plus récent d'abord.
import * as calc from './calc.js';
import * as food from './food.js';

export function list(key) {
  return (calc.settings().favs?.[key] || []).filter((id) => food.ingredient(id));
}

export function add(key, id) {
  if (!id || !food.ingredient(id)) return;
  const s = calc.settings();
  const cur = (s.favs?.[key] || []).filter((x) => x !== id);
  calc.saveSettings({ favs: { ...s.favs, [key]: [id, ...cur].slice(0, 12) } });
}

// Une seule famille par aliment : l'ajouter à une famille le retire des autres
// (le halloumi rangé en « Protéine » ne réapparaît pas en « En plus »).
export function addOnly(key, id, keys) {
  if (!id || !food.ingredient(id)) return;
  const s = calc.settings();
  const next = { ...s.favs };
  for (const k of keys) next[k] = (next[k] || []).filter((x) => x !== id);
  next[key] = [id, ...(next[key] || [])].slice(0, 12);
  calc.saveSettings({ favs: next });
}

// Famille où tu as rangé cet aliment toi-même, s'il y en a une
export function groupOf(id, keys) {
  return keys.find((k) => list(k).includes(id)) || null;
}

export function remove(key, id) {
  const s = calc.settings();
  calc.saveSettings({ favs: { ...s.favs, [key]: (s.favs?.[key] || []).filter((x) => x !== id) } });
}
