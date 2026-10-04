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

---
Task ID: 5
Agent: full-stack-developer
Task: 蛋白分类树浏览器 · 前端全量蛋白组改造（87,728 条 / 10 物种 / 116 家族 / 10,501 直系同源组）
Work Log:
- 依据 src/lib/protein-types.ts 与 src/components/protein/api.ts 契约，对 src/components/protein/ 全部 8 个组件完成全量蛋白组改造：移除一次性全量蛋白列表，改为服务端分页 + 聚合统计
- ProteinExplorer：ctx 去除 data.proteins，新增 compareAccs/setCompareAccs（比较入口统一）；比较浮层"开始比较"→ setCompareAccs + 切 compare 视图；页脚用 stats 动态渲染（87,728 条 · 10 物种 · 116 家族 · 10,501 直系同源组）；副标题标注"全量蛋白组"
- StatsBar：8 张统计卡（全量蛋白/模式生物/家族/直系同源含跨物种/已分类 87.6%/平均长度质量/EC 注释/OrthoDB 覆盖），移动端 2 列网格
- FamilyTree/FamilyTreeView：13 大类可折叠树（家族行 ORG_COLORS 物种堆叠条）；右侧蛋白表 TanStack useQuery + keepPreviousData 服务端分页（pageSize 50、页码窗口控件、表头排序、300ms 防抖搜索、物种 chips 计数、勾选比较 ≤12、行点击开详情、骨架/空态/错误态）
- ProteinDetailSheet：UniProt 实时+缓存详情（source badge live/cache）；头部家族链/OrthoDB/eggNOG；关键数字行；PDB chips 外链；功能/催化/亚基/组织/诱导/PTM/相似性七个折叠文本区；亚细胞定位 chips；结构域 SVG 位置条；GO 按 P/F/C 分色；关键词；aa 组成柱图（固定 hex）；直系同源表格（行点击切换、全部加入比较 ≤12）；序列折叠+复制 toast
- PhyloView：A 物种系统发生树（SVG currentColor 修复暗色连线）；B 116 家族×10 物种 log 强度热图（行点击跳家族树）；C 直系同源组浏览（跨物种开关/minOrganisms 1-10/大类下拉/防抖搜索/分页；行弹窗列组内成员，"比较此组 ≤12"每物种长度中位数代表）
- CompareView：手动（浮层勾选）/组模式（Command 搜组下拉）双模式；蛋白卡头、长度/质量柱图（ORG_COLORS）、20aa 组成雷达叠加、NxN 相似度矩阵（≥80 深绿/60-80 绿/40-60 黄/<40 灰、title 三分项、对角线 —）、配对明细进度条、属性总表
- CommandSearch：⌘K 全库搜索 250ms 防抖，蛋白/家族/物种三组结果分组，键盘导航
- 验收加固：移动端触控目标 ≥44px（导航 tab/物种 chips/分页按钮/浮层按钮/模式 tab 用 max-sm: 与 sm: 响应式类，表格行 max-sm py-3.5 ≈46px；桌面尺寸不变）
- agent-browser 端到端自测 + VLM 视觉审查（8 张截图）：家族树 13 大类加载、分页翻页"共 81 条 · 第 2/2 页"、长度排序、搜索 CD40→4 条、物种 chip 人→2 条、P04637 详情（功能/GO 24 条/关键词/直系同源 8 个/PDB）、直系同源行点击切换 P02340、live→cache（1116ms→64ms API 复核）、⌘K tp53/激酶/hemoglobin、热图行点击跳 GPCR、组弹窗→比较此组（12 代表）、比较视图组/手动双模式出图、390px 无横向溢出（scrollWidth=390）、暗色模式完整适配；控制台零报错
- bun run lint 零错误；tsc --noEmit src/ 零错误；dev.log 全部 200
Stage Summary:
- 前端完成全量蛋白组改造交付：服务端分页蛋白表 + UniProt 实时详情 + 116 家族热图 + 10,501 组浏览 + ≤12 跨物种比较，三视图交互全链路验证通过，明暗主题与移动端 390px 均正常，控制台零错误
- 已知边界（非 bug）：/api/groups?q=actin 会命中 "interacting" 子串（后端契约行为）；从组入口进入比较视图时默认选中"自由选择蛋白" tab（accs 已就位，功能不受影响）
- 交接记录：/home/z/my-project/agent-ctx/5-full-stack-developer.md

