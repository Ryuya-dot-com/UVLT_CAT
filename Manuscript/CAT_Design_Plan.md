# UVLT Testlet-CAT Implementation Plan

## 1. Objective

Build a browser-based research prototype of a UVLT-informed adaptive test using `HTML + CSS + JavaScript`.

The prototype should:

- administer **matching-format testlets** rather than single isolated items,
- use the existing UVLT calibration work as the starting point,
- estimate a latent vocabulary ability during testing,
- adapt the next **testlet** to the current ability estimate,
- export response logs and score summaries for later analysis.

This is a **research prototype**, not a high-stakes operational test.

---

## 2. Non-Negotiable Design Decisions

### 2.1 Unit of adaptation

The adaptive unit will be the **testlet**.

Reason:

- the UVLT uses 3-item matching clusters,
- local item dependence has been repeatedly reported for this format,
- the available `11TL` calibration was estimated in a testlet-aware framework,
- single-item CAT would break the psychometric context in which the parameters were estimated.

### 2.2 Initial scope

The first working version should use **one linked bank only**, preferably the `1k` bank, until cross-level linking is verified.

Reason:

- current `1k` to `5k` calibrations appear to have been run separately,
- separate calibrations should not be treated as one scale without linking evidence,
- a valid narrow prototype is preferable to an invalid full-range CAT.

### 2.3 Delivery target

The first implementation target is a **local browser prototype**:

- no server required,
- no authentication,
- no item security assumptions,
- all results saved locally as `JSON` or `CSV`.

---

## 3. Proposed Development Path

### Phase A. Psychometric foundation

Goal: decide exactly what the prototype will score and adapt on.

Deliverables:

- fixed statement of the latent variable,
- fixed bank scope,
- fixed estimation rule,
- fixed stopping rule,
- documented limitations.

Recommended initial choice:

- latent variable: `general receptive vocabulary knowledge within the chosen UVLT bank`,
- bank: `UVLT 1k`,
- response unit: `3-item testlet`,
- estimator: `MAP or EAP`,
- stopping: `max_testlets` + `minimum_standard_error`.

### Phase B. Bank preparation

Goal: transform the UVLT materials into a machine-readable bank.

Required inputs:

- testlet texts from the UVLT form,
- answer keys,
- item difficulties from the testlet-aware calibration,
- testlet identifiers,
- level identifiers,
- optional metadata such as part of speech or form label.

Deliverables:

- `uvlt_1k_bank.json`,
- bank validation script,
- item/testlet manifest.

### Phase C. Scoring engine

Goal: implement online ability estimation in JavaScript.

Recommended implementation sequence:

1. **Prototype scoring engine**
   - item-level Rasch likelihood,
   - testlet-level administration,
   - provisional standard error,
   - sufficient for UI and algorithm debugging.

2. **Research-grade scoring engine**
   - integrate a testlet-aware likelihood,
   - use estimated testlet-effect variance from the ConQuest outputs,
   - compare outputs against the prototype scorer.

This two-stage scoring plan reduces implementation risk while keeping the long-term model defensible.

### Phase D. Adaptive selection engine

Goal: choose the next testlet based on the current estimate.

Recommended selection strategy for the first version:

- compute current `theta_hat`,
- compute testlet information or proximity score for all unused testlets,
- apply exclusion and balancing constraints,
- select the highest-scoring eligible testlet.

### Phase E. UI implementation

Goal: deliver a usable browser test.

Screens:

- start,
- instructions,
- testlet screen,
- progress / optional review notice,
- results,
- download logs.

### Phase F. Validation

Goal: show the adaptive test behaves coherently before human piloting.

Validation layers:

- deterministic unit tests,
- simulated examinee runs,
- recovery of known `theta` values,
- sensitivity checks for stopping rules,
- comparison of prototype vs research-grade scoring.

### Phase G. Pilot

Goal: check whether humans can actually use the test.

Pilot focus:

- interaction clarity,
- timing,
- dropout points,
- score stability,
- response distribution,
- exposure imbalance.

---

## 4. Data Structure Specification

## 4.1 Bank schema

The core bank should use a structure like this:

