# =============================================================================
# 09_dif_jp_subgroups.R
# -----------------------------------------------------------------------------
# DIF check WITHIN the Japanese L1 sample: the 5K-administered group
# (JP_5K_admin, N=195 from F1+F3) vs. the 4K-only group (JP_4K_only, N=117
# from F2), on the 120 common items (1K-4K). This tests whether the two
# sub-samples can be treated as one population when pooling for the main
# VN-vs-JP comparison.
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
jp_mat  <- as.matrix(jp_wide[, items$item_id])

g5  <- persons$sample_group == "JP_5K_admin"
g4  <- persons$sample_group == "JP_4K_only"

cols <- items$item_id[items$level %in% c("1K","2K","3K","4K")]
m1  <- jp_mat[g5, cols]   # JP_5K_admin
m2  <- jp_mat[g4, cols]   # JP_4K_only

# listwise-complete rows
full <- rbind(m1, m2)
grp  <- c(rep("JP_5K_admin", nrow(m1)), rep("JP_4K_only", nrow(m2)))
ok   <- complete.cases(full)
full <- full[ok, ]; grp <- grp[ok]
cat(sprintf("Complete-case DIF sample: N = %d  (5K-admin=%d, 4K-only=%d)\n",
            nrow(full), sum(grp == "JP_5K_admin"), sum(grp == "JP_4K_only")))

# -----------------------------------------------------------------------------
mh <- difR::difMH(Data = as.data.frame(full), group = grp,
                  focal.name = "JP_4K_only",
                  MHstat = "MHChisq", purify = TRUE,
                  p.adjust.method = "BH")
lr <- tryCatch(
  difR::difLogistic(Data = as.data.frame(full), group = grp,
                    focal.name = "JP_4K_only", type = "both",
                    purify = TRUE, p.adjust.method = "BH"),
  error = function(e) { message("LogReg failed: ", e$message); NULL })

delta_mh <- -2.35 * log(as.numeric(mh$alphaMH))
tab <- tibble(item_id = cols,
              MH_chi      = as.numeric(mh$MH),
              MH_alpha    = as.numeric(mh$alphaMH),
              MH_delta    = delta_mh,
              MH_pval_adj = as.numeric(mh$adjusted.p)) |>
  mutate(ETS_cat = case_when(
    is.na(MH_delta) | abs(MH_delta) < 1                         ~ "A",
    abs(MH_delta) < 1.5 | is.na(MH_pval_adj) | MH_pval_adj >= .05 ~ "B",
    TRUE ~ "C"
  )) |>
  left_join(items |> select(item_id, level, target), by = "item_id")

if (!is.null(lr)) {
  tab$LR_chi       <- as.numeric(lr$Logistik)
  tab$LR_pval_adj  <- as.numeric(lr$adjusted.p)
  tab$LR_delta_R2  <- as.numeric(lr$deltaR2)
}

write_csv(tab, file.path(out_dir, "dif_JPsub_5Kadmin_vs_4Konly.csv"))

cat("\nETS category distribution (JP sub-sample DIF, 1K-4K):\n")
print(tab |> count(level, ETS_cat))
cat("\nFlagged items (ETS=C) — 4K-only differs from 5K-admin:\n")
print(tab |> filter(ETS_cat == "C") |>
        select(item_id, level, target, MH_delta, MH_pval_adj))

ggplot(tab, aes(MH_delta, -log10(MH_pval_adj + 1e-16), color = ETS_cat)) +
  geom_hline(yintercept = -log10(0.05), linetype = 2, alpha = .4) +
  geom_vline(xintercept = c(-1.5, 1.5), linetype = 3, alpha = .4) +
  geom_point(alpha = .8, size = 2) +
  scale_color_manual(values = c(A = "gray60", B = "darkorange",
                                C = "firebrick")) +
  facet_wrap(~ level) +
  labs(x = "delta_MH (pos = item harder for JP_4K_only)",
       y = "-log10(adj. p)",
       title = "DIF within JP: 5K-admin vs 4K-only (1K-4K items)") +
  theme_bw()
ggsave(file.path(out_dir, "dif_JPsub.png"), width = 8, height = 5.5, dpi = 150)

save(mh, lr, tab, file = file.path(out_dir, "dif_JPsub.RData"))
cat("\nDone.\n")
