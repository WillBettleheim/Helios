/*
 * HELIOS feature — offline symptom triage.
 * Short yes/no decision trees that end in concrete steps and the medical-kit items needed.
 * Prototype content: every path keeps the Crew Medical Officer in the loop.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, pill, store, ICON } = app;
  const T = app.T;
  const state = { guide: null, node: null, path: [] };

  app.addIcon('triage', '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>');
  app.addView({ id: 'triage', label: 'Symptom triage', short: 'Triage', group: 'act', icon: 'triage', render });

  // Node: { q, yes, no } or outcome { level, title, steps, kit }
  const GUIDES = [
    { id: 'chest', title: 'Chest pain or palpitations', icon: 'heart', start: 'c1', nodes: {
      c1: { q: 'Crushing or pressure-like chest pain, pain spreading to the arm, jaw or back, fainting, or severe shortness of breath?', yes: 'cE', no: 'c2' },
      c2: { q: 'Is the pain sharp and worse when you move, press on the chest wall or breathe deeply?', yes: 'cM', no: 'c3' },
      c3: { q: 'Racing, pounding or irregular heartbeat?', yes: 'cP', no: 'cU' },
      cE: { level: 3, title: 'Possible cardiac emergency', steps: ['Stop all activity and call the CMO and crew now', 'Secure yourself seated or restrained; keep still', 'Attach the 12-lead ECG and pulse oximeter', 'Oxygen if SpO₂ is below 94% (CMO decides)', 'Chew aspirin 325 mg if not allergic and the CMO agrees', 'Have the AED ready; request a private medical conference with ground'], kit: ['Aspirin 325 mg', 'ECG electrodes', 'AED pads'] },
      cM: { level: 1, title: 'Likely chest-wall (musculoskeletal) pain', steps: ['Rest and avoid the movement that triggers it', 'Paracetamol 1 g if needed', 'Record a 5-min ECG to be safe', 'Escalate if pain changes character, spreads or you feel unwell'], kit: ['Paracetamol 500 mg', 'ECG electrodes'] },
      cP: { level: 2, title: 'Palpitations', steps: ['Sit and secure yourself; slow breathing for 2 minutes', 'Record an ECG while the symptoms are present', 'Stop caffeine for today', 'Notify the CMO; escalate immediately if dizziness, chest pain or fainting'], kit: ['ECG electrodes'] },
      cU: { level: 1, title: 'Unclear chest discomfort', steps: ['Measure heart rate, blood pressure and SpO₂', 'Record a 5-min ECG', 'Notify the CMO for an assessment'], kit: ['ECG electrodes'] },
    } },
    { id: 'vision', title: 'Vision change', icon: 'eye', start: 'v1', nodes: {
      v1: { q: 'Sudden vision loss, a curtain or shadow, or flashes with many new floaters?', yes: 'vE', no: 'v2' },
      v2: { q: 'Blurred near vision that developed over days or weeks?', yes: 'vS', no: 'v3' },
      v3: { q: 'Eye pain, redness or a feeling of something in the eye?', yes: 'vF', no: 'vL' },
      vE: { level: 3, title: 'Possible retinal or neurological emergency', steps: ['Notify the CMO now', 'Avoid straining, heavy exercise and head-down positions', 'OCT and fundoscopy as soon as possible', 'Request a private medical conference with ground'], kit: [] },
      vS: { level: 2, title: 'Possible SANS-related change', steps: ['Run protocol P-SANS-01 (near-acuity and Amsler grid tests)', 'Book an OCT scan within 48 hours', 'Log any headaches alongside'], kit: [] },
      vF: { level: 1, title: 'Eye irritation or foreign body', steps: ['Do not rub the eye', 'Irrigate with saline eye wash', 'CMO to check with fluorescein strips', 'Antibiotic drops only if the CMO prescribes them'], kit: ['Saline eye wash', 'Fluorescein strips'] },
      vL: { level: 0, title: 'Minor or unclear change', steps: ['Log the symptom', 'Repeat the near-acuity test tomorrow', 'Escalate if it persists or worsens'], kit: [] },
    } },
    { id: 'head', title: 'Head injury', icon: 'shield', start: 'h1', nodes: {
      h1: { q: 'Loss of consciousness, confusion, repeated vomiting, seizure, unequal pupils or a worsening headache?', yes: 'hE', no: 'h2' },
      h2: { q: 'Is a scalp wound bleeding?', yes: 'hW', no: 'hM' },
      hE: { level: 3, title: 'Serious head injury', steps: ['Secure the person and protect the neck', 'Call the CMO and crew now', 'Neurological checks every 15 minutes (alertness, pupils, limb strength)', 'Request a private medical conference with ground'], kit: [] },
      hW: { level: 1, title: 'Scalp wound', steps: ['Firm direct pressure for 10 minutes (bleeding floats in microgravity — contain it)', 'Clean the wound and close with closure strips', 'Neuro checks every 4 hours for 24 hours'], kit: ['Wound closure strips'] },
      hM: { level: 1, title: 'Minor head bump', steps: ['Cold pack for 15 minutes', 'Neuro checks every 4 hours for 24 hours', 'No safety-critical tasks today; avoid sleep medication tonight'], kit: [] },
    } },
    { id: 'burn', title: 'Burns', icon: 'radiation', start: 'b1', nodes: {
      b1: { q: 'Larger than your palm, on the face, hands, genitals or a joint, electrical or chemical, or around a whole limb?', yes: 'bE', no: 'b2' },
      b2: { q: 'Are there blisters?', yes: 'bP', no: 'bS' },
      bE: { level: 3, title: 'Serious burn', steps: ['Cool with water for 20 minutes (chemical: brush off, then irrigate 20 minutes)', 'Cover loosely with a burn dressing', 'Notify the CMO now; pain relief and fluids', 'Request a private medical conference with ground'], kit: ['Burn dressing', 'Paracetamol 500 mg'] },
      bP: { level: 1, title: 'Partial-thickness burn', steps: ['Cool with water for 20 minutes', "Don't pop blisters", 'Non-adherent burn dressing; check daily for infection'], kit: ['Burn dressing'] },
      bS: { level: 0, title: 'Superficial burn', steps: ['Cool with water for 20 minutes', 'Moisturise; paracetamol if needed'], kit: ['Paracetamol 500 mg'] },
    } },
    { id: 'allergy', title: 'Allergic reaction', icon: 'shield', start: 'a1', nodes: {
      a1: { q: 'Swelling of the lips, tongue or throat, difficulty breathing, wheeze or feeling faint?', yes: 'aE', no: 'aH' },
      aE: { level: 3, title: 'Possible anaphylaxis', steps: ['Epinephrine auto-injector 0.3 mg into the outer thigh now', 'Call the CMO and crew', 'Lie flat with legs raised (sit up if breathing is hard)', 'Second dose after 5–15 minutes if no improvement', 'Antihistamine once stable; request ground conference'], kit: ['Epinephrine auto-injector 0.3 mg', 'Loratadine 10 mg'] },
      aH: { level: 1, title: 'Mild allergic reaction', steps: ['Antihistamine (loratadine 10 mg)', 'Watch for 4 hours for breathing or swelling changes', 'Note what you ate, touched or took'], kit: ['Loratadine 10 mg'] },
    } },
  ];

  function kitStatus(name) {
    const item = H.medkit && H.medkit.find(name);
    if (!item) return '';
    return item.qty > 0 ? `<span class="tag ok">${item.qty} in kit</span>` : '<span class="tag">out of stock</span>';
  }

  function render() {
    const g = GUIDES.find((x) => x.id === state.guide);
    if (!g) {
      return `<div class="page-head"><div><p class="eyebrow">${T('Symptom triage')}</p><h1>${T('What is happening?')}</h1>
        <p class="lede">Short yes/no guides that work offline, for when Earth is minutes away. Each ends with what to do now and what you need from the medical kit.</p></div></div>
        <div class="triage-grid">${GUIDES.map((x) => `<button class="triage-card" data-action="tri-open" data-id="${x.id}">${ICON[x.icon] || ''}<b>${T(x.title)}</b><span>${ICON.arrow}</span></button>`).join('')}</div>
        <p class="muted small">Prototype guidance written from standard first-aid practice — not validated clinical protocols. Always involve the Crew Medical Officer.</p>`;
    }
    const n = g.nodes[state.node];
    const crumbs = state.path.map((p) => `<li><span>${esc(g.nodes[p.node].q)}</span><b>${p.ans ? T('Yes') : T('No')}</b></li>`).join('');
    return `<div class="page-head"><div><p class="eyebrow">${T('Symptom triage')} · ${T(g.title)}</p><h1>${n.q ? T('Answer honestly — speed matters') : esc(n.title)}</h1></div>
      <button class="btn" data-action="tri-back">${T('All guides')}</button></div>
      ${crumbs ? `<ol class="tri-path">${crumbs}</ol>` : ''}
      ${n.q ? `<div class="card tri-q"><p>${esc(n.q)}</p><div class="btns"><button class="btn primary big" data-action="tri-ans" data-ans="1">${T('Yes')}</button><button class="btn big" data-action="tri-ans" data-ans="0">${T('No')}</button></div></div>`
        : `<div class="card tri-out lvl-${app.lv(n.level)}">
          ${pill(n.level)}
          <ol class="steps-plain">${n.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          ${n.kit.length ? `<div class="kit"><span class="k">${T('From the medical kit')}</span>${n.kit.map((k) => `<span class="kit-item">${esc(k)} ${kitStatus(k)}</span>`).join('')}</div>` : ''}
          <div class="form-foot">${n.level >= 2 ? `<button class="btn" data-action="tri-cmo">${T('Notify CMO')}</button>` : ''}<button class="btn" data-action="tri-restart">${T('Start over')}</button><button class="btn primary" data-action="tri-log">${T('Log and finish')}</button></div>
        </div>`}`;
  }

  H.bus.on('action:tri-open', (el) => { const g = GUIDES.find((x) => x.id === el.dataset.id); Object.assign(state, { guide: g.id, node: g.start, path: [] }); app.render(); });
  H.bus.on('action:tri-back', () => { state.guide = null; app.render(); });
  H.bus.on('action:tri-restart', () => { const g = GUIDES.find((x) => x.id === state.guide); Object.assign(state, { node: g.start, path: [] }); app.render(); });
  H.bus.on('action:tri-ans', (el) => {
    const g = GUIDES.find((x) => x.id === state.guide), n = g.nodes[state.node], ans = el.dataset.ans === '1';
    state.path.push({ node: state.node, ans });
    state.node = ans ? n.yes : n.no;
    app.render();
  });
  const outcome = () => { const g = GUIDES.find((x) => x.id === state.guide); return { g, n: g.nodes[state.node] }; };
  H.bus.on('action:tri-cmo', () => { const { g, n } = outcome(); app.log(`Triage (${g.title}): CMO notified — ${n.title}`, 'escalate'); app.toast('Crew Medical Officer notified.'); });
  H.bus.on('action:tri-log', () => {
    const { g, n } = outcome();
    app.log(`Triage (${g.title}): ${n.title}`, 'triage');
    app.toast('Triage logged to your record.');
    state.guide = null; app.go('overview');
  });

  H.triage = { GUIDES };
});
