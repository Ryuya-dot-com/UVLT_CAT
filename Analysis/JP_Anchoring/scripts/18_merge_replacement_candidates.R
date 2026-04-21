# =============================================================================
# 18_merge_replacement_candidates.R
# -----------------------------------------------------------------------------
# Merge the two agent JSONs (2K–3K and 4K–5K) into a single flat table of
# replacement candidates, classify them by recommendation status, and emit:
#
#   candidates_flat.csv         : one row per candidate word
#   testlet_redesigns.csv       : proposed whole-testlet replacements
#   summary_by_original.csv     : summary stats per original target
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr)
  library(jsonlite); library(purrr)
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
out  <- file.path(ana, "results", "loanword_replacement")

json1 <- fromJSON(file.path(out, "candidates_2K_3K.json"),
                  simplifyDataFrame = FALSE)
json2 <- fromJSON(file.path(out, "candidates_4K_5K.json"),
                  simplifyDataFrame = FALSE)

all_items <- c(json1, json2)

# ---- split into single-slot candidates and testlet redesigns ---------------
cand_rows <- list()
testlet_rows <- list()

for (item in all_items) {
  if (isTRUE(item$type == "single_slot")) {
    for (c in item$candidates) {
      cand_rows[[length(cand_rows) + 1]] <- tibble(
        original_item_id = item$original_item_id,
        original_target  = item$original_target,
        candidate_word   = c$word,
        recommend        = isTRUE(c$recommend),
        coca_band        = c$coca_band %||% NA_character_,
        suggested_prompt = c$suggested_prompt %||% NA_character_,
        katakana_check   = c$katakana_check %||% NA_character_,
        notes            = c$notes %||% NA_character_
      )
    }
  } else if (isTRUE(item$type == "whole_testlet_redesign")) {
    # Two different JSON shapes across the agents; normalise
    for (i in seq_along(item$proposed_testlets)) {
      pt <- item$proposed_testlets[[i]]
      testlet_rows[[length(testlet_rows) + 1]] <- tibble(
        original_item_id = item$original_item_id,
        variant          = pt$variant %||% sprintf("Variant %d", i),
        options          = paste(pt$options, collapse = ", "),
        answers          = paste(pt$answers %||% sapply(pt$answers_with_prompts,
                                                        function(a) a$target),
                                 collapse = ", "),
        prompts          = paste(pt$prompts %||% sapply(pt$answers_with_prompts,
                                                        function(a) a$prompt),
                                 collapse = " | "),
        rationale        = pt$rationale %||% pt$notes %||%
                           item$rationale %||% NA_character_,
        recommended      = !is.null(item$recommended_testlet_index) &&
                            (i - 1) == item$recommended_testlet_index
      )
    }
  }
}

`%||%` <- function(a, b) if (!is.null(a)) a else b

cand_tbl <- bind_rows(cand_rows)
testlet_tbl <- bind_rows(testlet_rows)

# write flat files
write_csv(cand_tbl,    file.path(out, "candidates_flat.csv"))
write_csv(testlet_tbl, file.path(out, "testlet_redesigns.csv"))

# ---- summary per original target -------------------------------------------
summary_tbl <- cand_tbl |>
  group_by(original_item_id, original_target) |>
  summarise(
    n_candidates    = n(),
    n_recommended   = sum(recommend, na.rm = TRUE),
    top_recommended = paste(candidate_word[recommend][seq_len(min(3, sum(recommend)))],
                            collapse = ", "),
    .groups = "drop")
write_csv(summary_tbl, file.path(out, "summary_by_original.csv"))

cat("=== Replacement-candidate summary ===\n\n")
print(summary_tbl, n = 30, width = Inf)

cat(sprintf("\nTotal candidate suggestions: %d\n", nrow(cand_tbl)))
cat(sprintf("  of which recommended:      %d\n", sum(cand_tbl$recommend)))
cat(sprintf("Whole-testlet redesigns:     %d variants\n", nrow(testlet_tbl)))

cat("\nRecommended candidates only:\n")
print(cand_tbl |>
        filter(recommend) |>
        select(original_item_id, original_target, candidate_word,
               coca_band, suggested_prompt),
      n = 60, width = Inf)

cat("\nTestlet redesign proposals:\n")
print(testlet_tbl, width = Inf)
