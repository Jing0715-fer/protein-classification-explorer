# Project Worklog

---
Task ID: 1
Agent: Z.ai Code (main)
Task: 蛋白分类树可视化页面 — 项目初始化与数据方案设计

Work Log:
- 探索项目结构：Next.js 16 + App Router + shadcn/ui + Prisma(SQLite) + recharts 可用
- 验证外部网络可访问 UniProt REST API（curl 测试 P04637 成功）
- 确定 fields 参数：`accession,id,protein_name,gene_names,organism_name,organism_id,length,mass,cc_function,cc_subcellular_location,cc_ptm,keyword,ft_domain,xref_pdb,sequence`（entry_type 自动返回）
- 数据方案：10 种模式生物（人/小鼠/大鼠/斑马鱼/鸡/果蝇/线虫/酵母/拟南芥/大肠杆菌）× 11 大类 40 个蛋白家族，约 250-300 条真实 Swiss-Prot 蛋白
- 三大视图规划：家族分类树 / 进化视角（物种树+直系同源覆盖矩阵）/ 跨物种比较（属性+图表+相似度矩阵）

Stage Summary:
- 技术路线确定：UniProt REST API 实时抓取真实数据 → JSON → Prisma/SQLite → API routes → 单页可视化
- 关键决策：用"直系同源组(orthologGroup)"支撑跨物种比较；氨基酸组成余弦相似度 + 关键词 Jaccard 作为比较指标

---
Task ID: 2
Agent: Z.ai Code (main)
Task: 数据抓取、校验与数据库入库

Work Log:
- 编写 scripts/curated.ts：364 条精选蛋白清单（含家族编码、直系同源组、代表蛋白标记）+ 51 个家族定义 + 10 种模式生物定义（含系统发育路径）
- 编写 scripts/fetch-uniprot.ts：批量按登录号抓取（3 批）+ gene_exact 搜索回退（154 条）+ 物种校验去重
- 两轮数据修复：修正错误登录号（P27386→P27361 MAPK3、P08233→P08246 ELANE、P11403→P11440 mouse Cdk1、P07570→P83949 Ubx、P0A6F8→P0A6F9 GroES、P18433→P18031 PTPN1 等）；酵母基因搜索改用菌株 taxon 559292；果蝇基因符号修正（rolled→rl、Shaker→Sh、white→w）；斑马鱼仅保留 reviewed 条目（tp53/myod1/hspa8/pax6a/actba/shha）
- 最终抓取：364/364 成功，0 未命中 0 丢弃
- prisma/schema.prisma：Organism/Family/Protein 三表 + 索引；`bun run db:push` 推送
- scripts/seed.ts 入库：364 蛋白 / 51 家族 / 10 物种，菌株归并（559292→酵母、83333→大肠杆菌）

Stage Summary:
- 数据库就绪：364 条真实 Swiss-Prot 蛋白；人 179 / 小鼠 43 / 果蝇 40 / 酵母 32 / 线虫 18 / 大肠杆菌 22 / 拟南芥 14 / 斑马鱼 6 / 大鼠 6 / 鸡 4
- 206 个直系同源组，其中 75 组跨物种保守（actin 9 物种、HSP70 8 物种、MAPK/GAPDH/CDK1/PKA/RAS/TP53/tubulin/cyclin-B/HSP90 各 5-6 物种）

---
Task ID: 3
Agent: Z.ai Code (main)
Task: 后端 API 与前端可视化全量实现

Work Log:
- API：GET /api/bootstrap（物种+家族树+蛋白lite+统计）、GET /api/proteins/[accession]（完整详情+直系同源+氨基酸组成）、GET /api/compare（≤12 蛋白比较+两两相似度矩阵：组成余弦45%+关键词Jaccard40%+结构域15%）
- 共享类型 src/lib/protein-types.ts（11 大类配色 CLASS_COLORS）；src/lib/composition.ts（组成/余弦/Jaccard 工具）
- 前端组件：ProteinExplorer（状态容器+QueryClientProvider+比较选择浮层）、StatsBar、FamilyTree（可折叠递归树）、FamilyTreeView（树+筛选chips+可排序蛋白表）、ProteinDetailSheet（UniProt 详情抽屉：功能/定位/结构域/关键词/PTM/组成图/序列+外链）、PhyloView（SVG 系统发育树+直系同源×物种矩阵+单元格弹窗）、CompareView（组选择器/手动模式+长度/质量柱状图+组成雷达图+相似度矩阵+配对明细）、CommandSearch（⌘K 全局搜索）
- 主题：next-themes 明暗切换；页脚粘性底部；响应式（移动端标签换行/表格横滚）

Stage Summary:
- 修复的关键 bug：①SheetDescription 嵌套 <p> 导致 hydration 错误 ②SVG 属性中 hsl(var()) 无效导致进化树连线不可见（改用 currentColor+Tailwind 类）③ctx 缺失 setDetailAcc 导致详情抽屉无法关闭（TypeError 被吞掉）④PhyloView Fragment 缺 key ⑤recharts 轴颜色 var() 失效
- lint 零错误、tsc src/ 零错误、Agent Browser 全流程验证通过（三视图交互/搜索/比较/暗色/移动端均正常，控制台零报错）

---
Task ID: 4
Agent: Z.ai Code (main)
Task: Agent Browser 端到端验证与 GitHub 推送

Work Log:
- Agent Browser 全流程验证：家族树点击/蛋白行→详情抽屉/直系同源导航/搜索面板(⌘K)/矩阵单元格弹窗/组名跳转比较/手动比较浮层/Escape 关闭/明暗主题/移动端 390px/粘性页脚（长页自然下推 ✓）
- VLM 视觉审查 6 张截图（浅色树视图、进化视角、比较视图、配对明细、暗色×2、移动端）——发现并修复进化树连线不可见问题
- tsc --noEmit 全量类型检查：src/ 零错误
- GitHub：创建仓库 Jing0715-fer/protein-classification-explorer（公开）
- 提交 2 个 commit：主功能 commit（106 文件）+ .env 规范化 commit（取消跟踪 .env，新增 .env.example）
- 推送成功并验证远端文件清单；推送后清理 remote URL 中的 token

Stage Summary:
- 应用最终状态：dev server 3000 端口运行正常，页面/API 全部 200，控制台零报错零警告
- 仓库地址：https://github.com/Jing0715-fer/protein-classification-explorer（含 db/custom.db 数据库快照，clone 后配置 .env 即可运行）
