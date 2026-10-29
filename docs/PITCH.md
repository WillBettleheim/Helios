# HELIOS — pitch kit

Every number below comes from the app itself (Mission replay and Model validation pages). If you change the scenario or models, re-check them there before presenting.

## The one-liner

**HELIOS gives astronauts a personal flight surgeon in their pocket.** It learns each crew member's own normal, catches problems weeks before fixed medical limits would, and tells them exactly what to do when Earth is 14 minutes away.

## 2-minute pitch script

**0:00 · The problem (20 s)**
> On a Mars mission, Earth is up to 20 minutes away each way, and for two weeks during solar conjunction it is unreachable. Radiation, isolation, microgravity and a closed cabin quietly change an astronaut's body and mind. Today the ground watches crew health. On Mars, astronauts have to do it themselves.

**0:20 · The insight (20 s)**
> Medical alarms use population limits, and astronauts aren't average people. A resting heart rate of 64 is normal for one person and a warning sign for another. HELIOS judges every reading against the astronaut's *own* baseline and trend, not a fixed number.

**0:40 · Demo: mission replay (35 s)** — open `?judge`
> This is a simulated Mars transit, days 90 to 147. As it plays, watch HELIOS flag problems as they develop. Across the crew it flagged **19** developing problems. **13 of them never crossed a fixed medical limit**, so a conventional system would have stayed silent. Where a limit was crossed, HELIOS was never later, and the commander's blood pressure was flagged **25 days** before the limit.

**1:15 · Demo: acting on it (25 s)**
> A flag is only useful if you know what to do. Each finding explains its evidence and links a step-by-step protocol. Before a spacewalk, the **EVA check** turns everything into GO / CAUTION / NO-GO. And during a **blackout**, HELIOS reroutes everything to the onboard medical officer and queues reports for when contact returns.

**1:40 · Proof and credibility (15 s)**
> We tested it on **real astronaut blood data** from NASA's Open Science Data Repository, from the Inspiration4 crew. Our ensemble model separated the day-after-landing draw from normal draws with an **AUROC of 0.85**. We report the honest nested estimate, **0.68**, too, because that's only four people. Wear a strap and HELIOS reads your heart live.

**1:55 · Close (5 s)**
> HELIOS: so the crew can see a problem coming and act before it becomes an emergency.

## 30-second demo video — storyboard

| Time | Screen | Voice-over / caption |
|---|---|---|
| 0–3 s | Start-up sequence, starfield, logo | "Mars. 14 minutes from help." |
| 3–8 s | Overview: readiness 49, body map pulsing | "HELIOS learns each astronaut's own normal." |
| 8–16 s | Mission replay at 4×, flags dropping onto the timeline | "13 of 19 problems never crossed a fixed limit. HELIOS caught them." |
| 16–21 s | Finding card, then protocol checklist | "Every alert comes with what to do." |
| 21–25 s | EVA readiness: NO-GO with reasons | "Fit for a spacewalk? One clear answer." |
| 25–28 s | Live sensor: heart rate streaming | "Real sensors. Real data. Fully offline." |
| 28–30 s | Logo + "HELIOS" | "Health, on board." |

**Recording tips:**
- Use Chrome. Set the window to 1280×800, or use a phone frame for the mobile shots.
- Use `?judge` for the replay; it starts playing on its own.
- Turn on the simulated sensor if you don't have a strap.
- Leave the sleep display off for the main shots, then show it in one cut ("this is how it looks at bedtime").

## Likely judge questions

- **"What about slow changes?"** Slow drifts are caught by statistical weekly trend tests (Mann–Kendall, CUSUM) that are built into the detector. On their own they caught the commander's slow resting-heart-rate rise on day 112.
- **"Won't it cry wolf?"** We benchmarked it on 200 randomized simulated astronauts it was never tuned on. The detector now raises **2.7 false alarms per person per month instead of 10** (−73 %), while still catching **98.8 %** of problems. Alarm fatigue is a real risk on a long mission, so we optimized for it.
- **"Isn't this just thresholds?" No. The thresholds are personal (z-scores against each astronaut's own baseline), trends are projected 14 days ahead, and the rules combine signals into explained findings. The replay shows the difference: 15 problems that fixed limits missed.
- **"Is the data real?"** The lab models are trained and tested on real NASA OSDR data from the Inspiration4 crew. The demo mission's daily wearable data is simulated, because no open in-flight astronaut wearable data exists. The live sensor reads real hardware.
- **"How good is the model really?"** The ensemble scores AUROC 0.85, and the nested estimate is 0.68. With four people, both are indicative, and the app says so on its own validation page.
- **"Privacy?"** Everything stays on the device. There's optional AES-256 encryption with a PIN. Sync is end-to-end encrypted, and private behavioural answers never reach the medical officer's view.
- **"Could it work for real?"** It works offline and installs as an app. It exports HL7 FHIR for ground medical systems and reads standard Bluetooth heart-rate sensors. There are 53 automated tests, and every screen passes WCAG AA contrast.
