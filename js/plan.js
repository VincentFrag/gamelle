// Planning des repas : lecture, écriture, gamelle du lendemain proposée, desserts, totaux,
// générateur de semaine et économies par rapport aux commandes.
import * as store from './store.js';
import * as calc from './calc.js';
import * as food from './food.js';
import * as habits from './habits.js';
import * as portions from './portions.js';

export const SLOT_ORDER = ['petitdej', 'midi', 'collation', 'soir'];
export const SLOT_LABELS = { petitdej: 'Petit-déj', midi: 'Midi', collation: 'Collation', soir: 'Soir' };
export const KIND_LABELS = { recette: 'À cuisiner', compo: 'Assiette composée', reste: 'Gamelle', uber: 'Commande', libre: 'Repas libre' };

export const mealId = (day, slot) => `${day}:${slot}`;

export function getMeal(day, slot) {
  const r = store.get('meal', mealId(day, slot));
  return r ? { id: r.id, ...r.data } : null;
}

export function mealsOfDay(day) {
  return SLOT_ORDER.map((slot) => getMeal(day, slot)).filter(Boolean);
}

export function activeSlots(s = calc.settings()) {
  return SLOT_ORDER.filter((slot) => (slot === 'petitdej' ? s.slots.petitdej : slot === 'collation' ? s.slots.collation : true));
}

// Portions cuisinées par défaut : 2 le soir (une pour la gamelle du lendemain), sinon ce qui est mangé.
export function defaultCooked(slot, s = calc.settings()) {
  return slot === 'soir' && s.batch ? 2 : 1;
}

// Repas qu'on cuisine (recette ou assiette composée)
export const isCooked = (m) => Boolean(m && (m.kind === 'recette' || m.kind === 'compo'));
// Repas dont le contenu est une assiette composée (ou sa gamelle)
const isPlate = (m) => m.kind === 'compo' || (m.kind === 'reste' && !m.recipe && (m.parts || m.sauce || m.sauceParts));

// ---------- Valeurs d'un repas ----------
function scaled(st, k, home = true) {
  return { kcal: st.kcal * k, p: st.p * k, c: st.c * k, f: st.f * k, cost: st.cost * k, home };
}

function baseStats(m, s) {
  const portions = m.portions ?? 1;
  if (isPlate(m)) return scaled(food.compoStats(m.parts, m.sauce, m.sauceParts), portions);
  if (m.kind === 'recette' || m.kind === 'reste') {
    const st = food.recipeStats(food.recipe(m.recipe));
    if (!st) return { kcal: 0, p: 0, c: 0, f: 0, cost: 0, home: true };
    return scaled(st, portions);
  }
  if (m.kind === 'uber') return { kcal: m.kcal ?? s.uber.kcal, p: null, c: null, f: null, cost: m.cost ?? s.uber.avg, home: false };
  return { kcal: m.kcal ?? s.libreKcal, p: null, c: null, f: null, cost: m.cost ?? 0, home: false };
}

// Dessert d'un repas : simple (yaourt, fruit…) ou une part du dessert de la semaine.
// Parts du dessert de la semaine prises à ce repas
export const cakeParts = (m) => (m && m.cake ? m.cakeN ?? 1 : 0);

// « Gâteau au yaourt, 2 parts »
export function cakeLabel(m) {
  const b = m && m.cake && store.get('bake', m.cake);
  const r = b && food.recipe(b.data.recipe);
  if (!r) return '';
  const n = cakeParts(m);
  return `${r.name}, ${n === 1 ? 'une part' : `${food.fmtCount(n)} parts`}`;
}

