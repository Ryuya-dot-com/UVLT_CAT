"""
merge_lexical_annotations.py
----------------------------
Merge existing 67-item lexical annotations from JP_Anchoring into the
Q-matrix skeleton, and produce a gap report identifying UVLT targets that
need fresh annotation.

Inputs:
  ../ljt/q_matrix_skeleton.csv (300 rows from generate_q_matrix.py)
  ../../Analysis/JP_Anchoring/data/processed/lexical_loanword.json  (67 entries)
  ../../Analysis/JP_Anchoring/data/processed/lexical_semantic.json  (67 entries)
  ../../Analysis/JP_Anchoring/data/processed/lexical_frequency.json (67 entries)

Outputs:
  ../ljt/q_matrix_merged.csv     (300 rows; annotated where possible)
  ../ljt/annotation_gap.csv      (list of UVLT targets needing new annotation)
  ../ljt/annotation_gap.json     (same, LLM-friendly JSON with prompt template)

The annotation gap JSON carries per-target context (level, POS, tested sense,
sibling targets in the same testlet) to ease careful LLM + bilingual review.

Usage:
  python tools/merge_lexical_annotations.py
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
LJT_DIR = ROOT / "ljt"
ANALYSIS_DIR = ROOT.parent / "Analysis" / "JP_Anchoring" / "data" / "processed"

SKELETON_CSV = LJT_DIR / "q_matrix_skeleton.csv"
OUT_MERGED = LJT_DIR / "q_matrix_merged.csv"
OUT_GAP_CSV = LJT_DIR / "annotation_gap.csv"
OUT_GAP_JSON = LJT_DIR / "annotation_gap.json"

LEXICAL_JSONS = {
    "loanword": ANALYSIS_DIR / "lexical_loanword.json",
    "semantic": ANALYSIS_DIR / "lexical_semantic.json",
    "frequency": ANALYSIS_DIR / "lexical_frequency.json",
}


# -----------------------------------------------------------------------------
# Loaders
# -----------------------------------------------------------------------------
def load_lexical(path: Path) -> dict[str, dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {entry["word"]: entry for entry in data}


def load_q_matrix(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


# -----------------------------------------------------------------------------
# Merger
# -----------------------------------------------------------------------------
def fill_annotations(rows: list[dict], lex: dict[str, dict[str, dict]]) -> tuple[list[dict], set[str]]:
    """Fill loanword_status, cognate_ease, translation_ambiguity_JP from the
    existing 67-item annotations. Return (merged_rows, set_of_unannotated_targets).
    """
    loanword = lex["loanword"]
    semantic = lex["semantic"]
    # frequency annotations have no columns in the Q-matrix per §4.1 / §12.1
    # (coca_rank_band etc. are kept separately as descriptor-only), but we still
    # surface whether they're present for completeness in the gap report.

    unannotated: set[str] = set()
    for r in rows:
        w = r["target_word"]
        if w in loanword:
            r["loanword_status"] = loanword[w].get("loanword_status", "")
            r["cognate_ease"] = loanword[w].get("cognate_ease", "")
        else:
            unannotated.add(w)

        if w in semantic:
            r["translation_ambiguity_JP"] = semantic[w].get("translation_ambiguity_JP", "")
            # polysemy from existing JSON is a coarse categorical — keep as a
            # starting hint for the Q-matrix polysemy_tier (to be refined by §5.2)
            raw_poly = semantic[w].get("polysemy", "")
            # map existing labels to §5.1 tier names as a hint only
            tier_hint = {
                "mono": "dominant",
                "low_poly": "dominant",
                "high_poly": "minority",  # conservative: high_poly -> critical review
            }.get(raw_poly, "")
            if tier_hint:
                r["polysemy_tier"] = tier_hint  # overwritten later by §5.2 3-layer process
        else:
            unannotated.add(w)

    return rows, unannotated


# -----------------------------------------------------------------------------
# Gap report with LLM-friendly context per target
# -----------------------------------------------------------------------------
def build_gap_report(rows: list[dict], unannotated: set[str]) -> list[dict]:
    """For each unannotated target, include its testlet context + sibling targets
    (other answers in the same testlet) so the annotator / LLM has enough cues.
    """
    # Group appropriate rows by testlet
    by_testlet: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        if r["condition"] != "appropriate":
            continue
        tid = r["item_id"].rsplit("_", 1)[0]  # e.g., uvlt_1k_t01
        by_testlet[tid].append(r)

    gap_rows: list[dict] = []
    for r in rows:
        if r["condition"] != "appropriate":
            continue
        w = r["target_word"]
        if w not in unannotated:
            continue
        tid = r["item_id"].rsplit("_", 1)[0]
        siblings = [
            (s["target_word"], s["tested_sense_desc"])
            for s in by_testlet[tid]
            if s["target_word"] != w
        ]
        gap_rows.append({
            "item_id": r["item_id"],
            "target_word": w,
            "target_level": r["target_level"],
            "target_POS": r["target_POS"],
            "tested_sense_desc": r["tested_sense_desc"],
            "sibling_targets": "; ".join(f"{sw} ({sd})" for sw, sd in siblings),
        })
    return gap_rows


LLM_PROMPT_TEMPLATE = """\
You are annotating a UVLT target word for a Japanese EFL vocabulary study.

