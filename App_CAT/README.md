# App_CAT README

## 概要

[App_CAT](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT) には、UVLT の 2 段階測定を行う静的ブラウザアプリが入っています。

- 第1段階: testlet-based CAT
- 第2段階: 音声版 LJT

ビルド工程はありません。実行時は `index.html` を直接開くより、ローカル HTTP サーバーで配信する前提です。

```bash
cd /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。

既定では参加者向けの簡潔な UI を表示します。研究者向けの詳細指標・保存操作・診断表示を出す場合は `http://localhost:8000/?researcher=1` を使います。

## 受験フロー

1. 参加者情報入力
2. CAT 練習 2 セット
3. CAT 本番 6-12 testlet
4. LJT 導入
5. ヘッドホンチェック
6. LJT 音声 preload
7. LJT 練習 20 trial
8. LJT 本番 80 trial
9. LJT 結果
10. 総合結果と export

CAT は `50 testlet / 150 item` を対象に、`testlet-aware marginal EAP` で推定します。LJT は current pilot では `untimed` で、`もう一度聞く` ボタンを有効にしており、replay 回数と RT を trial 単位で記録します。

## 主要ファイル

| パス | 役割 |
| --- | --- |
| [index.html](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/index.html) | CAT と LJT の画面、スタイル、基本 UI |
| [script.js](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/script.js) | CAT ロジック、状態保存、結果表示、Excel / JSON 出力 |
| [ljt/ljt_module.js](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/ljt_module.js) | LJT の画面制御、音声再生、trial logging、LJT 用 Excel シート生成 |
| [ljt/design_ljt_spec.md](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/design_ljt_spec.md) | LJT 設計仕様。現行実装との差分メモ付き |
| [vendor/xlsx.full.min.js](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/vendor/xlsx.full.min.js) | Excel 出力用 SheetJS |
| [tools](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools) | linking・simulation・LJT 文作成・音声生成などの補助スクリプト |

## 現行設定の要点

[script.js](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/script.js) の `CONFIG` に主要設定があります。

- `minTestlets = 6`
- `maxTestlets = 12`
- `targetSE = 0.52`
- `selectionMetricType = "expectedPosteriorVarianceReduction"`
- `storageTTLHours = 24`
- `ENABLE_LJT_PHASE = true`
- `LJT_RESPONSE_MODE = "untimed"`
- `LJT_ALLOW_REPLAY = true`
- `LJT_MAIN_N = 80`
- `LJT_TARGET_N = 40`

storage key は `uvlt_testlet_cat_github_pages_v2` です。保存不能環境でも落ちずに継続するようにしてあり、回答途中の draft も保存対象です。

## LJT 音声

LJT 音声素材は [ljt](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt) にあります。

- [practice_sentences_v0.5.csv](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/practice_sentences_v0.5.csv)
- [ljt_sentences_draft.csv](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/ljt_sentences_draft.csv)
- [audio_meta.csv](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/audio_meta.csv)
- `audio/` と `audio/practice/` の `.wav`

生成は [generate_ljt_audio.py](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/generate_ljt_audio.py) を使います。現行設定は `en-US-Neural2-C`、`speaking_rate = 0.90` です。

```bash
gcloud auth application-default login
python3 -m pip install -r /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/requirements.txt

python3 /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/generate_ljt_audio.py \
  /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/practice_sentences_v0.5.csv

python3 /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/generate_ljt_audio.py \
  /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/ljt_sentences_draft.csv
```

## 結果出力

Excel には CAT の基本シートに加えて、LJT 実施時は次のシートが追加されます。

- `ljt_log`
- `ljt_summary`
- `ljt_session_meta`

特に `ljt_log` には以下が入ります。

- replay 回数
- 総再生回数
- 再生イベント JSON
- first offset / last offset 基準 RT
- invalidation 情報

## 分析レポート

workbook を読む Quarto 文書は [Analysis](/Users/tohokusla/Dropbox/UVLT_CAT/Analysis) にあります。

- [uvlt_export_analysis.qmd](/Users/tohokusla/Dropbox/UVLT_CAT/Analysis/uvlt_export_analysis.qmd): CAT 中心
- [uvlt_export_descriptives.qmd](/Users/tohokusla/Dropbox/UVLT_CAT/Analysis/uvlt_export_descriptives.qmd): CAT + LJT 記述統計

例:

```bash
cd /Users/tohokusla/Dropbox/UVLT_CAT
quarto render Analysis/uvlt_export_descriptives.qmd \
  -P export_xlsx=/absolute/path/to/UVLTCAT_xxx.xlsx
```

## 補助スクリプト

[tools](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools) の主要スクリプト:

- [derive_cross_band_linking.py](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/derive_cross_band_linking.py): linking 係数再計算
- [run_simulation_study.py](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/run_simulation_study.py): CAT simulation
- [generate_q_matrix.py](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/generate_q_matrix.py): blueprint から Q-matrix 生成
- [validate_ljt_sentences.py](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/validate_ljt_sentences.py): LJT 文の検証
- [generate_ljt_audio.py](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/generate_ljt_audio.py): Google Cloud TTS で音声生成

## 注意

- `index.html` の ID を変えると、`script.js` と `ljt/ljt_module.js` の両方を追随させる必要があります。
- `ljt/design_ljt_spec.md` には旧 timed 設計の記述も残っています。現行挙動は実装と冒頭メモを優先してください。
- export workbook や JSON は生成物なので、公開用 repo に含めない方が安全です。
