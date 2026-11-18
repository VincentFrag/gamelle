// Éléments d'interface partagés : étiquettes de prix, macros, choix de recette, actions sur un repas.
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as food from '../food.js';
import * as plan from '../plan.js';
import * as have from '../have.js';
import { esc, icon, openSheet, menuSheet, toast, formData } from '../ui.js';
import { pickIngredient, productSheet, groupOf, defaultQty, GROUP_LABELS } from './aliments.js';
import * as portions from '../portions.js';
import * as favs from '../favs.js';

export function priceTag(eur, { big = false, cls = '' } = {}) {
  return `<span class="price ${big ? 'is-big' : ''} ${cls}"><span class="price-int">${esc(calc.fmtEur(eur).replace(/\s€$/, ''))}</span><span class="price-cur">€</span></span>`;
}

export function macros(st, { short = false } = {}) {
  if (!st) return '';
  const p = st.p == null ? '' : `<span class="m m-p"><b>${calc.fmt0(st.p)}</b> g prot.</span>`;
  if (short) return `<span class="macros"><span class="m"><b>${calc.fmt0(st.kcal)}</b> kcal</span>${p}</span>`;
  return `<span class="macros"><span class="m"><b>${calc.fmt0(st.kcal)}</b> kcal</span>${p}${st.c == null ? '' : `<span class="m m-c"><b>${calc.fmt0(st.c)}</b> g gluc.</span><span class="m m-f"><b>${calc.fmt0(st.f)}</b> g lip.</span>`}</span>`;
}

// Barre de progression vers l'objectif du jour
export function gauge(value, target, label, cls = '') {
  if (!target) return '';
  const ratio = value / target;
  const pct = Math.min(100, Math.round(ratio * 100));
  const state = ratio > 1.1 ? 'is-over' : ratio >= 0.9 ? 'is-ok' : '';
  return `<div class="gauge ${cls} ${state}">
    <div class="gauge-text"><span>${esc(label)}</span><span><b>${calc.fmt0(value)}</b> / ${calc.fmt0(target)}</span></div>
    <div class="gauge-track"><span class="gauge-fill" style="width:${pct}%"></span></div>
  </div>`;
}

export function styleTag(r) {
  if (!r) return '';
  return `<span class="tag style-${r.style}">${esc(food.STYLE_LABELS[r.style] || '')}</span>`;
}

export function recipeMeta(r) {
  const bits = r.time ? [`${r.time} min`] : ['sans préparation'];
  if (food.isLot(r)) bits.push(`${r.serves} parts`);
  if ((r.equip || []).includes('four')) bits.push('four');
  if (r.mc) bits.push('Monsieur Cuisine');
  if (r.freeze) bits.push('se congèle');
  return bits.join(', ');
}

export function recipeRow(r, { href = true, data = '' } = {}) {
  const st = food.recipeStats(r);
  const tag = href ? 'a' : 'button';
  const attr = href ? `href="#/recettes/${esc(r.id)}"` : `type="button" ${data}`;
  return `<${tag} class="list-row recipe-row" ${attr}>
    <span class="list-main"><span class="rr-name">${esc(r.name)}</span>
      <small>${esc(recipeMeta(r))}</small>
      <small class="rr-macros">${calc.fmt0(st.kcal)} kcal, ${calc.fmt0(st.p)} g de protéines ${food.isLot(r) ? 'la part' : 'par portion'}</small></span>
    ${priceTag(st.cost)}
  </${tag}>`;
}

// ---------- Choisir une recette ----------
export function pickRecipe({ title = 'Choisir une recette', cat = null, cats = ['diner', 'petitdej', 'collation'], only = null, create = null } = {}) {
  const s = calc.settings();
  let filter = cat || cats[0];
  let q = '';
  return openSheet({
    title,
    wide: true,
    top: `<label class="search"><span class="sr-only">Rechercher</span><input type="search" placeholder="Rechercher une recette ou un ingrédient" data-q autocomplete="off"></label>
      ${cats.length > 1 ? `<div class="chips tight" role="group" aria-label="Type">${cats.map((k) => `<button type="button" class="chip ${k === filter ? 'is-on' : ''}" data-cat="${k}">${esc(food.CAT_LABELS[k])}</button>`).join('')}</div>` : ''}`,
    body: `${create ? `<button type="button" class="btn primary block" data-create>${icon('add')} ${esc(create)}</button>` : ''}
      <div class="list pick-results" data-results></div>`,
    onMount(el, api) {
      const draw = () => {
        const nq = food.norm(q);
        const list = food.recipes()
          .filter((r) => r.cat === filter && (!only || only(r)))
          .filter((r) => !nq || food.norm(r.name).includes(nq) || r.ing.some(([id]) => food.norm(food.ingredient(id)?.name).includes(nq)))
          .sort((a, b) => (food.usable(b, s) - food.usable(a, s)) || a.name.localeCompare(b.name, 'fr'));
        el.querySelector('[data-results]').innerHTML = list.length
          ? list.map((r) => recipeRow(r, { href: false, data: `data-pick="${esc(r.id)}"` })).join('')
          : '<p class="empty pad">Aucune recette ne correspond.</p>';
      };
      el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; draw(); });
      el.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cat]');
        if (c) {
          filter = c.dataset.cat;
          el.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('is-on', b === c));
          draw();
          return;
        }
        const p = e.target.closest('[data-pick]');
        if (p) api.close(p.dataset.pick);
        if (e.target.closest('[data-create]')) api.close('__create');
      });
      draw();
    },
  });
}

