# =============================================================================
# 13_rasch_11TL_joint.R
# -----------------------------------------------------------------------------
# Joint 150-item, 51-dimensional testlet Rasch model:
#   1 primary ability dimension + 50 testlet-specific dimensions
#   (5 bands × 10 testlets × 3 items each).
#
# Strategy for convergence:
#   * Warm start from per-level 11TL item parameters (script 06 output)
#   * QMC integration with snodes = 2000 (higher than default 1500)
#   * maxiter = 1500, conv = 5e-4 (tighter than per-level's 2e-3)
#   * Msteps = 8 (default 4) for more robust M-step
#   * Gracefully prune dims with no items (e.g. JP_4K_only has no 5K testlets)
#
# Outputs for each sample:
#   - item parameters (delta, SE) with starting-value comparison
#   - testlet variance table (primary + 50 testlet dims, when identified)
#   - fit object (.RData)
#   - convergence log (iters, loglik history, deviance)
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

root    <- resolve_project_root()
ana     <- file.path(root, "Analysis", "JP_Anchoring")
dat_dir <- file.path(ana, "data", "processed")
out_dir <- file.path(ana, "results", "rasch_11TL_joint")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

items   <- read_csv(file.path(dat_dir, "jp_item_info.csv"),  show_col_types = FALSE)
persons <- read_csv(file.path(dat_dir, "jp_person_info.csv"),show_col_types = FALSE)
jp_wide <- read_csv(file.path(dat_dir, "jp_responses_wide.csv"), show_col_types = FALSE)
vn_wide <- read_csv(file.path(dat_dir, "vn_responses_wide.csv"), show_col_types = FALSE)

# per-level fits for warm start
per_lvl <- read_csv(file.path(ana, "results/rasch_11TL/item_params_perlevel_11TL.csv"),
                    show_col_types = FALSE)

# matrices
jp_all <- as.matrix(jp_wide[, items$item_id]); rownames(jp_all) <- jp_wide$person_id
vn_all <- as.matrix(vn_wide[, items$item_id]); rownames(vn_all) <- vn_wide$person_id
jp_5K  <- jp_all[persons$sample_group == "JP_5K_admin", ]
jp_4K  <- jp_all[persons$sample_group == "JP_4K_only",  ]

# -----------------------------------------------------------------------------
# Q matrix 150 × 51 — primary + 50 testlets
# -----------------------------------------------------------------------------
build_Q_joint <- function() {
  Q <- matrix(0, nrow = 150, ncol = 51)
  Q[, 1] <- 1
  levels_order <- c("1K","2K","3K","4K","5K")
  for (L in seq_along(levels_order)) {
    for (t in 1:10) {
      row_idx <- (L - 1) * 30 + (t - 1) * 3 + 1:3
      col_idx <- 1 + (L - 1) * 10 + t
      Q[row_idx, col_idx] <- 1
    }
  }
  rownames(Q) <- items$item_id
  colnames(Q) <- c("primary",
                   unlist(lapply(levels_order, function(lv)
                                sprintf("%s_t%02d", lv, 1:10))))
  Q
}
Q_joint <- build_Q_joint()

# -----------------------------------------------------------------------------
# Pruning helper: drop no-variance items and any dim left with 0 items
# -----------------------------------------------------------------------------
prep_sample <- function(mat) {
  iv <- apply(mat, 2, var, na.rm = TRUE)
  keep_items <- which(!is.na(iv) & iv > 0)
  dropped    <- setdiff(seq_len(ncol(mat)), keep_items)
  mat2 <- mat[, keep_items, drop = FALSE]

  Q2 <- Q_joint[keep_items, , drop = FALSE]
  # always keep primary; drop testlet dims that now have 0 items
  keep_dims <- c(1L, 1L + which(colSums(Q2[, -1, drop = FALSE]) > 0))
  Q2 <- Q2[, keep_dims, drop = FALSE]

  list(mat = mat2,
       Q   = Q2,
       items_kept = colnames(mat2),
       items_dropped = colnames(mat)[dropped],
       dims_kept = colnames(Q2))
}

# -----------------------------------------------------------------------------
# Warm-start xsi from per-level fits (sample-specific)
# -----------------------------------------------------------------------------
init_xsi <- function(sample_tag, item_ids) {
  w <- per_lvl |>
    filter(sample == sample_tag, item_id %in% item_ids) |>
    select(item_id, delta)
  lookup <- setNames(w$delta, w$item_id)
  # fallback to 0 for items not in per-level fit (no-variance items there)
  xsi <- unname(lookup[item_ids])
  xsi[is.na(xsi)] <- 0
  cbind(seq_along(xsi), xsi)
}

