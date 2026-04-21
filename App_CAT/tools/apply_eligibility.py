"""
apply_eligibility.py
--------------------
Merge Q-4 eligibility results into q_matrix.csv. Populates:
  - ljt_eligibility (eligible / careful / exclude)
  - review_priority (routine / careful / critical)
  - foil_subtype   (hint from screener, refined later at drafting)

Also produces filtered views:
  ../ljt/q_matrix_eligible.csv   (eligible + careful, for drafting)
  ../ljt/q_matrix_excluded.csv   (exclude set, for audit trail)

Usage:
  python tools/apply_eligibility.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
LJT = ROOT / "ljt"

Q_MATRIX = LJT / "q_matrix.csv"
ELIGIBILITY = LJT / "eligibility_results.json"
OUT_Q = LJT / "q_matrix.csv"  # overwritten
OUT_ELIGIBLE = LJT / "q_matrix_eligible.csv"
OUT_EXCLUDED = LJT / "q_matrix_excluded.csv"


def main() -> None:
    print(f"Loading eligibility results from {ELIGIBILITY}...")
    results = json.loads(ELIGIBILITY.read_text(encoding="utf-8"))
    by_item = {r["item_id"]: r for r in results}
    print(f"  {len(results)} eligibility decisions")

    print(f"Loading Q-matrix from {Q_MATRIX}...")
    with Q_MATRIX.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    print(f"  {len(rows)} rows")

    updated = 0
    for r in rows:
        decision = by_item.get(r["item_id"])
        if decision is None:
            continue
        r["ljt_eligibility"] = decision["eligibility"]
        r["review_priority"] = decision.get("review_priority_recommendation",
                                             "routine")
        # foil_subtype is a screening hint; overwrite only if not already set
        if not r.get("foil_subtype"):
            sug = decision.get("suggested_foil_type_if_eligible") or ""
            r["foil_subtype"] = sug if sug in {"a_selectional",
                                                "b_collocation",
                                                "either"} else ""
        updated += 1

    # Write back q_matrix.csv
    fieldnames = list(rows[0].keys())
    with OUT_Q.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {OUT_Q} (updated {updated} rows)")

    # Filtered outputs
    eligible_rows = [r for r in rows if r["ljt_eligibility"] in {"eligible", "careful"}]
    excluded_rows = [r for r in rows if r["ljt_eligibility"] == "exclude"]

    with OUT_ELIGIBLE.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(eligible_rows)
    with OUT_EXCLUDED.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(excluded_rows)
    print(f"Wrote {OUT_ELIGIBLE} ({len(eligible_rows)} rows)")
    print(f"Wrote {OUT_EXCLUDED} ({len(excluded_rows)} rows)")

    # Summary
    from collections import Counter
    by_level_elig: dict = {}
    for r in rows:
        if r["condition"] != "appropriate":
            continue
        by_level_elig.setdefault(r["target_level"], Counter())[
            r["ljt_eligibility"]
        ] += 1
    print("\n=== Eligibility distribution (unique targets) ===")
    print(f"{'Level':<6} {'eligible':<10} {'careful':<10} {'exclude':<10}")
    for lvl in ["1K", "2K", "3K", "4K", "5K"]:
        c = by_level_elig[lvl]
        print(f"{lvl:<6} {c['eligible']:<10} {c['careful']:<10} {c['exclude']:<10}")

    # Per-priority counts
    prio: Counter = Counter()
    for r in rows:
        if r["condition"] == "appropriate":
            prio[r["review_priority"]] += 1
    print(f"\n=== Review priority distribution ===")
    for p, n in prio.most_common():
        print(f"  {p}: {n}")


if __name__ == "__main__":
    main()
