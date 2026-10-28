#!/usr/bin/env node
/*
 * HELIOS — validation on real astronaut data.
 *
 * Data: SpaceX Inspiration4 crew (4 people), NASA Open Science Data Repository
 *   OSD-569 complete blood count, OSD-575 metabolic panel + serum cardiovascular and immune panels.
 *   Blood drawn at L-92, L-44, L-3 (preflight) and R+1, R+45, R+82, R+194 (post-flight).
 *
 * Task: using only each person's own preflight draws as their baseline, single out the
 *   R+1 sample (body still in the spaceflight state) from samples where the body is at
 *   its normal state (recovery draws R+45/R+82/R+194, plus each preflight draw scored
 *   against the other two). 4 positives, 24 negatives.
 *
 * Every method is scored leave-one-crew-out: the held-out person's data is never used
 *   to fit SDs, select features, train weights or pick thresholds.
 *
 * Usage: node tools/evaluate.js   → writes data/validation.json and js/validation-data.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'data', 'osdr');
const PRE = ['L-92', 'L-44', 'L-3'];
const POST = ['R+1', 'R+45', 'R+82', 'R+194'];
const TIMEPOINTS = PRE.concat(POST);

// ---------- loading ----------
function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const split = (l) => {
    const out = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

const PANELS = [
  { id: 'cbc', file: 'cbc.csv', label: 'Complete blood count', osd: 'OSD-569', a: 'ANALYTE', v: 'VALUE', s: 'SUBJECT_ID', t: 'TEST_DATE', log: false },
  { id: 'cmp', file: 'cmp.csv', label: 'Comprehensive metabolic panel', osd: 'OSD-575', a: 'ANALYTE', v: 'VALUE', s: 'SUBJECT_ID', t: 'timepoint', log: false },
  { id: 'cardio', file: 'cardio.csv', label: 'Serum cardiovascular panel', osd: 'OSD-575', a: 'Analyte', v: 'Concentration', s: 'ID', t: 'Timepoint', log: true },
  { id: 'immune', file: 'immune.csv', label: 'Serum immune (cytokine) panel', osd: 'OSD-575', a: 'Analyte', v: 'Concentration', s: 'ID', t: 'Timepoint', log: true },
];
const DROP = new Set(['cmp:eGFR AFRICAN AMERICAN', 'cmp:BUN/CREATININE RATIO']);

function load() {
  const val = {};       // feature → subject → timepoint → value
  const range = {};     // feature → [min, max] clinical reference range
  const meta = {};      // feature → {panel, name, unit}
  for (const p of PANELS) {
    for (const r of parseCsv(path.join(RAW, p.file))) {
      const name = r[p.a].replace(/ \(FEMALE\)$/, '');
      const f = `${p.id}:${name}`;
      if (DROP.has(f)) continue;
      let x = parseFloat(r[p.v]);
      if (!Number.isFinite(x)) continue;
      if (p.log) x = Math.log10(Math.max(x, 0) + 1);
      ((val[f] = val[f] || {})[r[p.s]] = val[f][r[p.s]] || {})[r[p.t]] = x;
      meta[f] = { panel: p.id, name, unit: p.log ? `log10(${r.Unit})` : r.UNITS };
      const lo = parseFloat(r.RANGE_MIN), hi = parseFloat(r.RANGE_MAX);
      if (!p.log && (Number.isFinite(lo) || Number.isFinite(hi))) range[f] = [Number.isFinite(lo) ? lo : -Infinity, Number.isFinite(hi) ? hi : Infinity];
    }
  }
  const subjects = ['C001', 'C002', 'C003', 'C004'];
  // Keep features measured for every subject at every timepoint.
  const features = Object.keys(val).filter((f) => subjects.every((s) => TIMEPOINTS.every((t) => val[f][s] && Number.isFinite(val[f][s][t]))));
  return { val, range, meta, subjects, features };
}

// ---------- maths ----------
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function auroc(scores, labels) {
  let pos = 0, neg = 0, wins = 0;
  scores.forEach((si, i) => {
    if (!labels[i]) return;
    pos++;
    scores.forEach((sj, j) => { if (labels[j]) return; wins += si > sj ? 1 : si === sj ? 0.5 : 0; });
  });
  neg = labels.length - pos;
  return wins / (pos * neg);
}
// Mulberry32 so the permutation test is reproducible.
function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function permutationP(scores, labels, observed, n = 20000) {
  const r = rng(7); let hit = 0; const lab = labels.slice();
  for (let k = 0; k < n; k++) {
    for (let i = lab.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [lab[i], lab[j]] = [lab[j], lab[i]]; }
    if (auroc(scores, lab) >= observed - 1e-12) hit++;
  }
  return (hit + 1) / (n + 1);
}

// ---------- personal-baseline features ----------
/*
 * Within-person SD per feature, pooled over the preflight draws of the training crew.
 * Three draws per person are too few for a stable personal SD, so HELIOS borrows the
 * spread from other astronauts while keeping each person's own mean.
 */
