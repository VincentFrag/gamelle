// Aliments : liste, prix, ajout facile (à la main ou depuis Open Food Facts), choix d'un aliment.
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as food from '../food.js';
import * as off from '../off.js';
import { esc, icon, openSheet, toast, formData } from '../ui.js';
import { priceTag } from './common.js';
import { RAYONS, UNITS } from '../clean.js';

// ---------- Familles pour l'assiette composée ----------
const FRUITS = new Set(['banane', 'pomme', 'clementine', 'kiwi', 'orange', 'poire', 'fruits_rouges', 'citron', 'citron_vert', 'compote']);
export const GROUP_LABELS = { feculent: 'Féculent', proteine: 'Protéine', legume: 'Légume', extra: 'En plus' };

// Famille probable d'un aliment, d'après ses valeurs nutritionnelles.
export function groupOf(ing) {
  if (!ing) return 'extra';
  const it = food.compoItem(ing.id);
  if (it) return it.group;
  const k = ing.kcal || 1;
  const pr = (ing.p * 4) / k, cr = (ing.c * 4) / k, fr = (ing.f * 9) / k;
  if (ing.p >= 8 && pr >= 0.3 && !ing.staple) return 'proteine';
  if (!FRUITS.has(ing.id) && ['legumes', 'surgeles'].includes(ing.rayon) && k < 60) return 'legume';
  if (cr >= 0.6 && fr < 0.3 && k >= 70 && !ing.staple && !FRUITS.has(ing.id) && ing.c >= 12) return 'feculent';
  return 'extra';
}

export function defaultQty(ing, group) {
  if (!ing) return 100;
  if (ing.unit === 'pc') return 1;
  return { feculent: 80, proteine: 120, legume: 150, extra: 30 }[group] || 100;
}

// ---------- Choisir un aliment ----------
// group : famille mise en avant quand la recherche est vide (assiette composée).
export async function pickIngredient({ title = 'Aliment', group = null } = {}) {
  let q = '';
  return openSheet({
    title,
    wide: true,
    body: `<label class="search"><span class="sr-only">Rechercher</span><input type="search" placeholder="Rechercher un aliment" data-q autocomplete="off" autofocus></label>
      <div class="list" data-results></div>
      <div class="add-food">
        <p class="group-title">Pas dans la liste ?</p>
        <div class="row-actions">
          <button type="button" class="btn primary" data-off>${icon('search')} Chercher sur Open Food Facts</button>
          <button type="button" class="btn" data-new>${icon('edit')} Créer à la main</button>
        </div>
      </div>`,
    onMount(el, api) {
      const draw = () => {
        const nq = food.norm(q);
        let list = food.ingredients();
        if (nq) list = list.filter((i) => food.norm(i.name).includes(nq));
        else if (group) list = list.filter((i) => groupOf(i) === group);
        list = list.sort((a, b) => (nq ? food.norm(b.name).startsWith(nq) - food.norm(a.name).startsWith(nq) : 0) || a.name.localeCompare(b.name, 'fr')).slice(0, 80);
        el.querySelector('[data-results]').innerHTML = list.map((i) => `<button type="button" class="list-row" data-pick="${esc(i.id)}"><span class="list-main">${esc(i.name)}<small>${calc.fmt0(i.kcal)} kcal, ${calc.fmt1(i.p)} g de protéines pour 100 ${i.unit === 'ml' ? 'ml' : 'g'}${i.custom ? ', ajouté par toi' : ''}</small></span></button>`).join('')
          || `<p class="empty pad">Rien de tel dans tes aliments. Cherche-le sur Open Food Facts : calories et macros se remplissent toutes seules.</p>`;
      };
      el.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; draw(); });
      el.addEventListener('click', async (e) => {
        const p = e.target.closest('[data-pick]');
        if (p) return api.close(p.dataset.pick);
        if (e.target.closest('[data-off]')) {
          const id = await offSheet(q);
          if (id) api.close(id);
          return;
        }
        if (e.target.closest('[data-new]')) {
          const id = await editIngredient(null, { name: q });
          if (id) api.close(id);
        }
      });
      draw();
    },
  });
}

// ---------- Open Food Facts ----------
function offRow(it, i) {
  const bits = [it.brand, it.quantity].filter(Boolean).join(', ');
  return `<button type="button" class="list-row" data-hit="${i}"><span class="list-main">${esc(it.name)}<small>${bits ? `${esc(bits)}. ` : ''}${it.kcal != null ? `${calc.fmt0(it.kcal)} kcal` : 'kcal ?'}, ${calc.fmt1(it.p ?? 0)} g prot., ${calc.fmt1(it.c ?? 0)} g gluc., ${calc.fmt1(it.f ?? 0)} g lip. pour 100 g</small></span>${icon('add')}</button>`;
}

