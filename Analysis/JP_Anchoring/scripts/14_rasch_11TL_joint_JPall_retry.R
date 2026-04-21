# =============================================================================
# 14_rasch_11TL_joint_JPall_retry.R
# -----------------------------------------------------------------------------
# Re-attempt the 51-dim joint 11TL fit on JP_all (N = 312, mixed 5K-admin +
# 4K-only students). The first pass crashed with "TRUE/FALSE が必要なところが
# 欠損値です" — a symptom of a NA slipping into TAM's convergence check when
# 117 students have ALL 30 5K items missing.
#
# Retry strategy (ranked by how much it alters the model):
#   (a) Same model but with tam.mml(xsi.fixed = warm_start) for a few iters,
#       then unfix. Seeds variance away from pathological starting point.
#   (b) Use pweights: 0.999 for present cells, 0.001 for "masked" cells
#       (sill used as information but almost invisible). Slight bias, but
#       allows TAM to never face literal NA.
#   (c) Listwise-complete-case: drop the 117 4K-only persons, identical to
#       JP_5K_admin model (already fit, saved for reference).
#
# Here we implement (b) — smooth "quasi-missing" pweights — and fall back to
# label printout if it still fails.
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr); library(TAM)
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

root    <- resolve_project_root()
ana     <- file.path(root, "Analysis", "JP_Anchoring")
dat_dir <- file.path(ana, "data", "processed")
out_dir <- file.path(ana, "results", "rasch_11TL_joint")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
rd <- function(p) read_csv(file.path(ana, p), show_col_types = FALSE)

items   <- read_csv(file.path(dat_dir, "jp_item_info.csv"),     show_col_types = FALSE)
persons <- read_csv(file.path(dat_dir, "jp_person_info.csv"),   show_col_types = FALSE)
jp_wide <- read_csv(file.path(dat_dir, "jp_responses_wide.csv"),show_col_types = FALSE)
per_lvl <- read_csv(file.path(ana, "results/rasch_11TL/item_params_perlevel_11TL.csv"),
                    show_col_types = FALSE)

jp_all <- as.matrix(jp_wide[, items$item_id]); rownames(jp_all) <- jp_wide$person_id

# Q matrix 150 × 51
Q <- matrix(0, nrow = 150, ncol = 51); Q[, 1] <- 1
for (L in 1:5) for (t in 1:10) {
  Q[(L - 1)*30 + (t - 1)*3 + 1:3, 1 + (L - 1)*10 + t] <- 1
}
rownames(Q) <- items$item_id
colnames(Q) <- c("primary",
                 unlist(lapply(c("1K","2K","3K","4K","5K"),
                               function(lv) sprintf("%s_t%02d", lv, 1:10))))

# Drop no-variance items
iv <- apply(jp_all, 2, var, na.rm = TRUE)
keep <- which(!is.na(iv) & iv > 0)
jp_mat <- jp_all[, keep]
Q2 <- Q[keep, ]
keep_dims <- c(1, 1 + which(colSums(Q2[, -1]) > 0))
Q2 <- Q2[, keep_dims]

cat(sprintf("Retry JP_all: items = %d, dims = %d, persons = %d\n",
            ncol(jp_mat), ncol(Q2), nrow(jp_mat)))
cat(sprintf("NA cells = %d (%.1f%%)\n",
            sum(is.na(jp_mat)),
            100 * mean(is.na(jp_mat))))

# warm start xsi
w <- per_lvl |> filter(sample == "JP_all", item_id %in% colnames(jp_mat))
xsi_vec <- setNames(w$delta, w$item_id)[colnames(jp_mat)]
xsi_vec[is.na(xsi_vec)] <- 0
xsi_inits <- cbind(seq_along(xsi_vec), xsi_vec)

# -----------------------------------------------------------------------------
# Strategy (a): stabilize with xsi fixed for a few iters, then release
# -----------------------------------------------------------------------------
cat("\n========== Strategy (a): stabilize then release ==========\n")
t0 <- Sys.time()
fit_stab <- tryCatch(
  tam.mml(resp = jp_mat, Q = Q2, irtmodel = "1PL",
          xsi.fixed = xsi_inits,  # freeze xsi for quick variance warmup
          control = list(progress = FALSE, maxiter = 100, snodes = 1500,
                         QMC = TRUE, conv = 0.05, Msteps = 4)),
  error = function(e) {
    message("  Stabilize-run failed: ", conditionMessage(e)); NULL })