function pooledSD(D, f, crew) {
  let ss = 0, df = 0;
  crew.forEach((s) => {
    const xs = PRE.map((t) => D.val[f][s][t]), m = mean(xs);
    xs.forEach((x) => { ss += (x - m) ** 2; });
    df += xs.length - 1;
  });
  return Math.sqrt(ss / df) || 1e-9;
}

/*
 * Samples to score for one subject. Post-flight draws are compared with all three preflight
 * draws; each preflight draw is compared with the other two (a realistic false-alarm check).
 */
function samplesFor(D, s, sd, cfg) {
  const out = [];
  // With cfg.correct, the SD is inflated by sqrt(1 + 1/n) for the uncertainty of an n-draw
  // baseline mean, so samples compared with 2 draws and with 3 draws are on the same scale.
  const z = (t, base) => D.features.map((f, k) => (D.val[f][s][t] - mean(base.map((b) => D.val[f][s][b]))) /
    (sd[k] * (cfg.correct ? Math.sqrt(1 + 1 / base.length) : 1)));
  POST.forEach((t) => out.push({ subject: s, t, label: t === 'R+1' ? 1 : 0, z: z(t, PRE) }));
  PRE.forEach((t) => out.push({ subject: s, t, label: 0, z: z(t, PRE.filter((x) => x !== t)) }));
  return out;
}

