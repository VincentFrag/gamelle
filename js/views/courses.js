// Écrans « Courses » (liste de la semaine) et « Réserves » (frigo, congélateur, placard).
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as food from '../food.js';
import * as shop from '../shop.js';
import { esc, icon, openSheet, confirmSheet, toast, formData } from '../ui.js';
import { priceTag } from './common.js';
import { pickIngredient } from './recipes.js';
import { PLACES } from '../clean.js';

const PLACE_LABELS = { frigo: 'Frigo', congelo: 'Congélateur', placard: 'Placard' };

function itemRow(i) {
  return `<div class="shop-item ${i.checked ? 'is-checked' : ''}">
    <label class="shop-check"><input type="checkbox" data-check="${esc(i.id)}" ${i.checked ? 'checked' : ''}>
      <span class="shop-main"><span class="shop-name">${esc(i.ing.name)}</span>
        <small>${esc(i.buy.label)}${i.stock > 0 ? `, ${esc(food.fmtQty(i.ing, i.stock))} déjà en réserve` : ''}</small>
        <small class="shop-uses">Pour : ${esc(i.uses.join(', '))}</small></span>
    </label>
    ${priceTag(i.buy.cost)}
    <button class="have-btn" data-have="${esc(i.id)}" aria-label="J’en ai déjà : ${esc(i.ing.name)}">J’en ai</button>
  </div>`;
}

