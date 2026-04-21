"""
consolidate_annotations.py
---------------------------
Merge existing 67-item lexical annotations (from JP_Anchoring) with the new
83-item annotations generated for the LJT Q-matrix, producing complete
150-item JSON files and a fully-populated q_matrix.csv.

Inputs:
  ../../Analysis/JP_Anchoring/data/processed/lexical_loanword.json   (67)
  ../../Analysis/JP_Anchoring/data/processed/lexical_semantic.json   (67)
  ../../Analysis/JP_Anchoring/data/processed/lexical_frequency.json  (67)
  ../ljt/lexical_loanword_new83.json   (83)
  ../ljt/lexical_semantic_new83.json   (83)
  ../ljt/lexical_frequency_new83.json  (83)
  ../ljt/q_matrix_skeleton.csv         (300 rows)

Outputs:
  ../ljt/lexical_loanword_all150.json  (150)
  ../ljt/lexical_semantic_all150.json  (150)
  ../ljt/lexical_frequency_all150.json (150)
  ../ljt/q_matrix.csv                  (300 rows, lexical fields populated)

Usage:
  python tools/consolidate_annotations.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LJT_DIR = ROOT / "ljt"
ANALYSIS_DIR = ROOT.parent / "Analysis" / "JP_Anchoring" / "data" / "processed"


def load_json_array(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def consolidate(name: str) -> list[dict]:
    existing = load_json_array(ANALYSIS_DIR / f"lexical_{name}.json")
    new = load_json_array(LJT_DIR / f"lexical_{name}_new83.json")
    # Check for overlap (should be zero if annotation_gap was computed correctly)
    ew = {e["word"] for e in existing}
    nw = {e["word"] for e in new}
    overlap = ew & nw
    if overlap:
        raise ValueError(f"Unexpected overlap in {name}: {overlap}")
    combined = existing + new
    return combined


def write_json(data: list[dict], path: Path) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2),
                     encoding="utf-8")


def build_full_q_matrix() -> None:
    """Re-merge Q-matrix skeleton with the 150-item combined annotations."""
    # Load combined lookup dictionaries
    loan = {e["word"]: e for e in load_json_array(LJT_DIR / "lexical_loanword_all150.json")}
    sem = {e["word"]: e for e in load_json_array(LJT_DIR / "lexical_semantic_all150.json")}
    # frequency is not a Q-matrix column per §4.1 but we keep it for downstream
    # analysis (e.g., mean_context_logfreq validation)

    skeleton_path = LJT_DIR / "q_matrix_skeleton.csv"
    with skeleton_path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    missing: set[str] = set()
    for r in rows:
        w = r["target_word"]
        if w in loan:
            r["loanword_status"] = loan[w].get("loanword_status", "")
            r["cognate_ease"] = loan[w].get("cognate_ease", "")
        else:
            missing.add(w)
        if w in sem:
            r["translation_ambiguity_JP"] = sem[w].get("translation_ambiguity_JP", "")
            raw_poly = sem[w].get("polysemy", "")
            tier_hint = {
                "mono": "dominant",
                "low_poly": "dominant",
                "high_poly": "minority",
            }.get(raw_poly, "")
            if tier_hint:
                r["polysemy_tier"] = tier_hint
        else:
            missing.add(w)

    assert not missing, f"Still missing after consolidation: {missing}"

    out_path = LJT_DIR / "q_matrix.csv"
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Wrote {out_path} ({len(rows)} rows, 0 missing annotations)")


def main() -> None:
    print("Consolidating lexical annotations (67 + 83 = 150)...")
    for name in ["loanword", "semantic", "frequency"]:
        combined = consolidate(name)
        out = LJT_DIR / f"lexical_{name}_all150.json"
        write_json(combined, out)
        words = {e["word"] for e in combined}
        assert len(combined) == 150, f"{name}: {len(combined)} != 150"
        assert len(words) == 150, f"{name}: {150 - len(words)} duplicate words"
        print(f"  {name}: {len(combined)} entries written to {out.name}")

    print("\nBuilding full Q-matrix (300 rows with 150-item annotations)...")
    build_full_q_matrix()

    # Summary statistics
    loan = load_json_array(LJT_DIR / "lexical_loanword_all150.json")
    sem = load_json_array(LJT_DIR / "lexical_semantic_all150.json")
    freq = load_json_array(LJT_DIR / "lexical_frequency_all150.json")

    from collections import Counter
    print("\n=== 150-item summary ===")
    print("Loanword status:", Counter(e["loanword_status"] for e in loan))
    print("Cognate ease:   ", Counter(e["cognate_ease"] for e in loan))
    print("Polysemy:       ", Counter(e["polysemy"] for e in sem))
    print("Concreteness:   ", Counter(e["concreteness"] for e in sem))
    print("Translation:    ", Counter(e["translation_ambiguity_JP"] for e in sem))
    print("COCA band:      ", Counter(e["coca_rank_band"] for e in freq))
    print("JP eikyo:       ", Counter(e["jp_eikyo"] for e in freq))


if __name__ == "__main__":
    main()
