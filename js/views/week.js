// Écran « Semaine » : le planning des repas, ce qu'il y a à cuisiner ce soir, les totaux.
import * as calc from '../calc.js';
import * as food from '../food.js';
import * as plan from '../plan.js';
import { esc, icon, menuSheet, confirmSheet, toast, openSheet, formData } from '../ui.js';
import { priceTag, mealActions, gauge, pickRecipe, bakeSheet, dessertSheet, myCakeSheet } from './common.js';
import { todayCard, todayClick, craquageSheet, snackRow } from './today.js';

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
    else if (m.kind === 'compo') bits.push(m.slot === 'petitdej' ? 'Ton petit-déj' : m.slot === 'collation' ? 'Ta collation' : 'Assiette composée');
    else if (r) bits.push(`${r.time} min`);
    if ((m.cooked ?? 1) > (m.portions ?? 1)) bits.push(`${calc.fmt1(m.cooked)} portions`);
    if (m.note) bits.push(m.note);
    if (m.mc) bits.push('Monsieur Cuisine');
    return bits.join(', ');
  }
  if (m.kind === 'uber') return m.refund ? 'Commande, note de frais' : 'Commande';
  return m.refund ? 'Repas libre, note de frais' : 'Repas libre';
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
  const main = slot === 'midi' || slot === 'soir';
  const cakeOnly = m.kind === 'compo' && m.cake && !m.parts?.length && !m.sauce && !m.sauceParts;
  // Le dessert a sa propre ligne : la ligne du repas affiche le plat seul (le total du jour, lui, compte tout une fois)
  if (main && d && !cakeOnly) {
    st.kcal -= d.kcal;
    st.cost -= d.cost;
  }
  // Le dessert a sa propre ligne sous le midi et le soir : « + Dessert », ou le dessert choisi
  const dessertLine = !main || cakeOnly ? '' : d
    ? `<button class="meal-dessert-row has-dessert" data-dessert-day="${day}" data-dessert-slot="${slot}" style="--slot: var(--sl-${slot})"><span class="dr-label">Dessert</span><span class="dr-name">${esc(d.name)}</span><span class="dr-kcal">${calc.fmt0(d.kcal)} kcal${d.cost >= 0.01 ? `, ${esc(calc.fmtEur(d.cost))}` : ''}</span></button>`
    : `<button class="meal-dessert-row" data-dessert-day="${day}" data-dessert-slot="${slot}" style="--slot: var(--sl-${slot})"><span class="dr-label"></span><span class="dr-name">${icon('add')} Dessert</span></button>`;
  return `<button class="meal k-${m.kind}${m.done ? ' is-done' : ''}" data-slot="${slot}" data-day="${day}">
    <span class="meal-slot">${esc(plan.SLOT_LABELS[slot])}</span>
    <span class="meal-main">
      <span class="meal-name">${ico}${esc(plan.mealTitle(m))}</span>
      <span class="meal-sub">${esc(mealSub(m))}</span>
    </span>
    <span class="meal-side">${m.refund ? (m.cost ? `<span class="refund-price" title="Remboursé">${esc(calc.fmtEur(m.cost))}</span>` : '') : priceTag(st.cost, { cls: m.kind === 'uber' ? 'is-uber' : '' })}<span class="meal-kcal">${calc.fmt0(st.kcal)} kcal</span></span>
  </button>${dessertLine}`;
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
      <small>${esc(when)}, ${left ? `${left} part${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''} sur ${b.parts}` : 'plus aucune part'}, ${calc.fmt0(st.kcal * f)} kcal la part</small>
    </div>
    ${priceTag(st.cost * f)}
    ${left ? `<button class="btn small" data-take="${esc(b.id)}">Prendre</button>` : ''}
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
  const serreFrom = days.find((d) => d >= today && plan.serreOn(d, s));
  const serre = Boolean(serreFrom);

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
    ${isCurrent ? todayCard(today) : ''}
    ${serre ? `<div class="serre-banner">${icon('wallet')}<span><b>Petit budget</b>${s.serre ? '' : serreFrom <= today ? ' jusqu’à la fin du mois' : ` à partir de ${calc.relDay(serreFrom).toLowerCase()}`} : Gamelle propose des plats équilibrés au plus bas prix, en partant de ce que tu as.</span>${s.serre ? '<button class="btn small" data-serre-off>Arrêter</button>' : ''}</div>` : ''}
    ${isCurrent && !empty ? tonightCard(today, s) : ''}
    ${empty ? `<section class="block soft start-week">
        <p class="start-title">Semaine vide</p>
        <p>Gamelle peut te proposer des repas selon ton objectif, ton temps de cuisine et ton matériel. Le soir, les plats sont prévus en 2 portions : Gamelle te propose ensuite de garder la seconde pour le lendemain midi, tu choisis.</p>
        <div class="row-actions"><button class="btn primary" data-fill>${icon('shuffle')} Proposer la semaine</button><a class="btn" href="#/quoi">${icon('box')} Avec ce que j’ai</a></div>
      </section>` : `
      <div class="figures">
        <div class="figure"><span class="fig-value">${esc(calc.fmtEur(ws.cost).replace(/\s€$/, ''))}<small>€</small></span><span class="fig-label">cette semaine${ws.homeAvg != null ? `, ${esc(calc.fmtEur(ws.homeAvg))} le repas` : ''}</span></div>
        <div class="figure"><span class="fig-value">${calc.fmt0(avgKcal)}<small>kcal</small></span><span class="fig-label">par jour${tg.ready ? `, objectif ${calc.fmt0(tg.kcal)}` : ''}</span></div>
        ${sav && sav.days ? `<div class="figure is-saved"><span class="fig-value">${esc(calc.fmtEur0(sav.saved).replace(/\s€$/, ''))}<small>€</small></span><span class="fig-label">économisés sur tes commandes</span></div>` : ''}
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
          <div class="meals">${slots.map((slot) => mealRow(d, slot, s)).join('')}${snackRow(d)}</div>
          <div class="day-extra">${extra.map((sl) => `<button class="link-btn" data-slot="${sl}" data-day="${d}">${icon('add')} ${esc(plan.SLOT_LABELS[sl])}</button>`).join('')}${plan.snacksOf(d).length ? '' : `<button class="link-btn is-crack" data-crack-day="${d}">${icon('spark')} Craquage</button>`}</div>
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
    if (await todayClick(e, ctx)) return;
    const dr = e.target.closest('[data-dessert-day]');
    if (dr) {
      await dessertSheet(dr.dataset.dessertDay, dr.dataset.dessertSlot);
      return ctx.render();
    }
    const cr = e.target.closest('[data-crack-day]');
    if (cr) {
      if (await craquageSheet(cr.dataset.crackDay)) ctx.render();
      return;
    }
    if (e.target.closest('[data-serre-off]')) {
      calc.saveSettings({ serre: false });
      toast('Petit budget arrêté. Les prochaines propositions reprennent leur rythme habituel.');
      return ctx.render();
    }
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
        ...(r && !r.base ? [{ label: 'Modifier mon gâteau', value: 'edit', icon: 'edit' }] : []),
        { label: 'Changer de gâteau', value: 'swap', icon: 'shuffle' },
        { label: b.done ? 'Annuler « préparé »' : 'Marquer comme préparé', value: 'done', icon: 'check' },
        { label: 'Prendre des parts', value: 'take', icon: 'add' },
        ...(plan.bakeUsed(b.id) ? [{ label: 'Retirer les parts prévues à partir d’aujourd’hui', value: 'release', icon: 'minus' }] : []),
        { label: 'Retirer', value: 'del', icon: 'trash', danger: true },
      ]);
      if (c === 'open') ctx.go(`/recettes/${r.id}?p=${r.serves}`);
      if (c === 'edit') {
        const nid = await myCakeSheet(r.id);
        // le nombre de parts prévu suit la recette modifiée
        if (nid) plan.patchBake(b.id, { parts: Math.max(plan.bakeUsed(b.id), food.recipe(nid).serves) });
      }
      if (c === 'swap') {
        // Même place dans la semaine, mêmes parts déjà prévues : seule la recette change
        let nid = await pickRecipe({ title: 'Changer de gâteau', cats: ['dessert'], only: food.isLot, create: 'Créer mon gâteau, avec mes ingrédients' });
        if (nid === '__create') nid = await myCakeSheet();
        if (nid) {
          plan.patchBake(b.id, { recipe: nid, parts: Math.max(plan.bakeUsed(b.id), food.recipe(nid).serves) });
          toast(`Remplacé par ${food.recipe(nid).name}.`);
        }
      }
      if (c === 'done') {
        plan.setBakeDone(b, !b.done);
        toast(b.done ? 'Remis « à préparer ».' : 'Préparé. Les réserves ont été mises à jour.');
      }
      if (c === 'take') await takeSheet(b, today);
      if (c === 'release') {
        const n = plan.releaseBake(b.id, today);
        toast(n ? `${calc.fmt1(n)} part${n > 1 ? 's' : ''} libérée${n > 1 ? 's' : ''} : place-les où tu veux.` : 'Aucune part prévue à partir d’aujourd’hui.');
      }
      if (c === 'del' && await confirmSheet('Retirer ce dessert ?', 'Les parts prévues en dessert seront retirées des repas.', { ok: 'Retirer', danger: true })) plan.removeBake(b.id);
      return ctx.render();
    }
    const tk = e.target.closest('[data-take]');
    if (tk) {
      const b = plan.bakes().find((x) => x.id === tk.dataset.take);
      if (b && await takeSheet(b, today)) ctx.render();
      return;
    }
    if (e.target.closest('[data-add-bake]')) {
      let id = await pickRecipe({ title: 'Dessert de la semaine', cats: ['dessert'], only: food.isLot, create: 'Créer mon gâteau, avec mes ingrédients' });
      if (id === '__create') id = await myCakeSheet();
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
        { label: s.serre ? 'Arrêter le petit budget' : 'Petit budget (fin de mois difficile)', value: 'serre', icon: 'wallet' },
        { label: 'Réglages des propositions', value: 'prefs', icon: 'sliders' },
      ]);
      if (c === 'prefs') ctx.go('/preferences');
      else if (c === 'serre') {
        calc.saveSettings({ serre: !s.serre });
        if (s.serre) {
          toast('Petit budget arrêté.');
          return ctx.render();
        }
        const ok = await confirmSheet('Petit budget activé', 'Les prochaines propositions privilégient des plats équilibrés au plus bas prix, et ce que tu as déjà à la maison. Reproposer les repas de cette semaine qui ne sont pas encore cuisinés ?', { ok: 'Reproposer' });
        if (ok) {
          plan.generate(start, 'replace');
          toast('Semaine reproposée en petit budget.');
        }
        ctx.render();
      } else if (c) generate(c);
    }
  });
}

// Prendre des parts du dessert de la semaine : le jour (passé compris), le repas, combien.
async function takeSheet(b, today) {
  const r = food.recipe(b.recipe);
  const left = b.parts - plan.bakeUsed(b.id);
  if (!r || left <= 0) {
    toast('Plus aucune part de ce gâteau.', { kind: 'error' });
    return false;
  }
  const days = Array.from({ length: 18 }, (_, i) => calc.addDays(b.day, i - 7));
  const res = await openSheet({
    title: `${r.name}`,
    body: `<form class="form" data-form>
      <div class="field-row">
        <label class="field"><span>Jour</span><select name="day">${days.map((d) => `<option value="${d}" ${d === today ? 'selected' : ''}>${esc(calc.relDay(d))}${calc.relDay(d) === calc.fmtDayName(d) ? '' : ` (${esc(calc.fmtShort(d))})`}</option>`).join('')}</select></label>
        <label class="field"><span>Repas</span><select name="slot">${['petitdej', 'midi', 'collation', 'soir'].map((sl) => `<option value="${sl}" ${sl === (new Date().getHours() < 11 ? 'petitdej' : new Date().getHours() < 16 ? 'collation' : 'soir') ? 'selected' : ''}>${esc(plan.SLOT_LABELS[sl])}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Nombre de parts</span><select name="n">${Array.from({ length: Math.min(8, left * 2) }, (_, i) => (i + 1) / 2).filter((n) => n <= left).map((n) => `<option value="${n}" ${n === 1 ? 'selected' : ''}>${food.fmtCount(n)} part${n > 1 ? 's' : ''}</option>`).join('')}</select></label>
      <p class="field-help">Il reste ${left} part${left > 1 ? 's' : ''}. Elles s’ajoutent à ce qui est déjà prévu à ce repas ; s’il n’y a rien, le repas ne contiendra que le gâteau.</p>
    </form>`,
    actions: [
      { label: 'Annuler', value: null },
      { label: 'Prendre', kind: 'primary', handler: (el) => formData(el) },
    ],
  });
  if (!res) return false;
  const m = plan.getMeal(res.day, res.slot);
  const n = Number(res.n) || 1;
  // même gâteau déjà pris à ce repas : on additionne
  const total = m && m.cake === b.id ? plan.cakeParts(m) + n : n;
  plan.takeCake(res.day, res.slot, b.id, Math.min(total, left + (m && m.cake === b.id ? plan.cakeParts(m) : 0)));
  toast(`${food.fmtCount(n)} part${n > 1 ? 's' : ''} : ${plan.SLOT_LABELS[res.slot].toLowerCase()}, ${calc.relDay(res.day).toLowerCase()}.`);
  return true;
}
