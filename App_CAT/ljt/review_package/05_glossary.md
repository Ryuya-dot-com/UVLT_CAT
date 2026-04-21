# Glossary

## candidate_id

Integer 1, 2, or 3 identifying which of three draft candidates this row
represents within a (target, condition) group.

- **candidate_id = 1** — original draft (preserved verbatim from the
  initial ljt_sentences_draft.csv).
- **candidate_id = 2, 3** — alternative drafts that target different
  syntactic frames (appropriate) or different violation subtypes / swap
  positions (inappropriate).

## approach_label

Short tag describing the candidate's strategic approach:
- For appropriate: frame / context tag
  (e.g., `copula-frame`, `transaction-frame`, `PP-frame`).
- For inappropriate type-a: violation subtype
  (e.g., `animate-violation`, `concrete-violation`, `temporal-violation`).
- For inappropriate type-b: collocation swap position
  (e.g., `object-collocate`, `modifier-collocate`, `prep-collocate`,
  `adverb-collocate`).

## foil_type

- **a_selectional** — inappropriate violates a selectional restriction.
- **b_collocation** — target preserved; a directly-adjacent word is
  swapped to a non-collocate.
- **NA** — appropriate row.

## review_priority

- **routine** — standard review pass.
- **careful** — elevated polysemy or translation-ambiguity risk.
- **critical** — minority tested sense or near-exclusion status; review
  slowly, `reject_all` if foil is truly impossible.

## ljt_eligibility

- **eligible** — standard drafting.
- **careful** — drafting proceeded with acknowledged risks.
- **exclude** — removed from LJT prior to drafting (not in this package).

## best_candidate (per-group, researcher column)

Integer 1, 2, or 3 indicating the chosen candidate. Special values:
- `"blend"` — synthesize features from 2+ candidates.
- `"reject_all"` — all 3 require re-drafting.
