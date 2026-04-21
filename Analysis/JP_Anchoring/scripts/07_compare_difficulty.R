# =============================================================================
# 07_compare_difficulty.R
# -----------------------------------------------------------------------------
# Compare item difficulty estimates across:
#   - JP 1D per-level   vs Ha et al. 1D (1-1) per-level (exact replication)
#   - JP 11TL per-level vs Ha et al. 11TL per-level      (exact replication)
#   - JP 1D joint       vs JP 1D per-level               (internal consistency)
#   - JP all vs JP_5K_admin                              (sample sensitivity)
#
# Outputs: scatter plots, correlation and RMSD tables, linear regression
# coefficients (for visualising scale-shift vs. slope differences), and a
# combined summary CSV in results/comparison.
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr)
  library(ggplot2)
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
out_dir <- file.path(ana, "results", "comparison")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

items    <- read_csv(file.path(dat_dir, "jp_item_info.csv"),  show_col_types = FALSE)
ha       <- read_csv(file.path(dat_dir, "ha_params.csv"),     show_col_types = FALSE)
jp1D_pl  <- read_csv(file.path(ana, "results/rasch_1D/item_params_perlevel.csv"),
                     show_col_types = FALSE)
jp1D_j   <- read_csv(file.path(ana, "results/rasch_1D/item_params_joint.csv"),
                     show_col_types = FALSE)

# 11TL per-level may not exist yet; we handle gracefully
tl_file  <- file.path(ana, "results/rasch_11TL/item_params_perlevel_11TL.csv")
has_11TL <- file.exists(tl_file) && file.info(tl_file)$size > 0
jp11_pl  <- if (has_11TL) read_csv(tl_file, show_col_types = FALSE) else NULL

# -----------------------------------------------------------------------------
# helper: correlation + RMSD + linear regression (slope, intercept) + n
# -----------------------------------------------------------------------------
metrics <- function(x, y) {
  ok <- complete.cases(x, y)
  x <- x[ok]; y <- y[ok]
  if (length(x) < 3) return(tibble(n = length(x), r = NA, rho = NA, RMSD = NA,
                                   slope = NA, intercept = NA))
  lm_fit <- lm(y ~ x)
  tibble(n = length(x),
         r         = cor(x, y),
         rho       = cor(x, y, method = "spearman"),
         RMSD      = sqrt(mean((x - y)^2)),
         bias      = mean(y - x),
         slope     = coef(lm_fit)[2],
         intercept = coef(lm_fit)[1])
}

# =============================================================================
# Comparison 1: 1D per-level JP vs Ha et al. 1D
# =============================================================================
cmp1 <- jp1D_pl |>
  filter(model == "1D_perlevel") |>
  select(item_id, level, sample, delta) |>
  pivot_wider(names_from = sample, values_from = delta) |>
  left_join(ha |> select(item_id, delta_1D), by = "item_id")

tab1 <- cmp1 |> group_by(level) |>
  summarise(
    `JP_all vs Ha_1D`      = list(metrics(delta_1D, JP_all)),
    `JP_5K vs Ha_1D`       = list(metrics(delta_1D, JP_5K_admin)),
    `JP_4K vs Ha_1D`       = list(metrics(delta_1D, JP_4K_only)),
    `VN_refit vs Ha_1D`    = list(metrics(delta_1D, VN)),
    .groups = "drop") |>
  pivot_longer(-level, names_to = "comparison", values_to = "m") |>
  unnest(m)
cat("\n=== Comparison 1: 1D per-level δ vs Ha et al. 1D ===\n")
print(tab1 |> select(comparison, level, n, r, RMSD, slope, intercept),
      width = Inf, n = 40)
write_csv(tab1, file.path(out_dir, "cmp_1D_perlevel_vs_Ha.csv"))

# scatter plot
plot_cmp <- function(df, x, y, title, out) {
  p <- ggplot(df, aes(.data[[x]], .data[[y]], color = level)) +
    geom_abline(slope = 1, intercept = 0, linetype = 2, alpha = .5) +
    geom_point(alpha = .75) +
    facet_wrap(~ level, scales = "free") +
    labs(x = x, y = y, title = title) +
    theme_bw() + theme(legend.position = "none")
  ggsave(out, p, width = 8, height = 6, dpi = 150)
}
plot_cmp(cmp1, "delta_1D", "JP_all",
         "1D Rasch: Ha et al. (VN) vs JP_all difficulty",
         file.path(out_dir, "scatter_1D_vs_Ha_JP_all.png"))
