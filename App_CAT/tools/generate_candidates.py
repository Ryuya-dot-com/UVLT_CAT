"""
Generate ljt_sentences_candidates.csv (858 rows = 286 * 3 candidates).
- candidate_id=1: verbatim draft
- candidate_id=2, 3: new sentences with different syntactic frames / lexical
  swaps following §3.3, §3.4, and the diversification rule.
"""
from __future__ import annotations
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DRAFT = ROOT / "ljt" / "ljt_sentences_draft.csv"
OUT = ROOT / "ljt" / "ljt_sentences_candidates.csv"
VERSION = "claude-opus-drafting-v1-2026-04-19"

# Each entry:
# item_id : {
#   "app":   [(sent, frame, approach, rationale, risks), ...],  # 2 new (cand 2, 3)
#   "inapp": [(sent, frame, approach, rationale, risks), ...],  # 2 new (cand 2, 3)
# }
#
# candidate 1 is taken from the draft file.

CAND: dict[str, dict[str, list[tuple[str, str, str, str, str]]]] = {}

# ----------------------------------------------------------------------------
# 1K band
# ----------------------------------------------------------------------------

CAND["uvlt_1k_t01_i01"] = {  # price (1K noun, cost; foil=a)
    "app": [
        ("She checked the price of milk.", "SVO-PP",
         "verb-change",
         "cost sense forced by 'checked' + 'of milk'; price is the object of inspection",
         ""),
        ("We paid a high price yesterday.", "SVO-temporal",
         "transaction-frame",
         "cost sense forced by 'paid' + gradable 'high'; transaction context",
         ""),
    ],
    "inapp": [
        ("She checked the price of happiness.", "SVO-PP",
         "concrete-violation",
         "price in 'cost' sense requires +countable/+material referent in PP; 'happiness' is -substance abstract",
         ""),
        ("We paid a sleeping price yesterday.", "SVO-temporal",
         "animate-violation",
         "price is -animate; modifier 'sleeping' requires +animate/+sentient head noun",
         ""),
    ],
}

CAND["uvlt_1k_t01_i02"] = {  # photograph (1K noun, picture; foil=a)
    "app": [
        ("We framed the old family photograph.", "SVO",
         "modifier-swap",
         "picture sense forced by 'framed' + 'old family'",
         ""),
        ("The photograph on the wall fell.", "SV-PP",
         "subject-frame",
         "picture sense forced by 'on the wall' + 'fell'",
         ""),
    ],
    "inapp": [
        ("We framed the loud family photograph.", "SVO",
         "audible-violation",
         "photograph is -audible; modifier 'loud' requires +audible head noun",
         ""),
        ("The photograph on the wall laughed.", "SV-PP",
         "animate-violation",
         "photograph is -animate; predicate 'laughed' requires +animate/+sentient subject",
         ""),
    ],
}

CAND["uvlt_1k_t01_i03"] = {  # garden (1K noun, place; foil=a)
    "app": [
        ("She watered the small front garden.", "SVO",
         "object-frame",
         "place-for-growing sense forced by 'watered' + 'small front'",
         ""),
        ("Birds sang in the big garden.", "SV-PP",
         "subject-verb-change",
         "garden (outdoor place) forced by 'birds sang in the'",
         ""),
    ],
    "inapp": [
        ("She watered the angry front garden.", "SVO",
         "animate-violation",
         "garden (place) is -sentient; 'angry' requires +sentient modified noun",
         ""),
        ("Birds sang in the asleep garden.", "SV-PP",
         "animate-violation-2",
         "garden is -animate; 'asleep' requires +animate head noun",
         ""),
    ],
}

CAND["uvlt_1k_t02_i01"] = {  # eye (1K noun, body part; foil=b)
    "app": [
        ("The doctor examined my left eye.", "SVO",
         "verb-object-swap",
         "body-part sense forced by 'doctor examined' + 'left'",
         "careful item: eye polysemy (needle, storm). Target preserved."),
        ("She closed her tired right eye.", "SVO",
         "modifier-swap",
         "body-part sense forced by 'closed' + 'tired right'",
         "careful item: eye polysemy preserved across candidates."),
    ],
    "inapp": [
        ("The doctor examined my musical eye.", "SVO",
         "modifier-collocate",
         "'musical eye' is not a COCA collocate for body-part sense (left/right/tired/sore/bright standard); target eye preserved",
         "careful item: 'musical eye' has no storm/needle rescue."),
        ("She closed her quick right eye.", "SVO",
         "modifier-collocate-2",
         "'quick eye' for body-part is non-collocate in this frame (typical: tired/sore/bright/left/right)",
         "careful item: 'quick eye' metaphor possible but foil rejects across senses."),
    ],
}

CAND["uvlt_1k_t02_i02"] = {  # father (1K noun, male parent; foil=b)
    "app": [
        ("My father cooks dinner every Sunday.", "SVO-temporal",
         "verb-object-swap",
         "parent-who-is-a-man sense forced by 'my' + 'cooks dinner every Sunday'",
         "iteration: kin+habitual-action frame."),
        ("Her father bought a new car.", "SVO",
         "SVO-frame",
         "parent sense forced by possessive + 'bought'",
         ""),
    ],
    "inapp": [
        ("My father boils dinner every Sunday.", "SVO-temporal",
         "verb-collocate",
         "'father boils' as main verb is non-collocate for human agent (cooks/makes/prepares standard); target preserved",
         ""),
        ("Her father rusted a new car.", "SVO",
         "verb-collocate-2",
         "'father rusted' is non-collocate; +human subject with 'rusted' (material process) unusual",
         ""),
    ],
}

CAND["uvlt_1k_t02_i03"] = {  # night (1K noun, part of day; foil=b)
    "app": [
        ("The night was dark and quiet.", "SVC",
         "copula-frame",
         "part-of-day sense forced by 'was dark and quiet'",
         ""),
        ("We walked home on that night.", "SV-PP",
         "PP-frame",
         "part-of-day sense forced by 'walked home on that'",
         ""),
    ],
    "inapp": [
        ("The night was sweet and quiet.", "SVC",
         "copula-collocate",
         "'sweet night' is non-collocate for temporal sense (dark/cold/long/quiet/silent standard)",
         ""),
        ("We walked home on that edible night.", "SV-PP",
         "modifier-collocate",
         "'edible night' non-collocate for part-of-day (long/cold/rainy/quiet/dark night standard)",
         ""),
    ],
}

CAND["uvlt_1k_t03_i01"] = {  # uncle (1K noun, kin; foil=a)
    "app": [
        ("She visited her uncle last weekend.", "SVO-temporal",
         "visit-frame",
         "kin sense forced by possessive + 'visited' + 'last weekend'",
         ""),
        ("Her uncle drove to the station.", "SV-PP",
         "drive-frame",
         "kin (+human) sense forced by 'drove to the station'",
         ""),
    ],
    "inapp": [
        ("She visited her edible uncle last weekend.", "SVO-temporal",
         "edible-violation",
         "uncle (+human) is -edible; 'edible' requires +food/+substance modified noun",
         ""),
        ("Her uncle melted in the station.", "SV-PP",
         "substance-violation",
         "uncle (+human) is -substance; 'melted' requires +substance/+meltable subject",
         ""),
    ],
}

CAND["uvlt_1k_t03_i02"] = {  # center (1K noun, middle; foil=a)
    "app": [
        ("The ball rolled to the center.", "SV-PP",
         "locative-frame",
         "middle sense forced by 'ball rolled to the'",
         "minority-sense polysemy (community center). Foil works across senses."),
        ("She drew a dot in the center.", "SVO-PP",
         "drawing-frame",
         "middle sense forced by 'drew a dot in the'",
         ""),
    ],
    "inapp": [
        ("The ball rolled to the happy center.", "SV-PP",
         "animate-violation",
         "center (geometric middle) is -sentient; 'happy' requires +sentient modified noun",
         ""),
        ("She drew a dot in the hungry center.", "SVO-PP",
         "animate-violation-2",
         "center is -animate; 'hungry' requires +animate head noun",
         ""),
    ],
}

CAND["uvlt_1k_t03_i03"] = {  # note (1K noun, short writing; foil=a)
    "app": [
        ("He read the short note quickly.", "SVO-adv",
         "read-frame",
         "short-piece-of-writing sense forced by 'read' + 'short' + 'quickly'",
         "minority-sense: music note. Foil fails there too."),
        ("She wrote a kind note today.", "SVO-temporal",
         "write-frame",
         "writing sense forced by 'wrote' + 'kind' modifier",
         ""),
    ],
    "inapp": [
        ("He read the angry short note quickly.", "SVO-adv",
         "animate-violation-multi-modifier",
         "note (-sentient writing) cannot bear 'angry' (animate emotion modifier); 8 words max",
         ""),
        ("She wrote a sleeping note today.", "SVO-temporal",
         "animate-violation-2",
         "note (-animate) cannot be 'sleeping'; requires +animate head noun",
         ""),
    ],
}

CAND["uvlt_1k_t04_i01"] = {  # brother (1K noun, kin; foil=b)
    "app": [
        ("My brother studies math at university.", "SVO-PP",
         "study-frame",
         "kin sense forced by 'my' + 'studies math at university'",
         ""),
        ("Her brother drives a small truck.", "SVO",
         "drive-frame",
         "kin sense forced by possessive + 'drives a small truck'",
         ""),
    ],
    "inapp": [
        ("My brother studies math at triangles.", "SVO-PP",
         "prep-collocate",
         "'at triangles' as location PP for student non-collocate (at university/school/home/college standard)",
         ""),
        ("Her brother drives a hungry truck.", "SVO",
         "modifier-collocate",
         "'hungry truck' non-collocate; truck modifiers: small/big/new/old/red standard",
         ""),
    ],
}

CAND["uvlt_1k_t04_i02"] = {  # hour (1K noun, sixty minutes; foil=b)
    "app": [
        ("They walked for one whole hour.", "SV-PP",
         "duration-frame",
         "sixty-minutes sense forced by 'walked for one whole'",
         ""),
        ("The train arrived one hour late.", "SV-adv",
         "adjunct-frame",
         "sixty-minutes sense forced by 'train arrived one' + 'late'",
         ""),
    ],
    "inapp": [
        ("They walked for one sleepy hour.", "SV-PP",
         "modifier-collocate",
         "'sleepy hour' non-collocate for duration (whole/full/short/entire/extra hour standard)",
         ""),
        ("The train arrived one hungry hour late.", "SV-adv",
         "modifier-collocate-2",
         "'hungry hour' non-collocate for time unit; time units take quantitative/temporal modifiers",
         ""),
    ],
}

CAND["uvlt_1k_t04_i03"] = {  # plan (1K noun, way of doing things; foil=b)
    "app": [
        ("She wrote a clear plan yesterday.", "SVO-temporal",
         "write-frame",
         "way-of-doing-things sense forced by 'wrote' + 'clear'",
         ""),
        ("His plan was too complex today.", "SVC",
         "copula-frame",
         "plan-as-strategy sense forced by 'was too complex today'",
         ""),
    ],
    "inapp": [
        ("She wrote a sweet plan yesterday.", "SVO-temporal",
         "modifier-collocate",
         "'sweet plan' non-collocate for strategy (clear/detailed/simple/new/backup/main plan standard)",
         ""),
        ("His plan was too loud today.", "SVC",
         "copula-collocate",
         "'loud plan' via copula non-collocate; plan modifiers: clear/complex/simple/bold standard",
         ""),
    ],
}

CAND["uvlt_1k_t05_i01"] = {  # grass (1K noun, plants; foil=a)
    "app": [
        ("Sheep ate the fresh green grass.", "SVO",
         "eat-frame",
         "plant sense forced by 'sheep ate the fresh green'",
         ""),
        ("Children played on the wet grass.", "SV-PP",
         "PP-frame",
         "plant sense forced by 'played on the wet'",
         ""),
    ],
    "inapp": [
        ("Sheep ate the talking green grass.", "SVO",
         "animate-violation",
         "grass is -sentient plant; 'talking' requires +animate/+human modified noun",
         ""),
        ("Children played on the sleepy grass.", "SV-PP",
         "animate-violation-2",
         "grass is -sentient; 'sleepy' requires +animate head noun",
         ""),
    ],
}

CAND["uvlt_1k_t05_i02"] = {  # bath (1K noun, place to wash; foil=a)
    "app": [
        ("She ran a warm bubble bath.", "SVO",
         "bath-prep-frame",
         "place-to-wash sense forced by 'ran' + 'warm bubble'",
         ""),
        ("He enjoyed a long evening bath.", "SVO",
         "enjoy-frame",
         "place-to-wash sense forced by 'enjoyed' + 'long evening'",
         ""),
    ],
    "inapp": [
        ("She ran a talking bubble bath.", "SVO",
         "animate-violation",
         "bath is -animate; 'talking' requires +animate modified noun",
         ""),
        ("He enjoyed a hungry evening bath.", "SVO",
         "animate-violation-2",
         "bath (place/activity) is -sentient; 'hungry' requires +animate head noun",
         ""),
    ],
}

CAND["uvlt_1k_t05_i03"] = {  # shoulder (1K noun, arm top; foil=a)
    "app": [
        ("She touched his warm right shoulder.", "SVO",
         "touch-frame",
         "body-part sense forced by 'touched' + 'warm right'",
         ""),
        ("A bag hung from her shoulder.", "SV-PP",
         "PP-frame",
         "body-part sense forced by 'bag hung from'",
         ""),
    ],
    "inapp": [
        ("She touched his edible right shoulder.", "SVO",
         "edible-violation",
         "shoulder (-edible body part) conflicts with 'edible' which requires +food",
         ""),
        ("A bag hung from her happy shoulder.", "SV-PP",
         "animate-violation",
         "shoulder is -sentient body part; 'happy' requires +sentient modified noun",
         ""),
    ],
}

CAND["uvlt_1k_t06_i01"] = {  # prepare (1K verb, get ready; foil=b)
    "app": [
        ("Dad prepared dinner for the family.", "SVO-PP",
         "object-swap",
         "get-ready sense forced by +human subject 'Dad' + obj 'dinner'",
         ""),
        ("Students prepared answers for the exam.", "SVO-PP",
         "student-frame",
         "get-ready sense forced by 'students prepared answers for the exam'",
         ""),
    ],
    "inapp": [
        ("Dad prepared silence for the family.", "SVO-PP",
         "object-collocate",
         "'prepare silence' non-collocate; prepare meals/food/dinner/speech/report standard",
         ""),
        ("Students prepared thunder for the exam.", "SVO-PP",
         "object-collocate-2",
         "'prepare thunder' non-collocate; prepare for exam: answers/notes/questions standard",
         ""),
    ],
}

CAND["uvlt_1k_t06_i02"] = {  # laugh (1K verb, make happy sound; foil=b)
    "app": [
        ("The crowd laughed at the comedian.", "SV-PP",
         "subject-swap",
         "make-happy-sound sense forced by +human subject 'crowd' + 'at the comedian'",
         "subject swap could read as selectional; labeled b per draft."),
        ("We laughed during the funny movie.", "SV-PP",
         "during-frame",
         "make-happy-sound sense forced by +human subject 'we' + 'during the funny movie'",
         ""),
    ],
    "inapp": [
        ("The bricks laughed at the comedian.", "SV-PP",
         "subject-collocate",
         "+animate subject required; 'bricks' is -animate (non-collocate as subject of laugh)",
         ""),
        ("We laughed during the funny kitchen.", "SV-PP",
         "prep-collocate",
         "'during the funny kitchen' is non-collocate PP for laugh (during the show/movie/speech standard)",
         ""),
    ],
}

CAND["uvlt_1k_t06_i03"] = {  # forget (1K verb, not remember; foil=b)
    "app": [
        ("He forgot his friend's phone number.", "SVO",
         "possessive-object",
         "not-remember sense forced by 'his friend's phone number'",
         ""),
        ("I forgot to lock the door.", "SV-inf",
         "inf-frame",
         "not-remember sense forced by 'to lock the door'",
         ""),
    ],
    "inapp": [
        ("He forgot his friend's sleepy number.", "SVO",
         "modifier-collocate",
         "'sleepy number' modifier non-collocate for forget-object (phone/house/passport/birthday number standard)",
         ""),
        ("I forgot to lock the hungry door.", "SV-inf",
         "modifier-collocate-2",
         "'hungry door' non-collocate; door modifiers: front/back/old/wooden/locked standard",
         ""),
    ],
}