# -----------------------------------------------------------------------------
# Main fit function
# -----------------------------------------------------------------------------
fit_joint_11TL <- function(mat, sample_tag,
                           snodes = 2000, maxiter = 1500, conv = 5e-4,
                           Msteps = 8) {
  cat(sprintf("\n========== %s  joint-51dim 11TL ==========\n", sample_tag))
  prep <- prep_sample(mat)
  cat(sprintf("  items kept = %d (dropped %d)\n  dims kept  = %d / 51\n",
              ncol(prep$mat), length(prep$items_dropped), ncol(prep$Q)))

  xsi_init <- init_xsi(sample_tag, prep$items_kept)
  cat(sprintf("  using %d warm-start xsi values\n", nrow(xsi_init)))

  t0 <- Sys.time()
  fit <- tryCatch(
    tam.mml(resp = prep$mat,
            Q    = prep$Q,
            irtmodel = "1PL",
            xsi.inits = xsi_init,
            control = list(progress = FALSE,
                           maxiter  = maxiter,
                           snodes   = snodes,
                           QMC      = TRUE,
                           conv     = conv,
                           Msteps   = Msteps)),
    error = function(e) {
      message("  FIT ERROR: ", conditionMessage(e)); NULL })
  t1 <- Sys.time()
  elapsed <- as.numeric(difftime(t1, t0, units = "mins"))

  if (is.null(fit)) {
    cat(sprintf("  FAILED after %.1f min\n", elapsed))
    return(NULL)
  }

  cat(sprintf("  iter used = %d / %d  (%.1f min)\n",
              fit$iter, maxiter, elapsed))
  converged <- fit$iter < maxiter
  cat(sprintf("  converged = %s\n", converged))

  # diagnostics
  loglik <- if (!is.null(fit$ic$loglike))
              fit$ic$loglike else fit$deviance / -2
  cat(sprintf("  final logL = %.2f, deviance = %.2f, AIC = %.1f, BIC = %.1f\n",
              loglik, fit$ic$deviance, fit$ic$AIC, fit$ic$BIC))

  # item parameters
  xsi <- as.numeric(fit$item$xsi.item)
  se  <- if ("se.xsi" %in% colnames(fit$item))
           as.numeric(fit$item$se.xsi) else NA_real_
  item_par <- tibble(
    item_id = colnames(prep$mat),
    delta   = xsi,
    se      = se,
    sample  = sample_tag,
    model   = "11TL_joint"
  ) |>
    left_join(items |> select(item_id, level, position, target), by = "item_id")

  # variance diag
  vardiag <- diag(fit$variance)
  var_tbl <- tibble(
    sample    = sample_tag,
    dim_name  = prep$dims_kept,
    variance  = vardiag,
    is_primary= prep$dims_kept == "primary"
  )

  list(sample   = sample_tag,
       fit      = fit,
       prep     = prep,
       elapsed_min = elapsed,
       converged   = converged,
       item_par    = item_par,
       var_tbl     = var_tbl,
       ic          = fit$ic)
}

# -----------------------------------------------------------------------------
# Run for each sample, saving progress after each
# -----------------------------------------------------------------------------
samples <- list(VN = vn_all, JP_all = jp_all,
                JP_5K_admin = jp_5K, JP_4K_only = jp_4K)

# Command-line override: which samples to run (defaults to all)
args <- commandArgs(trailingOnly = TRUE)
if (length(args) > 0) samples <- samples[intersect(names(samples), args)]
cat("Will run:", paste(names(samples), collapse = ", "), "\n")

# Settings can be overridden via env
snodes  <- as.integer(Sys.getenv("JOINT_SNODES",  "2000"))
maxiter <- as.integer(Sys.getenv("JOINT_MAXITER", "1500"))
conv_th <- as.numeric(Sys.getenv("JOINT_CONV",    "0.0005"))

cat(sprintf("Settings: snodes=%d, maxiter=%d, conv=%.4g\n",
            snodes, maxiter, conv_th))

results <- list()
for (nm in names(samples)) {
  res <- fit_joint_11TL(samples[[nm]], nm,
                        snodes = snodes, maxiter = maxiter, conv = conv_th)
  if (!is.null(res)) {
    results[[nm]] <- res
    # incremental save: item and var tables only
    write_csv(res$item_par, file.path(out_dir,
                                      sprintf("item_params_%s.csv", nm)))
    write_csv(res$var_tbl,  file.path(out_dir,
                                      sprintf("variance_%s.csv", nm)))
    # save full fit object
    saveRDS(res, file.path(out_dir, sprintf("fit_%s.rds", nm)))
    cat(sprintf("  -> saved %s\n", nm))
  }
}

# -----------------------------------------------------------------------------
# Consolidated outputs
# -----------------------------------------------------------------------------
if (length(results) > 0) {
  item_all <- bind_rows(lapply(results, `[[`, "item_par"))
  write_csv(item_all, file.path(out_dir, "item_params_all_joint11TL.csv"))
  var_all  <- bind_rows(lapply(results, `[[`, "var_tbl"))
  write_csv(var_all,  file.path(out_dir, "variance_all_joint11TL.csv"))

  conv_log <- tibble(
    sample    = names(results),
    elapsed_min = sapply(results, function(r) r$elapsed_min),
    converged   = sapply(results, function(r) r$converged),
    iter        = sapply(results, function(r) r$fit$iter),
    AIC         = sapply(results, function(r) r$ic$AIC),
    BIC         = sapply(results, function(r) r$ic$BIC),
    deviance    = sapply(results, function(r) r$ic$deviance),
    n_items     = sapply(results, function(r) ncol(r$prep$mat)),
    n_dims      = sapply(results, function(r) ncol(r$prep$Q)),
    snodes      = snodes,
    maxiter_set = maxiter,
    conv_set    = conv_th
  )
  write_csv(conv_log, file.path(out_dir, "convergence_log.csv"))
  cat("\nConvergence summary:\n"); print(conv_log)
}

cat("\nAll done. Outputs in ", out_dir, "\n")
