# =============================================================================
# 02_prepare_vn_data.R
# -----------------------------------------------------------------------------
# Read Ha et al. (2025) Vietnamese L1 UVLT response data from the Winsteps
# control files (one per level). Each file has a header block, then one
# data line per person of the form:
#     "<30 bits, 0/1/space>  <person_id>"
# followed by "END NAMES" above the data block.
# Produces a 311 x 150 binary response matrix (plus an item info table).
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr)
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

root     <- resolve_project_root()
ws_dir   <- file.path(root, "Readings", "Study01_UVLT", "Winsteps files")
out_dir  <- file.path(root, "Analysis", "JP_Anchoring", "data", "processed")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

levels <- c("1k","2k","3k","4k","5k")
parse_ws <- function(level) {
  f <- file.path(ws_dir, sprintf("UVLT_Data%s.txt", level))
  lines <- read_lines(f)

  # data block starts after "END NAMES"
  end_names <- which(str_detect(lines, "^END NAMES"))
  if (length(end_names) != 1) stop("Cannot locate END NAMES in ", f)
  dat <- lines[(end_names + 1):length(lines)]
  dat <- dat[nchar(trimws(dat)) > 0]

  # Each line: first 30 chars = response pattern, rest = person id
  pattern <- substr(dat, 1, 30)
  pid     <- trimws(substr(dat, 31, nchar(dat)))

  # scored matrix (some cells can be space = NA)
  sc <- do.call(rbind, lapply(pattern, function(r) {
    ch <- strsplit(r, "", fixed = TRUE)[[1]]
    ch[ch == " "] <- NA
    suppressWarnings(as.integer(ch))
  }))
  colnames(sc) <- sprintf("%s_%02d", toupper(level), seq_len(30))
  tibble(person_raw = pid, as_tibble(sc))
}

vn_list <- lapply(levels, parse_ws)
names(vn_list) <- toupper(levels)

# Merge by person id (Winsteps files should share the same 311 persons)
merged <- Reduce(function(a, b) full_join(a, b, by = "person_raw"), vn_list)

cat("VN data rows:", nrow(merged), "  cols:", ncol(merged)-1, "\n")
stopifnot(ncol(merged) - 1 == 150)

merged <- merged |>
  mutate(person_id = sprintf("VN_%s", person_raw)) |>
  relocate(person_id)

# item info aligned to JP item ordering
item_info <- tibble(item_id = names(merged)[-(1:2)]) |>
  mutate(level    = substr(item_id, 1, 2),
         position = as.integer(substr(item_id, 4, 5)))

write_csv(merged |> select(-person_raw),
          file.path(out_dir, "vn_responses_wide.csv"))
write_csv(item_info, file.path(out_dir, "vn_item_info.csv"))

cat("\nMissing cells per level (Vietnamese):\n")
long <- merged |>
  select(-person_raw) |>
  pivot_longer(-person_id, names_to = "item_id", values_to = "score") |>
  left_join(item_info, by = "item_id")
print(long |> group_by(level) |>
        summarise(p_NA = mean(is.na(score)),
                  n = sum(!is.na(score)),
                  .groups = "drop"))

cat("\nDescriptive: item p-values (proportion correct) per level\n")
print(long |> group_by(level) |>
        summarise(p_correct = mean(score, na.rm = TRUE),
                  .groups = "drop"))
