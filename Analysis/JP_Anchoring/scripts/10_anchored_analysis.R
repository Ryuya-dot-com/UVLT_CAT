# =============================================================================
# 10_anchored_analysis.R
# -----------------------------------------------------------------------------
# Fix item difficulties to Ha et al. (2025) calibrations and estimate the
# Japanese persons' ability (θ) under the anchored assumption. We do this
# for the 1D model at two scales:
#   (a) per-level 1D δ (Ha UVLT*-1_prm.txt)       — 5 separate anchors
#   (b) joint Ha et al. δ placed on the App_CAT linked scale
#       (linked_δ = slope × raw_1D + intercept per level)  — cross-band
#
# Person-fit (outfit, infit) is reported against the anchored model so we
# can see how well Japanese students respond to items calibrated on VN.
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
out_dir <- file.path(ana, "results", "anchored")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

items   <- read_csv(file.path(dat_dir, "jp_item_info.csv"),  show_col_types = FALSE)
persons <- read_csv(file.path(dat_dir, "jp_person_info.csv"),show_col_types = FALSE)
jp_wide <- read_csv(file.path(dat_dir, "jp_responses_wide.csv"), show_col_types = FALSE)
ha      <- read_csv(file.path(dat_dir, "ha_params.csv"),     show_col_types = FALSE)
link    <- read_csv(file.path(dat_dir, "cross_band_linking.csv"),
                    show_col_types = FALSE)

jp_mat <- as.matrix(jp_wide[, items$item_id]); rownames(jp_mat) <- jp_wide$person_id

# -----------------------------------------------------------------------------
# (a) Per-level anchored: fix δ to Ha et al. 1D, estimate θ per level
# -----------------------------------------------------------------------------
anchored_perlevel <- list()
for (lv in c("1K","2K","3K","4K","5K")) {
  cols <- items$item_id[items$level == lv]
  M <- jp_mat[, cols]; M <- M[rowSums(!is.na(M)) > 0, , drop = FALSE]
  anchor <- ha |> filter(level == lv) |> arrange(position) |>
    pull(delta_1D)
  xsi.fixed <- cbind(seq_along(anchor), anchor)

  fit <- tryCatch(
    tam.mml(resp = M, irtmodel = "1PL", xsi.fixed = xsi.fixed,
            control = list(progress = FALSE), verbose = FALSE),
    error = function(e) { message("Anchor fit failed ", lv, ": ", e$message); NULL })
  if (is.null(fit)) next

  th <- tam.wle(fit, progress = FALSE)
  th_theta <- as.numeric(th[["theta"]])
  th_se    <- as.numeric(th[["error"]])

  anchored_perlevel[[lv]] <- tibble(
    person_id = rownames(M), level = lv,
    theta_anchored = th_theta, se = th_se,
    raw_score = rowSums(M, na.rm = TRUE),
    n_items = rowSums(!is.na(M)))
}
anc_pl_tbl <- bind_rows(anchored_perlevel)
write_csv(anc_pl_tbl, file.path(out_dir, "theta_anchored_perlevel.csv"))

cat("\nSummary of anchored θ by level:\n")
print(anc_pl_tbl |> group_by(level) |>
        summarise(N = n(),
                  mean_theta = mean(theta_anchored, na.rm = TRUE),
                  sd_theta   = sd(theta_anchored, na.rm = TRUE),
                  mean_se    = mean(se, na.rm = TRUE),
                  .groups = "drop"))

# -----------------------------------------------------------------------------
# (b) Joint anchored on the App_CAT linked scale
# -----------------------------------------------------------------------------
# linked_δ = slope × raw_11TL + intercept (per level) — use 11TL since that
# is what the running CAT uses.
linked <- ha |>
  left_join(link, by = "level") |>
  mutate(delta_linked = slope * delta_11TL + intercept) |>
  arrange(factor(level, levels = c("1K","2K","3K","4K","5K")), position)