plot_cmp(cmp1, "delta_1D", "JP_5K_admin",
         "1D Rasch: Ha et al. vs JP_5K_admin",
         file.path(out_dir, "scatter_1D_vs_Ha_JP_5K.png"))
plot_cmp(cmp1, "delta_1D", "JP_4K_only",
         "1D Rasch: Ha et al. vs JP_4K_only",
         file.path(out_dir, "scatter_1D_vs_Ha_JP_4K.png"))

# =============================================================================
# Comparison 2: 1D joint JP vs Ha 1D (concatenated across levels)
# =============================================================================
cmp2 <- jp1D_j |>
  filter(model == "1D_joint") |>
  select(item_id, level, sample, delta) |>
  pivot_wider(names_from = sample, values_from = delta) |>
  left_join(ha |> select(item_id, delta_1D), by = "item_id")

tab2 <- tibble(
  comparison = c("JP_all vs Ha_1D (joint)",
                 "JP_5K vs Ha_1D (joint)",
                 "JP_4K vs Ha_1D (joint)",
                 "VN_refit vs Ha_1D (joint)"),
  bind_rows(metrics(cmp2$delta_1D, cmp2$JP_all),
            metrics(cmp2$delta_1D, cmp2$JP_5K_admin),
            metrics(cmp2$delta_1D, cmp2$JP_4K_only),
            metrics(cmp2$delta_1D, cmp2$VN))
)
cat("\n=== Comparison 2: 1D joint δ vs Ha et al. 1D ===\n"); print(tab2)
write_csv(tab2, file.path(out_dir, "cmp_1D_joint_vs_Ha.csv"))

plot_cmp(cmp2, "delta_1D", "JP_all",
         "1D joint Rasch: Ha et al. (VN) vs JP_all",
         file.path(out_dir, "scatter_1D_joint_vs_Ha.png"))

# =============================================================================
# Comparison 3: 11TL per-level JP vs Ha 11TL (exact replication)
# =============================================================================
if (has_11TL) {
  cmp3 <- jp11_pl |>
    filter(model == "11TL_perlevel") |>
    select(item_id, level, sample, delta) |>
    pivot_wider(names_from = sample, values_from = delta) |>
    left_join(ha |> select(item_id, delta_11TL), by = "item_id")

  tab3 <- cmp3 |> group_by(level) |>
    summarise(
      `JP_all vs Ha_11TL`      = list(metrics(delta_11TL, JP_all)),
      `JP_5K vs Ha_11TL`       = list(metrics(delta_11TL, JP_5K_admin)),
      `JP_4K vs Ha_11TL`       = list(metrics(delta_11TL, JP_4K_only)),
      `VN_refit vs Ha_11TL`    = list(metrics(delta_11TL, VN)),
      .groups = "drop") |>
    pivot_longer(-level, names_to = "comparison", values_to = "m") |>
    unnest(m)
  cat("\n=== Comparison 3: 11TL per-level δ vs Ha et al. 11TL ===\n")
  print(tab3 |> select(comparison, level, n, r, RMSD, slope, intercept),
        width = Inf, n = 40)
  write_csv(tab3, file.path(out_dir, "cmp_11TL_perlevel_vs_Ha.csv"))

  plot_cmp(cmp3, "delta_11TL", "JP_all",
           "11TL Rasch: Ha et al. vs JP_all",
           file.path(out_dir, "scatter_11TL_vs_Ha_JP_all.png"))
} else {
  cat("\n(11TL results not yet available — run 06_rasch_11TL.R first.)\n")
}

# =============================================================================
# Comparison 4: 1D vs 11TL within JP (internal)
# =============================================================================
if (has_11TL) {
  internal <- jp1D_pl |>
    filter(model == "1D_perlevel", sample == "JP_all") |>
    select(item_id, delta_1D = delta) |>
    full_join(jp11_pl |> filter(sample == "JP_all") |>
                select(item_id, delta_11TL = delta),
              by = "item_id")
  cat("\nJP internal 1D vs 11TL correlation:",
      round(cor(internal$delta_1D, internal$delta_11TL, use = "complete"), 3),
      "\n")
}

cat("\nDone. Results in", out_dir, "\n")