CAND["uvlt_1k_t07_i01"] = {  # work (1K verb, do for money; foil=b)
    "app": [
        ("Her mother worked at the hospital.", "SV-PP",
         "at-location",
         "do-for-money sense forced by 'mother worked at the hospital'",
         "minority-sense target preserved."),
        ("They worked for the local company.", "SV-PP",
         "for-frame",
         "do-for-money sense forced by 'worked for the local company'",
         ""),
    ],
    "inapp": [
        ("Her mother worked at the orange.", "SV-PP",
         "prep-collocate",
         "'worked at the orange' non-collocate; workplace nouns: hospital/bank/factory/office/shop standard",
         ""),
        ("They worked for the local triangle.", "SV-PP",
         "prep-collocate-2",
         "'worked for the triangle' non-collocate; work for + organization/company/person standard",
         ""),
    ],
}

CAND["uvlt_1k_t07_i02"] = {  # return (1K verb, go back; foil=b)
    "app": [
        ("The soldiers returned from the war.", "SV-PP",
         "from-frame",
         "go-back sense forced by +human subject + 'from the war'",
         "minority-sense: return an object. Foil works on go-back sense."),
        ("She returned to the empty office.", "SV-PP",
         "to-frame",
         "go-back sense forced by 'returned to the empty office'",
         ""),
    ],
    "inapp": [
        ("The soldiers returned from the thunder.", "SV-PP",
         "prep-collocate",
         "'returned from the thunder' non-collocate; return from + place/event standard (war/trip/journey/vacation)",
         ""),
        ("She returned to the empty breakfast.", "SV-PP",
         "prep-collocate-2",
         "'returned to the empty breakfast' non-collocate for go-back; return to + place/situation",
         ""),
    ],
}

CAND["uvlt_1k_t07_i03"] = {  # check (1K verb, make sure; foil=b)
    "app": [
        ("Please check the answers before leaving.", "SVO-PP",
         "answer-obj",
         "make-sure sense forced by 'check the answers' + 'before leaving'",
         "minority: check=inspect. Foil still non-collocate there."),
        ("She checked the time on her watch.", "SVO-PP",
         "time-obj",
         "make-sure sense forced by 'checked the time on her watch'",
         ""),
    ],
    "inapp": [
        ("Please check the whispers before leaving.", "SVO-PP",
         "object-collocate",
         "'check whispers' non-collocate; check answers/email/time/phone/mail standard",
         ""),
        ("She checked the smell on her watch.", "SVO-PP",
         "object-collocate-2",
         "'check the smell' non-collocate; check time/date/email/text standard",
         ""),
    ],
}

CAND["uvlt_1k_t08_i01"] = {  # reply (1K verb, answer; foil=b)
    "app": [
        ("She must reply to her friend.", "SV-PP",
         "to-person",
         "answer sense forced by modal + 'reply to her friend'; modal keeps target as base form",
         ""),
        ("He will reply with a letter.", "SV-PP",
         "with-frame",
         "answer sense forced by modal + 'reply with a letter'",
         ""),
    ],
    "inapp": [
        ("She must reply to her mountain.", "SV-PP",
         "prep-collocate",
         "'reply to mountain' non-collocate; reply to + message/letter/email/question/person standard",
         ""),
        ("He will reply with a tomato.", "SV-PP",
         "prep-collocate-2",
         "'reply with a tomato' non-collocate; reply with + letter/note/answer/call standard",
         ""),
    ],
}

CAND["uvlt_1k_t08_i02"] = {  # bring (1K verb, carry to; foil=b)
    "app": [
        ("She brought fresh bread to school.", "SVO-PP",
         "bread-obj",
         "carry-to-another-place sense forced by 'brought fresh bread to school'",
         ""),
        ("He brought his jacket to work.", "SVO-PP",
         "jacket-obj",
         "carry-to-another-place sense forced by 'brought his jacket to work'",
         ""),
    ],
    "inapp": [
        ("She brought fresh thunder to school.", "SVO-PP",
         "object-collocate",
         "'bring fresh thunder' non-collocate; bring food/bread/lunch/gifts/news standard",
         ""),
        ("He brought his hungry jacket to work.", "SVO-PP",
         "modifier-collocate",
         "'hungry jacket' non-collocate; jacket modifiers: old/new/heavy/wet/warm standard",
         ""),
    ],
}

CAND["uvlt_1k_t08_i03"] = {  # stare (1K verb, look at long; foil=b)
    "app": [
        ("The man stared at the painting.", "SV-PP",
         "at-painting",
         "look-at-long-time sense forced by +human subject + 'at the painting'",
         "subject swap could be a; labeled b per draft."),
        ("She stared into his dark eyes.", "SV-PP",
         "into-frame",
         "look-at-long-time sense forced by +human subject + 'into his dark eyes'",
         ""),
    ],
    "inapp": [
        ("The tomato stared at the painting.", "SV-PP",
         "subject-collocate",
         "stare subject +animate required; 'tomato' -animate is non-collocate",
         ""),
        ("She stared into his edible eyes.", "SV-PP",
         "modifier-collocate",
         "'edible eyes' non-collocate modifier for body-part; dark/bright/blue/green/tired eyes standard",
         ""),
    ],
}

CAND["uvlt_1k_t09_i01"] = {  # main (1K adj, most important; foil=b labeled a; keep b per draft row)
    "app": [
        ("The main reason was very simple.", "SVC",
         "reason-frame",
         "most-important sense forced by 'the main reason' + 'was simple'",
         ""),
        ("He found the main gate open.", "SVO",
         "gate-frame",
         "most-important sense forced by 'the main gate' + 'open'",
         ""),
    ],
    "inapp": [
        ("The main tomato was very simple.", "SVC",
         "modifier-collocate",
         "'main tomato' non-collocate (main reason/course/idea/point/problem/gate standard)",
         ""),
        ("He found the main rainbow open.", "SVO",
         "modifier-collocate-2",
         "'main rainbow' non-collocate; main + entity/feature/category head standard",
         ""),
    ],
}

CAND["uvlt_1k_t09_i02"] = {  # bad (1K adj, not good; foil=b per draft)
    "app": [
        ("It was a bad idea today.", "SVC",
         "idea-frame",
         "not-good sense forced by 'was a bad idea'",
         "minority: bad=naughty. Foil fails there too."),
        ("She had a bad day yesterday.", "SVO-temporal",
         "day-frame",
         "not-good sense forced by 'had a bad day'",
         ""),
    ],
    "inapp": [
        ("It was a bad elbow today.", "SVC",
         "modifier-collocate",
         "'bad elbow' in tested-sense frame non-collocate; bad idea/day/news/habit standard",
         ""),
        ("She had a bad rainbow yesterday.", "SVO-temporal",
         "modifier-collocate-2",
         "'bad rainbow' non-collocate; bad + event/state/quality head standard",
         ""),
    ],
}

CAND["uvlt_1k_t09_i03"] = {  # cold (1K adj, not hot; foil=a)
    "app": [
        ("The cold soup sat on the table.", "SV-PP",
         "soup-subject",
         "not-hot sense forced by +concrete 'soup' + 'on the table'",
         "metaphor risk: 'cold idea'. Use +concrete head."),
        ("He drank some very cold milk.", "SVO",
         "milk-obj",
         "not-hot sense forced by 'drank' + 'milk'",
         ""),
    ],
    "inapp": [
        ("The cold promise sat on the table.", "SV-PP",
         "concrete-violation",
         "cold (temperature) needs +concrete; 'promise' is -concrete abstract — violates tangibility",
         ""),
        ("He drank some very cold rainbow.", "SVO",
         "concrete-violation-2",
         "cold (temperature) drinkable needs +liquid/+concrete; 'rainbow' is -concrete",
         ""),
    ],
}

CAND["uvlt_1k_t10_i01"] = {  # definite (1K adj, certain; foil=b per draft)
    "app": [
        ("We need a definite answer today.", "SVO",
         "answer-frame",
         "certain sense forced by 'need a definite answer'",
         ""),
        ("There is a definite improvement now.", "SV-NP",
         "improvement-frame",
         "certain sense forced by 'a definite improvement'",
         ""),
    ],
    "inapp": [
        ("We need a definite rainbow today.", "SVO",
         "modifier-collocate",
         "'definite rainbow' non-collocate (definite answer/yes/no/plan/improvement standard)",
         ""),
        ("There is a definite tomato now.", "SV-NP",
         "modifier-collocate-2",
         "'definite tomato' non-collocate; definite + abstract decision-noun standard",
         ""),
    ],
}

CAND["uvlt_1k_t10_i02"] = {  # general (1K adj, usual; foil=b per draft)
    "app": [
        ("The general rule is very clear.", "SVC",
         "rule-frame",
         "usual sense forced by 'the general rule' + 'is clear'",
         "minority: military general. Foil fails there."),
        ("We had a general feeling of relief.", "SVO-PP",
         "feeling-frame",
         "usual sense forced by 'general feeling of relief'",
         ""),
    ],
    "inapp": [
        ("The general tomato is very clear.", "SVC",
         "modifier-collocate",
         "'general tomato' non-collocate (general rule/feeling/idea/public/opinion standard)",
         ""),
        ("We had a general rainbow of relief.", "SVO-PP",
         "modifier-collocate-2",
         "'general rainbow' non-collocate; general + abstract-noun head standard",
         ""),
    ],
}

CAND["uvlt_1k_t10_i03"] = {  # awful (1K adj, very bad; foil=a)
    "app": [
        ("The movie was really awful tonight.", "SVC",
         "movie-copula",
         "very-bad sense forced by +-entity 'movie' + 'was really' + temporal",
         "synesthesia rescue risk with tasted. Using +evaluable copula."),
        ("We had an awful time yesterday.", "SVO-temporal",
         "time-frame",
         "very-bad sense forced by 'had an awful time'",
         ""),
    ],
    "inapp": [
        ("The number was really awful tonight.", "SVC",
         "evaluable-violation",
         "awful (evaluative) needs +evaluable/+experiential head; 'number' (arithmetic) is -evaluable qualitatively",
         ""),
        ("We had an awful triangle yesterday.", "SVO-temporal",
         "evaluable-violation-2",
         "awful needs +experiential head; 'triangle' geometric is -evaluable",
         ""),
    ],
}

# ----------------------------------------------------------------------------
# 2K band (t01-t10 x i01-i03)
# ----------------------------------------------------------------------------

CAND["uvlt_2k_t01_i01"] = {  # feature (2K noun, important part; foil=a)
    "app": [
        ("Each car has special safety features.", "SVO",
         "car-obj",
         "important-part sense forced by 'car' + 'safety' + countable plural",
         "minority: face feature. Foil fails there."),
        ("The software has many useful features.", "SVO",
         "software-obj",
         "important-part sense forced by 'software' + 'many useful'",
         ""),
    ],
    "inapp": [
        ("Each car has sleepy safety features.", "SVO",
         "animate-violation",
         "feature (-animate attribute) + 'sleepy' requires +animate modified noun",
         ""),
        ("The software has many talking features.", "SVO",
         "animate-violation-2",
         "feature (-animate) + 'talking' requires +animate head noun",
         ""),
    ],
}

CAND["uvlt_2k_t01_i02"] = {  # coach (2K noun, trainer; foil=a)
    "app": [
        ("Our coach trained the young players.", "SVO",
         "train-verb",
         "trainer sense forced by +our + 'trained' + 'young players'",
         ""),
        ("The soccer coach gave clear instructions.", "SVO",
         "soccer-instr",
         "trainer sense forced by 'soccer coach' + 'gave clear instructions'",
         ""),
    ],
    "inapp": [
        ("Our coach melted the young players.", "SVO",
         "substance-violation",
         "coach (+human) + 'melted' (+substance process) violates agent selection; +human cannot melt an object in this sense",
         ""),
        ("The soccer coach rusted clear instructions.", "SVO",
         "material-violation",
         "coach (+human agent) + 'rusted' (material oxidation) violates agent-action compatibility",
         ""),
    ],
}