// ---------- Mon gâteau (dessert de la semaine perso) ----------
// Tes ingrédients pour tout le gâteau, le nombre de parts : calories et prix par part en direct.
// Enregistré comme une recette perso (dessert, « dessert de la semaine »). Renvoie l'id.
export async function myCakeSheet(existingId = null) {
  const ex = existingId ? food.recipe(existingId) : null;
  const ing = new Map(ex ? ex.ing : []);
  const res = await openSheet({
    title: ex ? 'Modifier mon gâteau' : 'Mon gâteau',
    wide: true,
    body: `<form class="form" data-form>
      <label class="field big"><span>Nom</span><input name="name" maxlength="80" value="${esc(ex?.name || '')}" placeholder="Ex. : gâteau au fromage blanc" required></label>
      <div class="field-row">
        <label class="field"><span>Nombre de parts</span><input name="parts" inputmode="numeric" value="${esc(ex?.serves || 8)}"></label>
        <label class="field"><span>Durée (min)</span><input name="time" inputmode="numeric" value="${esc(ex?.time || 45)}"></label>
      </div>
      <h3 class="group-title">Ingrédients, pour tout le gâteau</h3>
      <div class="ing-edit" data-ings></div>
      <button type="button" class="btn ghost" data-add-ing>${icon('add')} Ajouter un ingrédient</button>
      <div class="compo-total" data-total></div>
      <label class="field"><span>Étapes, une par ligne (facultatif)</span><textarea name="steps" rows="4" placeholder="Bats les blancs en neige.">${esc((ex?.steps || []).map((st) => st.t).join('\n'))}</textarea></label>
    </form>`,
    onMount(el) {
      const parts = () => Math.max(1, Math.min(30, Math.round(calc.parseNum(el.querySelector('[name=parts]').value) || 8)));
      const total = () => {
        const list = [...ing];
        const box = el.querySelector('[data-total]');
        if (!list.length) {
          box.innerHTML = '<span class="fine">Ajoute tes ingrédients : les calories et le prix par part se calculent tout seuls.</span>';
          return;
        }
        const st = food.sumOf(list);
        const n = parts();
        box.innerHTML = `<span class="compo-name">Une part sur ${n}</span>
          <span class="compo-figs">${macros({ kcal: st.kcal / n, p: st.p / n, c: st.c / n, f: st.f / n })} ${priceTag(st.cost / n)}</span>
          <span class="fine">Gâteau entier : ${calc.fmt0(st.kcal)} kcal, ${esc(calc.fmtEur(st.cost))}</span>`;
      };
      const drawIngs = () => {
        el.querySelector('[data-ings]').innerHTML = [...ing].map(([id, q]) => {
          const it = food.ingredient(id);
          if (!it) return '';
          return `<div class="ing-row"><span class="ing-row-name">${esc(it.name)}</span>
            <label class="ing-row-qty"><span class="sr-only">Quantité</span><input inputmode="decimal" data-ing-q="${esc(id)}" value="${esc(calc.numInput(q))}"><span>${it.unit === 'pc' ? 'pièce(s)' : it.unit}</span></label>
            <button type="button" class="icon-btn" data-ing-del="${esc(id)}" aria-label="Retirer ${esc(it.name)}">${icon('trash')}</button></div>`;
        }).join('');
        total();
      };
      el.addEventListener('input', (e) => {
        const q = e.target.closest('[data-ing-q]');
        if (q) {
          const v = calc.parseNum(q.value);
          if (v > 0 && v < 10000) ing.set(q.dataset.ingQ, v);
        }
        total();
      });
      el.addEventListener('click', async (e) => {
        if (e.target.closest('[data-add-ing]')) {
          const id = await pickIngredient({ title: 'Ingrédient du gâteau' });
          if (id && !ing.has(id)) {
            const it = food.ingredient(id);
            ing.set(id, it?.unit === 'pc' ? 1 : 100);
          }
          drawIngs();
          return;
        }
        const d = e.target.closest('[data-ing-del]');
        if (d) {
          ing.delete(d.dataset.ingDel);
          drawIngs();
        }
      });
      drawIngs();
    },
    actions: [
      { label: 'Annuler', value: null },
      {
        label: 'Enregistrer', kind: 'primary',
        handler(el) {
          const f = formData(el);
          if (!f.name.trim()) {
            toast('Donne un nom à ton gâteau.', { kind: 'error' });
            return false;
          }
          if (!ing.size) {
            toast('Ajoute au moins un ingrédient.', { kind: 'error' });
            return false;
          }
          const rid = existingId || store.uuid();
          const n = Math.max(1, Math.min(30, Math.round(calc.parseNum(f.parts) || 8)));
          store.put('recipe', rid, {
            name: f.name.trim(), cat: 'dessert', style: 'equilibre', time: calc.parseNum(f.time) || 45, serves: n,
            equip: ex?.equip || ['four'], freeze: ex?.freeze ?? true, gamelle: true,
            tags: [...new Set([...(ex?.tags || []), 'lot'])], ing: [...ing],
            steps: f.steps.split('\n').map((t) => t.trim()).filter(Boolean).map((t) => ({ t })),
          });
          toast(existingId ? 'Gâteau modifié.' : `${f.name.trim()} enregistré dans tes recettes.`);
          return rid;
        },
      },
    ],
  });
  return res || null;
}

// ---------- Saisie d'un repas hors recette (commande, repas libre) ----------
export function outsideSheet(day, slot, kind, cur) {
  const s = calc.settings();
  const isUber = kind === 'uber';
  const planned = plan.getMeal(day, slot);
  const plannedSt = isUber && planned && plan.isCooked(planned) && !planned.done ? plan.mealStats(planned, s) : null;
  const plannedR = plannedSt && planned.kind === 'recette' ? food.recipe(planned.recipe) : null;
  return openSheet({
    title: isUber ? 'Commande' : 'Repas libre',
    body: `<form class="form" data-form>
      <p>${isUber ? 'Note la commande pour garder un compteur honnête. Le prix et les calories sont pré-remplis avec tes valeurs habituelles.' : 'Restaurant, repas chez des amis, cantine… Une estimation suffit.'}</p>
      ${plannedSt ? `<p class="pep small">${icon('spark')}<span>Le plat prévu, ${esc(plan.mealTitle(planned).toLowerCase())}, c’était ${esc(calc.fmtEur(plannedSt.cost))}${plannedR ? ` et ${plannedR.time} minutes` : ''}. Si tu changes d’avis, ferme simplement cette fenêtre.</span></p>` : ''}
      <label class="field"><span>Description</span><input name="label" maxlength="80" value="${esc(cur?.label || '')}" placeholder="${isUber ? 'Ex. : burger frites' : 'Ex. : resto avec l’équipe'}"></label>
      <div class="field-row">
        <label class="field"><span>Prix (€)</span><input name="cost" inputmode="decimal" value="${esc(calc.numInput(cur?.cost ?? (isUber ? s.uber.avg : null)))}"></label>
        <label class="field"><span>Calories (estimation)</span><input name="kcal" inputmode="numeric" value="${esc(calc.numInput(cur?.kcal ?? (isUber ? s.uber.kcal : s.libreKcal)))}"></label>
      </div>
      <div class="chips tight" role="group" aria-label="Taille du repas">
        <button type="button" class="chip" data-kcal="600">Léger, 600</button>
        <button type="button" class="chip" data-kcal="900">Normal, 900</button>
        <button type="button" class="chip" data-kcal="1300">Copieux, 1 300</button>
      </div>
      <label class="switch"><input type="checkbox" name="refund" ${cur?.refund ? 'checked' : ''}><span>Remboursé (note de frais)<small>Repas pro : le prix ne compte pas dans tes dépenses${isUber ? ' ni comme une commande' : ''}. Les calories et les macros, si.</small></span></label>
      <p class="group-title">Macros (facultatif, en grammes)</p>
      <div class="field-row three">
        <label class="field"><span>Protéines</span><input name="p" inputmode="decimal" value="${esc(calc.numInput(cur?.p ?? null))}"></label>
        <label class="field"><span>Glucides</span><input name="c" inputmode="decimal" value="${esc(calc.numInput(cur?.c ?? null))}"></label>
        <label class="field"><span>Lipides</span><input name="f" inputmode="decimal" value="${esc(calc.numInput(cur?.f ?? null))}"></label>
      </div>
      <p class="field-help" data-macro-check>Si tu les as estimées, elles comptent dans tes protéines du jour. Sinon, seules les calories comptent.</p>
    </form>`,
    onMount(el) {
      // Repère : ce que font les macros saisies, en calories (4 kcal par g de protéines ou glucides, 9 par g de lipides)
      const check = () => {
        const g = (k) => calc.parseNum(el.querySelector(`[name=${k}]`).value) || 0;
        const p = g('p'), c = g('c'), f = g('f');
        const box = el.querySelector('[data-macro-check]');
        if (!p && !c && !f) {
          box.textContent = 'Si tu les as estimées, elles comptent dans tes protéines du jour. Sinon, seules les calories comptent.';
          return;
        }
        const k = Math.round(p * 4 + c * 4 + f * 9);
        const kc = calc.parseNum(el.querySelector('[name=kcal]').value);
        // tant que les trois ne sont pas remplies, pas de comparaison : il en manque forcément
        const all = ['p', 'c', 'f'].every((n) => el.querySelector(`[name=${n}]`).value.trim() !== '');
        if (!all) {
          box.textContent = 'Les macros remplies comptent dans ta journée ; celles laissées vides comptent pour 0.';
          return;
        }
        box.textContent = `Tes macros font environ ${calc.fmt0(k)} kcal${kc ? (Math.abs(k - kc) > Math.max(150, kc * 0.2) ? ` : assez loin des ${calc.fmt0(kc)} kcal notées, l’un des deux est peut-être à revoir.` : ', cohérent avec tes calories.') : '. Laisse les calories vides pour utiliser ce chiffre.'}`;
      };
      el.addEventListener('input', check);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-kcal]');
        if (b) {
          el.querySelector('[name=kcal]').value = b.dataset.kcal;
          check();
        }
      });
      check();
    },
    actions: [
      { label: 'Annuler', value: null },
      {
        label: 'Enregistrer', kind: 'primary',
        handler(el) {
          const f = formData(el);
          const p = calc.parseNum(f.p), c = calc.parseNum(f.c), fat = calc.parseNum(f.f);
          let kcal = calc.parseNum(f.kcal);
          // calories vides mais macros données : on les déduit des macros
          if (kcal == null && (p || c || fat)) kcal = Math.round((p || 0) * 4 + (c || 0) * 4 + (fat || 0) * 9);
          plan.setMeal(day, slot, {
            kind,
            label: f.label.trim(),
            cost: calc.parseNum(f.cost),
            kcal,
            p, c, f: fat,
            refund: f.refund || undefined,
          });
          return true;
        },
      },
    ],
  });
}

