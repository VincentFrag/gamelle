// Écrans « Ce que j'ai », « Qu'est-ce que je cuisine ? » et « Fonds de placard ».
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as food from '../food.js';
import * as plan from '../plan.js';
import * as shop from '../shop.js';
import * as have from '../have.js';
import { esc, icon, confirmSheet, toast } from '../ui.js';
import { priceTag, macros, compoSheet, addToPlan } from './common.js';
import { pickIngredient } from './recipes.js';

const PLACE_TITLES = { frigo: 'Frigo', congelo: 'Congélateur', placard: 'Placard et corbeille' };
const view_state = { q: '' };

function placeOf(ing) {
  return store.get('stock', ing.id)?.data.place || shop.defaultPlace(ing);
}

function haveChip(ing) {
  const st = have.state(ing.id);
  const label = st === 'soon' ? `${ing.name}, à finir vite` : st === 'have' ? `${ing.name}, j’en ai` : ing.name;
  return `<button type="button" class="chip have-chip ${st === 'have' ? 'is-on' : st === 'soon' ? 'is-on is-soon' : ''}" data-cycle="${esc(ing.id)}" aria-label="${esc(label)}">${esc(ing.name)}${st === 'soon' ? '<small>à finir</small>' : ''}</button>`;
}

// ---------- Ce que j'ai ----------
export function renderHave(view, ctx) {
  const draw = () => {
    const nq = food.norm(view_state.q);
    const all = food.ingredients().filter((i) => !i.staple).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const list = all.filter((i) => !nq || food.norm(i.name).includes(nq));
    const staples = food.ingredients().filter((i) => i.staple).map((i) => i.name.charAt(0).toLowerCase() + i.name.slice(1)).sort((a, b) => a.localeCompare(b, 'fr'));
    const n = all.filter((i) => have.state(i.id) !== 'none').length;
    const soon = all.filter((i) => have.state(i.id) === 'soon').length;
    view.innerHTML = `
      ${ctx.pageHead('Ce que j’ai', { back: '/courses', actions: `<a class="btn small" href="#/reserves">Quantités</a>` })}
      <p class="block-sub">Touche un aliment une fois : tu en as. Deux fois : il est à finir vite. Une troisième fois : il n’y en a plus. Pas besoin de quantité.</p>
      <div class="have-bar">
        <span><b>${n}</b> aliment${n > 1 ? 's' : ''}${soon ? `, dont <b>${soon}</b> à finir vite` : ''}</span>
        <a class="btn primary" href="#/quoi">${icon('pot')} Qu’est-ce que je cuisine ?</a>
      </div>
      <label class="search page-search"><span class="sr-only">Rechercher</span>${icon('search')}<input type="search" placeholder="Chercher un aliment" value="${esc(view_state.q)}" data-q autocomplete="off"></label>
      ${['frigo', 'congelo', 'placard'].map((p) => {
        const items = list.filter((i) => placeOf(i) === p);
        if (!items.length) return '';
        return `<section class="block">
          <h2 class="group-title">${esc(PLACE_TITLES[p])}</h2>
          <div class="chips">${items.map(haveChip).join('')}</div>
        </section>`;
      }).join('') || '<p class="empty">Aucun aliment ne correspond.</p>'}
      <p class="fine">Toujours supposés présents : ${esc(staples.join(', '))}. Tu peux changer ça dans Plus, Prix des ingrédients.</p>
      ${n ? '<div class="row-actions"><button class="btn ghost" data-clear>Tout décocher</button></div>' : ''}`;
    const input = view.querySelector('[data-q]');
    input.addEventListener('input', (e) => {
      view_state.q = e.target.value;
      const pos = e.target.selectionStart;
      draw();
      const ni = view.querySelector('[data-q]');
      ni.focus();
      ni.setSelectionRange(pos, pos);
    });
  };
  view.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-cycle]');
    if (c) {
      have.cycle(c.dataset.cycle);
      const ing = food.ingredient(c.dataset.cycle);
      c.outerHTML = haveChip(ing);
      const all = food.ingredients().filter((i) => !i.staple);
      const n = all.filter((i) => have.state(i.id) !== 'none').length;
      const soon = all.filter((i) => have.state(i.id) === 'soon').length;
      const bar = view.querySelector('.have-bar span');
      if (bar) bar.innerHTML = `<b>${n}</b> aliment${n > 1 ? 's' : ''}${soon ? `, dont <b>${soon}</b> à finir vite` : ''}`;
      return;
    }
    if (e.target.closest('[data-clear]') && await confirmSheet('Tout décocher ?', 'Les aliments cochés et les quantités enregistrées seront effacés.', { ok: 'Tout décocher', danger: true })) {
      store.batch((b) => { for (const r of store.all('stock')) b.remove('stock', r.id); });
      draw();
    }
  });
  draw();
}

