// Carte « Aujourd'hui » de l'écran Semaine : créatine, shaker de whey, pesée,
// et un coup de pouce quand on a la flemme de cuisiner.
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as food from '../food.js';
import * as plan from '../plan.js';
import * as have from '../have.js';
import * as habits from '../habits.js';
import { esc, icon, openSheet, toast, formData, confirmSheet } from '../ui.js';
import { priceTag, prepSheet, outsideSheet } from './common.js';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function dots(test, today) {
  return habits.lastDays(today).map((d) => {
    const on = test(d);
    const label = `${calc.fmtDayName(d)} : ${on ? 'oui' : 'non'}`;
    return `<span class="hdot ${on ? 'is-on' : ''} ${d === today ? 'is-today' : ''}" title="${esc(label)}"><span class="sr-only">${esc(label)}</span><span aria-hidden="true">${LETTERS[calc.weekday(d)]}</span></span>`;
  }).join('');
}

function streakText(n) {
  if (!n) return '';
  return `<span class="habit-streak"><b>${n}</b> jour${n > 1 ? 's' : ''} d’affilée</span>`;
}

export function todayCard(today = calc.localDay()) {
  const s = calc.settings();
  const h = habits.config(s);
  const log = store.dayLog(today);
  const pending = habits.pending(today, s);
  const shake = habits.shakeStats(s);
  const n = log.shakes || 0;
  const items = [];
  if (h.creatine) {
    const on = log.creatine === true;
    items.push(`<div class="habit ${on ? 'is-done' : 'is-todo'}">
      <button class="habit-toggle" data-habit="creatine" aria-pressed="${on}">
        <span class="habit-check">${icon(on ? 'check' : 'scoop')}</span>
        <span class="habit-main"><span class="habit-name">Créatine</span>
          <small>${on ? 'Prise' : `À prendre : ${esc(h.dose)}`}</small></span>
      </button>
      ${streakText(habits.creatineStreak(today))}
      <span class="habit-dots" aria-label="7 derniers jours">${dots(habits.creatineTaken, today)}</span>
    </div>`);
  }
  if (h.whey) {
    const on = n > 0;
    items.push(`<div class="habit ${on ? 'is-done' : 'is-todo'}">
      <button class="habit-toggle" data-habit="whey" aria-pressed="${on}">
        <span class="habit-check">${icon(on ? 'check' : 'shaker')}</span>
        <span class="habit-main"><span class="habit-name">Shaker de whey</span>
          <small>${on ? `${n > 1 ? `${n} shakers, ` : 'Bu, '}${calc.fmt0(shake.p * n)} g de protéines comptés` : `À prendre : ${h.wheyG} g, ${calc.fmt0(shake.p)} g de protéines`}</small></span>
      </button>
      ${on ? `<button class="icon-btn small" data-shake-add aria-label="Ajouter un shaker">${icon('add')}</button>` : streakText(habits.wheyStreak(today))}
      <span class="habit-dots" aria-label="7 derniers jours">${dots((d) => habits.shakes(d) > 0, today)}</span>
    </div>`);
  }
  const w = log.weight;
  const actions = `<button class="pill-btn" data-weigh>${icon('scale')}<span>${w ? `<b>${esc(calc.fmt1(w))}</b> kg aujourd’hui` : 'Noter mon poids'}</span></button>
      <button class="pill-btn is-flemme" data-flemme>${icon('spark')}<span>J’ai la flemme</span></button>`;
  // Tout est pris : la carte se fait discrète, sur une seule rangée.
  if (items.length && !pending.length) {
    const cs = h.creatine ? habits.creatineStreak(today) : 0;
    return `<section class="today is-clear is-compact" aria-label="Aujourd’hui">
      <div class="today-line">
        ${h.creatine ? `<button class="pill-btn is-done" data-habit="creatine" aria-pressed="true">${icon('check')}<span>Créatine${cs > 1 ? `, <b>${cs}</b> jours` : ''}</span></button>` : ''}
        ${h.whey ? `<button class="pill-btn is-done" data-habit="whey" aria-pressed="true">${icon('check')}<span>Whey${n > 1 ? ` ×${n}` : ''}</span></button><button class="icon-btn small" data-shake-add aria-label="Ajouter un shaker">${icon('add')}</button>` : ''}
        ${actions}
      </div>
    </section>`;
  }
  return `<section class="today ${pending.length ? 'is-pending' : 'is-clear'}" aria-label="Aujourd’hui">
    <header class="today-head">
      <h2>Aujourd’hui</h2>
      <span class="today-state">${pending.length ? `${pending.length === 2 ? 'Deux choses' : 'Une chose'} à prendre` : ''}</span>
    </header>
    ${items.length ? `<div class="habits">${items.join('')}</div>` : ''}
    <div class="today-actions">${actions}</div>
  </section>`;
}

