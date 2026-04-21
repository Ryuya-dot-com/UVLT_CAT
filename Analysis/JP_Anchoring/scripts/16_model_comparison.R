# =============================================================================
# 16_model_comparison.R
# -----------------------------------------------------------------------------
# Information-criteria comparison of UVLT Rasch models fitted to the same
# response matrix (within each sample). We compare, for each sample where
# it is valid:
#
#   M1 = 1D Rasch (joint, 150 items, 151 free parameters)
#   M2 = Joint 11-testlet Rasch (150 items, 1 primary + 50 testlet dims)
#
# AIC/BIC comparison is valid only when the two models are fit to the same
# response matrix (same persons × same items) — we enforce that here.
#
# We also report a "per-level pooled" AIC/BIC: the sum of AIC/BIC across the
# five independently fit 1-level 11TL models (script 06). This is not a valid
# IC comparison (different parameterisation and data partitioning), but is
# tabulated for context.
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr)
  library(TAM)
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
out  <- file.path(ana, "results", "model_comparison")
dir.create(out, recursive = TRUE, showWarnings = FALSE)

# -----------------------------------------------------------------------------
# Load 1D joint Rasch fits
# -----------------------------------------------------------------------------
load(file.path(ana, "results/rasch_1D/rasch_1D_fits.RData"))
#  -> per_level_results  (list by sample_level)
#  -> joint_results      (list by sample)

ic_1D_joint <- lapply(joint_results, function(r) {
  if (is.null(r$model)) return(NULL)
  tibble(sample = r$sample,
         model  = "1D_joint",
         logLik = r$model$ic$loglike,
         AIC    = r$model$ic$AIC,
         BIC    = r$model$ic$BIC,
         deviance = r$model$ic$deviance,
         n_items  = r$n_items,
         n_persons = r$n_persons)
}) |> bind_rows()

# -----------------------------------------------------------------------------
# Load 11TL joint Rasch ICs
# -----------------------------------------------------------------------------
clog <- read_csv(file.path(ana, "results/rasch_11TL_joint/convergence_log.csv"),
                 show_col_types = FALSE)
ic_11TL_joint <- clog |>
  transmute(sample, model = "11TL_joint",
            AIC, BIC, deviance,
            n_items, n_persons = NA_integer_,  # filled below
            logLik = -deviance / 2,
            iter, converged)

# fill persons counts
persons_by_sample <- list(VN = 311,
                          JP_all = 312,
                          JP_5K_admin = 195,
                          JP_4K_only  = 117)
ic_11TL_joint$n_persons <- unlist(persons_by_sample[ic_11TL_joint$sample])

# -----------------------------------------------------------------------------
# Per-level 11TL ICs (sum across 5 levels, within sample)
# -----------------------------------------------------------------------------
# We need these fits. The per-level results only saved item params/var tbl,
# not logLik. Refit if needed. For now, we refit per-level 11TL silently
# using saved params as starting values.
# -- Actually, the per-level results from 06 included the full fit object in
# -- rasch_11TL_fits.RData. Let's check.
if (file.exists(file.path(ana, "results/rasch_11TL/rasch_11TL_fits.RData"))) {
  load(file.path(ana, "results/rasch_11TL/rasch_11TL_fits.RData"))
  #  -> perlvl (list by sample_level), joint_items (list by sample)
  ic_11TL_per <- lapply(perlvl, function(r) {
    if (is.null(r$fit)) return(NULL)
    tibble(sample = r$sample,
           level  = r$level,
           logLik = r$fit$ic$loglike,
           AIC    = r$fit$ic$AIC,
           BIC    = r$fit$ic$BIC,
           deviance = r$fit$ic$deviance,
           npar   = length(r$fit$xsi$xsi.item) +
                    length(diag(r$fit$variance)))
  }) |> bind_rows()
  # Sum ACROSS levels within each sample (not a proper IC comparison;
  # tabulated for context only)
  ic_11TL_perlvl_sum <- ic_11TL_per |>
    group_by(sample) |>
    summarise(model   = "11TL_per-level (sum of 5 independent fits)",
              logLik  = sum(logLik, na.rm = TRUE),
              AIC     = sum(AIC, na.rm = TRUE),
              BIC     = sum(BIC, na.rm = TRUE),
              deviance = sum(deviance, na.rm = TRUE),
              n_items = 150,
              n_persons = NA_integer_,
              .groups = "drop")
  ic_11TL_perlvl_sum$n_persons <-
    unlist(persons_by_sample[ic_11TL_perlvl_sum$sample])
} else {
  ic_11TL_perlvl_sum <- NULL
  warning("per-level 11TL fits not found; skipping that row")
}

# -----------------------------------------------------------------------------
# Unified IC table (same-sample, same-data comparable rows only)
# -----------------------------------------------------------------------------
cmp <- bind_rows(
  ic_1D_joint |> mutate(iter = NA_integer_, converged = NA),
  ic_11TL_joint |> select(sample, model, logLik, AIC, BIC, deviance,
                          n_items, n_persons, iter, converged),
  if (!is.null(ic_11TL_perlvl_sum))
    ic_11TL_perlvl_sum |> mutate(iter = NA_integer_, converged = NA)
)

# ΔAIC, ΔBIC vs 1D-joint within sample (for items-matched rows only)
cmp <- cmp |>
  group_by(sample) |>
  mutate(ref_AIC = AIC[model == "1D_joint"][1],
         ref_BIC = BIC[model == "1D_joint"][1],
         dAIC    = AIC - ref_AIC,
         dBIC    = BIC - ref_BIC) |>
  ungroup() |>
  select(sample, model, n_persons, n_items, logLik, AIC, BIC,
         dAIC, dBIC, iter, converged)

write_csv(cmp, file.path(out, "IC_comparison_all.csv"))
cat("\nInformation-criteria comparison (per sample):\n")
print(cmp, n = 50, width = Inf)

# Sample-by-sample summary: is 11TL joint preferred?
cat("\nInterpretation (within each sample):\n")
cat("  ΔAIC < 0 and ΔBIC < 0 → 11TL_joint preferred over 1D_joint.\n")
cat("  ΔAIC > 10 or ΔBIC > 10 → substantial evidence for 1D_joint.\n\n")

cmp |> filter(model == "11TL_joint") |>
  transmute(sample,
            `ΔAIC (vs 1D_joint)` = round(dAIC, 1),
            `ΔBIC (vs 1D_joint)` = round(dBIC, 1),
            preferred_by_AIC = ifelse(dAIC < 0, "11TL", "1D"),
            preferred_by_BIC = ifelse(dBIC < 0, "11TL", "1D")) |>
  print()

# Save also the per-level 11TL breakdown
if (!is.null(ic_11TL_perlvl_sum)) {
  write_csv(ic_11TL_per, file.path(out, "IC_11TL_per_level.csv"))
}

cat("\nDone. Outputs in", out, "\n")
