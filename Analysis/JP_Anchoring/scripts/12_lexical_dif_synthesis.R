# =============================================================================
# 12_lexical_dif_synthesis.R
# -----------------------------------------------------------------------------
# Synthesize the three agent outputs (loanword, frequency, semantic features)
# with the DIF flag direction and compute how each lexical predictor relates
# to whether an item is easier or harder for Japanese L1 (compared to VN-L1
# Ha et al. 2025 calibrations).
#
# Tests reported: Fisher's exact (2 x k) for every categorical feature, plus
# a multivariable logistic regression on direction (Easier_for_JP = 1).
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr)
  library(jsonlite); library(ggplot2); library(broom)
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

root   <- resolve_project_root()
ana    <- file.path(root, "Analysis", "JP_Anchoring")
dat    <- file.path(ana, "data", "processed")
out    <- file.path(ana, "results", "dif")

# ---- inputs -----------------------------------------------------------------
flags  <- read_csv(file.path(out, "dif_flagged_items_with_direction.csv"),
                   show_col_types = FALSE)
lw     <- fromJSON(file.path(dat, "lexical_loanword.json"),
                   simplifyDataFrame = TRUE) |> as_tibble()
frq    <- fromJSON(file.path(dat, "lexical_frequency.json"),
                   simplifyDataFrame = TRUE) |> as_tibble()
sem    <- fromJSON(file.path(dat, "lexical_semantic.json"),
                   simplifyDataFrame = TRUE) |> as_tibble()

# rename for clarity
lw  <- lw  |> rename(target = word)
frq <- frq |> rename(target = word,
                     freq_notes = notes,
                     freq_COCA  = coca_rank_band,
                     freq_BNC   = bnc_band)
sem <- sem |> rename(target = word, sem_notes = notes)
lw  <- lw  |> rename(lw_notes = notes)

# ---- merge ------------------------------------------------------------------
dat_all <- flags |>
  left_join(lw,  by = "target") |>
  left_join(frq, by = "target") |>
  left_join(sem, by = "target")

dat_all <- dat_all |>
  mutate(is_easier_JP = (directions == "Easier_for_JP"),
         # Coalesce BAND into fewer groups for analysis
         freq_band = case_when(
           freq_COCA %in% c("top_1K","top_2K")         ~ "top_2K",
           freq_COCA %in% c("top_3K","top_4K","top_5K") ~ "top_3-5K",
           freq_COCA %in% c("top_10K")                  ~ "top_10K",
           freq_COCA %in% c("top_20K","beyond_20K")     ~ "20K+",
           TRUE                                         ~ "unknown"),
         # Collapse loanword status
         has_katakana = loanword_status %in% c("loanword","dual"),
         # Collapse school curriculum
         school_exposure = factor(school_curriculum_JP,
                                  levels = c("early","mid","late","unknown")))

write_csv(dat_all, file.path(out, "dif_with_lexical.csv"))

# ---- helper: Fisher's exact test + 2 x k table ------------------------------
fisher_feature <- function(df, feat_col) {
  if (length(unique(df[[feat_col]])) < 2) return(NULL)
  tab <- table(df[[feat_col]], df$directions)
  # p, OR for 2x2 if possible
  fish <- tryCatch(fisher.test(tab, simulate.p.value = TRUE, B = 20000),
                   error = function(e) NULL)
  list(
    feature = feat_col,
    n_cat   = length(unique(df[[feat_col]])),
    table   = tab,
    p_value = if (!is.null(fish)) fish$p.value else NA_real_,
    estimate = if (!is.null(fish) && !is.null(fish$estimate)) fish$estimate else NA_real_
  )
}

features <- c("pos", "loanword_status", "cognate_ease", "has_katakana",
              "freq_band", "jp_eikyo", "genre_skew",
              "concreteness", "polysemy", "cultural_tilt",
              "translation_ambiguity_JP", "school_curriculum_JP")