// ---------- methods ----------
// Each method: fit(trainSamples, ctx) → score(sample) → number (higher = more abnormal).
const METHODS = [
  {
    id: 'refrange', name: 'Clinical reference ranges', kind: 'Standard of care',
    desc: 'Counts CBC/metabolic results outside the lab\'s normal range. No personal baseline.',
    fit: (train, ctx) => (smp) => {
      const s = smp.subject, D = ctx.D;
      return D.features.reduce((n, f) => {
        const r = D.range[f]; if (!r) return n;
        const x = D.val[f][s][smp.t];
        return n + (x < r[0] || x > r[1] ? 1 : 0);
      }, 0);
    },
  },
  {
    id: 'rules', name: 'HELIOS rules (personal baseline)', kind: 'Rule-based',
    desc: 'Current HELIOS logic: counts results 3+ SD away from the person\'s own preflight baseline (the "Action" threshold).',
    fit: () => (smp) => smp.z.filter((v) => Math.abs(v) >= 3).length + 1e-3 * mean(smp.z.map(Math.abs)),
  },
  {
    id: 'anomaly', name: 'Unsupervised anomaly score', kind: 'ML · unsupervised',
    desc: 'Mean of the 10% largest |z| deviations from personal baseline. Needs no labelled examples.',
    fit: () => (smp) => { const a = smp.z.map(Math.abs).sort((x, y) => y - x); return mean(a.slice(0, Math.max(1, Math.round(a.length * 0.1)))); },
  },
  {
    id: 'signature', name: 'Spaceflight-signature model', kind: 'ML · supervised',
    desc: 'Learns the average deviation pattern of R+1 vs. normal samples on the training crew (top 20 features by t-statistic), then scores how strongly a new sample shows that pattern.',
    fit: (train, ctx = {}) => {
      const k = Math.min(ctx.k || 20, train[0].z.length);
      const P = train.filter((x) => x.label), N = train.filter((x) => !x.label);
      const p = train[0].z.length;
      const stats = [];
      for (let j = 0; j < p; j++) {
        const a = P.map((x) => x.z[j]), b = N.map((x) => x.z[j]);
        const ma = mean(a), mb = mean(b);
        const va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / Math.max(1, a.length - 1);
        const vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / Math.max(1, b.length - 1);
        stats.push({ j, t: (ma - mb) / Math.sqrt(va / a.length + vb / b.length + 1e-9), w: ma - mb });
      }
      const sel = stats.sort((x, y) => Math.abs(y.t) - Math.abs(x.t)).slice(0, k);
      const fn = (smp) => sel.reduce((s, f) => s + Math.sign(f.w) * Math.max(-6, Math.min(6, smp.z[f.j])), 0) / k;
      fn.selected = sel.map((f) => f.j);
      return fn;
    },
  },
  {
    id: 'logreg', name: 'Logistic regression (L2)', kind: 'ML · supervised',
    desc: 'L2-regularised logistic regression on the 20 most discriminative personal-baseline z-scores, trained on the other three crew.',
    fit: (train, ctx = {}) => {
      const k = Math.min(ctx.k || 20, train[0].z.length), lambda = 1.0, P = train.filter((x) => x.label), N = train.filter((x) => !x.label);
      const p = train[0].z.length, stats = [];
      for (let j = 0; j < p; j++) {
        const a = P.map((x) => x.z[j]), b = N.map((x) => x.z[j]);
        const ma = mean(a), mb = mean(b);
        const va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / Math.max(1, a.length - 1);
        const vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / Math.max(1, b.length - 1);
        stats.push({ j, t: (ma - mb) / Math.sqrt(va / a.length + vb / b.length + 1e-9) });
      }
      const sel = stats.sort((x, y) => Math.abs(y.t) - Math.abs(x.t)).slice(0, k).map((s) => s.j);
      const X = train.map((x) => sel.map((j) => Math.max(-6, Math.min(6, x.z[j]))));
      const y = train.map((x) => x.label);
      // Class-balanced weights: 3 positives vs 18 negatives in each training fold.
      const wPos = y.length / (2 * P.length), wNeg = y.length / (2 * N.length);
      let w = new Array(k).fill(0), b = 0;
      for (let it = 0; it < 3000; it++) {
        const gw = w.map((v) => lambda * v), lr = 0.05; let gb = 0;
        X.forEach((xi, i) => {
          const pr = 1 / (1 + Math.exp(-(b + xi.reduce((s, v, j) => s + v * w[j], 0))));
          const e = (pr - y[i]) * (y[i] ? wPos : wNeg);
          xi.forEach((v, j) => { gw[j] += e * v; });
          gb += e;
        });
        w = w.map((v, j) => v - lr * gw[j] / X.length);
        b -= lr * gb / X.length;
      }
      return (smp) => b + sel.reduce((s, j, i) => s + Math.max(-6, Math.min(6, smp.z[j])) * w[i], 0);
    },
  },
];