Target: {target_word}
UVLT level: {target_level}
Part of speech: {target_POS}
Tested sense (from UVLT prompt): {tested_sense_desc}
Sibling targets in the same testlet (for context): {sibling_targets}

Produce three JSON entries in the schemas below. Base judgments on the *tested
sense* only. If a field is uncertain, mark it explicitly in notes.

1) lexical_loanword entry:
   {{
     "word": "{target_word}",
     "most_common_JP": "<most common Japanese translation for the tested sense>",
     "loanword_status": "native|loanword|dual",
     "cognate_ease": "low|medium|high",
     "notes": "<1-2 sentences>"
   }}

2) lexical_semantic entry:
   {{
     "word": "{target_word}",
     "concreteness": "concrete|abstract",
     "polysemy": "mono|low_poly|high_poly",
     "cultural_tilt": "universal|business_academic|western|japanese",
     "school_curriculum_JP": "early|mid|late|unknown",
     "translation_ambiguity_JP": "one_to_one|one_to_many|no_direct",
     "notes": "<1-2 sentences>"
   }}

3) lexical_frequency entry:
   {{
     "word": "{target_word}",
     "coca_rank_band": "top_1K|top_2K|top_3K|top_4K|top_5K|top_10K|top_20K|beyond_20K",
     "bnc_band": "top_1K|top_2K|top_3K|top_4K|top_5K|top_10K|top_20K|beyond_20K",
     "genre_skew": "balanced|fiction|academic|spoken|technical",
     "jp_eikyo": "low|medium|high",
     "notes": "<1-2 sentences>"
   }}
"""


# -----------------------------------------------------------------------------
# Output
# -----------------------------------------------------------------------------
def write_merged_csv(rows: list[dict], path: Path) -> None:
    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_gap_files(gap_rows: list[dict], csv_path: Path, json_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    # CSV for human review
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(gap_rows[0].keys()))
        writer.writeheader()
        writer.writerows(gap_rows)

    # JSON with embedded LLM prompt per target
    payload = [
        {**g, "llm_prompt": LLM_PROMPT_TEMPLATE.format(**g)}
        for g in gap_rows
    ]
    json_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    print(f"Loading Q-matrix skeleton from {SKELETON_CSV}...")
    rows = load_q_matrix(SKELETON_CSV)
    print(f"  {len(rows)} rows loaded")

    print(f"Loading existing lexical annotations from {ANALYSIS_DIR}...")
    lex = {name: load_lexical(p) for name, p in LEXICAL_JSONS.items()}
    for name, entries in lex.items():
        print(f"  {name}: {len(entries)} entries")

    print("\nMerging annotations into Q-matrix...")
    rows, unannotated = fill_annotations(rows, lex)

    # Count unique target words (appropriate rows only = 150 items)
    all_targets = {r["target_word"] for r in rows if r["condition"] == "appropriate"}
    annotated_targets = all_targets - unannotated
    print(f"  Targets with existing annotation: {len(annotated_targets)} / {len(all_targets)}")
    print(f"  Targets needing new annotation:   {len(unannotated)} / {len(all_targets)}")

    print(f"\nWriting merged Q-matrix to {OUT_MERGED}...")
    write_merged_csv(rows, OUT_MERGED)

    print("Building gap report...")
    gap_rows = build_gap_report(rows, unannotated)
    print(f"  {len(gap_rows)} targets need new annotation")

    print(f"Writing gap CSV to {OUT_GAP_CSV}...")
    print(f"Writing gap JSON (with LLM prompts) to {OUT_GAP_JSON}...")
    write_gap_files(gap_rows, OUT_GAP_CSV, OUT_GAP_JSON)

    # Distribution of unannotated items
    print("\nDistribution of unannotated targets by level / POS:")
    from collections import Counter
    dist = Counter((g["target_level"], g["target_POS"]) for g in gap_rows)
    for key in sorted(dist):
        print(f"  {key[0]} {key[1]:<10}: {dist[key]}")

    print("\nDone.")


if __name__ == "__main__":
    main()