function portionsSheet(m) {
  const isCook = plan.isCooked(m);
  return openSheet({
    title: 'Portions',
    body: `<form class="form" data-form>
      <label class="field"><span>Portions mangées à ce repas</span><input name="portions" inputmode="decimal" value="${esc(calc.numInput(m.portions ?? 1))}"></label>
      ${isCook ? `<label class="field"><span>Portions cuisinées</span><input name="cooked" inputmode="decimal" value="${esc(calc.numInput(m.cooked ?? 1))}"></label>
      <p class="field-help">${m.slot === 'soir' ? 'Le soir, Gamelle te propose de garder ce qui dépasse pour le lendemain midi. Au-delà, pense au congélateur.' : 'Ce qui dépasse peut aller au congélateur.'}</p>` : ''}
    </form>`,
    actions: [
      { label: 'Annuler', value: null },
      {
        label: 'Enregistrer', kind: 'primary',
        handler(el) {
          const f = formData(el);
          const portions = calc.parseNum(f.portions) || 1;
          const data = { ...m, portions };
          delete data.id;
          if (isCook) data.cooked = Math.max(portions, calc.parseNum(f.cooked) || portions);
          plan.setMeal(m.day, m.slot, data);
          return true;
        },
      },
    ],
  });
}

// Choix du jour et du repas, pour ce qu'on ajoute depuis une fiche
function whenFields(slots, { help = '', past = 0, day = null, label = 'Jour' } = {}) {
  const today = calc.localDay();
  const days = Array.from({ length: 10 + past }, (_, i) => calc.addDays(today, i - past));
  const sel = day || today;
  return `<div class="field-row">
    <label class="field"><span>${esc(label)}</span><select name="day">${days.map((d) => `<option value="${d}" ${d === sel ? 'selected' : ''}>${esc(calc.relDay(d))}${d !== today && calc.relDay(d) === calc.fmtDayName(d) ? '' : ` (${esc(calc.fmtShort(d))})`}</option>`).join('')}</select></label>
    ${slots.length > 1 ? `<label class="field"><span>Repas</span><select name="slot">${slots.map((sl) => `<option value="${sl}">${esc(plan.SLOT_LABELS[sl])}</option>`).join('')}</select></label>` : `<input type="hidden" name="slot" value="${slots[0]}">`}
  </div>${help ? `<p class="field-help">${help}</p>` : ''}`;
}

// Après avoir prévu un plat le soir en 2 portions : proposer la gamelle du lendemain.
function offerLeftover(day, slot, ctx) {
  if (slot !== 'soir') return;
  const next = calc.addDays(day, 1);
  if (!plan.leftoverOffer(next)) return;
  toast('Garder la deuxième portion pour demain midi ?', {
    action: 'Garder', duration: 7000,
    onAction: () => { plan.keepLeftover(next); ctx?.render(); },
  });
}

// ---------- Assiette composée ----------
// Féculent, protéine, légume, « en plus » et une sauce : tout est facultatif, plusieurs choix
// possibles par famille. « Autre… » ouvre tous les aliments, y compris ceux ajoutés depuis Open Food Facts.
const GROUPS = ['feculent', 'proteine', 'legume', 'extra'];
const MAX_PARTS = 6;

