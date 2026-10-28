/*
 * HELIOS feature — Terms & Conditions.
 * The text lives here once; the in-app page, the first-run acceptance screen and TERMS.md
 * (tools/build-terms.js) are all generated from it. Bumping VERSION asks everyone to accept again.
 */
window.H = window.H || {};
(function (H) {
  'use strict';
  H.TERMS = {
    version: '1.0',
    effective: '2026-10-28',
    summary: [
      'HELIOS is a research prototype, not a medical device. It does not diagnose, treat or replace your Crew Medical Officer, flight surgeon or doctor.',
      'In an emergency, act on your training and call for help first. Never wait for the app.',
      'Your health data stays on your device unless you choose to sync it or send a report. It is encrypted on the device if you set a PIN.',
      'The demo crew and their readings are simulated. Model results are validated on only four people and are indicative only.',
    ],
    sections: [
      ['1. About these terms', [
        'These Terms & Conditions ("Terms") govern your use of HELIOS, a crew health monitoring prototype ("the app"). By selecting "I accept" or by using the app, you agree to these Terms. If you do not agree, do not use the app.',
        'If you use HELIOS on behalf of a mission, agency or organisation, you confirm you are authorised to accept these Terms for it.',
      ]],
      ['2. Not a medical device; not medical advice', [
        'HELIOS is a research and demonstration prototype. It has not been cleared or approved by any medical regulator and is not a medical device.',
        'Readiness scores, findings, protocols, triage guides, lab-panel scores and every other output are general information to support your own judgement. They are not a diagnosis, treatment or medical advice, and they may be incomplete or wrong.',
        'Always follow the instructions of your Crew Medical Officer, flight surgeon, physician and mission rules. If anything in HELIOS conflicts with them, they take precedence.',
        'In a medical emergency, act on your training and alert your crew and medical support immediately. Do not delay care because of anything the app shows or fails to show. An absence of alerts does not mean you are well.',
      ]],
      ['3. Prototype status, simulated data and model limits', [
        'The demo mission, crew members and their readings are fictional and simulated. Any resemblance to real people is coincidental.',
        'The lab-panel models were trained and validated on open data from four SpaceX Inspiration4 crew members after a three-day flight. Results are indicative only and are not proven for other people, longer missions or clinical use.',
        'Triage guides and protocols are written from general first-aid and spaceflight-medicine practice for demonstration. They have not been reviewed or validated by a clinician.',
        'Features may change, break or be removed without notice.',
      ]],
      ['4. Your responsibilities', [
        'You are responsible for the accuracy of the information you enter or import, for the security of your device, PIN and sync passphrase, and for keeping your own backups.',
        'Only enter or import data about another person with that person\'s consent and the authority to do so.',
        'Do not use HELIOS for any unlawful purpose, to harm anyone, or in a way that breaches mission, agency or employer rules.',
      ]],
      ['5. Your data and privacy', [
        'Where data is kept. Everything you enter (profile, check-ins, readings, imports, test results, lab values, medication log) is stored in your browser on this device. HELIOS has no account system, no analytics and no advertising, and does not send your data to its developers.',
        'When data leaves your device. Only when you choose to: (a) Sync sends an encrypted bundle to the server address you enter; the server receives ciphertext only. (b) Exported files and downlink reports go wherever you save or send them. (c) Voice control uses your browser\'s speech-recognition service, which in some browsers (for example Chrome) sends audio to the browser vendor for processing — do not use voice control if that is not acceptable.',
        'Imports. Wearable and CSV files are read on your device and are not uploaded.',
        'Crew sharing. On a shared crew device the Crew Medical Officer view shows crew summaries. Behavioural check-in answers you mark private are hidden there.',
        'Your control. You can export your data, restore a backup or delete your profile and data at any time from My profile. Deletion removes it from this device; copies you have exported or synced elsewhere must be deleted there.',
      ]],
      ['6. Security', [
        'If you set a PIN or passphrase, your record is stored only in encrypted form (AES-256-GCM, key derived with PBKDF2). If you forget it, your data cannot be recovered.',
        'A short PIN protects against casual access, not against a determined attacker who has your device. Use a longer passphrase for stronger protection.',
        'No system is perfectly secure. You use HELIOS at your own risk.',
      ]],
      ['7. Third-party data and names', [
        'Lab-panel validation uses open data from the NASA Open Science Data Repository (OSDR), studies OSD-569 and OSD-575 (SpaceX Inspiration4). HELIOS is an independent project and is not affiliated with, endorsed or sponsored by NASA, SpaceX, ESA, JAXA, ISRO, Roscosmos or any other agency or company. Their names are used only to describe data sources and intended users.',
        'Product names such as Apple Health, Fitbit, Garmin, Oura and Whoop are trademarks of their owners and are mentioned only to describe file formats HELIOS can read.',
      ]],
      ['8. No warranty', [
        'HELIOS is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose, accuracy, reliability, availability and non-infringement, to the fullest extent permitted by law.',
      ]],
      ['9. Limitation of liability', [
        'To the fullest extent permitted by law, the developers and contributors of HELIOS are not liable for any injury, illness, loss of data, or direct, indirect, incidental or consequential damages arising from use of, or inability to use, the app or reliance on its output.',
        'Nothing in these Terms limits liability that cannot be limited under applicable law.',
      ]],
      ['10. Changes to these Terms', [
        'These Terms may be updated. The version and effective date are shown at the top. When the version changes, HELIOS will ask you to accept the new Terms before continuing.',
      ]],
      ['11. Contact', [
        'Questions, issues and security reports: open an issue at github.com/WillBettleheim/Helios.',
      ]],
    ],
  };
})(window.H);