// Le dessert peut mêler une part de gâteau de la semaine et des choses prises à l'œil.
export function dessertOf(m) {
  const pieces = [];
  if (m.cake) {
    const b = store.get('bake', m.cake);
    const r = b && food.recipe(b.data.recipe);
    if (r) pieces.push({ name: cakeLabel(m), recipe: r, bake: b.id, ...scaled(food.recipeStats(r), ((r.serves || 1) / b.data.parts) * cakeParts(m)) });
  }
  if (m.dessert) {
    const r = food.recipe(m.dessert);
    if (r) pieces.push({ name: r.name, recipe: r, ...scaled(food.recipeStats(r), 1) });
  }
  if (m.dessertParts && m.dessertParts.length) {
    const name = m.dessertParts.map(([id, q]) => portions.itemLabel(id, q)).filter(Boolean).join(', ');
    pieces.push({ name, parts: m.dessertParts, ...scaled(food.sumOf(m.dessertParts), 1) });
  }
  if (!pieces.length) return null;
  if (pieces.length === 1) return { ...pieces[0], name: pieces[0].name.charAt(0).toUpperCase() + pieces[0].name.slice(1) };
  const out = { ...pieces[0], name: '', kcal: 0, p: 0, c: 0, f: 0, cost: 0, parts: m.dessertParts };
  for (const x of pieces) for (const k of ['kcal', 'p', 'c', 'f', 'cost']) out[k] += x[k] || 0;
  const name = pieces.map((x) => x.name).join(', ');
  out.name = name.charAt(0).toUpperCase() + name.slice(1);
  return out;
}

export function mealStats(m, s = calc.settings()) {
  const st = baseStats(m, s);
  const d = dessertOf(m);
  if (d) {
    st.kcal += d.kcal;
    st.cost += d.cost;
    if (st.p != null) { st.p += d.p; st.c += d.c; st.f += d.f; }
  }
  return st;
}

export function mealTitle(m) {
  // petit-déj ou collation composés : la part de gâteau fait partie du repas
  if (m.kind === 'compo' && (m.slot === 'petitdej' || m.slot === 'collation') && m.cake) {
    const rest = m.parts?.length ? food.compoTitle(m.parts).toLowerCase() : '';
    return [cakeLabel(m), rest].filter(Boolean).join(', ');
  }
  if (isPlate(m)) return food.compoTitle(m.parts, m.sauce, m.sauceParts);
  if (m.kind === 'recette' || m.kind === 'reste') return food.recipe(m.recipe)?.name || 'Recette supprimée';
  if (m.kind === 'uber') return m.label || 'Commande Uber Eats';
  return m.label || 'Repas libre';
}

export function sumStats(list) {
  const out = { kcal: 0, p: 0, c: 0, f: 0, cost: 0, n: 0, partial: false };
  for (const st of list) {
    out.kcal += st.kcal || 0;
    out.cost += st.cost || 0;
    if (st.p == null) out.partial = true;
    out.p += st.p || 0; out.c += st.c || 0; out.f += st.f || 0;
    out.n++;
  }
  return out;
}

// Shakers de whey notés dans le journal du jour : comptés dans les calories et protéines.
// Craquages notés dans le journal du jour, comptés aussi.
function shakeTotals(from, to, s) {
  const one = habits.shakeStats(s);
  let n = 0;
  const snacks = [];
  for (const r of store.all('weight')) {
    if (r.id < from || r.id > to) continue;
    n += habits.extraShakes(r.id);
    if (r.data.snacks) snacks.push(...r.data.snacks);
  }
  const sn = food.sumOf(snacks);
  return {
    n, snacks: snacks.length, snackKcal: sn.kcal,
    kcal: one.kcal * n + sn.kcal, p: one.p * n + sn.p, c: one.c * n + sn.c, f: one.f * n + sn.f, cost: one.cost * n + sn.cost,
  };
}

function addShakes(st, sh) {
  st.kcal += sh.kcal; st.p += sh.p; st.c += sh.c; st.f += sh.f; st.cost += sh.cost;
  st.shakes = sh.n;
  st.snacks = sh.snacks;
  st.snackKcal = sh.snackKcal;
  return st;
}

// ---------- Craquages ----------
export function snacksOf(day) {
  return store.dayLog(day).snacks || [];
}

export function setSnacks(day, list) {
  return store.patchDayLog(day, { snacks: list.filter(([, q]) => q > 0).slice(0, 12) });
}

export function dayStats(day) {
  const s = calc.settings();
  return addShakes(sumStats(mealsOfDay(day).map((m) => mealStats(m, s))), shakeTotals(day, day, s));
}

