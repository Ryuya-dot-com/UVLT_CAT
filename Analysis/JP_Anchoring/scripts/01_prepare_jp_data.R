# =============================================================================
# 01_prepare_jp_data.R
# -----------------------------------------------------------------------------
# Build a clean JP binary response matrix from three Excel files by
# comparing the text responses to target words (more reliable than the
# pre-scored section, which in File 3 has one 1K item missing).
#
# readxl view of the three files:
#   File 1 (SSLA):            R1=levels, R2=target, R3=prompt, R4+=data.
#                             cols: ID=1, total=3, per-level=4:8.
#                             test items in cols 14:166 (incl. 3 practice).
#   File 2 (LGCTGC):          R1=levels, R2=target+meta-labels, R3+=data.
#                             cols: ID=1, total=2, per-level=3:6 (no 5K),
#                             mastery flags=7:10. Test items in cols 11:130.
#   File 3 (VocabLanguaging): R1=levels, R2=meta-labels, R3=target, R4+=data.
#                             cols: ID=1, ID=2, score_form=3, total=4,
#                             per-level=5:9. Test items in cols 15:167.
# =============================================================================

suppressPackageStartupMessages({
  library(readxl); library(dplyr); library(tidyr)
  library(stringr); library(readr)
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

root      <- resolve_project_root()
excel_dir <- file.path(root, "Analysis", "Japanese_University_Students")
out_dir   <- file.path(root, "Analysis", "JP_Anchoring",
                       "data", "processed")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

f1 <- file.path(excel_dir, "1. uVLT_SSLA.xlsx")
f2 <- file.path(excel_dir, "2. uVLT_LGCTGC.xlsx")
f3 <- file.path(excel_dir, "3. uVLT_VocabLanguaging.xlsx")

clean_str <- function(x) {
  x <- as.character(x); x <- str_trim(x)
  x[x == "" | x == "NA"] <- NA_character_
  x
}

# -----------------------------------------------------------------------------
# generic extractor parameterised by the per-file layout
# -----------------------------------------------------------------------------
extract_file <- function(raw,
                         file_tag,
                         level_row,        # row index of level labels
                         target_row,       # row index of target words
                         first_data_row,   # first row of student responses
                         first_item_col,
                         last_item_col,
                         id_col, total_col, lvl_cols, n_levels = 5,
                         drop_practice = TRUE) {
  levels_row  <- as.character(raw[level_row,  first_item_col:last_item_col])
  targets_row <- as.character(raw[target_row, first_item_col:last_item_col])
  levels_row  <- toupper(levels_row)

  if (drop_practice)
    keep <- !is.na(levels_row) &
            !str_detect(levels_row, regex("practice", ignore_case = TRUE))
  else keep <- !is.na(levels_row)

  # normalise '1K'/'1k' + Japanese full-width 'ｋ'
  levels_clean <- str_replace(levels_row[keep], "[Kｋ]$", "K")
  item_cols    <- which(keep) + (first_item_col - 1L)
  item_targets <- targets_row[keep]
  item_pos     <- ave(seq_along(levels_clean), levels_clean, FUN = seq_along)
  item_id      <- sprintf("%s_%02d", levels_clean, item_pos)

  expected <- 30L * n_levels
  if (length(item_cols) != expected)
    stop(sprintf("[%s] expected %d test items, got %d",
                 file_tag, expected, length(item_cols)))

  # Student rows
  dat <- raw[first_data_row:nrow(raw), , drop = FALSE]
  dat <- dat[rowSums(!is.na(dat)) > 0, , drop = FALSE]
  person_ids <- clean_str(unlist(dat[, id_col]))
  keep_p <- !is.na(person_ids)
  dat <- dat[keep_p, , drop = FALSE]
  person_ids <- person_ids[keep_p]

  resp <- as.data.frame(lapply(item_cols, function(j) clean_str(unlist(dat[, j]))),
                        stringsAsFactors = FALSE)
  names(resp) <- item_id

  scored <- mapply(function(col, tgt) {
    col_l <- tolower(col); tgt_l <- tolower(tgt)
    ifelse(is.na(col_l) | is.na(tgt_l), NA_integer_,
           as.integer(col_l == tgt_l))
  }, resp, item_targets, SIMPLIFY = FALSE)
  scored <- as.data.frame(scored, stringsAsFactors = FALSE)
  names(scored) <- item_id

  # meta
  to_num <- function(v) suppressWarnings(as.numeric(v))
  level_scores <- lapply(lvl_cols, function(j) to_num(unlist(dat[, j])))
  names(level_scores) <- paste0("score_", c("1K","2K","3K","4K","5K")[1:length(lvl_cols)])
  if (length(lvl_cols) < 5)
    level_scores$score_5K <- NA_real_

  persons <- bind_cols(
    tibble(file_src   = file_tag,
           person_raw = person_ids,
           total_form = to_num(unlist(dat[, total_col]))),
    as_tibble(level_scores))

  list(scored  = scored,
       persons = persons,
       items   = tibble(item_id  = item_id,
                        level    = levels_clean,
                        position = item_pos,
                        target   = item_targets))
}

cat("Reading file 1 (SSLA)...\n")
raw1 <- read_excel(f1, col_names = FALSE, .name_repair = "minimal")
ex1 <- extract_file(raw1, "F1_SSLA",
                    level_row = 1, target_row = 2, first_data_row = 4,
                    first_item_col = 14, last_item_col = 166,
                    id_col = 1, total_col = 3, lvl_cols = 4:8)

cat("Reading file 2 (LGCTGC)...\n")
raw2 <- read_excel(f2, col_names = FALSE, .name_repair = "minimal")
ex2 <- extract_file(raw2, "F2_LGCTGC",
                    level_row = 1, target_row = 2, first_data_row = 3,
                    first_item_col = 11, last_item_col = 130,
                    id_col = 1, total_col = 2, lvl_cols = 3:6,
                    n_levels = 4)

cat("Reading file 3 (VocabLanguaging)...\n")
raw3 <- read_excel(f3, col_names = FALSE, .name_repair = "minimal")
ex3 <- extract_file(raw3, "F3_VocabLanguaging",
                    level_row = 1, target_row = 3, first_data_row = 4,
                    first_item_col = 15, last_item_col = 167,
                    id_col = 1, total_col = 4, lvl_cols = 5:9)

# -----------------------------------------------------------------------------
# Combine
# -----------------------------------------------------------------------------
items_all <- bind_rows(ex1$items, ex3$items, ex2$items) |>
  distinct(item_id, .keep_all = TRUE) |>
  arrange(factor(level, levels = c("1K","2K","3K","4K","5K")), position)

stopifnot(nrow(items_all) == 150)

align <- function(scored_df) {
  miss <- setdiff(items_all$item_id, names(scored_df))
  for (m in miss) scored_df[[m]] <- NA_integer_
  scored_df[, items_all$item_id, drop = FALSE]
}
sc1 <- align(ex1$scored); sc2 <- align(ex2$scored); sc3 <- align(ex3$scored)

# de-duplicate IDs (some files contain the same ID twice — treat as separate
# attempts by appending a-, b-, ... suffixes)
suffix_dups <- function(prefix, raw_ids) {
  ids <- sprintf("%s_%s", prefix, raw_ids)
  ave(ids, ids, FUN = function(x) {
    if (length(x) == 1) return(x)
    paste0(x, letters[seq_along(x)])
  })
}

pid1 <- suffix_dups("F1", ex1$persons$person_raw)
pid2 <- suffix_dups("F2", ex2$persons$person_raw)
pid3 <- suffix_dups("F3", ex3$persons$person_raw)

persons_all <- bind_rows(
  mutate(ex1$persons, person_id = pid1),
  mutate(ex2$persons, person_id = pid2),
  mutate(ex3$persons, person_id = pid3)
)

scored_all <- bind_rows(
  mutate(as_tibble(sc1), person_id = pid1, .before = 1),
  mutate(as_tibble(sc2), person_id = pid2, .before = 1),
  mutate(as_tibble(sc3), person_id = pid3, .before = 1)
)
scored_all <- scored_all[, c("person_id", items_all$item_id)]
stopifnot(nrow(scored_all) == nrow(persons_all))

persons_all <- persons_all |>
  mutate(sample_group = ifelse(file_src == "F2_LGCTGC",
                               "JP_4K_only", "JP_5K_admin"),
         raw_total  = rowSums(scored_all[, items_all$item_id], na.rm = TRUE),
         n_answered = rowSums(!is.na(scored_all[, items_all$item_id])))

# -----------------------------------------------------------------------------
# Scoring consistency vs form-reported totals
# -----------------------------------------------------------------------------
check_all <- persons_all |>
  mutate(diff = raw_total - total_form) |>
  summarise(n = n(),
            n_match = sum(abs(diff) < 0.5, na.rm = TRUE),
            mean_abs_diff = mean(abs(diff), na.rm = TRUE),
            max_abs_diff  = max(abs(diff), na.rm = TRUE))
cat("\nScoring consistency (recomputed vs form total) across 312 pps:\n")
print(check_all)

cat("\nBy file:\n")
persons_all |> mutate(diff = raw_total - total_form) |>
  group_by(file_src) |>
  summarise(n = n(),
            mean_abs_diff = mean(abs(diff), na.rm = TRUE),
            max_abs_diff  = max(abs(diff), na.rm = TRUE),
            .groups = "drop") |>
  print()

# Per-level recomputed scores (sanity check against form-reported per-level)
sc_mat <- as.matrix(scored_all[, items_all$item_id])
for (lvl in c("1K","2K","3K","4K","5K")) {
  cols <- items_all$item_id[items_all$level == lvl]
  recomputed <- rowSums(sc_mat[, cols, drop = FALSE], na.rm = TRUE)
  reported   <- persons_all[[paste0("score_", lvl)]]
  d <- recomputed - reported
  cat(sprintf("  %s: mean|diff|=%.2f, max|diff|=%.0f, N reported=%d\n",
              lvl,
              mean(abs(d), na.rm = TRUE),
              max(abs(d), na.rm = TRUE),
              sum(!is.na(reported))))
}

# -----------------------------------------------------------------------------
# Write outputs
# -----------------------------------------------------------------------------
write_csv(scored_all,  file.path(out_dir, "jp_responses_wide.csv"))
write_csv(items_all,   file.path(out_dir, "jp_item_info.csv"))
write_csv(persons_all, file.path(out_dir, "jp_person_info.csv"))
long <- scored_all |>
  pivot_longer(-person_id, names_to = "item_id", values_to = "score")
write_csv(long, file.path(out_dir, "jp_responses_long.csv"))

cat("\nSample by source/group:\n")
print(persons_all |> count(file_src, sample_group))

cat("\nMissingness by level:\n")
long |> left_join(items_all |> select(item_id, level), by = "item_id") |>
  group_by(level) |>
  summarise(p_NA = mean(is.na(score)),
            n_obs = sum(!is.na(score)), .groups = "drop") |>
  print()

cat("\nDone. Outputs in:\n  ", out_dir, "\n")