// ---------- Qu'est-ce que je cuisine ? ----------
export function renderWhat(view, ctx) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.day || '') ? ctx.query.day : null;
  const slot = ['midi', 'soir'].includes(ctx.query.slot) ? ctx.query.slot : null;
  const target = day && slot;
  const s = calc.settings();
  const stockCount = store.all('stock').length;
  const ranked = have.rank().slice(0, 15);
  const plate = have.plateFromStock();
  const plateStats = plate ? food.compoStats(plate.parts, plate.sauce) : null;
  const names = (ids) => ids.map((id) => food.ingredient(id)?.name).filter(Boolean).map((n) => n.charAt(0).toLowerCase() + n.slice(1)).join(', ');

  view.innerHTML = `
    ${ctx.pageHead('Qu’est-ce que je cuisine ?', { back: target ? `/semaine/${calc.weekStart(day)}` : '/frigo', sub: target ? esc(`Pour : ${plan.SLOT_LABELS[slot].toLowerCase()}, ${calc.relDay(day).toLowerCase()}`) : '' })}
    ${!stockCount ? `<section class="block soft">
        <p>Gamelle ne sait pas encore ce que tu as. Coche ton frigo, ton congélateur et ton placard en quelques secondes, puis reviens ici.</p>
        <a class="btn primary" href="#/frigo">${icon('box')} Ce que j’ai</a>
      </section>` : `
      ${plate ? `<section class="block plate-card">
        <h2 class="block-title">Une assiette simple avec ce que tu as</h2>
        <p class="plate-name">${esc(food.compoTitle(plate.parts, plate.sauce))}</p>
        <p class="plate-figs">${macros(plateStats, { short: true })} ${priceTag(plateStats.cost)} <small>la portion</small></p>
        <div class="row-actions"><button class="btn primary" data-plate>${target ? 'Prévoir' : 'Prévoir ce repas'}</button><button class="btn" data-plate-edit>Changer un élément</button></div>
      </section>` : ''}
      <section class="block">
        <h2 class="block-title">Recettes</h2>
        <p class="block-sub">D’abord celles pour lesquelles il ne manque rien, et celles qui utilisent ce qui est à finir vite.</p>
        ${ranked.length ? `<div class="list">${ranked.map((x) => {
          const st = food.recipeStats(x.r);
          return `<div class="list-row what-row">
            <a class="list-main" href="#/recettes/${esc(x.r.id)}">${esc(x.r.name)}
              <small class="${x.missing.length ? '' : 'ok-text'}">${x.missing.length ? `Il manque : ${esc(names(x.missing))}` : 'Tu as tout'}</small>
              ${x.soon.length ? `<small class="soon-text">Utilise : ${esc(names(x.soon))}</small>` : ''}
              <small>${x.r.time} min, ${calc.fmt0(st.kcal)} kcal la portion</small></a>
            <button class="btn small" data-plan="${esc(x.r.id)}">${target ? 'Choisir' : 'Prévoir'}</button>
          </div>`;
        }).join('')}</div>` : '<p class="empty">Aucune recette n’utilise ce que tu as coché.</p>'}
      </section>`}`;

  view.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-plan]');
    if (p) {
      const r = food.recipe(p.dataset.plan);
      if (!r) return;
      if (target) {
        plan.setMeal(day, slot, { kind: 'recette', recipe: r.id, portions: 1, mc: s.preferMc && !!r.mc });
        toast(`Prévu : ${r.name}`);
        ctx.go(`/semaine/${calc.weekStart(day)}`);
      } else addToPlan(r, ctx);
      return;
    }
    if (e.target.closest('[data-plate]') && plate) {
      if (target) {
        plan.setMeal(day, slot, { kind: 'compo', parts: plate.parts, sauce: plate.sauce, portions: 1 });
        toast('Assiette prévue.');
        ctx.go(`/semaine/${calc.weekStart(day)}`);
      } else {
        const res = await compoSheet({ cur: { parts: plate.parts, sauce: plate.sauce } });
        if (res) ctx.go(`/semaine/${calc.weekStart(res.day)}`);
      }
      return;
    }
    if (e.target.closest('[data-plate-edit]') && plate) {
      const res = await compoSheet({ day, slot, cur: { parts: plate.parts, sauce: plate.sauce } });
      if (res) ctx.go(`/semaine/${calc.weekStart(res.day)}`);
    }
  });
}

// ---------- Fonds de placard ----------
export function renderPantry(view, ctx) {
  const draw = () => {
    const list = shop.pantryList().sort((a, b) => (a.every === 'off') - (b.every === 'off') || a.ing.name.localeCompare(b.ing.name, 'fr'));
    view.innerHTML = `
      ${ctx.pageHead('Fonds de placard', { back: '/courses', actions: `<button class="icon-btn" data-add aria-label="Ajouter un fond de placard">${icon('add')}</button>` })}
      <p class="block-sub">Ce que tu rachètes régulièrement, quelles que soient les recettes : yaourts, compotes, huile, farine… Ils apparaissent dans la liste de courses quand c’est le moment. « J’en ai encore » les repousse à la semaine ou au mois suivant.</p>
      <div class="list">${list.map((p) => {
        const due = shop.pantryDue(p);
        const next = shop.pantryNext(p);
        const sub = p.every === 'off' ? 'Jamais proposé' : !p.last ? 'À vérifier aux prochaines courses' : due ? 'À racheter' : `Prochain achat : ${calc.fmtShort(next)}`;
        return `<div class="list-row pantry-row ${p.every === 'off' ? 'is-off' : ''}">
          <span class="list-main">${esc(p.ing.name)}<small class="${due && p.every !== 'off' ? 'due-text' : ''}">${esc(sub)}</small></span>
          <select data-every="${esc(p.id)}" aria-label="Fréquence pour ${esc(p.ing.name)}">${Object.entries(shop.EVERY_LABELS).map(([k, l]) => `<option value="${k}" ${p.every === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        </div>`;
      }).join('')}</div>
      <div class="row-actions"><button class="btn" data-add>${icon('add')} Ajouter</button></div>`;
  };
  view.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-every]');
    if (!sel) return;
    shop.setPantry(sel.dataset.every, { every: sel.value });
    draw();
  });
  view.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-add]')) return;
    const id = await pickIngredient();
    if (!id) return;
    shop.setPantry(id, { every: 'month' });
    toast(`${food.ingredient(id)?.name} ajouté aux fonds de placard.`);
    draw();
  });
  draw();
}
