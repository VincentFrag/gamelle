// Habitudes du jour : créatine et shaker de whey. Elles vivent dans le journal du jour
// (store.dayLog), à côté de la pesée. Le shaker compte dans les calories et protéines du jour.
import * as store from './store.js';
import * as calc from './calc.js';
import * as food from './food.js';

export function config(s = calc.settings()) {
  return s.habits;
}

export function creatineTaken(day) {
  return store.dayLog(day).creatine === true;
}

export function shakes(day) {
  return store.dayLog(day).shakes || 0;
}

export function setCreatine(day, on) {
  return store.patchDayLog(day, { creatine: on });
}

export function setShakes(day, n) {
  return store.patchDayLog(day, { shakes: Math.max(0, Math.min(5, n)) });
}

// Valeurs d'un shaker (whey à l'eau), d'après l'ingrédient « whey » (modifiable dans Aliments et prix).
export function shakeStats(s = calc.settings()) {
  const ing = food.ingredient('whey');
  const g = config(s).wheyG || 30;
  if (!ing) return { kcal: 0, p: 0, c: 0, f: 0, cost: 0, g };
  const k = g / 100;
  return { kcal: ing.kcal * k, p: ing.p * k, c: ing.c * k, f: ing.f * k, cost: food.costOf(ing, g), g };
}

// Ce qu'il reste à prendre aujourd'hui (pour le rappel visuel et le point sur l'onglet).
export function pending(day = calc.localDay(), s = calc.settings()) {
  const h = config(s);
  const out = [];
  if (h.creatine && !creatineTaken(day)) out.push('creatine');
  if (h.whey && !shakes(day)) out.push('whey');
  return out;
}

// Jours d'affilée. Aujourd'hui pas encore coché n'interrompt pas la série : la journée n'est pas finie.
export function streak(test, day = calc.localDay()) {
  let d = test(day) ? day : calc.addDays(day, -1);
  let n = 0;
  while (n < 3650 && test(d)) {
    n++;
    d = calc.addDays(d, -1);
  }
  return n;
}

export const creatineStreak = (day) => streak(creatineTaken, day);
export const wheyStreak = (day) => streak((d) => shakes(d) > 0, day);

// Les 7 derniers jours, du plus ancien à aujourd'hui.
export function lastDays(day = calc.localDay()) {
  return Array.from({ length: 7 }, (_, i) => calc.addDays(day, i - 6));
}
