# App_CAT README

## 概要

このディレクトリには、UVLT 用の静的な 1 ページアプリが入っています。  
受験者は最初に基本情報を入力し、2 セットの練習問題を解いたあと、本番の CAT に進みます。  
本番では 1k から 5k までの語彙帯域をまたいで testlet を選択し、回答後に能力推定値を更新しながら次のセットを切り替えます。

ビルド工程はありません。`index.html` をブラウザで開けば動作します。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | 画面の HTML とスタイル定義を持つ本体。イントロ、練習、本番、結果の 4 画面を 1 ファイル内で切り替えます。 |
| `script.js` | 問題バンク、CAT の選択ロジック、能力推定、状態保存、イベント記録、結果表示、JSON / Excel 出力を担当します。 |
| `vendor/xlsx.full.min.js` | Excel 出力用の SheetJS ライブラリです。 |

`index.html` では CSS を `<style>` に内包しており、外部のスタイルシートは使っていません。  
`script.js` は `index.html` 内の各 DOM 要素を ID で参照しているため、主要な要素 ID を変更する場合は両方を合わせて直す必要があります。

## 画面構成

`index.html` には次の 4 セクションがあります。

1. `intro-screen`
   受験者情報の入力画面です。学籍番号、氏名、所属を入力して練習を開始します。
2. `practice-screen`
   練習問題 2 セットを表示します。回答後に正誤フィードバックを出します。
3. `test-screen`
   本番画面です。CAT により選ばれた testlet を 1 セットずつ表示します。
4. `result-screen`
   語彙サイズ推定、帯域別の診断、受験のタイムライン、エクスポート状態を表示します。

画面の切り替えは `script.js` の `setScreen()` が担当します。

## `script.js` の構成

### 1. 設定値と固定データ

ファイル冒頭の `CONFIG` に、CAT の基本設定があります。

- `minTestlets`: 最低出題数。現在は 6
- `maxTestlets`: 最大出題数。現在は 12
- `targetSE`: 停止基準となる標準誤差。現在は 0.52
- `selectionMetricType`: 次の testlet を選ぶ指標。現在は `expectedPosteriorVarianceReduction`
- `storageTTLHours`: 途中状態を `localStorage` に保持する時間。現在は 24 時間
- `quadraturePoints`: testlet-aware 推定で使う積分点数。現在は 15

固定データとして、以下を同じファイルに持っています。

- `PRACTICE_TESTLETS`: 練習用 2 セット
- `RAW_BAND_REFERENCE`: 各帯域の元の項目難易度
- `CROSS_BAND_LINKING`: 共通受験者法で推定した帯域間リンク係数
- `RAW_TESTLET_VARIANCES`: testlet 分散
- `BAND_BLUEPRINTS`: 各帯域の問題セット定義

現在の問題バンクは 5 帯域 (`1k` から `5k`) × 各 10 testlet × 各 3 項目で、合計 50 testlet / 150 項目です。

### 2. 問題バンク生成

`buildTestBank()` が `BAND_BLUEPRINTS`、難易度、分散情報をまとめて `TEST_BANK` を作ります。  
各 testlet には次のような情報が入ります。

- `testletId`
- `level`
- `positionInForm`
- `testletVariance`
- `selectionDifficulty`
- `definitions`（各項目の prompt / correctOption / difficulty）

この段階で `itemMap` も作られ、後続の記録出力で参照しやすい形になります。

### 3. 状態管理と DOM 参照

- `state`: アプリ全体の状態
- `elements`: `index.html` 内の主要 DOM 要素参照

セッション開始時は `createFreshSession()` が呼ばれ、以下を初期化します。

- 受験者情報
- 練習回答ログ
- 本番回答ログ
- 推定値履歴
- 選択された testlet の履歴
- イベントログ
- エクスポート状態

途中状態は `persistState()` により `localStorage` へ保存され、`restoreState()` が 24 時間以内なら復元します。  
保存キーは `uvlt_testlet_cat_github_pages_v1` です。

### 4. 練習フェーズ

流れは次の通りです。

1. `startPracticeFlow()` が入力欄を検証し、セッションを開始
2. `renderPractice()` が練習セットを描画
3. `handlePracticeSubmit()` が選択を回収し、正誤フィードバックを表示
4. 練習 2 セット終了後、`startOperationalPhase()` で本番に移行

各セットは「3 つの定義に対して 6 語から 1 語ずつ選ぶ」形式です。  
同じ語を 1 セット内で重複選択できないよう `wireExclusiveChoices()` で制御しています。

