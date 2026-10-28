/*
 * HELIOS feature — import from wearables and health apps.
 *  · Apple Health: export.xml (streamed, so multi-hundred-MB exports work)
 *  · Any CSV (Fitbit, Garmin, Oura, Whoop, spreadsheets): columns are auto-matched, then confirmed
 * Everything is parsed in the browser; nothing is uploaded.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store, ICON } = app;
  const T = app.T;
  const ui = { csv: null, apple: null, busy: '' };

  app.addIcon('import', '<path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><rect x="4" y="17" width="16" height="3" rx="1"/>');
  app.addView({ id: 'import', label: 'Import wearables', short: 'Import', group: 'me', icon: 'import', render });

  // Daily aggregation: sums for totals, means for physiology.
  const SUM = new Set(['exer', 'fluid', 'kcal', 'sleep']);

  // ---------- Apple Health ----------
  const APPLE = {
    HKQuantityTypeIdentifierRestingHeartRate: { id: 'rhr', conv: (v) => v },
    HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { id: 'hrv', conv: (v) => v, note: 'Apple records SDNN, not RMSSD — values are comparable to themselves, which is what your personal baseline uses.' },
    HKQuantityTypeIdentifierBloodPressureSystolic: { id: 'sbp', conv: (v) => v },
    HKQuantityTypeIdentifierBodyTemperature: { id: 'temp', conv: (v, u) => (u === 'degF' ? (v - 32) * 5 / 9 : v) },
    HKQuantityTypeIdentifierAppleExerciseTime: { id: 'exer', conv: (v) => v },
    HKQuantityTypeIdentifierBodyMass: { id: 'mass', conv: (v, u) => (u === 'lb' ? v * 0.45359237 : v) },
    HKQuantityTypeIdentifierDietaryWater: { id: 'fluid', conv: (v, u) => (u === 'mL' ? v / 1000 : u === 'fl_oz_us' ? v * 0.0295735 : v) },
    HKQuantityTypeIdentifierDietaryEnergyConsumed: { id: 'kcal', conv: (v, u) => (u === 'kJ' ? v / 4.184 : v) },
    HKCategoryTypeIdentifierSleepAnalysis: { id: 'sleep', sleep: true },
  };
  const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null; };

  async function parseApple(file, onProgress) {
    const agg = {};   // date → id → [sum, n]
    const add = (date, id, v) => { const d = (agg[date] = agg[date] || {}); const a = (d[id] = d[id] || [0, 0]); a[0] += v; a[1]++; };
    const reader = file.stream().getReader(), dec = new TextDecoder();
    let buf = '', read = 0, records = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (value) { buf += dec.decode(value, { stream: true }); read += value.length; }
      const cut = done ? buf.length : buf.lastIndexOf('<Record');
      if (cut > 0) {
        const chunk = buf.slice(0, cut);
        buf = buf.slice(cut);
        const re = /<Record\b[^>]*>/g;
        let m;
        while ((m = re.exec(chunk))) {
          const tag = m[0], type = attr(tag, 'type'), map = APPLE[type];
          if (!map) continue;
          const start = attr(tag, 'startDate'), end = attr(tag, 'endDate');
          if (!start) continue;
          if (map.sleep) {
            const val = attr(tag, 'value') || '';
            if (!/Asleep/.test(val)) continue;      // skip InBed / Awake
            const h = (Date.parse(end.replace(' ', 'T').replace(' ', '')) - Date.parse(start.replace(' ', 'T').replace(' ', ''))) / 3.6e6;
            if (h > 0 && h < 16) add(end.slice(0, 10), 'sleep', h);
          } else {
            const v = parseFloat(attr(tag, 'value'));
            if (Number.isFinite(v)) add(start.slice(0, 10), map.id, map.conv(v, attr(tag, 'unit')));
          }
          records++;
        }
      }
      onProgress(read / file.size, records);
      if (done) break;
    }
    return finish(agg, records);
  }

  function finish(agg, records) {
    const out = {}; const counts = {};
    Object.entries(agg).forEach(([date, ids]) => {
      Object.entries(ids).forEach(([id, [sum, n]]) => {
        const v = SUM.has(id) ? sum : sum / n;
        (out[date] = out[date] || {})[id] = +v.toFixed(3);
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    return { byDate: out, counts, records, days: Object.keys(out).length };
  }

  // ---------- CSV with column mapping ----------
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  }

  const SYN = {
    rhr: ['resting heart rate', 'resting hr', 'rhr', 'lowest resting heart rate', 'average resting heart rate'],
    hrv: ['rmssd', 'hrv', 'heart rate variability', 'average hrv'],
    sleep: ['total sleep', 'sleep duration', 'minutes asleep', 'asleep', 'sleep time', 'total sleep duration', 'hours of sleep'],
    sleff: ['sleep efficiency', 'efficiency'],
    sbp: ['systolic'],
    temp: ['body temperature', 'skin temperature', 'temperature'],
    exer: ['exercise minutes', 'active minutes', 'very active minutes', 'activity minutes', 'exercise'],
    mass: ['body mass', 'weight'],
    fluid: ['water', 'fluid'],
    kcal: ['calories in', 'energy consumed', 'calories consumed', 'calorie intake'],
    mood: ['mood'], stress: ['stress'],
  };
  const UNITS = {
    sleep: [['h', 'hours', (v) => v], ['min', 'minutes', (v) => v / 60], ['s', 'seconds', (v) => v / 3600]],
    temp: [['c', '°C', (v) => v], ['f', '°F', (v) => (v - 32) * 5 / 9]],
    mass: [['kg', 'kg', (v) => v], ['lb', 'lb', (v) => v * 0.45359237]],
    fluid: [['l', 'litres', (v) => v], ['ml', 'mL', (v) => v / 1000], ['oz', 'fl oz', (v) => v * 0.0295735]],
    sleff: [['pct', '%', (v) => v], ['frac', '0–1', (v) => v * 100]],
  };

  function parseDate(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;   // US month/day
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
  }

  function guessUnit(id, values) {
    const v = values.filter(Number.isFinite);
    const med = v.sort((a, b) => a - b)[v.length >> 1];
    if (med == null) return UNITS[id] ? UNITS[id][0][0] : null;
    if (id === 'sleep') return med > 1440 ? 's' : med > 24 ? 'min' : 'h';
    if (id === 'temp') return med > 45 ? 'f' : 'c';
    if (id === 'fluid') return med > 20 ? 'ml' : 'l';
    if (id === 'sleff') return med <= 1 ? 'frac' : 'pct';
    if (id === 'mass') return med > 180 ? 'lb' : 'kg';
    return UNITS[id] ? UNITS[id][0][0] : null;
  }

  function prepareCsv(name, text) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('No data rows found.');
    const head = rows[0].map((h) => h.trim());
    const lower = head.map((h) => h.toLowerCase());
    const dateCol = lower.findIndex((h) => /\b(date|day|time|timestamp)\b/.test(h));
    const map = {};
    H.LOGGABLE.forEach((id) => {
      const syn = SYN[id] || [id];
      const col = lower.findIndex((h) => syn.some((s) => h === s || h.includes(s)));
      if (col >= 0 && col !== dateCol && !Object.values(map).some((x) => x.col === col)) {
        map[id] = { col, unit: guessUnit(id, rows.slice(1, 60).map((r) => parseFloat(r[col]))) };
      }
    });
    return { name, head, rows: rows.slice(1), dateCol, map };
  }

  function importCsvMapped() {
    const c = ui.csv, agg = {};
    c.rows.forEach((r) => {
      const date = parseDate(r[c.dateCol]);
      if (!date) return;
      Object.entries(c.map).forEach(([id, { col, unit }]) => {
        if (col < 0) return;
        let v = parseFloat(String(r[col]).replace(',', '.'));
        if (!Number.isFinite(v)) return;
        const u = UNITS[id] && UNITS[id].find((x) => x[0] === unit);
        if (u) v = u[2](v);
        const d = (agg[date] = agg[date] || {}); const a = (d[id] = d[id] || [0, 0]); a[0] += v; a[1]++;
      });
    });
    return finish(agg, c.rows.length);
  }

  function merge(result, source) {
    const recs = (store.personal = store.personal || { records: {} }).records;
    let n = 0;
    Object.entries(result.byDate).forEach(([date, vals]) => { recs[date] = Object.assign(recs[date] || {}, vals); n += Object.keys(vals).length; });
    app.log(`Imported ${n} daily values over ${result.days} days from ${source}`, 'import');
    app.recompute();
    app.toast(`Imported ${n} daily values over ${result.days} days from ${source}. HELIOS is updating your baselines.`);
  }

  // ---------- view ----------
  const label = (id) => { const i = H.INDICATORS.find((x) => x.id === id); return i ? `${i.short} (${i.unit})` : id; };

  function render() {
    if (!store.profile) {
      return `<div class="page-head"><div><p class="eyebrow">${T('Import wearables')}</p><h1>${T('Create your profile first')}</h1>
        <p class="lede">Imported data belongs to your personal profile, so HELIOS can learn your baselines from it.</p></div></div>
        <button class="btn primary" data-action="nav" data-view="profile">${T('Set up my profile')} ${ICON.arrow}</button>`;
    }
    return `
      <div class="page-head"><div><p class="eyebrow">${T('Import wearables')}</p><h1>${T('Bring in your own data')}</h1>
        <p class="lede">Your watch, ring or health app already knows your normal. Import it and HELIOS builds your personal baselines from it. Files are read on this device and never uploaded.</p></div></div>
      <div class="grid-2">
        <div class="card imp">
          <h3>Apple Health</h3>
          <p class="muted small">iPhone → Health → your picture → <b>Export All Health Data</b>. Unzip and choose <code>export.xml</code>. Reads resting HR, HRV, blood pressure, temperature, exercise minutes, sleep, body mass, water and calories.</p>
          <label class="btn primary file-btn">${ICON.upload} Choose export.xml<input type="file" accept=".xml,text/xml" data-change="wear-apple" hidden></label>
          ${ui.busy ? `<div class="progress"><div style="width:${ui.busy}"></div></div>` : ''}
          ${ui.apple ? summary(ui.apple, 'apple') : ''}
        </div>
        <div class="card imp">
          <h3>Fitbit · Garmin · Oura · Whoop · any CSV</h3>
          <p class="muted small">Export daily summaries as CSV from your device's app or website. HELIOS matches the columns it recognises; you confirm before anything is imported.</p>
          <label class="btn primary file-btn">${ICON.upload} Choose CSV<input type="file" accept=".csv,text/csv,.txt" data-change="wear-csv" hidden></label>
        </div>
      </div>
      ${ui.csv ? mapping() : ''}`;
  }

  function summary(r, kind) {
    const notes = Object.keys(r.counts).map((id) => Object.values(APPLE).find((m) => m.id === id && m.note)).filter(Boolean);
    return `<div class="imp-sum"><p><b class="mono">${r.records.toLocaleString()}</b> records → <b class="mono">${r.days}</b> days</p>
      <ul class="kv">${Object.entries(r.counts).map(([id, n]) => `<li><span>${esc(label(id))}</span><span class="mono">${n} days</span></li>`).join('') || '<li><span>No supported records found.</span></li>'}</ul>
      ${notes.map((n) => `<p class="muted small">${esc(n.note)}</p>`).join('')}
      ${r.days ? `<div class="form-foot"><button class="btn" data-action="wear-discard" data-kind="${kind}">Discard</button><button class="btn primary" data-action="wear-commit" data-kind="${kind}">Import ${r.days} days</button></div>` : ''}</div>`;
  }

  function mapping() {
    const c = ui.csv;
    const opts = (sel) => `<option value="-1">— not imported —</option>` + c.head.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(h)}</option>`).join('');
    const preview = c.rows.slice(0, 4);
    return `<div class="card">
      <h3>Match columns · ${esc(c.name)} <span class="muted small">(${c.rows.length} rows)</span></h3>
      <div class="map-grid">
        <div class="field"><label>Date column</label><select class="input" data-change="wear-datecol">${c.head.map((h, i) => `<option value="${i}" ${c.dateCol === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></div>
        ${H.LOGGABLE.filter((id) => SYN[id]).map((id) => {
          const m = c.map[id] || { col: -1 };
          return `<div class="field ${m.col >= 0 ? 'matched' : ''}"><label>${esc(label(id))}</label><div class="map-row">
            <select class="input" data-change="wear-col" data-id="${id}">${opts(m.col)}</select>
            ${UNITS[id] ? `<select class="input unit" data-change="wear-unit" data-id="${id}">${UNITS[id].map((u) => `<option value="${u[0]}" ${m.unit === u[0] ? 'selected' : ''}>${u[1]}</option>`).join('')}</select>` : ''}
          </div></div>`;
        }).join('')}
      </div>
      <div class="table-wrap"><table class="table"><thead><tr>${c.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${preview.map((r) => `<tr>${r.map((x) => `<td class="mono">${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="form-foot"><button class="btn" data-action="wear-discard" data-kind="csv">Cancel</button><button class="btn primary" data-action="wear-csv-commit" ${c.dateCol < 0 ? 'disabled' : ''}>Import</button></div>
    </div>`;
  }

  H.bus.on('change:wear-apple', async (el) => {
    const f = el.files && el.files[0]; el.value = '';
    if (!f) return;
    ui.apple = null; ui.busy = '0%'; app.render();
    try {
      ui.apple = await parseApple(f, (p) => {
        ui.busy = Math.round(p * 100) + '%';
        const bar = document.querySelector('.imp .progress div'); if (bar) bar.style.width = ui.busy;
      });
    } catch (e) { app.toast('Could not read that file as an Apple Health export.'); }
    ui.busy = ''; app.render();
  });
  H.bus.on('change:wear-csv', (el) => {
    const f = el.files && el.files[0]; el.value = '';
    if (!f) return;
    if (f.size > 50e6) { app.toast('CSV is larger than 50 MB.'); return; }
    f.text().then((t) => { try { ui.csv = prepareCsv(f.name, t); } catch (e) { app.toast(e.message); } app.render(); });
  });
  H.bus.on('change:wear-datecol', (el) => { ui.csv.dateCol = +el.value; });
  H.bus.on('change:wear-col', (el) => {
    const id = el.dataset.id, col = +el.value;
    ui.csv.map[id] = { col, unit: guessUnit(id, ui.csv.rows.slice(0, 60).map((r) => parseFloat(r[col]))) };
    app.render();
  });
  H.bus.on('change:wear-unit', (el) => { (ui.csv.map[el.dataset.id] = ui.csv.map[el.dataset.id] || { col: -1 }).unit = el.value; });
  H.bus.on('action:wear-discard', (el) => { if (el.dataset.kind === 'csv') ui.csv = null; else ui.apple = null; app.render(); });
  H.bus.on('action:wear-commit', () => { merge(ui.apple, 'Apple Health'); ui.apple = null; app.go('profile'); });
  H.bus.on('action:wear-csv-commit', () => {
    const r = importCsvMapped();
    if (!r.days) { app.toast('No rows with a readable date and value.'); return; }
    merge(r, ui.csv.name); ui.csv = null; app.go('profile');
  });
  H.bus.on('slot:profile-bottom', () => `<div class="card"><h3>${ICON.import || ''} ${T('Import from wearables')}</h3><p class="muted small">Apple Health, Fitbit, Garmin, Oura, Whoop or any CSV.</p><button class="btn sm primary" data-action="nav" data-view="import">${T('Open importer')}</button></div>`);

  H.wearables = { parseCsv, prepareCsv, parseDate, guessUnit, finish, parseApple, APPLE };
});
