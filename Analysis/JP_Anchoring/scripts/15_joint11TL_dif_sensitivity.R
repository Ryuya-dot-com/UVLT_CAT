# =============================================================================
# 15_joint11TL_dif_sensitivity.R
# -----------------------------------------------------------------------------
# Testlet-aware DIF between VN and JP using joint 51-dim 11TL item difficulties
# (primary dimension). We then cross-check against the 1D Mantel-Haenszel DIF
# (Scenario A) to quantify sensitivity of the lexical findings to the
# assumed model.
#
# Steps:
#   1. Load joint 11TL item deltas (VN, JP_all) and their SEs.
#   2. Mean-center within each band to put δ's on a common linear scale
#      (common-item linking, since the VN and JP fits are independent).
#   3. Compute item-level delta_diff = δ_JP − δ_VN (signed; negative → easier
#      for JP) and a Wald z = delta_diff / sqrt(SE_VN² + SE_JP²).
#   4. Benjamini–Hochberg adjust p-values.
#   5. Classify testlet-DIF with |delta_diff| ≥ 0.5 (Rasch) and adj p < .05.
#   6. Cross-tab with 1D Mantel-Haenszel flags from Scenario A.
#   7. Re-run lexical-attribute regression using signed delta_diff as outcome.
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr)
  library(jsonlite); library(broom); library(ggplot2)
})

find_project_root <- function(start = getwd()) {
  path <- normalizePath(start, winslash = "/", mustWork = TRUE)
  repeat {
    if (all(dir.exists(file.path(path, c("Analysis", "App_CAT", "Manuscript", "Readings"))))) {
      return(path)
    }
    parent <- dirname(path)
    if (identical(parent, path)) {
      stop("Could not locate the UVLT_CAT project root.", call. = FALSE)
    }
    path <- parent
  }
}

resolve_project_root <- function() {
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- "--file="
  file_path <- sub(file_arg, "", args[startsWith(args, file_arg)])

  if (length(file_path) >= 1L && file.exists(file_path[1])) {
    return(find_project_root(dirname(file_path[1])))
  }

  if (requireNamespace("knitr", quietly = TRUE)) {
    input_dir <- tryCatch(knitr::current_input(dir = TRUE), error = function(e) "")
    if (nzchar(input_dir) && dir.exists(input_dir)) {
      return(find_project_root(input_dir))
    }
  }

  find_project_root(getwd())
}

root <- resolve_project_root()
ana  <- file.path(root, "Analysis", "JP_Anchoring")
dat  <- file.path(ana, "data", "processed")
out  <- file.path(ana, "results", "dif_joint11TL")
dir.create(out, recursive = TRUE, showWarnings = FALSE)

joint <- read_csv(file.path(ana, "results/rasch_11TL_joint/item_params_all_joint11TL.csv"),
                  show_col_types = FALSE)
items <- read_csv(file.path(dat, "jp_item_info.csv"), show_col_types = FALSE)

# ---- pivot ------------------------------------------------------------------
pair <- joint |>
  filter(sample %in% c("VN","JP_all")) |>
  select(item_id, level, target, sample, delta, se) |>
  pivot_wider(names_from = sample, values_from = c(delta, se))

# drop items missing from either sample (e.g., 1K_26 removed as no-variance)
pair <- pair |> filter(!is.na(delta_VN) & !is.na(delta_JP_all))
cat("Common items for VN vs JP_all joint 11TL DIF:", nrow(pair), "\n")

# ---- within-band mean centring (common-item linking) ------------------------
pair <- pair |>
  group_by(level) |>
  mutate(delta_VN_c  = delta_VN  - mean(delta_VN,  na.rm = TRUE),
         delta_JP_c  = delta_JP_all - mean(delta_JP_all, na.rm = TRUE),
         delta_diff  = delta_JP_c - delta_VN_c,
         se_diff     = sqrt(pmax(se_VN,   1e-6)^2 +
                            pmax(se_JP_all,1e-6)^2),
         z_stat      = delta_diff / se_diff,
         p_raw       = 2 * pnorm(-abs(z_stat))) |>
  ungroup() |>
  mutate(p_adj = p.adjust(p_raw, method = "BH"))

