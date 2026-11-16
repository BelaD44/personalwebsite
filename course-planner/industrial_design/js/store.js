/*
 * State + persistence. All demo state lives in one object saved to localStorage.
 * If storage is unavailable (private mode, blocked), the app still works in memory.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const KEY = 'ui-proto-course-planner-state'; // separate from the original prototype's storage

  // Static catalog (never mutated). Seat counts live in state.seats.
  App.catalog = {};
  SEED.sections.forEach(s => { App.catalog[s.unique] = s; });

  function freshState() {
    const seats = {};
    SEED.sections.forEach(s => { seats[s.unique] = { enrolled: s.enrolled, waitlisted: s.waitlisted }; });
    return {
      version: SEED.version,
      seats,
      schedules: SEED.schedules.map(s => ({ id: s.id, name: s.name, sections: s.sections.slice() })),
      activeScheduleId: SEED.schedules[0].id,
      carts: { primary: [], backup: [] },
      backupEnabled: false,
      registered: SEED.registered.slice(),
      waitlists: [],          // {unique, position, status: 'waiting'|'offered', joinedAt}
      queue: { status: 'none', queuedAt: null },
      attempts: [],           // newest first
      clock: { sim: new Date(SEED.clockStart).getTime(), running: true },
      creditLimit: SEED.defaultCreditLimit,
      filters: [],            // {type, value}
      nextId: 1
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === SEED.version) return parsed;
      }
    } catch (e) { /* storage unavailable or corrupt → fall back to fresh */ }
    return freshState();
  }

  App.state = load();
  App.storageOk = true;

  App.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(App.state)); App.storageOk = true; }
    catch (e) { App.storageOk = false; }
  };

  App.resetState = function () {
    App.state = freshState();
    App.save();
  };

  App.uid = function (prefix) {
    const id = prefix + '-' + Date.now().toString(36) + '-' + (App.state.nextId++);
    return id;
  };

  // Transient UI state (not persisted)
  App.ui = {
    addMenuFor: null,
    popoverFor: null,
    popoverPinned: false,
    manualTab: 'add',
    manual: {
      add: { source: 'schedule', scheduleId: '', unique: '', typed: '' },
      drop: { unique: '' },
      cdrop: { oldUnique: '', source: 'schedule', scheduleId: '', unique: '', typed: '' }
    },
    manualResult: null
  };
})();
