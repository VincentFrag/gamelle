// Contrôle des données qui entrent dans l'app (fichier importé, serveur, stockage local).
// Chaque champ est ramené à son type attendu : une donnée piégée ne peut donc pas
// injecter de code dans les écrans (tout texte est de toute façon échappé à l'affichage).

const ID = /^[A-Za-z0-9_:.-]{1,80}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const SLOTS = ['petitdej', 'midi', 'collation', 'soir'];
export const MEAL_KINDS = ['recette', 'compo', 'reste', 'uber', 'libre'];
export const CATS = ['diner', 'petitdej', 'collation', 'dessert', 'sauce'];
export const STYLES = ['equilibre', 'leger', 'plaisir'];
export const EQUIP = ['plaques', 'four', 'mc', 'micro'];
export const RAYONS = ['legumes', 'viandes', 'cremerie', 'boulangerie', 'epicerie', 'surgeles', 'placard', 'autre'];
export const UNITS = ['g', 'ml', 'pc'];
export const PLACES = ['frigo', 'congelo', 'placard'];
export const EVERY = ['week', 'month', 'off'];

const id = (v) => (typeof v === 'string' && ID.test(v) ? v : null);
export const FAV_KEYS = ['feculent', 'proteine', 'legume', 'extra', 'sauce', 'petitdej', 'collation', 'dessert'];
const str = (v, max) => (v == null ? '' : String(v).slice(0, max));
const bool = (v) => v === true;
const oneOf = (v, list, dflt) => (list.includes(v) ? v : dflt);

export function num(v, min, max, { int = false } = {}) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const c = Math.min(max, Math.max(min, n));
  return int ? Math.round(c) : c;
}

