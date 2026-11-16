/*
 * Pure-ish domain logic: time parsing, conflicts, schedule stats, validation,
 * and the registration engine (all-or-nothing carts, backup, manual actions, waitlists).
 */
(function () {
  'use strict';
  const App = window.App;

  const DAYS = ['M', 'T', 'W', 'TH', 'F'];
  const DAY_NAME = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', TH: 'Thursday', F: 'Friday' };
  const DAY_SHORT = { M: 'Mon', T: 'Tue', W: 'Wed', TH: 'Thu', F: 'Fri' };
  const STANDING_RANK = { Freshman: 1, Sophomore: 2, Junior: 3, Senior: 4, Graduate: 5 };
  App.DAYS = DAYS; App.DAY_NAME = DAY_NAME; App.DAY_SHORT = DAY_SHORT;

  // ---------- parsing ----------
  function parseDays(str) {
    const out = []; let i = 0;
    while (i < str.length) {
      if (str.substr(i, 2) === 'TH') { out.push('TH'); i += 2; }
      else { out.push(str[i]); i += 1; }
    }
    return out;
  }
  function toMin(hm) { const [h, m] = hm.split(':').map(Number); return h * 60 + m; }

  Object.values(App.catalog).forEach(s => {
    s.parsed = s.meetings.map(m => {
      const [days, range, ...room] = m.split(' ');
      const [a, b] = range.split('-');
      return { days: parseDays(days), daysLabel: days, start: toMin(a), end: toMin(b), room: room.join(' ') };
    });
    s.credits = Number(s.num[0]);
    const lvl = Number(s.num.slice(1, 3));
    s.level = lvl >= 80 ? 'Graduate' : lvl >= 20 ? 'Upper division' : 'Lower division';
    s.course = s.dept + ' ' + s.num;
  });

  // ---------- formatting ----------
  App.fmtTime = function (min) {
    let h = Math.floor(min / 60); const m = min % 60; const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
  };
  App.fmtRange = (a, b) => App.fmtTime(a) + '–' + App.fmtTime(b);
  App.fmtDuration = function (min) {
    const h = Math.floor(min / 60), m = min % 60;
    return (h ? h + 'h' : '') + (h && m ? ' ' : '') + (m ? m + 'm' : '') || '0m';
  };
  App.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  // ---------- section helpers ----------
  App.sec = u => App.catalog[String(u).trim()];
  App.seats = u => App.state.seats[u];
  App.statusOf = function (u) {
    const s = App.sec(u); if (!s) return 'unknown';
    if (s.cancelled) return 'cancelled';
    return App.seats(u).enrolled >= s.capacity ? 'closed' : 'open';
  };
  App.label = function (u) { const s = App.sec(u); return s ? s.course + ' #' + s.unique : '#' + u; };
  App.meetingText = function (s) {
    return s.parsed.map(p => p.daysLabel + ' ' + App.fmtRange(p.start, p.end) + ' · ' + p.room);
  };

  // ---------- conflicts ----------
  App.overlaps = function (ua, ub) {
    const a = App.sec(ua), b = App.sec(ub); const out = [];
    if (!a || !b || ua === ub) return out;
    a.parsed.forEach(pa => b.parsed.forEach(pb => {
      pa.days.forEach(d => {
        if (pb.days.includes(d)) {
          const s = Math.max(pa.start, pb.start), e = Math.min(pa.end, pb.end);
          if (s < e) out.push({ day: d, start: s, end: e });
        }
      });
    }));
    out.sort((x, y) => DAYS.indexOf(x.day) - DAYS.indexOf(y.day) || x.start - y.start);
    return out;
  };
  App.conflictPairs = function (uniques) {
    const pairs = [];
    for (let i = 0; i < uniques.length; i++) for (let j = i + 1; j < uniques.length; j++) {
      const ov = App.overlaps(uniques[i], uniques[j]);
      if (ov.length) pairs.push({ a: uniques[i], b: uniques[j], overlaps: ov });
    }
    return pairs;
  };
  App.duplicateCourses = function (uniques) {
    const by = {};
    uniques.forEach(u => { const s = App.sec(u); if (s) (by[s.course] = by[s.course] || []).push(u); });
    return Object.keys(by).filter(c => by[c].length > 1).map(c => ({ course: c, uniques: by[c] }));
  };
  App.overlapText = o => DAY_SHORT[o.day] + ' ' + App.fmtRange(o.start, o.end);

  /** Compatible = not already in schedule, no duplicate course, no time overlap. */
  App.compatibility = function (u, schedule) {
    const s = App.sec(u);
    if (!schedule) return { ok: true };
    if (schedule.sections.includes(u)) return { ok: false, reason: 'Already in ' + schedule.name };
    const dup = schedule.sections.find(x => App.sec(x) && App.sec(x).course === s.course);
    if (dup) return { ok: false, reason: 'Duplicates ' + App.label(dup) };
    for (const x of schedule.sections) {
      const ov = App.overlaps(u, x);
      if (ov.length) return { ok: false, reason: 'Overlaps ' + App.label(x) + ' (' + App.overlapText(ov[0]) + ')' };
    }
    return { ok: true };
  };

  App.scheduleStats = function (uniques) {
    const perDay = {};
    let earliest = null, credits = 0;
    uniques.forEach(u => {
      const s = App.sec(u); if (!s) return;
      credits += s.credits;
      s.parsed.forEach(p => p.days.forEach(d => {
        const pd = perDay[d] = perDay[d] || { start: Infinity, end: -Infinity };
        pd.start = Math.min(pd.start, p.start); pd.end = Math.max(pd.end, p.end);
        if (!earliest || p.start < earliest.start) earliest = { start: p.start, day: d };
      }));
    });
    let longest = null;
    DAYS.forEach(d => {
      const pd = perDay[d]; if (!pd) return;
      const len = pd.end - pd.start;
      if (!longest || len > longest.len) longest = { day: d, start: pd.start, end: pd.end, len };
    });
    return { days: DAYS.filter(d => perDay[d]), earliest, longest, credits };
  };

  // ---------- clock / window ----------
  App.windowOpensAt = new Date(SEED.windowOpensAt).getTime();
  App.isWindowOpen = () => App.state.clock.sim >= App.windowOpensAt;

  // ---------- validation ----------
  App.registeredCredits = list => (list || App.state.registered).reduce((t, u) => t + (App.sec(u) ? App.sec(u).credits : 0), 0);

  function restrictionReason(s) {
    const r = s.restriction; const st = SEED.student;
    if (!r) return null;
    if (r.type === 'major' && st.major !== r.major) return r.text + ' (your major: ' + st.major + ').';
    if (r.type === 'standing' && STANDING_RANK[st.standing] < STANDING_RANK[r.min]) return r.text + ' (your standing: ' + st.standing + ').';
    return null;
  }

  /**
   * Validate candidates as one atomic set against a base list of registered sections.
   * Returns { ok, results:[{unique, reasons[], full}], cartErrors[], totalCredits }.
   */
  App.validate = function (candidates, base, opts) {
    opts = opts || {};
    base = base || App.state.registered;
    const results = []; const cartErrors = [];
    if (!candidates.length) cartErrors.push('Cart is empty — nothing to register.');

    candidates.forEach((u, idx) => {
      const reasons = []; const s = App.sec(u); let full = false;
      if (!s) { results.push({ unique: u, reasons: ['No section with unique number ' + u + ' exists in the catalog.'], full }); return; }
      if (s.cancelled) reasons.push('Section is cancelled.');
      else if (App.seats(u).enrolled >= s.capacity) { full = true; reasons.push('Section is closed — full (' + App.seats(u).enrolled + '/' + s.capacity + ' seats).'); }
      const rr = restrictionReason(s); if (rr) reasons.push(rr);
      if (base.includes(u)) reasons.push('You are already registered for this section.');
      else {
        const sameCourse = base.find(x => App.sec(x) && App.sec(x).course === s.course);
        if (sameCourse) reasons.push('Duplicate course: already registered for ' + App.label(sameCourse) + '.');
      }
      candidates.forEach((v, j) => {
        if (j === idx || !App.sec(v)) return;
        if (v === u) { if (j < idx) reasons.push('Listed more than once in this request.'); return; }
        if (App.sec(v).course === s.course) reasons.push('Duplicate course in this request: also includes ' + App.label(v) + '.');
      });
      base.forEach(x => {
        if (x === u) return;
        const ov = App.overlaps(u, x);
        if (ov.length) reasons.push('Time conflict with registered ' + App.label(x) + ': ' + ov.map(App.overlapText).join(', ') + '.');
      });
      candidates.forEach((v, j) => {
        if (j === idx || v === u) return;
        const ov = App.overlaps(u, v);
        if (ov.length) reasons.push('Time conflict with ' + App.label(v) + ' in this request: ' + ov.map(App.overlapText).join(', ') + '.');
      });
      results.push({ unique: u, reasons, full });
    });

    const uniqueCands = candidates.filter((u, i) => candidates.indexOf(u) === i && App.sec(u));
    const total = App.registeredCredits(base) + uniqueCands.reduce((t, u) => t + App.sec(u).credits, 0);
    if (candidates.length && total > App.state.creditLimit) {
      cartErrors.push('Credit-hour limit exceeded: ' + total + ' hrs total (' + App.registeredCredits(base) + ' registered + ' +
        (total - App.registeredCredits(base)) + ' requested) is over your ' + App.state.creditLimit + '-hr limit.');
    }
    const ok = !cartErrors.length && results.every(r => !r.reasons.length);
    return { ok, results, cartErrors, totalCredits: total };
  };

  App.waitlistEligibility = function (u) {
    const s = App.sec(u); const st = App.state;
    if (!s) return { ok: false, reason: 'Unknown section.' };
    if (s.cancelled) return { ok: false, reason: 'Cancelled sections have no waitlist.' };
    if (App.statusOf(u) !== 'closed') return { ok: false, reason: 'Section has open seats — register instead.' };
    if (st.waitlists.some(w => w.unique === u)) return { ok: false, reason: 'You are already on this waitlist.' };
    if (st.registered.includes(u)) return { ok: false, reason: 'You are already registered for this section.' };
    const same = st.registered.find(x => App.sec(x).course === s.course);
    if (same) return { ok: false, reason: 'Already registered for ' + App.label(same) + ' (use Conditional Drop for swaps).' };
    if (App.seats(u).waitlisted >= s.waitlistCap) return { ok: false, reason: 'Waitlist is full (' + App.seats(u).waitlisted + '/' + s.waitlistCap + ').' };
    const rr = restrictionReason(s); if (rr) return { ok: false, reason: rr };
    return { ok: true };
  };

  // ---------- mutations ----------
  function enroll(uniques) {
    const st = App.state;
    uniques.forEach(u => {
      if (st.registered.includes(u)) return;
      st.registered.push(u);
      st.seats[u].enrolled += 1;
      const w = st.waitlists.findIndex(x => x.unique === u);
      if (w >= 0) { st.waitlists.splice(w, 1); st.seats[u].waitlisted = Math.max(0, st.seats[u].waitlisted - 1); }
    });
  }
  function unenroll(u) {
    const st = App.state; const i = st.registered.indexOf(u);
    if (i >= 0) { st.registered.splice(i, 1); st.seats[u].enrolled = Math.max(0, st.seats[u].enrolled - 1); }
  }
  function record(attempt) {
    attempt.id = App.uid('att');
    attempt.at = App.state.clock.sim;
    App.state.attempts.unshift(attempt);
    App.state.attempts = App.state.attempts.slice(0, 25);
    return attempt;
  }

  function attemptCart(kind) {
    const cart = App.state.carts[kind].map(c => c.unique);
    const v = App.validate(cart);
    const step = { label: kind === 'primary' ? 'Primary cart' : 'Backup cart', ok: v.ok, results: v.results, cartErrors: v.cartErrors, sections: cart };
    if (v.ok) { enroll(cart); App.state.carts[kind] = []; }
    return step;
  }

  /** Register All: primary, then backup if enabled and primary failed. */
  App.registerAll = function (trigger) {
    const st = App.state;
    const steps = [attemptCart('primary')];
    if (steps[0].ok) {
      steps.push({ label: 'Backup cart', skipped: true, note: 'Not attempted — primary cart succeeded.' });
    } else if (st.backupEnabled && st.carts.backup.length) {
      steps.push(attemptCart('backup'));
    } else {
      steps.push({ label: 'Backup cart', skipped: true,
        note: !st.backupEnabled ? 'Not attempted — automatic backup is off.' : 'Not attempted — backup cart is empty.' });
    }
    const winner = steps.find(s => !s.skipped && s.ok);
    st.queue = { status: 'none', queuedAt: null };
    const att = record({
      kind: 'cart', trigger,
      ok: !!winner,
      summary: winner ? winner.label + ' registered successfully.' : 'No cart was registered. Your confirmed classes are unchanged.',
      steps
    });
    App.save();
    return att;
  };

  App.queueRegistration = function () {
    App.state.queue = { status: 'queued', queuedAt: App.state.clock.sim };
    App.save();
  };
  App.cancelQueue = function () { App.state.queue = { status: 'none', queuedAt: null }; App.save(); };

  function windowClosedResult(label) {
    return record({ kind: 'manual', trigger: label, ok: false, summary: 'Registration window is not open yet. Use the demo clock to open it.', steps: [] });
  }

  App.manualAdd = function (u) {
    if (!App.isWindowOpen()) return windowClosedResult('Manual add');
    const v = App.validate([u]);
    if (v.ok) enroll([u]);
    const r = v.results[0] || { unique: u, reasons: [] };
    const att = record({
      kind: 'manual', trigger: 'Manual add', ok: v.ok,
      summary: v.ok ? 'Registered for ' + App.label(u) + '.' : 'Could not add ' + App.label(u) + '. Nothing changed.',
      steps: [{ label: 'Add ' + App.label(u), ok: v.ok, results: v.results, cartErrors: v.cartErrors, sections: [u] }],
      waitlistOffer: !v.ok && r.full && App.waitlistEligibility(u).ok ? u : null
    });
    App.save();
    return att;
  };

  App.manualDrop = function (u) {
    if (!App.isWindowOpen()) return windowClosedResult('Drop');
    if (!App.state.registered.includes(u)) return record({ kind: 'manual', trigger: 'Drop', ok: false, summary: 'Not registered for ' + App.label(u) + '.', steps: [] });
    unenroll(u);
    const att = record({ kind: 'manual', trigger: 'Drop', ok: true, summary: 'Dropped ' + App.label(u) + '.', steps: [] });
    App.save();
    return att;
  };

  App.conditionalDrop = function (oldU, newU) {
    if (!App.isWindowOpen()) return windowClosedResult('Conditional drop');
    const st = App.state;
    let att;
    if (!st.registered.includes(oldU)) {
      att = record({ kind: 'manual', trigger: 'Conditional drop', ok: false, summary: 'You are not registered for ' + App.label(oldU) + '.', steps: [] });
    } else if (oldU === newU) {
      att = record({ kind: 'manual', trigger: 'Conditional drop', ok: false, summary: 'Replacement must be a different section.', steps: [] });
    } else {
      const base = st.registered.filter(x => x !== oldU);
      const v = App.validate([newU], base);
      if (v.ok) { unenroll(oldU); enroll([newU]); }
      att = record({
        kind: 'manual', trigger: 'Conditional drop', ok: v.ok,
        summary: v.ok ? 'Swapped ' + App.label(oldU) + ' → ' + App.label(newU) + '.'
          : 'Swap failed — you are still registered for ' + App.label(oldU) + '.',
        steps: [{ label: 'Replacement ' + App.label(newU), ok: v.ok, results: v.results, cartErrors: v.cartErrors, sections: [newU] }]
      });
    }
    App.save();
    return att;
  };

  // ---------- waitlist ----------
  App.joinWaitlist = function (u) {
    if (!App.isWindowOpen()) return { ok: false, msg: 'Waitlists open with the registration window. Use the demo clock to open it.' };
    const e = App.waitlistEligibility(u);
    if (!e.ok) return { ok: false, msg: e.reason };
    App.state.seats[u].waitlisted += 1;
    App.state.waitlists.push({ unique: u, position: App.state.seats[u].waitlisted, status: 'waiting', joinedAt: App.state.clock.sim });
    App.save();
    return { ok: true, msg: 'Joined waitlist for ' + App.label(u) + ' at position ' + App.state.seats[u].waitlisted + '.' };
  };
  App.leaveWaitlist = function (u) {
    const st = App.state; const i = st.waitlists.findIndex(w => w.unique === u);
    if (i < 0) return;
    const pos = st.waitlists[i].position;
    st.waitlists.splice(i, 1);
    st.seats[u].waitlisted = Math.max(0, st.seats[u].waitlisted - 1);
    void pos;
    App.save();
  };
  /** Simulate another student dropping: people ahead move up; at position 1 you get an offer. */
  App.simulateSeatOpening = function (u) {
    const w = App.state.waitlists.find(x => x.unique === u); if (!w) return '';
    if (w.position > 1) {
      w.position -= 1;
      App.save();
      return 'A seat opened and went to the student ahead of you. You moved up to position ' + w.position + '.';
    }
    if (w.status !== 'offered') {
      w.status = 'offered';
      App.state.seats[u].enrolled = Math.max(0, App.state.seats[u].enrolled - 1); // the seat that opened
      App.save();
      return 'A seat opened. You have an offer to attempt registration — it still must pass all checks.';
    }
    return 'You already have an open offer for this section.';
  };
  App.acceptOffer = function (u) {
    const att = App.manualAdd(u);
    att.trigger = 'Waitlist offer';
    App.save();
    return att;
  };
})();
