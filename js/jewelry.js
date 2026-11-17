// Процедурное построение 3D-моделей украшений (единицы — миллиметры).
import * as THREE from 'three';
import { getOutline, offsetOutline, resample, stoneWidth, PRONG_ANGLES } from './shapes.js';
import { METALS, STONE_COLORS } from './config.js';
import { createGemMaterial, createGemMesh, absorptionFor } from './gem.js';

// ---------------------------------------------------------------------------
//  Материалы (свои для каждого WebGL-контекста, т.к. env-карты привязаны к нему)
// ---------------------------------------------------------------------------
export class MaterialLibrary {
  constructor(env, { raytrace = true } = {}) {
    this.env = env; // { pmrem, refractCube, reflectCube, gemCube }
    this.cache = new Map();
    this.raytrace = raytrace && !!env.gemCube;
  }
  // Реалистичный камень с трассировкой лучей (материал на каждую геометрию)
  gemRT(id, geometry, quality = {}) {
    const g = STONE_COLORS.find((x) => x.id === id) || STONE_COLORS[0];
    const dark = g.id === 'black';
    return createGemMaterial(geometry, this.env.gemCube, {
      bounces: quality.bounces ?? 6,
      ior: dark ? 2.42 : 2.418,
      dispersion: dark ? 0 : 0.02,
      absorption: g.id === 'white' ? new THREE.Vector3(0.0, 0.0, 0.004) : absorptionFor(g.color, dark ? 3 : 0.32),
      tint: dark ? new THREE.Color(0.05, 0.05, 0.06) : new THREE.Color(1, 1, 1),
      reflectivity: dark ? 1.6 : 1,
      envIntensity: 1,
    });
  }
  _get(key, make) {
    if (!this.cache.has(key)) this.cache.set(key, make());
    return this.cache.get(key);
  }
  metal(id) {
    const m = METALS.find((x) => x.id === id) || METALS[0];
    return this._get('metal:' + m.id, () => new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(m.color),
      metalness: 1,
      roughness: 0.14,
      envMap: this.env.pmrem,
      envMapIntensity: 1.25,
      clearcoat: 0.35,
      clearcoatRoughness: 0.08,
    }));
  }
  gem(id) {
    const g = STONE_COLORS.find((x) => x.id === id) || STONE_COLORS[0];
    return this._get('gem:' + g.id, () => {
      const col = new THREE.Color(g.color);
      const dark = g.id === 'black';
      // Внутренний слой: преломление яркой студийной карты на гранях.
      const back = new THREE.MeshBasicMaterial({
        color: dark ? new THREE.Color('#151518') : col,
        envMap: this.env.refractCube,
        refractionRatio: 1 / 2.42,
        side: THREE.BackSide,
      });
      // Внешний слой: отражения, добавляются поверх.
      const front = new THREE.MeshBasicMaterial({
        color: dark ? new THREE.Color('#9a9aa0') : new THREE.Color('#ffffff').lerp(col, 0.35),
        envMap: this.env.reflectCube,
        transparent: true,
        opacity: dark ? 0.5 : 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      // Лёгкая «игра» цвета — дисперсия имитируется слоем с иридесценцией.
      const fire = new THREE.MeshPhysicalMaterial({
        color: 0x000000,
        metalness: 0,
        roughness: 0,
        envMap: this.env.pmrem,
        envMapIntensity: dark ? 0.25 : 0.32,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        specularIntensity: 1,
        ior: 2.42,
      });
      return { back, front, fire };
    });
  }
}

// ---------------------------------------------------------------------------
//  Утилиты геометрии
// ---------------------------------------------------------------------------

// Собирает плоско-затенённую геометрию из треугольников, ориентируя каждый
// наружу относительно центра.
function facetedGeometry(tris, center) {
  const pos = new Float32Array(tris.length * 9);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  let o = 0;
  for (const [p, q, r] of tris) {
    a.fromArray(p); b.fromArray(q); c.fromArray(r);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    m.copy(a).add(b).add(c).divideScalar(3).sub(center);
    const flip = n.dot(m) < 0;
    const order = flip ? [a, c, b] : [a, b, c];
    for (const v of order) { pos[o++] = v.x; pos[o++] = v.y; pos[o++] = v.z; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];

function ring3(pts2, s, y) { return pts2.map(([x, z]) => [x * s, y, z * s]); }

function bandAligned(tris, A, B) {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tris.push([A[i], A[j], B[j]], [A[i], B[j], B[i]]);
  }
}
// B[i] лежит между A[i] и A[i+1]
function bandOffset(tris, A, B) {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tris.push([A[i], A[j], B[i]], [B[(i - 1 + n) % n], A[i], B[i]]);
  }
}
function fan(tris, A, apex) {
  const n = A.length;
  for (let i = 0; i < n; i++) tris.push([A[i], A[(i + 1) % n], apex]);
}

/** Геометрия огранённого камня. Площадка смотрит вверх (+Y), рундист на y = 0. */
export function diamondGeometry(shape, width) {
  const { points, cut } = getOutline(shape);
  const P = points.map(([x, z]) => [x * width, z * width]);
  const M = P.map((p, i) => mid(p, P[(i + 1) % P.length]));
  const crown = width * (cut === 'step' ? 0.12 : 0.155);
  const pav = width * (cut === 'step' ? 0.38 : 0.43);
  const g = width * 0.012;
  const tris = [];
  if (cut === 'step') {
    const T = ring3(P, 0.66, crown);
    const C1 = ring3(P, 0.8, crown * 0.72);
    const C2 = ring3(P, 0.92, crown * 0.36);
    const G1 = ring3(P, 1, g), G2 = ring3(P, 1, -g);
    const P1 = ring3(P, 0.74, -pav * 0.35);
    const P2 = ring3(P, 0.46, -pav * 0.68);
    const P3 = ring3(P, 0.16, -pav * 0.93);
    fan(tris, T, [0, crown, 0]);
    bandAligned(tris, T, C1); bandAligned(tris, C1, C2); bandAligned(tris, C2, G1);
    bandAligned(tris, G1, G2); bandAligned(tris, G2, P1); bandAligned(tris, P1, P2);
    bandAligned(tris, P2, P3); fan(tris, P3, [0, -pav, 0]);
  } else {
    const T = ring3(M, 0.56, crown);
    const U = ring3(P, 0.8, crown * 0.52);
    const G1 = ring3(P, 1, g), G2 = ring3(P, 1, -g);
    const L = ring3(M, 0.62, -pav * 0.4);
    const L2 = ring3(P, 0.28, -pav * 0.78);
    fan(tris, T, [0, crown, 0]);
    // T[i] между U[i] и U[i+1]
    bandOffset(tris, U, T);
    // верхние грани короны: U -> G1 со вставкой средних точек рундиста
    const GM = ring3(M, 1, g);
    for (let i = 0; i < P.length; i++) {
      const j = (i + 1) % P.length;
      tris.push([U[i], G1[i], GM[i]], [U[i], GM[i], U[j]], [U[j], GM[i], G1[j]]);
    }
    bandAligned(tris, G1, G2);
    bandOffset(tris, G2, L);
    for (let i = 0; i < P.length; i++) {
      const j = (i + 1) % P.length;
      tris.push([L[i], G2[j], L2[j]], [L[i], L2[j], L2[i]]);
    }
    fan(tris, L2, [0, -pav, 0]);
  }
  const geo = facetedGeometry(tris, new THREE.Vector3(0, (crown - pav) / 2, 0));
  geo.userData = { crown, pav, girdle: g, width };
  return geo;
}

function stoneMesh(geo, mats) {
  const grp = new THREE.Group();
  const back = new THREE.Mesh(geo, mats.back);
  const front = new THREE.Mesh(geo, mats.front);
  const fire = new THREE.Mesh(geo, mats.fire);
  back.renderOrder = 1; front.renderOrder = 2; fire.renderOrder = 3;
  grp.add(back, front, fire);
  return grp;
}

function instancedStones(geo, lib, gemId, matrices) {
  if (lib.raytrace) {
    const im = new THREE.InstancedMesh(geo, lib.gemRT(gemId, geo, { bounces: 4 }), matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.userData.disposeMaterial = true;
    return im;
  }
  const mats = lib.gem(gemId);
  const grp = new THREE.Group();
  [['back', 1], ['front', 2], ['fire', 3]].forEach(([k, order]) => {
    const im = new THREE.InstancedMesh(geo, mats[k], matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.renderOrder = order;
    grp.add(im);
  });
  return grp;
}

// Протягивание сечения по окружности (шинка). profile(phi, a) -> [u, v],
// u — радиальное смещение, v — смещение вдоль оси кольца (Z).
function sweepRing(Rc, segs, prof, profile) {
  const pos = [];
  const idx = [];
  for (let i = 0; i < segs; i++) {
    const phi = (i / segs) * Math.PI * 2;
    const c = Math.cos(phi), s = Math.sin(phi);
    for (let k = 0; k < prof; k++) {
      const a = (k / prof) * Math.PI * 2;
      const [u, v] = profile(phi, a);
      const r = Rc + u;
      pos.push(c * r, s * r, v);
    }
  }
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % segs;
    for (let k = 0; k < prof; k++) {
      const k2 = (k + 1) % prof;
      const a = i * prof + k, b = i2 * prof + k, c = i2 * prof + k2, d = i * prof + k2;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // нормали должны смотреть наружу от сечения — проверим одну
  const n = g.getAttribute('normal');
  const p0 = new THREE.Vector3().fromBufferAttribute(g.getAttribute('position'), 0);
  const n0 = new THREE.Vector3().fromBufferAttribute(n, 0);
  const [u0, v0] = profile(0, 0);
  const center0 = new THREE.Vector3(Rc, 0, 0);
  const out = p0.clone().sub(center0); out.x -= 0; // от центра сечения
  if (n0.dot(out) < 0 && (u0 !== 0 || v0 !== 0)) {
    idx.reverse();
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

const sePow = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);

// ---------------------------------------------------------------------------
//  Шинки
// ---------------------------------------------------------------------------
// Металл касты: «как шинка» или выбранный отдельно
const headMetalId = (c) => (!c.head || c.head === 'same' ? c.metal : c.head);

// Модель кольца -> стиль шинки
const SHANK_STYLE = { solo: 'classic', trio: 'classic', bezel: 'classic', 'solo-pave': 'pave', 'trio-pave': 'pave' };
export const isTrilogy = (id) => id === 'trio' || id === 'trio-pave';

function buildShank(cfg, Ri, mats, group) {
  const metal = mats.metal(cfg.metal);
  const topTaper = (phi, amount) => {
    // phi = 90° — верх кольца, где сидит каста
    const d = Math.cos(phi - Math.PI / 2); // 1 сверху, -1 снизу
    return 1 - amount * Math.max(0, d) ** 3;
  };
  const SEGS = 220;
  let t, w;
  switch (SHANK_STYLE[cfg.shank] || cfg.shank) {
    case 'slim': {
      t = 1.45; w = 1.7;
      const g = sweepRing(Ri + t / 2, SEGS, 28, (phi, a) => {
        const f = topTaper(phi, 0.2);
        return [sePow(Math.cos(a), 2 / 2.4) * t / 2, sePow(Math.sin(a), 2 / 2.4) * (w * f) / 2];
      });
      group.add(new THREE.Mesh(g, metal));
      break;
    }
    case 'knife': {
      t = 1.9; w = 2.3;
      const g = sweepRing(Ri + t / 2, SEGS, 36, (phi, a) => {
        const f = topTaper(phi, 0.18);
        const ca = Math.cos(a), sa = Math.sin(a);
        const u = sePow(ca, 2 / 2.6) * t / 2;
        let v = sePow(sa, 2 / 2.6) * (w * f) / 2;
        if (u > 0) v *= 1 - 0.9 * Math.pow(u / (t / 2), 1.6); // острое ребро снаружи
        return [u, v];
      });
      group.add(new THREE.Mesh(g, metal));
      break;
    }
    case 'pave': {
      t = 1.7; w = 2.2;
      const g = sweepRing(Ri + t / 2, SEGS, 36, (phi, a) => {
        const f = topTaper(phi, 0.12);
        return [sePow(Math.cos(a), 2 / 4) * t / 2, sePow(Math.sin(a), 2 / 4) * (w * f) / 2];
      });
      group.add(new THREE.Mesh(g, metal));
      // дорожка камней по верхней дуге
      const s = 1.15;
      const R = Ri + t - s * 0.12;
      const headGap = (cfg._paveGap ?? cfg._stoneW * 0.62 + 0.8) / R;
      const span = (78 * Math.PI) / 180;
      const stepA = (s * 1.12) / R;
      const geo = diamondGeometry('round', s);
      const matrices = [];
      const beadPos = [];
      for (const dir of [1, -1]) {
        for (let a = headGap; a <= span; a += stepA) {
          const phi = Math.PI / 2 + dir * a;
          const er = new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), er);
          matrices.push(new THREE.Matrix4().compose(er.clone().multiplyScalar(R), q, new THREE.Vector3(1, 1, 1)));
          for (const z of [-1, 1]) beadPos.push(er.clone().multiplyScalar(R + 0.12).setZ(z * s * 0.56));
        }
      }
      group.add(instancedStones(geo, mats, cfg.gem2, matrices));
      const bead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), metal, beadPos.length);
      beadPos.forEach((p, i) => bead.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
      group.add(bead);
      break;
    }
    case 'twist': {
      t = 1.7; w = 2.4;
      const r0 = 0.62;
      for (const ph of [0, Math.PI]) {
        const g = sweepRing(Ri + t / 2, 320, 20, (phi, a) => {
          const k = 7;
          const ou = Math.sin(k * phi + ph) * 0.24;
          const ov = Math.cos(k * phi + ph) * (w / 2 - r0) * topTaper(phi, 0.2);
          return [ou + Math.cos(a) * r0, ov + Math.sin(a) * r0];
        });
        group.add(new THREE.Mesh(g, metal));
      }
      break;
    }
    default: { // classic
      t = 1.75; w = 2.4;
      const g = sweepRing(Ri + t / 2, SEGS, 32, (phi, a) => {
        const f = topTaper(phi, 0.22);
        return [sePow(Math.cos(a), 2 / 2.6) * t / 2, sePow(Math.sin(a), 2 / 2.6) * (w * f) / 2];
      });
      group.add(new THREE.Mesh(g, metal));
    }
  }
  return { t, w };
}

// ---------------------------------------------------------------------------
//  Касты (центральный камень + крепление). Строится в локальных координатах:
//  рундист камня на y = 0, площадка вверх. Возвращает группу и нижнюю точку.
// ---------------------------------------------------------------------------
function tube(points, radius, closed, mat, segs = 48) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 12, closed), mat);
}

