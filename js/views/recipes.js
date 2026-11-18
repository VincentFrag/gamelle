// Écrans « Recettes » : liste, fiche (portions, ingrédients, étapes), création et modification.
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as food from '../food.js';
import { esc, icon, openSheet, menuSheet, confirmSheet, toast, formData } from '../ui.js';
import { priceTag, recipeRow, addToPlan, styleTag, myCakeSheet } from './common.js';
import { EQUIP, STYLES, RAYONS, UNITS } from '../clean.js';

const FILTERS = [
  ['plats', 'Plats'],
  ['budget', 'Petit budget'],
  ['equilibre', 'Équilibrés'],
  ['leger', 'Légers'],
  ['plaisir', 'Versions maison'],
  ['sauce', 'Sauces'],
  ['dessert', 'Desserts'],
  ['lot', 'Gâteaux de la semaine'],
  ['petitdej', 'Petits-déj'],
  ['collation', 'Collations'],
  ['mc', 'Monsieur Cuisine'],
  ['rapide', '25 min max'],
  ['vege', 'Végétarien'],
  ['congel', 'Se congèle'],
  ['perso', 'Mes recettes'],
];

const state = { filter: 'plats', q: '' };

function matches(r, f) {
  switch (f) {
    case 'plats': return r.cat === 'diner';
    case 'budget': return r.cat === 'diner' && r.style !== 'plaisir' && (food.recipeStats(r).cost <= 2.3 || (r.tags || []).includes('budget'));
    case 'equilibre': case 'leger': case 'plaisir': return r.cat === 'diner' && r.style === f;
    case 'petitdej': case 'collation': case 'sauce': return r.cat === f;
    case 'dessert': return r.cat === 'dessert' && !food.isLot(r);
    case 'lot': return food.isLot(r);
    case 'mc': return Boolean(r.mc) || (r.equip || []).includes('mc');
    case 'rapide': return r.time <= 25;
    case 'vege': return (r.tags || []).includes('vege') || (r.cat !== 'diner' && !r.ing.some(([id]) => ['viandes'].includes(food.ingredient(id)?.rayon)));
    case 'congel': return Boolean(r.freeze);
    case 'perso': return !r.base;
    default: return true;
  }
}

export function renderRecipes(view, ctx) {
  view.innerHTML = `
    ${ctx.pageHead('Recettes', { actions: `<a class="icon-btn" href="#/recettes/nouvelle" aria-label="Nouvelle recette">${icon('add')}</a>` })}
    <label class="search page-search"><span class="sr-only">Rechercher</span>${icon('search')}<input type="search" placeholder="Recette ou ingrédient" value="${esc(state.q)}" data-q autocomplete="off"></label>
    <div class="chips scroll" role="group" aria-label="Filtres">
      ${FILTERS.map(([k, l]) => `<button class="chip ${state.filter === k ? 'is-on' : ''}" data-f="${k}">${esc(l)}</button>`).join('')}
      <a class="chip chip-link" href="#/aliments">${icon('add')} Aliments</a>
    </div>
    <div data-list></div>`;

  const draw = () => {
    const nq = food.norm(state.q);
    const list = food.recipes()
      .filter((r) => matches(r, state.filter))
      .filter((r) => !nq || food.norm(r.name).includes(nq) || r.ing.some(([id]) => food.norm(food.ingredient(id)?.name).includes(nq)))
      .sort((a, b) => (state.filter === 'budget' ? food.recipeStats(a).cost - food.recipeStats(b).cost : 0) || a.name.localeCompare(b.name, 'fr'));
    const hint = {
      budget: 'Plats équilibrés autour de 1,50 à 2 € la portion, du moins cher au plus cher. Pour une fin de mois difficile, active aussi « Petit budget » (bouton des propositions de la Semaine) : Gamelle les choisira pour toi.', plaisir: 'Tes commandes habituelles, faites maison. Gamelle en glisse au plus une par semaine dans ses propositions (réglable).', sauce: 'Pour relever un plat simple : pâtes ou riz, une protéine, un légume. Le bouton « Ajouter au planning » compose l’assiette.', lot: 'Préparés une fois, mangés en parts dans la semaine. Prix et valeurs par part.', dessert: 'À ajouter à un repas en deux gestes, depuis l’écran Semaine.' }[state.filter];
    view.querySelector('[data-list]').innerHTML = list.length
      ? `${hint ? `<p class="block-sub">${esc(hint)}</p>` : ''}${state.filter === 'lot' ? `<button class="btn primary add-top" data-my-cake>${icon('add')} Créer mon gâteau</button>` : ''}<p class="list-count">${list.length} recette${list.length > 1 ? 's' : ''}, prix et valeurs ${state.filter === 'lot' ? 'par part' : 'par portion'}</p><div class="list">${list.map((r) => recipeRow(r)).join('')}</div>`
      : `<p class="empty">${state.filter === 'perso' && !nq ? 'Tu n’as pas encore créé de recette. Le bouton + en haut permet d’en ajouter une, ou de partir d’une recette existante avec « Dupliquer ».' : 'Aucune recette ne correspond.'}</p>`;
  };
  view.querySelector('[data-q]').addEventListener('input', (e) => { state.q = e.target.value; draw(); });
  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-my-cake]')) {
      const id = await myCakeSheet();
      if (id) {
        draw();
        await addToPlan(food.recipe(id), ctx);
      }
      return;
    }
    const c = e.target.closest('[data-f]');
    if (!c) return;
    state.filter = c.dataset.f;
    view.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('is-on', b === c));
    draw();
  });
  draw();
}

