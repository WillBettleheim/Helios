/*
 * HELIOS feature — medical kit inventory and medication log.
 * Expiry is tracked in mission days so items that will lapse before mission end stand out;
 * radiation-sensitive items are flagged because potency can drop faster in deep space.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;

  app.addIcon('medkit', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M12 11v5M9.5 13.5h5"/>');
  app.addView({ id: 'medkit', label: 'Medical kit', short: 'Med kit', group: 'act', icon: 'medkit', render,
    badge: () => { const n = kit().filter((i) => status(i).level >= 1).length; return n ? `<span class="badge lvl-monitor">${n}</span>` : ''; } });

  // [name, use, quantity, expiry mission day, radiation-sensitive, prescription-only]
  const SEED = [
    ['Paracetamol 500 mg', 'Pain, fever', 100, 700, false, false],
    ['Ibuprofen 200 mg', 'Pain, inflammation', 60, 640, false, false],
    ['Aspirin 325 mg', 'Suspected cardiac event', 30, 520, false, false],
    ['Loratadine 10 mg', 'Allergy', 30, 600, false, false],
    ['Epinephrine auto-injector 0.3 mg', 'Anaphylaxis', 4, 365, true, true],
    ['Melatonin 3 mg', 'Sleep shifting', 60, 480, false, false],
    ['Zolpidem 5 mg', 'Insomnia (CMO only)', 30, 390, true, true],
    ['Promethazine 25 mg', 'Nausea, motion sickness', 20, 450, true, true],
    ['Valacyclovir 500 mg', 'Shingles / herpes reactivation', 42, 540, false, true],
    ['Ciprofloxacin 500 mg', 'Bacterial infection', 28, 420, true, true],
    ['Potassium citrate 10 mEq', 'Kidney-stone prevention', 90, 600, false, true],
    ['Vitamin D 800 IU', 'Bone health', 400, 520, false, false],
    ['Saline eye wash', 'Eye irrigation', 10, 900, false, false],
    ['Fluorescein strips', 'Eye exam', 20, 800, false, false],
    ['ECG electrodes', 'Heart rhythm recording', 100, 600, false, false],
    ['AED pads', 'Defibrillation', 2, 330, false, false],
    ['Wound closure strips', 'Cuts', 50, 900, false, false],
    ['Burn dressing', 'Burns', 10, 900, false, false],
  ];

  function kit() {
    if (!store.medkit) {
      store.medkit = SEED.map(([name, use, qty, exp, rad, rx]) => ({ name, use, qty, start: qty, exp, rad, rx }));
      app.save();
    }
    return store.medkit;
  }
  const find = (name) => kit().find((i) => i.name === name);
  const meds = (id) => (store.medlog = store.medlog || {})[id] = (store.medlog[id] || []);

  // Planned crew-wide use per 100 mission days (4 crew), from the mission medical plan.
  const PLAN = { 'Paracetamol 500 mg': 30, 'Ibuprofen 200 mg': 20, 'Aspirin 325 mg': 1, 'Loratadine 10 mg': 10, 'Epinephrine auto-injector 0.3 mg': 0.5,
    'Melatonin 3 mg': 60, 'Zolpidem 5 mg': 10, 'Promethazine 25 mg': 5, 'Valacyclovir 500 mg': 10, 'Ciprofloxacin 500 mg': 5, 'Potassium citrate 10 mEq': 30,
    'Vitamin D 800 IU': 400, 'Saline eye wash': 3, 'Fluorescein strips': 4, 'ECG electrodes': 30, 'AED pads': 0.2, 'Wound closure strips': 8, 'Burn dressing': 2 };

  // Forecast: the higher of planned use and actual use over the last 30 days.
  function forecast(i) {
    const since = Date.now() - 30 * 86400000;
    const used = Object.values(store.medlog || {}).flat().filter((l) => l.name === i.name && l.t >= since).length;
    const rate = Math.max((PLAN[i.name] || 0) / 100, used / 30);
    if (!rate) return null;
    const lasts = i.qty / rate;
    return { rate, lasts, out: Math.floor(app.M.day + lasts), short: app.M.day + lasts < app.M.plannedDays, observed: used / 30 > (PLAN[i.name] || 0) / 100 };
  }

  function status(i) {
    const day = app.M.day, end = app.M.plannedDays, f = forecast(i);
    if (i.exp <= day) return { level: 3, label: 'Expired' };
    if (i.qty === 0) return { level: 2, label: 'Out of stock' };
    if (f && f.short) return { level: 1, label: `Runs out ~D${f.out} — before mission end` };
    if (i.exp < end) return { level: 1, label: `Expires D${i.exp} — before mission end` };
    if (i.qty / i.start < 0.2) return { level: 1, label: 'Low stock' };
    return { level: 0, label: 'OK' };
  }

  function render() {
    const items = kit();
    const flagged = items.filter((i) => status(i).level >= 1).length;
    const log = meds(app.ui.crewId).slice(-10).reverse();
    return `<div class="page-head"><div><p class="eyebrow">${T('Medical kit')}</p><h1>${flagged ? `${flagged} ${T('items need attention')}` : T('Kit is mission-ready')}</h1>
      <p class="lede">Inventory shared by the crew, with a stock forecast from the mission medical plan or actual use (whichever is higher). Expiry is shown in mission days so anything that will lapse before day ${app.M.plannedDays} stands out. ☢ marks medicines whose potency can drop faster under deep-space radiation.</p></div></div>
      <div class="card table-wrap">
        <table class="table med-table">
          <thead><tr><th>${T('Item')}</th><th>${T('Use')}</th><th>${T('Stock')}</th><th>${T('Lasts until')}</th><th>${T('Status')}</th><th></th></tr></thead>
          <tbody>${items.map((i, k) => { const s = status(i); return `<tr>
            <td><b>${esc(i.name)}</b>${i.rad ? ' <span title="Radiation-sensitive" class="rad">☢</span>' : ''}${i.rx ? ' <span class="tag">Rx · CMO</span>' : ''}</td>
            <td class="muted">${esc(i.use)}</td>
            <td class="mono">${+i.qty}<small class="muted"> / ${+i.start}</small><span class="stock"><i style="width:${(+i.qty / +i.start) * 100}%"></i></span></td>
            <td class="mono">${(() => { const f = forecast(i); return f ? `D${Math.min(f.out, 9999)}${f.observed ? ' <small class="muted">(actual use)</small>' : ''}` : '—'; })()}</td>
            <td>${app.pill(s.level, s.label)}</td>
            <td class="right"><button class="btn sm" data-action="med-take" data-k="${k}" ${i.qty ? '' : 'disabled'}>${T('Use 1')}</button></td></tr>`; }).join('')}</tbody>
        </table>
      </div>
      <div class="card"><h2 class="ct">${T('Medication log')} · ${esc(app.me().crew.name)}</h2>
        ${log.length ? `<ul class="log">${log.map((l) => `<li><span class="mono">D${l.day} ${new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>${esc(l.name)}</li>`).join('')}</ul>` : `<p class="muted small">${T('Nothing taken yet.')}</p>`}
      </div>`;
  }

  H.bus.on('action:med-take', (el) => {
    const i = kit()[+el.dataset.k];
    if (!i || !i.qty) return;
    if (i.rx && !window.confirm(`${i.name} is prescription-only. Has the CMO approved this dose?`)) return;
    i.qty--;
    i.updated = Date.now();
    meds(app.ui.crewId).push({ name: i.name, day: app.M.day, t: Date.now() });
    app.log(`Medication: ${i.name}`, 'medication');
    app.toast(`${i.name} logged. ${i.qty} left.`);
    app.render();
  });

  H.medkit = { find, kit, status, forecast };
});
