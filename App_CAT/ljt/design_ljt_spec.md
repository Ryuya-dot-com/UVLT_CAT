# UVLT-LJT: 音声版 Lexicosemantic Judgement Task 設計仕様書

**版**: v0.5 (2026-04-19) — 第 4 ラウンド査読で発見された §14 UVLT 重複 3 件を修正した commit 版
**前版**: v0.4, v0.3, v0.2 (全て 2026-04-19), v0.1 (2026-04-18 初稿)
**対象**: UVLT CAT (App_CAT) の第 2 段階として実施する timed LJT
**主テンプレート**: Saito, Hosaka, Suzukida, Takizawa, & Uchihara (2026) *Second Language Research*
**補助参照**: Uchihara, Saito, Kurokawa, Takizawa, & Suzukida (2025) *Language Learning*, 75(2), 458–492

> 実装メモ (2026-04-21): 現行のブラウザ実装は pilot 運用のため、回答を untimed にし、`もう一度聞く` ボタンを有効化しています。trial ごとの再生回数、再生イベント、複数基準の RT を `ljt_log` / `ljt_summary` / `ljt_session_meta` に出力します。音声生成は `speaking_rate=0.90` に変更済みです。本文中の 1 回再生・1.6/2.0 秒 deadline 記述は旧設計として読み、必要に応じて今後 v0.6 で整理します。

---

## Changelog

### v0.4 → v0.5 (第 4 ラウンド査読反映、commit 版)

**P0 (§14 の UVLT 重複バグ修正)**:
査読 A2 が発見: v0.3/v0.4 で §14 練習項目 #1 `drink`, #2 `write`, #10 `voice` が **UVLT 1K 帯の option (distractor) リスト** に含まれていた ([script.js](../script.js) line 151, 152, 147)。§14 冒頭の「GSL top 500 の UVLT **非重複**語を使用」ルールに違反。CAT で distractor として既に目にした語を LJT 練習で見せると exposure bias が生じる。

- **#1**: `drink + paper` → **`eat + silence`** (`eat` は UVLT 非重複を grep で確認)
- **#2**: `write + mountains` → **`jump + opinions`** (`jump` は UVLT 非重複を grep で確認)
- **#10**: `voice + square` → **`smile + rectangular`** (`smile` は UVLT 非重複を grep で確認)

**P1 (第 4 ラウンド査読の refinements)**:
- **§1.1 H2**: probit β=-0.18 の effect size justification に Uchihara et al. (2025) の gairaigo 効果観察値 (L2 学習者の recognition accuracy で cognate 有無により ~20% 差) への inline 参照を追加
- **§15.1 H1 内部 α**: 固定 0.025 each から **Holm-adjusted α_H1 / 2 each** に変更 (H1 が Holm で α=0.0167 の場合、内部は α=0.00833 each)
- **§15.1 H1 test**: ICC の推測基準を明示 (profile-likelihood CI 下限 ≥ 0.15 **AND** `ranova()` で σ²_person = 0 の LRT p < 0.025)

### v0.3 → v0.4 (第 3 ラウンド査読反映、commit 候補)

**P0 (残存 blocker 解消)**:
- **§14 #9**: `price` (UVLT 1K target) を使用したルール違反を解消。**`distance`** (UVLT 非重複の GSL top 500 名詞) に置換
- **§14 #2, #4, #7**: 慣用・比喩救済リスクのある foil を差替 (*write sunrises* → *write mountains*, *buy anger* → *buy darkness*, *cook mathematics* → *cook thunder*)
- **§7.2 コード**: 3 つの JS バグを修正
  - 3a: `initialize()` → **`initOnUserGesture()`** に改名 + 契約明示
  - 3b: `visibilitychange` 条件を反転 (hidden + trialInProgress で invalidate)、`audioCtx.onstatechange` も追加
  - 3f: `trialInProgress` を `settleTrial()` 統一パスで false にリセット