// Cherche un produit (par nom ou code-barres), puis ouvre la fiche pré-remplie. Renvoie l'id créé.
export async function offSheet(initial = '') {
  let hits = [];
  const res = await openSheet({
    title: 'Open Food Facts',
    wide: true,
    body: `<form class="off-form" data-search>
        <label class="search"><span class="sr-only">Nom ou code-barres</span><input type="search" name="q" value="${esc(initial)}" placeholder="Nom du produit ou code-barres" autocomplete="off" enterkeyhint="search" autofocus></label>
        <button class="btn primary" type="submit">${icon('search')} Chercher</button>
      </form>
      <p class="field-help">Tape le nom (ex. : skyr vanille) ou les chiffres sous le code-barres. Les valeurs viennent de la base collaborative Open Food Facts : jette un œil à l’étiquette si un chiffre te paraît bizarre.</p>
      <div data-off-results></div>`,
    onMount(el, api) {
      const box = el.querySelector('[data-off-results]');
      const run = async (q) => {
        q = q.trim();
        if (q.length < 2) return;
        box.innerHTML = '<p class="empty pad">Recherche…</p>';
        try {
          const digits = q.replace(/\s/g, '');
          if (/^\d{8,14}$/.test(digits)) {
            const it = await off.byCode(digits);
            hits = it ? [it] : [];
          } else hits = await off.search(q);
          box.innerHTML = hits.length
            ? `<div class="list off-list">${hits.map(offRow).join('')}</div><p class="fine">Données Open Food Facts, sous licence ODbL.</p>`
            : '<p class="empty pad">Aucun produit trouvé. Essaie un nom plus court, ou crée l’aliment à la main.</p>';
        } catch {
          box.innerHTML = '<p class="empty pad">Open Food Facts ne répond pas. Vérifie ta connexion, ou crée l’aliment à la main.</p>';
        }
      };
      el.querySelector('[data-search]').addEventListener('submit', (e) => {
        e.preventDefault();
        run(e.target.q.value);
      });
      el.addEventListener('click', (e) => {
        const h = e.target.closest('[data-hit]');
        if (h) api.close(hits[Number(h.dataset.hit)]);
      });
      if (initial.trim().length >= 2) run(initial);
    },
  });
  if (!res) return null;
  return editIngredient(null, {
    name: res.brand && !food.norm(res.name).includes(food.norm(res.brand)) ? `${res.name} (${res.brand})` : res.name,
    rayon: res.rayon, unit: 'g',
    kcal: res.kcal, p: res.p, c: res.c, f: res.f, fib: res.fib,
    src: res.code ? `Open Food Facts ${res.code}` : 'Open Food Facts',
  });
}

