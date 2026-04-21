# =============================================================================
# 08_dif_vn_vs_jp.R
# -----------------------------------------------------------------------------
# Differential Item Functioning (DIF) analysis between Vietnamese L1 (Ha
# et al. 2025) and Japanese L1 samples.
#
# Two scenarios:
#   Scenario A  -  1K-4K only (120 common items).
#                  JP = full 312-person sample, VN = 311.
#   Scenario B  -  1K-5K (150 items, 5K included).
#                  JP = JP_5K_admin only (195, F1+F3), VN = 311.
#
# For each scenario we run Mantel-Haenszel (difMH) and logistic regression
# DIF (difLogistic, Raju's trans-logistic), classify items A/B/C via ETS
# rules, and save flagged items for the per-level Rasch follow-up.
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr)
  library(difR); library(ggplot2)
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
out_dir <- file.path(ana, "results", "dif")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

items   <- read_csv(file.path(dat_dir, "jp_item_info.csv"),  show_col_types = FALSE)
persons <- read_csv(file.path(dat_dir, "jp_person_info.csv"),show_col_types = FALSE)
jp_wide <- read_csv(file.path(dat_dir, "jp_responses_wide.csv"), show_col_types = FALSE)
vn_wide <- read_csv(file.path(dat_dir, "vn_responses_wide.csv"), show_col_types = FALSE)

jp_all_mat <- as.matrix(jp_wide[, items$item_id])
vn_mat     <- as.matrix(vn_wide[, items$item_id])
jp_5K_mat  <- jp_all_mat[persons$sample_group == "JP_5K_admin", ]

run_dif <- function(mat_g1, mat_g2, items_tbl, label_g1, label_g2, tag) {
  # combine and create group vector
  common_items <- colnames(mat_g1)
  m1 <- mat_g1[, common_items]; m2 <- mat_g2[, common_items]
  # drop persons with zero complete responses on this item set
  m1 <- m1[rowSums(!is.na(m1)) > 0, , drop = FALSE]
  m2 <- m2[rowSums(!is.na(m2)) > 0, , drop = FALSE]
  full <- rbind(m1, m2)
  grp  <- c(rep(label_g1, nrow(m1)), rep(label_g2, nrow(m2)))

  # difR requires complete data for most tests. Keep listwise-complete rows.
  ok <- stats::complete.cases(full)
  full_c <- full[ok, ]
  grp_c  <- grp[ok]
  cat(sprintf("[%s] complete-case N = %d (group1=%d, group2=%d)\n",
              tag, nrow(full_c), sum(grp_c == label_g1),
              sum(grp_c == label_g2)))

  # --- Mantel-Haenszel
  mh <- difR::difMH(Data = as.data.frame(full_c),
                    group = grp_c, focal.name = label_g2,
                    MHstat = "MHChisq", purify = TRUE, p.adjust.method = "BH")
  # Compute ETS delta from alphaMH: delta = -2.35 * log(alpha)
  delta_mh <- -2.35 * log(as.numeric(mh$alphaMH))
  tb_mh <- tibble(item_id = common_items,
                  MH_chi      = as.numeric(mh$MH),
                  MH_alpha    = as.numeric(mh$alphaMH),
                  MH_delta    = delta_mh,
                  MH_pval_adj = as.numeric(mh$adjusted.p)) |>
    mutate(ETS_cat = case_when(
      is.na(MH_delta) | abs(MH_delta) < 1                         ~ "A",
      abs(MH_delta) < 1.5 | is.na(MH_pval_adj) | MH_pval_adj >= .05 ~ "B",
      TRUE ~ "C"
    ))

  # --- Logistic regression DIF (Swaminathan & Rogers 1990)
  lr <- tryCatch(
    difR::difLogistic(Data = as.data.frame(full_c),
                      group = grp_c, focal.name = label_g2,
                      type = "both", purify = TRUE,
                      p.adjust.method = "BH"),
    error = function(e) { message("LogReg DIF failed: ", e$message); NULL })
  if (!is.null(lr)) {
    tb_lr <- tibble(item_id = common_items,
                    LR_chi      = as.numeric(lr$Logistik),
                    LR_pval_adj = as.numeric(lr$adjusted.p),
                    LR_delta_R2 = as.numeric(lr$deltaR2))
  } else {
    tb_lr <- tibble(item_id = common_items,
                    LR_chi = NA_real_, LR_pval_adj = NA_real_,
                    LR_delta_R2 = NA_real_)
  }

  full_tbl <- left_join(tb_mh, tb_lr, by = "item_id") |>
    left_join(items_tbl |> select(item_id, level, target), by = "item_id") |>
    mutate(scenario = tag)

  list(table = full_tbl, mh = mh, lr = lr)
}

# -----------------------------------------------------------------------------
# Scenario A: 1K-4K, JP_all vs VN
# -----------------------------------------------------------------------------
cols_A <- items$item_id[items$level %in% c("1K","2K","3K","4K")]
resA <- run_dif(jp_all_mat[, cols_A], vn_mat[, cols_A],
                items, "JP_all", "VN", "Scenario_A_1K-4K_JPall_vs_VN")

write_csv(resA$table, file.path(out_dir, "dif_scenarioA_JPall_vs_VN.csv"))
cat("\nETS category distribution — Scenario A (JP_all vs VN, 120 items):\n")
print(resA$table |> count(level, ETS_cat))
cat("\nFlagged items (ETS=C):\n")
print(resA$table |> filter(ETS_cat == "C") |>
        select(item_id, level, target, MH_delta, MH_pval_adj))

# -----------------------------------------------------------------------------
# Scenario B: all 150 items, JP_5K_admin vs VN
# -----------------------------------------------------------------------------
resB <- run_dif(jp_5K_mat, vn_mat, items, "JP_5K", "VN",
                "Scenario_B_1K-5K_JP5K_vs_VN")

write_csv(resB$table, file.path(out_dir, "dif_scenarioB_JP5K_vs_VN.csv"))
cat("\nETS category distribution — Scenario B (JP_5K_admin vs VN, 150 items):\n")
print(resB$table |> count(level, ETS_cat))
cat("\nFlagged items (ETS=C):\n")
print(resB$table |> filter(ETS_cat == "C") |>
        select(item_id, level, target, MH_delta, MH_pval_adj))

# -----------------------------------------------------------------------------
# Plots
# -----------------------------------------------------------------------------
plot_dif <- function(d, ttl, out) {
  p <- ggplot(d, aes(MH_delta, -log10(MH_pval_adj + 1e-16),
                     color = ETS_cat)) +
    geom_hline(yintercept = -log10(0.05), linetype = 2, alpha = .4) +
    geom_vline(xintercept = c(-1.5, 1.5), linetype = 3, alpha = .4) +
    geom_point(alpha = .7, size = 2) +
    scale_color_manual(values = c(A = "gray60", B = "darkorange",
                                  C = "firebrick")) +
    facet_wrap(~ level, scales = "free_x") +
    labs(x = "delta_MH (positive = harder for focal group)",
         y = "-log10(adj. p)",
         title = ttl) +
    theme_bw()
  ggsave(out, p, width = 8, height = 5.5, dpi = 150)
}
plot_dif(resA$table, "DIF: JP_all vs VN (1K-4K, N=623)",
         file.path(out_dir, "dif_scenarioA.png"))
plot_dif(resB$table, "DIF: JP_5K_admin vs VN (1K-5K, N=506)",
         file.path(out_dir, "dif_scenarioB.png"))

# Save workspace
save(resA, resB, file = file.path(out_dir, "dif_vn_vs_jp.RData"))
cat("\nDone. Results in", out_dir, "\n")
