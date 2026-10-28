/*
 * HELIOS feature — "what works for you".
 * When a protocol is logged, the indicators it targets are snapshotted. Two to seven days later
 * HELIOS checks whether they moved in the healthy direction for this person, and keeps a track
 * record per protocol so countermeasures can be ranked by personal effectiveness.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;

  const TARGETS = {
    'P-SLP-01': ['sleep', 'sleff', 'pvt'], 'P-ENV-01': ['headache'], 'P-BHP-01': ['mood', 'stress'],
    'P-MSK-01': ['exer', 'grip'], 'P-REN-01': ['uca', 'fluid'], 'P-IMM-01': ['temp', 'crp', 'lymph'],
    'P-CV-01': ['rhr', 'sbp', 'hrv'], 'P-SANS-01': ['headache', 'rnfl'], 'P-RAD-01': ['dose'], 'P-RAD-02': ['dose'],
    'P-NUT-01': ['mass', 'fluid', 'kcal'],
  };
  const BEFORE = 5, AFTER_FROM = 2, AFTER_TO = 7, EFFECT = 0.5;
  const list = (id) => (store.outcomes = store.outcomes || {})[id] = (store.outcomes[id] || []);
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const valuesIn = (arr, d0, d1) => { const v = []; for (let d = Math.max(1, d0); d <= Math.min(arr.length - 1, d1); d++) if (arr[d] != null) v.push(arr[d]); return v; };

  H.bus.on('protocol-complete', ({ protocol, steps, crewId, day, series }) => {
    const ids = (TARGETS[protocol.id] || []).filter((id) => series[id]);
    const before = {};
    ids.forEach((id) => { const m = mean(valuesIn(series[id], day - BEFORE + 1, day)); if (m != null) before[id] = m; });
    list(crewId).push({ protocol: protocol.id, day, ts: Date.now(), steps, total: protocol.steps.length, before });
    app.save();
  });

  // Effect in SD units, positive = moved in the healthy direction.
  function evaluate(o, a, series, today) {
    if (today < o.day + AFTER_FROM + 1) return { state: 'pending', ready: o.day + AFTER_FROM + 1 - today };
    const effects = Object.entries(o.before).map(([id, b]) => {
      const after = mean(valuesIn(series[id], o.day + AFTER_FROM, o.day + AFTER_TO));
      const r = a.inds[id], ind = r.ind;
      const sd = (r.base && r.base.sd) || (ind.base && ind.base[1]) || Math.max(1e-6, Math.abs(b) * 0.1);
      if (after == null) return null;
      return { id, name: ind.short, effect: ((after - b) / sd) * (ind.bad === 'up' ? -1 : 1), before: b, after, dec: ind.dec, unit: ind.unit };
    }).filter(Boolean);
    if (!effects.length) return { state: 'nodata' };
    const avg = mean(effects.map((e) => e.effect));
    return { state: avg >= EFFECT ? 'better' : avg <= -EFFECT ? 'worse' : 'same', avg, effects };
  }

  const STATE = { better: ['Improved', 'nominal'], same: ['No clear change', 'monitor'], worse: ['Got worse', 'action'], pending: ['Measuring', 'faint'], nodata: ['No follow-up data', 'faint'] };

  function record(crewId, protocolId) {
    const a = app.assessments()[crewId], series = app.data().crew[crewId].series, today = app.dayFor(crewId);
    return list(crewId).filter((o) => !protocolId || o.protocol === protocolId).map((o) => ({ o, r: evaluate(o, a, series, today) }));
  }

  function tally(rows) {
    const done = rows.filter((x) => ['better', 'same', 'worse'].includes(x.r.state));
    return { n: done.length, better: done.filter((x) => x.r.state === 'better').length, pending: rows.filter((x) => x.r.state === 'pending').length };
  }

  H.bus.on('slot:protocol-detail', (p) => {
    const rows = record(app.ui.crewId, p.id).reverse();
    const t = tally(rows);
    return `<div class="track">
      <div class="track-head"><b>${T('Your track record')}</b>${t.n ? `<span class="mono">${T('Worked')} ${t.better} / ${t.n}</span>` : ''}</div>
      ${rows.length ? `<ul>${rows.slice(0, 5).map(({ o, r }) => `<li><span class="mono">D${o.day}</span><span class="st st-${STATE[r.state][1]}">${T(STATE[r.state][0])}</span>
        <span class="muted small">${r.state === 'pending' ? `result in ${r.ready} day${r.ready > 1 ? 's' : ''}` : r.effects ? r.effects.map((e) => `${esc(e.name)} ${H.fmt(e.before, e.dec)}→${H.fmt(e.after, e.dec)}`).join(' · ') : ''}</span></li>`).join('')}</ul>`
        : `<p class="muted small">${T('Log this protocol and HELIOS will check 2–7 days later whether')} ${(TARGETS[p.id] || []).map((id) => H.INDICATORS.find((i) => i.id === id)?.short).filter(Boolean).join(', ')} ${T('improved for you.')}</p>`}
    </div>`;
  });

  H.bus.on('slot:overview-side-top', (a) => {
    const rows = record(a.crew.id);
    const by = {};
    rows.forEach(({ o, r }) => { if (['better', 'same', 'worse'].includes(r.state)) { const x = (by[o.protocol] = by[o.protocol] || { n: 0, b: 0 }); x.n++; if (r.state === 'better') x.b++; } });
    const ranked = Object.entries(by).sort((x, y) => y[1].b / y[1].n - x[1].b / x[1].n);
    const pending = rows.filter((x) => x.r.state === 'pending').length;
    if (!ranked.length && !pending) return '';
    return `<div class="card"><h2 class="ct">${T('What works for you')}</h2>
      ${ranked.length ? `<ul class="kv">${ranked.slice(0, 4).map(([id, x]) => `<li><span>${esc(H.PROTOCOLS.find((p) => p.id === id)?.title || id)}</span><span class="mono">${x.b}/${x.n}</span></li>`).join('')}</ul>` : ''}
      ${pending ? `<p class="muted small">${pending} protocol${pending > 1 ? 's' : ''} being measured.</p>` : ''}</div>`;
  });

  H.outcomes = { evaluate, TARGETS };
});
