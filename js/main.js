import {
  BRAND, SHAPES, SHANKS, SETTINGS, SETTING_SHAPES, METALS, PURITIES, STONE_COLORS,
  CARATS, RING_SIZES, STUD_SETTINGS, PRICING, DEFAULTS,
} from './config.js';
import { shapeSVG } from './shapes.js';
import { logoMark, logoLockup } from './logo.js';

const app = document.getElementById('app');
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (list, id) => list.find((x) => x.id === id) || list[0];
const fmtPhone = (d) => (/^7\d{10}$/.test(d) ? `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : `+${d}`);
const money = (n) => (n == null ? 'Цена по запросу' : `${Math.round(n).toLocaleString(BRAND.locale)} ${BRAND.currency}`);

let viewerMod = null;      // модуль 3D загружается лениво
let viewer = null;         // экземпляр Viewer (живёт между страницами)
let thumbnailer = null;
let has3D = true;

async function load3D() {
  if (!viewerMod) {
    viewerMod = await import('./viewer.js');
    has3D = viewerMod.webglAvailable();
  }
  return viewerMod;
}

// ---------------------------------------------------------------------------
//  Цены
// ---------------------------------------------------------------------------
export function priceOf(cfg) {
  const purity = byId(PURITIES, cfg.purity).price;
  const gem1 = byId(STONE_COLORS, cfg.gem1);
  const gem2 = byId(STONE_COLORS, cfg.gem2);
  if (cfg.type === 'studs') {
    const base = byId(STUD_SETTINGS, cfg.setting).price;
    let p = Math.max(base * PRICING.minPriceFactor, base + PRICING.caratPrice * 2 * (cfg.carat - 1));
    p += purity;
    if (gem1.fancy) p += PRICING.fancyColorPerCarat * cfg.carat * 2;
    if (cfg.setting === 'halo' && gem2.fancy) p += PRICING.fancySide * 2;
    return Math.round(p / 1000) * 1000;
  }
  const base = byId(SHANKS, cfg.shank).price + byId(SETTINGS, cfg.setting).price;
  let p = Math.max(base * PRICING.minPriceFactor, base + PRICING.caratPrice * (cfg.carat - 1));
  p += purity;
  if (gem1.fancy) p += PRICING.fancyColorPerCarat * cfg.carat;
  if (hasSideStones(cfg) && gem2.fancy) p += PRICING.fancySide * (cfg.setting === 'halo' && cfg.shank === 'pave' ? 2 : 1);
  return Math.round(p / 1000) * 1000;
}

const hasSideStones = (cfg) => cfg.setting === 'halo' || (cfg.type !== 'studs' && cfg.shank === 'pave');
const settingAllowed = (setting, shape) => !SETTING_SHAPES[setting] || SETTING_SHAPES[setting].includes(shape);

export function productName(cfg) {
  const shape = byId(SHAPES, cfg.shape).label;
  if (cfg.type === 'studs') return `Пусеты ${byId(STUD_SETTINGS, cfg.setting).label} · ${shape}`;
  return `Кольцо ${byId(SHANKS, cfg.shank).label} ${byId(SETTINGS, cfg.setting).label} · ${shape}`;
}

// ---------------------------------------------------------------------------
//  Маршрутизация (hash)
// ---------------------------------------------------------------------------
// Адреса страниц — только латиница, цифры и дефисы (так ссылка работает
// на любом хостинге и во встроенных просмотрщиках):
//   #catalog-rings-round-oval                     — каталог
//   #ring-oval-pave-halo-150-rose-same-585-white-white-170 — кольцо
//   #studs-round-halo-100-white-same-750-white-white     — пусеты
const RING_KEYS = ['shape', 'shank', 'setting', 'carat', 'metal', 'head', 'purity', 'gem1', 'gem2', 'size'];
const STUD_KEYS = ['shape', 'setting', 'carat', 'metal', 'head', 'purity', 'gem1', 'gem2'];

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [head, ...rest] = raw.split('-');
  const params = new URLSearchParams();
  if (head === 'catalog') {
    const shapes = rest.filter((t) => SHAPES.some((s) => s.id === t));
    const type = rest.find((t) => t === 'rings' || t === 'studs');
    if (shapes.length) params.set('shapes', shapes.join(','));
    if (type) params.set('type', type);
    return { path: '/catalog', params };
  }
  if (head === 'ring' || head === 'studs') {
    (head === 'ring' ? RING_KEYS : STUD_KEYS).forEach((k, i) => {
      if (rest[i] == null) return;
      let v = rest[i];
      if (k === 'carat') v = String(parseInt(v, 10) / 100);
      if (k === 'size') v = String(parseInt(v, 10) / 10);
      params.set(k, v);
    });
    return { path: '/' + head, params };
  }
  return { path: '/', params };
}
function catalogHash(shapes = [], type = 'all') {
  return '#' + ['catalog', ...(type !== 'all' ? [type] : []), ...shapes].join('-');
}
function cfgHash(cfg) {
  const isRing = cfg.type !== 'studs';
  const vals = (isRing ? RING_KEYS : STUD_KEYS).map((k) => {
    if (k === 'carat') return Math.round(cfg.carat * 100);
    if (k === 'size') return Math.round(cfg.size * 10);
    return cfg[k];
  });
  return '#' + [isRing ? 'ring' : 'studs', ...vals].join('-');
}

function cfgFromParams(type, p) {
  const num = (k, list, d) => { const v = parseFloat(p.get(k)); return list.includes(v) ? v : d; };
  const pick = (k, list, d) => (list.some((x) => x.id === p.get(k)) ? p.get(k) : d);
  const cfg = {
    type,
    shape: pick('shape', SHAPES, DEFAULTS.shape),
    shank: pick('shank', SHANKS, DEFAULTS.shank),
    setting: pick('setting', type === 'studs' ? STUD_SETTINGS : SETTINGS, DEFAULTS.setting),
    carat: num('carat', CARATS, DEFAULTS.carat),
    metal: pick('metal', METALS, DEFAULTS.metal),
    head: ['same', 'white'].includes(p.get('head')) ? p.get('head') : DEFAULTS.head,
    purity: pick('purity', PURITIES, DEFAULTS.purity),
    gem1: pick('gem1', STONE_COLORS, DEFAULTS.gem1),
    gem2: pick('gem2', STONE_COLORS, DEFAULTS.gem2),
    size: num('size', RING_SIZES, DEFAULTS.size),
  };
  if (!settingAllowed(cfg.setting, cfg.shape)) cfg.setting = 'prong';
  return cfg;
}
function cfgToParams(cfg) {
  const o = { shape: cfg.shape, setting: cfg.setting, carat: cfg.carat, metal: cfg.metal, head: cfg.head, purity: cfg.purity, gem1: cfg.gem1, gem2: cfg.gem2 };
  if (cfg.type !== 'studs') Object.assign(o, { shank: cfg.shank, size: cfg.size });
  return o;
}
// Внутри встроенного просмотрщика (iframe) своего адреса у страницы нет — ссылку не даём.
const embedded = (() => { try { return window.self !== window.top || location.origin === 'null'; } catch { return true; } })();
const cfgUrl = (cfg) => (embedded ? null : `${location.origin}${location.pathname}${cfgHash(cfg)}`);
const cfgText = (cfg) => `${productName(cfg)}, ${cfg.carat} ct, ${byId(METALS, cfg.metal).label} ${byId(PURITIES, cfg.purity).label}`
  + (cfg.type !== 'studs' ? `, размер ${cfg.size}` : '') + ` — ${money(priceOf(cfg))}`;

// ---------------------------------------------------------------------------
//  Общие элементы
// ---------------------------------------------------------------------------
function header(back) {
  return `<header class="topbar">
    ${back ? `<a class="topbar__back" href="${back}" aria-label="Назад">←</a>` : '<span class="topbar__back"></span>'}
    <a class="brand" href="#home" aria-label="${esc(BRAND.name)} — на главную">${logoMark('brand__mark')}<span>${esc(BRAND.name)}</span></a>
    <a class="topbar__link" href="#catalog">Каталог</a>
  </header>`;
}

// ---------------------------------------------------------------------------
//  Страница 1: выбор формы
// ---------------------------------------------------------------------------
function renderHome() {
  const selected = new Set();
  app.innerHTML = `${header()}
  <main class="home">
    <section class="hero">
      <div class="hero__logo">${logoLockup(esc(BRAND.name))}</div>
      <p class="eyebrow">${esc(BRAND.tagline)}</p>
      <h1>Соберите своё украшение</h1>
      <p class="lead">Выберите форму бриллианта — покажем подходящие кольца и пусеты. Каждое изделие можно рассмотреть в 3D со всех сторон и настроить: металл, камни, карат, размер.</p>
    </section>
    <section class="shapes">
      <div class="shapes__head">
        <h2>Форма бриллианта</h2>
        <button class="link-btn" id="selAll">Выбрать все</button>
      </div>
      <div class="shape-grid">
        ${SHAPES.map((s) => `<button class="shape-tile" data-shape="${s.id}" aria-pressed="false">
            ${shapeSVG(s.id, 64)}<span>${esc(s.label)}</span></button>`).join('')}
      </div>
      <div class="sticky-cta"><button class="btn btn--primary" id="showBtn">Показать все изделия</button></div>
    </section>
  </main>`;
  const btn = $('#showBtn'), selAll = $('#selAll');
  const sync = () => {
    app.querySelectorAll('.shape-tile').forEach((t) => {
      const on = selected.has(t.dataset.shape);
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-pressed', on);
    });
    btn.textContent = selected.size ? `Показать изделия (${selected.size} ${plural(selected.size, ['форма', 'формы', 'форм'])})` : 'Показать все изделия';
    selAll.textContent = selected.size === SHAPES.length ? 'Снять выбор' : 'Выбрать все';
  };
  app.querySelectorAll('.shape-tile').forEach((t) => t.addEventListener('click', () => {
    const id = t.dataset.shape;
    selected.has(id) ? selected.delete(id) : selected.add(id);
    sync();
  }));
  selAll.addEventListener('click', () => {
    if (selected.size === SHAPES.length) selected.clear(); else SHAPES.forEach((s) => selected.add(s.id));
    sync();
  });
  btn.addEventListener('click', () => { location.hash = catalogHash([...selected]); });
}

function plural(n, [one, few, many]) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// ---------------------------------------------------------------------------
//  Страница 2: каталог
// ---------------------------------------------------------------------------
async function renderCatalog(params) {
  const shapeIds = (params.get('shapes') || '').split(',').filter((id) => SHAPES.some((s) => s.id === id));
  const shapes = shapeIds.length ? shapeIds : SHAPES.map((s) => s.id);
  const type = ['rings', 'studs'].includes(params.get('type')) ? params.get('type') : 'all';

  const items = [];
  for (const shape of shapes) {
    if (type !== 'studs') {
      for (const sh of SHANKS) for (const st of SETTINGS) {
        if (!settingAllowed(st.id, shape)) continue;
        items.push({ ...DEFAULTS, type: 'ring', shape, shank: sh.id, setting: st.id });
      }
    }
    if (type !== 'rings') {
      for (const st of STUD_SETTINGS) {
        if (!settingAllowed(st.id, shape)) continue;
        items.push({ ...DEFAULTS, type: 'studs', shape, setting: st.id });
      }
    }
  }
  items.sort((a, b) => priceOf(a) - priceOf(b));

  const shapeLabel = shapeIds.length ? shapeIds.map((id) => byId(SHAPES, id).label).join(', ') : 'Все формы';
  const tab = (id, label) => `<a class="chip ${type === id ? 'is-active' : ''}" href="${catalogHash(shapeIds, id)}">${label}</a>`;
  app.innerHTML = `${header('#home')}
  <main class="catalog">
    <div class="catalog__bar">
      <a class="shape-filter" href="#home">${shapeSVG(shapes[0], 22)}<span>${esc(shapeLabel)}</span><em>Изменить</em></a>
      <div class="chips">${tab('all', 'Все')}${tab('rings', 'Кольца')}${tab('studs', 'Пусеты')}</div>
    </div>
    <p class="catalog__count">${items.length} ${plural(items.length, ['изделие', 'изделия', 'изделий'])} · цены за камень 1 ct, металл и камни настраиваются</p>
    <div class="product-grid">
      ${items.map((cfg, i) => `<a class="card" href="${cfgHash(cfg)}" data-i="${i}">
          <div class="card__img"><div class="card__ph" aria-hidden="true">${shapeSVG(cfg.shape, 48)}</div></div>
          <div class="card__body"><div class="card__name">${esc(productName(cfg))}</div><div class="card__price">от ${money(priceOf(cfg))}</div></div>
        </a>`).join('')}
    </div>
  </main>`;

  const mod = await load3D();
  if (!has3D) return;
  if (!thumbnailer) thumbnailer = new mod.Thumbnailer(360);
  thumbnailer.cancelAll();
  const keyOf = (cfg) => JSON.stringify(cfgToParams(cfg)) + cfg.type;
  const cards = [...app.querySelectorAll('.card')];
  const visible = new Set();
  const fill = (card, url) => {
    if (!url || !card.isConnected) return;
    const img = new Image();
    img.alt = card.querySelector('.card__name').textContent;
    img.src = url;
    img.decoding = 'async';
    img.className = 'card__render';
    card.querySelector('.card__img').replaceChildren(img);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const card = e.target, cfg = items[+card.dataset.i], key = keyOf(cfg);
      if (e.isIntersecting) {
        visible.add(key);
        thumbnailer.request(key, cfg).then((url) => fill(card, url));
        io.unobserve(card);
      }
    }
    thumbnailer.prioritize([...visible]);
  }, { rootMargin: '300px 0px' });
  cards.forEach((c) => io.observe(c));
  cleanup = () => { io.disconnect(); thumbnailer.cancelAll(); };
}

// ---------------------------------------------------------------------------
//  Страница 3: конструктор
// ---------------------------------------------------------------------------
async function renderConfigurator(type, params) {
  const cfg = cfgFromParams(type, params);
  const isRing = type !== 'studs';

  app.innerHTML = `${header(catalogHash([cfg.shape]))}
  <main class="config">
    <section class="stage" id="stage">
      <div class="stage__canvas" id="canvasHost"></div>
      <div class="stage__hint" id="hint"><span class="hint-hand">⟲</span> Вращайте изделие, чтобы рассмотреть его со всех сторон</div>
      <div class="stage__fallback" id="fallback" hidden>3D-просмотр недоступен в этом браузере</div>
      <div class="stage__tools" role="toolbar" aria-label="Ракурсы">
        <button data-view="hero" class="is-active">3/4</button>
        <button data-view="front">Спереди</button>
        <button data-view="side">Сбоку</button>
        <button data-view="top">Сверху</button>
        <button id="spinBtn" title="Автовращение 360°">360°</button>
      </div>
      <div class="stage__zoom">
        <button id="zoomIn" aria-label="Приблизить">+</button>
        <button id="zoomOut" aria-label="Отдалить">−</button>
        <button id="fsBtn" aria-label="Во весь экран">⤢</button>
      </div>
    </section>
    <aside class="panel">
      <div class="panel__head">
        <h1 id="pName"></h1>
        <div class="price" id="pPrice"></div>
        <p class="muted">Ориентировочная цена. Точную стоимость подтвердит менеджер.</p>
      </div>
      <div id="opts"></div>
      <div class="summary" id="summary"></div>
      <div class="panel__cta">
        <button class="btn btn--primary" id="orderBtn">Оформить заявку</button>
        <button class="btn btn--ghost" id="shareBtn">Поделиться</button>
      </div>
    </aside>
  </main>`;

  const optsEl = $('#opts');
  const group = (title, key, body, extra = '') => `<fieldset class="opt" data-key="${key}"><legend>${title}${extra}</legend>${body}</fieldset>`;
  const pills = (key, list, cur, fmt = (x) => esc(x.label), dis = () => false) =>
    `<div class="pills">${list.map((x) => `<button class="pill ${String(x.id) === String(cur) ? 'is-active' : ''}" data-key="${key}" data-val="${x.id}" ${dis(x) ? 'disabled' : ''}>${fmt(x)}</button>`).join('')}</div>`;
  const swatches = (key, list, cur) =>
    `<div class="swatches">${list.map((x) => `<button class="swatch ${x.id === cur ? 'is-active' : ''}" data-key="${key}" data-val="${x.id}" title="${esc(x.label)}" style="--c:${x.color}"><i></i><span>${esc(x.label)}</span></button>`).join('')}</div>`;

  function renderOpts() {
    const settings = isRing ? SETTINGS : STUD_SETTINGS;
    optsEl.innerHTML = [
      group('Форма камня', 'shape', `<div class="shape-row">${SHAPES.map((s) => `<button class="shape-mini ${s.id === cfg.shape ? 'is-active' : ''}" data-key="shape" data-val="${s.id}" title="${esc(s.label)}">${shapeSVG(s.id, 40)}<span>${esc(s.label)}</span></button>`).join('')}</div>`),
      isRing ? group('Шинка', 'shank', pills('shank', SHANKS, cfg.shank, (x) => `<b>${esc(x.label)}</b><small>${esc(x.note)}</small>`)) : '',
      group('Каста', 'setting', pills('setting', settings, cfg.setting, (x) => `<b>${esc(x.label)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}`, (x) => !settingAllowed(x.id, cfg.shape))),
      group('Карат центрального камня', 'carat', pills('carat', CARATS.map((c) => ({ id: c, label: `${c} ct` })), cfg.carat)),
      group('Металл', 'metal', swatches('metal', METALS, cfg.metal)),
      group('Металл касты', 'head', pills('head', [{ id: 'same', label: 'Как у шинки' }, { id: 'white', label: 'Белое золото' }], cfg.head)),
      group('Проба', 'purity', pills('purity', PURITIES, cfg.purity)),
      group(isRing ? 'Центральный камень' : 'Камни', 'gem1', swatches('gem1', STONE_COLORS, cfg.gem1)),
      hasSideStones(cfg) ? group('Боковые камни', 'gem2', swatches('gem2', STONE_COLORS, cfg.gem2)) : '',
      isRing ? group('Размер кольца', 'size', `<select class="select" data-key="size">${RING_SIZES.map((s) => `<option value="${s}" ${s === cfg.size ? 'selected' : ''}>${s}</option>`).join('')}</select><a class="link-btn size-help" href="#" id="sizeHelp">Как узнать размер?</a>`) : '',
    ].join('');
  }

  function renderSummary() {
    $('#pName').textContent = productName(cfg);
    $('#pPrice').textContent = money(priceOf(cfg));
    const rows = [
      ['Форма', byId(SHAPES, cfg.shape).label],
      isRing && ['Шинка', byId(SHANKS, cfg.shank).label],
      ['Каста', byId(isRing ? SETTINGS : STUD_SETTINGS, cfg.setting).label],
      ['Карат', `${cfg.carat} ct${isRing ? '' : ' × 2'}`],
      ['Металл', `${byId(METALS, cfg.metal).label}, ${byId(PURITIES, cfg.purity).label}`],
      cfg.head === 'white' && cfg.metal !== 'white' && ['Каста', 'белое золото'],
      ['Камень', byId(STONE_COLORS, cfg.gem1).label],
      hasSideStones(cfg) && ['Боковые', byId(STONE_COLORS, cfg.gem2).label],
      isRing && ['Размер', cfg.size],
    ].filter(Boolean);
    $('#summary').innerHTML = `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  }

  const syncUrl = () => { try { history.replaceState(null, '', cfgHash(cfg)); } catch { /* встроенный просмотр */ } };

  let update3D = () => {};
  function apply(key, val, rerenderOpts) {
    if (key === 'carat' || key === 'size') val = parseFloat(val);
    cfg[key] = val;
    if (key === 'shape' && !settingAllowed(cfg.setting, cfg.shape)) cfg.setting = 'prong';
    if (rerenderOpts) renderOpts();
    renderSummary();
    syncUrl();
    update3D();
  }

  optsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-key]');
    if (!b || b.disabled) return;
    const key = b.dataset.key;
    b.parentElement.querySelectorAll('[data-key]').forEach((x) => x.classList.toggle('is-active', x === b));
    apply(key, b.dataset.val, key === 'shape' || key === 'setting' || key === 'shank');
  });
  optsEl.addEventListener('change', (e) => { if (e.target.matches('select[data-key]')) apply(e.target.dataset.key, e.target.value, false); });
  optsEl.addEventListener('click', (e) => { if (e.target.id === 'sizeHelp') { e.preventDefault(); openSizeHelp(); } });

  renderOpts();
  renderSummary();
  $('#orderBtn').addEventListener('click', () => openOrder(cfg));
  $('#shareBtn').addEventListener('click', async () => {
    const url = cfgUrl(cfg) || cfgText(cfg);
    try {
      await navigator.clipboard.writeText(url);
      toast(cfgUrl(cfg) ? 'Ссылка скопирована' : 'Описание изделия скопировано');
    } catch {
      const m = modal(`<h2>Поделиться</h2><p class="muted">Скопируйте и отправьте.</p>
        <input class="share-input" id="shareUrl" readonly value="${esc(url)}">`);
      const inp = $('#shareUrl', m.el);
      inp.focus(); inp.select();
    }
  });

  // --- 3D
  const mod = await load3D();
  if (!has3D) { $('#fallback').hidden = false; $('#hint').hidden = true; return; }
  const host = $('#canvasHost');
  if (!viewer) viewer = new mod.Viewer(host);
  else { host.appendChild(viewer.renderer.domElement); viewer.container = host; viewer._ro.disconnect(); viewer._ro.observe(host); viewer.resize(); }
  viewer.setProduct(cfg);
  viewer.setAutoRotate(false);
  let timer = null;
  update3D = () => {
    clearTimeout(timer);
    timer = setTimeout(() => viewer.setProduct(cfg, { keepView: true }), 30);
  };
  const hint = $('#hint');
  viewer.onInteract = () => hint.classList.add('is-hidden');
  setTimeout(() => hint.classList.add('is-hidden'), 6000);

  const tools = app.querySelectorAll('.stage__tools [data-view]');
  tools.forEach((b) => b.addEventListener('click', () => {
    tools.forEach((x) => x.classList.toggle('is-active', x === b));
    viewer.setView(b.dataset.view);
  }));
  const spin = $('#spinBtn');
  spin.addEventListener('click', () => {
    const on = !spin.classList.contains('is-active');
    spin.classList.toggle('is-active', on);
    viewer.setAutoRotate(on);
  });
  $('#zoomIn').addEventListener('click', () => viewer.zoom(0.8));
  $('#zoomOut').addEventListener('click', () => viewer.zoom(1.25));
  $('#fsBtn').addEventListener('click', () => {
    const st = $('#stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (st.requestFullscreen) st.requestFullscreen().catch(() => st.classList.toggle('is-max'));
    else st.classList.toggle('is-max');
  });
}

