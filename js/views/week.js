// Écran « Semaine » : le planning des repas, ce qu'il y a à cuisiner ce soir, les totaux.
import * as calc from '../calc.js';
import * as food from '../food.js';
import * as plan from '../plan.js';
import { esc, icon, menuSheet, confirmSheet, toast } from '../ui.js';
import { priceTag, mealActions, gauge, pickRecipe, bakeSheet } from './common.js';

function mealSub(m) {
  const r = food.recipe(m.recipe);
  if (m.kind === 'reste') {
    const src = plan.source(m);
    const yesterday = src && src.day === calc.addDays(m.day, -1);
    return yesterday ? 'Gamelle du plat d’hier soir' : 'Restes';
  }
  if (plan.isCooked(m)) {
    const bits = [];
    if (m.done) bits.push('Cuisiné');
    else if (m.kind === 'compo') bits.push('Assiette composée');
    else if (r) bits.push(`${r.time} min`);
    if ((m.cooked ?? 1) > (m.portions ?? 1)) bits.push(`${calc.fmt1(m.cooked)} portions`);
    if (m.note) bits.push(m.note);
    if (m.mc) bits.push('Monsieur Cuisine');
    return bits.join(', ');
  }
  if (m.kind === 'uber') return 'Commande';
  return 'Repas libre';
}

function offerRow(day, prev) {
  return `<div class="meal is-offer">
    <span class="meal-slot">${esc(plan.SLOT_LABELS.midi)}</span>
    <span class="meal-main">
      <span class="meal-name">${icon('box', 'meal-ico')}Gamelle proposée</span>
      <span class="meal-sub">${esc(plan.mealTitle(prev))}, la portion en plus d’hier soir</span>
    </span>
    <span class="offer-actions">
      <button class="btn small primary" data-keep="${day}">Garder</button>
      <button class="icon-btn" data-slot="midi" data-day="${day}" aria-label="Autre chose pour ce midi">${icon('more')}</button>
    </span>
  </div>`;
}

function mealRow(day, slot, s) {
  const m = plan.getMeal(day, slot);
  if (!m) {
    const prev = slot === 'midi' ? plan.leftoverOffer(day) : null;
    if (prev) return offerRow(day, prev);
    return `<button class="meal is-empty" data-slot="${slot}" data-day="${day}">
      <span class="meal-slot">${esc(plan.SLOT_LABELS[slot])}</span>
      <span class="meal-main"><span class="meal-name">${icon('add')} Ajouter</span></span>
    </button>`;
  }
  const st = plan.mealStats(m, s);
  const d = plan.dessertOf(m);
  const ico = m.kind === 'reste' ? icon('box', 'meal-ico') : m.kind === 'uber' ? icon('bike', 'meal-ico') : m.done ? icon('check', 'meal-ico') : m.kind === 'compo' ? icon('fork', 'meal-ico') : '';
  return `<button class="meal k-${m.kind}${m.done ? ' is-done' : ''}" data-slot="${slot}" data-day="${day}">
    <span class="meal-slot">${esc(plan.SLOT_LABELS[slot])}</span>
    <span class="meal-main">
      <span class="meal-name">${ico}${esc(plan.mealTitle(m))}</span>
      <span class="meal-sub">${esc(mealSub(m))}</span>
      ${d ? `<span class="meal-dessert">+ ${esc(d.name)}</span>` : ''}
    </span>
    <span class="meal-side">${priceTag(st.cost, { cls: m.kind === 'uber' ? 'is-uber' : '' })}<span class="meal-kcal">${calc.fmt0(st.kcal)} kcal</span></span>
  </button>`;
}