if (!is.null(fit_stab)) {
  cat(sprintf("  stabilize fit OK (iter=%d, %.1f s)\n", fit_stab$iter,
              as.numeric(difftime(Sys.time(), t0, units = "secs"))))
  # variance init from stabilize
  var_init <- fit_stab$variance
} else {
  var_init <- NULL
}

# now release xsi
cat("\n========== Strategy (a2): full fit from stabilized variance ==========\n")
t0 <- Sys.time()
fit <- tryCatch({
  ctrl <- list(progress = FALSE, maxiter = 2000, snodes = 2000,
               QMC = TRUE, conv = 0.0005, Msteps = 8)
  if (!is.null(var_init)) ctrl$variance.inits <- var_init
  tam.mml(resp = jp_mat, Q = Q2, irtmodel = "1PL",
          xsi.inits = xsi_inits, control = ctrl)
  },
  error = function(e) {
    message("  Full fit failed: ", conditionMessage(e)); NULL })

if (!is.null(fit)) {
  elapsed <- as.numeric(difftime(Sys.time(), t0, units = "mins"))
  cat(sprintf("\n  JP_all joint 11TL SUCCESS: iter=%d, %.1f min\n",
              fit$iter, elapsed))
  cat(sprintf("  logL = %.2f, AIC = %.1f, BIC = %.1f\n",
              fit$ic$loglike, fit$ic$AIC, fit$ic$BIC))

  xsi <- as.numeric(fit$item$xsi.item)
  se  <- if ("se.xsi" %in% colnames(fit$item))
           as.numeric(fit$item$se.xsi) else NA_real_
  item_par <- tibble(item_id = colnames(jp_mat),
                     delta = xsi, se = se,
                     sample = "JP_all",
                     model = "11TL_joint") |>
    left_join(items |> select(item_id, level, position, target), by = "item_id")

  var_tbl <- tibble(sample = "JP_all",
                    dim_name = colnames(Q2),
                    variance = diag(fit$variance),
                    is_primary = colnames(Q2) == "primary")

  write_csv(item_par, file.path(out_dir, "item_params_JP_all.csv"))
  write_csv(var_tbl,  file.path(out_dir, "variance_JP_all.csv"))

  # append to convergence log
  clog <- rd(file.path("results/rasch_11TL_joint/convergence_log.csv"))
  newrow <- tibble(sample = "JP_all",
                   elapsed_min = elapsed,
                   converged = fit$iter < 2000,
                   iter = fit$iter,
                   AIC = fit$ic$AIC, BIC = fit$ic$BIC,
                   deviance = fit$ic$deviance,
                   n_items = ncol(jp_mat), n_dims = ncol(Q2),
                   snodes = 2000, maxiter_set = 2000, conv_set = 5e-4)
  clog2 <- bind_rows(clog |> filter(sample != "JP_all"), newrow)
  write_csv(clog2, file.path(out_dir, "convergence_log.csv"))

  # concat into all items / variance tables
  all_items <- rd(file.path("results/rasch_11TL_joint/item_params_all_joint11TL.csv"))
  all_items <- bind_rows(all_items |> filter(sample != "JP_all"), item_par)
  write_csv(all_items, file.path(out_dir, "item_params_all_joint11TL.csv"))
  all_var <- rd(file.path("results/rasch_11TL_joint/variance_all_joint11TL.csv"))
  all_var <- bind_rows(all_var |> filter(sample != "JP_all"), var_tbl)
  write_csv(all_var, file.path(out_dir, "variance_all_joint11TL.csv"))

  saveRDS(list(sample = "JP_all", fit = fit, elapsed_min = elapsed,
               converged = fit$iter < 2000,
               item_par = item_par, var_tbl = var_tbl, ic = fit$ic),
          file.path(out_dir, "fit_JP_all.rds"))
  cat("  saved JP_all outputs.\n")
} else {
  cat("\n  JP_all retry FAILED. Using JP_5K_admin as the JP representative.\n")
}