export function renderShop(view, ctx, startParam) {
  const today = calc.localDay();
  const start = startParam ? calc.weekStart(startParam) : calc.weekStart(today);
  const isCurrent = start === calc.weekStart(today);
  const lr = shop.listRow(start);
  const range = isCurrent ? lr.range : 'week';
  const list = shop.compute(start, range);

  view.innerHTML = `
    ${ctx.pageHead('Courses', { sub: esc(`Semaine du ${calc.fmtWeek(start)}`), actions: `<button class="icon-btn" data-copy aria-label="Copier la liste">${icon('copy')}</button>` })}
    <div class="week-nav">
      <a class="icon-btn" href="#/courses/${calc.addDays(start, -7)}" aria-label="Semaine précédente">${icon('back')}</a>
      <span class="week-label">${isCurrent ? 'Cette semaine' : esc(`Du ${calc.fmtWeek(start)}`)}</span>
      <a class="icon-btn" href="#/courses/${calc.addDays(start, 7)}" aria-label="Semaine suivante">${icon('next')}</a>
    </div>
    ${isCurrent ? `<div class="seg" role="radiogroup" aria-label="Période">
      <button role="radio" aria-checked="${range === 'today'}" data-range="today">À partir d’aujourd’hui</button>
      <button role="radio" aria-checked="${range === 'week'}" data-range="week">Toute la semaine</button>
    </div>` : ''}
    <div class="shop-links">
      <a class="btn small" href="#/frigo">${icon('box')} Ce que j’ai</a>
      <a class="btn small" href="#/placard">Fonds de placard</a>
    </div>
    ${!list.meals ? `<p class="empty">Aucun plat à cuisiner sur cette période. Planifie des repas dans l’onglet Semaine, la liste se remplit toute seule.</p>` : `
      <div class="shop-summary">
        <div><span class="shop-total">${priceTag(list.total, { big: true })}</span><span class="fig-label">estimation pour ${[list.preps ? `${list.preps} préparation${list.preps > 1 ? 's' : ''}` : '', list.desserts ? `${list.desserts} dessert${list.desserts > 1 ? 's' : ''}` : ''].filter(Boolean).join(' et ')}</span></div>
        <div class="shop-progress"><b>${list.done}</b> sur ${list.count} dans le panier</div>
      </div>
      ${list.groups.map((g) => `<section class="block shop-group">
        <h2 class="group-title">${esc(g.label)}</h2>
        <div class="list">${g.items.map(itemRow).join('')}</div>
      </section>`).join('')}
      ${list.staples.length ? `<section class="block shop-group">
        <h2 class="group-title">Placard, à vérifier</h2>
        <p class="block-sub">Produits qu’on a en général. Coche ceux qu’il faut racheter.</p>
        <div class="list">${list.staples.map((i) => `<div class="shop-item is-staple ${i.checked ? 'is-checked' : ''}">
          <label class="shop-check"><input type="checkbox" data-check="${esc(i.id)}" ${i.checked ? 'checked' : ''}>
          <span class="shop-main"><span class="shop-name">${esc(i.ing.name)}</span><small>${esc(food.fmtQty(i.ing, i.need))} nécessaires</small></span></label>
        </div>`).join('')}</div>
      </section>` : ''}`}
    ${list.pantry.length ? `<section class="block shop-group">
      <div class="block-head"><h2 class="group-title">Fonds de placard</h2><button class="btn small ghost" data-pantry-all>Tout est là</button></div>
      <p class="block-sub">Achats réguliers à vérifier. Coche ce qui manque, « J’en ai » le repousse à plus tard.</p>
      <div class="list">${list.pantry.map((p) => `<div class="shop-item ${p.checked ? 'is-checked' : ''}">
        <label class="shop-check"><input type="checkbox" data-check="${esc(p.id)}" ${p.checked ? 'checked' : ''}>
          <span class="shop-main"><span class="shop-name">${esc(p.ing.name)}</span><small>${esc(p.buy.label)}, ${p.every === 'week' ? 'chaque semaine' : 'chaque mois'}</small></span></label>
        ${priceTag(p.buy.cost)}
        <button class="have-btn" data-pantry-later="${esc(p.id)}" aria-label="J’en ai encore : ${esc(p.ing.name)}">J’en ai</button>
      </div>`).join('')}</div>
    </section>` : ''}
    <section class="block shop-group">
      <h2 class="group-title">En plus</h2>
      <div class="list">${list.extras.map((x) => `<div class="shop-item is-extra ${x.done ? 'is-checked' : ''}">
        <label class="shop-check"><input type="checkbox" data-extra="${esc(x.uid)}" ${x.done ? 'checked' : ''}><span class="shop-main"><span class="shop-name">${esc(x.name)}</span></span></label>
        <button class="icon-btn" data-del-extra="${esc(x.uid)}" aria-label="Retirer ${esc(x.name)}">${icon('trash')}</button>
      </div>`).join('')}
      <form class="inline-input pad" data-add-extra><input name="extra" maxlength="80" placeholder="Ajouter un article (lessive, café…)" aria-label="Ajouter un article"><button class="btn small" type="submit">Ajouter</button></form></div>
    </section>
    ${list.covered.length ? `<p class="fine">Déjà à la maison : ${esc(list.covered.map((i) => i.ing.name + (i.have ? ' (à vérifier)' : '')).join(', '))}.</p>` : ''}
    <div class="row-actions">
      ${list.done ? `<button class="btn primary" data-store>${icon('box')} Ranger les articles cochés</button>` : ''}
      <a class="btn" href="#/reserves">Quantités en réserve</a>
    </div>
    <p class="fine">Prix estimés d’après les conditionnements courants. Une fois les courses faites, « Ranger » ajoute les articles cochés à tes réserves : le reste d’un paquet sera déduit des listes suivantes.</p>`;

  const toggle = (arr, id, on) => {
    const set = new Set(arr);
    if (on) set.add(id); else set.delete(id);
    return [...set];
  };

  view.addEventListener('change', (e) => {
    const c = e.target.closest('[data-check]');
    if (c) {
      shop.saveList(start, { checked: toggle(shop.listRow(start).checked, c.dataset.check, c.checked) });
      ctx.render();
      return;
    }
    const x = e.target.closest('[data-extra]');
    if (x) {
      const l = shop.listRow(start);
      shop.saveList(start, { extras: l.extras.map((it) => (it.uid === x.dataset.extra ? { ...it, done: x.checked } : it)) });
      ctx.render();
    }
  });

  view.addEventListener('submit', (e) => {
    if (!e.target.closest('[data-add-extra]')) return;
    e.preventDefault();
    const name = e.target.extra.value.trim();
    if (!name) return;
    const l = shop.listRow(start);
    shop.saveList(start, { extras: [...l.extras, { uid: store.uuid().slice(0, 12), name, done: false }] });
    ctx.render();
    requestAnimationFrame(() => view.querySelector('[name=extra]')?.focus());
  });

  view.addEventListener('click', async (e) => {
    const rg = e.target.closest('[data-range]');
    if (rg) {
      shop.saveList(start, { range: rg.dataset.range });
      return ctx.render();
    }
    const pl = e.target.closest('[data-pantry-later]');
    if (pl) {
      shop.postponePantry([pl.dataset.pantryLater]);
      toast('Repoussé à plus tard.');
      return ctx.render();
    }
    if (e.target.closest('[data-pantry-all]')) {
      shop.postponePantry(list.pantry.filter((p) => !p.checked).map((p) => p.id));
      return ctx.render();
    }
    const de = e.target.closest('[data-del-extra]');
    if (de) {
      const l = shop.listRow(start);
      shop.saveList(start, { extras: l.extras.filter((it) => it.uid !== de.dataset.delExtra) });
      return ctx.render();
    }
    const h = e.target.closest('[data-have]');
    if (h) {
      const item = list.groups.flatMap((g) => g.items).find((i) => i.id === h.dataset.have);
      if (!item) return;
      const res = await openSheet({
        title: 'J’en ai déjà',
        body: `<form class="form" data-form><p>Quelle quantité de ${esc(item.ing.name.toLowerCase())} as-tu à la maison ? Il en faut ${esc(food.fmtQty(item.ing, item.gross))} cette semaine.</p>
          <label class="field"><span>Quantité (${esc(food.UNIT_LABELS[item.ing.unit])})</span><input name="qty" inputmode="decimal" value="${esc(calc.numInput(food.roundQty(item.ing.unit, item.gross)))}" autofocus></label></form>`,
        actions: [{ label: 'Annuler', value: null }, { label: 'Enregistrer', kind: 'primary', handler: (el) => formData(el) }],
      });
      if (!res) return;
      const qty = calc.parseNum(res.qty);
      if (qty == null) return;
      const cur = store.get('stock', item.id);
      if (qty <= 0) store.remove('stock', item.id);
      else store.put('stock', item.id, { qty, place: cur?.data.place || shop.defaultPlace(item.ing), soon: cur?.data.soon });
      return ctx.render();
    }
    if (e.target.closest('[data-store]')) {
      const n = shop.storeChecked(start, list);
      toast(`${n} article${n > 1 ? 's' : ''} rangé${n > 1 ? 's' : ''} dans tes réserves.`);
      return ctx.render();
    }
    if (e.target.closest('[data-copy]')) {
      const text = shop.asText(list);
      try {
        if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Courses', text });
        else {
          await navigator.clipboard.writeText(text);
          toast('Liste copiée.');
        }
      } catch (err) {
        if (err?.name !== 'AbortError') toast('Copie impossible sur ce navigateur.', { kind: 'error' });
      }
    }
  });
}

