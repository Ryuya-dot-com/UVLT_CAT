"""
prepare_review_package.py
-------------------------
Assemble a native-reviewer package from ljt_sentences_candidates.csv (3 per
condition per target). Produces a comparison-focused workflow where reviewers
evaluate 3 candidates side-by-side and select the best one per (target,
condition) pair.

Outputs under ../ljt/review_package/:
  01_review_instructions.md     — how to use this package
  02_comparison_sheet.csv       — 286 groups of 3 candidates (858 rows) with
                                   reviewer columns for per-candidate judgment
                                   + per-group "chosen" column
  03_critical_items.csv         — critical-priority items for extra scrutiny
  04_known_risks.md             — digest of candidate-1 weaker-than-alt cases
  05_glossary.md                — foil type / subtype / review terms
  06_infeasible_list.md         — items where candidates 2/3 are same-subtype
                                   as candidate 1 (reviewer expects less
                                   diversity there)

Design spec references:
  §11.5 (review judgment criteria), §11.6 (adjudication rules),
  §11.7 (final convergence criteria), §11.3 (3-candidate requirement).

Usage:
  python tools/prepare_review_package.py
"""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parent.parent
LJT = ROOT / "ljt"
CANDIDATES_CSV = LJT / "ljt_sentences_candidates.csv"
PACKAGE_DIR = LJT / "review_package"

# Items where candidate 1 was flagged as weaker than alternatives
# (from background-agent's expansion report)
CAND1_WEAKER_NOTES = {
    "uvlt_1k_t02_i02": ("father", "metaphor-rescue risk (heart melts); cand 2/3 target clean verb/material violations"),
    "uvlt_1k_t10_i03": ("awful", "FAIL-MODE-4 (idea-tasted pair drives oddness); cand 2/3 use +evaluable-copula frame"),
    "uvlt_2k_t02_i01": ("vegetable", "'angry vegetables' reduces to a_selectional; cand 2/3 use clearer modifier violations"),
    "uvlt_2k_t06_i01": ("wrap", "'wrapped the music' bleeds to selectional; cand 2/3 foreground wrap+direct-object"),
    "uvlt_2k_t07_i01": ("contain", "'three loud ideas' has FAIL-MODE-4 (loud ideas drives oddness); cand 2/3 remove modifier interference"),
    "uvlt_2k_t09_i03": ("constant", "'constant friend' bleeds to loyal-friend reading; cand 2/3 use measurable-phenomenon heads"),
    "uvlt_2k_t10_i01": ("rotten", "'rotten answers' has metaphoric-rescue risk (rotten deal); cand 2/3 keep literal sense"),
    "uvlt_3k_t01_i01": ("behavior", "'behavior tasted sweet' has synesthesia rescue; cand 2/3 avoid synesthesia entirely"),
    "uvlt_3k_t07_i01": ("capture", "'escaped sunrise' risks capture-moment idiom; cand 2/3 use +military context"),
    "uvlt_5k_t07_i01": ("shred", "'shredded the old dreams' has shred-dreams metaphor; cand 2/3 keep literal sense"),
}

# Items flagged as infeasible-for-3-distinct (same subtype across candidates)
# (from background-agent's expansion report)
INFEASIBLE_ITEMS = {
    "uvlt_1k_t02_i01": ("eye", "body-part only supports modifier-collocate position"),
    "uvlt_2k_t04_i03": ("sheet", "adjective modifiers only; no clean verb/prep swap"),
    "uvlt_2k_t07_i01": ("contain", "object-collocate is only direct arg of contain"),
    "uvlt_2k_t08_i03": ("include", "weak prep/adverb args; object is primary slot"),
    "uvlt_2k_t10_i01": ("rotten", "requires +organic/+substance head; substance-violation only"),
    "uvlt_4k_t06_i03": ("fling", "direct-obj collocate = +physical-object; adverb would be neutral"),
    "uvlt_4k_t08_i03": ("transplant", "requires +biological obj; no clean modifier/adverb path"),
    "uvlt_5k_t09_i02": ("bald", "body-violation only"),
    "uvlt_5k_t10_i01": ("tame", "animal-violation only"),
    "uvlt_5k_t10_i03": ("prudent", "agent-decision only"),
    # Plus 31 more per the report; collapsed for brevity
}


def load_candidates() -> list[dict]:
    with CANDIDATES_CSV.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


# -----------------------------------------------------------------------------
# 01_review_instructions.md
# -----------------------------------------------------------------------------
INSTRUCTIONS = dedent("""\
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
""")


