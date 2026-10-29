/*
 * HELIOS feature — HL7 FHIR R4 export.
 * Packages the current assessment as a FHIR Bundle (Patient, Observations with LOINC/UCUM codes
 * where they exist, and DetectedIssues for findings) so ground medical systems can ingest it.
 * Private journal text and private behavioural answers are never included.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { store } = app;
  const T = app.T;

  // LOINC where a standard code exists; HELIOS's own code system otherwise.
  const LOINC = {
    rhr: ['40443-4', 'Heart rate --resting'], sbp: ['8480-6', 'Systolic blood pressure'], temp: ['8310-5', 'Body temperature'],
    mass: ['29463-7', 'Body weight'], sleep: ['93832-4', 'Sleep duration'], lymph: ['26474-7', 'Lymphocytes [#/volume] in Blood'],
    crp: ['1988-5', 'C reactive protein [Mass/volume] in Serum or Plasma'], uca: ['6874-2', 'Calcium [Mass/time] in 24 hour Urine'],
  };
  const UCUM = { bpm: '/min', ms: 'ms', mmHg: 'mm[Hg]', '°C': 'Cel', kg: 'kg', h: 'h', '%': '%', 'mg/day': 'mg/d', 'mg/L': 'mg/L', '×10⁹/L': '10*9/L',
    'L/day': 'L/d', 'kcal/day': 'kcal/d', 'mSv/day': 'mSv/d', mSv: 'mSv', 'min/day': 'min/d', µm: 'um', 'copies/mL': '{copies}/mL', '/10': '{score}', 'of 7': 'd' };
  const VITAL = new Set(['rhr', 'hrv', 'sbp', 'temp', 'mass']);
  const SURVEY = new Set(['mood', 'stress', 'social', 'headache']);
  const HELIOS_CS = 'https://github.com/WillBettleheim/Helios/indicators';
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

  function bundle() {
    const a = app.me(), c = a.crew, ci = app.todayCheckin(c.id), privateBehav = ci && ci.share === 'private';
    const pid = uuid(), now = new Date().toISOString();
    const entries = [];
    const add = (resource) => { const id = resource.resourceType === 'Patient' ? pid : uuid(); resource.id = id; entries.push({ fullUrl: `urn:uuid:${id}`, resource }); return id; };
    add({ resourceType: 'Patient', identifier: [{ system: 'urn:helios:crew', value: c.personal && store.profile ? store.profile.uid : c.id }], name: [{ text: c.name }] });

    H.INDICATORS.forEach((ind) => {
      const r = a.inds[ind.id];
      if (r.noData || r.current == null) return;
      if (privateBehav && ind.domain === 'behav' && SURVEY.has(ind.id)) return;
      const code = LOINC[ind.id];
      const date = app.dayDate(r.latestDay).toISOString().slice(0, 10);
      const B = r.base;
      const interp = r.status === 0 ? 'N' : (r.z != null ? (r.z > 0 ? 'H' : 'L') : (ind.bad === 'up' ? 'H' : 'L'));
      add({
        resourceType: 'Observation', status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: VITAL.has(ind.id) ? 'vital-signs' : SURVEY.has(ind.id) ? 'survey' : 'laboratory' }] }],
        code: { coding: [code ? { system: 'http://loinc.org', code: code[0], display: code[1] } : { system: HELIOS_CS, code: ind.id, display: ind.name }], text: ind.name },
        subject: { reference: `urn:uuid:${pid}` }, effectiveDateTime: date,
        valueQuantity: { value: +r.current.toFixed(ind.dec + 1), unit: ind.unit, system: 'http://unitsofmeasure.org', code: UCUM[ind.unit] || ind.unit },
        interpretation: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: interp }] }],
        ...(B && B.mean != null ? { referenceRange: [{ low: { value: +(B.mean - 2 * B.sd).toFixed(ind.dec + 1), unit: ind.unit }, high: { value: +(B.mean + 2 * B.sd).toFixed(ind.dec + 1), unit: ind.unit }, text: `Personal baseline ±2 SD (${B.source})` }] } : {}),
        note: [{ text: `HELIOS status: ${H.LEVEL_LABEL[r.status]}${r.reasons[0] ? ` — ${r.reasons[0]}` : ''}` }],
      });
    });

    a.insights.filter((i) => !(privateBehav && i.private)).forEach((i) => add({
      resourceType: 'DetectedIssue', status: 'final', severity: i.level >= 2 ? 'high' : 'moderate',
      code: { text: i.title }, patient: { reference: `urn:uuid:${pid}` }, identifiedDateTime: now, detail: i.summary,
      mitigation: i.actions.map((x) => ({ action: { text: x } })).concat(i.protocol ? [{ action: { text: `Protocol ${i.protocol}` } }] : []),
    }));

    return { resourceType: 'Bundle', type: 'collection', timestamp: now, meta: { source: 'HELIOS crew health monitor (prototype)' }, entry: entries };
  }

  H.bus.on('slot:report-actions', () => `<button class="btn" data-action="fhir-export" title="HL7 FHIR R4 Bundle for ground medical systems">${T('Export FHIR')}</button>`);
  H.bus.on('action:fhir-export', () => {
    const b = bundle();
    app.download(`helios-${app.me().crew.id}-fhir.json`, JSON.stringify(b, null, 2), 'application/fhir+json');
    app.log(`FHIR bundle exported (${b.entry.length} resources)`, 'downlink');
  });

  H.fhir = { bundle, LOINC };
});
