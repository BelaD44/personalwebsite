/*
 * Middle panel: Calendar — schedule management, weekly grid, conflicts, stats, cart actions.
 */
(function () {
  'use strict';
  const App = window.App; const esc = App.esc;

  // Class colors: hex values are used by the image/PDF export; the on-screen calendar uses
  // theme-aware CSS variables (--cls-0 … --cls-9) defined in styles.css for light and dark mode.
  // Red is deliberately excluded — it is reserved for the conflict state.
  App.PALETTE = ['#2f5f8f', '#2c7a72', '#6a4c93', '#5f7a2e', '#4a5d78', '#8a6a1f', '#8a3f74', '#3f4e9a', '#2f6b4a', '#2a6f8a'];
  App.clsColor = i => 'var(--cls-' + (i % 10) + ')';
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

  App.renderWeekGrid = function (uniques, opts) {
    opts = opts || {};
    let startMin = 8 * 60, endMin = 18 * 60;
    uniques.forEach(u => App.sec(u).parsed.forEach(p => { startMin = Math.min(startMin, Math.floor(p.start / 60) * 60); endMin = Math.max(endMin, Math.ceil(p.end / 60) * 60); }));
    const height = (endMin - startMin) / 60 * HOUR_PX;
    const conflictSet = new Set();
    const pairs = App.conflictPairs(uniques);
    const conflictSlots = {}; // key unique|day → overlapping ranges
    pairs.forEach(p => p.overlaps.forEach(o => {
      [p.a, p.b].forEach(u => { conflictSet.add(u + '|' + o.day); (conflictSlots[u + '|' + o.day] = conflictSlots[u + '|' + o.day] || []).push(o); });
    }));

    let hours = '';
    for (let m = startMin; m < endMin; m += 60) hours += '<div class="hour" style="height:' + HOUR_PX + 'px">' + App.fmtTime(m).replace(':00', '') + '</div>';

    const cols = App.DAYS.map(d => {
      const blocks = [];
      uniques.forEach((u, i) => App.sec(u).parsed.forEach(p => {
        if (p.days.includes(d)) blocks.push({ u, start: p.start, end: p.end, room: p.room, color: App.clsColor(i) });
      }));
      layoutDay(blocks);
      const html = blocks.map(b => {
        const s = App.sec(b.u);
        const slots = (conflictSlots[b.u + '|' + d] || []).filter(o => o.start < b.end && o.end > b.start);
        const isConf = slots.length > 0;
        const top = (b.start - startMin) / 60 * HOUR_PX; const h = (b.end - b.start) / 60 * HOUR_PX;
        const w = 100 / b.lanes;
        const label = s.course + ', ' + s.title + ', unique ' + b.u + ', ' + App.DAY_NAME[d] + ' ' + App.fmtRange(b.start, b.end) + ', ' + b.room + (isConf ? ', TIME CONFLICT' : '');
        return '<div class="blk' + (isConf ? ' conflict' : '') + (App.statusOf(b.u) !== 'open' && !opts.confirmed ? ' not-open' : '') + '" role="listitem" aria-label="' + esc(label) + '" title="' + esc(label) + '" style="top:' + top + 'px;height:' + (h - 2) +
          'px;left:calc(' + (b.lane * w) + '% + 2px);width:calc(' + w + '% - 4px);--c:' + b.color + '">' +
          (b.lanes > 1
            ? '<strong>' + esc(s.num) + '</strong><span class="conf-flag">⚠</span>'
            : '<strong>' + esc(s.course) + '</strong><span>' + App.fmtRange(b.start, b.end).replace(/ (AM|PM)/g, '') + '</span><span class="room">' + esc(b.room) + '</span>' +
              (isConf ? '<span class="conf-flag">⚠ conflict</span>' : '')) + '</div>';
      }).join('');
      return '<div class="day-col" role="list" aria-label="' + App.DAY_NAME[d] + '" style="height:' + height + 'px;background-size:100% ' + HOUR_PX + 'px">' + html + '</div>';
    }).join('');

    return '<div class="week" aria-label="' + esc(opts.label || 'Weekly calendar') + '">' +
      '<div class="week-head"><div></div>' + App.DAYS.map(d => '<div>' + App.DAY_SHORT[d] + '</div>').join('') + '</div>' +
      '<div class="week-body"><div class="hours">' + hours + '</div>' + cols + '</div></div>';
  };

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

    html += secs.length ? App.renderWeekGrid(secs, { label: 'Weekly calendar for ' + sch.name }) +
      '<p class="tiny muted">Red outline = overlapping meetings · striped = section currently closed. Hover a block for full details.</p>'
      : '<div class="empty"><p><strong>“' + esc(sch.name) + '” is empty.</strong></p><p>Add sections from the Course Schedule on the left.</p></div>';

    // Legend / section list
    if (secs.length) {
      html += '<h3 class="sub">Sections in this schedule</h3><ul class="legend">' + secs.map((u, i) => {
        const s = App.sec(u); const stt = App.statusOf(u);
        return '<li><span class="swatch" style="--c:' + App.clsColor(i) + '"></span>' +
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
      else { cart.push({ unique: u, from: sch.name }); added.push(u); }
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

  App.initCalendar = function () {
    const col = document.getElementById('col-calendar');
    col.addEventListener('change', e => {
      if (e.target.id === 'sch-select') { App.state.activeScheduleId = e.target.value; App.save(); App.render(); }
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
          const ok = await App.confirmDialog({ title: 'Delete schedule?', body: 'Delete “' + esc(sch.name) + '” (' + sch.sections.length + ' sections)? Carts that already copied it are not affected.', confirmText: 'Delete schedule', danger: true });
          if (!ok) return;
          st.schedules = st.schedules.filter(s => s.id !== sch.id);
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
      }
    });
  };
})();