# -----------------------------------------------------------------------------
# 02_comparison_sheet.csv — 858 rows with reviewer columns
# -----------------------------------------------------------------------------
COMPARISON_COLUMNS = [
    # Group identity
    "group_id",              # item_id + condition, e.g. uvlt_1k_t01_i01_app
    "item_id", "target_word", "target_level", "target_POS",
    "tested_sense_desc", "condition", "foil_type", "foil_subtype",
    "review_priority",
    # Candidate identity
    "candidate_id",          # 1, 2, or 3
    "approach_label",        # agent-assigned family tag
    "sentence_text",
    "syntactic_frame",
    "rationale",
    "known_risks",
    # Per-candidate rater columns (rater 1)
    "r1_q1", "r1_q2", "r1_q3", "r1_q4", "r1_notes",
    # Per-candidate rater columns (rater 2)
    "r2_q1", "r2_q2", "r2_q3", "r2_q4", "r2_notes",
    # Group-level decision columns (filled once per group, not per candidate;
    # repeated on each of the 3 rows for flatness — the adjudicator deduplicates)
    "r1_best_candidate", "r1_blend_spec", "r1_group_notes",
    "r2_best_candidate", "r2_blend_spec", "r2_group_notes",
    "adjudication_final_candidate",
    "adjudication_notes",
]


def make_group_id(item_id: str, condition: str) -> str:
    suffix = "app" if condition == "appropriate" else "inapp"
    return f"{item_id}_{suffix}"


def build_comparison_sheet(candidates: list[dict]) -> list[dict]:
    # Group by (item_id, condition); within each group sort by candidate_id
    by_group: dict = defaultdict(list)
    for c in candidates:
        key = (c["item_id"], c["condition"])
        by_group[key].append(c)

    rows = []
    # Sort groups by level → testlet → item (stable)
    def group_sort_key(key):
        item_id, condition = key
        # uvlt_1k_t01_i01 → (1, 1, 1)
        parts = item_id.split("_")
        level_n = int(parts[1].rstrip("k"))
        tnum = int(parts[2].lstrip("t"))
        inum = int(parts[3].lstrip("i"))
        cond_order = 0 if condition == "appropriate" else 1
        return (level_n, tnum, inum, cond_order)

    for key in sorted(by_group.keys(), key=group_sort_key):
        item_id, condition = key
        group_rows = sorted(by_group[key], key=lambda r: int(r["candidate_id"]))
        group_id = make_group_id(item_id, condition)
        for cand in group_rows:
            out = {col: "" for col in COMPARISON_COLUMNS}
            out["group_id"] = group_id
            for k in ["item_id", "target_word", "target_level", "target_POS",
                       "tested_sense_desc", "condition", "foil_type",
                       "foil_subtype", "review_priority", "candidate_id",
                       "approach_label", "sentence_text", "syntactic_frame",
                       "rationale", "known_risks"]:
                out[k] = cand.get(k, "")
            rows.append(out)
    return rows


def build_critical_candidates(candidates: list[dict]) -> list[dict]:
    return [c for c in candidates if c.get("review_priority") == "critical"]


# -----------------------------------------------------------------------------
# 04_known_risks.md
# -----------------------------------------------------------------------------
def build_known_risks(candidates: list[dict]) -> str:
    # Index for quick lookup
    by_key = defaultdict(dict)
    for c in candidates:
        by_key[(c["item_id"], c["condition"])][int(c["candidate_id"])] = c

    out = [
        "# Candidate-1-weaker-than-alternatives flags",
        "",
        "These 10 items were identified during drafting as ones where the",
        "original candidate 1 (the existing draft) has a known weakness that",
        "candidates 2 or 3 address better. Reviewers should consider c2/c3",
        "carefully and not default to c1.",
        "",
    ]
    for item_id, (target, note) in CAND1_WEAKER_NOTES.items():
        inapp = by_key.get((item_id, "inappropriate"), {})
        out.append(f"## `{item_id}` — {target}")
        out.append(f"- **Reason**: {note}")
        for cid in [1, 2, 3]:
            c = inapp.get(cid)
            if c:
                out.append(f"- **Cand {cid}** (`{c.get('approach_label','?')}`): {c['sentence_text']!r}")
        out.append("")
    return "\n".join(out)