// Ingrédients à préparer pour un repas cuisiné : [id, quantité, pour quoi]
export function cookList(m) {
  const out = [];
  const cooked = m.cooked ?? 1;
  if (m.kind === 'recette') {
    const r = food.recipe(m.recipe);
    if (r) for (const [id, q] of r.ing) out.push([id, (q * cooked) / (r.serves || 1), r.name]);
  } else if (m.kind === 'compo') {
    const label = mealTitle(m);
    for (const [id, q] of m.parts || []) out.push([id, q * cooked, label]);
    const sr = m.sauce && food.recipe(m.sauce);
    if (sr) for (const [id, q] of sr.ing) out.push([id, (q * cooked) / (sr.serves || 1), sr.name]);
    for (const [id, q] of m.sauceParts || []) out.push([id, q * cooked, 'Sauce maison']);
  }
  return out;
}

// ---------- Écriture ----------
// Enregistre un repas. Le dessert déjà choisi pour ce créneau est conservé.
// Le soir, un plat cuisiné en 2 portions n'ajoute PAS tout seul la gamelle du lendemain :
// elle est proposée (voir leftoverOffer) et tu choisis de la garder ou non.
export function setMeal(day, slot, data) {
  const s = calc.settings();
  const id = mealId(day, slot);
  store.batch((b) => {
    const prev = getMeal(day, slot);
    const meal = { ...data, day, slot };
    delete meal.id;
    if (prev && !('dessert' in data) && !('cake' in data) && !('dessertParts' in data)) {
      if (prev.cakeN) meal.cakeN = prev.cakeN;
      if (prev.dessert) meal.dessert = prev.dessert;
      if (prev.dessertParts) meal.dessertParts = prev.dessertParts;
      if (prev.cake) meal.cake = prev.cake;
    }
    if (isCooked(meal) && meal.cooked == null) meal.cooked = defaultCooked(slot, s);
    if (!isCooked(meal)) delete meal.cooked;
    if (meal.kind !== 'compo' && meal.kind !== 'reste') { delete meal.parts; delete meal.sauce; delete meal.sauceParts; }
    b.put('meal', id, meal);
    syncLeftover(b, day, slot, meal);
  });
}

// Si la gamelle du lendemain a déjà été acceptée, elle suit le plat du soir (ou disparaît).
function syncLeftover(b, day, slot, meal) {
  if (slot !== 'soir') return;
  const next = calc.addDays(day, 1);
  const lunch = getMeal(next, 'midi');
  const myId = mealId(day, slot);
  if (!lunch || lunch.kind !== 'reste' || lunch.from !== myId) return;
  const extra = isCooked(meal) ? (meal.cooked ?? 1) - (meal.portions ?? 1) : 0;
  if (extra >= 0.5) {
    const { id: _i, ...cur } = lunch;
    b.put('meal', mealId(next, 'midi'), { ...cur, recipe: meal.recipe, parts: meal.parts, sauce: meal.sauce, sauceParts: meal.sauceParts, portions: Math.min(extra, lunch.portions ?? 1) });
  } else {
    b.remove('meal', mealId(next, 'midi'));
  }
}

// Plat de la veille au soir dont la portion en plus peut devenir la gamelle de ce midi.
export function leftoverOffer(day) {
  if (getMeal(day, 'midi')) return null;
  const prev = getMeal(calc.addDays(day, -1), 'soir');
  if (!prev || !isCooked(prev)) return null;
  if ((prev.cooked ?? 1) - (prev.portions ?? 1) < 0.5) return null;
  return prev;
}

// Accepte la gamelle : le midi reprend le plat de la veille au soir (remplace ce qui y était).
export function keepLeftover(day) {
  const prevDay = calc.addDays(day, -1);
  const prev = getMeal(prevDay, 'soir');
  if (!prev || !isCooked(prev)) return false;
  const cur = getMeal(day, 'midi');
  store.batch((b) => {
    const cooked = Math.max(prev.cooked ?? 1, (prev.portions ?? 1) + 1);
    if (cooked !== prev.cooked) b.patch('meal', prev.id, { cooked });
    b.put('meal', mealId(day, 'midi'), {
      day, slot: 'midi', kind: 'reste', recipe: prev.recipe, parts: prev.parts, sauce: prev.sauce, sauceParts: prev.sauceParts,
      from: prev.id, portions: 1, dessert: cur?.dessert, cake: cur?.cake, dessertParts: cur?.dessertParts,
    });
  });
  return true;
}

