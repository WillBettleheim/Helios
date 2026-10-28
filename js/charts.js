/*
 * HELIOS — dependency-free SVG charts (runs fully offline on board).
 */
window.H = window.H || {};
(function (H) {
  'use strict';

  function niceTicks(min, max, count) {
    const span = max - min || 1;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || mag * 10;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }

  function spark(values) {
    const pts = values.map((v, i) => [i, v]).filter((p) => p[1] != null);
    if (pts.length < 2) return '<svg class="spark" viewBox="0 0 100 28"></svg>';
    const ys = pts.map((p) => p[1]);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const n = values.length - 1 || 1;
    const X = (i) => (i / n) * 100, Y = (v) => 25 - ((v - lo) / (hi - lo)) * 22;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" vector-effect="non-scaling-stroke"/>
      <circle cx="${X(last[0])}" cy="${Y(last[1])}" r="1.8"/></svg>`;
  }

  /*
   * o: { pts:[[day,value]], d0, d1, center(d), sd, bandK, limits:[{v,lvl,label}], events:[{day,label}], unit, dec, sparse }
   */
  function trend(el, o) {
    const W = Math.max(320, el.clientWidth || 640), HH = 280;
    const m = { l: 52, r: 16, t: 18, b: 30 };
    const iw = W - m.l - m.r, ih = HH - m.t - m.b;
    const pts = o.pts.filter((p) => p[0] >= o.d0 && p[0] <= o.d1);

    const ys = pts.map((p) => p[1]);
    if (o.center) for (let d = o.d0; d <= o.d1; d += Math.max(1, Math.floor((o.d1 - o.d0) / 20))) {
      ys.push(o.center(d) - o.sd * o.bandK, o.center(d) + o.sd * o.bandK);
    }
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const span0 = hi - lo || 1;
    (o.limits || []).forEach((L) => { if (L.v >= lo - span0 * 0.6 && L.v <= hi + span0 * 0.6) { lo = Math.min(lo, L.v); hi = Math.max(hi, L.v); } });
    const pad = (hi - lo || 1) * 0.08; lo -= pad; hi += pad;

    const X = (d) => m.l + ((d - o.d0) / Math.max(1, o.d1 - o.d0)) * iw;
    const Y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
    const f = (v) => H.fmt(v, o.dec);

    let s = `<svg class="trend" viewBox="0 0 ${W} ${HH}" role="img" aria-label="${o.label || 'Trend chart'}">`;
    niceTicks(lo, hi, 5).forEach((t) => {
      s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick" x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${f(t)}</text>`;
    });
    niceTicks(o.d0, o.d1, 6).forEach((t) => {
      if (t % 1) return;
      s += `<text class="tick" x="${X(t)}" y="${HH - 8}" text-anchor="middle">D${t}</text>`;
    });

    if (o.center) {
      const top = [], bot = [], mid = [];
      for (let d = o.d0; d <= o.d1; d++) {
        const c = o.center(d);
        top.push(`${X(d)},${Y(c + o.sd * o.bandK)}`); bot.unshift(`${X(d)},${Y(c - o.sd * o.bandK)}`); mid.push(`${X(d)},${Y(c)}`);
      }
      s += `<polygon class="band" points="${top.concat(bot).join(' ')}"/><polyline class="center" points="${mid.join(' ')}"/>`;
    }

    (o.limits || []).forEach((L) => {
      if (L.v < lo || L.v > hi) return;
      s += `<line class="limit lvl-${L.lvl}" x1="${m.l}" x2="${W - m.r}" y1="${Y(L.v)}" y2="${Y(L.v)}"/>
        <text class="limit-label lvl-${L.lvl}" x="${W - m.r - 4}" y="${Y(L.v) - 5}" text-anchor="end">${L.label} ${f(L.v)}</text>`;
    });

    (o.events || []).filter((e) => e.day >= o.d0 && e.day <= o.d1).forEach((e, i) => {
      const x = X(e.day), right = x > m.l + iw * 0.7;
      s += `<line class="event" x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ih}"/>
        <text class="event-label" x="${right ? x - 4 : x + 4}" y="${m.t + 10 + i * 13}" text-anchor="${right ? 'end' : 'start'}">${e.label}</text>`;
    });

    if (pts.length) {
      s += `<path class="line" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('')}"/>`;
      if (o.sparse || pts.length < 40) pts.forEach((p) => { s += `<circle class="pt" cx="${X(p[0])}" cy="${Y(p[1])}" r="3"/>`; });
      const last = pts[pts.length - 1];
      s += `<circle class="pt-last" cx="${X(last[0])}" cy="${Y(last[1])}" r="5"/>`;
    }
    s += `<line class="cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" style="display:none"/>
      <circle class="cross-pt" r="5" style="display:none"/>
      <rect class="hover" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/></svg>
      <div class="tip" style="display:none"></div>`;

    el.innerHTML = s;
    el.classList.add('chart-wrap');

    const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
    const cross = el.querySelector('.cross'), cp = el.querySelector('.cross-pt');
    const hide = () => { tip.style.display = cross.style.display = cp.style.display = 'none'; };
    el.querySelector('.hover').addEventListener('pointermove', (ev) => {
      if (!pts.length) return;
      const r = svg.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * W;
      const day = o.d0 + ((x - m.l) / iw) * (o.d1 - o.d0);
      let best = pts[0];
      pts.forEach((p) => { if (Math.abs(p[0] - day) < Math.abs(best[0] - day)) best = p; });
      const px = X(best[0]), py = Y(best[1]);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.style.display = '';
      cp.setAttribute('cx', px); cp.setAttribute('cy', py); cp.style.display = '';
      const date = H.dayToDate(best[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const base = o.center ? `<span>baseline ${f(o.center(best[0]))}</span>` : '';
      tip.innerHTML = `<b>${f(best[1])} ${o.unit}</b><span>Mission day ${best[0]} · ${date}</span>${base}`;
      tip.style.display = '';
      const left = (px / W) * r.width;
      tip.style.left = Math.min(r.width - 170, Math.max(0, left + 12)) + 'px';
      tip.style.top = Math.max(0, (py / HH) * r.height - 50) + 'px';
    });
    el.querySelector('.hover').addEventListener('pointerleave', hide);
  }

  H.charts = { spark, trend };
})(window.H);
