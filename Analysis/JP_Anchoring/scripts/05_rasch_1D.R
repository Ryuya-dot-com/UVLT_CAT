# =============================================================================
# 05_rasch_1D.R
# -----------------------------------------------------------------------------
# Unidimensional Rasch calibration for Japanese L1 and Vietnamese L1 samples,
# run BOTH per-level (5 separate models × 30 items) AND joint (one model over
# 150 items). Item difficulties, person abilities, and fit statistics are
# saved for downstream comparison with Ha et al.
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
out_dir <- file.path(ana, "results", "rasch_1D")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

items   <- read_csv(file.path(dat_dir, "jp_item_info.csv"),
                    show_col_types = FALSE)
persons <- read_csv(file.path(dat_dir, "jp_person_info.csv"),
                    show_col_types = FALSE)
jp_wide <- read_csv(file.path(dat_dir, "jp_responses_wide.csv"),
                    show_col_types = FALSE)
vn_wide <- read_csv(file.path(dat_dir, "vn_responses_wide.csv"),
                    show_col_types = FALSE)

jp_mat_all <- as.matrix(jp_wide[, items$item_id]); rownames(jp_mat_all) <- jp_wide$person_id
vn_mat     <- as.matrix(vn_wide[, items$item_id]); rownames(vn_mat)     <- vn_wide$person_id
jp_mat_5K  <- jp_mat_all[persons$sample_group == "JP_5K_admin", ]
jp_mat_4K  <- jp_mat_all[persons$sample_group == "JP_4K_only",  ]

# -----------------------------------------------------------------------------
# helper: run TAM Rasch and return tidy outputs
# -----------------------------------------------------------------------------
run_rasch <- function(mat, tag) {
  mat <- mat[rowSums(!is.na(mat)) > 0, , drop = FALSE]

  # Drop items with zero variance for this subsample (all 0 or all 1) —
  # TAM cannot estimate a difficulty for such items
  item_var <- apply(mat, 2, function(x) var(x, na.rm = TRUE))
  bad <- names(item_var)[is.na(item_var) | item_var == 0]
  if (length(bad))
    message(sprintf("[%s] dropping %d items with no variance: %s",
                    tag, length(bad), paste(bad, collapse = ",")))
  keep <- setdiff(colnames(mat), bad)
  mat2 <- mat[, keep, drop = FALSE]

  fit <- tam.mml(resp = mat2, irtmodel = "1PL",
                 control = list(progress = FALSE), verbose = FALSE)
  th_raw <- tam.wle(fit, progress = FALSE)
  # Extract vectors up-front to avoid tibble NSE conflicts with the name
  # 'error' in the tam.wle data frame
  th_theta <- as.numeric(th_raw[["theta"]])
  th_se    <- as.numeric(th_raw[["error"]])
  th_score <- as.numeric(th_raw[["PersonScores"]])
  th_max   <- as.numeric(th_raw[["PersonMax"]])

  item_fit <- tam.fit(fit, progress = FALSE)$itemfit
  xsi <- as.numeric(fit$item$xsi.item)
  se_xsi <- if ("se.xsi" %in% colnames(fit$item))
    as.numeric(fit$item$se.xsi) else as.numeric(fit$xsi$se.xsi)

  list(
    tag = tag,
    n_persons = nrow(mat2),
    n_items   = ncol(mat2),
    items_dropped = bad,
    item_par = tibble(item_id = colnames(mat2),
                      delta   = xsi,
                      se      = se_xsi,
                      infit_mnsq  = item_fit$Infit,
                      outfit_mnsq = item_fit$Outfit),
    person = tibble(person_id = rownames(mat2),
                    theta = th_theta,
                    se    = th_se,
                    score = th_score,
                    n_ans = th_max),
    model = fit
  )
}

# -----------------------------------------------------------------------------
# PART A: per-level 1D Rasch
# -----------------------------------------------------------------------------
cat("\n\n########## PART A: per-level 1D Rasch ##########\n")

per_level_results <- list()
for (lv in c("1K","2K","3K","4K","5K")) {
  cols <- items$item_id[items$level == lv]
  for (samp in c("JP_all","JP_5K_admin","JP_4K_only","VN")) {
    if (samp == "JP_4K_only" && lv == "5K") next
    if (samp == "JP_all")      M <- jp_mat_all
    if (samp == "JP_5K_admin") M <- jp_mat_5K
    if (samp == "JP_4K_only")  M <- jp_mat_4K
    if (samp == "VN")          M <- vn_mat
    cat(sprintf(">>> %s | %s\n", samp, lv))
    r <- run_rasch(M[, cols, drop = FALSE], sprintf("%s_%s_1D", samp, lv))
    r$level <- lv; r$sample <- samp
    per_level_results[[paste(samp, lv, sep = "_")]] <- r
  }
}