// Refuse la gamelle : le plat du soir n'est plus cuisiné qu'en une portion (la liste de courses suit).
export function singlePortion(day) {
  const prev = getMeal(calc.addDays(day, -1), 'soir');
  if (prev) store.patch('meal', prev.id, { cooked: prev.portions ?? 1 });
}

// Toutes les gamelles proposées d'une semaine, acceptées d'un coup.
export function leftoverOffers(start) {
  return calc.weekDays(start).filter((d) => leftoverOffer(d));
}

export function keepAllLeftovers(start) {
  const days = leftoverOffers(start);
  for (const d of days) keepLeftover(d);
  return days.length;
}

export function removeMeal(day, slot) {
  const id = mealId(day, slot);
  store.batch((b) => {
    b.remove('meal', id);
    if (slot === 'soir') {
      const next = calc.addDays(day, 1);
      const lunch = getMeal(next, 'midi');
      if (lunch && lunch.kind === 'reste' && lunch.from === id) b.remove('meal', mealId(next, 'midi'));
    }
  });
}

// ---------- Desserts ----------
export function setDessert(day, slot, { dessert = null, cake = null, cakeN = 1, parts = null } = {}) {
  const m = getMeal(day, slot);
  if (!m) return;
  const { id: _i, ...data } = m;
  delete data.dessert;
  delete data.cake;
  delete data.cakeN;
  delete data.dessertParts;
  if (dessert) data.dessert = dessert;
  if (cake) {
    data.cake = cake;
    if (cakeN !== 1) data.cakeN = cakeN;
  }
  if (parts && parts.length) data.dessertParts = parts;
  store.put('meal', m.id, data);
}

// Propose un dessert simple : plutôt protéiné (whey, skyr) quand il manque des protéines
// dans la journée, et de temps en temps sinon ; léger quand il reste peu de calories.
export function suggestDessert(day, slot) {
  const s = calc.settings();
  const tg = calc.targets();
  const pool = food.recipes().filter((r) => r.cat === 'dessert' && !food.isLot(r) && food.usable(r, s));
  if (!pool.length) return null;
  const meals = mealsOfDay(day).map((m) => (m.slot === slot ? { ...m, dessert: null, cake: null, dessertParts: null } : m));
  const ds = sumStats(meals.map((m) => mealStats(m, s)));
  const protGap = tg.ready ? tg.p - ds.p : 0;
  const kcalLeft = tg.ready ? tg.kcal - ds.kcal : 400;
  const recent = new Set();
  for (const d of [day, calc.addDays(day, -1)]) for (const m of mealsOfDay(d)) if (m.dessert && !(d === day && m.slot === slot)) recent.add(m.dessert);
  const current = getMeal(day, slot)?.dessert;
  // La whey reste occasionnelle : un tirage par proposition, plus souvent quand il manque des protéines.
  const wantWhey = Math.random() < (protGap > 20 ? 0.4 : 0.15);
  const budget = serreOn(day, s);
  let best = null;
  for (const r of pool) {
    const st = food.recipeStats(r);
    const whey = (r.tags || []).includes('whey');
    let score = Math.random() * 2;
    if (whey) score += wantWhey ? 4 : -2;
    if (st.kcal > kcalLeft + 100) score -= 3;
    if (r.style === 'plaisir') score -= 0.5;
    if (budget) score -= st.cost * 4;
    if (recent.has(r.id)) score -= 3;
    if (r.id === current) score -= 10;
    if (!best || score > best[0]) best = [score, r];
  }
  return best[1];
}

// ---------- Dessert de la semaine (gâteau, riz au lait…) ----------
export function bakes() {
  return store.all('bake').map((r) => ({ id: r.id, ...r.data }));
}

export function bakeUsed(id) {
  return store.all('meal').filter((r) => r.data.cake === id).reduce((n, r) => n + (r.data.cakeN ?? 1), 0);
}

// Desserts de la semaine préparés dans la semaine affichée
export function bakesOfWeek(start) {
  const end = calc.addDays(start, 6);
  return bakes().filter((b) => b.day >= start && b.day <= end).sort((a, b) => a.day.localeCompare(b.day));
}

// Desserts de la semaine dont il reste des parts pour un repas donné (préparés dans les 7 jours avant)
export function bakesFor(day, current = null) {
  return bakes().filter((b) => b.day <= day && b.day >= calc.addDays(day, -7) && (b.id === current || bakeUsed(b.id) < b.parts));
}