(H.features = H.features || []).push(function (app) {
  'use strict';
  const { esc, store } = app;
  const T = app.T, TR = H.TERMS;

  app.addIcon('terms', '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>');
  app.addView({ id: 'terms', label: 'Terms & privacy', short: 'Terms', group: 'me', icon: 'terms', render });

  const accepted = () => store.prefs && store.prefs.termsVersion === TR.version;

  function body() {
    return TR.sections.map(([h, ps]) => `<section class="terms-sec"><h2>${esc(h)}</h2>${ps.map((p) => {
      const m = p.match(/^([A-Z][^.]{2,30}\.) (.*)$/);
      return m && h.startsWith('5.') ? `<p><b>${esc(m[1])}</b> ${esc(m[2])}</p>` : `<p>${esc(p)}</p>`;
    }).join('')}</section>`).join('');
  }

  function render() {
    const p = store.prefs || {};
    return `<div class="page-head"><div><p class="eyebrow">${T('Terms & privacy')} · v${TR.version} · effective ${TR.effective}</p><h1>${T('Terms & Conditions')}</h1>
      <p class="lede">${accepted() ? `You accepted version ${TR.version}${p.termsAt ? ` on ${new Date(p.termsAt).toLocaleDateString()}` : ''}.` : 'Please read and accept these terms to use HELIOS.'}</p></div>
      <button class="btn" data-action="print">Print</button></div>
      <div class="card terms-key"><h2 class="ct">${T('The short version')}</h2><ul>${TR.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>
      <article class="card terms">${body()}</article>`;
  }

  // First run (and after a terms update): a blocking acceptance screen.
  function gate() {
    if (accepted() || document.getElementById('terms-gate')) return;
    const el = document.createElement('div');
    el.id = 'terms-gate';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'tg-title');
    el.innerHTML = `<form class="tg-box">
      <span class="eyebrow">HELIOS · ${T('Terms & Conditions')} v${TR.version}</span>
      <h2 id="tg-title">${T('Before you start')}</h2>
      <ul>${TR.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <details><summary>${T('Read the full terms')}</summary><div class="tg-full">${body()}</div></details>
      <label class="tg-check"><input type="checkbox" name="ok" required><span>${T('I have read and accept the Terms & Conditions, and I understand HELIOS is not a medical device.')}</span></label>
      <button class="btn primary" type="submit">${T('I accept')}</button>
    </form>`;
    document.body.appendChild(el);
    const form = el.querySelector('form');
    form.querySelector('input').focus();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.ok.checked) return;
      const prefs = (store.prefs = store.prefs || {});
      prefs.termsVersion = TR.version; prefs.termsAt = Date.now();
      app.log(`Accepted Terms & Conditions v${TR.version}`, 'terms');
      el.remove();
      H.bus.emit('terms-accepted');
    });
  }

  H.bus.on('boot', () => {
    const wait = () => (document.getElementById('boot') ? setTimeout(wait, 300) : gate());
    wait();
  });
  H.termsAccepted = accepted;
});
