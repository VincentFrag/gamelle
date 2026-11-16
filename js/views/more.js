// Écrans « Plus » : profil et objectif, préférences, prix, compte, sauvegarde, aide.
import * as store from '../store.js';
import * as sync from '../sync.js';
import * as calc from '../calc.js';
import * as food from '../food.js';
import { esc, icon, openSheet, confirmSheet, toast, formData } from '../ui.js';
import { pickIngredient, editIngredient } from './recipes.js';
import { priceTag } from './common.js';

export function renderMore(view, ctx) {
  const tg = calc.targets();
  const rows = [
    ['profil', 'user', 'Profil et objectif', tg.ready ? `${calc.fmt0(tg.kcal)} kcal et ${calc.fmt0(tg.p)} g de protéines par jour` : 'À compléter'],
    ['preferences', 'sliders', 'Préférences des menus', 'Repas, temps, matériel, commandes'],
    ['prix', 'euro', 'Prix des ingrédients', 'Corrige les prix avec ton ticket'],
    ['frigo', 'box', 'Ce que j’ai', 'Frigo, congélateur, placard, et quoi cuisiner avec'],
    ['placard', 'cart', 'Fonds de placard', 'Achats réguliers : yaourts, huile, farine…'],
    ['compte', 'sync', 'Compte et synchronisation', sync.state.email || (sync.isConfigured() ? 'Non connecté' : 'Sur cet appareil')],
    ['sauvegarde', 'save', 'Sauvegarde', 'Exporter ou importer tes données'],
    ['aide', 'help', 'Aide et sources', 'Comment sont faits les calculs'],
  ];
  view.innerHTML = `
    ${ctx.pageHead('Plus')}
    <div class="list menu-big">${rows.map(([href, ic, l, sub]) => `<a class="list-row" href="#/${href}">${icon(ic)}<span class="list-main">${esc(l)}<small>${esc(sub)}</small></span>${icon('chevron', 'row-chevron')}</a>`).join('')}</div>
    <section class="block">
      <h2 class="block-title">Apparence</h2>
      <div class="seg" role="radiogroup" aria-label="Thème">
        ${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => `<button role="radio" aria-checked="${calc.settings().theme === k}" data-theme="${k}">${l}</button>`).join('')}
      </div>
    </section>
    <section class="block">
      <div class="update-box"><span>Gamelle, version ${esc(ctx.version)}</span><button class="btn small" data-update>Rechercher une mise à jour</button></div>
    </section>`;
  view.addEventListener('click', async (e) => {
    const th = e.target.closest('[data-theme]');
    if (th) {
      calc.saveSettings({ theme: th.dataset.theme });
      ctx.applyTheme();
      ctx.render();
    }
    if (e.target.closest('[data-update]')) {
      try {
        const r = await ctx.checkUpdate();
        if (r === 'uptodate') toast('Tu as la dernière version.');
        else if (r === 'unsupported') toast('Mises à jour automatiques indisponibles ici.');
        else if (r === 'waiting') toast('Une mise à jour est prête : ferme puis rouvre l’app.');
      } catch {
        toast('Pas de connexion au serveur.', { kind: 'error' });
      }
    }
  });
}