// ---------- Fiche ----------
export function stepsHtml(steps, label) {
  return `<ol class="steps">${steps.map((st, i) => `<li><span class="step-n">${i + 1}</span><span class="step-t">${esc(st.t)}</span>${st.s ? `<button class="timer-chip" data-timer="${st.s}" data-label="${esc(label)}">${icon('timer')} ${esc(calc.fmtMinutes(st.s))}</button>` : ''}</li>`).join('')}</ol>`;
}

export function renderRecipe(view, ctx, id) {
  const r = food.recipe(id);
  if (!r) {
    view.innerHTML = `${ctx.pageHead('Recette', { back: '/recettes' })}<p class="empty">Cette recette n’existe plus.</p>`;
    return;
  }
  const s = calc.settings();
  let portions = Number(ctx.query.p) || r.serves;
  let useMc = Boolean(r.mc) && (ctx.query.mc === '1' || s.preferMc);

  const draw = () => {
    const st = food.recipeStats(r);
    const factor = portions / r.serves;
    const lot = food.isLot(r);
    const unit = lot ? 'la part' : 'la portion';
    const pw = (n) => (lot ? `part${n > 1 ? 's' : ''}` : `portion${n > 1 ? 's' : ''}`);
    const steps = useMc && r.mc ? r.mc : r.steps;
    const missingEquip = (r.equip || []).filter((e) => e !== 'mc' && s.equip[e] === false);
    view.innerHTML = `
      ${ctx.pageHead(r.name, { back: '/recettes', actions: `<button class="icon-btn" data-menu aria-label="Plus d’actions">${icon('more')}</button>` })}
      <div class="recipe-head">
        <div class="recipe-tags">${r.cat === 'diner' ? styleTag(r) : `<span class="tag">${esc(food.CAT_LABELS[r.cat])}</span>`}${r.time ? `<span class="tag">${r.time} min</span>` : ''}${(r.equip || []).filter((e) => e !== 'mc').map((e) => `<span class="tag">${esc(food.EQUIP_LABELS[e])}</span>`).join('')}${r.freeze ? `<span class="tag">${icon('snow')} Se congèle</span>` : ''}${r.gamelle === false ? '<span class="tag">À assembler au moment de manger</span>' : ''}</div>
        <div class="recipe-price">${priceTag(st.cost, { big: true })}<span>${unit}</span></div>
      </div>
      ${missingEquip.length ? `<p class="banner warn">Cette recette demande : ${esc(missingEquip.map((e) => food.EQUIP_LABELS[e].toLowerCase()).join(', '))}, que tu as désactivé dans tes réglages.</p>` : ''}
      <div class="figures compact">
        <div class="figure"><span class="fig-value">${calc.fmt0(st.kcal)}<small>kcal</small></span><span class="fig-label">${food.isLot(r) ? 'par part' : 'par portion'}</span></div>
        <div class="figure"><span class="fig-value">${calc.fmt0(st.p)}<small>g</small></span><span class="fig-label">protéines</span></div>
        <div class="figure"><span class="fig-value">${calc.fmt0(st.c)}<small>g</small></span><span class="fig-label">glucides</span></div>
        <div class="figure"><span class="fig-value">${calc.fmt0(st.f)}<small>g</small></span><span class="fig-label">lipides</span></div>
      </div>
      <div class="recipe-grid">
        <section class="block">
          <div class="block-head">
            <h2 class="block-title">Ingrédients</h2>
            <div class="stepper" role="group" aria-label="Portions">
              <button class="icon-btn" data-portions="-1" aria-label="Une portion de moins" ${portions <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
              <span><b>${portions}</b> ${pw(portions)}</span>
              <button class="icon-btn" data-portions="1" aria-label="Une portion de plus">${icon('add')}</button>
            </div>
          </div>
          <ul class="ing-list">${r.ing.map(([iid, q]) => {
            const l = food.ingLine(iid, q * factor);
            return `<li><span class="ing-qty">${esc(l.qty)}</span><span class="ing-name">${esc(l.name)}${l.ing?.staple ? ' <small>placard</small>' : ''}</span></li>`;
          }).join('')}</ul>
          <p class="fine">Sel, poivre et eau en plus. Coût total pour ${portions} ${pw(portions)} : ${esc(calc.fmtEur(st.cost * portions))}.</p>
        </section>
        <section class="block">
          <div class="block-head">
            <h2 class="block-title">Étapes</h2>
            ${r.mc ? `<div class="seg" role="radiogroup" aria-label="Méthode">
              <button role="radio" aria-checked="${!useMc}" data-mc="0">Classique</button>
              <button role="radio" aria-checked="${useMc}" data-mc="1">Monsieur Cuisine</button>
            </div>` : ''}
          </div>
          ${useMc ? '<p class="block-sub">Réglages pour un Monsieur Cuisine Smart ou Connect. Les quantités sont prévues pour 2 portions : au-delà, vérifie la capacité du bol.</p>' : ''}
          ${steps.length ? stepsHtml(steps, r.name) : '<p class="empty">Pas d’étapes pour cette recette.</p>'}
          ${r.tip ? `<p class="hint-text">${esc(r.tip)}</p>` : ''}
        </section>
      </div>
      <div class="sticky-actions">
        ${steps.length ? `<a class="btn primary" href="#/cuisine/${esc(r.id)}?p=${portions}${useMc ? '&mc=1' : ''}">${icon('pot')} Cuisiner</a>` : ''}
        <button class="btn" data-plan>${icon('semaine')} ${r.cat === 'sauce' ? 'Composer une assiette' : r.cat === 'dessert' && !lot ? 'Ajouter en dessert' : lot ? 'Prévoir cette semaine' : 'Ajouter au planning'}</button>
      </div>
      ${st.missing.length ? `<p class="error-text">Ingrédients introuvables dans la base : ${esc(st.missing.join(', '))}. Les totaux sont incomplets.</p>` : ''}
      <p class="fine">Valeurs calculées à partir des ingrédients crus (table Ciqual de l’Anses) et prix moyens estimés, que tu peux ajuster dans Plus, Prix des ingrédients. Ce sont des ordres de grandeur.</p>`;
  };

  view.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-portions]');
    if (p) {
      portions = Math.max(1, Math.min(12, portions + Number(p.dataset.portions)));
      return draw();
    }
    const m = e.target.closest('[data-mc]');
    if (m) {
      useMc = m.dataset.mc === '1';
      return draw();
    }
    const tm = e.target.closest('[data-timer]');
    if (tm) {
      ctx.timers.start(Number(tm.dataset.timer), tm.dataset.label);
      return;
    }
    if (e.target.closest('[data-plan]')) return addToPlan(r, ctx);
    if (e.target.closest('[data-menu]')) {
      const items = r.base
        ? [{ label: 'Dupliquer pour la modifier', value: 'dup', icon: 'copy' }]
        : [{ label: 'Modifier', value: 'edit', icon: 'edit' }, { label: 'Dupliquer', value: 'dup', icon: 'copy' }, { label: 'Supprimer', value: 'del', icon: 'trash', danger: true }];
      const c = await menuSheet(r.name, items);
      if (c === 'edit') ctx.go(`/recettes/${r.id}/modifier`);
      if (c === 'dup') {
        const nid = store.uuid();
        const { id: _i, base: _b, mc: _m, ...data } = r;
        store.put('recipe', nid, { ...data, name: `${r.name} (ma version)` });
        ctx.go(`/recettes/${nid}/modifier`);
      }
      if (c === 'del' && await confirmSheet('Supprimer la recette ?', 'Les repas déjà planifiés avec cette recette n’auront plus de détail.', { ok: 'Supprimer', danger: true })) {
        store.remove('recipe', r.id);
        toast('Recette supprimée.');
        ctx.go('/recettes');
      }
    }
  });
  draw();
}

