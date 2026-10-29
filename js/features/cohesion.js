/*
 * HELIOS feature — crew cohesion.
 * Two quick check-in questions on connection with the crew, plus a private journal that stays on
 * this device: it never appears in reports, the CMO view, FHIR exports or sync, and is encrypted
 * with the privacy lock. (Your own backup file includes it.)
 */
window.H = window.H || {};
(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T;
  const journal = (id) => (store.journal = store.journal || {})[id] = (store.journal[id] || {});

  H.bus.on('slot:checkin-fields', (c, v) => {
    const social = v && v.social != null ? v.social : 7;
    return `<fieldset>
      <legend>${T('Crew & connection')}</legend>
      <div class="ranges">
        <div class="field range-field">
          <label for="f-social">${T('How connected do you feel to the crew?')} <output id="o-social" class="mono">${social}</output></label>
          <input type="range" id="f-social" name="social" min="1" max="10" step="1" value="${social}" data-output="o-social">
          <div class="range-ends"><span>${T('Isolated')}</span><span>${T('Close')}</span></div>
        </div>
        <div class="field"><label for="f-talks">${T('Conversations today that mattered')}</label><input id="f-talks" name="talks" type="number" min="0" max="50" inputmode="numeric" value="${v && v.talks != null ? v.talks : ''}"></div>
      </div>
      <div class="field"><label for="f-journal">${app.ICON.lock} ${T('Private journal')} <small class="muted">— ${T('only you see this — never in reports, the CMO view, FHIR exports or sync')}</small></label>
        <textarea id="f-journal" name="journal" rows="3" placeholder="${T('What is on your mind?')}">${esc(journal(c.id)[app.M.day] || '')}</textarea></div>
    </fieldset>`;
  });

  H.bus.on('checkin-submit', (entry, fd) => {
    const s = parseFloat(fd.get('social')), t = parseInt(fd.get('talks'), 10);
    entry.social = Number.isFinite(s) ? s : null;
    entry.talks = Number.isFinite(t) ? t : null;
    const text = String(fd.get('journal') || '').slice(0, 4000);
    const j = journal(app.ui.crewId);
    if (text.trim()) j[app.M.day] = text; else delete j[app.M.day];
  });
});