// Clics de la carte. Renvoie true si le clic a été traité.
export async function todayClick(e, ctx) {
  const today = calc.localDay();
  const hb = e.target.closest('[data-habit]');
  if (hb) {
    if (hb.dataset.habit === 'creatine') {
      const on = !habits.creatineTaken(today);
      habits.setCreatine(today, on);
      const n = habits.creatineStreak(today);
      if (on) toast(n > 1 ? `Créatine prise. ${n} jours d’affilée.` : 'Créatine prise.');
      else toast('Créatine décochée.', { action: 'Annuler', onAction: () => { habits.setCreatine(today, true); ctx.render(); } });
    } else {
      const on = habits.shakes(today) === 0;
      habits.setShakes(today, on ? 1 : 0);
      if (on) toast(`Shaker noté : ${calc.fmt0(habits.shakeStats().p)} g de protéines ajoutés à ta journée.`);
      else toast('Shaker décoché.', { action: 'Annuler', onAction: () => { habits.setShakes(today, 1); ctx.render(); } });
    }
    ctx.render();
    return true;
  }
  if (e.target.closest('[data-shake-add]')) {
    habits.setShakes(today, habits.shakes(today) + 1);
    toast(`${habits.shakes(today)} shakers aujourd’hui.`, { action: 'Annuler', onAction: () => { habits.setShakes(today, habits.shakes(today) - 1); ctx.render(); } });
    ctx.render();
    return true;
  }
  if (e.target.closest('[data-weigh]')) {
    if (await weightSheet()) ctx.render();
    return true;
  }
  if (e.target.closest('[data-flemme]')) {
    await flemmeSheet(ctx);
    ctx.render();
    return true;
  }
  return false;
}

// ---------- Pesée ----------
// Une pesée par jour. Choisir un autre jour permet d'ajouter un oubli.
export async function weightSheet(day = calc.localDay()) {
  const today = calc.localDay();
  const cur = store.dayLog(day).weight;
  const last = calc.weightSeries().filter((x) => x.day !== day).pop();
  const res = await openSheet({
    title: cur ? 'Modifier la pesée' : 'Noter mon poids',
    body: `<form class="form" data-form>
      <div class="field-row">
        <label class="field"><span>Jour</span><input type="date" name="day" value="${day}" max="${today}" required></label>
        <label class="field"><span>Poids (kg)</span><input name="w" inputmode="decimal" autocomplete="off" value="${esc(calc.numInput(cur ?? null))}" placeholder="${last ? esc(calc.numInput(last.weight)) : 'Ex. : 77,5'}" autofocus></label>
      </div>
      <p class="field-help">Une pesée par jour : en noter une autre le même jour la remplace. Le mieux : le matin, à jeun, après être passé aux toilettes. Ton poids bouge d’un jour à l’autre (eau, sel, repas) : Gamelle suit surtout la moyenne sur 7 jours.</p>
    </form>`,
    actions: [
      ...(cur ? [{ label: 'Supprimer', value: 'del', kind: 'ghost danger' }] : [{ label: 'Annuler', value: null }]),
      {
        label: 'Enregistrer', kind: 'primary',
        handler(el) {
          const f = formData(el);
          const w = calc.parseNum(f.w);
          const d = /^\d{4}-\d{2}-\d{2}$/.test(f.day) && f.day <= today ? f.day : day;
          if (!w || w < 25 || w > 400) {
            toast('Indique un poids en kg, par exemple 77,5.', { kind: 'error' });
            return false;
          }
          const replaced = store.dayLog(d).weight != null && d !== day;
          store.saveWeight(d, w);
          toast(d === today ? 'Pesée du jour enregistrée.' : `Pesée du ${calc.fmtShort(d)} ${replaced ? 'remplacée' : 'enregistrée'}.`);
          return true;
        },
      },
    ],
  });
  if (res === 'del') {
    if (await confirmSheet('Supprimer cette pesée ?', `${calc.fmt1(cur)} kg, ${calc.fmtLong(day).toLowerCase()}.`, { ok: 'Supprimer', danger: true })) {
      store.removeWeight(day);
      return true;
    }
    return false;
  }
  return Boolean(res);
}