function outlinePoints3(pts2, scale, y) {
  return pts2.map(([x, z]) => new THREE.Vector3(x * scale, y, z * scale));
}

function nearestByAngle(pts, deg) {
  const target = (deg * Math.PI) / 180;
  let best = 0, bd = Infinity;
  pts.forEach(([x, z], i) => {
    const a = Math.atan2(z, x) - target;
    const d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); // разница углов с учётом перехода через 360°
    if (d < bd) { bd = d; best = i; }
  });
  return pts[best];
}

export function buildHead(cfg, mats, { baseY = null, baseHalfWidth = 1.1 } = {}) {
  const grp = new THREE.Group();
  const W = cfg._stoneW;
  const geo = diamondGeometry(cfg.shape, W);
  const { crown, pav } = geo.userData;
  const outline = getOutline(cfg.shape).points.map(([x, z]) => [x * W, z * W]);
  const headMetal = mats.metal(headMetalId(cfg));
  if (mats.raytrace) grp.add(createGemMesh(geo, mats.gemRT(cfg.gem1, geo)));
  else grp.add(stoneMesh(geo, mats.gem(cfg.gem1)));

  const pr = THREE.MathUtils.clamp(0.28 + W * 0.035, 0.38, 0.62); // радиус крапана
  const bottom = baseY ?? -pav - 1.2;

  if (cfg.setting === 'bezel') {
    const outer = offsetOutline(outline, 0.55);
    const inner = offsetOutline(outline, -0.28);
    const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, z)));
    shape.holes.push(new THREE.Path(inner.map(([x, z]) => new THREE.Vector2(x, z))));
    const h = crown * 0.35 + pav * 0.55;
    const eg = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 4 });
    eg.rotateX(Math.PI / 2);         // экструзия по -Y
    eg.translate(0, crown * 0.35, 0);
    eg.computeVertexNormals();
    grp.add(new THREE.Mesh(eg, headMetal));
    // нижняя «чашка» и стойки к шинке
    const cupY = crown * 0.35 - h;
    const cupPts = offsetOutline(outline, 0.1).map(([x, z]) => [x * 0.7, z * 0.7]);
    grp.add(tube(outlinePoints3(cupPts, 1, cupY + 0.1), 0.3, true, headMetal, 64));
    for (const deg of [45, 135, 225, 315]) {
      const [x, z] = nearestByAngle(cupPts, deg);
      grp.add(tube([
        new THREE.Vector3(x, cupY + 0.1, z),
        new THREE.Vector3(x * 0.55, (cupY + bottom) / 2, THREE.MathUtils.clamp(z * 0.55, -baseHalfWidth, baseHalfWidth)),
        new THREE.Vector3(Math.sign(x) * Math.min(Math.abs(x) * 0.3, 1.2), bottom, THREE.MathUtils.clamp(z * 0.25, -baseHalfWidth * 0.8, baseHalfWidth * 0.8)),
      ], 0.32, false, headMetal, 24));
    }
    return { group: grp, crown, pav };
  }

  // Крапана
  const angles = PRONG_ANGLES[cfg.shape] || PRONG_ANGLES.round;
  // с ореолом у круглого камня 4 крапана по диагоналям, у остальных — как обычно
  const prongAngles = cfg.setting === 'halo' && cfg.shape === 'round' ? [45, 135, 225, 315] : angles;
  const nProngs = prongAngles.length;
  const rail = outline.map(([x, z]) => [x * 0.8, z * 0.8]);
  grp.add(tube(outlinePoints3(rail, 1, -pav * 0.45), pr * 0.62, true, headMetal, 96));
  for (let i = 0; i < nProngs; i++) {
    const [x, z] = nearestByAngle(outline, prongAngles[i]);
    const len = Math.hypot(x, z) || 1;
    const nx = x / len, nz = z / len;
    const tipIn = 0.55 + pr * 0.6;
    const pts = [
      new THREE.Vector3(THREE.MathUtils.clamp(x * 0.22, -1.2, 1.2), bottom, THREE.MathUtils.clamp(z * 0.22, -baseHalfWidth * 0.8, baseHalfWidth * 0.8)),
      new THREE.Vector3(x * 0.5, -pav * 0.62, z * 0.5),
      new THREE.Vector3(x * 0.8 + nx * pr * 0.3, -pav * 0.28, z * 0.8 + nz * pr * 0.3),
      new THREE.Vector3(x + nx * pr * 0.55, 0, z + nz * pr * 0.55),
      new THREE.Vector3(x - nx * tipIn * 0.4 + nx * pr * 0.3, crown * 0.42, z - nz * tipIn * 0.4 + nz * pr * 0.3),
    ];
    grp.add(tube(pts, pr, false, headMetal, 40));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(pr * 1.08, 16, 12), headMetal);
    tip.position.copy(pts[pts.length - 1]);
    tip.scale.set(1, 0.8, 1);
    grp.add(tip);
  }

  if (cfg.setting === 'halo') {
    const s = THREE.MathUtils.clamp(W * 0.13, 0.95, 1.5);
    const path = offsetOutline(outline, s * 0.5 + 0.3);
    // длина пути
    let per = 0;
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[(i + 1) % path.length];
      per += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const count = Math.max(10, Math.floor(per / (s * 1.08)));
    const ptsH = resample(path, count);
    const y = -crown * 0.15;
    const sgeo = diamondGeometry('round', s);
    const matrices = ptsH.map(([x, z]) => new THREE.Matrix4().makeTranslation(x, y, z));
    grp.add(instancedStones(sgeo, mats, cfg.gem2, matrices));
    // металлическая рамка ореола
    grp.add(tube(outlinePoints3(offsetOutline(path, s * 0.48), 1, y - s * 0.1), 0.22, true, headMetal, 128));
    grp.add(tube(outlinePoints3(offsetOutline(path, -s * 0.48), 1, y - s * 0.1), 0.18, true, headMetal, 128));
    grp.add(tube(outlinePoints3(path, 1, y - s * 0.42), s * 0.36, true, headMetal, 128));
    // корнеры между камнями
    const beads = ptsH.map((p, i) => mid(p, ptsH[(i + 1) % ptsH.length]));
    const bead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), headMetal, beads.length * 2);
    let bi = 0;
    const outerB = offsetOutline(beads, s * 0.36), innerB = offsetOutline(beads, -s * 0.36);
    for (const arr of [outerB, innerB]) for (const [x, z] of arr) bead.setMatrixAt(bi++, new THREE.Matrix4().makeTranslation(x, y + s * 0.05, z));
    grp.add(bead);
  }
  return { group: grp, crown, pav };
}

