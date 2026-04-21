# =============================================================================
# 06_rasch_11TL.R
# -----------------------------------------------------------------------------
# Multidimensional Rasch (11-testlet) calibration per level: 1 primary
# dimension + 10 testlet-specific dimensions. Items 1-3 load on testlet 1,
# 4-6 on testlet 2, ..., 28-30 on testlet 10 (same structure as Ha et al.
# ConQuest 11TL fits and the App_CAT test bank).
#
# Joint 50-testlet Rasch across all 150 items (51-dim model) is attempted
# at the end with a tight control so it still finishes in reasonable time.
# If convergence is unreliable we fall back to per-level results.
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr)
  library(TAM); library(ggplot2)
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
out_dir <- file.path(ana, "results", "rasch_11TL")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

items   <- read_csv(file.path(dat_dir, "jp_item_info.csv"),  show_col_types = FALSE)
persons <- read_csv(file.path(dat_dir, "jp_person_info.csv"),show_col_types = FALSE)
jp_wide <- read_csv(file.path(dat_dir, "jp_responses_wide.csv"), show_col_types = FALSE)
vn_wide <- read_csv(file.path(dat_dir, "vn_responses_wide.csv"), show_col_types = FALSE)

jp_all <- as.matrix(jp_wide[, items$item_id]); rownames(jp_all) <- jp_wide$person_id
vn_all <- as.matrix(vn_wide[, items$item_id]); rownames(vn_all) <- vn_wide$person_id
jp_5K  <- jp_all[persons$sample_group == "JP_5K_admin", ]
jp_4K  <- jp_all[persons$sample_group == "JP_4K_only",  ]

# -----------------------------------------------------------------------------
# Build Q-matrix: primary + 10 testlet dims for a single 30-item level
# -----------------------------------------------------------------------------
build_Q_1level <- function() {
  Q <- matrix(0, nrow = 30, ncol = 11)
  Q[, 1] <- 1                               # primary
  for (t in 1:10) {
    Q[((t - 1) * 3 + 1):(t * 3), t + 1] <- 1  # testlet dims
  }
  rownames(Q) <- sprintf("p%02d", 1:30)
  colnames(Q) <- c("primary", sprintf("tlt%02d", 1:10))
  Q
}

Q1 <- build_Q_1level()
cat("Q matrix (1-level 11TL):\n"); print(Q1)

# -----------------------------------------------------------------------------
# Fit 11TL per level
# -----------------------------------------------------------------------------
fit_11TL_level <- function(mat, lv, sample_tag) {
  cols <- items$item_id[items$level == lv]
  M <- mat[, cols, drop = FALSE]
  M <- M[rowSums(!is.na(M)) > 0, , drop = FALSE]

  iv <- apply(M, 2, var, na.rm = TRUE)
  bad <- names(iv)[is.na(iv) | iv == 0]
  if (length(bad) > 0) {
    message(sprintf("[%s %s 11TL] dropping %d no-variance items: %s",
                    sample_tag, lv, length(bad), paste(bad, collapse=",")))
  }
  keep_idx <- which(iv > 0)
  M2 <- M[, keep_idx, drop = FALSE]
  Q2 <- Q1[keep_idx, , drop = FALSE]
  # Remove any testlet dim that no longer has items after dropping
  keep_dims <- which(c(TRUE, colSums(Q2[, -1, drop = FALSE]) > 0))
  Q2 <- Q2[, keep_dims, drop = FALSE]

  t0 <- Sys.time()
  fit <- tryCatch(
    tam.mml(resp = M2, Q = Q2, irtmodel = "1PL",
            control = list(progress = FALSE, maxiter = 300,
                           snodes = 800, QMC = TRUE, conv = 0.002),
            verbose = FALSE),
    error = function(e) {
      message(sprintf("  TAM error on %s %s: %s",
                      sample_tag, lv, conditionMessage(e)))
      NULL
    })
  if (is.null(fit)) return(NULL)
  t1 <- Sys.time()
  cat(sprintf("    [%s %s 11TL] fit in %.1f s (iter=%d)\n",
              sample_tag, lv,
              as.numeric(difftime(t1, t0, units = "secs")),
              fit$iter))

  item_fit <- try(tam.fit(fit, progress = FALSE)$itemfit, silent = TRUE)
  if (inherits(item_fit, "try-error"))
    item_fit <- data.frame(parameter = colnames(M2),
                           Infit = NA_real_, Outfit = NA_real_)

  xsi <- as.numeric(fit$item$xsi.item)
  se_xsi <- if ("se.xsi" %in% colnames(fit$item))
    as.numeric(fit$item$se.xsi) else as.numeric(fit$xsi$se.xsi)

  # Primary-dim person ability (dim 1 of EAP)
  eap <- as.data.frame(unclass(tam.wle(fit, progress = FALSE)))
  # WLE column names depend on dim count — find dim1 columns
  theta_col <- grep("^theta", names(eap), value = TRUE)[1]
  err_col   <- grep("^error", names(eap), value = TRUE)[1]

  list(
    fit = fit,
    items_dropped = bad,
    level = lv,
    sample = sample_tag,
    item_par = tibble(item_id = colnames(M2),
                      delta   = xsi,
                      se      = se_xsi,
                      infit_mnsq  = item_fit$Infit,
                      outfit_mnsq = item_fit$Outfit,
                      sample = sample_tag, level = lv, model = "11TL_perlevel"),
    variance_primary = fit$variance[1, 1],
    variance_testlets = if (ncol(fit$variance) > 1)
      diag(fit$variance)[-1] else numeric(0)
  )
}