export function compoSheet({ day = null, slot = null, cur = null, sauce = null } = {}) {
  const s = calc.settings();
  // id → { group, qty } dans l'ordre de choix
  // Famille d'un aliment : celle où tu l'as rangé toi-même, sinon celle de ses valeurs
  const groupFor = (id) => favs.groupOf(id, GROUPS) || groupOf(food.ingredient(id));
  const pick = new Map();
  for (const [id, q] of cur?.parts || []) {
    const ing = food.ingredient(id);
    if (ing) pick.set(id, { group: groupFor(id), qty: q });
  }
  let sauceId = cur ? cur.sauce || null : sauce;
  // Ma sauce, à l'œil (par portion)
  const mineParts = new Map(cur?.sauceParts || []);
  let mine = Boolean(cur?.sauceParts?.length);
  const sauceExtra = `<button type="button" class="chip chip-add" data-sauce-other>${icon('add')} Autre</button>`;
  const mineList = () => (mine && mineParts.size ? [...mineParts] : null);
  const sauceUi = {};
  const sauces = food.recipes().filter((r) => r.cat === 'sauce').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const cookedDefault = cur?.cooked ?? (slot ? plan.defaultCooked(slot, s) : 2);
  const ui = {};
  const itemsOf = (g) => {
    // tes ajouts d'abord, puis les classiques
    const base = favs.list(g).map((id) => [id, defaultQty(food.ingredient(id), g)]);
    if (g !== 'extra') for (const [id, q] of food.COMPO[g].items) if (!base.some(([x]) => x === id)) base.push([id, q]);
    for (const [id, p] of pick) if (p.group === g && !base.some(([x]) => x === id)) base.push([id, p.qty]);
    // chaque aliment n'apparaît que dans une seule famille
    return base.filter(([id]) => {
      if (pick.has(id)) return pick.get(id).group === g;
      const fg = favs.groupOf(id, GROUPS);
      return !fg || fg === g;
    });
  };
  const chip = (group, [id, q]) => {
    const ing = food.ingredient(id);
    if (!ing) return '';
    if (ui.editing && favs.list(group).includes(id)) return `<button type="button" class="chip is-removable" data-part-del="${group}" data-id="${esc(id)}" aria-label="Retirer ${esc(ing.name)} des suggestions">${esc(ing.name)} ${icon('close')}</button>`;
    return `<button type="button" class="chip ${pick.has(id) ? 'is-on' : ''} ${have.has(id) ? 'has-dot' : ''}" data-part="${group}" data-id="${esc(id)}" aria-pressed="${pick.has(id)}">${esc(ing.name)}<small>${esc(food.fmtQty(ing, pick.get(id)?.qty ?? q))}</small></button>`;
  };
  const anyFav = () => GROUPS.some((g) => favs.list(g).length);
  const groupsHtml = () => GROUPS.map((g) => `<fieldset class="compo-group g-${g}"><legend>${esc(GROUP_LABELS[g])}${g === 'extra' ? ' <small>fromage, avocat, graines…</small>' : ''}</legend>
      <div class="chips tight">${itemsOf(g).map((it) => chip(g, it)).join('')}${ui.editing ? '' : `<button type="button" class="chip chip-add" data-other="${g}">${icon('add')} ${g === 'extra' ? 'Ajouter' : 'Autre'}</button>`}</div></fieldset>`).join('')
    + (anyFav() ? `<button type="button" class="link-btn fav-edit" data-parts-edit>${ui.editing ? 'Terminé' : 'Retirer des aliments ajoutés'}</button>` : '');
  const parts = () => GROUPS.flatMap((g) => [...pick].filter(([, p]) => p.group === g).map(([id, p]) => [id, p.qty]));
  return openSheet({
    title: cur?.id ? 'Modifier l’assiette' : 'Composer une assiette',
    wide: true,
    body: `<form class="form compo" data-form>
      ${day ? '' : whenFields(['soir', 'midi'])}
      <p class="field-help">Choisis ce que tu veux, tout est facultatif, plusieurs choix possibles. ${icon('check', 'dot-ico')} : tu en as à la maison.</p>
      <div data-groups>${groupsHtml()}</div>
      <fieldset class="compo-group g-sauce"><legend>Sauce</legend>
        <div class="chips tight">
          <button type="button" class="chip ${!sauceId && !mine ? 'is-on' : ''}" data-sauce="">Sans sauce</button>
          <button type="button" class="chip chip-mine ${mine ? 'is-on' : ''}" data-sauce="__mine">Ma sauce, à l’œil</button>
          ${sauces.map((r) => `<button type="button" class="chip ${sauceId === r.id ? 'is-on' : ''}" data-sauce="${esc(r.id)}">${esc(r.name.replace(/^Sauce\s+/i, '').replace(/^./, (c) => c.toUpperCase()))}</button>`).join('')}
        </div>
        <div class="sauce-mine" data-mine-box ${mine ? '' : 'hidden'}></div></fieldset>
      <div data-qty></div>
      <div class="compo-total" data-total></div>
      <label class="field small-field"><span>Portions cuisinées</span><input name="cooked" inputmode="decimal" value="${esc(calc.numInput(cookedDefault))}"></label>
    </form>`,
    onMount(el) {
      const total = () => {
        const p = parts();
        const box = el.querySelector('[data-total]');
        if (!p.length && !sauceId && !mineList()) {
          box.innerHTML = '<span class="fine">Choisis au moins un élément.</span>';
          return;
        }
        const st = food.compoStats(p, sauceId, mineList());
        box.innerHTML = `<span class="compo-name">${esc(food.compoTitle(p, sauceId, mineList()))}</span>
          <span class="compo-figs">${macros(st)} ${priceTag(st.cost)}</span>`;
      };
      const qtyList = () => {
        const p = parts();
        el.querySelector('[data-qty]').innerHTML = p.length ? `<p class="group-title">Quantités pour une portion</p><p class="field-help">Riz, pâtes, semoule : le poids <b>cru</b>, avant cuisson. 80 g de riz cru donnent environ 200 g de riz cuit.</p><div class="ing-edit">${p.map(([id, q]) => {
          const ing = food.ingredient(id);
          const sw = portions.swell(ing);
          const kc = food.sumOf([[id, q]]).kcal;
          return `<div class="ing-row"><span class="ing-row-name">${esc(ing.name)}<small data-row-hint="${esc(id)}">${calc.fmt0(kc)} kcal${sw ? `, pesé cru (≈ ${calc.fmt0(q * sw)} g une fois cuit)` : ''}</small></span><label class="ing-row-qty"><input inputmode="decimal" data-qty-id="${esc(id)}" value="${esc(calc.numInput(q))}" aria-label="Quantité de ${esc(ing.name)}${sw ? ', poids cru' : ''}">${ing.unit === 'pc' ? 'pièce' : sw ? 'g cru' : ing.unit}</label><button type="button" class="icon-btn" data-unpick="${esc(id)}" aria-label="Retirer ${esc(ing.name)}">${icon('close')}</button></div>`;
        }).join('')}</div>` : '';
      };
      const redraw = () => {
        el.querySelector('[data-groups]').innerHTML = groupsHtml();
        qtyList();
        total();
      };
      el.addEventListener('input', (e) => {
        const q = e.target.closest('[data-qty-id]');
        if (!q) return;
        const v = calc.parseNum(q.value);
        const p = pick.get(q.dataset.qtyId);
        if (p && v > 0 && v < 5000) {
          p.qty = v;
          const ing = food.ingredient(q.dataset.qtyId);
          const c = el.querySelector(`[data-part][data-id="${CSS.escape(q.dataset.qtyId)}"] small`);
          if (c) c.textContent = food.fmtQty(ing, v);
          const h = el.querySelector(`[data-row-hint="${CSS.escape(q.dataset.qtyId)}"]`);
          const sw = portions.swell(ing);
          if (h) h.textContent = `${calc.fmt0(food.sumOf([[q.dataset.qtyId, v]]).kcal)} kcal${sw ? `, pesé cru (≈ ${calc.fmt0(v * sw)} g une fois cuit)` : ''}`;
          total();
        }
      });
      const drawMine = () => {
        const mb = el.querySelector('[data-mine-box]');
        mb.hidden = !mine;
        if (mine) mb.innerHTML = `<p class="field-help">Pour une portion. Touche ce que tu mets, ajuste avec − et + : une cuillère, une pincée, ça suffit.</p>${eyeball({ suggest: portions.SAUCE_ORDER, ctx: 'sauce', chosen: mineParts, extra: sauceExtra, favKey: 'sauce', ui: sauceUi })}`;
      };
      drawMine();
      el.addEventListener('click', async (e) => {
        if (el.querySelector('[data-mine-box]').contains(e.target)) {
          if (eyeballClick(e, mineParts, 'sauce', { favKey: 'sauce', ui: sauceUi })) { drawMine(); return total(); }
          if (e.target.closest('[data-sauce-other]')) {
            const id = await pickIngredient({ title: 'Dans ma sauce' });
            if (id && !mineParts.has(id)) mineParts.set(id, portions.defaultQty(id, 'sauce'));
            favs.add('sauce', id);
            drawMine();
            return total();
          }
        }
        const c = e.target.closest('[data-part]');
        if (c) {
          const id = c.dataset.id;
          if (pick.has(id)) pick.delete(id);
          else if (pick.size >= MAX_PARTS) return toast(`${MAX_PARTS} éléments au plus dans une assiette.`, { kind: 'error' });
          else {
            const it = food.compoItem(id);
            pick.set(id, { group: c.dataset.part, qty: it ? it.qty : defaultQty(food.ingredient(id), c.dataset.part) });
          }
          return redraw();
        }
        if (e.target.closest('[data-parts-edit]')) {
          ui.editing = !ui.editing;
          return redraw();
        }
        const pd = e.target.closest('[data-part-del]');
        if (pd) {
          favs.remove(pd.dataset.partDel, pd.dataset.id);
          if (!anyFav()) ui.editing = false;
          return redraw();
        }
        const un = e.target.closest('[data-unpick]');
        if (un) {
          pick.delete(un.dataset.unpick);
          return redraw();
        }
        const o = e.target.closest('[data-other]');
        if (o) {
          if (pick.size >= MAX_PARTS) return toast(`${MAX_PARTS} éléments au plus dans une assiette.`, { kind: 'error' });
          const g = o.dataset.other;
          const id = await pickIngredient({ title: GROUP_LABELS[g], group: g });
          if (id) {
            // rangé là où tu l'as ajouté, et proposé dans cette famille seulement les fois suivantes
            if (pick.has(id)) pick.get(id).group = g;
            else pick.set(id, { group: g, qty: defaultQty(food.ingredient(id), g) });
            favs.addOnly(g, id, GROUPS);
          }
          return redraw();
        }
        const sc = e.target.closest('[data-sauce]');
        if (sc) {
          mine = sc.dataset.sauce === '__mine';
          sauceId = mine ? null : sc.dataset.sauce || null;
          el.querySelectorAll('[data-sauce]').forEach((b) => b.classList.toggle('is-on', mine ? b.dataset.sauce === '__mine' : (b.dataset.sauce || null) === sauceId));
          drawMine();
          total();
        }
      });
      qtyList();
      total();
    },
    actions: [
      { label: 'Annuler', value: null },
      {
        label: 'Enregistrer', kind: 'primary',
        handler(el) {
          const p = parts();
          if (!p.length && !sauceId && !mineList()) {
            toast('Choisis au moins un élément.', { kind: 'error' });
            return false;
          }
          const f = formData(el);
          const d = day || f.day;
          const sl = slot || f.slot;
          const cooked = Math.max(1, calc.parseNum(f.cooked) || 1);
          plan.setMeal(d, sl, { kind: 'compo', parts: p, sauce: sauceId, sauceParts: mineList() || undefined, portions: cur?.portions ?? 1, cooked });
          return { day: d, slot: sl };
        },
      },
    ],
  });
}