# ---- classify DIF -----------------------------------------------------------
pair <- pair |>
  mutate(flag_testlet = case_when(
    is.na(delta_diff) ~ "NA",
    abs(delta_diff) >= 0.5 & p_adj < .05 & delta_diff <= -0.5 ~ "Easier_for_JP",
    abs(delta_diff) >= 0.5 & p_adj < .05 & delta_diff >=  0.5 ~ "Harder_for_JP",
    abs(delta_diff) >= 0.3 ~ "Mild",
    TRUE ~ "Negligible"
  ))

write_csv(pair, file.path(out, "joint11TL_dif_VNvsJPall.csv"))

cat("\nTestlet-aware DIF flags (joint 11TL, mean-centred within band):\n")
print(pair |> count(level, flag_testlet) |>
        pivot_wider(names_from = flag_testlet, values_from = n, values_fill = 0))

# ---- cross-check with 1D Mantel-Haenszel (Scenario A) -----------------------
mh_A <- read_csv(file.path(ana, "results/dif/dif_scenarioA_JPall_vs_VN.csv"),
                 show_col_types = FALSE) |>
  select(item_id, MH_delta, MH_pval_adj, ETS_MH = ETS_cat)

cross <- pair |>
  select(item_id, level, target,
         delta_diff, p_adj, flag_testlet) |>
  left_join(mh_A, by = "item_id") |>
  mutate(flag_MH = case_when(
    is.na(MH_delta) ~ "NA",
    MH_delta <= -1.5 & MH_pval_adj < .05 ~ "Easier_for_JP",
    MH_delta >=  1.5 & MH_pval_adj < .05 ~ "Harder_for_JP",
    abs(MH_delta) >= 1.0 ~ "Mild",
    TRUE ~ "Negligible"
  )) |>
  mutate(
    MH_sig       = MH_delta <= -1.5 | MH_delta >= 1.5,
    testlet_sig  = abs(delta_diff) >= 0.5 & p_adj < .05,
    agreement    = case_when(
      is.na(MH_delta) ~ "out_of_scope",
      MH_sig &  testlet_sig ~ "Both",
      MH_sig & !testlet_sig ~ "MH_only",
      !MH_sig &  testlet_sig ~ "Testlet_only",
      TRUE ~ "Neither"))
write_csv(cross, file.path(out, "dif_method_concordance.csv"))

cat("\nConcordance table — 1D MH vs testlet-aware (joint 11TL):\n")
print(cross |> count(agreement))
cat("\nBy level:\n")
print(cross |> count(level, agreement) |>
        pivot_wider(names_from = agreement, values_from = n, values_fill = 0))

# directional concordance
cat("\nDirectional agreement among items flagged by BOTH methods:\n")
both <- cross |> filter(agreement == "Both")
print(both |> count(flag_testlet, flag_MH))

# correlation of effect sizes
cat("\nCorrelation of effect-size estimates:\n")
cat(sprintf("  Pearson r (MH delta, testlet delta_diff) = %.3f\n",
            cor(cross$MH_delta, cross$delta_diff, use = "complete")))
cat(sprintf("  Spearman rho                              = %.3f\n",
            cor(cross$MH_delta, cross$delta_diff, use = "complete",
                method = "spearman")))

