# =============================================================================
# 17_loanword_replacement_targets.R
# -----------------------------------------------------------------------------
# Build a clean list of UVLT items most at-risk from Japanese-loanword (gairaigo)
# bias for replacement-candidate search. Criteria for "replacement-priority":
#
#   loanword_status == "loanword"                        (pure katakana)  OR
#   (loanword_status == "dual"
#     AND cognate_ease == "high"
#     AND directions == "Easier_for_JP")                 (effectively gairaigo)
#
# Attach each target item's testlet context from App_CAT:
#   * testletId, position within band
#   * prompt (definition clue)
#   * the 6 distractor options
#   * sibling target words in the same testlet
#
# Output: JSON + CSV for the downstream research agents.
# =============================================================================

suppressPackageStartupMessages({
  library(readr); library(dplyr); library(tidyr); library(stringr)
  library(jsonlite)
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
dat  <- file.path(ana, "data", "processed")
out  <- file.path(ana, "results", "loanword_replacement")
dir.create(out, recursive = TRUE, showWarnings = FALSE)

# ---- loanword analysis data -------------------------------------------------
lex <- read_csv(file.path(ana, "results/dif/dif_with_lexical.csv"),
                show_col_types = FALSE) |>
  distinct(item_id, level, target, pos, directions, max_abs_MH,
           loanword_status, cognate_ease, most_common_JP,
           freq_COCA, jp_eikyo, polysemy, cultural_tilt,
           translation_ambiguity_JP, lw_notes)

# ---- priority rule ----------------------------------------------------------
priority <- lex |>
  mutate(
    priority = case_when(
      loanword_status == "loanword" ~ "P1_pure_loanword",
      loanword_status == "dual" &
        cognate_ease == "high" &
        directions == "Easier_for_JP" ~ "P2_dual_high_JPeasy",
      TRUE ~ "—"),
    is_target = priority %in% c("P1_pure_loanword", "P2_dual_high_JPeasy")
  ) |>
  filter(is_target) |>
  arrange(priority, level, target)

cat("Replacement-priority items:\n")
print(priority |> count(priority, level))

# ---- App_CAT testlet context (from script.js BAND_BLUEPRINTS) --------------
# Copied verbatim from /App_CAT/script.js lines 144-205
blueprint <- list(
  `1K` = list(
    list(partOfSpeech="noun",      options=c("choice","computer","garden","photograph","price","week"),
         prompts=c("cost","picture","place where things grow outside"),
         answers=c("price","photograph","garden")),
    list(partOfSpeech="noun",      options=c("eye","father","night","van","voice","year"),
         prompts=c("body part that sees","parent who is a man","part of the day with no sun"),
         answers=c("eye","father","night")),
    list(partOfSpeech="noun",      options=c("center","note","state","tomorrow","uncle","winter"),
         prompts=c("brother of your mother or father","middle","short piece of writing"),
         answers=c("uncle","center","note")),
    list(partOfSpeech="noun",      options=c("box","brother","horse","hour","house","plan"),
         prompts=c("family member","sixty minutes","way of doing things"),
         answers=c("brother","hour","plan")),
    list(partOfSpeech="noun",      options=c("animal","bath","crime","grass","law","shoulder"),
         prompts=c("green leaves that cover the ground","place to wash","top end of your arm"),
         answers=c("grass","bath","shoulder")),
    list(partOfSpeech="verb",      options=c("drink","educate","forget","laugh","prepare","suit"),
         prompts=c("get ready","make a happy sound","not remember"),
         answers=c("prepare","laugh","forget")),
    list(partOfSpeech="verb",      options=c("check","fight","return","tell","work","write"),
         prompts=c("do things to get money","go back again","make sure"),
         answers=c("work","return","check")),
    list(partOfSpeech="verb",      options=c("bring","can","reply","stare","understand","wish"),
         prompts=c("say or write an answer to somebody","carry to another place","look at for a long time"),
         answers=c("reply","bring","stare")),
    list(partOfSpeech="adjective", options=c("alone","bad","cold","green","loud","main"),
         prompts=c("most important","not good","not hot"),
         answers=c("main","bad","cold")),
    list(partOfSpeech="adjective", options=c("awful","definite","exciting","general","mad","sweet"),
         prompts=c("certain","usual","very bad"),
         answers=c("definite","general","awful"))
  ),
  `2K` = list(
    list(partOfSpeech="noun",      options=c("coach","customer","feature","pie","vehicle","weed"),
         prompts=c("important part of something","person who trains members of sports teams","unwanted plant"),
         answers=c("feature","coach","weed")),
    list(partOfSpeech="noun",      options=c("average","discipline","knowledge","pocket","trap","vegetable"),
         prompts=c("food grown in gardens","information which a person has","middle number"),
         answers=c("vegetable","knowledge","average")),
    list(partOfSpeech="noun",      options=c("circle","justice","knife","onion","partner","pension"),
         prompts=c("round shape","something used to cut food","using laws fairly"),
         answers=c("circle","knife","justice")),
    list(partOfSpeech="noun",      options=c("cable","section","sheet","site","staff","tank"),
         prompts=c("part","place","something to cover a bed"),
         answers=c("section","site","sheet")),
    list(partOfSpeech="noun",      options=c("apartment","cap","envelope","lawyer","speed","union"),
         prompts=c("cover for letters","kind of hat","place to live inside a tall building"),
         answers=c("envelope","cap","apartment")),
    list(partOfSpeech="verb",      options=c("argue","contribute","quit","seek","vote","wrap"),
         prompts=c("cover tightly and completely","give to","look for"),
         answers=c("wrap","contribute","seek")),
    list(partOfSpeech="verb",      options=c("avoid","contain","murder","search","switch","trade"),
         prompts=c("have something inside","look for","try not to do"),
         answers=c("contain","search","avoid")),
    list(partOfSpeech="verb",      options=c("bump","complicate","include","organize","receive","warn"),
         prompts=c("get something","hit gently","have as part of something"),
         answers=c("receive","bump","include")),
    list(partOfSpeech="adjective", options=c("available","constant","electrical","medical","proud","super"),
         prompts=c("feeling good about what you have done","great","happening all the time"),
         answers=c("proud","super","constant")),
    list(partOfSpeech="adjective", options=c("environmental","junior","pure","rotten","smooth","wise"),
         prompts=c("bad","not rough","younger in position"),
         answers=c("rotten","smooth","junior"))
  ),
  `3K` = list(
    list(partOfSpeech="noun",      options=c("angle","apology","behavior","bible","celebration","portion"),
         prompts=c("actions","happy occasion","statement saying you are sorry"),
         answers=c("behavior","celebration","apology")),
    list(partOfSpeech="noun",      options=c("anxiety","athlete","counsel","foundation","phrase","wealth"),
         prompts=c("combination of words","guidance","large amount of money"),
         answers=c("phrase","counsel","wealth")),
    list(partOfSpeech="noun",      options=c("agriculture","conference","frequency","liquid","regime","volunteer"),
         prompts=c("farming","government","person who helps without payment"),
         answers=c("agriculture","regime","volunteer")),
    list(partOfSpeech="noun",      options=c("asset","heritage","novel","poverty","prosecution","suburb"),
         prompts=c("having little money","history","useful thing"),
         answers=c("poverty","heritage","asset")),
    list(partOfSpeech="noun",      options=c("audience","crystal","intelligence","outcome","pit","welfare"),
         prompts=c("ability to learn","deep place","people who watch and listen"),
         answers=c("intelligence","pit","audience")),
    list(partOfSpeech="verb",      options=c("consent","enforce","exhibit","retain","specify","target"),
         prompts=c("agree","say clearly","show in public"),
         answers=c("consent","specify","exhibit")),
    list(partOfSpeech="verb",      options=c("accomplish","capture","debate","impose","proceed","prohibit"),
         prompts=c("catch","go on","talk about what is correct"),
         answers=c("capture","proceed","debate")),
    list(partOfSpeech="verb",      options=c("absorb","decline","exceed","link","nod","persist"),
         prompts=c("continue to happen","goes beyond the limit","take in"),
         answers=c("persist","exceed","absorb")),
    list(partOfSpeech="adjective", options=c("approximate","frequent","graphic","pale","prior","vital"),
         prompts=c("almost exact","earlier","happening often"),
         answers=c("approximate","prior","frequent")),
    list(partOfSpeech="adjective", options=c("consistent","enthusiastic","former","logical","marginal","mutual"),
         prompts=c("not changing","occurring earlier in time","shared"),
         answers=c("consistent","former","mutual"))
  ),
  `4K` = list(
    list(partOfSpeech="noun",      options=c("cave","scenario","sergeant","stitch","vitamin","wax"),
         prompts=c("healthy supplement","opening in the ground or in the side of a hill","situation"),
         answers=c("vitamin","cave","scenario")),
    list(partOfSpeech="noun",      options=c("candle","diamond","gulf","salmon","soap","tutor"),
         prompts=c("something used for cleaning","teacher","valuable stone"),
         answers=c("soap","tutor","diamond")),
    list(partOfSpeech="noun",      options=c("agony","kilogram","orchestra","scrap","slot","soccer"),
         prompts=c("group of people who play music","long, thin opening","small unwanted piece"),
         answers=c("orchestra","slot","scrap")),
    list(partOfSpeech="noun",      options=c("crust","incidence","ram","senator","venue","verdict"),
         prompts=c("hard outside part","judgment","place"),
         answers=c("crust","verdict","venue")),
    list(partOfSpeech="noun",      options=c("alley","embassy","hardware","nutrition","threshold","tobacco"),
         prompts=c("government building","plant that is smoked in cigarettes","small street between buildings"),
         answers=c("embassy","tobacco","alley")),
    list(partOfSpeech="verb",      options=c("fling","forbid","harvest","shrink","simulate","vibrate"),
         prompts=c("do not allow","make smaller","throw"),
         answers=c("forbid","shrink","fling")),
    list(partOfSpeech="verb",      options=c("activate","disclose","hug","intimidate","plunge","weep"),
         prompts=c("cry","tell","turn on"),
         answers=c("weep","disclose","activate")),
    list(partOfSpeech="verb",      options=c("diminish","exaggerate","explode","penetrate","transplant","verify"),
         prompts=c("break into pieces violently","get smaller","move something to another place"),
         answers=c("explode","diminish","transplant")),
    list(partOfSpeech="adjective", options=c("adjacent","crude","fond","sane","spherical","swift"),
         prompts=c("beside","not crazy","quick"),
         answers=c("adjacent","sane","swift")),
    list(partOfSpeech="adjective", options=c("abnormal","bulky","credible","greasy","magnificent","optical"),
         prompts=c("believable","oily","unusual"),
         answers=c("credible","greasy","abnormal"))
  ),
  `5K` = list(
    list(partOfSpeech="noun",      options=c("gown","maid","mustache","paradise","pastry","vinegar"),
         prompts=c("hair on your upper lip","perfect place","small baked food"),
         answers=c("mustache","paradise","pastry")),
    list(partOfSpeech="noun",      options=c("asthma","chord","jockey","monk","rectangle","vase"),
         prompts=c("container for cut flowers","group of musical notes that are played at the same time","shape with two long and two short sides"),
         answers=c("vase","chord","rectangle")),
    list(partOfSpeech="noun",      options=c("batch","dentist","hum","lime","pork","scripture"),
         prompts=c("green fruit","low, constant sound","meat from pigs"),
         answers=c("lime","hum","pork")),
    list(partOfSpeech="noun",      options=c("amnesty","claw","earthquake","perfume","sanctuary","wizard"),
         prompts=c("liquid that is made to smell nice","man who has magical powers","safe place"),
         answers=c("perfume","wizard","sanctuary")),
    list(partOfSpeech="noun",      options=c("altitude","diversion","hemisphere","pirate","robe","socket"),
         prompts=c("height","kind of clothing","person who attacks ships"),
         answers=c("altitude","robe","pirate")),
    list(partOfSpeech="verb",      options=c("applaud","erase","jog","intrude","notify","wrestle"),
         prompts=c("announce","enter without permission","remove"),
         answers=c("notify","intrude","erase")),
    list(partOfSpeech="verb",      options=c("bribe","expire","immerse","meditate","persecute","shred"),
         prompts=c("cut or tear into small pieces","end","think deeply"),
         answers=c("shred","expire","meditate")),
    list(partOfSpeech="verb",      options=c("commemorate","growl","ignite","pierce","renovate","swap"),
         prompts=c("catch fire","exchange","go into or through something"),
         answers=c("ignite","swap","pierce")),
    list(partOfSpeech="adjective", options=c("bald","eternal","imperative","lavish","moist","tranquil"),
         prompts=c("calm and quiet","having no hair","slightly wet"),
         answers=c("tranquil","bald","moist")),
    list(partOfSpeech="adjective", options=c("diesel","incidental","mandatory","prudent","superficial","tame"),
         prompts=c("not dangerous","required","using good judgment"),
         answers=c("tame","mandatory","prudent"))
  )
)

# ---- find testlet context for each priority target -------------------------
attach_testlet_ctx <- function(level, target) {
  bp <- blueprint[[level]]
  for (t in seq_along(bp)) {
    if (target %in% bp[[t]]$answers) {
      ans_idx <- which(bp[[t]]$answers == target)
      siblings <- bp[[t]]$answers[-ans_idx]
      distractors <- setdiff(bp[[t]]$options, bp[[t]]$answers)
      return(list(
        testlet_index = t,
        part_of_speech = bp[[t]]$partOfSpeech,
        prompt = bp[[t]]$prompts[ans_idx],
        sibling_targets = paste(siblings, collapse = ", "),
        distractors = paste(distractors, collapse = ", "),
        all_options = paste(bp[[t]]$options, collapse = ", ")
      ))
    }
  }
  return(list(testlet_index = NA, part_of_speech = NA, prompt = NA,
              sibling_targets = NA, distractors = NA, all_options = NA))
}

# Build context-attached priority list
contexts <- purrr::map2_dfr(priority$level, priority$target, function(l, t) {
  ctx <- attach_testlet_ctx(l, t)
  as_tibble(ctx)
})

priority_ctx <- bind_cols(priority, contexts)

write_csv(priority_ctx, file.path(out, "replacement_targets.csv"))
write_json(priority_ctx, file.path(out, "replacement_targets.json"),
           pretty = TRUE, auto_unbox = TRUE)

cat("\nReplacement targets (with testlet context):\n")
print(priority_ctx |>
        select(item_id, level, target, pos, priority, prompt, distractors),
      n = 30, width = Inf)

cat(sprintf("\nTotal replacement-priority targets: %d\n", nrow(priority_ctx)))
cat("Saved to:\n")
cat(" ", file.path(out, "replacement_targets.csv"), "\n")
cat(" ", file.path(out, "replacement_targets.json"), "\n")