// ---------------------------------------------------------------------------
//  Кольцо
// ---------------------------------------------------------------------------
function stoneDepth(shape, width) {
  const geo = diamondGeometry(shape, width); // только для размеров
  const { pav } = geo.userData;
  geo.dispose();
  return pav;
}

export function buildRing(cfg, mats) {
  const group = new THREE.Group();
  const c = { ...cfg, _stoneW: stoneWidth(cfg.shape, cfg.carat) };
  const W = c._stoneW;
  const Ri = cfg.size / 2;
  const trilogy = isTrilogy(c.shank);
  // трилогия: боковые камни-груши вдоль шинки, остриём к центральному
  let side = null;
  if (trilogy) {
    const Ws = THREE.MathUtils.clamp(W * 0.6, 3, 6.2);
    const Ls = Ws * getOutline('pear').aspect;
    const haloExtra = c.setting === 'halo' ? THREE.MathUtils.clamp(W * 0.13, 0.95, 1.5) + 0.45 : 0;
    // ширина центрального камня поперёк шинки (по X) — 0.5·W
    side = { Ws, Ls, offset: W / 2 + haloExtra + Ls / 2 + 0.05 };
    c._paveGap = side.offset + Ls / 2 + 0.9;
  }
  const { t, w } = buildShank(c, Ri, mats, group);
  const pav = stoneDepth(c.shape, W);
  const lift = c.setting === 'bezel' ? 0.5 : 0.7;
  const yc = Ri + t + pav + lift;
  const head = buildHead(c, mats, { baseY: -(pav + lift) - 0.25, baseHalfWidth: w / 2 });
  head.group.position.y = yc;
  group.add(head.group);

  if (side) {
    const pavS = stoneDepth('pear', side.Ws);
    const liftS = 0.45;
    const Rs = Ri + t + pavS + liftS;
    const delta = side.offset / Rs;
    const sideCfg = { ...c, shape: 'pear', setting: 'prong', gem1: c.gem2, _stoneW: side.Ws };
    for (const dir of [1, -1]) {
      const sh = buildHead(sideCfg, mats, { baseY: -(pavS + liftS) - 0.25, baseHalfWidth: w / 2 });
      // остриё груши (+Z) поворачиваем к центру, затем наклоняем по шинке
      sh.group.rotation.set(0, dir > 0 ? -Math.PI / 2 : Math.PI / 2, -dir * delta, 'ZYX');
      sh.group.position.set(dir * Rs * Math.sin(delta), Rs * Math.cos(delta), 0);
      group.add(sh.group);
    }
  }
  group.userData.kind = 'ring';
  return group;
}