// Comment préparer une assiette composée : cuisson de chaque élément puis la sauce.
export function prepSheet(m, ctx) {
  const lines = [];
  for (const [id] of m.parts || []) {
    const it = food.compoItem(id);
    const name = food.ingredient(id)?.name || '';
    if (it) lines.push({ t: it.how, s: it.s, label: name });
    else if (name) lines.push({ t: `${name} : à préparer à ta façon.`, s: 0, label: name });
  }
  const sr = m.sauce && food.recipe(m.sauce);
  return openSheet({
    title: 'Préparer l’assiette',
    wide: true,
    body: `<p class="block-sub">Pour ${calc.fmt1(m.cooked ?? m.portions ?? 1)} portion${(m.cooked ?? 1) > 1 ? 's' : ''}. Lance le plus long en premier.</p>
      <ol class="steps">${lines.sort((a, b) => (b.s || 0) - (a.s || 0)).map((l, i) => `<li><span class="step-n">${i + 1}</span><span class="step-t">${esc(l.t)}</span>${l.s ? `<button class="timer-chip" data-timer="${l.s}" data-label="${esc(l.label)}">${icon('timer')} ${esc(calc.fmtMinutes(l.s))}</button>` : ''}</li>`).join('')}</ol>
      ${sr ? `<h3 class="block-title">${esc(sr.name)}</h3>
        <ul class="ing-list">${sr.ing.map(([iid, q]) => { const l = food.ingLine(iid, (q * (m.cooked ?? 1)) / (sr.serves || 1)); return `<li><span class="ing-qty">${esc(l.qty)}</span><span class="ing-name">${esc(l.name)}</span></li>`; }).join('')}</ul>
        <ol class="steps">${sr.steps.map((st, i) => `<li><span class="step-n">${i + 1}</span><span class="step-t">${esc(st.t)}</span>${st.s ? `<button class="timer-chip" data-timer="${st.s}" data-label="${esc(sr.name)}">${icon('timer')} ${esc(calc.fmtMinutes(st.s))}</button>` : ''}</li>`).join('')}</ol>
        ${sr.tip ? `<p class="hint-text">${esc(sr.tip)}</p>` : ''}` : ''}
      ${m.sauceParts?.length ? `<h3 class="block-title">Ta sauce, à l’œil</h3>
        <ul class="ing-list">${m.sauceParts.map(([iid, q]) => `<li><span class="ing-qty">${esc(portions.fmtMeasure(iid, q * (m.cooked ?? 1), 'sauce'))}</span><span class="ing-name">${esc(food.ingredient(iid)?.name || '')}</span></li>`).join('')}</ul>
        <p class="hint-text">Fais revenir d’abord ce qui se cuit (poivron, oignon, ail), puis ajoute le reste à feu doux, 2 à 3 minutes, avec un fond d’eau si c’est trop épais. Goûte et ajuste.</p>` : ''}`,
    onMount(el) {
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-timer]');
        if (t) ctx.timers.start(Number(t.dataset.timer), t.dataset.label);
      });
    },
  });
}

// ---------- Desserts ----------
function dessertRow(r, { on = false, attr = '' } = {}) {
  const st = food.recipeStats(r);
  const whey = (r.tags || []).includes('whey');
  return `<button type="button" class="list-row dessert-row ${on ? 'is-on' : ''}" ${attr}>
    <span class="list-main"><span>${esc(r.name)}${whey ? ' <span class="tag mini">protéiné</span>' : ''}</span>
      <small>${calc.fmt0(st.kcal)} kcal, ${calc.fmt0(st.p)} g de protéines</small></span>
    ${priceTag(st.cost)}
  </button>`;
}

// ---------- Choix « à l'œil » ----------
// Un état (Map id → quantité) affiché en pastilles de suggestion et en lignes avec − / +.
// ctx : 'dessert' ou 'sauce' (pour les mesures : carré, pot, cuillère, pincée…).
// favKey : famille des favoris (ce que tu as ajouté toi-même reste proposé, et peut être retiré).
export function eyeball({ suggest, ctx, chosen, extra = '', favKey = null, ui = {} }) {
  const mine = favKey ? favs.list(favKey) : [];
  const ids = [...new Set([...mine, ...suggest])].filter((id) => food.ingredient(id));
  const chips = ids.map((id) => (ui.editing && mine.includes(id)
    ? `<button type="button" class="chip is-removable" data-fav-del="${esc(id)}" aria-label="Retirer ${esc(food.ingredient(id).name)} des suggestions">${esc(food.ingredient(id).name)} ${icon('close')}</button>`
    : `<button type="button" class="chip ${chosen.has(id) ? 'is-on' : ''} ${have.has(id) ? 'has-dot' : ''} ${mine.includes(id) ? 'is-fav' : ''}" data-eye="${esc(id)}" aria-pressed="${chosen.has(id)}">${esc(food.ingredient(id).name)}</button>`)).join('');
  const editLink = mine.length ? `<button type="button" class="link-btn fav-edit" data-fav-edit>${ui.editing ? 'Terminé' : 'Retirer des aliments ajoutés'}</button>` : '';
  const rows = [...chosen].map(([id, q]) => {
    const ing = food.ingredient(id);
    if (!ing) return '';
    const st = food.sumOf([[id, q]]);
    return `<div class="mrow"><span class="mrow-name">${esc(ing.name)}<small>${calc.fmt0(st.kcal)} kcal${st.p >= 1 ? `, ${calc.fmt0(st.p)} g prot.` : ''}</small></span>
      <span class="mstep"><button type="button" class="icon-btn small" data-eye-step="${esc(id)}" data-dir="-1" aria-label="Moins de ${esc(ing.name)}">−</button><b>${esc(portions.fmtMeasure(id, q, ctx))}</b><button type="button" class="icon-btn small" data-eye-step="${esc(id)}" data-dir="1" aria-label="Plus de ${esc(ing.name)}">+</button></span></div>`;
  }).join('');
  return `<div class="chips tight">${chips}${ui.editing ? '' : extra}</div>${editLink}${rows ? `<div class="mrows">${rows}</div>` : ''}`;
}

