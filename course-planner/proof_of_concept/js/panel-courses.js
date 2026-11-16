/*
 * Left panel: Course Schedule — filters, section list, add menu, detail popover.
 */
(function () {
  'use strict';
  const App = window.App; const esc = App.esc;

  const FILTER_TYPES = {
    dept: 'Department', level: 'Level', num: 'Course #', instructor: 'Instructor',
    status: 'Status', day: 'Meets on', compat: 'Fits schedule'
  };

  function allSections() { return Object.values(App.catalog); }

  function filterLabel(f) {
    if (f.type === 'compat') {
      const s = App.state.schedules.find(x => x.id === f.value);
      return FILTER_TYPES.compat + ': ' + (s ? s.name : '(deleted)');
    }
    if (f.type === 'day') return FILTER_TYPES.day + ': ' + App.DAY_NAME[f.value];
    if (f.type === 'status') return FILTER_TYPES.status + ': ' + f.value[0].toUpperCase() + f.value.slice(1);
    if (f.type === 'num') return FILTER_TYPES.num + ' contains "' + f.value + '"';
    return FILTER_TYPES[f.type] + ': ' + f.value;
  }

  /** Same-type filters are OR'ed; different types are AND'ed. */
  function applyFilters(list) {
    const groups = {};
    App.state.filters.forEach(f => { (groups[f.type] = groups[f.type] || []).push(f.value); });
    return list.filter(s => Object.keys(groups).every(type => groups[type].some(v => {
      switch (type) {
        case 'dept': return s.dept === v;
        case 'level': return s.level === v;
        case 'num': return s.num.toUpperCase().includes(v.toUpperCase());
        case 'instructor': return s.instructor === v;
        case 'status': return App.statusOf(s.unique) === v;
        case 'day': return s.parsed.some(p => p.days.includes(v));
        case 'compat': {
          const sch = App.state.schedules.find(x => x.id === v);
          return !sch || App.compatibility(s.unique, sch).ok;
        }
      }
      return true;
    })));
  }

  function addFilter(type, value) {
    if (!value) return;
    const st = App.state;
    if (type === 'compat') st.filters = st.filters.filter(f => f.type !== 'compat');
    if (st.filters.some(f => f.type === type && f.value === value)) { App.toast('That filter is already applied.', 'info'); return; }
    st.filters.push({ type, value });
    App.save(); App.render();
  }

  function uniqueVals(fn) { return [...new Set(allSections().map(fn))].sort(); }

  function opt(v, l, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(l) + '</option>'; }

  function renderFilters() {
    const st = App.state;
    const deptOpts = uniqueVals(s => s.dept).map(d => opt(d, d)).join('');
    const instOpts = uniqueVals(s => s.instructor).map(d => opt(d, d)).join('');
    const compat = st.filters.find(f => f.type === 'compat');
    const schOpts = st.schedules.map(s => opt(s.id, s.name, compat && compat.value === s.id)).join('');
    const tags = st.filters.map((f, i) =>
      '<li class="tag"><span>' + esc(filterLabel(f)) + '</span><button type="button" class="tag-x" data-act="rm-filter" data-i="' + i +
      '" data-fk="rmf-' + i + '" aria-label="Remove filter ' + esc(filterLabel(f)) + '">×</button></li>').join('');
    return '' +
      '<form class="filters" id="filter-form" aria-label="Course filters">' +
      '<div class="filter-grid">' +
      '<label>Department<select data-filter="dept" data-fk="f-dept"><option value="">Add…</option>' + deptOpts + '</select></label>' +
      '<label>Level / standing<select data-filter="level" data-fk="f-level"><option value="">Add…</option>' +
      opt('Lower division', 'Lower division') + opt('Upper division', 'Upper division') + opt('Graduate', 'Graduate') + '</select></label>' +
      '<label>Instructor<select data-filter="instructor" data-fk="f-inst"><option value="">Add…</option>' + instOpts + '</select></label>' +
      '<label>Status<select data-filter="status" data-fk="f-status"><option value="">Add…</option>' +
      opt('open', 'Open') + opt('closed', 'Closed (full)') + opt('cancelled', 'Cancelled') + '</select></label>' +
      '<label>Weekday<select data-filter="day" data-fk="f-day"><option value="">Add…</option>' +
      App.DAYS.map(d => opt(d, App.DAY_NAME[d])).join('') + '</select></label>' +
      '<label>Fits saved schedule<select data-filter="compat" data-fk="f-compat"><option value="">Off</option>' + schOpts + '</select></label>' +
      '<label class="span2">Course number<span class="inline-input"><input type="text" id="f-num" data-fk="f-num" placeholder="e.g. 3 or 314" inputmode="text" autocomplete="off">' +
      '<button type="submit" class="btn small" data-fk="f-num-btn">Add</button></span></label>' +
      '</div>' +
      '<div class="tags-row">' +
      (tags ? '<ul class="tags" aria-label="Active filters">' + tags + '</ul><button type="button" class="link-btn" data-act="clear-filters" data-fk="clear-filters">Clear all</button>'
        : '<p class="muted small">No filters applied. Same-type filters match <em>any</em>; different types must <em>all</em> match.</p>') +
      '</div></form>';
  }

  function statusBadge(u) {
    const s = App.sec(u); const se = App.seats(u); const stt = App.statusOf(u);
    if (stt === 'cancelled') return '<span class="badge cancelled">Cancelled</span>';
    if (stt === 'closed') return '<span class="badge closed">Closed · ' + se.enrolled + '/' + s.capacity + ' · WL ' + se.waitlisted + '/' + s.waitlistCap + '</span>';
    return '<span class="badge open">Open · ' + se.enrolled + '/' + s.capacity + '</span>';
  }

  function sectionCard(s) {
    const st = App.state; const u = s.unique;
    const active = st.schedules.find(x => x.id === st.activeScheduleId);
    const stt = App.statusOf(u);
    let fit = '';
    if (active && stt !== 'cancelled') {
      const c = App.compatibility(u, active);
      fit = c.ok ? '<span class="fit ok">Fits “' + esc(active.name) + '”</span>' : '<span class="fit bad">' + esc(c.reason) + '</span>';
    }
    const reg = st.registered.includes(u) ? '<span class="chip reg">Registered</span>' : '';
    const wl = st.waitlists.some(w => w.unique === u) ? '<span class="chip wl">On waitlist</span>' : '';
    const menu = App.ui.addMenuFor === u ? addMenu(u) : '';
    const expanded = App.ui.popoverFor === u;
    return '' +
      '<li class="sec-card status-' + stt + '" data-u="' + u + '">' +
      '<div class="sec-top"><span class="course">' + esc(s.course) + '</span><span class="uniq">#' + u + '</span>' + statusBadge(u) + '</div>' +
      '<div class="sec-title">' + esc(s.title) + '</div>' +
      '<div class="sec-meta">' + s.credits + ' hr' + (s.credits === 1 ? '' : 's') + ' · ' + esc(s.level) + ' · ' + esc(s.instructor) + '</div>' +
      '<ul class="sec-meet">' + App.meetingText(s).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
      (s.restriction ? '<div class="sec-restr">⚑ ' + esc(s.restriction.text) + '</div>' : '') +
      '<div class="sec-flags">' + reg + wl + fit + '</div>' +
      '<div class="sec-actions">' +
      '<button type="button" class="btn small ghost" data-act="details" data-u="' + u + '" data-fk="det-' + u + '" aria-expanded="' + expanded + '" aria-controls="popover">Details</button>' +
      '<div class="menu-wrap"><button type="button" class="btn small primary" data-act="add-menu" data-u="' + u + '" data-fk="add-' + u + '" aria-haspopup="true" aria-expanded="' + (App.ui.addMenuFor === u) + '">Add ▾</button>' + menu + '</div>' +
      (stt === 'closed' ? '<button type="button" class="btn small" data-act="join-wl" data-u="' + u + '" data-fk="jwl-' + u + '">Join waitlist</button>' : '') +
      '</div></li>';
  }

  function addMenu(u) {
    const items = App.state.schedules.map(s =>
      '<li><button type="button" role="menuitem" data-act="add-to" data-u="' + u + '" data-sid="' + s.id + '" data-fk="addto-' + u + '-' + s.id + '">Add to “' + esc(s.name) + '”</button></li>').join('');
    return '<ul class="menu" role="menu" aria-label="Add ' + esc(App.label(u)) + ' to">' + items +
      '<li><button type="button" role="menuitem" data-act="add-new" data-u="' + u + '" data-fk="addnew-' + u + '">＋ New schedule with this section…</button></li></ul>';
  }

  App.renderCourses = function () {
    const root = document.getElementById('courses-body');
    const all = allSections().slice().sort((a, b) => (a.dept + a.num.padStart(5)).localeCompare(b.dept + b.num.padStart(5)) || a.unique.localeCompare(b.unique));
    const list = applyFilters(all);
    document.getElementById('courses-count').textContent = 'Showing ' + list.length + ' of ' + all.length + ' sections';
    document.getElementById('courses-filters').innerHTML = renderFilters();
    root.innerHTML = list.length
      ? '<ul class="sec-list">' + list.map(sectionCard).join('') + '</ul>'
      : '<div class="empty"><p><strong>No sections match these filters.</strong></p><p>Remove a filter tag or <button type="button" class="link-btn" data-act="clear-filters">clear all filters</button>.</p></div>';
  };

  // ---------- add-to-schedule ----------
  function addToSchedule(u, sid) {
    const s = App.sec(u); const sch = App.state.schedules.find(x => x.id === sid);
    if (!sch) return;
    if (s.cancelled) { App.toast(App.label(u) + ' is cancelled and can’t be added to a schedule.', 'error'); return; }
    if (sch.sections.includes(u)) { App.toast(App.label(u) + ' is already in “' + sch.name + '”.', 'warn'); return; }
    const dup = sch.sections.find(x => App.sec(x).course === s.course);
    sch.sections.push(u);
    App.state.activeScheduleId = sid;
    App.ui.addMenuFor = null;
    App.save(); App.render();
    const conflicts = sch.sections.filter(x => x !== u && App.overlaps(u, x).length);
    let msg = 'Added ' + App.label(u) + ' to “' + sch.name + '”.';
    let type = 'success';
    if (dup) { msg += ' Note: it duplicates ' + App.label(dup) + ' (same course) — flagged in the calendar.'; type = 'warn'; }
    if (conflicts.length) { msg += ' Time conflict with ' + conflicts.map(App.label).join(', ') + ' — shown in red.'; type = 'warn'; }
    if (App.statusOf(u) === 'closed') { msg += ' This section is currently full.'; type = 'warn'; }
    App.toast(msg, type);
  }

  async function addToNew(u) {
    const s = App.sec(u);
    if (s.cancelled) { App.toast(App.label(u) + ' is cancelled and can’t be added to a schedule.', 'error'); return; }
    App.ui.addMenuFor = null; App.render();
    const name = await App.promptDialog({ title: 'New schedule', label: 'Schedule name', value: 'Plan ' + String.fromCharCode(65 + App.state.schedules.length) });
    if (!name) return;
    const sch = { id: App.uid('sch'), name, sections: [u] };
    App.state.schedules.push(sch);
    App.state.activeScheduleId = sch.id;
    App.save(); App.render();
    App.toast('Created “' + name + '” with ' + App.label(u) + '.', 'success');
  }

  // ---------- popover ----------
  function seededRandom(seed) { let x = Number(seed) % 2147483647; return () => (x = (x * 16807) % 2147483647) / 2147483647; }
  function gradeDist(u) {
    const r = seededRandom(Number(u) * 7 + 13);
    const raw = [0.28 + r() * 0.2, 0.25 + r() * 0.12, 0.14 + r() * 0.1, 0.05 + r() * 0.06, 0.02 + r() * 0.05, 0.03 + r() * 0.03];
    const sum = raw.reduce((a, b) => a + b, 0);
    const pct = raw.map(v => Math.round(v / sum * 100));
    pct[0] += 100 - pct.reduce((a, b) => a + b, 0);
    return ['A', 'B', 'C', 'D', 'F', 'Q/W'].map((g, i) => ({ g, p: pct[i] }));
  }

  function popoverHtml(u) {
    const s = App.sec(u); const se = App.seats(u);
    const dist = gradeDist(u); const max = Math.max(...dist.map(d => d.p));
    const rmp = 'https://www.ratemyprofessors.com/search/professors?q=' + encodeURIComponent(s.instructor.replace(/^(Dr\.|Prof\.)\s*/, ''));
    return '' +
      '<div class="pop-head"><h3 id="pop-title">' + esc(s.course) + ' · ' + esc(s.title) + '</h3>' +
      '<button type="button" class="icon-btn" data-act="pop-close" aria-label="Close details">×</button></div>' +
      '<p class="muted small">Unique #' + u + ' · ' + esc(s.instructor) + ' · ' + s.credits + ' hrs · ' + esc(s.mode) + '</p>' +
      '<p>' + esc(s.description) + '</p>' +
      '<p class="small">Seats ' + se.enrolled + '/' + s.capacity + ' · Waitlist ' + se.waitlisted + '/' + s.waitlistCap + (s.restriction ? ' · ' + esc(s.restriction.text) : '') + '</p>' +
      '<h4>Past grade distribution <span class="sample-tag">SAMPLE DATA</span></h4>' +
      '<div class="dist" role="img" aria-label="Sample grade distribution: ' + dist.map(d => d.g + ' ' + d.p + '%').join(', ') + '">' +
      dist.map(d => '<div class="dist-col"><div class="dist-bar" style="height:' + Math.max(4, d.p / max * 56) + 'px"></div><span>' + d.g + '</span><small>' + d.p + '%</small></div>').join('') +
      '</div><p class="muted tiny">Illustrative numbers generated for the demo — not real historical grades.</p>' +
      '<ul class="pop-links">' +
      '<li><a href="syllabi/sample-syllabus.html?u=' + u + '" target="_blank" rel="noopener">Past syllabus — sample document (local mock)</a></li>' +
      '<li><a href="' + rmp + '" target="_blank" rel="noopener noreferrer">Rate My Professors search ↗ <span class="muted">(external site)</span></a></li>' +
      '</ul>';
  }

  let hideTimer = null;
  function showPopover(u, anchor, pinned) {
    const pop = document.getElementById('popover');
    clearTimeout(hideTimer);
    App.ui.popoverFor = u; App.ui.popoverPinned = !!pinned;
    pop.innerHTML = popoverHtml(u);
    pop.hidden = false;
    positionPopover(pop, anchor);
    document.querySelectorAll('[data-act="details"]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.u === u)));
  }
  function positionPopover(pop, anchor) {
    if (window.innerWidth < 900 || !anchor) { pop.classList.add('sheet'); pop.style.left = pop.style.top = ''; return; }
    pop.classList.remove('sheet');
    const r = anchor.getBoundingClientRect(); const w = pop.offsetWidth; const h = pop.offsetHeight;
    let left = r.right + 10; if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 10);
    let top = Math.min(Math.max(8, r.top), window.innerHeight - h - 8);
    pop.style.left = left + 'px'; pop.style.top = Math.max(8, top) + 'px';
  }
  App.hidePopover = function (returnFocus) {
    const pop = document.getElementById('popover');
    const u = App.ui.popoverFor;
    pop.hidden = true; App.ui.popoverFor = null; App.ui.popoverPinned = false;
    document.querySelectorAll('[data-act="details"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (returnFocus && u) { const b = document.querySelector('[data-fk="det-' + u + '"]'); if (b) b.focus(); }
  };

  // ---------- events ----------
  App.initCourses = function () {
    const col = document.getElementById('col-courses');
    const pop = document.getElementById('popover');

    col.addEventListener('change', e => {
      const sel = e.target.closest('select[data-filter]');
      if (!sel) return;
      if (sel.dataset.filter === 'compat' && !sel.value) {
        App.state.filters = App.state.filters.filter(f => f.type !== 'compat'); App.save(); App.render(); return;
      }
      if (sel.value) addFilter(sel.dataset.filter, sel.value);
    });
    col.addEventListener('submit', e => {
      if (e.target.id !== 'filter-form') return;
      e.preventDefault();
      const inp = document.getElementById('f-num'); const v = inp.value.trim();
      if (!v) { App.toast('Type part of a course number first (e.g. 3 or 314).', 'info'); inp.focus(); return; }
      addFilter('num', v);
    });

    col.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const u = b.dataset.u; const act = b.dataset.act;
      if (act === 'rm-filter') { App.state.filters.splice(Number(b.dataset.i), 1); App.save(); App.render(); }
      else if (act === 'clear-filters') { App.state.filters = []; App.save(); App.render(); App.toast('All filters cleared.', 'info'); }
      else if (act === 'details') {
        if (App.ui.popoverFor === u && App.ui.popoverPinned) App.hidePopover(false);
        else { showPopover(u, b.closest('.sec-card'), true); const c = pop.querySelector('.icon-btn'); if (c) c.focus(); }
      }
      else if (act === 'add-menu') {
        App.ui.addMenuFor = App.ui.addMenuFor === u ? null : u; App.render();
        if (App.ui.addMenuFor) { const first = col.querySelector('.menu [role="menuitem"]'); if (first) first.focus(); }
      }
      else if (act === 'add-to') addToSchedule(u, b.dataset.sid);
      else if (act === 'add-new') addToNew(u);
      else if (act === 'join-wl') { const r = App.joinWaitlist(u); App.toast(r.msg, r.ok ? 'success' : 'error'); App.render(); }
    });

    // keyboard for add menu
    col.addEventListener('keydown', e => {
      const menu = e.target.closest('.menu');
      if (!menu) return;
      const items = [...menu.querySelectorAll('[role="menuitem"]')]; const i = items.indexOf(e.target);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') { const u = App.ui.addMenuFor; App.ui.addMenuFor = null; App.render(); const t = document.querySelector('[data-fk="add-' + u + '"]'); if (t) t.focus(); }
    });

    // hover preview
    col.addEventListener('mouseover', e => {
      const card = e.target.closest('.sec-card'); if (!card || App.ui.popoverPinned) return;
      if (window.matchMedia('(hover: none)').matches) return;
      const u = card.dataset.u;
      clearTimeout(hideTimer);
      if (App.ui.popoverFor !== u) { hideTimer = setTimeout(() => showPopover(u, card, false), 220); }
    });
    col.addEventListener('mouseout', e => {
      const card = e.target.closest('.sec-card'); if (!card || App.ui.popoverPinned) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (!App.ui.popoverPinned) App.hidePopover(false); }, 250);
    });
    pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    pop.addEventListener('mouseleave', () => { if (!App.ui.popoverPinned) hideTimer = setTimeout(() => App.hidePopover(false), 250); });
    pop.addEventListener('click', e => { if (e.target.closest('[data-act="pop-close"]')) App.hidePopover(true); });
    document.getElementById('courses-body').addEventListener('scroll', () => { if (!App.ui.popoverPinned && App.ui.popoverFor) App.hidePopover(false); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && App.ui.popoverFor && !document.querySelector('dialog[open]')) App.hidePopover(true);
    });
    document.addEventListener('click', e => {
      if (App.ui.popoverFor && App.ui.popoverPinned && !pop.contains(e.target) && !e.target.closest('[data-act="details"]')) App.hidePopover(false);
      if (App.ui.addMenuFor && !e.target.closest('.menu-wrap')) { App.ui.addMenuFor = null; App.render(); }
    });
  };
})();
