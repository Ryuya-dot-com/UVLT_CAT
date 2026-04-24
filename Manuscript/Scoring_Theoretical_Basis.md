# UVLT 3問セットCAT 試作版: 理論的根拠メモ

## 1. 結論

この試作版は、**先行研究に依拠している**。ただし、すべてが既存研究の完全再現ではない。  
実装は次の3層に分かれる。

1. **先行研究をほぼそのまま受けている部分**
2. **標準的な測定理論を使って本研究用に実装した部分**
3. **受験者向けフィードバックのための暫定的・実務的な部分**

## 2. Web で確認した主要先行研究

### 2.1 UVLT そのものの基礎

- **Webb, Sasao, & Ballance (2017)**  
  UVLT の中心文献である。Benjamins の公開メタデータでは、**1000–5000語の5水準**、**1,463名を用いた項目選定**、さらに**250名での評価**が示されている。  
  このため、本試作版が `UVLT 1k–5k` を対象にすること自体は、明確にこの研究に依拠している。  
  参照: [Benjamins article page](https://www.benjamins.com/catalog/itl.168.1.02web)

### 2.2 UVLT の matching 形式と local item dependence

- **Ha (2022)**  
  Frontiers の本文では、UVLT の **3-item-per-cluster matching format** と local item dependence の強い関連が報告されている。  
  同論文は、UVLT で**同一クラスター内の項目間に強い残差相関**が見られ、一部は **0.70超**であったと報告している。  
  このため、UVLT を単純な独立項目CATとして扱うより、**testlet 単位で扱う**という判断の根拠になる。  
  参照: [Frontiers full text](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.805450/full)

- **Yen (1984)**  
  local item dependence が IRT の適合と equating に影響し得ることを早期に示した基礎文献である。  
  Q2 / Q3 による局所依存の検出と、局所独立性の破れを統計的推定の問題として扱う視点は、本試作版で LID を中心論点に置く理由を支える。  
  参照: [University Digital Conservancy](https://conservancy.umn.edu/items/93af21c3-e468-4772-9576-41e92f0d353c)

- **Ha et al. (2025a)**  
  Taylor & Francis の公開メタデータと要約では、語彙 matching test の LID 検出法として **Yen’s Q3** と **Rasch testlet modeling** を比較している。  
  要約レベルでも、RTM が method-specific variance をモデル化できることが明示されており、**testlet-aware な較正・推定**を採る理論的な後押しになる。  
  参照: [Language Assessment Quarterly article page](https://www.tandfonline.com/doi/full/10.1080/15434303.2025.2456953)

### 2.3 testlet-based CAT の理論

- **Wainer, Bradlow, & Du (2000)**  
  testlet-based adaptive testing に使う **Testlet Response Theory** の代表的文献である。  
  本試作版が「testlet を独立 item の集合ではなく、共有分散をもつ単位として扱う」方針は、この系譜に依拠する。  
  参照: [ETS chapter](https://www.ets.org/research/policy_research_reports/publications/chapter/2000/cfzt.html)

- **Glas, Wainer, & Bradlow (2000)**  
  testlet-based adaptive testing における **MML / EAP estimation** を扱った基礎文献である。  
  本試作版が **marginal EAP** を採用している点は、この方向性と整合的である。  
  参照: [ETS chapter](https://www.ets.org/research/policy_research_reports/publications/chapter/2000/cfzu.html)

- **Paek, Yon, Wilson, & Kang (2009)**  
  Rasch testlet model の拡張を提示し、testlet effect と target dimension の独立性仮定が破れた場合の影響を検討している。  
  本試作版が testlet 分散を明示的に持つ構造を採ることの、より直接的な統計的根拠になる。  
  参照: [PubMed](https://pubmed.ncbi.nlm.nih.gov/19934527/)

### 2.4 adaptive selection と testlet 情報量

- **Yao (2019)**  
  passage/testlet を含む CAT において、**testlet-effect model**・**passage model**・**unidimensional model** を比較している。  
  Frontiers 本文では、**testlet-effect model の方が passage / unidimensional model より良く、後二者は精度を過大評価しやすい**と報告されている。  
  これは、本試作版が selection と score interpretation の両方で **testlet-aware** に寄せる根拠になる。  
  参照: [Frontiers full text](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.00240/full)

- **Frey, Seitz, & Brandt (2016)**  
  testlet-based multidimensional adaptive testing の研究で、**testlet effect variance や testlet size が大きくなると精度は低下するが、適応化自体は精度向上に有効**と示している。  
  これは、testlet を含む適応テストの実現可能性を支持する。  
  参照: [PubMed](https://pubmed.ncbi.nlm.nih.gov/27917132/)

- **Kang, Han, Betts, & Muntean (2022)**  
  testlet-based innovative items に対する CAT で、複数モデルを比較している。  
  testlet 効果がある場面で scoring model の選択が重要であることを示しており、**単純モデルより testlet model を優先する**判断の支えになる。  
  参照: [PubMed](https://pubmed.ncbi.nlm.nih.gov/34462913/)

### 2.5 語彙CAT の実務上の参照

- **Tseng (2016)**  
  語彙サイズ測定に CAT を用いる実証研究で、ScienceDirect の要約では、**180項目バンクの約3分の1の項目数で comparable な推定**が得られたと報告している。  
  ただし、これは **独立項目・Rasch bank** に基づく語彙CATであり、UVLT のような testlet 構造そのものを扱った研究ではない。  
  したがって、本試作版にとっては **「語彙CATは成立する」** という補助的根拠であって、直接の設計根拠ではない。  
  参照: [ScienceDirect abstract](https://www.sciencedirect.com/science/article/pii/S0360131516300501)

## 3. 先行研究をほぼそのまま受けている部分

### 3.1 UVLT の項目形式

- UVLT 自体の土台は `Webb et al. (2017).pdf` に依拠する。
- 5 band 構成、matching 形式、語彙レベルテストとしての設計思想はこの論文に基づく。

### 3.2 local item dependence と testlet 扱い

- UVLT の matching 形式では local item dependence が問題になるという立場は、`Ha et al. (2025a).pdf` と関連研究に依拠する。
- そのため、本試作版では **独立項目 CAT** ではなく、**3問セット単位の testlet-CAT** として扱っている。

### 3.3 testlet-based CAT という発想

- testlet を適応的に出題する考え方そのものは、testlet-based adaptive testing の研究系譜に依拠する。
- 背景として参照しているのは、少なくとも次の文献群である。
  - `Frey et al. (2016).pdf`
  - `Yao (2019).pdf`
  - `Kang et al. (2022).pdf`
  - `Koedsri et al. (2014).pdf`

## 4. 標準理論を使って本研究用に実装した部分

### 4.1 common-person cross-band linking

- 1k–5k を同一尺度に置くための linking は、**common-person linking** という標準的発想に基づく。
- この発想の背景には、独立較正された項目母数を共通尺度へ写像する **Stocking & Lord (1982)** の common metric 論がある。  
  参照: [ETS Research Report](https://www.ets.org/research/policy_research_reports/publications/report/1982/ihpz.html)
- ただし、現在の係数そのものは `Study01_UVLT` の complete-case 受験者から **この試作版のために再計算した値**である。
- 再計算スクリプトは `App_CAT/tools/derive_cross_band_linking.py` にある。
- したがって、**理論的には標準的**だが、**係数は本実装独自**である。

### 4.2 testlet-aware marginal EAP

- 能力推定は、testlet 分散を nuisance parameter として周辺化した **testlet-aware marginal EAP 近似** を採用している。
- これは testlet response theory / Rasch testlet modeling の考え方に依拠している。
- 分散構造の解釈には **Paek et al. (2009)** が補助線になる。
- ただし、ブラウザで動く形へ落とすための数値積分・実装細部は **本試作版の工学的な近似実装**である。強制マッチングによる testlet 内の「同じ選択肢を再使用できない」応答過程までは完全に同時モデル化していないため、研究上の表現は `testlet-aware 近似プロトタイプ` とする。
- 現在は `15点 Gauss-Hermite` を用いている。実装は `App_CAT/script.js` の `estimateTestletAwareAbility()` にある。

### 4.3 次問選択

- 現在の出題選択は、**expected posterior variance reduction** を基準にしている。これは、候補 testlet の各反応パターンに対する事後分布を評価し、期待される posterior variance の減少量が最も大きいセットを選ぶ考え方である。実装は `App_CAT/script.js` の `expectedPosteriorVarianceReduction()` にある。
- 補助的に、従来型の **expected marginal testlet information** も比較用に計算している。実装上は `App_CAT/script.js` の `testletInformation()` を比較指標として用いている。
- これは CAT の標準的な「情報量最大化」に依拠している。
- とくに、Yao (2019) が示した **testlet-effect model に基づく selection** の方向性と整合する。
- ただし、実装は本試作版向けの近似であり、特定の1本の論文のアルゴリズムを完全再現しているわけではない。

### 4.4 停止規則

- 停止規則は `min testlets + target posterior SE + max testlets` で構成している。実装は `App_CAT/script.js` の `shouldStop()` にある。
- これは CAT 実装として標準的で妥当な形だが、この閾値自体は **シミュレーションを踏まえた本試作版の運用設定**である。

## 5. 暫定的・実務的な部分

### 5.1 語彙サイズ換算

- 現在の語彙サイズ換算は、各 band の期待正答率を 1000語帯へ換算して合計する実務的指標である。実装は `App_CAT/script.js` の `computeVocabularyEstimate()` にある。
- これは **受験者向けの解釈補助**としては有用だが、厳密な意味での正式な vocabulary size 推定式とは言い切らない。
- 論文では、**主スコアではなく補助的指標**として位置づけるほうが安全である。

### 5.2 受験者向けフィードバック

- 強みの帯域、今後の重点帯域、学習提案は、測定理論そのものではなく **受験者向けの説明レイヤー**である。
- これらは教育実務上は有用だが、厳密な psychometric output とは区別して扱う。

## 6. 現時点の整理

### 強く先行研究に依拠している

- UVLT の構成と項目形式
- matching 形式に対する LID / testlet の問題意識
- testlet-based CAT の発想
- testlet-aware ability estimation の理論

### 標準理論を用いた本実装の設計判断

- common-person cross-band linking 係数
- browser 上での marginal EAP の数値実装
- expected posterior variance reduction による次問選択
- 停止規則の閾値設定

### 暫定的で、論文化時に慎重な扱いが必要

- 語彙サイズ換算
- 受験者向け自然言語フィードバック

## 7. 研究上の言い方

論文や研究計画書では、次の表現が妥当である。

- 「本試作版は、UVLT の testlet 性を踏まえ、testlet-based adaptive testing の先行研究に依拠して設計した。」
- 「能力推定には testlet-aware marginal EAP 近似を採用した。」
- 「band 間の共通尺度化には common-person linking を用いた。」
- 「語彙サイズ換算は受験者向けの補助的指標として提示した。」

次の表現は避けたほうがよい。

- 「既存研究で確立された正式な UVLT-CAT である」
- 「語彙サイズを厳密に推定する公式である」
- 「本アルゴリズムは既存論文の完全再現である」