CAND["uvlt_2k_t01_i03"] = {  # weed (2K noun, unwanted plant; foil=a)
    "app": [
        ("Farmers removed the tall dry weeds.", "SVO",
         "remove-verb",
         "unwanted-plant sense forced by 'farmers' + 'tall dry'",
         ""),
        ("Tall weeds covered the small field.", "SVO",
         "subject-frame",
         "unwanted-plant sense forced by 'tall' + 'covered the field'",
         ""),
    ],
    "inapp": [
        ("Farmers removed the laughing dry weeds.", "SVO",
         "animate-violation",
         "weed (-sentient plant) + 'laughing' requires +sentient/+animate",
         ""),
        ("Sleepy weeds covered the small field.", "SVO",
         "animate-violation-2",
         "weed (plant) is -sentient; 'sleepy' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_2k_t02_i01"] = {  # vegetable (2K noun, food from garden; foil=b)
    "app": [
        ("She bought some fresh green vegetables.", "SVO",
         "buy-frame",
         "food-from-garden sense forced by 'bought' + 'fresh green'",
         ""),
        ("Children must eat their daily vegetables.", "SVO",
         "eat-frame",
         "food-from-garden sense forced by 'children must eat their daily'",
         ""),
    ],
    "inapp": [
        ("She bought some fresh musical vegetables.", "SVO",
         "modifier-collocate",
         "'musical vegetables' non-collocate (fresh/green/cooked/frozen/organic standard)",
         ""),
        ("Children must eat their sleepy vegetables.", "SVO",
         "modifier-collocate-2",
         "'sleepy vegetables' non-collocate; vegetable modifiers: fresh/raw/green/steamed/roasted standard",
         ""),
    ],
}

CAND["uvlt_2k_t02_i02"] = {  # knowledge (2K noun, info; foil=b)
    "app": [
        ("Her knowledge of math is broad.", "N-subj_copula_AdjP",
         "math-domain",
         "information sense forced by 'of math' + 'broad'",
         ""),
        ("He shared useful knowledge with us.", "SVO-PP",
         "share-frame",
         "information sense forced by 'shared' + 'useful' + 'with us'",
         ""),
    ],
    "inapp": [
        ("Her knowledge of math is crunchy.", "N-subj_copula_AdjP",
         "modifier-collocate",
         "'crunchy knowledge' non-collocate; knowledge modifiers: deep/broad/basic/limited/general standard",
         ""),
        ("He shared crunchy knowledge with us.", "SVO-PP",
         "modifier-collocate-2",
         "'crunchy knowledge' non-collocate; share + deep/broad/useful knowledge standard",
         ""),
    ],
}

CAND["uvlt_2k_t02_i03"] = {  # average (2K noun, middle number; foil=b)
    "app": [
        ("The class average improved this week.", "SVO",
         "class-frame",
         "middle-number sense forced by 'the class' + 'improved this week'",
         ""),
        ("His test average reached eighty points.", "SVO",
         "test-frame",
         "middle-number sense forced by 'test' + 'reached eighty points'",
         ""),
    ],
    "inapp": [
        ("The class average eats this week.", "SVO",
         "animate-violation",
         "average (-animate number) + 'eats' (+animate) violates animacy",
         ""),
        ("His test average laughed eighty points.", "SVO",
         "animate-violation-2",
         "average (-animate) + 'laughed' requires +animate subject",
         ""),
    ],
}

CAND["uvlt_2k_t03_i01"] = {  # circle (2K noun, round shape; foil=a)
    "app": [
        ("She drew a small red circle.", "SVO",
         "draw-frame",
         "round-shape sense forced by 'drew' + 'small red'",
         ""),
        ("The circle on paper was perfect.", "SV-PP-copula",
         "copula-frame",
         "round-shape sense forced by 'on paper' + 'was perfect'",
         ""),
    ],
    "inapp": [
        ("She drew a talking red circle.", "SVO",
         "animate-violation",
         "circle (geometric) is -animate; 'talking' requires +animate modified noun",
         ""),
        ("The circle on paper was asleep.", "SV-PP-copula",
         "animate-violation-2",
         "circle (-animate shape) cannot 'be asleep'; 'asleep' requires +animate subject",
         ""),
    ],
}

CAND["uvlt_2k_t03_i02"] = {  # knife (2K noun, cutting tool; foil=a)
    "app": [
        ("She sharpened the kitchen knife carefully.", "SVO-adv",
         "sharpen-frame",
         "cutting-tool sense forced by 'sharpened' + 'kitchen' + 'carefully'",
         ""),
        ("A sharp knife lay on the table.", "SV-PP",
         "lay-frame",
         "cutting-tool sense forced by 'sharp' + 'lay on the table'",
         ""),
    ],
    "inapp": [
        ("She sharpened the sleepy knife carefully.", "SVO-adv",
         "animate-violation",
         "knife (-animate tool) + 'sleepy' requires +animate modified noun",
         ""),
        ("A laughing knife lay on the table.", "SV-PP",
         "animate-violation-2",
         "knife is -sentient; 'laughing' requires +sentient/+animate",
         ""),
    ],
}

CAND["uvlt_2k_t03_i03"] = {  # justice (2K noun, using laws fairly; foil=a)
    "app": [
        ("She fought for justice every day.", "SV-PP-temporal",
         "fight-frame",
         "using-laws-fairly sense forced by 'fought for' + 'every day'",
         "synesthesia risk 'taste justice' — avoiding sensory verbs."),
        ("People demand justice after the trial.", "SVO-PP",
         "demand-frame",
         "using-laws-fairly sense forced by 'people demand' + 'after the trial'",
         ""),
    ],
    "inapp": [
        ("She fought for edible justice every day.", "SV-PP-temporal",
         "substance-violation",
         "justice (abstract) is -substance; 'edible' requires +food/+substance",
         ""),
        ("People demand sleeping justice after the trial.", "SVO-PP",
         "animate-violation",
         "justice (abstract) is -animate; 'sleeping' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_2k_t04_i01"] = {  # section (2K noun, part; foil=b)
    "app": [
        ("She read the first section carefully.", "SVO-adv",
         "read-frame",
         "part sense forced by 'read' + 'first' + 'carefully'",
         ""),
        ("They moved to the next section.", "SV-PP",
         "move-frame",
         "part sense forced by 'moved to the next'",
         ""),
    ],
    "inapp": [
        ("She read the sleepy first section carefully.", "SVO-adv",
         "modifier-collocate",
         "'sleepy section' non-collocate; section modifiers: first/last/main/next/whole standard",
         ""),
        ("They moved to the hungry section.", "SV-PP",
         "modifier-collocate-2",
         "'hungry section' non-collocate; section modifiers are ordinal/positional",
         ""),
    ],
}

CAND["uvlt_2k_t04_i02"] = {  # site (2K noun, place; foil=b)
    "app": [
        ("The workers left the construction site.", "SVO",
         "leave-frame",
         "place sense forced by 'workers' + 'construction' + 'left'",
         ""),
        ("Engineers inspected the new site today.", "SVO-temporal",
         "inspect-frame",
         "place sense forced by 'engineers inspected' + 'new' + 'today'",
         ""),
    ],
    "inapp": [
        ("The workers left the sleepy construction site.", "SVO",
         "modifier-collocate",
         "'sleepy site' non-collocate; site modifiers: construction/work/building/main standard",
         ""),
        ("Engineers inspected the hungry site today.", "SVO-temporal",
         "modifier-collocate-2",
         "'hungry site' non-collocate; site + function-modifier standard",
         ""),
    ],
}

CAND["uvlt_2k_t04_i03"] = {  # sheet (2K noun, bed cover; foil=b)
    "app": [
        ("She changed the white bed sheet.", "SVO",
         "change-frame",
         "bed-cover sense forced by 'changed' + 'white bed'",
         "minority: sheet of paper. Foil fails there."),
        ("He folded the large cotton sheet.", "SVO",
         "fold-frame",
         "bed-cover sense forced by 'folded' + 'large cotton'",
         ""),
    ],
    "inapp": [
        ("She changed the sleepy white sheet.", "SVO",
         "modifier-collocate",
         "'sleepy sheet' non-collocate; sheet modifiers: clean/white/fresh/cotton/flat standard",
         ""),
        ("He folded the hungry cotton sheet.", "SVO",
         "modifier-collocate-2",
         "'hungry sheet' non-collocate; sheet + texture/color modifier standard",
         ""),
    ],
}

CAND["uvlt_2k_t05_i01"] = {  # envelope (2K noun, cover for letters; foil=a)
    "app": [
        ("She opened the white paper envelope.", "SVO",
         "open-frame",
         "letter-cover sense forced by 'opened' + 'white paper'",
         ""),
        ("A thick envelope arrived in the mail.", "SV-PP",
         "arrive-frame",
         "letter-cover sense forced by 'thick' + 'arrived in the mail'",
         ""),
    ],
    "inapp": [
        ("She opened the laughing white envelope.", "SVO",
         "animate-violation",
         "envelope (-animate) + 'laughing' requires +animate modified noun",
         ""),
        ("A hungry envelope arrived in the mail.", "SV-PP",
         "animate-violation-2",
         "envelope (-animate) + 'hungry' requires +animate head noun",
         ""),
    ],
}

CAND["uvlt_2k_t05_i02"] = {  # cap (2K noun, hat; foil=a)
    "app": [
        ("She wore a red baseball cap.", "SVO",
         "baseball-frame",
         "hat sense forced by 'wore' + 'red baseball'",
         ""),
        ("The cap on his head fell.", "SV-PP",
         "fall-frame",
         "hat sense forced by 'on his head' + 'fell'",
         ""),
    ],
    "inapp": [
        ("She wore a talking red cap.", "SVO",
         "animate-violation",
         "cap (-animate hat) + 'talking' requires +animate modified noun",
         ""),
        ("The hungry cap on his head fell.", "SV-PP",
         "animate-violation-2",
         "cap is -animate; 'hungry' requires +animate subject",
         ""),
    ],
}

CAND["uvlt_2k_t05_i03"] = {  # apartment (2K noun, place to live; foil=a)
    "app": [
        ("They cleaned the small kitchen apartment.", "SVO",
         "clean-frame",
         "place-to-live sense forced by 'cleaned' + 'small kitchen'",
         ""),
        ("My apartment is near the station.", "SVC-PP",
         "copula-frame",
         "place-to-live sense forced by 'my' + 'near the station'",
         ""),
    ],
    "inapp": [
        ("They cleaned the talking small apartment.", "SVO",
         "animate-violation",
         "apartment (-animate) + 'talking' requires +animate modified noun",
         ""),
        ("My apartment is asleep near the station.", "SVC-PP",
         "animate-violation-2",
         "apartment (-animate) + 'asleep' requires +animate subject",
         ""),
    ],
}

CAND["uvlt_2k_t06_i01"] = {  # wrap (2K verb, cover tightly; foil=b)
    "app": [
        ("He wrapped his arm with bandage.", "SVO-PP",
         "arm-obj",
         "cover-tightly sense forced by +human subject + 'arm' + 'with bandage'",
         ""),
        ("She wrapped the sandwich in foil.", "SVO-PP",
         "sandwich-obj",
         "cover-tightly sense forced by 'wrapped' + 'sandwich in foil'",
         ""),
    ],
    "inapp": [
        ("He wrapped his silence with bandage.", "SVO-PP",
         "object-collocate",
         "'wrap silence' non-collocate; wrap + physical/tangible object standard (arm/gift/box/sandwich)",
         ""),
        ("She wrapped the thunder in foil.", "SVO-PP",
         "object-collocate-2",
         "'wrap thunder' non-collocate; wrap + gift/package/sandwich/food standard",
         ""),
    ],
}

CAND["uvlt_2k_t06_i02"] = {  # contribute (2K verb, give to; foil=b)
    "app": [
        ("He contributed his time to teaching.", "SVO-PP",
         "time-obj",
         "give-to sense forced by 'contributed his time to teaching'",
         ""),
        ("They contributed ideas at the meeting.", "SVO-PP",
         "ideas-obj",
         "give-to sense forced by 'contributed ideas at the meeting'",
         ""),
    ],
    "inapp": [
        ("He contributed his thunder to teaching.", "SVO-PP",
         "object-collocate",
         "'contribute thunder' non-collocate; contribute time/money/effort/ideas/support standard",
         ""),
        ("They contributed whispers at the meeting.", "SVO-PP",
         "object-collocate-2",
         "'contribute whispers' non-collocate; contribute ideas/suggestions/money/effort standard",
         ""),
    ],
}

CAND["uvlt_2k_t06_i03"] = {  # seek (2K verb, look for; foil=b)
    "app": [
        ("They sought justice after the trial.", "SVO-PP",
         "justice-obj",
         "look-for sense forced by 'sought justice after the trial'",
         ""),
        ("She sought help from her teacher.", "SVO-PP",
         "help-obj",
         "look-for sense forced by 'sought help from her teacher'",
         ""),
    ],
    "inapp": [
        ("They sought thunder after the trial.", "SVO-PP",
         "object-collocate",
         "'seek thunder' non-collocate; seek justice/advice/help/approval/support standard",
         ""),
        ("She sought rainbow from her teacher.", "SVO-PP",
         "object-collocate-2",
         "'seek rainbow' non-collocate; seek + +desirable-abstract standard (advice/help/permission)",
         ""),
    ],
}

CAND["uvlt_2k_t07_i01"] = {  # contain (2K verb, have inside; foil=b)
    "app": [
        ("The drawer contained several old coins.", "SVO",
         "drawer-subj",
         "have-inside sense forced by +container 'drawer' + +physical obj 'coins'",
         ""),
        ("That jar contains dry red beans.", "SVO",
         "jar-subj",
         "have-inside sense forced by +container 'jar' + 'dry red beans'",
         ""),
    ],
    "inapp": [
        ("The drawer contained several old songs.", "SVO",
         "object-collocate",
         "contain (+physical container) + 'songs' (-physical) non-collocate direct obj; contain + physical items standard",
         ""),
        ("That jar contains dry red whispers.", "SVO",
         "object-collocate-2",
         "'contain whispers' non-collocate; jar contains + liquid/solid tangible items",
         ""),
    ],
}

CAND["uvlt_2k_t07_i02"] = {  # search (2K verb, look for; foil=b)
    "app": [
        ("Police searched the forest for clues.", "SVO-PP",
         "police-subj",
         "look-for sense forced by 'police searched' + 'forest for clues'",
         ""),
        ("He searched his bag for keys.", "SVO-PP",
         "bag-obj",
         "look-for sense forced by 'searched his bag for keys'",
         ""),
    ],
    "inapp": [
        ("Police searched the forest for whispers.", "SVO-PP",
         "prep-collocate",
         "'search forest for whispers' non-collocate; search for clues/evidence/missing standard",
         ""),
        ("He searched his bag for thunder.", "SVO-PP",
         "prep-collocate-2",
         "'search bag for thunder' non-collocate; search for + tangible/findable item standard",
         ""),
    ],
}

CAND["uvlt_2k_t07_i03"] = {  # avoid (2K verb, try not to do; foil=b)
    "app": [
        ("She avoided the rude customer today.", "SVO-temporal",
         "customer-obj",
         "try-not-to-do sense forced by 'avoided' + 'rude customer today'",
         ""),
        ("He avoided eye contact with her.", "SVO-PP",
         "eye-contact",
         "try-not-to-do sense forced by 'avoided eye contact with her'",
         ""),
    ],
    "inapp": [
        ("She avoided the rude thunder today.", "SVO-temporal",
         "object-collocate",
         "'avoid thunder' non-collocate as person/action obj; avoid traffic/conflict/problems/mistakes standard",
         ""),
        ("He avoided triangle contact with her.", "SVO-PP",
         "modifier-collocate",
         "'triangle contact' non-collocate; avoid eye/physical/body/direct contact standard",
         ""),
    ],
}

CAND["uvlt_2k_t08_i01"] = {  # receive (2K verb, get; foil=b)
    "app": [
        ("He received a kind email today.", "SVO-temporal",
         "email-obj",
         "get-something sense forced by 'received' + 'kind email today'",
         ""),
        ("She received many flowers at work.", "SVO-PP",
         "flowers-obj",
         "get-something sense forced by 'received' + 'many flowers at work'",
         ""),
    ],
    "inapp": [
        ("He received a kind thunder today.", "SVO-temporal",
         "object-collocate",
         "'receive thunder' non-collocate; receive gift/letter/email/call/message/award standard",
         ""),
        ("She received many rainbows at work.", "SVO-PP",
         "object-collocate-2",
         "'receive rainbows' non-collocate; receive + tangible/transferable items standard",
         ""),
    ],
}

CAND["uvlt_2k_t08_i02"] = {  # bump (2K verb, hit gently; foil=b)
    "app": [
        ("She bumped her head against wood.", "SVO-PP",
         "head-obj",
         "hit-gently sense forced by 'bumped her head against wood'",
         ""),
        ("He bumped his elbow on ice.", "SVO-PP",
         "elbow-obj",
         "hit-gently sense forced by 'bumped his elbow on ice'",
         ""),
    ],
    "inapp": [
        ("She bumped her silence against wood.", "SVO-PP",
         "object-collocate",
         "'bump silence' non-collocate; bump body part (head/elbow/knee/shoulder/into-something) standard",
         ""),
        ("He bumped his rainbow on ice.", "SVO-PP",
         "object-collocate-2",
         "'bump rainbow' non-collocate; bump + body part against surface standard",
         ""),
    ],
}

CAND["uvlt_2k_t08_i03"] = {  # include (2K verb, have as part; foil=b)
    "app": [
        ("The menu includes several hot dishes.", "SVO",
         "menu-subj",
         "have-as-part sense forced by 'menu includes' + 'several hot dishes'",
         ""),
        ("Our plan includes safety and rest.", "SVO",
         "plan-subj",
         "have-as-part sense forced by 'our plan includes safety and rest'",
         ""),
    ],
    "inapp": [
        ("The menu includes several hot whispers.", "SVO",
         "object-collocate",
         "'menu includes whispers' non-collocate; menu includes dishes/items/drinks/options standard",
         ""),
        ("Our plan includes thunder and rest.", "SVO",
         "object-collocate-2",
         "'plan includes thunder' non-collocate; include tax/fees/meals/stages/components standard",
         ""),
    ],
}

CAND["uvlt_2k_t09_i01"] = {  # proud (2K adj; foil=a)
    "app": [
        ("He was proud of his team.", "SVC-PP",
         "team-frame",
         "feeling-good sense forced by '+human' + 'of his team'",
         ""),
        ("She felt proud of her project.", "SV-PP",
         "felt-frame",
         "feeling-good sense forced by +human subj + 'project'",
         ""),
    ],
    "inapp": [
        ("He was proud of his pencil.", "SVC-PP",
         "worthwhile-violation",
         "proud of + +achievement/+worthwhile required; 'pencil' is -worthwhile/ordinary",
         ""),
        ("She felt proud of her rainbow.", "SV-PP",
         "worthwhile-violation-2",
         "proud of + 'rainbow' (natural phenomenon, not personal achievement) violates +personal-achievement selection",
         ""),
    ],
}

CAND["uvlt_2k_t09_i02"] = {  # super (2K adj, great; foil=b per draft)
    "app": [
        ("That was a super fun party.", "SVC",
         "party-copula",
         "great sense forced by 'super fun party'",
         "fragile target; minority-sense (superior)."),
        ("He did a super good job.", "SVO",
         "job-frame",
         "great sense forced by 'super good job'",
         ""),
    ],
    "inapp": [
        ("That was a super fun rainbow.", "SVC",
         "modifier-collocate",
         "'super fun rainbow' non-collocate; super + evaluable-experience head (day/party/idea/movie) standard",
         ""),
        ("He did a super good tomato.", "SVO",
         "modifier-collocate-2",
         "'super good tomato' non-collocate in evaluative sense; super + achievement/event/quality standard",
         ""),
    ],
}

CAND["uvlt_2k_t09_i03"] = {  # constant (2K adj, all the time; foil=b per draft)
    "app": [
        ("The constant noise annoyed many people.", "SVO",
         "noise-frame",
         "happening-all-the-time sense forced by 'constant noise annoyed'",
         "polysemy: constant=loyal. Using noise-frame."),
        ("She lived with constant back pain.", "SV-PP",
         "pain-frame",
         "happening-all-the-time sense forced by 'constant back pain'",
         ""),
    ],
    "inapp": [
        ("The constant rainbow annoyed many people.", "SVO",
         "modifier-collocate",
         "'constant rainbow' non-collocate; constant + noise/pain/pressure/reminder/fear standard",
         ""),
        ("She lived with constant back tomato.", "SV-PP",
         "modifier-collocate-2",
         "'constant back tomato' non-collocate; constant + ongoing-phenomenon head standard",
         ""),
    ],
}

CAND["uvlt_2k_t10_i01"] = {  # rotten (2K adj, bad; foil=a)
    "app": [
        ("She smelled the rotten green onion.", "SVO",
         "onion-frame",
         "bad sense forced by +organic 'green onion' + 'smelled'",
         ""),
        ("The rotten meat made him sick.", "SVO",
         "meat-frame",
         "bad sense forced by +organic 'meat' + 'made him sick'",
         ""),
    ],
    "inapp": [
        ("She smelled the rotten green opinion.", "SVO",
         "substance-violation",
         "rotten requires +organic/+substance; 'opinion' is -substance abstract",
         ""),
        ("The rotten number made him sick.", "SVO",
         "substance-violation-2",
         "rotten requires +organic; 'number' is -organic abstract",
         ""),
    ],
}

CAND["uvlt_2k_t10_i02"] = {  # smooth (2K adj, not rough; foil=a)
    "app": [
        ("He touched the smooth glass carefully.", "SVO-adv",
         "touch-frame",
         "not-rough sense forced by +tangible 'glass' + 'touched'",
         ""),
        ("The smooth stone lay on sand.", "SV-PP",
         "stone-frame",
         "not-rough sense forced by +tangible 'stone' + 'on sand'",
         ""),
    ],
    "inapp": [
        ("He touched the smooth idea carefully.", "SVO-adv",
         "concrete-violation",
         "smooth (tactile) requires +concrete/+tangible; 'idea' is -tangible",
         ""),
        ("The smooth promise lay on sand.", "SV-PP",
         "concrete-violation-2",
         "smooth (tactile) requires +tangible; 'promise' is abstract -tangible",
         ""),
    ],
}

CAND["uvlt_2k_t10_i03"] = {  # junior (2K adj, younger; foil=a)
    "app": [
        ("The junior worker finished early today.", "SVO-adv",
         "worker-frame",
         "younger-in-position sense forced by 'junior worker' + 'finished early'",
         ""),
        ("She hired a junior sales assistant.", "SVO",
         "sales-frame",
         "younger-in-position sense forced by 'hired a junior sales assistant'",
         ""),
    ],
    "inapp": [
        ("The junior mountain finished early today.", "SVO-adv",
         "hierarchical-violation",
         "junior requires +human/+hierarchical; 'mountain' is -hierarchical natural feature",
         ""),
        ("She hired a junior sunset assistant.", "SVO",
         "hierarchical-violation-2",
         "junior requires +human-role; 'sunset' is -human",
         ""),
    ],
}

# ----------------------------------------------------------------------------
# 3K band
# ----------------------------------------------------------------------------

CAND["uvlt_3k_t01_i01"] = {  # behavior (3K noun, actions; foil=a)
    "app": [
        ("Her behavior improved after the talk.", "SV-PP",
         "improve-frame",
         "actions sense forced by 'behavior improved after the talk'",
         "synesthesia rescue risk. Using +process verbs."),
        ("We noticed his strange behavior today.", "SVO-temporal",
         "notice-frame",
         "actions sense forced by 'noticed his strange behavior today'",
         ""),
    ],
    "inapp": [
        ("Her behavior laughed after the talk.", "SV-PP",
         "animate-violation",
         "behavior (abstract -sentient) + 'laughed' requires +sentient subject",
         ""),
        ("We noticed his edible strange behavior today.", "SVO-temporal",
         "substance-violation",
         "behavior is -substance; 'edible' requires +food/+substance modified noun",
         ""),
    ],
}

CAND["uvlt_3k_t01_i02"] = {  # celebration (3K noun, happy occasion; foil=a)
    "app": [
        ("The whole village joined the celebration.", "SVO",
         "village-frame",
         "happy-occasion sense forced by 'whole village' + 'joined the'",
         ""),
        ("Our celebration ended at midnight tonight.", "SV-PP-temporal",
         "end-frame",
         "happy-occasion sense forced by 'our celebration ended at midnight tonight'",
         ""),
    ],
    "inapp": [
        ("The whole village joined the edible celebration.", "SVO",
         "substance-violation",
         "celebration (+event -substance) + 'edible' requires +food/+substance modified noun",
         ""),
        ("Our celebration melted at midnight tonight.", "SV-PP-temporal",
         "substance-violation-2",
         "celebration (+event -substance) + 'melted' requires +substance subject",
         ""),
    ],
}

CAND["uvlt_3k_t01_i03"] = {  # apology (3K noun, saying sorry; foil=a)
    "app": [
        ("Her apology seemed completely honest today.", "SV-AdjP-temporal",
         "seem-frame",
         "saying-sorry sense forced by 'seemed completely honest today'",
         ""),
        ("They accepted his formal written apology.", "SVO",
         "accept-frame",
         "saying-sorry sense forced by 'accepted his formal written'",
         ""),
    ],
    "inapp": [
        ("Her apology melted completely honest today.", "SV-AdjP-temporal",
         "substance-violation",
         "apology (+verbal_act -substance) + 'melted' requires +substance subject",
         ""),
        ("They accepted his edible written apology.", "SVO",
         "edible-violation",
         "apology (verbal act) is -edible; 'edible' requires +food modified noun",
         ""),
    ],
}

CAND["uvlt_3k_t02_i01"] = {  # phrase (3K noun, combination of words; foil=b)
    "app": [
        ("She memorized a common English phrase.", "SVO",
         "memorize-frame",
         "combination-of-words sense forced by 'memorized' + 'common English'",
         ""),
        ("He wrote the key phrase on paper.", "SVO-PP",
         "write-frame",
         "combination-of-words sense forced by 'wrote' + 'key phrase on paper'",
         ""),
    ],
    "inapp": [
        ("She memorized a sleepy English phrase.", "SVO",
         "modifier-collocate",
         "'sleepy phrase' non-collocate; phrase modifiers: useful/common/new/key/famous/standard",
         ""),
        ("He wrote the edible phrase on paper.", "SVO-PP",
         "modifier-collocate-2",
         "'edible phrase' non-collocate; phrase + linguistic/semantic modifier standard",
         ""),
    ],
}

CAND["uvlt_3k_t02_i03"] = {  # wealth (3K noun, money; foil=b)
    "app": [
        ("His family wealth supports many children.", "SVO",
         "support-frame",
         "much-money sense forced by 'family wealth supports' + 'many children'",
         "reduces to a risk. Using support-verb."),
        ("Their wealth came from hard work.", "SV-PP",
         "come-from-frame",
         "much-money sense forced by 'their wealth came from hard work'",
         ""),
    ],
    "inapp": [
        ("His family wealth sings many children.", "SVO",
         "verb-collocate",
         "'wealth sings' non-collocate (wealth grew/increased/doubled/vanished/supports standard)",
         ""),
        ("Their wealth came from hard laughter.", "SV-PP",
         "prep-collocate",
         "'wealth came from laughter' non-collocate; wealth from + work/family/business/investment standard",
         ""),
    ],
}

CAND["uvlt_3k_t03_i01"] = {  # agriculture (3K noun, farming; foil=a)
    "app": [
        ("Japanese agriculture depends on the weather.", "SV-PP",
         "depend-frame",
         "farming sense forced by 'Japanese agriculture depends on the weather'",
         ""),
        ("Students studied modern agriculture last year.", "SVO-temporal",
         "study-frame",
         "farming sense forced by 'studied modern agriculture last year'",
         ""),
    ],
    "inapp": [
        ("Japanese agriculture laughed on the weather.", "SV-PP",
         "animate-violation",
         "agriculture (-animate abstract) + 'laughed' requires +animate subject",
         ""),
        ("Students studied edible modern agriculture last year.", "SVO-temporal",
         "substance-violation",
         "agriculture (abstract sector) is -substance; 'edible' requires +food modified noun",
         ""),
    ],
}

CAND["uvlt_3k_t03_i02"] = {  # regime (3K noun, government; foil=a)
    "app": [
        ("The new regime changed the laws.", "SVO",
         "change-frame",
         "government sense forced by 'new regime changed the laws'",
         "metonymy rescue risk (regime=rulers). Foil using material predicate."),
        ("The regime lasted for many years.", "SV-PP",
         "last-frame",
         "government sense forced by 'regime lasted for many years'",
         ""),
    ],
    "inapp": [
        ("The new regime melted the laws.", "SVO",
         "substance-violation",
         "regime (abstract -substance) + 'melted' requires +substance subject",
         ""),
        ("The regime rusted for many years.", "SV-PP",
         "material-violation",
         "regime (-metal abstract) + 'rusted' requires +metal subject",
         ""),
    ],
}

CAND["uvlt_3k_t03_i03"] = {  # volunteer (3K noun, unpaid helper; foil=a)
    "app": [
        ("Every volunteer worked quickly this week.", "SV-adv-temporal",
         "worked-frame",
         "person-helping-without-payment sense forced by +human subj + 'worked quickly this week'",
         ""),
        ("The volunteer gave food to people.", "SVO-PP",
         "give-frame",
         "person-helping-without-payment sense forced by 'volunteer gave food to people'",
         ""),
    ],
    "inapp": [
        ("Every volunteer melted quickly this week.", "SV-adv-temporal",
         "substance-violation",
         "volunteer (+human) + 'melted' (+substance process) violates +human subject selection",
         ""),
        ("The volunteer boiled food to people.", "SVO-PP",
         "verb-collocate",
         "volunteer (+human) + 'boiled...to people' non-collocate frame; give/serve/distribute food to people standard",
         ""),
    ],
}

CAND["uvlt_3k_t04_i01"] = {  # poverty (3K noun, little money; foil=b per draft)
    "app": [
        ("Rural poverty affects many small towns.", "SVO",
         "affect-frame",
         "little-money sense forced by 'rural poverty affects many small towns'",
         "bleeds to a; using +abstract verb collocates."),
        ("Deep poverty hurts these poor families.", "SVO",
         "hurt-frame",
         "little-money sense forced by 'deep poverty hurts these poor families'",
         ""),
    ],
    "inapp": [
        ("Rural poverty sings many small towns.", "SVO",
         "verb-collocate",
         "'poverty sings' non-collocate (poverty affects/hurts/traps/grips/causes/impacts standard)",
         ""),
        ("Deep poverty dances these poor families.", "SVO",
         "verb-collocate-2",
         "'poverty dances' non-collocate; poverty + +abstract-effect verb standard",
         ""),
    ],
}

CAND["uvlt_3k_t04_i02"] = {  # heritage (3K noun, history; foil=b)
    "app": [
        ("They preserved their cultural heritage carefully.", "SVO-adv",
         "preserve-frame",
         "history sense forced by 'preserved their cultural' + adverb",
         ""),
        ("Rich heritage connects many different families.", "SVO",
         "connect-frame",
         "history sense forced by 'rich heritage connects many different families'",
         ""),
    ],
    "inapp": [
        ("They preserved their hungry heritage carefully.", "SVO-adv",
         "modifier-collocate",
         "'hungry heritage' non-collocate; heritage modifiers: cultural/national/rich/shared/ancient standard",
         ""),
        ("Sleepy heritage connects many different families.", "SVO",
         "modifier-collocate-2",
         "'sleepy heritage' non-collocate; heritage + cultural/historical modifier standard",
         ""),
    ],
}

CAND["uvlt_3k_t04_i03"] = {  # asset (3K noun, useful thing; foil=b)
    "app": [
        ("Her experience is a real asset.", "SVC",
         "real-frame",
         "useful-thing sense forced by 'experience is a real asset'",
         ""),
        ("The company values its major assets.", "SVO",
         "value-frame",
         "useful-thing sense forced by 'company values its major assets'",
         ""),
    ],
    "inapp": [
        ("Her experience is a sleepy asset.", "SVC",
         "modifier-collocate",
         "'sleepy asset' non-collocate; asset modifiers: great/valuable/real/huge/major standard",
         ""),
        ("The company values its singing assets.", "SVO",
         "modifier-collocate-2",
         "'singing asset' non-collocate; asset + value/size/kind modifier standard",
         ""),
    ],
}

CAND["uvlt_3k_t05_i01"] = {  # intelligence (3K noun, ability to learn; foil=a)
    "app": [
        ("His intelligence impressed every single teacher.", "SVO",
         "impress-frame",
         "ability-to-learn sense forced by 'intelligence impressed every single teacher'",
         ""),
        ("Her intelligence helped many young students.", "SVO",
         "help-frame",
         "ability-to-learn sense forced by 'intelligence helped many young students'",
         ""),
    ],
    "inapp": [
        ("His intelligence chewed every single teacher.", "SVO",
         "animate-violation",
         "intelligence (-animate abstract) + 'chewed' (+animate action) violates agent selection",
         ""),
        ("Her intelligence melted many young students.", "SVO",
         "substance-violation",
         "intelligence (-substance abstract) + 'melted' requires +substance subject",
         ""),
    ],
}

CAND["uvlt_3k_t05_i02"] = {  # pit (3K noun, deep place; foil=a)
    "app": [
        ("Workers covered the deep round pit.", "SVO",
         "cover-frame",
         "deep-place sense forced by 'covered the deep round pit'",
         ""),
        ("She fell into the old pit.", "SV-PP",
         "fall-frame",
         "deep-place sense forced by 'fell into the old pit'",
         ""),
    ],
    "inapp": [
        ("Workers covered the singing round pit.", "SVO",
         "animate-violation",
         "pit (-sentient hole) + 'singing' requires +animate modified noun",
         ""),
        ("She fell into the sleepy pit.", "SV-PP",
         "animate-violation-2",
         "pit is -animate; 'sleepy' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_3k_t05_i03"] = {  # audience (3K noun, watchers/listeners; foil=a)
    "app": [
        ("The audience cheered after the performance.", "SV-PP",
         "cheer-frame",
         "watchers/listeners sense forced by 'audience cheered after the performance'",
         ""),
        ("A large audience watched the movie.", "SVO",
         "watch-frame",
         "watchers/listeners sense forced by 'large audience watched the movie'",
         ""),
    ],
    "inapp": [
        ("The audience melted after the performance.", "SV-PP",
         "substance-violation",
         "audience (+human collective) + 'melted' (+substance process) violates +human selection",
         ""),
        ("A large audience boiled the movie.", "SVO",
         "verb-collocate",
         "audience (+human collective perceiver) + 'boiled' (material process) non-collocate verb frame",
         ""),
    ],
}

CAND["uvlt_3k_t06_i02"] = {  # specify (3K verb, say clearly; foil=b; CRITICAL)
    "app": [
        ("You must specify the meeting time.", "SVO",
         "time-obj",
         "say-clearly sense forced by modal 'must' + 'specify the meeting time'; base form target",
         "CRITICAL: cand2/3 must block arbitrariness — using tightly bound collocates."),
        ("Please specify the address for delivery.", "SVO-PP",
         "address-obj",
         "say-clearly sense forced by 'specify the address for delivery'",
         "CRITICAL: address/delivery is a canonical specify-object; swap breaks more visibly."),
    ],
    "inapp": [
        ("You must specify the meeting rainbow.", "SVO",
         "object-collocate",
         "'specify a rainbow' non-collocate; specify date/time/amount/location/conditions/requirements standard. Rainbow blocks conditional-rescue",
         "CRITICAL: rainbow chosen to avoid compositional rescue; unambiguously external concrete."),
        ("Please specify the address for rainbows.", "SVO-PP",
         "prep-collocate",
         "specify + 'for rainbows' governed-PP non-collocate; specify + for + purpose/recipient (delivery/reference/clarity) standard",
         "CRITICAL: swap moved to governed prep-object so candidate 3 tests a different syntactic position from candidate 2."),
    ],
}

CAND["uvlt_3k_t06_i03"] = {  # exhibit (3K verb, show in public; foil=b; CRITICAL)
    "app": [
        ("The gallery exhibited modern Spanish paintings.", "SVO",
         "painting-obj",
         "show-in-public sense forced by +gallery subj + 'modern Spanish paintings'",
         "CRITICAL: gallery/paintings maximally canonical."),
        ("Artists exhibit their work every year.", "SVO-temporal",
         "artist-subj",
         "show-in-public sense forced by 'artists exhibit their work every year'",
         "CRITICAL: artist+work is textbook exhibit pair."),
    ],
    "inapp": [
        ("The gallery exhibited modern Spanish laughter.", "SVO",
         "object-collocate",
         "'exhibit laughter' non-collocate; exhibit art/paintings/sculpture/work/artifacts standard",
         "CRITICAL: laughter (-display-object) blocks the metonymic reading 'exhibit [artist]'s laughter' since gallery context rules out human-subject metonymy."),
        ("Artists exhibit their thunder every year.", "SVO-temporal",
         "object-collocate-2",
         "'exhibit thunder' non-collocate; exhibit + artwork/craft/display-item/possession standard",
         "CRITICAL: thunder (natural phenomenon, -ownable, -artifact) blocks any possessive-exhibit metaphor such as 'their voice'."),
    ],
}

CAND["uvlt_3k_t07_i01"] = {  # capture (3K verb, catch; foil=b)
    "app": [
        ("Soldiers captured the enemy base quickly.", "SVO-adv",
         "enemy-frame",
         "catch sense forced by +military subj + 'enemy base'",
         "minority 'capture moment' rescue risk."),
        ("They captured the runaway horse yesterday.", "SVO-temporal",
         "runaway-frame",
         "catch sense forced by 'captured the runaway horse yesterday'",
         ""),
    ],
    "inapp": [
        ("Soldiers captured the enemy sunrise quickly.", "SVO-adv",
         "object-collocate",
         "'capture the enemy sunrise' non-collocate catch sense; capture thief/prisoner/town/base standard",
         ""),
        ("They captured the runaway rainbow yesterday.", "SVO-temporal",
         "object-collocate-2",
         "'capture the runaway rainbow' non-collocate catch sense; capture fugitive/animal/thief standard",
         ""),
    ],
}

CAND["uvlt_3k_t07_i02"] = {  # proceed (3K verb, go on; foil=b)
    "app": [
        ("They proceeded down the narrow corridor.", "SV-PP",
         "corridor-frame",
         "go-on sense forced by 'proceeded down the narrow corridor' (physical movement)",
         "weak foil risk noted."),
        ("We proceeded toward the main exit.", "SV-PP",
         "exit-frame",
         "go-on sense forced by 'proceeded toward the main exit' (physical movement)",
         ""),
    ],
    "inapp": [
        ("They proceeded down the narrow promise.", "SV-PP",
         "prep-collocate",
         "'proceed down a promise' non-collocate; proceed down/along + physical path standard",
         ""),
        ("We proceeded toward the main rainbow.", "SV-PP",
         "prep-collocate-2",
         "'proceed toward a rainbow' non-collocate physical-movement sense; proceed toward + destination standard",
         ""),
    ],
}

CAND["uvlt_3k_t08_i01"] = {  # persist (3K verb, continue; foil=b; CRITICAL)
    "app": [
        ("The loud noise persisted all night.", "SV-temporal",
         "noise-frame",
         "continue-to-happen sense forced by +perceivable 'loud noise' + 'persisted all night'",
         "CRITICAL: matched with time-unit adjunct to block fail-mode-4."),
        ("His strong cough persisted through winter.", "SV-PP",
         "cough-frame",
         "continue-to-happen sense forced by +condition 'strong cough' + 'persisted through winter'",
         "CRITICAL: condition+through+season is prototypical persist frame."),
    ],
    "inapp": [
        ("The loud noise persisted all triangle.", "SV-temporal",
         "object-collocate",
         "persisted all + 'triangle' non-collocate temporal unit; persisted all + night/day/week/year standard",
         "CRITICAL: swap is in direct duration-complement of persist (adverbial), not elsewhere in the sentence — blocks fail-mode-4 attribution to unrelated words."),
        ("His strong cough persisted through rainbow.", "SV-PP",
         "prep-collocate",
         "'persisted through a rainbow' non-collocate; persist through + duration/season/event standard",
         "CRITICAL: rainbow as prep-object of persist-through blocks fail-mode-4 since persist's prepositional argument is directly semantically ill-formed."),
    ],
}

CAND["uvlt_3k_t08_i02"] = {  # exceed (3K verb, go beyond limit; foil=b)
    "app": [
        ("The price exceeded our original limit.", "SVO",
         "limit-obj",
         "goes-beyond-limit sense forced by 'price exceeded our original limit'",
         ""),
        ("Her test score exceeded every expectation.", "SVO",
         "expectation-obj",
         "goes-beyond-limit sense forced by 'test score exceeded every expectation'",
         ""),
    ],
    "inapp": [
        ("The price exceeded our original rainbow.", "SVO",
         "object-collocate",
         "'exceed rainbow' non-collocate; exceed expectations/limits/budget/estimate/target standard",
         ""),
        ("Her test score exceeded every thunder.", "SVO",
         "object-collocate-2",
         "'exceed thunder' non-collocate; exceed + measurable-target noun standard",
         ""),
    ],
}

CAND["uvlt_3k_t09_i01"] = {  # approximate (3K adj, almost exact; foil=b; CRITICAL)
    "app": [
        ("The approximate time is three hours.", "SVC",
         "time-head",
         "almost-exact sense forced by 'approximate time' + 'is three hours'",
         "CRITICAL: matched with quantity-head noun."),
        ("She gave an approximate weight estimate.", "SVO",
         "weight-head",
         "almost-exact sense forced by 'approximate weight estimate'",
         "CRITICAL: matched with measurement-head noun."),
    ],
    "inapp": [
        ("The approximate rainbow is three hours.", "SVC",
         "modifier-collocate",
         "'approximate rainbow' non-collocate; approximate + number/time/size/cost/weight/age standard",
         "CRITICAL: rainbow (natural phenomenon, not measurable-quantity) unambiguously blocks approximate as modifier."),
        ("She gave an approximate thunder estimate.", "SVO",
         "modifier-collocate-2",
         "'approximate thunder' non-collocate; approximate + quantifiable-noun head standard",
         "CRITICAL: thunder is not a quantity-noun; 'approximate' requires +measurable head."),
    ],
}

CAND["uvlt_3k_t09_i02"] = {  # prior (3K adj, earlier; foil=b per draft)
    "app": [
        ("Her prior knowledge made everything easier.", "SVC",
         "knowledge-frame",
         "earlier sense forced by 'prior knowledge' + 'made everything easier'",
         ""),
        ("He needed prior approval from management.", "SVO-PP",
         "approval-frame",
         "earlier sense forced by 'needed prior approval from management'",
         ""),
    ],
    "inapp": [
        ("Her prior rainbow made everything easier.", "SVC",
         "modifier-collocate",
         "'prior rainbow' non-collocate; prior + experience/knowledge/notice/approval/arrangement standard",
         ""),
        ("He needed prior thunder from management.", "SVO-PP",
         "modifier-collocate-2",
         "'prior thunder' non-collocate; prior + formal-action/document head standard",
         ""),
    ],
}

CAND["uvlt_3k_t09_i03"] = {  # frequent (3K adj, often; foil=b per draft)
    "app": [
        ("Her frequent visits pleased her grandmother.", "SVO",
         "visit-frame",
         "happening-often sense forced by 'frequent visits pleased her grandmother'",
         ""),
        ("They made frequent stops along the road.", "SVO-PP",
         "stop-frame",
         "happening-often sense forced by 'made frequent stops along the road'",
         ""),
    ],
    "inapp": [
        ("Her frequent rainbows pleased her grandmother.", "SVO",
         "modifier-collocate",
         "'frequent rainbow' non-collocate; frequent + visitor/flyer/rain/trip/stop standard",
         ""),
        ("They made frequent thunders along the road.", "SVO-PP",
         "modifier-collocate-2",
         "'frequent thunder' non-collocate; frequent + countable-repeatable-event standard",
         ""),
    ],
}

CAND["uvlt_3k_t10_i01"] = {  # consistent (3K adj, not changing; foil=b per draft)
    "app": [
        ("Her work showed consistent quality lately.", "SVO-temporal",
         "quality-frame",
         "not-changing sense forced by 'consistent quality' + 'showed' + 'lately'",
         ""),
        ("The team delivered consistent results daily.", "SVO-adv",
         "results-frame",
         "not-changing sense forced by 'delivered consistent results daily'",
         ""),
    ],
    "inapp": [
        ("Her work showed consistent laughter lately.", "SVO-temporal",
         "modifier-collocate",
         "'consistent laughter' non-collocate; consistent + quality/results/performance/approach/message standard",
         ""),
        ("The team delivered consistent rainbows daily.", "SVO-adv",
         "modifier-collocate-2",
         "'consistent rainbow' non-collocate; consistent + measurable-output standard",
         ""),
    ],
}

CAND["uvlt_3k_t10_i03"] = {  # mutual (3K adj, shared; foil=b per draft)
    "app": [
        ("They shared a mutual interest today.", "SVO-temporal",
         "interest-frame",
         "shared sense forced by 'shared a mutual interest today'",
         ""),
        ("Our mutual friend joined the meeting.", "SVO",
         "friend-frame",
         "shared sense forced by 'our mutual friend joined the meeting'",
         ""),
    ],
    "inapp": [
        ("They shared a mutual thunder today.", "SVO-temporal",
         "modifier-collocate",
         "'mutual thunder' non-collocate; mutual + respect/friend/interest/agreement/understanding/benefit standard",
         ""),
        ("Our mutual rainbow joined the meeting.", "SVO",
         "modifier-collocate-2",
         "'mutual rainbow' non-collocate; mutual + relational-abstract head standard",
         ""),
    ],
}

# ----------------------------------------------------------------------------
# 4K band
# ----------------------------------------------------------------------------

CAND["uvlt_4k_t01_i01"] = {  # vitamin (4K noun, supplement; foil=a)
    "app": [
        ("Doctors recommend vitamins for growing children.", "SVO-PP",
         "recommend-frame",
         "healthy-supplement sense forced by 'doctors recommend vitamins for growing children'",
         ""),
        ("She takes vitamins every single morning.", "SVO-temporal",
         "take-frame",
         "healthy-supplement sense forced by 'takes vitamins every single morning'",
         ""),
    ],
    "inapp": [
        ("Doctors recommend vitamins for laughing children.", "SVO-PP",
         "prep-collocate-but-animate",
         "vitamins is -animate supplement; 'laughing' modifier in PP is directly the animate-violation anchor (children context intact, the 'laughing children' is fine — but the vitamin takes an inanimate-collocate head issue with the animate-participle). Wait: the direct relation is vitamins ... but 'laughing children' is not wrong. Revise to animate-violation on vitamins directly.",
         ""),
        ("She takes hungry vitamins every morning.", "SVO-temporal",
         "animate-violation",
         "vitamin (-animate supplement) + 'hungry' requires +animate modified noun",
         ""),
    ],
}

# Fix: revise uvlt_4k_t01_i01 inapp cand2 so violation is at vitamins
CAND["uvlt_4k_t01_i01"]["inapp"] = [
    ("Doctors recommend laughing vitamins for children.", "SVO-PP",
     "animate-violation",
     "vitamin (-animate) + 'laughing' requires +animate modified noun",
     ""),
    ("She takes hungry vitamins every morning.", "SVO-temporal",
     "animate-violation-2",
     "vitamin (-animate supplement) + 'hungry' requires +animate head noun",
     ""),
]

CAND["uvlt_4k_t01_i02"] = {  # cave (4K noun, hill opening; foil=a)
    "app": [
        ("They explored the dark cold cave.", "SVO",
         "explore-frame",
         "hill-opening sense forced by 'explored the dark cold cave'",
         ""),
        ("A bat flew inside the cave.", "SV-PP",
         "bat-frame",
         "hill-opening sense forced by 'bat flew inside the'",
         ""),
    ],
    "inapp": [
        ("They explored the laughing cold cave.", "SVO",
         "animate-violation",
         "cave (-animate geological) + 'laughing' requires +animate modified noun",
         ""),
        ("A bat flew inside the hungry cave.", "SV-PP",
         "animate-violation-2",
         "cave (-animate) + 'hungry' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_4k_t02_i01"] = {  # soap (4K noun, for cleaning; foil=b per draft)
    "app": [
        ("He bought some cheap hand soap.", "SVO",
         "hand-frame",
         "cleaning-product sense forced by 'bought' + 'cheap hand'",
         ""),
        ("She used liquid soap for dishes.", "SVO-PP",
         "liquid-frame",
         "cleaning-product sense forced by 'used liquid soap for dishes'",
         ""),
    ],
    "inapp": [
        ("He bought some laughing hand soap.", "SVO",
         "modifier-collocate",
         "'laughing soap' non-collocate; soap modifiers: bar/liquid/hand/dish/fresh/scented standard",
         ""),
        ("She used hungry soap for dishes.", "SVO-PP",
         "modifier-collocate-2",
         "'hungry soap' non-collocate; soap + function/texture modifier standard",
         ""),
    ],
}

CAND["uvlt_4k_t02_i02"] = {  # tutor (4K noun, teacher; foil=b)
    "app": [
        ("Her tutor explained the math problem.", "SVO",
         "explain-frame",
         "teacher sense forced by 'tutor explained the math problem'",
         ""),
        ("The tutor gave clear homework instructions.", "SVO",
         "homework-frame",
         "teacher sense forced by 'tutor gave clear homework instructions'",
         ""),
    ],
    "inapp": [
        ("Her tutor explained the rainbow problem.", "SVO",
         "object-collocate",
         "'tutor explained the rainbow problem' non-collocate; tutor explains + academic-topic (math/grammar/problem/lesson) standard",
         ""),
        ("The tutor gave clear thunder instructions.", "SVO",
         "modifier-collocate",
         "'thunder instructions' non-collocate; tutor + homework/clear/simple/detailed/daily instructions standard",
         ""),
    ],
}

CAND["uvlt_4k_t02_i03"] = {  # diamond (4K noun, stone; foil=b per draft)
    "app": [
        ("The diamond necklace cost many thousands.", "SVO",
         "necklace-frame",
         "valuable-stone sense forced by 'diamond necklace cost many thousands'",
         ""),
        ("A large diamond shone in sunlight.", "SV-PP",
         "shine-frame",
         "valuable-stone sense forced by 'large diamond shone in sunlight'",
         ""),
    ],
    "inapp": [
        ("The laughing diamond necklace cost thousands.", "SVO",
         "modifier-collocate",
         "'laughing diamond' non-collocate; diamond modifiers: small/large/fake/real/rough/cut standard",
         ""),
        ("A hungry diamond shone in sunlight.", "SV-PP",
         "modifier-collocate-2",
         "'hungry diamond' non-collocate; diamond + size/quality/form modifier standard",
         ""),
    ],
}

CAND["uvlt_4k_t03_i01"] = {  # orchestra (4K noun, music group; foil=a)
    "app": [
        ("The famous orchestra performed that evening.", "SV-temporal",
         "perform-frame",
         "music-group sense forced by 'famous orchestra performed that evening'",
         ""),
        ("Our orchestra rehearsed every Thursday night.", "SV-adv",
         "rehearse-frame",
         "music-group sense forced by 'orchestra rehearsed every Thursday night'",
         ""),
    ],
    "inapp": [
        ("The famous orchestra melted that evening.", "SV-temporal",
         "substance-violation",
         "orchestra (+human collective) + 'melted' (+substance) violates +human selection",
         ""),
        ("Our orchestra rusted every Thursday night.", "SV-adv",
         "material-violation",
         "orchestra (+human collective) + 'rusted' (+metal) violates material selection",
         ""),
    ],
}

CAND["uvlt_4k_t03_i02"] = {  # slot (4K noun, thin opening; foil=a)
    "app": [
        ("She inserted the card into slot.", "SVO-PP",
         "insert-frame",
         "thin-opening sense forced by 'inserted the card into slot'",
         ""),
        ("The slot on the machine jammed.", "SV",
         "jam-frame",
         "thin-opening sense forced by 'slot on the machine jammed'",
         ""),
    ],
    "inapp": [
        ("She inserted the card into laughing slot.", "SVO-PP",
         "animate-violation",
         "slot (-animate opening) + 'laughing' requires +animate modified noun",
         ""),
        ("The hungry slot on the machine jammed.", "SV",
         "animate-violation-2",
         "slot (-animate) + 'hungry' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_4k_t03_i03"] = {  # scrap (4K noun, small piece; foil=a)
    "app": [
        ("She collected small scraps of cloth.", "SVO-PP",
         "cloth-frame",
         "small-unwanted-piece sense forced by 'collected small scraps of cloth'",
         ""),
        ("He threw the metal scrap away.", "SVO-adv",
         "throw-frame",
         "small-unwanted-piece sense forced by 'threw the metal scrap away'",
         ""),
    ],
    "inapp": [
        ("She collected small scraps of silence.", "SVO-PP",
         "substance-violation",
         "scrap requires +substance/+tangible material; 'silence' is -substance",
         ""),
        ("He threw the melody scrap away.", "SVO-adv",
         "substance-violation-2",
         "scrap (+substance piece) conflicts with 'melody' (-substance auditory)",
         ""),
    ],
}

CAND["uvlt_4k_t04_i01"] = {  # crust (4K noun, hard outside; foil=b)
    "app": [
        ("The pie had a thick crust.", "SVO",
         "pie-frame",
         "hard-outside-part sense forced by 'pie had a thick crust'",
         ""),
        ("She removed the hard bread crust.", "SVO",
         "remove-frame",
         "hard-outside-part sense forced by 'removed the hard bread crust'",
         ""),
    ],
    "inapp": [
        ("The pie had a hungry crust.", "SVO",
         "modifier-collocate",
         "'hungry crust' non-collocate; crust modifiers: hard/thick/crispy/golden/flaky/bread/pie standard",
         ""),
        ("She removed the sleepy bread crust.", "SVO",
         "modifier-collocate-2",
         "'sleepy crust' non-collocate; crust + texture/type modifier standard",
         ""),
    ],
}

CAND["uvlt_4k_t04_i02"] = {  # verdict (4K noun, judgment; foil=b)
    "app": [
        ("The judge announced the final verdict.", "SVO",
         "announce-frame",
         "judgment sense forced by 'judge announced the final verdict'",
         ""),
        ("The verdict came in this morning.", "SV-temporal",
         "come-in-frame",
         "judgment sense forced by 'verdict came in this morning'",
         ""),
    ],
    "inapp": [
        ("The judge announced the sleepy verdict.", "SVO",
         "modifier-collocate",
         "'sleepy verdict' non-collocate; verdict modifiers: fair/final/guilty/unanimous/written/harsh standard",
         ""),
        ("The hungry verdict came in this morning.", "SV-temporal",
         "modifier-collocate-2",
         "'hungry verdict' non-collocate; verdict + legal-outcome modifier standard",
         ""),
    ],
}

CAND["uvlt_4k_t04_i03"] = {  # venue (4K noun, place; foil=b)
    "app": [
        ("The wedding venue offered beautiful views.", "SVO",
         "wedding-frame",
         "place sense forced by 'wedding venue offered beautiful views'",
         ""),
        ("They changed the concert venue yesterday.", "SVO-temporal",
         "concert-frame",
         "place sense forced by 'changed the concert venue yesterday'",
         ""),
    ],
    "inapp": [
        ("The wedding venue offered sleepy views.", "SVO",
         "object-collocate",
         "'venue offered sleepy views' — venue offers + feature/location/seating/atmosphere standard; 'sleepy views' breaks the modifier pattern that venue directly governs",
         ""),
        ("They changed the hungry venue yesterday.", "SVO-temporal",
         "modifier-collocate",
         "'hungry venue' non-collocate; venue + event-type/location/style modifier standard",
         ""),
    ],
}

CAND["uvlt_4k_t05_i01"] = {  # embassy (4K noun, govt building; foil=a)
    "app": [
        ("The embassy opened its front gate.", "SVO",
         "gate-frame",
         "government-building sense forced by 'embassy opened its front gate'",
         ""),
        ("Tourists visited the Japanese embassy today.", "SVO-temporal",
         "visit-frame",
         "government-building sense forced by 'tourists visited the Japanese embassy today'",
         ""),
    ],
    "inapp": [
        ("The embassy ate its front gate.", "SVO",
         "animate-violation",
         "embassy (-animate building) + 'ate' requires +animate subject",
         ""),
        ("Tourists visited the laughing Japanese embassy today.", "SVO-temporal",
         "animate-violation-2",
         "embassy (-animate building) + 'laughing' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_4k_t05_i02"] = {  # tobacco (4K noun, smoked plant; foil=a)
    "app": [
        ("The farmer picked tobacco last week.", "SVO-temporal",
         "pick-frame",
         "smoking-plant sense forced by 'farmer picked tobacco last week'",
         ""),
        ("Dry tobacco hung from the rafters.", "SV-PP",
         "dry-frame",
         "smoking-plant sense forced by 'dry tobacco hung from the rafters'",
         ""),
    ],
    "inapp": [
        ("The farmer picked laughing tobacco last week.", "SVO-temporal",
         "animate-violation",
         "tobacco (-sentient plant) + 'laughing' requires +sentient/+animate",
         ""),
        ("Hungry tobacco hung from the rafters.", "SV-PP",
         "animate-violation-2",
         "tobacco (plant) -animate; 'hungry' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_4k_t05_i03"] = {  # alley (4K noun, small street; foil=a)
    "app": [
        ("A cat ran through the alley.", "SV-PP",
         "cat-frame",
         "small-street sense forced by 'cat ran through the alley'",
         ""),
        ("The narrow alley led to downtown.", "SV-PP",
         "narrow-frame",
         "small-street sense forced by 'narrow alley led to downtown'",
         ""),
    ],
    "inapp": [
        ("A cat ran through the laughing alley.", "SV-PP",
         "animate-violation",
         "alley (-animate street) + 'laughing' requires +animate modified noun",
         ""),
        ("The hungry alley led to downtown.", "SV-PP",
         "animate-violation-2",
         "alley (-animate) + 'hungry' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_4k_t06_i01"] = {  # forbid (4K verb, not allow; foil=b)
    "app": [
        ("The school forbids food during exams.", "SVO-PP",
         "food-obj",
         "not-allow sense forced by 'school forbids food during exams'",
         ""),
        ("They forbid smoking inside the building.", "SVO-PP",
         "smoking-obj",
         "not-allow sense forced by 'they forbid smoking inside the building'",
         ""),
    ],
    "inapp": [
        ("The school forbids rainbows during exams.", "SVO-PP",
         "object-collocate",
         "'forbid rainbows' non-collocate; forbid + restrictable-activity/item (smoking/phones/weapons/entry) standard",
         ""),
        ("They forbid thunder inside the building.", "SVO-PP",
         "object-collocate-2",
         "'forbid thunder' non-collocate; forbid + human-controllable-activity standard",
         ""),
    ],
}

CAND["uvlt_4k_t06_i02"] = {  # shrink (4K verb, make smaller; foil=b)
    "app": [
        ("My shirt will shrink in wash.", "SV-PP",
         "wash-frame",
         "make-smaller sense forced by modal 'will' + 'shrink in wash'; base form preserved",
         ""),
        ("The pond may shrink during summer.", "SV-PP",
         "pond-frame",
         "make-smaller sense forced by modal 'may' + 'shrink during summer'; base form preserved",
         ""),
    ],
    "inapp": [
        ("My shirt will shrink in silence.", "SV-PP",
         "prep-collocate",
         "'shrink in silence' non-collocate; shrink in + water/heat/wash/size/dryer standard",
         ""),
        ("The pond may shrink during rainbows.", "SV-PP",
         "prep-collocate-2",
         "'shrink during rainbows' non-collocate; shrink during + duration/process standard",
         ""),
    ],
}

CAND["uvlt_4k_t06_i03"] = {  # fling (4K verb, throw; foil=b)
    "app": [
        ("She will fling the book angrily.", "SVO-adv",
         "book-obj",
         "throw sense forced by +human subj + 'fling the book angrily'",
         ""),
        ("He might fling his hat somewhere.", "SVO-adv",
         "hat-obj",
         "throw sense forced by modal + +human subj + 'fling his hat'",
         ""),
    ],
    "inapp": [
        ("She will fling the opinion angrily.", "SVO-adv",
         "object-collocate",
         "'fling opinion' non-collocate; fling + physical-object (ball/stone/door/bag/hat/book) standard",
         ""),
        ("He might fling his whisper somewhere.", "SVO-adv",
         "object-collocate-2",
         "'fling whisper' non-collocate; fling + tangible-tossable-item standard",
         ""),
    ],
}

CAND["uvlt_4k_t07_i01"] = {  # weep (4K verb, cry; foil=b)
    "app": [
        ("The mother will weep for him.", "SV-PP",
         "mother-subj",
         "cry sense forced by modal + +human subject + 'for him'; base form target",
         ""),
        ("Children often weep during sad stories.", "SV-PP",
         "children-subj",
         "cry sense forced by +human subject + habitual 'often' + 'during sad stories'",
         ""),
    ],
    "inapp": [
        ("The rainbow will weep for him.", "SV-PP",
         "subject-collocate",
         "weep's subject +human/+animate required; 'rainbow' is -animate natural phenomenon",
         ""),
        ("Thunders often weep during sad stories.", "SV-PP",
         "subject-collocate-2",
         "weep requires +sentient subject; 'thunder' is -sentient weather phenomenon",
         ""),
    ],
}

CAND["uvlt_4k_t07_i02"] = {  # disclose (4K verb, tell; foil=b)
    "app": [
        ("She disclosed her salary to him.", "SVO-PP",
         "salary-obj",
         "tell sense forced by 'disclosed her salary to him'",
         ""),
        ("He disclosed the secret plan yesterday.", "SVO-temporal",
         "secret-obj",
         "tell sense forced by 'disclosed the secret plan yesterday'",
         ""),
    ],
    "inapp": [
        ("She disclosed her rainbow to him.", "SVO-PP",
         "object-collocate",
         "'disclose rainbow' non-collocate; disclose information/details/news/identity/facts/secrets standard",
         ""),
        ("He disclosed the thunder plan yesterday.", "SVO-temporal",
         "modifier-collocate",
         "'thunder plan' as disclose-object-modifier non-collocate; disclose + information-containing noun standard",
         ""),
    ],
}

CAND["uvlt_4k_t07_i03"] = {  # activate (4K verb, turn on; foil=b)
    "app": [
        ("She activated the new phone today.", "SVO-temporal",
         "phone-obj",
         "turn-on sense forced by 'activated the new phone today'",
         ""),
        ("Please activate your account before tomorrow.", "SVO-PP",
         "account-obj",
         "turn-on sense forced by 'activate your account before tomorrow'",
         ""),
    ],
    "inapp": [
        ("She activated the new rainbow today.", "SVO-temporal",
         "object-collocate",
         "'activate a rainbow' non-collocate; activate + alarm/account/system/device/feature standard",
         ""),
        ("Please activate your thunder before tomorrow.", "SVO-PP",
         "object-collocate-2",
         "'activate thunder' non-collocate; activate + user-controllable-electronic/account item standard",
         ""),
    ],
}

CAND["uvlt_4k_t08_i01"] = {  # explode (4K verb, break violently; foil=b)
    "app": [
        ("The firework exploded over the lake.", "SV-PP",
         "firework-subj",
         "break-into-pieces sense forced by +explosive 'firework' + 'over the lake'",
         ""),
        ("A gas tank exploded behind the garage.", "SV-PP",
         "gas-frame",
         "break-into-pieces sense forced by +explosive 'gas tank' + 'behind the garage'",
         ""),
    ],
    "inapp": [
        ("The firework exploded over the rainbow.", "SV-PP",
         "prep-collocate",
         "'explode over rainbow' non-collocate; explode over + physical-location (lake/city/bridge/field) standard",
         ""),
        ("A gas tank exploded behind the whisper.", "SV-PP",
         "prep-collocate-2",
         "'explode behind whisper' non-collocate; explode behind + physical-object/place standard",
         ""),
    ],
}

CAND["uvlt_4k_t08_i02"] = {  # diminish (4K verb, get smaller; foil=b)
    "app": [
        ("His courage diminished during the storm.", "SV-PP",
         "courage-subj",
         "get-smaller sense forced by +abstract 'courage' + 'during the storm'",
         ""),
        ("The profits diminished over many months.", "SV-PP",
         "profit-subj",
         "get-smaller sense forced by 'profits diminished over many months'",
         ""),
    ],
    "inapp": [
        ("His courage diminished during the rainbow.", "SV-PP",
         "prep-collocate",
         "'diminish during the rainbow' non-collocate; diminish during + duration/event/season standard",
         ""),
        ("The profits diminished over many thunders.", "SV-PP",
         "prep-collocate-2",
         "'diminish over thunders' non-collocate; diminish over + time-period (years/months/decades) standard",
         ""),
    ],
}

CAND["uvlt_4k_t08_i03"] = {  # transplant (4K verb, move; foil=b)
    "app": [
        ("Surgeons transplanted a kidney last night.", "SVO-temporal",
         "kidney-obj",
         "move-to-another-place sense forced by 'surgeons transplanted a kidney last night'",
         ""),
        ("Farmers transplanted young trees this spring.", "SVO-temporal",
         "tree-obj",
         "move-to-another-place sense forced by 'farmers transplanted young trees this spring'",
         ""),
    ],
    "inapp": [
        ("Surgeons transplanted a whisper last night.", "SVO-temporal",
         "object-collocate",
         "'transplant whisper' non-collocate; transplant + heart/kidney/liver/organ/tree/plant/skin standard",
         ""),
        ("Farmers transplanted young rainbows this spring.", "SVO-temporal",
         "object-collocate-2",
         "'transplant rainbow' non-collocate; transplant + biological-movable-entity standard",
         ""),
    ],
}

CAND["uvlt_4k_t09_i01"] = {  # adjacent (4K adj, beside; foil=b per draft)
    "app": [
        ("His office is adjacent to mine.", "SVC-PP",
         "office-frame",
         "beside sense forced by +physical 'office' + 'adjacent to mine'",
         ""),
        ("The park sits adjacent to school.", "SV-PP",
         "park-frame",
         "beside sense forced by +physical 'park' + 'adjacent to school'",
         ""),
    ],
    "inapp": [
        ("His office is adjacent to thunder.", "SVC-PP",
         "prep-collocate",
         "'adjacent to thunder' non-collocate; adjacent to + physical-location standard",
         ""),
        ("The park sits adjacent to sadness.", "SV-PP",
         "prep-collocate-2",
         "'adjacent to sadness' non-collocate; adjacent to + physical-place/building standard",
         ""),
    ],
}

CAND["uvlt_4k_t09_i02"] = {  # sane (4K adj, not crazy; foil=a)
    "app": [
        ("The patient seemed sane at last.", "SV-AdjP-PP",
         "patient-frame",
         "not-crazy sense forced by +human 'patient' + 'seemed sane'",
         ""),
        ("No sane person would refuse help.", "SVO",
         "person-frame",
         "not-crazy sense forced by 'no sane person would refuse help'",
         ""),
    ],
    "inapp": [
        ("The tomato seemed sane at last.", "SV-AdjP-PP",
         "mind-violation",
         "sane requires +mind-capable subject; 'tomato' is -sentient/-minded",
         ""),
        ("No sane chair would refuse help.", "SVO",
         "mind-violation-2",
         "sane requires +mind-capable head; 'chair' is -sentient",
         ""),
    ],
}

CAND["uvlt_4k_t09_i03"] = {  # swift (4K adj, quick; foil=b per draft)
    "app": [
        ("They took swift action against crime.", "SVO-PP",
         "action-frame",
         "quick sense forced by 'took swift action against crime'",
         ""),
        ("He gave a swift reply tonight.", "SVO-temporal",
         "reply-frame",
         "quick sense forced by 'gave a swift reply tonight'",
         ""),
    ],
    "inapp": [
        ("They took swift thunder against crime.", "SVO-PP",
         "modifier-collocate",
         "'swift thunder' non-collocate; swift + action/response/reply/movement/river/horse standard",
         ""),
        ("He gave a swift rainbow tonight.", "SVO-temporal",
         "modifier-collocate-2",
         "'swift rainbow' non-collocate; swift + agent/action head standard",
         ""),
    ],
}

CAND["uvlt_4k_t10_i01"] = {  # credible (4K adj, believable; foil=a)
    "app": [
        ("Her evidence looked very credible tonight.", "SVC-temporal",
         "evidence-frame",
         "believable sense forced by +proposition 'evidence' + 'looked' + 'tonight'",
         ""),
        ("He made a credible witness today.", "SVC-temporal",
         "witness-frame",
         "believable sense forced by +human 'witness' + 'today'",
         ""),
    ],
    "inapp": [
        ("Her pancake looked very credible tonight.", "SVC-temporal",
         "proposition-violation",
         "credible (+proposition/+testimony head) + 'pancake' (+food -proposition) violates selection",
         ""),
        ("He made a credible chair today.", "SVC-temporal",
         "proposition-violation-2",
         "credible requires +truth-evaluable head; 'chair' is -evaluable-claim",
         ""),
    ],
}

CAND["uvlt_4k_t10_i02"] = {  # greasy (4K adj, oily; foil=a)
    "app": [
        ("The greasy pan needed careful washing.", "SVO",
         "pan-frame",
         "oily sense forced by +substance 'pan' + 'needed careful washing'",
         ""),
        ("He wiped his greasy hands carefully.", "SVO-adv",
         "hand-frame",
         "oily sense forced by +substance 'hands' + 'wiped carefully'",
         ""),
    ],
    "inapp": [
        ("The greasy promise needed careful washing.", "SVO",
         "substance-violation",
         "greasy requires +substance/+physical-surface; 'promise' is -substance abstract",
         ""),
        ("He wiped his greasy opinions carefully.", "SVO-adv",
         "substance-violation-2",
         "greasy requires +substance; 'opinions' are -substance abstract",
         ""),
    ],
}

CAND["uvlt_4k_t10_i03"] = {  # abnormal (4K adj, unusual; foil=b per draft)
    "app": [
        ("Doctors noticed the abnormal heart rate.", "SVO",
         "heart-frame",
         "unusual sense forced by 'doctors noticed the abnormal heart rate'",
         ""),
        ("Her abnormal test results worried everyone.", "SVO",
         "results-frame",
         "unusual sense forced by 'abnormal test results worried everyone'",
         ""),
    ],
    "inapp": [
        ("Doctors noticed the abnormal rainbow rate.", "SVO",
         "modifier-collocate",
         "'abnormal rainbow rate' non-collocate; abnormal + behavior/result/growth/level/cell/reading/rate standard",
         ""),
        ("Her abnormal thunder results worried everyone.", "SVO",
         "modifier-collocate-2",
         "'abnormal thunder' non-collocate; abnormal + measurable-biological-or-clinical indicator standard",
         ""),
    ],
}

# ----------------------------------------------------------------------------
# 5K band
# ----------------------------------------------------------------------------

CAND["uvlt_5k_t01_i01"] = {  # mustache (5K noun, facial hair; foil=a)
    "app": [
        ("His thick black mustache looked neat.", "SVC",
         "thick-frame",
         "upper-lip-hair sense forced by 'thick black mustache looked neat'",
         ""),
        ("The old man trimmed his mustache.", "SVO",
         "trim-frame",
         "upper-lip-hair sense forced by 'old man trimmed his mustache'",
         ""),
    ],
    "inapp": [
        ("His thick black mustache laughed neat.", "SVC",
         "animate-violation",
         "mustache (-animate body feature) + 'laughed' requires +animate subject",
         ""),
        ("The old man trimmed his hungry mustache.", "SVO",
         "animate-violation-2",
         "mustache (-animate) + 'hungry' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_5k_t01_i02"] = {  # paradise (5K noun, perfect place; foil=a)
    "app": [
        ("Tourists called the beach their paradise.", "SVOC",
         "beach-frame",
         "perfect-place sense forced by 'tourists called the beach their paradise'",
         ""),
        ("Her garden feels like a paradise.", "SV-PP",
         "garden-frame",
         "perfect-place sense forced by +physical 'garden' + 'feels like'",
         ""),
    ],
    "inapp": [
        ("Tourists called the beach their laughing paradise.", "SVOC",
         "animate-violation",
         "paradise (-animate place) + 'laughing' requires +animate modified noun",
         ""),
        ("Her garden feels like a hungry paradise.", "SV-PP",
         "animate-violation-2",
         "paradise (-animate place) + 'hungry' requires +animate head noun",
         ""),
    ],
}

CAND["uvlt_5k_t01_i03"] = {  # pastry (5K noun, baked food; foil=a)
    "app": [
        ("He bought two warm fresh pastries.", "SVO",
         "buy-frame",
         "baked-food sense forced by 'bought two warm fresh pastries'",
         ""),
        ("Each pastry smelled buttery and sweet.", "SV-AdjP",
         "smell-frame",
         "baked-food sense forced by 'pastry smelled buttery and sweet'",
         ""),
    ],
    "inapp": [
        ("He bought two laughing fresh pastries.", "SVO",
         "animate-violation",
         "pastry (-animate) + 'laughing' requires +animate modified noun",
         ""),
        ("Each pastry sang buttery and sweet.", "SV-AdjP",
         "animate-violation-2",
         "pastry (-animate) + 'sang' requires +animate subject",
         ""),
    ],
}

CAND["uvlt_5k_t02_i01"] = {  # vase (5K noun, container; foil=b per draft)
    "app": [
        ("She filled the tall glass vase.", "SVO",
         "fill-frame",
         "container sense forced by 'filled the tall glass vase'",
         ""),
        ("The empty vase stood on shelf.", "SV-PP",
         "empty-frame",
         "container sense forced by 'empty vase stood on shelf'",
         ""),
    ],
    "inapp": [
        ("She filled the hungry glass vase.", "SVO",
         "modifier-collocate",
         "'hungry vase' non-collocate; vase modifiers: tall/small/crystal/glass/empty/broken/flower standard",
         ""),
        ("The laughing vase stood on shelf.", "SV-PP",
         "modifier-collocate-2",
         "'laughing vase' non-collocate; vase + material/size/color modifier standard",
         ""),
    ],
}

CAND["uvlt_5k_t02_i02"] = {  # chord (5K noun, musical notes; foil=b)
    "app": [
        ("He struck a loud minor chord.", "SVO",
         "minor-frame",
         "musical-notes sense forced by 'struck a loud minor chord'",
         ""),
        ("The final chord echoed through hall.", "SV-PP",
         "final-frame",
         "musical-notes sense forced by 'final chord echoed through hall'",
         ""),
    ],
    "inapp": [
        ("He struck a sleepy minor chord.", "SVO",
         "modifier-collocate",
         "'sleepy chord' non-collocate; chord modifiers: beautiful/major/minor/final/opening/sad standard",
         ""),
        ("The hungry chord echoed through hall.", "SV-PP",
         "modifier-collocate-2",
         "'hungry chord' non-collocate; chord + musical-property modifier standard",
         ""),
    ],
}

CAND["uvlt_5k_t02_i03"] = {  # rectangle (5K noun, shape; foil=b per draft)
    "app": [
        ("The rectangle on the wall looked perfect.", "SV-AdjP",
         "wall-frame",
         "shape sense forced by 'rectangle on the wall looked perfect'",
         ""),
        ("She painted a small blue rectangle.", "SVO",
         "paint-frame",
         "shape sense forced by 'painted a small blue rectangle'",
         ""),
    ],
    "inapp": [
        ("The rectangle on the wall laughed perfect.", "SV-AdjP",
         "animate-violation",
         "rectangle (-animate shape) + 'laughed' requires +animate subject",
         ""),
        ("She painted a small hungry rectangle.", "SVO",
         "modifier-collocate",
         "'hungry rectangle' non-collocate; rectangle modifiers: large/small/long/thin/perfect/blue standard",
         ""),
    ],
}

CAND["uvlt_5k_t03_i01"] = {  # lime (5K noun, fruit; foil=a)
    "app": [
        ("She sliced a tiny fresh lime.", "SVO",
         "slice-frame",
         "green-fruit sense forced by 'sliced a tiny fresh lime'",
         ""),
        ("The lime in her drink floated.", "SV-PP",
         "drink-frame",
         "green-fruit sense forced by 'lime in her drink floated'",
         ""),
    ],
    "inapp": [
        ("She sliced a tiny laughing lime.", "SVO",
         "animate-violation",
         "lime (-animate fruit) + 'laughing' requires +animate modified noun",
         ""),
        ("The hungry lime in her drink floated.", "SV-PP",
         "animate-violation-2",
         "lime (-animate) + 'hungry' requires +animate head noun",
         ""),
    ],
}

CAND["uvlt_5k_t03_i02"] = {  # hum (5K noun, low sound; foil=a)
    "app": [
        ("The soft hum filled the room.", "SVO",
         "fill-frame",
         "low-constant-sound sense forced by 'soft hum filled the room'",
         ""),
        ("Her hum grew louder after midnight.", "SV-temporal",
         "grow-frame",
         "low-constant-sound sense forced by 'hum grew louder after midnight'",
         ""),
    ],
    "inapp": [
        ("The soft hum ate the room.", "SVO",
         "animate-violation",
         "hum (-animate sound) + 'ate' requires +animate subject",
         ""),
        ("Her hum walked louder after midnight.", "SV-temporal",
         "animate-violation-2",
         "hum (-animate sound) + 'walked' requires +animate subject",
         ""),
    ],
}

CAND["uvlt_5k_t03_i03"] = {  # pork (5K noun, pig meat; foil=a)
    "app": [
        ("She grilled some tasty thick pork.", "SVO",
         "grill-frame",
         "pig-meat sense forced by 'grilled some tasty thick pork'",
         ""),
        ("The pork on his plate steamed.", "SV-PP",
         "plate-frame",
         "pig-meat sense forced by 'pork on his plate steamed'",
         ""),
    ],
    "inapp": [
        ("She grilled some tasty laughing pork.", "SVO",
         "animate-violation",
         "pork (-animate meat) + 'laughing' requires +animate modified noun",
         ""),
        ("The hungry pork on his plate steamed.", "SV-PP",
         "animate-violation-2",
         "pork (-animate) + 'hungry' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_5k_t04_i01"] = {  # perfume (5K noun, scent liquid; foil=b)
    "app": [
        ("She sprayed expensive French perfume today.", "SVO-temporal",
         "spray-frame",
         "nice-smelling-liquid sense forced by 'sprayed expensive French perfume today'",
         ""),
        ("The perfume on her wrist smelled sweet.", "SV-AdjP",
         "wrist-frame",
         "nice-smelling-liquid sense forced by 'perfume on her wrist smelled sweet'",
         ""),
    ],
    "inapp": [
        ("She sprayed sleepy French perfume today.", "SVO-temporal",
         "modifier-collocate",
         "'sleepy perfume' non-collocate; perfume modifiers: sweet/strong/expensive/French/heavy/light standard",
         ""),
        ("The hungry perfume on her wrist smelled sweet.", "SV-AdjP",
         "modifier-collocate-2",
         "'hungry perfume' non-collocate; perfume + scent/origin/strength modifier standard",
         ""),
    ],
}

CAND["uvlt_5k_t04_i02"] = {  # wizard (5K noun, magic user; foil=b per draft)
    "app": [
        ("The wizard waved his wooden staff.", "SVO",
         "staff-frame",
         "magic-user sense forced by 'wizard waved his wooden staff'",
         ""),
        ("A wise wizard helped the princess.", "SVO",
         "princess-frame",
         "magic-user sense forced by 'wise wizard helped the princess'",
         ""),
    ],
    "inapp": [
        ("The wizard waved his hungry staff.", "SVO",
         "modifier-collocate",
         "'hungry staff' as wizard-wielded object non-collocate; wizard + wooden/magic/ancient staff standard",
         ""),
        ("A wise wizard rusted the princess.", "SVO",
         "verb-collocate",
         "wizard (+human magical agent) + 'rusted the princess' non-collocate verb frame; wizard + help/save/teach/curse standard",
         ""),
    ],
}

CAND["uvlt_5k_t04_i03"] = {  # sanctuary (5K noun, safe place; foil=b per draft)
    "app": [
        ("This old garden feels like sanctuary.", "SV-PP",
         "garden-frame",
         "safe-place sense forced by 'old garden feels like sanctuary'",
         "bleeds to a (sanctuary = quiet). Intact."),
        ("The bird sanctuary protects many species.", "SVO",
         "bird-frame",
         "safe-place sense forced by 'bird sanctuary protects many species'",
         ""),
    ],
    "inapp": [
        ("This old garden feels like angry sanctuary.", "SV-PP",
         "modifier-collocate",
         "'angry sanctuary' non-collocate; sanctuary modifiers: safe/quiet/peaceful/bird/wildlife standard",
         ""),
        ("The hungry sanctuary protects many species.", "SVO",
         "modifier-collocate-2",
         "'hungry sanctuary' non-collocate; sanctuary + protection-purpose modifier standard",
         ""),
    ],
}

CAND["uvlt_5k_t05_i01"] = {  # altitude (5K noun, height; foil=a)
    "app": [
        ("Planes fly at high cruising altitude.", "SV-PP",
         "cruise-frame",
         "height sense forced by 'planes fly at high cruising altitude'",
         ""),
        ("The altitude here affects her breathing.", "SVO",
         "affect-frame",
         "height sense forced by 'altitude here affects her breathing'",
         ""),
    ],
    "inapp": [
        ("Planes fly at happy cruising altitude.", "SV-PP",
         "animate-violation",
         "altitude (-sentient measure) + 'happy' requires +sentient modified noun",
         ""),
        ("The hungry altitude here affects her breathing.", "SVO",
         "animate-violation-2",
         "altitude (-animate) + 'hungry' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_5k_t05_i02"] = {  # robe (5K noun, clothing; foil=a)
    "app": [
        ("He tied his warm silk robe.", "SVO",
         "tie-frame",
         "clothing sense forced by 'tied his warm silk robe'",
         ""),
        ("The robe on the hook fell.", "SV-PP",
         "hook-frame",
         "clothing sense forced by 'robe on the hook fell'",
         ""),
    ],
    "inapp": [
        ("He tied his laughing silk robe.", "SVO",
         "animate-violation",
         "robe (-animate clothing) + 'laughing' requires +animate modified noun",
         ""),
        ("The hungry robe on the hook fell.", "SV-PP",
         "animate-violation-2",
         "robe (-animate) + 'hungry' requires +animate modified noun",
         ""),
    ],
}

CAND["uvlt_5k_t05_i03"] = {  # pirate (5K noun, ship attacker; foil=a)
    "app": [
        ("The pirate stole all the gold.", "SVO",
         "steal-frame",
         "ship-attacker sense forced by 'pirate stole all the gold'",
         ""),
        ("Each pirate carried a sharp sword.", "SVO",
         "carry-frame",
         "ship-attacker sense forced by 'pirate carried a sharp sword'",
         ""),
    ],
    "inapp": [
        ("The pirate melted all the gold.", "SVO",
         "substance-violation",
         "pirate (+human agent) + 'melted' (+substance process) violates +human-subject selection (agent cannot be the one melting in this frame)",
         ""),
        ("Each pirate rusted a sharp sword.", "SVO",
         "material-violation",
         "pirate (+human) + 'rusted' (material oxidation) violates +human-agent selection",
         ""),
    ],
}

CAND["uvlt_5k_t06_i01"] = {  # notify (5K verb, announce; foil=b)
    "app": [
        ("She must notify her parents immediately.", "SVO-adv",
         "parents-obj",
         "announce sense forced by modal + 'notify her parents immediately'; base form target",
         ""),
        ("Please notify the manager before Friday.", "SVO-PP",
         "manager-obj",
         "announce sense forced by 'notify the manager before Friday'",
         ""),
    ],
    "inapp": [
        ("She must notify her rainbows immediately.", "SVO-adv",
         "object-collocate",
         "'notify rainbows' non-collocate; notify + +human-recipient (parents/police/manager/staff/school) standard",
         ""),
        ("Please notify the manager before rainbow.", "SVO-PP",
         "prep-collocate",
         "'notify before rainbow' non-collocate temporal frame; notify before + date/deadline/event standard",
         ""),
    ],
}

CAND["uvlt_5k_t06_i02"] = {  # intrude (5K verb, enter no permission; foil=b)
    "app": [
        ("He intruded into her private life.", "SV-PP",
         "life-obj",
         "enter-without-permission sense forced by 'intruded into her private life'",
         ""),
        ("Reporters intruded into the family home.", "SV-PP",
         "home-obj",
         "enter-without-permission sense forced by 'reporters intruded into the family home'",
         ""),
    ],
    "inapp": [
        ("He intruded into her private rainbow.", "SV-PP",
         "prep-collocate",
         "'intrude into rainbow' non-collocate; intrude into + privacy/meeting/life/conversation/space/home standard",
         ""),
        ("Reporters intruded into the thunder home.", "SV-PP",
         "modifier-collocate",
         "'thunder home' as intrude-target non-collocate modifier; intrude into + possessable-space standard",
         ""),
    ],
}

CAND["uvlt_5k_t06_i03"] = {  # erase (5K verb, remove; foil=b)
    "app": [
        ("She erased all the old files.", "SVO",
         "files-obj",
         "remove sense forced by 'erased all the old files'",
         ""),
        ("He erased her name from list.", "SVO-PP",
         "name-obj",
         "remove sense forced by 'erased her name from list'",
         ""),
    ],
    "inapp": [
        ("She erased all the old rainbows.", "SVO",
         "object-collocate",
         "'erase rainbow' non-collocate; erase notes/memories/data/mark/name/board/file standard",
         ""),
        ("He erased her thunder from list.", "SVO-PP",
         "object-collocate-2",
         "'erase thunder' non-collocate; erase + recordable/written item standard",
         ""),
    ],
}

CAND["uvlt_5k_t07_i01"] = {  # shred (5K verb, tear small; foil=b)
    "app": [
        ("She shredded the old receipts carefully.", "SVO-adv",
         "receipt-obj",
         "tear-into-pieces sense forced by 'shredded the old receipts carefully'",
         "metaphor risk (shred dreams). Using +substance obj."),
        ("The machine shredded all the documents.", "SVO",
         "document-obj",
         "tear-into-pieces sense forced by 'machine shredded all the documents'",
         ""),
    ],
    "inapp": [
        ("She shredded the old rainbows carefully.", "SVO-adv",
         "object-collocate",
         "'shred rainbows' non-collocate physical sense; shred paper/document/cheese/cabbage/receipt standard",
         ""),
        ("The machine shredded all the whispers.", "SVO",
         "object-collocate-2",
         "'shred whispers' non-collocate literal sense; shred + +physical-material object standard",
         ""),
    ],
}

CAND["uvlt_5k_t07_i02"] = {  # expire (5K verb, end; foil=b per draft)
    "app": [
        ("His passport expires next summer already.", "SV-temporal",
         "passport-subj",
         "end sense forced by 'passport expires next summer already'",
         ""),
        ("Her contract expired before the holiday.", "SV-PP",
         "contract-subj",
         "end sense forced by 'contract expired before the holiday'",
         ""),
    ],
    "inapp": [
        ("His rainbow expires next summer already.", "SV-temporal",
         "subject-collocate",
         "'rainbow expires' non-collocate; expire + visa/contract/passport/license/membership/food standard",
         ""),
        ("Her thunder expired before the holiday.", "SV-PP",
         "subject-collocate-2",
         "'thunder expired' non-collocate; expire + legally-time-bound document/status standard",
         ""),
    ],
}

CAND["uvlt_5k_t07_i03"] = {  # meditate (5K verb, think deep; foil=b per draft)
    "app": [
        ("He meditated silently under the tree.", "SV-adv-PP",
         "silent-frame",
         "think-deeply sense forced by 'meditated silently under the tree'",
         ""),
        ("Monks meditated daily in their hall.", "SV-adv-PP",
         "daily-frame",
         "think-deeply sense forced by 'monks meditated daily in their hall'",
         ""),
    ],
    "inapp": [
        ("He meditated angrily under the tree.", "SV-adv-PP",
         "adverb-collocate",
         "'meditate angrily' non-collocate; meditate quietly/silently/deeply/alone/daily standard",
         ""),
        ("Monks meditated hungrily in their hall.", "SV-adv-PP",
         "adverb-collocate-2",
         "'meditate hungrily' non-collocate; meditate + manner-of-calm/stillness adverb standard",
         ""),
    ],
}

CAND["uvlt_5k_t08_i01"] = {  # ignite (5K verb, catch fire; foil=b per draft)
    "app": [
        ("The match ignited the dry paper.", "SVO",
         "paper-obj",
         "catch-fire sense forced by +fire-source 'match' + 'dry paper'",
         "metaphor risk (ignite a dream). Using +substance obj."),
        ("The stove ignited the small twigs.", "SVO",
         "twig-obj",
         "catch-fire sense forced by +fire-source 'stove' + 'small twigs'",
         ""),
    ],
    "inapp": [
        ("The match ignited the dry rainbow.", "SVO",
         "object-collocate",
         "'ignite rainbow' non-collocate literal sense; ignite paper/fire/gas/fuel/wood/flame standard",
         ""),
        ("The stove ignited the small whispers.", "SVO",
         "object-collocate-2",
         "'ignite whispers' non-collocate literal sense; ignite + flammable-substance object standard",
         ""),
    ],
}

CAND["uvlt_5k_t08_i02"] = {  # swap (5K verb, exchange; foil=b)
    "app": [
        ("Children swapped stickers during the break.", "SVO-PP",
         "sticker-obj",
         "exchange sense forced by 'children swapped stickers during the break'",
         ""),
        ("They swapped phone numbers after class.", "SVO-PP",
         "number-obj",
         "exchange sense forced by 'swapped phone numbers after class'",
         ""),
    ],
    "inapp": [
        ("Children swapped rainbows during the break.", "SVO-PP",
         "object-collocate",
         "'swap rainbows' non-collocate; swap seats/places/stories/numbers/gifts/jobs/stickers standard",
         ""),
        ("They swapped thunder numbers after class.", "SVO-PP",
         "modifier-collocate",
         "'thunder numbers' non-collocate modifier; swap + phone/house/student/lottery-number standard",
         ""),
    ],
}

CAND["uvlt_5k_t08_i03"] = {  # pierce (5K verb, go through; foil=b per draft)
    "app": [
        ("The thorn pierced her thin sleeve.", "SVO",
         "sleeve-obj",
         "go-through sense forced by +sharp 'thorn' + 'thin sleeve'",
         ""),
        ("A needle pierced his rough palm.", "SVO",
         "palm-obj",
         "go-through sense forced by +sharp 'needle' + 'rough palm'",
         ""),
    ],
    "inapp": [
        ("The thorn pierced her thin rainbow.", "SVO",
         "object-collocate",
         "'pierce rainbow' non-collocate literal sense; pierce skin/ear/hole/heart/shoe/cloth standard",
         ""),
        ("A needle pierced his rough whisper.", "SVO",
         "object-collocate-2",
         "'pierce whisper' non-collocate; pierce + +physical/+piercable object standard",
         ""),
    ],
}

CAND["uvlt_5k_t09_i01"] = {  # tranquil (5K adj, calm; foil=a)
    "app": [
        ("The tranquil forest soothed her mind.", "SVO",
         "forest-frame",
         "calm-and-quiet sense forced by +peaceful-place 'forest' + 'soothed her mind'",
         ""),
        ("Their tranquil garden welcomed tired visitors.", "SVO",
         "garden-frame",
         "calm-and-quiet sense forced by +peaceful-place 'garden' + 'welcomed tired visitors'",
         ""),
    ],
    "inapp": [
        ("The tranquil battle soothed her mind.", "SVO",
         "peaceful-violation",
         "tranquil requires +peaceful-entity; 'battle' is +conflict, core-meaning contradiction",
         ""),
        ("Their tranquil war welcomed tired visitors.", "SVO",
         "peaceful-violation-2",
         "tranquil requires +peaceful-entity; 'war' is +conflict, contradicts core meaning",
         ""),
    ],
}

CAND["uvlt_5k_t09_i02"] = {  # bald (5K adj, no hair; foil=a)
    "app": [
        ("The bald child laughed in joy.", "SV-PP",
         "child-frame",
         "no-hair sense forced by +human 'child' + 'laughed in joy'",
         ""),
        ("Her bald grandfather smiled at her.", "SV-PP",
         "grandfather-frame",
         "no-hair sense forced by +human 'grandfather' + 'smiled at her'",
         ""),
    ],
    "inapp": [
        ("The bald cloud laughed in joy.", "SV-PP",
         "body-violation",
         "bald requires +hair-capable body surface; 'cloud' is -physical-body natural phenomenon",
         ""),
        ("Her bald triangle smiled at her.", "SV-PP",
         "body-violation-2",
         "bald requires +hair-capable head; 'triangle' is -biological shape",
         ""),
    ],
}

CAND["uvlt_5k_t09_i03"] = {  # moist (5K adj, slightly wet; foil=a)
    "app": [
        ("The moist bread tasted really fresh.", "SVC",
         "bread-frame",
         "slightly-wet sense forced by +food 'bread' + 'tasted really fresh'",
         ""),
        ("She found the moist soil helpful.", "SVO",
         "soil-frame",
         "slightly-wet sense forced by +substance 'soil' as inner NP; target non-initial",
         ""),
    ],
    "inapp": [
        ("The moist opinion tasted really fresh.", "SVC",
         "substance-violation",
         "moist requires +substance/+physical; 'opinion' is -substance abstract",
         ""),
        ("She found the moist silence helpful.", "SVO",
         "substance-violation-2",
         "moist requires +substance; 'silence' is -substance abstract",
         ""),
    ],
}

CAND["uvlt_5k_t10_i01"] = {  # tame (5K adj, not dangerous; foil=a)
    "app": [
        ("The tame horse walked beside him.", "SV-PP",
         "horse-frame",
         "not-dangerous sense forced by +animal 'horse' + 'walked beside him'",
         ""),
        ("A tame rabbit slept inside the basket.", "SV-PP",
         "rabbit-frame",
         "not-dangerous sense forced by +animal 'rabbit' + 'slept inside the basket'",
         ""),
    ],
    "inapp": [
        ("The tame cloud walked beside him.", "SV-PP",
         "animal-violation",
         "tame requires +animal; 'cloud' is -animal natural phenomenon",
         ""),
        ("A tame triangle slept inside the basket.", "SV-PP",
         "animal-violation-2",
         "tame requires +animal; 'triangle' is -animal geometric",
         ""),
    ],
}

CAND["uvlt_5k_t10_i03"] = {  # prudent (5K adj, good judgment; foil=a)
    "app": [
        ("Her prudent decision helped the company.", "SVO",
         "decision-frame",
         "using-good-judgment sense forced by +agent-output 'decision' + 'helped the company'",
         ""),
        ("His prudent advice saved many lives.", "SVO",
         "advice-frame",
         "using-good-judgment sense forced by +agent-output 'advice' + 'saved many lives'",
         ""),
    ],
    "inapp": [
        ("Her prudent rainbow helped the company.", "SVO",
         "agent-violation",
         "prudent requires +agent/+deliberate-output; 'rainbow' is -agent natural phenomenon",
         ""),
        ("His prudent thunder saved many lives.", "SVO",
         "agent-violation-2",
         "prudent requires +agent-decision; 'thunder' is -agent weather phenomenon",
         ""),
    ],
}

# ----------------------------------------------------------------------------
# Build the output
# ----------------------------------------------------------------------------

COLUMNS = [
    "item_id", "target_word", "target_level", "target_POS", "tested_sense_desc",
    "condition", "foil_type", "foil_subtype", "review_priority", "ljt_eligibility",
    "candidate_id", "sentence_text", "syntactic_frame", "rationale", "known_risks",
    "approach_label", "llm_draft_version",
]


def main() -> None:
    with DRAFT.open(encoding="utf-8") as f:
        draft_rows = list(csv.DictReader(f))

    # Group draft by (item_id, condition)
    from collections import defaultdict
    draft_by_key: dict[tuple[str, str], dict] = {}
    for r in draft_rows:
        draft_by_key[(r["item_id"], r["condition"])] = r

    # Emit 858 rows
    out_rows = []
    seen_items: set[str] = set()
    for (item_id, condition), draft in draft_by_key.items():
        seen_items.add(item_id)
    seen_items_sorted = sorted(seen_items,
                               key=lambda s: (s.split("_")[1], s.split("_")[2], s.split("_")[3]))

    missing = []
    for item_id in seen_items_sorted:
        if item_id not in CAND:
            missing.append(item_id)
    if missing:
        print(f"Missing candidates for items: {missing}")
        raise SystemExit(1)

    for item_id in seen_items_sorted:
        for condition_key, app_key in [("appropriate", "app"), ("inappropriate", "inapp")]:
            draft = draft_by_key[(item_id, condition_key)]
            cand_entries = CAND[item_id][app_key]
            if len(cand_entries) != 2:
                print(f"Need exactly 2 new candidates for {item_id}/{condition_key}, got {len(cand_entries)}")
                raise SystemExit(1)

            # Row A: candidate_id=1 verbatim
            row1 = {
                "item_id": draft["item_id"],
                "target_word": draft["target_word"],
                "target_level": draft["target_level"],
                "target_POS": draft["target_POS"],
                "tested_sense_desc": draft["tested_sense_desc"],
                "condition": draft["condition"],
                "foil_type": draft["foil_type"],
                "foil_subtype": draft["foil_subtype"],
                "review_priority": draft["review_priority"],
                "ljt_eligibility": draft["ljt_eligibility"],
                "candidate_id": "1",
                "sentence_text": draft["sentence_text"],
                "syntactic_frame": draft["syntactic_frame"],
                "rationale": draft["rationale"],
                "known_risks": draft["known_risks"],
                "approach_label": "draft-v1",
                "llm_draft_version": draft["llm_draft_version"],
            }
            out_rows.append(row1)

            for i, (sent, frame, approach, rationale, risks) in enumerate(cand_entries, start=2):
                row = {
                    "item_id": draft["item_id"],
                    "target_word": draft["target_word"],
                    "target_level": draft["target_level"],
                    "target_POS": draft["target_POS"],
                    "tested_sense_desc": draft["tested_sense_desc"],
                    "condition": draft["condition"],
                    "foil_type": draft["foil_type"],
                    "foil_subtype": draft["foil_subtype"],
                    "review_priority": draft["review_priority"],
                    "ljt_eligibility": draft["ljt_eligibility"],
                    "candidate_id": str(i),
                    "sentence_text": sent,
                    "syntactic_frame": frame,
                    "rationale": rationale,
                    "known_risks": risks,
                    "approach_label": approach,
                    "llm_draft_version": VERSION,
                }
                out_rows.append(row)

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for r in out_rows:
            w.writerow(r)

    print(f"Wrote {len(out_rows)} rows to {OUT}")


if __name__ == "__main__":
    main()
