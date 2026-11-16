/*
 * Right panel: Registration — demo clock, carts, queue, results, manual actions,
 * confirmed classes, waitlists, exports.
 */
(function () {
  'use strict';
  const App = window.App; const esc = App.esc;

  function fmtClock(ms) {
    return new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }
  function fmtCountdown(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + (d || h || m ? m + 'm ' : '') + sec + 's';
  }

  App.updateClock = function () {
    const el = document.getElementById('clock-now'); if (!el) return;
    const st = App.state; const open = App.isWindowOpen();
    el.textContent = fmtClock(st.clock.sim);
    const cd = document.getElementById('clock-countdown');
    cd.textContent = open ? 'Opened ' + fmtClock(App.windowOpensAt) : 'Opens in ' + fmtCountdown(App.windowOpensAt - st.clock.sim) + ' (' + fmtClock(App.windowOpensAt) + ')';
  };

  function clockCard() {
    const st = App.state; const open = App.isWindowOpen();
    return '<div class="card clock-card ' + (open ? 'is-open' : 'is-before') + '">' +
      '<div class="clock-row"><div><div class="tiny muted">DEMO CLOCK (simulated)</div><div id="clock-now" class="clock-now" aria-live="off"></div></div>' +
      '<span class="badge ' + (open ? 'open' : 'closed') + ' big" role="status">' + (open ? 'Registration window OPEN' : 'Before registration window') + '</span></div>' +
      '<div id="clock-countdown" class="small"></div>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn small" data-act="clk-before" data-fk="clk-before">Set to 30 s before window</button>' +
      '<button type="button" class="btn small primary" data-act="clk-open" data-fk="clk-open"' + (open ? ' disabled' : '') + '>Open window now</button>' +
      '<button type="button" class="btn small ghost" data-act="clk-toggle" data-fk="clk-toggle" aria-pressed="' + !st.clock.running + '">' + (st.clock.running ? 'Pause clock' : 'Resume clock') + '</button></div>' +
      '<p class="tiny muted">In-app simulation: the clock only runs while this page is open, and queued registration is attempted by this tab — not by a real background service.</p></div>';
  }

  function studentCard() {
    const st = App.state; const s = SEED.student;
    return '<div class="card row-card"><div class="small"><strong>' + esc(s.name) + '</strong> (demo student) · ' + esc(s.major) + ' major · ' + esc(s.standing) + ' standing</div>' +
      '<label class="inline-label">Credit-hour limit <input type="number" id="credit-limit" data-fk="credit-limit" min="1" max="30" value="' + st.creditLimit + '"></label></div>';
  }

  function cartList(kind) {
    const cart = App.state.carts[kind];
    if (!cart.length) return '<div class="empty small"><p>' + (kind === 'primary' ? 'Primary cart is empty. Use “Add schedule to primary cart” under the calendar.' : 'Backup cart is empty. Use “Add schedule to backup cart” under the calendar.') + '</p></div>';
    const sources = [...new Set(cart.map(c => c.from))];
    return '<p class="tiny muted">Copied from: ' + sources.map(esc).join(', ') + '</p><ul class="cart">' + cart.map(c => {
      const s = App.sec(c.unique); const stt = App.statusOf(c.unique);
      return '<li><span><strong>' + esc(s.course) + '</strong> #' + c.unique + ' · ' + esc(s.title) + ' · ' + s.credits + ' hrs<br><small class="muted">' +
        App.meetingText(s).map(esc).join(' / ') + '</small></span>' +
        '<span class="badge ' + stt + '">' + stt + '</span>' +
        '<button type="button" class="icon-btn" data-act="cart-rm" data-kind="' + kind + '" data-u="' + c.unique + '" data-fk="cartrm-' + kind + '-' + c.unique + '" aria-label="Remove ' + esc(App.label(c.unique)) + ' from ' + kind + ' cart">×</button></li>';
    }).join('') + '</ul>';
  }

  function precheck(kind) {
    const cart = App.state.carts[kind].map(c => c.unique);
    if (!cart.length) return '';
    const v = App.validate(cart);
    const total = App.registeredCredits() + cart.reduce((t, u) => t + App.sec(u).credits, 0);
    if (v.ok) return '<p class="ok-line small">✓ Pre-check passed (' + total + ' hrs incl. registered). Seats are not held until registration runs.</p>';
    return '<div class="precheck"><p class="small"><strong>Pre-check found problems</strong> — this cart would fail as a whole:</p><ul class="small">' +
      v.cartErrors.map(e => '<li>' + esc(e) + '</li>').join('') +
      v.results.filter(r => r.reasons.length).map(r => '<li><strong>' + esc(App.label(r.unique)) + ':</strong> ' + r.reasons.map(esc).join(' ') + '</li>').join('') + '</ul></div>';
  }

  function queueBanner() {
    const q = App.state.queue;
    if (q.status !== 'queued') return '';
    return '<div class="banner queued" role="status"><strong>Queued.</strong> Register All will run automatically when the window opens (' + fmtClock(App.windowOpensAt) +
      '), using the primary cart as it is at that moment' + (App.state.backupEnabled ? ', then the backup cart if the primary fails' : '') + '. Queued at ' + fmtClock(q.queuedAt) +
      '. Keep this tab open. <button type="button" class="link-btn" data-act="queue-cancel" data-fk="queue-cancel">Cancel queue</button></div>';
  }

  function resultRows(step) {
    if (step.skipped) return '<p class="small muted">' + esc(step.note) + '</p>';
    let h = '';
    if (step.cartErrors && step.cartErrors.length) h += '<ul class="small err-list">' + step.cartErrors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>';
    h += '<ul class="results">' + (step.results || []).map(r => {
      const failed = r.reasons.length;
      let txt;
      if (failed) txt = r.reasons.map(esc).join(' ');
      else txt = step.ok ? 'Registered.' : 'Passed its own checks, but not registered — the request failed as a whole (all-or-nothing).';
      return '<li class="' + (failed ? 'bad' : step.ok ? 'good' : 'neutral') + '"><span class="ico" aria-hidden="true">' + (failed ? '✗' : step.ok ? '✓' : '–') + '</span><span><strong>' +
        esc(App.label(r.unique)) + (App.sec(r.unique) ? ' ' + esc(App.sec(r.unique).title) : '') + '</strong><br>' + txt + '</span></li>';
    }).join('') + '</ul>';
    return h;
  }

  App.renderAttempt = function (att) {
    return '<div class="attempt ' + (att.ok ? 'ok' : 'fail') + '"><div class="att-head"><strong>' + esc(att.trigger) + '</strong><span class="tiny muted">' + fmtClock(att.at) + '</span></div>' +
      '<p class="att-sum ' + (att.ok ? 'good' : 'bad') + '">' + (att.ok ? '✓ ' : '✗ ') + esc(att.summary) + '</p>' +
      att.steps.map(s => '<div class="step"><div class="step-head">' + esc(s.label) + (s.skipped ? ' <span class="badge neutral">skipped</span>' :
        ' <span class="badge ' + (s.ok ? 'open' : 'closed') + '">' + (s.ok ? 'succeeded' : 'failed') + '</span>') + '</div>' + resultRows(s) + '</div>').join('') +
      (att.waitlistOffer && App.waitlistEligibility(att.waitlistOffer).ok ? '<button type="button" class="btn small" data-act="join-wl" data-u="' + att.waitlistOffer + '" data-fk="attwl-' + att.waitlistOffer + '">Join waitlist for #' + att.waitlistOffer + '</button>' : '') +
      '</div>';
  };

  function resultsCard() {
    const atts = App.state.attempts.filter(a => a.kind === 'cart');
    if (!atts.length) return '<div class="empty small"><p>No cart registration attempts yet.</p></div>';
    return App.renderAttempt(atts[0]) + (atts.length > 1 ? '<details class="history"><summary>Earlier attempts (' + (atts.length - 1) + ')</summary>' + atts.slice(1).map(App.renderAttempt).join('') + '</details>' : '');
  }

  // ----- manual registration -----
  function sectionPicker(model, prefix) {
    const st = App.state;
    const schOpts = st.schedules.map(s => '<option value="' + s.id + '"' + (model.scheduleId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const sch = st.schedules.find(s => s.id === model.scheduleId) || st.schedules[0];
    if (sch && !model.scheduleId) model.scheduleId = sch.id;
    const secOpts = sch ? sch.sections.map(u => '<option value="' + u + '"' + (model.unique === u ? ' selected' : '') + '>' + esc(App.label(u)) + ' – ' + esc(App.sec(u).title) + '</option>').join('') : '';
    return '<fieldset class="picker"><legend>Section</legend>' +
      '<div class="radio-row"><label><input type="radio" name="' + prefix + '-src" value="schedule" data-m="source" data-fk="' + prefix + '-src-s"' + (model.source === 'schedule' ? ' checked' : '') + '> From a saved schedule</label>' +
      '<label><input type="radio" name="' + prefix + '-src" value="typed" data-m="source" data-fk="' + prefix + '-src-t"' + (model.source === 'typed' ? ' checked' : '') + '> Enter unique number</label></div>' +
      (model.source === 'schedule'
        ? (st.schedules.length
          ? '<div class="two"><label>Schedule<select data-m="scheduleId" data-fk="' + prefix + '-sch">' + schOpts + '</select></label>' +
            '<label>Section<select data-m="unique" data-fk="' + prefix + '-sec"><option value="">Choose…</option>' + secOpts + '</select></label></div>'
          : '<p class="small muted">No saved schedules — enter a unique number instead.</p>')
        : '<label>Unique number<input type="text" inputmode="numeric" maxlength="5" placeholder="e.g. 19445" data-m="typed" data-fk="' + prefix + '-typed" value="' + esc(model.typed) + '"></label>') +
      '</fieldset>';
  }
  function pickedUnique(model) { return model.source === 'typed' ? model.typed.trim() : model.unique; }

  function manualCard() {
    const ui = App.ui; const st = App.state; const tab = ui.manualTab;
    const tabs = [['add', 'Add'], ['drop', 'Drop'], ['cdrop', 'Conditional Drop']].map(([k, l]) =>
      '<button type="button" role="tab" id="mt-' + k + '" aria-selected="' + (tab === k) + '" aria-controls="mt-panel" tabindex="' + (tab === k ? 0 : -1) + '" data-act="mtab" data-tab="' + k + '" data-fk="mtab-' + k + '">' + l + '</button>').join('');
    const regOpts = st.registered.map(u => '<option value="' + u + '">' + esc(App.label(u)) + ' – ' + esc(App.sec(u).title) + '</option>').join('');
    let body = '';
    if (tab === 'add') {
      body = sectionPicker(ui.manual.add, 'ma') + '<button type="button" class="btn primary" data-act="m-add" data-fk="m-add">Add section</button>' +
        '<p class="tiny muted">Uses the same checks as Register All.</p>';
    } else if (tab === 'drop') {
      if (!st.registered.length) body = '<p class="small muted">You have no confirmed classes to drop.</p>';
      else {
        if (!st.registered.includes(ui.manual.drop.unique)) ui.manual.drop.unique = st.registered[0];
        body = '<label>Registered section<select data-m="unique" data-fk="md-sec">' + regOpts.replace('value="' + ui.manual.drop.unique + '"', 'value="' + ui.manual.drop.unique + '" selected') + '</select></label>' +
          '<button type="button" class="btn danger" data-act="m-drop" data-fk="m-drop">Drop…</button>';
      }
    } else {
      const m = ui.manual.cdrop;
      if (!st.registered.length) body = '<p class="small muted">You have no confirmed classes to swap.</p>';
      else {
        if (!st.registered.includes(m.oldUnique)) m.oldUnique = st.registered[0];
        body = '<label>Drop this registered section<select data-m="oldUnique" data-fk="mc-old">' + regOpts.replace('value="' + m.oldUnique + '"', 'value="' + m.oldUnique + '" selected') + '</select></label>' +
          '<p class="small">…only if this replacement can be registered:</p>' + sectionPicker(m, 'mc') +
          '<button type="button" class="btn primary" data-act="m-cdrop" data-fk="m-cdrop">Conditional drop…</button>' +
          '<p class="tiny muted">Atomic swap: if the replacement fails any check, you keep the original.</p>';
      }
    }
    const res = ui.manualResult ? st.attempts.find(a => a.id === ui.manualResult) : null;
    return '<div class="tabs" role="tablist" aria-label="Manual registration action">' + tabs + '</div>' +
      '<div id="mt-panel" role="tabpanel" aria-labelledby="mt-' + tab + '" class="mt-panel" data-model="' + tab + '">' +
      (!App.isWindowOpen() ? '<p class="banner info small">The registration window is not open yet, so manual actions will be refused. Open it with the demo clock.</p>' : '') +
      body + '</div>' + (res ? '<div class="manual-result" aria-live="polite">' + App.renderAttempt(res) + '</div>' : '');
  }

  function confirmedCard() {
    const st = App.state;
    if (!st.registered.length) return '<div class="empty small"><p>No confirmed classes yet.</p></div>';
    const total = App.registeredCredits();
    return '<ul class="cart">' + st.registered.map(u => {
      const s = App.sec(u);
      return '<li><span><strong>' + esc(s.course) + '</strong> #' + u + ' · ' + esc(s.title) + ' · ' + s.credits + ' hrs<br><small class="muted">' + App.meetingText(s).map(esc).join(' / ') + ' · ' + esc(s.instructor) + '</small></span></li>';
    }).join('') + '</ul><p class="total"><strong>Total registered: ' + total + ' hrs</strong> <span class="muted small">(limit ' + st.creditLimit + ')</span></p>';
  }

  function waitlistCard() {
    const st = App.state;
    if (!st.waitlists.length) return '<div class="empty small"><p>Not on any waitlists. Full sections show a “Join waitlist” button in the Course Schedule.</p></div>';
    return '<ul class="cart">' + st.waitlists.map(w => {
      const s = App.sec(w.unique);
      const offered = w.status === 'offered';
      return '<li class="wl-item"><span><strong>' + esc(s.course) + '</strong> #' + w.unique + ' · ' + esc(s.title) + '<br>' +
        '<small>Position <strong>' + w.position + '</strong> of ' + App.seats(w.unique).waitlisted + ' · Status: ' +
        (offered ? '<strong class="warn-text">Seat offered — not yet enrolled</strong>' : 'Waiting') + ' · Not counted toward registered hours</small>' +
        (offered ? '<br><small>An offer lets you attempt registration; it still has to pass every check and is not guaranteed enrollment.</small>' : '') + '</span>' +
        '<span class="btn-col">' +
        (offered ? '<button type="button" class="btn small primary" data-act="wl-accept" data-u="' + w.unique + '" data-fk="wla-' + w.unique + '">Accept &amp; try to register</button>'
          : '<button type="button" class="btn small ghost" data-act="wl-sim" data-u="' + w.unique + '" data-fk="wls-' + w.unique + '">Simulate a seat opening</button>') +
        '<button type="button" class="btn small danger" data-act="wl-leave" data-u="' + w.unique + '" data-fk="wll-' + w.unique + '">Leave waitlist</button></span></li>';
    }).join('') + '</ul>';
  }

  function exportCard() {
    const has = App.state.registered.length > 0;
    return '<div class="btn-row">' +
      '<button type="button" class="btn small" data-act="exp-pdf" data-fk="exp-pdf"' + (has ? '' : ' disabled') + '>Download PDF</button>' +
      '<button type="button" class="btn small" data-act="exp-jpg" data-fk="exp-jpg"' + (has ? '' : ' disabled') + '>Download JPEG</button>' +
      '<button type="button" class="btn small" data-act="exp-ics" data-fk="exp-ics"' + (has ? '' : ' disabled') + '>Download .ics calendar file</button></div>' +
      '<p class="tiny muted">' + (has ? '' : 'Register for at least one class to enable exports. ') +
      'The .ics file is a calendar <em>file export</em>: import it in Google Calendar (Settings → Import &amp; export) or Outlook (Add calendar → Upload from file). No account connection is made.</p>';
  }

  App.renderRegistration = function () {
    const st = App.state;
    const root = document.getElementById('registration-body');
    root.innerHTML =
      clockCard() + studentCard() +
      '<section class="card" aria-labelledby="h-primary"><h3 id="h-primary">Primary cart <span class="count">' + st.carts.primary.length + '</span></h3>' +
      cartList('primary') + precheck('primary') + queueBanner() +
      '<div class="btn-row"><button type="button" class="btn primary" data-act="register-all" data-fk="register-all"' + (st.carts.primary.length ? '' : ' disabled') + '>' +
      (App.isWindowOpen() ? 'Register All' : (st.queue.status === 'queued' ? 'Queued ✓' : 'Register All (queue for window)')) + '</button>' +
      (st.carts.primary.length ? '<button type="button" class="btn small ghost" data-act="cart-clear" data-kind="primary" data-fk="clr-primary">Clear cart</button>' : '') + '</div>' +
      '<p class="tiny muted">All-or-nothing: if any section fails, none in the cart are registered and your confirmed classes stay the same.</p></section>' +

      '<section class="card" aria-labelledby="h-backup"><h3 id="h-backup">Backup cart <span class="count">' + st.carts.backup.length + '</span></h3>' +
      '<label class="check"><input type="checkbox" id="backup-enabled" data-fk="backup-enabled"' + (st.backupEnabled ? ' checked' : '') + '> Automatically try the backup cart if the primary attempt fails</label>' +
      cartList('backup') + precheck('backup') +
      (st.carts.backup.length ? '<button type="button" class="btn small ghost" data-act="cart-clear" data-kind="backup" data-fk="clr-backup">Clear cart</button>' : '') + '</section>' +

      '<section class="card" aria-labelledby="h-results"><h3 id="h-results">Registration results</h3><div aria-live="polite">' + resultsCard() + '</div></section>' +
      '<section class="card" aria-labelledby="h-manual"><h3 id="h-manual">Manual registration</h3>' + manualCard() + '</section>' +
      '<section class="card" aria-labelledby="h-confirmed"><h3 id="h-confirmed">Confirmed classes</h3>' + confirmedCard() + '</section>' +
      '<section class="card" aria-labelledby="h-wl"><h3 id="h-wl">Waitlists <span class="count">' + st.waitlists.length + '</span></h3>' + waitlistCard() + '</section>' +
      '<section class="card" aria-labelledby="h-export"><h3 id="h-export">Export confirmed schedule</h3>' + exportCard() + '</section>';
    App.updateClock();
  };

  // ----- actions -----
  App.runRegisterAll = function (trigger) {
    const att = App.registerAll(trigger);
    App.render();
    App.toast((att.ok ? '✓ ' : '✗ ') + att.summary, att.ok ? 'success' : 'error');
    const h = document.getElementById('h-results'); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function modelFor(el) {
    const tab = App.ui.manualTab; return App.ui.manual[tab];
  }

  App.initRegistration = function () {
    const col = document.getElementById('col-registration');

    col.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'backup-enabled') { App.state.backupEnabled = t.checked; App.save(); App.render(); return; }
      if (t.id === 'credit-limit') {
        const v = Math.round(Number(t.value));
        if (!v || v < 1 || v > 30) { App.toast('Credit limit must be between 1 and 30.', 'error'); App.render(); return; }
        App.state.creditLimit = v; App.save(); App.render(); App.toast('Credit-hour limit set to ' + v + '.', 'info'); return;
      }
      if (t.dataset.m) {
        const m = modelFor(t);
        m[t.dataset.m] = t.value;
        if (t.dataset.m === 'scheduleId') m.unique = '';
        if (t.dataset.m !== 'typed') App.render();
      }
    });
    col.addEventListener('input', e => { const t = e.target; if (t.dataset.m === 'typed') modelFor(t).typed = t.value; });

    col.addEventListener('keydown', e => {
      if (e.target.getAttribute('role') === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const order = ['add', 'drop', 'cdrop']; let i = order.indexOf(App.ui.manualTab);
        i = (i + (e.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
        App.ui.manualTab = order[i]; App.ui.manualResult = null; App.render();
        document.getElementById('mt-' + order[i]).focus();
      }
      if (e.key === 'Enter' && e.target.dataset.m === 'typed') {
        e.preventDefault();
        const btn = col.querySelector(App.ui.manualTab === 'add' ? '[data-act="m-add"]' : '[data-act="m-cdrop"]'); if (btn) btn.click();
      }
    });

    col.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const st = App.state; const u = b.dataset.u;
      switch (b.dataset.act) {
        case 'clk-before': st.clock.sim = App.windowOpensAt - 30000; App.save(); App.render(); App.toast('Clock set to 30 seconds before the window opens.', 'info'); break;
        case 'clk-open': App.setClock(App.windowOpensAt); break;
        case 'clk-toggle': st.clock.running = !st.clock.running; App.save(); App.render(); break;
        case 'register-all':
          if (App.isWindowOpen()) App.runRegisterAll('Register All (immediate)');
          else if (st.queue.status === 'queued') App.toast('Already queued. It will run when the window opens.', 'info');
          else {
            App.queueRegistration(); App.render();
            const v = App.validate(st.carts.primary.map(c => c.unique));
            App.toast('Queued. Registration will be attempted automatically when the window opens.' + (v.ok ? '' : ' ⚠ The primary cart currently has problems and would fail' + (st.backupEnabled ? ' (backup will then be tried).' : '.')), v.ok ? 'success' : 'warn');
          }
          break;
        case 'queue-cancel': App.cancelQueue(); App.render(); App.toast('Queued registration cancelled.', 'info'); break;
        case 'cart-rm': st.carts[b.dataset.kind] = st.carts[b.dataset.kind].filter(c => c.unique !== u); App.save(); App.render(); App.toast('Removed ' + App.label(u) + ' from the ' + b.dataset.kind + ' cart.', 'info'); break;
        case 'cart-clear': {
          const ok = await App.confirmDialog({ title: 'Clear ' + b.dataset.kind + ' cart?', body: 'Remove all ' + st.carts[b.dataset.kind].length + ' sections from the ' + b.dataset.kind + ' cart? Saved schedules are not affected.', confirmText: 'Clear cart' });
          if (ok) { st.carts[b.dataset.kind] = []; App.save(); App.render(); }
          break;
        }
        case 'mtab': App.ui.manualTab = b.dataset.tab; App.ui.manualResult = null; App.render(); break;
        case 'm-add': {
          const pu = pickedUnique(App.ui.manual.add);
          if (!pu) { App.toast('Choose a section or enter a unique number.', 'error'); break; }
          const att = App.manualAdd(pu); App.ui.manualResult = att.id; App.render();
          App.toast((att.ok ? '✓ ' : '✗ ') + att.summary, att.ok ? 'success' : 'error'); break;
        }
        case 'm-drop': {
          const du = App.ui.manual.drop.unique || st.registered[0]; if (!du) break;
          const ok = await App.confirmDialog({ title: 'Drop class?', body: 'Drop <strong>' + esc(App.label(du)) + ' ' + esc(App.sec(du).title) + '</strong>? Your seat will be released and may be taken by someone else.', confirmText: 'Drop class', danger: true });
          if (!ok) break;
          const att = App.manualDrop(du); App.ui.manualResult = att.id; App.render();
          App.toast((att.ok ? '✓ ' : '✗ ') + att.summary, att.ok ? 'success' : 'error'); break;
        }
        case 'm-cdrop': {
          const m = App.ui.manual.cdrop; const oldU = m.oldUnique || st.registered[0]; const newU = pickedUnique(m);
          if (!newU) { App.toast('Choose a replacement section or enter its unique number.', 'error'); break; }
          const ok = await App.confirmDialog({ title: 'Conditional drop?', body: 'Drop <strong>' + esc(App.label(oldU)) + '</strong> only if <strong>' + esc(App.sec(newU) ? App.label(newU) + ' ' + App.sec(newU).title : '#' + newU) + '</strong> can be registered. If the replacement fails, you keep ' + esc(App.label(oldU)) + '.', confirmText: 'Try swap' });
          if (!ok) break;
          const att = App.conditionalDrop(oldU, newU); App.ui.manualResult = att.id; App.render();
          App.toast((att.ok ? '✓ ' : '✗ ') + att.summary, att.ok ? 'success' : 'error'); break;
        }
        case 'join-wl': { const r = App.joinWaitlist(u); App.toast(r.msg, r.ok ? 'success' : 'error'); App.render(); break; }
        case 'wl-sim': { const msg = App.simulateSeatOpening(u); App.render(); App.toast(msg, 'info'); break; }
        case 'wl-accept': { const att = App.acceptOffer(u); App.ui.manualResult = att.id; App.render(); App.toast((att.ok ? '✓ ' : '✗ ') + att.summary, att.ok ? 'success' : 'error'); break; }
        case 'wl-leave': {
          const ok = await App.confirmDialog({ title: 'Leave waitlist?', body: 'Leave the waitlist for ' + esc(App.label(u)) + '? You will lose your position.', confirmText: 'Leave waitlist', danger: true });
          if (ok) { App.leaveWaitlist(u); App.render(); App.toast('Left the waitlist for ' + App.label(u) + '.', 'info'); }
          break;
        }
        case 'exp-pdf': App.exportPdf(); break;
        case 'exp-jpg': App.exportJpeg(); break;
        case 'exp-ics': App.exportIcs(); break;
      }
    });
  };
})();
