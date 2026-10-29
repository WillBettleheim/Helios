# HELIOS — Crew Health Monitor
**On-board health monitoring that lets astronauts evaluate and act on their own health on long missions.**

### The problem
On deep-space missions:
- **Earth is far:** up to 20 minutes away, and unreachable for about two weeks during solar conjunction.
- **The body changes:** radiation, isolation, microgravity and a closed cabin bring immune changes, bone loss, cardiovascular strain and behavioural problems.
- **The crew must self-monitor:** they have to spot these changes themselves. Fixed population limits miss what is abnormal *for a particular person*.

### What HELIOS does
- **Learns each astronaut's normal.** It uses preflight data first, then learns from in-flight data and adapts slowly. Readings older than 14 days update the baseline, so a developing problem never becomes "normal".
- **Judges every reading against that baseline.** It checks deviation in standard deviations, medical limits and a 14-day trend projection across 24 indicators in 7 domains.
- **Watches for slow change too.** A separate weekly system runs trend tests (Mann–Kendall, Sen's slope, CUSUM) over 8 weeks to catch drifts that day-to-day noise hides.
- **Explains and acts.** Each finding comes with its evidence, what to do now, a step-by-step protocol and who to involve: you, the onboard medical officer, or the flight surgeon.
- **Works when Earth can't help.** It is offline and installable. There's a blackout mode for conjunction, offline triage guides, a medical kit with stock forecasting, and an EVA go/no-go check.

### Results
- **Mission replay (simulated mission):** HELIOS flagged **21** developing problems across the crew.
  - **15** never crossed a fixed medical limit, so a limit-only system would not have alarmed.
  - Where limits were crossed, HELIOS was earlier, by up to **29 days** (the commander's blood pressure).
- **Real astronaut data (NASA OSDR, Inspiration4):** clinical-panel models separated the day-after-landing blood draw from normal draws.
  - Ensemble AUROC: **0.85** (p = 0.012).
  - Nested estimate: **0.68**.
  - That's only four people, so the results are indicative.
- **Live hardware:** a standard Bluetooth heart-rate strap streams heart rate and HRV into HELIOS in real time.

### Built for real use
- **Privacy:** data stays on the device, with optional AES-256 encryption, and sync is end-to-end encrypted.
- **Interoperability:** HL7 FHIR export for ground medical systems, plus Apple Health and CSV import.
- **Accessibility and languages:** WCAG AA contrast in three themes, screen-reader support, glove mode, and 6 languages (ESA, JAXA, ISRO and Roscosmos crews).
- **Quality:** 48 automated tests, input sanitizing, and Terms & Conditions with clear "not a medical device" wording.

### Try it
```bash
npm start
```
Open `http://localhost:8173/?judge`, which jumps straight into the mission replay.

*Prototype for research and demonstration. Not a medical device.*