// ---------- Profil ----------
export function renderProfile(view, ctx) {
  const draw = () => {
    const s = calc.settings();
    const p = s.profile;
    const tg = calc.targets();
    const lastW = calc.weightSeries().pop();
    view.innerHTML = `
      ${ctx.pageHead('Profil et objectif', { back: '/plus' })}
      <form class="form" data-form>
        <div class="field-row">
          <label class="field"><span>Sexe</span><select name="sex"><option value="">–</option><option value="h" ${p.sex === 'h' ? 'selected' : ''}>Homme</option><option value="f" ${p.sex === 'f' ? 'selected' : ''}>Femme</option></select></label>
          <label class="field"><span>Âge</span><input name="age" inputmode="numeric" value="${esc(p.age ?? '')}"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Taille (cm)</span><input name="height" inputmode="numeric" value="${esc(p.height ?? '')}"></label>
          <label class="field"><span>Poids (kg)</span><input name="weight" inputmode="decimal" value="${esc(calc.numInput(p.weight))}" placeholder="${lastW ? esc(calc.numInput(Math.round(lastW.avg * 10) / 10)) : ''}"></label>
        </div>
        ${lastW ? `<p class="field-help">Le calcul utilise ta moyenne de pesées sur 7 jours (${esc(calc.fmt1(lastW.avg))} kg). Le poids saisi ici ne sert que si tu n’as pas de pesée.</p>` : ''}
        <label class="field"><span>Activité</span><select name="activity">${calc.ACTIVITY.map(([v, l, d]) => `<option value="${v}" ${(p.activity || 1.55) === v ? 'selected' : ''}>${esc(l)} : ${esc(d)}</option>`).join('')}</select></label>
        <fieldset class="field"><legend>Objectif</legend>
          <div class="seg" role="radiogroup">
            ${[['perte', 'Perdre du poids'], ['maintien', 'Maintenir'], ['prise', 'Prendre du muscle']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${s.goal === k}" data-goal="${k}">${l}</button>`).join('')}
          </div>
        </fieldset>
        ${s.goal === 'perte' ? `<label class="field"><span>Déficit : ${s.deficit} % sous ta dépense</span><input type="range" name="deficit" min="10" max="25" step="5" value="${s.deficit}"></label>
          <p class="field-help">10 à 20 % reste confortable et préserve le muscle. Au-delà, la faim et la fatigue rendent le rythme difficile à tenir, surtout avec de l’endurance.</p>` : ''}
        <label class="field"><span>Protéines (g par kg de poids)</span><input name="proteinPerKg" inputmode="decimal" value="${esc(calc.numInput(s.proteinPerKg))}"></label>
        <p class="field-help">1,6 à 2,2 g/kg est la fourchette usuelle quand on fait de la musculation, la partie haute en période de perte de poids.</p>
        <label class="field"><span>Objectif de calories imposé (facultatif)</span><input name="kcalOverride" inputmode="numeric" value="${esc(s.kcalOverride ?? '')}" placeholder="Calcul automatique"></label>
        <button class="btn primary" type="submit">Enregistrer</button>
      </form>
      ${tg.ready ? `<section class="block soft target-box">
        <p class="block-title">Ton objectif par jour</p>
        <div class="figures compact">
          <div class="figure"><span class="fig-value">${calc.fmt0(tg.kcal)}<small>kcal</small></span><span class="fig-label">calories</span></div>
          <div class="figure"><span class="fig-value">${calc.fmt0(tg.p)}<small>g</small></span><span class="fig-label">protéines</span></div>
          <div class="figure"><span class="fig-value">${calc.fmt0(tg.c)}<small>g</small></span><span class="fig-label">glucides</span></div>
          <div class="figure"><span class="fig-value">${calc.fmt0(tg.f)}<small>g</small></span><span class="fig-label">lipides</span></div>
        </div>
        ${tg.tdee ? `<p class="fine">Dépense estimée : ${calc.fmt0(tg.tdee)} kcal par jour (métabolisme de base ${calc.fmt0(tg.bmr)} kcal, formule de Mifflin-St Jeor, multiplié par ton niveau d’activité). C’est une estimation : si ton poids ne bouge pas comme prévu après 2 à 3 semaines, ajuste de 100 à 200 kcal.</p>` : ''}
      </section>` : ''}`;
  };

  view.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goal]');
    if (g) {
      save();
      calc.saveSettings({ goal: g.dataset.goal });
      draw();
    }
  });
  view.addEventListener('input', (e) => {
    if (e.target.name === 'deficit') e.target.closest('label').querySelector('span').textContent = `Déficit : ${e.target.value} % sous ta dépense`;
  });
  const save = () => {
    const f = formData(view.querySelector('[data-form]'));
    const s = calc.settings();
    calc.saveSettings({
      profile: {
        ...s.profile,
        sex: f.sex || null,
        age: calc.parseNum(f.age),
        height: calc.parseNum(f.height),
        weight: calc.parseNum(f.weight),
        activity: calc.parseNum(f.activity),
      },
      deficit: f.deficit ? Number(f.deficit) : s.deficit,
      proteinPerKg: calc.parseNum(f.proteinPerKg) || s.proteinPerKg,
      kcalOverride: calc.parseNum(f.kcalOverride),
    });
  };
  view.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
    toast('Profil enregistré.');
    draw();
  });
  draw();
}

// ---------- Préférences ----------
export function renderPrefs(view, ctx) {
  const draw = () => {
    const s = calc.settings();
    view.innerHTML = `
      ${ctx.pageHead('Préférences des menus', { back: '/plus' })}
      <form class="form" data-form>
        <h2 class="block-title">Repas à prévoir</h2>
        <label class="switch"><input type="checkbox" name="petitdej" ${s.slots.petitdej ? 'checked' : ''}><span>Petit-déjeuner chaque jour<small>Désactivé, tu peux toujours en ajouter un depuis la semaine, le jour où tu en prends un.</small></span></label>
        <label class="switch"><input type="checkbox" name="collation" ${s.slots.collation ? 'checked' : ''}><span>Collation chaque jour<small>Proposée les jours où il manque des calories pour atteindre l’objectif. Désactivée, tu l’ajoutes à la main.</small></span></label>
        <label class="switch"><input type="checkbox" name="batch" ${s.batch ? 'checked' : ''}><span>Cuisiner 2 portions le soir<small>Gamelle te propose ensuite de garder la seconde pour le lendemain midi. Rien n’est ajouté sans ton accord.</small></span></label>

        <h2 class="block-title">Propositions</h2>
        <label class="field"><span>Temps de cuisine maximum en semaine (min)</span><input name="weekdayTime" inputmode="numeric" value="${esc(s.weekdayTime)}"></label>
        <div class="field-row">
          <label class="field"><span>Versions maison par semaine, au plus</span><input name="plaisir" inputmode="numeric" value="${esc(s.plaisir)}"></label>
          <label class="field"><span>Repas légers par semaine</span><input name="leger" inputmode="numeric" value="${esc(s.leger)}"></label>
        </div>
        <p class="field-help">Les versions maison de tes commandes (burger, tikka, pizza…) tombent de préférence le vendredi ou le samedi soir, et pas toutes les semaines.</p>

        <fieldset class="field"><legend>Matériel</legend><div class="checks">
          ${Object.entries(food.EQUIP_LABELS).map(([k, l]) => `<label class="switch"><input type="checkbox" name="eq-${k}" ${s.equip[k] !== false ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}
        </div></fieldset>
        <label class="switch"><input type="checkbox" name="preferMc" ${s.preferMc ? 'checked' : ''}><span>Afficher d’abord la version Monsieur Cuisine<small>Quand une recette en a une.</small></span></label>

        <h2 class="block-title">Aliments à éviter</h2>
        <div class="chips">${s.exclude.map((id) => `<button type="button" class="chip is-on" data-unexclude="${esc(id)}">${esc(food.ingredient(id)?.name || id)} ${icon('close')}</button>`).join('')}
          <button type="button" class="chip" data-exclude>${icon('add')} Ajouter</button></div>

        <h2 class="block-title">Commandes</h2>
        <p class="field-help">Sert à calculer ce que tu économises. Mets ton rythme d’avant Gamelle.</p>
        <div class="field-row">
          <label class="field"><span>Panier moyen (€)</span><input name="uberAvg" inputmode="decimal" value="${esc(calc.numInput(s.uber.avg))}"></label>
          <label class="field"><span>Commandes par semaine</span><input name="uberPerWeek" inputmode="decimal" value="${esc(calc.numInput(s.uber.perWeek))}"></label>
        </div>
        <label class="field"><span>Calories d’une commande (estimation)</span><input name="uberKcal" inputmode="numeric" value="${esc(s.uber.kcal)}"></label>
        <label class="field"><span>Début du suivi des économies</span><input type="date" name="start" value="${esc(s.start || '')}"></label>

        <h2 class="block-title">Cuisine</h2>
        <label class="switch"><input type="checkbox" name="wakeLock" ${s.wakeLock ? 'checked' : ''}><span>Garder l’écran allumé en mode cuisine</span></label>
        <label class="switch"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}><span>Sonnerie des minuteurs</span></label>
        <button class="btn primary" type="submit">Enregistrer</button>
      </form>`;
  };
  const save = () => {
    const f = formData(view.querySelector('[data-form]'));
    const s = calc.settings();
    calc.saveSettings({
      slots: { petitdej: f.petitdej, collation: f.collation },
      batch: f.batch,
      weekdayTime: calc.parseNum(f.weekdayTime) || s.weekdayTime,
      plaisir: calc.parseNum(f.plaisir) ?? s.plaisir,
      leger: calc.parseNum(f.leger) ?? s.leger,
      equip: Object.fromEntries(Object.keys(food.EQUIP_LABELS).map((k) => [k, f[`eq-${k}`]])),
      preferMc: f.preferMc,
      uber: { avg: calc.parseNum(f.uberAvg) ?? s.uber.avg, perWeek: calc.parseNum(f.uberPerWeek) ?? s.uber.perWeek, kcal: calc.parseNum(f.uberKcal) ?? s.uber.kcal },
      start: f.start || null,
      wakeLock: f.wakeLock,
      sound: f.sound,
    });
  };
  view.addEventListener('click', async (e) => {
    const u = e.target.closest('[data-unexclude]');
    if (u) {
      save();
      calc.saveSettings({ exclude: calc.settings().exclude.filter((x) => x !== u.dataset.unexclude) });
      return draw();
    }
    if (e.target.closest('[data-exclude]')) {
      save();
      const id = await pickIngredient();
      if (id) calc.saveSettings({ exclude: [...new Set([...calc.settings().exclude, id])] });
      draw();
    }
  });
  view.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
    toast('Préférences enregistrées.');
    ctx.go('/plus');
  });
  draw();
}

