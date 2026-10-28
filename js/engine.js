/*
 * HELIOS — assessment engine.
 * Every indicator is judged against the astronaut's own preflight baseline
 * (z-score), against absolute medical limits, and on its 21-day trend.
 * Rules then combine indicators into explainable findings with actions.
 */
window.H = window.H || {};
(function (H) {
  'use strict';

  const LEVELS = ['nominal', 'monitor', 'action', 'urgent'];
  const LEVEL_LABEL = ['Nominal', 'Monitor', 'Action', 'Urgent'];
  const PENALTY = [0, 4, 10, 25];
  const ESCALATION = ['Self-manage', 'Crew Medical Officer', 'Flight surgeon (next downlink)', 'Immediate crew response'];

  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const crossed = (v, limit, sign) => (sign > 0 ? v >= limit : v <= limit);

  function fmt(v, dec) {
    if (v == null || Number.isNaN(v)) return '—';
    const n = Number(v);
    return Math.abs(n) >= 10000 ? Math.round(n).toLocaleString('en-US') : n.toFixed(dec);
  }

  function regress(pts) {
    const mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
    let num = 0, den = 0;
    pts.forEach(([x, y]) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
    return den ? num / den : 0;
  }

  function assessIndicator(ind, arr, day, ctx) {
    const pts = [];
    for (let d = 1; d <= day; d++) if (arr[d] != null) pts.push([d, arr[d]]);
    const r = { ind, status: 0, reasons: [], pts, trending: false };
    if (!pts.length) { r.noData = true; return r; }

    const sign = ind.bad === 'up' ? 1 : -1;
    const k = ind.window || (ind.cadence <= 2 ? 3 : 1);
    r.current = mean(pts.slice(-k).map((p) => p[1]));
    r.latestDay = pts[pts.length - 1][0];
    r.latest = pts[pts.length - 1][1];

    const centerAt = (d) => (ind.base ? ind.base[0] + (ind.expected ? ind.expected(d) : 0) : null);
    if (ind.base) {
      r.center = centerAt(day);
      r.sd = ind.base[1];
      r.z = (r.current - r.center) / r.sd;
      r.zBad = r.z * sign;
    }
    const useZ = ind.base && ind.useZ !== false;
    const raise = (lvl, msg) => { r.status = Math.max(r.status, lvl); r.reasons.push(msg); };
    const u = ind.unit;

    if (useZ) {
      const label = `${Math.abs(r.z).toFixed(1)} SD ${r.z > 0 ? 'above' : 'below'} your ${ind.expected ? 'expected in-flight trajectory' : 'preflight baseline'}`;
      if (r.zBad >= 3) raise(2, label);
      else if (r.zBad >= 2) raise(1, label);
    }
    const L = ind.limits || {};
    if (L.urgent != null && crossed(r.current, L.urgent, sign)) raise(3, `Beyond urgent limit (${L.urgent} ${u})`);
    else if (L.action != null && crossed(r.current, L.action, sign)) raise(2, `Beyond action limit (${L.action} ${u})`);
    else if (L.monitor != null && crossed(r.current, L.monitor, sign)) raise(1, `Beyond monitoring limit (${L.monitor} ${u})`);

    // Trend over the last 21 days, projected forward.
    if (ind.cumulative) {
      r.horizon = H.MISSION.plannedDays - day;
      r.projected = r.current + (ctx.doseRate || 0) * r.horizon;
      r.slopeWeek = (ctx.doseRate || 0) * 7;
      if (r.status === 0 && r.projected >= ind.projectLimit) {
        r.status = 1; r.trending = true;
        r.reasons.push(`Projected ${fmt(r.projected, 0)} ${u} at mission end — ${Math.round(r.projected / H.MISSION.careerLimit * 100)}% of the career limit`);
      }
    } else {
      const win = pts.filter((p) => p[0] > day - Math.max(21, ind.cadence * 4));
      if (win.length >= 4 && win[win.length - 1][0] - win[0][0] >= 6) {
        const s = regress(win);
        r.slopeWeek = s * 7;
        r.horizon = 14;
        r.projected = r.current + s * r.horizon;
        if (r.status === 0) {
          const zP = useZ ? ((r.projected - centerAt(day + 14)) / r.sd) * sign : -Infinity;
          const limHit = L.monitor != null && crossed(r.projected, L.monitor, sign);
          if (zP >= 3 || limHit) {
            r.status = 1; r.trending = true;
            r.reasons.push(`Trending toward threshold — projected ${fmt(r.projected, ind.dec)} ${u} in 14 days`);
          }
        }
      }
    }

    const expectedN = Math.max(1, Math.floor(14 / ind.cadence));
    r.confidence = Math.min(1, pts.filter((p) => p[0] > day - 14).length / expectedN);
    r.stale = day - r.latestDay > Math.max(2, ind.cadence * 1.5);
    return r;
  }

  function evidence(r) {
    return { id: r.ind.id, label: r.ind.short, value: `${fmt(r.current, r.ind.dec)} ${r.ind.unit}`, note: r.reasons[0] || 'Within range', status: r.status };
  }

  // ---------- rules: indicators → explainable findings ----------
  function buildInsights(inds, env, checkin) {
    const S = (id) => inds[id].status;
    const sym = (s) => !!(checkin && checkin.symptoms.includes(s));
    const co2 = env.co2.current;
    const out = [];
    const add = (o) => out.push(Object.assign({ evidence: [], actions: [] }, o));
    const ev = (...ids) => ids.map((id) => inds[id]).filter((r) => r.status > 0).map(evidence);

    if (S('dose') > 0) {
      add({ id: 'rad-rate', domain: 'rad', level: Math.max(2, S('dose')), title: 'Radiation dose rate elevated',
        summary: 'Your dosimeter is reading well above galactic-cosmic-ray background — consistent with a solar particle event.',
        evidence: ev('dose'), protocol: 'P-RAD-01', escalate: 3,
        actions: ['Go to the storm shelter now', 'Keep your dosimeter on', 'Stay sheltered until the all-clear'] });
    }
    if (S('cumdose') > 0) {
      const r = inds.cumdose;
      add({ id: 'rad-career', domain: 'rad', level: S('cumdose'), title: 'Career radiation dose projection high',
        summary: `At the current rate you will reach ${Math.round(r.projected / H.MISSION.careerLimit * 100)}% of the ${H.MISSION.careerLimit} mSv career limit by mission end.`,
        evidence: ev('cumdose'), protocol: 'P-RAD-02', escalate: 2,
        actions: ['Re-orient your sleep station behind the water wall', 'Trade low-shielding tasks with crewmates', 'Request a dosimetry review'] });
    }

    const slp = Math.max(S('sleep'), S('sleff'), S('pvt'));
    if (slp > 0) {
      const both = S('pvt') > 0 && (S('sleep') > 0 || S('sleff') > 0);
      add({ id: 'sleep', domain: 'behav', level: slp,
        title: both ? 'Sleep loss is slowing your reactions' : S('pvt') > 0 ? 'Reaction time slower than baseline' : 'Sleep below your baseline',
        summary: (both
          ? 'Shorter, more broken sleep over the past weeks lines up with slower PVT reaction times. This raises error risk on demanding tasks.'
          : 'Your recent sleep is outside your personal range.') +
          (co2 >= 2.8 ? ` Cabin CO₂ is ${fmt(co2, 2)} mmHg, which can also disturb sleep.` : ''),
        evidence: ev('sleep', 'sleff', 'pvt'), protocol: 'P-SLP-01', escalate: slp >= 2 ? 1 : 0,
        actions: [
          'Protect an 8.5 h sleep opportunity tonight',
          S('pvt') > 0 ? 'Defer safety-critical tasks until PVT is back to baseline' : 'Use the pre-sleep lighting setting',
          'Repeat the PVT after your next sleep period',
        ] });
    }

    if (S('headache') > 0 || sym('headache')) {
      const high = co2 >= 2.8;
      add({ id: 'headache', domain: 'sans', level: Math.max(1, S('headache')),
        title: high ? 'Headaches coincide with elevated cabin CO₂' : 'Frequent headaches',
        summary: high
          ? `${fmt(inds.headache.current, 0)} headache days in the last week, starting after the scrubber fault. Cabin CO₂ is ${fmt(co2, 2)} mmHg (target < 3.0).`
          : 'Headache frequency is above your usual pattern.',
        evidence: ev('headache').concat(high ? [{ id: 'co2', label: 'Cabin CO₂', value: `${fmt(co2, 2)} mmHg`, note: 'Above 3.0 mmHg target', status: env.co2.status }] : []),
        protocol: 'P-ENV-01', escalate: sym('vision') ? 2 : 1,
        actions: ['Check CO₂ at your sleep station', 'Increase local ventilation', 'Hydrate and log the episode'] });
    }

    const beh = Math.max(S('mood'), S('stress'), sym('isolated') ? 1 : 0);
    if (beh > 0) {
      add({ id: 'behav', domain: 'behav', level: beh, title: 'Mood and stress outside your usual range',
        summary: 'Your self-reports show a sustained shift. This is common on long missions and responds well to early action. These details stay private unless you share them.',
        evidence: ev('mood', 'stress'), protocol: 'P-BHP-01', escalate: beh >= 2 ? 2 : 0, private: true,
        actions: ['Book a private psychological conference', 'Block personal time today', 'Check in with a crewmate'] });
    }

    const bone = Math.max(S('bmd'), S('exer'), S('grip'));
    if (bone > 0) {
      add({ id: 'bone', domain: 'msk', level: bone,
        title: S('bmd') > 0 ? 'Bone loss ahead of expected trajectory' : 'Exercise below prescription',
        summary: S('bmd') > 0 && S('exer') > 0
          ? 'Countermeasure exercise has dropped for three weeks and estimated hip bone loss is now faster than the expected in-flight curve.'
          : 'Countermeasures are the main protection against bone and muscle loss in microgravity.',
        evidence: ev('bmd', 'exer', 'grip'), protocol: 'P-MSK-01', escalate: bone >= 2 ? 1 : 0,
        actions: ['Restore ~2 h/day of countermeasure exercise', 'Prioritize heavy squats and deadlifts', 'Ask the commander to protect exercise time'] });
    }

    if (S('uca') > 0) {
      add({ id: 'renal', domain: 'msk', level: S('uca'), title: 'Kidney-stone risk rising',
        summary: 'Calcium released from bone is being excreted in urine, which raises kidney-stone risk.',
        evidence: ev('uca'), protocol: 'P-REN-01', escalate: 1,
        actions: ['Drink at least 2.5 L/day', 'Limit sodium', 'Repeat urine sample in 3 days'] });
    }

    const imm = Math.max(S('lymph'), S('crp'), S('vir'));
    if (imm > 0) {
      add({ id: 'immune', domain: 'immune', level: imm,
        title: S('vir') > 0 ? 'Latent virus reactivation detected' : 'Immune markers changing',
        summary: S('vir') > 0
          ? 'Viral DNA in saliva together with falling lymphocytes points to immune suppression. Usually symptom-free, but shingles is a risk.'
          : 'Blood markers show a shift in immune status.',
        evidence: ev('lymph', 'crp', 'vir'), protocol: 'P-IMM-01', escalate: imm >= 2 ? 2 : 1,
        actions: ['Repeat saliva and blood samples within 72 h', 'Check skin daily for rash', 'Use separate utensils'] });
    }

    if (S('temp') > 0 || sym('fever')) {
      add({ id: 'fever', domain: 'immune', level: Math.max(1, S('temp')), title: 'Temperature raised',
        summary: 'Core temperature or symptoms suggest a possible infection.',
        evidence: ev('temp'), protocol: 'P-IMM-01', escalate: 1,
        actions: ['Re-measure in 1 hour', 'Rest and hydrate', 'Tell the CMO'] });
    }

    const cv = Math.max(S('rhr'), S('hrv'), S('sbp'), sym('dizzy') ? 1 : 0, sym('chest') ? 3 : 0);
    if (cv > 0) {
      add({ id: 'cardio', domain: 'cardio', level: cv,
        title: sym('chest') ? 'Chest pain reported' : 'Cardiovascular strain indicators',
        summary: sym('chest')
          ? 'Chest pain needs immediate assessment by the CMO.'
          : 'Higher resting heart rate and blood pressure with lower HRV over several weeks suggest cardiovascular strain or deconditioning.' +
            (sym('dizzy') ? ' Dizziness on standing/moving is reported.' : ''),
        evidence: ev('rhr', 'hrv', 'sbp'), protocol: 'P-CV-01', escalate: sym('chest') ? 3 : cv >= 2 ? 2 : 1,
        actions: sym('chest')
          ? ['Stop activity and notify the CMO now', 'Record a 12-lead ECG', 'Prepare for a medical conference with ground']
          : ['Record a 5-min resting ECG', 'Measure BP twice daily for 3 days', 'Keep aerobic work moderate'] });
    }

    const sans = Math.max(S('rnfl'), sym('vision') ? 2 : 0);
    if (sans > 0) {
      add({ id: 'sans', domain: 'sans', level: sans, title: 'Possible neuro-ocular change (SANS)',
        summary: 'Vision change or retinal thickening can be early signs of spaceflight-associated neuro-ocular syndrome.',
        evidence: ev('rnfl'), protocol: 'P-SANS-01', escalate: 2,
        actions: ['Do the near-acuity and Amsler grid tests', 'Book OCT with the CMO', 'Send images at next downlink'] });
    }

    return out.sort((a, b) => b.level - a.level);
  }

  function assessEnv(ds) {
    const env = {};
    H.ENV_INDICATORS.forEach((ind) => { env[ind.id] = assessIndicator(ind, ds.env[ind.id], H.MISSION.day, {}); });
    return env;
  }

  function assessCrew(c, ds, checkin) {
    const day = H.MISSION.day, cd = ds.crew[c.id];
    const inds = {};
    H.INDICATORS.forEach((ind) => { inds[ind.id] = assessIndicator(ind, cd.series[ind.id], day, cd); });
    const env = assessEnv(ds);

    const domains = H.DOMAINS.map((dm) => {
      const list = H.INDICATORS.filter((i) => i.domain === dm.id).map((i) => inds[i.id]);
      return Object.assign({}, dm, {
        list,
        status: Math.max(...list.map((x) => x.status)),
        penalty: Math.min(25, list.reduce((s, x) => s + PENALTY[x.status], 0)),
      });
    });

    const insights = buildInsights(inds, env, checkin);
    // Symptom-driven findings can raise a domain above what the sensors alone show.
    insights.forEach((ins) => {
      const d = domains.find((x) => x.id === ins.domain);
      if (d && ins.level > d.status) { d.status = ins.level; d.penalty = Math.max(d.penalty, PENALTY[ins.level]); }
    });

    const readiness = Math.max(0, Math.round(100 - domains.reduce((s, d) => s + d.penalty, 0)));
    return { crew: c, inds, env, domains, insights, readiness, overall: Math.max(...domains.map((d) => d.status)) };
  }

  Object.assign(H, { LEVELS, LEVEL_LABEL, ESCALATION, fmt, assessIndicator, assessCrew, assessEnv });
})(window.H);