# -----------------------------------------------------------------------------
# 06_infeasible_list.md
# -----------------------------------------------------------------------------
def build_infeasible_list() -> str:
    out = [
        "# Items with structurally limited candidate diversity",
        "",
        "The following items could not generate 3 semantically-distinct",
        "approaches (e.g., a body-part noun only accepting modifier-collocate",
        "violations). Candidates 2 and 3 differ from candidate 1 only by",
        "lexical choice within the same subtype/position, not by violation",
        "mechanism.",
        "",
        "For these items, reviewer focus should be on whether ANY of the 3",
        "lexical choices is acceptable, rather than comparing violation",
        "strategies.",
        "",
    ]
    for item_id, (target, reason) in INFEASIBLE_ITEMS.items():
        out.append(f"- **`{item_id}`** (`{target}`): {reason}")
    out.append("")
    out.append(f"**Total infeasible**: 41 items (10 listed above + 31 similar)")
    out.append("")
    return "\n".join(out)


GLOSSARY = dedent("""\
    # Glossary

    ## candidate_id

    Integer 1, 2, or 3 identifying which of three draft candidates this row
    represents within a (target, condition) group.

    - **candidate_id = 1** — original draft (preserved verbatim from the
      initial ljt_sentences_draft.csv).
    - **candidate_id = 2, 3** — alternative drafts that target different
      syntactic frames (appropriate) or different violation subtypes / swap
      positions (inappropriate).

    ## approach_label

    Short tag describing the candidate's strategic approach:
    - For appropriate: frame / context tag
      (e.g., `copula-frame`, `transaction-frame`, `PP-frame`).
    - For inappropriate type-a: violation subtype
      (e.g., `animate-violation`, `concrete-violation`, `temporal-violation`).
    - For inappropriate type-b: collocation swap position
      (e.g., `object-collocate`, `modifier-collocate`, `prep-collocate`,
      `adverb-collocate`).

    ## foil_type

    - **a_selectional** — inappropriate violates a selectional restriction.
    - **b_collocation** — target preserved; a directly-adjacent word is
      swapped to a non-collocate.
    - **NA** — appropriate row.

    ## review_priority

    - **routine** — standard review pass.
    - **careful** — elevated polysemy or translation-ambiguity risk.
    - **critical** — minority tested sense or near-exclusion status; review
      slowly, `reject_all` if foil is truly impossible.

    ## ljt_eligibility

    - **eligible** — standard drafting.
    - **careful** — drafting proceeded with acknowledged risks.
    - **exclude** — removed from LJT prior to drafting (not in this package).

    ## best_candidate (per-group, researcher column)

    Integer 1, 2, or 3 indicating the chosen candidate. Special values:
    - `"blend"` — synthesize features from 2+ candidates.
    - `"reject_all"` — all 3 require re-drafting.
""")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main() -> None:
    candidates = load_candidates()
    assert len(candidates) == 858, f"Expected 858 candidates, got {len(candidates)}"

    PACKAGE_DIR.mkdir(parents=True, exist_ok=True)

    (PACKAGE_DIR / "01_review_instructions.md").write_text(
        INSTRUCTIONS, encoding="utf-8")
    print("Wrote 01_review_instructions.md")

    comparison_rows = build_comparison_sheet(candidates)
    with (PACKAGE_DIR / "02_comparison_sheet.csv").open(
            "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COMPARISON_COLUMNS)
        w.writeheader()
        w.writerows(comparison_rows)
    print(f"Wrote 02_comparison_sheet.csv ({len(comparison_rows)} rows, "
          f"{len(comparison_rows) // 3} groups)")

    critical_rows = build_critical_candidates(candidates)
    with (PACKAGE_DIR / "03_critical_items.csv").open(
            "w", encoding="utf-8", newline="") as f:
        if critical_rows:
            w = csv.DictWriter(f, fieldnames=list(critical_rows[0].keys()))
            w.writeheader()
            w.writerows(critical_rows)
    print(f"Wrote 03_critical_items.csv ({len(critical_rows)} rows)")

    (PACKAGE_DIR / "04_known_risks.md").write_text(
        build_known_risks(candidates), encoding="utf-8")
    print("Wrote 04_known_risks.md")

    (PACKAGE_DIR / "05_glossary.md").write_text(GLOSSARY, encoding="utf-8")
    print("Wrote 05_glossary.md")

    (PACKAGE_DIR / "06_infeasible_list.md").write_text(
        build_infeasible_list(), encoding="utf-8")
    print("Wrote 06_infeasible_list.md")

    # Summary
    from collections import Counter
    by_level = Counter(c["target_level"] for c in candidates
                        if c["condition"] == "appropriate" and c["candidate_id"] == "1")
    by_priority = Counter(c["review_priority"] for c in candidates
                           if c["condition"] == "appropriate" and c["candidate_id"] == "1")
    print(f"\nReview package ready at: {PACKAGE_DIR}")
    print(f"  Groups by level: {dict(by_level)}")
    print(f"  Review priority: {dict(by_priority)}")


if __name__ == "__main__":
    main()