// ---------- Flemme ----------
function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Un mot d'encouragement, avec de vrais chiffres quand on en a.
export function encouragement(m, s = calc.settings(), when = 'ce soir') {
  const When = when.charAt(0).toUpperCase() + when.slice(1);
  const today = calc.localDay();
  const r = m && m.kind === 'recette' ? food.recipe(m.recipe) : null;
  const st = m && plan.isCooked(m) ? plan.mealStats(m, s) : null;
  const d = calc.dayToDate(today);
  const monthStart = calc.localDay(new Date(d.getFullYear(), d.getMonth(), 1));
  const sav = plan.savings(monthStart, today);
  const out = [
    'Commence juste par mettre l’eau à chauffer. Le plus dur, c’est de se lever.',
    'Pas besoin d’un grand repas : des pâtes, deux œufs, un peu de fromage. Dix minutes et c’est réglé.',
    'Mets un son, lance un minuteur, et dans vingt minutes c’est fini.',
    'Fais la première étape, rien de plus. Une fois lancé, le reste suit tout seul.',
    `${When}, la version simple suffit. Un repas fait maison même basique, c’est déjà gagné.`,
  ];
  if (r && r.time) out.push(`Ton plat prévu prend ${r.time} minutes. Entre la commande et la livraison, tu attendrais à peu près autant.`);
  if (st && st.cost < s.uber.avg) out.push(`Cuisiner ${when} te coûte ${calc.fmtEur(st.cost)}. La commande, ce serait autour de ${calc.fmtEur0(s.uber.avg)}.`);
  if (st && st.p >= 30) out.push(`Ton plat prévu, c’est ${calc.fmt0(st.p)} g de protéines. Après l’entraînement, tes muscles disent merci.`);
  if (sav && sav.saved >= 5) out.push(`Tu as déjà mis environ ${calc.fmtEur0(sav.saved)} de côté ce mois-ci en cuisinant. ${When} peut en ajouter ${calc.fmtEur0(Math.max(0, s.uber.avg - (st ? st.cost : 3)))}.`);
  if (m && (m.cooked ?? 1) > (m.portions ?? 1)) out.push('Et en prime, il t’en restera une portion pour la gamelle de demain midi.');
  // les messages chiffrés passent plus souvent
  const numbered = out.slice(5);
  return numbered.length && Math.random() < 0.65 ? pickOne(numbered) : pickOne(out);
}

// Ce qu'on peut faire de plus rapide : recettes courtes avec ce qu'il y a, ou une assiette express.
function quickOptions(s) {
  const ranked = have.rank().filter((x) => x.r.time <= 20 && x.missing.length <= 1)
    .sort((a, b) => a.missing.length - b.missing.length || a.r.time - b.r.time);
  const out = ranked.slice(0, 2).map((x) => ({ r: x.r, missing: x.missing }));
  if (out.length < 2) {
    for (const r of food.recipes().filter((x) => x.cat === 'diner' && x.time <= 20 && food.usable(x, s)).sort((a, b) => a.time - b.time)) {
      if (out.length >= 2) break;
      if (!out.some((o) => o.r.id === r.id)) out.push({ r, missing: null });
    }
  }
  return out;
}