// ---------------------------------------------------------------------------
//  Модальные окна
// ---------------------------------------------------------------------------
function modal(html) {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal__box" role="dialog" aria-modal="true"><button class="modal__x" aria-label="Закрыть">×</button>${html}</div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('.modal__x')) close(); });
  document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
  document.body.appendChild(wrap);
  return { el: wrap, close };
}

function openOrder(cfg) {
  const m = modal(`<h2>Заявка на изделие</h2>
    <p class="muted">${esc(productName(cfg))} · ${money(priceOf(cfg))}</p>
    <form class="form" id="orderForm">
      <label>Ваше имя<input name="name" required autocomplete="name"></label>
      <label>Телефон<input name="phone" type="tel" required autocomplete="tel" placeholder="+7"></label>
      ${BRAND.cities.length > 1 ? `<label>Город<select name="city">${BRAND.cities.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select></label>` : ''}
      <label>Комментарий<textarea name="comment" rows="2" placeholder="Например, гравировка или срок"></textarea></label>
      <button class="btn btn--primary" type="submit">Отправить в WhatsApp</button>
    </form>`);
  $('#orderForm', m.el).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const city = BRAND.cities.find((c) => c.id === f.get('city')) || BRAND.cities[0];
    const isRing = cfg.type !== 'studs';
    const lines = [
      `Здравствуйте! Хочу заказать: ${productName(cfg)}`,
      `Карат: ${cfg.carat} ct${isRing ? '' : ' (каждый камень)'}`,
      `Металл: ${byId(METALS, cfg.metal).label}, ${byId(PURITIES, cfg.purity).label}`,
      cfg.head === 'white' && cfg.metal !== 'white' ? 'Каста: белое золото' : null,
      `Камень: ${byId(STONE_COLORS, cfg.gem1).label}`,
      hasSideStones(cfg) ? `Боковые камни: ${byId(STONE_COLORS, cfg.gem2).label}` : null,
      isRing ? `Размер: ${cfg.size}` : null,
      `Цена: ${money(priceOf(cfg))}`,
      `Имя: ${f.get('name')}`,
      `Телефон: ${f.get('phone')}`,
      f.get('comment') ? `Комментарий: ${f.get('comment')}` : null,
      cfgUrl(cfg) ? `Ссылка: ${cfgUrl(cfg)}` : null,
    ].filter(Boolean);
    const text = lines.join('\n');
    const href = `https://wa.me/${city.whatsapp}?text=${encodeURIComponent(text)}`;
    const box = m.el.querySelector('.modal__box');
    box.innerHTML = `<button class="modal__x" aria-label="Закрыть">×</button>
      <h2>Заявка готова</h2>
      <p class="muted">Нажмите кнопку — откроется WhatsApp с готовым сообщением. Останется только отправить его.</p>
      <a class="btn btn--primary btn--block" href="${esc(href)}" target="_blank" rel="noopener">Открыть WhatsApp</a>
      <p class="muted order-alt">Если WhatsApp не открылся, напишите на номер <b class="selectable">${esc(fmtPhone(city.whatsapp))}</b> и вставьте текст заявки:</p>
      <textarea class="order-text" id="orderText" rows="7" readonly>${esc(text)}</textarea>
      <button class="btn btn--ghost btn--block" id="copyOrder" type="button">Скопировать текст заявки</button>`;
    $('#copyOrder', box).addEventListener('click', async () => {
      const ta = $('#orderText', box);
      try { await navigator.clipboard.writeText(text); toast('Текст скопирован'); }
      catch { ta.focus(); ta.select(); }
    });
  });
}

function openSizeHelp() {
  modal(`<h2>Как узнать размер кольца</h2>
    <p>Размер кольца — это внутренний диаметр в миллиметрах.</p>
    <ol class="steps">
      <li>Возьмите кольцо, которое хорошо сидит на нужном пальце.</li>
      <li>Измерьте линейкой его внутренний диаметр.</li>
      <li>Например, 17 мм — это 17 размер.</li>
    </ol>
    <p class="muted">Без кольца: оберните палец ниткой, измерьте длину и разделите на 3,14.</p>`);
}

function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('is-in'), 10);
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); }, 2200);
}

// ---------------------------------------------------------------------------
let cleanup = null;
function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  document.querySelector('.modal')?.remove();
  const { path, params } = parseHash();
  window.scrollTo(0, 0);
  if (path === '/catalog') renderCatalog(params);
  else if (path === '/ring') renderConfigurator('ring', params);
  else if (path === '/studs') renderConfigurator('studs', params);
  else renderHome();
}
window.addEventListener('hashchange', route);
route();
