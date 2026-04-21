# UVLT 3問セットCAT 試作版: 先行研究レビュー・方法草案

## 1. 問題設定

語彙サイズ・語彙レベルの測定では、短時間で広い語彙帯域を扱える形式が求められる。  
その代表例の1つが Updated Vocabulary Levels Test（UVLT）である。しかし、UVLT は matching 形式を採るため、同一セット内の項目間で local item dependence（LID）が生じやすい。  
この点を無視して独立項目CATとして設計すると、推定精度を過大評価する危険がある。Yen (1984) は、局所独立性の破れが IRT の適合や equating に影響し得ることを示しており、LID を単なる形式上の問題ではなく統計的推定上の問題として位置づけている。そこで本研究では、UVLT を **testlet 単位**で扱う Computerized Adaptive Testing（CAT）を設計する。

## 2. 先行研究レビュー

### 2.1 UVLT の基礎

Webb, Sasao, and Ballance (2017) は、Updated Vocabulary Levels Test を開発し、1000–5000語の5水準構成と matching 形式を採用した。  
Benjamins の公開情報では、項目選定に 1,463 名、評価に 250 名を用いたことが示されており、UVLT は現代的な語彙レベルテストとして広く参照されている。  
本研究が UVLT を対象にすること自体は、この研究を直接の出発点とする。  

### 2.2 UVLT と local item dependence

UVLT の psychometric 上の主要論点は、matching 形式に由来する LID である。  
Ha (2022) は UVLT の residual correlations を再検討し、同一クラスター内で強い相関が観察されることを報告した。Frontiers の本文では、同一クラスター項目間に高い相関がみられ、matching format が multiple-choice format よりも LID を生じやすいと論じている。  
さらに Ha et al. (2025a) は、語彙 matching test に対して Yen’s Q3 と Rasch testlet modeling を比較し、testlet model によって method-specific variance をより適切に扱えることを示している。  
したがって、UVLT を単純な独立項目集合として扱うより、**testlet 単位でモデル化する方が理論的に妥当**である。

### 2.3 testlet-based adaptive testing の理論

testlet-based adaptive testing の理論的基礎は、Wainer, Bradlow, and Du (2000) および Glas, Wainer, and Bradlow (2000) に代表される testlet response theory の系譜にある。  
これらの研究は、共通刺激や共通文脈をもつ項目群に対して、testlet effect を明示的に扱うことの必要性を示した。  
また、Paek et al. (2009) は Rasch testlet model の拡張を示し、testlet effect と target dimension の独立性仮定が破れた場合の影響を検討している。  
Yao (2019) は passage/testlet を含む CAT において、testlet-effect model が passage model や unidimensional model より適切であり、後者は精度を過大評価しやすいと報告している。  
また、Frey, Seitz, and Brandt (2016) および Kang et al. (2022) は、testlet を含む adaptive testing が十分実現可能であり、scoring model の選択が精度に大きく影響することを示している。  
以上から、**UVLT の adaptive 化は、独立項目CATより testlet-based CAT の方が理論的に支持される**。

### 2.4 語彙CAT 研究との接点

語彙CATそのものの実用性は、Tseng (2016) によって支持されている。  
同研究は、語彙サイズCATによって、固定長テストより少ない項目数で comparable な推定が得られる可能性を示した。  
ただし、この研究は独立項目CATであり、UVLT のような testlet 構造を直接扱ったものではない。  
したがって、本研究は **語彙CAT研究** と **testlet-based CAT研究** を接続する位置にある。

### 2.5 研究ギャップ

以上の先行研究から、次のギャップが確認できる。

1. UVLT を testlet 単位で adaptive に運用する具体的設計は十分示されていない。  
2. UVLT の LID 問題を踏まえた CAT 実装研究は乏しい。  
3. GitHub Pages のような公開・再現可能な静的環境で動く UVLT testlet-CAT の試作例は見当たらない。  

本研究は、このギャップに対して **Open Science を前提とした UVLT testlet-CAT 試作版** を提示する。

## 3. 方法草案

### 3.1 項目バンク

- 対象は UVLT 1k–5k の 5 band とする。  
- 各 band は 10 セット、各セットは 3 項目から構成され、合計 50 セット・150 項目を item bank とする。  
- 出題単位は項目ではなく **3問セット（testlet）** とする。  

### 3.2 共通尺度化

- band 間の困難度を同一尺度に置くため、complete-case respondents を用いた **common-person cross-band linking** を実施する。  
- linking 係数は `Study01_UVLT` のローカルデータから再計算し、band 別困難度を linked multi-band theta scale へ変換する。  
- testlet 分散は、同じ変換係数に基づき `slope^2` でスケーリングする。尺度変換の発想自体は Stocking and Lord (1982) の common metric 論に依拠する。  

### 3.3 能力推定