function tonightCard(today, s) {
  const m = plan.getMeal(today, 'soir');
  const tomorrow = calc.addDays(today, 1);
  if (!m) {
    return `<section class="tonight is-empty">
      <p class="tonight-kicker">Ce soir</p>
      <p class="tonight-name">Rien de prévu pour l’instant</p>
      <div class="row-actions">
        <button class="btn primary" data-slot="soir" data-day="${today}">${icon('add')} Choisir le repas</button>
        <a class="btn" href="#/quoi?day=${today}&slot=soir">${icon('box')} Avec ce que j’ai</a>
      </div>
    </section>`;
  }
  const r = food.recipe(m.recipe);
  const cookable = m.kind === 'recette' && r && !m.done;
  const st = plan.mealStats(m, s);
  const lunch = plan.getMeal(tomorrow, 'midi');
  const kept = lunch && lunch.kind === 'reste' && lunch.from === m.id;
  const offer = !kept && plan.leftoverOffer(tomorrow);
  return `<section class="tonight">
    <p class="tonight-kicker">${m.done ? 'Ce soir, c’est prêt' : plan.isCooked(m) ? 'Ce soir tu cuisines' : 'Ce soir'}</p>
    <p class="tonight-name">${esc(plan.mealTitle(m))}</p>
    <p class="tonight-meta">${r && m.kind === 'recette' ? `${r.time} min, ` : ''}${calc.fmt0(st.kcal)} kcal la portion${kept ? '. La deuxième portion part dans la gamelle de demain midi.' : ''}</p>
    <div class="row-actions">
      ${cookable ? `<a class="btn primary" href="#/cuisine/${esc(r.id)}?p=${m.cooked ?? 1}&meal=${encodeURIComponent(m.id)}${m.mc ? '&mc=1' : ''}">${icon('pot')} Cuisiner</a>` : ''}
      ${m.kind === 'compo' && !m.done ? `<button class="btn primary" data-slot="soir" data-day="${today}">${icon('pot')} Préparer</button>` : ''}
      ${r && m.kind !== 'compo' ? `<a class="btn" href="#/recettes/${esc(r.id)}">Voir la recette</a>` : ''}
      ${offer ? `<button class="btn" data-keep="${tomorrow}">${icon('box')} Garder la 2ᵉ portion pour demain midi</button>` : ''}
    </div>
  </section>`;
}

function bakeCard(b, today) {
  const r = food.recipe(b.recipe);
  if (!r) return '';
  const used = plan.bakeUsed(b.id);
  const left = Math.max(0, b.parts - used);
  const st = food.recipeStats(r);
  const f = (r.serves || 1) / b.parts;
  const when = b.done ? 'Préparé' : b.day === today ? 'À préparer aujourd’hui' : b.day < today ? 'À préparer' : `À préparer ${calc.relDay(b.day).toLowerCase()}`;
  return `<div class="bake">
    <div class="bake-main">
      <span class="bake-name">${esc(r.name)}</span>
      <small>${esc(when)}, ${left} part${left > 1 ? 's' : ''} sur ${b.parts} pas encore prévue${left > 1 ? 's' : ''}, ${calc.fmt0(st.kcal * f)} kcal la part</small>
    </div>
    ${priceTag(st.cost * f)}
    <button class="icon-btn" data-bake="${esc(b.id)}" aria-label="Actions pour ${esc(r.name)}">${icon('more')}</button>
  </div>`;
}