- **§8.2 後処理**: `for range(3)` に `else` 節を追加し overshoot 残存時に `warnings.warn()` を発行 (silent failure 解消)
- **§9.2 pseudocode**: timeout セル排他性 (`response_value=null iff timeout_flag=true`) を注記
- **§11.4 COCA check**: Google Books 2-gram フォールバック、lemmatization (spaCy)、trigram 対応を追加
- **§15.1 H1 test**: ICC 公式を Nakagawa & Schielzeth (2013) 準拠で明示 `ICC = σ²_person / (σ²_person + σ²_item + 1)`
- **§15.5 副次値**: H=0.70, F=0.30 の SE(d') を **0.29** に訂正 (v0.3 の 0.26 は n≈50 相当、Miller 1996 で n=40 なら 0.29)
- **§1.1 H1**: conjunction rule を明記 (ICC ≥ 0.15 **AND** source の probit β 有意、Bonferroni α=0.025 each)
- **§13.1 credentials**: 検知パターンを拡張 (`client_email`, `auth_uri`, `.p12`/`.key`/`.p8`/`.jks` 等) + `detect-secrets` 併用を推奨

**P1 (refinements)**:
- **§1.1 H2**: effect size justification を追加 (probit β=-0.18 は Saito 2026 系列の gairaigo 効果観察範囲に相当)
- **§10.2 Bluetooth 能動検知**: `outputLatency > 20 ms` で "Bluetooth 相当遅延" として session_meta にフラグ
- **§15.4 VIF**: `car::vif()` を `lm(as.numeric(is_correct) ~ ...)` で計算する旨の注記追加 (GLMM 非対応のため)

### v0.2 → v0.3 (第 2 ラウンド査読反映)

**P0 (残存 blocker 解消)**:
- **§14**: 練習 10 項目を再刷新。v0.2 で指摘された 6 件の慣用表現・比喩救済問題 (*keep silence*, *carry rumors*, *silence followed*, *accept weather*, *describe in silence*, *garden needs laughter*) を全て排除し、新しい 10 項目を採用。強い選択制限違反を基本とし、(b) は noun target + 非慣用形容詞モデルに統一
- **§3.4 (b3)**: `This box contains several loud books.` を削除。oddness が target verb との直接統語関係ではなく object+modifier に帰着する問題を解消。**`He sought laughter from his father yesterday.`** (*seek + laughter*) に差替。seek の直接目的語として laughter は COCA collocate 外
- **§15.5**: Power 計算を **Miller (1996) の正しい公式**で置き換え。SE(d') の誤記を訂正 (H=0.8 F=0.2 n=40 → 0.32, H=0.95 F=0.05 n=40 → 0.47, foil-layered n=20 → 0.45, 群レベル N=200 → 0.023)。精度が v0.2 想定より良好な方向の訂正
- **§9.2**: Hautus pseudocode の自己対話コメント (`これでは不整合。再定義...`) を削除し、最終定義のみ明記。timeout 処理の表記を §7.5 と完全一致
- **§1.1 H2**: logit β ≤ -0.3 を **probit β ≤ -0.18** に書換 (§15.1 の probit GLMM と整合。link 関数変動による pre-registration 齟齬を解消)
- **§15.1**: GLMM primary model に **`source` (CAT_correct vs theta_pad)** を固定効果として追加。H1 の核心変数が model 外にあった問題を解消
- **§5.4.1**: `frequency` を除外候補リストから削除 (BAND_BLUEPRINTS で `frequency` は distractor であり UVLT target ではない、事実確認ミス)

**P1 (大規模 revisions)**:
- **§15.1**: GLMM に `matching_quality` を固定効果として追加
- **§15.4**: VIF 事前チェック手続きを明記 (cognate_ease / polysemy_tier / translation_ambiguity_JP の多重共線性対応)
- **§15.2**: Secondary analyses 内に BH-FDR を指定 (Family-wise error 統制を primary 外にも拡張)
- **§7.5 / §9.2**: timeout 呼称 "miss(app)/FA(inapp)" で両節を統一 (v0.2 での鏡像逆転を解消)
- **§7.2**: JS コード例に `audioCtx.resume()` (user-gesture 要件)、`trialSettled` guard (race 防止)、`visibilitychange → suspended` 検知を追加
- **§13**: v1 localStorage 移行方針を明確化 (新規コホートのため v1 データは意図的破棄、ベータ参加者がいる場合の migration フック明示)。credentials CI hook として `pre-commit` での `git ls-files` JSON scan を具体指定

**P2 (refinements)**:
- **§5.4.1**: 追加の除外候補を review 対象に (`exhibit`, `persist`, `scenario`, `specify`, `approximate`)。最終判定はネイティブレビュワーに委ねる
- **§11.4**: `validate_ljt_sentences.py` に **COCA bigram MI > 3 チェック**を追加指定 (慣用表現による foil 無効化を起案時点で自動検出)
- **§1.1 H3**: r=0.3-0.4 および r=0.7-0.8 の境界領域に decision rule を追記
- Formatting: 各セクションに「v0.3 での変更点」サマリを追加

### v0.1 → v0.2 (第 1 ラウンド査読反映、参考)

前版 changelog を §付録 A に移動。詳細は履歴参照。

---

## 1. 目的と位置づけ

### 1.0 理論的枠組み

本研究は DeKeyser (2017) の **skill acquisition theory** 三段階 (declarative → proceduralized → automatized) に準拠し、Saito et al. (2025, 2026)、Uchihara et al. (2025) の phonological vocabulary knowledge 枠組みを採用する。

**UVLT matching** は (i) 書字刺激 × (ii) 多肢選択 × (iii) 無制限時間という 3 条件で実施されるため、**stable retrieval of declarative form-meaning knowledge** を測るタスクと位置づけられる。一方 **timed LJT** は (i') 音声刺激 × (ii') yes/no 判断 × (iii') deadline 下での実施となり、**proceduralized/automatized use-in-context knowledge** への接近を意図する。

**本研究の原理的限界 (重要)**: 両タスクは **modality (orthographic vs. phonological)** と **rate (untimed vs. timed)** の 2 軸で同時に異なる。したがって両者の performance 乖離は「declarative vs. automatized の差」のみでは同定不能であり、以下のような alternative interpretations が常に並存する:

- (A) モダリティ効果: LJT の劣化は automatization の欠如ではなく、単なる音韻デコード能力・TTS 聴取能力の不足に帰される可能性
- (B) レート効果: LJT の劣化は automatization ではなく、時間圧下での general cognitive load に帰される可能性
- (C) タスク形式効果: yes/no 判断と 6-options matching の応答形式差が、知識以外の要因で乖離を生む可能性

§4 の Q-matrix 統制、§6 の動的サンプリング、§15 の GLMM による foil_type × 帯域交互作用は、これらの交絡を**統計的に部分分離**するための設計である。交絡の完全除去は本研究の射程外であり、将来的に (a) 書字版 LJT との部分比較、(b) 音声-書字の 2×2 デザイン、(c) 個人別の音韻処理能力指標を共変量投入、といった追加デザインで段階的に解消すべき点として明記しておく。

### 1.1 研究仮説 (pre-registration 可能な形式、v0.3 で probit に統一)

#### Hypothesis 1 (CAT-LJT 乖離の存在と個人差の安定性)

Cross-classified GLMM `glmer(is_correct_LJT ~ ... + (1|person) + (1|item), family=binomial("probit"))` において、以下の **conjunction rule (v0.4 で明記)** で支持判定:

- **条件 A** (個人差の安定性):
  - `ICC_person ≥ 0.15` の点推定 **かつ** profile-likelihood 95% CI 下限 ≥ 0.15
  - **推測基準 (v0.5)**: `ranova()` で σ²_person = 0 を null とする LRT が **p < α_H1_internal** で棄却
  - 加えて個人別 `p_LJT_correct | CAT_correct` の IQR が 0.20 以上
- **条件 B** (CAT-LJT 乖離の存在): §15.1 primary GLMM における `source` 固定効果 (CAT_correct vs theta_pad) の probit β が有意

**支持判定**: H1 は **A ∧ B** で完全支持。どちらか一方のみでも partial support として記述。

**Multiple comparison (v0.5 更新)**:
- H1 全体は primary 3 検定の 1 つとして Holm-Bonferroni family α=0.05 に参加。Holm の step-down で H1 が受け取る α は {0.05/3, 0.05/2, 0.05} のいずれか (p 値順位依存)
- **H1 内部**: 受け取った α_H1 を 2 条件に Bonferroni で半々分割 (α_H1_internal = α_H1 / 2 each)。例: H1 が Holm で α=0.0167 を受けた場合、A・B それぞれ α=0.00833 で検定
- 旧 v0.4 の固定 α=0.025 each は Holm 全体との整合性欠如のため廃止

**対立仮説**: ICC < 0.05 かつ source β が有意でなければ H1 棄却 (乖離は主にランダム誤差)。

#### Hypothesis 2 (JP 特異な gairaigo 仮説; v0.3: probit スケールに統一)

Primary GLMM (§15.1) において:

- **`cognate_ease = high` の probit β ≤ -0.18** (標準正規スケール、d' ~0.18 単位の低下に相当)、α = 0.05 で有意
  - **Effect size justification (v0.5)**: probit β = -0.18 は Uchihara et al. (2025) *Language Learning* の L2 学習者 recognition accuracy データで、cognate 有無による差が概ね 15-20% に相当する範囲 (Cohen's h ≈ 0.3-0.4) と符合する。本研究の LJT では自動化された use-in-context 知識を測るため、recognition タスクと比べ cognate 効果はより縮小する可能性があり、β = -0.18 は保守的下限として適切
- **対立仮説排除条件**: `polysemy_tier` および `translation_ambiguity_JP` を同時投入しても `cognate_ease` の β が 50% 以上残存する
- **ネステッド比較**: `cognate_ease` 項を含むモデルと除いたモデルで **ΔAIC ≥ 4** を追加支持の閾値とする
- **多重共線性 (§15.4)**: VIF ≤ 5 を条件。VIF > 5 の場合、β の点推定は報告するが effect 独立性の claim は制限する

これらすべてが満たされた場合のみ H2 を支持。単一指標のみでは不十分。

**備考**: logit-probit 変換で β_probit ≈ β_logit / 1.7。v0.2 の logit β ≤ -0.3 と概ね等価。

#### Hypothesis 3 (CAT θ と LJT d' の関係)

- `r(CAT θ_hat, LJT d') = 0.40 – 0.70` の中程度の相関
- 95% CI が [0.30, 0.80] の範囲に収まる
- **v0.3 追加の境界 decision rule**:
  - `r < 0.30`: 両測度は独立構成概念として分離可能 (ただし関連性弱すぎ)。CAT と LJT は異なる語彙知識次元を測っている証拠
  - `0.30 ≤ r < 0.40`: 弱い関連性ゾーン。Sensitivity として reliability 補正 (disattenuated r) を報告
  - `0.40 ≤ r ≤ 0.70`: **仮説支持**
  - `0.70 < r ≤ 0.80`: 境界的支持。両測度の冗長性傾向を併記
  - `r > 0.80`: 両測度は冗長 (LJT の追加説明力低下)

### 1.2 Saito et al. (2026) との対応

| 側面 | Saito 2026 | 本研究 |
|---|---|---|
| 主目的 | automatized phonological vocabulary knowledge の測定 | 同左 + CAT recognition との乖離同定 + gairaigo 仮説検証 |
| 対象 | Japanese EFL university students | 同左 (新規募集コホート) |
| ターゲット語 | 80 語 (cognate excluded) | 1 人 **40 語** (CAT 正解 + θ-pad); バンク全体 **150 語 (loanword 含む)** |
| 条件 | appropriate + inappropriate 各 80 文、計 160 文 | 各 40 文、計 **80 文** |
| Deadline | 1,600 ms (app) / 2,000 ms (inapp) 音声オフセット後 | **同値を採用** (§7.3 compatibility note) |
| 音声 | female native General American | `en-US-Neural2-C` (female GA 系) → パイロット後ネイティブ録音に置換 |
| Practice | 4 items (2 app + 2 inapp) | **10 items (8 app + 2 inapp タイプ混合, v0.3 更新)** |
| Platform | Gorilla | **App_CAT 内に統合** (既存 UVLT CAT と同一ブラウザセッション) |
| タイミング計測 | Gorilla 内蔵 | **Web Audio API** (`AudioContext.currentTime`) |

### 1.2.1 Saito 2026 との比較可能性マトリクス

| 比較対象 | 可能性 | 理由 |
|---|---|---|
| d' の絶対値 | **不可** | 40 vs 80 項目 / 項目サンプル自体が受験者依存 / loanword 包含 |
| RT 分布形状 (correct-only, 適切文) | **条件付き可** | 1,600 ms deadline 共有、ただし θ 層別化後に比較 |
| RT 分布形状 (correct-only, 不適切文) | **条件付き可** | 2,000 ms deadline 共有、同様に θ 層別 |
| app vs inapp の非対称性 (within-subject Δ RT) | **可** | deadline 設計が同一、被験者内対比は交絡少 |
| 絶対成績水準 (% correct, raw score) | **不可** | ターゲット選定が θ 近傍・CAT 正解バイアス |
| 個人差構造 (d' × TOEIC など) | **部分可** | 相関パタンのみ、絶対値は不可。本研究は TOEIC 測定なし |
| foil_type 効果 (a vs b) | **本研究独自** | Saito は foil type を統制変数として明示していない |
| loanword 効果 (cognate_ease) | **本研究独自** | Saito は loanword 除外のため比較対象なし |

論文化時は「d' の絶対値比較は本研究の主目的ではない」ことを Methods で明示する。**本研究の independent contribution は (i) UVLT 既知項目への LJT 適用、(ii) CAT-LJT 乖離の person-level 測定、(iii) gairaigo 仮説の検証、の 3 点**。

### 1.3 本研究固有の拡張

1. ターゲット語 150 語はすべて **UVLT 項目バンク由来** ([App_CAT/script.js:144-205 `BAND_BLUEPRINTS`](../script.js))
2. 個人のターゲット 40 語は CAT 結果に基づき**動的サンプリング** (§6 参照)
3. Q-matrix で sentence length・context frequency・foil type・多義度を**同時統制**
4. LJT 適格性フィルタ (§5.4) で、4-8 words で clean foil を作れない項目を事前除外

---

## 2. タスク全体の流れ

CAT → (30 秒休憩) → LJT 指示 + 練習 (10 試行) → LJT 本番 (80 試行、40 試行目に任意休憩) → 結果画面。

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐
│   CAT (既存)    │→│ LJT 指示 + 練習 │→│  LJT 本番 (80)  │→│ 2 軸プロファイル │
│ matching 形式   │  │    10 trials    │  │  timed, 音声    │  │ breadth×depth │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └──────────────┘
```

1 試行あたり 6–8 秒 × 80 = 約 10 分。CAT (既存) は 10–15 分、合計 **20–25 分**。

---

## 3. 刺激仕様 (Sentence-level specification)

### 3.1 文の構造

| 属性 | 値 | 根拠 |
|---|---|---|
| **文長** | 4–8 words (inclusive) | Saito 2026, p.9 |
| **ターゲット語位置** | 非文頭 (position ≥ 2) | Saito 2026, p.9 |
| **文法** | grammatically accurate | Saito 2026 |
| **統語複雑度** | structurally simple, no subordination | Saito 2026, p.9 |
| **ターゲット語出現数** | 1 文あたり 1 回 | Saito 2026 |
| **POS** | ターゲット語の POS は UVLT blueprint に一致 | `BAND_BLUEPRINTS[level][t].partOfSpeech` |
| **テスト対象センス** | UVLT prompt と一致するセンス (§5 参照) | 本研究固有 |

### 3.2 Context word frequency (段階天井)

Saito 2026 の **93% top 1K + 7% top 2K** 固定天井に対し、本研究は**段階天井**を採用:

| ターゲット帯域 | 必須比率 (top 1K) | 許容される非 1K 語の上限 |
|---|---|---|
| 1K / 2K / 3K | **≥ 90%** | top 2K まで |
| 4K | ≥ 85% | top 3K まで |
| 5K | ≥ 85% | top 4K まで |

- 非 1K の context 語は、その文の意味決定に不可欠である場合のみ許容
- 一文中に許容される「非 1K の非ターゲット語」は**最大 1 語**
- 固有名詞は「top 1K」扱い
- 頻度判定の基準: **COCA rank band** (`lexical_frequency.json` と同じ基準)

### 3.3 Appropriate 文の作成要件

- 文脈が **tested sense** を一意に決定すること
- ターゲット語の意味が文全体の成立に意味的に貢献していること
- **必須チェック**: 起案時、ネイティブが appropriate 文を見てターゲット語を削除した場合、tested sense でない別 sense の他語 (別 POS 含む) で自然に穴埋めできてはいけない

#### 例 (1K `note`, tested sense = "short piece of writing")

- ✅ `She left a short note on the desk.` (8 words)
- ❌ `I listened to the note carefully.` (note = 音符 sense でも成立; ambiguity)
- ❌ `He gave me a note.` (どの sense でも成立; 意味貢献が弱い)

### 3.4 Inappropriate 文の作成要件 (v0.3 改訂)

**両 foil type に共通する絶対規則**:

1. **ターゲット語を保持**する (置換・削除しない)
2. **どの sense でも成立しない**こと (多義語では全 sense での成立をチェック)
3. **比喩・寓意・詩的読解で救済されない**こと (ネイティブ 2 名以上の合意)
4. **不自然さの源泉がターゲット語との関係**に帰せられること (他の語の奇妙さに起因する違和感は NG)
5. **COCA bigram MI > 3** の既知慣用表現でないこと (§11.4 の自動検証)

#### Foil type (a): 選択制限違反

ターゲット語の tested sense が要求する意味素性 (±animate / ±concrete / ±countable / ±abstract / ±human / ±temporal 等) を**明示的に破る**。

**多様化要件 (adjective ターゲット)**: 15 項目の (a) を「+animate 違反」のみで埋めない。各レベルの (a) は +animate / +concrete / +temporal / +gradable のそれぞれで**最低 2 項目**を含める。

**worked example**:

- **3K `apology`** (tested sense = "statement saying you are sorry")
  - App: `Her apology sounded completely sincere.` (5 words)
  - Inapp (a): `Her apology wore a blue coat.` (6 words) — apology は +verbal_act で、衣服を着るのは +human_physical_body の選択制限。比喩的救済 (「謝罪が青いコートを着ていた」) は詩的だが自然な比喩として成立せず、ネイティブ 3 名による救済不可確認済み (pilot)

- **3K `poverty`** (tested sense = "having little money")
  - App: `Poverty affects many families in the region.` (7 words)
  - Inapp (a): `Poverty tasted bitter on her tongue.` (6 words) — poverty は +state, -substance で、味覚の対象は +substance。この foil はネイティブレビューで **WATCH** 判定 (文芸的 synesthesia 救済リスク)、critical review 対象とする

- **1K `stare`** (tested sense = "look at for a long time")
  - App: `The child stared at the bright window.` (7 words)
  - Inapp (a): `The table stared at the bright window.` (7 words) — stare は +animate_agent 必須

#### Foil type (b): コロケーション違反

> ターゲット語の **tested sense を保持**したまま、ターゲット語と**直接統語関係にある隣接語** (直接目的語、主語補語、直接修飾語など) を、**COCA の collocate list に現れない語**に差し替える。

**v0.3 で明確化した「直接統語関係」**:

- Target が **動詞** の場合: 直接目的語、主語、副詞 (動詞を修飾)、前置詞 (動詞に支配される)
- Target が **名詞** の場合: 形容詞修飾、名詞補語、主語-補語関係の動詞
- Target が **形容詞** の場合: 被修飾名詞、程度副詞

**NOT 直接統語関係**: Target が動詞の場合の「目的語を修飾する形容詞」 (e.g., v0.2 の `contain + loud books` の `loud` は `books` を修飾し、`contain` とは間接関係)。これは規則違反。

**worked example (v0.3 改訂、3 件)**:

- **(b1) 2K `contribute`** (tested sense = "give to")
  - App: `She contributed funds to the local charity.` (7 words)
  - Inapp (b): `She contributed laughter to the local charity.` (7 words) — *contribute* の直接目的語として *laughter* は COCA collocate list 外。`contribute money/time/ideas/effort/support` が高頻度。意味論的には成立するが慣用外

- **(b2) 1K `price`** (tested sense = "cost")
  - App: `The price of this book is low.` (7 words)
  - Inapp (b): `The price of this book is tall.` (7 words) — *price* + 修飾語として *tall* は COCA collocate 外。日本語からの転移リスク捕捉

- **(b3) 2K `seek`** (tested sense = "look for", v0.3 で `contain` から差替)
  - App: `He sought advice from his father yesterday.` (7 words)
  - Inapp (b): `He sought laughter from his father yesterday.` (7 words) — *seek* の直接目的語として *laughter* は COCA collocate 外 (seek は advice/help/approval/support/justice 等 +desirable_abstract を探す)。意味論的に「父親から笑いを探し求める」は metaphorically 可能だが慣用表現としては非典型。**seek の直接目的語を変更する設計**で §3.4 規則 4 を満たす

**(b) の失敗モード (起案時に除外すべきパターン)**:

1. 候補の foil が実は慣用 (e.g., *capture a bright idea* は両方とも慣用表現)
2. 候補が selectional 違反に縮退 (e.g., *wealth played music* は wealth -animate の (a) 型)
3. 候補がターゲット語置換 (e.g., *offer* → *contribute* に置換した foil)
4. 候補が register 違和 (e.g., *describe aggressively* は register 問題)
5. **v0.3 追加**: 修飾関係がターゲット語と間接的 (v0.2 `contain + loud books` 型)

### 3.5 Appropriate / Inappropriate のマッチング

| 優先度 | 属性 | 許容差 |
|---|---|---|
| **必達** | 統語フレーム | 完全一致 |
| **必達** | ターゲット語位置 | 完全一致 |
| 努力目標 | 文長 | ± 1 word |
| 努力目標 | mean context log-freq | 差 ≤ 0.3 log-unit |
| 努力目標 | 主語のアニメーション性 | 一致 |

Q-matrix の `matching_quality` 列 (`full` / `partial_frame` / `frame_only` / `fail`) に記録し、**§15.1 GLMM に固定効果として投入** (v0.3 追加)。

---

## 4. Q-matrix (統制変数表)

行 = 300 文 (150 targets × 2 conditions)、列 = 以下の属性。CSV として `ljt/q_matrix.csv` に格納。

### 4.1 列定義

| 列名 | 型 | 説明 | 情報源 |
|---|---|---|---|
| `item_id` | str | UVLT item_id | `BAND_BLUEPRINTS` |
| `target_word` | str | ターゲット語 | `BAND_BLUEPRINTS.answers` |
| `target_level` | str | 1K/2K/3K/4K/5K | `BAND_BLUEPRINTS` |
| `target_position_in_testlet` | int | 1–3 | 導出 |
| `target_POS` | str | noun / verb / adjective | `BAND_BLUEPRINTS.partOfSpeech` |
| `tested_sense_desc` | str | CAT prompt | `BAND_BLUEPRINTS.prompts` |
| `condition` | str | `appropriate` / `inappropriate` | 設計 |
| `foil_type` | str | `NA` / `a_selectional` / `b_collocation` | 設計 |
| `foil_subtype` | str | (a): `animate`/`concrete`/`temporal`/`gradable`/`abstract` / (b): `object_collocate`/`modifier_collocate`/`prep_collocate`/`adverb_collocate` | 設計 |
| **context** | | | |
| `sentence_text` | str | 音声化される文 | 起案 |
| `sentence_length` | int | 4–8 | 派生 |
| `target_position_in_sentence` | int | 2 以上 | 派生 |
| `syntactic_frame` | str | SVO / SV / SVC 等 | レビュー時 |
| `n_context_non_1K` | int | top 1K 外の context 語の数 | 自動判定 |
| `context_max_band` | str | top_1K/2K/3K/4K | 自動判定 |
| `mean_context_logfreq` | float | context 語の mean COCA log-freq | 自動計算 |
| `coca_bigram_max_mi` | float | context 内 bigram の最大 MI (§11.4) | 自動計算 |
| **matching** | | | |
| `matching_quality` | str | `full` / `partial_frame` / `frame_only` / `fail` | §3.5 |
| `length_diff` | int | |len(app) − len(inapp)| | 派生 |
| `logfreq_diff` | float | log-freq 差 | 派生 |
| **polysemy** | | | |
| `n_wordnet_senses` | int | descriptor only | `nltk.wordnet` |
| `tested_sense_dominance` | float | [0, 1] 推定値 | WordNet + LLM + native |
| `polysemy_tier` | str | `dominant` / `intermediate` / `minority` | 派生 |
| `dict_1st_sense_match` | bool | tested sense が辞書 1st sense と一致 | 手動判定 |
| `ljt_eligibility` | str | `eligible` / `careful` / `exclude` | §5.4 |
| **JP-specific** | | | |
| `loanword_status` | str | `native` / `loanword` / `dual` | JSON + 新規 |
| `cognate_ease` | str | `low` / `medium` / `high` | 同上 |
| `translation_ambiguity_JP` | str | `one_to_one` / `one_to_many` / `no_direct` | 同上 |
| **audio** | | | |
| `audio_file` | str | 音声ファイル名 | B 実装で生成 |
| `audio_duration_ms` | int | 音声長 | B 実装で計測 |
| `audio_sha256` | str | ファイルハッシュ | B 実装で計測 |
| **review** | | | |
| `llm_draft_version` | str | 初稿生成の LLM / バージョン | 起案 |
| `native_rater_1_decision` | str | accept / revise / reject | レビュー |
| `native_rater_2_decision` | str | 同上 | レビュー |
| `final_decision` | str | accepted / revised / rejected | 合議 |
| `review_priority` | str | routine / careful / critical | §5 |
| `revision_notes` | str | レビュワーコメント | レビュー |

### 4.2 Q-matrix の事前検証

- [ ] `item_id` は 150 件 unique
- [ ] 各 eligible item に condition × 2 行が存在
- [ ] `foil_type` の分布: level 内で 15 (a) + 15 (b) ± 3 以内
- [ ] `foil_subtype` の分布: adjective ターゲット内で +animate 偏重でないこと
- [ ] `polysemy_tier = minority` の項目数が帯域間で ±5 以内
- [ ] `matching_quality = fail` が全体の 10% 以下
- [ ] **`coca_bigram_max_mi > 3` の既知慣用を含む文は 0**

---

## 5. 多義語処理方針

### 5.1 tier 定義 (dominance-based)

| Tier | dominance | review priority |
|---|---|---|
| `dominant` | ≥ 0.70 | `routine` |
| `intermediate` | 0.40 – 0.70 | `careful` |
| `minority` | < 0.40 | **`critical`** |

### 5.2 dominance 推定プロセス (3 層)

1. **第一層 (自動)**: WordNet の SemCor 頻度
2. **第二層 (LLM)**: Claude Opus による推定 (5 回サンプリング中央値)。第一層との乖離 0.2 以上で第三層必須
3. **第三層 (native)**: ネイティブ判定 (3 段階) — 自動推定と乖離する場合は第三層を最終値

### 5.3 critical review チェックリスト (minority tier)

- [ ] Appropriate 文が tested sense 以外の sense でも成立しないか?
- [ ] Inappropriate 文が tested sense 以外の sense で成立してしまわないか? ← **最重要**
- [ ] 日本語訳の優勢 sense が tested sense と一致するか?
- [ ] `dict_1st_sense_match = FALSE` の場合: JP_Anchoring DIF 再分析用に記録 (§12 参照)

### 5.4 LJT 適格性フィルタ

#### 5.4.1 除外候補 (starting list, v0.3 更新)

確度高: 4-8 words で clean foil を作れない可能性が高い:

| 項目 | 理由 |
|---|---|
| **3K `debate`** (verb, "talk about what is correct") | 比喩的拡張が無限、*debate* の minority 読み (熟考) が救済候補 |
| **3K `former`** (adj, "occurring earlier in time") | 限定用法のみ、4-8 words で自然な文に制約強 |
| **3K `absorb`** (verb, "take in") | layered polysemy で foil 無効化リスク |
| **3K `counsel`** (noun, "guidance") | 弁護士 sense が優勢で tested sense が minority |
| **5K `mandatory`** (adj, "required") | 関係形容詞的、foil レパートリー極小 |
| **3K `consent`** (verb, "agree") | 法的/医療 register 限定 |

追加の review 対象 (v0.3 P2 追加、ネイティブ判定で eligible/careful/exclude 最終決定):
- **3K `exhibit`** (verb, "show in public") — +display_intent 強制
- **3K `persist`** (verb, "continue to happen") — 継続相 aspectual
- **4K `scenario`** (noun, "situation") — 極めて多用途で foil 無効化
- **3K `specify`** (verb, "say clearly") — report verb で (b) collocate 多様
- **3K `approximate`** (adj, "almost exact") — gradable 選択制限が near-synonymy 縮退

**v0.3 削除**: ~~3K `frequency`~~ — BAND_BLUEPRINTS で `frequency` は distractor であり target ではないため削除

#### 5.4.2 判定プロセス

1. **Pre-screening (LLM)**: 150 語について、4-8 words の app/inapp 候補を LLM に各 10 文生成
2. **Native 事前評価**: 生成候補のうち **10 候補中 2 件以上が careful review 通過可能** な項目を `eligible`、**1 件も合格候補なし**を `exclude`、中間を `careful`
3. Q-matrix の `ljt_eligibility` 列に記録

#### 5.4.3 除外項目の扱い

- CAT では通常通り出題 (除外は LJT のみ)
- §6 の個人サンプリングでは除外項目を候補から外す
- 除外率が 15% を超える場合、設計全体の見直しを検討

---

## 6. 個人あたりターゲット語サンプリング

### 6.1 基本規則

```
S_correct     := CAT で正解した UVLT 項目集合 (eligible のみ)
S_eligible    := ljt_eligibility ∈ {eligible, careful} の項目
target_N      := 40

if |S_correct ∩ S_eligible| >= 40:
    LJT_targets := (S_correct ∩ S_eligible) から帯域層化で 40 語
else:
    base        := S_correct ∩ S_eligible
    pad_N       := 40 - |base|
    theta_hat   := CAT 最終 θ 推定値 (linked scale)
    S_pad_cand  := S_eligible - CAT 出題済項目集合
                    のうち |item.linked_difficulty - theta_hat| <= 0.5
    S_pad       := S_pad_cand から帯域層化で pad_N 語 (同一 testlet 最大 1 語)
    LJT_targets := base ∪ S_pad
```

### 6.2 帯域層化サンプリング

40 語の帯域分布は CAT 出題時の帯域分布に可能な限り近づける。

### 6.3 ログ必須項目

```
各 LJT_target 行:
  source ∈ {CAT_correct, theta_pad}
  cat_item_correct_flag ∈ {TRUE, FALSE, null}
  sampling_strata (帯域)
  sampled_at (timestamp)
  eligible_at_sampling (bool)
```

`source` は **§15.1 primary GLMM の固定効果として投入** (v0.3 追加)、H1 の直接テスト。

---

## 7. タイミング仕様

### 7.1 1 試行のタイムライン

```
[Fixation]  [Audio playback]                   [Response window]
 500 ms     audio_duration (~2,500-4,500 ms)   app: 1,600 ms | inapp: 2,000 ms
```

**ISI**: 次の試行の fixation 開始まで **800 ms** の blank。

### 7.2 タイミング計測基盤 (Web Audio API)

`AudioContext.currentTime` 基準でタイミング計測。`<audio>` 要素は使わない。

```javascript
// LJTController 擬似コード (v0.4 バグ修正版)
class LJTController {
    // IMPORTANT (3a): 必ず user gesture ハンドラ (click/touch) 内で呼ぶこと
    // Safari/iOS では auto-play policy により user gesture 外では resume() しても
    // 音が出ない。DOMContentLoaded からの呼び出しは NG。
    async initOnUserGesture() {
        this.audioCtx = new AudioContext({ latencyHint: 'interactive' });
        // resume() は user gesture 契機でのみ有効
        await this.audioCtx.resume();
        this.outputLatency = this.audioCtx.outputLatency;
        this.baseLatency   = this.audioCtx.baseLatency;
        // Bluetooth 等の遅延指標を session_meta に記録
        this.connectionTypeEstimate =
            this.outputLatency * 1000 > 20 ? 'bluetooth_or_wireless' : 'wired_or_internal';

        // (3b) AudioContext の suspended 遷移を直接検知
        this.audioCtx.onstatechange = () => {
            if (this.audioCtx.state === 'suspended' && this.trialInProgress) {
                this.invalidateCurrentTrial('audiocontext_suspended');
            }
        };
        // tab hidden は state 遷移より早く起きるため併用
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.trialInProgress) {
                this.invalidateCurrentTrial('tab_hidden_mid_trial');
            }
        });

        this.trialSettled = true;   // 試行外の初期状態
        this.trialInProgress = false;
    }

    async playTrial(itemId, audioBuffer, condition) {
        this.trialSettled = false;
        this.trialInProgress = true;
        this.currentTrialMeta = { itemId, condition };

        const source = this.audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioCtx.destination);

        const scheduledStart = this.audioCtx.currentTime + 0.1;
        source.start(scheduledStart);

        const audioOnsetAtCtx  = scheduledStart;
        const audioOffsetAtCtx = scheduledStart + audioBuffer.duration;
        const deadlineMs = condition === 'appropriate' ? 1600 : 2000;
        const deadlineAtCtx = audioOffsetAtCtx + deadlineMs / 1000;

        this.currentTrialMeta.onset = audioOnsetAtCtx;
        this.currentTrialMeta.offset = audioOffsetAtCtx;
        this.currentTrialMeta.deadline = deadlineAtCtx;

        // 音声終了でボタン有効化 (onended と setTimeout の二重化で idempotent に)
        const enableAt = (audioOffsetAtCtx - this.audioCtx.currentTime) * 1000;
        this.enableTimerId = setTimeout(() => this.enableResponseButtons(), enableAt);
        source.onended = () => { this.enableResponseButtons(); };

        // timeout (trialSettled guard は settleTrial() 内で一元処理)
        const timeoutMs = (deadlineAtCtx - this.audioCtx.currentTime) * 1000;
        this.timeoutId = setTimeout(
            () => this.settleTrial({ kind: 'timeout', at: this.audioCtx.currentTime }),
            timeoutMs
        );
    }

    onResponseClick(responseValue) {
        this.settleTrial({
            kind: 'response',
            value: responseValue,
            at: this.audioCtx.currentTime,
        });
    }

    invalidateCurrentTrial(reason) {
        this.settleTrial({ kind: 'invalidated', reason, at: this.audioCtx.currentTime });
    }

    // 単一の終結路 (3f): trialSettled + trialInProgress を必ず同時にリセット
    settleTrial(outcome) {
        if (this.trialSettled) return;
        this.trialSettled = true;
        this.trialInProgress = false;
        clearTimeout(this.timeoutId);
        clearTimeout(this.enableTimerId);
        this.disableResponseButtons();
        this.logTrialResult({ ...this.currentTrialMeta, ...outcome });
        this.advanceToNextTrial();
    }
}
```

**v0.4 でのバグ修正まとめ**:
- **3a**: `initialize()` → `initOnUserGesture()` に改名、契約 (user gesture 内でのみ呼ぶ) を明示
- **3b**: `visibilitychange` の条件を反転 (hidden 時に invalidate、state チェック不要)。`onstatechange` も配線して OS-level interrupt (電話着信等) もカバー
- **3f**: `settleTrial()` を**単一の終結路**として設定し、`trialSettled` と `trialInProgress` の両フラグを必ず同時にリセット。click / timeout / invalidate のすべてがこのパスを通る
- **補足**: `connectionTypeEstimate` を `outputLatency > 20 ms` で分類し session_meta に記録 (Bluetooth 能動検知、§10.2 参照)

**タイミング列の記録** (`ljt_log` シート, §9.1):
- `audio_context_start_time_s` (`audioCtx.currentTime` 基準)
- `audio_onset_at_ctx_s`
- `audio_offset_at_ctx_s`
- `deadline_at_ctx_s`
- `response_at_ctx_s` (timeout なら null)
- `rt_from_offset_ms` (timeout なら **null**)
- `output_latency_ms` / `base_latency_ms` (セッション固定値)

### 7.3 応答可能時点の制約

**音声再生終了後のみクリック可能** (Saito 2026 p.16)。再生中のクリックは無視 + `premature_click_count` を増加。

### 7.4 Deadline 値

| 条件 | Deadline (post-offset) | 根拠 |
|---|---|---|
| Appropriate | **1,600 ms** | Saito 2026, advanced JP EFL 95% CI 上限 (1,639 ms) |
| Inappropriate | **2,000 ms** | Saito 2026, advanced JP EFL 95% CI 上限 (1,966 ms) |

**Compatibility note**: 本研究は 40 項目・θ 近傍サンプリングのため RT 分布が異なる可能性があるが、**同値を採用することで across-study comparability を優先**。パイロット後に調整を再検討。

### 7.5 Timeout 処理 (v0.3 で §9.2 と完全統一)

**全指標で timeout = incorrect** の原則:

- **Raw accuracy**: timeout = 0 点
- **d' (primary)**:
  - Appropriate 条件での timeout → **miss** (= hit でない、分子 n_hit_app に非加算)
  - Inappropriate 条件での timeout → **FA** (= correctly reject でない、分子 n_fa_inapp に加算)
  - この非対称は「timeout は正しい判断ができなかった = incorrect」の原則に基づく
- **Mean RT (correct only)**: timeout は計算対象外 (null)
- **Logs**:
  - `response_value = null`
  - `timeout_flag = true`
  - `rt_from_offset_ms = null`

**Sensitivity analysis**: `d'_excluding_timeouts` を secondary に保持。両者の差 `|d_primary - d_excl| > 0.2` の場合、timeout 率の効果を別途考察。

**Saito 2026 "transformed score"** (tertiary, exploratory): `correct / (total - timeouts)` — 正確には "conditional accuracy on responded trials"。

---

## 8. 音声仕様 (B 実装への receipts)

### 8.1 TTS パラメータ

| 項目 | 値 |
|---|---|
| API | Google Cloud Text-to-Speech |
| Voice | `en-US-Neural2-C` (female, General American) |
| Language code | `en-US` |
| Speaking rate | 1.0 (default) |
| Pitch | 0.0 (default) |
| Audio encoding | LINEAR16 |
| Sample rate | 22,050 Hz |
| Channels | mono |
| File format | wav |

### 8.2 後処理 (修正版, B2 blocker 解消済み)

```python
# App_CAT/tools/generate_ljt_audio.py 抜粋
import numpy as np
import librosa
import pyloudnorm as pyln
import soundfile as sf

def post_process(wav_path):
    y, sr = librosa.load(wav_path, sr=22050)
    # 1. 先頭・末尾の無音トリム (-40 dB 基準)
    y, _ = librosa.effects.trim(y, top_db=40)
    if len(y) < int(0.5 * sr):
        raise ValueError(f"Audio too short after trim: {wav_path}")
    # 2. ピーク制限 (-1 dBFS) を正規化前に実施
    peak = float(np.max(np.abs(y)))
    if peak > 10**(-1/20):
        y = y * (10**(-1/20) / peak)
    # 3. LUFS 正規化 (-23 LUFS target)
    meter = pyln.Meter(sr)
    loudness_before = meter.integrated_loudness(y)
    y = pyln.normalize.loudness(y, loudness_before, -23.0)
    # 4. 正規化後 overshoot 検出 + target 下げ再正規化 (最大 3 回)
    for _ in range(3):
        peak_after = float(np.max(np.abs(y)))
        if peak_after <= 10**(-1/20):
            break
        overshoot_db = 20 * np.log10(peak_after / 10**(-1/20))
        y = pyln.normalize.loudness(y, meter.integrated_loudness(y),
                                     -23.0 - overshoot_db)
    else:  # v0.4: silent failure 解消
        import warnings
        peak_final = float(np.max(np.abs(y)))
        warnings.warn(
            f"{wav_path}: LUFS normalization overshoot persists after 3 iters; "
            f"final peak={peak_final:.4f} (> -1 dBFS). "
            f"audio_meta.csv will record actual peak for downstream QC."
        )
    # 5. 最終 LUFS を実測
    loudness_final = meter.integrated_loudness(y)
    # 6. 末尾に 200 ms silence padding
    y = np.concatenate([y, np.zeros(int(0.2 * sr))])
    sf.write(wav_path, y, sr, subtype='PCM_16')
    return {
        "duration_ms": int(len(y) / sr * 1000),
        "peak_dbfs": 20 * np.log10(np.max(np.abs(y)) + 1e-9),
        "integrated_lufs": loudness_final,
        "sha256": compute_sha256(wav_path),
    }
```

**依存 (`requirements.txt`)**:
```
google-cloud-texttospeech>=2.16
pyloudnorm>=0.1.1
librosa>=0.10
soundfile>=0.12
numpy>=1.24
```

### 8.3 ファイル命名規則 + プリロード戦略

```
App_CAT/ljt/audio/
    uvlt_<level>_t<NN>_i<NN>_{appropriate|inappropriate}.wav  (300 files)
    practice/
        p<NN>_{appropriate|inappropriate}.wav                 (20 files)
```

**合計**: 320 ファイル、**10-15 MB**。

**プリロード戦略**:

1. LJT intro 画面で、**個人の LJT_targets 40 語 × 2 + 練習 10 × 2 = 100 ファイル**を事前 fetch + `AudioContext.decodeAudioData`
2. `Promise.all(loadPromises)` が fulfill するまで「本番開始」ボタンをグレーアウト
3. 試行開始前に `audioBuffer[item_id][condition]` が存在することを assert
4. 1 ファイルでもロード失敗した場合は実験中止 + 再試行ダイアログ
5. 練習フェーズ中は背景ロードを許可

### 8.4 audio_meta.csv

```csv
audio_file,item_id,condition,text,duration_ms,peak_dbfs,integrated_lufs,sha256,tts_voice,tts_speaking_rate,generated_at,generator_version
```

決定論的再生成検証: 同一入力での `sha256` 一致を CI チェック。

---

## 9. ログスキーマ (C 実装への receipts)

### 9.1 `ljt_log` (試行レベル)

| 列 | 型 | 説明 |
|---|---|---|
| `trial_seq` | int | 通し番号 |
| `phase` | str | `practice` / `main` |
| `trial_in_phase` | int | 1..10 / 1..80 |
| `item_id` | str | UVLT item_id / `p01`–`p10` |
| `target_word` | str | |
| `target_level` | str | 1K–5K / `practice` |
| `condition` | str | `appropriate` / `inappropriate` |
| `foil_type` | str | `NA` / `a_selectional` / `b_collocation` |
| `source` | str | `CAT_correct` / `theta_pad` / `practice` |
| `audio_file` | str | |
| `audio_duration_ms` | int | |
| **タイミング (AudioContext 基準)** | | |
| `audio_context_start_time_s` | float | |
| `audio_onset_at_ctx_s` | float | |
| `audio_offset_at_ctx_s` | float | |
| `deadline_at_ctx_s` | float | |
| `response_at_ctx_s` | float/null | timeout なら null |
| `response_value` | int/null | 1/0/null |
| `rt_from_offset_ms` | int/null | timeout なら null |
| `timeout_flag` | bool | |
| `premature_click_count` | int | |
| `invalidation_reason` | str/null | tab_hidden_mid_trial など |
| `is_correct` | bool | |
| `audio_replay_count` | int | 0 固定 |

### 9.2 個人レベル集計 (`ljt_summary`) — Hautus log-linear (v0.3 クリーンアップ)

**Primary: `d'_primary`** — Hautus (1995) log-linear 補正、**全被験者に常時適用**:

```
# 定義 (v0.3 確定版):
#   hit = correctly accept appropriate (say-yes on app)
#   FA  = incorrectly accept inappropriate (say-yes on inapp)
#   miss = fail to hit on appropriate (includes say-no AND timeout)
#   correct-reject = reject inappropriate (say-no)
#
# Timeout policy (incorrect 扱いの一貫化):
#   timeout on appropriate → miss (n_hit_app に非加算)
#   timeout on inappropriate → FA (n_fa_inapp に加算)
# ← §7.5 と呼称完全一致 (v0.3)

n_hit_app      = count(condition=app  & response=1)
n_miss_app     = n_trials_app - n_hit_app                     # response=0 または timeout
n_fa_inapp     = count(condition=inapp & response=1)          # say-yes (response=1)
               + count(condition=inapp & timeout_flag=true)   # 排他、§7.5 準拠
n_reject_inapp = count(condition=inapp & response=0)

# 排他性保証 (v0.4 明記): response_value=null iff timeout_flag=true (§7.5)
# したがって上記 n_fa_inapp の 2 項は重複カウントなし

# Hautus log-linear (全セルに常時):
H = (n_hit_app + 0.5) / (n_trials_app + 1)         # n_trials_app = 40
F = (n_fa_inapp + 0.5) / (n_trials_inapp + 1)      # n_trials_inapp = 40

d_primary = qnorm(H) - qnorm(F)
c_primary = -0.5 * (qnorm(H) + qnorm(F))
```

**Sensitivity: `d'_excluding_timeouts`** (分母から timeout 除外):

```
n_hit_excl_app      = n_hit_app
n_nontimeout_app    = n_trials_app - n_timeout_app
n_fa_excl_inapp     = count(condition=inapp & response=1)  # timeout 除外
n_nontimeout_inapp  = n_trials_inapp - n_timeout_inapp

H_excl = (n_hit_excl_app + 0.5) / (n_nontimeout_app + 1)
F_excl = (n_fa_excl_inapp + 0.5) / (n_nontimeout_inapp + 1)
d_excl = qnorm(H_excl) - qnorm(F_excl)
```

両者の差 `|d_primary - d_excl| > 0.2` で timeout 効果を考察。

**その他の列**:
- `n_correct_app`, `n_correct_inapp`
- `n_timeout_app`, `n_timeout_inapp`
- `raw_accuracy = n_correct_total / 80`
- `conditional_accuracy = n_correct / (80 - n_timeout)` (tertiary)
- `mean_rt_app_correct`, `mean_rt_inapp_correct`, `median_rt_app_correct`, `median_rt_inapp_correct`
- `p_LJT_among_CAT_correct` (H1 直接指標)
- `p_LJT_among_pad`

### 9.3 `ljt_session_meta` (セッションレベル、1 行/参加者)

```
participant_id
ua_string
platform
viewport_wh
screen_dpr
audio_context_sample_rate
audio_context_output_latency_ms
audio_context_base_latency_ms
audio_context_state
headphone_check_attempts
headphone_check_result
bluetooth_warning_shown
preload_started_at
preload_finished_at
preload_total_files
preload_failures
cat_total_duration_s
ljt_total_duration_s
practice_accuracy       # v0.3 追加 (§14.1 追加 5 試行判定用)
events_tabswitch_count
events_focusblur_count
events_beforeunload_count
invalidated_trials_count # v0.3 追加 (§7.2 invalidateCurrentTrial)
```

### 9.4 個人プロファイル表示

- x 軸: CAT θ_recog (linked scale)
- y 軸: LJT `d'_primary`
- 四象限: high-both / high-recog-low-depth / low-recog-high-depth / low-both
- 副指標バー: `conditional_accuracy`, `mean_rt_app`, `mean_rt_inapp`

---

## 10. 画面フロー仕様

### 10.1 新規画面

```
<section id="ljt-intro-screen">     ← CAT 終了後の導入 + ヘッドホン推奨
<section id="ljt-headphone-check">  ← L/R/両耳 3 択
<section id="ljt-preload-screen">   ← 音声プリロード進捗
<section id="ljt-practice-screen">  ← 10 試行の練習
<section id="ljt-main-screen">      ← 80 試行の本番
<section id="ljt-pause-screen">     ← 40 試行目の任意休憩
<section id="ljt-result-screen">    ← 2 軸プロファイル
```

**intro 文言必須事項**:
- 「ヘッドホンまたはイヤホン着用必須。**有線接続を推奨**」
- 「Bluetooth 機器は音声遅延のため結果の信頼性が低下します」
- 「音声は各文について 1 回のみ再生されます」
- 「音声が終わってからのみボタンが押せます」
- 「約 1.6-2 秒以内に回答してください」

### 10.2 ヘッドホンチェック (L/R/両耳 3 択) + Bluetooth 能動検知 (v0.4)

3 つのビープ音を順に再生 (①左のみ、②右のみ、③両方)、各音後に 3 択で回答。3/3 正答で通過、3 回連続失敗で `headphone_check_result = fail`。

**Bluetooth 能動検知 (v0.4 新設)**: ヘッドホンチェック完了時に `audioContext.outputLatency` を記録:

| `outputLatency` | `connection_type_estimate` | 対応 |
|---|---|---|
| < 10 ms | `wired_internal` (内蔵/有線) | 正常、通過 |
| 10-20 ms | `wired_external_likely` (外部有線と推定) | 正常、通過 |
| **> 20 ms** | **`bluetooth_or_wireless`** (Bluetooth 可能性高) | intro 画面で「可能なら有線接続に切替推奨」dialog を再表示 |
| > 100 ms | `high_latency_warning` | 本番に進むかを被験者に確認、進む場合は `high_latency_flag` を meta に記録 |

これらは `ljt_session_meta.connection_type_estimate` および `audio_context_output_latency_ms` に記録され、後段分析で共変量投入可能 (§15.4 sensitivity)。

### 10.3 インタラクション制約

- 本番 80 試行中は localStorage に途中保存
- **途中離脱復帰は現試行からやり直し**
- `audio_replay_count = 0` を強制
- `visibilitychange` で tab blur 時は current trial を invalidate + warning dialog

---

## 11. 刺激文起案ワークフロー

### 11.1 事前フェーズ: LJT 適格性スクリーニング

1. LLM pre-screening (10 候補/語)
2. Native reviewer 1 名による `eligible` / `careful` / `exclude` 判定
3. Q-matrix の `ljt_eligibility` 列に反映

### 11.2 起案フロー

```
Q-matrix → LLM 初稿 → 自動検証 → Native レビュー 2 名 → 合議 → 音声生成
```

### 11.3 LLM プロンプトテンプレート

(v0.2 から継承、§3.4 の 4-5 失敗モードを明示)

### 11.4 自動検証 (v0.3 COCA 検証追加)

```python
# tools/validate_ljt_sentences.py
def validate(row):
    checks = {
        'length_ok':     4 <= len(row.sentence_text.split()) <= 8,
        'target_not_initial': row.sentence_text.split()[0].lower() != row.target_word.lower(),
        'target_present': row.target_word.lower() in [w.lower().strip('.,!?')
                                                       for w in row.sentence_text.split()],
        'single_target': sum(1 for w in row.sentence_text.split()
                              if w.lower().strip('.,!?') == row.target_word.lower()) == 1,
        'context_freq_ok': check_frequency(row.sentence_text, row.target_word, row.target_level),
        'no_subordination': not has_subordinating_conjunction(row.sentence_text),
        'foil_b_target_preserved': row.foil_type != 'b_collocation' or
                                    row.target_word in row.sentence_text,
        'no_idiom_overlap': check_coca_bigrams(row.sentence_text),  # v0.3 新規
    }
    return checks

import spacy

_NLP = spacy.load("en_core_web_sm", disable=["parser", "ner"])

def lemmatize(sentence: str) -> list[str]:
    """spaCy による lemmatization + 小文字化 + 句読点除去"""
    doc = _NLP(sentence)
    return [tok.lemma_.lower() for tok in doc
            if not tok.is_punct and not tok.is_space]

def check_coca_bigrams(sentence: str,
                        mi_threshold_coca: float = 3.0,
                        mi_threshold_gbooks: float = 2.5) -> tuple[bool, list]:
    """
    v0.4: lemmatization + bigram + trigram, COCA 一次 / Google Books 2-gram 代替
    戻り値: (clean_flag, hits) — hits は閾値超過した n-gram リスト
    """
    tokens = lemmatize(sentence)
    hits = []

    # Bigram チェック
    for i in range(len(tokens) - 1):
        bigram = (tokens[i], tokens[i+1])
        # Stop-word ペアは除外 (function-word bigram は高 MI でも慣用ではない)
        if _is_function_word_pair(bigram):
            continue
        mi_coca = get_bigram_mi(bigram, source="COCA")
        if mi_coca is not None and mi_coca > mi_threshold_coca:
            hits.append(("COCA_bigram", bigram, mi_coca))
            continue
        # フォールバック: COCA lookup miss で Google Books 2-gram
        if mi_coca is None:
            mi_gb = get_bigram_mi(bigram, source="GoogleBooks")
            if mi_gb is not None and mi_gb > mi_threshold_gbooks:
                hits.append(("GB_bigram", bigram, mi_gb))

    # Trigram チェック (3-gram 慣用対応)
    for i in range(len(tokens) - 2):
        trigram = tuple(tokens[i:i+3])
        mi_coca = get_trigram_mi(trigram, source="COCA")
        if mi_coca is not None and mi_coca > mi_threshold_coca:
            hits.append(("COCA_trigram", trigram, mi_coca))

    return (len(hits) == 0, hits)

def _is_function_word_pair(bigram: tuple) -> bool:
    """*of the*, *in a*, *to be* 等の純粋機能語ペアを除外"""
    FUNCTION_WORDS = {'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to',
                       'for', 'with', 'be', 'is', 'are', 'and', 'or'}
    return bigram[0] in FUNCTION_WORDS and bigram[1] in FUNCTION_WORDS
```

**COCA データソース (v0.4 拡張)**:
- **Primary**: COCA 上位 **1M bigram + 100K trigram** (有償 $395+、`tools/coca_ngrams.json` として同梱、GitHub Pages 配信対象外)
- **Fallback (v0.4 新設)**: Google Books 2-gram (無料、API 制限あり)。COCA lookup が miss した場合のみ参照、MI 閾値を 2.5 に緩和
- **備考**: COCA 入手不可の場合も Google Books のみで運用可能。`tools/build_ngram_lookup.py` で初回 ngram DB を構築

### 11.5 ネイティブレビューの判定基準

| 判定項目 | Appropriate | Inappropriate |
|---|---|---|
| Q1 | Tested sense で自然か? | 選択制限/collocation 違反か? |
| Q2 | 別 sense で解釈されないか? | 別 sense でも成立しないか? |
| Q3 | 英語として流暢か? | 非自然性が tested sense 起因か? |
| Q4 (b only) | | 置換された隣接語は collocate 外か? 別慣用で救済されないか? |

判定 = accept / revise / reject。

### 11.6 合議規則

- 両者 accept → final accept
- 1 accept + 1 revise → revision 適用後再 review
- 1 以上 reject → LLM 再起案 (3 候補 → 再 review)
- 3 ラウンド未収束 → `ljt_eligibility = exclude` 再分類

### 11.7 最終収束基準

- `final_decision = accepted` が eligible 項目で 100%
- `review_priority = critical` の全項目が 2 人 accept
- foil_type 配分 §3.4 規則満たす
- foil_subtype の多様化要件満たす
- `coca_bigram_max_mi > 3` 項目が 0

---

## 12. 既存アノテーションとの接続

### 12.1 新規 lexical annotation (83 項目)

既存 67 項目の形式に合わせて、残り 83 項目に対し:
- `loanword_status` + `cognate_ease` + `most_common_JP` + `lw_notes`
- `polysemy` + `cultural_tilt` + `school_curriculum_JP` + `translation_ambiguity_JP` + `sem_notes`
- `coca_rank_band` + `bnc_band` + `genre_skew` + `jp_eikyo` + `freq_notes`

LLM 初稿 + バイリンガル 1 名チェック。

### 12.2 JP_Anchoring DIF 分析への逆輸入 (pre-registration 警告)

`dict_1st_sense_match` を予測変数として追加するが、**post-hoc な変数追加**のため:

1. OSF に独立 pre-registration を作成
2. 既存モデルとの VIF チェック (> 5 警告、> 10 投入不可)
3. dat_all 150 に annotation 拡張後に推定 (C-flagged 67 のみだと EPV < 10)
4. 結果は exploratory / hypothesis-generating として明示

### 12.3 統合モデル (LJT 完了後)

```R
# H2 の confirmatory test (pre-registered)
glmer(is_correct_LJT ~ cognate_ease + polysemy_tier + translation_ambiguity_JP
                       + dict_1st_sense_match  # exploratory
                       + target_level + condition + foil_type + source
                       + matching_quality
                       + (condition|person) + (1|item),
      family = binomial(link = "probit"), data = ljt_long)
```

---

## 13. ファイル・ディレクトリ構成 + セキュリティ

```
App_CAT/
├── index.html                    ← LJT 画面追加 (C)
├── script.js                     ← LJT ロジック追加 (C)
├── ljt/
│   ├── design_ljt_spec.md        ← 本ファイル
│   ├── q_matrix.csv              ← §4
│   ├── ljt_sentences.csv         ← 起案 + レビュー履歴
│   ├── sentence_review_log.csv   ← レビュワー判定原データ
│   ├── audio_meta.csv            ← §8.4
│   ├── audio/
│   │   ├── uvlt_*_{appropriate|inappropriate}.wav (300 files)
│   │   └── practice/p<NN>_*.wav  (20 files)
│   ├── ljt_ui_spec.md            ← C 詳細画面仕様 (将来)
│   └── .gitignore                ← credentials/ を除外
└── tools/
    ├── generate_ljt_audio.py     ← B
    ├── validate_ljt_sentences.py ← §11.4
    ├── compute_sense_dominance.py ← §5.2
    ├── screen_ljt_eligibility.py ← §5.4 / §11.1
    ├── coca_bigrams.json          ← §11.4 (配信対象外)
    └── requirements.txt
```

### 13.1 Credentials 保護 (v0.3 強化)

- `gcloud auth application-default login` で個人アカウント (サービスアカウント JSON は**使用しない**)
- もし JSON 利用時は `.gitignore` で `credentials/` + `*.json` 含む credentials 名パターン除外
- **CI / pre-commit hook** で以下を強制:

```bash
# tools/check_no_credentials.sh (pre-commit hook + CI) — v0.4 拡張版
#!/bin/bash
set -e

# 1. Service account JSON の決定的マーカー (type field)
if git ls-files | xargs grep -lE '"type":\s*"service_account"' 2>/dev/null \
        | grep -v 'check_no_credentials'; then
    echo "ERROR: service_account type field detected"
    exit 1
fi

# 2. 鍵フィールド (private_key, private_key_id)
if git ls-files | xargs grep -lE '"private_key":|"private_key_id":' 2>/dev/null; then
    echo "ERROR: private_key or private_key_id field detected"
    exit 1
fi

# 3. Service account email (xxx@xxx.iam.gserviceaccount.com)
if git ls-files | xargs grep -lE '"client_email":\s*"[^"]+@[^"]+\.iam\.gserviceaccount\.com"' 2>/dev/null; then
    echo "ERROR: service account client_email detected"
    exit 1
fi

# 4. Google OAuth endpoint
if git ls-files | xargs grep -lE '"auth_uri":\s*"https://accounts\.google\.com/o/oauth2' 2>/dev/null; then
    echo "ERROR: Google OAuth auth_uri detected"
    exit 1
fi

# 5. PEM ブロック (インライン鍵)
if git ls-files | xargs grep -lE 'BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY' 2>/dev/null; then
    echo "ERROR: PEM private key block detected"
    exit 1
fi

# 6. ファイル名パターン (拡張子 + credentials ディレクトリ + 命名慣例)
if git ls-files | grep -E '\.(pem|p12|key|jks|p8)$|credentials/|_sa\.json$|-sa\.json$|service-account\.json$'; then
    echo "ERROR: credentials-related path detected"
    exit 1
fi

# 7. (推奨) detect-secrets 併用
if command -v detect-secrets &> /dev/null; then
    if ! detect-secrets scan --all-files --exclude-files '(node_modules|\.git/)' | \
         python -c 'import json, sys; d=json.load(sys.stdin); sys.exit(0 if not d["results"] else 1)'; then
        echo "ERROR: detect-secrets found potential secrets"
        exit 1
    fi
fi

exit 0
```

`.git/hooks/pre-commit` に symlink、GitHub Actions (`.github/workflows/security.yml`) に同等チェック併走。`detect-secrets` の依存追加 (`pip install detect-secrets`) を `tools/requirements.txt` の dev-extras に明記。

### 13.2 フィーチャフラグ

```javascript
CONFIG = {
    ENABLE_LJT_PHASE: true,  // false で CAT 単体動作
    LJT_PRACTICE_N: 10,
    LJT_MAIN_N: 80,
    LJT_DEADLINE_APP_MS: 1600,
    LJT_DEADLINE_INAPP_MS: 2000,
};
```

### 13.3 storageKey のバージョニング (v0.3 方針明確化)

```javascript
const STORAGE_KEY = 'uvlt_testlet_cat_github_pages_v2';

// 方針: v1 データは意図的破棄 (新規コホート募集のため既存 v1 参加者はゼロ前提)
// ベータ参加者がいる場合のみ、v1 の person_info のみを v2 にコピーする migration を実装
function migrateOrClearOldStorage() {
    const v1 = localStorage.getItem('uvlt_testlet_cat_github_pages_v1');
    if (v1) {
        // 現状: 無条件破棄 (新規コホート想定)
        localStorage.removeItem('uvlt_testlet_cat_github_pages_v1');
        console.log('v1 localStorage cleared (new cohort policy).');
        // 将来: ベータ参加者がいる場合のみ以下を有効化
        // try {
        //     const v1obj = JSON.parse(v1);
        //     const migrated = { participant: v1obj.session.participant, migrated_from: 'v1' };
        //     localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        // } catch(e) { /* corrupt v1 */ }
    }
}
```

**ENABLE_LJT_PHASE=false 時の state 形状**: `state.session.ljt = null` を明示設定し、`restoreState()` で `ljt === undefined || null` を安全に処理。

---

## 14. 練習項目 (v0.3 全面刷新)

GSL top 500 の UVLT 非重複語を使用。(a) 8 項目 + (b) 2 項目で、**(a) は強い選択制限違反を基本**、**(b) は名詞 target + 非慣用形容詞修飾**で統一。

**重要**: 下記は暫定案。起案前にネイティブレビュワー 2 名の合意確認が必要。v0.1/v0.2 の練習項目は 10 項目中 6-8 項目が慣用表現・比喩で救済されたため、v0.3 では foil の強度を大幅に上げ、metaphor rescue の候補を最小化した。

| # | target | POS | foil_type | foil_subtype | Appropriate (暫定) | Inappropriate (暫定) | 期待される foil 根拠 |
|---|---|---|---|---|---|---|---|
| 1 | eat | verb | a | edible | `She eats fresh vegetables every day.` | `She eats fresh silence every day.` | silence は -edible, -physical; v0.3/v0.4 の `drink` は UVLT 1K option のためルール違反、置換 (eat は UVLT 非重複確認済) |
| 2 | jump | verb | a | animate-physical | `The children jump on the mattress loudly.` | `The opinions jump on the mattress loudly.` | opinion は -animate-physical; v0.3/v0.4 の `write` は UVLT 1K option のためルール違反、置換 (jump は UVLT 非重複確認済) |
| 3 | sing | verb | a | musical | `They sing old songs on weekends.` | `They sing old bricks on weekends.` | bricks は -musical, sing の目的語選択違反、強固 |
| 4 | buy | verb | a | purchasable | `She buys fresh fish at the market.` | `She buys fresh darkness at the market.` | darkness は -tradeable で市場文脈に置けない; v0.3 の anger は *buy trouble/into anger* 連想で差替 |
| 5 | meet | verb | a | animate | `We met our teacher in the library.` | `We met our sunlight in the library.` | sunlight は -meetable-social-entity (WATCH: poetic rescue minor) |
| 6 | start | verb | a | eventive-subject | `The game starts at seven tonight.` | `The table starts at seven tonight.` | table は -event, start の主語選択違反、強固 |
| 7 | cook | verb | a | edible | `She cooks dinner for her family.` | `She cooks thunder for her family.` | thunder は -cookable-substance (atmospheric event); v0.3 の mathematics は *cook the books* 慣用拡張 risk のため差替 |
| 8 | listen | verb | a | audible | `She listens to music after dinner.` | `She listens to colors after dinner.` | colors は -audible (WATCH: synesthesia 救済 minor) |
| 9 | distance | noun | b | modifier_collocate | `The distance to the station is long.` | `The distance to the station is tall.` | *tall distance* は COCA collocate 外 (distance: long/short/great/vast/close); v0.3 の price は UVLT 1K target のためルール違反、置換 |
| 10 | smile | noun | b | modifier_collocate | `Her smile looked very warm tonight.` | `Her smile looked very rectangular tonight.` | *rectangular smile* は COCA collocate 外 (smile: bright/wide/warm/shy/forced 等); rectangular は厳密幾何形状で abstract noun 修飾にならない; v0.3/v0.4 の `voice` は UVLT 1K option のためルール違反、置換 (smile は UVLT 非重複確認済) |

### 14.1 練習項目の承認基準

- 各項目について native rater 2 名が独立に accept を付与
- Inappropriate 文が比喩・擬人化・詩的文脈で救済されないか確認
- **COCA bigram MI ≤ 3** の自動検証を通過
- 練習正答率 60% 未満の被験者には**追加 5 試行**を自動投入 (`ljt_session_meta.practice_accuracy` に記録)

### 14.2 練習項目の既知リスク

- **#5 meet + sunlight** (WATCH): 「太陽の光に出会う」という poetic 表現の余地。pilot で false-yes 率を測定し、> 25% なら置換
- **#8 listen + colors** (WATCH): synesthesia 概念 (音楽と色の共感覚) を知る被験者は救済するリスク。同様に pilot 測定
- その他 8 項目は強固な選択制限違反と判定

---

## 15. 統計分析計画

### 15.1 Primary analysis (pre-registered, confirmatory)

**Model**: Cross-classified GLMM with probit link (v0.3 で `source` および `matching_quality` 追加):

```R
library(lme4)
m_primary <- glmer(
    is_correct ~ condition * foil_type
                 + target_level
                 + cognate_ease
                 + polysemy_tier
                 + translation_ambiguity_JP
                 + source                     # v0.3 新規: CAT_correct vs theta_pad
                 + matching_quality           # v0.3 新規: full/partial/frame_only
                 + (condition | person)
                 + (1 | item),
    family = binomial(link = "probit"),
    data = ljt_long_data,
    control = glmerControl(optimizer = "bobyqa",
                            optCtrl = list(maxfun = 50000))
)
```

**Primary outcomes**:
- **H1 test (conjunction, §1.1)**:
  - 条件 A: `ICC_person ≥ 0.15`
    - **ICC 公式 (v0.4 明示)**: Nakagawa & Schielzeth (2013) の probit GLMM 版:
      ```
      ICC_person = σ²_person / (σ²_person + σ²_item + 1)
      ```
      probit link の residual 分散は 1 (標準正規前提)。Hox (2002) の式 (分母に `+1` なし) とは異なるため明示。
    - 加えて個人別 `p_LJT_correct | CAT_correct` の IQR ≥ 0.20
  - 条件 B: `source` 固定効果の probit β が有意 (α=0.025, Bonferroni within H1)
  - H1 支持: **A ∧ B**、partial は内部対応
- **H2 test**: `cognate_ease` の probit β ≤ -0.18 かつ ΔAIC ≥ 4 (nested comparison with/without cognate_ease)
- **H3 test**: `ranef(m_primary)$person` の BLUP と CAT θ との Pearson r、CI 報告

**Multiple comparisons**: primary 3 検定 (H1, H2, H3) に Holm-Bonferroni (α = 0.05 family)。H1 内部 2 条件は独立に Bonferroni α=0.025 each。

### 15.2 Secondary analyses (pre-registered)

- **d'_primary** (Hautus, §9.2)
- **Mean RT (correct-app)**
- **Raw accuracy / 80**

**FWER control (v0.3 追加)**: secondary 3 指標に対し **BH-FDR (α = 0.05)** を secondary tier 内で適用。Primary の Holm-Bonferroni とは独立に運用。

### 15.3 Exploratory analyses

- `p_LJT_correct | CAT_correct` vs `p_LJT_correct | theta_pad` person-level 差
- Conditional accuracy (Saito 2026 transformed)
- foil_subtype 層別 d' (power 低下のため exploratory)
- `dict_1st_sense_match` を予測変数とした追加モデル (post-hoc)

### 15.4 Sensitivity / robustness (v0.3 VIF 追加)

- **多重共線性事前チェック**:
  ```R
  library(car)
  # 注 (v0.4): car::vif() は GLMM 非対応のため lm で代替近似。
  # VIF は X 行列の相関構造のみで定義され outcome から独立なので、lm 近似で
  # GLMM の fixed effects の共線性を推定することは標準的な実務 (Fox & Monette 1992)。
  m_vif_check <- lm(as.numeric(is_correct) ~ condition * foil_type + target_level
                    + cognate_ease + polysemy_tier + translation_ambiguity_JP
                    + source + matching_quality, data = ljt_long_data)
  vif_results <- vif(m_vif_check)
  # VIF > 5 の予測変数:
  #   - β の点推定は報告
  #   - 独立効果 claim は制限 (H2 の判定条件に反映)
  # VIF > 10:
  #   - Primary GLMM から除外
  #   - Exploratory として別モデルで評価
  ```
- timeout 除外 d' との比較 (|Δ| > 0.2 で考察)
- `matching_quality = fail` 試行除外後の再推定
- `ljt_eligibility = careful` 項目除外後の item-level 再分析
- Mahalanobis 距離で person-level 多変量外れ値除外 (p < .001)

### 15.5 Power / precision (v0.3 全面訂正)

**d' の per-person SE** (Miller 1996 正確公式):
```
Var(z_H) = H(1-H) / [n_app · φ(z_H)²]
Var(z_F) = F(1-F) / [n_inapp · φ(z_F)²]
Var(d') = Var(z_H) + Var(z_F)
```

計算結果 (n_app = n_inapp = 40):

| H | F | SE(d') | 注 |
|---|---|---|---|
| 0.80 | 0.20 | **0.32** | 中央的な d' ≈ 1.68 |
| 0.95 | 0.05 | **0.47** | 極端値では SE 増大 (φ(z) 低下のため) |
| 0.70 | 0.30 | **0.29** | d' ≈ 1.05、中央寄りで精度相対的に高 (v0.4 訂正: 旧 0.26 は n≈50 相当) |

**foil_type 層別** (n=20 each): SE(d') ≈ **0.45**。個人差分析には十分だが、**層別 d' を primary に使わず GLMM 固定効果で推定する**方が power 上有利。

**群レベル** (N=200 想定): SE(mean d') = 0.32 / √200 = **0.023**。H3 の r=0.5 は N=200 で 95% CI ≈ [0.39, 0.60]、十分な精度。

**項目レベル n 不均一**:
- CAT は 150 中 18-36 項目を出題、人気項目 n ≥ 200、θ-pad 項目 n ≤ 30 の不均衡予想
- per-item GLMM では shrinkage で部分補正されるが、**per-item n ≥ 30** 閾値を事前設定、未満の項目は item-level DIF 解釈から除外

### 15.6 欠測・除外

**Session-level 除外**:
- ヘッドホンチェック 3 回連続失敗
- 練習正答率 < 40%
- 本番 timeout 率 > 40%
- `invalidated_trials_count > 10` (AudioContext 中断多発)

**Trial-level 除外**:
- `premature_click_count > 0` 試行は sensitivity 分析のみ
- `matching_quality = fail` 項目は primary から除外
- `invalidation_reason != null` 試行は全分析から除外

### 15.7 報告の哲学

- Primary 3 検定の結果は full 報告 (有意/非有意に関わらず)
- Secondary は summary statistics として報告、BH-FDR 適用
- Exploratory は "hypothesis-generating" ラベル付き
- 全モデル式・除外判断・sensitivity を OSF に pre-registration + analysis script 提出

---

## 16. 次のステップ

### 16.1 Q-matrix 生成タスク

1. `ljt/q_matrix_skeleton.csv` を `BAND_BLUEPRINTS` から自動生成
2. 83 項目の新規 lexical annotation
3. WordNet + LLM による dominance 推定
4. LJT 適格性 pre-screening

### 16.2 B (音声生成) への receipts

1. `tools/generate_ljt_audio.py` を新規作成 (§8.2)
2. 入力: `ljt/ljt_sentences.csv` (final accepted)
3. 出力: `ljt/audio/*.wav` + `ljt/audio_meta.csv`
4. 認証: `gcloud auth application-default login`
5. CI: 決定論的再生成 sha256 一致 + credentials scan

### 16.3 C (LJT 画面) への receipts

1. `index.html` に §10.1 セクション追加
2. `script.js` に以下:
   - `LJTController` (Web Audio API ベース、§7.2 擬似コード)
   - `LJTSentences` blueprint
   - `LJTScorer` (Hautus §9.2)
   - `LJTExporter` (`ljt_log`, `ljt_summary`, `ljt_session_meta`)
3. `CONFIG.ENABLE_LJT_PHASE = false` での回帰テスト
4. `storageKey` v2 + v1 クリア
5. Chromebook + 有線/Bluetooth 実機テスト

### 16.4 未決事項

- ネイティブレビュワー依頼先・謝礼
- パイロット → 本実施スケジュール
- IRB / 同意書文言
- 予算 (GCP TTS < $5、native review、参加者謝礼)

---

## References

- DeKeyser, R. (2017). Knowledge and skill in ISLA. In *The Routledge Handbook of Instructed Second Language Acquisition* (pp. 15-32). Routledge.
- Godfroid, A., Loewen, S., Jung, S., Park, J. H., Gass, S., & Ellis, R. (2015). Timed and untimed grammaticality judgments measure distinct types of knowledge. *Studies in Second Language Acquisition*, 37(2), 269-297.
- Hautus, M. J. (1995). Corrections for extreme proportions and their biasing effects on estimated values of d'. *Behavior Research Methods, Instruments, & Computers*, 27(1), 46-51.
- Macmillan, N. A., & Creelman, C. D. (2005). *Detection Theory: A User's Guide* (2nd ed.). Lawrence Erlbaum Associates.
- Miller, J. (1996). The sampling distribution of d'. *Perception & Psychophysics*, 58(1), 65-72.
- Saito, K., Hosaka, I., Suzukida, Y., Takizawa, K., & Uchihara, T. (2026). Timed vs. untimed lexicosemantic judgement task for measuring automatized phonological vocabulary knowledge. *Second Language Research*. https://doi.org/10.1177/02676583261420616
- Uchihara, T., Saito, K., Kurokawa, S., Takizawa, K., & Suzukida, Y. (2025). Declarative and automatized phonological vocabulary knowledge: Recognition, recall, lexicosemantic judgement, and listening-focused employability of L2 words. *Language Learning*, 75(2), 458–492. https://doi.org/10.1111/lang.12668
- Barr, D. J., Levy, R., Scheepers, C., & Tily, H. J. (2013). Random effects structure for confirmatory hypothesis testing: Keep it maximal. *Journal of Memory and Language*, 68(3), 255-278.

## 補助資料

- Saito et al. (2026) 刺激材料 (OSF): https://osf.io/jgudx/
- 本研究 GitHub: TBD
- 本研究 OSF pre-registration: TBD

---

## 付録 A: v0.1 → v0.2 Changelog (履歴)

前版 v0.1 での初期設計に対し、v0.2 で以下を修正:

- P0: §3.4 foil (b) 定義と worked example 精緻化、§14 練習項目全面刷新、§5.4 LJT 適格性フィルタ新設、§8.2 音声後処理バグ修正、§7.2 Web Audio API 明示、§13 storageKey v2 + ENABLE_LJT_PHASE
- P1: §1.0 理論的枠組み新設、§1.1 H1/H2/H3 定量化、§1.2.1 比較可能性マトリクス、§9.2 Hautus 全適用、§15 統計分析計画新設、§7.4 timeout RT null、§9.3 session_meta
- P2: §10.2 ヘッドホンチェック L/R/両耳、§8.3 プリロード戦略、§12.2 pre-registration 警告、§4.1 matching_quality、§10.1 Bluetooth 警告
