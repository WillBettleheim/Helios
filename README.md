# HELIOS — Crew Health Monitor

A prototype of on-board health monitoring software for long-duration missions. It collects
physiological, behavioral and environmental indicators, compares each one with the astronaut's
**own preflight baseline**, and turns any deviation into an explained finding with concrete steps.
Astronauts can then act on their health without waiting for a 14-minute-each-way ground loop.

> Prototype: all sensor data is simulated. This is not a medical device.

## Run it

No build step and no dependencies. It runs fully offline, as it would on board.

```bash
python3 -m http.server 8173
```

Then open http://localhost:8173. Opening `index.html` directly also works.

## What it does

| Screen | Purpose |
|---|---|
| **My health** | Readiness score, six health-domain cards, ranked findings with "do now" steps, today's tasks, cabin environment, ground-link latency |
| **Trends** | Per-indicator charts against your personal normal range, limits and mission events; deviation, trend per week, 14-day projection, data coverage |
| **Daily check-in** | Two-minute self-report: sleep, mood, energy, stress, symptoms, manual vitals, privacy choice. Results are re-evaluated immediately |
| **Alertness test** | PVT-B psychomotor vigilance test (1 or 3 min), scored for mean RT, lapses (>355 ms) and false starts |
| **Protocols** | Ten on-board procedures (SPE shelter, sleep recovery, CO₂ headache, bone countermeasures, immune, SANS…) with step tracking and escalation criteria |
| **Downlink report** | Compact summary for the flight surgeon: queue for the next window, export JSON, or print |
| **Crew (CMO)** | Crew Medical Officer overview. Private behavioral entries stay hidden |

There is also a **sleep-period display** (moon icon): a red-shifted, low-blue-light theme.

## Health domains and indicators

- **Cardiovascular**: resting HR, HRV (RMSSD), systolic BP
- **Bone & Muscle**: estimated hip BMD change (vs. the expected in-flight curve), urinary calcium, countermeasure exercise, grip strength
- **Immune**: lymphocytes, CRP, salivary EBV/VZV shedding, core temperature
- **Radiation**: daily dose rate, career dose with a projection to mission end against the 600 mSv limit
- **Sleep & Behavioral**: sleep duration and efficiency, mood, stress, PVT reaction time
- **Neuro-ocular (SANS)**: retinal nerve-fiber-layer change (OCT), headache days
- **Habitat**: ppCO₂, temperature, humidity, sleep-station noise (shared exposures that often explain symptoms)

## How assessment works (`js/engine.js`)

1. **Personal baseline.** Deviation in SD from the astronaut's preflight mean (or from an expected in-flight trajectory for bone loss). 2 SD → *Monitor*, 3 SD → *Action*.
2. **Absolute limits.** Medical thresholds per indicator (*Monitor / Action / Urgent*).
3. **Trend.** Linear trend over 21+ days, projected 14 days ahead, so slow drifts are caught before they cross a limit.
4. **Rules.** These combine indicators and symptoms into findings. For example, sleep loss together with slower PVT gives "Sleep loss is slowing your reactions", and headaches together with high cabin CO₂ point to the scrubber fault. Each finding lists its evidence, the steps to take, a linked protocol and a recommended route: self-manage, CMO, flight surgeon, or immediate crew response.
5. **Readiness** is 100 minus capped penalties for each domain.

## Demo scenario (mission day 147)

| Crew | Story |
|---|---|
| Ren Nakamura (you) | Weeks of repair work: shorter sleep, slower PVT, lower mood, missed exercise leading to faster bone loss and rising urinary calcium, headaches after a CO₂ scrubber fault |
| Alex Reyes | Gradual rise in BP and resting HR with lower HRV; career dose projected at 94% of the limit |
| Dr. Kai Lindqvist | Nominal |
| Sami Haddad | Latent-virus reactivation with falling lymphocytes, rising CRP and a slight temperature rise |

A solar particle event on day 131 appears in the radiation, sleep and stress trends.

## Structure

```
index.html
css/styles.css
js/data.js        mission, crew, indicator catalogue, deterministic simulator
js/engine.js      baseline / limit / trend assessment and finding rules
js/protocols.js   on-board procedures
js/charts.js      dependency-free SVG sparkline and trend charts
js/app.js         views, check-in, PVT, report, interactions
```

Check-ins, test results, protocol progress and the downlink queue are saved in the browser's `localStorage`.

## Next steps toward a flight system

- Replace the simulator with real device adapters (Bio-harness, actigraphy, dosimeter, analyzers)
- Use Bayesian baselines that update in flight, plus multivariate anomaly detection
- Encrypted on-board store, consent rules for each data type, and DTN bundles for the downlink
- Review of the rules and protocols by flight surgeons, and validation against analog-mission data
