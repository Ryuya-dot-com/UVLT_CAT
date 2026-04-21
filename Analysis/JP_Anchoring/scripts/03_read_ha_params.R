# =============================================================================
# 03_read_ha_params.R
# -----------------------------------------------------------------------------
# Collect Ha et al. (2025) UVLT item difficulty parameters for both the
# unidimensional (1-1) and 11-testlet (11TL) ConQuest calibrations.
# Each ConQuest _prm.txt line has format:
#   "<index>\t<index>       <delta>        /* item <n> */"
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(stringr); library(tidyr)
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
cq_dir  <- file.path(root, "Readings", "Study01_UVLT", "ConQuest files")
out_dir <- file.path(root, "Analysis", "JP_Anchoring", "data", "processed")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

levels <- c("1k","2k","3k","4k","5k")

parse_prm <- function(level, model) {
  lvl_num <- sub("k$", "", level)
  stem <- ifelse(model == "1D",
                 sprintf("UVLT%s-1_prm.txt",    lvl_num),
                 sprintf("UVLT%s-11TL_prm.txt", lvl_num))
  f <- file.path(cq_dir, level, stem)
  # ConQuest prm layout: "<idx>  <delta>  /* item <idx> */"
  d <- utils::read.table(f, header = FALSE, strip.white = TRUE,
                         stringsAsFactors = FALSE, fill = TRUE)
  tibble(
    model    = model,
    level    = toupper(level),
    position = as.integer(d$V1),
    delta    = as.numeric(d$V2),
    item_id  = sprintf("%s_%02d", toupper(level), as.integer(d$V1))
  )
}

grid <- expand.grid(level = levels, model = c("1D","11TL"),
                    stringsAsFactors = FALSE)
all_par <- do.call(rbind, Map(parse_prm, grid$level, grid$model))
all_par <- as_tibble(all_par)

cat("Parameter rows extracted:", nrow(all_par), "(expect 300 = 150 x 2)\n")
stopifnot(nrow(all_par) == 300)

# Wide form: one row per item, two columns (delta_1D, delta_11TL)
wide <- all_par |>
  select(model, level, position, item_id, delta) |>
  pivot_wider(names_from = model, values_from = delta,
              names_prefix = "delta_") |>
  arrange(factor(level, levels = c("1K","2K","3K","4K","5K")), position)

write_csv(wide, file.path(out_dir, "ha_params.csv"))

cat("\nSummary by level (11TL):\n")
print(wide |> group_by(level) |>
        summarise(mean = mean(delta_11TL),
                  sd   = sd(delta_11TL),
                  min  = min(delta_11TL),
                  max  = max(delta_11TL)))

# Quick correlation between the two models (within-level)
cat("\n1D vs 11TL correlation by level:\n")
print(wide |> group_by(level) |>
        summarise(r = cor(delta_1D, delta_11TL), .groups = "drop"))

# Cross-band linking coefficients taken from App_CAT/script.js
linking <- tibble(
  level      = c("1K","2K","3K","4K","5K"),
  slope      = c(1.67393, 1.663797, 1.725087, 1.709496, 1.609528),
  intercept  = c(1.040786, 0.943617, 0.973808, 1.058006, 0.986388),
  correlation= c(0.968506, 0.998129, 0.999483, 0.997631, 0.998525),
  rmse       = c(0.322672, 0.082120, 0.047686, 0.099038, 0.064178)
)
write_csv(linking, file.path(out_dir, "cross_band_linking.csv"))
cat("\nCross-band linking coefficients:\n")
print(linking)

# Raw testlet variances from the CAT app (before linking rescaling)
testlet_var <- tibble(
  level = rep(c("1K","2K","3K","4K","5K"), each = 10),
  testlet_pos = rep(1:10, 5),
  variance = c(
    0.51292, 0.78248, 0.80257, 0.60581, 0.73041, 1.40502, 0.46701, 0.98060, 2.15975, 2.45020,
    0.57812, 1.06486, 0.29591, 1.40184, 1.57106, 1.17961, 0.97126, 0.67629, 0.79426, 0.66219,
    1.10257, 0.30189, 1.26191, 1.18785, 0.89292, 0.52752, 0.62772, 0.88701, 0.40443, 0.28666,
    0.80541, 2.78514, 1.58759, 0.83600, 0.69884, 0.11795, 0.28894, 0.21365, 0.24206, 0.71627,
    0.20547, 0.22906, 1.39371, 0.90107, 1.40290, 0.25347, 0.93590, 3.33337, 1.15354, 2.45207
  )
)
write_csv(testlet_var, file.path(out_dir, "raw_testlet_variances.csv"))

cat("\nWritten:\n")
cat("  ha_params.csv             (150 rows, delta_1D + delta_11TL)\n")
cat("  cross_band_linking.csv    (5 rows)\n")
cat("  raw_testlet_variances.csv (50 rows)\n")