// ---------- evaluation ----------
function evaluate(cfg) {
  const D = load();
  D.features = D.features.filter((f) => cfg.panels.includes(D.meta[f].panel));
  const results = [];
  for (const m of METHODS) {
    const rows = [];
    for (const held of D.subjects) {
      const trainCrew = D.subjects.filter((s) => s !== held);
      const sd = D.features.map((f) => pooledSD(D, f, trainCrew));
      const train = trainCrew.flatMap((s) => samplesFor(D, s, sd, cfg));
      const score = m.fit(train, { D });
      // Threshold from the training crew only: midway between the highest-scoring normal
      // sample and the lowest-scoring R+1 sample (or their means if they overlap).
      const tr = train.map((x) => ({ s: score(x), y: x.label }));
      const minPos = Math.min(...tr.filter((x) => x.y).map((x) => x.s));
      const maxNeg = Math.max(...tr.filter((x) => !x.y).map((x) => x.s));
      const thr = minPos > maxNeg ? (minPos + maxNeg) / 2
        : (mean(tr.filter((x) => x.y).map((x) => x.s)) + mean(tr.filter((x) => !x.y).map((x) => x.s))) / 2;
      samplesFor(D, held, sd, cfg).forEach((x) => rows.push({ subject: held, t: x.t, label: x.label, score: score(x), flagged: score(x) > thr }));
    }
    const scores = rows.map((r) => r.score), labels = rows.map((r) => r.label);
    const auc = auroc(scores, labels);
    const tp = rows.filter((r) => r.label && r.flagged).length, fn = rows.filter((r) => r.label && !r.flagged).length;
    const tn = rows.filter((r) => !r.label && !r.flagged).length, fp = rows.filter((r) => !r.label && r.flagged).length;
    // Per crew member: is R+1 the most abnormal of their four post-flight draws?
    const top1 = D.subjects.filter((s) => {
      const post = rows.filter((r) => r.subject === s && POST.includes(r.t));
      return post.slice().sort((a, b) => b.score - a.score)[0].t === 'R+1';
    }).length;
    const postRows = rows.filter((r) => POST.includes(r.t));
    results.push({
      id: m.id, name: m.name, kind: m.kind, desc: m.desc,
      auroc: +auc.toFixed(3), aurocPostOnly: +auroc(postRows.map((r) => r.score), postRows.map((r) => r.label)).toFixed(3),
      pValue: +permutationP(scores, labels, auc).toFixed(4),
      sensitivity: +(tp / (tp + fn)).toFixed(3), specificity: +(tn / (tn + fp)).toFixed(3),
      accuracy: +((tp + tn) / rows.length).toFixed(3), confusion: { tp, fn, tn, fp },
      top1, crew: D.subjects.length,
      rows: rows.map((r) => ({ subject: r.subject, t: r.t, label: r.label, score: +r.score.toFixed(3), flagged: r.flagged })),
    });
  }

  // Which measurements move most at R+1 (all crew, descriptive only — not used for scoring).
  const sdAll = D.features.map((f) => pooledSD(D, f, D.subjects));
  const all = D.subjects.flatMap((s) => samplesFor(D, s, sdAll, cfg));
  const r1 = all.filter((x) => x.label), rest = all.filter((x) => !x.label);
  const markers = D.features.map((f, j) => {
    const a = r1.map((x) => x.z[j]);
    return { feature: f, name: D.meta[f].name, panel: D.meta[f].panel, meanZ: mean(a), sameDir: a.filter((v) => Math.sign(v) === Math.sign(mean(a))).length, restAbs: mean(rest.map((x) => Math.abs(x.z[j]))) };
  }).sort((a, b) => Math.abs(b.meanZ) - Math.abs(a.meanZ)).slice(0, 12)
    .map((x) => ({ ...x, meanZ: +x.meanZ.toFixed(2), restAbs: +x.restAbs.toFixed(2) }));

  return {
    config: cfg,
    generated: new Date().toISOString().slice(0, 10),
    dataset: {
      name: 'SpaceX Inspiration4 (2021, 3-day orbital flight)',
      source: 'NASA Open Science Data Repository',
      studies: PANELS.map((p) => ({ id: p.id, label: p.label, osd: p.osd })),
      crew: D.subjects.length, timepoints: TIMEPOINTS, features: D.features.length,
      byPanel: Object.fromEntries(PANELS.map((p) => [p.id, D.features.filter((f) => D.meta[f].panel === p.id).length])),
      positives: 4, negatives: 24,
    },
    protocol: 'Leave-one-crew-out. Positive = R+1 draw. Negatives = R+45, R+82, R+194 draws plus each preflight draw scored against the other two.',
    results, markers,
  };
}

/*
 * Configurations, in the order they were run. Run 1 was fixed before seeing any results;
 * runs 2–3 were added after it, so their scores carry some selection optimism.
 */
