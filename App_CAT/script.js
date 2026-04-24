(function () {
  "use strict";

  const CONFIG = {
    storageKey: "uvlt_testlet_cat_github_pages_v2",
    operationalModeLabel: "multi-band routing + common-person cross-band linking + testlet-aware marginal EAP approximation + expected posterior variance reduction",
    priorMean: 0,
    priorSD: 1,
    thetaMin: -6,
    thetaMax: 6,
    thetaStep: 0.05,
    selectionThetaStep: 0.2,
    selectionMetricType: "expectedPosteriorVarianceReduction",
    minTestlets: 6,
    maxTestlets: 12,
    targetSE: 0.52,
    storageTTLHours: 24,
    quadraturePoints: 15,
    exposureControlEnabled: false,
    maxExposureRate: 0.30,
    exposurePenaltyWeight: 0.10,
    // ----- LJT (Lexicosemantic Judgement Task) phase, spec v0.5 §13 -----
    ENABLE_LJT_PHASE: true,
    LJT_PRACTICE_N: 10,
    LJT_MAIN_N: 80,
    LJT_RESPONSE_MODE: "untimed",
    LJT_ALLOW_REPLAY: true,
    LJT_DEADLINE_APP_MS: 1600,
    LJT_DEADLINE_INAPP_MS: 2000,
    LJT_TARGET_N: 40,
    LJT_THETA_PAD_MAX_PER_TESTLET: 1
  };

  function detectResearcherMode() {
    try {
      return new URLSearchParams(window.location.search).get("researcher") === "1";
    } catch (error) {
      return false;
    }
  }

  const UI_MODE = {
    researcher: detectResearcherMode()
  };

  function isResearcherMode() {
    return !!UI_MODE.researcher;
  }

  function suspendHistoryGuardForNextUnload() {
    try {
      state.historyGuardSuspended = true;
    } catch (error) {
      /* state may not be initialized in isolated test harnesses */
    }
  }

  function applyUIMode() {
    if (typeof document === "undefined" || !document.body) {
      return;
    }
    document.body.classList.toggle("researcher-mode", isResearcherMode());
  }

  if (typeof window !== "undefined") {
    window.UVLT_CAT_UI = {
      isResearcherMode: isResearcherMode,
      suspendHistoryGuardForNextUnload: suspendHistoryGuardForNextUnload
    };
  }

  // v1 → v2 migration: new cohort policy, discard any v1 payload so we don't
  // restore into an incompatible state shape. (Spec v0.5 §13.3.)
  function migrateOrClearOldStorage() {
    try {
      const v1 = localStorage.getItem("uvlt_testlet_cat_github_pages_v1");
      if (v1 != null) {
        localStorage.removeItem("uvlt_testlet_cat_github_pages_v1");
        if (typeof console !== "undefined") {
          console.info("[UVLT] v1 localStorage cleared (new-cohort policy).");
        }
      }
    } catch (e) {
      // ignore: storage may be disabled
    }
  }
  migrateOrClearOldStorage();

  // Hand CONFIG to the LJT module (loaded via separate script tag).
  if (typeof window !== "undefined" && window.UVLT_LJT && typeof window.UVLT_LJT.init === "function") {
    window.UVLT_LJT.init(CONFIG);
  }

  // R1 / spec §6.1: supply the LJT module with per-item linked difficulty
  //   so its sampleLJTTargets() can filter theta_pad candidates to the
  //   ±0.5 logit neighborhood of CAT's final theta_hat. Built below once
  //   TEST_BANK is constructed (delayed call via wireLjtItemDifficulties()).
  function wireLjtItemDifficulties() {
    if (!(window.UVLT_LJT && typeof window.UVLT_LJT.setItemDifficultyMap === "function")) {
      return;
    }
    const map = {};
    const testletMap = {};
    Object.keys(TEST_BANK.itemMap).forEach(function (itemId) {
      const item = TEST_BANK.itemMap[itemId];
      if (item && typeof item.linkedDifficulty === "number") {
        map[itemId] = item.linkedDifficulty;
      }
      if (item && item.testletId) {
        testletMap[itemId] = item.testletId;
      }
    });
    try { window.UVLT_LJT.setItemDifficultyMap(map); } catch (e) {
      console.error("[UVLT] setItemDifficultyMap failed:", e);
    }
    if (typeof window.UVLT_LJT.setItemTestletMap === "function") {
      try { window.UVLT_LJT.setItemTestletMap(testletMap); } catch (e) {
        console.error("[UVLT] setItemTestletMap failed:", e);
      }
    }
  }

  const PRACTICE_TESTLETS = [
    {
      practiceId: "practice_01",
      title: "練習 1",
      description: "まずは形式に慣れてください。3つの英語の意味それぞれに対応する語を選びます。",
      options: ["game", "island", "mouth", "movie", "song", "yard"],
      definitions: [
        { prompt: "land with water all around it", correctOption: "island" },
        { prompt: "part of your body used for eating and speaking", correctOption: "mouth" },
        { prompt: "a piece of music", correctOption: "song" }
      ]
    },
    {
      practiceId: "practice_02",
      title: "練習 2",
      description: "本番と同じ形式です。3つの英語の意味それぞれに最も合う語を1つずつ選んでください。",
      options: ["boy", "rent", "report", "size", "station", "thing"],
      definitions: [
        { prompt: "how big something is", correctOption: "size" },
        { prompt: "place where buses and trains arrive and leave", correctOption: "station" },
        { prompt: "a young male person", correctOption: "boy" }
      ]
    }
  ];

  const RAW_BAND_REFERENCE = {
    "1k": [-2.97942, -3.11853, -3.29266, -3.24746, -3.47051, -3.47051, -3.41272, -2.31129, -1.92248, -2.25096, -3.05118, -2.6499, -1.70328, -2.29598, -2.05763, -2.50274, -2.752, -3.10634, -2.4476, -2.57668, -1.84433, -2.5432, -1.84817, -0.93159, -3.08665, -3.61942, -3.36637, -0.94702, -1.22047, -1.73415],
    "2k": [-0.67529, -1.03908, -0.47767, -2.69415, -2.16032, -1.80317, -1.52419, -2.13189, -0.65492, -0.83834, -0.52813, 0.92313, -0.75561, -1.53636, -2.2663, -0.45807, -0.17593, -1.0166, -0.62371, -1.77664, -1.37614, -1.05696, -0.55582, -0.99606, -1.60194, -1.0372, 0.24745, 0.31803, -0.09045, -1.34679],
    "3k": [-1.21091, -1.1445, -1.81482, -1.01839, 0.49014, -0.3644, -1.04129, 0.57422, -1.97556, -0.92312, 0.28591, 0.69795, -1.29949, 0.57966, -1.8728, 0.80322, 0.6405, -0.24254, 0.00439, -0.17315, 0.16981, 0.66427, 0.66427, 0.71318, -0.68827, -0.20239, -0.71279, 0.01452, 0.47754, 0.60601],
    "4k": [-1.30329, -0.8106, 0.04709, -1.55279, -1.46711, -1.32819, 1.36317, 1.90707, 0.61313, 0.99444, 1.09688, 0.69816, 0.62973, -0.47131, 0.23521, -0.34152, 0.74048, 0.41277, 0.33921, 0.92455, 0.06449, 0.16599, 0.23408, -0.24867, 1.10217, 0.77742, 0.47456, 0.12488, 0.6346, -0.14029],
    "5k": [0.4187, -0.59309, 0.58643, 0.13516, 0.25492, 0.21123, 0.0739, 1.0403, -0.84137, -0.47066, -0.23389, 0.99636, 1.20411, 1.95915, 0.31854, -0.29743, 0.73262, -0.17359, 0.88251, 0.77906, 1.35679, 0.88522, 0.78701, 1.59435, 1.56878, 0.04684, 0.34657, 2.05119, 0.73821, 1.44108]
  };
  const BAND_ORDER = ["1k", "2k", "3k", "4k", "5k"];
  const BAND_DESCRIPTIONS = {
    "1k": "ごく基本的な語",
    "2k": "基礎的な日常語",
    "3k": "中頻度の一般語",
    "4k": "やや発展的な語",
    "5k": "発展的・低頻度の語"
  };
  const INTERRUPTION_EVENT_TYPES = ["browser_back_attempt", "beforeunload_prompt", "page_hidden", "pagehide"];
  const CROSS_BAND_LINKING = {
    version: "2026-03-26-common-person-v1",
    method: "common-person complete-case Rasch linking",
    scale: "linked multi-band theta scale",
    calibrationSampleSize: 302,
    source: "Study01_UVLT complete-case respondents across 1k-5k (11TL raw responses)",
    coefficients: {
      "1k": { slope: 1.67393, intercept: 1.040786, correlation: 0.968506, rmse: 0.322672 },
      "2k": { slope: 1.663797, intercept: 0.943617, correlation: 0.998129, rmse: 0.08212 },
      "3k": { slope: 1.725087, intercept: 0.973808, correlation: 0.999483, rmse: 0.047686 },
      "4k": { slope: 1.709496, intercept: 1.058006, correlation: 0.997631, rmse: 0.099038 },
      "5k": { slope: 1.609528, intercept: 0.986388, correlation: 0.998525, rmse: 0.064178 }
    }
  };

  function applyCrossBandLinking(band, rawDifficulty) {
    const coefficient = CROSS_BAND_LINKING.coefficients[band];
    return Number((coefficient.slope * rawDifficulty + coefficient.intercept).toFixed(5));
  }

  function buildLinkedBandReference() {
    const linked = {};

    BAND_ORDER.forEach(function (band) {
      linked[band] = RAW_BAND_REFERENCE[band].map(function (rawDifficulty) {
        return applyCrossBandLinking(band, rawDifficulty);
      });
    });

    return linked;
  }

  const BAND_REFERENCE = buildLinkedBandReference();
  const RAW_TESTLET_VARIANCES = {
    "1k": [0.51292, 0.78248, 0.80257, 0.60581, 0.73041, 1.40502, 0.46701, 0.9806, 2.15975, 2.4502],
    "2k": [0.57812, 1.06486, 0.29591, 1.40184, 1.57106, 1.17961, 0.97126, 0.67629, 0.79426, 0.66219],
    "3k": [1.10257, 0.30189, 1.26191, 1.18785, 0.89292, 0.52752, 0.62772, 0.88701, 0.40443, 0.28666],
    "4k": [0.80541, 2.78514, 1.58759, 0.836, 0.69884, 0.11795, 0.28894, 0.21365, 0.24206, 0.71627],
    "5k": [0.20547, 0.22906, 1.39371, 0.90107, 1.4029, 0.25347, 0.9359, 3.33337, 1.15354, 2.45207]
  };

  function buildLinkedTestletVariances() {
    const linked = {};

    BAND_ORDER.forEach(function (band) {
      const slope = CROSS_BAND_LINKING.coefficients[band].slope;
      linked[band] = RAW_TESTLET_VARIANCES[band].map(function (variance) {
        return Number((variance * slope * slope).toFixed(5));
      });
    });

    return linked;
  }

  const TESTLET_VARIANCES = buildLinkedTestletVariances();
  const QUADRATURE_CACHE = {};
  const THETA_GRID_CACHE = {};
  const PRIOR_POSTERIOR_CACHE = {};
  const TESTLET_PATTERN_LIKELIHOOD_CACHE = {};
  const TESTLET_THETA_PATTERN_CACHE = {};
  const TESTLET_INFORMATION_CACHE = {};
  const INITIAL_SELECTION_CACHE = {};

  function clearConfigDependentCaches() {
    Object.keys(PRIOR_POSTERIOR_CACHE).forEach(function (key) { delete PRIOR_POSTERIOR_CACHE[key]; });
    Object.keys(INITIAL_SELECTION_CACHE).forEach(function (key) { delete INITIAL_SELECTION_CACHE[key]; });
  }

  const GAUSS_HERMITE_NODES = [
    -4.4999907073093919, -3.6699503734044527, -2.9671669279056032, -2.3257324861738580, -1.7199925751864888,
    -1.1361155852109206, -0.5650695832555758, 0.0, 0.5650695832555758, 1.1361155852109206,
    1.7199925751864888, 2.3257324861738580, 2.9671669279056032, 3.6699503734044527, 4.4999907073093919
  ];
  const GAUSS_HERMITE_WEIGHTS = [
    0.0000000015224758, 0.0000010591155477, 0.0001000044412325, 0.0027780688429128, 0.0307800338725461,
    0.1584889157959357, 0.4120286874988987, 0.5641003087264174, 0.4120286874988987, 0.1584889157959357,
    0.0307800338725461, 0.0027780688429128, 0.0001000044412325, 0.0000010591155477, 0.0000000015224758
  ];

  const BAND_BLUEPRINTS = {
    "1k": [
      { partOfSpeech: "noun", options: ["choice", "computer", "garden", "photograph", "price", "week"], prompts: ["cost", "picture", "place where things grow outside"], answers: ["price", "photograph", "garden"] },
      { partOfSpeech: "noun", options: ["eye", "father", "night", "van", "voice", "year"], prompts: ["body part that sees", "parent who is a man", "part of the day with no sun"], answers: ["eye", "father", "night"] },
      { partOfSpeech: "noun", options: ["center", "note", "state", "tomorrow", "uncle", "winter"], prompts: ["brother of your mother or father", "middle", "short piece of writing"], answers: ["uncle", "center", "note"] },
      { partOfSpeech: "noun", options: ["box", "brother", "horse", "hour", "house", "plan"], prompts: ["family member", "sixty minutes", "way of doing things"], answers: ["brother", "hour", "plan"] },
      { partOfSpeech: "noun", options: ["animal", "bath", "crime", "grass", "law", "shoulder"], prompts: ["green leaves that cover the ground", "place to wash", "top end of your arm"], answers: ["grass", "bath", "shoulder"] },
      { partOfSpeech: "verb", options: ["drink", "educate", "forget", "laugh", "prepare", "suit"], prompts: ["get ready", "make a happy sound", "not remember"], answers: ["prepare", "laugh", "forget"] },
      { partOfSpeech: "verb", options: ["check", "fight", "return", "tell", "work", "write"], prompts: ["do things to get money", "go back again", "make sure"], answers: ["work", "return", "check"] },
      { partOfSpeech: "verb", options: ["bring", "can", "reply", "stare", "understand", "wish"], prompts: ["say or write an answer to somebody", "carry to another place", "look at for a long time"], answers: ["reply", "bring", "stare"] },
      { partOfSpeech: "adjective", options: ["alone", "bad", "cold", "green", "loud", "main"], prompts: ["most important", "not good", "not hot"], answers: ["main", "bad", "cold"] },
      { partOfSpeech: "adjective", options: ["awful", "definite", "exciting", "general", "mad", "sweet"], prompts: ["certain", "usual", "very bad"], answers: ["definite", "general", "awful"] }
    ],
    "2k": [
      { partOfSpeech: "noun", options: ["coach", "customer", "feature", "pie", "vehicle", "weed"], prompts: ["important part of something", "person who trains members of sports teams", "unwanted plant"], answers: ["feature", "coach", "weed"] },
      { partOfSpeech: "noun", options: ["average", "discipline", "knowledge", "pocket", "trap", "vegetable"], prompts: ["food grown in gardens", "information which a person has", "middle number"], answers: ["vegetable", "knowledge", "average"] },
      { partOfSpeech: "noun", options: ["circle", "justice", "knife", "onion", "partner", "pension"], prompts: ["round shape", "something used to cut food", "using laws fairly"], answers: ["circle", "knife", "justice"] },
      { partOfSpeech: "noun", options: ["cable", "section", "sheet", "site", "staff", "tank"], prompts: ["part", "place", "something to cover a bed"], answers: ["section", "site", "sheet"] },
      { partOfSpeech: "noun", options: ["apartment", "cap", "envelope", "lawyer", "speed", "union"], prompts: ["cover for letters", "kind of hat", "place to live inside a tall building"], answers: ["envelope", "cap", "apartment"] },
      { partOfSpeech: "verb", options: ["argue", "contribute", "quit", "seek", "vote", "wrap"], prompts: ["cover tightly and completely", "give to", "look for"], answers: ["wrap", "contribute", "seek"] },
      { partOfSpeech: "verb", options: ["avoid", "contain", "murder", "search", "switch", "trade"], prompts: ["have something inside", "look for", "try not to do"], answers: ["contain", "search", "avoid"] },
      { partOfSpeech: "verb", options: ["bump", "complicate", "include", "organize", "receive", "warn"], prompts: ["get something", "hit gently", "have as part of something"], answers: ["receive", "bump", "include"] },
      { partOfSpeech: "adjective", options: ["available", "constant", "electrical", "medical", "proud", "super"], prompts: ["feeling good about what you have done", "great", "happening all the time"], answers: ["proud", "super", "constant"] },
      { partOfSpeech: "adjective", options: ["environmental", "junior", "pure", "rotten", "smooth", "wise"], prompts: ["bad", "not rough", "younger in position"], answers: ["rotten", "smooth", "junior"] }
    ],
    "3k": [
      { partOfSpeech: "noun", options: ["angle", "apology", "behavior", "bible", "celebration", "portion"], prompts: ["actions", "happy occasion", "statement saying you are sorry"], answers: ["behavior", "celebration", "apology"] },
      { partOfSpeech: "noun", options: ["anxiety", "athlete", "counsel", "foundation", "phrase", "wealth"], prompts: ["combination of words", "guidance", "large amount of money"], answers: ["phrase", "counsel", "wealth"] },
      { partOfSpeech: "noun", options: ["agriculture", "conference", "frequency", "liquid", "regime", "volunteer"], prompts: ["farming", "government", "person who helps without payment"], answers: ["agriculture", "regime", "volunteer"] },
      { partOfSpeech: "noun", options: ["asset", "heritage", "novel", "poverty", "prosecution", "suburb"], prompts: ["having little money", "history", "useful thing"], answers: ["poverty", "heritage", "asset"] },
      { partOfSpeech: "noun", options: ["audience", "crystal", "intelligence", "outcome", "pit", "welfare"], prompts: ["ability to learn", "deep place", "people who watch and listen"], answers: ["intelligence", "pit", "audience"] },
      { partOfSpeech: "verb", options: ["consent", "enforce", "exhibit", "retain", "specify", "target"], prompts: ["agree", "say clearly", "show in public"], answers: ["consent", "specify", "exhibit"] },
      { partOfSpeech: "verb", options: ["accomplish", "capture", "debate", "impose", "proceed", "prohibit"], prompts: ["catch", "go on", "talk about what is correct"], answers: ["capture", "proceed", "debate"] },
      { partOfSpeech: "verb", options: ["absorb", "decline", "exceed", "link", "nod", "persist"], prompts: ["continue to happen", "goes beyond the limit", "take in"], answers: ["persist", "exceed", "absorb"] },
      { partOfSpeech: "adjective", options: ["approximate", "frequent", "graphic", "pale", "prior", "vital"], prompts: ["almost exact", "earlier", "happening often"], answers: ["approximate", "prior", "frequent"] },
      { partOfSpeech: "adjective", options: ["consistent", "enthusiastic", "former", "logical", "marginal", "mutual"], prompts: ["not changing", "occurring earlier in time", "shared"], answers: ["consistent", "former", "mutual"] }
    ],
    "4k": [
      { partOfSpeech: "noun", options: ["cave", "scenario", "sergeant", "stitch", "vitamin", "wax"], prompts: ["healthy supplement", "opening in the ground or in the side of a hill", "situation"], answers: ["vitamin", "cave", "scenario"] },
      { partOfSpeech: "noun", options: ["candle", "diamond", "gulf", "salmon", "soap", "tutor"], prompts: ["something used for cleaning", "teacher", "valuable stone"], answers: ["soap", "tutor", "diamond"] },
      { partOfSpeech: "noun", options: ["agony", "kilogram", "orchestra", "scrap", "slot", "soccer"], prompts: ["group of people who play music", "long, thin opening", "small unwanted piece"], answers: ["orchestra", "slot", "scrap"] },
      { partOfSpeech: "noun", options: ["crust", "incidence", "ram", "senator", "venue", "verdict"], prompts: ["hard outside part", "judgment", "place"], answers: ["crust", "verdict", "venue"] },
      { partOfSpeech: "noun", options: ["alley", "embassy", "hardware", "nutrition", "threshold", "tobacco"], prompts: ["government building", "plant that is smoked in cigarettes", "small street between buildings"], answers: ["embassy", "tobacco", "alley"] },
      { partOfSpeech: "verb", options: ["fling", "forbid", "harvest", "shrink", "simulate", "vibrate"], prompts: ["do not allow", "make smaller", "throw"], answers: ["forbid", "shrink", "fling"] },
      { partOfSpeech: "verb", options: ["activate", "disclose", "hug", "intimidate", "plunge", "weep"], prompts: ["cry", "tell", "turn on"], answers: ["weep", "disclose", "activate"] },
      { partOfSpeech: "verb", options: ["diminish", "exaggerate", "explode", "penetrate", "transplant", "verify"], prompts: ["break into pieces violently", "get smaller", "move something to another place"], answers: ["explode", "diminish", "transplant"] },
      { partOfSpeech: "adjective", options: ["adjacent", "crude", "fond", "sane", "spherical", "swift"], prompts: ["beside", "not crazy", "quick"], answers: ["adjacent", "sane", "swift"] },
      { partOfSpeech: "adjective", options: ["abnormal", "bulky", "credible", "greasy", "magnificent", "optical"], prompts: ["believable", "oily", "unusual"], answers: ["credible", "greasy", "abnormal"] }
    ],
    "5k": [
      { partOfSpeech: "noun", options: ["gown", "maid", "mustache", "paradise", "pastry", "vinegar"], prompts: ["hair on your upper lip", "perfect place", "small baked food"], answers: ["mustache", "paradise", "pastry"] },
      { partOfSpeech: "noun", options: ["asthma", "chord", "jockey", "monk", "rectangle", "vase"], prompts: ["container for cut flowers", "group of musical notes that are played at the same time", "shape with two long and two short sides"], answers: ["vase", "chord", "rectangle"] },
      { partOfSpeech: "noun", options: ["batch", "dentist", "hum", "lime", "pork", "scripture"], prompts: ["green fruit", "low, constant sound", "meat from pigs"], answers: ["lime", "hum", "pork"] },
      { partOfSpeech: "noun", options: ["amnesty", "claw", "earthquake", "perfume", "sanctuary", "wizard"], prompts: ["liquid that is made to smell nice", "man who has magical powers", "safe place"], answers: ["perfume", "wizard", "sanctuary"] },
      { partOfSpeech: "noun", options: ["altitude", "diversion", "hemisphere", "pirate", "robe", "socket"], prompts: ["height", "kind of clothing", "person who attacks ships"], answers: ["altitude", "robe", "pirate"] },
      { partOfSpeech: "verb", options: ["applaud", "erase", "jog", "intrude", "notify", "wrestle"], prompts: ["announce", "enter without permission", "remove"], answers: ["notify", "intrude", "erase"] },
      { partOfSpeech: "verb", options: ["bribe", "expire", "immerse", "meditate", "persecute", "shred"], prompts: ["cut or tear into small pieces", "end", "think deeply"], answers: ["shred", "expire", "meditate"] },
      { partOfSpeech: "verb", options: ["commemorate", "growl", "ignite", "pierce", "renovate", "swap"], prompts: ["catch fire", "exchange", "go into or through something"], answers: ["ignite", "swap", "pierce"] },
      { partOfSpeech: "adjective", options: ["bald", "eternal", "imperative", "lavish", "moist", "tranquil"], prompts: ["calm and quiet", "having no hair", "slightly wet"], answers: ["tranquil", "bald", "moist"] },
      { partOfSpeech: "adjective", options: ["diesel", "incidental", "mandatory", "prudent", "superficial", "tame"], prompts: ["not dangerous", "required", "using good judgment"], answers: ["tame", "mandatory", "prudent"] }
    ]
  };

  function buildTestBank() {
    const bank = {
      bankId: "uvlt_multiband_form",
      title: "UVLT Multi-Band Testlet CAT Linked Bank",
      bands: BAND_ORDER.slice(),
      linking: CROSS_BAND_LINKING,
      testlets: [],
      itemMap: {}
    };

    let globalPosition = 1;

    BAND_ORDER.forEach(function (band, bandIndex) {
      const blueprints = BAND_BLUEPRINTS[band];
      const rawDifficulties = RAW_BAND_REFERENCE[band];
      const linkedDifficulties = BAND_REFERENCE[band];

      blueprints.forEach(function (blueprint, testletIndex) {
        const itemOffset = testletIndex * 3;
        const itemRawDifficulties = rawDifficulties.slice(itemOffset, itemOffset + 3);
        const itemLinkedDifficulties = linkedDifficulties.slice(itemOffset, itemOffset + 3);
        const testlet = {
          testletId: "uvlt_" + band + "_t" + String(testletIndex + 1).padStart(2, "0"),
          level: band,
          bandIndex: bandIndex + 1,
          globalPosition: globalPosition,
          positionInForm: testletIndex + 1,
          testletVariance: TESTLET_VARIANCES[band][testletIndex],
          difficultyVector: itemLinkedDifficulties.slice(),
          patternCount: Math.pow(2, blueprint.prompts.length),
          partOfSpeech: blueprint.partOfSpeech,
          selectionDifficulty: Number((itemLinkedDifficulties.reduce(function (sum, value) {
            return sum + value;
          }, 0) / itemLinkedDifficulties.length).toFixed(5)),
          selectionRawDifficulty: Number((itemRawDifficulties.reduce(function (sum, value) {
            return sum + value;
          }, 0) / itemRawDifficulties.length).toFixed(5)),
          options: blueprint.options.slice(),
          definitions: blueprint.prompts.map(function (prompt, promptIndex) {
            return {
              itemId: "uvlt_" + band + "_t" + String(testletIndex + 1).padStart(2, "0") + "_i" + String(promptIndex + 1).padStart(2, "0"),
              prompt: prompt,
              correctOption: blueprint.answers[promptIndex],
              rawDifficulty: itemRawDifficulties[promptIndex],
              linkedDifficulty: itemLinkedDifficulties[promptIndex],
              difficulty: itemLinkedDifficulties[promptIndex]
            };
          })
        };

        bank.testlets.push(testlet);
        globalPosition += 1;
      });
    });

    bank.testlets.forEach(function (testlet) {
      testlet.definitions.forEach(function (definition) {
        bank.itemMap[definition.itemId] = {
          itemId: definition.itemId,
          difficulty: definition.difficulty,
          rawDifficulty: definition.rawDifficulty,
          linkedDifficulty: definition.linkedDifficulty,
          prompt: definition.prompt,
          correctOption: definition.correctOption,
          testletId: testlet.testletId,
          level: testlet.level,
          selectionDifficulty: testlet.selectionDifficulty,
          selectionRawDifficulty: testlet.selectionRawDifficulty,
          positionInForm: testlet.positionInForm,
          testletVariance: testlet.testletVariance,
          partOfSpeech: testlet.partOfSpeech
        };
      });
    });

    return bank;
  }

  const TEST_BANK = buildTestBank();
  // R1: push linked difficulty map to LJT module now that TEST_BANK is ready.
  wireLjtItemDifficulties();
  const SIMULATION_PROFILES = [
    {
      id: "balanced",
      label: "標準的受験者",
      thetaMean: 0,
      thetaSD: 0.9,
      focus: 1,
      slipRate: 0.05,
      guessSuccess: 0.16,
      fatiguePerTestlet: 0.01,
      baseTimeMs: 52000,
      timeJitterMs: 12000,
      tabSwitchRate: 0.05,
      backAttemptRate: 0.01,
      restoreRate: 0.04
    },
    {
      id: "rapid_guesser",
      label: "急ぎ解答型",
      thetaMean: -0.2,
      thetaSD: 1,
      focus: 0.7,
      slipRate: 0.2,
      guessSuccess: 0.18,
      fatiguePerTestlet: 0.03,
      baseTimeMs: 17000,
      timeJitterMs: 5000,
      tabSwitchRate: 0.02,
      backAttemptRate: 0.03,
      restoreRate: 0.02
    },
    {
      id: "careful_reader",
      label: "慎重解答型",
      thetaMean: 0.4,
      thetaSD: 0.8,
      focus: 1.15,
      slipRate: 0.03,
      guessSuccess: 0.12,
      fatiguePerTestlet: 0.005,
      baseTimeMs: 76000,
      timeJitterMs: 18000,
      tabSwitchRate: 0.06,
      backAttemptRate: 0.005,
      restoreRate: 0.05
    },
    {
      id: "fatigued",
      label: "後半失速型",
      thetaMean: 0.1,
      thetaSD: 1,
      focus: 0.95,
      slipRate: 0.08,
      guessSuccess: 0.16,
      fatiguePerTestlet: 0.045,
      baseTimeMs: 60000,
      timeJitterMs: 15000,
      tabSwitchRate: 0.08,
      backAttemptRate: 0.015,
      restoreRate: 0.06
    },
    {
      id: "interrupted",
      label: "中断復帰型",
      thetaMean: 0,
      thetaSD: 0.95,
      focus: 0.92,
      slipRate: 0.08,
      guessSuccess: 0.16,
      fatiguePerTestlet: 0.015,
      baseTimeMs: 58000,
      timeJitterMs: 16000,
      tabSwitchRate: 0.25,
      backAttemptRate: 0.08,
      restoreRate: 0.2
    }
  ];

  const BASELINE_BEHAVIOR = {
    focus: 1,
    slipRate: 0.05,
    guessSuccess: 0.16,
    fatiguePerTestlet: 0.01,
    baseTimeMs: 52000,
    timeJitterMs: 12000,
    tabSwitchRate: 0.05,
    backAttemptRate: 0.01,
    restoreRate: 0.04
  };

  const EXTENDED_SIMULATION_PROFILES = SIMULATION_PROFILES.concat([
    Object.assign({ id: "uniform_wide", label: "一様分布(広)", thetaMean: 0, thetaSD: 1.5, thetaDistribution: "uniform", thetaRange: [-3, 3] }, BASELINE_BEHAVIOR),
    Object.assign({ id: "low_ability", label: "低能力群", thetaMean: -1.5, thetaSD: 0.6 }, BASELINE_BEHAVIOR),
    Object.assign({ id: "high_ability", label: "高能力群", thetaMean: 1.5, thetaSD: 0.6 }, BASELINE_BEHAVIOR),
    Object.assign({ id: "negskew", label: "負の歪み", thetaMean: 0.5, thetaSD: 0.8, thetaDistribution: "skewNormal", skewness: -3 }, BASELINE_BEHAVIOR),
    Object.assign({ id: "posskew", label: "正の歪み", thetaMean: -0.5, thetaSD: 0.8, thetaDistribution: "skewNormal", skewness: 3 }, BASELINE_BEHAVIOR),
    Object.assign({ id: "bimodal", label: "二峰性分布", thetaMean: 0, thetaSD: 1, thetaDistribution: "bimodal", modes: [-1.2, 1.2], modeSD: 0.5 }, BASELINE_BEHAVIOR),
    Object.assign({ id: "high_guess", label: "過剰推測", thetaMean: 0, thetaSD: 0.9, guessSuccess: 0.35, focus: 1, slipRate: 0.05, fatiguePerTestlet: 0.01, baseTimeMs: 52000, timeJitterMs: 12000, tabSwitchRate: 0.05, backAttemptRate: 0.01, restoreRate: 0.04 })
  ]);

  function sampleSkewNormal(rng, mu, sigma, alpha) {
    const u1 = sampleNormal(rng, 0, 1);
    const u2 = sampleNormal(rng, 0, 1);
    const delta = alpha / Math.sqrt(1 + alpha * alpha);
    const z = delta * Math.abs(u1) + Math.sqrt(1 - delta * delta) * u2;
    return mu + sigma * z;
  }

  function sampleTheta(profile, rng) {
    if (profile.thetaDistribution === "uniform") {
      const lo = profile.thetaRange ? profile.thetaRange[0] : (profile.thetaMean - 2 * profile.thetaSD);
      const hi = profile.thetaRange ? profile.thetaRange[1] : (profile.thetaMean + 2 * profile.thetaSD);
      return lo + rng() * (hi - lo);
    }
    if (profile.thetaDistribution === "bimodal") {
      const mode = rng() < 0.5 ? profile.modes[0] : profile.modes[1];
      return sampleNormal(rng, mode, profile.modeSD || 0.5);
    }
    if (profile.thetaDistribution === "skewNormal") {
      return sampleSkewNormal(rng, profile.thetaMean, profile.thetaSD, profile.skewness || 0);
    }
    return sampleNormal(rng, profile.thetaMean, profile.thetaSD);
  }

  const exposureTracker = {
    sessionCount: 0,
    counts: {}
  };

  function resetExposureTracker() {
    exposureTracker.sessionCount = 0;
    exposureTracker.counts = {};
  }

  function getExposureRate(testletId) {
    if (exposureTracker.sessionCount < 1) {
      return 0;
    }
    return (exposureTracker.counts[testletId] || 0) / exposureTracker.sessionCount;
  }

  function updateExposureCounts(administeredIds) {
    exposureTracker.sessionCount += 1;
    administeredIds.forEach(function (id) {
      exposureTracker.counts[id] = (exposureTracker.counts[id] || 0) + 1;
    });
  }

  function computeCorrelation(xs, ys) {
    const n = xs.length;
    if (n < 2) { return 0; }
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let dx2 = 0;
    let dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      num += dx * dy;
      dx2 += dx * dx;
      dy2 += dy * dy;
    }
    const denom = Math.sqrt(dx2 * dy2);
    return denom < 1e-15 ? 0 : Number((num / denom).toFixed(6));
  }

  function computeMedian(values) {
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function computeQuantiles(values) {
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const n = sorted.length;
    function q(p) {
      const index = p * (n - 1);
      const lo = Math.floor(index);
      const hi = Math.ceil(index);
      return lo === hi ? sorted[lo] : sorted[lo] + (index - lo) * (sorted[hi] - sorted[lo]);
    }
    return {
      min: sorted[0],
      q25: Number(q(0.25).toFixed(3)),
      median: Number(q(0.5).toFixed(3)),
      q75: Number(q(0.75).toFixed(3)),
      max: sorted[n - 1]
    };
  }

  function computeExposureDistribution(rows) {
    const testletCounts = {};
    const n = rows.length;
    rows.forEach(function (row) {
      if (!row.administeredTestletIdList) { return; }
      row.administeredTestletIdList.forEach(function (id) {
        testletCounts[id] = (testletCounts[id] || 0) + 1;
      });
    });
    const rates = Object.keys(testletCounts).map(function (id) {
      return testletCounts[id] / n;
    });
    if (rates.length === 0) {
      return { maxRate: 0, minRate: 0, meanRate: 0, sdRate: 0, overexposedCount: 0 };
    }
    const meanRate = mean(rates);
    const variance = mean(rates.map(function (r) { return (r - meanRate) * (r - meanRate); }));
    return {
      maxRate: Number(Math.max.apply(null, rates).toFixed(4)),
      minRate: Number(Math.min.apply(null, rates).toFixed(4)),
      meanRate: Number(meanRate.toFixed(4)),
      sdRate: Number(Math.sqrt(variance).toFixed(4)),
      overexposedCount: rates.filter(function (r) { return r > CONFIG.maxExposureRate; }).length
    };
  }

  function computeBandUsageDistribution(rows) {
    const bandCounts = {};
    rows.forEach(function (row) {
      if (!row.bandPath) { return; }
      const seen = {};
      row.bandPath.forEach(function (band) {
        if (!seen[band]) {
          bandCounts[band] = (bandCounts[band] || 0) + 1;
          seen[band] = true;
        }
      });
    });
    const result = {};
    Object.keys(bandCounts).forEach(function (band) {
      result[band] = Number((bandCounts[band] / rows.length).toFixed(4));
    });
    return result;
  }

  function computeConditionalMetrics(rows, bins) {
    const thresholds = bins || [-1.5, -0.5, 0.5, 1.5];
    const groups = [];
    for (let g = 0; g <= thresholds.length; g++) {
      groups.push({ label: "", errors: [], absErrors: [] });
    }
    groups[0].label = "< " + thresholds[0];
    for (let t = 0; t < thresholds.length - 1; t++) {
      groups[t + 1].label = thresholds[t] + " to " + thresholds[t + 1];
    }
    groups[thresholds.length].label = ">= " + thresholds[thresholds.length - 1];

    rows.forEach(function (row) {
      const theta = row.thetaTrue;
      const error = row.thetaEstimated - theta;
      let idx = thresholds.length;
      for (let k = 0; k < thresholds.length; k++) {
        if (theta < thresholds[k]) { idx = k; break; }
      }
      groups[idx].errors.push(error);
      groups[idx].absErrors.push(Math.abs(error));
    });

    return groups.map(function (g) {
      if (g.errors.length === 0) {
        return { label: g.label, n: 0, bias: null, rmse: null };
      }
      const biasVal = mean(g.errors);
      const mse = mean(g.errors.map(function (e) { return e * e; }));
      return {
        label: g.label,
        n: g.errors.length,
        bias: Number(biasVal.toFixed(4)),
        rmse: Number(Math.sqrt(mse).toFixed(4))
      };
    });
  }

  const state = {
    phase: "intro",
    session: null,
    pendingResume: null,
    practiceIndex: 0,
    historyGuardArmed: false,
    historyGuardSuspended: false,
    lastSafetyAlertAt: 0,
    pageHiddenDuringSession: false,
    storageCleared: false,
    storageUnavailable: false,
    storageWarningShown: false
  };

  const elements = {
    statusMessage: document.getElementById("status-message"),
    introScreen: document.getElementById("intro-screen"),
    practiceScreen: document.getElementById("practice-screen"),
    testScreen: document.getElementById("test-screen"),
    resultScreen: document.getElementById("result-screen"),
    participantForm: document.getElementById("participant-form"),
    studentIdInput: document.getElementById("student-id-input"),
    participantNameInput: document.getElementById("participant-name-input"),
    affiliationInput: document.getElementById("affiliation-input"),
    startPracticeButton: document.getElementById("start-practice-button"),
    practiceProgress: document.getElementById("practice-progress"),
    practiceProgressFill: document.getElementById("practice-progress-fill"),
    practiceParticipantMeta: document.getElementById("practice-participant-meta"),
    practiceTitle: document.getElementById("practice-title"),
    practiceDescription: document.getElementById("practice-description"),
    practiceForm: document.getElementById("practice-form"),
    practiceOptionsHeader: document.getElementById("practice-options-header"),
    practiceDefinitionsBody: document.getElementById("practice-definitions-body"),
    submitPracticeButton: document.getElementById("submit-practice-button"),
    backToIntroButton: document.getElementById("back-to-intro-button"),
    practiceFeedback: document.getElementById("practice-feedback"),
    practiceFeedbackList: document.getElementById("practice-feedback-list"),
    nextPracticeButton: document.getElementById("next-practice-button"),
    testProgress: document.getElementById("test-progress"),
    testProgressFill: document.getElementById("test-progress-fill"),
    thetaBadge: document.getElementById("theta-badge"),
    seBadge: document.getElementById("se-badge"),
    testParticipantMeta: document.getElementById("test-participant-meta"),
    testTitle: document.getElementById("test-title"),
    testDescription: document.getElementById("test-description"),
    selectionReason: document.getElementById("selection-reason"),
    testForm: document.getElementById("test-form"),
    testOptionsHeader: document.getElementById("test-options-header"),
    testDefinitionsBody: document.getElementById("test-definitions-body"),
    restartButton: document.getElementById("restart-button"),
    resultRange: document.getElementById("result-range"),
    resultStrongBand: document.getElementById("result-strong-band"),
    resultGrowthBand: document.getElementById("result-growth-band"),
    resultLength: document.getElementById("result-length"),
    resultDuration: document.getElementById("result-duration"),
    resultVocabSize: document.getElementById("result-vocab-size"),
    resultScoreQuality: document.getElementById("result-score-quality"),
    resultStopReason: document.getElementById("result-stop-reason"),
    resultParticipantMeta: document.getElementById("result-participant-meta"),
    thetaVisual: document.getElementById("theta-visual"),
    feedbackItems: document.getElementById("feedback-items"),
    bandDiagnostics: document.getElementById("band-diagnostics"),
    timelineVisual: document.getElementById("timeline-visual"),
    exportStatus: document.getElementById("export-status"),
    downloadJsonButton: document.getElementById("download-json-button"),
    downloadExcelButton: document.getElementById("download-excel-button"),
    clearDeviceDataButton: document.getElementById("clear-device-data-button"),
    restartFromResultButton: document.getElementById("restart-from-result-button")
  };
  function setStatus(message) {
    elements.statusMessage.textContent = message || "";
  }

  function updateProgressFill(element, completed, total) {
    if (!element) {
      return;
    }
    const safeTotal = Math.max(1, total || 1);
    const safeCompleted = Math.max(0, Math.min(completed || 0, safeTotal));
    const ratio = Math.max(0, Math.min(1, safeCompleted / safeTotal));
    element.style.width = (ratio * 100).toFixed(1) + "%";
    const meter = element.parentElement;
    if (meter && meter.classList && meter.classList.contains("progress-meter")) {
      meter.setAttribute("aria-valuemin", "0");
      meter.setAttribute("aria-valuemax", String(safeTotal));
      meter.setAttribute("aria-valuenow", String(safeCompleted));
      meter.setAttribute("aria-valuetext", Math.round(ratio * 100) + "%");
    }
  }

  function markStorageUnavailable(error) {
    state.storageUnavailable = true;

    if (typeof console !== "undefined" && console.warn) {
      console.warn("[UVLT] localStorage unavailable; continuing without resume support.", error);
    }

    if (!state.storageWarningShown) {
      state.storageWarningShown = true;
      setStatus("このブラウザでは途中保存を利用できません。再読み込みやタブ破棄をすると未送信の解答は失われます。");
    }

    renderExportStatus();
  }

  function markStorageAvailable() {
    state.storageUnavailable = false;
  }

  function storageGetItem(key) {
    try {
      const value = localStorage.getItem(key);
      markStorageAvailable();
      return value;
    } catch (error) {
      markStorageUnavailable(error);
      return null;
    }
  }

  function storageSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      markStorageAvailable();
      return true;
    } catch (error) {
      markStorageUnavailable(error);
      return false;
    }
  }

  function storageRemoveItem(key) {
    try {
      localStorage.removeItem(key);
      markStorageAvailable();
      return true;
    } catch (error) {
      markStorageUnavailable(error);
      return false;
    }
  }

  function normalizeDraftEntry(entry) {
    const source = entry && typeof entry === "object" ? entry : null;
    const promptId = source && typeof source.promptId === "string" && source.promptId
      ? source.promptId
      : null;
    const selections = {};

    if (source && source.selections && typeof source.selections === "object") {
      Object.keys(source.selections).forEach(function (key) {
        const normalizedKey = String(Number(key));
        const optionIndex = Number(source.selections[key]);

        if (normalizedKey !== "NaN" && Number.isInteger(optionIndex) && optionIndex >= 0) {
          selections[normalizedKey] = optionIndex;
        }
      });
    }

    if (!promptId) {
      return null;
    }

    return {
      promptId: promptId,
      selections: selections
    };
  }

  function normalizeDraftSelections(draftSelections) {
    const source = draftSelections || {};

    return {
      practice: normalizeDraftEntry(source.practice),
      test: normalizeDraftEntry(source.test)
    };
  }

  function ensureDraftSelections() {
    if (!state.session) {
      return null;
    }

    if (!state.session.draftSelections) {
      state.session.draftSelections = normalizeDraftSelections(null);
    }

    return state.session.draftSelections;
  }

  function getDraftKindFromPrefix(inputPrefix) {
    if (inputPrefix === "practice") {
      return "practice";
    }
    if (inputPrefix === "test") {
      return "test";
    }
    return null;
  }

  function getPromptIdForPrefix(inputPrefix) {
    if (inputPrefix === "practice") {
      const practice = PRACTICE_TESTLETS[state.practiceIndex];
      return practice ? practice.practiceId : null;
    }
    if (inputPrefix === "test") {
      const currentTestlet = getCurrentTestlet();
      return currentTestlet ? currentTestlet.testletId : null;
    }
    return null;
  }

  function captureSelections(formElement, inputPrefix) {
    const selections = {};

    Array.prototype.forEach.call(
      formElement.querySelectorAll("input[data-prefix=\"" + inputPrefix + "\"]:checked"),
      function (input) {
        const name = input.getAttribute("name") || "";
        const prefix = inputPrefix + "-";
        const rowKey = name.indexOf(prefix) === 0 ? name.slice(prefix.length) : "";
        const optionIndex = Number(input.value);

        if (rowKey && Number.isInteger(optionIndex) && optionIndex >= 0) {
          selections[rowKey] = optionIndex;
        }
      }
    );

    return selections;
  }

  function persistDraftSelections(formElement, inputPrefix) {
    const kind = getDraftKindFromPrefix(inputPrefix);
    const promptId = getPromptIdForPrefix(inputPrefix);
    const draftSelections = ensureDraftSelections();

    if (!draftSelections || !kind || !promptId) {
      return;
    }

    draftSelections[kind] = {
      promptId: promptId,
      selections: captureSelections(formElement, inputPrefix)
    };
    persistState();
  }

  function clearDraftSelections(kind) {
    const draftSelections = ensureDraftSelections();

    if (!draftSelections || !Object.prototype.hasOwnProperty.call(draftSelections, kind)) {
      return;
    }

    draftSelections[kind] = null;
  }

  function restoreDraftSelections(formElement, inputPrefix, promptId) {
    const draftSelections = ensureDraftSelections();
    const kind = getDraftKindFromPrefix(inputPrefix);
    const entry = draftSelections && kind ? draftSelections[kind] : null;

    if (!entry || entry.promptId !== promptId) {
      return;
    }

    Object.keys(entry.selections).forEach(function (rowKey) {
      const optionIndex = entry.selections[rowKey];
      const input = formElement.querySelector(
        "input[name=\"" + inputPrefix + "-" + rowKey + "\"][value=\"" + optionIndex + "\"]"
      );

      if (input) {
        input.checked = true;
      }
    });
  }

  function getSavedStateLabel() {
    return state.storageUnavailable
      ? "このブラウザでは途中保存を利用できません"
      : "途中状態を保存しています";
  }

  function getResumeStatusMessage() {
    return state.storageUnavailable
      ? "テスト画面に戻りました。再読み込みせず、そのまま続けて解答してください。"
      : "テスト画面に戻りました。途中状態は保存されています。続けて解答してください。";
  }

  function getRestoreStatusMessage() {
    return state.storageUnavailable
      ? "画面は復元されましたが、このブラウザでは途中保存を利用できません。"
      : "画面が復元されました。保存済みの状態から続行します。";
  }

  function getPendingResumeStatusMessage() {
    return "この端末に前回の一時保存があります。同じ受験者が同じ学籍番号と受験者名を入力して開始すると続きから再開します。別の受験者が開始すると前回の一時保存は削除されます。";
  }

  function normalizeParticipant(participant) {
    const source = participant || {};

    return {
      studentId: String(source.studentId || "").trim(),
      participantName: String(source.participantName || "").trim(),
      affiliation: String(source.affiliation || "").trim()
    };
  }

  function readParticipantInputs() {
    return normalizeParticipant({
      studentId: elements.studentIdInput.value,
      participantName: elements.participantNameInput.value,
      affiliation: elements.affiliationInput.value
    });
  }

  function syncParticipantInputs(participant) {
    const normalized = normalizeParticipant(participant);
    elements.studentIdInput.value = normalized.studentId;
    elements.participantNameInput.value = normalized.participantName;
    elements.affiliationInput.value = normalized.affiliation;
  }

  function participantsMatchForResume(left, right) {
    const a = normalizeParticipant(left);
    const b = normalizeParticipant(right);
    return !!(
      a.studentId &&
      b.studentId &&
      a.participantName &&
      b.participantName &&
      a.studentId === b.studentId &&
      a.participantName === b.participantName
    );
  }

  function formatParticipantLabel(participant) {
    const normalized = normalizeParticipant(participant);
    const parts = [];

    if (normalized.studentId) {
      parts.push(normalized.studentId);
    }
    if (normalized.participantName) {
      parts.push(normalized.participantName);
    }
    if (normalized.affiliation) {
      parts.push(normalized.affiliation);
    }

    return parts.length ? parts.join(" / ") : "受験者情報未設定";
  }

  function updateParticipantMeta() {
    const participant = state.session ? state.session.participant : readParticipantInputs();
    const label = formatParticipantLabel(participant);

    if (elements.practiceParticipantMeta) {
      elements.practiceParticipantMeta.textContent = label;
    }
    if (elements.testParticipantMeta) {
      elements.testParticipantMeta.textContent = label;
    }
    if (elements.resultParticipantMeta) {
      elements.resultParticipantMeta.textContent = "受験者: " + label;
    }
  }

  function sanitizeFilenamePart(value, fallback) {
    const normalized = String(value || "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalized || fallback;
  }

  function formatFilenameTimestamp(isoTimestamp) {
    const date = isoTimestamp ? new Date(isoTimestamp) : new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return yyyy + mm + dd + "-" + hh + mi + ss;
  }

  function buildExportBaseName() {
    const participant = state.session ? state.session.participant : readParticipantInputs();
    const studentId = sanitizeFilenamePart(participant.studentId, "unknown-id");
    const participantName = sanitizeFilenamePart(participant.participantName, "unknown-name");
    const timestamp = formatFilenameTimestamp(state.session ? state.session.startedAt : nowIso());
    return "UVLTCAT_" + studentId + "_" + participantName + "_" + timestamp;
  }

  function formatBandLabel(band) {
    return band ? band.toUpperCase() + "帯" : "";
  }

  function describeBand(band) {
    return BAND_DESCRIPTIONS[band] || "";
  }

  function formatBandWithDescription(band) {
    const label = formatBandLabel(band);
    const description = describeBand(band);
    return description ? label + "（" + description + "）" : label;
  }

  function buildStudySuggestion(band) {
    const suggestions = {
      "1k": "まずは教科書や日常会話でよく出る基本語を、例文と発音と一緒に確認してください。",
      "2k": "基礎語の動詞・形容詞を、意味だけでなく一緒に使われやすい語とセットで復習してください。",
      "3k": "中頻度語は、読み物の中で繰り返し出会えるように短い英文を使って復習すると伸びやすいです。",
      "4k": "やや発展的な語は、語根・派生語・類義語をまとめて学ぶと定着しやすくなります。",
      "5k": "低頻度語は、長文読解や専門分野の文章の中で繰り返し確認する方法が効果的です。"
    };

    return suggestions[band] || "弱かった帯域の語を、短い例文と一緒に繰り返し確認してください。";
  }

  function buildInitialEstimate() {
    return {
      step: 0,
      theta: CONFIG.priorMean,
      se: CONFIG.priorSD,
      map: CONFIG.priorMean,
      scoringModel: "testlet-aware marginal EAP approximation",
      linkedRaschTheta: CONFIG.priorMean,
      linkedRaschSE: CONFIG.priorSD,
      linkedRaschMap: CONFIG.priorMean,
      testletAwareTheta: CONFIG.priorMean,
      testletAwareSE: CONFIG.priorSD,
      testletAwareMap: CONFIG.priorMean,
      timestamp: nowIso()
    };
  }

  // IDs of the LJT-phase screens (owned by UVLT_LJT module; we just hide them
  // when a CAT screen is active and vice versa). Spec v0.5 §10.1.
  const LJT_SCREEN_IDS = [
    "ljt-intro-screen",
    "ljt-headphone-check",
    "ljt-preload-screen",
    "ljt-practice-screen",
    "ljt-main-screen",
    "ljt-pause-screen",
    "ljt-result-screen"
  ];

  function setScreen(screenName) {
    const screens = {
      intro: elements.introScreen,
      practice: elements.practiceScreen,
      test: elements.testScreen,
      result: elements.resultScreen
    };

    const isCatScreen = Object.prototype.hasOwnProperty.call(screens, screenName);

    Object.keys(screens).forEach(function (key) {
      const hidden = key !== screenName;
      screens[key].classList.toggle("hidden", hidden);
      if (hidden) {
        screens[key].setAttribute("inert", "");
      } else {
        screens[key].removeAttribute("inert");
      }
    });

    // Hide all LJT screens while a CAT screen is active. When a CAT screen is
    // NOT requested (screenName is, e.g., "ljt-intro"), leave LJT sections alone
    // — the LJT module manages their visibility directly.
    if (isCatScreen) {
      LJT_SCREEN_IDS.forEach(function (id) {
        const el = document.getElementById(id);
        if (el) {
          el.classList.add("hidden");
          el.setAttribute("inert", "");
        }
      });
    }

    const focusTarget = isCatScreen
      ? screens[screenName].querySelector("h2, [autofocus], button, input")
      : null;
    if (focusTarget) {
      if (/^H[1-6]$/.test(focusTarget.tagName || "") && !focusTarget.hasAttribute("tabindex")) {
        focusTarget.setAttribute("tabindex", "-1");
      }
      focusTarget.focus();
    }

    state.phase = screenName;
    if (isActiveSession()) {
      ensureHistoryGuard();
    } else {
      releaseHistoryGuard();
    }
    updateParticipantMeta();
    if (!state.pendingResume) {
      persistState();
    }
  }

  function createSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "session-" + Date.now();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function toTimestamp(value) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function calculateElapsedMs(startedAt, endedAt) {
    const start = toTimestamp(startedAt);
    const end = toTimestamp(endedAt);

    if (start == null || end == null) {
      return null;
    }

    return Math.max(0, end - start);
  }

  function formatElapsedMs(elapsedMs) {
    if (elapsedMs == null) {
      return "—";
    }

    const totalSeconds = Math.round(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return hours + "時間 " + remainingMinutes + "分 " + String(seconds).padStart(2, "0") + "秒";
    }

    return minutes + "分 " + String(seconds).padStart(2, "0") + "秒";
  }

  function formatTimestampLabel(value) {
    const timestamp = toTimestamp(value);
    if (timestamp == null) {
      return "—";
    }

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date(timestamp));
  }

  function getSessionElapsedMs(session) {
    if (!session) {
      return null;
    }

    return calculateElapsedMs(session.startedAt, session.completedAt || nowIso());
  }

  function normalizeExportsState(exportsState) {
    const source = exportsState || {};

    return {
      excelAutoDownloadedAt: source.excelAutoDownloadedAt || null,
      lastExcelFilename: source.lastExcelFilename || "",
      lastExcelDownloadedAt: source.lastExcelDownloadedAt || null,
      lastJsonFilename: source.lastJsonFilename || "",
      lastJsonDownloadedAt: source.lastJsonDownloadedAt || null
    };
  }

  function normalizeSessionState(session) {
    if (!session) {
      return null;
    }

    session.participant = normalizeParticipant(session.participant);
    session.practiceResponses = Array.isArray(session.practiceResponses) ? session.practiceResponses : [];
    session.administeredTestletIds = Array.isArray(session.administeredTestletIds) ? session.administeredTestletIds : [];
    session.selectedTestlets = Array.isArray(session.selectedTestlets) ? session.selectedTestlets : [];
    session.responses = Array.isArray(session.responses) ? session.responses : [];
    session.estimates = Array.isArray(session.estimates) && session.estimates.length
      ? session.estimates.map(function (estimate, index) {
          return {
            step: estimate.step == null ? index : estimate.step,
            theta: estimate.theta == null ? CONFIG.priorMean : estimate.theta,
            se: estimate.se == null ? CONFIG.priorSD : estimate.se,
            map: estimate.map == null ? CONFIG.priorMean : estimate.map,
            scoringModel: estimate.scoringModel || "testlet-aware marginal EAP approximation",
            linkedRaschTheta: estimate.linkedRaschTheta == null ? estimate.theta : estimate.linkedRaschTheta,
            linkedRaschSE: estimate.linkedRaschSE == null ? estimate.se : estimate.linkedRaschSE,
            linkedRaschMap: estimate.linkedRaschMap == null ? estimate.map : estimate.linkedRaschMap,
            testletAwareTheta: estimate.testletAwareTheta == null ? estimate.theta : estimate.testletAwareTheta,
            testletAwareSE: estimate.testletAwareSE == null ? estimate.se : estimate.testletAwareSE,
            testletAwareMap: estimate.testletAwareMap == null ? estimate.map : estimate.testletAwareMap,
            timestamp: estimate.timestamp || nowIso(),
            afterTestletId: estimate.afterTestletId || ""
          };
        })
      : [buildInitialEstimate()];
    session.currentPrompt = session.currentPrompt || null;
    session.exports = normalizeExportsState(session.exports);
    session.eventLog = Array.isArray(session.eventLog) ? session.eventLog : [];
    session.linking = session.linking || CROSS_BAND_LINKING;
    session.draftSelections = normalizeDraftSelections(session.draftSelections);
    // ljt can be undefined on legacy payloads; null means "not yet started"
    if (typeof session.ljt === "undefined") {
      session.ljt = null;
    }

    return session;
  }

  function logSessionEvent(type, details, shouldPersist) {
    if (!state.session) {
      return;
    }

    state.session.eventLog.push({
      timestamp: nowIso(),
      phase: state.phase,
      type: type,
      details: details || ""
    });

    if (shouldPersist !== false) {
      persistState();
    }
  }

  function isActiveSession() {
    return !!(
      state.session &&
      !state.session.completedAt &&
      (state.phase === "practice" || state.phase === "test" || state.phase === "ljt")
    );
  }

  function ensureHistoryGuard() {
    if (!isActiveSession() || state.historyGuardArmed) {
      return;
    }

    if (window.history.state && window.history.state.uvltGuard) {
      state.historyGuardArmed = true;
      return;
    }

    window.history.pushState({ uvltGuard: true, sessionId: state.session ? state.session.sessionId : null }, "", window.location.href);
    state.historyGuardArmed = true;
  }

  function releaseHistoryGuard() {
    state.historyGuardArmed = false;
    state.historyGuardSuspended = false;
    state.pageHiddenDuringSession = false;
  }

  function showSafetyStatus(message, useAlert) {
    const now = Date.now();
    setStatus(message);

    if (useAlert && now - state.lastSafetyAlertAt > 2500) {
      state.lastSafetyAlertAt = now;
      window.alert(message);
    }
  }

  function getEventCounts(session) {
    const counts = {
      browserBackAttempts: 0,
      unloadPrompts: 0,
      pageHiddenEvents: 0,
      pageHideEvents: 0,
      restoreEvents: 0,
      interruptionEvents: 0,
      totalEvents: 0
    };

    if (!session || !Array.isArray(session.eventLog)) {
      return counts;
    }

    session.eventLog.forEach(function (event) {
      counts.totalEvents += 1;

      if (event.type === "browser_back_attempt") {
        counts.browserBackAttempts += 1;
      } else if (event.type === "beforeunload_prompt") {
        counts.unloadPrompts += 1;
      } else if (event.type === "page_hidden") {
        counts.pageHiddenEvents += 1;
      } else if (event.type === "pagehide") {
        counts.pageHideEvents += 1;
      } else if (event.type === "session_restored") {
        counts.restoreEvents += 1;
      }
    });

    counts.interruptionEvents =
      counts.browserBackAttempts +
      counts.unloadPrompts +
      counts.pageHiddenEvents +
      counts.pageHideEvents;

    return counts;
  }

  function getBandVisitSummary(session) {
    const summary = BAND_ORDER.map(function (band) {
      return {
        band: band,
        administeredTestlets: 0,
        administeredItems: 0,
        correctItems: 0
      };
    });
    const byBand = {};

    summary.forEach(function (row) {
      byBand[row.band] = row;
    });

    if (!session) {
      return summary;
    }

    (session.selectedTestlets || []).forEach(function (testlet) {
      if (byBand[testlet.level]) {
        byBand[testlet.level].administeredTestlets += 1;
      }
    });

    (session.responses || []).forEach(function (response) {
      if (byBand[response.level]) {
        byBand[response.level].administeredItems += 1;
        if (response.correct) {
          byBand[response.level].correctItems += 1;
        }
      }
    });

    summary.forEach(function (row) {
      row.observedAccuracy = row.administeredItems
        ? Number((row.correctItems / row.administeredItems).toFixed(4))
        : null;
    });

    return summary;
  }

  function getScoreQuality(estimate, session) {
    const eventCounts = getEventCounts(session);
    const interruptions = eventCounts.interruptionEvents;
    let label = "要確認";
    let note = "結果にはやや幅があります。参考値として見てください。";

    if (estimate.se <= 0.5 && interruptions === 0) {
      label = "高";
      note = "結果は比較的安定しています。";
    } else if (estimate.se <= 0.52 && interruptions <= 1) {
      label = "良好";
      note = "結果はおおむね安定しています。";
    } else if (estimate.se <= 0.56 && interruptions <= 3) {
      label = "注意";
      note = "結果は参考値として見てください。";
    }

    if (interruptions >= 3) {
      label = "要確認";
      note = "途中の画面切り替えが多かったため、結果は参考値として見てください。";
    }

    return {
      label: label,
      note: note,
      interruptions: interruptions
    };
  }

  function getBandExtremes(vocabulary) {
    return {
      strongestBand: vocabulary.bandDiagnostics.reduce(function (best, current) {
        return !best || current.expectedAccuracy > best.expectedAccuracy ? current : best;
      }, null),
      weakestBand: vocabulary.bandDiagnostics.reduce(function (worst, current) {
        return !worst || current.expectedAccuracy < worst.expectedAccuracy ? current : worst;
      }, null)
    };
  }

  function formatParticipantStopReason(stopReason) {
    if (!stopReason) {
      return "";
    }

    if (stopReason.indexOf("目標標準誤差") >= 0) {
      return "必要な情報が十分に集まったため、ここで終了しました。";
    }
    if (stopReason.indexOf("最大") >= 0) {
      return "予定していた最大数まで実施したため、ここで終了しました。";
    }
    if (stopReason.indexOf("利用可能なセットがなくなりました") >= 0 || stopReason.indexOf("利用可能な testlet がなくなりました") >= 0) {
      return "用意された問題セットを使い切ったため、ここで終了しました。";
    }

    return stopReason;
  }

  function beginPrompt(kind, promptId) {
    if (!state.session) {
      return null;
    }

    const currentPrompt = state.session.currentPrompt;
    if (currentPrompt && currentPrompt.kind === kind && currentPrompt.promptId === promptId && currentPrompt.presentedAt) {
      return currentPrompt.presentedAt;
    }

    state.session.currentPrompt = {
      kind: kind,
      promptId: promptId,
      presentedAt: nowIso()
    };

    return state.session.currentPrompt.presentedAt;
  }

  function completePrompt(kind, promptId) {
    const submittedAt = nowIso();
    const currentPrompt = state.session && state.session.currentPrompt &&
      state.session.currentPrompt.kind === kind &&
      state.session.currentPrompt.promptId === promptId
        ? state.session.currentPrompt
        : { kind: kind, promptId: promptId, presentedAt: submittedAt };

    const timing = {
      presentedAt: currentPrompt.presentedAt,
      submittedAt: submittedAt,
      elapsedMs: calculateElapsedMs(currentPrompt.presentedAt, submittedAt)
    };

    if (state.session) {
      state.session.currentPrompt = null;
    }

    return timing;
  }

  function createFreshSession(participant) {
    return {
      sessionId: createSessionId(),
      bankId: TEST_BANK.bankId,
      bankTitle: TEST_BANK.title,
      participant: normalizeParticipant(participant),
      startedAt: nowIso(),
      completedAt: null,
      phase: "practice",
      practiceResponses: [],
      practiceCompleted: false,
      currentTestletId: null,
      currentPrompt: null,
      stopReason: null,
      rawCorrect: 0,
      administeredTestletIds: [],
      selectedTestlets: [],
      responses: [],
      draftSelections: normalizeDraftSelections(null),
      estimates: [buildInitialEstimate()],
      exports: normalizeExportsState(null),
      eventLog: [],
      linking: CROSS_BAND_LINKING,
      ljt: null,  // spec v0.5 §13.2: null when LJT disabled or not yet reached
      config: {
        minTestlets: CONFIG.minTestlets,
        maxTestlets: CONFIG.maxTestlets,
        targetSE: CONFIG.targetSE,
        selectionMetricType: CONFIG.selectionMetricType,
        selectionThetaStep: CONFIG.selectionThetaStep
      }
    };
  }

  function persistState() {
    const payload = {
      savedAt: nowIso(),
      phase: state.phase,
      practiceIndex: state.practiceIndex,
      session: state.session
    };
    const saved = storageSetItem(CONFIG.storageKey, JSON.stringify(payload));
    if (saved) {
      state.storageCleared = false;
    }
    return saved;
  }

  function clearPersistedState() {
    return storageRemoveItem(CONFIG.storageKey);
  }

  function restoreState() {
    const raw = storageGetItem(CONFIG.storageKey);
    if (!raw) {
      return;
    }

    try {
      const payload = JSON.parse(raw);
      if (isPersistedPayloadExpired(payload)) {
        clearPersistedState();
        setStatus("前回の一時保存は24時間を過ぎたため削除しました。必要なら保存済みファイルを利用してください。");
        return;
      }
      if (payload.session) {
        state.pendingResume = {
          savedAt: payload.savedAt || null,
          phase: payload.phase || "intro",
          practiceIndex: Number.isInteger(payload.practiceIndex) ? payload.practiceIndex : 0,
          session: normalizeSessionState(payload.session || null)
        };
        setStatus(getPendingResumeStatusMessage());
      }
    } catch (error) {
      clearPersistedState();
    }
  }

  function isPersistedPayloadExpired(payload) {
    if (!payload || !payload.savedAt) {
      return false;
    }

    const savedAt = toTimestamp(payload.savedAt);
    if (savedAt == null) {
      return false;
    }

    return Date.now() - savedAt > (CONFIG.storageTTLHours * 60 * 60 * 1000);
  }

  function handleBeforeUnload(event) {
    if (!isActiveSession() || state.historyGuardSuspended) {
      return undefined;
    }

    logSessionEvent("beforeunload_prompt", "受験中にページ離脱または再読み込みが試行されました。");
    event.preventDefault();
    event.returnValue = "";
    return "";
  }

  function handlePopState() {
    if (!isActiveSession() || state.historyGuardSuspended) {
      return;
    }

    logSessionEvent("browser_back_attempt", "ブラウザの戻る操作を検知しました。");
    window.history.pushState({ uvltGuard: true, sessionId: state.session ? state.session.sessionId : null }, "", window.location.href);
    showSafetyStatus(
      state.storageUnavailable
        ? "受験中はブラウザの「戻る」や再読み込みをしないでください。このブラウザでは途中保存を利用できません。"
        : "受験中はブラウザの「戻る」や再読み込みをしないでください。現在の解答状態は保持されています。",
      true
    );
  }

  function handleVisibilityChange() {
    if (!state.session || state.historyGuardSuspended) {
      return;
    }

    if (document.hidden) {
      state.pageHiddenDuringSession = true;
      if (isActiveSession()) {
        logSessionEvent("page_hidden", "受験中に別タブまたは別アプリへ移動しました。");
      }
      return;
    }

    if (state.pageHiddenDuringSession && !state.session.completedAt) {
      state.pageHiddenDuringSession = false;
      logSessionEvent("page_visible", "テスト画面へ復帰しました。");
      showSafetyStatus(getResumeStatusMessage(), false);
    }
  }

  function handlePageHide() {
    if (!isActiveSession() || state.historyGuardSuspended) {
      return;
    }

    logSessionEvent("pagehide", "ページが非表示またはキャッシュ退避されました。");
  }

  function handlePageShow(event) {
    if (!state.session || state.session.completedAt) {
      return;
    }

    if (event.persisted) {
      logSessionEvent("pageshow_restored", "ブラウザキャッシュから画面が復元されました。");
      showSafetyStatus(getRestoreStatusMessage(), false);
    }
  }

  function resetApplication() {
    if (isActiveSession()) {
      if (!confirm("受験を中断して最初からやり直しますか？ 現在の記録は失われます。")) {
        return;
      }
      logSessionEvent("session_reset", "ユーザーが最初からやり直しを選択しました。");
    }
    state.phase = "intro";
    state.practiceIndex = 0;
    state.session = null;
    state.pendingResume = null;
    state.storageCleared = false;
    state.storageWarningShown = false;
    clearPersistedState();
    setStatus("");
    releaseHistoryGuard();
    setScreen("intro");
  }

  function buildTable(testlet, headerElement, bodyElement, inputPrefix) {
    headerElement.innerHTML = "<th>意味</th>" + testlet.options.map(function (option) {
      return "<th>" + option + "</th>";
    }).join("");

    bodyElement.innerHTML = testlet.definitions.map(function (definition, rowIndex) {
      return (
        "<tr>" +
          "<th scope=\"row\">" + definition.prompt + "</th>" +
          testlet.options.map(function (_, optionIndex) {
            return (
              "<td><label class=\"choice-cell\">" +
                "<input type=\"radio\" name=\"" + inputPrefix + "-" + rowIndex + "\" value=\"" + optionIndex + "\" data-prefix=\"" + inputPrefix + "\" data-option-index=\"" + optionIndex + "\" aria-label=\"" + definition.prompt + ": " + testlet.options[optionIndex] + "\">" +
              "</label></td>"
            );
          }).join("") +
        "</tr>"
      );
    }).join("");
  }

  function setFormDisabled(formElement, disabled) {
    Array.prototype.forEach.call(formElement.querySelectorAll("input"), function (input) {
      input.disabled = disabled;
    });
  }

  function wireExclusiveChoices(formElement, inputPrefix) {
    Array.prototype.forEach.call(
      formElement.querySelectorAll("input[data-prefix=\"" + inputPrefix + "\"]"),
      function (input) {
        input.addEventListener("change", function (event) {
          if (!event.target.checked) {
            return;
          }

          const selectedOptionIndex = event.target.getAttribute("data-option-index");
          Array.prototype.forEach.call(
            formElement.querySelectorAll(
              "input[data-prefix=\"" + inputPrefix + "\"][data-option-index=\"" + selectedOptionIndex + "\"]"
            ),
            function (candidate) {
              if (candidate !== event.target) {
                candidate.checked = false;
              }
            }
          );

          persistDraftSelections(formElement, inputPrefix);
        });
      }
    );
  }

  function formatPartOfSpeech(partOfSpeech) {
    const labels = {
      noun: "名詞",
      verb: "動詞",
      adjective: "形容詞",
      adverb: "副詞"
    };

    return labels[partOfSpeech] || partOfSpeech;
  }

  function collectSelections(formElement, testlet, inputPrefix) {
    const selections = testlet.definitions.map(function (definition, rowIndex) {
      const checked = formElement.querySelector("input[name=\"" + inputPrefix + "-" + rowIndex + "\"]:checked");

      if (!checked) {
        throw new Error("すべての意味に対して、1つずつ選択してください。");
      }

      const selectedIndex = Number(checked.value);
      return {
        definition: definition,
        selectedIndex: selectedIndex,
        selectedOption: testlet.options[selectedIndex],
        correct: testlet.options[selectedIndex] === definition.correctOption
      };
    });

    const selectedIndices = selections.map(function (selection) {
      return selection.selectedIndex;
    });
    const uniqueIndices = new Set(selectedIndices);

    if (uniqueIndices.size !== selectedIndices.length) {
      throw new Error("同じ語を複数の意味に割り当てることはできません。各語は1回だけ選択してください。");
    }

    return selections;
  }

  function renderPractice() {
    const practice = PRACTICE_TESTLETS[state.practiceIndex];
    beginPrompt("practice", practice.practiceId);

    elements.practiceProgress.textContent = "練習 " + (state.practiceIndex + 1) + " / " + PRACTICE_TESTLETS.length;
    updateProgressFill(elements.practiceProgressFill, state.practiceIndex + 1, PRACTICE_TESTLETS.length);
    elements.practiceTitle.textContent = practice.title;
    elements.practiceDescription.textContent = practice.description + " 同じ語は1回だけ選べます。";
    buildTable(practice, elements.practiceOptionsHeader, elements.practiceDefinitionsBody, "practice");
    wireExclusiveChoices(elements.practiceForm, "practice");
    restoreDraftSelections(elements.practiceForm, "practice", practice.practiceId);
    elements.practiceFeedback.classList.add("hidden");
    elements.practiceFeedbackList.innerHTML = "";
    elements.nextPracticeButton.textContent = state.practiceIndex < PRACTICE_TESTLETS.length - 1 ? "次の練習へ" : "本番へ進む";
    setFormDisabled(elements.practiceForm, false);
    elements.submitPracticeButton.disabled = false;
    setStatus("");
    setScreen("practice");
  }

  function startPracticeFlow() {
    const participant = readParticipantInputs();

    if (!elements.participantForm.reportValidity()) {
      setStatus("学籍番号と受験者名を入力してください。");
      return;
    }

    if (state.pendingResume && state.pendingResume.session) {
      if (participantsMatchForResume(participant, state.pendingResume.session.participant)) {
        state.phase = state.pendingResume.phase || "intro";
        state.practiceIndex = Number.isInteger(state.pendingResume.practiceIndex)
          ? state.pendingResume.practiceIndex
          : 0;
        state.session = state.pendingResume.session;
        state.pendingResume = null;
        restoreInterface();
        return;
      }

      clearPersistedState();
      state.pendingResume = null;
    }

    state.practiceIndex = 0;
    state.session = createFreshSession(participant);
    logSessionEvent("session_started", "練習セクションを開始しました。");
    renderPractice();
  }

  function handlePracticeSubmit(event) {
    event.preventDefault();

    const practice = PRACTICE_TESTLETS[state.practiceIndex];
    let results;

    try {
      results = collectSelections(elements.practiceForm, practice, "practice");
    } catch (error) {
      setStatus(error.message);
      return;
    }

    const timing = completePrompt("practice", practice.practiceId);
    setStatus("");
    elements.practiceFeedbackList.innerHTML = results.map(function (result) {
      const status = result.correct ? "<span class=\"ok\">正解</span>" : "<span class=\"ng\">不正解</span>";
      return (
        "<li>" +
          status + " 「" + result.definition.prompt + "」 → あなたの解答: " + result.selectedOption +
          " / 正答: " + result.definition.correctOption +
        "</li>"
      );
    }).join("");

    state.session.practiceResponses.push({
      practiceId: practice.practiceId,
      title: practice.title,
      responses: results.map(function (result) {
        return {
          prompt: result.definition.prompt,
          selectedOption: result.selectedOption,
          correctOption: result.definition.correctOption,
          correct: result.correct
        };
      }),
      presentedAt: timing.presentedAt,
      submittedAt: timing.submittedAt,
      elapsedMs: timing.elapsedMs,
      timestamp: timing.submittedAt
    });

    clearDraftSelections("practice");
    setFormDisabled(elements.practiceForm, true);
    elements.submitPracticeButton.disabled = true;
    elements.practiceFeedback.classList.remove("hidden");
    persistState();
  }

  function logistic(value) {
    return 1 / (1 + Math.exp(-value));
  }

  function getResolvedThetaStep(step) {
    return step || CONFIG.thetaStep;
  }

  function getThetaGridCacheKey(step) {
    return [
      Number(CONFIG.thetaMin).toFixed(5),
      Number(CONFIG.thetaMax).toFixed(5),
      Number(getResolvedThetaStep(step)).toFixed(5)
    ].join("|");
  }

  function formatCacheNumber(value) {
    return Number(value).toFixed(5);
  }

  function getTestletThetaCacheKey(testlet, theta) {
    return testlet.testletId + "|" + formatCacheNumber(theta);
  }

  function buildThetaGrid(step) {
    const cacheKey = getThetaGridCacheKey(step);
    if (THETA_GRID_CACHE[cacheKey]) {
      return THETA_GRID_CACHE[cacheKey];
    }

    const grid = [];
    const resolvedStep = getResolvedThetaStep(step);
    for (let theta = CONFIG.thetaMin; theta <= CONFIG.thetaMax + 1e-9; theta += resolvedStep) {
      grid.push(Number(theta.toFixed(5)));
    }

    THETA_GRID_CACHE[cacheKey] = grid;
    return grid;
  }

  function normalLogDensity(theta, mean, sd) {
    const z = (theta - mean) / sd;
    return -0.5 * z * z - Math.log(sd);
  }

  function buildPosterior(thetaGrid, logPosterior, step) {
    if (!logPosterior.length) {
      return buildPriorPosterior(step);
    }
    const maxLog = Math.max.apply(null, logPosterior);
    const weights = logPosterior.map(function (value) {
      return Math.exp(value - maxLog);
    });
    const totalWeight = weights.reduce(function (sum, value) {
      return sum + value;
    }, 0);
    const normalized = weights.map(function (weight) {
      return weight / totalWeight;
    });
    const summary = summarizePosterior(thetaGrid, normalized);

    return {
      thetaGrid: thetaGrid,
      normalized: normalized,
      thetaStep: getResolvedThetaStep(step),
      summary: summary
    };
  }

  function buildPriorPosterior(step) {
    const cacheKey = getThetaGridCacheKey(step);
    if (PRIOR_POSTERIOR_CACHE[cacheKey]) {
      return PRIOR_POSTERIOR_CACHE[cacheKey];
    }

    const thetaGrid = buildThetaGrid(step);
    const logPosterior = thetaGrid.map(function (theta) {
      return normalLogDensity(theta, CONFIG.priorMean, CONFIG.priorSD);
    });

    PRIOR_POSTERIOR_CACHE[cacheKey] = buildPosterior(thetaGrid, logPosterior, step);
    return PRIOR_POSTERIOR_CACHE[cacheKey];
  }

  function buildLinkedRaschPosterior(responses, step) {
    const thetaGrid = buildThetaGrid(step);
    const epsilon = 1e-12;

    const logPosterior = thetaGrid.map(function (theta) {
      let value = normalLogDensity(theta, CONFIG.priorMean, CONFIG.priorSD);

      responses.forEach(function (response) {
        const item = TEST_BANK.itemMap[response.itemId];
        const probability = logistic(theta - item.difficulty);
        const safeProbability = Math.min(Math.max(probability, epsilon), 1 - epsilon);
        value += response.correct ? Math.log(safeProbability) : Math.log(1 - safeProbability);
      });

      return value;
    });

    return buildPosterior(thetaGrid, logPosterior, step);
  }

  function summarizePosterior(thetaGrid, normalized) {
    if (!thetaGrid.length || !normalized.length) {
      return {
        theta: CONFIG.priorMean,
        se: CONFIG.priorSD,
        map: CONFIG.priorMean,
        variance: CONFIG.priorSD * CONFIG.priorSD
      };
    }

    const eap = normalized.reduce(function (sum, weight, index) {
      return sum + thetaGrid[index] * weight;
    }, 0);

    const variance = normalized.reduce(function (sum, weight, index) {
      const delta = thetaGrid[index] - eap;
      return sum + delta * delta * weight;
    }, 0);

    let mapIndex = 0;
    normalized.forEach(function (weight, index) {
      if (weight > normalized[mapIndex]) {
        mapIndex = index;
      }
    });

    return {
      theta: Number(eap.toFixed(3)),
      se: Number(Math.sqrt(variance).toFixed(3)),
      map: Number(thetaGrid[mapIndex].toFixed(3)),
      variance: variance
    };
  }

  function estimateAbility(responses) {
    if (!responses.length) {
      return {
        theta: CONFIG.priorMean,
        se: CONFIG.priorSD,
        map: CONFIG.priorMean
      };
    }

    const posterior = buildLinkedRaschPosterior(responses);
    const summary = posterior.summary;
    return {
      theta: summary.theta,
      se: summary.se,
      map: summary.map
    };
  }

  function buildQuadratureGrid(variance) {
    const cacheKey = Number(variance.toFixed(5));

    if (QUADRATURE_CACHE[cacheKey]) {
      return QUADRATURE_CACHE[cacheKey];
    }

    if (variance <= 1e-8) {
      return [{ gamma: 0, weight: 1 }];
    }

    const sd = Math.sqrt(variance);
    const normalization = Math.sqrt(Math.PI);

    QUADRATURE_CACHE[cacheKey] = GAUSS_HERMITE_NODES.map(function (node, index) {
      return {
        gamma: Number((Math.sqrt(2) * sd * node).toFixed(5)),
        weight: GAUSS_HERMITE_WEIGHTS[index] / normalization
      };
    });

    return QUADRATURE_CACHE[cacheKey];
  }

  function groupResponsesByTestlet(responses) {
    const grouped = {};

    responses.forEach(function (response) {
      if (!grouped[response.testletId]) {
        grouped[response.testletId] = {
          variance: response.testletVariance || 0,
          difficulties: [],
          outcomes: []
        };
      }
      grouped[response.testletId].difficulties.push(TEST_BANK.itemMap[response.itemId].difficulty);
      grouped[response.testletId].outcomes.push(Boolean(response.correct));
    });

    return Object.keys(grouped).map(function (testletId) {
      return grouped[testletId];
    });
  }

  function computeObservedTestletLikelihood(theta, testletGroup) {
    if (!testletGroup.outcomes.length) {
      return 1;
    }

    const quadrature = buildQuadratureGrid(testletGroup.variance);
    const epsilon = 1e-12;
    let likelihood = 0;

    quadrature.forEach(function (point) {
      let conditional = 1;

      testletGroup.difficulties.forEach(function (difficulty, index) {
        const probability = logistic(theta - difficulty + point.gamma);
        const safeProbability = Math.min(Math.max(probability, epsilon), 1 - epsilon);
        conditional *= testletGroup.outcomes[index] ? safeProbability : (1 - safeProbability);
      });

      likelihood += point.weight * conditional;
    });

    return Math.max(likelihood, epsilon);
  }

  function computeAllPatternLikelihoods(theta, difficulties, variance) {
    const quadrature = buildQuadratureGrid(variance);
    const epsilon = 1e-12;
    const patternCount = Math.pow(2, difficulties.length);
    const likelihoods = new Array(patternCount).fill(0);

    quadrature.forEach(function (point) {
      const probabilities = difficulties.map(function (difficulty) {
        const probability = logistic(theta - difficulty + point.gamma);
        return Math.min(Math.max(probability, epsilon), 1 - epsilon);
      });

      for (let patternMask = 0; patternMask < patternCount; patternMask += 1) {
        let conditional = 1;

        probabilities.forEach(function (probability, index) {
          conditional *= (patternMask & (1 << index)) ? probability : (1 - probability);
        });

        likelihoods[patternMask] += point.weight * conditional;
      }
    });

    return likelihoods.map(function (likelihood) {
      return Math.max(likelihood, epsilon);
    });
  }

  function marginalCorrectProbability(theta, difficulty, variance) {
    if (!variance || variance <= 1e-8) {
      return logistic(theta - difficulty);
    }

    const quadrature = buildQuadratureGrid(variance);

    return quadrature.reduce(function (sum, point) {
      return sum + point.weight * logistic(theta - difficulty + point.gamma);
    }, 0);
  }

  function buildTestletAwarePosterior(responses, step) {
    if (!responses.length) {
      return buildPriorPosterior(step);
    }

    const thetaGrid = buildThetaGrid(step);
    const groupedResponses = groupResponsesByTestlet(responses);
    const logPosterior = thetaGrid.map(function (theta) {
      let value = normalLogDensity(theta, CONFIG.priorMean, CONFIG.priorSD);

      groupedResponses.forEach(function (testletGroup) {
        value += Math.log(computeObservedTestletLikelihood(theta, testletGroup));
      });

      return value;
    });

    return buildPosterior(thetaGrid, logPosterior, step);
  }

  function estimateTestletAwareAbility(responses) {
    if (!responses.length) {
      return {
        theta: CONFIG.priorMean,
        se: CONFIG.priorSD,
        map: CONFIG.priorMean
      };
    }

    const posterior = buildTestletAwarePosterior(responses);
    const summary = posterior.summary;
    return {
      theta: summary.theta,
      se: summary.se,
      map: summary.map
    };
  }

  function buildOperationalEstimate(responses) {
    const linkedRasch = estimateAbility(responses);
    const testletAware = estimateTestletAwareAbility(responses);

    return {
      theta: testletAware.theta,
      se: testletAware.se,
      map: testletAware.map,
      scoringModel: "testlet-aware marginal EAP approximation",
      linkedRaschTheta: linkedRasch.theta,
      linkedRaschSE: linkedRasch.se,
      linkedRaschMap: linkedRasch.map,
      testletAwareTheta: testletAware.theta,
      testletAwareSE: testletAware.se,
      testletAwareMap: testletAware.map
    };
  }

  function getTestletPatternLikelihoods(testlet, step) {
    const cacheKey = testlet.testletId + "|" + getThetaGridCacheKey(step);
    if (TESTLET_PATTERN_LIKELIHOOD_CACHE[cacheKey]) {
      return TESTLET_PATTERN_LIKELIHOOD_CACHE[cacheKey];
    }

    const thetaGrid = buildThetaGrid(step);
    const likelihoodsByPattern = [];

    for (let patternIndex = 0; patternIndex < testlet.patternCount; patternIndex += 1) {
      likelihoodsByPattern.push([]);
    }

    thetaGrid.forEach(function (theta) {
      const patternLikelihoods = computeAllPatternLikelihoods(
        theta,
        testlet.difficultyVector,
        testlet.testletVariance || 0
      );

      patternLikelihoods.forEach(function (likelihood, patternIndex) {
        likelihoodsByPattern[patternIndex].push(likelihood);
      });
    });

    TESTLET_PATTERN_LIKELIHOOD_CACHE[cacheKey] = {
      likelihoodsByPattern: likelihoodsByPattern
    };
    return TESTLET_PATTERN_LIKELIHOOD_CACHE[cacheKey];
  }

  function getPatternLikelihoodsAtTheta(testlet, theta) {
    const cacheKey = getTestletThetaCacheKey(testlet, theta);
    if (TESTLET_THETA_PATTERN_CACHE[cacheKey]) {
      return TESTLET_THETA_PATTERN_CACHE[cacheKey];
    }
    const likelihoods = computeAllPatternLikelihoods(theta, testlet.difficultyVector, testlet.testletVariance || 0);

    TESTLET_THETA_PATTERN_CACHE[cacheKey] = likelihoods;
    return likelihoods;
  }

  function approximatePatternSecondDerivatives(theta, testlet) {
    const baseStep = 0.1;
    const distToMin = theta - CONFIG.thetaMin;
    const distToMax = CONFIG.thetaMax - theta;
    const canGoDown = distToMin > 1e-6;
    const canGoUp = distToMax > 1e-6;

    if (!canGoDown && !canGoUp) {
      return new Array(testlet.patternCount).fill(0);
    }

    const centerLikelihoods = getPatternLikelihoodsAtTheta(testlet, theta);
    const secondDerivatives = [];

    if (canGoDown && canGoUp) {
      const step = Math.min(baseStep, distToMin, distToMax);
      const lowerLikelihoods = getPatternLikelihoodsAtTheta(testlet, theta - step);
      const upperLikelihoods = getPatternLikelihoodsAtTheta(testlet, theta + step);
      const denom = step * step;
      for (let i = 0; i < testlet.patternCount; i += 1) {
        secondDerivatives.push(
          (Math.log(upperLikelihoods[i]) - (2 * Math.log(centerLikelihoods[i])) + Math.log(lowerLikelihoods[i])) / denom
        );
      }
    } else if (canGoUp) {
      const h = Math.min(baseStep, distToMax / 2);
      const L0 = centerLikelihoods;
      const L1 = getPatternLikelihoodsAtTheta(testlet, theta + h);
      const L2 = getPatternLikelihoodsAtTheta(testlet, theta + 2 * h);
      const denom = h * h;
      for (let i = 0; i < testlet.patternCount; i += 1) {
        secondDerivatives.push(
          (Math.log(L2[i]) - (2 * Math.log(L1[i])) + Math.log(L0[i])) / denom
        );
      }
    } else {
      const h = Math.min(baseStep, distToMin / 2);
      const L0 = centerLikelihoods;
      const L1 = getPatternLikelihoodsAtTheta(testlet, theta - h);
      const L2 = getPatternLikelihoodsAtTheta(testlet, theta - 2 * h);
      const denom = h * h;
      for (let i = 0; i < testlet.patternCount; i += 1) {
        secondDerivatives.push(
          (Math.log(L2[i]) - (2 * Math.log(L1[i])) + Math.log(L0[i])) / denom
        );
      }
    }

    return secondDerivatives;
  }

  function testletInformation(theta, testlet) {
    const cacheKey = getTestletThetaCacheKey(testlet, theta);
    if (TESTLET_INFORMATION_CACHE[cacheKey] != null) {
      return TESTLET_INFORMATION_CACHE[cacheKey];
    }

    const likelihoods = getPatternLikelihoodsAtTheta(testlet, theta);
    const secondDerivatives = approximatePatternSecondDerivatives(theta, testlet);
    const information = likelihoods.reduce(function (sum, likelihood, patternIndex) {
      return sum + (likelihood * Math.max(0, -secondDerivatives[patternIndex]));
    }, 0);

    TESTLET_INFORMATION_CACHE[cacheKey] = Number(information.toFixed(6));
    return TESTLET_INFORMATION_CACHE[cacheKey];
  }

  function expectedPosteriorVarianceReduction(responses, testlet, cachedPosterior) {
    const posterior = cachedPosterior || buildTestletAwarePosterior(responses);
    const currentSummary = posterior.summary || summarizePosterior(posterior.thetaGrid, posterior.normalized);
    const cachedLikelihoods = getTestletPatternLikelihoods(testlet, posterior.thetaStep);
    const epsilon = 1e-15;
    const expectedPosteriorVariance = cachedLikelihoods.likelihoodsByPattern.reduce(function (sum, likelihoods) {
      let patternProbability = 0;
      let weightedTheta = 0;
      let weightedThetaSquared = 0;

      posterior.thetaGrid.forEach(function (theta, index) {
        const weightedLikelihood = posterior.normalized[index] * likelihoods[index];
        patternProbability += weightedLikelihood;
        weightedTheta += theta * weightedLikelihood;
        weightedThetaSquared += theta * theta * weightedLikelihood;
      });

      if (patternProbability <= epsilon) {
        return sum;
      }

      return sum + weightedThetaSquared - ((weightedTheta * weightedTheta) / patternProbability);
    }, 0);

    return Number(Math.max(0, currentSummary.variance - expectedPosteriorVariance).toFixed(6));
  }

  function getSelectionMetricLabel() {
    if (CONFIG.selectionMetricType === "expectedMarginalTestletInformation") {
      return "expected marginal testlet information";
    }
    return "expected posterior variance reduction";
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function mean(values) {
    if (!values.length) {
      return 0;
    }

    return values.reduce(function (sum, value) {
      return sum + value;
    }, 0) / values.length;
  }

  function getBandStatusLabel(probability) {
    if (probability >= 0.8) {
      return "安定";
    }
    if (probability >= 0.65) {
      return "概ね安定";
    }
    if (probability >= 0.5) {
      return "発達中";
    }
    if (probability >= 0.35) {
      return "要強化";
    }
    return "未定着";
  }

  function getBandStatusClass(probability) {
    if (probability >= 0.8) {
      return "ok";
    }
    if (probability >= 0.5) {
      return "warn";
    }
    return "";
  }

  function getObservedBandStats() {
    if (!state.session) {
      return {};
    }

    return state.session.responses.reduce(function (accumulator, response) {
      const item = TEST_BANK.itemMap[response.itemId];
      if (!item) {
        return accumulator;
      }

      if (!accumulator[item.level]) {
        accumulator[item.level] = {
          correct: 0,
          total: 0
        };
      }

      accumulator[item.level].total += 1;
      if (response.correct) {
        accumulator[item.level].correct += 1;
      }

      return accumulator;
    }, {});
  }

  function computeBandDiagnostics(theta, se) {
    const observedStats = getObservedBandStats();

    return BAND_ORDER.map(function (band) {
      const testlets = TEST_BANK.testlets.filter(function (testlet) {
        return testlet.level === band;
      });
      const items = testlets.reduce(function (rows, testlet) {
        return rows.concat(testlet.definitions.map(function (definition) {
          return {
            difficulty: definition.difficulty,
            variance: testlet.testletVariance
          };
        }));
      }, []);
      const difficulties = items.map(function (item) {
        return item.difficulty;
      });
      const coefficient = CROSS_BAND_LINKING.coefficients[band];
      const expectedAccuracy = mean(items.map(function (item) {
        return marginalCorrectProbability(theta, item.difficulty, item.variance);
      }));
      const lowerAccuracy = mean(items.map(function (item) {
        return marginalCorrectProbability(theta - se, item.difficulty, item.variance);
      }));
      const upperAccuracy = mean(items.map(function (item) {
        return marginalCorrectProbability(theta + se, item.difficulty, item.variance);
      }));
      const estimatedKnownWords = expectedAccuracy * 1000;
      const observed = observedStats[band] || null;
      const observedAccuracy = observed && observed.total ? observed.correct / observed.total : null;

      return {
        band: band,
        expectedAccuracy: Number(expectedAccuracy.toFixed(4)),
        lowerAccuracy: Number(lowerAccuracy.toFixed(4)),
        upperAccuracy: Number(upperAccuracy.toFixed(4)),
        expectedFormScore: Number((expectedAccuracy * difficulties.length).toFixed(2)),
        estimatedKnownWords: Math.round(estimatedKnownWords),
        lowerKnownWords: Math.round(lowerAccuracy * 1000),
        upperKnownWords: Math.round(upperAccuracy * 1000),
        itemCount: difficulties.length,
        observedCorrect: observed ? observed.correct : 0,
        observedItems: observed ? observed.total : 0,
        observedAccuracy: observedAccuracy == null ? null : Number(observedAccuracy.toFixed(4)),
        meanDifficulty: Number(mean(difficulties).toFixed(3)),
        linkSlope: coefficient.slope,
        linkIntercept: coefficient.intercept,
        linkCorrelation: coefficient.correlation,
        linkRMSE: coefficient.rmse,
        statusLabel: getBandStatusLabel(expectedAccuracy),
        statusClass: getBandStatusClass(expectedAccuracy)
      };
    });
  }

  function computeVocabularyEstimate(theta, se) {
    const bandDiagnostics = computeBandDiagnostics(theta, se);

    return {
      estimatedWords: bandDiagnostics.reduce(function (sum, band) {
        return sum + band.estimatedKnownWords;
      }, 0),
      lowerWords: bandDiagnostics.reduce(function (sum, band) {
        return sum + band.lowerKnownWords;
      }, 0),
      upperWords: bandDiagnostics.reduce(function (sum, band) {
        return sum + band.upperKnownWords;
      }, 0),
      bandDiagnostics: bandDiagnostics
    };
  }

  function renderVocabularyRangeVisual(vocabulary) {
    const scaleMin = 0;
    const scaleMax = 5000;
    const range = scaleMax - scaleMin;
    const lower = clamp(vocabulary.lowerWords, scaleMin, scaleMax);
    const upper = clamp(vocabulary.upperWords, scaleMin, scaleMax);
    const marker = clamp(vocabulary.estimatedWords, scaleMin, scaleMax);
    const markerPosition = ((marker - scaleMin) / range) * 100;
    const lowerPosition = ((lower - scaleMin) / range) * 100;
    const upperPosition = ((upper - scaleMin) / range) * 100;

    elements.thetaVisual.innerHTML =
      "<div><strong>" + vocabulary.estimatedWords + "語</strong> / 推定レンジ " + vocabulary.lowerWords + "–" + vocabulary.upperWords + "語</div>" +
      "<div class=\"theta-scale\">" +
        "<div class=\"theta-track\">" +
          "<div class=\"theta-band\" style=\"left:" + lowerPosition.toFixed(2) + "%; width:" + (upperPosition - lowerPosition).toFixed(2) + "%;\"></div>" +
          "<div class=\"theta-marker\" style=\"left:" + markerPosition.toFixed(2) + "%;\"></div>" +
        "</div>" +
        "<div class=\"theta-labels\"><span>0</span><span>1000</span><span>2000</span><span>3000</span><span>4000</span><span>5000</span></div>" +
      "</div>";
  }

  function renderBandDiagnostics(diagnostics) {
    elements.bandDiagnostics.innerHTML = diagnostics.map(function (band) {
      return (
        "<div class=\"band-row\">" +
          "<div class=\"band-top\">" +
            "<strong>" + formatBandWithDescription(band.band) + "</strong>" +
            "<span>" + band.statusLabel + " / " + band.estimatedKnownWords + "語の目安</span>" +
          "</div>" +
          "<div class=\"bar-track\"><div class=\"bar-fill " + band.statusClass + "\" style=\"width:" + (band.expectedAccuracy * 100).toFixed(1) + "%;\"></div></div>" +
          "<div class=\"fine-print\">この帯域では、およそ " + band.lowerKnownWords + "–" + band.upperKnownWords + "語ぶんの理解が見込まれます。</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderTimelineVisual() {
    elements.timelineVisual.innerHTML = state.session.selectedTestlets.map(function (testlet) {
      const correctCount = testlet.correctCount == null ? "—" : testlet.correctCount + " / 3";
      const timeLabel = formatElapsedMs(testlet.elapsedMs);
      const accuracyRatio = testlet.correctCount == null ? 0 : (testlet.correctCount / 3);
      const accuracyClass = getBandStatusClass(accuracyRatio);
      const bandLabel = formatBandWithDescription(testlet.testletId.split("_")[1]);

      return (
        "<div class=\"timeline-row\">" +
          "<div class=\"timeline-top\">" +
            "<strong>セット " + testlet.order + "（" + bandLabel + "）</strong>" +
            "<span>正答 " + correctCount + " / " + timeLabel + "</span>" +
          "</div>" +
          "<div class=\"bar-track\"><div class=\"bar-fill " + accuracyClass + "\" style=\"width:" + (accuracyRatio * 100).toFixed(1) + "%;\"></div></div>" +
          "<div class=\"fine-print\">" + bandLabel + "の問題に取り組みました。</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderFeedbackItems(estimate, vocabulary, sessionElapsedMs) {
    const averageTimePerTestlet = state.session.selectedTestlets.length
      ? Math.round(state.session.selectedTestlets.reduce(function (sum, row) {
          return sum + (row.elapsedMs || 0);
        }, 0) / state.session.selectedTestlets.length)
      : null;
    const eventCounts = getEventCounts(state.session);
    const scoreQuality = getScoreQuality(estimate, state.session);
    const bandExtremes = getBandExtremes(vocabulary);
    const strongestBand = bandExtremes.strongestBand;
    const weakestBand = bandExtremes.weakestBand;
    const researcherMode = isResearcherMode();

    const items = [
      "今回の結果では、語彙サイズは " + vocabulary.estimatedWords + "語程度と見込まれます。",
      "推定レンジは " + vocabulary.lowerWords + "–" + vocabulary.upperWords + "語です。数字はあくまで目安として見てください。",
      formatBandWithDescription(strongestBand.band) + "は比較的安定して理解できている可能性があります。",
      formatBandWithDescription(weakestBand.band) + "は、今後重点的に伸ばしていく候補です。",
      "次の学習では、" + formatBandLabel(weakestBand.band) + "を中心に確認してください。 " + buildStudySuggestion(weakestBand.band),
      "受験全体の所要時間は " + formatElapsedMs(sessionElapsedMs) + "、1セットあたり平均は " + formatElapsedMs(averageTimePerTestlet) + " でした。"
    ];

    if (researcherMode) {
      items.splice(5, 0, "結果の安定性は「" + scoreQuality.label + "」です。 " + scoreQuality.note);
    }

    if (researcherMode && eventCounts.interruptionEvents > 0) {
      items.push(
        "途中で画面の切り替えが " + eventCounts.interruptionEvents + " 回記録されました。今回の結果は、少し幅をもって解釈してください。"
      );
    }

    elements.feedbackItems.innerHTML = items.map(function (item) {
      return "<li>" + item + "</li>";
    }).join("");
  }

  function getInitialTestletSelection() {
    const cacheKey = [
      CONFIG.selectionMetricType,
      getThetaGridCacheKey(CONFIG.selectionThetaStep),
      Number(CONFIG.priorMean).toFixed(5)
    ].join("|");
    if (INITIAL_SELECTION_CACHE[cacheKey]) {
      return {
        testlet: INITIAL_SELECTION_CACHE[cacheKey].testlet,
        informationScore: INITIAL_SELECTION_CACHE[cacheKey].informationScore,
        posteriorReductionScore: INITIAL_SELECTION_CACHE[cacheKey].posteriorReductionScore,
        difficultyGap: INITIAL_SELECTION_CACHE[cacheKey].difficultyGap,
        reasonText: INITIAL_SELECTION_CACHE[cacheKey].reasonText
      };
    }

    const priorPosterior = buildTestletAwarePosterior([], CONFIG.selectionThetaStep);
    const ranked = TEST_BANK.testlets.map(function (testlet) {
      return {
        testlet: testlet,
        primaryMetricScore: CONFIG.selectionMetricType === "expectedPosteriorVarianceReduction"
          ? expectedPosteriorVarianceReduction([], testlet, priorPosterior)
          : testletInformation(CONFIG.priorMean, testlet)
      };
    }).sort(function (left, right) {
      if (right.primaryMetricScore !== left.primaryMetricScore) {
        return right.primaryMetricScore - left.primaryMetricScore;
      }
      return left.testlet.globalPosition - right.testlet.globalPosition;
    });

    const winner = ranked[0];
    const selection = {
      testlet: winner.testlet,
      informationScore: CONFIG.selectionMetricType === "expectedMarginalTestletInformation"
        ? winner.primaryMetricScore
        : testletInformation(CONFIG.priorMean, winner.testlet),
      posteriorReductionScore: CONFIG.selectionMetricType === "expectedPosteriorVarianceReduction"
        ? winner.primaryMetricScore
        : expectedPosteriorVarianceReduction([], winner.testlet, priorPosterior),
      difficultyGap: Math.abs(winner.testlet.selectionDifficulty - CONFIG.priorMean),
      reasonText: "本番では、解答に応じて次に出るセットが変わります。"
    };

    INITIAL_SELECTION_CACHE[cacheKey] = selection;
    return {
      testlet: selection.testlet,
      informationScore: selection.informationScore,
      posteriorReductionScore: selection.posteriorReductionScore,
      difficultyGap: selection.difficultyGap,
      reasonText: selection.reasonText
    };
  }

  function getBandMeanDifficulty(band) {
    return mean(BAND_REFERENCE[band]);
  }

  function getTargetBands(theta) {
    const rankedBands = BAND_ORDER
      .map(function (band) {
        return {
          band: band,
          gap: Math.abs(theta - getBandMeanDifficulty(band))
        };
      })
      .sort(function (left, right) {
        return left.gap - right.gap;
      });

    const primaryBand = rankedBands[0].band;
    const primaryIndex = BAND_ORDER.indexOf(primaryBand);
    const neighborBands = BAND_ORDER.filter(function (band, index) {
      return Math.abs(index - primaryIndex) <= 1;
    });

    return {
      primaryBand: primaryBand,
      eligibleBands: neighborBands
    };
  }

  function getAdministeredBandCounts(administeredTestletIds) {
    const counts = {};

    BAND_ORDER.forEach(function (band) {
      counts[band] = 0;
    });

    administeredTestletIds.forEach(function (testletId) {
      const testlet = TEST_BANK.testlets.find(function (candidate) {
        return candidate.testletId === testletId;
      });
      if (testlet) {
        counts[testlet.level] += 1;
      }
    });

    return counts;
  }

  function getNextTestletSelection(theta, administeredTestletIds) {
    const administered = new Set(administeredTestletIds);
    const routing = getTargetBands(theta);
    const bandCounts = getAdministeredBandCounts(administeredTestletIds);
    const responses = state.session ? state.session.responses : [];
    const currentPosterior = CONFIG.selectionMetricType === "expectedPosteriorVarianceReduction"
      ? buildTestletAwarePosterior(responses, CONFIG.selectionThetaStep)
      : null;
    const remaining = TEST_BANK.testlets.filter(function (testlet) {
      return !administered.has(testlet.testletId);
    });
    const eligible = remaining.filter(function (testlet) {
      return routing.eligibleBands.indexOf(testlet.level) >= 0;
    });
    const candidatePool = eligible.length ? eligible : remaining;

    const ranked = candidatePool
      .map(function (testlet) {
        const inEligibleBand = routing.eligibleBands.indexOf(testlet.level) >= 0;
        const coveragePenalty = bandCounts[testlet.level] * 0.015;
        const outOfBandPenalty = inEligibleBand ? 0 : 0.2;
        let exposurePenalty = 0;
        if (CONFIG.exposureControlEnabled && exposureTracker.sessionCount > 20) {
          const overshoot = Math.max(0, getExposureRate(testlet.testletId) - CONFIG.maxExposureRate);
          exposurePenalty = overshoot * CONFIG.exposurePenaltyWeight * Math.log(exposureTracker.sessionCount + 1);
        }
        const primaryMetricScore = CONFIG.selectionMetricType === "expectedPosteriorVarianceReduction"
          ? expectedPosteriorVarianceReduction(responses, testlet, currentPosterior)
          : testletInformation(theta, testlet);
        return {
          testlet: testlet,
          difficultyGap: Math.abs(theta - testlet.selectionDifficulty),
          routingPenalty: coveragePenalty + outOfBandPenalty,
          exposurePenalty: exposurePenalty,
          primaryMetricScore: primaryMetricScore,
          compositeScore: primaryMetricScore - coveragePenalty - outOfBandPenalty - exposurePenalty,
          primaryBand: routing.primaryBand
        };
      })
      .sort(function (left, right) {
        if (right.compositeScore !== left.compositeScore) {
          return right.compositeScore - left.compositeScore;
        }
        if (left.difficultyGap !== right.difficultyGap) {
          return left.difficultyGap - right.difficultyGap;
        }
        return left.testlet.globalPosition - right.testlet.globalPosition;
      });

    if (!ranked.length) {
      return null;
    }

    ranked[0].informationScore = CONFIG.selectionMetricType === "expectedMarginalTestletInformation"
      ? ranked[0].primaryMetricScore
      : testletInformation(theta, ranked[0].testlet);
    ranked[0].posteriorReductionScore = CONFIG.selectionMetricType === "expectedPosteriorVarianceReduction"
      ? ranked[0].primaryMetricScore
      : expectedPosteriorVarianceReduction(
        responses,
        ranked[0].testlet,
        currentPosterior || buildTestletAwarePosterior(responses, CONFIG.selectionThetaStep)
      );
    ranked[0].reasonText = "このセットは、ここまでの解答に合わせて選ばれています。";
    return ranked[0];
  }

  function getCurrentEstimate() {
    return state.session.estimates[state.session.estimates.length - 1];
  }

  function getCurrentTestlet() {
    if (!state.session || !state.session.currentTestletId) {
      return null;
    }
    return TEST_BANK.testlets.find(function (testlet) {
      return testlet.testletId === state.session.currentTestletId;
    }) || null;
  }

  function getCurrentSelectionRecord() {
    if (!state.session || !state.session.selectedTestlets.length) {
      return null;
    }

    return state.session.selectedTestlets[state.session.selectedTestlets.length - 1];
  }

  function renderOperationalTestlet(selection) {
    const testlet = selection.testlet;
    const completed = state.session.administeredTestletIds.length;
    const presentedAt = beginPrompt("test", testlet.testletId);
    const selectionRecord = getCurrentSelectionRecord();

    if (selectionRecord && !selectionRecord.presentedAt) {
      selectionRecord.presentedAt = presentedAt;
    }

    elements.testProgress.textContent = "本番 セット " + (completed + 1) + " / 最大 " + CONFIG.maxTestlets;
    updateProgressFill(elements.testProgressFill, completed + 1, CONFIG.maxTestlets);
    elements.thetaBadge.textContent = "同じ語は1回だけ選べます";
    elements.seBadge.textContent = getSavedStateLabel();
    elements.testTitle.textContent = "本番 セット " + (completed + 1);
    elements.testDescription.textContent =
      "3つの英語の意味それぞれに、最も合う語を1つずつ選んでください。";
    elements.selectionReason.textContent = selection.reasonText;

    buildTable(testlet, elements.testOptionsHeader, elements.testDefinitionsBody, "test");
    wireExclusiveChoices(elements.testForm, "test");
    restoreDraftSelections(elements.testForm, "test", testlet.testletId);
    setStatus("");
    setScreen("test");
  }

  function queueNextOperationalTestlet() {
    let selection;

    if (!state.session.administeredTestletIds.length) {
      selection = getInitialTestletSelection();
    } else {
      selection = getNextTestletSelection(getCurrentEstimate().theta, state.session.administeredTestletIds);
    }

    if (!selection) {
      finishSession("利用可能なセットがなくなりました。");
      return;
    }

    state.session.currentTestletId = selection.testlet.testletId;
    state.session.selectedTestlets.push({
      order: state.session.selectedTestlets.length + 1,
      testletId: selection.testlet.testletId,
      level: selection.testlet.level,
        selectionTheta: getCurrentEstimate().theta,
        selectionDifficulty: selection.testlet.selectionDifficulty,
        selectionRawDifficulty: selection.testlet.selectionRawDifficulty,
        informationScore: selection.informationScore,
        posteriorReductionScore: selection.posteriorReductionScore == null ? null : Number(selection.posteriorReductionScore.toFixed(6)),
        difficultyGap: Number(selection.difficultyGap.toFixed(3)),
        reasonText: selection.reasonText,
        selectedAt: nowIso(),
      presentedAt: null,
      submittedAt: null,
      elapsedMs: null,
      correctCount: null
    });

    state.session.phase = "test";
    persistState();
    renderOperationalTestlet(selection);
  }

  function startOperationalPhase() {
    state.session.practiceCompleted = true;
    state.session.phase = "test";
    clearDraftSelections("practice");
    logSessionEvent("operational_started", "本番セクションを開始しました。");
    queueNextOperationalTestlet();
  }

  function shouldStop(administeredCount, estimate) {
    if (administeredCount < CONFIG.minTestlets) {
      return null;
    }

    if (estimate.se <= CONFIG.targetSE && administeredCount < CONFIG.maxTestlets) {
      return "目標標準誤差 " + CONFIG.targetSE.toFixed(2) + " に到達しました。";
    }

    if (administeredCount >= CONFIG.maxTestlets) {
      return "最大 " + CONFIG.maxTestlets + " セットに到達しました。";
    }

    return null;
  }

  function createSeededRandom(seed) {
    let value = (Math.abs(Math.floor(seed || 1)) % 4294967296) || 1;

    return function () {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    };
  }

  function sampleNormal(rng, meanValue, sdValue) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = Math.max(rng(), 1e-12);
    const radius = Math.sqrt(-2 * Math.log(u1));
    const angle = 2 * Math.PI * u2;
    return meanValue + (sdValue * radius * Math.cos(angle));
  }

  function chooseRandomValue(values, rng) {
    return values[Math.floor(rng() * values.length)];
  }

  function simulateTestletResponses(testlet, thetaTrue, profile, order, rng) {
    const usedOptions = new Set();

    return testlet.definitions.map(function (definition) {
      const effectiveTheta = thetaTrue - ((order - 1) * (profile.fatiguePerTestlet || 0));
      const baseProbability = logistic((effectiveTheta - definition.difficulty) * (profile.focus || 1));
      const adjustedProbability = clamp(
        (baseProbability * (1 - (profile.slipRate || 0))) +
        ((1 - baseProbability) * (profile.guessSuccess || 0.16)),
        0.02,
        0.98
      );

      const correctAvailable = !usedOptions.has(definition.correctOption);
      const answeredCorrect = correctAvailable && rng() < adjustedProbability;
      const candidateOptions = testlet.options.filter(function (option) {
        return !usedOptions.has(option);
      });
      const wrongOptions = candidateOptions.filter(function (option) {
        return option !== definition.correctOption;
      });
      const selectedOption = answeredCorrect
        ? definition.correctOption
        : chooseRandomValue(wrongOptions.length ? wrongOptions : candidateOptions, rng);

      usedOptions.add(selectedOption);

      return {
        itemId: definition.itemId,
        difficulty: definition.difficulty,
        selectedOption: selectedOption,
        correct: selectedOption === definition.correctOption
      };
    });
  }

  function simulateBehaviorEvents(profile, rng) {
    const eventLog = [];
    let delayMs = 0;

    if (rng() < (profile.tabSwitchRate || 0)) {
      eventLog.push({ type: "page_hidden" });
      delayMs += 15000;

      if (rng() < (profile.restoreRate || 0)) {
        eventLog.push({ type: "session_restored" });
        delayMs += 5000;
      }
    }

    if (rng() < (profile.backAttemptRate || 0)) {
      eventLog.push({ type: "browser_back_attempt" });
      delayMs += 8000;
    }

    if (rng() < ((profile.backAttemptRate || 0) * 0.6)) {
      eventLog.push({ type: "beforeunload_prompt" });
      delayMs += 5000;
    }

    return {
      eventLog: eventLog,
      delayMs: delayMs
    };
  }

  function simulateSingleSession(profile, rng) {
    const thetaTrue = clamp(sampleTheta(profile, rng), CONFIG.thetaMin, CONFIG.thetaMax);
    const responses = [];
    const administeredTestletIds = [];
    const bandPath = [];
    const eventLog = [];
    let totalElapsedMs = 0;
    let rawCorrect = 0;
    let estimate = {
      theta: CONFIG.priorMean,
      se: CONFIG.priorSD,
      map: CONFIG.priorMean
    };
    let selection = getInitialTestletSelection();
    let stopReason = "利用可能なセットがなくなりました。";

    while (selection) {
      const order = administeredTestletIds.length + 1;
      const testlet = selection.testlet;
      const simulatedRows = simulateTestletResponses(testlet, thetaTrue, profile, order, rng);
      const behavior = simulateBehaviorEvents(profile, rng);
      const responseTimeMs = Math.max(
        7000,
        Math.round(sampleNormal(rng, profile.baseTimeMs, profile.timeJitterMs)) + behavior.delayMs
      );

      simulatedRows.forEach(function (row) {
        responses.push({
          itemId: row.itemId,
          correct: row.correct,
          testletId: testlet.testletId,
          level: testlet.level,
          positionInForm: testlet.positionInForm,
          testletVariance: testlet.testletVariance
        });
        if (row.correct) {
          rawCorrect += 1;
        }
      });

      behavior.eventLog.forEach(function (event) {
        eventLog.push({
          type: event.type,
          order: order
        });
      });

      administeredTestletIds.push(testlet.testletId);
      bandPath.push(testlet.level);
      totalElapsedMs += responseTimeMs;
      estimate = buildOperationalEstimate(responses);

      stopReason = shouldStop(administeredTestletIds.length, estimate);
      if (stopReason) {
        break;
      }

      const pseudoSession = state.session;
      state.session = { responses: responses };
      try {
        selection = getNextTestletSelection(estimate.theta, administeredTestletIds);
      } finally {
        state.session = pseudoSession;
      }
      if (!selection) {
        stopReason = "利用可能なセットがなくなりました。";
      }
    }

    if (CONFIG.exposureControlEnabled) {
      updateExposureCounts(administeredTestletIds);
    }

    const interruptionEvents = eventLog.filter(function (event) {
      return INTERRUPTION_EVENT_TYPES.indexOf(event.type) >= 0;
    }).length;
    const uniqueBands = new Set(bandPath);
    const thetaError = estimate.theta - thetaTrue;

    return {
      profileId: profile.id,
      profileLabel: profile.label,
      thetaTrue: Number(thetaTrue.toFixed(3)),
      thetaEstimated: estimate.theta,
      linkedRaschTheta: estimate.linkedRaschTheta,
      se: estimate.se,
      thetaError: Number(thetaError.toFixed(5)),
      thetaSquaredError: Number((thetaError * thetaError).toFixed(6)),
      rawCorrect: rawCorrect,
      administeredTestlets: administeredTestletIds.length,
      administeredItems: responses.length,
      administeredTestletIdList: administeredTestletIds.slice(),
      bandPath: bandPath.slice(),
      elapsedMs: totalElapsedMs,
      interruptionEvents: interruptionEvents,
      browserBackAttempts: eventLog.filter(function (event) { return event.type === "browser_back_attempt"; }).length,
      unloadPrompts: eventLog.filter(function (event) { return event.type === "beforeunload_prompt"; }).length,
      restoreEvents: eventLog.filter(function (event) { return event.type === "session_restored"; }).length,
      uniqueBands: uniqueBands.size,
      stopReason: stopReason
    };
  }

  function summarizeSimulationProfile(profile, rows) {
    const thetaTrues = rows.map(function (row) { return row.thetaTrue; });
    const thetaEstimated = rows.map(function (row) { return row.thetaEstimated; });
    const testletCounts = rows.map(function (row) { return row.administeredTestlets; });

    return {
      profileId: profile.id,
      profileLabel: profile.label,
      sampleSize: rows.length,
      avgTestlets: Number(mean(testletCounts).toFixed(2)),
      minTestlets: Math.min.apply(null, testletCounts),
      maxTestlets: Math.max.apply(null, testletCounts),
      medianTestlets: computeMedian(testletCounts),
      testLengthDistribution: computeQuantiles(testletCounts),
      avgItems: Number(mean(rows.map(function (row) { return row.administeredItems; })).toFixed(2)),
      avgSE: Number(mean(rows.map(function (row) { return row.se; })).toFixed(3)),
      avgThetaBias: Number(mean(rows.map(function (row) { return row.thetaError; })).toFixed(3)),
      avgAbsThetaError: Number(mean(rows.map(function (row) { return Math.abs(row.thetaError); })).toFixed(3)),
      rmse: Number(Math.sqrt(mean(rows.map(function (row) { return row.thetaSquaredError; }))).toFixed(4)),
      correlation: computeCorrelation(thetaTrues, thetaEstimated),
      pctReachingTarget: Number((rows.filter(function (row) { return row.se <= CONFIG.targetSE; }).length / rows.length * 100).toFixed(1)),
      avgElapsedMinutes: Number((mean(rows.map(function (row) { return row.elapsedMs; })) / 60000).toFixed(2)),
      avgInterruptions: Number(mean(rows.map(function (row) { return row.interruptionEvents; })).toFixed(2)),
      avgBackAttempts: Number(mean(rows.map(function (row) { return row.browserBackAttempts; })).toFixed(2)),
      avgRestoreEvents: Number(mean(rows.map(function (row) { return row.restoreEvents; })).toFixed(2)),
      avgBandsVisited: Number(mean(rows.map(function (row) { return row.uniqueBands; })).toFixed(2)),
      exposureDistribution: computeExposureDistribution(rows),
      bandUsageDistribution: computeBandUsageDistribution(rows),
      conditionalMetrics: computeConditionalMetrics(rows)
    };
  }

  function runSimulationSuite(sampleSize, seed) {
    const cases = Math.max(10, Number(sampleSize) || 200);
    const rng = createSeededRandom(seed || 20260326);

    if (CONFIG.exposureControlEnabled) {
      resetExposureTracker();
    }

    return SIMULATION_PROFILES.map(function (profile) {
      const rows = [];
      for (let index = 0; index < cases; index += 1) {
        rows.push(simulateSingleSession(profile, rng));
      }

      return summarizeSimulationProfile(profile, rows);
    });
  }

  function withTemporaryConfig(overrides, task) {
    const originalValues = {};
    Object.keys(overrides || {}).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(CONFIG, key)) {
        originalValues[key] = CONFIG[key];
        CONFIG[key] = overrides[key];
      }
    });
    clearConfigDependentCaches();

    try {
      return task();
    } finally {
      Object.keys(originalValues).forEach(function (key) {
        CONFIG[key] = originalValues[key];
      });
      clearConfigDependentCaches();
    }
  }

  function runSimulationSuiteWithConfig(overrides, sampleSize, seed) {
    return withTemporaryConfig(overrides || {}, function () {
      return runSimulationSuite(sampleSize, seed);
    });
  }

  function runExtendedSimulationSuite(sampleSize, seed, options) {
    const cases = Math.max(10, Number(sampleSize) || 500);
    const rng = createSeededRandom(seed || 20260326);
    const profiles = (options && options.profileSet === "extended")
      ? EXTENDED_SIMULATION_PROFILES
      : SIMULATION_PROFILES;

    if (CONFIG.exposureControlEnabled) {
      resetExposureTracker();
    }

    return profiles.map(function (profile) {
      const rows = [];
      for (let i = 0; i < cases; i++) {
        rows.push(simulateSingleSession(profile, rng));
      }
      return summarizeSimulationProfile(profile, rows);
    });
  }

  function runStoppingThresholdSweep(sweepConfig, sampleSize, seed) {
    const cfg = sweepConfig || {};
    const targetSEValues = cfg.targetSE || [0.40, 0.45, 0.50, 0.52, 0.55, 0.60];
    const minValues = cfg.minTestlets || [4, 5, 6, 7, 8];
    const maxValues = cfg.maxTestlets || [8, 10, 12, 14];
    const results = [];

    targetSEValues.forEach(function (se) {
      minValues.forEach(function (mn) {
        maxValues.forEach(function (mx) {
          if (mn > mx) { return; }
          const overrides = { targetSE: se, minTestlets: mn, maxTestlets: mx };
          if (cfg.exposureControlEnabled !== undefined) {
            overrides.exposureControlEnabled = cfg.exposureControlEnabled;
            if (cfg.maxExposureRate !== undefined) {
              overrides.maxExposureRate = cfg.maxExposureRate;
            }
          }
          results.push({
            condition: { targetSE: se, minTestlets: mn, maxTestlets: mx },
            profiles: withTemporaryConfig(overrides, function () {
              return runSimulationSuite(sampleSize, seed);
            })
          });
        });
      });
    });

    return results;
  }

  function handleTestSubmit(event) {
    event.preventDefault();

    const currentTestlet = getCurrentTestlet();
    if (!currentTestlet) {
      return;
    }

    let submitted;

    try {
      submitted = collectSelections(elements.testForm, currentTestlet, "test");
    } catch (error) {
      setStatus(error.message);
      return;
    }

    setStatus("");

    const thetaBefore = getCurrentEstimate().theta;
    const timing = completePrompt("test", currentTestlet.testletId);
    const selectionRecord = getCurrentSelectionRecord();

    const responseRows = submitted.map(function (result) {
      return {
        sessionId: state.session.sessionId,
        studentId: state.session.participant.studentId,
        participantName: state.session.participant.participantName,
        bankId: state.session.bankId,
        testletId: currentTestlet.testletId,
        level: currentTestlet.level,
        positionInForm: currentTestlet.positionInForm,
        testletVariance: currentTestlet.testletVariance,
        itemId: result.definition.itemId,
        prompt: result.definition.prompt,
        response: result.selectedOption,
        correctOption: result.definition.correctOption,
        correct: result.correct,
        rawDifficulty: result.definition.rawDifficulty,
        linkedDifficulty: result.definition.linkedDifficulty,
        difficulty: result.definition.difficulty,
        thetaBefore: thetaBefore,
        thetaAfter: null,
        seAfter: null,
        thetaAfterLinkedRasch: null,
        seAfterLinkedRasch: null,
        testletPresentedAt: timing.presentedAt,
        responseSubmittedAt: timing.submittedAt,
        testletElapsedMs: timing.elapsedMs,
        timestamp: timing.submittedAt
      };
    });

    state.session.responses = state.session.responses.concat(responseRows);
    const correctCount = responseRows.filter(function (row) {
      return row.correct;
    }).length;
    state.session.rawCorrect += correctCount;
    state.session.administeredTestletIds.push(currentTestlet.testletId);

    if (selectionRecord) {
      selectionRecord.submittedAt = timing.submittedAt;
      selectionRecord.elapsedMs = timing.elapsedMs;
      selectionRecord.correctCount = correctCount;
    }

    const estimate = buildOperationalEstimate(state.session.responses);

    responseRows.forEach(function (row) {
      row.thetaAfter = estimate.theta;
      row.seAfter = estimate.se;
      row.thetaAfterLinkedRasch = estimate.linkedRaschTheta;
      row.seAfterLinkedRasch = estimate.linkedRaschSE;
    });

    state.session.estimates.push({
      step: state.session.administeredTestletIds.length,
      afterTestletId: currentTestlet.testletId,
      theta: estimate.theta,
      se: estimate.se,
      map: estimate.map,
      scoringModel: estimate.scoringModel,
      linkedRaschTheta: estimate.linkedRaschTheta,
      linkedRaschSE: estimate.linkedRaschSE,
      linkedRaschMap: estimate.linkedRaschMap,
      testletAwareTheta: estimate.testletAwareTheta,
      testletAwareSE: estimate.testletAwareSE,
      testletAwareMap: estimate.testletAwareMap,
      timestamp: nowIso()
    });

    clearDraftSelections("test");
    state.session.currentTestletId = null;

    const stopReason = shouldStop(state.session.administeredTestletIds.length, estimate);
    if (stopReason) {
      finishSession(stopReason);
      return;
    }

    queueNextOperationalTestlet();
  }

  function finishSession(stopReason) {
    state.session.stopReason = stopReason;
    state.session.currentTestletId = null;
    state.session.currentPrompt = null;
    logSessionEvent("cat_section_completed", stopReason);

    // LJT integration (spec v0.5 §2, §13.2):
    // If the feature flag is on and no LJT data exists yet for this session,
    // enter the LJT phase. The LJT module will call window.UVLT_CAT_AFTER_LJT
    // (installed below) when it finishes, which re-enters finishSession().
    const ljtModule = window.UVLT_LJT;
    const ljtShouldStart =
      CONFIG.ENABLE_LJT_PHASE === true &&
      ljtModule && typeof ljtModule.isEnabled === "function" && ljtModule.isEnabled() &&
      (!state.session.ljt || !ljtModule.isSessionComplete(state.session));

    if (ljtShouldStart) {
      state.session.phase = "ljt";
      state.phase = "ljt";
      logSessionEvent("ljt_phase_started", "LJT section entered after CAT completion.");
      persistState();
      // Install a one-shot hook for the LJT module to call on completion.
      window.UVLT_CAT_AFTER_LJT = function () {
        // Persist whatever LJT data the module wrote to state.session.ljt
        persistState();
        completeSessionAndShowResult(stopReason);
      };
      // R3: Let the LJT module trigger persistence whenever it updates
      // session.ljt (e.g. mid-trial, after each completed trial). Without
      // this hook, a page reload between auto-saves would lose trial history
      // and prevent resume-from-current-trial from working.
      window.UVLT_CAT_PERSIST_HOOK = function () {
        try { persistState(); } catch (e) { /* ignore */ }
      };
      try {
        ljtModule.startPhase(state.session);
      } catch (e) {
        console.error("[UVLT] LJT startPhase failed, falling back to CAT-only result:", e);
        completeSessionAndShowResult(stopReason);
      }
      return;
    }

    completeSessionAndShowResult(stopReason);
  }

  function completeSessionAndShowResult(stopReason) {
    state.session.completedAt = nowIso();
    state.session.phase = "result";
    logSessionEvent("session_completed", stopReason || state.session.stopReason || "");
    renderResults();
    persistState();
    setScreen("result");
    autoDownloadExcel();
  }

  function renderResults() {
    const estimate = getCurrentEstimate();
    const vocabulary = computeVocabularyEstimate(estimate.theta, estimate.se);
    const sessionElapsedMs = getSessionElapsedMs(state.session);
    const scoreQuality = getScoreQuality(estimate, state.session);
    const bandExtremes = getBandExtremes(vocabulary);

    elements.resultRange.textContent = vocabulary.lowerWords + "–" + vocabulary.upperWords + "語";
    elements.resultStrongBand.textContent = formatBandWithDescription(bandExtremes.strongestBand.band);
    elements.resultGrowthBand.textContent = formatBandWithDescription(bandExtremes.weakestBand.band);
    elements.resultLength.textContent = state.session.administeredTestletIds.length + "セット / " + state.session.responses.length + "問";
    elements.resultDuration.textContent = formatElapsedMs(sessionElapsedMs);
    elements.resultVocabSize.textContent = vocabulary.estimatedWords + "語";
    elements.resultScoreQuality.textContent = scoreQuality.label;
    elements.resultStopReason.textContent = formatParticipantStopReason(state.session.stopReason);
    renderVocabularyRangeVisual(vocabulary);
    renderFeedbackItems(estimate, vocabulary, sessionElapsedMs);
    if (isResearcherMode()) {
      renderBandDiagnostics(vocabulary.bandDiagnostics);
      renderTimelineVisual();
      renderLjtTwoAxisProfile(estimate);   // R4: spec §9.4
      renderLjtBandSubindices();           // R4: spec §9.4 (sub-indices)
    } else {
      elements.bandDiagnostics.innerHTML = "";
      elements.timelineVisual.innerHTML = "";
    }
    renderExportStatus();
  }

  // ------------------------------------------------------------------
  // R4 / spec §9.4: CAT θ (linked) × LJT d'_primary 2-axis profile.
  //   Gracefully hides itself when LJT data is unavailable. Uses inline
  //   SVG to stay consistent with the app's no-external-deps policy.
  // ------------------------------------------------------------------
  function renderLjtTwoAxisProfile(estimate) {
    const section = document.getElementById("ljt-two-axis-section");
    const host = document.getElementById("ljt-two-axis-plot");
    const metaEl = document.getElementById("ljt-two-axis-meta");
    if (!section || !host) return;
    section.classList.add("hidden");
    host.innerHTML = "";
    if (metaEl) metaEl.textContent = "";

    const ljt = state.session && state.session.ljt;
    if (!ljt || !ljt.completed || !Array.isArray(ljt.mainTrials) || ljt.mainTrials.length === 0) {
      return;
    }

    const summary = computeLjtSummarySafe(ljt.mainTrials);
    if (!summary || summary.d_primary == null || !isFinite(summary.d_primary)) {
      return;
    }
    const xTheta = (estimate && typeof estimate.linkedRaschTheta === "number"
                    && isFinite(estimate.linkedRaschTheta))
      ? estimate.linkedRaschTheta
      : (estimate && isFinite(estimate.theta) ? estimate.theta : 0);
    const yDprime = summary.d_primary;

    // Clamp to plot domains so extreme participants still land on the canvas.
    const X_MIN = -4, X_MAX = 4;   // linked θ range spans roughly (-3, +3)
    const Y_MIN = -2, Y_MAX = 5;   // d' theoretical is (-∞, +∞) but typical [-1, 4]
    const W = 480, H = 320;
    const PAD_L = 52, PAD_R = 16, PAD_T = 20, PAD_B = 44;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const toX = function (v) {
      const t = (Math.max(X_MIN, Math.min(X_MAX, v)) - X_MIN) / (X_MAX - X_MIN);
      return PAD_L + t * innerW;
    };
    const toY = function (v) {
      const t = (Math.max(Y_MIN, Math.min(Y_MAX, v)) - Y_MIN) / (Y_MAX - Y_MIN);
      return PAD_T + (1 - t) * innerH;
    };
    const xZero = toX(0);
    const yZero = toY(0);

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" })[c];
      });
    }

    const parts = [];
    parts.push(
      "<svg viewBox=\"0 0 " + W + " " + H + "\" width=\"100%\" height=\"" + H +
      "\" preserveAspectRatio=\"xMidYMid meet\" role=\"img\" aria-label=\"" +
      "CAT θ (linked) × LJT d-prime 2 軸プロファイル\">");
    // Axes background + quadrant tints
    const tintHi = "#eaf4ea";  // high-both
    const tintMix = "#f6efe4"; // mismatches
    const tintLo = "#fbecec";  // low-both
    // Quadrants: (x<0, y>0): low-recog-high-depth; (x>0, y>0): high-both;
    //            (x<0, y<0): low-both; (x>0, y<0): high-recog-low-depth
    parts.push("<rect x=\"" + PAD_L + "\" y=\"" + PAD_T + "\" width=\"" +
      (xZero - PAD_L) + "\" height=\"" + (yZero - PAD_T) +
      "\" fill=\"" + tintMix + "\"/>");
    parts.push("<rect x=\"" + xZero + "\" y=\"" + PAD_T + "\" width=\"" +
      (PAD_L + innerW - xZero) + "\" height=\"" + (yZero - PAD_T) +
      "\" fill=\"" + tintHi + "\"/>");
    parts.push("<rect x=\"" + PAD_L + "\" y=\"" + yZero + "\" width=\"" +
      (xZero - PAD_L) + "\" height=\"" + (PAD_T + innerH - yZero) +
      "\" fill=\"" + tintLo + "\"/>");
    parts.push("<rect x=\"" + xZero + "\" y=\"" + yZero + "\" width=\"" +
      (PAD_L + innerW - xZero) + "\" height=\"" + (PAD_T + innerH - yZero) +
      "\" fill=\"" + tintMix + "\"/>");

    // Grid (ticks every 1 unit)
    for (let gv = X_MIN; gv <= X_MAX; gv += 1) {
      const gx = toX(gv);
      parts.push("<line x1=\"" + gx + "\" y1=\"" + PAD_T + "\" x2=\"" + gx +
        "\" y2=\"" + (PAD_T + innerH) + "\" stroke=\"#d7e0ec\" stroke-width=\"0.5\"/>");
      parts.push("<text x=\"" + gx + "\" y=\"" + (PAD_T + innerH + 16) +
        "\" font-size=\"10\" text-anchor=\"middle\" fill=\"#4d6074\">" + gv + "</text>");
    }
    for (let gv = Y_MIN; gv <= Y_MAX; gv += 1) {
      const gy = toY(gv);
      parts.push("<line x1=\"" + PAD_L + "\" y1=\"" + gy + "\" x2=\"" + (PAD_L + innerW) +
        "\" y2=\"" + gy + "\" stroke=\"#d7e0ec\" stroke-width=\"0.5\"/>");
      parts.push("<text x=\"" + (PAD_L - 6) + "\" y=\"" + (gy + 3) +
        "\" font-size=\"10\" text-anchor=\"end\" fill=\"#4d6074\">" + gv + "</text>");
    }
    // Zero axes (bold)
    parts.push("<line x1=\"" + xZero + "\" y1=\"" + PAD_T + "\" x2=\"" + xZero +
      "\" y2=\"" + (PAD_T + innerH) + "\" stroke=\"#17324d\" stroke-width=\"1.2\"/>");
    parts.push("<line x1=\"" + PAD_L + "\" y1=\"" + yZero + "\" x2=\"" + (PAD_L + innerW) +
      "\" y2=\"" + yZero + "\" stroke=\"#17324d\" stroke-width=\"1.2\"/>");

    // Quadrant labels (bottom-right corner of each)
    const labelStyle = "font-size=\"10\" fill=\"#4d6074\" font-weight=\"700\"";
    parts.push("<text x=\"" + (xZero + 8) + "\" y=\"" + (PAD_T + 14) +
      "\" " + labelStyle + ">high-both</text>");
    parts.push("<text x=\"" + (xZero - 8) + "\" y=\"" + (PAD_T + 14) +
      "\" text-anchor=\"end\" " + labelStyle + ">low-recog / high-depth</text>");
    parts.push("<text x=\"" + (xZero - 8) + "\" y=\"" + (PAD_T + innerH - 4) +
      "\" text-anchor=\"end\" " + labelStyle + ">low-both</text>");
    parts.push("<text x=\"" + (xZero + 8) + "\" y=\"" + (PAD_T + innerH - 4) +
      "\" " + labelStyle + ">high-recog / low-depth</text>");

    // Axis titles
    parts.push("<text x=\"" + (PAD_L + innerW / 2) + "\" y=\"" + (H - 6) +
      "\" font-size=\"11\" text-anchor=\"middle\" fill=\"#17324d\" font-weight=\"700\">" +
      "CAT θ (linked Rasch)</text>");
    parts.push("<text x=\"14\" y=\"" + (PAD_T + innerH / 2) +
      "\" font-size=\"11\" text-anchor=\"middle\" fill=\"#17324d\" font-weight=\"700\" " +
      "transform=\"rotate(-90 14 " + (PAD_T + innerH / 2) + ")\">LJT d'</text>");

    // Participant marker
    const px = toX(xTheta);
    const py = toY(yDprime);
    parts.push("<circle cx=\"" + px + "\" cy=\"" + py + "\" r=\"8\" fill=\"#2459a6\" " +
      "stroke=\"#17324d\" stroke-width=\"1.5\"/>");
    parts.push("<text x=\"" + (px + 12) + "\" y=\"" + (py + 4) +
      "\" font-size=\"11\" fill=\"#17324d\" font-weight=\"700\">" +
      esc("θ=" + xTheta.toFixed(2) + ", d'=" + yDprime.toFixed(2)) + "</text>");

    parts.push("</svg>");
    host.innerHTML = parts.join("");

    // Quadrant membership notice under the plot
    let quadrantLabel;
    if (xTheta >= 0 && yDprime >= 0) quadrantLabel = "high-both";
    else if (xTheta < 0 && yDprime >= 0) quadrantLabel = "low-recog / high-depth";
    else if (xTheta < 0 && yDprime < 0) quadrantLabel = "low-both";
    else quadrantLabel = "high-recog / low-depth";
    if (metaEl) {
      metaEl.textContent = "現在の位置: " + quadrantLabel + " 象限 (θ=" +
        xTheta.toFixed(2) + ", d'=" + yDprime.toFixed(2) +
        ", H=" + (summary.H == null ? "—" : summary.H.toFixed(2)) +
        ", F=" + (summary.F == null ? "—" : summary.F.toFixed(2)) + ")";
    }
    section.classList.remove("hidden");
  }

  // R4 / spec §9.4: Per-band LJT sub-indices (d'_primary, accuracy, mean RT on
  //   correct-app trials), computed on the subset of LJT trials whose target
  //   word maps to each CAT band (1K-5K). Hidden if LJT absent or only CAT
  //   bands with zero items; rendered as an HTML table.
  function renderLjtBandSubindices() {
    const section = document.getElementById("ljt-band-subindices-section");
    const host = document.getElementById("ljt-band-subindices");
    if (!section || !host) return;
    section.classList.add("hidden");
    host.innerHTML = "";

    const ljt = state.session && state.session.ljt;
    if (!ljt || !ljt.completed || !Array.isArray(ljt.mainTrials) || ljt.mainTrials.length === 0) {
      return;
    }

    const bands = BAND_ORDER.slice();  // ["1k", "2k", "3k", "4k", "5k"]
    const bandTrials = {};
    bands.forEach(function (b) { bandTrials[b] = []; });
    ljt.mainTrials.forEach(function (t) {
      const lvl = (t.target_level || "").toLowerCase();
      if (bandTrials[lvl]) bandTrials[lvl].push(t);
    });

    const rows = bands.map(function (b) {
      const trials = bandTrials[b];
      const s = trials.length > 0 ? computeLjtSummarySafe(trials) : null;
      return {
        band: b.toUpperCase(),
        description: BAND_DESCRIPTIONS[b] || "",
        n: trials.length,
        d_primary: (s && s.d_primary != null) ? s.d_primary : null,
        accuracy: (s && s.raw_accuracy != null) ? s.raw_accuracy : null,
        mean_rt: (s && s.mean_rt_app_correct != null) ? s.mean_rt_app_correct : null
      };
    });
    if (rows.every(function (r) { return r.n === 0; })) return;

    function fmtNum(v, digits) {
      return v == null || !isFinite(v) ? "—" : Number(v).toFixed(digits);
    }
    function fmtPct(v) {
      return v == null || !isFinite(v) ? "—" : (v * 100).toFixed(1) + "%";
    }
    function fmtMs(v) {
      return v == null || !isFinite(v) ? "—" : Math.round(v) + " ms";
    }

    const tableHtml =
      "<div class=\"table-scroll\"><table class=\"testlet-table\">" +
        "<thead><tr>" +
          "<th>帯域</th>" +
          "<th>試行数</th>" +
          "<th>d′</th>" +
          "<th>正答率</th>" +
          "<th>平均 RT (正答, 自然文)</th>" +
        "</tr></thead>" +
        "<tbody>" +
        rows.map(function (r) {
          return "<tr>" +
            "<td><strong>" + r.band + "</strong>" +
            (r.description ? " <span class=\"fine-print\">(" + r.description + ")</span>" : "") +
            "</td>" +
            "<td>" + r.n + "</td>" +
            "<td>" + fmtNum(r.d_primary, 2) + "</td>" +
            "<td>" + fmtPct(r.accuracy) + "</td>" +
            "<td>" + fmtMs(r.mean_rt) + "</td>" +
          "</tr>";
        }).join("") +
        "</tbody>" +
      "</table></div>";

    host.innerHTML = tableHtml;
    section.classList.remove("hidden");
  }

  // Shared helper: reach into the LJT module's internal scorer without adding
  // a new public method. If the module failed to load, return null gracefully.
  function computeLjtSummarySafe(trials) {
    try {
      if (window.UVLT_LJT && window.UVLT_LJT._internal &&
          window.UVLT_LJT._internal.LJTScorer) {
        return window.UVLT_LJT._internal.LJTScorer.computeSummary(trials);
      }
    } catch (e) {
      console.error("[UVLT] LJT scorer call failed:", e);
    }
    return null;
  }

  function renderExportStatus() {
    if (!elements.exportStatus) {
      return;
    }

    if (!state.session) {
      elements.exportStatus.innerHTML = "";
      return;
    }

    const exportsState = normalizeExportsState(state.session.exports);
    const rows = [
      {
        title: "Excel",
        value: exportsState.lastExcelFilename || "まだ保存されていません",
        note: exportsState.lastExcelDownloadedAt
          ? "保存時刻: " + formatTimestampLabel(exportsState.lastExcelDownloadedAt)
          : "終了時に詳細データを自動保存します。"
      },
      {
        title: "JSON",
        value: exportsState.lastJsonFilename || "必要な場合のみ保存してください",
        note: exportsState.lastJsonDownloadedAt
          ? "保存時刻: " + formatTimestampLabel(exportsState.lastJsonDownloadedAt)
          : "必要な場合に保存してください。"
      },
      {
        title: "この端末の一時保存",
        value: state.storageUnavailable
          ? "利用不可"
          : (state.storageCleared ? "削除済み" : "保存中"),
        note: state.storageUnavailable
          ? "このブラウザの設定では途中保存を利用できません。再読み込みすると未送信の解答は失われます。"
          : state.storageCleared
          ? "ページを再読み込みしても途中状態は復元されません。"
          : CONFIG.storageTTLHours + "時間を過ぎると自動で削除されます。"
      }
    ];

    elements.exportStatus.innerHTML = rows.map(function (row) {
      return (
        "<div class=\"export-item\">" +
          "<strong>" + row.title + "</strong>" +
          "<div>" + row.value + "</div>" +
          "<div class=\"fine-print\">" + row.note + "</div>" +
        "</div>"
      );
    }).join("");
  }
  function downloadBlob(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadJson() {
    if (!state.session) {
      return;
    }
    const filename = buildExportBaseName() + ".json";
    downloadBlob(filename, "application/json", JSON.stringify(state.session, null, 2));
    state.session.exports.lastJsonFilename = filename;
    state.session.exports.lastJsonDownloadedAt = nowIso();
    state.storageCleared = false;
    persistState();
    renderExportStatus();
    setStatus(isResearcherMode() ? filename + " を保存しました。" : "JSON の保存が完了しました。");
  }

  function createSummaryRows() {
    const estimate = getCurrentEstimate();
    const sessionElapsedMs = getSessionElapsedMs(state.session);
    const vocabulary = computeVocabularyEstimate(estimate.theta, estimate.se);
    const eventCounts = getEventCounts(state.session);
    const scoreQuality = getScoreQuality(estimate, state.session);
    const bandVisitSummary = getBandVisitSummary(state.session);

    return [
      {
        sessionId: state.session.sessionId,
        bankId: state.session.bankId,
        bankTitle: state.session.bankTitle,
        studentId: state.session.participant.studentId,
        participantName: state.session.participant.participantName,
        affiliation: state.session.participant.affiliation,
        exportBaseName: buildExportBaseName(),
        operationalMode: CONFIG.operationalModeLabel,
        scoringModel: "Testlet-aware marginal EAP approximation on linked multi-band scale",
        selectionMetric: getSelectionMetricLabel(),
        storageTTLHours: CONFIG.storageTTLHours,
        linkingVersion: CROSS_BAND_LINKING.version,
        linkingMethod: CROSS_BAND_LINKING.method,
        linkingScale: CROSS_BAND_LINKING.scale,
        linkingSampleSize: CROSS_BAND_LINKING.calibrationSampleSize,
        linkingSource: CROSS_BAND_LINKING.source,
        level: "multi-band",
        startedAt: state.session.startedAt,
        completedAt: state.session.completedAt || "",
        sessionElapsedMs: sessionElapsedMs,
        sessionElapsedLabel: formatElapsedMs(sessionElapsedMs),
        administeredTestlets: state.session.administeredTestletIds.length,
        administeredItems: state.session.responses.length,
        plannedTestlets: CONFIG.maxTestlets,
        plannedItems: CONFIG.maxTestlets * 3,
        targetSE: CONFIG.targetSE,
        quadraturePoints: CONFIG.quadraturePoints,
        selectionThetaStep: CONFIG.selectionThetaStep,
        rawCorrect: state.session.rawCorrect,
        theta: estimate.theta,
        se: estimate.se,
        map: estimate.map,
        linkedRaschTheta: estimate.linkedRaschTheta,
        linkedRaschSE: estimate.linkedRaschSE,
        scoreQuality: scoreQuality.label,
        scoreQualityNote: scoreQuality.note,
        visitedBands: bandVisitSummary.filter(function (row) { return row.administeredTestlets > 0; }).map(function (row) { return row.band.toUpperCase(); }).join(", "),
        estimatedVocabularySize: vocabulary.estimatedWords,
        lowerVocabularySize: vocabulary.lowerWords,
        upperVocabularySize: vocabulary.upperWords,
        lastExcelFilename: state.session.exports.lastExcelFilename || "",
        lastJsonFilename: state.session.exports.lastJsonFilename || "",
        interruptionEvents: eventCounts.interruptionEvents,
        browserBackAttempts: eventCounts.browserBackAttempts,
        unloadPrompts: eventCounts.unloadPrompts,
        pageHiddenEvents: eventCounts.pageHiddenEvents,
        restoreEvents: eventCounts.restoreEvents,
        stopReason: state.session.stopReason || ""
      }
    ];
  }

  function createPracticeRows() {
    return state.session.practiceResponses.reduce(function (rows, practiceAttempt) {
      return rows.concat(practiceAttempt.responses.map(function (response, index) {
        return {
          sessionId: state.session.sessionId,
          studentId: state.session.participant.studentId,
          participantName: state.session.participant.participantName,
          practiceId: practiceAttempt.practiceId,
          title: practiceAttempt.title,
          itemOrder: index + 1,
          prompt: response.prompt,
          selectedOption: response.selectedOption,
          correctOption: response.correctOption,
          correct: response.correct,
          presentedAt: practiceAttempt.presentedAt || "",
          submittedAt: practiceAttempt.submittedAt || "",
          elapsedMs: practiceAttempt.elapsedMs == null ? "" : practiceAttempt.elapsedMs
        };
      }));
    }, []);
  }

  function createSessionEventRows() {
    return (state.session.eventLog || []).map(function (event, index) {
      return {
        order: index + 1,
        sessionId: state.session.sessionId,
        studentId: state.session.participant.studentId,
        participantName: state.session.participant.participantName,
        timestamp: event.timestamp,
        phase: event.phase,
        type: event.type,
        details: event.details
      };
    });
  }

  function createRoutingSummaryRows() {
    return getBandVisitSummary(state.session).map(function (row) {
      return {
        sessionId: state.session.sessionId,
        studentId: state.session.participant.studentId,
        participantName: state.session.participant.participantName,
        band: row.band,
        administeredTestlets: row.administeredTestlets,
        administeredItems: row.administeredItems,
        correctItems: row.correctItems,
        observedAccuracy: row.observedAccuracy
      };
    });
  }

  function createLinkingRows() {
    return BAND_ORDER.map(function (band) {
      const coefficient = CROSS_BAND_LINKING.coefficients[band];
      return {
        linkingVersion: CROSS_BAND_LINKING.version,
        linkingMethod: CROSS_BAND_LINKING.method,
        scale: CROSS_BAND_LINKING.scale,
        calibrationSampleSize: CROSS_BAND_LINKING.calibrationSampleSize,
        source: CROSS_BAND_LINKING.source,
        band: band,
        slope: coefficient.slope,
        intercept: coefficient.intercept,
        correlation: coefficient.correlation,
        rmse: coefficient.rmse
      };
    });
  }

  function createTestletVarianceRows() {
    const rows = [];

    BAND_ORDER.forEach(function (band) {
      TESTLET_VARIANCES[band].forEach(function (variance, index) {
        rows.push({
          linkingVersion: CROSS_BAND_LINKING.version,
          band: band,
          positionInForm: index + 1,
          rawVariance: RAW_TESTLET_VARIANCES[band][index],
          linkedVariance: variance,
          linkSlope: CROSS_BAND_LINKING.coefficients[band].slope
        });
      });
    });

    return rows;
  }

  function createSheet(workbook, name, rows) {
    const safeRows = rows.length ? rows : [{ note: "no data" }];
    const worksheet = XLSX.utils.json_to_sheet(safeRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }

  function buildExcelWorkbook() {
    if (typeof XLSX === "undefined" || !XLSX.utils || !(XLSX.writeFileXLSX || XLSX.writeFile)) {
      throw new Error("Excel 出力ライブラリの読み込みに失敗しました。");
    }

    const workbook = XLSX.utils.book_new();
    createSheet(workbook, "summary", createSummaryRows());
    createSheet(workbook, "band_diagnostics", computeVocabularyEstimate(getCurrentEstimate().theta, getCurrentEstimate().se).bandDiagnostics);
    createSheet(workbook, "testlet_log", state.session.selectedTestlets);
    createSheet(workbook, "item_responses", state.session.responses);
    createSheet(workbook, "practice", createPracticeRows());
    createSheet(workbook, "estimates", state.session.estimates);
    createSheet(workbook, "session_events", createSessionEventRows());
    createSheet(workbook, "routing_summary", createRoutingSummaryRows());
    createSheet(workbook, "linking_coeffs", createLinkingRows());
    createSheet(workbook, "testlet_variance", createTestletVarianceRows());

    // LJT sheets (spec v0.5 §9.1-9.3). Added only when the module is loaded
    // and has data for this session. Empty/partial LJT sessions still produce
    // valid sheets via the module's buildExcelSheets.
    if (window.UVLT_LJT && typeof window.UVLT_LJT.buildExcelSheets === "function"
        && state.session && state.session.ljt) {
      try {
        const ljtSheets = window.UVLT_LJT.buildExcelSheets(state.session);
        if (ljtSheets && typeof ljtSheets === "object") {
          createSheet(workbook, "ljt_log", ljtSheets.ljt_log || []);
          createSheet(workbook, "ljt_summary", ljtSheets.ljt_summary || []);
          createSheet(workbook, "ljt_session_meta", ljtSheets.ljt_session_meta || []);
        }
      } catch (e) {
        console.error("[UVLT] buildExcelSheets (LJT) failed:", e);
      }
    }
    return workbook;
  }

  function triggerExcelDownload() {
    if (!state.session) {
      return "";
    }

    const workbook = buildExcelWorkbook();
    const filename = buildExportBaseName() + ".xlsx";

    if (typeof XLSX.writeFileXLSX === "function") {
      XLSX.writeFileXLSX(workbook, filename);
      return filename;
    }

    XLSX.writeFile(workbook, filename);
    return filename;
  }

  function downloadExcel() {
    try {
      const filename = triggerExcelDownload();
      state.session.exports.lastExcelFilename = filename;
      state.session.exports.lastExcelDownloadedAt = nowIso();
      state.storageCleared = false;
      persistState();
      renderExportStatus();
      setStatus(isResearcherMode() ? filename + " を保存しました。" : "結果ファイルの保存が完了しました。");
    } catch (error) {
      setStatus(isResearcherMode()
        ? "Excel の保存に失敗しました。"
        : "結果の保存に失敗しました。研究担当者に知らせてください。");
    }
  }

  function autoDownloadExcel() {
    if (!state.session || !state.session.completedAt) {
      return;
    }

    if (state.session.exports && state.session.exports.excelAutoDownloadedAt) {
      return;
    }

    try {
      const filename = triggerExcelDownload();
      state.session.exports.excelAutoDownloadedAt = nowIso();
      state.session.exports.lastExcelFilename = filename;
      state.session.exports.lastExcelDownloadedAt = state.session.exports.excelAutoDownloadedAt;
      state.storageCleared = false;
      persistState();
      renderExportStatus();
      setStatus(isResearcherMode()
        ? filename + " を自動保存しました。"
        : "結果ファイルの保存が完了しました。");
    } catch (error) {
      setStatus(isResearcherMode()
        ? "Excel の自動保存に失敗しました。結果画面のボタンから再保存してください。"
        : "結果の保存に失敗しました。研究担当者に知らせてください。");
    }
  }

  function clearDeviceData() {
    if (state.storageUnavailable) {
      renderExportStatus();
      setStatus("このブラウザでは一時保存を利用していません。");
      return;
    }

    state.storageCleared = true;
    state.pendingResume = null;
    clearPersistedState();
    renderExportStatus();
    setStatus("この端末の一時保存を削除しました。必要なファイルはダウンロード済みのものを利用してください。");
  }

  function bindEvents() {
    elements.startPracticeButton.addEventListener("click", startPracticeFlow);
    elements.backToIntroButton.addEventListener("click", resetApplication);
    elements.practiceForm.addEventListener("submit", handlePracticeSubmit);
    elements.nextPracticeButton.addEventListener("click", function () {
      if (state.practiceIndex < PRACTICE_TESTLETS.length - 1) {
        clearDraftSelections("practice");
        state.practiceIndex += 1;
        persistState();
        renderPractice();
      } else {
        startOperationalPhase();
      }
    });
    elements.testForm.addEventListener("submit", handleTestSubmit);
    elements.restartButton.addEventListener("click", resetApplication);
    elements.restartFromResultButton.addEventListener("click", resetApplication);
    elements.downloadJsonButton.addEventListener("click", downloadJson);
    elements.downloadExcelButton.addEventListener("click", downloadExcel);
    elements.clearDeviceDataButton.addEventListener("click", clearDeviceData);
  }

  function bindWindowEvents() {
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  function restoreInterface() {
    if (!state.session) {
      setScreen("intro");
      return;
    }

    if (state.phase === "practice") {
      logSessionEvent("session_restored", "練習セクションを復元しました。");
      setStatus(state.storageUnavailable ? "練習画面を復元しました。" : "途中のセッションを復元しました。");
      renderPractice();
      return;
    }

    if (state.phase === "test") {
      const currentTestlet = getCurrentTestlet();
      const latestSelection = state.session.selectedTestlets[state.session.selectedTestlets.length - 1];

      if (!currentTestlet || !latestSelection) {
        queueNextOperationalTestlet();
        return;
      }

      renderOperationalTestlet({
        testlet: currentTestlet,
        informationScore: latestSelection.informationScore,
        difficultyGap: latestSelection.difficultyGap,
        reasonText: latestSelection.reasonText
      });
      logSessionEvent("session_restored", "本番セクションを復元しました。");
      setStatus(state.storageUnavailable ? "本番画面を復元しました。" : "途中のセッションを復元しました。");
      return;
    }

    if (state.phase === "result") {
      renderResults();
      setScreen("result");
      return;
    }

    if (state.phase === "ljt" && CONFIG.ENABLE_LJT_PHASE && window.UVLT_LJT) {
      // R3 / spec §10.3: "途中離脱復帰は現試行からやり直し"  — trial-level
      //   resume. The module's startPhase() now inspects session.ljt state
      //   on entry and jumps forward to the correct phase/index after the
      //   user taps the intro button (required for Safari AudioContext).
      //   The current trial (if any) is invalidated with
      //   invalidation_reason = "page_reload" and replayed.
      logSessionEvent("session_restored",
        "LJT セクションを復元しました。中断した試行からやり直します。");
      window.UVLT_CAT_AFTER_LJT = function () {
        persistState();
        completeSessionAndShowResult(state.session.stopReason);
      };
      window.UVLT_CAT_PERSIST_HOOK = function () {
        try { persistState(); } catch (e) { /* ignore */ }
      };
      try {
        window.UVLT_LJT.startPhase(state.session);
        return;
      } catch (e) {
        console.error("[UVLT] LJT restore failed:", e);
      }
    }

    setScreen("intro");
  }

  function initialize() {
    applyUIMode();
    elements.downloadExcelButton.disabled = typeof XLSX === "undefined";
    elements.downloadExcelButton.textContent = "結果ファイルを保存";
    bindEvents();
    bindWindowEvents();
    restoreState();
    restoreInterface();
    if (!state.session && !elements.statusMessage.textContent) {
      setStatus("準備完了です。練習から始めてください。");
    }
  }

  window.UVLT_CAT_DEV = {
    runSimulationSuite: runSimulationSuite,
    runSimulationSuiteWithConfig: runSimulationSuiteWithConfig,
    runExtendedSimulationSuite: runExtendedSimulationSuite,
    runStoppingThresholdSweep: runStoppingThresholdSweep,
    currentConfig: CONFIG,
    linking: CROSS_BAND_LINKING,
    resetExposureTracker: resetExposureTracker,
    exposureTracker: exposureTracker,
    simulationProfiles: SIMULATION_PROFILES.map(function (profile) {
      return { id: profile.id, label: profile.label };
    }),
    extendedProfiles: EXTENDED_SIMULATION_PROFILES.map(function (profile) {
      return { id: profile.id, label: profile.label };
    })
  };

  initialize();
})();