// Gère les clics d'un bloc eyeball. Renvoie true si le clic le concernait.
export function eyeballClick(e, chosen, ctx, { favKey = null, ui = {} } = {}) {
  if (e.target.closest('[data-fav-edit]')) {
    ui.editing = !ui.editing;
    return true;
  }
  const fd = e.target.closest('[data-fav-del]');
  if (fd && favKey) {
    favs.remove(favKey, fd.dataset.favDel);
    if (!favs.list(favKey).length) ui.editing = false;
    return true;
  }
  const c = e.target.closest('[data-eye]');
  if (c) {
    const id = c.dataset.eye;
    if (chosen.has(id)) chosen.delete(id);
    else chosen.set(id, portions.defaultQty(id, ctx));
    return true;
  }
  const st = e.target.closest('[data-eye-step]');
  if (st) {
    const id = st.dataset.eyeStep;
    const q = portions.step(id, chosen.get(id) || 0, Number(st.dataset.dir), ctx);
    if (q > 0) chosen.set(id, q);
    else chosen.delete(id);
    return true;
  }
  return false;
}

// ---------- Parts du dessert de la semaine ----------
// Choisies avec − et + (0 = pas de gâteau), à n'importe quel repas : dessert, petit-déj, collation.
function cakeLots(day, m) {
  return plan.bakesFor(day, m?.cake).map((b) => {
    const r = food.recipe(b.recipe);
    if (!r) return null;
    const left = b.parts - plan.bakeUsed(b.id) + (m?.cake === b.id ? plan.cakeParts(m) : 0);
    const st = food.recipeStats(r);
    const f = (r.serves || 1) / b.parts;
    return { b, r, left, kcal: st.kcal * f, p: st.p * f, c: st.c * f, f: st.f * f, cost: st.cost * f };
  }).filter(Boolean);
}

function cakeBlock(lots, sel) {
  if (!lots.length) return '';
  return `<p class="group-title cake-title">Gâteau de la semaine</p><div class="mrows">${lots.map((x) => {
    const n = sel.id === x.b.id ? sel.n : 0;
    return `<div class="mrow ${n ? 'is-on' : ''}"><span class="mrow-name">${esc(x.r.name)}<small>${calc.fmt0(x.kcal)} kcal la part, ${x.left - n ? `encore ${food.fmtCount(x.left - n)} part${x.left - n > 1 ? 's' : ''} après` : 'plus aucune part après'}</small></span>
      <span class="mstep"><button type="button" class="icon-btn small" data-cake-step="${esc(x.b.id)}" data-dir="-1" aria-label="Une part de moins" ${n ? '' : 'disabled'}>−</button><b>${n ? `${food.fmtCount(n)} part${n > 1 ? 's' : ''}` : 'Aucune'}</b><button type="button" class="icon-btn small" data-cake-step="${esc(x.b.id)}" data-dir="1" aria-label="Une part de plus" ${n >= x.left ? 'disabled' : ''}>+</button></span></div>`;
  }).join('')}</div>`;
}

function cakeClick(e, sel, lots) {
  const c = e.target.closest('[data-cake-step]');
  if (!c) return false;
  const x = lots.find((l) => l.b.id === c.dataset.cakeStep);
  if (!x) return true;
  const cur = sel.id === x.b.id ? sel.n : 0;
  const n = Math.max(0, Math.min(x.left, cur + Number(c.dataset.dir)));
  sel.id = n ? x.b.id : null;
  sel.n = n;
  return true;
}

function cakeStats(lots, sel) {
  const x = sel.id && lots.find((l) => l.b.id === sel.id);
  return x ? { name: `${x.r.name}, ${sel.n === 1 ? 'une part' : `${food.fmtCount(sel.n)} parts`}`, kcal: x.kcal * sel.n, p: x.p * sel.n, c: x.c * sel.n, f: x.f * sel.n, cost: x.cost * sel.n } : null;
}

// Total affiché : aliments à l'œil + parts de gâteau
function freeTotal(chosen, lots, sel) {
  const list = [...chosen];
  const st = food.sumOf(list);
  const ck = cakeStats(lots, sel);
  const names = [...(ck ? [ck.name] : []), ...list.map(([id, q]) => portions.itemLabel(id, q))];
  if (ck) for (const k of ['kcal', 'p', 'c', 'f', 'cost']) st[k] += ck[k];
  if (!names.length) return { html: '<span class="fine">Rien de choisi pour l’instant.</span>', empty: true };
  return { html: `<span class="compo-name">${esc(names.join(', ').replace(/^./, (c) => c.toUpperCase()))}</span><span class="compo-figs">${macros(st)} ${priceTag(st.cost)}</span>`, empty: false };
}

export function dessertSheet(day, slot) {
  const m = plan.getMeal(day, slot);
  const s = calc.settings();
  const chosen = new Map(m?.dessertParts || []);
  const simple = food.recipes().filter((r) => r.cat === 'dessert' && !food.isLot(r) && food.usable(r, s))
    .sort((a, b) => food.recipeStats(a).kcal - food.recipeStats(b).kcal);
  const lots = cakeLots(day, m);
  const sel = { id: m?.cake || null, n: plan.cakeParts(m) };
  // Suggestions : les classiques, plus ce que tu as déjà pris en dessert ou en craquage
  const suggest = [...new Set([...portions.DESSERT_ORDER, ...recentFree()])];
  const extra = `<button type="button" class="chip chip-add" data-other>${icon('add')} Autre aliment</button><button type="button" class="chip chip-add is-crack" data-crack>${icon('spark')} Craquage</button>`;
  const ui = {};
  return openSheet({
    title: 'Dessert',
    wide: true,
    body: `<section class="free-dessert">
        <h3 class="group-title">Mon dessert</h3>
        <p class="field-help">Touche ce que tu prends, règle la quantité avec − et +. « Craquage » cherche un produit du commerce (biscuits, barre, glace…) sur Open Food Facts.</p>
        <div data-cake-box></div>
        <div data-eye-box></div>
        <div class="compo-total" data-total></div>
        <button type="button" class="btn primary block" data-save-free>Valider ce dessert</button>
      </section>
      <h3 class="group-title">Ou une recette de dessert</h3>
      <button type="button" class="btn block" data-suggest>${icon('shuffle')} Me proposer un dessert</button>
      <div class="list">${simple.map((r) => dessertRow(r, { on: m?.dessert === r.id, attr: `data-dessert="${esc(r.id)}"` })).join('')}</div>
      ${m?.dessert || m?.cake || m?.dessertParts ? '<button type="button" class="btn ghost block" data-none>Pas de dessert</button>' : ''}`,
    onMount(el, api) {
      const draw = () => {
        el.querySelector('[data-cake-box]').innerHTML = cakeBlock(lots, sel);
        el.querySelector('[data-eye-box]').innerHTML = eyeball({ suggest, ctx: 'dessert', chosen, extra, favKey: 'dessert', ui });
        const t = freeTotal(chosen, lots, sel);
        el.querySelector('[data-total]').innerHTML = t.html;
        el.querySelector('[data-save-free]').disabled = t.empty;
      };
      el.addEventListener('click', async (e) => {
        if (cakeClick(e, sel, lots)) return draw();
        if (eyeballClick(e, chosen, 'dessert', { favKey: 'dessert', ui })) return draw();
        if (e.target.closest('[data-other]')) {
          const id = await pickIngredient({ title: 'Dessert' });
          if (id && !chosen.has(id)) chosen.set(id, portions.defaultQty(id, 'dessert'));
          favs.add('dessert', id);
          return draw();
        }
        if (e.target.closest('[data-crack]')) {
          const res = await productSheet({ title: 'Craquage', recent: recentFree() });
          if (res) {
            chosen.set(res.id, (chosen.get(res.id) || 0) + res.qty);
            favs.add('dessert', res.id);
          }
          return draw();
        }
        if (e.target.closest('[data-save-free]')) {
          plan.setDessert(day, slot, { parts: [...chosen], cake: sel.id, cakeN: sel.n || 1 });
          return api.close(true);
        }
        if (e.target.closest('[data-suggest]')) {
          const r = plan.suggestDessert(day, slot);
          if (r) {
            plan.setDessert(day, slot, { dessert: r.id });
            toast(`Dessert : ${r.name}`);
          }
          return api.close(true);
        }
        const d = e.target.closest('[data-dessert]');
        if (d) {
          plan.setDessert(day, slot, { dessert: d.dataset.dessert });
          return api.close(true);
        }
        const c = e.target.closest('[data-cake]');
        if (c) {
          plan.setDessert(day, slot, { cake: c.dataset.cake });
          return api.close(true);
        }
        if (e.target.closest('[data-none]')) {
          plan.setDessert(day, slot, {});
          api.close(true);
        }
      });
      draw();
    },
  });
}