// Ajoute un dessert de la semaine. eachEvening : une part en dessert chaque soir déjà prévu, à partir de ce jour.
export function addBake(recipeId, day, parts, { eachEvening = true } = {}) {
  const id = store.uuid();
  store.batch((b) => {
    b.put('bake', id, { recipe: recipeId, day, parts });
    if (!eachEvening) return;
    let used = 0;
    for (let i = 0; i < 7 && used < parts; i++) {
      const d = calc.addDays(day, i);
      const m = getMeal(d, 'soir');
      if (!m || m.dessert || m.cake) continue;
      const { id: _i, ...data } = m;
      b.put('meal', m.id, { ...data, cake: id });
      used++;
    }
  });
  return id;
}

export function removeBake(id) {
  store.batch((b) => {
    for (const r of store.all('meal')) {
      if (r.data.cake !== id) continue;
      const { cake: _c, ...data } = r.data;
      b.put('meal', r.id, data);
    }
    b.remove('bake', id);
  });
}

export function setBakeDone(bk, done) {
  const r = food.recipe(bk.recipe);
  store.batch((b) => {
    b.patch('bake', bk.id, { done });
    if (r) moveStock(b, r.ing.map(([id, q]) => [id, q]), done);
  });
}

export function source(m) {
  if (m.kind !== 'reste' || !m.from) return null;
  const [day, slot] = m.from.split(':');
  return getMeal(day, slot);
}

// ---------- Petit budget (fin de mois) ----------
// Actif à la main, ou automatiquement les 10 derniers jours du mois si l'option est cochée.
export function serreAuto(day = calc.localDay()) {
  const d = calc.dayToDate(day);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() > last - 10;
}

export function serreOn(day = calc.localDay(), s = calc.settings()) {
  return s.serre || (s.serreAuto && serreAuto(day));
}

// Plat équilibré : assez de protéines, des calories raisonnables, pas une « version maison ».
export function balanced(r) {
  const st = food.recipeStats(r);
  return Boolean(st && r.style !== 'plaisir' && st.p >= 25 && st.kcal >= 400 && st.kcal <= 850);
}

// Disponible à la maison (réserves ou produit de placard)
function inStock(id) {
  const ing = food.ingredient(id);
  return Boolean(ing && (ing.staple || store.get('stock', id)));
}

// ---------- Générateur ----------
const PROTEIN_TAGS = ['volaille', 'boeuf', 'poisson', 'vege'];
const mainProtein = (r) => (r.tags || []).find((t) => PROTEIN_TAGS.includes(t)) || 'autre';
const PLAISIR_DAYS = [4, 5, 2, 6, 1, 3, 0]; // vendredi, samedi, mercredi…
const LEGER_DAYS = [0, 3, 1, 6, 2, 4, 5];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Produits frais vendus en lot (sachet de salade, bouquet, crème…) : on aime les réutiliser dans la semaine.
function perishables(r) {
  const out = [];
  for (const [id] of r.ing || []) {
    const ing = food.ingredient(id);
    if (!ing || ing.staple) continue;
    if (['legumes', 'cremerie'].includes(ing.rayon) && (ing.buy || ing.unit === 'pc')) out.push(id);
  }
  return out;
}

