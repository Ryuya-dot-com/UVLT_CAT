# UVLT_CAT

UVLT を 2 段階で実施する研究用プロトタイプです。

- 第1段階: testlet-based CAT
- 第2段階: 音声版 LJT (Lexicosemantic Judgement Task)

現在の実装は、静的ブラウザアプリとして [App_CAT](App_CAT) にまとまっています。分析スクリプトは [Analysis](Analysis)、研究文書は [Manuscript](Manuscript) にあります。`Readings/` はローカル資料置き場で、公開 repo には含めません。

## 現在の測定フロー

1. 参加者情報を入力
2. CAT 練習 2 セット
3. CAT 本番 6-12 testlet
4. LJT 導入
5. ヘッドホンチェック
6. LJT 音声の preload
7. LJT 練習 20 trial
8. LJT 本番 80 trial
9. 結果表示と出力

CAT は `1k-5k` をまたぐ `50 testlet / 150 item` を対象に、`testlet-aware marginal EAP 近似` と `common-person cross-band linking` を使って推定します。LJT は UVLT CAT で正解した項目を意図的に再提示し、それらを音声 LJT で本当に使えるか検討します。current pilot では `untimed` で、`もう一度聞く` ボタンを有効にしており、replay 回数と複数基準の RT を記録します。

## 運用 UI の方針

通常の受験画面は参加者向けに簡素化しています。参加者には「今やること」と進行状況を中心に表示し、`theta`、`SE`、LJT の `source`、RT 詳細、routing 診断などの研究用情報は画面に出しません。

一方で、分析に必要な詳細情報は通常 URL から保存される Excel workbook に保持します。参加者には画面上で `theta`、`SE`、LJT source、RT 詳細などを見せませんが、研究者へ送付する Excel には `summary`、`estimates`、`item_responses`、`ljt_log`、`ljt_summary`、`ljt_session_meta` を含めます。JSON export と端末内一時保存の削除は研究者表示 (`?researcher=1`) で使います。

受験は PC を推奨します。ブラウザの戻る、再読み込み、別タブ移動はログに残り、途中状態は browser storage に一時保存されます。ヘッドホンチェックに 3 回失敗した場合は、参加者フローを止めて `再読み込みを推奨` し、研究者確認時のみ override 続行できます。

参加者がダウンロードした `UVLTCAT_*.xlsx` は、研究で指定した提出経路で研究者へ送付します。ファイル名と workbook には参加者名・学籍番号が含まれるため、GitHub issue / public repository / 公開チャットにはアップロードしない運用にします。自動保存に失敗した場合は、結果画面の `結果ファイルを保存` を使って再保存します。

## ディレクトリ構成

- [App_CAT](App_CAT): 実装本体。静的ブラウザアプリ、LJT 素材、補助スクリプト。
- [Analysis](Analysis): CAT / LJT export の分析テンプレートと JP anchoring 分析。
- [Manuscript](Manuscript): 研究計画、理論メモ、草稿。
- `Readings/`: 先行研究 PDF と calibration 用資料。ローカル専用で公開 repo には含めません。

## アプリ起動

`file://` で直接開くより、ローカル HTTP サーバーで起動する方が安全です。LJT は CSV と音声ファイルを `fetch()` するためです。

```bash
python3 -m http.server 8000 --directory App_CAT
```

ブラウザで `http://localhost:8000` を開きます。

GitHub Pages などの静的 hosting でも動作します。`App_CAT/index.html` を配信対象にし、`App_CAT/vendor/`、`App_CAT/ljt/*.csv`、`App_CAT/ljt/audio_meta.csv`、`App_CAT/ljt/audio/`、`App_CAT/ljt/audio/practice/` を同じ相対配置で公開してください。CSV や音声を更新した場合は、参加者にブラウザ reload を案内し、必要なら hosting 側の cache を無効化します。

## LJT 音声生成

Google Cloud Text-to-Speech を使います。認証は一度だけ `ADC` を作れば足ります。

```bash
gcloud auth application-default login
python3 -m pip install -r App_CAT/tools/requirements.txt
```

練習用:

```bash
python3 App_CAT/tools/generate_ljt_audio.py \
  App_CAT/ljt/practice_sentences_v0.5.csv
```

本番用:

```bash
python3 App_CAT/tools/generate_ljt_audio.py \
  App_CAT/ljt/ljt_sentences_draft.csv
```

現行設定は `en-US-Neural2-C`、`speaking_rate = 0.90` です。生成メタデータは [audio_meta.csv](App_CAT/ljt/audio_meta.csv) に出ます。

## Export 分析

Quarto で 2 系統のレポートを用意しています。

- [uvlt_export_analysis.qmd](Analysis/uvlt_export_analysis.qmd): 既存の CAT 中心レポート
- [uvlt_export_descriptives.qmd](Analysis/uvlt_export_descriptives.qmd): CAT + LJT の記述統計と可視化

例:

```bash
quarto render Analysis/uvlt_export_descriptives.qmd \
  -P export_xlsx=/absolute/path/to/UVLTCAT_xxx.xlsx
```

## 主な出力

通常 URL から保存する Excel workbook には少なくとも次のシートが入ります。

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

`ljt_log` には各 trial の `source` (`CAT_correct` / `theta_pad`) と `cat_item_correct_flag` が入り、CAT で正解した項目が LJT で使えるかを直接評価できます。`ljt_summary` には CAT 正解由来 trial と theta-pad trial の正答率を分けて出力します。`ljt_session_meta` には headphone failure action、preload、theta-pad sampling diagnostics、testlet cap diagnostics を保存します。

## 補足

- 途中状態は browser storage に一時保存されます。
- 保存不可環境でもアプリは継続動作しますが、resume は弱くなります。
- [App_CAT/ljt/design_ljt_spec.md](App_CAT/ljt/design_ljt_spec.md) には旧 timed 設計も残っています。現行実装との差分は冒頭メモを優先してください。
- 実装詳細は [App_CAT/README.md](App_CAT/README.md) を参照してください。