cat("\n=============== Fisher's exact tests (feature x direction) ===============\n")
fisher_results <- list()
for (f in features) {
  r <- fisher_feature(dat_all, f)
  if (is.null(r)) { cat("  (skip ", f, ": only one level)\n"); next }
  fisher_results[[f]] <- r
  cat(sprintf("\n--- %s (Fisher p = %.4f", f, r$p_value))
  if (is.finite(r$estimate)) cat(sprintf(", OR = %.3f", r$estimate))
  cat(") ---\n")
  print(r$table)
  pct <- round(100 * prop.table(r$table, margin = 1), 1)
  cat("% Easier_for_JP within each row:\n")
  print(round(100 * sweep(r$table, 1, rowSums(r$table), "/")[, "Easier_for_JP"], 1))
}

summary_tbl <- tibble(
  feature = names(fisher_results),
  p_value = sapply(fisher_results, function(r) r$p_value),
  OR_if2x2 = sapply(fisher_results, function(r) {
    if (!is.null(r$estimate) && is.finite(r$estimate)) r$estimate else NA
  }),
  n_levels = sapply(fisher_results, function(r) r$n_cat)
) |> arrange(p_value)
write_csv(summary_tbl, file.path(out, "lexical_fisher_summary.csv"))
cat("\n=============== Fisher summary (sorted by p) ===============\n")
print(summary_tbl)

# ---- simple descriptive cross-tabs ------------------------------------------
cat("\n=============== % Easier-for-JP by feature ===============\n")
pct_by <- list()
for (f in c("has_katakana","cognate_ease","pos","cultural_tilt",
            "jp_eikyo","freq_band","school_curriculum_JP")) {
  tmp <- dat_all |>
    group_by(.data[[f]]) |>
    summarise(n = n(),
              prop_easier_JP = mean(is_easier_JP, na.rm = TRUE),
              .groups = "drop")
  tmp[[1]] <- as.character(tmp[[1]])   # normalise category to character
  names(tmp)[1] <- "category"
  tmp$feature <- f
  pct_by[[f]] <- tmp
}
pct_all <- bind_rows(pct_by) |>
  select(feature, category, n, prop_easier_JP)
write_csv(pct_all, file.path(out, "lexical_pct_easier_JP.csv"))
print(pct_all, n = 100)

# ---- multivariable logistic regression --------------------------------------
cat("\n=============== Logistic regression ===============\n")
mod_df <- dat_all |>
  mutate(
    is_easier = as.integer(is_easier_JP),
    cognate_ease = factor(cognate_ease, levels = c("low","medium","high")),
    freq_band = factor(freq_band,
                       levels = c("top_2K","top_3-5K","top_10K","20K+")),
    pos = factor(pos, levels = c("noun","verb","adjective")),
    cultural_tilt = factor(cultural_tilt,
                           levels = c("universal","business_academic",
                                      "western","japanese"))
  )

# Primary model
m1 <- glm(is_easier ~ cognate_ease + freq_band + pos + cultural_tilt,
          data = mod_df, family = binomial())
cat("\nLogistic regression (direction = Easier_for_JP)\n")
print(tidy(m1, conf.int = TRUE, exponentiate = TRUE), width = Inf)
write_csv(tidy(m1, conf.int = TRUE, exponentiate = TRUE),
          file.path(out, "lexical_logistic_main.csv"))

# Reduced model with the strongest single predictor
m2 <- glm(is_easier ~ cognate_ease, data = mod_df, family = binomial())
cat("\nReduced: direction ~ cognate_ease only\n")
print(tidy(m2, conf.int = TRUE, exponentiate = TRUE), width = Inf)

