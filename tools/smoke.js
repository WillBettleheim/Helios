/*
 * HELIOS — in-browser smoke sweep.
 * Visits every screen for every crew member, presses every non-destructive button once, and
 * reports uncaught errors, failed renders and broken text (NaN, undefined, [object Object]…).
 * Usage (browser console, app served locally):
 *   const r = await (await import('/tools/smoke.js')).sweep(); console.table(r.issues)
 */
const SKIP = new Set([
  // destructive, permission prompts, downloads or external effects
  'delete-me', 'emergency-export', 'emergency-reset', 'lock-now', 'pin-on', 'pin-off', 'pin-change', 'sync-push', 'sync-pull',
  'install', 'print', 'export', 'export-me', 'export-readings', 'csv-template', 'trend-csv', 'fhir-export', 'voice-toggle',
  'live-connect', 'queue', 'clear-queue', 'more-scrim', 'brief', 'nav', 'set-crew', 'open-domain', 'open-ind', 'open-protocol',
  'tour-start', 'cog-start', 'pvt-start', 'wear-commit', 'wear-csv-commit', 'lab-load-example', 'live-save', 'rp-play',
]);
const BAD_TEXT = /\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b|\bnull\b(?!\s*(?:hypothesis|result))/;

export async function sweep({ crews, views, wait = 250 } = {}) {
  const H = window.H, app = H.app;
  const W = (ms) => new Promise((r) => setTimeout(r, ms));
  const issues = [];
  const errors = [];
  const onErr = (e) => errors.push(e.message || String(e.reason));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onErr);
  const origConfirm = window.confirm; window.confirm = () => true;
  const origErr = console.error; console.error = (...a) => { errors.push(a.map(String).join(' ')); origErr(...a); };

  const where = { crew: '', view: '', action: '' };
  const check = () => {
    const v = document.querySelector('#view');
    if (errors.length) { errors.splice(0).forEach((m) => issues.push({ ...where, problem: 'error', detail: m })); }
    if (v.querySelector('.empty.err')) issues.push({ ...where, problem: 'error boundary', detail: v.querySelector('.empty.err').innerText.slice(0, 160) });
    if (!v.innerText.trim()) issues.push({ ...where, problem: 'blank view', detail: '' });
    const text = document.body.innerText;
    const m = text.match(BAD_TEXT);
    if (m) { const i = text.indexOf(m[0]); issues.push({ ...where, problem: 'bad text', detail: text.slice(Math.max(0, i - 50), i + 30).replace(/\s+/g, ' ') }); }
    document.querySelectorAll('#view [style*="NaN"], #view [d*="NaN"], #view [x*="NaN"], #view [cx*="NaN"], #view [points*="NaN"]').forEach((el) => issues.push({ ...where, problem: 'NaN in SVG/style', detail: el.outerHTML.slice(0, 120) }));
  };

  crews = crews || app.crew().map((c) => c.id);
  for (const crew of crews) {
    where.crew = crew;
    const sel = document.querySelector('[data-change="crew"]');
    sel.value = crew; sel.dispatchEvent(new Event('change', { bubbles: true })); await W(wait);
    for (const view of views || [...document.querySelectorAll('#nav [data-view]')].map((a) => a.dataset.view)) {
      where.view = view; where.action = '(open)';
      app.go(view); await W(wait); check();
      const seen = new Set();
      for (let guard = 0; guard < 40; guard++) {
        const btn = [...document.querySelectorAll('#view [data-action], #alert-bar [data-action]')]
          .find((b) => !SKIP.has(b.dataset.action) && !b.disabled && !seen.has(b.dataset.action + '|' + (b.dataset.id || b.dataset.v || b.dataset.domain || b.dataset.ind || b.dataset.k || b.dataset.t || '')));
        if (!btn) break;
        seen.add(btn.dataset.action + '|' + (btn.dataset.id || btn.dataset.v || btn.dataset.domain || btn.dataset.ind || btn.dataset.k || btn.dataset.t || ''));
        where.action = btn.dataset.action + (btn.dataset.id ? `:${btn.dataset.id}` : '');
        btn.click(); await W(wait); check();
        if (H.app.ui.view !== view) { app.go(view); await W(wait); }
        if (document.getElementById('spe')) { const c = document.querySelector('#spe [data-action="spe-cancel"], #spe [data-action="spe-clear"]'); if (c) { c.click(); await W(wait); } }
      }
    }
  }
  window.removeEventListener('error', onErr);
  window.removeEventListener('unhandledrejection', onErr);
  window.confirm = origConfirm; console.error = origErr;
  return { issues, count: issues.length };
}
