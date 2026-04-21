"""
generate_q_matrix.py
--------------------
Generate Q-matrix skeleton (300 rows = 150 UVLT items x 2 conditions) from
BAND_BLUEPRINTS in ../script.js. Output to ../ljt/q_matrix_skeleton.csv.

Q-matrix columns populated at this stage:
  - item_id, target_word, target_level, target_POS
  - target_position_in_testlet, tested_sense_desc
  - condition, foil_type

All other columns (sentence_text, lexical_*, dominance, etc.) left blank for
subsequent stages (§5, §11, §12 in design_ljt_spec.md v0.5).

Foil type balancing rule (per design spec §3.4):
  - adjective targets -> foil_type = a_selectional (metaphor rescue avoidance)
  - verb targets      -> foil_type = b_collocation (richer collocate sets)
  - noun targets      -> alternate by testlet index to achieve 15a + 15b / level
Resulting per-level distribution:
  adj(6) * a + verb(9) * b + noun(9a + 6b) = 15 (a) + 15 (b).

Usage:
  python tools/generate_q_matrix.py
"""

from __future__ import annotations

import csv
import re
from pathlib import Path


# -----------------------------------------------------------------------------
# BAND_BLUEPRINTS parser (reads from script.js so single source of truth)
# -----------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
SCRIPT_JS = ROOT / "script.js"
OUT_CSV = ROOT / "ljt" / "q_matrix_skeleton.csv"

BAND_ORDER = ["1k", "2k", "3k", "4k", "5k"]


def parse_band_blueprints(js_path: Path) -> dict:
    """Extract BAND_BLUEPRINTS object from script.js using regex + ad-hoc JS-JSON.

    The blueprints are a JS object literal with double-quoted keys already, so
    we convert it to a JSON-parseable form by:
      * trimming trailing commas,
      * removing ES5 property shorthand (none used here),
      * taking the balanced braces after `const BAND_BLUEPRINTS = `.
    """
    src = js_path.read_text(encoding="utf-8")

    # Find the literal start
    m = re.search(r"const\s+BAND_BLUEPRINTS\s*=\s*\{", src)
    if not m:
        raise RuntimeError("BAND_BLUEPRINTS assignment not found in script.js")
    start = m.end() - 1  # position of the opening {

    # Scan for matching closing brace
    depth = 0
    in_string = False
    string_char = ""
    i = start
    while i < len(src):
        ch = src[i]
        if in_string:
            if ch == "\\":
                i += 2
                continue
            if ch == string_char:
                in_string = False
        else:
            if ch in ('"', "'"):
                in_string = True
                string_char = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        i += 1
    else:
        raise RuntimeError("Could not find closing brace of BAND_BLUEPRINTS")

    raw = src[start:end]

    # Convert JS object literal -> JSON
    # (1) unquoted keys: partOfSpeech, options, prompts, answers, "1k" etc are
    #     already double-quoted as keys in script.js, but inner keys are unquoted.
    raw = re.sub(r"(\w+)\s*:", lambda mm: f'"{mm.group(1)}":', raw)
    # (2) Remove trailing commas inside arrays/objects
    raw = re.sub(r",(\s*[}\]])", r"\1", raw)
    # (3) Restore double-quoting of top-level band keys that got mangled
    #     (our regex in (1) may have touched "1k": -> ""1k"":, fix)
    raw = raw.replace('""', '"')

    import json
    data = json.loads(raw)
    return data


# -----------------------------------------------------------------------------
# Foil-type balancing
# -----------------------------------------------------------------------------
def assign_foil_type(pos: str, testlet_index: int) -> str:
    """Deterministic foil_type per design spec §3.4.

    Per-level totals (5 noun testlets, 3 verb testlets, 2 adjective testlets):
      - adjective: all 6 items -> a_selectional
      - verb:      all 9 items -> b_collocation
      - noun:      alternate by testlet index (even -> a, odd -> b)
                   5 testlets * 3 items -> testlets 0,2,4 = 9(a); testlets 1,3 = 6(b)
      Totals: 15 (a_selectional) + 15 (b_collocation) per level.
    """
    if pos == "adjective":
        return "a_selectional"
    if pos == "verb":
        return "b_collocation"
    if pos == "noun":
        # testlet_index 0-based across the 10 testlets per band;
        # noun testlets in UVLT are at indices 0..4 (first 5)
        return "a_selectional" if testlet_index % 2 == 0 else "b_collocation"
    raise ValueError(f"Unknown POS: {pos!r}")


# -----------------------------------------------------------------------------
# Q-matrix row construction
# -----------------------------------------------------------------------------
# Columns are a superset of those defined in design_ljt_spec.md §4.1.
# Stage 1 fills a subset; other columns stay blank for subsequent stages.
QMATRIX_COLUMNS = [
    # Identity
    "item_id",
    "target_word",
    "target_level",
    "target_position_in_testlet",
    "target_POS",
    "tested_sense_desc",
    # Condition / foil
    "condition",
    "foil_type",
    "foil_subtype",
    # Context (filled at sentence drafting)
    "sentence_text",
    "sentence_length",
    "target_position_in_sentence",
    "syntactic_frame",
    "n_context_non_1K",
    "context_max_band",
    "mean_context_logfreq",
    "coca_bigram_max_mi",
    # Matching
    "matching_quality",
    "length_diff",
    "logfreq_diff",
    # Polysemy (§5, filled later)
    "n_wordnet_senses",
    "tested_sense_dominance",
    "polysemy_tier",
    "dict_1st_sense_match",
    "ljt_eligibility",
    # JP-specific (§12, filled from lexical_*.json extension)
    "loanword_status",
    "cognate_ease",
    "translation_ambiguity_JP",
    # Audio (filled by generate_ljt_audio.py)
    "audio_file",
    "audio_duration_ms",
    "audio_sha256",
    # Review workflow
    "llm_draft_version",
    "native_rater_1_decision",
    "native_rater_2_decision",
    "final_decision",
    "review_priority",
    "revision_notes",
]