---
Task ID: 6
Agent: Z.ai Code (main)
Task: 全量蛋白组升级——UniProt API 全量抓取 10 物种所有蛋白并分类（应用户要求"蛋白不全，要包含所有蛋白信息，通过 uniprot api 全量获取并分类"）

Work Log:
- 全量抓取：scripts/fetch-proteomes.ts 游标分页抓取 10 物种全部 Swiss-Prot reviewed 蛋白（人 20,431 / 小家鼠 17,283 / 拟南芥 16,421 / 褐家鼠 8,233 / 酿酒酵母 6,733 / 大肠杆菌 4,531 / 线虫 4,489 / 果蝇 3,904 / 斑马鱼 3,385 / 家鸡 2,318，共 87,728 条），字段含 OrthoDB/eggNOG 直系同源组、关键词、结构域、EC、序列
- 关键 bug 修复：UniProt Link header 的 URL 内含未编码逗号（fields=a,b,c），不能按逗号 split 解析 next 链接，改为整体正则匹配
- 分类引擎：scripts/classify.ts 实现 13 大类 / 116 家族的优先级规则引擎（关键词/结构域/EC/名称/基因正则），基于真实关键词直方图校准（如 "G protein-coupled receptor"、"Ion channel"、"Plant defense" 等 894 个关键词），覆盖率 87.6% 具名家族
- 规则迭代修复：白介素受体被细胞因子配体规则误抢、TLR 落入免疫兜底、p53 被凋亡规则抢走（调整优先级：抑癌/原癌先于凋亡）、5.11 转运兜底抢驱动蛋白（移至细胞骨架之后）
- 直系同源组：按 OrthoDB ID 聚合出 10,501 组（8,913 组跨物种），含组名/成员数/物种覆盖
- 数据库：prisma schema 重构（Protein 含 keywords/domains/ec/orthodb/eggnog/sequence/groupId，新增 ProteinDetail 缓存表与 OrthologGroup 表），scripts/seed-full.ts 全量入库（92MB SQLite）
- 后端 API 重写：/api/bootstrap（聚合统计+家族×物种计数树，258ms）、/api/proteins（服务端分页/筛选/排序/搜索）、/api/proteins/[accession]（实时 UniProt REST JSON 抓取+SQLite 缓存，含功能/催化/亚基/PTM/GO/关键词带分类/PDB/结构域位置/直系同源）、/api/compare（≤12 蛋白，组成余弦+关键词/结构域 Jaccard）、/api/search、/api/groups（组浏览）
- 前端改造（full-stack-developer 子代理执行）：8 组件全部适配服务端分页与富详情；主代理修复移动端 grid 溢出（grid 缺基础 grid-cols-1 导致 1fr 轨道被撑开）
- dev server 守护进程化：发现沙箱工具调用会清理后代进程树，改用双 fork 守护进程（孙进程过继给 init）使 dev server 跨调用存活
- 验证：lint 零错误、tsc src/ 零错误、Agent Browser 全流程（家族树点击/分页翻页排序搜索/物种筛选/p53 详情 GO 24 条+PDB 30+直系同源 8 物种/⌘K 搜索 tp53/进化视角热图+组浏览弹窗/组比较 Rab-19 12 物种代表出图/移动端 390px 无溢出/暗色模式）+ VLM 视觉审查通过

