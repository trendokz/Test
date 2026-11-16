// 3D-просмотрщик: студийный свет, вращение, зум, готовые ракурсы, превью.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { MaterialLibrary, buildProduct, disposeObject } from './jewelry.js';

// Студия для отражений: RoomEnvironment + дополнительные яркие софтбоксы,
// чтобы камни «играли» и на металле были чёткие блики.
function makeStudioScene() {
  const scene = new RoomEnvironment();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const add = (intensity, pos, scale) => {
    const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity) }));
    m.position.set(...pos); m.scale.set(...scale);
    scene.add(m);
  };
  add(14, [0, 13, 0], [7, 0.1, 7]);
  add(10, [-9, 4, 5], [0.1, 5, 3]);
  add(10, [9, 5, -3], [0.1, 3, 6]);
  add(6, [3, 2, 11], [4, 2, 0.1]);
  add(8, [-3, 6, -11], [5, 1, 0.1]);
  // глубокий синий отсвет окружения — металл «вписывается» в фон сайта
  const blue = (pos, scale) => {
    const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.12, 0.35) }));
    m.position.set(...pos); m.scale.set(...scale);
    scene.add(m);
  };
  blue([0, -6, 0], [30, 0.1, 30]);
  blue([0, 3, -14], [30, 12, 0.1]);
  return scene;
}

// Студия для трассировки бриллиантов: тёмная комната с крупными софтбоксами,
// узкими полосами света и множеством точечных «искр». Высокий контраст
// светлых и тёмных участков даёт блеск, а точечный свет — радужную игру.
function makeRTGemScene() {
  const scene = new THREE.Scene();
  const sphere = new THREE.SphereGeometry(60, 48, 24);
  const colors = [];
  const pos = sphere.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 60; // -1..1
    const t = (y + 1) / 2;
    colors.push(0.04 + 0.24 * t * t, 0.045 + 0.26 * t * t, 0.065 + 0.3 * t * t);
  }
  sphere.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const plane = new THREE.PlaneGeometry(1, 1);
  const panel = (k, dir, w, h, tint = [1, 1, 1]) => {
    const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: new THREE.Color(k * tint[0], k * tint[1], k * tint[2]), side: THREE.DoubleSide }));
    m.position.copy(new THREE.Vector3(...dir).normalize().multiplyScalar(30));
    m.lookAt(0, 0, 0);
    m.scale.set(w, h, 1);
    scene.add(m);
  };
  // крупные софтбоксы
  panel(4.2, [0, 1, 0.15], 22, 22);
  panel(4.5, [-1, 0.5, 0.8], 14, 20);
  panel(4.5, [1, 0.5, 0.8], 14, 20);
  panel(3.5, [0, 0.35, -1], 26, 10);
  panel(3, [-1, 0.3, -0.7], 10, 16);
  panel(3, [1, 0.3, -0.7], 10, 16);
  panel(2.2, [0, 0.15, 1], 20, 8);
  // узкие полосы (дают чёткие блики на гранях)
  panel(7, [-1, 0.2, -0.3], 1.2, 22);
  panel(7, [1, 0.25, -0.4], 1.2, 22);
  panel(5, [0.3, 0.1, 1], 22, 1);
  panel(4, [0, -0.25, 1], 26, 0.8);
  // точечные искры
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const v = [rnd() * 2 - 1, rnd() * 1.6 - 0.35, rnd() * 2 - 1];
    const s = 0.35 + rnd() * 0.9;
    panel(18 + rnd() * 40, v, s, s);
  }
  // тёплый и холодный рефлекторы — лёгкий цветовой характер, как в студии
  panel(2.4, [-0.7, 0.9, -0.6], 7, 7, [1, 0.88, 0.72]);
  panel(2.4, [0.8, 0.8, 0.5], 6, 6, [0.75, 0.86, 1]);
  return scene;
}

// Контрастная «ювелирная» студия для камней: тёмный фон и много ярких
// софтбоксов — так грани дают чёрно-белую игру, как у настоящего бриллианта.
function makeGemScene() {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.11, 0.11, 0.12), side: THREE.BackSide }),
  );
  scene.add(room);
  const geo = new THREE.PlaneGeometry(1, 1);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 64; i++) {
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const k = 1.1 + rnd() * 3;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.copy(v.multiplyScalar(20));
    m.lookAt(0, 0, 0);
    m.scale.set(1.5 + rnd() * 4, 1 + rnd() * 3, 1);
    scene.add(m);
  }
  const top = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5), side: THREE.DoubleSide }));
  top.position.set(0, 20, 0); top.lookAt(0, 0, 0); top.scale.set(6, 6, 1);
  scene.add(top);
  return scene;
}

