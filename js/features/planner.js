/*
 * HELIOS feature — circadian planner.
 * Builds a day plan (light, caffeine, exercise, critical work, nap, wind-down, sleep) from the
 * astronaut's wake time and adjusts it to their own recent sleep debt and alertness test results.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;

  app.addIcon('planner', '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>');
  app.addView({ id: 'planner', label: 'Day planner', short: 'Planner', group: 'daily', icon: 'planner', render });

  const settings = () => (store.planner = store.planner || {})[app.ui.crewId] = Object.assign({ wake: '06:30', sleepH: 8.5, critical: '' }, (store.planner || {})[app.ui.crewId]);
  const toMin = (s) => { const [h, m] = s.split(':').map(Number); return ((h * 60 + m) % 1440 + 1440) % 1440; };
  const fmt = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

  // Recent state from this person's data.
  function readiness() {
    const a = app.me(), sr = app.data().crew[app.ui.crewId].series.sleep, day = app.M.day;
    const base = a.inds.sleep.base && a.inds.sleep.base.mean != null ? a.inds.sleep.base.mean : 7.5;
    let debt = 0;
    for (let d = day - 2; d <= day; d++) if (d >= 1 && sr[d] != null) debt += Math.max(0, base - sr[d]);
    const pvt = a.inds.pvt;
    return { debt, pvtSlow: pvt.status >= 1, pvtZ: pvt.z, sleepBase: base };
  }

  function plan() {
    const s = settings(), r = readiness();
    const wake = toMin(s.wake), extra = Math.min(1, r.debt / 3);           // up to +1 h when in debt
    const sleepLen = (s.sleepH + extra) * 60, bed = wake - sleepLen;
    const blocks = [
      { kind: 'sleep', from: bed, to: wake, label: `Sleep opportunity · ${(sleepLen / 60).toFixed(1)} h`, why: r.debt >= 1 ? `Extended: ${r.debt.toFixed(1)} h sleep debt over the last 3 nights.` : 'Protected — move tasks out of this window.' },
      { kind: 'light', from: wake, to: wake + 45, label: 'Bright blue-enriched light', why: 'Anchors your circadian clock to the mission day.' },
      { kind: 'peak', from: wake + 120, to: wake + 300, label: 'Peak alertness · safety-critical work', why: 'Schedule EVA prep, robotics and maintenance here.' },
      { kind: 'caffeine', from: wake + 60, to: bed - 360, label: 'Caffeine allowed', why: 'Stops 6 h before sleep so it does not cut deep sleep.' },
      { kind: 'dip', from: wake + 420, to: wake + 540, label: r.debt >= 1.5 || r.pvtSlow ? '20-min nap window' : 'Post-lunch dip · routine tasks', why: r.debt >= 1.5 || r.pvtSlow ? 'A short nap here restores alertness without hurting tonight\'s sleep.' : 'Natural low point — avoid critical work.' },
      { kind: 'exercise', from: wake + 600, to: wake + 690, label: 'Countermeasure exercise', why: 'Late afternoon is when strength peaks; ends 3 h+ before sleep.' },
      { kind: 'peak', from: wake + 660, to: wake + 780, label: 'Second alertness peak', why: 'Good for demanding tasks.' },
      { kind: 'wind', from: bed - 120, to: bed, label: 'Wind-down · warm dim light, no screens last hour', why: 'Lets melatonin rise.' },
    ];
    const notes = [];
    if (r.pvtSlow) notes.push(`Your last alertness tests are slower than your baseline${r.pvtZ != null ? ` (${r.pvtZ.toFixed(1)} SD)` : ''} — keep safety-critical work inside the peak window and re-test after sleep.`);
    if (s.critical) {
      const c = toMin(s.critical), rel = ((c - wake) % 1440 + 1440) % 1440;
      const inPeak = (rel >= 120 && rel <= 300) || (rel >= 660 && rel <= 780);
      notes.push(inPeak ? `Your critical task at ${s.critical} falls in a peak-alertness window.` : `Your critical task at ${s.critical} is outside your peak windows${rel >= 420 && rel <= 540 ? ' and lands in the afternoon dip' : ''}. If it can't move, take 100–200 mg caffeine 30 min before${rel > (bed - wake + 1440) % 1440 - 360 ? ' — but that is within 6 h of sleep, so expect lighter sleep' : ''}.`);
    }
    return { blocks, notes, r, bed, wake };
  }

  const COLORS = { sleep: 'var(--accent)', light: 'var(--sun)', peak: 'var(--nominal)', caffeine: '#b98a5a', dip: 'var(--monitor)', exercise: 'var(--action)', wind: '#9b7cff' };

  function ring(blocks) {
    const cx = 130, cy = 130, rings = { sleep: 104, wind: 104, light: 88, peak: 88, dip: 88, exercise: 72, caffeine: 56 };
    const pt = (m, r) => { const a = (m / 1440) * 2 * Math.PI - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const arc = (b) => {
      const r = rings[b.kind], from = ((b.from % 1440) + 1440) % 1440, len = ((b.to - b.from) % 1440 + 1440) % 1440 || 1;
      const [x1, y1] = pt(from, r), [x2, y2] = pt(from + len, r);
      return `<path d="M${x1} ${y1} A${r} ${r} 0 ${len > 720 ? 1 : 0} 1 ${x2} ${y2}" stroke="${COLORS[b.kind]}" class="arc"><title>${esc(b.label)}</title></path>`;
    };
    const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), [nx, ny] = pt(nm, 118);
    const ticks = [0, 6, 12, 18].map((h) => { const [x, y] = pt(h * 60, 124); return `<text x="${x}" y="${y + 4}" text-anchor="middle" class="tick">${String(h).padStart(2, '0')}</text>`; }).join('');
    return `<svg viewBox="0 0 260 260" class="clock" role="img" aria-label="24-hour plan">
      <circle cx="${cx}" cy="${cy}" r="112" class="face"/>${ticks}${blocks.map(arc).join('')}
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" class="now"/><circle cx="${nx}" cy="${ny}" r="4" class="now-dot"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="clock-t mono">${fmt(nm)}</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" class="tick">${T('now')}</text></svg>`;
  }

  function render() {
    const s = settings(), p = plan();
    const order = p.blocks.slice().sort((a, b) => (((a.from - p.wake) % 1440) + 1440) % 1440 - ((((b.from - p.wake) % 1440) + 1440) % 1440));
    return `<div class="page-head"><div><p class="eyebrow">${T('Day planner')}</p><h1>${T('Your circadian plan')}</h1>
      <p class="lede">Built from your wake time and adjusted to your own sleep debt and alertness results. On a spacecraft there is no sunrise — light, caffeine and timing have to do its job.</p></div></div>
      <form id="plan-form" class="card plan-form">
        <div class="field"><label for="pl-wake">${T('Wake time')}</label><input id="pl-wake" name="wake" type="time" value="${esc(s.wake)}"></div>
        <div class="field"><label for="pl-sleep">${T('Sleep need')} <small>h</small></label><input id="pl-sleep" name="sleepH" type="number" min="5" max="11" step="0.25" value="${s.sleepH}"></div>
        <div class="field"><label for="pl-crit">${T('Critical task at')} <small>optional</small></label><input id="pl-crit" name="critical" type="time" value="${esc(s.critical)}"></div>
        <button class="btn primary" type="submit">${T('Update plan')}</button>
      </form>
      <div class="plan-layout">
        <div class="card center">${ring(p.blocks)}
          <p class="muted small">Sleep debt (3 nights): <b class="mono">${p.r.debt.toFixed(1)} h</b> vs your ${p.r.sleepBase.toFixed(1)} h normal</p></div>
        <div class="card">
          ${p.notes.map((n) => `<div class="banner">${esc(n)}</div>`).join('')}
          <ul class="plan-list">${order.map((b) => `<li><i style="background:${COLORS[b.kind]}"></i><span class="mono">${fmt(b.from)}–${fmt(b.to)}</span><div><b>${esc(T(b.label))}</b><small>${esc(b.why)}</small></div></li>`).join('')}</ul>
        </div>
      </div>`;
  }

  H.bus.on('submit:plan-form', (f) => {
    const fd = new FormData(f), s = settings();
    s.wake = fd.get('wake') || s.wake;
    s.sleepH = Math.min(11, Math.max(5, parseFloat(fd.get('sleepH')) || s.sleepH));
    s.critical = fd.get('critical') || '';
    app.save(); app.render();
  });

  H.planner = { plan };
});
