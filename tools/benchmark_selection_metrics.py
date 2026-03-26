from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from py_mini_racer import py_mini_racer


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


def build_context() -> py_mini_racer.MiniRacer:
    context = py_mini_racer.MiniRacer()
    context.eval(JS_STUB)
    context.eval(SCRIPT_PATH.read_text(encoding="utf-8"))
    return context


def run_metric(context: py_mini_racer.MiniRacer, metric: str, cases: int, seed: int) -> dict:
    context.eval(f"window.UVLT_CAT_DEV.currentConfig.selectionMetricType = '{metric}';")
    started = time.perf_counter()
    payload = context.eval(
        f"JSON.stringify(window.UVLT_CAT_DEV.runSimulationSuite({cases}, {seed}))"
    )
    elapsed = time.perf_counter() - started
    profile_rows = json.loads(payload)

    return {
        "metric": metric,
        "cases_per_profile": max(10, int(cases)),
        "elapsed_seconds": round(elapsed, 2),
        "avg_abs_theta_error_across_profiles": round(
            sum(row["avgAbsThetaError"] for row in profile_rows) / len(profile_rows), 3
        ),
        "avg_se_across_profiles": round(
            sum(row["avgSE"] for row in profile_rows) / len(profile_rows), 3
        ),
        "avg_testlets_across_profiles": round(
            sum(row["avgTestlets"] for row in profile_rows) / len(profile_rows), 2
        ),
        "profile_rows": profile_rows,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark UVLT CAT selection metrics with the browser JS implementation."
    )
    parser.add_argument(
        "--cases",
        type=int,
        default=100,
        help="Requested simulation cases per profile. Values below 10 are promoted to 10.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help="Random seed passed to the JS simulator.",
    )
    parser.add_argument(
        "--metrics",
        nargs="+",
        default=[
            "expectedPosteriorVarianceReduction",
            "expectedMarginalTestletInformation",
        ],
        help="Selection metrics to benchmark.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional JSON output path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    context = build_context()
    results = [run_metric(context, metric, args.cases, args.seed) for metric in args.metrics]
    text = json.dumps(results, ensure_ascii=False, indent=2)

    if args.output:
        args.output.write_text(text, encoding="utf-8")

    print(text)


if __name__ == "__main__":
    main()