write_csv(linked, file.path(out_dir, "ha_linked_delta.csv"))

# fit 150-item anchored 1D model on the linked scale
anchor_joint <- linked$delta_linked
names(anchor_joint) <- linked$item_id
jp_mat_j <- jp_mat[, linked$item_id]

# Some JP_5K admin students have NA on 5K; TAM can handle NA. The model fits
# all 312 persons on whatever they answered.
xsi.fixed <- cbind(seq_along(anchor_joint), anchor_joint)
fit_joint <- tam.mml(resp = jp_mat_j, irtmodel = "1PL",
                     xsi.fixed = xsi.fixed,
                     control = list(progress = FALSE), verbose = FALSE)
th_j <- tam.wle(fit_joint, progress = FALSE)
th_j_theta <- as.numeric(th_j[["theta"]])
th_j_se    <- as.numeric(th_j[["error"]])

joint_tbl <- tibble(person_id = rownames(jp_mat_j),
                    theta_linked_anchored = th_j_theta,
                    se = th_j_se,
                    raw_total = rowSums(jp_mat_j, na.rm = TRUE),
                    n_items   = rowSums(!is.na(jp_mat_j))) |>
  left_join(persons |> select(person_id, sample_group, file_src),
            by = "person_id")

write_csv(joint_tbl, file.path(out_dir, "theta_anchored_joint_linked.csv"))

cat("\nSummary of anchored θ (App_CAT linked scale) by JP sample:\n")
print(joint_tbl |> group_by(sample_group) |>
        summarise(N = n(),
                  mean_theta = mean(theta_linked_anchored, na.rm = TRUE),
                  sd_theta   = sd(theta_linked_anchored, na.rm = TRUE),
                  mean_se    = mean(se, na.rm = TRUE),
                  .groups = "drop"))

# -----------------------------------------------------------------------------
# Person fit against the anchored model
# -----------------------------------------------------------------------------
pfit <- tam.personfit(fit_joint)
pfit_tbl <- tibble(person_id = rownames(jp_mat_j),
                   outfit_mnsq = as.numeric(pfit$outfitPerson),
                   outfit_t    = as.numeric(pfit$outfitPerson_t),
                   infit_mnsq  = as.numeric(pfit$infitPerson),
                   infit_t     = as.numeric(pfit$infitPerson_t))
write_csv(pfit_tbl, file.path(out_dir, "person_fit_anchored.csv"))
cat("\nPerson fit summary against anchored model:\n")
print(pfit_tbl |>
        summarise(across(c(outfit_mnsq, infit_mnsq),
                         list(mean = ~mean(.x, na.rm=TRUE),
                              sd   = ~sd(.x, na.rm=TRUE),
                              max  = ~max(.x, na.rm=TRUE)))))
# Flag misfitting persons (outfit > 1.5 commonly)
mis <- pfit_tbl |> filter(outfit_mnsq > 1.5)
cat(sprintf("\nPersons with outfit MNSQ > 1.5: %d / %d (%.1f%%)\n",
            nrow(mis), nrow(pfit_tbl), 100 * nrow(mis) / nrow(pfit_tbl)))

# -----------------------------------------------------------------------------
# Plot: linked anchored θ vs raw total, coloured by sample group
# -----------------------------------------------------------------------------
ggplot(joint_tbl, aes(raw_total, theta_linked_anchored, color = sample_group)) +
  geom_point(alpha = .7) +
  labs(x = "Raw total correct (150-item, NA ignored)",
       y = "Anchored θ (App_CAT linked scale)",
       title = "JP anchored ability (Ha et al. linked 11TL δ fixed)") +
  theme_bw()
ggsave(file.path(out_dir, "anchored_theta_vs_raw.png"),
       width = 7, height = 5, dpi = 150)

save(anc_pl_tbl, joint_tbl, pfit_tbl, fit_joint,
     file = file.path(out_dir, "anchored_fits.RData"))
cat("\nDone. Results in", out_dir, "\n")