function candidates(pool, { style, maxTime, needGamelle, used, lastWeek, chosen, prevProtein, noPlaisir = false, budget = false }) {
  const fresh = new Set(chosen.flatMap(perishables));
  const scored = [];
  for (const r of pool) {
    if (used.has(r.id)) continue;
    if (noPlaisir && r.style === 'plaisir') continue;
    if (budget && !balanced(r)) continue;
    if (maxTime && r.time > maxTime) continue;
    if (needGamelle && r.gamelle === false) continue;
    let score = Math.random() * 2;
    if (budget) {
      // Le prix passe devant tout le reste ; ce qu'on a déjà à la maison ne coûte rien de plus.
      const missing = (r.ing || []).filter(([id]) => !inStock(id));
      const extra = food.sumOf(missing.map(([id, q]) => [id, q / (r.serves || 1)])).cost;
      score -= extra * 4;
    } else if (style && r.style === style) score += 4;
    if (!lastWeek.has(r.id)) score += 2;
    if (prevProtein && mainProtein(r) === prevProtein) score -= 2.5;
    score += perishables(r).filter((id) => fresh.has(id)).length * 0.8;
    scored.push([score, r]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}

// Propose une recette pour un créneau, en dehors de celles déjà prévues dans la semaine.
export function suggest(day, slot, { exclude = [] } = {}) {
  const s = calc.settings();
  const start = calc.weekStart(day);
  const week = calc.weekDays(start);
  const used = new Set(exclude);
  for (const d of week) for (const m of mealsOfDay(d)) if (m.recipe && !(d === day && m.slot === slot)) used.add(m.recipe);
  const cat = slot === 'petitdej' ? 'petitdej' : slot === 'collation' ? 'collation' : 'diner';
  const pool = food.recipes().filter((r) => r.cat === cat && food.usable(r, s));
  if (cat !== 'diner') {
    const list = shuffle(pool.filter((r) => !used.has(r.id) || pool.length <= used.size));
    return list[0] || pool[0] || null;
  }
  const wd = calc.weekday(day);
  const workTomorrow = slot === 'soir' ? [6, 0, 1, 2, 3].includes(wd) : [0, 1, 2, 3, 4].includes(wd);
  let maisons = 0;
  for (const d of week) for (const m of mealsOfDay(d)) if (m.kind === 'recette' && !(d === day && m.slot === slot) && food.isMaison(food.recipe(m.recipe))) maisons++;
  const budget = serreOn(day, s);
  const opts = {
    maxTime: workTomorrow || slot === 'midi' ? s.weekdayTime : 75,
    needGamelle: slot === 'soir' && s.batch && workTomorrow,
    used, lastWeek: new Set(), chosen: [], prevProtein: null,
    noPlaisir: budget || maisons >= s.plaisir, budget,
  };
  return candidates(pool, opts)[0] || candidates(pool, { ...opts, maxTime: null, needGamelle: false, used: new Set(exclude) })[0] || null;
}

// Remplit la semaine. mode 'fill' : seulement les repas vides ; 'replace' : repropose tout,
// sauf les commandes, repas libres et plats déjà cuisinés.
export function generate(start, mode = 'fill') {
  const s = calc.settings();
  const tg = calc.targets();
  const days = calc.weekDays(start);
  const slots = activeSlots(s);
  const keep = (m) => m && (mode === 'fill' || m.kind === 'uber' || m.kind === 'libre' || m.done);
  const current = new Map();
  for (const d of days) for (const slot of SLOT_ORDER) {
    const m = getMeal(d, slot);
    if (m) current.set(mealId(d, slot), m);
  }
  const next = new Map();
  for (const [id, m] of current) if (keep(m)) next.set(id, m);

  const lastWeek = new Set();
  for (const d of calc.weekDays(calc.addDays(start, -7))) for (const m of mealsOfDay(d)) if (m.recipe) lastWeek.add(m.recipe);

  // Versions maison (burger, pizza, tikka…) : au plus « plaisir » par semaine, et pas toutes les
  // semaines quand la précédente en avait déjà une.
  const hadMaison = [...lastWeek].some((id) => food.isMaison(food.recipe(id)));
  const maisonQuota = hadMaison && Math.random() < 0.5 ? Math.max(0, s.plaisir - 1) : s.plaisir;
  let maisons = [...next.values()].filter((m) => m.kind === 'recette' && food.isMaison(food.recipe(m.recipe))).length;

  const dinners = food.recipes().filter((r) => r.cat === 'diner' && food.usable(r, s));
  const used = new Set([...next.values()].map((m) => m.recipe).filter(Boolean));
  const chosen = [...next.values()].map((m) => food.recipe(m.recipe)).filter(Boolean);

  // Styles visés pour les soirs libres
  const freeEvenings = days.filter((d) => !next.has(mealId(d, 'soir')));
  const styleOf = new Map();
  for (const wd of PLAISIR_DAYS) {
    if ([...styleOf.values()].filter((x) => x === 'plaisir').length >= maisonQuota - maisons) break;
    const d = days[wd];
    if (freeEvenings.includes(d)) styleOf.set(d, 'plaisir');
  }
  for (const wd of LEGER_DAYS) {
    if ([...styleOf.values()].filter((x) => x === 'leger').length >= s.leger) break;
    const d = days[wd];
    if (freeEvenings.includes(d) && !styleOf.has(d)) styleOf.set(d, 'leger');
  }

  let prevProtein = null;
  for (const d of days) {
    const id = mealId(d, 'soir');
    if (next.has(id)) {
      prevProtein = mainProtein(food.recipe(next.get(id).recipe) || {});
      continue;
    }
    const wd = calc.weekday(d);
    const workTomorrow = [6, 0, 1, 2, 3].includes(wd);
    const budget = serreOn(d, s);
    const style = budget ? 'equilibre' : styleOf.get(d) || 'equilibre';
    const base = { style, used, lastWeek, chosen, prevProtein, budget, noPlaisir: budget || style !== 'plaisir' || maisons >= maisonQuota };
    const strict = { ...base, maxTime: workTomorrow ? s.weekdayTime : 75, needGamelle: s.batch && workTomorrow };
    const r = candidates(dinners, strict)[0] || candidates(dinners, { ...base, maxTime: null, needGamelle: false })[0]
      || candidates(dinners, { ...base, used: new Set() })[0] || candidates(dinners, { ...base, used: new Set(), budget: false })[0];
    if (!r) continue;
    if (food.isMaison(r)) maisons++;
    used.add(r.id);
    chosen.push(r);
    prevProtein = mainProtein(r);
    next.set(id, { day: d, slot: 'soir', kind: 'recette', recipe: r.id, portions: 1, cooked: defaultCooked('soir', s), mc: s.preferMc && !!r.mc });
  }

  // Midis : quand le plat de la veille au soir est cuisiné en 2 portions, le midi reste vide
  // et la gamelle y est proposée (à accepter dans l'écran Semaine). Sinon, une recette rapide.
  for (const d of days) {
    const id = mealId(d, 'midi');
    if (next.has(id)) {
      const cur = next.get(id);
      const src = cur.kind === 'reste' && cur.from ? next.get(cur.from) || (cur.from < start ? getMeal(...cur.from.split(':')) : null) : null;
      if (cur.kind !== 'reste' || (src && isCooked(src) && src.recipe === cur.recipe)) continue;
      next.delete(id);
    }
    const prevDay = calc.addDays(d, -1);
    const prevId = mealId(prevDay, 'soir');
    const prev = next.get(prevId) || (prevDay < start ? getMeal(prevDay, 'soir') : null);
    if (prev && isCooked(prev) && (prev.cooked ?? 1) - (prev.portions ?? 1) >= 0.5) continue;
    const quick = candidates(dinners, { used, lastWeek, chosen, maxTime: 30, needGamelle: true, style: null, prevProtein: null, noPlaisir: true, budget: serreOn(d, s) });
    const r = quick.find((x) => (x.tags || []).includes('froid')) || quick[0];
    if (!r) continue;
    used.add(r.id);
    chosen.push(r);
    next.set(id, { day: d, slot: 'midi', kind: 'recette', recipe: r.id, portions: 1, cooked: 1, note: 'À préparer la veille' });
  }

  // Petits-déjeuners variés
  if (slots.includes('petitdej')) {
    const pool = shuffle(food.recipes().filter((r) => r.cat === 'petitdej' && food.usable(r, s)));
    let i = 0;
    for (const d of days) {
      const id = mealId(d, 'petitdej');
      if (next.has(id) || !pool.length) continue;
      const r = pool[i++ % pool.length];
      next.set(id, { day: d, slot: 'petitdej', kind: 'recette', recipe: r.id, portions: 1, cooked: 1 });
    }
  }

  // Collation les jours où il manque des calories
  if (slots.includes('collation') && tg.ready) {
    const snacks = food.recipes().filter((r) => r.cat === 'collation' && food.usable(r, s));
    const usedSnacks = new Map();
    for (const d of days) {
      const id = mealId(d, 'collation');
      if (next.has(id) || !snacks.length) continue;
      const total = sumStats([...next.values()].filter((m) => m.day === d).map((m) => mealStats(m, s))).kcal;
      const gap = tg.kcal - total;
      if (gap < 150) continue;
      const pick = snacks
        .map((r) => [Math.abs(food.recipeStats(r).kcal - gap) - food.recipeStats(r).p * 3 + (usedSnacks.get(r.id) || 0) * 260 + Math.random() * 80, r])
        .sort((a, b) => a[0] - b[0])[0][1];
      usedSnacks.set(pick.id, (usedSnacks.get(pick.id) || 0) + 1);
      next.set(id, { day: d, slot: 'collation', kind: 'recette', recipe: pick.id, portions: 1, cooked: 1 });
    }
  }

  store.batch((b) => {
    for (const [id] of current) if (!next.has(id)) b.remove('meal', id);
    for (const [id, m] of next) {
      const cur = current.get(id);
      // le dessert choisi pour ce créneau reste en place quand le plat change
      if (cur && !m.dessert && !m.cake && !m.dessertParts) {
        if (cur.dessert) m.dessert = cur.dessert;
        if (cur.dessertParts) m.dessertParts = cur.dessertParts;
        if (cur.cake) { m.cake = cur.cake; if (cur.cakeN) m.cakeN = cur.cakeN; }
      }
      if (cur && JSON.stringify({ ...cur, id: undefined }) === JSON.stringify({ ...m, id: undefined })) continue;
      const { id: _drop, ...data } = m;
      b.put('meal', id, data);
    }
  });
}

// ---------- Périodes ----------
export function mealsBetween(from, to) {
  return store.all('meal').map((r) => ({ id: r.id, ...r.data })).filter((m) => m.day >= from && m.day <= to);
}

export function periodStats(from, to) {
  const s = calc.settings();
  const meals = mealsBetween(from, to);
  const days = new Set(meals.map((m) => m.day));
  const st = addShakes(sumStats(meals.map((m) => mealStats(m, s))), shakeTotals(from, to, s));
  const home = meals.filter((m) => (isCooked(m) || m.kind === 'reste') && (m.slot === 'midi' || m.slot === 'soir'));
  const homeCost = home.reduce((n, m) => n + mealStats(m, s).cost, 0);
  return {
    ...st,
    days: days.size,
    meals: meals.length,
    homeMeals: home.length,
    homeAvg: home.length ? homeCost / home.length : null,
    uber: meals.filter((m) => m.kind === 'uber').length,
    uberCost: meals.filter((m) => m.kind === 'uber').reduce((n, m) => n + mealStats(m, s).cost, 0),
  };
}

export function firstDay() {
  let min = null;
  for (const r of store.all('meal')) if (!min || r.data.day < min) min = r.data.day;
  return min;
}

// Économies estimées : chaque commande évitée (par rapport à ton rythme d'avant)
// est remplacée par un repas maison. Seuls les jours passés avec au moins un repas noté comptent.
export function savings(from, to) {
  const s = calc.settings();
  const today = calc.localDay();
  const start = s.start || firstDay();
  if (!start) return null;
  const a = from < start ? start : from;
  const b = to > today ? today : to;
  if (a > b) return { saved: 0, days: 0, avoided: 0, homeAvg: null, uber: 0 };
  const st = periodStats(a, b);
  if (!st.days) return { saved: 0, days: 0, avoided: 0, homeAvg: st.homeAvg, uber: 0 };
  const homeAvg = st.homeAvg ?? 3;
  const baseline = (s.uber.perWeek * st.days) / 7;
  const avoided = Math.max(0, baseline - st.uber);
  return { saved: Math.max(0, avoided * (s.uber.avg - homeAvg)), days: st.days, avoided, homeAvg, uber: st.uber, baseline };
}

// ---------- Cuisine faite : mise à jour des réserves ----------
// Retire (ou remet) des quantités des réserves. Une réserve cochée sans quantité (« j'en ai »)
// n'est pas touchée : on ne sait pas combien il en reste.
function moveStock(b, list, done) {
  for (const [id, q] of list) {
    const st = store.get('stock', id);
    if (!st || st.data.qty == null) continue;
    const qty = Math.max(0, st.data.qty + (done ? -1 : 1) * q);
    if (qty <= 0.0001) b.remove('stock', id);
    else b.put('stock', id, { ...st.data, qty });
  }
}

export function setDone(m, done) {
  store.batch((b) => {
    b.patch('meal', m.id || mealId(m.day, m.slot), { done });
    if (isCooked(m)) moveStock(b, cookList(m), done);
  });
}