# ---- plot: MH vs testlet-aware effect sizes ---------------------------------
p1 <- ggplot(cross |> filter(!is.na(MH_delta)),
             aes(x = MH_delta, y = delta_diff, color = agreement)) +
  geom_vline(xintercept = c(-1.5, 1.5), linetype = 3, alpha = .4) +
  geom_hline(yintercept = c(-0.5, 0.5), linetype = 3, alpha = .4) +
  geom_point(alpha = .8, size = 2.2) +
  scale_color_manual(values = c(Both = "#C0392B",
                                MH_only = "#2980B9",
                                Testlet_only = "#8E44AD",
                                Neither = "grey60",
                                out_of_scope = "grey85")) +
  labs(x = "1D Mantel-Haenszel delta (Scenario A)",
       y = "Testlet-aware delta_diff (δ_JP − δ_VN, band-centred)",
       title = "DIF effect size: MH (1D) vs testlet-aware (joint 11TL)",
       subtitle = "Red = flagged by both; blue = MH only; purple = testlet only")
ggsave(file.path(out, "mh_vs_testlet_scatter.png"), p1,
       width = 8, height = 5.5, dpi = 150)

# ---- lexical sensitivity ----------------------------------------------------
lex <- read_csv(file.path(ana, "results/dif/dif_with_lexical.csv"),
                show_col_types = FALSE) |>
  distinct(item_id, loanword_status, cognate_ease, polysemy,
           translation_ambiguity_JP, cultural_tilt,
           pos, most_common_JP, target)

pair_lex <- pair |>
  left_join(lex, by = "item_id")

# Only items with lexical attributes (the 67 originally flagged) OR all 150?
# We have lexical only for the flagged set. To check generalisation, we
# annotate the remaining items via a light-weight rule:
# - has_katakana: any of 'loanword'/'dual' OR NA (we mark NA as unknown)
pair_lex <- pair_lex |>
  mutate(has_katakana = ifelse(is.na(loanword_status), NA,
                               loanword_status %in% c("loanword","dual")))

# Subset to annotated
lex_sub <- pair_lex |> filter(!is.na(loanword_status))
cat(sprintf("\nItems with lexical annotation available: %d / %d\n",
            nrow(lex_sub), nrow(pair_lex)))

# linear model: delta_diff ~ lexical attributes
mod_sens <- lm(delta_diff ~ factor(cognate_ease, levels = c("low","medium","high")) +
                            factor(pos, levels = c("noun","verb","adjective")) +
                            factor(cultural_tilt,
                                   levels = c("universal","business_academic",
                                              "western")),
               data = lex_sub)
coef_sens <- broom::tidy(mod_sens, conf.int = TRUE) |>
  mutate(p.value = signif(p.value, 3))
write_csv(coef_sens, file.path(out, "sensitivity_linear_coef.csv"))
cat("\nSensitivity — linear model on signed testlet delta_diff:\n")
print(coef_sens, width = Inf)

# per-category mean delta_diff
summ_cog <- lex_sub |> group_by(cognate_ease) |>
  summarise(n = n(),
            mean_diff = mean(delta_diff, na.rm = TRUE),
            sd_diff   = sd(delta_diff, na.rm = TRUE),
            .groups = "drop")
cat("\nMean signed delta_diff by cognate_ease:\n"); print(summ_cog)
write_csv(summ_cog, file.path(out, "sensitivity_by_cognate.csv"))

summ_lw <- lex_sub |> group_by(loanword_status) |>
  summarise(n = n(),
            mean_diff = mean(delta_diff, na.rm = TRUE),
            sd_diff   = sd(delta_diff, na.rm = TRUE),
            .groups = "drop")
cat("\nMean signed delta_diff by loanword_status:\n"); print(summ_lw)

# correlation of signed effect size between MH and testlet
cor_mh_tlt_only_flagged <- cor(lex_sub$MH_delta <- {
  mh <- mh_A$MH_delta[match(lex_sub$item_id, mh_A$item_id)]; mh
}, lex_sub$delta_diff, use = "complete")

cat(sprintf("\nAmong flagged (N=%d), cor(MH delta, testlet delta_diff) = %.3f\n",
            nrow(lex_sub), cor_mh_tlt_only_flagged))

cat("\nDone. Outputs in", out, "\n")
