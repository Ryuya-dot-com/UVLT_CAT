"""
validate_ljt_sentences.py
-------------------------
Automated pre-review validation for LJT sentence drafts. Implements the
checks specified in design_ljt_spec.md §11.4 (v0.5).

Checks per row:
  1. length_ok               : 4 <= n_words <= 8
  2. target_not_initial      : target word is not position 0
  3. target_present          : target word appears in sentence (lemma-aware)
  4. single_target           : target appears exactly once
  5. context_freq_ok         : context words satisfy graduated frequency ceiling (§3.2)
  6. no_subordination        : no subordinating conjunctions
  7. foil_b_target_preserved : for foil_type=b_collocation, target must be unchanged
  8. no_idiom_overlap        : no n-gram with COCA MI > 3 (or GoogleBooks MI > 2.5)

The COCA/GoogleBooks lookups read from optional JSON ngram databases
(`tools/coca_*.json`, `tools/gbooks_*.json`). By default, missing resources or
unverifiable words fail validation (fail-closed). Use `--allow-unverified` to
treat those cases as warnings instead.

Usage:
  python tools/validate_ljt_sentences.py ljt/ljt_sentences.csv
  python tools/validate_ljt_sentences.py --strict ljt/ljt_sentences.csv
  python tools/validate_ljt_sentences.py --allow-unverified ljt/ljt_sentences.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import warnings
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"

# -----------------------------------------------------------------------------
# Lightweight lemmatizer (falls back to surface form if spaCy unavailable)
# -----------------------------------------------------------------------------
try:
    import spacy
    try:
        _NLP = spacy.load("en_core_web_sm", disable=["parser", "ner"])
    except OSError:
        warnings.warn(
            "spaCy model 'en_core_web_sm' not found. "
            "Run: python -m spacy download en_core_web_sm. "
            "Falling back to surface-form tokenization."
        )
        _NLP = None
except ImportError:
    warnings.warn("spaCy not installed. Falling back to surface-form tokenization.")
    _NLP = None


def tokenize(sentence: str) -> list[str]:
    """Return list of word tokens (punctuation stripped, lowercased)."""
    if _NLP is not None:
        return [tok.text.lower() for tok in _NLP(sentence)
                if not tok.is_punct and not tok.is_space]
    # Fallback: split on whitespace, strip punctuation
    return [re.sub(r"[.,!?;:\"']", "", w.lower()) for w in sentence.split()
            if re.sub(r"[.,!?;:\"']", "", w)]


# Minimal fallback inflection handler — covers GSL-tier verb/noun forms for
# purposes of target-presence matching. When spaCy is available, this code is
# bypassed in favor of proper lemmatization.
COMMON_IRREGULARS = {
    # past tense -> base
    "met": "meet", "ate": "eat", "bought": "buy", "sang": "sing",
    "came": "come", "went": "go", "saw": "see", "knew": "know",
    "took": "take", "gave": "give", "wrote": "write", "ran": "run",
    "made": "make", "found": "find", "told": "tell", "got": "get",
    "began": "begin", "brought": "bring", "chose": "choose", "drove": "drive",
    "drank": "drink", "fell": "fall", "felt": "feel", "flew": "fly",
    "forgot": "forget", "grew": "grow", "had": "have", "held": "hold",
    "hid": "hide", "kept": "keep", "left": "leave", "lost": "lose",
    "paid": "pay", "read": "read", "said": "say", "sent": "send",
    "slept": "sleep", "spoke": "speak", "stood": "stand", "swam": "swim",
    "taught": "teach", "thought": "think", "threw": "throw",
    "understood": "understand", "woke": "wake", "wore": "wear", "won": "win",
    "sought": "seek", "caught": "catch", "dealt": "deal", "drew": "draw",
    "sat": "sit", "stuck": "stick", "struck": "strike", "shook": "shake",
}


def fallback_lemma_candidates(word: str) -> list[str]:
    """Return possible lemma forms of a surface word (fallback when no spaCy)."""
    w = word.lower()
    forms = {w}
    if w in COMMON_IRREGULARS:
        forms.add(COMMON_IRREGULARS[w])
    # Regular inflections (ordered most-specific first)
    for suffix, rewrites in [
        ("ies", [(lambda s: s[:-3] + "y")]),   # tries -> try
        ("ing", [(lambda s: s[:-3]),            # jumping -> jump
                 (lambda s: s[:-3] + "e"),       # making -> make
                 (lambda s: s[:-4] if len(s) >= 5 and s[-4] == s[-5] else None)]),  # running -> run
        ("ed",  [(lambda s: s[:-2]),            # jumped -> jump
                 (lambda s: s[:-1]),            # liked -> like (keep e)
                 (lambda s: s[:-3] if len(s) >= 4 and s[-3] == s[-4] else None)]),  # stopped -> stop
        ("es",  [(lambda s: s[:-2]),            # watches -> watch
                 (lambda s: s[:-1])]),          # goes -> go
        ("s",   [(lambda s: s[:-1])]),          # eats -> eat
        ("er",  [(lambda s: s[:-2]),            # taller -> tall
                 (lambda s: s[:-1])]),
        ("est", [(lambda s: s[:-3]),
                 (lambda s: s[:-2])]),
    ]:
        if w.endswith(suffix) and len(w) > len(suffix) + 1:
            for fn in rewrites:
                cand = fn(w)
                if cand and len(cand) >= 2:
                    forms.add(cand)
    return list(forms)


def lemmatize(sentence: str) -> list[str]:
    """Return list of lemmas (spaCy) or best-effort lemma (fallback)."""
    if _NLP is not None:
        return [tok.lemma_.lower() for tok in _NLP(sentence)
                if not tok.is_punct and not tok.is_space]
    # Fallback: take first candidate (prefer irregular-table lemma if present)
    out = []
    for t in tokenize(sentence):
        candidates = fallback_lemma_candidates(t)
        # Prefer non-identity reduction that comes from the irregular table,
        # else use the surface form for stability.
        reduced = t
        if t in COMMON_IRREGULARS:
            reduced = COMMON_IRREGULARS[t]
        out.append(reduced)
    return out


def target_matches_any(target: str, surface_tokens: list[str]) -> list[int]:
    """Return positions where target matches any surface token (lemma-aware).

    Used by target_present / single_target / target_not_initial checks, since
    surface inflections like 'eats' should match target 'eat'.
    """
    target_l = target.lower()
    positions: list[int] = []
    for i, tok in enumerate(surface_tokens):
        if tok == target_l:
            positions.append(i)
            continue
        # Fallback: check inflection candidates
        if target_l in fallback_lemma_candidates(tok):
            positions.append(i)
    return positions


# -----------------------------------------------------------------------------
# Frequency ceiling check (§3.2)
# -----------------------------------------------------------------------------
# Graduated ceiling: target Nk -> context words must be <= max(2K, (N-1)K).
# For stage 1, we ship a compact GSL-derived top-1K/2K list; fuller bands are
# expected from COCA/BNC rank files if present.
DEFAULT_TOP_1K = TOOLS / "top_1k.json"
DEFAULT_TOP_2K = TOOLS / "top_2k.json"
DEFAULT_COCA_RANK = TOOLS / "coca_ranks.json"  # word -> rank (1..)


def load_word_set(path: Path) -> set[str]:
    if not path.exists():
        return set()
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return {w.lower() for w in data}
    if isinstance(data, dict):
        return {w.lower() for w in data.keys()}
    return set()


def load_coca_ranks(path: Path = DEFAULT_COCA_RANK) -> dict[str, int] | None:
    if not path.exists():
        return None
    return {k.lower(): int(v) for k, v in json.loads(path.read_text()).items()}


_TOP_1K: set[str] | None = None
_TOP_2K: set[str] | None = None
_COCA_RANKS: dict[str, int] | None = None


def has_frequency_resources() -> bool:
    global _TOP_1K, _TOP_2K, _COCA_RANKS
    if _COCA_RANKS is None:
        _COCA_RANKS = load_coca_ranks()
    if _COCA_RANKS is not None:
        return True
    if _TOP_1K is None:
        _TOP_1K = load_word_set(DEFAULT_TOP_1K)
    if _TOP_2K is None:
        _TOP_2K = load_word_set(DEFAULT_TOP_2K)
    return bool(_TOP_1K and _TOP_2K)


def get_word_band(word: str) -> str | None:
    """Return the K-band label for a word or None if unknown.

    Uses COCA rank file if present (authoritative), otherwise falls back to
    top_1k.json / top_2k.json set membership.
    """
    global _TOP_1K, _TOP_2K, _COCA_RANKS
    if _COCA_RANKS is None:
        _COCA_RANKS = load_coca_ranks()

    w = word.lower()
    if _COCA_RANKS is not None and w in _COCA_RANKS:
        r = _COCA_RANKS[w]
        if r <= 1000:
            return "top_1K"
        if r <= 2000:
            return "top_2K"
        if r <= 3000:
            return "top_3K"
        if r <= 4000:
            return "top_4K"
        if r <= 5000:
            return "top_5K"
        if r <= 10000:
            return "top_10K"
        if r <= 20000:
            return "top_20K"
        return "beyond_20K"

    # Fallback: top_1K/top_2K word sets
    if _TOP_1K is None:
        _TOP_1K = load_word_set(DEFAULT_TOP_1K)
    if _TOP_2K is None:
        _TOP_2K = load_word_set(DEFAULT_TOP_2K)
    if not (_TOP_1K and _TOP_2K):
        return None  # unknown, cannot verify
    if w in _TOP_1K:
        return "top_1K"
    if w in _TOP_2K:
        return "top_2K"
    return "unknown"


_LEVEL_TO_CEILING = {
    "1K": "top_2K", "2K": "top_2K", "3K": "top_2K",
    "4K": "top_3K", "5K": "top_4K",
}
_BAND_RANK = ["top_1K", "top_2K", "top_3K", "top_4K", "top_5K",
              "top_10K", "top_20K", "beyond_20K"]


def band_leq(band_a: str, band_b: str) -> bool:
    """True iff band_a is at or below (equal or easier than) band_b."""
    if band_a not in _BAND_RANK or band_b not in _BAND_RANK:
        return True  # unknown treated as pass (warn elsewhere)
    return _BAND_RANK.index(band_a) <= _BAND_RANK.index(band_b)


PROPER_NOUN_RE = re.compile(r"^[A-Z][a-z]+$")


def check_context_freq(sentence: str, target_word: str, target_level: str) -> dict:
    ceiling = _LEVEL_TO_CEILING.get(target_level.upper(), "top_2K")
    surface_tokens = [w for w in sentence.split() if re.sub(r"[.,!?;:\"']", "", w)]

    if not has_frequency_resources():
        return {
            "ok": False,
            "unverified": True,
            "reason": "Missing frequency resources (coca_ranks.json or top_1k.json + top_2k.json).",
            "pct_top1k": None,
            "non_1k_count": None,
            "ceiling_violations": [],
            "unknown_words": [],
        }

    non_target_tokens = [
        w for w in surface_tokens
        if re.sub(r"[.,!?;:\"']", "", w).lower() != target_word.lower()
    ]

    non_1k_count = 0
    violating: list[str] = []
    unknown: list[str] = []
    for w in non_target_tokens:
        stripped = re.sub(r"[.,!?;:\"']", "", w)
        if PROPER_NOUN_RE.match(stripped):
            # Proper nouns count as top_1K per §3.2
            continue
        band = get_word_band(stripped.lower())
        if band is None or band == "unknown":
            unknown.append(stripped)
            continue
        if band != "top_1K":
            non_1k_count += 1
        if not band_leq(band, ceiling):
            violating.append(f"{stripped}({band})")

    n_non_target = len([t for t in non_target_tokens
                         if not PROPER_NOUN_RE.match(
                             re.sub(r"[.,!?;:\"']", "", t))])

    # §3.2 rule: >=90% top_1K for 1-3K targets, >=85% for 4-5K
    min_pct = 0.85 if target_level.upper() in {"4K", "5K"} else 0.90
    if n_non_target == 0:
        pct_top1k = 1.0
    else:
        pct_top1k = 1.0 - (non_1k_count / n_non_target)

    # Max 1 non-1K per sentence
    ok_count = non_1k_count <= 1
    ok_pct = pct_top1k >= min_pct
    ok_ceiling = not violating
    ok_verifiable = len(unknown) == 0
    ok = ok_count and ok_pct and ok_ceiling and ok_verifiable
    return {
        "ok": ok,
        "unverified": not ok_verifiable,
        "pct_top1k": round(pct_top1k, 3),
        "non_1k_count": non_1k_count,
        "ceiling_violations": violating,
        "unknown_words": unknown,
    }


# -----------------------------------------------------------------------------
# Subordination check
# -----------------------------------------------------------------------------
SUBORDINATING_CONJ = {
    "because", "although", "though", "since", "while", "whereas",
    "unless", "until", "whenever", "whereas", "whether", "which",
    "that",  # ambiguous — flag for review
    "who", "whom", "whose", "when", "where", "why",  # WH-clause markers
    "if",
}


def check_no_subordination(sentence: str) -> dict:
    tokens = tokenize(sentence)
    hits = [t for t in tokens if t in SUBORDINATING_CONJ]
    # 'that' is informational-only; flag but don't fail
    hard_fails = [t for t in hits if t != "that"]
    return {
        "ok": not hard_fails,
        "hits": hits,
        "hard_fails": hard_fails,
    }


# -----------------------------------------------------------------------------
# N-gram MI check (§11.4)
# -----------------------------------------------------------------------------
_COCA_BIGRAMS: dict | None = None
_COCA_TRIGRAMS: dict | None = None
_GBOOKS_BIGRAMS: dict | None = None


def _load_ngram_db(path: Path) -> dict | None:
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    # Expected structure: {"word1 word2": {"mi": 3.5, "freq": 100}, ...}
    return data


FUNCTION_WORDS = {
    "the", "a", "an", "of", "in", "on", "at", "to", "for", "with",
    "be", "is", "are", "am", "was", "were", "been", "being",
    "and", "or", "but", "as", "by", "from", "this", "that", "these",
    "those", "it", "its", "their", "his", "her", "my", "your", "our",
}


def is_function_word_pair(bigram: tuple[str, str]) -> bool:
    return bigram[0] in FUNCTION_WORDS and bigram[1] in FUNCTION_WORDS


def lookup_mi(ngram: tuple[str, ...], db: dict | None) -> float | None:
    if db is None:
        return None
    key = " ".join(ngram)
    entry = db.get(key)
    if entry is None:
        return None
    return float(entry.get("mi", 0.0))


def check_no_idiom_overlap(sentence: str,
                             mi_threshold_coca: float = 3.0,
                             mi_threshold_gbooks: float = 2.5) -> dict:
    """Return dict with ok flag and list of hit n-grams."""
    global _COCA_BIGRAMS, _COCA_TRIGRAMS, _GBOOKS_BIGRAMS
    if _COCA_BIGRAMS is None:
        _COCA_BIGRAMS = _load_ngram_db(TOOLS / "coca_bigrams.json")
    if _COCA_TRIGRAMS is None:
        _COCA_TRIGRAMS = _load_ngram_db(TOOLS / "coca_trigrams.json")
    if _GBOOKS_BIGRAMS is None:
        _GBOOKS_BIGRAMS = _load_ngram_db(TOOLS / "gbooks_bigrams.json")

    if _COCA_BIGRAMS is None and _GBOOKS_BIGRAMS is None:
        return {
            "ok": False,
            "hits": [],
            "unverified": True,
            "reason": "No ngram database found (tools/coca_bigrams.json or gbooks_bigrams.json).",
        }

    tokens = lemmatize(sentence)
    hits: list[tuple[str, tuple, float]] = []

    # Bigrams
    for i in range(len(tokens) - 1):
        bigram = (tokens[i], tokens[i+1])
        if is_function_word_pair(bigram):
            continue
        mi_c = lookup_mi(bigram, _COCA_BIGRAMS)
        if mi_c is not None and mi_c > mi_threshold_coca:
            hits.append(("COCA_bigram", bigram, mi_c))
            continue
        if mi_c is None:
            mi_g = lookup_mi(bigram, _GBOOKS_BIGRAMS)
            if mi_g is not None and mi_g > mi_threshold_gbooks:
                hits.append(("GB_bigram", bigram, mi_g))

    # Trigrams (COCA only, typically unavailable in Google Books 2-gram)
    for i in range(len(tokens) - 2):
        trigram = tuple(tokens[i:i+3])
        mi_c = lookup_mi(trigram, _COCA_TRIGRAMS)
        if mi_c is not None and mi_c > mi_threshold_coca:
            hits.append(("COCA_trigram", trigram, mi_c))

    return {"ok": not hits, "hits": hits, "skipped": False}


# -----------------------------------------------------------------------------
# Main validator
# -----------------------------------------------------------------------------
def validate_row(row: dict, strict: bool = False, allow_unverified: bool = False) -> dict:
    """Apply all checks and return a result dict per row."""
    sentence = row.get("sentence_text", "").strip()
    target = row.get("target_word", "").strip()
    level = row.get("target_level", "").strip()
    foil_type = row.get("foil_type", "").strip()

    result: dict = {
        "item_id": row.get("item_id", ""),
        "condition": row.get("condition", ""),
        "target_word": target,
        "sentence_text": sentence,
        "checks": {},
        "overall_pass": True,
    }

    if not sentence:
        result["overall_pass"] = False
        result["checks"]["empty_sentence"] = {"ok": False}
        return result

    tokens = tokenize(sentence)

    # 1. length_ok
    n_words = len(tokens)
    result["checks"]["length_ok"] = {"ok": 4 <= n_words <= 8, "n_words": n_words}

    # 2/3/4. target presence and position (lemma-aware)
    target_positions = target_matches_any(target, tokens)
    result["checks"]["target_present"] = {"ok": len(target_positions) >= 1,
                                            "count": len(target_positions)}
    result["checks"]["single_target"] = {"ok": len(target_positions) == 1,
                                          "count": len(target_positions)}
    result["checks"]["target_not_initial"] = {
        "ok": all(p != 0 for p in target_positions) if target_positions else True,
        "positions": target_positions,
    }

    # 5. context frequency
    result["checks"]["context_freq_ok"] = check_context_freq(sentence, target, level)

    # 6. subordination
    result["checks"]["no_subordination"] = check_no_subordination(sentence)

    # 7. foil_b preservation (lemma-aware)
    if foil_type == "b_collocation":
        preserved = len(target_matches_any(target, tokens)) >= 1
        result["checks"]["foil_b_target_preserved"] = {"ok": preserved}

    # 8. idiom overlap (n-gram MI)
    result["checks"]["no_idiom_overlap"] = check_no_idiom_overlap(sentence)

    # Overall pass: all ok flags true (skipped checks don't fail in lax mode)
    for name, check in result["checks"].items():
        if not check.get("ok", False):
            if check.get("unverified") and allow_unverified:
                continue
            if check.get("skipped") and not strict:
                continue
            result["overall_pass"] = False
            break

    return result


def run(csv_path: Path, strict: bool = False, allow_unverified: bool = False) -> list[dict]:
    with csv_path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return [validate_row(r, strict=strict, allow_unverified=allow_unverified) for r in rows]


def print_summary(results: list[dict]) -> int:
    n_total = len(results)
    n_pass = sum(1 for r in results if r["overall_pass"])
    n_fail = n_total - n_pass
    print(f"\n=== Validation Summary ===")
    print(f"Total rows: {n_total}")
    print(f"Passed:     {n_pass}")
    print(f"Failed:     {n_fail}")

    if n_fail > 0:
        print("\nFailure breakdown:")
        from collections import Counter
        fail_counter: Counter = Counter()
        for r in results:
            if r["overall_pass"]:
                continue
            for name, check in r["checks"].items():
                if not check.get("ok", False) and not check.get("skipped"):
                    fail_counter[name] += 1
        for name, count in fail_counter.most_common():
            print(f"  {name}: {count}")

        print("\nFirst 5 failures:")
        count = 0
        for r in results:
            if r["overall_pass"]:
                continue
            print(f"  [{r['item_id']} / {r['condition']}] {r['sentence_text']!r}")
            for name, check in r["checks"].items():
                if not check.get("ok", False) and not check.get("skipped"):
                    print(f"    - {name}: {check}")
            count += 1
            if count >= 5:
                break

    return n_fail


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate LJT sentence drafts")
    parser.add_argument("csv_path", type=Path, help="Path to ljt_sentences.csv")
    parser.add_argument("--strict", action="store_true",
                         help="Fail on skipped checks (e.g., missing ngram DB)")
    parser.add_argument("--allow-unverified", action="store_true",
                         help="Treat missing lexical resources and unknown words as warnings")
    parser.add_argument("--json-out", type=Path, default=None,
                         help="Also write full validation results as JSON")
    args = parser.parse_args()

    if not args.csv_path.exists():
        print(f"ERROR: {args.csv_path} not found", file=sys.stderr)
        sys.exit(2)

    results = run(
        args.csv_path,
        strict=args.strict,
        allow_unverified=args.allow_unverified,
    )

    if args.json_out:
        args.json_out.write_text(
            json.dumps(results, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print(f"Wrote detailed results to {args.json_out}")

    n_fail = print_summary(results)
    sys.exit(0 if n_fail == 0 else 1)


if __name__ == "__main__":
    main()