// ---------- Créer ou modifier un aliment perso ----------
export async function editIngredient(id, prefill = {}) {
  const cur = id ? food.ingredient(id) : { ...prefill };
  const v = (k) => esc(calc.numInput(cur?.[k] ?? null));
  const fromOff = Boolean(!id && prefill.src);
  const res = await openSheet({
    title: id ? 'Modifier l’aliment' : 'Nouvel aliment',
    wide: true,
    body: `<form class="form" data-form>
      ${fromOff ? `<p class="pep small ok">${icon('check')}<span>Valeurs remplies depuis Open Food Facts. Ajoute juste le prix si tu le connais.</span></p>` : ''}
      <label class="field"><span>Nom</span><input name="name" maxlength="80" value="${esc(cur?.name || '')}" required></label>
      <div class="field-row">
        <label class="field"><span>Rayon</span><select name="rayon">${RAYONS.map((r) => `<option value="${r}" ${(cur?.rayon || 'autre') === r ? 'selected' : ''}>${esc(food.RAYON_LABELS[r])}</option>`).join('')}</select></label>
        <label class="field"><span>Compté en</span><select name="unit">${UNITS.map((u) => `<option value="${u}" ${(cur?.unit || 'g') === u ? 'selected' : ''}>${esc(food.UNIT_LABELS[u])}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Poids d’une pièce (g), si compté en pièces</span><input name="pw" inputmode="decimal" value="${v('pw')}"></label>
      <div class="block-head"><p class="field-help nomargin">Valeurs pour 100 g, sur l’étiquette.</p>${fromOff ? '' : `<button type="button" class="btn small" data-fill>${icon('search')} Remplir avec Open Food Facts</button>`}</div>
      <div class="field-row four">
        <label class="field"><span>kcal</span><input name="kcal" inputmode="decimal" value="${v('kcal')}"></label>
        <label class="field"><span>Prot.</span><input name="p" inputmode="decimal" value="${v('p')}"></label>
        <label class="field"><span>Gluc.</span><input name="c" inputmode="decimal" value="${v('c')}"></label>
        <label class="field"><span>Lip.</span><input name="f" inputmode="decimal" value="${v('f')}"></label>
      </div>
      <input type="hidden" name="fib" value="${v('fib')}"><input type="hidden" name="src" value="${esc(cur?.src && cur.src !== 'ajouté par toi' ? cur.src : '')}">
      <label class="field"><span>Prix (€ le kg, le litre ou la pièce)</span><input name="price" inputmode="decimal" value="${v('price')}" placeholder="Facultatif"></label>
      <label class="switch"><input type="checkbox" name="staple" ${cur?.staple ? 'checked' : ''}><span>Produit de placard<small>Toujours à la maison : il apparaît « à vérifier » dans la liste de courses.</small></span></label>
      ${cur?.src && cur.src !== 'ajouté par toi' ? `<p class="fine">Source : ${esc(cur.src)}.</p>` : ''}
    </form>`,
    onMount(el) {
      el.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-fill]')) return;
        const f = formData(el);
        let hit = null;
        const res2 = await openSheet({
          title: 'Open Food Facts',
          wide: true,
          body: `<div data-r><p class="empty pad">Recherche de « ${esc(f.name)} »…</p></div>`,
          onMount(el2, api2) {
            let hits = [];
            off.search(f.name).then((h) => {
              hits = h;
              el2.querySelector('[data-r]').innerHTML = h.length ? `<div class="list">${h.map(offRow).join('')}</div>` : '<p class="empty pad">Aucun produit trouvé avec ce nom.</p>';
            }).catch(() => { el2.querySelector('[data-r]').innerHTML = '<p class="empty pad">Open Food Facts ne répond pas.</p>'; });
            el2.addEventListener('click', (ev) => {
              const h = ev.target.closest('[data-hit]');
              if (h) { hit = hits[Number(h.dataset.hit)]; api2.close(true); }
            });
          },
        });
        if (!res2 || !hit) return;
        for (const k of ['kcal', 'p', 'c', 'f', 'fib']) el.querySelector(`[name=${k}]`).value = calc.numInput(hit[k] ?? null);
        el.querySelector('[name=src]').value = hit.code ? `Open Food Facts ${hit.code}` : 'Open Food Facts';
        toast('Valeurs remplies.');
      });
    },
    actions: [
      { label: 'Annuler', value: null },
      {
        label: 'Enregistrer', kind: 'primary',
        handler(el) {
          const f = formData(el);
          if (!f.name.trim()) {
            toast('Donne un nom à l’aliment.', { kind: 'error' });
            return false;
          }
          const nid = id || `x-${store.uuid().slice(0, 8)}`;
          store.put('ingredient', nid, {
            custom: true, name: f.name.trim(), rayon: f.rayon, unit: f.unit,
            pw: calc.parseNum(f.pw), kcal: calc.parseNum(f.kcal) || 0, p: calc.parseNum(f.p) || 0,
            c: calc.parseNum(f.c) || 0, f: calc.parseNum(f.f) || 0, fib: calc.parseNum(f.fib) || 0,
            price: calc.parseNum(f.price) || 0, staple: f.staple, src: f.src || null,
          });
          toast(id ? 'Aliment modifié.' : `${f.name.trim()} ajouté à tes aliments.`);
          return nid;
        },
      },
    ],
  });
  return res;
}

// ---------- Prix d'un aliment de base ----------
export async function priceSheet(ing) {
  const base = food.baseIngredient(ing.id);
  const res = await openSheet({
    title: ing.name,
    body: `<form class="form" data-form>
      <label class="field big"><span>Prix (€ ${esc(food.priceUnit(ing))})</span><input name="price" inputmode="decimal" value="${esc(calc.numInput(ing.price))}" autofocus></label>
      <p class="field-help">Estimation de départ : ${esc(calc.fmtEur(base.price))} ${esc(food.priceUnit(ing))}. Sur un ticket, le prix au kilo ou au litre est indiqué sous le prix du produit.</p>
      <label class="field"><span>Vendu par (quantité en ${esc(food.UNIT_LABELS[ing.unit])}, vide = au poids)</span><input name="buy" inputmode="decimal" value="${esc(calc.numInput(ing.buy))}"></label>
      <label class="switch"><input type="checkbox" name="staple" ${ing.staple ? 'checked' : ''}><span>Produit de placard (à vérifier, pas à acheter)</span></label>
      <p class="fine">Valeurs pour 100 g : ${calc.fmt0(ing.kcal)} kcal, ${calc.fmt1(ing.p)} g de protéines, ${calc.fmt1(ing.c)} g de glucides, ${calc.fmt1(ing.f)} g de lipides. Source : ${esc(ing.src || '')}.</p>
    </form>`,
    actions: [
      { label: 'Prix d’origine', value: 'reset' },
      { label: 'Enregistrer', kind: 'primary', handler: (el) => formData(el) },
    ],
  });
  if (res === 'reset') store.remove('ingredient', ing.id);
  else if (res) {
    const buy = calc.parseNum(res.buy);
    store.put('ingredient', ing.id, {
      price: calc.parseNum(res.price) ?? base.price,
      buy: buy || null,
      buyLabel: buy && buy === base.buy ? base.buyLabel : buy ? food.fmtQty(ing, buy) : '',
      staple: res.staple,
    });
  }
  return res;
}

export async function openIngredient(id) {
  const ing = food.ingredient(id);
  if (!ing) return null;
  return ing.custom ? editIngredient(id) : priceSheet(ing);
}

// ---------- Écran « Aliments et prix » ----------
export function renderAliments(view, ctx, { back = '/plus', title = 'Aliments et prix' } = {}) {
  let q = '';
  view.innerHTML = `
    ${ctx.pageHead(title, { back })}
    <p class="block-sub">Tous les aliments utilisés par les recettes et l’assiette composée. Touche-en un pour mettre le prix que tu paies vraiment, ou ajoute les tiens : par nom ou code-barres, les valeurs nutritionnelles se remplissent depuis Open Food Facts.</p>
    <div class="row-actions add-top">
      <button class="btn primary" data-off>${icon('add')} Ajouter un aliment</button>
      <button class="btn" data-new>${icon('edit')} À la main</button>
    </div>
    <label class="search page-search"><span class="sr-only">Rechercher</span>${icon('search')}<input type="search" placeholder="Rechercher parmi ${food.ingredients().length} aliments" data-q></label>
    <div data-list></div>`;
  const draw = () => {
    const nq = food.norm(q);
    const list = food.ingredients().filter((i) => !nq || food.norm(i.name).includes(nq));
    const mine = list.filter((i) => i.custom).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const row = (i) => `<button class="list-row" data-ing="${esc(i.id)}"><span class="list-main">${esc(i.name)}<small>${calc.fmt0(i.kcal)} kcal, ${calc.fmt1(i.p)} g prot. pour 100 g${i.price ? `, ${esc(calc.fmtEur(i.price))} ${esc(food.priceUnit(i))}` : ''}${i.edited ? ', prix modifié' : ''}</small></span>${i.price ? priceTag(i.price, { cls: i.edited || i.custom ? 'is-edited' : '' }) : ''}</button>`;
    const groups = food.RAYON_ORDER.map((r) => {
      const items = list.filter((i) => !i.custom && (i.rayon || 'autre') === r).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      if (!items.length) return '';
      return `<section class="block"><h2 class="group-title">${esc(food.RAYON_LABELS[r])}</h2><div class="list">${items.map(row).join('')}</div></section>`;
    }).join('');
    view.querySelector('[data-list]').innerHTML = (mine.length ? `<section class="block"><h2 class="group-title">Ajoutés par toi</h2><div class="list">${mine.map(row).join('')}</div></section>` : '')
      + (groups || (nq ? `<p class="empty">Aucun aliment ne correspond. <button class="link-btn inline" data-off>Le chercher sur Open Food Facts</button></p>` : ''));
  };
  view.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; draw(); });
  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-off]')) {
      if (await offSheet(q)) draw();
      return;
    }
    if (e.target.closest('[data-new]')) {
      if (await editIngredient(null, { name: q })) draw();
      return;
    }
    const b = e.target.closest('[data-ing]');
    if (b) {
      await openIngredient(b.dataset.ing);
      draw();
    }
  });
  draw();
}
