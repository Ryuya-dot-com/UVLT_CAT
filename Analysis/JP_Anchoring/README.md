# JP_Anchoring — UVLT Rasch anchor analysis (VN vs JP)

Cross-validation of Ha et al. (2025) Vietnamese-L1 UVLT item calibrations
against a pooled sample of 312 Japanese-L1 university students.

## Data

- `Analysis/Japanese_University_Students/`
  - `1. uVLT_SSLA.xlsx` — F1, 161 students, 1K–5K
  - `2. uVLT_LGCTGC.xlsx` — F2, 117 students, 1K–4K only (no 5K)
  - `3. uVLT_VocabLanguaging.xlsx` — F3, 34 students, 1K–5K
- `Readings/Study01_UVLT/`
  - `Winsteps files/UVLT_Data{1..5}k.txt` — 311 VN-L1 binary responses
  - `ConQuest files/{1..5}k/UVLT{n}-1_prm.txt` — 1D Rasch δ per level
  - `ConQuest files/{1..5}k/UVLT{n}-11TL_prm.txt` — 11-testlet δ per level

## Pipeline (run in order)

```
scripts/01_prepare_jp_data.R     # Excel -> 312x150 binary responses
scripts/02_prepare_vn_data.R     # Winsteps -> 311x150
scripts/03_read_ha_params.R      # ConQuest -> 1D + 11TL delta tables
scripts/04_descriptives.R        # alpha, p-values, descriptives
scripts/05_rasch_1D.R            # 1D per-level + joint (TAM)
scripts/06_rasch_11TL.R          # 11-testlet per-level (TAM, Q matrix)
scripts/07_compare_difficulty.R  # JP vs Ha delta scatter/r/RMSD
scripts/08_dif_vn_vs_jp.R        # MH + LogReg DIF, 2 scenarios
scripts/09_dif_jp_subgroups.R    # 5K-admin vs 4K-only DIF within JP
scripts/10_anchored_analysis.R   # Ha delta fixed, JP theta + person fit
scripts/11_flag_items_summary.R  # unify DIF flags + code direction
scripts/12_lexical_dif_synthesis.R # lexical attributes vs DIF direction
scripts/13_rasch_11TL_joint.R    # joint 51-dim 11TL fits (VN / JP)
scripts/15_joint11TL_dif_sensitivity.R # joint-11TL DIF sensitivity
scripts/16_model_comparison.R    # 1D vs 11TL information criteria
scripts/17_loanword_replacement_targets.R # replacement target shortlist
scripts/18_merge_replacement_candidates.R # merge replacement suggestions
report/report.Rmd                # consolidated HTML report
report/uvlt_report.qmd           # interactive Quarto report
```

Quick full run (canonical full pipeline):

```sh
cd Analysis/JP_Anchoring
for s in 01_prepare_jp_data 02_prepare_vn_data 03_read_ha_params \
         04_descriptives 05_rasch_1D 06_rasch_11TL \
         07_compare_difficulty 08_dif_vn_vs_jp 09_dif_jp_subgroups \
         10_anchored_analysis 11_flag_items_summary \
         12_lexical_dif_synthesis 13_rasch_11TL_joint \
         15_joint11TL_dif_sensitivity 16_model_comparison \
         17_loanword_replacement_targets 18_merge_replacement_candidates; do
  Rscript "scripts/${s}.R"
done
Rscript -e 'rmarkdown::render("report/report.Rmd")'
quarto render report/uvlt_report.qmd
```

If the `JP_all` joint 11TL fit is unstable, `scripts/14_rasch_11TL_joint_JPall_retry.R`
is an optional recovery path rather than part of the canonical run.

## Key findings

- JP_all vs Ha 1D joint (150 items): **r = 0.89, RMSD = 1.29**,
  slope ≈ 0.73, intercept ≈ -0.82 (JP scale compressed vs VN).
- 11TL per-level internally consistent with 1D (r = 0.98 within JP).
- DIF (MH purified, BH-adjusted):
  - Scenario A (JP_all vs VN, 1K-4K): **42 / 120 items at ETS=C**.
  - Scenario B (JP_5K vs VN, 1K-5K): **strongest DIF in 5K**
    (19/30 C flags).
  - JP internal (5K-admin vs 4K-only): only **2 items C** — the
    Japanese sub-samples are poolable.
- Anchoring Ha δ and estimating JP θ → **45.8% of JP pps with
  outfit MNSQ > 1.5**, i.e. Ha et al.'s calibration does not fit
  JP responses well without re-calibration or DIF adjustment.

## Requirements

- R >= 4.5.x, packages: TAM, mirt, difR, eRm, readxl, tidyverse,
  openxlsx, sfsmisc (QMC), psych, knitr, rmarkdown, ggplot2.

## Outputs

- `results/descriptives/` — group summaries, item p-values, alpha
- `results/rasch_1D/` — per-level & joint 1D Rasch item and person pars
- `results/rasch_11TL/` — per-level 11TL item pars, variance summary
- `results/comparison/` — JP-vs-Ha scatter plots, correlation tables
- `results/dif/` — DIF tables and volcano plots
- `results/anchored/` — anchored theta, person fit
- `report/report.html` — consolidated HTML write-up (R Markdown)
- `report/uvlt_report.html` — **interactive Quarto report** with plotly
  charts, gt/DT tables (Excel/CSV download buttons), Wright maps, forest
  plots, and full Part A lexical synthesis. Render via:
  `quarto render report/uvlt_report.qmd`