// Aliments perso déjà pris en dessert ou en craquage, du plus récent au plus ancien
export function recentFree(max = 8) {
  const seen = [];
  const add = (id) => { if (!seen.includes(id) && food.ingredient(id)?.custom) seen.push(id); };
  for (const r of store.all('weight').sort((a, b) => b.id.localeCompare(a.id))) for (const [id] of r.data.snacks || []) add(id);
  for (const r of store.all('meal').sort((a, b) => b.id.localeCompare(a.id))) for (const [id] of r.data.dessertParts || []) add(id);
  return seen.slice(0, max);
}

// Dessert de la semaine : préparé une fois, mangé en parts.
export async function bakeSheet(r, ctx, { day = null } = {}) {
  const res = await openSheet({
    title: r.name,
    body: `<form class="form" data-form>
      <p>Préparé une fois, mangé en parts dans la semaine. Les ingrédients passent une seule fois dans les courses, le prix et les calories sont comptés par part.</p>
      ${whenFields(['soir'], { past: 7, day, label: 'Préparé (ou à préparer) le' })}
      <label class="field"><span>Nombre de parts</span><input name="parts" inputmode="numeric" value="${esc(r.serves)}"></label>
      <p class="field-help">Aucune part n’est placée d’office : tu les prends quand tu veux, au petit-déj, en collation ou en dessert, jusqu’à épuisement.</p>
    </form>`,
    actions: [
      { label: 'Annuler', value: null },
      { label: 'Ajouter', kind: 'primary', handler: (el) => formData(el) },
    ],
  });
  if (!res) return false;
  const parts = Math.max(1, Math.min(30, Math.round(calc.parseNum(res.parts) || r.serves)));
  plan.addBake(r.id, res.day, parts);
  toast(`${r.name} ajouté, ${parts} parts.`, { action: 'Voir', onAction: () => ctx.go(`/semaine/${calc.weekStart(res.day)}`) });
  return true;
}

// ---------- Actions sur un créneau ----------
export async function mealActions(day, slot, ctx) {
  const m = plan.getMeal(day, slot);
  const s = calc.settings();
  const label = `${plan.SLOT_LABELS[slot]}, ${calc.relDay(day).toLowerCase()}`;
  const main = slot === 'midi' || slot === 'soir';
  // Petit-déj ou collation vide : on compose directement ce qu'on prend
  if (!main && !m) {
    const r = await freeMealSheet(day, slot);
    if (r !== 'more') return;
  }
  const plate = main && m && (m.kind === 'compo' || (m.kind === 'reste' && !m.recipe));
  const items = [];
  if (!main) items.push({ label: m && m.kind === 'compo' ? `Modifier ${slot === 'petitdej' ? 'mon petit-déj' : 'ma collation'}` : `Composer ${slot === 'petitdej' ? 'mon petit-déj' : 'ma collation'}`, value: 'free', icon: 'edit' });
  if (m && (m.kind === 'recette' || m.kind === 'reste') && food.recipe(m.recipe)) {
    items.push({ label: 'Voir la recette', value: 'open', icon: 'recettes' });
  }
  if (plate) items.push({ label: 'Comment la préparer', value: 'prep', icon: 'pot' });
  if (m && m.kind === 'recette' && food.recipe(m.recipe)?.steps.length) items.push({ label: 'Cuisiner maintenant', value: 'cook', icon: 'pot' });
  if (plan.isCooked(m) && (main || m.kind === 'recette')) items.push({ label: m.done ? 'Annuler « cuisiné »' : 'Marquer comme cuisiné', value: 'done', icon: 'check' });
  if (slot === 'midi' && !(m && m.kind === 'reste')) {
    const prev = plan.getMeal(calc.addDays(day, -1), 'soir');
    if (plan.isCooked(prev)) items.push({ label: `Gamelle : ${plan.mealTitle(prev)}`, value: 'leftover', icon: 'box' });
  }
  if (main && m && m.kind === 'compo') items.push({ label: 'Modifier l’assiette', value: 'compo', icon: 'edit' });
  items.push({ label: m ? 'Choisir une autre recette' : 'Choisir une recette', value: 'pick', icon: 'search' });
  if (main && !(m && m.kind === 'compo')) items.push({ label: 'Composer une assiette', value: 'compo', icon: 'fork' });
  if (main) items.push({ label: 'Avec ce que j’ai', value: 'what', icon: 'box' });
  items.push({ label: 'Me proposer une recette', value: 'suggest', icon: 'shuffle' });
  if (m && main) items.push({ label: m.dessert || m.cake ? 'Changer le dessert' : 'Ajouter un dessert', value: 'dessert', icon: 'add' });
  if (m && (plan.isCooked(m) || m.kind === 'reste') && (main || m.kind === 'recette')) items.push({ label: 'Portions', value: 'portions', icon: 'sliders' });
  items.push({ label: 'Commande (Uber Eats…)', value: 'uber', icon: 'bike' });
  items.push({ label: 'Repas libre (resto, invité…)', value: 'libre', icon: 'fork' });
  if (m) items.push({ label: 'Retirer ce repas', value: 'remove', icon: 'trash', danger: true });

  const choice = await menuSheet(label, items);
  if (!choice) return;
  switch (choice) {
    case 'open': ctx.go(`/recettes/${m.recipe}`); break;
    case 'prep': await prepSheet(m, ctx); break;
    case 'cook': ctx.go(`/cuisine/${m.recipe}?p=${m.cooked ?? 1}&meal=${encodeURIComponent(m.id)}${m.mc ? '&mc=1' : ''}`); break;
    case 'done':
      plan.setDone(m, !m.done);
      toast(m.done ? 'Repas remis « à cuisiner ».' : 'Cuisiné. Les réserves ont été mises à jour.');
      break;
    case 'pick': {
      const cat = slot === 'petitdej' ? 'petitdej' : slot === 'collation' ? 'collation' : 'diner';
      const id = await pickRecipe({ cat, cats: main ? ['diner'] : [cat] });
      if (id) {
        plan.setMeal(day, slot, { kind: 'recette', recipe: id, portions: 1, mc: s.preferMc && !!food.recipe(id)?.mc });
        offerLeftover(day, slot, ctx);
      }
      break;
    }
    case 'compo': {
      const res = await compoSheet({ day, slot, cur: m && m.kind === 'compo' ? m : null });
      if (res) offerLeftover(day, slot, ctx);
      break;
    }
    case 'what': ctx.go(`/quoi?day=${day}&slot=${slot}`); break;
    case 'free': {
      const r = await freeMealSheet(day, slot);
      if (r === 'more') return mealActions(day, slot, ctx);
      break;
    }
    case 'suggest': {
      const r = plan.suggest(day, slot, { exclude: m?.recipe ? [m.recipe] : [] });
      if (r) {
        plan.setMeal(day, slot, { kind: 'recette', recipe: r.id, portions: 1, mc: s.preferMc && !!r.mc });
        toast(`Proposé : ${r.name}`);
        offerLeftover(day, slot, ctx);
      } else toast('Aucune autre recette ne convient à tes réglages.');
      break;
    }
    case 'leftover': plan.keepLeftover(day); break;
    case 'dessert': await dessertSheet(day, slot); break;
    case 'portions': await portionsSheet(m); break;
    case 'uber':
    case 'libre': await outsideSheet(day, slot, choice, m && m.kind === choice ? m : null); break;
    case 'remove': plan.removeMeal(day, slot); break;
    default: break;
  }
}

