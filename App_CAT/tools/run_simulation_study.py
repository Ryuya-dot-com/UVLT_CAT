from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from datetime import datetime
from pathlib import Path

from py_mini_racer import MiniRacer


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "script.js"
DEFAULT_SEED = 20260326

JS_STUB = r"""
var __elements = {};
function __makeElement() {
  return {
    classList: { toggle: function(){}, add: function(){}, remove: function(){} },
    addEventListener: function(){},
    removeEventListener: function(){},
    querySelectorAll: function(){ return []; },
    querySelector: function(){ return __makeElement(); },
    setAttribute: function(){},
    removeAttribute: function(){},
    appendChild: function(){},
    removeChild: function(){},
    focus: function(){},
    reset: function(){},
    click: function(){},
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false
  };
}
var document = {
  hidden: false,
  body: __makeElement(),
  createElement: function(){ return __makeElement(); },
  getElementById: function(id){
    if (!__elements[id]) { __elements[id] = __makeElement(); }
    return __elements[id];
  },
  querySelectorAll: function(){ return []; },
  querySelector: function(){ return __makeElement(); },
  addEventListener: function(){},
  removeEventListener: function(){}
};
var window = this;
window.document = document;
window.history = { state: null, pushState: function(state){ this.state = state; } };
window.location = { href: 'http://localhost/' };
window.localStorage = {
  _data: {},
  getItem: function(k){ return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
  setItem: function(k,v){ this._data[k] = String(v); },
  removeItem: function(k){ delete this._data[k]; }
};
window.addEventListener = function(){};
window.removeEventListener = function(){};
window.alert = function(){};
window.crypto = { randomUUID: function(){ return '00000000-0000-4000-8000-000000000000'; } };
var XLSX = undefined;
"""


def build_context() -> MiniRacer:
    ctx = MiniRacer()
    ctx.eval(JS_STUB)
    ctx.eval(SCRIPT_PATH.read_text(encoding="utf-8"))
    return ctx


def run_exposure_study(ctx: MiniRacer, cases: int, seed: int, output_dir: Path) -> dict:
    print(f"[exposure] Running baseline (no exposure control) ... cases={cases}")
    started = time.perf_counter()
    ctx.eval("window.UVLT_CAT_DEV.currentConfig.exposureControlEnabled = false;")
    baseline_raw = ctx.eval(
        f"JSON.stringify(window.UVLT_CAT_DEV.runExtendedSimulationSuite({cases}, {seed}, {{profileSet: 'extended'}}))"
    )
    baseline = json.loads(baseline_raw)
    print(f"  baseline done in {time.perf_counter() - started:.1f}s")

    results = [{"label": "baseline", "exposureControlEnabled": False, "profiles": baseline}]

    for rate in [0.20, 0.30, 0.40]:
        print(f"[exposure] Running with maxExposureRate={rate} ...")
        started = time.perf_counter()
        ctx.eval(f"""
            window.UVLT_CAT_DEV.currentConfig.exposureControlEnabled = true;
            window.UVLT_CAT_DEV.currentConfig.maxExposureRate = {rate};
            window.UVLT_CAT_DEV.resetExposureTracker();
        """)
        raw = ctx.eval(
            f"JSON.stringify(window.UVLT_CAT_DEV.runExtendedSimulationSuite({cases}, {seed}, {{profileSet: 'extended'}}))"
        )
        results.append({
            "label": f"exposure_{rate}",
            "exposureControlEnabled": True,
            "maxExposureRate": rate,
            "profiles": json.loads(raw),
        })
        print(f"  done in {time.perf_counter() - started:.1f}s")

    ctx.eval("window.UVLT_CAT_DEV.currentConfig.exposureControlEnabled = false;")

    path = output_dir / "exposure_comparison.json"
    path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[exposure] Saved to {path}")
    return {"file": str(path), "conditions": len(results)}


def run_stopping_sweep(ctx: MiniRacer, cases: int, seed: int, output_dir: Path) -> dict:
    print(f"[stopping] Running threshold sweep ... cases={cases}")
    started = time.perf_counter()
    raw = ctx.eval(
        f"JSON.stringify(window.UVLT_CAT_DEV.runStoppingThresholdSweep(null, {cases}, {seed}))"
    )
    results = json.loads(raw)
    elapsed = time.perf_counter() - started
    print(f"[stopping] {len(results)} conditions completed in {elapsed:.1f}s")

    json_path = output_dir / "stopping_sweep.json"
    json_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    csv_path = output_dir / "stopping_sweep_summary.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "targetSE", "minTestlets", "maxTestlets",
            "profileId", "avgTestlets", "avgSE", "bias", "rmse",
            "correlation", "pctReachingTarget", "maxExposureRate",
        ])
        for entry in results:
            cond = entry["condition"]
            for profile in entry["profiles"]:
                exp = profile.get("exposureDistribution", {})
                writer.writerow([
                    cond["targetSE"],
                    cond["minTestlets"],
                    cond["maxTestlets"],
                    profile["profileId"],
                    profile["avgTestlets"],
                    profile["avgSE"],
                    profile["avgThetaBias"],
                    profile.get("rmse", ""),
                    profile.get("correlation", ""),
                    profile.get("pctReachingTarget", ""),
                    exp.get("maxRate", ""),
                ])

    print(f"[stopping] Saved to {json_path} and {csv_path}")
    return {"json_file": str(json_path), "csv_file": str(csv_path), "conditions": len(results)}


def run_extended_profiles(ctx: MiniRacer, cases: int, seed: int, output_dir: Path) -> dict:
    print(f"[extended] Running extended profiles ... cases={cases}")
    started = time.perf_counter()
    raw = ctx.eval(
        f"JSON.stringify(window.UVLT_CAT_DEV.runExtendedSimulationSuite({cases}, {seed}, {{profileSet: 'extended'}}))"
    )
    results = json.loads(raw)
    elapsed = time.perf_counter() - started
    print(f"[extended] {len(results)} profiles completed in {elapsed:.1f}s")

    path = output_dir / "extended_profiles.json"
    path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[extended] Saved to {path}")
    return {"file": str(path), "profiles": len(results)}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run UVLT CAT simulation study via headless JS execution."
    )
    parser.add_argument(
        "--mode",
        choices=["exposure", "stopping", "extended", "full"],
        default="full",
        help="Study mode to run. 'full' runs all modes sequentially.",
    )
    parser.add_argument("--cases", type=int, default=200, help="Simulation cases per profile.")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="Random seed.")
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "simulation_output",
        help="Output directory for results.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    print(f"Building JS context from {SCRIPT_PATH} ...")
    ctx = build_context()
    print("JS context ready.\n")

    manifest = {
        "created": datetime.now().isoformat(),
        "seed": args.seed,
        "casesPerProfile": args.cases,
        "mode": args.mode,
        "studies": {},
    }

    if args.mode in ("exposure", "full"):
        manifest["studies"]["exposure"] = run_exposure_study(ctx, args.cases, args.seed, args.output)
        print()

    if args.mode in ("stopping", "full"):
        manifest["studies"]["stopping"] = run_stopping_sweep(ctx, args.cases, args.seed, args.output)
        print()

    if args.mode in ("extended", "full"):
        manifest["studies"]["extended"] = run_extended_profiles(ctx, args.cases, args.seed, args.output)
        print()

    manifest_path = args.output / "study_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Manifest saved to {manifest_path}")


if __name__ == "__main__":
    main()