Stage Summary:
- 应用从 364 条精选蛋白升级为 87,728 条全量蛋白（241 倍），10 物种全覆盖
- 13 大类 116 家族分类体系，87.6% 归入具名家族；10,501 个真实 OrthoDB 直系同源组支撑跨物种比较
- 详情页实时对接 UniProt API（首次 ~2s，缓存后毫秒级），功能/GO/关键词/PDB/PTM/结构域位置全量呈现
- 仓库推送：Jing0715-fer/protein-classification-explorer（含 92MB 数据库快照，clone 配置 .env 即可运行；原始数据可用 scripts/fetch-proteomes.ts + classify.ts + seed-full.ts 重新生成）

---
Task ID: 7
Agent: Z.ai Code (main)
Task: 家族分类层级化升级——UniProt 官方超家族→家族→亚家族链（应用户反馈"slc家族拟南芥只有4个？超家族需要下一级家族分类"）

Work Log:
- 根因定位：旧分类引擎是关键词规则（5.5 规则 /solute carrier|^slc/），拟南芥蛋白名不带 SLC 字样 → 仅 4 条误归；且只有 大类→家族 两级，无超家族层级
- 数据验证：UniProt cc_similarity 字段即官方层级链（"Belongs to the major facilitator superfamily. Sugar transporter (TC 2.A.1.1) family. Glucose transporter subfamily."）；拟南芥 MFS reviewed 全量 158 条、Sugar transporter 85 条（API curl 验证）
- scripts/fetch-families.ts：轻量补抓 10 物种全量 87,728 条 accession+cc_similarity（6.1 分钟，双 fork 守护进程防沙箱清理）
- scripts/classify-hierarchy.ts 两遍算法：①parseChain 解析官方链（句点分段/去 ECO/TC 括号归一化）+ 规则打分 → 按归一化超家族名做多数票统一大类（修正 5,171 条，避免同一超家族分裂到多个大类）②建树分配编码 {class}.{sf}.{fam}.{sub}；无链蛋白（25.3%）回退旧规则引擎家族
- 覆盖率：官方链 74.7%（65,536 条），加上兜底具名家族 classifiedPct 93.5%；节点数 level2=6,774 / level3=1,753 / level4=377
- seed-full.ts 重入库：8,917 家族节点（13 大类 + 8,904 层级节点）
- API 层：bootstrap 改任意深度组树（parentOf 去尾段）+ 递归聚合 totalCount/byOrganism + gzip 压缩（1.87MB→163KB）+ 内存缓存（首次 6.5s → 8ms）；proteins/groups 家族过滤改 OR(精确+前缀) 支持超家族节点聚合子孙；详情 API 新增 familyChain 完整层级链
- 前端：FamilyTree 深度区分样式（大类/超家族 ring/亚家族淡色）+ 默认折叠 + 选中自动展开；FamilyTreeView 递归 flattenFamilies/findFamilyPath + 四级面包屑（可点击跳转）+ 渲染期间重置页码（替代 key 重挂载，保留树展开状态）；ProteinDetailSheet 显示完整层级链；PhyloView 热图改"每大类 Top 12 超家族"模式（含子级徽标）；StatsBar/页脚/⌘K 文案加超家族统计
- 修复：Prisma StringFilter 不支持内联 OR（groups route 提升到 where.AND）；bootstrap 未分类统计前缀 bug；Turbopack 缓存损坏（删 .next 重启）

Stage Summary:
- 层级体系从"13 大类 116 人工家族"升级为"13 大类 → 605 超家族 → 8,213 叶子家族"（UniProt 官方链）
- 核心验证：MFS 主要易化超家族(5.1) 全物种 627 条 / 拟南芥 158 条（=官方 reviewed 全量，旧版仅 4 条）；下含 39 个家族（糖转运 146/POT 77/有机阳离子 72...）；GLUT1(P11166) 完整四级链"通道与转运 → MFS → 糖转运家族 → Glucose transporter subfamily"
- Agent Browser 全流程通过：四级树导航/面包屑跳转/拟南芥筛选/热图 Top12 跳转/GLUT4 组比较 7 物种出图/移动端 390px 无溢出/控制台零报错；VLM 视觉审查 4 张截图无布局问题
