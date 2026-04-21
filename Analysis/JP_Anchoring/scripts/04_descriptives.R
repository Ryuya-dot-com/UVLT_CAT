# =============================================================================
# 04_descriptives.R
# -----------------------------------------------------------------------------
# Descriptive statistics and item p-values for JP and VN samples, saved in
# results/descriptives.
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(psych)
  library(ggplot2); library(stringr)
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
ana_dir <- file.path(root, "Analysis", "JP_Anchoring")
dat_dir <- file.path(ana_dir, "data", "processed")
out_dir <- file.path(ana_dir, "results", "descriptives")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

jp_wide  <- read_csv(file.path(dat_dir, "jp_responses_wide.csv"),
                     show_col_types = FALSE)
vn_wide  <- read_csv(file.path(dat_dir, "vn_responses_wide.csv"),
                     show_col_types = FALSE)
items    <- read_csv(file.path(dat_dir, "jp_item_info.csv"),
                     show_col_types = FALSE)
persons  <- read_csv(file.path(dat_dir, "jp_person_info.csv"),
                     show_col_types = FALSE)

jp_mat <- as.matrix(jp_wide[, items$item_id])
vn_mat <- as.matrix(vn_wide[, items$item_id])

# ------------- person-level summaries ----------------------------------------
person_score <- function(mat, pids, lvls = c("1K","2K","3K","4K","5K")) {
  tot <- rowSums(mat, na.rm = TRUE)
  out <- tibble(person_id = pids, total = tot,
                n_answered = rowSums(!is.na(mat)))
  for (lv in lvls) {
    cols <- items$item_id[items$level == lv]
    out[[paste0("score_", lv)]]    <- rowSums(mat[, cols, drop = FALSE], na.rm = TRUE)
    out[[paste0("n_ans_", lv)]] <- rowSums(!is.na(mat[, cols, drop = FALSE]))
  }
  out
}
jp_ps <- person_score(jp_mat, jp_wide$person_id) |>
  left_join(persons |> select(person_id, file_src, sample_group),
            by = "person_id")
vn_ps <- person_score(vn_mat, vn_wide$person_id) |>
  mutate(file_src = "VN", sample_group = "VN_Ha")

all_ps <- bind_rows(jp_ps, vn_ps)
write_csv(all_ps, file.path(out_dir, "person_scores.csv"))

cat("\n=== Person score summary (mean / SD) ===\n")
sum_tbl <- all_ps |>
  group_by(sample_group) |>
  summarise(N = n(),
            total_mean = mean(total, na.rm = TRUE),
            total_sd   = sd(total,   na.rm = TRUE),
            across(starts_with("score_"),
                   list(m = ~mean(.x, na.rm = TRUE),
                        s = ~sd(.x,   na.rm = TRUE))))
print(sum_tbl, width = Inf)
write_csv(sum_tbl, file.path(out_dir, "group_summary.csv"))

# ------------- item p-values -------------------------------------------------
item_p <- function(mat, grp) {
  tibble(
    item_id = items$item_id,
    level   = items$level,
    target  = items$target,
    p       = colMeans(mat, na.rm = TRUE),
    n       = colSums(!is.na(mat)),
    group   = grp
  )
}
pj_all   <- item_p(jp_mat, "JP_all")
pv       <- item_p(vn_mat, "VN_Ha")
pj_5k    <- item_p(jp_mat[persons$sample_group == "JP_5K_admin", ], "JP_5K_admin")
pj_4k    <- item_p(jp_mat[persons$sample_group == "JP_4K_only",  ], "JP_4K_only")

item_p_all <- bind_rows(pj_all, pv, pj_5k, pj_4k)
write_csv(item_p_all, file.path(out_dir, "item_p_values.csv"))

# Side-by-side for scatter
p_wide <- item_p_all |>
  select(item_id, level, group, p) |>
  pivot_wider(names_from = group, values_from = p)
write_csv(p_wide, file.path(out_dir, "item_p_wide.csv"))

cat("\n=== Item p-values: JP_all vs VN correlation by level ===\n")
p_corr <- p_wide |> group_by(level) |>
  summarise(r = cor(JP_all, VN_Ha, use = "pairwise"),
            mean_diff = mean(JP_all - VN_Ha, na.rm = TRUE),
            mean_abs  = mean(abs(JP_all - VN_Ha), na.rm = TRUE),
            .groups = "drop")
print(p_corr); write_csv(p_corr, file.path(out_dir, "item_p_corr.csv"))

# ------------- Cronbach's alpha ----------------------------------------------
alpha_by_level <- function(mat, grp) {
  out <- tibble()
  for (lv in c("1K","2K","3K","4K","5K")) {
    cols <- items$item_id[items$level == lv]
    sub  <- mat[, cols, drop = FALSE]
    sub  <- sub[complete.cases(sub), , drop = FALSE]
    if (nrow(sub) < 10 || ncol(sub) < 3) next
    a <- try(psych::alpha(sub, check.keys = FALSE,
                          warnings = FALSE), silent = TRUE)
    if (!inherits(a, "try-error"))
      out <- bind_rows(out,
                       tibble(group = grp, level = lv,
                              alpha = a$total$raw_alpha,
                              n = nrow(sub)))
  }
  out
}
alpha_tbl <- bind_rows(
  alpha_by_level(jp_mat, "JP_all"),
  alpha_by_level(jp_mat[persons$sample_group == "JP_5K_admin", ], "JP_5K_admin"),
  alpha_by_level(jp_mat[persons$sample_group == "JP_4K_only",  ], "JP_4K_only"),
  alpha_by_level(vn_mat, "VN_Ha")
)
cat("\n=== Cronbach's alpha (per level, per group) ===\n")
print(alpha_tbl); write_csv(alpha_tbl, file.path(out_dir, "cronbach_alpha.csv"))

# ------------- plot ----------------------------------------------------------
ggplot(p_wide, aes(VN_Ha, JP_all, color = level)) +
  geom_abline(slope = 1, intercept = 0, linetype = 2, alpha = .5) +
  geom_point(alpha = .75) +
  facet_wrap(~ level) +
  coord_equal() + xlim(0,1) + ylim(0,1) +
  labs(x = "VN (Ha et al.) item p-value",
       y = "JP item p-value",
       title = "Item p-values: VN vs JP (classical comparison)") +
  theme_bw() + theme(legend.position = "none")
ggsave(file.path(out_dir, "item_p_scatter.png"),
       width = 7, height = 5.5, dpi = 150)

cat("\nDone. Results in:\n  ", out_dir, "\n")