```json
{
  "bank_id": "uvlt_1k_form_b",
  "scale_status": "single_bank_unlinked",
  "model_version": "rasch_testlet_v1",
  "theta_prior": { "mean": 0.0, "sd": 1.0 },
  "testlets": [
    {
      "testlet_id": "uvlt_1k_t01",
      "level": "1k",
      "form": "B",
      "position_in_form": 1,
      "selection_difficulty": -3.13,
      "testlet_variance": null,
      "options": ["bar", "conversation", "neighbor", "rain", "rubbish", "shirt"],
      "definitions": [
        {
          "item_id": "uvlt_1k_t01_i01",
          "prompt": "person who lives nearby",
          "correct_option": "neighbor",
          "difficulty": -2.98
        },
        {
          "item_id": "uvlt_1k_t01_i02",
          "prompt": "things that are thrown away",
          "correct_option": "rubbish",
          "difficulty": -3.12
        },
        {
          "item_id": "uvlt_1k_t01_i03",
          "prompt": "type of clothing",
          "correct_option": "shirt",
          "difficulty": -3.29
        }
      ]
    }
  ]
}
```

## 4.2 Required fields

Each testlet must include:

- `testlet_id`
- `level`
- `position_in_form`
- `options`
- `definitions`
- `selection_difficulty`
- `difficulty` for each item

Each response log must include:

- `session_id`
- `timestamp`
- `testlet_id`
- `item_id`
- `response`
- `correct`
- `theta_before`
- `theta_after`
- `se_after`
- `selection_reason`

---

## 5. Selection Strategy

## 5.1 Start rule

Start with a mid-range testlet in the active bank.

For `1k`, this means selecting a testlet whose `selection_difficulty` is near the median of all available testlets.

## 5.2 Ongoing rule

At each step:

1. estimate current `theta_hat`,
2. compute candidate score for each unused testlet,
3. remove ineligible testlets,
4. choose best remaining testlet.

## 5.3 Candidate score

Initial pragmatic formula:

- `candidate_score = -abs(theta_hat - selection_difficulty)`

Improved formula:

- expected Fisher information under the chosen scoring model.

## 5.4 Constraints

Initial constraints:

- do not repeat administered testlets,
- maintain bank order randomness among near-ties,
- optionally enforce coverage rules if multiple levels are later linked.

Future constraints:

- exposure control,
- content balancing by level,
- maximum number of testlets from a single frequency band,
- item review policy.

---

## 6. Estimation Strategy

## 6.1 Prototype estimator

Use a simple Rasch-style estimator with full testlet administration:

- responses are collected for all 3 items in a testlet,
- person likelihood is updated after each testlet,
- `MAP` is recommended because it is stable early in the test.

Advantages:

- easy to implement in JavaScript,
- easy to debug,
- enough for UI integration and simulation.

Limitation:

- it does not fully account for testlet dependence.

## 6.2 Research-grade estimator

Implement a testlet-aware likelihood:

- latent structure includes `theta` and a random testlet effect,
- each administered testlet contributes an integrated likelihood,
- numerical integration can be done with fixed quadrature nodes in JavaScript.

Needed additional inputs:

- final estimated testlet variances from the ConQuest output,
- explicit mapping from testlet dimensions to administered clusters.

## 6.3 Recommendation

Use the following staged rule:

- `v0.1`: Rasch scoring + testlet administration,
- `v0.2`: testlet-aware scoring,
- `v1.0 study release`: only after comparison shows acceptable behavior.

---

## 7. Stopping Rules

The first release should use two simultaneous stopping conditions:

- `max_testlets`
- `target_se`

Recommended defaults for the prototype:

- `min_testlets = 4`
- `max_testlets = 8`
- `target_se = 0.35`

Operational logic:

- do not stop before `min_testlets`,
- stop once `se <= target_se`,
- otherwise stop at `max_testlets`.

These values should later be tuned by simulation.

---

## 8. Browser App Architecture

## 8.1 File structure

Recommended project structure:

```text
/app
  index.html
  /css
    styles.css
  /js
    app.js
    bank.js
    estimator.js
    selector.js
    storage.js
    export.js
    config.js
  /data
    uvlt_1k_bank.json
  /tests
    estimator.test.js
    selector.test.js
```

