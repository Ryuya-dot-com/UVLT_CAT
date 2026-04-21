# =============================================================================
# 11_flag_items_summary.R
# -----------------------------------------------------------------------------
# Consolidate DIF flags from scenarios A and B, classify each flagged item
# into "JP-favored" (easier for JP than for VN) and "JP-disfavored"
# (harder for JP than for VN), and join with raw p-values and part-of-speech
# meta (from the App_CAT blueprints).
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr); library(jsonlite)
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
out  <- file.path(ana, "results", "dif")

difA  <- read_csv(file.path(out, "dif_scenarioA_JPall_vs_VN.csv"),
                  show_col_types = FALSE)
difB  <- read_csv(file.path(out, "dif_scenarioB_JP5K_vs_VN.csv"),
                  show_col_types = FALSE)
difJ  <- read_csv(file.path(out, "dif_JPsub_5Kadmin_vs_4Konly.csv"),
                  show_col_types = FALSE)
pvals <- read_csv(file.path(ana, "results", "descriptives", "item_p_wide.csv"),
                  show_col_types = FALSE)
items <- read_csv(file.path(ana, "data", "processed", "jp_item_info.csv"),
                  show_col_types = FALSE)

# Part-of-speech per testlet from App_CAT blueprints (items 1-3 = testlet 1, ...)
# The script.js blueprint is organized by testlet; each testlet has partOfSpeech.
# We encode it manually for the 50 testlets (10 per level).
pos_by_testlet <- list(
  "1K" = c("noun","noun","noun","noun","noun","verb","verb","verb","adjective","adjective"),
  "2K" = c("noun","noun","noun","noun","noun","verb","verb","verb","adjective","adjective"),
  "3K" = c("noun","noun","noun","noun","noun","verb","verb","verb","adjective","adjective"),
  "4K" = c("noun","noun","noun","noun","noun","verb","verb","verb","adjective","adjective"),
  "5K" = c("noun","noun","noun","noun","noun","verb","verb","verb","adjective","adjective")
)
pos_tbl <- tibble(
  item_id = items$item_id,
  level   = items$level,
  position = items$position,
  testlet  = ((items$position - 1) %/% 3) + 1,
  pos      = mapply(function(lv, t) pos_by_testlet[[lv]][t],
                    items$level, ((items$position - 1) %/% 3) + 1)
)

# Sign convention (corrected):
# In our difR calls, reference = JP, focal = VN.
# alphaMH is the Mantel-Haenszel odds ratio (reference / focal conditional
# on matched ability). If JP is doing better at matched ability, alphaMH > 1
# and delta = -2.35 * log(alphaMH) < 0.  So:
#   delta < 0  ->  item EASIER FOR JP (reference does better)
#   delta > 0  ->  item HARDER FOR JP (reference does worse)
dir_of_delta <- function(d) case_when(
  is.na(d)    ~ "NA",
  d <= -1.5   ~ "Easier_for_JP",
  d >=  1.5   ~ "Harder_for_JP",
  abs(d) >= 1 ~ "Mild",
  TRUE        ~ "Negligible")

format_long <- function(d, tag) {
  d |> mutate(scenario = tag,
              direction = dir_of_delta(MH_delta)) |>
    select(scenario, item_id, level, target, MH_delta, MH_pval_adj,
           LR_delta_R2, ETS_cat, direction)
}

combined <- bind_rows(format_long(difA, "A (JP_all vs VN, 1K-4K)"),
                      format_long(difB, "B (JP_5K vs VN, 1K-5K)"))

# Include p-values from both groups
combined <- combined |>
  left_join(pvals |> select(item_id, p_JP = JP_all, p_VN = VN_Ha),
            by = "item_id") |>
  left_join(pos_tbl |> select(item_id, testlet, pos), by = "item_id") |>
  mutate(p_diff = p_JP - p_VN)

write_csv(combined, file.path(out, "dif_flags_combined.csv"))

# Items flagged as C in EITHER scenario → union set for lexical investigation
C_items <- combined |> filter(ETS_cat == "C") |>
  distinct(item_id, level, target, pos) |>
  arrange(factor(level, levels = c("1K","2K","3K","4K","5K")), target)

write_csv(C_items, file.path(out, "dif_flagged_items_union.csv"))

cat("Flagged items (ETS=C) in at least one scenario:\n")
print(C_items, n = 100)
cat(sprintf("\nTotal unique flagged items: %d\n", nrow(C_items)))

# Breakdown by direction within each scenario
cat("\nBreakdown by direction (combined):\n")
print(combined |> filter(ETS_cat == "C") |>
        count(scenario, direction) |>
        pivot_wider(names_from = direction, values_from = n, values_fill = 0))

# Export compact tables for the web-search agents
# - JSON with everything researchers need (word, level, direction, PoS, p-diff)
C_with_dir <- combined |>
  filter(ETS_cat == "C") |>
  distinct(item_id, level, target, pos,
           direction, MH_delta, p_JP, p_VN, p_diff) |>
  group_by(item_id, level, target, pos) |>
  summarise(
    directions = paste(unique(direction), collapse = "|"),
    max_abs_MH = max(abs(MH_delta), na.rm = TRUE),
    p_JP = mean(p_JP, na.rm = TRUE),
    p_VN = mean(p_VN, na.rm = TRUE),
    p_diff = mean(p_diff, na.rm = TRUE),
    .groups = "drop") |>
  arrange(factor(level, levels = c("1K","2K","3K","4K","5K")))

write_csv(C_with_dir, file.path(out, "dif_flagged_items_with_direction.csv"))
write_json(C_with_dir, file.path(out, "dif_flagged_items_with_direction.json"),
           pretty = TRUE, auto_unbox = TRUE)

cat("\nSaved:\n")
cat("  dif_flags_combined.csv              (scenario-long table)\n")
cat("  dif_flagged_items_union.csv         (unique C-items)\n")
cat("  dif_flagged_items_with_direction.csv (with direction + p-values)\n")
cat("  dif_flagged_items_with_direction.json\n")