function createEnv(renderer) {
  const studio = makeStudioScene();
  const gemStudio = makeGemScene();
  const pmremGen = new THREE.PMREMGenerator(renderer);
  const pmrem = pmremGen.fromScene(studio, 0.03).texture;
  const mk = (mapping) => {
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cam = new THREE.CubeCamera(0.1, 100, rt);
    cam.update(renderer, gemStudio);
    rt.texture.mapping = mapping;
    return rt.texture;
  };
  const rtGem = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter });
  new THREE.CubeCamera(0.1, 200, rtGem).update(renderer, makeRTGemScene());
  const env = {
    pmrem,
    refractCube: mk(THREE.CubeRefractionMapping),
    reflectCube: mk(THREE.CubeReflectionMapping),
    gemCube: renderer.capabilities.isWebGL2 ? rtGem.texture : null,
  };
  pmremGen.dispose();
  return env;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,4,14,0.65)');
  grd.addColorStop(0.45, 'rgba(0,4,14,0.25)');
  grd.addColorStop(1, 'rgba(0,4,14,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Фон превью — такой же синий бархатный градиент, как у 3D-сцены
function thumbBackground() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 225, 10, 256, 240, 380);
  grd.addColorStop(0, '#2a4c94');
  grd.addColorStop(0.45, '#102654');
  grd.addColorStop(1, '#050b1b');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function setupRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

// Ракурсы (направление камеры). Кольцо стоит вертикально, камень сверху (+Y),
// палец проходит вдоль оси Z.
const VIEWS = {
  ring: {
    hero:  new THREE.Vector3(0.95, 0.55, 1.25),
    front: new THREE.Vector3(0, 0.12, 1),
    side:  new THREE.Vector3(1, 0.15, 0.02),
    top:   new THREE.Vector3(0.001, 1, 0.08),
  },
  studs: {
    hero:  new THREE.Vector3(0.35, 0.3, 1),
    front: new THREE.Vector3(0, 0, 1),
    side:  new THREE.Vector3(1, 0.1, 0.25),
    top:   new THREE.Vector3(0.001, 1, 0.25),
  },
};

function fitInfo(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return { box, sphere };
}

export class Viewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    setupRenderer(this.renderer);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);
    this.env = createEnv(this.renderer);
    this.mats = new MaterialLibrary(this.env);

    this.scene = new THREE.Scene();
    this.scene.environment = this.env.pmrem;
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 6, 4);
    this.scene.add(key, new THREE.HemisphereLight(0xfff6ea, 0x1b2c58, 0.55));

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.5, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.8;
    this.controls.autoRotateSpeed = 2.2;
    this.controls.addEventListener('start', () => {
      this._anim = null;
      this.onInteract?.();
    });

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    this.model = null;
    this.kind = 'ring';
    this._anim = null;
    this._clock = new THREE.Clock();

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    this._loop = this._loop.bind(this);
    this._running = true;
    requestAnimationFrame(this._loop);
    document.addEventListener('visibilitychange', () => {
      this._running = !document.hidden;
      if (this._running) requestAnimationFrame(this._loop);
    });
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._dirty = true;
  }

  setProduct(cfg, { keepView = false } = {}) {
    const kindChanged = this.kind !== (cfg.type === 'studs' ? 'studs' : 'ring');
    if (this.model) {
      this.scene.remove(this.model);
      disposeObject(this.model);
    }
    this.model = buildProduct(cfg, this.mats);
    this.kind = this.model.userData.kind;
    // центрирование
    const { box, sphere } = fitInfo(this.model);
    const center = sphere.center;
    this.model.position.sub(center);
    this.radius = sphere.radius;
    this.scene.add(this.model);
    this._dirty = true;
    const floorY = box.min.y - center.y - 0.05;
    this.shadow.position.set(0, floorY, 0);
    const sw = this.kind === 'studs' ? (box.max.x - box.min.x) * 1.2 : sphere.radius * 2.2;
    this.shadow.scale.set(sw, this.kind === 'studs' ? sw * 0.5 : sphere.radius * 1.4, 1);
    this.shadow.visible = this.kind === 'ring';

    // точка, к которой «подъезжает» камера при приближении (камень)
    this.focusY = this.kind === 'ring' ? box.max.y - center.y - 2.2 : 0;
    this.controls.minDistance = this.radius * 0.9;
    this.controls.maxDistance = this.radius * 7;
    if (!keepView || kindChanged) this.setView('hero', false);
  }

  _distance() {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.min(this.camera.aspect, 1);
    return (this.radius / Math.sin(fov / 2)) / Math.max(aspect, 0.6) * 1.05;
  }

  setView(name, animate = true) {
    const dir = (VIEWS[this.kind][name] || VIEWS[this.kind].hero).clone().normalize();
    const target = dir.multiplyScalar(this._distance());
    if (!animate) {
      this.controls.target.set(0, 0, 0);
      this.camera.position.copy(target);
      this.controls.update();
      return;
    }
    this._anim = { from: this.camera.position.clone().sub(this.controls.target), to: target, t: 0 };
  }

  setAutoRotate(on) { this.controls.autoRotate = on; }

  zoom(factor) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const c = THREE.MathUtils.clamp(off.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this._anim = { from: off.clone(), to: off.clone().setLength(c), t: 0 };
  }

  _loop() {
    if (!this._running) return;
    const dt = this._clock.getDelta();
    if (this._anim) {
      const a = this._anim;
      a.t = Math.min(1, a.t + dt / 0.7);
      const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2;
      // интерполяция по сфере, чтобы камера облетала объект
      const r = THREE.MathUtils.lerp(a.from.length(), a.to.length(), e);
      const v = a.from.clone().normalize().lerp(a.to.clone().normalize(), e);
      if (v.lengthSq() < 1e-6) v.set(0, 1, 0);
      this.camera.position.copy(v.setLength(r)).add(this.controls.target);
      if (a.t >= 1) this._anim = null;
    }
    const moving = !!this._anim;
    if (this.focusY) {
      const base = this._distance();
      const d = this.camera.position.distanceTo(this.controls.target);
      const k = THREE.MathUtils.clamp(((base - d) / (base - this.controls.minDistance)) * 1.7, 0, 1);
      const ty = this.focusY * k;
      const dy = ty - this.controls.target.y;
      this.controls.target.y = ty;
      this.camera.position.y += dy;
    }
    const changed = this.controls.update();
    // рисуем только когда что-то изменилось — экономит батарею телефона
    if (changed || moving || this._dirty || this.controls.autoRotate) {
      this._dirty = false;
      const t0 = performance.now();
      this.renderer.render(this.scene, this.camera);
      this._adapt(performance.now() - t0, dt);
    }
    requestAnimationFrame(this._loop);
  }

  // Адаптивное качество: если кадр слишком тяжёлый, снижаем плотность пикселей.
  _adapt(cpuMs, dt) {
    const frame = Math.max(cpuMs, dt * 1000);
    this._slow = frame > 45 ? (this._slow || 0) + 1 : Math.max(0, (this._slow || 0) - 1);
    const pr = this.renderer.getPixelRatio();
    if (this._slow > 8 && pr > 1) {
      this.renderer.setPixelRatio(Math.max(1, pr - 0.25));
      this.resize();
      this._slow = 0;
    }
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}

