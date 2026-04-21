# 研究計画書用セクション完成稿（先行研究・方法）

## 1. 研究背景

語彙知識は第二言語運用の基盤であり、学習者の読解・聴解・産出能力を支える中核的要素である。そのため、短時間で、かつ広い語彙帯域を安定して測定できる語彙テストの開発は、語彙研究と教育実践の双方にとって重要な課題である。  
Updated Vocabulary Levels Test（UVLT）は、その代表的な到達点の1つである。Webb, Sasao, and Ballance (2017) は、既存の Vocabulary Levels Test を見直し、1000語帯から5000語帯までの5水準を対象とする新しい語彙レベルテストを提示した。UVLT は、効率的に多数の語を扱える matching 形式を維持しつつ、現代的な語彙レベルテストとして再構成された点に意義がある（[Webb et al., 2017](https://www.benjamins.com/catalog/itl.168.1.02web)）。

しかし、この matching 形式は psychometric な課題も抱えている。複数の項目が同一の選択肢群や共通文脈を共有するため、項目間の local item dependence（LID）が生じやすいからである。LID を無視して独立項目として得点化・推定を行うと、能力推定の精度が過大評価される危険がある。この問題は、語彙テストの adaptive 化を考える際に、単なる実装上の論点ではなく、測定理論上の中核課題となる。Yen (1984) は、局所独立性の破れが IRT の適合や equating に影響し得ることを示しており、LID を統計的推定上の問題として扱う必要性を早い段階で明確化している（[Yen, 1984](https://conservancy.umn.edu/items/93af21c3-e468-4772-9576-41e92f0d353c)）。

## 2. 先行研究

### 2.1 UVLT の妥当性研究

UVLT の基礎を与えたのは Webb, Sasao, and Ballance (2017) である。同研究は、1000–5000語帯をカバーする2つの新しい UVLT 版を開発し、Rasch に基づく妥当化を行った。公開メタデータでは、項目選定に 1,463 名、評価に 250 名を用いたことが示されており、UVLT は語彙レベル測定における重要な参照点となっている（[Webb et al., 2017](https://www.benjamins.com/catalog/itl.168.1.02web)）。

一方で、この妥当性研究の枠組みは、基本的には独立項目を前提とする Rasch 的視点に立っていた。そのため、matching 形式に由来する method effect や testlet effect を、明示的に扱う枠組みにはなっていなかった。

### 2.2 UVLT と local item dependence

UVLT の matching 形式がもつ LID の問題を再検討したのが Ha (2022) である。Ha は、UVLT と別形式の語彙テストを比較し、残差相関および Yen’s Q3 に基づいて local dependence を検討した。その結果、UVLT では同一クラスター内項目間に強い関連がみられ、matching format が local dependence を誘発しやすいことを示した（[Ha, 2022](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.805450/full)）。  
この知見は、UVLT を adaptive に実装する際、項目単位で独立に扱うのではなく、**3項目セット単位で扱う必要性**を強く示唆している。

さらに Ha et al. (2025a) は、語彙 matching test における LID の検出法として Yen’s Q3 と Rasch testlet modeling を比較し、testlet model が共有分散や method-specific variance をより適切に扱えることを示した（[Ha et al., 2025a](https://www.tandfonline.com/doi/full/10.1080/15434303.2025.2456953)）。この研究は、UVLT の adaptive 化に際して testlet-aware な推定枠組みを採る理論的根拠となる。

### 2.3 testlet-based adaptive testing

testlet を adaptive testing に組み込む発想自体は新しいものではない。Wainer, Bradlow, and Du (2000) は、testlet response theory を軸に、共通刺激をもつ項目群を独立項目としてではなく、testlet effect を伴う単位として扱う必要性を論じた（[Wainer et al., 2000](https://www.ets.org/research/policy_research_reports/publications/chapter/2000/cfzt.html)）。また、Glas, Wainer, and Bradlow (2000) は、testlet-based adaptive testing における能力推定の方法として、周辺尤度に基づく推定を論じている（[Glas et al., 2000](https://www.ets.org/research/policy_research_reports/publications/chapter/2000/cfzu.html)）。加えて、Paek, Yon, Wilson, and Kang (2009) は Rasch testlet model の拡張を示し、testlet effect と target dimension の独立性仮定が破れた場合の影響を検討した。これは、testlet 分散を明示的に扱う本研究の統計的前提を補強する（[Paek et al., 2009](https://pubmed.ncbi.nlm.nih.gov/19934527/)）。

近年では、Yao (2019) が passage/testlet を含む CAT において、testlet-effect model、passage model、unidimensional model を比較し、testlet-effect model の方が適切な推定を与え、passage model や unidimensional model は精度を過大評価しやすいことを報告した（[Yao, 2019](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.00240/full)）。  
また、Frey, Seitz, and Brandt (2016) は、testlet-based multidimensional adaptive testing の有効性を示し、Kang et al. (2022) も testlet-based CAT において scoring model の選択が結果に影響することを示している（[Frey et al., 2016](https://pubmed.ncbi.nlm.nih.gov/27917132/); [Kang et al., 2022](https://pubmed.ncbi.nlm.nih.gov/34462913/)）。

以上の研究は、共通文脈をもつ項目群を含むテストに対しては、独立項目CATではなく、**testlet-aware CAT** を採用する方が理論的に一貫していることを示している。

### 2.4 語彙CAT 研究との接点

語彙テストを adaptive に実施すること自体は、語彙測定研究でも実績がある。Tseng (2016) は、英語語彙サイズ測定に CAT を適用し、固定長テストよりも少ない項目数で comparable な推定が得られる可能性を示した（[Tseng, 2016](https://www.sciencedirect.com/science/article/pii/S0360131516300501)）。  
ただし、この研究は独立項目 bank を前提とする語彙CATであり、UVLT のような matching/testlet 構造を直接扱ったものではない。したがって、本研究は、**語彙CAT の知見**と**testlet-based CAT の知見**を接続する位置にある。

### 2.5 研究上のギャップ

以上を踏まえると、次の研究上のギャップが残されている。

1. UVLT の LID 問題を踏まえて adaptive 化した研究は十分に示されていない。  
2. UVLT を testlet 単位で運用する CAT 設計はほとんど提案されていない。  
3. Open Science を前提として、再現可能な形で動く UVLT testlet-CAT の試作例は見当たらない。  

そこで本研究は、UVLT の testlet 性を前提とし、先行研究に依拠した **UVLT 3問セットCAT 試作版** を設計・実装し、その理論的妥当性と実用可能性を検討する。

## 3. 研究目的

本研究の目的は、UVLT を独立項目テストとしてではなく、**3項目セットからなる testlet テスト**として捉え直し、testlet-aware な adaptive testing の試作版を構築することである。  
具体的には、次の3点を目的とする。

1. UVLT 1k–5k を対象とする multi-band testlet-CAT の設計原理を明確化する。  
2. testlet-aware marginal EAP に基づく推定と、testlet-aware な出題選択を組み込んだ静的ブラウザ版プロトタイプを構築する。  
3. Open Science を前提とした公開可能な形で、研究用試作版としての妥当性と限界を整理する。  

## 4. 方法

### 4.1 項目バンク

対象とする item bank は UVLT 1k–5k の5 band である。各 band は10セットから構成され、各セットは3項目を含む。したがって、本研究の bank は **50セット・150項目** から成る。  
出題単位は独立項目ではなく、**3項目セット（testlet）** とする。これは、UVLT の matching 形式に対する local dependence の知見を踏まえた設計である。

### 4.2 band 間の共通尺度化

multi-band adaptive testing を行うためには、各 band の困難度を同一尺度に置く必要がある。本研究では、complete-case respondents を用いた **common-person cross-band linking** を採用する。  
具体的には、Study01_UVLT のローカルデータを用いて complete-case 受験者の反応行列を作成し、Rasch 的な JML 推定により多band 一括の困難度尺度を得た上で、各 band の raw difficulty を linked multi-band theta scale へ線形変換する。  
この linking 係数は本試作版用に再計算したものであり、完全に既存研究から与えられた値ではないが、理論的には standard な common-person linking に基づく。尺度変換の発想自体は、独立較正された項目母数を共通尺度へ写像する Stocking and Lord (1982) の common metric 論に依拠している（[Stocking & Lord, 1982](https://www.ets.org/research/policy_research_reports/publications/report/1982/ihpz.html)）。

### 4.3 能力推定

能力推定には **testlet-aware marginal EAP** を用いる。  
各 testlet に対して testlet effect を nuisance parameter とみなし、その分散を明示的に扱った上で response likelihood を周辺化し、受験者の posterior distribution を求める。  
数値積分には 15 点 Gauss-Hermite quadrature を用いる。  
この設計は、testlet response theory および testlet-based adaptive testing の先行研究と整合的である。とくに、周辺尤度に基づく能力推定は Glas et al. (2000) に、Rasch testlet model の分散構造の扱いは Paek et al. (2009) によって補強される。

### 4.4 出題選択

最初のセットは中程度の難度から開始する。  
2セット目以降は、その時点の反応に基づく事後分布のもとで、候補セットを出したときの **expected posterior variance reduction** が大きいセットを優先して選択する。  
ただし、単純な最大情報量基準だけでは同一 band へ偏る可能性があるため、本研究では次の2つの運用上の制約を設ける。

- 推定値に近い band とその隣接 band を優先する routing  
- 同一 band への過度な集中を抑える coverage penalty  

この選択法は、Yao (2019) が示した testlet-effect model に基づく selection の方向性と整合する。

### 4.5 停止規則

停止規則は、測定精度と実施時間のバランスを考慮して、次の3条件で構成する。

1. 最少 6 セット  
2. posterior SE が目標値に到達した場合  
3. 最大 12 セット  

これにより、短すぎるテストを避けつつ、必要な精度が得られた時点で終了できるようにする。

### 4.6 出力と受験者向け表示

受験者画面には、技術的なパラメータである theta や model comparison は表示しない。  
表示するのは、推定レンジ、推定語彙サイズの目安、強みの帯域、今後の重点帯域、所要時間、結果の安定性とする。  
一方、研究用の詳細情報は Excel / JSON に保存し、選択経路、反応ログ、band 診断、linking 係数、testlet 分散などを確認できるようにする。

### 4.7 語彙サイズ換算の位置づけ

語彙サイズ換算は、各 band の期待正答率を 1000語帯へ換算して合計する補助的指標として扱う。  
この値は、受験者にとって結果を理解しやすくするうえで有用であるが、厳密な意味での正式な vocabulary size 推定式とは異なる。  
したがって、本研究ではこの値を **補助的な interpretive index** と位置づけ、主たる psychometric score は testlet-aware な能力推定値とする。

## 5. 本研究の位置づけ

本研究は、既存の UVLT をそのまま adaptive 化した既成システムではない。  
むしろ、UVLT の testlet 性を踏まえ、testlet-based adaptive testing の理論を適用して設計した **研究用プロトタイプ** である。  
したがって、本研究の貢献は、完成された operational CAT を提示することではなく、**UVLT を testlet-aware に adaptive 化する理論的・実装的枠組みを示すこと**にある。

## 6. 期待される貢献

本研究の意義は、少なくとも次の3点にある。

1. UVLT の matching 形式と local dependence の問題を踏まえた adaptive design を提示する点  
2. 語彙CAT 研究と testlet-based CAT 研究を接続する点  
3. Open Science を前提として、公開可能かつ再現可能な形で試作版を提示する点  

## 7. 参考文献（Web で確認した主要文献）

- Frey, A., Seitz, N.-N., & Brandt, S. (2016). Testlet-Based Multidimensional Adaptive Testing. [PubMed](https://pubmed.ncbi.nlm.nih.gov/27917132/)  
- Glas, C. A. W., Wainer, H., & Bradlow, E. T. (2000). Estimating ability with testlet-based adaptive testing. [ETS chapter](https://www.ets.org/research/policy_research_reports/publications/chapter/2000/cfzu.html)  
- Ha, H. T. (2022). Test Format and Local Dependence of Items Revisited. [Frontiers](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.805450/full)  
- Ha, H. T., et al. (2025a). Q3 and Rasch testlet modeling for vocabulary matching tests. [Taylor & Francis](https://www.tandfonline.com/doi/full/10.1080/15434303.2025.2456953)  
- Kang, T., Han, K. T., Betts, J., & Muntean, W. J. (2022). Testlet-based computerized adaptive testing for innovative item types. [PubMed](https://pubmed.ncbi.nlm.nih.gov/34462913/)  
- Paek, I., Yon, H., Wilson, M., & Kang, T. (2009). Random parameter structure and the testlet model: extension of the Rasch testlet model. [PubMed](https://pubmed.ncbi.nlm.nih.gov/19934527/)  
- Stocking, M. L., & Lord, F. M. (1982). Developing a Common Metric in Item Response Theory. [ETS Research Report](https://www.ets.org/research/policy_research_reports/publications/report/1982/ihpz.html)  
- Tseng, W.-T. (2016). Measuring English vocabulary size via computerized adaptive testing. [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0360131516300501)  
- Wainer, H., Bradlow, E. T., & Du, Z. (2000). Testlet Response Theory and testlet-based adaptive testing. [ETS chapter](https://www.ets.org/research/policy_research_reports/publications/chapter/2000/cfzt.html)  
- Webb, S., Sasao, Y., & Ballance, O. (2017). The Updated Vocabulary Levels Test. [Benjamins](https://www.benjamins.com/catalog/itl.168.1.02web)  
- Yao, L. (2019). Item Selection Methods for Computer Adaptive Testing With Passages. [Frontiers](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.00240/full)  
- Yen, W. M. (1984). Effects of local item dependence on the fit and equating performance of the three-parameter logistic model. [University Digital Conservancy](https://conservancy.umn.edu/items/93af21c3-e468-4772-9576-41e92f0d353c)  