const CONFIGS = [
  { id: 'run1', label: 'Run 1 · all panels, no correction (pre-specified)', panels: ['cbc', 'cmp', 'cardio', 'immune'], correct: false },
  { id: 'run2', label: 'Run 2 · all panels, baseline-size correction', panels: ['cbc', 'cmp', 'cardio', 'immune'], correct: true },
  { id: 'run3', label: 'Run 3 · clinical panels (CBC + CMP), baseline-size correction', panels: ['cbc', 'cmp'], correct: true },
];

const runs = CONFIGS.map(evaluate);

/*
 * Nested leave-one-crew-out model search. For each held-out astronaut, every candidate
 * configuration (panels × model × number of features) is scored by an inner leave-one-crew-out
 * loop over the remaining three; the winner is retrained on those three and only then applied
 * to the held-out person. The outer score is therefore an honest estimate of the whole search.
 */
function nested() {
  const base = load();
  const PANELSETS = { clinical: ['cbc', 'cmp'], 'clinical+cardio': ['cbc', 'cmp', 'cardio'], all: ['cbc', 'cmp', 'cardio', 'immune'] };
  const grid = [];
  for (const ps of Object.keys(PANELSETS)) for (const mid of ['signature', 'logreg']) for (const k of [5, 10, 20, 40]) grid.push({ ps, mid, k });
  const view = (ps) => ({ ...base, features: base.features.filter((f) => PANELSETS[ps].includes(base.meta[f].panel)) });
  const views = Object.fromEntries(Object.keys(PANELSETS).map((ps) => [ps, view(ps)]));
  const cfg = { correct: true };
  const method = (id) => METHODS.find((m) => m.id === id);

  // Train on `trainCrew`, return scored samples for `testCrew`.
  function trainAndScore(c, trainCrew, testCrew) {
    const D = views[c.ps];
    const sd = D.features.map((f) => pooledSD(D, f, trainCrew));
    const train = trainCrew.flatMap((s) => samplesFor(D, s, sd, cfg));
    const score = method(c.mid).fit(train, { D, k: c.k });
    return testCrew.flatMap((s) => samplesFor(D, s, sd, cfg).map((x) => ({ subject: s, t: x.t, label: x.label, score: score(x) })));
  }

  // Ensemble: rank-average all configurations (no selection step, so nothing to overfit).
  const ens = [];
  for (const held of base.subjects) {
    const T = base.subjects.filter((s) => s !== held);
    const per = grid.map((c) => trainAndScore(c, T, [held]));
    per[0].forEach((r, i) => {
      // Rank each config's scores within this person so scales are comparable.
      const rk = per.map((list) => list.filter((x) => x.score < list[i].score).length / (list.length - 1));
      ens.push({ ...r, score: mean(rk) });
    });
  }
  const ensPost = ens.filter((r) => POST.includes(r.t));
  const ensAuc = auroc(ens.map((r) => r.score), ens.map((r) => r.label));
  const ensemble = {
    auroc: +ensAuc.toFixed(3), aurocPostOnly: +auroc(ensPost.map((r) => r.score), ensPost.map((r) => r.label)).toFixed(3),
    pValue: +permutationP(ens.map((r) => r.score), ens.map((r) => r.label), ensAuc).toFixed(4),
    top1: base.subjects.filter((s) => ens.filter((r) => r.subject === s && POST.includes(r.t)).sort((a, b) => b.score - a.score)[0].t === 'R+1').length,
    rows: ens.map((r) => ({ ...r, score: +r.score.toFixed(3) })),
  };

  const rows = [], chosen = [];
  for (const held of base.subjects) {
    const T = base.subjects.filter((s) => s !== held);
    let best = null;
    for (const c of grid) {
      const inner = T.flatMap((t) => trainAndScore(c, T.filter((x) => x !== t), [t]));
      const a = auroc(inner.map((r) => r.score), inner.map((r) => r.label));
      if (!best || a > best.a + 1e-9 || (Math.abs(a - best.a) < 1e-9 && c.k < best.c.k)) best = { c, a };
    }
    chosen.push({ heldOut: held, ...best.c, innerAuroc: +best.a.toFixed(3) });
    trainAndScore(best.c, T, [held]).forEach((r) => rows.push(r));
  }
  const scores = rows.map((r) => r.score), labels = rows.map((r) => r.label);
  const auc = auroc(scores, labels);
  const post = rows.filter((r) => POST.includes(r.t));
  const top1 = base.subjects.filter((s) => rows.filter((r) => r.subject === s && POST.includes(r.t)).sort((a, b) => b.score - a.score)[0].t === 'R+1').length;
  // Per-person calibration: compare each post-flight score with that person's own preflight scores.
  // Flag when it exceeds every preflight score — needs no threshold transferred between people.
  const flags = base.subjects.flatMap((s) => {
    const mine = rows.filter((r) => r.subject === s), preMax = Math.max(...mine.filter((r) => PRE.includes(r.t)).map((r) => r.score));
    return mine.filter((r) => POST.includes(r.t)).map((r) => ({ ...r, flagged: r.score > preMax }));
  });
  const tp = flags.filter((r) => r.label && r.flagged).length, fp = flags.filter((r) => !r.label && r.flagged).length;
  return {
    grid: grid.length, chosen, ensemble,
    auroc: +auc.toFixed(3), aurocPostOnly: +auroc(post.map((r) => r.score), post.map((r) => r.label)).toFixed(3),
    pValue: +permutationP(scores, labels, auc).toFixed(4), top1, crew: base.subjects.length,
    personal: { sensitivity: +(tp / 4).toFixed(3), specificity: +((12 - fp) / 12).toFixed(3), tp, fp, note: 'Post-flight draw flagged when it scores above all of that person\'s own preflight draws.' },
    rows: rows.map((r) => ({ ...r, score: +r.score.toFixed(3) })),
  };
}

