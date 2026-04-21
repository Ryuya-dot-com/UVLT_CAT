# LJT Native Reviewer Instructions (v0.6 — 3-candidate comparison)

Welcome. You're reviewing LLM-drafted candidate sentences for a timed
auditory LJT research study with Japanese EFL university students.

**Per-target structure**: 143 UVLT target words, each with:
- 3 appropriate candidates (sharing the same tested sense)
- 3 inappropriate candidates (all breaking the target's semantic or
  collocational constraints in different ways)
- → 6 candidates per target, 858 rows total

**Your task**:
1. For each candidate, rate naturalness / sense-disambiguation / fluency /
   collocation-violation (inapp only).
2. Per (target, condition) group of 3 candidates, select **one best** in
   the `best_candidate` column — the one that goes to the final stimulus.
3. If none of the 3 are acceptable, mark `best_candidate = "reject_all"`
   and explain why; the drafter will re-generate for that group.

## Background (30 seconds)

- Participants will hear each sentence (no visual text) and decide whether
  it is semantically appropriate.
- The **target word** is the UVLT item being tested (e.g., "apology").
- The **tested sense** is the specific meaning the UVLT prompt elicited
  (e.g., *capture* = "catch", not "grasp mentally").
- Appropriate sentences must force the **tested sense** unambiguously.
- Inappropriate sentences must violate the target's semantic / collocational
  constraints in a way no native speaker would naturally rescue via
  metaphor or idiom.

## Review questions (per candidate)

For each row in `02_comparison_sheet.csv`, fill columns:

### Q1 — Naturalness for the tested sense
- **Appropriate candidate**: sounds natural + forces the tested sense?
- **Inappropriate candidate**: violation clearly attributable to
  target+immediate-context relation?

### Q2 — Sense disambiguation
- **Appropriate**: any other sense read naturally? If yes → `revise`.
- **Inappropriate**: any alternate sense rescue the foil? If yes → `revise`.

### Q3 — Fluency & source of oddness
- **Appropriate**: fluent, non-target words well-chosen?
- **Inappropriate**: oddness caused by TARGET+context, not some bizarre
  non-target content word?

### Q4 — Collocation (inapp, foil_type=b_collocation only)
- Swapped adjacent word genuinely non-collocational AND not rescued by
  a different idiom / phrasal usage?

## Per-group decision columns

After rating all 3 candidates in a group:

- `best_candidate` ∈ {1, 2, 3, "blend", "reject_all"}
  - `1/2/3`: use this candidate as-is (or with minor revisions noted)
  - `"blend"`: combine features of 2+ candidates (specify in notes)
  - `"reject_all"`: all 3 need re-drafting (drafter will regenerate)
- `blend_specification`: if blend, describe the merge (free text)
- `group_notes`: overall comparative observations

## Response codes (per candidate)

- `accept` — usable (becomes a `best_candidate` contender)
- `revise` — salvageable; write fix in notes
- `reject` — unusable; specify rescue path

## Adjudication (after both reviewers complete)

The researcher applies §11.6 with these rules for the 3-candidate case:
- Both reviewers pick same `best_candidate` → final accept of that one
- Reviewers pick different candidates → researcher reviews both + chooses
  or blends
- Either reviewer says `reject_all` → LLM re-drafts all 3 for that group
- 3 iterations without convergence → item becomes
  `ljt_eligibility=exclude` (§5.4)

## Priority guidance

**Start with**: `03_critical_items.csv` (critical-priority items, extra
scrutiny — only 4 items but they gate the study's validity).

**Next**: `04_known_risks.md` (10 items where the drafter self-flagged
candidate 1 as potentially weaker; reviewers should explicitly consider
candidates 2/3).

**Then**: work through `02_comparison_sheet.csv` in order (sorted by
level / testlet).

**Also consult**: `06_infeasible_list.md` (items where 3 distinct
approaches were structurally unavailable; reviewers should expect cand 2/3
to differ from cand 1 only by lexical choice, not subtype).

## Estimated time

~12-14 hours per reviewer for 858 candidates (≈60-70 candidates/hour,
factoring in group-level comparison overhead). Split into multiple
sessions; spec-aligned reviewer pay should reflect this workload.

Thank you for your careful judgment — stimulus quality drives the entire
study's validity.