// ---------- Petit-déj et collation libres ----------
// Comme le dessert : on touche ce qu'on prend, en mesures à l'œil. Enregistré comme une
// petite assiette composée (cuisinée en une portion). Les recettes restent proposées dessous.
export async function freeMealSheet(day, slot) {
  const m = plan.getMeal(day, slot);
  const s = calc.settings();
  const cur = m && m.kind === 'compo' ? m : null;
  const chosen = new Map(cur?.parts || []);
  const lots = cakeLots(day, cur);
  const sel = { id: cur?.cake || null, n: plan.cakeParts(cur) };
  const isBreak = slot === 'petitdej';
  const what = isBreak ? 'petit-déj' : 'collation';
  const suggest = [...(isBreak ? portions.BREAKFAST_ORDER : portions.SNACK_ORDER), ...recentFree()];
  const recipes = food.recipes().filter((r) => r.cat === slot && food.usable(r, s)).sort((a, b) => food.recipeStats(a).kcal - food.recipeStats(b).kcal);
  const extra = `<button type="button" class="chip chip-add" data-other>${icon('add')} Autre aliment</button><button type="button" class="chip chip-add" data-product>${icon('search')} Produit du commerce</button>`;
  const ui = {};
  const res = await openSheet({
    title: `${isBreak ? 'Petit-déj' : 'Collation'}, ${calc.relDay(day).toLowerCase()}`,
    wide: true,
    body: `<section class="free-dessert free-meal">
        <h3 class="group-title">${isBreak ? 'Mon petit-déj' : 'Ma collation'}</h3>
        <p class="field-help">Touche ce que tu prends, règle la quantité avec − et +. Ce que tu ajoutes toi-même reste proposé la prochaine fois.</p>
        <div data-cake-box></div>
        <div data-eye-box></div>
        <div class="compo-total" data-total></div>
        <button type="button" class="btn primary block" data-save-free>Valider ${isBreak ? 'ce petit-déj' : 'cette collation'}</button>
      </section>
      ${recipes.length ? `<h3 class="group-title">Ou une recette</h3><div class="list">${recipes.map((r) => dessertRow(r, { on: m?.recipe === r.id, attr: `data-recipe="${esc(r.id)}"` })).join('')}</div>` : ''}
      <button type="button" class="link-btn" data-more>Autres options (commande, repas libre…)</button>`,
    onMount(el, api) {
      const draw = () => {
        el.querySelector('[data-cake-box]').innerHTML = cakeBlock(lots, sel);
        el.querySelector('[data-eye-box]').innerHTML = eyeball({ suggest, ctx: 'dessert', chosen, extra, favKey: slot, ui });
        const t = freeTotal(chosen, lots, sel);
        el.querySelector('[data-total]').innerHTML = t.html;
        el.querySelector('[data-save-free]').disabled = t.empty;
      };
      el.addEventListener('click', async (e) => {
        if (cakeClick(e, sel, lots)) return draw();
        if (eyeballClick(e, chosen, 'dessert', { favKey: slot, ui })) return draw();
        if (e.target.closest('[data-other]')) {
          const id = await pickIngredient({ title: isBreak ? 'Petit-déj' : 'Collation' });
          if (id) {
            if (!chosen.has(id)) chosen.set(id, portions.defaultQty(id, 'dessert'));
            favs.add(slot, id);
          }
          return draw();
        }
        if (e.target.closest('[data-product]')) {
          const r = await productSheet({ title: 'Produit du commerce', recent: recentFree() });
          if (r) {
            chosen.set(r.id, (chosen.get(r.id) || 0) + r.qty);
            favs.add(slot, r.id);
          }
          return draw();
        }
        if (e.target.closest('[data-save-free]')) return api.close({ parts: [...chosen] });
        const rc = e.target.closest('[data-recipe]');
        if (rc) return api.close({ recipe: rc.dataset.recipe });
        if (e.target.closest('[data-more]')) api.close({ more: true });
      });
      draw();
    },
  });
  if (!res) return null;
  if (res.more) return 'more';
  if (res.recipe) {
    plan.setMeal(day, slot, { kind: 'recette', recipe: res.recipe, portions: 1 });
    return true;
  }
  if (res.parts.length > 10) toast('10 éléments au plus : les derniers ont été retirés.', { kind: 'error' });
  plan.setMeal(day, slot, { kind: 'compo', parts: res.parts.slice(0, 10), portions: 1, cooked: 1, cake: sel.id || undefined, cakeN: sel.id && sel.n !== 1 ? sel.n : undefined });
  toast(`${isBreak ? 'Petit-déj' : 'Collation'} enregistré${isBreak ? '' : 'e'}.`);
  return true;
}

// Ajouter une recette au planning depuis sa fiche
export async function addToPlan(r, ctx) {
  if (food.isLot(r)) return bakeSheet(r, ctx);
  if (r.cat === 'sauce') {
    const res = await compoSheet({ sauce: r.id });
    if (res) {
      toast(`Assiette ajoutée : ${plan.SLOT_LABELS[res.slot].toLowerCase()}, ${calc.relDay(res.day).toLowerCase()}.`, {
        action: 'Voir', onAction: () => ctx.go(`/semaine/${calc.weekStart(res.day)}`),
      });
    }
    return;
  }
  const isDessert = r.cat === 'dessert';
  const slots = isDessert ? ['soir', 'midi'] : r.cat === 'petitdej' ? ['petitdej'] : r.cat === 'collation' ? ['collation'] : ['soir', 'midi'];
  const res = await openSheet({
    title: isDessert ? 'Ajouter en dessert' : 'Ajouter au planning',
    body: `<form class="form" data-form>
      ${whenFields(slots, { help: isDessert ? 'Le dessert s’ajoute au repas déjà prévu à ce moment-là.' : r.cat === 'diner' ? 'Le soir, la recette est prévue en 2 portions. Gamelle te propose ensuite de garder la seconde pour le lendemain midi.' : '' })}
    </form>`,
    actions: [
      { label: 'Annuler', value: null },
      { label: 'Ajouter', kind: 'primary', handler: (el) => formData(el) },
    ],
  });
  if (!res) return;
  const cur = plan.getMeal(res.day, res.slot);
  if (isDessert) {
    if (!cur) {
      toast('Aucun repas prévu à ce moment-là. Prévois d’abord le repas, puis ajoute le dessert.', { kind: 'error', duration: 5000 });
      return;
    }
    plan.setDessert(res.day, res.slot, { dessert: r.id });
  } else {
    plan.setMeal(res.day, res.slot, { kind: 'recette', recipe: r.id, portions: 1, mc: calc.settings().preferMc && !!r.mc });
  }
  toast(`${isDessert ? 'Dessert ajouté' : cur ? 'Remplacé' : 'Ajouté'} : ${plan.SLOT_LABELS[res.slot].toLowerCase()}, ${calc.relDay(res.day).toLowerCase()}.`, {
    action: 'Voir', onAction: () => ctx.go(`/semaine/${calc.weekStart(res.day)}`),
  });
  if (!isDessert) setTimeout(() => offerLeftover(res.day, res.slot, ctx), 400);
}

export function emptyIcon(name) {
  return `<span class="empty-icon">${icon(name)}</span>`;
}
