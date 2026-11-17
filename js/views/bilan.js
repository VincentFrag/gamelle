// Écran « Bilan » : argent dépensé et économisé, calories et protéines, poids.
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as plan from '../plan.js';
import { esc, icon, toast } from '../ui.js';
import { priceTag, gauge } from './common.js';
import { weightSheet } from './today.js';
import { barChart, weightChart } from '../charts.js';

const view$ = { mode: 'semaine', offset: 0 };

function period() {
  const today = calc.localDay();
  if (view$.mode === 'semaine') {
    const start = calc.addDays(calc.weekStart(today), 7 * view$.offset);
    return { from: start, to: calc.addDays(start, 6), label: view$.offset === 0 ? 'Cette semaine' : `Semaine du ${calc.fmtWeek(start)}` };
  }
  const d = calc.dayToDate(today);
  const m = new Date(d.getFullYear(), d.getMonth() + view$.offset, 1);
  const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
  return { from: calc.localDay(m), to: calc.localDay(end), label: calc.fmtMonth(m), month: m };
}

export function renderBilan(view, ctx) {
  const s = calc.settings();
  const tg = calc.targets();
  const p = period();
  const st = plan.periodStats(p.from, p.to);
  const sav = plan.savings(p.from, p.to);
  const total = plan.savings('0000-01-01', '9999-12-31');
  const days = [];
  for (let d = p.from; d <= p.to; d = calc.addDays(d, 1)) days.push(d);
  const filled = days.map((d) => ({ d, st: plan.dayStats(d) })).filter((x) => x.st.n);
  const avgKcal = filled.length ? filled.reduce((n, x) => n + x.st.kcal, 0) / filled.length : 0;
  const avgP = filled.length ? filled.reduce((n, x) => n + x.st.p, 0) / filled.length : 0;
  const series = calc.weightSeries();
  const last = series[series.length - 1];
  const trend = calc.weightTrend(series);
  const recent = series.filter((x) => x.t >= Date.now() - 90 * calc.DAY_MS);
  const today = calc.localDay();
  const todayW = store.weights().find((w) => w.day === today);

  const perYear = total && total.days >= 7 ? (total.saved / total.days) * 365 : null;

  view.innerHTML = `
    ${ctx.pageHead('Bilan')}
    <div class="bilan-controls">
      <div class="seg" role="radiogroup" aria-label="Période">
        <button role="radio" aria-checked="${view$.mode === 'semaine'}" data-mode="semaine">Semaine</button>
        <button role="radio" aria-checked="${view$.mode === 'mois'}" data-mode="mois">Mois</button>
      </div>
      <div class="week-nav compact">
        <button class="icon-btn" data-shift="-1" aria-label="Période précédente">${icon('back')}</button>
        <span class="week-label">${esc(p.label)}</span>
        <button class="icon-btn" data-shift="1" aria-label="Période suivante" ${view$.offset >= 0 ? 'disabled' : ''}>${icon('next')}</button>
      </div>
    </div>

    <section class="saved-hero">
      ${sav && sav.days ? `
        <p class="saved-kicker">${sav.saved >= 0 ? 'Économisé par rapport à tes commandes' : 'Dépensé en plus par rapport à tes habitudes'}</p>
        <p class="saved-amount">${priceTag(Math.abs(sav.saved), { big: true, cls: sav.saved >= 0 ? 'is-saved' : 'is-uber' })}</p>
        <p class="saved-detail">Sur ${sav.days} jour${sav.days > 1 ? 's' : ''} suivi${sav.days > 1 ? 's' : ''}, tu aurais commandé environ ${calc.fmt1(sav.baseline)} fois. Tu as commandé ${sav.uber} fois. Un repas maison t’a coûté ${esc(calc.fmtEur(sav.homeAvg))}, contre ${esc(calc.fmtEur(s.uber.avg))} en livraison.</p>
        ${total && total.days ? `<p class="saved-total">Depuis le début : <b>${esc(calc.fmtEur0(total.saved))}</b>${perYear ? `. À ce rythme, environ ${esc(calc.fmtEur0(perYear))} par an.` : '.'}</p>` : ''}`
        : `<p class="saved-kicker">Économies</p><p class="saved-detail">Le compteur démarre dès qu’une journée passée contient des repas. Il compare à ton rythme d’avant : ${calc.fmt1(s.uber.perWeek)} commande${s.uber.perWeek > 1 ? 's' : ''} par semaine à ${esc(calc.fmtEur(s.uber.avg))} (<a href="#/preferences">modifier</a>).</p>`}
    </section>

    <section class="block">
      <h2 class="block-title">Dépenses</h2>
      <div class="figures quad">
        <div class="figure"><span class="fig-value">${esc(calc.fmtEur0(st.cost).replace(/\s€$/, ''))}<small>€</small></span><span class="fig-label">au total${p.month ? ' ce mois-ci' : ''}</span></div>
        <div class="figure"><span class="fig-value">${filled.length ? esc(calc.fmtEur(st.cost / filled.length).replace(/\s€$/, '')) : '–'}<small>€</small></span><span class="fig-label">par jour</span></div>
        <div class="figure"><span class="fig-value">${st.homeAvg != null ? esc(calc.fmtEur(st.homeAvg).replace(/\s€$/, '')) : '–'}<small>€</small></span><span class="fig-label">le repas maison</span></div>
        <div class="figure"><span class="fig-value">${st.uber}</span><span class="fig-label">commande${st.uber > 1 ? 's' : ''}${st.uber ? `, ${esc(calc.fmtEur0(st.uberCost))}` : ''}</span></div>
      </div>
      ${view$.mode === 'semaine' && filled.length ? `<p class="fine">Sur un mois à ce rythme : environ ${esc(calc.fmtEur0((st.cost / filled.length) * 30.4))}.</p>` : ''}
    </section>

    <section class="block">
      <h2 class="block-title">Calories et protéines</h2>
      ${filled.length ? `
        ${tg.ready ? gauge(avgKcal, tg.kcal, 'Calories par jour, en moyenne') + gauge(avgP, tg.p, 'Protéines par jour (g), en moyenne', 'prot') : `<p class="block-sub">Moyenne : ${calc.fmt0(avgKcal)} kcal et ${calc.fmt0(avgP)} g de protéines par jour. <a href="#/profil">Renseigne ton profil</a> pour comparer à un objectif.</p>`}
        <div class="chart-box" data-chart="kcal"></div>
        ${st.shakes ? `<p class="fine">Dont ${st.shakes} shaker${st.shakes > 1 ? 's' : ''} de whey sur la période.</p>` : ''}
        ${st.partial ? '<p class="fine">Les commandes et repas libres comptent pour leurs calories estimées, sans détail des protéines.</p>' : ''}`
        : '<p class="empty">Pas encore de repas sur cette période.</p>'}
    </section>

    <section class="block" id="poids">
      <div class="block-head"><h2 class="block-title">Poids</h2><button class="btn small primary" data-weigh>${icon('add')} ${todayW ? 'Modifier la pesée du jour' : 'Pesée du jour'}</button></div>
      ${last ? `<div class="figures compact">
        <div class="figure"><span class="fig-value">${esc(calc.fmt1(last.avg))}<small>kg</small></span><span class="fig-label">moyenne sur 7 jours</span></div>
        <div class="figure"><span class="fig-value">${trend == null ? '–' : esc(calc.fmtSigned(trend, 2))}<small>kg</small></span><span class="fig-label">${trend == null ? 'par semaine (dès 4 pesées sur 4 semaines)' : 'par semaine, tendance sur 4 semaines'}</span></div>
      </div>
      ${recent.length > 1 ? '<div class="chart-box" data-chart="weight"></div><p class="chart-legend"><span class="lg-dot"></span> pesées <span class="lg-line"></span> moyenne sur 7 jours</p>' : ''}
      <h3 class="group-title">Tes pesées</h3>
      <div class="list weigh-list">${series.slice(-14).reverse().map((x) => `<button class="list-row" data-weigh-day="${x.day}"><span class="list-main">${esc(calc.relDay(x.day) === calc.fmtDayName(x.day) ? calc.fmtLong(x.day) : `${calc.relDay(x.day)}, ${calc.fmtShort(x.day)}`)}</span><span class="weigh-val"><b>${esc(calc.fmt1(x.weight))}</b> kg</span>${icon('chevron', 'row-chevron')}</button>`).join('')}</div>
      ${series.length > 14 ? `<p class="fine">${series.length} pesées au total, les 14 dernières sont affichées.</p>` : ''}`
      : '<p class="empty">Aucune pesée pour l’instant. Note ton poids ici ou depuis la carte « Aujourd’hui » de l’écran Semaine.</p>'}
      <p class="fine">Une pesée par jour, idéalement le matin à jeun. Le poids varie d’un jour à l’autre (eau, sel, repas) : regarde surtout la moyenne sur 7 jours. Une perte d’environ 0,5 % du poids par semaine est un rythme durable.</p>
    </section>`;

  const kcalBox = view.querySelector('[data-chart="kcal"]');
  if (kcalBox) {
    let bars;
    if (view$.mode === 'semaine') bars = days.map((d) => ({ label: calc.fmtWd(d), value: plan.dayStats(d).kcal }));
    else {
      bars = [];
      for (let w = calc.weekStart(p.from); w <= p.to; w = calc.addDays(w, 7)) {
        const ds = calc.weekDays(w).filter((d) => d >= p.from && d <= p.to).map((d) => plan.dayStats(d)).filter((x) => x.n);
        bars.push({ label: calc.fmtShort(w), value: ds.length ? ds.reduce((n, x) => n + x.kcal, 0) / ds.length : 0 });
      }
    }
    barChart(kcalBox, { bars, target: tg.ready ? tg.kcal : null, unit: 'kcal' });
  }
  const wBox = view.querySelector('[data-chart="weight"]');
  if (wBox) weightChart(wBox, recent.map((x) => ({ t: x.t, y: x.weight, avg: x.avg })));

  view.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) {
      view$.mode = m.dataset.mode;
      view$.offset = 0;
      return ctx.render();
    }
    const sh = e.target.closest('[data-shift]');
    if (sh && !sh.disabled) {
      view$.offset = Math.min(0, view$.offset + Number(sh.dataset.shift));
      ctx.render();
    }
    const wd = e.target.closest('[data-weigh-day]');
    if (wd) {
      if (await weightSheet(wd.dataset.weighDay)) ctx.render();
      return;
    }
    if (e.target.closest('[data-weigh]') && await weightSheet()) ctx.render();
  });
}