const nestedResult = nested();
const out = { generated: runs[0].generated, dataset: runs[0].dataset, protocol: runs[0].protocol, runs, nested: nestedResult };
fs.writeFileSync(path.join(ROOT, 'data', 'validation.json'), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(ROOT, 'js', 'validation-data.js'),
  '/* Generated by tools/evaluate.js from NASA OSDR Inspiration4 data. Do not edit. */\nwindow.H = window.H || {};\nwindow.H.VALIDATION = ' + JSON.stringify(out) + ';\n');

runs.forEach((r) => {
  console.log(`\n${r.config.label} — ${r.dataset.features} features`);
  console.log('  ' + 'Method'.padEnd(36), 'AUROC  post   p      Sens   Spec   Top-1');
  r.results.forEach((m) => console.log('  ' + m.name.padEnd(36), [m.auroc, m.aurocPostOnly, m.pValue, m.sensitivity, m.specificity].map((x) => String(x).padEnd(6)).join(' '), `${m.top1}/${m.crew}`));
});
console.log(`\nNested model search (${nestedResult.grid} configs): AUROC ${nestedResult.auroc} (post-only ${nestedResult.aurocPostOnly}, p ${nestedResult.pValue}), R+1 first ${nestedResult.top1}/4, personal flag sens ${nestedResult.personal.sensitivity} spec ${nestedResult.personal.specificity}`);
console.log(`Ensemble of all ${nestedResult.grid}: AUROC ${nestedResult.ensemble.auroc} (post-only ${nestedResult.ensemble.aurocPostOnly}, p ${nestedResult.ensemble.pValue}), R+1 first ${nestedResult.ensemble.top1}/4`);
nestedResult.chosen.forEach((c) => console.log('  held out', c.heldOut, '→', c.ps, c.mid, 'k=' + c.k, 'inner AUROC', c.innerAuroc));
console.log('\nLargest R+1 shifts (run 3):'); runs[2].markers.forEach((m) => console.log(' ', m.feature.padEnd(36), m.meanZ, `${m.sameDir}/4 same direction`));