samples <- list(JP_all = jp_all, JP_5K_admin = jp_5K,
                JP_4K_only = jp_4K, VN = vn_all)

perlvl <- list()
for (samp in names(samples)) {
  for (lv in c("1K","2K","3K","4K","5K")) {
    if (samp == "JP_4K_only" && lv == "5K") next
    cat(sprintf(">>> 11TL per-level: %s | %s\n", samp, lv))
    r <- fit_11TL_level(samples[[samp]], lv, samp)
    if (!is.null(r)) perlvl[[paste(samp, lv, sep = "_")]] <- r
  }
}

# consolidated tables
item_par_perlvl <- bind_rows(lapply(perlvl, function(r) r$item_par))
write_csv(item_par_perlvl, file.path(out_dir, "item_params_perlevel_11TL.csv"))

var_tbl <- bind_rows(lapply(perlvl, function(r) {
  tibble(sample = r$sample, level = r$level,
         variance_primary = r$variance_primary,
         variance_testlet_mean = if (length(r$variance_testlets))
           mean(r$variance_testlets) else NA_real_,
         variance_testlet_max  = if (length(r$variance_testlets))
           max(r$variance_testlets)  else NA_real_,
         n_testlets_kept = length(r$variance_testlets))
}))
write_csv(var_tbl, file.path(out_dir, "variance_summary_perlevel_11TL.csv"))
cat("\nVariance summary (11TL per-level):\n"); print(var_tbl)

# Quick plot: JP vs VN 11TL difficulty
cmp <- item_par_perlvl |>
  select(item_id, level, sample, delta) |>
  pivot_wider(names_from = sample, values_from = delta)
write_csv(cmp, file.path(out_dir, "item_delta_wide_perlevel_11TL.csv"))

ggplot(cmp, aes(VN, JP_all, color = level)) +
  geom_abline(slope = 1, intercept = 0, linetype = 2, alpha = .5) +
  geom_point(alpha = .8) +
  facet_wrap(~ level, scales = "free") +
  labs(x = "VN 11TL Rasch delta",
       y = "JP 11TL Rasch delta",
       title = "Item difficulty: JP vs VN (11TL per-level)") +
  theme_bw() + theme(legend.position = "none")
ggsave(file.path(out_dir, "scatter_VN_vs_JP_perlevel_11TL.png"),
       width = 7.5, height = 6, dpi = 150)

cat("\nPer-level 11TL JP_all vs VN correlation:\n")
print(cmp |> group_by(level) |>
        summarise(r = cor(JP_all, VN, use = "complete"),
                  RMSD = sqrt(mean((JP_all - VN)^2, na.rm = TRUE)),
                  .groups = "drop"))

