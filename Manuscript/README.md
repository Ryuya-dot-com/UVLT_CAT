# UVLT 3問セットCAT 試作版

## 概要

このリポジトリは、**UVLT（Updated Vocabulary Levels Test）を testlet 単位で適応出題する研究用プロトタイプ**です。  
現在の実装は、**GitHub Pages で動作する静的サイト**を前提にしています。

主な特徴:

- 対象: `UVLT 1k–5k`
- 出題単位: `3問セット（testlet）`
- 項目バンク: `50セット / 150項目`
- 推定法: `testlet-aware marginal EAP 近似`
- 共通尺度化: `common-person cross-band linking`
- 次問選択: `expected posterior variance reduction`
- 停止規則: `最少 6 セット / 最大 12 セット / 目標 SE 到達`
- 結果保存: `Excel 自動保存 + JSON 手動保存`

## 現在の位置づけ

これは **研究用・試作検証用のプロトタイプ** です。  
完成済みの operational CAT ではありません。

以下の点に注意してください。

- **Open Science 前提**のため、項目文・選択肢・正答・尺度情報は公開されています。
- **高 stakes の本番試験運用**は想定していません。
- 語彙サイズ換算は、受験者向けの**補助的な解釈指標**です。
- 主スコアは、`testlet-aware marginal EAP 近似` による能力推定です。

## 実行方法

### GitHub Pages

`App_CAT/index.html` と `App_CAT/script.js` をそのまま公開できます。

### Quarto レポート

Excel 出力を分析する Quarto テンプレートは `Analysis/uvlt_export_analysis.qmd` です。  
`quarto` が PATH に通っている場合は、次のように実行できます。

```powershell
quarto render Analysis/uvlt_export_analysis.qmd -P export_xlsx="C:\path\to\UVLTCAT_xxx.xlsx"
```

Windows で `quarto` が PATH にない場合でも、RStudio 同梱版を直接呼べます。

```powershell
& "C:\Program Files\RStudio\resources\app\bin\quarto\bin\quarto.exe" render `
  "C:\path\to\UVLT_CAT\Analysis\uvlt_export_analysis.qmd" `
  -P export_xlsx="C:\path\to\UVLTCAT_xxx.xlsx"
```

必要な R パッケージは少なくとも `knitr`, `rmarkdown`, `readxl`, `dplyr`, `tidyr`, `purrr`, `gt`, `ggplot2` です。

### ローカル実行

PowerShell でルートに移動し、簡易サーバーを起動してください。

```powershell
Set-Location "C:\path\to\UVLT_CAT\App_CAT"
python -m http.server 8000
```

その後、ブラウザで次を開きます。

```text
http://localhost:8000
```

## 主要ファイル

- `App_CAT/index.html`  
  受験画面・結果画面を含む静的 UI

- `App_CAT/script.js`  
  項目バンク、推定、選択、停止規則、ログ、保存処理

- `App_CAT/vendor/xlsx.full.min.js`  
  Excel 出力用ライブラリ

- `App_CAT/tools/derive_cross_band_linking.py`  
  cross-band linking 係数の再計算スクリプト

- `Analysis/uvlt_export_analysis.qmd`  
  Excel 出力を読む Quarto 分析テンプレート

- `Manuscript/Scoring_Theoretical_Basis.md`  
  理論的根拠メモ

- `Manuscript/Research_Draft_LitReview_Methods.md`  
  先行研究レビューと方法の草案

- `Manuscript/Research_Plan_Sections_Polished.md`  
  研究計画書向けの完成稿

## 受験者情報と保存

- 入力項目: `学籍番号`、`受験者名`、`所属・クラス名`
- 保存名: `UVLTCAT_学籍番号_受験者名_YYYYMMDD-HHMMSS`
- 出力:
  - `Excel (.xlsx)` は終了時に自動保存
  - `JSON (.json)` は必要に応じて手動保存
- 途中状態はブラウザに一時保存されますが、**24時間で自動削除**されます。

## 現在の測定設計

### 項目構造

- UVLT を独立項目ではなく `3問セット` として扱います。
- 各セット内では、同じ語を重複して選べません。

### 推定

- 能力推定は `testlet-aware marginal EAP 近似`
- testlet 分散は band ごとに保持
- 数値積分は `15点 Gauss-Hermite`

### 共通尺度化

- `Study01_UVLT` の complete-case respondents を用いて `common-person linking`
- band 別 difficulty を linked multi-band theta scale に変換

### 適応出題

- 初回は中難度セットから開始
- 2セット目以降は `expected posterior variance reduction` を基準に選択
- 選択計算は速度と安定性のため、`θ = -6..6` の粗いグリッド（`0.2`刻み）で近似
- routing と coverage penalty により、帯域の偏りを抑制

### 補助指標

- band ごとの理解目安
- 推定語彙サイズ
- 所要時間
- 結果の安定性

## 参考文書

理論的な位置づけや先行研究との関係は、次を参照してください。

- `Manuscript/Scoring_Theoretical_Basis.md`
- `Manuscript/Research_Draft_LitReview_Methods.md`
- `Manuscript/Research_Plan_Sections_Polished.md`

## GitHub 公開方針

### 基本的に GitHub に載せるもの

- `App_CAT/index.html`, `App_CAT/script.js`, `App_CAT/vendor/`
- `Analysis/uvlt_export_analysis.qmd`
- `App_CAT/tools/` 内の再計算・検証用スクリプト
- `README.md` や研究メモ類

### GitHub に載せないもの

- 受験終了時に生成される `UVLTCAT_*.xlsx`
- 手動保存する `UVLTCAT_*.json`
- Quarto のレンダリング生成物 (`reports/output/`, `reports/*.html`, `reports/*_files/`)
- 一時ディレクトリ (`reports/.quarto/`, `_tmp_chrome_profile/`, `__pycache__/`)

### 公開前に個別確認した方がよいもの

- `Study01_UVLT`, `Study02_EMT` の元データや calibration 用ファイル
- 論文 PDF や配布条件が不明な外部資料

公開リポジトリにする場合は、**生成物を除く**だけでなく、**再配布してよい研究資料かどうか**も確認してください。

## 旧プロトタイプについて

初期段階の「リポジトリ直下で運用する」想定の名残は一部文書に残っています。  
現在の実装の中心は **`App_CAT/` 配下の `index.html` と `script.js`** です。