// ---------- Prix ----------
export function renderPrices(view, ctx) {
  let q = '';
  view.innerHTML = `
    ${ctx.pageHead('Prix des ingrédients', { back: '/plus' })}
    <p class="block-sub">Prix moyens estimés pour la France. Touche un ingrédient pour mettre le prix que tu paies vraiment : toutes les recettes et listes se mettent à jour.</p>
    <label class="search page-search"><span class="sr-only">Rechercher</span>${icon('search')}<input type="search" placeholder="Rechercher" data-q></label>
    <div data-list></div>
    <button class="btn ghost block" data-new>${icon('add')} Créer un ingrédient</button>`;
  const draw = () => {
    const nq = food.norm(q);
    const list = food.ingredients().filter((i) => !nq || food.norm(i.name).includes(nq));
    view.querySelector('[data-list]').innerHTML = food.RAYON_ORDER.map((r) => {
      const items = list.filter((i) => (i.rayon || 'autre') === r).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      if (!items.length) return '';
      return `<section class="block"><h2 class="group-title">${esc(food.RAYON_LABELS[r])}</h2><div class="list">${items.map((i) => `
        <button class="list-row" data-ing="${esc(i.id)}"><span class="list-main">${esc(i.name)}<small>${esc(food.priceUnit(i))}${i.buyLabel ? `, vendu en ${esc(i.buyLabel)}` : ''}${i.edited ? ', modifié' : ''}${i.custom ? ', ajouté par toi' : ''}</small></span>${priceTag(i.price, { cls: i.edited || i.custom ? 'is-edited' : '' })}</button>`).join('')}</div></section>`;
    }).join('');
  };
  view.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value; draw(); });
  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-new]')) {
      await editIngredient(null);
      return draw();
    }
    const b = e.target.closest('[data-ing]');
    if (!b) return;
    const ing = food.ingredient(b.dataset.ing);
    if (ing.custom) {
      await editIngredient(ing.id);
      return draw();
    }
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
    draw();
  });
  draw();
}