// ---------- Réserves ----------
export function renderStock(view, ctx) {
  const rows = store.all('stock').map((r) => ({ id: r.id, ...r.data, ing: food.ingredient(r.id) })).filter((r) => r.ing);
  const byPlace = PLACES.map((p) => ({ p, items: rows.filter((r) => (r.place || 'placard') === p).sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'fr')) }));

  view.innerHTML = `
    ${ctx.pageHead('Réserves', { back: '/courses', actions: `<button class="icon-btn" data-add aria-label="Ajouter une réserve">${icon('add')}</button>` })}
    <p class="block-sub">Ce que tu as à la maison, avec les quantités quand tu les connais. La liste de courses en tient compte, et un plat marqué « cuisiné » retire ses ingrédients d’ici. Pour cocher vite sans quantité, utilise <a href="#/frigo">Ce que j’ai</a>.</p>
    ${rows.length ? byPlace.filter((g) => g.items.length).map((g) => `<section class="block">
      <h2 class="group-title">${esc(PLACE_LABELS[g.p])}</h2>
      <div class="list">${g.items.map((r) => `<button class="list-row" data-edit="${esc(r.id)}"><span class="list-main">${esc(r.ing.name)}</span><span class="list-value">${r.qty != null ? esc(food.fmtQty(r.ing, r.qty)) : 'j’en ai'}${r.soon ? ' <span class="tag mini soon">à finir</span>' : ''}</span></button>`).join('')}</div>
    </section>`).join('') : `<p class="empty">Rien pour l’instant. Ajoute ce que tu as au congélateur ou au placard, ou utilise « Ranger les articles cochés » après tes courses.</p>`}
    <div class="row-actions">
      <button class="btn" data-add>${icon('add')} Ajouter</button>
      ${rows.length ? '<button class="btn ghost" data-clear>Tout vider</button>' : ''}
    </div>`;

  const edit = async (id) => {
    const ing = food.ingredient(id);
    const cur = store.get('stock', id);
    const res = await openSheet({
      title: ing.name,
      body: `<form class="form" data-form>
        <label class="field"><span>Quantité (${esc(food.UNIT_LABELS[ing.unit])})</span><input name="qty" inputmode="decimal" value="${esc(calc.numInput(cur?.data.qty))}" placeholder="Je ne sais pas" autofocus></label>
        <label class="field"><span>Rangé au</span><select name="place">${PLACES.map((p) => `<option value="${p}" ${(cur?.data.place || shop.defaultPlace(ing)) === p ? 'selected' : ''}>${esc(PLACE_LABELS[p])}</option>`).join('')}</select></label>
        <label class="switch"><input type="checkbox" name="soon" ${cur?.data.soon ? 'checked' : ''}><span>À finir vite<small>Les recettes qui l’utilisent passent devant dans « Qu’est-ce que je cuisine ? ».</small></span></label>
      </form>`,
      actions: [
        ...(cur ? [{ label: 'Retirer', kind: 'danger', value: 'del' }] : [{ label: 'Annuler', value: null }]),
        { label: 'Enregistrer', kind: 'primary', handler: (el) => formData(el) },
      ],
    });
    if (res === 'del') store.remove('stock', id);
    else if (res) {
      const qty = calc.parseNum(res.qty);
      if (qty === 0) store.remove('stock', id);
      else store.put('stock', id, qty ? { qty, place: res.place, soon: res.soon } : { have: true, place: res.place, soon: res.soon });
    }
    ctx.render();
  };

  view.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) return edit(ed.dataset.edit);
    if (e.target.closest('[data-add]')) {
      const id = await pickIngredient();
      if (id) edit(id);
      return;
    }
    if (e.target.closest('[data-clear]') && await confirmSheet('Vider les réserves ?', 'Toutes les quantités enregistrées seront effacées.', { ok: 'Vider', danger: true })) {
      store.batch((b) => { for (const r of store.all('stock')) b.remove('stock', r.id); });
      ctx.render();
    }
  });
}
