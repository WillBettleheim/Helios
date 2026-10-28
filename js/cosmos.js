/*
 * HELIOS — ambient visuals: deep-space starfield and the boot sequence.
 * Both stand down when the viewer prefers reduced motion.
 */
window.H = window.H || {};
(function (H) {
  'use strict';

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- starfield ----------
  function starfield(canvas) {
    const ctx = canvas.getContext('2d');
    let w, h, dpr, stars = [], meteors = [], raf;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.width = Math.floor(innerWidth * dpr);
      h = canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      const n = Math.round((innerWidth * innerHeight) / 2600);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        z: Math.random() ** 2,                  // depth: 0 far … 1 near
        p: Math.random() * Math.PI * 2,         // twinkle phase
      }));
      if (reduced) draw(0);
    }

    function tint() {
      return document.body.classList.contains('night') ? [255, 120, 100] : [205, 225, 255];
    }

    let lastFrame = 0;
    function draw(t) {
      // 30 fps is plenty for drifting stars and halves the work under the glass panels.
      if (!reduced && t - lastFrame < 33) { raf = requestAnimationFrame(draw); return; }
      lastFrame = t;
      const [r, g, b] = tint();
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduced) {
          s.x -= (0.03 + s.z * 0.22) * dpr;
          if (s.x < 0) { s.x = w; s.y = Math.random() * h; }
        }
        const tw = reduced ? 1 : 0.65 + 0.35 * Math.sin(t / 900 + s.p);
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.18 + s.z * 0.75) * tw})`;
        const size = (0.4 + s.z * 1.5) * dpr;
        ctx.fillRect(s.x, s.y, size, size);
      }
      if (!reduced) {
        if (Math.random() < 0.003 && meteors.length < 2) {
          meteors.push({ x: Math.random() * w, y: Math.random() * h * 0.5, vx: -(6 + Math.random() * 6) * dpr, vy: (2 + Math.random() * 2) * dpr, life: 1 });
        }
        meteors = meteors.filter((m) => m.life > 0);
        for (const m of meteors) {
          const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 10, m.y - m.vy * 10);
          grad.addColorStop(0, `rgba(${r},${g},${b},${0.8 * m.life})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.strokeStyle = grad; ctx.lineWidth = 1.4 * dpr;
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 10, m.y - m.vy * 10); ctx.stroke();
          m.x += m.vx; m.y += m.vy; m.life -= 0.018;
        }
        raf = requestAnimationFrame(draw);
      }
    }

    resize();
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); if (!reduced) raf = requestAnimationFrame(draw); });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(draw);
    });
    if (!reduced) raf = requestAnimationFrame(draw);
    H.redrawStars = () => { if (reduced) draw(0); };
  }

  // ---------- boot sequence ----------
  function boot(el, lines, done) {
    let seen = false;
    try { seen = sessionStorage.getItem('helios.booted') === '1'; } catch (e) { /* ignore */ }
    if (seen || reduced) { el.remove(); done(); return; }
    const log = el.querySelector('.boot-log'), bar = el.querySelector('.boot-bar i');
    let i = 0, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try { sessionStorage.setItem('helios.booted', '1'); } catch (e) { /* ignore */ }
      el.classList.add('out');
      setTimeout(() => el.remove(), 700);
      done();
    };
    const step = () => {
      if (finished) return;
      if (i < lines.length) {
        const li = document.createElement('li');
        li.innerHTML = `<span>${lines[i][0]}</span><b>${lines[i][1]}</b>`;
        log.appendChild(li);
        bar.style.width = `${((i + 1) / lines.length) * 100}%`;
        i++;
        setTimeout(step, 260 + Math.random() * 140);
      } else setTimeout(finish, 450);
    };
    el.addEventListener('click', finish);
    window.addEventListener('keydown', finish, { once: true });
    setTimeout(step, 500);
  }

  H.cosmos = { starfield, boot, reduced };
})(window.H);
