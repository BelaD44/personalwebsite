/*
 * Exports for the confirmed schedule: JPEG (canvas), PDF (JPEG embedded in a
 * minimal hand-written PDF — no libraries), and an iCalendar (.ics) file.
 */
(function () {
  'use strict';
  const App = window.App;

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /** Draws the confirmed schedule on a landscape letter-ratio canvas (1650×1275). */
  function drawSchedule() {
    const W = 1650, H = 1275;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const regs = App.state.registered.slice();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111827'; ctx.font = 'bold 38px "Charis SIL", Charter, Georgia, serif';
    ctx.fillText('Confirmed schedule — ' + SEED.term.name, 60, 80);
    ctx.font = '22px "Charis SIL", Charter, Georgia, serif'; ctx.fillStyle = '#4b5563';
    ctx.fillText(SEED.student.name + ' (demo student) · ' + App.registeredCredits() + ' registered hours · Exported from course-planning proof of concept (mock data)', 60, 118);

    let startMin = 8 * 60, endMin = 18 * 60;
    regs.forEach(u => App.sec(u).parsed.forEach(p => { startMin = Math.min(startMin, Math.floor(p.start / 60) * 60); endMin = Math.max(endMin, Math.ceil(p.end / 60) * 60); }));
    const gx = 140, gy = 170, gw = W - gx - 60, gh = 760; const colW = gw / 5;
    const pxPerMin = gh / (endMin - startMin);

    ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1; ctx.font = '18px "Charis SIL", Charter, Georgia, serif'; ctx.fillStyle = '#6b7280';
    for (let m = startMin; m <= endMin; m += 60) {
      const y = gy + (m - startMin) * pxPerMin;
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke();
      if (m < endMin) ctx.fillText(App.fmtTime(m).replace(':00', ''), 60, y + 18);
    }
    App.DAYS.forEach((d, i) => {
      const x = gx + i * colW;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke();
      ctx.fillStyle = '#111827'; ctx.font = 'bold 22px "Charis SIL", Charter, Georgia, serif';
      ctx.fillText(App.DAY_NAME[d], x + 12, gy - 14);
    });
    ctx.beginPath(); ctx.moveTo(gx + gw, gy); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();

    regs.forEach((u, i) => {
      const s = App.sec(u); const color = App.PALETTE[i % App.PALETTE.length];
      s.parsed.forEach(p => p.days.forEach(d => {
        const x = gx + App.DAYS.indexOf(d) * colW + 6; const y = gy + (p.start - startMin) * pxPerMin + 2;
        const h = (p.end - p.start) * pxPerMin - 4;
        ctx.fillStyle = color; roundRect(ctx, x, y, colW - 12, h, 8); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 19px "Charis SIL", Charter, Georgia, serif';
        ctx.fillText(s.course + ' #' + u, x + 10, y + 24);
        ctx.font = '16px "Charis SIL", Charter, Georgia, serif';
        if (h > 46) ctx.fillText(App.fmtRange(p.start, p.end), x + 10, y + 46);
        if (h > 66) ctx.fillText(p.room, x + 10, y + 66);
      }));
    });

    // List
    let y = gy + gh + 50;
    ctx.fillStyle = '#111827'; ctx.font = 'bold 22px "Charis SIL", Charter, Georgia, serif'; ctx.fillText('Classes', 60, y); y += 32;
    ctx.font = '18px "Charis SIL", Charter, Georgia, serif';
    regs.forEach((u, i) => {
      const s = App.sec(u);
      ctx.fillStyle = App.PALETTE[i % App.PALETTE.length]; ctx.fillRect(60, y - 14, 14, 14);
      ctx.fillStyle = '#111827';
      const line = s.course + '  #' + u + '  ' + s.title + '  ·  ' + s.credits + ' hrs  ·  ' + App.meetingText(s).join(' / ') + '  ·  ' + s.instructor;
      ctx.fillText(line.length > 150 ? line.slice(0, 147) + '…' : line, 84, y); y += 28;
    });
    return c;
  }

  App.drawSchedule = drawSchedule;

  App.exportJpeg = function () {
    drawSchedule().toBlob(b => { download(b, 'confirmed-schedule.jpg'); App.toast('Downloaded confirmed-schedule.jpg', 'success'); }, 'image/jpeg', 0.92);
  };

  App.exportPdf = function () {
    download(App.buildPdf(), 'confirmed-schedule.pdf');
    App.toast('Downloaded confirmed-schedule.pdf', 'success');
  };

  App.buildPdf = function () {
    const canvas = drawSchedule();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const bin = atob(dataUrl.split(',')[1]);
    const jpg = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);

    // Landscape US Letter: 792 × 612 pt; image fitted with 24pt margin.
    const pw = 792, ph = 612, m = 24;
    const scale = Math.min((pw - 2 * m) / canvas.width, (ph - 2 * m) / canvas.height);
    const iw = (canvas.width * scale).toFixed(2), ih = (canvas.height * scale).toFixed(2);
    const ix = ((pw - iw) / 2).toFixed(2), iy = ((ph - ih) / 2).toFixed(2);
    const content = 'q ' + iw + ' 0 0 ' + ih + ' ' + ix + ' ' + iy + ' cm /Im0 Do Q';

    const enc = new TextEncoder(); const parts = []; const offsets = []; let len = 0;
    const push = p => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); };

    push('%PDF-1.4\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    obj(3, () => push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'));
    obj(4, () => { push('<< /Type /XObject /Subtype /Image /Width ' + canvas.width + ' /Height ' + canvas.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); push(jpg); push('\nendstream'); });
    obj(5, () => push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'));
    obj(6, () => push('<< /Title (Confirmed schedule - ' + SEED.term.name + ') /Producer (Course planner proof of concept) >>'));
    const xref = len;
    let x = 'xref\n0 7\n0000000000 65535 f \n';
    for (let i = 1; i <= 6; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  };

  // ---------- iCalendar ----------
  const ICS_DAY = { M: 'MO', T: 'TU', W: 'WE', TH: 'TH', F: 'FR' };
  const JS_DAY = { M: 1, T: 2, W: 3, TH: 4, F: 5 };
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function fold(line) {
    const out = []; let s = line;
    while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
    out.push(s); return out.join('\r\n');
  }
  const pad = n => String(n).padStart(2, '0');
  function localStamp(dateStr, min) {
    return dateStr.replace(/-/g, '') + 'T' + pad(Math.floor(min / 60)) + pad(min % 60) + '00';
  }
  function firstDate(startStr, days) {
    const d = new Date(startStr + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      if (days.some(x => JS_DAY[x] === d.getDay())) return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      d.setDate(d.getDate() + 1);
    }
    return startStr;
  }

  App.buildIcs = function () {
    const now = new Date(); const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    // UNTIL must be UTC when DTSTART has a TZID (end of last class day, Central Daylight Time).
    const until = new Date(SEED.term.end + 'T23:59:59-05:00').toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Course Planner POC//Demo Export//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEsc(SEED.term.name + ' classes (demo)'), 'X-WR-TIMEZONE:America/Chicago',
      'BEGIN:VTIMEZONE', 'TZID:America/Chicago',
      'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
      'END:VTIMEZONE'];
    App.state.registered.forEach(u => {
      const s = App.sec(u);
      s.parsed.forEach((p, i) => {
        const day0 = firstDate(SEED.term.start, p.days);
        L.push('BEGIN:VEVENT',
          'UID:' + u + '-' + i + '-' + SEED.term.name.replace(/\s/g, '') + '@course-planner-poc.local',
          'DTSTAMP:' + stamp,
          'DTSTART;TZID=America/Chicago:' + localStamp(day0, p.start),
          'DTEND;TZID=America/Chicago:' + localStamp(day0, p.end),
          'RRULE:FREQ=WEEKLY;BYDAY=' + p.days.map(d => ICS_DAY[d]).join(',') + ';UNTIL=' + until,
          'SUMMARY:' + icsEsc(s.course + ' ' + s.title + ' (#' + u + ')'),
          'LOCATION:' + icsEsc(p.room),
          'DESCRIPTION:' + icsEsc('Instructor: ' + s.instructor + '\nUnique #' + u + ', ' + s.credits + ' credit hours\nExported from the course-planning proof of concept (mock data).'),
          'END:VEVENT');
      });
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  };

  App.exportIcs = function () {
    download(new Blob([App.buildIcs()], { type: 'text/calendar;charset=utf-8' }), 'confirmed-schedule-' + SEED.term.name.replace(/\s/g, '-').toLowerCase() + '.ics');
    App.toast('Downloaded .ics file — import it into Google Calendar or Outlook.', 'success');
  };
})();