// ---------------------------------------------------------------------------
//  Пусеты (пара серёг-гвоздиков)
// ---------------------------------------------------------------------------
export function buildStuds(cfg, mats) {
  const group = new THREE.Group();
  const c = { ...cfg, _stoneW: stoneWidth(cfg.shape, cfg.carat) };
  const metal = mats.metal(headMetalId(c));
  const gap = Math.max(c._stoneW * (getOutline(c.shape).aspect > 1.2 ? 1.25 : 1.6), 7);
  for (const side of [-1, 1]) {
    const stud = new THREE.Group();
    const head = buildHead(c, mats, { baseY: null, baseHalfWidth: 1.4 });
    stud.add(head.group);
    const bottom = -head.pav - 1.2;
    // основание + штифт + заглушка
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 24), metal);
    base.position.y = bottom - 0.1;
    stud.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 9, 16), metal);
    post.position.y = bottom - 4.5;
    stud.add(post);
    const back = new THREE.Mesh(new THREE.SphereGeometry(2.6, 32, 16), metal);
    back.scale.set(1, 0.36, 1);
    back.position.y = bottom - 7.2;
    stud.add(back);
    // лицом к зрителю (+Z) с лёгким наклоном
    stud.rotation.x = Math.PI / 2 - 0.08;
    stud.rotation.y = side * 0.12;
    stud.position.x = side * gap * 0.62;
    group.add(stud);
  }
  group.userData.kind = 'studs';
  return group;
}

export function buildProduct(cfg, mats) {
  return cfg.type === 'studs' ? buildStuds(cfg, mats) : buildRing(cfg, mats);
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.userData.disposeMaterial && o.material) o.material.dispose();
  });
}
