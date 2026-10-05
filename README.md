# 蛋白质分类图谱 · Proteome Atlas

> 基于 **UniProtKB / Swiss-Prot 全量 reviewed 数据**的十物种蛋白家族分类与进化关系可视化。
> 88,515 条蛋白 · 10 种模式生物 · 14 大类 · 100 个亚类 · 654 个超家族 · 8,062 个叶子家族 · 10,504 个直系同源组

一个学术期刊风格的单页应用：以 UniProt 官方家族链（`Belongs to …`）为骨架，将十个模式生物的**全部**已审核蛋白组织为「大类 → 亚类 → 超群/超家族 → 家族 → 亚家族」的层级谱系——大类内部按**科学机制再分组**（膜通道与膜转运细分为离子通道、二级载体、ATP 驱动泵、孔蛋白、蛋白转位酶等运输方式；酶类按 IUBMB EC 六大类），并以 NCBI Taxonomy 校准的系统发生树、OrthoDB 直系同源关系与序列特征图谱，从分类、进化、比较三个视角纵览蛋白组。

---

## 目录

- [数据规模](#数据规模)
- [核心功能](#核心功能)
- [科学性说明](#科学性说明)
- [技术栈](#技术栈)
- [数据管线](#数据管线)
- [本地运行](#本地运行)
- [目录结构](#目录结构)
- [数据源与致谢](#数据源与致谢)
- [免责声明](#免责声明)

## 数据规模

全部数据来自 UniProtKB/Swiss-Prot（reviewed，人工注释）**全量拉取**，非精选子集；各参考菌株计数与 UniProt REST `X-Total-Results` 精确对拍一致。

| 物种 | 学名 | Taxon | 蛋白条目 |
| --- | --- | --- | --- |
| 人 | *Homo sapiens* | 9606 | 20,431 |
| 小鼠 | *Mus musculus* | 10090 | 17,283 |
| 拟南芥 | *Arabidopsis thaliana* | 3702 | 16,421 |
| 大鼠 | *Rattus norvegicus* | 10116 | 8,233 |
| 酿酒酵母 | *Saccharomyces cerevisiae* | 559292 (+4932) | 6,776 |
| 大肠杆菌 | *Escherichia coli* | 83333 (+562) | 5,275 |
| 秀丽隐杆线虫 | *Caenorhabditis elegans* | 6239 | 4,489 |
| 黑腹果蝇 | *Drosophila melanogaster* | 7227 | 3,904 |
| 斑马鱼 | *Danio rerio* | 7955 | 3,385 |
| 红原鸡（家鸡） | *Gallus gallus* | 9031 | 2,318 |
| **合计** | | | **88,515** |

> 菌株归并口径：大肠杆菌 = K-12 参考株（83333，4,531 条）+ 种级泛条目（562，744 条，如 TEM β-内酰胺酶、溶血素等跨菌株条目）；酿酒酵母 = S288C 参考株（559292，6,733 条）+ 种级条目（4932，43 条）。直系同源组跨物种判定按归并后物种计算。

全局统计：分类树节点 8,830 个（14 大类 → 100 亚类 → 654 超家族/超群 → 8,062 叶子家族；显示名全局唯一，0 撞名）· 家族链覆盖 93.5% · EC 注释 25,193 条 · OrthoDB 覆盖 69,732 条 · 平均长度 511 aa · 平均分子质量 57 kDa。

## 核心功能

### 1. 家族分类树

- **14 大类 → 100 亚类 → 超群/超家族 → 家族 → 亚家族**（最多七级）：大类内插入按科学机制/类别归组的「亚类」层，让数百个家族不再平铺；
- **膜通道与膜转运按运输方式分组**（参照 TC 转运蛋白分类系统）：溶质载体与二级转运体（SLC/MFS 等，电化学梯度驱动）· ATP 驱动泵（P/V/F 型与 ABC）· 电压门控离子通道 · 配体门控离子通道 · 感觉与机械敏感通道（TRP/PIEZO/Connexin）· 水通道蛋白 · 孔蛋白与外膜通道（β 桶）· 蛋白转位与分泌系统（Sec/Tat/Tim/Tom/Tic）；
- **其他大类同样按学科标准分组**：酶类按 IUBMB EC 六大类（名称正则优先 + 成员 EC 多数票兜底）· 转录因子按 DNA 结合域（锌指/同源框/bZIP/bHLH/核受体/植物特异）· 免疫按防线（抗体/补体/细胞因子/抗菌肽/植物抗病/限制修饰/毒素）·「其他功能蛋白」按物种进化支（细菌/植物/真菌/动物/跨物种保守）分组；
- **分类的膜属性经过严格审计**：「膜通道与膜转运」仅收跨膜运输系统成员（通道/载体/泵/转位酶，膜关联占比 93.5%）；可溶性电子载体（硫氧还蛋白等）归入酶类，血浆载体（载脂蛋白/白蛋白/转铁蛋白）归入分泌类，囊泡运输与核质运输机器单独成「细胞内运输」大类，「其他功能蛋白」不再冠以膜蛋白之名；
- **溶质载体（SLC）超群**：动物按 SLC 编号体系（SLC1–SLC67）组织，MFS、APS 转运体、KUP 等植物/微生物家族按官方链归入对应分支——MFS 在全树中是唯一节点，聚合全部物种成员；
- 家族节点显示各物种成员分布与计数；点击家族查看蛋白列表，点击蛋白打开详情抽屉；
- 树内任一节点的显示名全局唯一（含 KCNN/KCNE/HCN 等限定词家族、GPCR 九个亚类），无「同名家族多级重复」。

### 2. 进化视角

- **物种系统发生树**：谱系对照 NCBI Taxonomy 校准（详见[科学性说明](#科学性说明)），每个分岔节点均为单系群，悬停可查看中英文全称；叶子为物种色圆点并标注蛋白条目数；
- **超家族 × 物种覆盖热图**：每大类规模最大的前 12 个超家族在 10 物种中的分布，对数强度着色，点击行跳转分类树；
- **直系同源组浏览**：按跨物种数、大类过滤检索 OrthoDB 直系同源组，一键选取代表蛋白进入比较视图。

### 3. 跨物种比较

多蛋白并排对比：分子量 / 长度 / 物种 / 家族链 / EC / 关键词 / 亚细胞定位 / GO 功能注释；直系同源组一键带入代表成员。

### 4. 蛋白详情（⌘K 全局检索直达）

- 基本面：推荐名与同义词、基因名、条目版本与序列版本、蛋白存在性证据等级、注释评分；
- **序列特征图谱**：五泳道学术视图——结构域与区域、**跨膜区（独立泳道 + 脂双层背景带 + 红色胶囊条）**、拓扑域（胞质侧/胞外侧明暗区分）、信号与肽段、位点与修饰（棒棒糖图）；自适应刻度尺、悬停/键盘/触屏三通道详情卡；
- 深度注释：酶活性调控、辅因子、催化活性、发育阶段、结构域注释、注解警告、疾病关联（OMIM 外链）、分子互作（IntAct 证据、库内可跳转）、异构体、外部数据库 8 分组 20 库链接（Ensembl / RefSeq / AlphaFold / Pfam / Reactome / OMIM / ChEMBL …）。

## 科学性说明

### 分类体系

- **唯一性原则**：每个超家族在整棵树中只出现一次；同义词（如 HSP70/heat shock protein 70）、标点变体（Ntn-hydrolase/Ntn hydrolide）、fb 兜底节点与链节点同族分裂均归一合并；全树 8,827 节点显示名 0 撞名（脚本校验 + DB 级审计）。
- **膜属性审计**：以 UniProt 关键词（Transmembrane/Membrane）为证据逐类复核——「膜通道与膜转运」85.3% 整合膜 + 8.2% 泵复合体外周亚基；旧版混入的硫氧还蛋白/谷氧还蛋白/铁蛋白/ETF/细胞色素等可溶载体已归入酶类，载脂蛋白/白蛋白/植物 LTP 等血浆载体归入分泌类，输入蛋白/核孔蛋白/SNARE/外泌体复合体等归入「细胞内运输」，LDL 受体/Patched 等跨膜受体归入受体类，PPR 重复蛋白归入 RNA 结合类。
- **兜底桶是诚实的**：6.5% 蛋白落入「未分类/其他膜蛋白」等兜底桶，经抽样核验全部为 UniProt flat-file 中无 `CC SIMILARITY` 家族链的条目——即 UniProt 注释缺口的真实反映，而非分类遗漏；反向抽检 20 条随机蛋白 17/17 与本库指派精确一致。
- **中文名保真**：前缀译名 + 限定词保留 + 词级半翻译（「组蛋白 · 赖氨酸甲基转移酶家族」「DNA 聚合酶 · B 型家族」），避免「钾离子通道家族」式撞名。

### 系统发生树

谱系对照 **NCBI Taxonomy**（EUtils efetch lineage）逐阶元校准：

```
细胞生物
├─ 细菌域 Bacteria
│    └─ 变形菌门 → γ-变形菌纲 → 肠杆菌目 → 肠杆菌科 → 埃希氏菌属（大肠杆菌）
└─ 真核生物域 Eukaryota
     ├─ 植物界 Plantae（拟南芥：有胚植物 → 维管植物 → 被子植物 → 真双子叶植物 → 十字花目 → 十字花科）
     └─ 后鞭毛生物 Opisthokonta
          ├─ 真菌界 Fungi（酿酒酵母：子囊菌门 → 酵母亚门）
          └─ 后生动物 Metazoa → 真后生动物 → 两侧对称动物 Bilateria
               ├─ 原口动物 Protostomia → 蜕皮动物 Ecdysozoa（线虫动物门 ｜ 节肢动物门 → 昆虫纲 → 双翅目）
               └─ 后口动物 Deuterostomia → 脊索动物门 Chordata → 脊椎动物亚门 → 有颌类 → 硬骨鱼类
                    ├─ 辐鳍鱼纲（斑马鱼：真骨下纲 → 鲤形目）
                    └─ 肉鳍鱼纲 Sarcopterygii → 四足动物 → 羊膜动物
                         ├─ 鸟纲 Aves（家鸡：鸡形目 → 雉科）
                         └─ 哺乳纲 Mammalia → 灵长总目
                              ├─ 啮齿目 → 鼠科 Muridae（小鼠属 ｜ 大鼠属）
                              └─ 灵长目 → 人科 → 人属（人）
```

- 关键修正：辐鳍鱼纲与羊膜动物**不再**在脊索动物门下直接并列（中间补齐脊椎动物亚门 → 有颌类 → 硬骨鱼类 → 肉鳍鱼纲 → 四足动物链路）；蜕皮动物与脊索动物经两侧对称动物/原口/后口动物正确分层；小鼠/大鼠在鼠科下分属，人科/人属显式标出；根节点为「细胞生物」，细菌为域级；
- 渲染层对阶元名做归一化（同一单系群的不同写法合并为同一节点），从结构上杜绝「同一演化支被拆成多条分支」；
- 竖直高度表示**分类阶元层级**而非分化时间；连线长度不携带年代信息。

## 技术栈

- **框架**：Next.js 16（App Router）+ React 19 + TypeScript 5（strict）
- **样式**：Tailwind CSS 4 + shadcn/ui（New York）+ Lucide 图标 + next-themes 暗色模式
- **数据**：Prisma ORM + SQLite（本地单文件 `db/custom.db`，随仓库分发，开箱即用）
- **状态**：TanStack Query（服务端状态）+ 原生 React state
- **API**：Next.js Route Handlers（gzip 引导数据 + 分页蛋白列表 + 实时详情聚合），无外部服务依赖

## 数据管线

```
UniProt REST API ──▶ fetch-proteomes.ts ──▶ fetch-families.ts ──▶ classify-hierarchy.ts ──▶ seed-full.ts ──▶ SQLite
                      （全量蛋白组+缓存）    （官方家族链 cc_similarity）  （层级分类引擎 v5）     （入库 88,515 条）      （Prisma）
```

| 脚本 | 作用 |
| --- | --- |
| `scripts/fetch-proteomes.ts` | 按物种游标分页全量拉取 Swiss-Prot（accession/名称/基因/长度/质量/关键词/结构域/EC/OrthoDB/eggNOG/序列），带 `.done` 断点续传 |
| `scripts/fetch-families.ts` | 轻量补抓每条蛋白的 `Belongs to …` 官方家族链 |
| `scripts/classify-hierarchy.ts` | 层级分类引擎：14 大类 → 超群/超家族 → 家族 → 亚家族；SLC 超群手术、同义词归一、fb/链节点合并、膜属性路由（可溶载体/囊泡机器/受体分流）、中文名保真；输出前跑四项结构校验（唯一性/引用一致性/撞名=0） |
| `scripts/classify-subgroups.ts` | 亚类分组定义 + 跨类修正清单：14 大类各自的亚类路由规则（TC 运输机制 / IUBMB EC 六大类 / 物种进化支等）与 180+ 处证据驱动的跨大类修正 |
| `scripts/rebuild-subgroups.ts` | 亚类分组就地重建（DB 直通版）：原始 proteome jsonl 清理后，直接在数据库树上执行跨类修正 + 亚类分组 + 重编码，含蛋白迁移与直系同源组主家族码重算 |
| `scripts/seed-full.ts` | 清库重入库（蛋白/家族树/直系同源组/物种谱系） |
| `scripts/update-phylo.ts` | 单独更新物种系统发生谱系（NCBI 校准） |
| `scripts/audit-db.ts` `audit-missed.ts` `audit-reverse.ts` | 分类审计三件套：结构完整性/兜底桶抽样/反向抽检 |

重建全量数据（约 30–60 分钟，取决于 UniProt 限速）：

```bash
bun run scripts/fetch-proteomes.ts
bun run scripts/fetch-families.ts
bun run scripts/classify-hierarchy.ts
bun run scripts/seed-full.ts
```

## 本地运行

```bash
bun install          # 安装依赖
bun run db:push      # 同步 Prisma schema（db/custom.db 已随仓库附带，可跳过）
bun run dev          # http://localhost:3000
```

> 数据库 `db/custom.db`（约 94 MB）已随仓库附带全部 88,515 条蛋白与分类树，clone 后无需重跑管线即可运行。

## 目录结构

```
├── db/custom.db                 # SQLite 全量数据（蛋白/家族树/直系同源组/物种谱系）
├── prisma/schema.prisma         # 数据模型
├── scripts/                     # 数据管线与审计脚本（见上表）
├── src/
│   ├── app/
│   │   ├── api/                 # Route Handlers：bootstrap / proteins / groups / detail
│   │   ├── layout.tsx           # 字体（Fraunces/Instrument Sans/IBM Plex Mono）与元数据
│   │   └── page.tsx
│   ├── components/protein/      # FamilyTreeView / PhyloView / CompareView / ProteinDetailSheet / CommandSearch …
│   └── lib/                     # 类型定义与数据库客户端
└── download/                    # 管线中间产物（大文件已 gitignore，可由 scripts 重新生成）
```

## 数据源与致谢

- [UniProtKB / Swiss-Prot](https://www.uniprot.org) —— 全量蛋白注释与官方家族链（CC SIMILARITY）
- [NCBI Taxonomy](https://www.ncbi.nlm.nih.gov/taxonomy) —— 系统发生谱系校准
- [OrthoDB](https://www.orthodb.org) —— 直系同源组；[eggNOG](https://eggnog.embl.de) —— 直系同源注释
- [AlphaFold](https://alphafold.ebi.ac.uk) / [Pfam](https://www.ebi.ac.uk/interpro/) / [InterPro](https://www.ebi.ac.uk/interpro/) / [PROSITE](https://prosite.expasy.org) —— 结构与家族域链接
- [OMIM](https://omim.org) / [IntAct](https://www.ebi.ac.uk/intact/) / [Reactome](https://reactome.org) / [KEGG](https://www.kegg.jp) —— 疾病、互作与通路注释
- [PDB](https://www.rcsb.org) —— 结构交叉引用

## 免责声明

本项目为科研可视化演示：数据快照取自 UniProt 2026-10 版本，分类树为 UniProt 官方家族链的程序化整理，系统发生树为 NCBI Taxonomy 拓扑的阶元级呈现（非分子钟测年）。一切以 [UniProt 官方条目](https://www.uniprot.org/uniprotkb)为准；使用本工具产生的任何科学结论请回溯原始数据库核实。

---

**Proteome Atlas** · 科研可视化演示 · Next.js 16 + Prisma + UniProt
