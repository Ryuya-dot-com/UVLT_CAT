# UVLT_CAT

UVLT を 2 段階で実施する研究用プロトタイプです。

- 第1段階: testlet-based CAT
- 第2段階: 音声版 LJT (Lexicosemantic Judgement Task)

現在の実装は、静的ブラウザアプリとして [App_CAT](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT) にまとまっています。分析スクリプトは [Analysis](/Users/tohokusla/Dropbox/UVLT_CAT/Analysis)、研究文書は [Manuscript](/Users/tohokusla/Dropbox/UVLT_CAT/Manuscript)、元データや文献は [Readings](/Users/tohokusla/Dropbox/UVLT_CAT/Readings) にあります。

## 現在の測定フロー

1. 参加者情報を入力
2. CAT 練習 2 セット
3. CAT 本番 6-12 testlet
4. LJT 導入
5. ヘッドホンチェック
6. LJT 音声の preload
7. LJT 練習 20 trial
8. LJT 本番 80 trial
9. 結果表示と Excel / JSON 出力

CAT は `1k-5k` をまたぐ `50 testlet / 150 item` を対象に、`testlet-aware marginal EAP` と `common-person cross-band linking` を使って推定します。LJT は current pilot では `untimed` で、`もう一度聞く` ボタンを有効にしており、replay 回数と複数基準の RT を記録します。

## ディレクトリ構成

- [App_CAT](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT): 実装本体。静的ブラウザアプリ、LJT 素材、補助スクリプト。
- [Analysis](/Users/tohokusla/Dropbox/UVLT_CAT/Analysis): CAT / LJT export の分析テンプレートと JP anchoring 分析。
- [Manuscript](/Users/tohokusla/Dropbox/UVLT_CAT/Manuscript): 研究計画、理論メモ、草稿。
- [Readings](/Users/tohokusla/Dropbox/UVLT_CAT/Readings): 先行研究 PDF と calibration 用資料。

## アプリ起動

`file://` で直接開くより、ローカル HTTP サーバーで起動する方が安全です。LJT は CSV と音声ファイルを `fetch()` するためです。

```bash
cd /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。

## LJT 音声生成

Google Cloud Text-to-Speech を使います。認証は一度だけ `ADC` を作れば足ります。

```bash
gcloud auth application-default login
python3 -m pip install -r /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/requirements.txt
```

練習用:

```bash
python3 /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/generate_ljt_audio.py \
  /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/practice_sentences_v0.5.csv
```

本番用:

```bash
python3 /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/tools/generate_ljt_audio.py \
  /Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/ljt_sentences_draft.csv
```

現行設定は `en-US-Neural2-C`、`speaking_rate = 0.90` です。生成メタデータは [audio_meta.csv](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/audio_meta.csv) に出ます。

## Export 分析

Quarto で 2 系統のレポートを用意しています。

- [uvlt_export_analysis.qmd](/Users/tohokusla/Dropbox/UVLT_CAT/Analysis/uvlt_export_analysis.qmd): 既存の CAT 中心レポート
- [uvlt_export_descriptives.qmd](/Users/tohokusla/Dropbox/UVLT_CAT/Analysis/uvlt_export_descriptives.qmd): CAT + LJT の記述統計と可視化

例:

```bash
cd /Users/tohokusla/Dropbox/UVLT_CAT
quarto render Analysis/uvlt_export_descriptives.qmd \
  -P export_xlsx=/absolute/path/to/UVLTCAT_xxx.xlsx
```

## 主な出力

Excel workbook には少なくとも次のシートが入ります。

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

LJT を実施したセッションでは追加で次が入ります。

- `ljt_log`
- `ljt_summary`
- `ljt_session_meta`

## 補足

- 途中状態は browser storage に一時保存されます。
- 保存不可環境でもアプリは継続動作しますが、resume は弱くなります。
- [App_CAT/ljt/design_ljt_spec.md](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/ljt/design_ljt_spec.md) には旧 timed 設計も残っています。現行実装との差分は冒頭メモを優先してください。
- 実装詳細は [App_CAT/README.md](/Users/tohokusla/Dropbox/UVLT_CAT/App_CAT/README.md) を参照してください。
