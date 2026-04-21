"""
generate_ljt_audio.py
---------------------
Generate TTS audio for LJT sentences using Google Cloud Text-to-Speech.
Implements the audio pipeline specified in design_ljt_spec.md §8.

Pipeline per sentence:
  1. Synthesize with en-US-Neural2-C voice (female, General American)
  2. Decode MP3 -> 16-bit PCM at 22,050 Hz mono
  3. Trim leading/trailing silence (-40 dB threshold)
  4. Peak limit to -1 dBFS (BEFORE LUFS normalization)
  5. LUFS normalize to -23 LUFS target
  6. If overshoot >=-1 dBFS persists, iteratively lower target (max 3 iters)
  7. Measure actual integrated LUFS post-normalization
  8. Append 200 ms silence padding for clean offset detection
  9. Save to audio/{item_id}_{condition}.wav
  10. Compute sha256, record in audio_meta.csv

Authentication:
  Run `gcloud auth application-default login` once before invoking.
  DO NOT commit service-account JSON to the repository.

Usage:
  python tools/generate_ljt_audio.py ljt/ljt_sentences.csv
  python tools/generate_ljt_audio.py --dry-run ljt/ljt_sentences.csv
  python tools/generate_ljt_audio.py --force-regenerate ljt/ljt_sentences.csv
  python tools/generate_ljt_audio.py --items uvlt_1k_t01_i01 ljt/ljt_sentences.csv

Input CSV columns (minimum):
  item_id, target_word, condition, sentence_text, target_level

Output:
  ljt/audio/*.wav (or practice/ subdir for item_id starting with p)
  ljt/audio_meta.csv
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
LJT_DIR = ROOT / "ljt"
AUDIO_DIR = LJT_DIR / "audio"
PRACTICE_AUDIO_DIR = AUDIO_DIR / "practice"
META_CSV = LJT_DIR / "audio_meta.csv"

GENERATOR_VERSION = "v1.1-2026-04"
TTS_VOICE = "en-US-Neural2-C"
TTS_LANGUAGE = "en-US"
SPEAKING_RATE = 0.90
PITCH = 0.0
SAMPLE_RATE = 22050  # Hz

LUFS_TARGET = -23.0
PEAK_CEILING_DBFS = -1.0
TRIM_TOP_DB = 40  # dB threshold for silence trimming
SILENCE_PAD_MS = 200
MAX_NORM_ITERS = 3


# -----------------------------------------------------------------------------
# Deps imported lazily so --help works without them installed
# -----------------------------------------------------------------------------
def import_deps(require: bool = True):
    missing = []
    try:
        from google.cloud import texttospeech  # noqa: F401
    except ImportError:
        missing.append("google-cloud-texttospeech")
    try:
        import librosa  # noqa: F401
    except ImportError:
        missing.append("librosa")
    try:
        import pyloudnorm  # noqa: F401
    except ImportError:
        missing.append("pyloudnorm")
    try:
        import soundfile  # noqa: F401
    except ImportError:
        missing.append("soundfile")
    try:
        import numpy  # noqa: F401
    except ImportError:
        missing.append("numpy")

    if missing:
        msg = (
            f"Missing Python dependencies: {', '.join(missing)}\n"
            f"Install with: pip install {' '.join(missing)}"
        )
        if require:
            raise ImportError(msg)
        warnings.warn(msg)
    return not missing


# -----------------------------------------------------------------------------
# TTS synthesis
# -----------------------------------------------------------------------------
def synthesize_mp3(text: str) -> bytes:
    """Call Google Cloud TTS. Returns MP3 bytes."""
    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(
        language_code=TTS_LANGUAGE,
        name=TTS_VOICE,
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=SPEAKING_RATE,
        pitch=PITCH,
        sample_rate_hertz=SAMPLE_RATE,
    )
    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )
    return response.audio_content


# -----------------------------------------------------------------------------
# Post-processing (§8.2 v0.5 spec)
# -----------------------------------------------------------------------------
def post_process(mp3_bytes: bytes, out_wav: Path) -> dict:
    import io

    import librosa
    import numpy as np
    import pyloudnorm as pyln
    import soundfile as sf

    # 1. Decode MP3 -> waveform at target sample rate, mono
    with io.BytesIO(mp3_bytes) as buf:
        y, sr = librosa.load(buf, sr=SAMPLE_RATE, mono=True)
    if len(y) == 0:
        raise ValueError("TTS returned empty audio")

    # 2. Trim silence
    y, _ = librosa.effects.trim(y, top_db=TRIM_TOP_DB)
    if len(y) < int(0.3 * sr):
        raise ValueError(
            f"Audio too short after trim ({len(y) / sr:.2f} s); "
            f"TTS output may be malformed"
        )

    # 3. Peak limit BEFORE LUFS normalization
    peak = float(np.max(np.abs(y)))
    if peak > 10 ** (PEAK_CEILING_DBFS / 20):
        y = y * (10 ** (PEAK_CEILING_DBFS / 20) / peak)

    # 4. LUFS normalize with overshoot-correction loop
    meter = pyln.Meter(sr)
    loudness_in = meter.integrated_loudness(y)
    y = pyln.normalize.loudness(y, loudness_in, LUFS_TARGET)

    for _ in range(MAX_NORM_ITERS):
        peak_after = float(np.max(np.abs(y)))
        if peak_after <= 10 ** (PEAK_CEILING_DBFS / 20):
            break
        overshoot_db = 20 * np.log10(peak_after / 10 ** (PEAK_CEILING_DBFS / 20))
        y = pyln.normalize.loudness(
            y, meter.integrated_loudness(y), LUFS_TARGET - overshoot_db
        )
    else:
        peak_final = float(np.max(np.abs(y)))
        warnings.warn(
            f"{out_wav.name}: LUFS normalization overshoot persists after "
            f"{MAX_NORM_ITERS} iters; final peak={peak_final:.4f} "
            f"(> {10 ** (PEAK_CEILING_DBFS / 20):.4f}). "
            f"audio_meta.csv will record actual peak for downstream QC."
        )

    # 5. Re-measure final LUFS (actual, not target)
    loudness_final = meter.integrated_loudness(y)

    # 6. Append silence padding
    pad_samples = int(SILENCE_PAD_MS / 1000 * sr)
    y = np.concatenate([y, np.zeros(pad_samples, dtype=y.dtype)])

    # 7. Write wav
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out_wav, y, sr, subtype="PCM_16")

    # 8. Measure final artifact
    peak_dbfs = 20 * np.log10(float(np.max(np.abs(y))) + 1e-9)
    duration_ms = int(len(y) / sr * 1000)
    sha256 = compute_sha256(out_wav)
    return {
        "duration_ms": duration_ms,
        "peak_dbfs": round(peak_dbfs, 3),
        "integrated_lufs": round(loudness_final, 3),
        "sha256": sha256,
    }


def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# -----------------------------------------------------------------------------
# Filename + meta
# -----------------------------------------------------------------------------
def canonical_practice_item_id(item_id: str) -> str:
    match = re.match(
        r"^(p\d+)_(?:appropriate|app|inappropriate|inapp)$",
        item_id.strip(),
        re.IGNORECASE,
    )
    return match.group(1) if match else item_id


def audio_filename(item_id: str, condition: str) -> Path:
    if item_id.startswith("p"):
        # Practice items go to practice/ subdir
        practice_id = canonical_practice_item_id(item_id)
        return PRACTICE_AUDIO_DIR / f"{practice_id}_{condition}.wav"
    return AUDIO_DIR / f"{item_id}_{condition}.wav"


META_COLUMNS = [
    "audio_file",
    "item_id",
    "condition",
    "text",
    "duration_ms",
    "peak_dbfs",
    "integrated_lufs",
    "sha256",
    "tts_voice",
    "tts_speaking_rate",
    "generated_at",
    "generator_version",
]


def load_existing_meta() -> dict[str, dict]:
    """Return existing meta entries keyed by audio_file (for incremental builds)."""
    if not META_CSV.exists():
        return {}
    with META_CSV.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return {row["audio_file"]: row for row in reader}


def write_meta(entries: list[dict]) -> None:
    META_CSV.parent.mkdir(parents=True, exist_ok=True)
    # Sort by audio_file for stable diffs
    entries = sorted(entries, key=lambda e: e["audio_file"])
    with META_CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=META_COLUMNS)
        writer.writeheader()
        writer.writerows(entries)


# -----------------------------------------------------------------------------
# Driver
# -----------------------------------------------------------------------------
def process_one(row: dict, *, force: bool, dry_run: bool,
                existing_meta: dict[str, dict]) -> dict | None:
    item_id = row["item_id"]
    meta_item_id = canonical_practice_item_id(item_id) if item_id.startswith("p") else item_id
    condition = row["condition"]
    text = (row.get("sentence_text") or "").strip()
    if not text:
        print(f"  SKIP {item_id}/{condition}: empty sentence_text")
        return None

    out_path = audio_filename(item_id, condition)
    rel_path = out_path.relative_to(LJT_DIR).as_posix()

    # Cache check: if file exists + meta matches text + sha256 stable, skip
    if not force and out_path.exists() and rel_path in existing_meta:
        existing = existing_meta[rel_path]
        if existing.get("text") == text:
            existing_sha = compute_sha256(out_path)
            if existing_sha == existing.get("sha256"):
                print(f"  CACHE {rel_path}")
                return existing
            # sha mismatch: regenerate to ensure determinism
            print(f"  REGEN {rel_path} (sha256 mismatch)")

    if dry_run:
        print(f"  DRY-RUN would synthesize: {rel_path}: {text!r}")
        return None

    print(f"  SYNTH {rel_path}: {text!r}")
    mp3 = synthesize_mp3(text)
    meta = post_process(mp3, out_path)
    meta.update({
        "audio_file": rel_path,
        "item_id": meta_item_id,
        "condition": condition,
        "text": text,
        "tts_voice": TTS_VOICE,
        "tts_speaking_rate": SPEAKING_RATE,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generator_version": GENERATOR_VERSION,
    })
    return meta


def run(csv_path: Path, *, items_filter: set[str] | None,
        force: bool, dry_run: bool) -> int:
    with csv_path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if items_filter:
        rows = [r for r in rows if r["item_id"] in items_filter]
        if not rows:
            print(f"ERROR: no rows match --items filter", file=sys.stderr)
            return 2

    existing_meta = load_existing_meta()
    all_meta: dict[str, dict] = dict(existing_meta)  # start from existing

    # Deps check (skip if dry-run)
    if not dry_run:
        import_deps(require=True)

    print(f"Processing {len(rows)} sentences from {csv_path}...")
    generated = 0
    cached = 0
    failed: list[tuple[str, Exception]] = []
    for row in rows:
        try:
            meta = process_one(row, force=force, dry_run=dry_run,
                                 existing_meta=existing_meta)
            if meta is None:
                continue
            all_meta[meta["audio_file"]] = meta
            if meta.get("generated_at", "").startswith(
                datetime.now(timezone.utc).strftime("%Y")
            ):
                generated += 1
            else:
                cached += 1
        except Exception as e:
            print(f"  FAIL {row.get('item_id')}/{row.get('condition')}: {e}",
                  file=sys.stderr)
            failed.append((row.get("item_id", "?"), e))

    if not dry_run:
        write_meta(list(all_meta.values()))
        print(f"\n=== Summary ===")
        print(f"Generated:    {generated}")
        print(f"Cached:       {cached}")
        print(f"Failed:       {len(failed)}")
        print(f"Meta entries: {len(all_meta)}")
        print(f"Meta file:    {META_CSV}")
        if failed:
            print("\nFailures:")
            for item_id, err in failed:
                print(f"  {item_id}: {err}")
            return 1
    else:
        print(f"\nDry-run complete. Would synthesize {len(rows)} sentences.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate LJT audio via Google TTS")
    parser.add_argument("csv_path", type=Path,
                         help="Input sentences CSV (ljt/ljt_sentences.csv)")
    parser.add_argument("--dry-run", action="store_true",
                         help="Plan only; do not call TTS API or write files")
    parser.add_argument("--force-regenerate", action="store_true",
                         help="Regenerate even if cached wav + meta match")
    parser.add_argument("--items", type=str, default=None,
                         help="Comma-separated item_ids to process (default: all)")
    args = parser.parse_args()

    items_filter = None
    if args.items:
        items_filter = {i.strip() for i in args.items.split(",") if i.strip()}

    if not args.csv_path.exists():
        print(f"ERROR: {args.csv_path} not found", file=sys.stderr)
        sys.exit(2)

    sys.exit(run(args.csv_path,
                 items_filter=items_filter,
                 force=args.force_regenerate,
                 dry_run=args.dry_run))


if __name__ == "__main__":
    main()
