// Graphiques SVG légers : colonnes avec ligne d'objectif, courbe de poids.
import { esc } from './ui.js';

function nice(max) {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  const n = max / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

// bars : [{label, value, sub}] ; target : ligne horizontale facultative
export function barChart(el, { bars, target = null, unit = '', height = 190 }) {
  const width = Math.max(280, el.clientWidth || 600);
  const pad = { l: 40, r: 10, t: 16, b: 26 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = nice(Math.max(target || 0, ...bars.map((b) => b.value)) * 1.08);
  const y = (v) => pad.t + h - (v / max) * h;
  const slot = w / bars.length;
  const bw = Math.min(34, slot * 0.62);
  let svg = `<svg class="chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(bars.map((b) => `${b.label} : ${Math.round(b.value)} ${unit}`).join(', '))}">`;
  for (const v of [0, max / 2, max]) {
    svg += `<line class="grid" x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="tick" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }
  bars.forEach((b, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const over = target && b.value > target * 1.1;
    if (b.value > 0) svg += `<rect class="bar ${over ? 'is-over' : ''} ${b.cls || ''}" x="${cx - bw / 2}" y="${y(b.value)}" width="${bw}" height="${Math.max(0, pad.t + h - y(b.value))}" rx="4"/>`;
    else svg += `<rect class="bar is-zero" x="${cx - bw / 2}" y="${pad.t + h - 2}" width="${bw}" height="2"/>`;
    svg += `<text class="tick" x="${cx}" y="${height - 8}" text-anchor="middle">${esc(b.label)}</text>`;
  });
  if (target) {
    svg += `<line class="target" x1="${pad.l}" x2="${width - pad.r}" y1="${y(target)}" y2="${y(target)}"/>`;
    svg += `<text class="target-label" x="${width - pad.r}" y="${y(target) - 5}" text-anchor="end">objectif ${Math.round(target)}</text>`;
  }
  svg += '</svg>';
  el.innerHTML = svg;
}

// points : [{t, y, avg}]
export function weightChart(el, points, { height = 170 } = {}) {
  if (!points.length) {
    el.innerHTML = '';
    return;
  }
  const width = Math.max(280, el.clientWidth || 600);
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  let t0 = points[0].t, t1 = points[points.length - 1].t;
  if (t0 === t1) { t0 -= 3 * 86400000; t1 += 3 * 86400000; }
  const ys = points.flatMap((p) => [p.y, p.avg]);
  let lo = Math.floor(Math.min(...ys) - 0.5), hi = Math.ceil(Math.max(...ys) + 0.5);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const x = (t) => pad.l + ((t - t0) / (t1 - t0)) * w;
  const y = (v) => pad.t + h - ((v - lo) / (hi - lo)) * h;
  const df = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  let svg = `<svg class="chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Évolution du poids">`;
  for (const v of [lo, (lo + hi) / 2, hi]) {
    svg += `<line class="grid" x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="tick" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${String(Math.round(v * 10) / 10).replace('.', ',')}</text>`;
  }
  svg += `<text class="tick" x="${pad.l}" y="${height - 6}">${esc(df.format(new Date(t0)))}</text>`;
  svg += `<text class="tick" x="${width - pad.r}" y="${height - 6}" text-anchor="end">${esc(df.format(new Date(t1)))}</text>`;
  for (const p of points) svg += `<circle class="dot raw" cx="${x(p.t)}" cy="${y(p.y)}" r="3"/>`;
  if (points.length > 1) svg += `<path class="line" d="${points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.avg).toFixed(1)}`).join('')}"/>`;
  svg += '</svg>';
  el.innerHTML = svg;
}
