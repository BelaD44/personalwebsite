/*
 * UI-prototype layer: light/dark theme switch and resizable desktop columns.
 * Independent of the simulation logic; both settings persist in localStorage.
 */
(function () {
  'use strict';
  const App = window.App;
  const THEME_KEY = 'ui-proto-theme';
  const WIDTH_KEY = 'ui-proto-col-widths';
  const MIN_PX = [300, 320, 320];    // Course Schedule, Calendar, Registration
  const DESKTOP_MQ = window.matchMedia('(min-width: 1101px)');

  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // ---------- theme ----------
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.setAttribute('aria-checked', String(t === 'dark'));
      btn.title = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
  }
  function initTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    document.getElementById('btn-theme').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next); store(THEME_KEY, next);
    });
    // Follow the device setting live only until the user picks a theme explicitly.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = e => { if (!read(THEME_KEY)) applyTheme(e.matches ? 'dark' : 'light'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }

  // ---------- resizable columns ----------
  let fr = [1, 1, 1];
  const cols = () => ['col-courses', 'col-calendar', 'col-registration'].map(id => document.getElementById(id));

  function loadWidths() {
    try {
      const v = JSON.parse(read(WIDTH_KEY));
      if (Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && n > 0)) fr = v;
    } catch (e) { /* default */ }
  }
  function applyWidths() {
    const grid = document.getElementById('columns');
    fr.forEach((f, i) => grid.style.setProperty('--w' + (i + 1) + 'fr', f.toFixed(4) + 'fr'));
    updateAria();
  }
  /** Convert pixel widths to fractions, enforcing per-column minimums. */
  function setPx(px) {
    const total = px.reduce((x, y) => x + y, 0);
    const minSum = MIN_PX.reduce((x, y) => x + y, 0);
    // If the window is too narrow for every minimum (rare above the stacking breakpoint), scale them down.
    const mins = total >= minSum ? MIN_PX : MIN_PX.map(m => m / minSum * total);
    px = px.map((w, i) => Math.max(mins[i], w));
    let over = px.reduce((x, y) => x + y, 0) - total;
    // Give back any excess from the columns with the most room above their minimum.
    while (over > 0.5) {
      let j = 0; px.forEach((v, k) => { if (v - mins[k] > px[j] - mins[j]) j = k; });
      const take = Math.min(over, px[j] - mins[j]);
      if (take <= 0) break;
      px[j] -= take; over -= take;
    }
    fr = px.map(w => w / total * 3);
    applyWidths();
  }
  function currentPx() { return cols().map(el => el.offsetWidth); }
  function save() { store(WIDTH_KEY, JSON.stringify(fr.map(n => Math.round(n * 10000) / 10000))); }

  App.resetWidths = function () {
    fr = [1, 1, 1]; applyWidths(); store(WIDTH_KEY, null);
    App.toast('Sections reset to equal thirds.', 'info');
  };

  function updateAria() {
    const total = fr.reduce((a, b) => a + b, 0);
    document.querySelectorAll('.resizer').forEach(r => {
      const i = Number(r.dataset.index);
      const pct = Math.round(fr.slice(0, i + 1).reduce((a, b) => a + b, 0) / total * 100);
      r.setAttribute('aria-valuenow', String(pct));
      r.setAttribute('aria-valuemin', '0'); r.setAttribute('aria-valuemax', '100');
      r.setAttribute('aria-valuetext', cols().map((c, k) => c.querySelector('h2').textContent.replace(/^\d\s*/, '') + ' ' + Math.round(fr[k] / total * 100) + '%').join(', '));
    });
  }

  function moveBoundary(i, dx) {
    const px = currentPx();
    const sum = px[i] + px[i + 1];
    let a = px[i] + dx;
    a = Math.max(MIN_PX[i], Math.min(sum - MIN_PX[i + 1], a));
    px[i] = a; px[i + 1] = sum - a;
    setPx(px);
  }

  function initResizers() {
    loadWidths(); applyWidths();
    document.getElementById('btn-reset-widths').addEventListener('click', App.resetWidths);

    document.querySelectorAll('.resizer').forEach(r => {
      const i = Number(r.dataset.index);
      let startX = 0, startPx = null;
      r.addEventListener('pointerdown', e => {
        if (!DESKTOP_MQ.matches || e.button !== 0) return;
        e.preventDefault();
        r.setPointerCapture(e.pointerId);
        startX = e.clientX; startPx = currentPx();
        r.classList.add('dragging'); document.body.classList.add('is-resizing');
      });
      r.addEventListener('pointermove', e => {
        if (!startPx) return;
        const dx = e.clientX - startX;
        const px = startPx.slice(); const sum = px[i] + px[i + 1];
        const a = Math.max(MIN_PX[i], Math.min(sum - MIN_PX[i + 1], px[i] + dx));
        px[i] = a; px[i + 1] = sum - a;
        setPx(px);
      });
      const end = () => {
        if (!startPx) return;
        startPx = null; r.classList.remove('dragging'); document.body.classList.remove('is-resizing'); save();
      };
      r.addEventListener('pointerup', end);
      r.addEventListener('pointercancel', end);
      r.addEventListener('dblclick', App.resetWidths);
      r.addEventListener('keydown', e => {
        const step = e.shiftKey ? 96 : 24;
        if (e.key === 'ArrowLeft') { e.preventDefault(); moveBoundary(i, -step); save(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); moveBoundary(i, step); save(); }
        else if (e.key === 'Home') { e.preventDefault(); moveBoundary(i, -10000); save(); }
        else if (e.key === 'End') { e.preventDefault(); moveBoundary(i, 10000); save(); }
        else if (e.key === 'Enter') { e.preventDefault(); App.resetWidths(); }
      });
    });

    // Keep minimums valid when the window shrinks (desktop only).
    let t = null;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => { if (DESKTOP_MQ.matches && currentPx().some((w, k) => w < MIN_PX[k] - 1)) { setPx(currentPx()); } }, 120);
    });
  }

  document.addEventListener('DOMContentLoaded', () => { initTheme(); initResizers(); });
  App._layout = { get fr() { return fr.slice(); }, MIN_PX };
})();
