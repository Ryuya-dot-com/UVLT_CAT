/*
 * UVLT-LJT (Lexicosemantic Judgement Task) — browser module
 * ----------------------------------------------------------
 * Implementation reference: App_CAT/ljt/design_ljt_spec.md v0.5
 *   §6  individual target sampling (CAT_correct ∪ theta_pad)
 *   §7  timing + replay telemetry (AudioContext.currentTime basis)
 *   §8  audio preload (fetch + decodeAudioData, 100 files total)
 *   §9  logging schema (ljt_log / ljt_summary / ljt_session_meta)
 *   §10 screen flow + headphone check (L/R/both 3-tone, 3/3 pass)
 *   §13 CONFIG keys + storageKey v2
 *   §14 practice item list (10 items × 2 conditions)
 *
 * Exposed as window.UVLT_LJT with methods:
 *   init(config), isEnabled(), isSessionComplete(session), startPhase(session),
 *   loadSentences(), sampleLJTTargets(session, targetN),
 *   buildExcelSheets(session)
 *
 * Internal classes (not exported directly):
 *   LJTController   — AudioContext-based trial timing (§7.2 pseudocode)
 *   LJTScorer       — Hautus log-linear d' (§9.2)
 *   HeadphoneChecker— programmatic L/R/both tone check (§10.2)
 *
 * Constraints:
 *   - Vanilla ES6+, no build step, no external libs
 *   - Safari/iOS: AudioContext.resume() MUST be invoked from a user-gesture handler
 *   - CSV parsing: built-in mini parser (handles quotes + commas-in-quotes)
 *   - Preload failures surface a clear researcher-visible error
 */