// ---------- Création et modification ----------
function parseSteps(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((t) => {
    const m = t.match(/(\d+)\s*min/i);
    return m ? { t, s: Number(m[1]) * 60 } : { t };
  });
}

// Choix et création d'aliments : voir aliments.js (ajout depuis Open Food Facts).
export { pickIngredient, editIngredient } from './aliments.js';
import { pickIngredient } from './aliments.js';

export function renderRecipeEdit(view, ctx, id) {
  const existing = id ? food.recipe(id) : null;
  if (existing && existing.base) {
    ctx.go(`/recettes/${id}`);
    return;
  }
  const r = existing ? JSON.parse(JSON.stringify(existing)) : { name: '', cat: 'diner', style: 'equilibre', time: 30, serves: 2, equip: ['plaques'], ing: [], steps: [], gamelle: true };
  const rid = id || store.uuid();

  const draw = () => {
    view.innerHTML = `
      ${ctx.pageHead(existing ? 'Modifier la recette' : 'Nouvelle recette', { back: existing ? `/recettes/${rid}` : '/recettes' })}
      <form class="form edit-form" data-form>
        <label class="field big"><span>Nom</span><input name="name" maxlength="80" value="${esc(r.name)}" required placeholder="Ex. : gratin de courgettes"></label>
        <div class="field-row">
          <label class="field"><span>Type</span><select name="cat">${Object.entries(food.CAT_LABELS).map(([k, l]) => `<option value="${k}" ${r.cat === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <label class="field"><span>Style</span><select name="style">${STYLES.map((k) => `<option value="${k}" ${r.style === k ? 'selected' : ''}>${esc(food.STYLE_LABELS[k])}</option>`).join('')}</select></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Durée totale (min)</span><input name="time" inputmode="numeric" value="${esc(r.time)}"></label>
          <label class="field"><span>${(r.tags || []).includes('lot') ? 'Nombre de parts' : 'Portions'}</span><input name="serves" inputmode="numeric" value="${esc(r.serves)}"></label>
        </div>
        <fieldset class="field"><legend>Matériel</legend><div class="checks">
          ${EQUIP.map((e) => `<label class="switch"><input type="checkbox" name="eq-${e}" ${(r.equip || []).includes(e) ? 'checked' : ''}><span>${esc(food.EQUIP_LABELS[e])}</span></label>`).join('')}
        </div></fieldset>
        <label class="switch"><input type="checkbox" name="freeze" ${r.freeze ? 'checked' : ''}><span>Se congèle bien</span></label>
        <label class="switch"><input type="checkbox" name="gamelle" ${r.gamelle !== false ? 'checked' : ''}><span>Se garde pour la gamelle du lendemain</span></label>
        <label class="switch"><input type="checkbox" name="lot" ${(r.tags || []).includes('lot') ? 'checked' : ''}><span>Dessert de la semaine<small>Pour un gâteau ou un dessert préparé une fois et mangé en parts. Les portions deviennent des parts.</small></span></label>

        <h2 class="block-title">Ingrédients <small>${(r.tags || []).includes('lot') ? 'pour tout le gâteau' : `pour ${esc(r.serves)} portions`}</small></h2>
        <div class="ing-edit">${r.ing.map(([iid, q], i) => {
          const ing = food.ingredient(iid);
          return `<div class="ing-row"><span class="ing-row-name">${esc(ing?.name || iid)}</span>
            <label class="ing-row-qty"><span class="sr-only">Quantité</span><input inputmode="decimal" data-qty="${i}" value="${esc(calc.numInput(q))}"><span>${ing?.unit === 'pc' ? 'pièce(s)' : ing?.unit || ''}</span></label>
            <button type="button" class="icon-btn" data-del-ing="${i}" aria-label="Retirer ${esc(ing?.name || '')}">${icon('trash')}</button></div>`;
        }).join('')}</div>
        <button type="button" class="btn ghost" data-add-ing>${icon('add')} Ajouter un ingrédient</button>

        <label class="field"><span>Étapes, une par ligne</span><textarea name="steps" rows="8" placeholder="Fais revenir l’oignon 5 min.">${esc(r.steps.map((st) => st.t).join('\n'))}</textarea></label>
        <p class="field-help">Une durée écrite dans l’étape (par ex. « 12 min ») ajoute un minuteur.</p>
        <div class="row-actions"><button class="btn primary" type="submit">Enregistrer</button></div>
      </form>`;
  };

  const readForm = () => {
    const f = formData(view);
    r.name = f.name.trim();
    r.cat = f.cat;
    r.style = f.style;
    r.time = calc.parseNum(f.time) || 30;
    r.serves = Math.max(1, Math.round(calc.parseNum(f.serves) || 2));
    r.equip = EQUIP.filter((e) => f[`eq-${e}`]);
    r.freeze = f.freeze;
    r.gamelle = f.gamelle;
    const tags = (r.tags || []).filter((t) => t !== 'lot');
    r.tags = f.lot && f.cat === 'dessert' ? [...tags, 'lot'] : tags;
    r.steps = parseSteps(f.steps);
    view.querySelectorAll('[data-qty]').forEach((inp) => {
      const n = calc.parseNum(inp.value);
      if (n != null) r.ing[Number(inp.dataset.qty)][1] = n;
    });
  };

  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add-ing]')) {
      readForm();
      const iid = await pickIngredient();
      if (iid) {
        const ing = food.ingredient(iid);
        r.ing.push([iid, ing?.unit === 'pc' ? 1 : 100]);
      }
      draw();
      return;
    }
    const d = e.target.closest('[data-del-ing]');
    if (d) {
      readForm();
      r.ing.splice(Number(d.dataset.delIng), 1);
      draw();
    }
  });
  view.addEventListener('submit', (e) => {
    e.preventDefault();
    readForm();
    if (!r.name) {
      toast('Donne un nom à la recette.', { kind: 'error' });
      return;
    }
    const { id: _i, base: _b, mc: _m, ...data } = r;
    store.put('recipe', rid, data);
    toast('Recette enregistrée.');
    ctx.go(`/recettes/${rid}`);
  });
  draw();
}
