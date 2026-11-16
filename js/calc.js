// Réglages, dates, formats, objectifs nutritionnels, poids.
import * as store from './store.js';
import { cleanRow } from './clean.js';

// ---------- Réglages ----------
let cachedSettings = null;
let cachedVersion = -1;

export function settings() {
  if (cachedVersion === store.getVersion() && cachedSettings) return cachedSettings;
  const row = store.get('settings', 'main');
  cachedSettings = cleanRow('gamelle', { kind: 'settings', id: 'main', data: row ? row.data : {} }).data;
  cachedVersion = store.getVersion();
  return cachedSettings;
}

export function saveSettings(partial) {
  const cur = settings();
  store.put('settings', 'main', { ...cur, ...partial });
}

// ---------- Dates ----------
export const DAY_MS = 86400000;

export function localDay(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function dayToDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day, n) {
  const d = dayToDate(day);
  d.setDate(d.getDate() + n);
  return localDay(d);
}

// Lundi de la semaine du jour donné
export function weekStart(day = localDay()) {
  const d = dayToDate(day);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return localDay(d);
}

export function weekDays(start) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// 0 = lundi … 6 = dimanche
export function weekday(day) {
  return (dayToDate(day).getDay() + 6) % 7;
}

const dfLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dfDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric' });
const dfShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const dfMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const dfWd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtLong = (day) => cap(dfLong.format(dayToDate(day)));
export const fmtDayName = (day) => cap(dfDay.format(dayToDate(day)));
export const fmtShort = (day) => dfShort.format(dayToDate(day));
export const fmtMonth = (d) => cap(dfMonth.format(d));
export const fmtWd = (day) => cap(dfWd.format(dayToDate(day)).replace('.', ''));

export function fmtWeek(start) {
  const end = addDays(start, 6);
  const a = dayToDate(start), b = dayToDate(end);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} au ${dfShort.format(b)}`;
  return `${dfShort.format(a)} au ${dfShort.format(b)}`;
}

export function relDay(day) {
  const diff = Math.round((dayToDate(day) - dayToDate(localDay())) / DAY_MS);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  return fmtDayName(day);
}

// ---------- Nombres ----------
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nfEur = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt0 = (n) => nf0.format(Math.round(n || 0));
export const fmt1 = (n) => nf1.format(n || 0);
export const fmtEur = (n) => `${nfEur.format(n || 0)} €`;
export const fmtEur0 = (n) => `${nf0.format(Math.round(n || 0))} €`;

export function fmtSigned(n, digits = 1) {
  const s = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Math.abs(n));
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${s}`;
}

export function parseNum(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const numInput = (n) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtMinutes(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

// ---------- Poids ----------
export function weightSeries() {
  const list = store.weights().sort((a, b) => a.day.localeCompare(b.day));
  return list.map((b, i) => {
    const t = dayToDate(b.day).getTime();
    let sum = 0, n = 0;
    for (let j = i; j >= 0; j--) {
      const tj = dayToDate(list[j].day).getTime();
      if (t - tj > 6 * DAY_MS) break;
      sum += list[j].weight;
      n++;
    }
    return { day: b.day, t, weight: b.weight, avg: sum / n };
  });
}

// Tendance (kg par semaine) : régression linéaire sur les 28 derniers jours.
export function weightTrend(series, days = 28) {
  if (!series.length) return null;
  const end = series[series.length - 1].t;
  const pts = series.filter((p) => end - p.t <= days * DAY_MS);
  if (pts.length < 4) return null;
  const xs = pts.map((p) => (p.t - end) / (7 * DAY_MS));
  const ys = pts.map((p) => p.weight);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den ? num / den : null;
}

// Poids de référence : moyenne 7 jours la plus récente, sinon le poids du profil.
export function currentWeight() {
  const s = weightSeries();
  if (s.length) return s[s.length - 1].avg;
  return settings().profile.weight || null;
}

// ---------- Objectifs ----------
export const ACTIVITY = [
  [1.2, 'Sédentaire', 'Travail assis, peu de sport'],
  [1.375, 'Légèrement actif', '1 à 3 séances par semaine'],
  [1.55, 'Actif', '3 à 5 séances par semaine'],
  [1.725, 'Très actif', '6 séances ou plus, ou entraînement d’endurance soutenu'],
];

// Métabolisme de base : formule de Mifflin-St Jeor.
export function bmr(p = settings().profile, weight = currentWeight()) {
  if (!p.sex || !p.age || !p.height || !weight) return null;
  return 10 * weight + 6.25 * p.height - 5 * p.age + (p.sex === 'h' ? 5 : -161);
}

export function targets() {
  const s = settings();
  const weight = currentWeight();
  const base = bmr(s.profile, weight);
  const tdee = base ? base * (s.profile.activity || 1.55) : null;
  let kcal = null;
  if (s.kcalOverride) kcal = s.kcalOverride;
  else if (tdee) {
    if (s.goal === 'perte') kcal = tdee * (1 - s.deficit / 100);
    else if (s.goal === 'prise') kcal = tdee * 1.1;
    else kcal = tdee;
    kcal = Math.round(kcal / 10) * 10;
  }
  if (!kcal) return { ready: false, weight, tdee, bmr: base };
  const p = weight ? Math.round(weight * s.proteinPerKg) : Math.round((kcal * 0.25) / 4);
  const f = Math.round((kcal * 0.28) / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return { ready: true, kcal, p, c, f, weight, tdee: tdee ? Math.round(tdee) : null, bmr: base ? Math.round(base) : null };
}
