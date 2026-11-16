/*
 * Middle panel: Calendar — schedule management, weekly grid, conflicts, stats, cart actions.
 */
(function () {
  'use strict';
  const App = window.App; const esc = App.esc;

  App.PALETTE = ['#2563eb', '#0d9488', '#7c3aed', '#c2410c', '#0369a1', '#4d7c0f', '#be185d', '#a16207', '#4338ca', '#047857'];
  const HOUR_PX = 44;

  App.activeSchedule = () => App.state.schedules.find(s => s.id === App.state.activeScheduleId) || null;

  /** Lay out blocks for one day: overlapping blocks share width in lanes. */
  function layoutDay(blocks) {
    blocks.sort((a, b) => a.start - b.start || b.end - a.end);
    const clusters = []; let cur = null;
    blocks.forEach(b => {
      if (!cur || b.start >= cur.end) { cur = { end: b.end, items: [] }; clusters.push(cur); }
      cur.items.push(b); cur.end = Math.max(cur.end, b.end);
    });
    clusters.forEach(c => {
      const lanes = [];
      c.items.forEach(b => {
        let li = lanes.findIndex(end => end <= b.start);
        if (li < 0) { li = lanes.length; lanes.push(0); }
        lanes[li] = b.end; b.lane = li;
      });
      c.items.forEach(b => { b.lanes = lanes.length; });
    });
    return blocks;
  }

  /**
   * Weekly grid. uniques = class sections; opts.events = personal time blocks to draw alongside.
   * Red outline = class↔class overlap or class↔personal-event overlap.
   */
  App.renderWeekGrid = function (uniques, opts) {
    opts = opts || {};
    const events = opts.events || [];
    let startMin = 8 * 60, endMin = 18 * 60;
    const widen = (a, z) => { startMin = Math.min(startMin, Math.floor(a / 60) * 60); endMin = Math.max(endMin, Math.ceil(z / 60) * 60); };
    uniques.forEach(u => App.sec(u).parsed.forEach(p => widen(p.start, p.end)));
    events.forEach(ev => widen(ev.start, ev.end));
    const height = (endMin - startMin) / 60 * HOUR_PX;
    const conflictSlots = {}; // key (unique or 'ev:'+id)|day → overlapping ranges
    const mark = (key, o) => { (conflictSlots[key + '|' + o.day] = conflictSlots[key + '|' + o.day] || []).push(o); };
    App.conflictPairs(uniques).forEach(p => p.overlaps.forEach(o => { mark(p.a, o); mark(p.b, o); }));
    App.eventConflicts(uniques, events).forEach(c => c.overlaps.forEach(o => { mark(c.u, o); mark('ev:' + c.ev.id, o); }));

    let hours = '';
    for (let m = startMin; m < endMin; m += 60) hours += '<div class="hour" style="height:' + HOUR_PX + 'px">' + App.fmtTime(m).replace(':00', '') + '</div>';

    const cols = App.DAYS.map(d => {
      const blocks = [];
      uniques.forEach((u, i) => App.sec(u).parsed.forEach(p => {
        if (p.days.includes(d)) blocks.push({ key: u, u, start: p.start, end: p.end, room: p.room, color: App.PALETTE[i % App.PALETTE.length] });
      }));
      events.forEach(ev => { if (ev.days.includes(d)) blocks.push({ key: 'ev:' + ev.id, ev, start: ev.start, end: ev.end }); });
      layoutDay(blocks);
      const html = blocks.map(b => {
        const slots = (conflictSlots[b.key + '|' + d] || []).filter(o => o.start < b.end && o.end > b.start);
        const isConf = slots.length > 0;
        const top = (b.start - startMin) / 60 * HOUR_PX; const h = (b.end - b.start) / 60 * HOUR_PX;
        const w = 100 / b.lanes;
        const pos = 'top:' + top + 'px;height:' + (h - 2) + 'px;left:calc(' + (b.lane * w) + '% + 2px);width:calc(' + w + '% - 4px);';
        const time = App.fmtRange(b.start, b.end).replace(/ (AM|PM)/g, '');
        if (b.ev) {
          const label = 'Personal event: ' + b.ev.title + ', ' + App.DAY_NAME[d] + ' ' + App.fmtRange(b.start, b.end) +
            (b.ev.scope === 'all' ? ', applies to all schedules' : ', this schedule only') + (isConf ? ', OVERLAPS A CLASS' : '');
          return '<div class="blk evt' + (isConf ? ' conflict' : '') + '" role="listitem" aria-label="' + esc(label) + '" title="' + esc(label) + '" style="' + pos + '">' +
            (b.lanes > 1 ? '<strong>' + esc(b.ev.title) + '</strong><span class="conf-flag">⚠</span>'
              : '<strong>' + esc(b.ev.title) + '</strong><span>' + time + '</span>' + (isConf ? '<span class="conf-flag">⚠ overlap</span>' : '')) + '</div>';
        }
        const s = App.sec(b.u);
        const label = s.course + ', ' + s.title + ', unique ' + b.u + ', ' + App.DAY_NAME[d] + ' ' + App.fmtRange(b.start, b.end) + ', ' + b.room + (isConf ? ', TIME CONFLICT' : '');
        return '<div class="blk' + (isConf ? ' conflict' : '') + (App.statusOf(b.u) !== 'open' && !opts.confirmed ? ' not-open' : '') + '" role="listitem" aria-label="' + esc(label) + '" title="' + esc(label) + '" style="' + pos + '--c:' + b.color + '">' +
          (b.lanes > 1
            ? '<strong>' + esc(s.num) + '</strong><span class="conf-flag">⚠</span>'
            : '<strong>' + esc(s.course) + '</strong><span>' + time + '</span><span class="room">' + esc(b.room) + '</span>' +
              (isConf ? '<span class="conf-flag">⚠ conflict</span>' : '')) + '</div>';
      }).join('');
      return '<div class="day-col" role="list" aria-label="' + App.DAY_NAME[d] + '" style="height:' + height + 'px;background-size:100% ' + HOUR_PX + 'px">' + html + '</div>';
    }).join('');

    return '<div class="week" aria-label="' + esc(opts.label || 'Weekly calendar') + '">' +
      '<div class="week-head"><div></div>' + App.DAYS.map(d => '<div>' + App.DAY_SHORT[d] + '</div>').join('') + '</div>' +
      '<div class="week-body"><div class="hours">' + hours + '</div>' + cols + '</div></div>';
  };

  function eventsSection(sch) {
    const st = App.state;
    const mine = App.eventsFor(sch.id);
    const elsewhere = st.events.filter(e => e.scope !== 'all' && e.scope !== sch.id).length;
    let h = '<h3 class="sub">Personal events</h3>' +
      '<div class="evt-bar"><label class="check"><input type="checkbox" id="evt-show" data-fk="evt-show"' + (st.showEvents ? ' checked' : '') + '> Show personal events in the calendar</label>' +
      '<button type="button" class="btn small" data-act="evt-add" data-fk="evt-add">＋ Add personal event</button></div>';
    if (!mine.length) h += '<p class="muted small">No personal events for this schedule. Add work, practice, commuting or other time blocks to see how classes collide with them.</p>';
    else h += '<ul class="legend evt-list">' + mine.map(ev =>
      '<li><span class="swatch evt-swatch" aria-hidden="true"></span><span class="lg-main"><strong>' + esc(ev.title) + '</strong> · ' + esc(App.eventDaysText(ev)) +
      ' <span class="badge neutral">' + (ev.scope === 'all' ? 'All schedules' : 'This schedule only') + '</span></span>' +
      '<button type="button" class="btn small ghost" data-act="evt-edit" data-id="' + ev.id + '" data-fk="evted-' + ev.id + '">Edit</button>' +
      '<button type="button" class="icon-btn" data-act="evt-del" data-id="' + ev.id + '" data-fk="evtdel-' + ev.id + '" aria-label="Delete personal event ' + esc(ev.title) + '">×</button></li>').join('') + '</ul>';
    if (elsewhere) h += '<p class="muted tiny">' + elsewhere + ' other event' + (elsewhere > 1 ? 's belong' : ' belongs') + ' to other schedules only.</p>';
    h += '<p class="muted tiny">Personal events are planning aids: overlaps are flagged and excluded by “Fits saved schedule”, but they never block registration and aren’t counted in the summary.</p>';
    return h;
  }

  App.renderCalendar = function () {
    const st = App.state; const sch = App.activeSchedule();
    const root = document.getElementById('calendar-body');
    const opts = st.schedules.map(s => '<option value="' + s.id + '"' + (sch && s.id === sch.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    let html = '<div class="toolbar">' +
      '<label class="grow">Saved schedule<select id="sch-select" data-fk="sch-select"' + (st.schedules.length ? '' : ' disabled') + '>' + (opts || '<option>No schedules yet</option>') + '</select></label>' +
      '<div class="btn-row"><button type="button" class="btn small" data-act="sch-new" data-fk="sch-new">New</button>' +
      '<button type="button" class="btn small" data-act="sch-rename" data-fk="sch-rename"' + (sch ? '' : ' disabled') + '>Rename</button>' +
      '<button type="button" class="btn small danger" data-act="sch-delete" data-fk="sch-delete"' + (sch ? '' : ' disabled') + '>Delete</button></div></div>';

    if (!sch) {
      root.innerHTML = html + '<div class="empty"><p><strong>No saved schedules.</strong></p><p>Create one with <em>New</em>, or use <em>Add ▾</em> on any section in the Course Schedule.</p></div>';
      return;
    }
    const secs = sch.sections.filter(u => App.sec(u));
    const pairs = App.conflictPairs(secs);
    const dups = App.duplicateCourses(secs);
    const stats = App.scheduleStats(secs);
    const evts = App.eventsFor(sch.id);
    const shownEvts = st.showEvents ? evts : [];
    const evConf = App.eventConflicts(secs, evts);

    if (secs.length || shownEvts.length) {
      html += App.renderWeekGrid(secs, { label: 'Weekly calendar for ' + sch.name, events: shownEvts }) +
        '<p class="tiny muted">Red outline = overlapping meetings · striped = section currently closed · grey = personal event. Hover a block for full details.</p>';
    }
    if (!secs.length) html += '<div class="empty"><p><strong>“' + esc(sch.name) + '” has no sections yet.</strong></p><p>Add sections from the Course Schedule on the left.</p></div>';

    // Legend / section list
    if (secs.length) {
      html += '<h3 class="sub">Sections in this schedule</h3><ul class="legend">' + secs.map((u, i) => {
        const s = App.sec(u); const stt = App.statusOf(u);
        return '<li><span class="swatch" style="--c:' + App.PALETTE[i % App.PALETTE.length] + '"></span>' +
          '<span class="lg-main"><strong>' + esc(s.course) + '</strong> #' + u + ' · ' + esc(s.title) + ' · ' + s.credits + ' hrs' +
          (stt !== 'open' ? ' <span class="badge ' + stt + '">' + stt + '</span>' : '') + '</span>' +
          '<button type="button" class="icon-btn" data-act="sch-remove" data-u="' + u + '" data-fk="schrm-' + u + '" aria-label="Remove ' + esc(App.label(u)) + ' from schedule">×</button></li>';
      }).join('') + '</ul>';
    }

    // Conflicts
    html += '<h3 class="sub">Conflicts</h3>';
    if (!pairs.length && !dups.length) html += '<p class="ok-line">✓ No time conflicts or duplicate courses.</p>';
    else {
      html += '<ul class="conflicts">' + pairs.map(p =>
        '<li><strong>' + esc(App.label(p.a)) + '</strong> overlaps <strong>' + esc(App.label(p.b)) + '</strong>: ' +
        p.overlaps.map(o => App.DAY_NAME[o.day] + ' ' + App.fmtRange(o.start, o.end)).join('; ') + '</li>').join('') +
        dups.map(d => '<li>Duplicate course <strong>' + esc(d.course) + '</strong>: ' + d.uniques.map(u => '#' + u).join(', ') + ' (only one section can be registered)</li>').join('') +
        '</ul><p class="muted small">Conflicts are allowed while planning but will block registration.</p>';
    }
    if (evConf.length) {
      html += '<p class="small"><strong>Personal-event overlaps</strong> <span class="muted">(warnings only — registration is not blocked)</span></p>' +
        '<ul class="conflicts evt-conflicts">' + evConf.map(c =>
          '<li><strong>' + esc(App.label(c.u)) + '</strong> overlaps your <strong>' + esc(c.ev.title) + '</strong>: ' +
          c.overlaps.map(o => App.DAY_NAME[o.day] + ' ' + App.fmtRange(o.start, o.end)).join('; ') + '</li>').join('') + '</ul>' +
        (st.showEvents ? '' : '<p class="muted tiny">Personal events are hidden in the calendar but still checked.</p>');
    } else if (evts.length) html += '<p class="ok-line small">✓ No overlaps with your personal events.</p>';

    html += eventsSection(sch);

    // Stats
    html += '<h3 class="sub">Summary</h3><dl class="stats">' +
      '<div><dt>Days on campus</dt><dd>' + stats.days.length + (stats.days.length ? ' <small>(' + stats.days.map(d => App.DAY_SHORT[d]).join(', ') + ')</small>' : '') + '</dd></div>' +
      '<div><dt>Earliest start</dt><dd>' + (stats.earliest ? App.fmtTime(stats.earliest.start) : '—') + '</dd></div>' +
      '<div><dt>Longest day</dt><dd>' + (stats.longest ? App.fmtDuration(stats.longest.len) + ' <small>(' + App.DAY_SHORT[stats.longest.day] + ' ' + App.fmtRange(stats.longest.start, stats.longest.end) + ')</small>' : '—') + '</dd></div>' +
      '<div><dt>Total credit hours</dt><dd>' + stats.credits + '</dd></div></dl>' +
      '<p class="muted tiny">Longest day = first class start to last class end on a single day.</p>';

    html += '<div class="btn-row cart-actions">' +
      '<button type="button" class="btn primary" data-act="to-cart" data-kind="primary" data-fk="to-primary"' + (secs.length ? '' : ' disabled') + '>Add schedule to primary cart</button>' +
      '<button type="button" class="btn" data-act="to-cart" data-kind="backup" data-fk="to-backup"' + (secs.length ? '' : ' disabled') + '>Add schedule to backup cart</button></div>' +
      '<p class="muted tiny">Copies the current sections into the cart. Later edits to this schedule won’t change the cart.</p>';

    root.innerHTML = html;
  };

  function copyToCart(kind) {
    const sch = App.activeSchedule(); if (!sch) return;
    const cart = App.state.carts[kind];
    const added = [], skipped = [], cancelled = [];
    sch.sections.forEach(u => {
      if (App.sec(u).cancelled) { cancelled.push(u); return; }
      if (cart.some(c => c.unique === u)) skipped.push(u);
      else { cart.push({ unique: u, from: sch.name, fromId: sch.id }); added.push(u); }
    });
    App.save(); App.render();
    const name = kind === 'primary' ? 'primary cart' : 'backup cart';
    let msg = added.length ? 'Copied ' + added.length + ' section' + (added.length > 1 ? 's' : '') + ' from “' + sch.name + '” to the ' + name + '.' : 'Nothing new added to the ' + name + '.';
    if (skipped.length) msg += ' Skipped ' + skipped.length + ' already in the cart (' + skipped.map(u => '#' + u).join(', ') + ').';
    if (cancelled.length) msg += ' Skipped cancelled ' + cancelled.map(u => '#' + u).join(', ') + '.';
    const pairs = App.conflictPairs(App.state.carts[kind].map(c => c.unique));
    if (pairs.length) msg += ' ⚠ The cart has time conflicts — registration will be blocked until resolved.';
    App.toast(msg, skipped.length || pairs.length ? 'warn' : 'success');
  }

  const pad = n => String(n).padStart(2, '0');
  const toHM = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const fromHM = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };

  /** Add/edit form for a personal time block. Resolves to {title, days, start, end, scope} or null. */
  function eventDialog(ev, sch) {
    const st = App.state;
    const v = ev || { title: '', days: [], start: 12 * 60, end: 13 * 60, scope: 'all' };
    const scopeOpts = '<option value="all"' + (v.scope === 'all' ? ' selected' : '') + '>All saved schedules</option>' +
      st.schedules.map(x => '<option value="' + x.id + '"' + (v.scope === x.id ? ' selected' : '') + '>Only “' + esc(x.name) + '”</option>').join('');
    const html = '<form class="dlg-form evt-form" novalidate><h2>' + (ev ? 'Edit personal event' : 'Add personal event') + '</h2>' +
      '<label>Name<input type="text" id="ev-title" maxlength="40" required placeholder="e.g. Part-time job, practice, commute" value="' + esc(v.title) + '"></label>' +
      '<fieldset class="picker"><legend>Days</legend><div class="radio-row">' + App.DAYS.map(d =>
        '<label><input type="checkbox" name="ev-day" value="' + d + '"' + (v.days.includes(d) ? ' checked' : '') + '> ' + App.DAY_SHORT[d] + '</label>').join('') + '</div></fieldset>' +
      '<div class="two"><label>Start<input type="time" id="ev-start" step="900" min="06:00" max="23:00" value="' + toHM(v.start) + '"></label>' +
      '<label>End<input type="time" id="ev-end" step="900" min="06:00" max="23:30" value="' + toHM(v.end) + '"></label></div>' +
      '<label>Show in<select id="ev-scope">' + scopeOpts + '</select></label>' +
      '<p class="err small" id="ev-err" role="alert" hidden></p>' +
      '<div class="btn-row end"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="submit" class="btn primary">' + (ev ? 'Save changes' : 'Add event') + '</button></div></form>';
    return App.openDialog(html, (dlg, done) => {
      const q = sel => dlg.querySelector(sel);
      if (!ev) q('#ev-scope').value = 'all';
      dlg.querySelector('[data-x="cancel"]').onclick = () => done(null);
      q('form').onsubmit = e => {
        e.preventDefault();
        const title = q('#ev-title').value.trim();
        const days = [...dlg.querySelectorAll('input[name="ev-day"]:checked')].map(i => i.value);
        const start = fromHM(q('#ev-start').value), end = fromHM(q('#ev-end').value);
        let err = '';
        if (!title) err = 'Please enter a name.';
        else if (!days.length) err = 'Choose at least one day.';
        else if (isNaN(start) || isNaN(end)) err = 'Enter a start and end time.';
        else if (end <= start) err = 'End time must be after the start time.';
        else if (start < 6 * 60 || end > 23 * 60 + 30) err = 'Keep events between 6:00 AM and 11:30 PM.';
        if (err) { const p = q('#ev-err'); p.textContent = err; p.hidden = false; return; }
        done({ title, days: App.DAYS.filter(d => days.includes(d)), start, end, scope: q('#ev-scope').value });
      };
      setTimeout(() => q('#ev-title').focus(), 0);
    });
  }

  App.initCalendar = function () {
    const col = document.getElementById('col-calendar');
    col.addEventListener('change', e => {
      if (e.target.id === 'sch-select') { App.state.activeScheduleId = e.target.value; App.save(); App.render(); }
      if (e.target.id === 'evt-show') { App.state.showEvents = e.target.checked; App.save(); App.render(); }
    });
    col.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const st = App.state; const sch = App.activeSchedule();
      switch (b.dataset.act) {
        case 'sch-new': {
          const name = await App.promptDialog({ title: 'New schedule', label: 'Schedule name', value: 'Plan ' + String.fromCharCode(65 + st.schedules.length) });
          if (!name) return;
          const n = { id: App.uid('sch'), name, sections: [] };
          st.schedules.push(n); st.activeScheduleId = n.id; App.save(); App.render();
          App.toast('Created empty schedule “' + name + '”.', 'success'); break;
        }
        case 'sch-rename': {
          if (!sch) return;
          const name = await App.promptDialog({ title: 'Rename schedule', label: 'New name', value: sch.name });
          if (!name) return;
          sch.name = name; App.save(); App.render(); App.toast('Renamed to “' + name + '”.', 'success'); break;
        }
        case 'sch-delete': {
          if (!sch) return;
          const own = st.events.filter(ev => ev.scope === sch.id).length;
          const ok = await App.confirmDialog({ title: 'Delete schedule?', body: 'Delete “' + esc(sch.name) + '” (' + sch.sections.length + ' sections' + (own ? ', ' + own + ' schedule-only personal event' + (own > 1 ? 's' : '') : '') + ')? Carts that already copied it are not affected.', confirmText: 'Delete schedule', danger: true });
          if (!ok) return;
          st.schedules = st.schedules.filter(s => s.id !== sch.id);
          st.events = st.events.filter(ev => ev.scope !== sch.id);
          st.filters = st.filters.filter(f => !(f.type === 'compat' && f.value === sch.id));
          st.activeScheduleId = st.schedules[0] ? st.schedules[0].id : null;
          App.save(); App.render(); App.toast('Deleted “' + sch.name + '”.', 'info'); break;
        }
        case 'sch-remove': {
          if (!sch) return;
          sch.sections = sch.sections.filter(u => u !== b.dataset.u); App.save(); App.render();
          App.toast('Removed ' + App.label(b.dataset.u) + ' from “' + sch.name + '”.', 'info');
          const next = col.querySelector('[data-act="sch-remove"]') || col.querySelector('#sch-select'); if (next) next.focus();
          break;
        }
        case 'to-cart': copyToCart(b.dataset.kind); break;
        case 'evt-add': case 'evt-edit': {
          if (!sch) return;
          const existing = b.dataset.id ? st.events.find(ev => ev.id === b.dataset.id) : null;
          const res = await eventDialog(existing, sch);
          if (!res) return;
          if (existing) Object.assign(existing, res);
          else st.events.push(Object.assign({ id: App.uid('ev') }, res));
          App.save(); App.render();
          const target = existing || st.events[st.events.length - 1];
          const hits = st.schedules.filter(x => target.scope === 'all' || target.scope === x.id)
            .reduce((n, x) => n + App.eventConflicts(x.sections, [target]).length, 0);
          App.toast((existing ? 'Updated' : 'Added') + ' “' + target.title + '” (' + App.eventDaysText(target) + ', ' +
            (target.scope === 'all' ? 'all schedules' : 'only “' + sch.name + '”') + ').' +
            (hits ? ' ⚠ Overlaps ' + hits + ' class section' + (hits > 1 ? 's' : '') + ' — see the calendar.' : ''), hits ? 'warn' : 'success');
          break;
        }
        case 'evt-del': {
          const ev = st.events.find(x => x.id === b.dataset.id); if (!ev) return;
          const ok = await App.confirmDialog({ title: 'Delete personal event?', body: 'Delete “' + esc(ev.title) + '” (' + esc(App.eventDaysText(ev)) + ')' + (ev.scope === 'all' ? ' from <strong>all</strong> schedules' : '') + '?', confirmText: 'Delete event', danger: true });
          if (!ok) return;
          st.events = st.events.filter(x => x.id !== ev.id); App.save(); App.render();
          App.toast('Deleted “' + ev.title + '”.', 'info'); break;
        }
      }
    });
  };
})();
