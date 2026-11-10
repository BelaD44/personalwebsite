/*
 * App shell: rendering orchestration, focus preservation, toasts, dialogs,
 * demo clock loop, reset, and the scenario guide.
 */
(function () {
  'use strict';
  const App = window.App; const esc = App.esc;

  // ---------- render with focus preservation ----------
  App.render = function () {
    const active = document.activeElement;
    const fk = active && active.dataset ? active.dataset.fk : null;
    App.renderCourses();
    App.renderCalendar();
    App.renderRegistration();
    if (fk) {
      const el = document.querySelector('[data-fk="' + fk + '"]');
      if (el && el !== document.activeElement) el.focus({ preventScroll: true });
    }
    const warn = document.getElementById('storage-warn');
    if (warn) warn.hidden = App.storageOk;
  };

  // ---------- toasts ----------
  App.toast = function (msg, type) {
    const box = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.innerHTML = '<span>' + esc(msg) + '</span><button type="button" class="icon-btn" aria-label="Dismiss">×</button>';
    t.querySelector('button').addEventListener('click', () => t.remove());
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.remove(), type === 'error' || type === 'warn' ? 9000 : 5000);
  };

  // ---------- dialogs ----------
  function openDialog(html, onReady) {
    return new Promise(resolve => {
      const dlg = document.getElementById('dlg');
      const prev = document.activeElement;
      dlg.innerHTML = html;
      const done = val => { resolve(val); dlg.close(); if (prev && prev.isConnected) prev.focus(); };
      dlg.onclose = () => resolve(null);
      dlg.oncancel = () => {};
      onReady(dlg, done);
      dlg.showModal();
    });
  }
  App.confirmDialog = function (o) {
    return openDialog(
      '<form method="dialog" class="dlg-form"><h2>' + esc(o.title) + '</h2><p>' + o.body + '</p>' +
      '<div class="btn-row end"><button type="button" class="btn" data-x="cancel">Cancel</button>' +
      '<button type="submit" class="btn ' + (o.danger ? 'danger solid' : 'primary') + '" data-x="ok">' + esc(o.confirmText || 'Confirm') + '</button></div></form>',
      (dlg, done) => {
        dlg.querySelector('[data-x="cancel"]').onclick = () => done(false);
        dlg.querySelector('form').onsubmit = e => { e.preventDefault(); done(true); };
        setTimeout(() => dlg.querySelector('[data-x="cancel"]').focus(), 0);
      }).then(v => !!v);
  };
  App.promptDialog = function (o) {
    return openDialog(
      '<form method="dialog" class="dlg-form"><h2>' + esc(o.title) + '</h2><label>' + esc(o.label) +
      '<input type="text" id="dlg-input" maxlength="60" required value="' + esc(o.value || '') + '"></label><p class="err small" id="dlg-err" hidden>Please enter a name.</p>' +
      '<div class="btn-row end"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn primary">Save</button></div></form>',
      (dlg, done) => {
        const inp = dlg.querySelector('#dlg-input');
        dlg.querySelector('[data-x="cancel"]').onclick = () => done(null);
        dlg.querySelector('form').onsubmit = e => {
          e.preventDefault(); const v = inp.value.trim();
          if (!v) { dlg.querySelector('#dlg-err').hidden = false; inp.focus(); return; }
          done(v);
        };
        setTimeout(() => { inp.focus(); inp.select(); }, 0);
      });
  };

  // ---------- clock ----------
  App.setClock = function (ms) {
    const wasOpen = App.isWindowOpen();
    App.state.clock.sim = ms;
    App.save();
    if (!wasOpen && App.isWindowOpen()) onWindowOpened();
    else App.render();
  };
  function onWindowOpened() {
    App.toast('The registration window is now open (simulated).', 'info');
    if (App.state.queue.status === 'queued') App.runRegisterAll('Queued Register All (ran when window opened)');
    else App.render();
  }
  let lastTick = Date.now();
  function tick() {
    const now = Date.now(); const dt = now - lastTick; lastTick = now;
    const st = App.state;
    if (st.clock.running) {
      const wasOpen = App.isWindowOpen();
      st.clock.sim += Math.min(dt, 5000); // clamp: clock doesn't jump if the tab was asleep
      if (!wasOpen && App.isWindowOpen()) { App.save(); onWindowOpened(); return; }
      if (now % 5000 < 1000) App.save();
    }
    App.updateClock();
  }

  // ---------- guide ----------
  const SCENARIOS = [
    ['Open section', 'In Course Schedule, find <b>M E 330 #19400</b> (Open). Hover or press <i>Details</i> to see the description, sample grades, a sample syllabus and the RMP search link. Click <i>Add ▾</i> → pick a schedule.'],
    ['Cancelled section', 'Add a Status: Cancelled filter. Try <i>Add ▾</i> on <b>M E 337C #19470</b> — you get an error and it is not added.'],
    ['Schedule conflict', 'Select <b>Plan A – Conflict demo</b> in the Calendar. Dynamics #19250 and Thermo #19300 overlap (red blocks) and the conflict list names each pair, day, and time. Add Plan A to the primary cart: the pre-check flags it and registration would fail. Remove a section with × to resolve.'],
    ['Compatibility filter', 'Set <i>Fits saved schedule</i> to Plan C. Only sections that add no overlap or duplicate course remain. Turn it off to add a conflicting section on purpose.'],
    ['Queued registration + primary fails, backup succeeds', 'Clock is <b>before the window</b>. Select Plan B → <i>Add schedule to primary cart</i>. Select Plan C → <i>Add schedule to backup cart</i>. Tick “Automatically try the backup cart”. Press <i>Register All</i> (it queues). Press <i>Set to 30 s before window</i> and wait, or <i>Open window now</i>. Primary fails (M E 339 #19500 is full), backup registers.'],
    ['Full section + waitlist', 'With the window open, press <i>Join waitlist</i> on <b>M E 344 #19520</b> (full). See position and status under Waitlists; it adds no registered hours. Use <i>Simulate a seat opening</i> until you get an offer, then <i>Accept &amp; try to register</i> — it can still fail (e.g. time conflict with Thermo #19310 if you registered Plan C).'],
    ['Conditional drop (success)', 'Manual registration → Conditional Drop. Drop <b>M E 335 #19440</b>, replacement unique <b>19445</b>. Confirm → swapped atomically.'],
    ['Conditional drop (fails safely)', 'Drop <b>#19440</b> (or #19445 if you swapped), replacement <b>19450</b> (full). Confirm → swap fails and you keep the original.'],
    ['Other validation', 'Best tried right after opening the window. Manual Add:<b>19660</b> (senior standing required), <b>51000</b> (C S majors only), <b>19420</b> (conflicts with registered #19440), <b>53500</b> after registering Plan C (exceeds the 17-hr limit — raise the limit to see it pass).'],
    ['Exports', 'With confirmed classes, download the PDF, JPEG, or .ics file (import it into Google Calendar or Outlook).']
  ];
  function guideHtml() {
    return '<div class="dlg-form guide"><div class="pop-head"><h2>Try these scenarios</h2><button type="button" class="icon-btn" data-x="close" aria-label="Close guide">×</button></div>' +
      '<p class="small muted">Everything uses mock data saved in this browser. Use <b>Reset demo</b> any time to start over. Demo student: ' + esc(SEED.student.name) + ', ' + SEED.student.major + ' ' + SEED.student.standing + ', already registered for M E 335 #19440.</p>' +
      '<ol class="scenarios">' + SCENARIOS.map(s => '<li><strong>' + s[0] + '.</strong> ' + s[1] + '</li>').join('') + '</ol>' +
      '<div class="btn-row end"><button type="button" class="btn primary" data-x="close">Got it</button></div></div>';
  }
  App.openGuide = function () {
    openDialog(guideHtml(), (dlg, done) => {
      dlg.querySelectorAll('[data-x="close"]').forEach(b => { b.onclick = () => done(true); });
      setTimeout(() => dlg.querySelector('[data-x="close"]').focus(), 0);
    });
  };

  // ---------- init ----------
  document.addEventListener('DOMContentLoaded', () => {
    App.initCourses(); App.initCalendar(); App.initRegistration();
    document.getElementById('btn-guide').addEventListener('click', App.openGuide);
    document.getElementById('btn-reset').addEventListener('click', async () => {
      const ok = await App.confirmDialog({ title: 'Reset demo?', body: 'Restore all seeded schedules, carts, registrations, waitlists, seat counts and the demo clock. Your changes in this browser will be erased.', confirmText: 'Reset demo', danger: true });
      if (!ok) return;
      App.resetState(); App.hidePopover(false);
      App.ui.addMenuFor = null; App.ui.manualResult = null;
      App.ui.manual = { add: { source: 'schedule', scheduleId: '', unique: '', typed: '' }, drop: { unique: '' }, cdrop: { oldUnique: '', source: 'schedule', scheduleId: '', unique: '', typed: '' } };
      App.render(); App.toast('Demo reset to seeded data.', 'success');
    });
    App.render();
    // If the window is already open on load and a queue is pending (e.g. refreshed right after opening), run it.
    if (App.isWindowOpen() && App.state.queue.status === 'queued') onWindowOpened();
    let firstVisit = true;
    try { firstVisit = !localStorage.getItem('ui-proto-guide-seen'); localStorage.setItem('ui-proto-guide-seen', '1'); } catch (e) { /* ignore */ }
    if (firstVisit) App.openGuide();
    setInterval(tick, 1000);
    window.addEventListener('beforeunload', App.save);
  });
})();