export async function flemmeSheet(ctx) {
  const s = calc.settings();
  const today = calc.localDay();
  const slot = new Date().getHours() < 15 ? 'midi' : 'soir';
  const m = plan.getMeal(today, slot);
  const cooked = m && plan.isCooked(m) && !m.done ? m : null;
  const quick = quickOptions(s).filter((o) => !cooked || o.r.id !== cooked.recipe);
  const plate = have.plateFromStock();
  const r = cooked && cooked.kind === 'recette' ? food.recipe(cooked.recipe) : null;
  const msg = encouragement(cooked, s, slot === 'midi' ? 'ce midi' : 'ce soir');
  const quickRow = (o) => {
    const st = food.recipeStats(o.r);
    const miss = o.missing == null ? '' : o.missing.length ? `, il te manque : ${o.missing.map((id) => food.ingredient(id)?.name.toLowerCase()).join(', ')}` : ', tu as tout';
    return `<button type="button" class="list-row" data-quick="${esc(o.r.id)}"><span class="list-main">${esc(o.r.name)}<small>${o.r.time} min, ${calc.fmt0(st.p)} g de protéines${esc(miss)}</small></span>${priceTag(st.cost)}</button>`;
  };
  const res = await openSheet({
    title: 'Flemme de cuisiner ?',
    wide: true,
    body: `<p class="pep">${icon('spark')}<span>${esc(msg)}</span></p>
      ${cooked ? `<div class="list"><button type="button" class="list-row is-main" data-go><span class="list-main">${esc(plan.mealTitle(cooked))}<small>Ton plat prévu${r ? `, ${r.time} min` : ''}</small></span><span class="btn small primary">${icon('pot')} Je m’y mets</span></button></div>` : ''}
      ${quick.length || plate ? `<h3 class="group-title">${cooked ? 'Ou plus rapide' : 'Le plus rapide'}</h3>
        <div class="list">
          ${plate ? `<button type="button" class="list-row" data-plate><span class="list-main">Assiette express : ${esc(food.compoTitle(plate.parts, plate.sauce).toLowerCase())}<small>Avec ce que tu as à la maison</small></span>${priceTag(food.compoStats(plate.parts, plate.sauce).cost)}</button>` : ''}
          ${quick.map(quickRow).join('')}
        </div>` : ''}
      <button type="button" class="btn ghost block" data-order>Tant pis, je commande</button>
      <p class="fine center">Ça arrive. La noter garde ton compteur d’économies honnête.</p>`,
    onMount(el, api) {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-go]')) return api.close({ go: true });
        const q = e.target.closest('[data-quick]');
        if (q) return api.close({ quick: q.dataset.quick });
        if (e.target.closest('[data-plate]')) return api.close({ plate: true });
        if (e.target.closest('[data-order]')) api.close({ order: true });
      });
    },
  });
  if (!res) return;
  if (res.go) {
    if (cooked.kind === 'compo') return prepSheet(cooked, ctx);
    return ctx.go(`/cuisine/${cooked.recipe}?p=${cooked.cooked ?? 1}&meal=${encodeURIComponent(cooked.id)}${cooked.mc ? '&mc=1' : ''}`);
  }
  if (res.quick) {
    const rq = food.recipe(res.quick);
    plan.setMeal(today, slot, { kind: 'recette', recipe: rq.id, portions: 1 });
    toast(`C’est parti : ${rq.name}.`, { action: 'Cuisiner', duration: 6000, onAction: () => ctx.go(`/cuisine/${rq.id}?p=${plan.getMeal(today, slot)?.cooked ?? 1}&meal=${encodeURIComponent(plan.mealId(today, slot))}`) });
    return;
  }
  if (res.plate) {
    plan.setMeal(today, slot, { kind: 'compo', parts: plate.parts, sauce: plate.sauce, portions: 1 });
    return prepSheet(plan.getMeal(today, slot), ctx);
  }
  if (res.order) return outsideSheet(today, slot, 'uber', null);
}