// ---------- Compte ----------
export function renderAccount(view, ctx) {
  let email = '';
  const unsub = sync.onStatus(() => {
    if (view.isConnected && !view.querySelector('input:focus')) draw();
  });
  ctx.onCleanup(unsub);
  const dt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

  function draw() {
    const st = sync.state;
    let body = '';
    if (!sync.isConfigured()) {
      body = `<section class="block soft"><h2 class="block-title">Synchronisation non configurée</h2>
        <p>Tes données sont enregistrées uniquement sur cet appareil. Pour les retrouver partout, renseigne l’adresse et la clé de ton projet Supabase dans <code>config.js</code>, comme expliqué dans le guide.</p></section>`;
    } else if (sync.isSignedIn()) {
      body = `<section class="block">
        <dl class="kv">
          <div><dt>Compte</dt><dd>${esc(st.email || '')}</dd></div>
          <div><dt>État</dt><dd>${esc({ ok: 'Synchronisé', syncing: 'Synchronisation en cours', offline: 'Hors ligne', error: 'Erreur' }[st.status] || st.status)}</dd></div>
          <div><dt>Dernière synchro</dt><dd>${st.lastSync ? esc(dt.format(st.lastSync)) : '–'}</dd></div>
          <div><dt>Modifications en attente</dt><dd>${store.pendingCount()}</dd></div>
        </dl>
        ${st.error ? `<p class="error-text">${esc(st.error)}</p>` : ''}
        <div class="row-actions">
          <button class="btn primary" data-sync>${icon('sync')}<span>Synchroniser maintenant</span></button>
          <button class="btn" data-out>Se déconnecter</button>
        </div></section>
        <p class="block-sub">C’est le même compte que Fonte, mais les données de Gamelle restent à part.</p>`;
    } else {
      body = `<form class="block form" data-login>
        <p>Connecte-toi avec le compte que tu utilises déjà dans Fonte. Gamelle te demande ta connexion une fois par appareil, indépendamment de Fonte.</p>
        <label class="field"><span>Adresse email</span><input type="email" name="email" autocomplete="username" autocapitalize="off" required value="${esc(email)}"></label>
        <label class="field"><span>Mot de passe</span><input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">Se connecter</button>
      </form>`;
    }
    view.innerHTML = `${ctx.pageHead('Compte et synchronisation', { back: '/plus' })}${body}`;
  }

  view.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!e.target.matches('[data-login]')) return;
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    const f = formData(e.target);
    email = f.email.trim();
    try {
      await sync.signIn(email, f.password);
      toast('Connecté. Synchronisation en cours…');
      draw();
    } catch (err) {
      const m = err?.message || String(err);
      let msg = m;
      if (/invalid login credentials/i.test(m)) msg = 'Email ou mot de passe incorrect.';
      else if (/rate limit|too many/i.test(m)) msg = 'Trop de tentatives rapprochées. Attends quelques minutes.';
      else if (/fetch|network/i.test(m)) msg = 'Pas de connexion au serveur. Vérifie le réseau et l’adresse dans config.js.';
      toast(msg, { kind: 'error', duration: 6000 });
      btn.disabled = false;
    }
  });
  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-sync]')) sync.syncNow();
    if (e.target.closest('[data-out]')) {
      const pending = store.pendingCount();
      const ok = await confirmSheet('Se déconnecter', pending
        ? `Attention : ${pending} modification${pending > 1 ? 's n’ont' : ' n’a'} pas encore été envoyée${pending > 1 ? 's' : ''} et ser${pending > 1 ? 'ont perdues' : 'a perdue'}. Les données de cet appareil seront effacées.`
        : 'Les données seront effacées de cet appareil. Elles restent dans ton compte et reviendront à la prochaine connexion.', { ok: 'Se déconnecter', danger: true });
      if (!ok) return;
      await sync.signOut();
      draw();
    }
  });
  draw();
}