function iso(v) {
  if (v == null || v === '') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const day = (v) => (typeof v === 'string' && DAY.test(v) ? v : null);
const strList = (v, max, fn = id) => (Array.isArray(v) ? v.slice(0, max).map(fn).filter(Boolean) : []);
const drop = (o) => {
  for (const k of Object.keys(o)) if (o[k] === null || o[k] === undefined || o[k] === '') delete o[k];
  return o;
};

// Liste de paires [identifiant, quantité]
function pairs(v, max) {
  return Array.isArray(v)
    ? v.slice(0, max).map((x) => (Array.isArray(x) && id(x[0]) && num(x[1], 0, 100000) != null ? [x[0], num(x[1], 0, 100000)] : null)).filter(Boolean)
    : [];
}

function meal(d, rowId) {
  const [dDay, dSlot] = String(rowId).split(':');
  const out = drop({
    day: day(d.day) || day(dDay),
    slot: oneOf(d.slot, SLOTS, oneOf(dSlot, SLOTS, null)),
    kind: oneOf(d.kind, MEAL_KINDS, null),
    recipe: id(d.recipe),
    portions: num(d.portions, 0.25, 10),
    cooked: num(d.cooked, 0.5, 20),
    from: id(d.from),
    cost: num(d.cost, 0, 1000),
    kcal: num(d.kcal, 0, 10000, { int: true }),
    label: str(d.label, 80),
    note: str(d.note, 300),
    done: bool(d.done) || null,
    mc: bool(d.mc) || null,
    // Assiette composée : [ingrédient, quantité par portion] + une sauce facultative
    sauce: id(d.sauce),
    dessert: id(d.dessert),
    cake: id(d.cake),
  });
  out.parts = pairs(d.parts, 10);
  if (!out.parts.length) delete out.parts;
  // Sauce « à l'œil » (par portion) et dessert libre (carré de chocolat, yaourt, produit du commerce…)
  out.sauceParts = pairs(d.sauceParts, 10);
  if (!out.sauceParts.length) delete out.sauceParts;
  out.dessertParts = pairs(d.dessertParts, 8);
  if (!out.dessertParts.length) delete out.dessertParts;
  if (out.kind === 'compo' && !out.parts && !out.sauce && !out.sauceParts) return null;
  return out.day && out.slot && out.kind ? out : null;
}

function recipe(d) {
  const ing = pairs(d.ing, 40);
  const steps = Array.isArray(d.steps)
    ? d.steps.slice(0, 40).map((s) => (s && typeof s === 'object' ? drop({ t: str(s.t, 600), s: num(s.s, 0, 86400, { int: true }) }) : null)).filter((s) => s && s.t)
    : [];
  return drop({
    name: str(d.name, 80) || 'Recette',
    cat: oneOf(d.cat, CATS, 'diner'),
    style: oneOf(d.style, STYLES, 'equilibre'),
    time: num(d.time, 0, 1440, { int: true }) ?? 30,
    serves: num(d.serves, 1, 20, { int: true }) ?? 2,
    equip: strList(d.equip, 4).filter((e) => EQUIP.includes(e)),
    freeze: bool(d.freeze) || null,
    gamelle: d.gamelle === false ? false : true,
    tags: strList(d.tags, 10),
    tip: str(d.tip, 500),
    ing,
    steps,
  });
}

function ingredient(d) {
  return drop({
    custom: bool(d.custom) || null,
    name: str(d.name, 80),
    rayon: d.rayon ? oneOf(d.rayon, RAYONS, 'autre') : null,
    unit: d.unit ? oneOf(d.unit, UNITS, 'g') : null,
    kcal: num(d.kcal, 0, 1000),
    p: num(d.p, 0, 100),
    c: num(d.c, 0, 100),
    f: num(d.f, 0, 100),
    fib: num(d.fib, 0, 100),
    pw: num(d.pw, 0.1, 10000),
    price: num(d.price, 0, 10000),
    buy: num(d.buy, 0.1, 100000),
    buyLabel: str(d.buyLabel, 60),
    staple: typeof d.staple === 'boolean' ? d.staple : null,
    // Origine des valeurs (« Open Food Facts 3017620422003 », « étiquette »…)
    src: str(d.src, 80),
  });
}

// Réserve : une quantité précise, ou juste « j'en ai » (coché dans « Ce que j'ai »).
// soon : à finir vite (les recettes qui l'utilisent passent devant).
function stock(d) {
  const qty = num(d.qty, 0, 1000000);
  const have = bool(d.have);
  if (qty == null && !have) return null;
  return drop({ qty, have: have || null, soon: bool(d.soon) || null, place: oneOf(d.place, PLACES, null) });
}

// Dessert préparé une fois pour plusieurs jours (gâteau, riz au lait…), mangé en parts.
function bake(d) {
  const out = drop({
    recipe: id(d.recipe),
    day: day(d.day),
    parts: num(d.parts, 1, 30, { int: true }),
    done: bool(d.done) || null,
  });
  return out.recipe && out.day && out.parts ? out : null;
}

// Fond de placard : achat récurrent proposé chaque semaine ou chaque mois.
function pantry(d) {
  return drop({ every: oneOf(d.every, EVERY, 'month'), last: day(d.last) });
}

function list(d) {
  const extras = Array.isArray(d.extras)
    ? d.extras.slice(0, 100).map((x) => (x && id(x.uid) ? { uid: x.uid, name: str(x.name, 80), done: bool(x.done) } : null)).filter((x) => x && x.name)
    : [];
  return { checked: strList(d.checked, 300), extras, range: d.range === 'week' ? 'week' : 'today' };
}

function settings(d) {
  const p = d.profile && typeof d.profile === 'object' ? d.profile : {};
  const u = d.uber && typeof d.uber === 'object' ? d.uber : {};
  const s = d.slots && typeof d.slots === 'object' ? d.slots : {};
  const e = d.equip && typeof d.equip === 'object' ? d.equip : {};
  const h = d.habits && typeof d.habits === 'object' ? d.habits : {};
  const fv = d.favs && typeof d.favs === 'object' ? d.favs : {};
  return {
    // Aliments ajoutés à la main, gardés en suggestion (assiette, sauce, petit-déj, collation, dessert)
    favs: Object.fromEntries(FAV_KEYS.map((k) => [k, (Array.isArray(fv[k]) ? fv[k] : []).map(id).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 12)])),
    profile: drop({
      sex: oneOf(p.sex, ['h', 'f'], null),
      age: num(p.age, 10, 110, { int: true }),
      height: num(p.height, 100, 250, { int: true }),
      weight: num(p.weight, 25, 400),
      activity: num(p.activity, 1, 2.5),
    }),
    goal: oneOf(d.goal, ['perte', 'maintien', 'prise'], 'maintien'),
    deficit: num(d.deficit, 5, 25, { int: true }) ?? 15,
    proteinPerKg: num(d.proteinPerKg, 0.8, 3) ?? 1.8,
    kcalOverride: num(d.kcalOverride, 1000, 6000, { int: true }),
    slots: { petitdej: s.petitdej === true, collation: s.collation === true },
    batch: d.batch !== false,
    weekdayTime: num(d.weekdayTime, 10, 180, { int: true }) ?? 45,
    plaisir: num(d.plaisir, 0, 7, { int: true }) ?? 1,
    leger: num(d.leger, 0, 7, { int: true }) ?? 2,
    equip: { plaques: e.plaques !== false, four: e.four !== false, micro: e.micro !== false, mc: e.mc !== false },
    preferMc: d.preferMc === true,
    exclude: strList(d.exclude, 100),
    uber: drop({ avg: num(u.avg, 0, 500) ?? 22, perWeek: num(u.perWeek, 0, 21) ?? 3, kcal: num(u.kcal, 0, 5000, { int: true }) ?? 1100 }),
    libreKcal: num(d.libreKcal, 0, 5000, { int: true }) ?? 800,
    start: day(d.start),
    // Petit budget (fin de mois) : manuel, ou automatique les 10 derniers jours du mois
    serre: d.serre === true,
    serreAuto: d.serreAuto === true,
    // Habitudes du jour : créatine et shaker de whey
    habits: drop({
      creatine: h.creatine !== false,
      whey: h.whey !== false,
      wheyG: num(h.wheyG, 5, 100, { int: true }) ?? 30,
      dose: str(h.dose, 30) || '1 scoop',
    }),
    theme: oneOf(d.theme, ['auto', 'light', 'dark'], 'auto'),
    wakeLock: d.wakeLock !== false,
    sound: d.sound !== false,
  };
}