export function renderWeek(view, ctx, startParam) {
  const today = calc.localDay();
  const start = startParam ? calc.weekStart(startParam) : calc.weekStart(today);
  const isCurrent = start === calc.weekStart(today);
  const s = calc.settings();
  const tg = calc.targets();
  const days = calc.weekDays(start);
  const active = plan.activeSlots(s);
  const ws = plan.periodStats(start, days[6]);
  const sav = plan.savings(start, days[6]);
  const daysWithMeals = days.filter((d) => plan.mealsOfDay(d).length);
  const avgKcal = daysWithMeals.length ? daysWithMeals.reduce((n, d) => n + plan.dayStats(d).kcal, 0) / daysWithMeals.length : 0;
  const empty = !ws.meals;
  const offers = plan.leftoverOffers(start);
  const bakes = plan.bakesOfWeek(start);

  view.innerHTML = `
    ${ctx.pageHead('Semaine', {
      sub: esc(`Du ${calc.fmtWeek(start)}`),
      actions: `<button class="icon-btn" data-gen aria-label="Proposer des repas">${icon('shuffle')}</button>`,
    })}
    <div class="week-nav">
      <a class="icon-btn" href="#/semaine/${calc.addDays(start, -7)}" aria-label="Semaine précédente">${icon('back')}</a>
      <span class="week-label">${isCurrent ? 'Cette semaine' : esc(`Semaine du ${calc.fmtWeek(start)}`)}</span>
      <a class="icon-btn" href="#/semaine/${calc.addDays(start, 7)}" aria-label="Semaine suivante">${icon('next')}</a>
      ${isCurrent ? '' : '<a class="btn small" href="#/semaine">Aujourd’hui</a>'}
    </div>
    ${!tg.ready ? `<a class="banner" href="#/profil">Renseigne ton profil pour calculer ton objectif de calories et de protéines.</a>` : ''}
    ${isCurrent && !empty ? tonightCard(today, s) : ''}
    ${empty ? `<section class="block soft start-week">
        <p class="start-title">Semaine vide</p>
        <p>Gamelle peut te proposer des repas selon ton objectif, ton temps de cuisine et ton matériel. Le soir, les plats sont prévus en 2 portions : Gamelle te propose ensuite de garder la seconde pour le lendemain midi, tu choisis.</p>
        <div class="row-actions"><button class="btn primary" data-fill>${icon('shuffle')} Proposer la semaine</button><a class="btn" href="#/quoi">${icon('box')} Avec ce que j’ai</a></div>
      </section>` : `
      <div class="figures">
        <div class="figure"><span class="fig-value">${esc(calc.fmtEur(ws.cost).replace(' €', ''))}<small>€</small></span><span class="fig-label">cette semaine${ws.homeAvg != null ? `, ${esc(calc.fmtEur(ws.homeAvg))} le repas` : ''}</span></div>
        <div class="figure"><span class="fig-value">${calc.fmt0(avgKcal)}<small>kcal</small></span><span class="fig-label">par jour${tg.ready ? `, objectif ${calc.fmt0(tg.kcal)}` : ''}</span></div>
        ${sav && sav.days ? `<div class="figure is-saved"><span class="fig-value">${esc(calc.fmtEur0(sav.saved).replace(' €', ''))}<small>€</small></span><span class="fig-label">économisés sur tes commandes</span></div>` : ''}
      </div>`}
    ${offers.length > 1 ? `<div class="offer-banner">${icon('box')}<span>${offers.length} gamelles proposées pour les midis, avec la portion en plus de la veille.</span><button class="btn small primary" data-keep-all>Tout garder</button></div>` : ''}
    ${bakes.length ? `<section class="block bakes"><h2 class="group-title">Dessert de la semaine</h2>${bakes.map((b) => bakeCard(b, today)).join('')}</section>` : ''}
    <div class="days">
      ${days.map((d) => {
        const ds = plan.dayStats(d);
        const past = d < today;
        const slots = plan.SLOT_ORDER.filter((sl) => active.includes(sl) || plan.getMeal(d, sl));
        const extra = ['petitdej', 'collation'].filter((sl) => !slots.includes(sl));
        return `<section class="day ${d === today ? 'is-today' : ''} ${past ? 'is-past' : ''}" id="d-${d}">
          <header class="day-head">
            <h2>${esc(calc.relDay(d) === calc.fmtDayName(d) ? calc.fmtDayName(d) : `${calc.relDay(d)}, ${calc.fmtDayName(d).toLowerCase()}`)}</h2>
            ${ds.n ? `<span class="day-total"><span><b>${calc.fmt0(ds.kcal)}</b> kcal</span>${priceTag(ds.cost, { cls: 'is-plain' })}</span>` : ''}
          </header>
          ${tg.ready && ds.n ? gauge(ds.kcal, tg.kcal, 'Calories', 'mini') : ''}
          <div class="meals">${slots.map((slot) => mealRow(d, slot, s)).join('')}</div>
          ${extra.length ? `<div class="day-extra">${extra.map((sl) => `<button class="link-btn" data-slot="${sl}" data-day="${d}">${icon('add')} ${esc(plan.SLOT_LABELS[sl])}</button>`).join('')}</div>` : ''}
        </section>`;
      }).join('')}
    </div>
    <div class="row-actions center">
      ${!empty ? `<a class="btn" href="#/courses/${start}">${icon('courses')} Liste de courses</a>` : ''}
      <button class="btn" data-add-bake>${icon('add')} Gâteau ou dessert de la semaine</button>
    </div>
  `;

  const generate = async (mode) => {
    if (mode === 'replace') {
      const ok = await confirmSheet('Tout reproposer ?', 'Les repas de la semaine seront remplacés, sauf les commandes, repas libres et plats déjà cuisinés.', { ok: 'Reproposer' });
      if (!ok) return;
    }
    plan.generate(start, mode);
    const n = plan.leftoverOffers(start).length;
    toast(`${mode === 'fill' ? 'Repas proposés pour les créneaux vides.' : 'Nouvelle semaine proposée.'}${n ? ` ${n} gamelle${n > 1 ? 's' : ''} à garder ou non pour les midis.` : ''}`, { duration: 5000 });
    ctx.render();
  };

  view.addEventListener('click', async (e) => {
    const keep = e.target.closest('[data-keep]');
    if (keep) {
      plan.keepLeftover(keep.dataset.keep);
      toast('Gamelle gardée pour le midi.');
      return ctx.render();
    }
    if (e.target.closest('[data-keep-all]')) {
      const n = plan.keepAllLeftovers(start);
      toast(`${n} gamelle${n > 1 ? 's' : ''} gardée${n > 1 ? 's' : ''}.`);
      return ctx.render();
    }
    const bk = e.target.closest('[data-bake]');
    if (bk) {
      const b = plan.bakes().find((x) => x.id === bk.dataset.bake);
      const r = b && food.recipe(b.recipe);
      if (!b) return;
      const c = await menuSheet(r ? r.name : 'Dessert', [
        ...(r ? [{ label: 'Voir la recette', value: 'open', icon: 'recettes' }] : []),
        { label: b.done ? 'Annuler « préparé »' : 'Marquer comme préparé', value: 'done', icon: 'check' },
        { label: 'Une part en dessert ce soir', value: 'tonight', icon: 'add' },
        { label: 'Retirer', value: 'del', icon: 'trash', danger: true },
      ]);
      if (c === 'open') ctx.go(`/recettes/${r.id}?p=${r.serves}`);
      if (c === 'done') {
        plan.setBakeDone(b, !b.done);
        toast(b.done ? 'Remis « à préparer ».' : 'Préparé. Les réserves ont été mises à jour.');
      }
      if (c === 'tonight') {
        const d = today >= b.day ? today : b.day;
        if (!plan.getMeal(d, 'soir')) toast('Aucun repas prévu ce soir-là : prévois d’abord le repas.', { kind: 'error' });
        else plan.setDessert(d, 'soir', { cake: b.id });
      }
      if (c === 'del' && await confirmSheet('Retirer ce dessert ?', 'Les parts prévues en dessert seront retirées des repas.', { ok: 'Retirer', danger: true })) plan.removeBake(b.id);
      return ctx.render();
    }
    if (e.target.closest('[data-add-bake]')) {
      const id = await pickRecipe({ title: 'Dessert de la semaine', cats: ['dessert'], only: food.isLot });
      if (id && await bakeSheet(food.recipe(id), ctx, { day: start > today ? start : (isCurrent ? today : start) })) ctx.render();
      return;
    }
    const slotBtn = e.target.closest('[data-slot]');
    if (slotBtn) {
      const { day, slot } = slotBtn.dataset;
      if (!plan.getMeal(day, slot) && slot === 'midi' && plan.leftoverOffer(day)) {
        const c = await menuSheet(`Midi, ${calc.relDay(day).toLowerCase()}`, [
          { label: 'Garder la gamelle d’hier soir', value: 'keep', icon: 'box' },
          { label: 'Non : cuisiner une seule portion hier soir', value: 'single', icon: 'minus' },
          { label: 'Prévoir autre chose', value: 'other', icon: 'search' },
        ]);
        if (c === 'keep') plan.keepLeftover(day);
        if (c === 'single') {
          plan.singlePortion(day);
          toast('Le plat de la veille ne sera cuisiné qu’en une portion. La liste de courses suit.');
        }
        if (c === 'other') await mealActions(day, slot, ctx);
        return ctx.render();
      }
      await mealActions(day, slot, ctx);
      ctx.render();
      return;
    }
    if (e.target.closest('[data-fill]')) return generate('fill');
    if (e.target.closest('[data-gen]')) {
      const c = await menuSheet('Proposer des repas', [
        { label: 'Remplir les repas vides', value: 'fill', icon: 'add' },
        { label: 'Tout reproposer', value: 'replace', icon: 'shuffle' },
        { label: 'Réglages des propositions', value: 'prefs', icon: 'sliders' },
      ]);
      if (c === 'prefs') ctx.go('/preferences');
      else if (c) generate(c);
    }
  });
}