// ---------- Sauvegarde ----------
export function renderBackup(view, ctx) {
  view.innerHTML = `
    ${ctx.pageHead('Sauvegarde', { back: '/plus' })}
    <section class="block">
      <p class="block-sub">Un fichier avec tes repas, recettes, prix, réserves, réglages et pesées. Utile avant un changement de téléphone, ou si tu n’utilises pas la synchro.</p>
      <div class="row-actions">
        <button class="btn primary" data-export>${icon('save')} Exporter</button>
        <label class="btn file-btn">Importer un fichier<input type="file" accept="application/json,.json" data-import hidden></label>
      </div>
    </section>`;
  view.addEventListener('click', (e) => {
    if (!e.target.closest('[data-export]')) return;
    const payload = { app: 'gamelle', version: ctx.version, exported_at: new Date().toISOString(), gamelle: store.exportRows('gamelle') };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gamelle-${calc.localDay()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  view.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-import]');
    if (!input || !input.files[0]) return;
    try {
      const file = input.files[0];
      if (file.size > 20 * 1024 * 1024) throw new Error('fichier trop gros');
      const json = JSON.parse(await file.text());
      if (json.app !== 'gamelle') throw new Error('ce n’est pas une sauvegarde Gamelle');
      let n = store.importRows('gamelle', json.gamelle || []);
      // Anciennes sauvegardes : les pesées étaient dans une liste à part.
      for (const w of Array.isArray(json.bodyweights) ? json.bodyweights : []) {
        if (w && typeof w.day === 'string' && Number.isFinite(Number(w.weight)) && store.saveWeight(w.day, Number(w.weight))) n++;
      }
      toast(`${n} élément${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}.`);
    } catch (err) {
      toast(`Import impossible : ${err.message}`, { kind: 'error', duration: 6000 });
    }
    input.value = '';
  });
}