// Journal du jour (kind « weight », identifiant = le jour AAAA-MM-JJ) :
// pesée en kg, créatine prise, nombre de shakers de whey. Tout est facultatif.
function weight(d, rid) {
  if (!day(rid)) return null;
  const out = {};
  if (d.weight != null && d.weight !== '') {
    const raw = Number(d.weight);
    if (Number.isFinite(raw) && raw >= 20 && raw <= 500) out.weight = Math.round(raw * 10) / 10; // refusé, pas ramené à la limite
  }
  if (d.creatine === true) out.creatine = true;
  const sh = num(d.shakes, 0, 5, { int: true });
  if (sh) out.shakes = sh;
  // Craquages de la journée, hors repas : [aliment, quantité]
  const sn = pairs(d.snacks, 12);
  if (sn.length) out.snacks = sn;
  return Object.keys(out).length ? out : null;
}

const CLEANERS = { meal, recipe, ingredient, stock, list, settings, weight, bake, pantry };

// Renvoie une copie propre de la ligne, ou null si elle est inutilisable.
export function cleanRow(table, r) {
  if (!r || typeof r !== 'object') return null;
  const common = { updated_at: iso(r.updated_at), deleted: bool(r.deleted) };
  if (r.user_id !== undefined) common.user_id = id(r.user_id);
  if (table === 'gamelle') {
    const kind = CLEANERS[r.kind] ? r.kind : null;
    const rid = id(r.id);
    if (!kind || !rid) return null;
    if (common.deleted) return { ...common, kind, id: rid, data: {} };
    const d = r.data && typeof r.data === 'object' ? CLEANERS[kind](r.data, rid) : null;
    if (!d) return null;
    return { ...common, kind, id: rid, data: d };
  }
  return null;
}
