# download/ —— 数据管线中间产物

此目录存放 UniProt 抓取与分类引擎的中间产物（大文件已 gitignore，可随时由 `scripts/` 重新生成）：

```
proteomes/{taxon}.jsonl       # fetch-proteomes.ts 全量拉取的蛋白组（含序列/关键词/EC/OrthoDB…）
families/{taxon}.jsonl        # fetch-families.ts 补抓的官方家族链（cc_similarity）
hier-classified.jsonl         # classify-hierarchy.ts 输出的带家族编码蛋白流
hier-families.json            # 层级家族树（超群→超家族→家族→亚家族）
hier-report.json              # 分类报告（校验与统计）
families.json                 # 旧版分类引擎产物
```

重建方式见仓库根目录 `README.md` 的「数据管线」一节。