// ---------- Aide ----------
export function renderHelp(view, ctx) {
  view.innerHTML = `
    ${ctx.pageHead('Aide et sources', { back: '/plus' })}
    <div class="prose">
      <h2 class="block-title">Le principe</h2>
      <p>Le soir, les plats sont prévus en 2 portions. Gamelle te propose de garder la seconde pour la gamelle du lendemain midi : « Garder » l’ajoute, sinon le plat n’est cuisiné qu’en une portion ou tu prévois autre chose. Gamelle remplit la semaine, calcule les calories, le prix et la liste de courses. Tu changes ce que tu veux en touchant un repas.</p>
      <p>Le petit-déjeuner et la collation sont facultatifs : ajoute-les depuis un jour de la semaine quand tu en prends un, ou active-les dans les préférences.</p>
      <h2 class="block-title">Assiettes, sauces et desserts</h2>
      <p>« Composer une assiette » assemble un féculent, une protéine, un légume et une sauce légère, tous facultatifs. Les sauces sont aussi dans les recettes. Un dessert simple (yaourt, compote, fruit, parfois protéiné) s’ajoute à un repas. Un gâteau ou un riz au lait se prévoit une fois pour la semaine : ses ingrédients passent une seule fois dans les courses, et le prix et les calories sont comptés par part.</p>
      <h2 class="block-title">Ce que j’ai et fonds de placard</h2>
      <p>Dans « Ce que j’ai », coche ce qu’il y a dans ton frigo, ton congélateur et ton placard, sans quantité. Touche deux fois un aliment à finir vite. « Qu’est-ce que je cuisine ? » classe alors les recettes selon ce qui te manque, et propose une assiette simple. Les produits de base (huile, épices, sauce soja…) sont toujours supposés présents.</p>
      <p>Les fonds de placard sont les achats réguliers qui ne dépendent pas des recettes. Ils reviennent dans la liste de courses chaque semaine ou chaque mois.</p>
      <h2 class="block-title">Calories et macros</h2>
      <p>Les valeurs viennent de la table Ciqual 2020 de l’Anses (aliments crus, pour 100 g), sauf le skyr, la whey, le lait de coco allégé et le fromage frais type Philadelphia, pris sur des étiquettes moyennes. Elles dépendent des marques et des quantités réelles : vois-les comme des ordres de grandeur, suffisants pour suivre une tendance.</p>
      <p>L’objectif part de la formule de Mifflin-St Jeor multipliée par ton niveau d’activité. Ton poids réel sur quelques semaines reste le meilleur juge : si la tendance ne suit pas, ajuste de 100 à 200 kcal.</p>
      <h2 class="block-title">Prix et économies</h2>
      <p>Les prix sont des moyennes estimées en grande surface. Le coût d’un repas compte seulement ce que tu manges (un tiers de paquet de riz, pas le paquet). La liste de courses, elle, arrondit aux conditionnements du rayon.</p>
      <p>Les économies comparent tes jours suivis à ton rythme de commandes d’avant : chaque commande évitée est remplacée par le prix moyen d’un repas maison. Si tu commandes autant ou plus qu’avant, le compteur reste à 0 €.</p>
      <h2 class="block-title">Conservation des gamelles</h2>
      <p>Mets la portion du lendemain en boîte et au frigo dès qu’elle a tiédi, dans les 2 heures. Réchauffe-la jusqu’à ce qu’elle soit bien chaude au cœur. Les plats marqués « se congèle » tiennent environ 3 mois au congélateur.</p>
      <h2 class="block-title">Monsieur Cuisine</h2>
      <p>Les réglages donnés (durée, température, vitesse, sens inverse) visent un Monsieur Cuisine Smart ou Connect. Adapte-les si ton modèle est différent.</p>
      <p class="fine">Source des données nutritionnelles : Anses, Table de composition nutritionnelle des aliments Ciqual, 2020. Gamelle donne des estimations et ne remplace pas l’avis d’un médecin ou d’un diététicien.</p>
    </div>`;
}