# consolidate item params
item_par_perlvl <- bind_rows(lapply(per_level_results, function(r) {
  r$item_par |> mutate(sample = r$sample, level = r$level,
                       model  = "1D_perlevel")
}))
write_csv(item_par_perlvl, file.path(out_dir, "item_params_perlevel.csv"))

person_perlvl <- bind_rows(lapply(per_level_results, function(r) {
  r$person |> mutate(sample = r$sample, level = r$level,
                     model  = "1D_perlevel")
}))
write_csv(person_perlvl, file.path(out_dir, "person_params_perlevel.csv"))

# -----------------------------------------------------------------------------
# PART B: joint 150-item 1D Rasch
# -----------------------------------------------------------------------------
cat("\n\n########## PART B: joint 150-item 1D Rasch ##########\n")

joint_results <- list()
for (samp in c("JP_all","JP_5K_admin","JP_4K_only","VN")) {
  if (samp == "JP_all")      M <- jp_mat_all
  if (samp == "JP_5K_admin") M <- jp_mat_5K
  if (samp == "JP_4K_only")  M <- jp_mat_4K
  if (samp == "VN")          M <- vn_mat
  cat(sprintf(">>> Joint 150-item 1D for %s (N=%d)\n", samp, nrow(M)))
  r <- run_rasch(M, sprintf("%s_joint_1D", samp))
  r$sample <- samp
  joint_results[[samp]] <- r
}

item_par_joint <- bind_rows(lapply(joint_results, function(r) {
  r$item_par |> mutate(sample = r$sample, model = "1D_joint") |>
    left_join(items |> select(item_id, level), by = "item_id")
}))
write_csv(item_par_joint, file.path(out_dir, "item_params_joint.csv"))

person_joint <- bind_rows(lapply(joint_results, function(r) {
  r$person |> mutate(sample = r$sample, model = "1D_joint")
}))
write_csv(person_joint, file.path(out_dir, "person_params_joint.csv"))

# -----------------------------------------------------------------------------
# Quick plot: per-level JP vs VN in 1D Rasch
# -----------------------------------------------------------------------------
cmp <- item_par_perlvl |>
  select(item_id, level, sample, delta) |>
  pivot_wider(names_from = sample, values_from = delta)

ggplot(cmp, aes(VN, JP_all, color = level)) +
  geom_abline(slope = 1, intercept = 0, linetype = 2, alpha = .5) +
  geom_point(alpha = .8) +
  facet_wrap(~ level, scales = "free") +
  labs(x = "VN Rasch delta (per-level 1D)",
       y = "JP Rasch delta (per-level 1D)",
       title = "Item difficulty: JP vs VN (1D per-level)") +
  theme_bw() + theme(legend.position = "none")
ggsave(file.path(out_dir, "scatter_VN_vs_JP_perlevel.png"),
       width = 7.5, height = 6, dpi = 150)

cat("\nPer-level JP_all vs VN difficulty correlation:\n")
print(cmp |> group_by(level) |>
        summarise(r_pearson  = cor(JP_all, VN, use = "complete"),
                  r_spearman = cor(JP_all, VN, use = "complete",
                                   method = "spearman"),
                  RMSD = sqrt(mean((JP_all - VN)^2, na.rm = TRUE)),
                  .groups = "drop"))

# joint
cmp_j <- item_par_joint |>
  select(item_id, level, sample, delta) |>
  pivot_wider(names_from = sample, values_from = delta)
ggplot(cmp_j, aes(VN, JP_all, color = level)) +
  geom_abline(slope = 1, intercept = 0, linetype = 2, alpha = .5) +
  geom_point(alpha = .8) +
  labs(x = "VN Rasch delta (joint 150-item 1D)",
       y = "JP Rasch delta (joint 150-item 1D)",
       title = "Item difficulty: JP vs VN (1D joint)") +
  theme_bw()
ggsave(file.path(out_dir, "scatter_VN_vs_JP_joint.png"),
       width = 7, height = 5.5, dpi = 150)

cat("\nJoint 1D JP_all vs VN correlation (all 150):\n")
print(with(cmp_j, c(r = cor(JP_all, VN, use="complete"),
                    RMSD = sqrt(mean((JP_all - VN)^2, na.rm = TRUE)))))

save(per_level_results, joint_results,
     file = file.path(out_dir, "rasch_1D_fits.RData"))
cat("\nDone. Results saved to ", out_dir, "\n")
