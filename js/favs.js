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

export function remove(key, id) {
  const s = calc.settings();
  calc.saveSettings({ favs: { ...s.favs, [key]: (s.favs?.[key] || []).filter((x) => x !== id) } });
}
