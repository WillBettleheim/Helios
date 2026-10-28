/*
 * HELIOS — mission, crew and indicator catalogue, plus a deterministic
 * simulator that stands in for the on-board sensor and lab feeds.
 */
window.H = window.H || {};
(function (H) {
  'use strict';

  const MISSION = {
    name: 'HELIOS-1',
    subtitle: 'Mars transit · Deep Space Habitat',
    startISO: '2026-06-04',
    day: 147,
    plannedDays: 400,
    lightTimeSec: 846,      // one-way Earth light time
    downlinkInMin: 47,      // next scheduled high-rate downlink window
    careerLimit: 600,       // mSv, NASA career effective-dose standard
    events: [
      { day: 125, label: 'CO₂ scrubber fault', kind: 'env' },
      { day: 131, label: 'Solar particle event', kind: 'rad' },
      { day: 140, label: 'Scrubber partially restored', kind: 'env' },
    ],
  };

  const DOMAINS = [
    { id: 'cardio', name: 'Cardiovascular', icon: 'heart',
      risk: 'Headward fluid shift, deconditioning and radiation raise cardiovascular and orthostatic risk.' },
    { id: 'msk', name: 'Bone & Muscle', icon: 'bone',
      risk: 'Unloading in microgravity drives ~1–1.5% hip bone loss per month without countermeasures, plus kidney-stone risk.' },
    { id: 'immune', name: 'Immune', icon: 'shield',
      risk: 'Stress, radiation and confinement dysregulate immunity and allow latent viruses (EBV, VZV) to reactivate.' },
    { id: 'rad', name: 'Radiation', icon: 'radiation',
      risk: 'Galactic cosmic rays accumulate dose continuously; solar particle events can deliver large acute doses.' },
    { id: 'behav', name: 'Sleep & Behavioral', icon: 'moon',
      risk: 'Isolation, confinement and circadian disruption degrade sleep, mood and cognitive performance.' },
    { id: 'sans', name: 'Neuro-ocular', icon: 'eye',
      risk: 'Spaceflight-associated neuro-ocular syndrome (SANS): optic disc edema, globe flattening and vision change.' },
  ];

  /*
   * bad:      direction of unhealthy change ('up' | 'down')
   * base:     [preflight mean, preflight SD] — the personal baseline
   * expected: optional in-flight expected drift (e.g. bone loss even with countermeasures)
   * cadence:  days between measurements
   * onDemand: value for today only exists once the astronaut provides it
   * useZ:     false → judged on absolute limits only
   */
  const INDICATORS = [
    { id: 'rhr', domain: 'cardio', name: 'Resting heart rate', short: 'Resting HR', unit: 'bpm', dec: 0, bad: 'up',
      base: [58, 3], cadence: 1, src: 'Bio-harness · sleep-period average', limits: { monitor: 75, action: 90, urgent: 110 } },
    { id: 'hrv', domain: 'cardio', name: 'Heart rate variability (RMSSD)', short: 'HRV', unit: 'ms', dec: 0, bad: 'down',
      base: [52, 6], cadence: 1, src: 'Bio-harness · morning 5-min ECG', limits: { monitor: 35, action: 25 } },
    { id: 'sbp', domain: 'cardio', name: 'Systolic blood pressure', short: 'Systolic BP', unit: 'mmHg', dec: 0, bad: 'up',
      base: [118, 5], cadence: 1, src: 'Automated cuff · morning', limits: { monitor: 135, action: 150, urgent: 180 } },

    { id: 'bmd', domain: 'msk', name: 'Estimated hip BMD change', short: 'Hip BMD Δ', unit: '%', dec: 1, bad: 'down',
      base: [0, 0.4], expected: (d) => -0.017 * d, cadence: 7, src: 'Bone ultrasound + resorption-marker model' },
    { id: 'uca', domain: 'msk', name: 'Urinary calcium', short: 'Urine Ca', unit: 'mg/day', dec: 0, bad: 'up',
      base: [190, 25], cadence: 3, src: 'Urine analyzer', limits: { monitor: 300, action: 350 } },
    { id: 'exer', domain: 'msk', name: 'Countermeasure exercise', short: 'Exercise', unit: 'min/day', dec: 0, bad: 'down',
      base: [120, 12], cadence: 1, clamp: [0, 240], step: 5, src: 'ARED / treadmill / cycle logs', limits: { monitor: 90, action: 60 } },
    { id: 'grip', domain: 'msk', name: 'Grip strength', short: 'Grip', unit: 'kg', dec: 1, bad: 'down',
      base: [44, 1.5], cadence: 7, src: 'Hand dynamometer' },

    { id: 'lymph', domain: 'immune', name: 'Lymphocyte count', short: 'Lymphocytes', unit: '×10⁹/L', dec: 2, bad: 'down',
      base: [2.0, 0.25], cadence: 7, src: 'In-flight blood analyzer', limits: { monitor: 1.2, action: 0.9, urgent: 0.5 } },
    { id: 'crp', domain: 'immune', name: 'C-reactive protein', short: 'CRP', unit: 'mg/L', dec: 1, bad: 'up',
      base: [1.0, 0.4], cadence: 7, clamp: [0.1, 300], src: 'In-flight blood analyzer', limits: { monitor: 3, action: 10 } },
    { id: 'vir', domain: 'immune', name: 'Salivary latent-virus DNA (EBV/VZV)', short: 'Viral shedding', unit: 'copies/mL', dec: 0, bad: 'up',
      base: null, cadence: 7, clamp: [0, 1e7], step: 1, src: 'Saliva PCR cartridge', limits: { monitor: 100, action: 1000 } },
    { id: 'temp', domain: 'immune', name: 'Core body temperature', short: 'Temperature', unit: '°C', dec: 1, bad: 'up',
      base: [36.7, 0.2], cadence: 1, src: 'Bio-harness · thermal patch', limits: { monitor: 37.6, action: 38.3, urgent: 39.5 } },

    { id: 'dose', domain: 'rad', name: 'Daily effective dose', short: 'Dose rate', unit: 'mSv/day', dec: 2, bad: 'up',
      base: [1.1, 0.08], cadence: 1, clamp: [0, 500], src: 'Personal active dosimeter', limits: { monitor: 3, action: 10, urgent: 50 } },
    { id: 'cumdose', domain: 'rad', name: 'Career effective dose', short: 'Career dose', unit: 'mSv', dec: 0, bad: 'up',
      base: null, cadence: 1, derived: true, cumulative: true, window: 1, projectLimit: 540,
      src: 'Integrated dosimetry + prior flight history', limits: { monitor: 360, action: 480, urgent: 570 } },

    { id: 'sleep', domain: 'behav', name: 'Sleep duration', short: 'Sleep', unit: 'h', dec: 1, bad: 'down',
      base: [7.2, 0.45], cadence: 1, clamp: [2, 11], src: 'Actigraphy watch', limits: { monitor: 6, action: 5 } },
    { id: 'sleff', domain: 'behav', name: 'Sleep efficiency', short: 'Sleep efficiency', unit: '%', dec: 0, bad: 'down',
      base: [89, 3], cadence: 1, clamp: [40, 99], src: 'Actigraphy watch', limits: { monitor: 80, action: 70 } },
    { id: 'mood', domain: 'behav', name: 'Mood (self-report)', short: 'Mood', unit: '/10', dec: 1, bad: 'down',
      base: [7.5, 0.8], cadence: 1, onDemand: true, clamp: [1, 10], step: 0.5, src: 'Daily check-in', limits: { monitor: 5, action: 3 } },
    { id: 'stress', domain: 'behav', name: 'Perceived stress (self-report)', short: 'Stress', unit: '/10', dec: 1, bad: 'up',
      base: [3, 0.8], cadence: 1, onDemand: true, clamp: [1, 10], step: 0.5, src: 'Daily check-in', limits: { monitor: 6, action: 8 } },
    { id: 'pvt', domain: 'behav', name: 'Psychomotor vigilance (mean RT)', short: 'PVT reaction', unit: 'ms', dec: 0, bad: 'up',
      base: [255, 14], cadence: 2, onDemand: true, src: 'PVT-B cognitive test', limits: { monitor: 320, action: 380 } },

    { id: 'rnfl', domain: 'sans', name: 'Retinal nerve-fiber layer thickness change', short: 'RNFL Δ (OCT)', unit: 'µm', dec: 1, bad: 'up',
      base: [0, 4], cadence: 14, src: 'On-board optical coherence tomography', limits: { monitor: 15, action: 30 } },
    { id: 'headache', domain: 'sans', name: 'Headache days (rolling 7 days)', short: 'Headache days', unit: 'of 7', dec: 0, bad: 'up',
      base: [0.5, 0.7], useZ: false, cadence: 1, derived: true, window: 1, src: 'Daily check-in', limits: { monitor: 3, action: 5 } },
  ];

  const ENV_INDICATORS = [
    { id: 'co2', name: 'Cabin ppCO₂', short: 'CO₂', unit: 'mmHg', dec: 2, bad: 'up', base: [2.2, 0.15], useZ: false,
      cadence: 1, src: 'Major constituent analyzer', limits: { monitor: 3.0, action: 4.0, urgent: 6.0 } },
    { id: 'ctemp', name: 'Cabin temperature', short: 'Temperature', unit: '°C', dec: 1, bad: 'up', base: [22.4, 0.5], useZ: false,
      cadence: 1, src: 'Thermal control system', limits: { monitor: 26.5, action: 28 } },
    { id: 'rh', name: 'Relative humidity', short: 'Humidity', unit: '%', dec: 0, bad: 'up', base: [46, 3], useZ: false,
      cadence: 1, src: 'Thermal control system', limits: { monitor: 65, action: 75 } },
    { id: 'noise', name: 'Sleep-station noise', short: 'Noise', unit: 'dBA', dec: 0, bad: 'up', base: [52, 1.5], useZ: false,
      cadence: 1, src: 'Acoustic dosimeter', limits: { monitor: 60, action: 65 } },
  ];

  const CREW = [
    { id: 'nakamura', name: 'Ren Nakamura', first: 'Ren', role: 'Flight Engineer', initials: 'RN', priorDose: 38, co2Sens: 0.75, self: true },
    { id: 'reyes', name: 'Alex Reyes', first: 'Alex', role: 'Commander', initials: 'AR', priorDose: 96, co2Sens: 0.2 },
    { id: 'lindqvist', name: 'Dr. Kai Lindqvist', first: 'Kai', role: 'Crew Medical Officer', initials: 'KL', priorDose: 12, co2Sens: 0.2 },
    { id: 'haddad', name: 'Sami Haddad', first: 'Sami', role: 'Mission Specialist', initials: 'SH', priorDose: 0, co2Sens: 0.25 },
  ];

  // Scenario shaping. ramp: linear from 0 at `from` to `delta` at `to`; step: constant from `from`; pulse: decays with tau days.
  const GLOBAL_MODS = {
    dose: [{ shape: 'pulse', from: 131, delta: 24, tau: 0.6 }],
    stress: [{ shape: 'pulse', from: 131, delta: 1.8, tau: 3 }],
    sleep: [{ shape: 'pulse', from: 131, delta: -1.1, tau: 1.5 }],
    sleff: [{ shape: 'pulse', from: 131, delta: -5, tau: 1.5 }],
  };

  const CREW_MODS = {
    nakamura: {
      sleep: [{ shape: 'ramp', from: 118, to: 147, delta: -1.4 }],
      sleff: [{ shape: 'ramp', from: 118, to: 147, delta: -9 }],
      pvt: [{ shape: 'ramp', from: 112, to: 147, delta: 55 }],
      mood: [{ shape: 'ramp', from: 120, to: 147, delta: -1.7 }],
      stress: [{ shape: 'ramp', from: 120, to: 147, delta: 2.4 }],
      exer: [{ shape: 'ramp', from: 126, to: 147, delta: -50 }],
      bmd: [{ shape: 'ramp', from: 105, to: 147, delta: -1.1 }],
      uca: [{ shape: 'ramp', from: 110, to: 147, delta: 55 }],
    },
    reyes: {
      hrv: [{ shape: 'ramp', from: 96, to: 147, delta: -15 }],
      rhr: [{ shape: 'ramp', from: 96, to: 147, delta: 7 }],
      sbp: [{ shape: 'ramp', from: 96, to: 147, delta: 17 }],
    },
    lindqvist: {
      sleep: [{ shape: 'ramp', from: 120, to: 147, delta: -0.3 }],
    },
    haddad: {
      lymph: [{ shape: 'ramp', from: 105, to: 147, delta: -0.85 }],
      vir: [{ shape: 'step', from: 133, delta: 2600, noisy: true }],
      crp: [{ shape: 'ramp', from: 126, to: 147, delta: 2.6 }],
      temp: [{ shape: 'ramp', from: 140, to: 147, delta: 0.5 }],
      mood: [{ shape: 'ramp', from: 125, to: 147, delta: -0.8 }],
    },
  };

  const ENV_MODS = {
    co2: [{ shape: 'ramp', from: 125, to: 129, delta: 1.2 }, { shape: 'step', from: 140, delta: -0.35 }],
  };

  // ---------- helpers ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0, v = 0;
    while (!u) u = r();
    while (!v) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function shapeValue(m, d, n) {
    if (d < m.from) return 0;
    let v;
    if (m.shape === 'ramp') v = m.delta * Math.min(1, (d - m.from) / Math.max(1, m.to - m.from));
    else if (m.shape === 'step') v = m.delta;
    else v = m.delta * Math.exp(-(d - m.from) / (m.tau || 2));
    return m.noisy ? v * (1 + 0.3 * n) : v;
  }
  const modSum = (mods, d, n) => (mods || []).reduce((s, m) => s + shapeValue(m, d, n), 0);
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

  function simulate(ind, mods, rnd, offset, dropout) {
    const D = MISSION.day, arr = new Array(D + 1).fill(null);
    for (let d = 1; d <= D; d++) {
      const n = gauss(rnd), miss = rnd(), extra = rnd();   // always consumed: keeps runs deterministic
      if ((d + offset) % ind.cadence !== 0) continue;
      if (ind.onDemand && d === D) continue;
      if (ind.cadence === 1 && dropout && miss < dropout && d < D - 3) continue;
      let v = ind.base
        ? ind.base[0] + (ind.expected ? ind.expected(d) : 0) + n * ind.base[1] * (ind.noise ?? 0.8)
        : (extra < 0.12 ? 20 + extra * 300 : 0);
      v += modSum(mods, d, n);
      if (ind.clamp) v = Math.min(ind.clamp[1], Math.max(ind.clamp[0], v));
      if (ind.step) v = Math.round(v / ind.step) * ind.step;
      arr[d] = v;
    }
    return arr;
  }

  function simulateEnv() {
    const rnd = mulberry32(42), env = {};
    ENV_INDICATORS.forEach((ind) => { env[ind.id] = simulate(ind, ENV_MODS[ind.id], rnd, 0, 0); });
    return env;
  }

  /*
   * Builds the full dataset and overlays what the astronaut entered on board
   * (check-ins, manual vitals, PVT results).
   */
  function buildDataset(store) {
    const D = MISSION.day;
    const env = simulateEnv();
    const crew = {};

    CREW.forEach((c, ci) => {
      const rnd = mulberry32(1000 + ci * 7919);
      const series = {}, offsets = {};
      INDICATORS.forEach((ind) => {
        offsets[ind.id] = Math.floor(rnd() * ind.cadence);
        if (ind.derived) return;
        const mods = [].concat(GLOBAL_MODS[ind.id] || [], (CREW_MODS[c.id] || {})[ind.id] || []);
        series[ind.id] = simulate(ind, mods, rnd, offsets[ind.id], ind.onDemand ? 0 : 0.03);
      });

      const checkin = ((store.checkins || {})[c.id] || {})[D];
      if (checkin) {
        series.mood[D] = checkin.mood;
        series.stress[D] = checkin.stress;
        const v = checkin.vitals || {};
        if (v.rhr) series.rhr[D] = v.rhr;
        if (v.sbp) series.sbp[D] = v.sbp;
        if (v.temp) series.temp[D] = v.temp;
      }
      const tests = ((store.pvt || {})[c.id] || []).filter((t) => t.day === D);
      if (tests.length) series.pvt[D] = tests[tests.length - 1].mean;

      // Career dose: prior flights + integrated daily dose.
      let cum = c.priorDose;
      series.cumdose = new Array(D + 1).fill(null);
      for (let d = 1; d <= D; d++) { cum += series.dose[d] ?? 1.1; series.cumdose[d] = cum; }

      // Headache: daily occurrence (sensitive to cabin CO₂) → rolling 7-day count.
      const ha = new Array(D + 1).fill(null);
      for (let d = 1; d <= D; d++) {
        const p = 0.05 + c.co2Sens * Math.max(0, (env.co2[d] ?? 2.2) - 2.4);
        ha[d] = rnd() < p ? 1 : 0;
      }
      ha[D] = checkin ? (checkin.symptoms.includes('headache') ? 1 : 0) : null;
      series.headache = new Array(D + 1).fill(null);
      for (let d = 7; d <= D; d++) {
        let s = 0;
        for (let k = d - 6; k <= d; k++) s += ha[k] || 0;
        series.headache[d] = s;
      }

      const doseRate = median(series.dose.slice(D - 30).filter((v) => v != null && v < 3));
      crew[c.id] = { series, offsets, headacheDaily: ha, doseRate };
    });

    return { env, crew };
  }

  function dayToDate(d) {
    const t = new Date(MISSION.startISO + 'T00:00:00Z');
    t.setUTCDate(t.getUTCDate() + d - 1);
    return t;
  }

  Object.assign(H, { MISSION, DOMAINS, INDICATORS, ENV_INDICATORS, CREW, buildDataset, dayToDate });
})(window.H);
