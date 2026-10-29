/*
 * HELIOS — weekly (multi-week) trend detection.
 * A second detection system that runs alongside the daily engine. It rolls daily readings up into
 * mission weeks and looks for slow change that day-to-day noise hides:
 *   · Mann–Kendall test (non-parametric, robust to outliers): is there a consistent monotonic trend
 *     over the last 4–8 weeks?
 *   · Sen's slope: how fast, per week — and how many weeks until a medical limit at that rate?
 *   · One-sided CUSUM on weekly means vs the person's own baseline: has there been a small but
 *     persistent shift, and in which week did it start?
 */
window.H = window.H || {};
(function (H) {
  'use strict';

  const MAX_WEEKS = 8, MIN_WEEKS = 4, MIN_DAYS = 3;      // a week needs ≥3 readings (daily indicators)
  // α = 0.01: ~24 indicators are tested per person, so 0.05 would flag one by chance most weeks.
  const ALPHA = 0.01, CUSUM_K = 0.5, CUSUM_H = 5, Z_CAP = 3;
  const PRACTICAL = 0.5;                                  // a drift must total ≥ 0.5 SD to matter

  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
  // Standard normal CDF (Abramowitz–Stegun 7.1.26 erf approximation, |error| < 1.5e-7).
  function phi(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }

  // Mann–Kendall with tie correction. Returns S, Z and one-sided p-values for up / down trends.
  function mannKendall(xs) {
    const n = xs.length;
    let S = 0;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) S += Math.sign(xs[j] - xs[i]);
    const ties = {};
    xs.forEach((x) => { const k = x.toFixed(9); ties[k] = (ties[k] || 0) + 1; });
    const tieTerm = Object.values(ties).reduce((s, t) => s + t * (t - 1) * (2 * t + 5), 0);
    const v = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
    const Z = v > 0 ? (S > 0 ? (S - 1) / Math.sqrt(v) : S < 0 ? (S + 1) / Math.sqrt(v) : 0) : 0;
    return { S, Z, pUp: 1 - phi(Z), pDown: phi(Z), n };
  }

  // Sen's slope over (x, y) pairs: median of pairwise slopes.
  function senSlope(pts) {
    const s = [];
    for (let i = 0; i < pts.length - 1; i++) for (let j = i + 1; j < pts.length; j++) if (pts[j][0] !== pts[i][0]) s.push((pts[j][1] - pts[i][1]) / (pts[j][0] - pts[i][0]));
    if (!s.length) return null;
    const m = median(s);
    const icept = median(pts.map(([x, y]) => y - m * x));
    return { slope: m, intercept: icept };
  }

  // Mission weeks: week w covers days 7(w−1)+1 … 7w.
  const weekOf = (d) => Math.floor((d - 1) / 7) + 1;

  function weeklyMeans(arr, day, cadence) {
    const lastFull = weekOf(day) - (day % 7 === 0 ? 0 : 1);
    const need = cadence <= 2 ? MIN_DAYS : 1;
    const out = [];
    for (let w = Math.max(1, lastFull - MAX_WEEKS - 12); w <= lastFull; w++) {
      const vals = [];
      for (let d = 7 * (w - 1) + 1; d <= 7 * w; d++) if (arr[d] != null) vals.push(arr[d]);
      if (vals.length >= need) out.push({ w, mean: mean(vals), n: vals.length, mid: 7 * (w - 1) + 4 });
    }
    return { weeks: out, lastFull };
  }

  /*
   * ind: indicator; arr: daily series; base: { mean, sd } personal baseline (or null);
   * day: today (mission day). Only complete weeks are judged.
   */
  function analyze(ind, arr, base, day) {
    const sign = ind.bad === 'up' ? 1 : -1;
    const { weeks: all, lastFull } = weeklyMeans(arr, day, ind.cadence);
    const recent = all.filter((x) => x.w > lastFull - MAX_WEEKS);
    const r = { ind, weeks: recent, history: all, lastFull, status: 'insufficient', level: 0, reasons: [] };
    // Cumulative totals (career dose) always rise; trend tests do not apply to them.
    if (ind.cumulative) { r.status = 'na'; r.reasons.push('Cumulative total — judged against its limit by the daily system.'); return r; }
    if (recent.length < MIN_WEEKS) { r.reasons.push(`Needs ${MIN_WEEKS} weeks with data (has ${recent.length}).`); return r; }

    const sd = base && base.sd ? base.sd : (ind.base ? ind.base[1] : null);
    const center = (d) => (base && base.mean != null ? base.mean : ind.base ? ind.base[0] : null) + (ind.expected ? ind.expected(d) : 0);

    // Detrend indicators with an expected in-flight trajectory (e.g. bone loss) before testing.
    const ys = recent.map((x) => (ind.expected ? x.mean - ind.expected(x.mid) : x.mean));
    const mk = mannKendall(ys);
    const sen = senSlope(recent.map((x, i) => [x.w, ys[i]]));
    r.mk = mk; r.slope = sen ? sen.slope : 0; r.intercept = sen ? sen.intercept : 0;
    r.current = recent[recent.length - 1].mean;
    const totalChange = r.slope * (recent[recent.length - 1].w - recent[0].w);
    r.changeSD = sd ? (totalChange * sign) / sd : null;
    const pBad = sign > 0 ? mk.pUp : mk.pDown, pGood = sign > 0 ? mk.pDown : mk.pUp;
    r.p = Math.min(pBad, pGood);

    // CUSUM in the unhealthy direction on standardised weekly means.
    if (sd && center(1) != null && Number.isFinite(center(1))) {
      let C = 0, alarm = null, R = 0, minR = 0, minAt = null;
      r.cusum = all.map((x) => {
        // Rolling-window indicators (e.g. headache days per 7) are already averaged: no √n gain.
        const se = ind.window === 1 ? sd : sd / Math.sqrt(Math.min(x.n, 7));
        // Winsorised: one extreme week (a solar storm, a sick day) cannot fake a persistent shift.
        const z = Math.max(-Z_CAP, Math.min(Z_CAP, (sign * (x.mean - center(x.mid))) / se));
        C = Math.max(0, C + z - CUSUM_K);
        // Change point (Page): the shift began just after the unbounded cumulative sum was lowest.
        R += z - CUSUM_K;
        if (alarm == null && R <= minR) { minR = R; minAt = x.w; }
        if (alarm == null && C >= CUSUM_H) {
          const after = all.find((y) => y.w > (minAt == null ? 0 : minAt));
          alarm = { week: x.w, since: after ? after.w : x.w };
        }
        return { w: x.w, C };
      });
      if (alarm && r.cusum[r.cusum.length - 1].C >= CUSUM_H) r.shift = alarm;
    }

    // Weeks until the monitoring limit at the current rate (only when moving toward it).
    const L = ind.limits && (ind.limits.monitor != null ? ind.limits.monitor : ind.limits.action);
    if (L != null && r.slope && Math.sign(r.slope) === sign) {
      const gap = (L - r.current) * sign;
      r.weeksToLimit = gap > 0 ? gap / Math.abs(r.slope) : 0;
    }

    const practical = r.changeSD == null || Math.abs(r.changeSD) >= PRACTICAL;
    if (r.shift) {
      r.status = 'shift'; r.level = 2;
      r.reasons.push(`Persistent shift from your baseline since week ${r.shift.since} (CUSUM).`);
    } else if (pBad < ALPHA && practical) {
      r.status = 'drift'; r.level = 1;
      r.reasons.push(`Consistent ${sign > 0 ? 'rise' : 'fall'} over ${recent.length} weeks (Mann–Kendall p = ${pBad.toFixed(3)}).`);
    } else if (pGood < ALPHA && practical) {
      r.status = 'improving'; r.level = 0;
      r.reasons.push(`Consistent improvement over ${recent.length} weeks (p = ${pGood.toFixed(3)}).`);
    } else {
      r.status = 'steady'; r.level = 0;
    }
    if (r.weeksToLimit != null && r.status !== 'steady' && r.status !== 'improving') {
      r.reasons.push(r.weeksToLimit === 0 ? 'Already at or past the monitoring limit.' : `At this rate it reaches the monitoring limit in about ${Math.max(1, Math.round(r.weeksToLimit))} week${Math.round(r.weeksToLimit) > 1 ? 's' : ''}.`);
      if (r.weeksToLimit > 0 && r.weeksToLimit <= 4 && r.level < 2) r.level = 2;
    }
    return r;
  }

  // Runs the weekly system for one person, using the daily engine's baselines.
  function analyzeCrew(a, cd, day) {
    const res = H.INDICATORS.filter((i) => !i.cumulative).map((ind) => analyze(ind, cd.series[ind.id], a.inds[ind.id] && a.inds[ind.id].base, day));
    return {
      week: weekOf(day), lastFull: res[0] ? res[0].lastFull : 0, results: res,
      shifts: res.filter((r) => r.status === 'shift'), drifts: res.filter((r) => r.status === 'drift'), improving: res.filter((r) => r.status === 'improving'),
    };
  }

  H.weekly = { analyze, analyzeCrew, mannKendall, senSlope, weeklyMeans, weekOf, phi, MIN_WEEKS, MAX_WEEKS };
})(window.H);