(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Module-private state
  // ------------------------------------------------------------------
  let CONFIG_REF = null;      // reference to main CONFIG, wired via init()
  let SENTENCE_BANK = null;   // { main: Map<item_id, { app, inapp }>, practice: Array }
  let AUDIO_META = null;      // Map<audio_file, { duration_ms, sha256, ... }>
  let state = null;           // per-session runtime state (controller, scorer, UI refs)
  // R1: linked-difficulty lookup supplied by main app (script.js) so that
  //     sampleLJTTargets() can apply the |linked_difficulty - theta_hat| <= 0.5
  //     neighborhood filter from spec §6.1 without duplicating the test bank
  //     inside the module.
  let ITEM_DIFFICULTY_MAP = null;  // { item_id: Number(linkedDifficulty) }

  // ------------------------------------------------------------------
  // Practice items (§14, v0.5). Kept in-module so the app works even if
  // the CSV fetch fails — these 10 items are spec-authoritative.
  // ------------------------------------------------------------------
  const PRACTICE_ITEMS = [
    { item_id: "p01", target_word: "eat",      target_POS: "verb", foil_type: "a_selectional",
      appropriate: "She eats fresh vegetables every day.",
      inappropriate: "She eats fresh silence every day." },
    { item_id: "p02", target_word: "jump",     target_POS: "verb", foil_type: "a_selectional",
      appropriate: "The children jump on the mattress loudly.",
      inappropriate: "The opinions jump on the mattress loudly." },
    { item_id: "p03", target_word: "sing",     target_POS: "verb", foil_type: "a_selectional",
      appropriate: "They sing old songs on weekends.",
      inappropriate: "They sing old bricks on weekends." },
    { item_id: "p04", target_word: "buy",      target_POS: "verb", foil_type: "a_selectional",
      appropriate: "She buys fresh fish at the market.",
      inappropriate: "She buys fresh darkness at the market." },
    { item_id: "p05", target_word: "meet",     target_POS: "verb", foil_type: "a_selectional",
      appropriate: "We met our teacher in the library.",
      inappropriate: "We met our sunlight in the library." },
    { item_id: "p06", target_word: "start",    target_POS: "verb", foil_type: "a_selectional",
      appropriate: "The game starts at seven tonight.",
      inappropriate: "The table starts at seven tonight." },
    { item_id: "p07", target_word: "cook",     target_POS: "verb", foil_type: "a_selectional",
      appropriate: "She cooks dinner for her family.",
      inappropriate: "She cooks thunder for her family." },
    { item_id: "p08", target_word: "listen",   target_POS: "verb", foil_type: "a_selectional",
      appropriate: "She listens to music after dinner.",
      inappropriate: "She listens to colors after dinner." },
    { item_id: "p09", target_word: "distance", target_POS: "noun", foil_type: "b_collocation",
      appropriate: "The distance to the station is long.",
      inappropriate: "The distance to the station is tall." },
    { item_id: "p10", target_word: "smile",    target_POS: "noun", foil_type: "b_collocation",
      appropriate: "Her smile looked very warm tonight.",
      inappropriate: "Her smile looked very rectangular tonight." }
  ];

  // ------------------------------------------------------------------
  // CSV parsing (handles commas inside double-quoted fields, escaped "")
  // ------------------------------------------------------------------
  function clonePlain(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function getResponseMode() {
    return (CONFIG_REF && CONFIG_REF.LJT_RESPONSE_MODE) || "timed";
  }

  function isUntimedMode() {
    return getResponseMode() === "untimed";
  }

  function isReplayEnabled() {
    return !!(CONFIG_REF && CONFIG_REF.LJT_ALLOW_REPLAY);
  }

  function isResearcherMode() {
    try {
      if (window.UVLT_CAT_UI && typeof window.UVLT_CAT_UI.isResearcherMode === "function") {
        return !!window.UVLT_CAT_UI.isResearcherMode();
      }
    } catch (e) {
      /* ignore */
    }

    try {
      return !!(document.body && document.body.classList.contains("researcher-mode"));
    } catch (e) {
      return false;
    }
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    const n = text.length;

    while (i < n) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < n && text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      // not in quotes
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        i += 1;
        continue;
      }
      if (ch === "\r") {
        // swallow CR; LF will handle row close
        i += 1;
        continue;
      }
      if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
    }
    // tail
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function csvToObjects(text) {
    const rows = parseCSV(text);
    if (rows.length === 0) return [];
    const header = rows[0].map(function (h) { return h.trim(); });
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const raw = rows[r];
      if (raw.length === 1 && raw[0] === "") continue;  // blank line
      const obj = {};
      for (let c = 0; c < header.length; c++) {
        obj[header[c]] = raw[c] == null ? "" : raw[c];
      }
      out.push(obj);
    }
    return out;
  }

  function audioMetaKey(itemId, condition) {
    const id = String(itemId || "").trim();
    const cond = String(condition || "").trim().toLowerCase();
    if (!id || !cond) return "";
    return id + "|" + cond;
  }

  function normalizeAudioMetaPath(audioFile) {
    const raw = String(audioFile || "").trim().replace(/\\/g, "/");
    if (!raw) return null;
    if (/^(https?:)?\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return raw;
    if (raw.startsWith("./ljt/")) return raw;
    if (raw.startsWith("ljt/")) return "./" + raw;
    if (raw.startsWith("./audio/")) return "./ljt/" + raw.slice(2);
    if (raw.startsWith("audio/")) return "./ljt/" + raw;
    return "./ljt/" + raw.replace(/^\.\//, "");
  }

  function resolveAudioPath(audioMetaByItemCondition, itemId, condition, fallbackPath, altItemId) {
    const candidates = [itemId, altItemId];
    for (let i = 0; i < candidates.length; i++) {
      const key = audioMetaKey(candidates[i], condition);
      if (key && audioMetaByItemCondition.has(key)) {
        return audioMetaByItemCondition.get(key);
      }
    }
    return fallbackPath;
  }

  // ------------------------------------------------------------------
  // Sentence / audio-meta loading
  // ------------------------------------------------------------------
  async function loadSentences() {
    if (SENTENCE_BANK) return SENTENCE_BANK;

    const sentencePromise = fetch("./ljt/ljt_sentences_draft.csv")
      .then(function (r) {
        if (!r.ok) throw new Error("sentences CSV fetch failed (" + r.status + ")");
        return r.text();
      })
      .then(csvToObjects)
      .catch(function (e) {
        console.warn("[LJT] sentence CSV load failed:", e);
        return [];
      });

    const audioMetaPromise = fetch("./ljt/audio_meta.csv")
      .then(function (r) {
        if (!r.ok) throw new Error("audio_meta CSV fetch failed (" + r.status + ")");
        return r.text();
      })
      .then(csvToObjects)
      .catch(function () {
        // audio_meta is optional at first load — empty map is fine
        return [];
      });

    // R2: Load the authoritative v0.5 practice CSV (20 rows = 10 items × 2 conditions).
    // If the fetch fails (e.g., missing file during local debugging), we fall back
    // to the in-module PRACTICE_ITEMS (spec §14 table) so the app still runs.
    const practicePromise = fetch("./ljt/practice_sentences_v0.5.csv")
      .then(function (r) {
        if (!r.ok) throw new Error("practice CSV fetch failed (" + r.status + ")");
        return r.text();
      })
      .then(csvToObjects)
      .catch(function (e) {
        console.warn("[LJT] practice CSV load failed, using in-module fallback:", e);
        return [];
      });

    const [rows, metaRows, practiceRows] = await Promise.all(
      [sentencePromise, audioMetaPromise, practicePromise]);

    const audioMetaByItemCondition = new Map();
    metaRows.forEach(function (row) {
      const key = audioMetaKey(row.item_id, row.condition);
      const normalizedPath = normalizeAudioMetaPath(row.audio_file);
      if (key && normalizedPath) {
        audioMetaByItemCondition.set(key, normalizedPath);
      }
    });

    // Build main-item bank keyed by item_id
    const main = new Map();
    rows.forEach(function (row) {
      const itemId = row.item_id;
      if (!itemId || itemId.indexOf("uvlt_") !== 0) return;
      if (!main.has(itemId)) {
        main.set(itemId, {
          item_id: itemId,
          target_word: row.target_word,
          target_level: row.target_level,
          target_POS: row.target_POS,
          tested_sense_desc: row.tested_sense_desc,
          ljt_eligibility: row.ljt_eligibility || "eligible",
          review_priority: row.review_priority || "routine",
          appropriate: null,
          inappropriate: null
        });
      }
      const entry = main.get(itemId);
      if (row.condition === "appropriate") {
        entry.appropriate = {
          sentence_text: row.sentence_text,
          foil_type: row.foil_type || "NA",
          foil_subtype: row.foil_subtype || "",
          audio_file: resolveAudioPath(
            audioMetaByItemCondition,
            itemId,
            "appropriate",
            "./ljt/audio/" + itemId + "_appropriate.wav"
          )
        };
      } else if (row.condition === "inappropriate") {
        entry.inappropriate = {
          sentence_text: row.sentence_text,
          foil_type: row.foil_type || "NA",
          foil_subtype: row.foil_subtype || "",
          audio_file: resolveAudioPath(
            audioMetaByItemCondition,
            itemId,
            "inappropriate",
            "./ljt/audio/" + itemId + "_inappropriate.wav"
          )
        };
      }
    });

    // ------------------------------------------------------------------
    // R2 / spec §14: Practice items from practice_sentences_v0.5.csv.
    //   CSV has 20 rows keyed by <base>_<app|inapp>, e.g. p01_app / p01_inapp.
    //   We fold them back into 10 entries (each with .appropriate + .inappropriate)
    //   so downstream buildPracticeTrialPlan can emit 20 trials.
    //   CSV-missing fallback: spec-authoritative PRACTICE_ITEMS.
    // ------------------------------------------------------------------
    let practice;
    if (practiceRows && practiceRows.length > 0) {
      const byBase = new Map();
      practiceRows.forEach(function (row) {
        const rawId = (row.item_id || "").trim();
        if (!rawId) return;
        // Accept "p01_app" / "p01_inapp" / "p01_appropriate" / "p01_inappropriate"
        // and bare "p01" (use row.condition if present).
        let baseId = rawId;
        const suffixMatch = rawId.match(/^(.*?)_(appropriate|app|inappropriate|inapp)$/i);
        let condition = (row.condition || "").trim().toLowerCase();
        if (suffixMatch) {
          baseId = suffixMatch[1];
          const sfx = suffixMatch[2].toLowerCase();
          if (!condition) condition = (sfx === "app" || sfx === "appropriate")
            ? "appropriate" : "inappropriate";
        }
        if (!condition) return;  // can't place row without a condition
        if (!byBase.has(baseId)) {
          byBase.set(baseId, {
            item_id: baseId,
            target_word: row.target_word || "",
            target_level: row.target_level || "practice",
            target_POS: row.target_POS || "",
            foil_type: null,   // filled from the inappropriate row below
            appropriate: null,
            inappropriate: null
          });
        }
        const entry = byBase.get(baseId);
        const audioFile = resolveAudioPath(
          audioMetaByItemCondition,
          baseId,
          condition,
          "./ljt/audio/practice/" + baseId +
            (condition === "appropriate" ? "_appropriate.wav" : "_inappropriate.wav"),
          rawId
        );
        if (condition === "appropriate") {
          entry.appropriate = {
            sentence_text: row.sentence_text || "",
            foil_type: "NA",
            audio_file: audioFile
          };
        } else {
          entry.inappropriate = {
            sentence_text: row.sentence_text || "",
            foil_type: row.foil_type || "a_selectional",
            audio_file: audioFile
          };
          if (!entry.foil_type) entry.foil_type = row.foil_type || "a_selectional";
        }
      });
      practice = Array.from(byBase.values())
        // Keep only entries that have both conditions — a practice trial pair
        // requires both for the random assignment to work.
        .filter(function (e) { return e.appropriate && e.inappropriate; });
      // Preserve CSV ordering by item_id
      practice.sort(function (a, b) {
        return String(a.item_id).localeCompare(String(b.item_id));
      });
    }

    // Fall back to spec-authoritative in-module list if CSV absent/empty.
    if (!practice || practice.length === 0) {
      practice = PRACTICE_ITEMS.map(function (p) {
        return {
          item_id: p.item_id,
          target_word: p.target_word,
          target_level: "practice",
          target_POS: p.target_POS,
          foil_type: p.foil_type,
          appropriate: {
            sentence_text: p.appropriate,
            foil_type: "NA",
            audio_file: "./ljt/audio/practice/" + p.item_id + "_appropriate.wav"
          },
          inappropriate: {
            sentence_text: p.inappropriate,
            foil_type: p.foil_type,
            audio_file: "./ljt/audio/practice/" + p.item_id + "_inappropriate.wav"
          }
        };
      });
    }

    // Audio meta keyed by audio_file basename
    const audioMeta = new Map();
    metaRows.forEach(function (row) {
      const normalizedPath = normalizeAudioMetaPath(row.audio_file);
      if (!normalizedPath) return;
      audioMeta.set(normalizedPath, {
        duration_ms: Number(row.duration_ms) || null,
        peak_dbfs: Number(row.peak_dbfs) || null,
        integrated_lufs: Number(row.integrated_lufs) || null,
        sha256: row.sha256 || "",
        tts_voice: row.tts_voice || "",
        tts_speaking_rate: row.tts_speaking_rate || ""
      });
    });

    SENTENCE_BANK = { main: main, practice: practice };
    AUDIO_META = audioMeta;
    return SENTENCE_BANK;
  }

  // ------------------------------------------------------------------
  // Helper: derive theta_hat (CAT final linked θ estimate) from session.
  //   Preferred path: latest estimate's linked Rasch theta (scale matches
  //   item.linkedDifficulty used in the main bank). Fallback to raw theta
  //   if linked is unavailable (for back-compat with legacy payloads).
  // ------------------------------------------------------------------
  function extractThetaHat(session) {
    if (!session || !Array.isArray(session.estimates) || session.estimates.length === 0) {
      return null;
    }
    const last = session.estimates[session.estimates.length - 1];
    if (last == null) return null;
    if (typeof last.linkedRaschTheta === "number" && isFinite(last.linkedRaschTheta)) {
      return last.linkedRaschTheta;
    }
    if (typeof last.theta === "number" && isFinite(last.theta)) {
      return last.theta;
    }
    return null;
  }

  // ------------------------------------------------------------------
  // §6: sampleLJTTargets
  //   S_correct     = CAT-correct UVLT items (eligible only)
  //   S_eligible    = items with ljt_eligibility ∈ {eligible, careful}
  //   If |S_correct| >= target_N: stratify-sample target_N
  //   Else (spec §6.1):
  //     base       := S_correct
  //     pad_N      := target_N - |base|
  //     theta_hat  := CAT final θ (linked scale)
  //     S_pad_cand := S_eligible - administered,
  //                   filtered by |linked_difficulty - theta_hat| <= 0.5
  //     If |S_pad_cand| < pad_N, widen neighborhood to ±1.0, then ±1.5,
  //     logging the widening so researchers see when the ±0.5 window was
  //     insufficient. After widening, stratify-sample pad_N.
  //   Targets_meta (written to state.session.ljt.targets_meta) records
  //   theta_hat, chosen neighborhood width, counts per widening step.
  // ------------------------------------------------------------------
  function sampleLJTTargets(session, targetN) {
    targetN = targetN || (CONFIG_REF && CONFIG_REF.LJT_TARGET_N) || 40;
    if (!SENTENCE_BANK) {
      throw new Error("sampleLJTTargets: call loadSentences() first");
    }

    const mainBank = SENTENCE_BANK.main;
    const eligibleItemIds = [];
    mainBank.forEach(function (entry, itemId) {
      const el = (entry.ljt_eligibility || "").toLowerCase();
      if (el === "eligible" || el === "careful") {
        if (entry.appropriate && entry.inappropriate) {
          eligibleItemIds.push(itemId);
        }
      }
    });
    const eligibleSet = new Set(eligibleItemIds);

    // Administered item IDs (all CAT items shown)
    const administered = new Set();
    const correct = [];
    const correctSet = new Set();
    (session && session.responses ? session.responses : []).forEach(function (resp) {
      if (resp && resp.itemId) {
        administered.add(resp.itemId);
        if (resp.correct && !correctSet.has(resp.itemId) && eligibleSet.has(resp.itemId)) {
          correctSet.add(resp.itemId);
          correct.push(resp.itemId);
        }
      }
    });

    const targetsBase = correct.slice();
    const sources = {};

    // R1: theta-pad sampling metadata for logging (spec §6.1, §6.3).
    const targetsMeta = {
      theta_hat: null,
      neighborhood_widths_tried: [],   // e.g. [0.5, 1.0] when 0.5 was insufficient
      neighborhood_width_used: null,
      pad_candidates_at_05: null,
      pad_candidates_at_10: null,
      pad_candidates_at_15: null,
      pad_candidates_all_fallback: null,
      pad_needed: 0,
      pad_chosen: 0,
      widening_triggered: false,
      notes: ""
    };

    let chosen;
    if (targetsBase.length >= targetN) {
      chosen = stratifiedSampleByBand(targetsBase, targetN, mainBank);
      chosen.forEach(function (id) { sources[id] = "CAT_correct"; });
      targetsMeta.notes = "|CAT_correct| >= target_N; no theta_pad used.";
    } else {
      const padN = targetN - targetsBase.length;
      targetsMeta.pad_needed = padN;

      const thetaHat = extractThetaHat(session);
      targetsMeta.theta_hat = thetaHat;

      const basePadPool = eligibleItemIds.filter(function (id) {
        return !administered.has(id);
      });

      // Compute candidate counts at each widening step so researchers see
      // whether ±0.5 was insufficient even when we successfully widened.
      const WIDENING_STEPS = [0.5, 1.0, 1.5];
      let padCandidates = [];
      let widthUsed = null;

      if (ITEM_DIFFICULTY_MAP && thetaHat != null && isFinite(thetaHat)) {
        for (let i = 0; i < WIDENING_STEPS.length; i++) {
          const w = WIDENING_STEPS[i];
          const candidates = basePadPool.filter(function (id) {
            const d = ITEM_DIFFICULTY_MAP[id];
            if (typeof d !== "number" || !isFinite(d)) return false;
            return Math.abs(d - thetaHat) <= w;
          });
          if (w === 0.5)  targetsMeta.pad_candidates_at_05 = candidates.length;
          if (w === 1.0)  targetsMeta.pad_candidates_at_10 = candidates.length;
          if (w === 1.5)  targetsMeta.pad_candidates_at_15 = candidates.length;

          targetsMeta.neighborhood_widths_tried.push(w);
          if (candidates.length >= padN) {
            padCandidates = candidates;
            widthUsed = w;
            break;
          }
          // else: log that this width was insufficient, try the next.
          targetsMeta.widening_triggered = true;
          try {
            console.warn("[LJT][sampleLJTTargets] ±" + w +
              " neighborhood insufficient (" + candidates.length +
              " < pad_N=" + padN + "); widening.");
          } catch (e) { /* ignore logging failure */ }
        }

        // Fallback: if even ±1.5 had fewer than pad_N, take the ±1.5 set
        // (or the full non-administered eligible pool if nothing matched).
        if (padCandidates.length < padN) {
          const wide = basePadPool.filter(function (id) {
            const d = ITEM_DIFFICULTY_MAP[id];
            if (typeof d !== "number" || !isFinite(d)) return false;
            return Math.abs(d - thetaHat) <= 1.5;
          });
          targetsMeta.pad_candidates_all_fallback = basePadPool.length;
          if (wide.length > 0) {
            padCandidates = wide;
            widthUsed = 1.5;
            targetsMeta.notes =
              "±1.5 still < pad_N; using all ±1.5 candidates (may under-fill).";
          } else {
            padCandidates = basePadPool.slice();
            widthUsed = Infinity;
            targetsMeta.notes =
              "No candidates in ±1.5 of theta_hat; falling back to full " +
              "non-administered eligible pool.";
          }
        }
      } else {
        // No theta / no difficulty map: legacy behaviour (stratify over all
        // non-administered eligible items). Flag this in meta so downstream
        // analysis can see that the §6.1 neighborhood rule wasn't applied.
        padCandidates = basePadPool;
        widthUsed = null;
        targetsMeta.notes = ITEM_DIFFICULTY_MAP
          ? "theta_hat unavailable; neighborhood filter skipped."
          : "ITEM_DIFFICULTY_MAP unset; neighborhood filter skipped.";
      }

      targetsMeta.neighborhood_width_used = widthUsed;

      const padChosen = stratifiedSampleByBand(padCandidates, padN, mainBank);
      targetsMeta.pad_chosen = padChosen.length;

      chosen = targetsBase.concat(padChosen);
      targetsBase.forEach(function (id) { sources[id] = "CAT_correct"; });
      padChosen.forEach(function (id) { sources[id] = "theta_pad"; });
    }

    // Expose meta for the caller (persisted on session.ljt.targets_meta via
    // startPhase). Stored on the session here if session.ljt already exists.
    if (session && session.ljt) {
      session.ljt.targets_meta = targetsMeta;
    }

    // Build trial plan: each target emits 2 trials (app + inapp), later shuffled
    const targets = chosen.map(function (itemId) {
      const entry = mainBank.get(itemId);
      return {
        item_id: itemId,
        target_word: entry.target_word,
        target_level: entry.target_level,
        target_POS: entry.target_POS,
        tested_sense_desc: entry.tested_sense_desc,
        source: sources[itemId],
        sampling_strata: entry.target_level,
        eligible_at_sampling: true,
        linked_difficulty: ITEM_DIFFICULTY_MAP ? (ITEM_DIFFICULTY_MAP[itemId] || null) : null,
        sampled_at: new Date().toISOString()
      };
    });

    return targets;
  }

  function stratifiedSampleByBand(itemIds, n, mainBank) {
    if (n <= 0 || itemIds.length === 0) return [];
    // group by level
    const groups = { "1K": [], "2K": [], "3K": [], "4K": [], "5K": [] };
    itemIds.forEach(function (id) {
      const e = mainBank.get(id);
      const lvl = e && e.target_level ? e.target_level.toUpperCase() : "1K";
      (groups[lvl] || (groups[lvl] = [])).push(id);
    });
    const bands = Object.keys(groups).filter(function (b) { return groups[b].length > 0; });
    if (bands.length === 0) return [];

    // proportional allocation
    const total = itemIds.length;
    const alloc = {};
    let assigned = 0;
    bands.forEach(function (b, idx) {
      if (idx === bands.length - 1) {
        alloc[b] = n - assigned;
      } else {
        const k = Math.round(groups[b].length / total * n);
        alloc[b] = Math.max(0, Math.min(k, groups[b].length));
        assigned += alloc[b];
      }
    });
    // rebalance if overshoot
    let taken = 0;
    bands.forEach(function (b) { taken += Math.min(alloc[b], groups[b].length); });
    if (taken < n) {
      // fill remainder from any non-exhausted band
      for (let i = 0; i < bands.length && taken < n; i++) {
        const b = bands[i];
        const room = groups[b].length - (alloc[b] || 0);
        if (room > 0) {
          const add = Math.min(room, n - taken);
          alloc[b] = (alloc[b] || 0) + add;
          taken += add;
        }
      }
    }

    const out = [];
    bands.forEach(function (b) {
      const pool = groups[b].slice();
      shuffleInPlace(pool);
      const take = Math.min(alloc[b] || 0, pool.length);
      for (let i = 0; i < take; i++) out.push(pool[i]);
    });
    // final shuffle so band order is randomized
    shuffleInPlace(out);
    return out.slice(0, n);
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // ------------------------------------------------------------------
  // LJTScorer — Hautus (1995) log-linear d' (§9.2)
  //   Applied to ALL trials (not just extreme cells).
  //   Timeouts: miss (app) / FA (inapp), per §7.5.
  // ------------------------------------------------------------------
  function normalQuantile(p) {
    // Beasley–Springer–Moro rational approximation for Φ⁻¹(p)
    // Accurate to ~1e-9 in (0, 1)
    if (!(p > 0 && p < 1)) return NaN;
    const a = [-3.969683028665376e+01,  2.209460984245205e+02,
               -2.759285104469687e+02,  1.383577518672690e+02,
               -3.066479806614716e+01,  2.506628277459239e+00];
    const b = [-5.447609879822406e+01,  1.615858368580409e+02,
               -1.556989798598866e+02,  6.680131188771972e+01,
               -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01,
               -2.400758277161838e+00, -2.549732539343734e+00,
                4.374664141464968e+00,  2.938163982698783e+00];
    const d = [ 7.784695709041462e-03,  3.224671290700398e-01,
                2.445134137142996e+00,  3.754408661907416e+00];
    const pLow = 0.02425, pHigh = 1 - pLow;
    let q, r;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
             ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
             (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
              ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
    }
  }

  const LJTScorer = {
    computeSummary: function (trials) {
      trials = Array.isArray(trials) ? trials : [];
      let n_app = 0, n_inapp = 0;
      let n_hit = 0, n_fa_resp = 0;
      let n_timeout_app = 0, n_timeout_inapp = 0;
      let n_correct_app = 0, n_correct_inapp = 0;
      const rt_app_correct = [];
      const rt_inapp_correct = [];
      const rt_first_all = [];
      const rt_last_all = [];
      const rt_first_correct = [];
      const rt_last_correct = [];
      const playCounts = [];
      const replayCounts = [];

      trials.forEach(function (t) {
        playCounts.push(t.audio_play_count_total == null ? 1 : t.audio_play_count_total);
        replayCounts.push(t.audio_replay_count || 0);
        if (!t.invalidation_reason && !t.timeout_flag) {
          if (t.rt_from_first_offset_ms != null) rt_first_all.push(t.rt_from_first_offset_ms);
          if (t.rt_from_last_offset_ms != null) rt_last_all.push(t.rt_from_last_offset_ms);
        }
        if (t.condition === "appropriate") {
          n_app += 1;
          if (t.timeout_flag) {
            n_timeout_app += 1;
            // timeout on app is a miss (§7.5); not counted as hit/correct
          } else if (t.response_value === 1) {
            // say-yes on app = hit (correct)
            n_hit += 1;
            n_correct_app += 1;
            if (t.rt_from_offset_ms != null) rt_app_correct.push(t.rt_from_offset_ms);
            if (t.rt_from_first_offset_ms != null) rt_first_correct.push(t.rt_from_first_offset_ms);
            if (t.rt_from_last_offset_ms != null) rt_last_correct.push(t.rt_from_last_offset_ms);
          }
          // response_value === 0 on app = miss (incorrect); do nothing
        } else if (t.condition === "inappropriate") {
          n_inapp += 1;
          if (t.timeout_flag) {
            n_timeout_inapp += 1;
            // §7.5: timeout on inapp counts as FA
          } else if (t.response_value === 1) {
            n_fa_resp += 1;
          } else if (t.response_value === 0) {
            if (t.is_correct) {
              n_correct_inapp += 1;
              if (t.rt_from_offset_ms != null) rt_inapp_correct.push(t.rt_from_offset_ms);
              if (t.rt_from_first_offset_ms != null) rt_first_correct.push(t.rt_from_first_offset_ms);
              if (t.rt_from_last_offset_ms != null) rt_last_correct.push(t.rt_from_last_offset_ms);
            }
          }
        }
      });

      const n_fa_inapp = n_fa_resp + n_timeout_inapp;
      // Hautus log-linear (all trials)
      let d_primary = null, c_primary = null;
      let H = null, F = null;
      if (n_app > 0 && n_inapp > 0) {
        H = (n_hit + 0.5) / (n_app + 1);
        F = (n_fa_inapp + 0.5) / (n_inapp + 1);
        const zH = normalQuantile(H);
        const zF = normalQuantile(F);
        d_primary = zH - zF;
        c_primary = -0.5 * (zH + zF);
      }

      // Sensitivity: d'_excluding_timeouts
      let d_excl = null;
      const n_nt_app = n_app - n_timeout_app;
      const n_nt_inapp = n_inapp - n_timeout_inapp;
      if (n_nt_app > 0 && n_nt_inapp > 0) {
        const H_excl = (n_hit + 0.5) / (n_nt_app + 1);
        const F_excl = (n_fa_resp + 0.5) / (n_nt_inapp + 1);
        d_excl = normalQuantile(H_excl) - normalQuantile(F_excl);
      }

      const n_correct_total = n_correct_app + n_correct_inapp;
      const n_timeout_total = n_timeout_app + n_timeout_inapp;
      const n_total = n_app + n_inapp;

      function mean(arr) { return arr.length ? arr.reduce(function (a,b){return a+b;},0)/arr.length : null; }
      function median(arr) {
        if (!arr.length) return null;
        const s = arr.slice().sort(function (a,b){return a-b;});
        const m = Math.floor(s.length / 2);
        return s.length % 2 === 0 ? (s[m-1]+s[m])/2 : s[m];
      }

      return {
        n_trials_total: n_total,
        n_trials_app: n_app,
        n_trials_inapp: n_inapp,
        n_correct_total: n_correct_total,
        n_correct_app: n_correct_app,
        n_correct_inapp: n_correct_inapp,
        n_hit_app: n_hit,
        n_fa_inapp: n_fa_inapp,
        n_fa_inapp_response_only: n_fa_resp,
        n_timeout_app: n_timeout_app,
        n_timeout_inapp: n_timeout_inapp,
        n_timeout_total: n_timeout_total,
        H: H,
        F: F,
        d_primary: d_primary,
        c_primary: c_primary,
        d_excluding_timeouts: d_excl,
        raw_accuracy: n_total > 0 ? n_correct_total / n_total : null,
        conditional_accuracy: (n_total - n_timeout_total) > 0
          ? n_correct_total / (n_total - n_timeout_total) : null,
        mean_rt_app_correct: mean(rt_app_correct),
        mean_rt_inapp_correct: mean(rt_inapp_correct),
        median_rt_app_correct: median(rt_app_correct),
        median_rt_inapp_correct: median(rt_inapp_correct),
        mean_rt_first_offset_all: mean(rt_first_all),
        median_rt_first_offset_all: median(rt_first_all),
        mean_rt_last_offset_all: mean(rt_last_all),
        median_rt_last_offset_all: median(rt_last_all),
        mean_rt_first_offset_correct: mean(rt_first_correct),
        median_rt_first_offset_correct: median(rt_first_correct),
        mean_rt_last_offset_correct: mean(rt_last_correct),
        median_rt_last_offset_correct: median(rt_last_correct),
        mean_audio_play_count_total: mean(playCounts),
        median_audio_play_count_total: median(playCounts),
        mean_audio_replay_count: mean(replayCounts),
        median_audio_replay_count: median(replayCounts),
        max_audio_replay_count: replayCounts.length
          ? Math.max.apply(null, replayCounts) : null
      };
    }
  };

  // ------------------------------------------------------------------
  // HeadphoneChecker — programmatic L/R/both tone test (§10.2)
  //   Uses OscillatorNode + StereoPannerNode (or ChannelMerger fallback).
  //   1 kHz sine, 500 ms; user picks "left" / "right" / "both" for each.
  //   3/3 pass; up to 3 retries before result = fail.
  // ------------------------------------------------------------------
  class HeadphoneChecker {
    constructor(audioCtx) {
      this.audioCtx = audioCtx;
      this.attempts = 0;
      this.history = [];  // [{ attempt, sequence, responses, passed }]
    }

    /** play a single 1 kHz 500 ms tone on specified channel */
    async playTone(channel /* 'left' | 'right' | 'both' */) {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const durSec = 0.5;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 1000;
      const gain = ctx.createGain();
      // 10 ms fade-in / fade-out to avoid clicks
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
      gain.gain.setValueAtTime(0.25, now + durSec - 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

      let panNode;
      if (typeof ctx.createStereoPanner === "function") {
        panNode = ctx.createStereoPanner();
        panNode.pan.value = channel === "left" ? -1 : (channel === "right" ? 1 : 0);
        osc.connect(gain).connect(panNode).connect(ctx.destination);
      } else {
        // fallback: ChannelMerger with two GainNodes
        const merger = ctx.createChannelMerger(2);
        const gL = ctx.createGain();
        const gR = ctx.createGain();
        gL.gain.value = channel === "right" ? 0 : 1;
        gR.gain.value = channel === "left" ? 0 : 1;
        osc.connect(gain);
        gain.connect(gL).connect(merger, 0, 0);
        gain.connect(gR).connect(merger, 0, 1);
        merger.connect(ctx.destination);
      }
      osc.start(now);
      osc.stop(now + durSec + 0.02);
      return new Promise(function (resolve) {
        setTimeout(resolve, (durSec + 0.05) * 1000);
      });
    }

    /** generate random L/R/both sequence for a single attempt */
    newSequence() {
      const pool = ["left", "right", "both"];
      shuffleInPlace(pool);
      return pool;
    }

    recordAttempt(sequence, responses) {
      const passed = sequence.every(function (ch, i) { return responses[i] === ch; });
      this.attempts += 1;
      this.history.push({
        attempt: this.attempts,
        sequence: sequence.slice(),
        responses: responses.slice(),
        passed: passed,
        timestamp: new Date().toISOString()
      });
      return passed;
    }

    get isFailedTerminally() {
      return this.attempts >= 3 && !this.history.some(function (h) { return h.passed; });
    }
  }

  // ------------------------------------------------------------------
  // LJTController (§7.2) — AudioContext-based trial timing
  // ------------------------------------------------------------------
  class LJTController {
    /**
     * @param {Object} opts
     * @param {Function} opts.onTrialDone - ({ meta, outcome }) => void
     * @param {Function} opts.onEnableButtons - () => void (UI: enable yes/no)
     * @param {Function} opts.onDisableButtons - () => void (UI: disable yes/no)
     */
    constructor(opts) {
      this.onTrialDone = opts && opts.onTrialDone || function () {};
      this.onMetaUpdate = opts && opts.onMetaUpdate || function () {};
      this.onEnableButtons = opts && opts.onEnableButtons || function () {};
      this.onDisableButtons = opts && opts.onDisableButtons || function () {};
      this.audioCtx = null;
      this.outputLatency = 0;
      this.baseLatency = 0;
      this.connectionTypeEstimate = null;
      this.trialSettled = true;
      this.trialInProgress = false;
      this.currentTrialMeta = null;
      this.timeoutId = null;
      this.enableTimerId = null;
      this.prematureClickCount = 0;
      this.prematureReplayClickCount = 0;
      this.invalidatedCount = 0;
      this.currentAudioBuffer = null;
      this.activeSource = null;
      this.playToken = 0;
      this._trialResolver = null;
    }

    /** MUST be called inside a user-gesture handler (click/touch). */
    async initOnUserGesture() {
      if (this.audioCtx && this.audioCtx.state !== "closed") return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AC({ latencyHint: "interactive" });
      try { await this.audioCtx.resume(); } catch (e) { /* ignore */ }
      this.outputLatency = this.audioCtx.outputLatency || 0;
      this.baseLatency = this.audioCtx.baseLatency || 0;
      const latencyMs = this.outputLatency * 1000;
      if (latencyMs > 100) {
        this.connectionTypeEstimate = "high_latency_warning";
      } else if (latencyMs > 20) {
        this.connectionTypeEstimate = "bluetooth_or_wireless";
      } else if (latencyMs > 10) {
        this.connectionTypeEstimate = "wired_external_likely";
      } else {
        this.connectionTypeEstimate = "wired_internal";
      }

      const self = this;
      this.audioCtx.onstatechange = function () {
        if (self.audioCtx && self.audioCtx.state === "suspended" && self.trialInProgress) {
          self.invalidateCurrentTrial("audiocontext_suspended");
        }
      };
      this._visibilityHandler = function () {
        if (document.hidden && self.trialInProgress) {
          self.invalidateCurrentTrial("tab_hidden_mid_trial");
        }
      };
      document.addEventListener("visibilitychange", this._visibilityHandler);

      this.trialSettled = true;
      this.trialInProgress = false;
    }

    notifyMetaUpdate() {
      if (!this.currentTrialMeta) return;
      try {
        this.onMetaUpdate(clonePlain(this.currentTrialMeta));
      } catch (e) {
        console.error(e);
      }
    }

    /** Pre-load one audio file into an AudioBuffer. */
    async preloadAudio(url) {
      if (!this.audioCtx) throw new Error("AudioContext not initialized");
      const response = await fetch(url);
      if (!response.ok) throw new Error("fetch " + url + " → HTTP " + response.status);
      const arrayBuf = await response.arrayBuffer();
      const ctx = this.audioCtx;
      // Safari-compatible wrapping: prefer the Promise form when supported,
      // fall back to the legacy callback form.
      return await new Promise(function (resolve, reject) {
        let settled = false;
        const ok = function (buf) { if (!settled) { settled = true; resolve(buf); } };
        const fail = function (err) { if (!settled) { settled = true; reject(err); } };
        try {
          const p = ctx.decodeAudioData(arrayBuf, ok, fail);
          if (p && typeof p.then === "function") p.then(ok, fail);
        } catch (e) { fail(e); }
      });
    }

    isAudioPlaying() {
      return !!(
        this.audioCtx &&
        this.currentTrialMeta &&
        this.currentTrialMeta.audio_offset_at_ctx_s != null &&
        this.audioCtx.currentTime < this.currentTrialMeta.audio_offset_at_ctx_s
      );
    }

    startPlayback(playKind) {
      if (!this.audioCtx || !this.currentAudioBuffer || !this.currentTrialMeta) {
        throw new Error("Playback requested before trial initialization");
      }

      if (this.enableTimerId != null) {
        clearTimeout(this.enableTimerId);
        this.enableTimerId = null;
      }
      this.onDisableButtons();

      const source = this.audioCtx.createBufferSource();
      source.buffer = this.currentAudioBuffer;
      source.connect(this.audioCtx.destination);

      const scheduledStart = this.audioCtx.currentTime + 0.1;
      const audioOnset = scheduledStart;
      const audioOffset = scheduledStart + this.currentAudioBuffer.duration;
      const meta = this.currentTrialMeta;
      const timedMode = !isUntimedMode();
      const deadlineMs = timedMode
        ? (meta.condition === "appropriate"
          ? ((CONFIG_REF && CONFIG_REF.LJT_DEADLINE_APP_MS) || 1600)
          : ((CONFIG_REF && CONFIG_REF.LJT_DEADLINE_INAPP_MS) || 2000))
        : null;

      source.start(scheduledStart);
      this.activeSource = source;
      this.playToken += 1;
      const token = this.playToken;

      meta.response_mode = getResponseMode();
      meta.replay_enabled = isReplayEnabled();
      meta.audio_duration_ms = Math.round(this.currentAudioBuffer.duration * 1000);
      meta.output_latency_ms = Math.round(this.outputLatency * 1000);
      meta.base_latency_ms = Math.round(this.baseLatency * 1000);
      meta.audio_context_start_time_s = scheduledStart;
      meta.audio_onset_at_ctx_s = audioOnset;
      meta.audio_offset_at_ctx_s = audioOffset;
      meta.last_audio_onset_at_ctx_s = audioOnset;
      meta.last_audio_offset_at_ctx_s = audioOffset;
      if (meta.first_audio_context_start_time_s == null) {
        meta.first_audio_context_start_time_s = scheduledStart;
      }
      if (meta.first_audio_onset_at_ctx_s == null) {
        meta.first_audio_onset_at_ctx_s = audioOnset;
      }
      if (meta.first_audio_offset_at_ctx_s == null) {
        meta.first_audio_offset_at_ctx_s = audioOffset;
      }
      meta.deadline_at_ctx_s = deadlineMs == null ? null : (audioOffset + deadlineMs / 1000);
      meta.audio_play_count_total = (meta.audio_play_count_total || 0) + 1;
      meta.audio_replay_count = playKind === "replay"
        ? ((meta.audio_replay_count || 0) + 1)
        : (meta.audio_replay_count || 0);
      meta.audio_play_events = Array.isArray(meta.audio_play_events) ? meta.audio_play_events : [];
      meta.audio_play_events.push({
        play_index: meta.audio_play_count_total,
        play_kind: playKind,
        scheduled_start_ctx_s: scheduledStart,
        audio_onset_at_ctx_s: audioOnset,
        audio_offset_at_ctx_s: audioOffset,
        requested_at_iso: new Date().toISOString(),
        completed: false
      });
      this.notifyMetaUpdate();

      const self = this;
      const enableAt = Math.max(0, (audioOffset - this.audioCtx.currentTime) * 1000);
      this.enableTimerId = setTimeout(function () {
        if (token !== self.playToken || self.trialSettled) return;
        const lastEvent = self.currentTrialMeta &&
          self.currentTrialMeta.audio_play_events &&
          self.currentTrialMeta.audio_play_events[self.currentTrialMeta.audio_play_events.length - 1];
        if (lastEvent) {
          lastEvent.completed = true;
          lastEvent.completed_at_iso = new Date().toISOString();
        }
        self.notifyMetaUpdate();
        self.onEnableButtons();
      }, enableAt);
      source.onended = function () {
        if (token !== self.playToken || self.trialSettled) return;
        const lastEvent = self.currentTrialMeta &&
          self.currentTrialMeta.audio_play_events &&
          self.currentTrialMeta.audio_play_events[self.currentTrialMeta.audio_play_events.length - 1];
        if (lastEvent && !lastEvent.completed) {
          lastEvent.completed = true;
          lastEvent.completed_at_iso = new Date().toISOString();
        }
        self.notifyMetaUpdate();
        self.onEnableButtons();
      };

      if (this.timeoutId != null) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      if (timedMode && meta.deadline_at_ctx_s != null) {
        const timeoutMs = Math.max(0, (meta.deadline_at_ctx_s - this.audioCtx.currentTime) * 1000);
        this.timeoutId = setTimeout(function () {
          self.settleTrial({ kind: "timeout", at: self.audioCtx.currentTime });
        }, timeoutMs);
      }
    }

    /** Play one trial and wait for click / timeout / invalidate. */
    async playTrial(meta, audioBuffer) {
      this.trialSettled = false;
      this.trialInProgress = true;
      this.prematureClickCount = 0;
      this.prematureReplayClickCount = 0;
      this.currentAudioBuffer = audioBuffer;
      this.currentTrialMeta = Object.assign({}, meta, {
        response_mode: getResponseMode(),
        replay_enabled: isReplayEnabled(),
        audio_play_count_total: 0,
        audio_replay_count: 0,
        audio_play_events: [],
        first_audio_context_start_time_s: null,
        first_audio_onset_at_ctx_s: null,
        first_audio_offset_at_ctx_s: null,
        last_audio_onset_at_ctx_s: null,
        last_audio_offset_at_ctx_s: null,
        rt_from_first_offset_ms: null,
        rt_from_last_offset_ms: null,
        response_from_first_onset_ms: null,
        response_from_last_onset_ms: null,
        premature_replay_click_count: 0
      });

      this.startPlayback("initial");

      // Return a promise that resolves when this trial is settled.
      const self = this;
      return new Promise(function (resolve) {
        self._trialResolver = resolve;
      });
    }

    onPrematureClick() {
      this.prematureClickCount += 1;
      if (this.currentTrialMeta) {
        this.currentTrialMeta.premature_click_count = this.prematureClickCount;
        this.notifyMetaUpdate();
      }
    }

    onPrematureReplayClick() {
      this.prematureReplayClickCount += 1;
      if (this.currentTrialMeta) {
        this.currentTrialMeta.premature_replay_click_count = this.prematureReplayClickCount;
        this.notifyMetaUpdate();
      }
    }

    replayCurrentAudio() {
      if (this.trialSettled || !this.currentTrialMeta || !this.currentAudioBuffer) return false;
      if (!isReplayEnabled()) return false;
      if (this.isAudioPlaying()) return false;
      this.startPlayback("replay");
      return true;
    }

    onResponseClick(responseValue) {
      if (this.trialSettled) return;
      this.settleTrial({
        kind: "response",
        value: responseValue,
        at: this.audioCtx.currentTime
      });
    }

    invalidateCurrentTrial(reason) {
      if (this.trialSettled) return;
      this.invalidatedCount += 1;
      this.settleTrial({
        kind: "invalidated",
        reason: reason,
        at: this.audioCtx ? this.audioCtx.currentTime : null
      });
    }

    /** Single terminal path for click / timeout / invalidate (§7.2 bug 3f). */
    settleTrial(outcome) {
      if (this.trialSettled) return;
      this.trialSettled = true;
      this.trialInProgress = false;
      if (this.timeoutId != null) { clearTimeout(this.timeoutId); this.timeoutId = null; }
      if (this.enableTimerId != null) { clearTimeout(this.enableTimerId); this.enableTimerId = null; }
      this.onDisableButtons();
      if (this.activeSource) {
        try { this.activeSource.onended = null; } catch (e) { /* ignore */ }
        try { this.activeSource.stop(); } catch (e) { /* ignore */ }
        this.activeSource = null;
      }

      const meta = this.currentTrialMeta;
      meta.premature_click_count = this.prematureClickCount;
      meta.premature_replay_click_count = this.prematureReplayClickCount;
      meta.settled_at_iso = new Date().toISOString();
      // fold outcome into meta
      if (outcome.kind === "response") {
        meta.response_value = outcome.value;
        meta.response_at_ctx_s = outcome.at;
        meta.timeout_flag = false;
        meta.invalidation_reason = null;
        meta.rt_from_last_offset_ms = meta.audio_offset_at_ctx_s == null ? null : Math.max(
          0, Math.round((outcome.at - meta.audio_offset_at_ctx_s) * 1000));
        meta.rt_from_first_offset_ms = meta.first_audio_offset_at_ctx_s == null ? null : Math.max(
          0, Math.round((outcome.at - meta.first_audio_offset_at_ctx_s) * 1000));
        meta.response_from_last_onset_ms = meta.audio_onset_at_ctx_s == null ? null : Math.max(
          0, Math.round((outcome.at - meta.audio_onset_at_ctx_s) * 1000));
        meta.response_from_first_onset_ms = meta.first_audio_onset_at_ctx_s == null ? null : Math.max(
          0, Math.round((outcome.at - meta.first_audio_onset_at_ctx_s) * 1000));
        meta.rt_from_offset_ms = meta.rt_from_last_offset_ms;
      } else if (outcome.kind === "timeout") {
        meta.response_value = null;
        meta.response_at_ctx_s = null;
        meta.timeout_flag = true;
        meta.invalidation_reason = null;
        meta.rt_from_offset_ms = null;
        meta.rt_from_first_offset_ms = null;
        meta.rt_from_last_offset_ms = null;
        meta.response_from_first_onset_ms = null;
        meta.response_from_last_onset_ms = null;
      } else {
        // invalidated
        meta.response_value = null;
        meta.response_at_ctx_s = null;
        meta.timeout_flag = false;
        meta.invalidation_reason = outcome.reason || "unknown";
        meta.rt_from_offset_ms = null;
        meta.rt_from_first_offset_ms = null;
        meta.rt_from_last_offset_ms = null;
        meta.response_from_first_onset_ms = null;
        meta.response_from_last_onset_ms = null;
      }
      meta.audio_play_count_completed = Array.isArray(meta.audio_play_events)
        ? meta.audio_play_events.filter(function (event) { return !!event.completed; }).length
        : 0;

      // is_correct: yes-on-app OR no-on-inapp. Everything else (timeout,
      // invalidate, wrong-click) is incorrect.
      if (meta.timeout_flag || meta.invalidation_reason) {
        meta.is_correct = false;
      } else if (meta.condition === "appropriate") {
        meta.is_correct = meta.response_value === 1;
      } else if (meta.condition === "inappropriate") {
        meta.is_correct = meta.response_value === 0;
      } else {
        meta.is_correct = false;
      }

      try { this.onTrialDone({ meta: meta, outcome: outcome }); } catch (e) { console.error(e); }
      this.currentTrialMeta = null;
      this.currentAudioBuffer = null;

      if (this._trialResolver) {
        const r = this._trialResolver;
        this._trialResolver = null;
        r(meta);
      }
    }

    dispose() {
      try { document.removeEventListener("visibilitychange", this._visibilityHandler); } catch (e) {}
      if (this.timeoutId != null) clearTimeout(this.timeoutId);
      if (this.enableTimerId != null) clearTimeout(this.enableTimerId);
      if (this.activeSource) {
        try { this.activeSource.onended = null; } catch (e) { /* ignore */ }
        try { this.activeSource.stop(); } catch (e) { /* ignore */ }
      }
      if (this.audioCtx && this.audioCtx.state !== "closed") {
        try { this.audioCtx.close(); } catch (e) {}
      }
      this.activeSource = null;
      this.currentAudioBuffer = null;
      this.audioCtx = null;
    }
  }

  // ------------------------------------------------------------------
  // Trial plan construction
  //   For each target, create app + inapp trials. Interleave with a
  //   constraint that consecutive trials are not the same target.
  // ------------------------------------------------------------------
  function buildTrialPlan(targets, mainBank, phase) {
    const trials = [];
    let seq = 0;
    targets.forEach(function (tgt) {
      const bankEntry = mainBank.get(tgt.item_id);
      if (!bankEntry) return;
      if (bankEntry.appropriate) {
        trials.push({
          trial_seq: 0,
          phase: phase,
          item_id: tgt.item_id,
          target_word: tgt.target_word,
          target_level: tgt.target_level,
          condition: "appropriate",
          foil_type: "NA",
          source: tgt.source,
          sentence_text: bankEntry.appropriate.sentence_text,
          audio_file: bankEntry.appropriate.audio_file
        });
      }
      if (bankEntry.inappropriate) {
        trials.push({
          trial_seq: 0,
          phase: phase,
          item_id: tgt.item_id,
          target_word: tgt.target_word,
          target_level: tgt.target_level,
          condition: "inappropriate",
          foil_type: bankEntry.inappropriate.foil_type || "a_selectional",
          source: tgt.source,
          sentence_text: bankEntry.inappropriate.sentence_text,
          audio_file: bankEntry.inappropriate.audio_file
        });
      }
    });

    // Adjacency-avoidance shuffle: same item_id cannot appear back-to-back
    shuffleInPlace(trials);
    for (let i = 1; i < trials.length; i++) {
      if (trials[i].item_id === trials[i - 1].item_id) {
        // find a swap partner j > i whose item differs from both neighbors
        let swapped = false;
        for (let j = i + 1; j < trials.length; j++) {
          const prev = trials[i - 1].item_id;
          const nxt = i + 1 < trials.length ? trials[i + 1].item_id : null;
          if (trials[j].item_id !== prev && trials[j].item_id !== nxt) {
            const tmp = trials[i]; trials[i] = trials[j]; trials[j] = tmp;
            swapped = true;
            break;
          }
        }
        if (!swapped) break;  // accept imperfect adjacency
      }
    }

    trials.forEach(function (t, i) { t.trial_seq = ++seq; t.trial_in_phase = i + 1; });
    return trials;
  }

  // R2 / spec §14: Practice emits BOTH conditions for every practice item
  //   → 10 items × 2 conditions = 20 trials. Order is shuffled with an
  //   adjacency-avoidance constraint (same item_id cannot appear back-to-back)
  //   to prevent repeat-sentence cuing.
  //   Accuracy < 60 % triggers injection of 5 extra trials by re-running the
  //   shuffle on a random sample of existing pairs (handled in renderPracticePhase).
  function buildPracticeTrialPlan(practiceItems) {
    const trials = [];
    practiceItems.forEach(function (p) {
      if (p.appropriate) {
        trials.push({
          phase: "practice",
          item_id: p.item_id,
          target_word: p.target_word,
          target_level: "practice",
          condition: "appropriate",
          foil_type: "NA",
          source: "practice",
          sentence_text: p.appropriate.sentence_text,
          audio_file: p.appropriate.audio_file
        });
      }
      if (p.inappropriate) {
        trials.push({
          phase: "practice",
          item_id: p.item_id,
          target_word: p.target_word,
          target_level: "practice",
          condition: "inappropriate",
          foil_type: p.foil_type || p.inappropriate.foil_type || "a_selectional",
          source: "practice",
          sentence_text: p.inappropriate.sentence_text,
          audio_file: p.inappropriate.audio_file
        });
      }
    });

    shuffleInPlace(trials);
    // Adjacency-avoidance: same item_id cannot appear in consecutive trials.
    // Mirrors the logic used in buildTrialPlan() for main trials.
    for (let i = 1; i < trials.length; i++) {
      if (trials[i].item_id === trials[i - 1].item_id) {
        let swapped = false;
        for (let j = i + 1; j < trials.length; j++) {
          const prev = trials[i - 1].item_id;
          const nxt = i + 1 < trials.length ? trials[i + 1].item_id : null;
          if (trials[j].item_id !== prev && trials[j].item_id !== nxt) {
            const tmp = trials[i]; trials[i] = trials[j]; trials[j] = tmp;
            swapped = true;
            break;
          }
        }
        if (!swapped) break;
      }
    }

    let seq = 0;
    trials.forEach(function (t, i) {
      t.trial_seq = ++seq;
      t.trial_in_phase = i + 1;
      t.is_practice_extra = false;
    });
    return trials;
  }

  // R2 / spec §14.1: when practice accuracy < 60 %, inject 5 extra trials
  //   drawn with replacement from the existing practice bank. The new trials
  //   are appended to state.trialPlanPractice and flagged is_practice_extra=true
  //   so downstream analysis can separate them from the original 20.
  function buildPracticeExtraTrials(practiceItems, n) {
    n = n || 5;
    const pool = [];
    practiceItems.forEach(function (p) {
      if (p.appropriate) {
        pool.push({
          phase: "practice",
          item_id: p.item_id,
          target_word: p.target_word,
          target_level: "practice",
          condition: "appropriate",
          foil_type: "NA",
          source: "practice_extra",
          sentence_text: p.appropriate.sentence_text,
          audio_file: p.appropriate.audio_file
        });
      }
      if (p.inappropriate) {
        pool.push({
          phase: "practice",
          item_id: p.item_id,
          target_word: p.target_word,
          target_level: "practice",
          condition: "inappropriate",
          foil_type: p.foil_type || p.inappropriate.foil_type || "a_selectional",
          source: "practice_extra",
          sentence_text: p.inappropriate.sentence_text,
          audio_file: p.inappropriate.audio_file
        });
      }
    });
    shuffleInPlace(pool);
    const picks = pool.slice(0, Math.min(n, pool.length)).map(function (t) {
      return Object.assign({}, t, { is_practice_extra: true });
    });
    return picks;
  }

  // ------------------------------------------------------------------
  // Excel sheets builder (§9.1 - §9.3)
  // ------------------------------------------------------------------
  function buildExcelSheets(session) {
    const ljt = session && session.ljt ? session.ljt : {};
    const practiceTrials = Array.isArray(ljt.practiceTrials) ? ljt.practiceTrials : [];
    const mainTrials = Array.isArray(ljt.mainTrials) ? ljt.mainTrials : [];
    const allTrials = practiceTrials.concat(mainTrials);

    const ljt_log = allTrials.map(function (t) {
      return {
        trial_seq: t.trial_seq,
        phase: t.phase,
        trial_in_phase: t.trial_in_phase,
        item_id: t.item_id,
        target_word: t.target_word,
        target_level: t.target_level,
        condition: t.condition,
        foil_type: t.foil_type,
        source: t.source,
        audio_file: t.audio_file,
        response_mode: t.response_mode || getResponseMode(),
        replay_enabled: t.replay_enabled == null ? isReplayEnabled() : !!t.replay_enabled,
        audio_duration_ms: t.audio_duration_ms,
        first_audio_context_start_time_s: t.first_audio_context_start_time_s,
        audio_context_start_time_s: t.audio_context_start_time_s,
        first_audio_onset_at_ctx_s: t.first_audio_onset_at_ctx_s,
        audio_onset_at_ctx_s: t.audio_onset_at_ctx_s,
        first_audio_offset_at_ctx_s: t.first_audio_offset_at_ctx_s,
        audio_offset_at_ctx_s: t.audio_offset_at_ctx_s,
        last_audio_onset_at_ctx_s: t.last_audio_onset_at_ctx_s,
        last_audio_offset_at_ctx_s: t.last_audio_offset_at_ctx_s,
        deadline_at_ctx_s: t.deadline_at_ctx_s,
        response_at_ctx_s: t.response_at_ctx_s,
        response_value: t.response_value,
        rt_from_offset_ms: t.rt_from_offset_ms,
        rt_from_first_offset_ms: t.rt_from_first_offset_ms,
        rt_from_last_offset_ms: t.rt_from_last_offset_ms,
        response_from_first_onset_ms: t.response_from_first_onset_ms,
        response_from_last_onset_ms: t.response_from_last_onset_ms,
        timeout_flag: !!t.timeout_flag,
        premature_click_count: t.premature_click_count || 0,
        premature_replay_click_count: t.premature_replay_click_count || 0,
        invalidation_reason: t.invalidation_reason || "",
        is_correct: !!t.is_correct,
        is_practice_extra: !!t.is_practice_extra,       // R2 telemetry
        is_retry_original: !!t.is_retry_original,       // R3 telemetry
        audio_play_count_total: t.audio_play_count_total == null ? 1 : t.audio_play_count_total,
        audio_play_count_completed: t.audio_play_count_completed == null ? null : t.audio_play_count_completed,
        audio_replay_count: t.audio_replay_count || 0,
        audio_play_events_json: Array.isArray(t.audio_play_events)
          ? JSON.stringify(t.audio_play_events) : "",
        started_at_iso: t.started_at_iso || "",
        settled_at_iso: t.settled_at_iso || ""
      };
    });

    const mainSummary = LJTScorer.computeSummary(mainTrials);
    const practiceSummary = LJTScorer.computeSummary(practiceTrials);
    const ljt_summary = [{
      participant_id: session && session.participant ? session.participant.studentId : "",
      phase_evaluated: "main",
      n_trials_total: mainSummary.n_trials_total,
      n_trials_app: mainSummary.n_trials_app,
      n_trials_inapp: mainSummary.n_trials_inapp,
      n_correct_total: mainSummary.n_correct_total,
      n_correct_app: mainSummary.n_correct_app,
      n_correct_inapp: mainSummary.n_correct_inapp,
      n_hit_app: mainSummary.n_hit_app,
      n_fa_inapp: mainSummary.n_fa_inapp,
      n_timeout_app: mainSummary.n_timeout_app,
      n_timeout_inapp: mainSummary.n_timeout_inapp,
      H: mainSummary.H,
      F: mainSummary.F,
      d_primary: mainSummary.d_primary,
      c_primary: mainSummary.c_primary,
      d_excluding_timeouts: mainSummary.d_excluding_timeouts,
      raw_accuracy: mainSummary.raw_accuracy,
      conditional_accuracy: mainSummary.conditional_accuracy,
      mean_rt_app_correct: mainSummary.mean_rt_app_correct,
      mean_rt_inapp_correct: mainSummary.mean_rt_inapp_correct,
      median_rt_app_correct: mainSummary.median_rt_app_correct,
      median_rt_inapp_correct: mainSummary.median_rt_inapp_correct,
      mean_rt_first_offset_all: mainSummary.mean_rt_first_offset_all,
      median_rt_first_offset_all: mainSummary.median_rt_first_offset_all,
      mean_rt_last_offset_all: mainSummary.mean_rt_last_offset_all,
      median_rt_last_offset_all: mainSummary.median_rt_last_offset_all,
      mean_rt_first_offset_correct: mainSummary.mean_rt_first_offset_correct,
      median_rt_first_offset_correct: mainSummary.median_rt_first_offset_correct,
      mean_rt_last_offset_correct: mainSummary.mean_rt_last_offset_correct,
      median_rt_last_offset_correct: mainSummary.median_rt_last_offset_correct,
      mean_audio_play_count_total: mainSummary.mean_audio_play_count_total,
      median_audio_play_count_total: mainSummary.median_audio_play_count_total,
      mean_audio_replay_count: mainSummary.mean_audio_replay_count,
      median_audio_replay_count: mainSummary.median_audio_replay_count,
      max_audio_replay_count: mainSummary.max_audio_replay_count,
      practice_raw_accuracy: practiceSummary.raw_accuracy,
      practice_n_trials: practiceSummary.n_trials_total
    }];

    const preload = ljt.preload || {};
    const hc = ljt.headphoneCheck || {};
    const session_meta = ljt.sessionMeta || {};
    const targets_meta = ljt.targets_meta || {};
    const ljt_session_meta = [{
      participant_id: session && session.participant ? session.participant.studentId : "",
      ua_string: session_meta.ua || (typeof navigator !== "undefined" ? navigator.userAgent : ""),
      platform: session_meta.platform || (typeof navigator !== "undefined" ? navigator.platform : ""),
      viewport_wh: session_meta.viewport || "",
      screen_dpr: session_meta.dpr || null,
      audio_context_sample_rate: session_meta.sample_rate || null,
      audio_context_output_latency_ms: session_meta.output_latency_ms || null,
      audio_context_base_latency_ms: session_meta.base_latency_ms || null,
      audio_context_state: session_meta.audio_state || "",
      connection_type_estimate: session_meta.connection_type || "",
      response_mode: session_meta.response_mode || getResponseMode(),
      replay_enabled: session_meta.replay_enabled == null ? isReplayEnabled() : !!session_meta.replay_enabled,
      headphone_check_attempts: hc.attempts || 0,
      headphone_check_result: hc.result || "",
      headphone_check_history_json: hc.history ? JSON.stringify(hc.history) : "",
      bluetooth_warning_shown: !!session_meta.bluetooth_warning_shown,
      // R5: spec §10.2 — record whether the Bluetooth / high-latency warning
      //   dialog was ignored / accepted with warning / restarted.
      bluetooth_action_chosen: session_meta.bluetooth_action_chosen || "",
      preload_started_at: preload.startedAt || "",
      preload_finished_at: preload.finishedAt || "",
      preload_total_files: preload.total || 0,
      preload_failures: Array.isArray(preload.failures) ? preload.failures.join("|") : "",
      ljt_intro_entered_at: ljt.introEnteredAt || "",
      ljt_main_started_at: ljt.mainStartedAt || "",
      ljt_main_finished_at: ljt.mainFinishedAt || "",
      ljt_total_duration_s: ljt.totalDurationSec || null,
      practice_accuracy: practiceSummary.raw_accuracy,
      // R2: spec §14.1 — extra-trial injection flag + pre-injection accuracy
      practice_extra_triggered: !!session_meta.practice_extra_triggered,
      practice_accuracy_original: session_meta.practice_accuracy_original,
      // R1: spec §6.1 — theta-pad sampling diagnostics
      theta_pad_theta_hat: targets_meta.theta_hat,
      theta_pad_width_used: targets_meta.neighborhood_width_used,
      theta_pad_widening_triggered: !!targets_meta.widening_triggered,
      theta_pad_candidates_at_05: targets_meta.pad_candidates_at_05,
      theta_pad_candidates_at_10: targets_meta.pad_candidates_at_10,
      theta_pad_candidates_at_15: targets_meta.pad_candidates_at_15,
      theta_pad_needed: targets_meta.pad_needed,
      theta_pad_chosen: targets_meta.pad_chosen,
      theta_pad_notes: targets_meta.notes || "",
      invalidated_trials_count: (session_meta.invalidated_trials_count || 0),
      events_tabswitch_count: session_meta.events_tabswitch_count || 0
    }];

    return {
      ljt_log: ljt_log,
      ljt_summary: ljt_summary,
      ljt_session_meta: ljt_session_meta
    };
  }

  // ------------------------------------------------------------------
  // Screen orchestration (minimal UI rendering for the 7 screens)
  // ------------------------------------------------------------------
  const LJT_SCREENS = [
    "ljt-intro-screen",
    "ljt-headphone-check",
    "ljt-preload-screen",
    "ljt-practice-screen",
    "ljt-main-screen",
    "ljt-pause-screen",
    "ljt-result-screen"
  ];

  function showLjtScreen(name) {
    LJT_SCREENS.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === name) {
        el.classList.remove("hidden");
        el.removeAttribute("inert");
      } else {
        el.classList.add("hidden");
        el.setAttribute("inert", "");
      }
    });
    // Also hide the original CAT screens if they exist
    ["intro-screen", "practice-screen", "test-screen", "result-screen"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add("hidden");
        el.setAttribute("inert", "");
      }
    });
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function bindClickOnce(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);
    newEl.addEventListener("click", handler);
  }

  // ------------------------------------------------------------------
  // Phase entry point
  // ------------------------------------------------------------------
  async function startPhase(session) {
    if (!session) return;
    // R3: Guard. If the LJT was already completed, skip straight to the
    //   LJT result screen so the caller's UVLT_CAT_AFTER_LJT hook can fire
    //   when the participant acknowledges it.
    if (session.ljt && session.ljt.completed) {
      state = {
        session: session,
        controller: null,
        checker: null,
        audioBuffers: new Map(),
        trialPlanPractice: [],
        trialPlanMain: [],
        currentIndex: 0,
        resumePending: false
      };
      renderResultScreen();
      return;
    }
    if (!session.ljt) {
      session.ljt = {
        targets: [],
        targets_meta: null,  // R1: populated by sampleLJTTargets()
        practiceTrials: [],
        mainTrials: [],
        headphoneCheck: { attempts: 0, result: "", history: [] },
        preload: { startedAt: "", finishedAt: "", total: 0, failures: [] },
        sessionMeta: {
          ua: navigator.userAgent,
          platform: navigator.platform,
          viewport: window.innerWidth + "x" + window.innerHeight,
          dpr: window.devicePixelRatio || 1,
          response_mode: getResponseMode(),
          replay_enabled: isReplayEnabled(),
          invalidated_trials_count: 0,
          events_tabswitch_count: 0,
          bluetooth_warning_shown: false,
          bluetooth_action_chosen: "",   // R5: §10.2
          // R2: §14.1 — accuracy-triggered practice re-dose flag & telemetry
          practice_extra_triggered: false,
          practice_accuracy_original: null
        },
        introEnteredAt: new Date().toISOString(),
        mainStartedAt: "",
        mainFinishedAt: "",
        totalDurationSec: null,
        completed: false,
        terminated: false,
        // R3: spec §10.3 — mid-trial resume support. current_trial_meta is the
        //     partially-constructed trial meta (if a reload happens mid-trial);
        //     main_trial_index / practice_trial_index are ordinals for the
        //     running plan so restoreState can resume correctly.
        current_trial_meta: null,
        main_trial_index: 0,
        practice_trial_index: 0,
        last_phase_shown: "intro"
      };
    } else {
      // Back-fill fields that older sessions (restored from v2 localStorage
      // written before R1-R5) may be missing.
      const sm = session.ljt.sessionMeta = session.ljt.sessionMeta || {};
      if (sm.response_mode == null) sm.response_mode = getResponseMode();
      if (sm.replay_enabled == null) sm.replay_enabled = isReplayEnabled();
      if (sm.practice_extra_triggered == null) sm.practice_extra_triggered = false;
      if (sm.practice_accuracy_original === undefined) sm.practice_accuracy_original = null;
      if (sm.bluetooth_action_chosen == null) sm.bluetooth_action_chosen = "";
      if (session.ljt.current_trial_meta === undefined) session.ljt.current_trial_meta = null;
      if (session.ljt.main_trial_index == null) session.ljt.main_trial_index = 0;
      if (session.ljt.practice_trial_index == null) session.ljt.practice_trial_index = 0;
      if (session.ljt.last_phase_shown == null) session.ljt.last_phase_shown = "intro";
      if (session.ljt.targets_meta === undefined) session.ljt.targets_meta = null;
    }

    state = {
      session: session,
      controller: null,
      checker: null,
      audioBuffers: new Map(),  // audio_file → AudioBuffer
      trialPlanPractice: [],
      trialPlanMain: [],
      currentIndex: 0,
      // R3: resume-mid-trial flags consumed once by the preload/practice/main
      // entry points. Cleared after the first use so a second reload doesn't
      // stack invalidation rows.
      resumePending: false,
      resumePhase: null,     // "practice" | "main"
      resumeIndex: 0,
      resumeTrialMeta: null
    };

    try { await loadSentences(); } catch (e) {
      console.error("[LJT] loadSentences failed:", e);
    }

    // R3 / spec §10.3: detect a mid-LJT reload and seed resume state so that
    //   the intro handler (which owns initOnUserGesture — required by Safari)
    //   can re-instantiate the controller, then skip straight to the proper
    //   screen. If we reloaded before main trials even started (i.e. during
    //   headphone/preload), we restart those screens rather than intro.
    const ljt = session.ljt;
    const reloadedMidTrial = !!(ljt.current_trial_meta && ljt.current_trial_meta.item_id);
    const hasPracticeProgress = Array.isArray(ljt.practiceTrials) && ljt.practiceTrials.length > 0;
    const hasMainProgress = Array.isArray(ljt.mainTrials) && ljt.mainTrials.length > 0;
    if (reloadedMidTrial || hasMainProgress || hasPracticeProgress) {
      // Log an invalidated row for the in-flight trial so logs show "original
      // attempt + re-attempt" per spec §10.3. The re-attempt row will be
      // written normally via onTrialDone when the trial re-plays.
      if (reloadedMidTrial) {
        const orig = ljt.current_trial_meta;
        const invalidatedRow = Object.assign({}, orig, {
          response_value: null,
          response_at_ctx_s: null,
          rt_from_offset_ms: null,
          timeout_flag: false,
          invalidation_reason: "page_reload",
          is_correct: false,
          premature_click_count: 0,
          is_retry_original: true
        });
        if (orig.phase === "practice") {
          ljt.practiceTrials.push(invalidatedRow);
        } else {
          ljt.mainTrials.push(invalidatedRow);
        }
        ljt.sessionMeta.invalidated_trials_count =
          (ljt.sessionMeta.invalidated_trials_count || 0) + 1;

        state.resumePending = true;
        state.resumePhase = orig.phase || ljt.last_phase_shown || "main";
        state.resumeIndex = state.resumePhase === "practice"
          ? (ljt.practice_trial_index || 0)
          : (ljt.main_trial_index || 0);
        state.resumeTrialMeta = orig;
      } else if (hasMainProgress) {
        // Reloaded between trials during main phase — resume at next index
        state.resumePending = true;
        state.resumePhase = "main";
        state.resumeIndex = ljt.mainTrials.length;
      } else if (hasPracticeProgress) {
        state.resumePending = true;
        state.resumePhase = "practice";
        state.resumeIndex = ljt.practiceTrials.length;
      }
      // Clear the persisted in-flight meta so subsequent reloads (before the
      // retry actually starts) don't accumulate duplicate invalidated rows.
      ljt.current_trial_meta = null;
      persistLjtState();
    }

    renderIntroScreen();
  }

  // ---- Intro screen ------------------------------------------------
  function renderIntroScreen() {
    showLjtScreen("ljt-intro-screen");
    // R3: mid-trial or mid-phase reload — surface a brief notice so the
    // participant understands why they're re-entering the task.
    if (state.resumePending) {
      const el = document.getElementById("ljt-intro-start-button");
      if (el) {
        el.textContent = "続きから LJT を再開する";
      }
      const intro = document.getElementById("ljt-intro-screen");
      if (intro && !intro.querySelector(".ljt-resume-notice")) {
        const notice = document.createElement("div");
        notice.className = "notice warn ljt-resume-notice";
        notice.style.margin = "1rem 0";
        const phaseLabel = state.resumePhase === "practice" ? "練習" : "本番";
        notice.textContent = "前回のセッションを検出しました。" + phaseLabel +
          " の途中から再開します。" +
          (state.resumeTrialMeta ? " (中断した試行はやり直します)" : "");
        intro.insertBefore(notice, intro.querySelector(".actions") || null);
      }
    }
    bindClickOnce("ljt-intro-start-button", async function () {
      // CRITICAL: initOnUserGesture MUST be inside this click handler
      state.controller = new LJTController({
        onTrialDone: onTrialDone,
        onMetaUpdate: syncCurrentTrialMeta,
        onEnableButtons: enableYesNo,
        onDisableButtons: disableYesNo
      });
      try {
        await state.controller.initOnUserGesture();
      } catch (e) {
        console.error("[LJT] AudioContext init failed:", e);
        alert("音声システムの初期化に失敗しました。ページを再読み込みしてください。");
        return;
      }
      state.session.ljt.sessionMeta.sample_rate = state.controller.audioCtx.sampleRate;
      state.session.ljt.sessionMeta.output_latency_ms =
        Math.round(state.controller.outputLatency * 1000);
      state.session.ljt.sessionMeta.base_latency_ms =
        Math.round(state.controller.baseLatency * 1000);
      state.session.ljt.sessionMeta.audio_state = state.controller.audioCtx.state;
      state.session.ljt.sessionMeta.connection_type = state.controller.connectionTypeEstimate;
      state.session.ljt.sessionMeta.response_mode = getResponseMode();
      state.session.ljt.sessionMeta.replay_enabled = isReplayEnabled();

      renderHeadphoneCheck();
    });
  }

  // ---- Headphone check --------------------------------------------
  function renderHeadphoneCheck() {
    showLjtScreen("ljt-headphone-check");
    state.checker = new HeadphoneChecker(state.controller.audioCtx);
    runHeadphoneAttempt();
  }

  async function runHeadphoneAttempt() {
    const checker = state.checker;
    const sequence = checker.newSequence();
    const responses = [];
    const container = document.getElementById("ljt-hc-status");
    if (container) container.textContent = "音が 3 回鳴ります。それぞれどこから聞こえたか選んでください。";

    for (let i = 0; i < sequence.length; i++) {
      if (container) container.textContent = "音 " + (i + 1) + " / 3 を再生中...";
      await checker.playTone(sequence[i]);
      // Wait for user click on L/R/both
      const response = await new Promise(function (resolve) {
        ["ljt-hc-left", "ljt-hc-right", "ljt-hc-both"].forEach(function (id) {
          const el = document.getElementById(id);
          if (!el) return;
          const newEl = el.cloneNode(true);
          el.parentNode.replaceChild(newEl, el);
          newEl.addEventListener("click", function () {
            const ch = id === "ljt-hc-left" ? "left"
                     : id === "ljt-hc-right" ? "right" : "both";
            resolve(ch);
          });
        });
      });
      responses.push(response);
      if (container) container.textContent = "回答 " + (i + 1) + " / 3 を受け付けました。";
      // brief gap
      await new Promise(function (r) { setTimeout(r, 400); });
    }

    const passed = checker.recordAttempt(sequence, responses);
    state.session.ljt.headphoneCheck.attempts = checker.attempts;
    state.session.ljt.headphoneCheck.history = checker.history.slice();

    if (passed) {
      state.session.ljt.headphoneCheck.result = "pass";
      if (container) container.textContent = "合格しました。";
      // R5 / spec §10.2: Bluetooth / high-latency re-warning. Pass/fail of the
      //   L/R tone test is orthogonal to wire-vs-wireless detection, so we
      //   always inspect outputLatency AFTER the check has passed.
      maybeShowLatencyWarning(function () {
        setTimeout(startPreload, 400);
      });
    } else if (checker.attempts < 3) {
      if (container) container.textContent = "失敗しました (" + checker.attempts + "/3 試行)。もう一度お試しください。";
      const retryBtn = document.getElementById("ljt-hc-retry");
      if (retryBtn) {
        retryBtn.classList.remove("hidden");
        retryBtn.onclick = function () {
          retryBtn.classList.add("hidden");
          runHeadphoneAttempt();
        };
      } else {
        setTimeout(runHeadphoneAttempt, 1200);
      }
    } else {
      state.session.ljt.headphoneCheck.result = "fail";
      if (container) {
        container.textContent = isResearcherMode()
          ? "ヘッドホン確認に 3 回失敗しました。研究者確認後に続行します。"
          : "ヘッドホン確認に失敗しました。担当者の指示に従ってください。";
      }
      // still allow to proceed (spec §15.6 marks this as exclusion criterion)
      maybeShowLatencyWarning(function () {
        setTimeout(startPreload, 1000);
      });
    }
  }

  // R5 / spec §10.2: After the headphone check completes, inspect the audio
  //   context's outputLatency and surface a modal-style warning for
  //   Bluetooth-class (>20 ms) or genuinely high-latency (>100 ms) devices.
  //   A callback is used (not a promise) to keep the async flow compatible
  //   with Safari which needs subsequent audio calls to run inside the
  //   user-gesture frame triggered by the warning-dismiss click.
  function maybeShowLatencyWarning(onProceed) {
    const ctx = state.controller && state.controller.audioCtx;
    if (!ctx) {
      onProceed();
      return;
    }
    const outputLatencySec = ctx.outputLatency || 0;
    const latencyMs = outputLatencySec * 1000;
    state.session.ljt.sessionMeta.output_latency_ms = Math.round(latencyMs);

    if (latencyMs <= 20) {
      state.session.ljt.sessionMeta.bluetooth_action_chosen = "";
      onProceed();
      return;
    }

    state.session.ljt.sessionMeta.bluetooth_warning_shown = true;
    persistLjtState();

    const isHigh = latencyMs > 100;
    // Build warning dialog inside the headphone-check screen so we don't have
    // to add new HTML. Uses vanilla DOM (no dependency on a modal library).
    const hcScreen = document.getElementById("ljt-headphone-check");
    if (!hcScreen) { onProceed(); return; }

    // Remove any previously-shown notice so we don't stack duplicates.
    const stale = hcScreen.querySelector(".ljt-latency-warning");
    if (stale) stale.remove();

    const box = document.createElement("div");
    box.className = "notice warn ljt-latency-warning";
    box.setAttribute("role", "alertdialog");
    box.setAttribute("aria-live", "assertive");
    box.style.margin = "1.2rem 0";

    if (isHigh) {
      box.innerHTML = isResearcherMode()
        ? "<h3 style=\"margin-top:0\">高レイテンシ検出</h3>" +
          "<p>音声出力遅延が <strong>" + Math.round(latencyMs) + " ms</strong> です。" +
          "この環境では本番の結果信頼性が大幅に低下します。" +
          "可能であれば有線接続に変更してやり直してください。</p>" +
          "<label style=\"display:block;margin:0.6rem 0\">" +
          "<input type=\"checkbox\" id=\"ljt-hc-warn-ack\"> " +
          "この警告を理解した上で続行することに同意します</label>" +
          "<div class=\"actions\">" +
          "<button type=\"button\" id=\"ljt-hc-warn-continue\" disabled>このまま続行</button> " +
          "<button type=\"button\" class=\"secondary\" id=\"ljt-hc-warn-restart\">" +
          "接続を切り替えてやり直す</button></div>"
        : "<h3 style=\"margin-top:0\">音声の遅れが大きい可能性があります</h3>" +
          "<p>イヤホンや接続を確認してください。可能であれば有線接続を使ってください。</p>" +
          "<label style=\"display:block;margin:0.6rem 0\">" +
          "<input type=\"checkbox\" id=\"ljt-hc-warn-ack\"> 内容を確認しました</label>" +
          "<div class=\"actions\">" +
          "<button type=\"button\" id=\"ljt-hc-warn-continue\" disabled>このまま続行</button> " +
          "<button type=\"button\" class=\"secondary\" id=\"ljt-hc-warn-restart\">" +
          "接続を確認する</button></div>";
    } else {
      box.innerHTML = isResearcherMode()
        ? "<h3 style=\"margin-top:0\">Bluetooth 接続の可能性</h3>" +
          "<p>音声出力遅延が <strong>" + Math.round(latencyMs) + " ms</strong> " +
          "と検出されました。Bluetooth の可能性があります。" +
          "<strong>有線接続を推奨</strong>しますが、続行することは可能です。" +
          "結果解釈の際にこの情報が記録されます。</p>" +
          "<div class=\"actions\">" +
          "<button type=\"button\" id=\"ljt-hc-warn-continue\">続行</button> " +
          "<button type=\"button\" class=\"secondary\" id=\"ljt-hc-warn-restart\">" +
          "接続を切り替えてやり直す</button></div>"
        : "<h3 style=\"margin-top:0\">接続を確認してください</h3>" +
          "<p>音声が遅れて聞こえる可能性があります。可能であれば有線接続を使ってください。</p>" +
          "<div class=\"actions\">" +
          "<button type=\"button\" id=\"ljt-hc-warn-continue\">続行</button> " +
          "<button type=\"button\" class=\"secondary\" id=\"ljt-hc-warn-restart\">" +
          "接続を確認する</button></div>";
    }
    hcScreen.appendChild(box);

    if (isHigh) {
      const ack = document.getElementById("ljt-hc-warn-ack");
      const contBtn = document.getElementById("ljt-hc-warn-continue");
      if (ack && contBtn) {
        ack.addEventListener("change", function () {
          contBtn.disabled = !ack.checked;
        });
      }
    }
    const finish = function (choice) {
      state.session.ljt.sessionMeta.bluetooth_action_chosen = choice;
      persistLjtState();
      try { box.remove(); } catch (e) { /* ignore */ }
      onProceed();
    };
    const contEl = document.getElementById("ljt-hc-warn-continue");
    if (contEl) {
      contEl.addEventListener("click", function () {
        if (contEl.disabled) return;
        finish(isHigh ? "continued_with_warning" : "ignored");
      });
    }
    const restartEl = document.getElementById("ljt-hc-warn-restart");
    if (restartEl) {
      restartEl.addEventListener("click", function () {
        state.session.ljt.sessionMeta.bluetooth_action_chosen =
          "restarted_after_warning";
        persistLjtState();
        try { box.remove(); } catch (e) { /* ignore */ }
        // Restart the headphone check. Participant can reconnect a wired
        // device and re-run; the latency will be re-sampled on the subsequent
        // successful pass.
        runHeadphoneAttempt();
      });
    }
  }

  // ---- Preload -----------------------------------------------------
  async function startPreload() {
    showLjtScreen("ljt-preload-screen");
    state.session.ljt.preload.startedAt = new Date().toISOString();

    // R3: On resume the targets + trial plan already exist in session; rebuild
    //   them from stored data to avoid re-sampling (which would pick different
    //   targets and render the partial-log inconsistent).
    const hasStoredTargets = Array.isArray(state.session.ljt.targets) &&
      state.session.ljt.targets.length > 0;

    if (!hasStoredTargets) {
      state.session.ljt.targets = sampleLJTTargets(
        state.session,
        (CONFIG_REF && CONFIG_REF.LJT_TARGET_N) || 40
      );
    }
    state.trialPlanPractice = buildPracticeTrialPlan(SENTENCE_BANK.practice);
    state.trialPlanMain = buildTrialPlan(
      state.session.ljt.targets,
      SENTENCE_BANK.main,
      "main"
    );
    const allTrials = state.trialPlanPractice.concat(state.trialPlanMain);
    const uniqueFiles = Array.from(new Set(allTrials.map(function (t) { return t.audio_file; })));
    state.session.ljt.preload.total = uniqueFiles.length;

    setText("ljt-preload-status", isResearcherMode()
      ? "音声ファイル " + uniqueFiles.length + " 件を読み込み中 (0/" + uniqueFiles.length + ")..."
      : "音声を準備しています...");
    const startBtn = document.getElementById("ljt-preload-start-button");
    if (startBtn) startBtn.disabled = true;

    let done = 0;
    const failures = [];
    await Promise.all(uniqueFiles.map(function (file) {
      return state.controller.preloadAudio(file)
        .then(function (buf) {
          state.audioBuffers.set(file, buf);
        })
        .catch(function (err) {
          console.warn("[LJT] preload failed for " + file + ":", err);
          failures.push(file);
        })
        .finally(function () {
          done += 1;
          setText("ljt-preload-status", isResearcherMode()
            ? "音声ファイル " + uniqueFiles.length + " 件を読み込み中 (" + done + "/" + uniqueFiles.length + ")..."
            : "音声を準備しています...");
        });
    }));

    state.session.ljt.preload.finishedAt = new Date().toISOString();
    state.session.ljt.preload.failures = failures;

    if (failures.length > 0) {
      const researcherMode = isResearcherMode();
      const debugMsg = "音声ファイル " + failures.length + " 件の読み込みに失敗しました。\n\n" +
        "これは想定動作です (音声ファイル未生成の場合)。\n" +
        "研究者: ljt/audio/ に wav ファイルを配置してください。\n\n" +
        "失敗ファイル (最初の 5 件):\n" + failures.slice(0, 5).join("\n");
      const participantMsg =
        "音声の準備に失敗しました。研究担当者に知らせてください。";
      setText("ljt-preload-status", researcherMode ? debugMsg : participantMsg);
      const errBox = document.getElementById("ljt-preload-error");
      if (errBox) {
        if (researcherMode) {
          errBox.textContent = debugMsg;
          errBox.classList.remove("hidden");
        } else {
          errBox.textContent = "";
          errBox.classList.add("hidden");
        }
      }
      if (startBtn) {
        if (researcherMode) {
          startBtn.disabled = false;
          startBtn.textContent = "それでも続行 (研究者用)";
        } else {
          startBtn.disabled = true;
          startBtn.textContent = "担当者に知らせてください";
        }
      }
    } else {
      setText("ljt-preload-status", isResearcherMode()
        ? "読み込み完了 (" + uniqueFiles.length + " 件)。"
        : "準備ができました。");
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = "次へ進む";
      }
    }
    if (startBtn) {
      startBtn.onclick = function () {
        // R3: honour resume-at-main or resume-at-practice requests. A retry
        //   of the exact mid-trial row is handled by runNextTrial because
        //   resumeIndex already points at the interrupted trial.
        if (state.resumePending && state.resumePhase === "main") {
          state.resumePending = false;
          state.session.ljt.mainStartedAt = state.session.ljt.mainStartedAt ||
            new Date().toISOString();
          state.currentIndex = Math.max(0, Math.min(
            state.resumeIndex, state.trialPlanMain.length - 1));
          showLjtScreen("ljt-main-screen");
          runNextTrial("main");
          return;
        }
        if (state.resumePending && state.resumePhase === "practice") {
          state.resumePending = false;
          showLjtScreen("ljt-practice-screen");
          state.currentIndex = Math.max(0, Math.min(
            state.resumeIndex, state.trialPlanPractice.length - 1));
          runNextTrial("practice");
          return;
        }
        renderPracticePhase();
      };
    }
  }

  // ---- Practice phase ---------------------------------------------
  function renderPracticePhase() {
    showLjtScreen("ljt-practice-screen");
    const contBtn = document.getElementById("ljt-practice-continue-button");
    if (contBtn) contBtn.classList.add("hidden");
    state.currentIndex = 0;
    runNextTrial("practice");
  }

  async function runNextTrial(phase) {
    const trials = phase === "practice" ? state.trialPlanPractice : state.trialPlanMain;
    if (state.currentIndex >= trials.length) {
      if (phase === "practice") {
        // R2 / spec §14.1: accuracy gate. If we haven't already injected extras
        // and accuracy on the original 20 trials is below 60 %, append 5 extras.
        //   Exclude: (a) practice-extras themselves, (b) invalidated rows
        //   (page_reload, tab_hidden_mid_trial, audiocontext_suspended, etc.)
        //   — those would depress the denominator without reflecting ability.
        if (!state.session.ljt.sessionMeta.practice_extra_triggered) {
          const practiceTrials = state.session.ljt.practiceTrials || [];
          const scorable = practiceTrials.filter(function (t) {
            return !t.is_practice_extra && !t.invalidation_reason;
          });
          const correctCt = scorable.filter(function (t) {
            return !!t.is_correct;
          }).length;
          const acc = scorable.length > 0 ? (correctCt / scorable.length) : 1;
          state.session.ljt.sessionMeta.practice_accuracy_original = acc;
          if (scorable.length > 0 && acc < 0.60) {
            state.session.ljt.sessionMeta.practice_extra_triggered = true;
            const extras = buildPracticeExtraTrials(SENTENCE_BANK.practice, 5);
            // renumber the trial_seq/trial_in_phase so logs stay consistent
            let seq = trials.length;
            extras.forEach(function (t) {
              t.trial_seq = ++seq;
              t.trial_in_phase = seq;
            });
            state.trialPlanPractice = trials.concat(extras);
            try {
              console.info("[LJT] practice_extra_triggered (accuracy " +
                (acc * 100).toFixed(1) + "% < 60%): +" + extras.length +
                " extra practice trials.");
            } catch (e) { /* ignore */ }
            setText("ljt-practice-status",
              "練習の正答率が目安を下回ったため、追加 " + extras.length + " 試行を行います。");
            // Keep the same phase running so the next iteration picks up the
            // newly appended trials.
            await new Promise(function (r) { setTimeout(r, 1200); });
            runNextTrial(phase);
            return;
          }
        }

        // End of practice — prompt to start main
        bindClickOnce("ljt-practice-continue-button", function () {
          state.session.ljt.mainStartedAt = new Date().toISOString();
          state.currentIndex = 0;
          showLjtScreen("ljt-main-screen");
          runNextTrial("main");
        });
        const shownN = trials.length;
        setText("ljt-practice-status",
          "練習 " + shownN + " 試行が終わりました。本番に進んでください。");
        const contBtn = document.getElementById("ljt-practice-continue-button");
        if (contBtn) contBtn.classList.remove("hidden");
        return;
      }
      // main complete
      state.session.ljt.mainFinishedAt = new Date().toISOString();
      state.session.ljt.completed = true;
      state.session.ljt.completedAt = state.session.ljt.mainFinishedAt;  // R4 gate
      state.session.ljt.current_trial_meta = null;                       // R3 cleanup
      const startedMs = Date.parse(state.session.ljt.mainStartedAt);
      const endedMs = Date.parse(state.session.ljt.mainFinishedAt);
      if (isFinite(startedMs) && isFinite(endedMs)) {
        state.session.ljt.totalDurationSec = (endedMs - startedMs) / 1000;
      }
      persistLjtState();
      renderResultScreen();
      return;
    }

    // Check for optional pause at trial 40 in main phase
    const pauseAt = Math.floor(((CONFIG_REF && CONFIG_REF.LJT_MAIN_N) || 80) / 2);
    if (phase === "main" && state.currentIndex === pauseAt && !state.pauseShown) {
      state.pauseShown = true;
      showLjtScreen("ljt-pause-screen");
      bindClickOnce("ljt-pause-continue-button", function () {
        showLjtScreen("ljt-main-screen");
        runNextTrial(phase);
      });
      return;
    }

    const trial = trials[state.currentIndex];
    const trialMeta = Object.assign({}, trial, {
      started_at_iso: new Date().toISOString()
    });
    const statusId = phase === "practice" ? "ljt-practice-status" : "ljt-main-status";
    const progressId = phase === "practice" ? "ljt-practice-progress" : "ljt-main-progress";
    setText(statusId, "再生中 ...");
    setText(progressId,
      (phase === "practice" ? "練習 " : "本番 ") +
      (state.currentIndex + 1) + " / " + trials.length);

    // R3: §10.3 — record the in-flight trial so restoreState can detect that
    //   a reload interrupted THIS trial and retry it with invalidation_reason
    //   = "page_reload". We snapshot a shallow copy so the controller can
    //   augment meta during playTrial without polluting the persisted record.
    state.session.ljt.last_phase_shown = phase;
    if (phase === "practice") {
      state.session.ljt.practice_trial_index = state.currentIndex;
    } else {
      state.session.ljt.main_trial_index = state.currentIndex;
    }
    state.session.ljt.current_trial_meta = clonePlain(trialMeta);
    persistLjtState();

    const audioBuf = state.audioBuffers.get(trial.audio_file);
    if (!audioBuf) {
      // audio missing — skip trial with invalidation
      console.warn("[LJT] no audio buffer for", trial.audio_file, "— skipping");
      state.currentIndex += 1;
      // Record as invalidated
      const invalidatedMeta = Object.assign({}, trial, {
        response_value: null,
        response_at_ctx_s: null,
        rt_from_offset_ms: null,
        rt_from_first_offset_ms: null,
        rt_from_last_offset_ms: null,
        timeout_flag: false,
        invalidation_reason: "audio_missing",
        is_correct: false,
        premature_click_count: 0,
        premature_replay_click_count: 0,
        audio_play_count_total: 0,
        audio_play_count_completed: 0,
        audio_replay_count: 0,
        audio_play_events: []
      });
      if (phase === "practice") {
        state.session.ljt.practiceTrials.push(invalidatedMeta);
      } else {
        state.session.ljt.mainTrials.push(invalidatedMeta);
      }
      setTimeout(function () { runNextTrial(phase); }, 200);
      return;
    }

    // Wire yes/no buttons
    disableYesNo();
    setupResponseHandlers(phase);

    await state.controller.playTrial(trialMeta, audioBuf);
    // settleTrial callback writes the trial; onTrialDone pushes to session

    // Inter-trial interval 800 ms (+ fixation handled visually by UI)
    await new Promise(function (r) { setTimeout(r, 800); });

    if (phase === "practice") {
      // show feedback for practice
      const last = state.session.ljt.practiceTrials[state.session.ljt.practiceTrials.length - 1];
      const fb = last && last.is_correct
        ? "正解"
        : (last && last.timeout_flag ? "時間切れ" : "不正解");
      setText(statusId, "直前の試行: " + fb);
      await new Promise(function (r) { setTimeout(r, 900); });
    }

    state.currentIndex += 1;
    runNextTrial(phase);
  }

  function onTrialDone(payload) {
    const meta = payload && payload.meta;
    if (!meta) return;
    if (meta.phase === "practice") {
      state.session.ljt.practiceTrials.push(meta);
    } else {
      state.session.ljt.mainTrials.push(meta);
    }
    if (meta.invalidation_reason) {
      state.session.ljt.sessionMeta.invalidated_trials_count =
        (state.session.ljt.sessionMeta.invalidated_trials_count || 0) + 1;
    }
    // R3: trial is settled — clear the in-flight snapshot.
    state.session.ljt.current_trial_meta = null;
    persistLjtState();
  }

  function syncCurrentTrialMeta(meta) {
    if (!(state && state.session && state.session.ljt)) return;
    state.session.ljt.current_trial_meta = clonePlain(meta);
    persistLjtState();
  }

  // R3: Thin wrapper around the main app's persistence hook (installed as
  // window.UVLT_CAT_PERSIST_HOOK by script.js). No-op if the hook is absent
  // (e.g. running the module in isolation for tests).
  function persistLjtState() {
    try {
      if (typeof window.UVLT_CAT_PERSIST_HOOK === "function") {
        window.UVLT_CAT_PERSIST_HOOK(state && state.session);
      }
    } catch (e) { /* ignore — persistence failures must not break trials */ }
  }

  function getResponseButtonIds(phase) {
    if (phase === "main") {
      return { yesId: "ljt-response-yes-main", noId: "ljt-response-no-main" };
    }
    return { yesId: "ljt-response-yes", noId: "ljt-response-no" };
  }

  function getReplayButtonId(phase) {
    return phase === "main" ? "ljt-replay-button-main" : "ljt-replay-button";
  }

  function allResponseButtonIds() {
    return [
      "ljt-response-yes", "ljt-response-no",
      "ljt-response-yes-main", "ljt-response-no-main"
    ];
  }

  function allReplayButtonIds() {
    return ["ljt-replay-button", "ljt-replay-button-main"];
  }

  function setupResponseHandlers(phase) {
    const ids = getResponseButtonIds(phase);
    [ids.yesId, ids.noId].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);
      newEl.addEventListener("click", function () {
        const value = id === ids.yesId ? 1 : 0;
        if (state.controller.trialSettled ||
            state.controller.currentTrialMeta === null) {
          return;  // already settled
        }
        // if audio still playing, record premature click and ignore
        if (state.controller.isAudioPlaying()) {
          state.controller.onPrematureClick();
          return;
        }
        state.controller.onResponseClick(value);
      });
    });

    const replayId = getReplayButtonId(phase);
    const replayEl = document.getElementById(replayId);
    if (replayEl) {
      const newReplayEl = replayEl.cloneNode(true);
      replayEl.parentNode.replaceChild(newReplayEl, replayEl);
      newReplayEl.classList.toggle("hidden", !isReplayEnabled());
      newReplayEl.disabled = true;
      newReplayEl.addEventListener("click", function () {
        if (!isReplayEnabled() || !state.controller || state.controller.trialSettled) {
          return;
        }
        if (state.controller.isAudioPlaying()) {
          state.controller.onPrematureReplayClick();
          return;
        }
        setText(phase === "practice" ? "ljt-practice-status" : "ljt-main-status", "再生中 ...");
        state.controller.replayCurrentAudio();
      });
    }
  }

  function enableYesNo() {
    allResponseButtonIds().forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });
    allReplayButtonIds().forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle("hidden", !isReplayEnabled());
      el.disabled = !isReplayEnabled();
    });
  }
  function disableYesNo() {
    allResponseButtonIds().forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
    allReplayButtonIds().forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  }

  // ---- Result screen ----------------------------------------------
  function renderResultScreen() {
    showLjtScreen("ljt-result-screen");
    const summary = LJTScorer.computeSummary(state.session.ljt.mainTrials);

    setText("ljt-result-d-primary",
      summary.d_primary == null ? "—" : summary.d_primary.toFixed(2));
    setText("ljt-result-hit-rate",
      summary.H == null ? "—" : (summary.H * 100).toFixed(1) + "%");
    setText("ljt-result-fa-rate",
      summary.F == null ? "—" : (summary.F * 100).toFixed(1) + "%");
    setText("ljt-result-raw-accuracy",
      summary.raw_accuracy == null ? "—" : (summary.raw_accuracy * 100).toFixed(1) + "%");
    setText("ljt-result-mean-rt",
      summary.mean_rt_app_correct == null ? "—" : Math.round(summary.mean_rt_app_correct) + " ms");

    // Now hand control back to the main CAT app to render the full result screen.
    const cb = window.UVLT_CAT_RESULT_HOOK;
    if (typeof cb === "function") {
      try { cb(state.session); } catch (e) { console.error(e); }
    }

    // wire the continue button that transitions to CAT result screen
    bindClickOnce("ljt-result-continue-button", function () {
      const onDone = window.UVLT_CAT_AFTER_LJT;
      if (typeof onDone === "function") {
        onDone(state.session);
      }
    });
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  window.UVLT_LJT = {
    init: function (config) {
      CONFIG_REF = config || {};
    },
    isEnabled: function () {
      return !!(CONFIG_REF && CONFIG_REF.ENABLE_LJT_PHASE);
    },
    isSessionComplete: function (session) {
      return !!(session && session.ljt && session.ljt.completed);
    },
    /**
     * R1: Allow the main app to hand the LJT module the per-item linked
     * difficulty values so sampleLJTTargets can apply the |d − θ̂| ≤ 0.5
     * neighborhood filter of §6.1 without the module duplicating the bank.
     * @param {Object|Map} map — { item_id: Number } or Map<string, number>
     */
    setItemDifficultyMap: function (map) {
      if (!map) { ITEM_DIFFICULTY_MAP = null; return; }
      const out = {};
      if (map instanceof Map) {
        map.forEach(function (v, k) {
          if (typeof v === "number" && isFinite(v)) out[k] = v;
        });
      } else {
        Object.keys(map).forEach(function (k) {
          const v = map[k];
          if (typeof v === "number" && isFinite(v)) out[k] = v;
        });
      }
      ITEM_DIFFICULTY_MAP = out;
    },
    startPhase: startPhase,
    loadSentences: loadSentences,
    sampleLJTTargets: sampleLJTTargets,
    buildExcelSheets: buildExcelSheets,
    // exposed for testing
    _internal: {
      LJTController: LJTController,
      LJTScorer: LJTScorer,
      HeadphoneChecker: HeadphoneChecker,
      parseCSV: parseCSV,
      csvToObjects: csvToObjects,
      normalQuantile: normalQuantile,
      PRACTICE_ITEMS: PRACTICE_ITEMS,
      extractThetaHat: extractThetaHat,
      getItemDifficultyMap: function () { return ITEM_DIFFICULTY_MAP; }
    }
  };
})();