// Отрисовка превью для каталога одним общим WebGL-контекстом.
export class Thumbnailer {
  constructor(size = 360) {
    this.size = size;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    setupRenderer(this.renderer);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    // непрозрачный фон в цвет карточки — так аддитивные блики камня
    // корректно сохраняются в картинку
    this.renderer.setClearColor(0x0c1a36, 1);
    this.env = createEnv(this.renderer);
    this.mats = new MaterialLibrary(this.env);
    this.scene = new THREE.Scene();
    this.scene.environment = this.env.pmrem;
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 6, 4);
    this.scene.add(key, new THREE.HemisphereLight(0xfff6ea, 0x1b2c58, 0.55));
    this.scene.background = thumbBackground();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.5, 2000);
    this.cache = new Map();
    this.queue = [];
    this.busy = false;
  }

  request(key, cfg) {
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    const existing = this.queue.find((q) => q.key === key);
    if (existing) return existing.promise;
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    this.queue.push({ key, cfg, resolve, promise });
    this._pump();
    return promise;
  }

  // Очередь сортируется так, чтобы видимые карточки шли первыми
  prioritize(keys) {
    const set = new Set(keys);
    this.queue.sort((a, b) => (set.has(b.key) ? 1 : 0) - (set.has(a.key) ? 1 : 0));
  }

  cancelAll() { this.queue.length = 0; }

  _pump() {
    if (this.busy || !this.queue.length) return;
    this.busy = true;
    const job = this.queue.shift();
    const run = () => {
      try {
        const url = this._render(job.cfg);
        this.cache.set(job.key, url);
        job.resolve(url);
      } catch (e) {
        console.warn('[thumb]', e);
        job.resolve(null);
      }
      this.busy = false;
      setTimeout(() => this._pump(), 0);
    };
    (window.requestIdleCallback || ((f) => setTimeout(f, 16)))(run);
  }

  _render(cfg) {
    const model = buildProduct(cfg, this.mats);
    const { sphere } = fitInfo(model);
    model.position.sub(sphere.center);
    this.scene.add(model);
    const kind = model.userData.kind;
    const dir = VIEWS[kind].hero.clone().normalize();
    const d = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 0.98;
    this.camera.position.copy(dir.multiplyScalar(d));
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/webp', 0.9);
    this.scene.remove(model);
    disposeObject(model);
    return url;
  }
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
