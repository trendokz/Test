// Контуры огранок бриллианта.
// Каждый контур — замкнутый список точек [x, z] (по часовой/против — не важно),
// нормализованный: ширина по X = 1, центр в (0, 0). Длинная ось — Z.

const cache = new Map();

function circle(n, rx = 0.5, rz = 0.5) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * rx, Math.sin(a) * rz]);
  }
  return pts;
}

function superellipse(n, rx, rz, p) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    pts.push([
      Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * rx,
      Math.sign(s) * Math.pow(Math.abs(s), 2 / p) * rz,
    ]);
  }
  return pts;
}

// Прямоугольник со срезанными углами; каждое ребро делится пропорционально длине.
function cutRect(hx, hz, cut, step = 0.09) {
  const v = [
    [hx, -hz + cut], [hx, hz - cut], [hx - cut, hz], [-hx + cut, hz],
    [-hx, hz - cut], [-hx, -hz + cut], [-hx + cut, -hz], [hx - cut, -hz],
  ];
  return subdividePolygon(v, step);
}

function subdividePolygon(v, step) {
  const pts = [];
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b = v[(i + 1) % v.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const k = Math.max(1, Math.round(len / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return pts;
}

function convexHull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

// Равномерная по длине дуги выборка замкнутой ломаной.
function resample(pts, n) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push(l); total += l;
  }
  const out = [];
  let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (acc + seg[i] < target) { acc += seg[i]; i++; }
    const t = (target - acc) / seg[i];
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function pear() {
  const dense = circle(120, 0.5, 0.5).map(([x, z]) => [x, z - 0.2]);
  dense.push([0, 0.78]);
  return resample(convexHull(dense), 26);
}

function marquise() {
  const w = 0.5, L = 1.0;
  const c = (L * L - w * w) / (2 * w), R = c + w;
  const pts = [];
  const n = 14;
  for (let i = 0; i < n; i++) {            // правая дуга, сверху вниз
    const z = L - (2 * L * i) / n;
    pts.push([Math.sqrt(Math.max(0, R * R - z * z)) - c, z]);
  }
  for (let i = 0; i < n; i++) {            // левая дуга, снизу вверх
    const z = -L + (2 * L * i) / n;
    pts.push([-(Math.sqrt(Math.max(0, R * R - z * z)) - c), z]);
  }
  return pts;
}

function heart() {
  const dense = [];
  for (let i = 0; i < 400; i++) {
    const t = (i / 400) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    dense.push([x, -y]); // остриё сердца направлено к +Z
  }
  return resample(dense, 32);
}

function normalize(pts) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const s = 1 / (maxX - minX);
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  return pts.map(([x, z]) => [(x - cx) * s, (z - cz) * s]);
}

function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

const BUILDERS = {
  round:    () => circle(16),
  oval:     () => circle(24, 0.5, 0.7),
  princess: () => cutRect(0.5, 0.5, 0.025, 0.125),
  cushion:  () => superellipse(24, 0.5, 0.54, 3.2),
  emerald:  () => cutRect(0.5, 0.72, 0.14, 0.12),
  asscher:  () => cutRect(0.5, 0.5, 0.16, 0.12),
  radiant:  () => cutRect(0.5, 0.64, 0.1, 0.12),
  pear,
  marquise,
  heart,
};

// Тип огранки: бриллиантовая или ступенчатая
export const CUT_TYPE = { emerald: 'step', asscher: 'step' };

// Направления крапанов (в градусах, 0 = +X, 90 = +Z)
// Расставлены симметрично, чтобы камень держался со всех сторон.
export const PRONG_ANGLES = {
  round: [30, 90, 150, 210, 270, 330],
  oval: [40, 140, 220, 320],
  princess: [45, 135, 225, 315],
  cushion: [45, 135, 225, 315],
  emerald: [50, 130, 230, 310],
  asscher: [45, 135, 225, 315],
  radiant: [45, 135, 225, 315],
  pear: [90, 200, 340, 270],
  marquise: [90, 270, 20, 160, 200, 340],
  heart: [90, 200, 340, 240, 300],
};

/** Возвращает { points, aspect, area, cut } для формы. */
export function getOutline(shape) {
  if (cache.has(shape)) return cache.get(shape);
  const build = BUILDERS[shape] || BUILDERS.round;
  const points = normalize(build());
  let minZ = Infinity, maxZ = -Infinity;
  for (const [, z] of points) { minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const info = { points, aspect: maxZ - minZ, area: area(points), cut: CUT_TYPE[shape] || 'brilliant' };
  cache.set(shape, info);
  return info;
}

/** Смещение контура наружу на d (по нормалям). */
export function offsetOutline(pts, d) {
  const n = pts.length;
  // ориентация
  let s = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    s += p[0] * q[1] - q[0] * p[1];
  }
  const sign = s > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    // внешняя нормаль
    const nx = tz * sign, nz = -tx * sign;
    return [p[0] + nx * d, p[1] + nz * d];
  });
}

export { resample };

/** Ширина камня (мм) для массы в каратах — равная площадь с круглым камнем. */
export function stoneWidth(shape, carat) {
  const roundD = 6.45 * Math.cbrt(carat);
  const info = getOutline(shape);
  const k = Math.sqrt((Math.PI * 0.25) / info.area);
  return roundD * k;
}

/** SVG-иконка формы: контур + площадка + линии граней. */
export function shapeSVG(shape, size = 64) {
  const { points, cut } = getOutline(shape);
  let maxExt = 0;
  for (const [x, z] of points) maxExt = Math.max(maxExt, Math.abs(x), Math.abs(z));
  const sc = (size * 0.42) / maxExt, c = size / 2;
  const P = (pts) => pts.map(([x, z]) => `${(c + x * sc).toFixed(1)},${(c - z * sc).toFixed(1)}`).join(' ');
  const inner = points.map(([x, z]) => [x * (cut === 'step' ? 0.62 : 0.5), z * (cut === 'step' ? 0.62 : 0.5)]);
  let lines = '';
  const step = cut === 'step' ? 1 : 2;
  for (let i = 0; i < points.length; i += step) {
    const [x1, z1] = points[i], [x2, z2] = inner[i];
    lines += `<line x1="${(c + x1 * sc).toFixed(1)}" y1="${(c - z1 * sc).toFixed(1)}" x2="${(c + x2 * sc).toFixed(1)}" y2="${(c - z2 * sc).toFixed(1)}"/>`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="shape-svg" aria-hidden="true">
    <polygon points="${P(points)}" class="shape-svg__outline"/>
    <polygon points="${P(inner)}" class="shape-svg__table"/>
    <g class="shape-svg__facets">${lines}</g></svg>`;
}