- 能力推定には **testlet-aware marginal EAP** を採用する。  
- 各受験者の反応に対して、testlet effect を nuisance parameter として周辺化し、linked 尺度上で posterior を求める。  
- 数値積分には 15 点 Gauss-Hermite quadrature を用いる。分散構造の統計的前提は Glas et al. (2000) と Paek et al. (2009) に依拠する。  

### 3.4 出題選択

- 初回は中難度のセットから開始する。  
- 2セット目以降は、現時点の反応に基づく事後分布のもとで、候補セットを出したときに **expected posterior variance reduction** が最も大きいセットを優先する。  
- 同時に、近接 band を優先する軽い routing と、同一 band への過度な集中を避けるための coverage penalty を入れる。  

### 3.5 停止規則

- 停止規則は次の3条件で構成する。  
  1. 最少 6 セット  
  2. 目標 posterior SE 到達  
  3. 最大 12 セット  
- これにより、短すぎるテストを避けつつ、精度が確保された時点で終了できるようにする。  

### 3.6 受験者向け出力

- 受験者画面には、技術的な theta や model comparison は出さない。  
- 表示するのは、推定レンジ、推定語彙サイズの目安、強みの帯域、今後の重点帯域、所要時間、結果の安定性とする。  
- 研究用の詳細値は Excel / JSON に保存する。  

### 3.7 補助指標としての語彙サイズ換算

- 語彙サイズ換算は、各 band の期待正答率を 1000語帯へ換算して合計する。  
- これは受験者向けフィードバックとして有用だが、厳密な意味での正式な vocabulary size 推定式ではない。  
- したがって、研究報告では **補助的指標** と位置づける。

## 4. 本研究の位置づけ

本研究は、既存の UVLT をそのまま adaptive 化したものではなく、  
**UVLT の testlet 性を踏まえて、testlet-based adaptive testing の理論を適用した研究用試作版**である。  
この意味で、完全な既存法の再現ではなく、**先行研究に依拠した設計研究**と位置づけるのが適切である。

## 5. 研究計画書・論文で使いやすい表現

- 本研究では、UVLT の matching 形式に伴う local item dependence を踏まえ、項目ではなく testlet 単位で adaptive testing を設計した。  
- 能力推定には testlet-aware marginal EAP を採用し、band 間の共通尺度化には common-person linking を用いた。  
- 語彙サイズ換算は、受験者向けフィードバックのための補助的指標として提示した。  
- 本試作版は、UVLT と testlet-based CAT の先行研究に依拠して設計した研究用プロトタイプである。  

## 6. Web で確認した参考文献

1. Webb, S., Sasao, Y., & Ballance, O. (2017). The Updated Vocabulary Levels Test. [Benjamins article page](https://www.benjamins.com/catalog/itl.168.1.02web)  
2. Ha, H. T. (2022). Test Format and Local Dependence of Items Revisited. [Frontiers full text](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.805450/full)  
3. Ha, H. T., et al. (2025). Q3 and Rasch testlet modeling for vocabulary matching tests. [Language Assessment Quarterly article page](https://www.tandfonline.com/doi/full/10.1080/15434303.2025.2456953)  
4. Wainer, H., Bradlow, E. T., & Du, Z. (2000). Testlet Response Theory and testlet-based adaptive testing. [ETS chapter](https://www.ets.org/research/policy_research_reports/publications/chapter/2000/cfzt.html)  
5. Glas, C. A. W., Wainer, H., & Bradlow, E. T. (2000). Estimating ability with testlet-based adaptive testing. [ETS chapter](https://www.ets.org/research/policy_research_reports/publications/chapter/2000/cfzu.html)  
6. Yao, L. (2019). Item Selection Methods for Computer Adaptive Testing With Passages. [Frontiers full text](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.00240/full)  
7. Frey, A., Seitz, N.-N., & Brandt, S. (2016). Testlet-Based Multidimensional Adaptive Testing. [PubMed](https://pubmed.ncbi.nlm.nih.gov/27917132/)  
8. Kang, T., Han, K. T., Betts, J., & Muntean, W. J. (2022). Testlet-based computerized adaptive testing for innovative item types. [PubMed](https://pubmed.ncbi.nlm.nih.gov/34462913/)  
9. Paek, I., Yon, H., Wilson, M., & Kang, T. (2009). Random parameter structure and the testlet model: extension of the Rasch testlet model. [PubMed](https://pubmed.ncbi.nlm.nih.gov/19934527/)  
10. Stocking, M. L., & Lord, F. M. (1982). Developing a Common Metric in Item Response Theory. [ETS Research Report](https://www.ets.org/research/policy_research_reports/publications/report/1982/ihpz.html)  
11. Tseng, W.-T. (2016). Measuring English vocabulary size via computerized adaptive testing. [ScienceDirect abstract](https://www.sciencedirect.com/science/article/pii/S0360131516300501)  
12. Yen, W. M. (1984). Effects of local item dependence on the fit and equating performance of the three-parameter logistic model. [University Digital Conservancy](https://conservancy.umn.edu/items/93af21c3-e468-4772-9576-41e92f0d353c)  
