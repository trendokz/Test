// Знак AISUL (бриллиант), векторная версия логотипа.
// Внешний контур минус три внутренних «звезды» (fill-rule: evenodd).
const MARK_PATH =
  'M243 22H557L778 220L400 558L22 220Z' +
  'M400 38L510 182L598 218L518 255L400 540L282 255L202 218L290 182Z' +
  'M205 108L135 185L52 218L130 248L328 458L203 224Z' +
  'M595 108L665 185L748 218L670 248L472 458L597 224Z';

export function logoMark(cls = 'logo-mark', title = '') {
  return `<svg class="${cls}" viewBox="0 0 800 580" ${title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"'}>
    <path d="${MARK_PATH}" fill="currentColor" fill-rule="evenodd"/></svg>`;
}

export function logoLockup(name) {
  return `<span class="logo-lockup" aria-label="${name}">${logoMark('logo-lockup__mark')}<span class="logo-lockup__word">${name}</span></span>`;
}