### 5. 本番フェーズと CAT

本番の主な処理は以下です。

- `queueNextOperationalTestlet()`: 次の testlet を決定
- `getInitialTestletSelection()`: 初回出題を決定
- `getNextTestletSelection()`: 推定値に応じて次の候補を順位付け
- `handleTestSubmit()`: 回答を保存し、能力推定を更新
- `shouldStop()`: 停止条件を判定

選択ロジックの概要:

- 現在の θ に最も近い帯域と、その隣接帯域を候補にします
- 候補内の未使用 testlet を評価します
- 主指標として `expectedPosteriorVarianceReduction` を使います
- 同一帯域に偏りすぎないよう軽いペナルティを加えます
- 最高スコアの testlet を次に出題します

停止条件:

- 6 セット未満では停止しない
- 標準誤差が `0.52` 以下になれば終了
- ただし最大 12 セットで必ず終了

### 6. 能力推定

能力推定は 2 系統を計算しています。

- `estimateAbility()`: linked Rasch ベース
- `estimateTestletAwareAbility()`: testlet-aware marginal EAP

実際の運用値としては `buildOperationalEstimate()` で testlet-aware marginal EAP を採用しています。  
一方で linked Rasch の結果も保持しており、エクスポート時に両方確認できます。

### 7. 安全対策とイベント記録

受験中の離脱や復帰を記録する仕組みがあります。

- `beforeunload`: 再読み込み・離脱の試行
- `popstate`: ブラウザの戻る操作
- `visibilitychange`: 別タブや別アプリへの移動
- `pagehide` / `pageshow`: 非表示化やキャッシュ復帰

これらは `eventLog` に保存され、結果の信頼性表示にも使われます。  
結果画面の「結果の信頼性」は、主に標準誤差と中断イベント回数から判定しています。

## 結果画面と出力

結果画面では次を表示します。

- 推定語彙サイズ
- 推定レンジ
- 強みのある帯域
- 今後の重点帯域
- 出題数と所要時間
- 帯域別診断
- testlet ごとのタイムライン
- フィードバック文

### JSON 出力

`downloadJson()` が現在の `state.session` をそのまま JSON で保存します。  
必要に応じて手動保存する前提です。

### Excel 出力

`downloadExcel()` と `autoDownloadExcel()` が Excel を作成します。  
本番終了時には自動保存を試み、必要なら結果画面のボタンから再保存できます。

Excel には次のシートが入ります。

- `summary`
- `band_diagnostics`
- `testlet_log`
- `item_responses`
- `practice`
- `estimates`
- `session_events`
- `routing_summary`
- `linking_coeffs`
- `testlet_variance`

## 修正ポイントの目安

変更したい内容ごとの主な編集箇所は次の通りです。

| 変更内容 | 主な編集箇所 |
| --- | --- |
| 画面文言やレイアウト | `index.html` |
| 色・余白・レスポンシブ調整 | `index.html` の `<style>` |
| 練習問題 | `script.js` の `PRACTICE_TESTLETS` |
| 問題バンク | `script.js` の `BAND_BLUEPRINTS` |
| 難易度やリンク係数 | `script.js` の `RAW_BAND_REFERENCE` / `CROSS_BAND_LINKING` / `RAW_TESTLET_VARIANCES` |
| 停止条件や保存時間 | `script.js` の `CONFIG` |
| 結果画面の説明文 | `script.js` の `renderFeedbackItems()` や `renderResults()` |
| Excel 出力列やシート | `script.js` の `create*Rows()` / `buildExcelWorkbook()` |

## 開発補助

`initialize()` の最後で `window.UVLT_CAT_DEV` を公開しています。  
ブラウザの開発者ツールから以下を利用できます。

- `window.UVLT_CAT_DEV.currentConfig`
- `window.UVLT_CAT_DEV.linking`
- `window.UVLT_CAT_DEV.runSimulationSuite(sampleSize, seed)`
- `window.UVLT_CAT_DEV.runSimulationSuiteWithConfig(overrides, sampleSize, seed)`

CAT の挙動を試験的に検証したいときに便利です。

## 補足

- 日本語文言を編集する場合は、ファイルを UTF-8 で保存してください。
- `index.html` の ID 名を変えると、`script.js` の `elements` 定義も更新が必要です。
- Excel 出力は `vendor/xlsx.full.min.js` の読み込みに依存します。
