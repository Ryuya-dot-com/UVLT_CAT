# App_CAT README

## 概要

[App_CAT](.) には、UVLT の 2 段階測定を行う静的ブラウザアプリが入っています。

- 第1段階: testlet-based CAT
- 第2段階: 音声版 LJT

ビルド工程はありません。実行時は `index.html` を直接開くより、ローカル HTTP サーバーで配信する前提です。repository root から起動する場合は次を使います。

```bash
python3 -m http.server 8000 --directory App_CAT
```

ブラウザで `http://localhost:8000` を開きます。

既定では参加者向けの簡潔な UI を表示します。通常運用では、受験者に `theta`、`SE`、routing 診断、LJT source、RT 詳細を見せません。通常 URL の保存ボタンと自動保存は、研究者へ送付する詳細 Excel workbook を出力します。JSON export と端末内一時保存の削除を使う場合は `http://localhost:8000/?researcher=1` を開きます。

参加者がダウンロードした `UVLTCAT_*.xlsx` は、研究で指定した提出経路で研究者へ送付します。ファイル名と workbook には参加者名・学籍番号が含まれるため、public GitHub repo や issue にはアップロードしない運用にします。自動保存に失敗した場合は、結果画面の `結果ファイルを保存` で再保存できます。

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

CAT は `50 testlet / 150 item` を対象に、`testlet-aware marginal EAP 近似` で推定します。LJT は CAT 正解項目を意図的に再提示し、それらを音声 LJT で本当に使えるか検討します。current pilot では `untimed` で、`もう一度聞く` ボタンを有効にしており、replay 回数と RT を trial 単位で記録します。

## 画面と運用

- 受験は PC 推奨です。小画面でも動作しますが、CAT の matching table と LJT の音声回答は PC の方が安定します。
- 受験者画面は「次に何をするか」と進行状況を中心にしています。
- CAT 練習、CAT 本番、LJT preload、LJT 練習、LJT 本番には進捗バーがあります。
- LJT では音声再生中は回答ボタンが disabled になり、回答可能になると状態表示とボタンの見た目が変わります。
- ヘッドホンチェックに 3 回失敗した場合は自動続行せず、`再読み込みを推奨` を表示します。`?researcher=1` の確認表示では研究者 override が使えます。
- ページ再読み込みや途中復帰時は、再開位置を画面に表示し、中断 trial は export 上で invalidated として残します。

## 静的 hosting

GitHub Pages などで公開する場合は、`App_CAT` の中身を同じ相対配置で配信します。特に次を欠かさず含めます。

- `index.html`
- `script.js`
- `ljt/ljt_module.js`
- `vendor/xlsx.full.min.js`
- `ljt/*.csv`
- `ljt/audio_meta.csv`
- `ljt/audio/` と `ljt/audio/practice/` の `.wav`

CSV や音声を更新した場合は、参加者に reload を案内し、必要なら hosting 側の cache を無効化します。

## 主要ファイル

| パス | 役割 |
| --- | --- |
| [index.html](index.html) | CAT と LJT の画面、スタイル、基本 UI |
| [script.js](script.js) | CAT ロジック、状態保存、結果表示、Excel / JSON 出力 |
| [ljt/ljt_module.js](ljt/ljt_module.js) | LJT の画面制御、音声再生、trial logging、LJT 用 Excel シート生成 |
| [ljt/design_ljt_spec.md](ljt/design_ljt_spec.md) | LJT 設計仕様。現行実装との差分メモ付き |
| [vendor/xlsx.full.min.js](vendor/xlsx.full.min.js) | Excel 出力用 SheetJS |
| [tools](tools) | linking・simulation・LJT 文作成・音声生成などの補助スクリプト |

## 現行設定の要点

[script.js](script.js) の `CONFIG` に主要設定があります。

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
- `LJT_THETA_PAD_MAX_PER_TESTLET = 1`

storage key は `uvlt_testlet_cat_github_pages_v2` です。保存不能環境でも落ちずに継続するようにしてあり、回答途中の draft も保存対象です。

## LJT 音声

LJT 音声素材は [ljt](ljt) にあります。

- [practice_sentences_v0.5.csv](ljt/practice_sentences_v0.5.csv)
- [ljt_sentences_draft.csv](ljt/ljt_sentences_draft.csv)
- [audio_meta.csv](ljt/audio_meta.csv)
- `audio/` と `audio/practice/` の `.wav`

生成は [generate_ljt_audio.py](tools/generate_ljt_audio.py) を使います。現行設定は `en-US-Neural2-C`、`speaking_rate = 0.90` です。

```bash
gcloud auth application-default login
python3 -m pip install -r tools/requirements.txt

python3 tools/generate_ljt_audio.py \
  ljt/practice_sentences_v0.5.csv

python3 tools/generate_ljt_audio.py \
  ljt/ljt_sentences_draft.csv
```

## 結果出力

通常 URL から保存される Excel には CAT の基本シートに加えて、LJT 実施時は次のシートが追加されます。

- `ljt_log`
- `ljt_summary`
- `ljt_session_meta`

特に `ljt_log` には以下が入ります。

- `source` (`CAT_correct` / `theta_pad`)
- `cat_item_correct_flag`
- sampling strata / linked difficulty / tested sense
- replay 回数
- 総再生回数
- 再生イベント JSON
- first offset / last offset 基準 RT
- invalidation 情報

`ljt_summary` には `p_LJT_correct_among_CAT_correct` と `p_LJT_correct_among_theta_pad` が入り、CAT 正解項目を LJT で本当に使えるかを source 別に確認できます。`ljt_session_meta` には headphone check result / failure action、Bluetooth warning action、preload failure、theta-pad sampling diagnostics、testlet cap diagnostics が入ります。

## 分析レポート

workbook を読む Quarto 文書は [Analysis](../Analysis) にあります。

- [uvlt_export_analysis.qmd](../Analysis/uvlt_export_analysis.qmd): CAT 中心
- [uvlt_export_descriptives.qmd](../Analysis/uvlt_export_descriptives.qmd): CAT + LJT 記述統計

例:

```bash
quarto render Analysis/uvlt_export_descriptives.qmd \
  -P export_xlsx=/absolute/path/to/UVLTCAT_xxx.xlsx
```

## 補助スクリプト

[tools](tools) の主要スクリプト:

- [derive_cross_band_linking.py](tools/derive_cross_band_linking.py): linking 係数再計算
- [run_simulation_study.py](tools/run_simulation_study.py): CAT simulation
- [generate_q_matrix.py](tools/generate_q_matrix.py): blueprint から Q-matrix 生成
- [validate_ljt_sentences.py](tools/validate_ljt_sentences.py): LJT 文の検証
- [generate_ljt_audio.py](tools/generate_ljt_audio.py): Google Cloud TTS で音声生成

## 注意

- `index.html` の ID を変えると、`script.js` と `ljt/ljt_module.js` の両方を追随させる必要があります。
- `ljt/design_ljt_spec.md` には旧 timed 設計の記述も残っています。現行挙動は実装と冒頭メモを優先してください。
- export workbook や JSON は生成物なので、公開用 repo に含めない方が安全です。
