// Mode cuisine : une étape à la fois, en grand, écran allumé, minuteurs à portée de main.
import * as calc from '../calc.js';
import * as food from '../food.js';
import * as plan from '../plan.js';
import { esc, icon, openSheet, toast } from '../ui.js';

export function renderCook(view, ctx, id) {
  const r = food.recipe(id);
  if (!r) {
    ctx.go('/recettes');
    return;
  }
  const portions = Number(ctx.query.p) || r.serves;
  const useMc = ctx.query.mc === '1' && r.mc;
  const steps = useMc ? r.mc : r.steps;
  const mealKey = ctx.query.meal || null;
  const factor = portions / r.serves;
  let i = 0;
  const checked = new Set();
  ctx.wake.enable();

  const back = () => {
    if (history.length > 1) history.back();
    else ctx.go(`/recettes/${r.id}`);
  };

  const ingredientsHtml = () => `<ul class="ing-list checkable">${r.ing.map(([iid, q], k) => {
    const l = food.ingLine(iid, q * factor);
    return `<li><label><input type="checkbox" data-ck="${k}" ${checked.has(k) ? 'checked' : ''}><span class="ing-qty">${esc(l.qty)}</span><span class="ing-name">${esc(l.name)}</span></label></li>`;
  }).join('')}</ul>`;

  const draw = () => {
    const st = steps[i];
    const last = i === steps.length - 1;
    view.innerHTML = `
      <div class="cook">
        <header class="cook-head">
          <button class="icon-btn" data-close aria-label="Quitter le mode cuisine">${icon('close')}</button>
          <div class="cook-title"><p>${esc(r.name)}</p><small>${portions} portion${portions > 1 ? 's' : ''}${useMc ? ', Monsieur Cuisine' : ''}</small></div>
          <button class="btn small" data-ing>Ingrédients</button>
        </header>
        <div class="cook-progress" aria-hidden="true">${steps.map((_, k) => `<span class="${k < i ? 'is-done' : k === i ? 'is-now' : ''}"></span>`).join('')}</div>
        <main class="cook-body">
          <p class="cook-count">Étape ${i + 1} sur ${steps.length}</p>
          <p class="cook-step">${esc(st.t)}</p>
          ${st.s ? `<button class="btn cook-timer" data-timer="${st.s}">${icon('timer')} Lancer ${esc(calc.fmtMinutes(st.s))}</button>` : ''}
          ${i === 0 ? `<details class="cook-ing"><summary>Préparer les ingrédients</summary>${ingredientsHtml()}</details>` : ''}
        </main>
        <footer class="cook-nav">
          <button class="btn" data-prev ${i === 0 ? 'disabled' : ''}>${icon('back')} Précédente</button>
          ${last ? `<button class="btn primary" data-finish>${icon('check')} Terminé</button>` : `<button class="btn primary" data-next>Suivante ${icon('next')}</button>`}
        </footer>
      </div>`;
  };

  const finish = () => {
    if (mealKey) {
      const [day, slot] = mealKey.split(':');
      const m = plan.getMeal(day, slot);
      if (m && m.kind === 'recette' && !m.done) plan.setDone(m, true);
    }
    toast(mealKey ? 'Bon appétit ! Mets la gamelle au frigo dès que c’est tiède.' : 'Bon appétit !');
    ctx.go(mealKey ? `/semaine/${calc.weekStart(mealKey.split(':')[0])}` : `/recettes/${r.id}`);
  };

  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return back();
    if (e.target.closest('[data-prev]')) { i = Math.max(0, i - 1); return draw(); }
    if (e.target.closest('[data-next]')) { i = Math.min(steps.length - 1, i + 1); return draw(); }
    if (e.target.closest('[data-finish]')) return finish();
    const tm = e.target.closest('[data-timer]');
    if (tm) {
      ctx.timers.start(Number(tm.dataset.timer), `${r.name}, étape ${i + 1}`);
      toast(`Minuteur lancé : ${calc.fmtMinutes(Number(tm.dataset.timer))}.`, { duration: 1800 });
      return;
    }
    if (e.target.closest('[data-ing]')) {
      await openSheet({
        title: `Ingrédients, ${portions} portion${portions > 1 ? 's' : ''}`,
        body: ingredientsHtml(),
        onMount(el) {
          el.addEventListener('change', (ev) => {
            const k = Number(ev.target.dataset.ck);
            if (ev.target.checked) checked.add(k); else checked.delete(k);
          });
        },
      });
    }
  });
  view.addEventListener('change', (ev) => {
    if (ev.target.dataset.ck == null) return;
    const k = Number(ev.target.dataset.ck);
    if (ev.target.checked) checked.add(k); else checked.delete(k);
  });
  const onKey = (e) => {
    if (document.querySelector('.sheet-wrap')) return;
    if (e.key === 'ArrowRight' && i < steps.length - 1) { i++; draw(); }
    if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); }
  };
  document.addEventListener('keydown', onKey);
  ctx.onCleanup(() => document.removeEventListener('keydown', onKey));
  draw();
}
