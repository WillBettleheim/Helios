/*
 * HELIOS — lightweight in-page accessibility audit (no dependencies).
 * Checks the most common WCAG 2.1 AA failures on the current screen:
 *   names on interactive controls, labels on form fields, text contrast (1.4.3),
 *   duplicate ids, heading order, image alt text and broken ARIA id references.
 * Usage (browser console, app served locally):
 *   await import('/tools/a11y-audit.js').then((m) => m.audit())
 * It is a quick regression check, not a substitute for testing with a real screen reader.
 */
export function audit(root = document) {
  const issues = [];
  const add = (rule, el, detail) => issues.push({ rule, detail, el: describe(el) });
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const describe = (el) => (el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}` : '');

  // Accessible name (simplified accname: aria-labelledby, aria-label, label, text, title, alt).
  function name(el) {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l && l.textContent.trim()) return l.textContent.trim(); }
    const wrap = el.closest('label'); if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
    if (['button', 'a', 'summary', 'option'].includes(el.tagName.toLowerCase()) || el.getAttribute('role') === 'button') {
      const t = (el.textContent || '').trim(); if (t) return t;
      const img = el.querySelector('[alt], svg title'); if (img) return (img.getAttribute('alt') || img.textContent || '').trim();
    }
    return (el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
  }

  root.querySelectorAll('button, a[href], [role="button"], summary').forEach((el) => { if (visible(el) && !name(el)) add('control-name', el, 'interactive control has no accessible name'); });
  root.querySelectorAll('input:not([type=hidden]), select, textarea').forEach((el) => {
    if (!visible(el) && !el.closest('label')) return;
    if (!name(el) || (name(el) === el.getAttribute('placeholder') && !el.getAttribute('aria-label'))) add('field-label', el, 'form field has no label');
  });
  root.querySelectorAll('img').forEach((el) => { if (!el.hasAttribute('alt')) add('img-alt', el, 'image has no alt attribute'); });

  const ids = {};
  document.querySelectorAll('[id]').forEach((el) => { ids[el.id] = (ids[el.id] || 0) + 1; });
  Object.entries(ids).filter(([, n]) => n > 1).forEach(([id]) => add('duplicate-id', document.getElementById(id), `id "${id}" used more than once`));
  root.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]').forEach((el) => {
    ['aria-labelledby', 'aria-describedby', 'aria-controls'].forEach((a) => (el.getAttribute(a) || '').split(/\s+/).filter(Boolean).forEach((id) => { if (!document.getElementById(id)) add('aria-ref', el, `${a} points to missing id "${id}"`); }));
  });

  let last = 0;
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    if (!visible(h)) return;
    const lvl = +h.tagName[1];
    if (last && lvl > last + 1) add('heading-order', h, `h${last} followed by h${lvl}`);
    last = lvl;
  });

  // Contrast: composite semi-transparent backgrounds up the tree onto the page background.
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  function bgOf(el) {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      if (getComputedStyle(n).backgroundImage !== 'none' && n !== document.body) return null;   // gradient/image: skip
    }
    let bg = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1];
    if (bg[3] < 1) bg = over(bg, [255, 255, 255, 1]);
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return bg;
  }
  const seen = new Set();
  root.querySelectorAll('body *').forEach((el) => {
    if (!visible(el) || ['SCRIPT', 'STYLE', 'svg', 'SVG'].includes(el.tagName) || el.closest('svg')) return;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) return;
    const s = getComputedStyle(el);
    if (parseFloat(s.opacity) < 0.1) return;
    const fg = parse(s.color), bg = bgOf(el);
    if (!fg || !bg) return;
    const r = ratio(over(fg, bg), bg);
    const size = parseFloat(s.fontSize), bold = +s.fontWeight >= 700;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    if (r < need - 0.05) {
      const key = `${describe(el)}|${s.color}`;
      if (!seen.has(key)) { seen.add(key); add('contrast', el, `${r.toFixed(2)}:1 (needs ${need}:1) — "${el.textContent.trim().slice(0, 40)}"`); }
    }
  });
  return issues;
}