# ---- continuous: linear model on signed MH delta ----------------------------
# direction field represents binary; we can compute signed delta:
#   Easier_for_JP -> delta is strongly negative
#   Harder_for_JP -> delta is strongly positive
# We regenerate a signed delta: same sign as in original difR output.
signed <- dat_all |>
  mutate(signed_MH = ifelse(directions == "Easier_for_JP",
                            -max_abs_MH, max_abs_MH),
         signed_MH = pmin(pmax(signed_MH, -15), 15))  # clip Inf

m_lin <- lm(signed_MH ~ cognate_ease + freq_band + pos + cultural_tilt,
            data = signed |>
              mutate(cognate_ease = factor(cognate_ease,
                                           levels = c("low","medium","high")),
                     freq_band = factor(freq_band,
                                        levels = c("top_2K","top_3-5K",
                                                   "top_10K","20K+"))))
cat("\nLinear model: signed MH delta ~ features\n")
print(tidy(m_lin, conf.int = TRUE), width = Inf)
write_csv(tidy(m_lin, conf.int = TRUE),
          file.path(out, "lexical_linear_signed_MH.csv"))

# ---- plots ------------------------------------------------------------------
theme_set(theme_bw())
plot_feat <- function(feat, title) {
  d <- dat_all |> group_by(.data[[feat]], directions) |>
    summarise(n = n(), .groups = "drop")
  d[[feat]] <- factor(d[[feat]])
  ggplot(d, aes(x = .data[[feat]], y = n, fill = directions)) +
    geom_col(position = "stack") +
    geom_text(aes(label = n), position = position_stack(vjust = .5),
              color = "white", size = 3.2) +
    scale_fill_manual(values = c(Easier_for_JP = "steelblue",
                                 Harder_for_JP = "firebrick")) +
    labs(title = title, x = feat, y = "Count of flagged items",
         fill = "Direction") +
    theme(axis.text.x = element_text(angle = 20, hjust = 1))
}

ggsave(file.path(out, "lex_stack_has_katakana.png"),
       plot_feat("has_katakana", "Katakana loanword availability × DIF direction"),
       width = 6, height = 4, dpi = 150)
ggsave(file.path(out, "lex_stack_cognate_ease.png"),
       plot_feat("cognate_ease", "Cognate ease × DIF direction"),
       width = 6, height = 4, dpi = 150)
ggsave(file.path(out, "lex_stack_pos.png"),
       plot_feat("pos", "Part of speech × DIF direction"),
       width = 5, height = 4, dpi = 150)
ggsave(file.path(out, "lex_stack_culture.png"),
       plot_feat("cultural_tilt", "Cultural tilt × DIF direction"),
       width = 6, height = 4, dpi = 150)
ggsave(file.path(out, "lex_stack_jp_eikyo.png"),
       plot_feat("jp_eikyo", "JP curriculum exposure × DIF direction"),
       width = 5, height = 4, dpi = 150)
ggsave(file.path(out, "lex_stack_school.png"),
       plot_feat("school_curriculum_JP",
                 "Estimated JP school curriculum tier × DIF direction"),
       width = 6, height = 4, dpi = 150)

# Continuous
p_cont <- ggplot(signed, aes(x = cognate_ease, y = signed_MH)) +
  geom_jitter(width = 0.15, size = 2, alpha = .75,
              aes(color = directions)) +
  geom_hline(yintercept = 0, linetype = 2, alpha = .4) +
  scale_color_manual(values = c(Easier_for_JP = "steelblue",
                                Harder_for_JP = "firebrick")) +
  labs(x = "Cognate ease (loanword familiarity)",
       y = "Signed MH delta (neg = easier for JP)",
       title = "Cognate ease predicts JP-favoring DIF direction")
ggsave(file.path(out, "lex_signed_MH_by_cognate.png"),
       p_cont, width = 6, height = 4, dpi = 150)

save(dat_all, m1, m2, m_lin, fisher_results, pct_all,
     file = file.path(out, "lexical_synthesis.RData"))
cat("\nDone. Lexical synthesis saved in ", out, "\n")
