/*
 * HELIOS feature — lab panel scoring.
 * Runs the clinical-panel models validated on Inspiration4 crew data (tools/evaluate.js) on an
 * astronaut's own blood count + metabolic panels, against their own preflight draws.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const LM = H.LABMODEL;
  if (!LM) return;
  const { esc, pill, store, ICON } = app;
  const T = app.T;
  const ui = { adding: false, example: 'C001' };
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const clip = (x) => Math.max(-6, Math.min(6, x));
  const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(/-])\S/g, (c) => c.toUpperCase());

  app.addIcon('labs', '<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3"/><circle cx="10" cy="15" r="1"/><circle cx="14" cy="17" r="1"/>');
  app.addView({ id: 'labs', label: 'Lab panels', short: 'Labs', group: 'monitor', icon: 'labs', render });

  const draws = () => (store.labs = store.labs || {})[app.ui.crewId] = (store.labs[app.ui.crewId] || []);

  function zVector(draw, base) {
    return LM.features.map((f) => {
      const b = base.map((d) => d.values[f.id]).filter(Number.isFinite);
      const x = draw.values[f.id];
      if (!Number.isFinite(x) || !b.length) return null;
      return (x - mean(b)) / (f.sd * Math.sqrt(1 + 1 / b.length));
    });
  }
  function modelScore(m, z) {
    if (m.type === 'signature') return m.sel.reduce((s, j, i) => s + m.sign[i] * clip(z[j] ?? 0), 0) / m.k;
    return m.b + m.sel.reduce((s, j, i) => s + m.w[i] * clip(z[j] ?? 0), 0);
  }
  const pct = (ref, x) => (ref.filter((r) => r < x).length + 0.5 * ref.filter((r) => r === x).length) / ref.length;

  // Ensemble: average percentile of the draw's score among real normal Inspiration4 draws.
  function score(draw, all) {
    const pre = all.filter((d) => d.kind === 'pre' && d !== draw);
    if (!pre.length) return null;
    const z = zVector(draw, pre);
    const coverage = z.filter((v) => v != null).length / z.length;
    const per = LM.models.map((m) => { const s = modelScore(m, z); return { id: m.id, normalPct: pct(m.ref.normal, s), flightPct: pct(m.ref.flight, s) }; });
    const value = Math.round(mean(per.map((p) => p.normalPct)) * 100);
    const flightLike = Math.round(mean(per.map((p) => p.flightPct)) * 100);
    // Features the models rely on, ranked by how far this draw moved them.
    const used = new Set(LM.models.flatMap((m) => m.sel));
    const drivers = [...used].map((j) => ({ f: LM.features[j], z: z[j] })).filter((d) => d.z != null && Math.abs(d.z) >= 1.5)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 6);
    const level = value >= 90 ? 2 : value >= 75 ? 1 : 0;
    return { value, flightLike, coverage, drivers, level, nPre: pre.length };
  }

  function rangeFlags(draw) {
    return LM.features.filter((f) => f.range && Number.isFinite(draw.values[f.id]) &&
      ((f.range[0] != null && draw.values[f.id] < f.range[0]) || (f.range[1] != null && draw.values[f.id] > f.range[1])));
  }

  const VERDICT = ['Consistent with your preflight baseline', 'Some spaceflight-like shift', 'Strong spaceflight-like shift'];

  function render() {
    const list = draws().slice().sort((a, b) => a.date.localeCompare(b.date));
    const pre = list.filter((d) => d.kind === 'pre');
    const latest = list.filter((d) => d.kind !== 'pre').slice(-1)[0];
    const res = latest ? score(latest, list) : null;

    const timeline = list.map((d) => {
      const r = score(d, list);
      return `<li class="${d === latest ? 'cur' : ''}">
        <span class="mono">${esc(d.date)}</span><span class="tag">${d.kind === 'pre' ? T('Preflight') : T('In/post-flight')}</span>
        <span class="lab-bar">${r ? `<i class="lvl-${app.lv(r.level)}" style="width:${r.value}%"></i>` : ''}</span>
        <span class="mono">${r ? r.value : '—'}</span>
        <button class="btn sm ghost" data-action="lab-del" data-id="${esc(d.id)}" aria-label="Delete draw">✕</button></li>`;
    }).join('');

    return `
      <div class="page-head"><div><p class="eyebrow">${T('Lab panels')} · ${T('validated model')}</p><h1>${T('Is your blood showing a spaceflight shift?')}</h1>
        <p class="lede">Enter blood count and metabolic panel results. HELIOS compares them with your own preflight draws and runs the ${LM.models.length} clinical-panel models validated on real Inspiration4 crew data (AUROC ${LM.validation.aurocLogreg.toFixed(2)}–${LM.validation.aurocSignature.toFixed(2)}).</p></div>
        <div class="btns"><button class="btn" data-action="lab-add">+ ${T('Add blood draw')}</button>
          <span class="ex"><select data-change="lab-example" aria-label="Example crew member">${LM.examples.map((e) => `<option ${ui.example === e.id ? 'selected' : ''}>${e.id}</option>`).join('')}</select>
          <button class="btn" data-action="lab-load-example">${T('Load real example')}</button></span></div></div>

      ${ui.adding ? form() : ''}

      ${res ? `<section class="lab-result lvl-${app.lv(res.level)}">
        <div class="lab-score"><span class="eyebrow">${T('Spaceflight-shift score')}</span><div class="v-big mono">${res.value}<small>/100</small></div>${pill(res.level, VERDICT[res.level])}</div>
        <div class="lab-text">
          <p>Your ${esc(latest.date)} draw scores higher than <b>${res.value}%</b> of normal Inspiration4 draws and higher than <b>${res.flightLike}%</b> of their day-after-landing draws.</p>
          ${res.drivers.length ? `<ul class="drivers">${res.drivers.map((d) => `<li><span>${esc(titleCase(d.f.name))}</span><span class="zbar ${d.z < 0 ? 'neg' : 'pos'}"><i style="width:${Math.min(50, Math.abs(d.z) * 10)}%"></i></span><span class="mono">${d.z > 0 ? '+' : ''}${d.z.toFixed(1)} SD</span></li>`).join('')}</ul>` : '<p class="muted small">No single value moved more than 1.5 SD from your baseline.</p>'}
          <p class="muted small">Baseline: ${res.nPre} preflight draw${res.nPre > 1 ? 's' : ''} · ${Math.round(res.coverage * 100)}% of the ${LM.features.length} values entered. Validated on only 4 people after a 3-day flight — indicative, not diagnostic.</p>
        </div>
      </section>` : `<div class="empty">${ICON.labs || ''}<div><b>${pre.length ? T('Add an in-flight or post-flight draw to score it.') : T('Start with at least one preflight draw.')}</b><p>Or load a real Inspiration4 crew member's draws to see how the model behaves.</p></div></div>`}

      ${latest && rangeFlags(latest).length ? `<div class="card"><h3>${T('Outside the lab reference range')}</h3><ul class="kv">${rangeFlags(latest).map((f) => `<li><span>${esc(titleCase(f.name))}</span><span class="mono">${latest.values[f.id]} ${esc(f.unit)}</span><span class="muted small">range ${f.range[0] ?? '–'}–${f.range[1] ?? '–'}</span></li>`).join('')}</ul></div>` : ''}

      <div class="card"><h3>${T('Your draws')}</h3>${list.length ? `<ul class="lab-timeline">${timeline}</ul>` : `<p class="muted small">${T('No blood draws yet.')}</p>`}</div>`;
  }

  function form() {
    const group = (panel, title) => `<fieldset><legend>${title}</legend><div class="base-grid">${LM.features.filter((f) => f.panel === panel).map((f) => `
      <div class="field"><label for="lab-${f.id}">${esc(titleCase(f.name))} <small>${esc(f.unit)}</small></label>
      <input id="lab-${f.id}" name="${esc(f.id)}" type="number" step="any" inputmode="decimal" placeholder="${f.range ? `${f.range[0] ?? ''}–${f.range[1] ?? ''}` : ''}"></div>`).join('')}</div></fieldset>`;
    return `<form id="lab-form" class="card form">
      <div class="vitals">
        <div class="field"><label for="lab-date">Date</label><input id="lab-date" name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label for="lab-kind">Timing</label><select id="lab-kind" name="kind" class="input"><option value="pre">Preflight (baseline)</option><option value="post">In-flight / post-flight</option></select></div>
      </div>
      ${group('cbc', 'Complete blood count')}${group('cmp', 'Comprehensive metabolic panel')}
      <p class="muted small">Use the units shown — they match the validation data. Leave unknown values blank.</p>
      <div class="form-foot"><button type="button" class="btn" data-action="lab-cancel">Cancel</button><button type="submit" class="btn primary">Save draw</button></div>
    </form>`;
  }

  H.bus.on('action:lab-add', () => { ui.adding = true; app.render(); });
  H.bus.on('action:lab-cancel', () => { ui.adding = false; app.render(); });
  H.bus.on('action:lab-del', (el) => {
    store.labs[app.ui.crewId] = draws().filter((d) => d.id !== el.dataset.id);
    app.save(); app.render();
  });
  H.bus.on('change:lab-example', (el) => { ui.example = el.value; });
  H.bus.on('action:lab-load-example', () => {
    const ex = LM.examples.find((e) => e.id === ui.example);
    const start = app.M.startISO;
    const offset = (t) => (t[0] === 'L' ? -parseInt(t.slice(2), 10) : app.M.plannedDays + parseInt(t.slice(2), 10));
    store.labs[app.ui.crewId] = ex.draws.filter((d) => ['L-92', 'L-44', 'L-3', 'R+1'].includes(d.t)).map((d) => {
      const dt = new Date(start + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + offset(d.t));
      return { id: `ex-${ex.id}-${d.t}`, date: dt.toISOString().slice(0, 10), kind: d.kind, values: d.values, source: `Inspiration4 ${ex.id} ${d.t}` };
    });
    app.log(`Loaded Inspiration4 ${ex.id} blood draws as an example`, 'labs');
    app.toast(`Loaded ${ex.id}: 3 preflight draws and the day-after-landing draw (real NASA OSDR data).`);
    app.render();
  });
  H.bus.on('submit:lab-form', (f) => {
    const fd = new FormData(f), values = {};
    LM.features.forEach((ft) => { const x = parseFloat(fd.get(ft.id)); if (Number.isFinite(x)) values[ft.id] = x; });
    if (!Object.keys(values).length) { app.toast('Enter at least one value.'); return; }
    draws().push({ id: 'd' + Date.now(), date: String(fd.get('date')), kind: fd.get('kind'), values });
    ui.adding = false;
    app.log(`Blood draw added (${Object.keys(values).length} values)`, 'labs');
    app.render();
  });

  H.labs = { score, zVector };
});
