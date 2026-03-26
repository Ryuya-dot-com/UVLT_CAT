from __future__ import annotations

import json
from pathlib import Path

import numpy as np


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = REPO_ROOT / "Study01_UVLT" / "ConQuest files"
BANDS = ["1k", "2k", "3k", "4k", "5k"]
RAW_BAND_REFERENCE = {
    "1k": [-2.97942, -3.11853, -3.29266, -3.24746, -3.47051, -3.47051, -3.41272, -2.31129, -1.92248, -2.25096, -3.05118, -2.6499, -1.70328, -2.29598, -2.05763, -2.50274, -2.752, -3.10634, -2.4476, -2.57668, -1.84433, -2.5432, -1.84817, -0.93159, -3.08665, -3.61942, -3.36637, -0.94702, -1.22047, -1.73415],
    "2k": [-0.67529, -1.03908, -0.47767, -2.69415, -2.16032, -1.80317, -1.52419, -2.13189, -0.65492, -0.83834, -0.52813, 0.92313, -0.75561, -1.53636, -2.2663, -0.45807, -0.17593, -1.0166, -0.62371, -1.77664, -1.37614, -1.05696, -0.55582, -0.99606, -1.60194, -1.0372, 0.24745, 0.31803, -0.09045, -1.34679],
    "3k": [-1.21091, -1.1445, -1.81482, -1.01839, 0.49014, -0.3644, -1.04129, 0.57422, -1.97556, -0.92312, 0.28591, 0.69795, -1.29949, 0.57966, -1.8728, 0.80322, 0.6405, -0.24254, 0.00439, -0.17315, 0.16981, 0.66427, 0.66427, 0.71318, -0.68827, -0.20239, -0.71279, 0.01452, 0.47754, 0.60601],
    "4k": [-1.30329, -0.8106, 0.04709, -1.55279, -1.46711, -1.32819, 1.36317, 1.90707, 0.61313, 0.99444, 1.09688, 0.69816, 0.62973, -0.47131, 0.23521, -0.34152, 0.74048, 0.41277, 0.33921, 0.92455, 0.06449, 0.16599, 0.23408, -0.24867, 1.10217, 0.77742, 0.47456, 0.12488, 0.6346, -0.14029],
    "5k": [0.4187, -0.59309, 0.58643, 0.13516, 0.25492, 0.21123, 0.0739, 1.0403, -0.84137, -0.47066, -0.23389, 0.99636, 1.20411, 1.95915, 0.31854, -0.29743, 0.73262, -0.17359, 0.88251, 0.77906, 1.35679, 0.88522, 0.78701, 1.59435, 1.56878, 0.04684, 0.34657, 2.05119, 0.73821, 1.44108],
}


def logistic(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -35, 35)))


def load_complete_case_matrix() -> tuple[np.ndarray, int]:
    rows_by_band: dict[str, list[str]] = {}
    valid_indices: set[int] | None = None

    for band in BANDS:
        path = DATA_ROOT / band / f"UVLT{band[0]}-11TL_dat.txt"
        rows = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        rows_by_band[band] = rows
        complete = {index for index, row in enumerate(rows) if len(row) == 30}
        valid_indices = complete if valid_indices is None else valid_indices & complete

    common_indices = sorted(valid_indices or [])
    blocks = []
    for band in BANDS:
        block = np.array(
            [[1.0 if char == "1" else 0.0 for char in rows_by_band[band][index]] for index in common_indices],
            dtype=float,
        )
        blocks.append(block)

    return np.concatenate(blocks, axis=1), len(common_indices)


def estimate_rasch_jml(response_matrix: np.ndarray, max_iterations: int = 120) -> np.ndarray:
    person_count, item_count = response_matrix.shape

    person_scores = np.clip(response_matrix.sum(axis=1), 0.5, item_count - 0.5)
    theta = np.log(person_scores / (item_count - person_scores))

    item_scores = np.clip(response_matrix.sum(axis=0), 0.5, person_count - 0.5)
    difficulty = np.log((person_count - item_scores) / item_scores)
    difficulty -= difficulty.mean()

    for _ in range(max_iterations):
        for _ in range(2):
            probability = logistic(theta[:, None] - difficulty[None, :])
            gradient = response_matrix.sum(axis=1) - probability.sum(axis=1)
            hessian = -(probability * (1 - probability)).sum(axis=1)
            step = gradient / np.where(np.abs(hessian) < 1e-8, -1e-8, hessian)
            theta -= np.clip(step, -1, 1)
        theta -= theta.mean()

        previous = difficulty.copy()
        for _ in range(2):
            probability = logistic(theta[:, None] - difficulty[None, :])
            gradient = probability.sum(axis=0) - response_matrix.sum(axis=0)
            hessian = (probability * (1 - probability)).sum(axis=0)
            step = gradient / np.where(hessian < 1e-8, 1e-8, hessian)
            difficulty += np.clip(step, -1, 1)
        difficulty -= difficulty.mean()

        if np.max(np.abs(difficulty - previous)) < 1e-5:
            break

    return difficulty


def derive_coefficients(linked_difficulties: np.ndarray) -> dict[str, dict[str, float]]:
    coefficients: dict[str, dict[str, float]] = {}

    for index, band in enumerate(BANDS):
      raw = np.array(RAW_BAND_REFERENCE[band], dtype=float)
      target = linked_difficulties[index * 30:(index + 1) * 30]
      slope = float(np.cov(raw, target, ddof=0)[0, 1] / np.var(raw))
      intercept = float(target.mean() - slope * raw.mean())
      linked = slope * raw + intercept
      coefficients[band] = {
          "slope": round(slope, 6),
          "intercept": round(intercept, 6),
          "correlation": round(float(np.corrcoef(raw, target)[0, 1]), 6),
          "rmse": round(float(np.sqrt(np.mean((linked - target) ** 2))), 6),
      }

    return coefficients


def main() -> None:
    response_matrix, sample_size = load_complete_case_matrix()
    linked_difficulties = estimate_rasch_jml(response_matrix)
    coefficients = derive_coefficients(linked_difficulties)

    payload = {
        "version": "2026-03-26-common-person-v1",
        "method": "common-person complete-case Rasch linking",
        "scale": "linked multi-band theta scale",
        "calibrationSampleSize": sample_size,
        "source": "Study01_UVLT complete-case respondents across 1k-5k (11TL raw responses)",
        "coefficients": coefficients,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