# -----------------------------------------------------------------------------
# Joint 150-item 51-dim testlet model (1 primary + 50 testlets)
# This is heavy. We try with QMC and moderate snodes.
# -----------------------------------------------------------------------------
cat("\n\n########## PART B: joint 150-item 51-dim testlet Rasch ##########\n")

build_Q_joint <- function() {
  Q <- matrix(0, nrow = 150, ncol = 51)
  Q[, 1] <- 1
  # testlet index = 1..50 where testlet (level_index-1)*10 + within-level-testlet
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
                   c(sapply(levels_order, function(lv)
                            sprintf("%s_t%02d", lv, 1:10))))
  Q
}
Qj <- build_Q_joint()
cat("Joint Q dim:", dim(Qj), "\n")
cat("Items per dim:\n"); print(colSums(Qj))

fit_joint_11TL <- function(mat, sample_tag) {
  M <- mat
  iv <- apply(M, 2, var, na.rm = TRUE)
  bad <- names(iv)[is.na(iv) | iv == 0]
  keep_idx <- which(iv > 0 & items$item_id %in% colnames(M))
  if (length(bad))
    message(sprintf("[%s joint 11TL] dropping %d items", sample_tag, length(bad)))
  M2 <- M[, keep_idx, drop = FALSE]
  Q2 <- Qj[keep_idx, , drop = FALSE]
  keep_dims <- which(c(TRUE, colSums(Q2[, -1, drop = FALSE]) > 0))
  Q2 <- Q2[, keep_dims, drop = FALSE]

  t0 <- Sys.time()
  fit <- tryCatch(
    tam.mml(resp = M2, Q = Q2, irtmodel = "1PL",
            control = list(progress = FALSE, maxiter = 300,
                           snodes = 1500, QMC = TRUE, conv = 0.001),
            verbose = FALSE),
    error = function(e) {
      message(sprintf("  TAM joint 11TL error for %s: %s",
                      sample_tag, conditionMessage(e))); NULL })
  if (is.null(fit)) return(NULL)
  t1 <- Sys.time()
  cat(sprintf("  %s joint 11TL fit finished in %.1f min (iter=%d)\n",
              sample_tag, as.numeric(difftime(t1, t0, units = "mins")),
              fit$iter))

  xsi <- as.numeric(fit$item$xsi.item)
  se_xsi <- if ("se.xsi" %in% colnames(fit$item))
    as.numeric(fit$item$se.xsi) else as.numeric(fit$xsi$se.xsi)
  tibble(item_id = colnames(M2),
         delta = xsi, se = se_xsi,
         sample = sample_tag,
         model  = "11TL_joint") |>
    left_join(items |> select(item_id, level), by = "item_id")
}

joint_items <- list()
run_joint <- Sys.getenv("RUN_JOINT_11TL", "0") == "1"
if (run_joint) {
  for (samp in c("JP_all","JP_5K_admin","JP_4K_only","VN")) {
    cat(sprintf("\n>>> Joint 11TL for %s\n", samp))
    joint_items[[samp]] <- fit_joint_11TL(samples[[samp]], samp)
  }
  joint_par <- bind_rows(joint_items)
  write_csv(joint_par, file.path(out_dir, "item_params_joint_11TL.csv"))

  cmp_j <- joint_par |>
    select(item_id, level, sample, delta) |>
    pivot_wider(names_from = sample, values_from = delta)
  write_csv(cmp_j, file.path(out_dir, "item_delta_wide_joint_11TL.csv"))

  if (all(c("JP_all","VN") %in% colnames(cmp_j))) {
    cat("\nJoint 11TL JP_all vs VN correlation:\n")
    print(with(cmp_j, c(r = cor(JP_all, VN, use = "complete"),
                        RMSD = sqrt(mean((JP_all - VN)^2, na.rm = TRUE)))))
  }
} else {
  cat("\nSkipping joint 51-dim 11TL (set RUN_JOINT_11TL=1 to enable).\n")
}

save(perlvl, joint_items, file = file.path(out_dir, "rasch_11TL_fits.RData"))
cat("\nDone. Results in", out_dir, "\n")