## 8.2 Module responsibilities

- `bank.js`: load and validate bank JSON
- `estimator.js`: update theta and standard error
- `selector.js`: choose next testlet
- `app.js`: manage session state and screen flow
- `storage.js`: session persistence and local recovery
- `export.js`: CSV / JSON output
- `config.js`: all tunable thresholds

## 8.3 Runtime behavior

Session flow:

1. load bank,
2. initialize prior,
3. select opening testlet,
4. collect 3 responses,
5. update estimate,
6. check stop rule,
7. select next testlet,
8. export result package.

---

## 9. Validation Plan

## 9.1 Static validation

Check before any administration:

- every testlet has exactly 6 options,
- every testlet has exactly 3 scored definitions,
- every scored definition maps to one valid option,
- no duplicate item ids,
- no missing difficulty values.

## 9.2 Algorithm validation

Run simulation using generated examinees:

- `theta ~ N(0,1)`
- response generation under Rasch first,
- later under testlet-aware simulation

Evaluate:

- bias,
- RMSE,
- average test length,
- exposure distribution,
- score monotonicity,
- stopping behavior.

## 9.3 Human pilot validation

Collect:

- completion rate,
- average completion time,
- response pattern anomalies,
- user confusion points,
- discrepancies between CAT and fixed-form score ordering.

---

## 10. Risks and Mitigations

### Risk 1. Cross-level scales are not linked

Impact:

- invalid full-range adaptive testing.

Mitigation:

- launch with `1k` only,
- or add explicit routing between independently scored subtests,
- or conduct linking study before combining levels.

### Risk 2. Testlet variance estimates are hard to recover cleanly

Impact:

- delays research-grade scoring.

Mitigation:

- use staged scoring implementation,
- compare approximate and testlet-aware scorers,
- document scoring assumptions explicitly.

### Risk 3. UVLT item text extraction is incomplete

Impact:

- cannot build the bank.

Mitigation:

- use downloaded UVLT PDFs as the authoritative content source,
- manually encode the first bank if needed,
- build validators to catch transcription errors.

### Risk 4. Adaptive test overuses easy items

Impact:

- poor coverage,
- weak interpretability.

Mitigation:

- enforce a minimum and maximum number of testlets,
- add balancing constraints,
- evaluate exposure under simulation before piloting.

### Risk 5. Prototype score is misinterpreted as operational score

Impact:

- invalid use.

Mitigation:

- label the output clearly as research-use only,
- include model version and caveats in exported reports.

---

## 11. Milestones

### Milestone 1. Specification freeze

Done when:

- scoring approach is fixed for `v0.1`,
- bank scope is fixed,
- JSON schema is fixed.

### Milestone 2. Bank preparation

Done when:

- one clean bank file exists,
- validation script passes,
- item content is manually checked.

### Milestone 3. Working prototype

Done when:

- browser app runs locally,
- testlet administration works,
- theta updates after each testlet,
- logs export correctly.

### Milestone 4. Simulation validation

Done when:

- simulation scripts produce bias and RMSE summaries,
- stop rules are tuned,
- major failure modes are understood.

### Milestone 5. Pilot release

Done when:

- pilot version is stable,
- instructions are clear,
- data export supports later analysis.

---

## 12. Immediate Next Actions

1. Create a **single-bank JSON** for `UVLT 1k`.
2. Recover or compute a **testlet-level selection difficulty** for each cluster.
3. Implement a **prototype MAP estimator** in JavaScript.
4. Implement a **nearest-difficulty testlet selector**.
5. Build a minimal browser UI that administers one testlet at a time.
6. Simulate at least `1,000` examinees before any human pilot.

---

## 13. Recommendation

The project should start with:

- `UVLT 1k`,
- `testlet-level adaptation`,
- `Rasch-style prototype scoring`,
- `HTML + CSS + JavaScript only`,
- explicit upgrade path to a testlet-aware likelihood.

This path is fast enough to build, psychometrically defensible as a prototype, and structured enough to evolve into a publishable methodological study.
