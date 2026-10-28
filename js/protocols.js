/*
 * HELIOS — on-board countermeasure and response procedures.
 * Written so a crew member can execute them without real-time ground support.
 */
window.H = window.H || {};
(function (H) {
  'use strict';

  H.PROTOCOLS = [
    {
      id: 'P-RAD-01', domain: 'rad', title: 'Solar particle event — shelter', duration: 'Until all-clear (typically 12–48 h)',
      when: 'Personal dosimeter or vehicle alarm shows dose rate above 3 mSv/day, or SPE warning from ground.',
      steps: [
        'Move immediately to the storm shelter (water-wall sleep stations).',
        'Confirm your personal dosimeter is worn and logging.',
        'Bring sleep kit, water and the shelter task list; minimize time outside the shelter.',
        'Log shelter entry time in HELIOS.',
        'Wait for the all-clear (dose rate below 3 mSv/day for 6 h) before leaving.',
        'After exit, review your integrated dose with the CMO.',
      ],
      escalateIf: ['Nausea, vomiting or skin reddening within 48 h of the event', 'Integrated event dose above 100 mSv'],
    },
    {
      id: 'P-RAD-02', domain: 'rad', title: 'Career-dose management', duration: '15 min review',
      when: 'Career dose projected to exceed 90% of the career limit by mission end.',
      steps: [
        'Review the dose map: identify the modules where you spend the most time.',
        'Re-orient your sleep station so the water wall sits between you and the hull.',
        'Swap low-shielding tasks (airlock, node maintenance) with crewmates where possible.',
        'Request a dosimetry review from the flight surgeon at the next downlink.',
      ],
      escalateIf: ['Projection exceeds 100% of the career limit'],
    },
    {
      id: 'P-SLP-01', domain: 'behav', title: 'Sleep recovery & alertness management', duration: '3 sleep periods',
      when: 'Sleep duration or efficiency below baseline, or PVT reaction time slowed.',
      steps: [
        'Set sleep-station lighting to the pre-sleep (warm, low-blue) setting 2 h before sleep.',
        'Stop caffeine 6 h before your sleep period.',
        'Check sleep-station noise and CO₂; use earplugs and confirm the ventilation fan is on.',
        'Protect an 8.5 h sleep opportunity — ask the commander to move tasks if needed.',
        'Defer safety-critical tasks (EVA prep, robotics, ECLSS work) while PVT is above baseline.',
        'Repeat the PVT after the next sleep period.',
      ],
      escalateIf: ['Sleep under 5 h for 3 consecutive periods', 'PVT lapses persist after 3 recovery sleeps', 'Considering sleep medication (CMO decides)'],
    },
    {
      id: 'P-ENV-01', domain: 'sans', title: 'Elevated CO₂ — headache response', duration: '30 min',
      when: 'Headaches with cabin ppCO₂ at or above 3.0 mmHg.',
      steps: [
        'Read the portable CO₂ monitor at your sleep station and work area.',
        'Increase local ventilation fan speed; avoid sleeping in dead-air pockets.',
        'Drink 500 mL of water and take a 10-min break away from the work area.',
        'Notify the crew and log the reading for the ECLSS team.',
        'If the headache persists, take paracetamol per the medical kit card.',
      ],
      escalateIf: ['Headache with vision change or blurring (see P-SANS-01)', 'Confusion, shortness of breath or CO₂ ≥ 4 mmHg'],
    },
    {
      id: 'P-BHP-01', domain: 'behav', title: 'Behavioral health self-care', duration: 'Ongoing',
      when: 'Mood or stress outside your usual range, or feeling isolated.',
      steps: [
        'Name it: note the main stressor in your private journal.',
        'Schedule a private psychological conference (PPC) for the next comm window.',
        'Book protected personal time today (music, family message, window view).',
        'Do a 10-min guided breathing or relaxation session from the library.',
        'Check in with one crewmate — shared meals count.',
      ],
      escalateIf: ['Thoughts of self-harm (notify CMO immediately)', 'Unable to perform duties', 'Interpersonal conflict affecting safety'],
    },
    {
      id: 'P-MSK-01', domain: 'msk', title: 'Bone & muscle countermeasures', duration: '14 days',
      when: 'Exercise below prescription, or bone loss ahead of the expected trajectory.',
      steps: [
        'Restore the full prescription: 3–6 resistive (ARED) sessions + daily aerobic, ~2 h/day total.',
        'Prioritize heavy squats and deadlifts — the highest hip loading.',
        'Confirm vitamin D supplement (800 IU/day) and dietary calcium.',
        'Ask the commander to protect exercise time in the timeline.',
        'Re-measure grip strength and bone ultrasound in 14 days.',
      ],
      escalateIf: ['Bone loss more than 1.5% beyond expected', 'Pain during loading'],
    },
    {
      id: 'P-REN-01', domain: 'msk', title: 'Kidney-stone prevention', duration: '7 days',
      when: 'Urinary calcium above 300 mg/day.',
      steps: [
        'Drink at least 2.5 L of fluid per day; track it in HELIOS.',
        'Limit sodium — choose low-salt menu items.',
        'Ask the CMO about potassium citrate.',
        'Repeat the urine sample in 3 days.',
      ],
      escalateIf: ['Flank pain, blood in urine or fever'],
    },
    {
      id: 'P-IMM-01', domain: 'immune', title: 'Immune surveillance & infection control', duration: '7 days',
      when: 'Lymphocytes low, CRP raised, viral shedding detected or fever.',
      steps: [
        'Collect a repeat saliva sample and blood draw within 72 h.',
        'Inspect skin daily for rash or blisters (shingles risk with VZV).',
        'Use separate utensils and wipe shared surfaces; wash hands before meals.',
        'Measure temperature twice daily.',
        'Prioritize sleep — immune recovery depends on it.',
      ],
      escalateIf: ['Painful rash or blisters', 'Temperature above 38.3 °C', 'Lymphocytes below 0.9 ×10⁹/L'],
    },
    {
      id: 'P-CV-01', domain: 'cardio', title: 'Cardiovascular assessment', duration: '3 days',
      when: 'Resting HR, blood pressure or HRV outside baseline.',
      steps: [
        'Record a 5-min resting ECG with the Bio-harness and send it to the CMO.',
        'Measure blood pressure morning and evening for 3 days.',
        'Keep aerobic sessions in the moderate zone (no maximal efforts) until reviewed.',
        'Reduce sodium and caffeine.',
        'Complete the orthostatic symptom checklist each morning.',
      ],
      escalateIf: ['Chest pain, palpitations or fainting — immediate response', 'Systolic BP above 150 mmHg on repeat'],
    },
    {
      id: 'P-SANS-01', domain: 'sans', title: 'Neuro-ocular self-assessment', duration: '20 min',
      when: 'New vision change, rising retinal thickness or recurring headaches.',
      steps: [
        'Do the near-acuity card test, each eye separately; log the result.',
        'Do the Amsler grid test, each eye separately.',
        'Book an OCT and fundoscopy session with the CMO.',
        'Avoid prolonged head-down positions and heavy straining until reviewed.',
        'Send the images to the flight surgeon at the next downlink.',
      ],
      escalateIf: ['Sudden vision loss', 'Severe headache with nausea'],
    },
  ];
})(window.H);
