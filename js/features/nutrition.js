/*
 * HELIOS feature — nutrition & hydration logging in the daily check-in.
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const T = app.T;
  const val = (v, id) => (v && v.vitals && v.vitals[id] != null ? v.vitals[id] : '');

  H.bus.on('slot:checkin-fields', (c, v) => `
    <fieldset>
      <legend>${T('Nutrition & hydration')} <span class="muted small">— ${T('optional')}</span></legend>
      <div class="vitals">
        <div class="field"><label for="f-mass">${T('Body mass')} <small>kg</small></label><input id="f-mass" name="mass" type="number" min="30" max="200" step="0.1" inputmode="decimal" value="${val(v, 'mass')}" placeholder="${H.fmt(app.me().inds.mass.current, 1)}"></div>
        <div class="field"><label for="f-fluid">${T('Fluid today')} <small>L</small></label><input id="f-fluid" name="fluid" type="number" min="0" max="8" step="0.1" inputmode="decimal" value="${val(v, 'fluid')}" placeholder="${H.fmt(app.me().inds.fluid.current, 1)}"></div>
        <div class="field"><label for="f-kcal">${T('Energy today')} <small>kcal</small></label><input id="f-kcal" name="kcal" type="number" min="0" max="8000" step="10" inputmode="numeric" value="${val(v, 'kcal')}" placeholder="${H.fmt(app.me().inds.kcal.current, 0)}"></div>
      </div>
    </fieldset>`);

  H.bus.on('checkin-submit', (entry, fd) => {
    ['mass', 'fluid', 'kcal'].forEach((id) => { const x = parseFloat(fd.get(id)); entry.vitals[id] = Number.isFinite(x) ? x : null; });
  });
});