def build_item_id(band: str, testlet_idx: int, position: int) -> str:
    """UVLT canonical id, matching script.js buildTestBank() convention."""
    return f"uvlt_{band}_t{testlet_idx + 1:02d}_i{position + 1:02d}"


def build_rows(blueprints: dict) -> list[dict]:
    """Generate 300 Q-matrix skeleton rows from BAND_BLUEPRINTS."""
    rows: list[dict] = []
    for band in BAND_ORDER:
        testlets = blueprints[band]
        assert len(testlets) == 10, f"Band {band} has {len(testlets)} testlets"
        for testlet_idx, testlet in enumerate(testlets):
            pos = testlet["partOfSpeech"]
            prompts = testlet["prompts"]
            answers = testlet["answers"]
            assert len(prompts) == 3 and len(answers) == 3
            foil_type = assign_foil_type(pos, testlet_idx)
            for item_pos in range(3):
                item_id = build_item_id(band, testlet_idx, item_pos)
                target = answers[item_pos]
                sense = prompts[item_pos]
                base = {
                    col: "" for col in QMATRIX_COLUMNS
                }
                base["item_id"] = item_id
                base["target_word"] = target
                base["target_level"] = band.upper()
                base["target_position_in_testlet"] = item_pos + 1
                base["target_POS"] = pos
                base["tested_sense_desc"] = sense
                base["review_priority"] = "routine"  # upgraded later by §5.4

                # Appropriate row
                app_row = dict(base)
                app_row["condition"] = "appropriate"
                app_row["foil_type"] = "NA"
                rows.append(app_row)

                # Inappropriate row
                inapp_row = dict(base)
                inapp_row["condition"] = "inappropriate"
                inapp_row["foil_type"] = foil_type
                rows.append(inapp_row)

    assert len(rows) == 300, f"Expected 300 rows, got {len(rows)}"
    return rows


def sanity_check(rows: list[dict]) -> None:
    """Verify balance matches design spec §3.4."""
    from collections import Counter

    # Per-level foil_type distribution (inappropriate rows only)
    per_level: dict[str, Counter] = {}
    for r in rows:
        if r["condition"] != "inappropriate":
            continue
        per_level.setdefault(r["target_level"], Counter())[r["foil_type"]] += 1

    print("Foil-type balance per level (inappropriate rows only):")
    print(f"{'Level':<6} {'a_selectional':<16} {'b_collocation':<16} {'total':<6}")
    for lvl in ["1K", "2K", "3K", "4K", "5K"]:
        c = per_level[lvl]
        a = c["a_selectional"]
        b = c["b_collocation"]
        total = a + b
        print(f"{lvl:<6} {a:<16} {b:<16} {total:<6}")
        assert total == 30, f"Level {lvl}: expected 30, got {total}"
        assert abs(a - 15) <= 3, f"Level {lvl}: a_selectional {a} out of [12, 18]"
        assert abs(b - 15) <= 3, f"Level {lvl}: b_collocation {b} out of [12, 18]"

    # Target word uniqueness per level (UVLT answers are unique by design)
    for lvl in ["1K", "2K", "3K", "4K", "5K"]:
        words = [r["target_word"] for r in rows
                 if r["target_level"] == lvl and r["condition"] == "appropriate"]
        assert len(words) == 30
        assert len(set(words)) == 30, f"Duplicate target words in {lvl}"

    # POS distribution
    pos_counts: Counter = Counter()
    for r in rows:
        if r["condition"] == "appropriate":
            pos_counts[(r["target_level"], r["target_POS"])] += 1
    print("\nPOS distribution per level (appropriate rows):")
    for lvl in ["1K", "2K", "3K", "4K", "5K"]:
        print(
            f"  {lvl}: noun={pos_counts[(lvl, 'noun')]}, "
            f"verb={pos_counts[(lvl, 'verb')]}, "
            f"adjective={pos_counts[(lvl, 'adjective')]}"
        )


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=QMATRIX_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    print(f"Parsing BAND_BLUEPRINTS from {SCRIPT_JS}...")
    blueprints = parse_band_blueprints(SCRIPT_JS)
    print(f"Loaded {sum(len(blueprints[b]) for b in BAND_ORDER)} testlets "
          f"across {len(BAND_ORDER)} bands")

    print("\nBuilding 300-row Q-matrix skeleton...")
    rows = build_rows(blueprints)

    print("\nRunning sanity checks...")
    sanity_check(rows)

    print(f"\nWriting to {OUT_CSV}...")
    write_csv(rows, OUT_CSV)
    print(f"Done. {len(rows)} rows written.")


if __name__ == "__main__":
    main()
