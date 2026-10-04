/**
 * 层级分类引擎 v3：超家族唯一节点 + 全局去重
 * 层级结构：13 大类 → [超群(group) →] 超家族 → 家族 → 亚家族
 * 核心原则（应用户反馈"家族在多级同时出现、内容不统一"重构）：
 *   1) 每个超家族在整棵树中只出现一次（如 MFS 仅存在于 SLC 超群下，聚合全部物种成员）
 *   2) SLC 超群 = 溶质载体全集：动物按 SLC 编号家族归入 18+1 个超家族分支；
 *      植物/酵母/细菌成员通过 UniProt 官方链家族整体并入对应分支
 *   3) 全局同名节点去重（泛型亚家族标签除外），修复 Rho/Arginase/NIT/激酶亚家族等历史分裂
 * 输入: download/proteomes/*.jsonl + download/families/*.jsonl
 * 输出: download/hier-families.json + download/hier-classified.jsonl + download/hier-report.json
 * 运行: bun run scripts/classify-hierarchy.ts
 */
import type { RawProtein } from "./fetch-proteomes";
import type { FamilyRaw } from "./fetch-families";
import { CLASSES, FAMILIES, classify } from "./classify";

const TAXA = [9606, 10090, 10116, 7955, 9031, 7227, 6239, 559292, 3702, 83333];
const FAM_BY_CODE = new Map(FAMILIES.map((f) => [f.code, f]));

// ===== 1) 官方链解析 =====
/** 解析 cc_similarity 文本 → 家族链段落（最多取 3 级） */
export function parseChain(sim: string): string[] {
  if (!sim) return [];
  // 多条 SIMILARITY 注释以 "SIMILARITY:" 为界分开，取段数最多的一条
  const blocks = sim
    .split(/SIMILARITY:\s*/i)
    .map((b) =>
      b
        .replace(/\{ECO:[^}]*\}/g, "") // 去证据标签
        .replace(/^[;:\s]+|[;:\s]+$/g, "")
        .trim()
    )
    .filter(Boolean);
  let best: string[] = [];
  for (const b of blocks) {
    // 去掉双功能酶的区段前缀："In the N/C-terminal/2nd/3rd section; belongs to the ..."
    const cleaned = b.replace(
      /In the [\w-]+(?:-terminal)? section;\s*belongs to (?:the|a)\s*/gi,
      ""
    );
    // 按句点+空格分段（"TC 2.A.1.1" 括号内句点后无空格，不受影响）
    const parts = cleaned
      .split(/(?<=\.)\s+(?=[A-Z0-9])/)
      .map((p) =>
        p
          .replace(/\.+$/, "")
          .replace(/^Belongs to the\s+/i, "")
          .replace(/^Belongs to a\s+/i, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter((p) => p.length > 1)
      .flatMap((p) => {
        // 修复 "X superfamily. lowercase-name family" 句点泄漏
        // （如 "ABC transporter superfamily. sn-glycerol-3-phosphate importer family"）
        const m = p.match(/^(.*(?:superfamily|family))\.\s+([a-z][a-z0-9].*)$/);
        if (m && m[1].length > 10 && m[2].length > 5) return [m[1], m[2]];
        return [p];
      })
      .map((p) => canonName(p));
    if (parts.length > best.length) best = parts;
  }
  return best.slice(0, 3);
}

/** 同义超家族名归一（合并 UniProt 写法变体，避免同一家族分裂并列） */
const CANON_SYNONYMS: [RegExp, string][] = [
  [/^aquaporins?$/i, "MIP/aquaporin family"],
  [/^aquaporin family$/i, "MIP/aquaporin family"],
  [/^major intrinsic protein(?: family)?$/i, "MIP/aquaporin family"],
  [/^immunoglobulin superfamily(?! domain)/i, "immunoglobulin superfamily"],
  // ABC 转运：旧引擎兜底名 "ABC transporters" 与官方链 "ABC transporter superfamily" 归一
  [/^abc transporters?$/i, "ABC transporter superfamily"],
  // TC 2.A.2 同家族两种写法：钠:半乳糖同向转运 = GPH 家族
  [/^sodium:galactoside symporter family$/i, "Glycoside-pentoside-hexuronide (GPH) cation symporter family"],
  [/^glycoside-pentoside-hexuronide \(gph\) cation symporter transporter family$/i, "Glycoside-pentoside-hexuronide (GPH) cation symporter family"],
];

function canonName(seg: string): string {
  for (const [re, canon] of CANON_SYNONYMS) {
    if (re.test(seg)) return canon;
  }
  return seg;
}

/** 展示用短名：去 TC/EC 编号括号等 */
function shortName(en: string): string {
  return en
    .replace(/\s*\(TC [^)]*\)/gi, "")
    .replace(/\s*\(EC [0-9.()-]+\)/gi, "")
    .replace(/\.+$/, "")
    .replace(/\s*(family|superfamily)\s+\1$/i, "$1") // "family family" 泄漏
    .replace(/\)(family|superfamily)$/i, ") $1") // "(MHS)family" 缺空格泄漏
    .replace(/\s+/g, " ")
    .trim();
}

/** 归一化 key：短名小写（合并 "X" 与 "X (TC 2.A.1)" 变体） */
function normKey(en: string): string {
  return shortName(en).toLowerCase();
}

// ===== 2) 大类判定（基于链名，回退旧引擎 class） =====
const CLASS_RULES: { re: RegExp; code: string }[] = [
  // 离子通道（先于 receptor 泛匹配）
  { re: /ionotropic|ligand-gated|glutamate-gated|cys-loop|two pore domain|voltage-(dependent|gated)|potassium channel|sodium channel|calcium channel|chloride channel|ion channel/i, code: "5" },
  // 核受体（先于 receptor）
  { re: /nuclear receptor|steroid hormone receptor/i, code: "4" },
  // GPCR
  { re: /g protein-coupled receptor|gpcr|olfactory receptor|\bopsin\b|rhodopsin-like|7tm receptor/i, code: "3" },
  // 激酶
  { re: /kinase/i, code: "2" },
  // 转运（含 MFS 各种写法）
  { re: /major facilitator|transporter|symporter|antiporter|permease|\bcarrier\b|porin|aquaporin|major intrinsic|atp-binding cassette|abc transporter|abc-type|solute|efflux|secretion system|translocase|\bmfs\b/i, code: "5" },
  // 小G蛋白/信号开关
  { re: /gtpase|gtp-binding|gtp-binding protein|\bras\b|\brab\b|\brho\b|\barf\b|\bran\b|\bsar\b|ga protein|calmodulin|ef-hand/i, code: "3" },
  // 细胞骨架结构
  { re: /tubulin|actin-related|actin depolymeriz|\bactin\b|myosin|kinesin|dynein|keratin|intermediate filament|septin|profilin|tropomyosin|troponin|spectrin|cilium|microtubule/i, code: "6" },
  // ECM/分泌
  { re: /collagen|fibronectin|laminin|elastin|extracellular matrix|integrin|fibrinogen|vitronectin|globin|lipocalin|secreted/i, code: "7" },
  // 免疫防御
  { re: /immunoglobulin|\bmhc\b|interleukin|interferon|cytokine|defensin|complement|toll-like|tumor necrosis|cathelicidin/i, code: "8" },
  // 蛋白质稳态
  { re: /ubiquitin|proteasome|heat shock|\bhsp\b|chaperon|chaperone/i, code: "10" },
  // 细胞周期
  { re: /cyclin|oncogene|tumor suppressor|tumor progression/i, code: "11" },
  // 转录与染色质
  { re: /transcription|zinc finger|homeobox|homeodomain|leucine zipper|helix-loop-helix|forkhead|high mobility group|\bhmg\b|chromatin|histone|nucleosome|swi\/snf|polycomb|\bmyb\b/i, code: "4" },
  // 核酸加工
  { re: /helicase|topoisomerase|polymerase|ribonucle|deoxyribonucle|nuclease|spliceosome|dead-box|rna-binding|dna-binding|recombination/i, code: "12" },
  // 核糖体与翻译
  { re: /ribosom|elongation factor|initiation factor|aminoacyl|\brrna\b/i, code: "9" },
  // 酶类（泛称兜底）
  { re: /oxidoreductase|dehydrogenase|transferase|hydrolase|lyase|isomerase|ligase|synthase|synthetase|phosphatase|peptidase|protease|oxygenase|peroxidase|catalase|mutase|cyclase|phospholipase|lipase|esterase|glycosidase|glycosyltransferase|acetyltransferase|methyltransferase|demethylase|deacetylase/i, code: "1" },
];

/** 由链名判定大类；无命中时回退旧引擎 class / EC / 其他 */
function classForChain(segs: string[], oldClass: string, hasEC: boolean): string {
  const text = segs.join(" ");
  for (const r of CLASS_RULES) {
    if (r.re.test(text)) return r.code;
  }
  if (/^[1-9]$|^1[0-3]$/.test(oldClass)) return oldClass;
  if (hasEC) return "1";
  return "13";
}

// ===== 3) 常见超家族/家族中文映射 =====
const ZH_MAP: [RegExp, string][] = [
  [/^major facilitator/i, "MFS 主要易化超家族"],
  [/^atp-binding cassette|^abc transporter/i, "ABC 转运蛋白超家族"],
  [/^protein kinase/i, "蛋白激酶超家族"],
  [/^g protein-coupled receptor/i, "G蛋白偶联受体家族"],
  [/^ionotropic glutamate/i, "离子型谷氨酸受体家族"],
  [/^nuclear receptor/i, "核受体家族"],
  [/^zinc finger/i, "锌指转录因子家族"],
  [/^homeobox/i, "同源框因子家族"],
  [/^basic leucine zipper|^bzip/i, "bZIP 转录因子家族"],
  [/^basic helix-loop-helix|^bhlh/i, "bHLH 转录因子家族"],
  [/^forkhead/i, "Forkhead 转录因子家族"],
  [/^high mobility group|^hmg/i, "HMG-box 因子家族"],
  [/^heat shock protein 70/i, "热激蛋白 70 家族"],
  [/^heat shock protein 90/i, "热激蛋白 90 家族"],
  [/^chaperonin/i, "伴侣蛋白家族"],
  [/^small gtpase/i, "小GTP酶超家族"],
  [/^rab\b|^rab family/i, "RAB 家族"],
  [/^ras\b|^ras family/i, "RAS 家族"],
  [/^rho\b|^rho family|^rac\b|^cdc42/i, "RHO 家族"],
  [/^actin-related|^arp\b/i, "肌动蛋白相关家族"],
  [/^actin\b/i, "肌动蛋白家族"],
  [/^tubulin/i, "微管蛋白家族"],
  [/^myosin/i, "肌球蛋白超家族"],
  [/^kinesin/i, "驱动蛋白超家族"],
  [/^dynein/i, "动力蛋白超家族"],
  [/^histone/i, "组蛋白家族"],
  [/^ribosomal protein/i, "核糖体蛋白家族"],
  [/^ubiquitin/i, "泛素家族"],
  [/^proteasome/i, "蛋白酶体家族"],
  [/^cytochrome p450/i, "细胞色素 P450 家族"],
  [/^mitochondrial carrier/i, "线粒体载体家族"],
  [/^sugar (transporter|porter)/i, "糖转运蛋白家族"],
  [/^peptide transporter|^proton-dependent oligopeptide/i, "肽转运蛋白家族"],
  [/^amino acid(-| )permease|amino acid transporter/i, "氨基酸转运蛋白家族"],
  [/^aquaporin|^major intrinsic/i, "水通道蛋白家族"],
  [/^sodium:neurotransmitter/i, "钠依赖神经递质转运家族"],
  [/^sodium-coupled/i, "钠耦联转运家族"],
  [/^voltage-(dependent|gated)/i, "电压门控离子通道家族"],
  [/^potassium channel/i, "钾离子通道家族"],
  [/^sodium channel/i, "钠离子通道家族"],
  [/^calcium channel/i, "钙离子通道家族"],
  [/^chloride channel/i, "氯离子通道家族"],
  [/^cys-loop|^ligand-gated/i, "配体门控离子通道家族"],
  [/^immunoglobulin/i, "免疫球蛋白超家族"],
  [/^mhc\b/i, "MHC 家族"],
  [/^interleukin/i, "白细胞介素家族"],
  [/^interferon/i, "干扰素家族"],
  [/^tumor necrosis/i, "TNF 家族"],
  [/^defensin/i, "防御素家族"],
  [/^cyclin/i, "周期蛋白家族"],
  [/^collagen/i, "胶原家族"],
  [/^fibronectin/i, "纤连蛋白家族"],
  [/^keratin/i, "角蛋白家族"],
  [/^globin/i, "珠蛋白家族"],
  [/^calmodulin|^ef-hand/i, "钙调蛋白/EF-hand 家族"],
  [/^annexin/i, "膜联蛋白家族"],
  [/^aldehyde dehydrogenase/i, "醛脱氢酶家族"],
  [/^short-chain dehydrogenase/i, "短链脱氢酶/还原酶家族"],
  [/^cytochrome c\b/i, "细胞色素 c 家族"],
  [/^thioredoxin/i, "硫氧还蛋白家族"],
  [/^glutathione/i, "谷胱甘肽转移酶家族"],
  [/^dna polymerase/i, "DNA 聚合酶家族"],
  [/^rna polymerase/i, "RNA 聚合酶家族"],
  [/^topoisomerase/i, "拓扑异构酶家族"],
  [/^elongation factor/i, "延伸因子家族"],
  [/^olfactory receptor/i, "嗅觉受体家族"],
  [/^opsin|^rhodopsin/i, "视蛋白家族"],
  [/^fatty acid/i, "脂肪酸结合蛋白家族"],
  [/^lipocalin/i, "脂质运载蛋白家族"],
  [/^serpin/i, "丝氨酸蛋白酶抑制剂家族"],
  [/^p450\b/i, "细胞色素 P450 家族"],
  [/^arrestin/i, "阻遏蛋白家族"],
  [/^syntaxin|^snare/i, "SNARE 家族"],
  [/^intermediate filament/i, "中间丝家族"],
  [/^guanine nucleotide/i, "鸟苷酸交换因子家族"],
];

function zhFor(en: string): string {
  const lower = en.toLowerCase();
  for (const [re, zh] of ZH_MAP) {
    if (re.test(lower)) return zh;
  }
  return "";
}

// ===== 4.5) SLC 超群定义 =====

/** SLC 超家族分支（IUPHAR/TC 分类，SLC 超群 → 超家族分支 → SLC 家族/官方链家族） */
const SLC_BRANCHES: Record<string, { nameEn: string; name: string }> = {
  MFS:   { nameEn: "Major facilitator superfamily (MFS)", name: "MFS 主要易化超家族" },
  MCF:   { nameEn: "Mitochondrial carrier (MCF) family", name: "MCF 线粒体载体超家族" },
  APC:   { nameEn: "Amino acid/polyamine/organocation (APC) superfamily", name: "APC 氨基酸/多胺/有机阳离子超家族" },
  METAL: { nameEn: "Metal ion transporters (NRAMP/ZnT/ZIP/CTR/FPN/MgtE)", name: "金属离子转运体超群" },
  NST:   { nameEn: "Nucleotide-sugar transporter (NST) family", name: "NST 糖核苷酸转运体家族" },
  NSS:   { nameEn: "Neurotransmitter:sodium symporter (NSS) family", name: "NSS 神经递质钠同向转运家族" },
  CPA1:  { nameEn: "Monovalent cation:proton antiporter-1 (CPA1)", name: "CPA1 单价阳离子:质子反向转运" },
  SSF:   { nameEn: "Solute:sodium symporter (SSF) family", name: "SSF 钠:溶质同向转运家族" },
  HCO3:  { nameEn: "Bicarbonate transporter family (SLC4)", name: "SLC4 碳酸氢盐转运体" },
  DAACS: { nameEn: "Dicarboxylate/amino acid:cation symporter (DAACS)", name: "DAACS 二羧酸/氨基酸阳离子同向转运" },
  CACA:  { nameEn: "Ca2+/cation antiporter (CaCA) family", name: "CaCA 钙/阳离子反向转运家族" },
  SULP:  { nameEn: "Sulfate permease (SulP) family", name: "SulP 硫酸盐通透酶家族" },
  CCC:   { nameEn: "Cation-chloride cotransporter (CCC) family", name: "CCC 阳离子-氯共转运家族" },
  NUC:   { nameEn: "Nucleoside & vitamin transporters (CNT/ENT/SVCT/RFVT)", name: "核苷与维生素转运体" },
  BASS:  { nameEn: "Bile acid:sodium symporter (BASS) family", name: "BASS 胆汁酸:钠同向转运家族" },
  PHOS:  { nameEn: "Na+-phosphate cotransporters (NaPi/PiT)", name: "钠磷共转运 (NaPi/PiT)" },
  MATE:  { nameEn: "Multidrug and toxic compound extrusion (MATE) family", name: "MATE 多药外排转运体家族" },
  SWEET: { nameEn: "SWEET sugar transporter family (SLC50)", name: "SWEET 糖外排转运家族 (SLC50)" },
  OTHER: { nameEn: "Other SLC families", name: "其他 SLC 家族" },
};

/**
 * 官方链超家族/家族节点 → SLC 分支拼接映射。
 * 命中的独立节点（含全部子树与跨物种成员）整体并入对应分支，
 * 确保每个超家族在树中只有一个节点。
 */
const SPLICE_TO_BRANCH: { re: RegExp; branch: string }[] = [
  { re: /^major facilitator( superfamily)?$/, branch: "MFS" },
  { re: /^glycoside-pentoside-hexuronide \(gph\) cation symporter family$/, branch: "MFS" }, // TC 2.A.2（SLC45 所在家族）
  { re: /^organo anion transporter family$/, branch: "MFS" }, // SLCO/OATP（TC 2.A.60）
  { re: /^mitochondrial carrier( family)?$/, branch: "MCF" },
  { re: /^amino acid[-/]polyamine[-/]organocation \(apc\) superfamily$/, branch: "APC" },
  { re: /^amino acid\/polyamine transporter 2 family$/, branch: "APC" }, // SLC32/36/38 的官方链超家族
  { re: /^zip transporter family$/, branch: "METAL" }, // SLC39
  { re: /^cation diffusion facilitator \(cdf\) transporter family$/, branch: "METAL" }, // SLC30
  { re: /^nramp family$/, branch: "METAL" }, // SLC11
  { re: /^copper transporter \(ctr\) family$/, branch: "METAL" }, // SLC31
  { re: /^membrane magnesium transporter family$/, branch: "METAL" }, // SLC41/MgtE
  { re: /^nucleotide-sugar transporter family$/, branch: "NST" }, // SLC35
  { re: /^sodium:neurotransmitter symporter \(snf\) family$/, branch: "NSS" }, // SLC6
  { re: /^monovalent cation:proton antiporter 1 \(cpa1\) transporter family$/, branch: "CPA1" }, // SLC9
  { re: /^sodium:solute symporter \(ssf\) family$/, branch: "SSF" }, // SLC5
  { re: /^anion exchanger family$/, branch: "HCO3" }, // SLC4
  { re: /^bicarbonate transporter( family)?$/, branch: "HCO3" }, // SLC4
  { re: /^dicarboxylate\/amino acid:cation symporter \(daacs\) family$/, branch: "DAACS" }, // SLC1
  { re: /^slc13a\/dass transporter family$/, branch: "DAACS" }, // SLC13
  { re: /^ca\(2\+\):cation antiporter \(caca\) family$/, branch: "CACA" }, // SLC8/24
  { re: /^slc26a\/sulp transporter family$/, branch: "SULP" }, // SLC26
  { re: /^sulfate permease( family)?$/, branch: "SULP" },
  { re: /^slc12a transporter family$/, branch: "CCC" }, // SLC12
  { re: /^cation-chloride cotransporter family$/, branch: "CCC" }, // SLC12
  { re: /^slc29a\/ent transporter family$/, branch: "MFS" }, // SLC29/ENT（ENT 属 MFS）
  { re: /^concentrative nucleoside transporter \(cnt\) family$/, branch: "NUC" }, // SLC28
  { re: /^nucleobase:cation symporter-2 \(ncs2\) family$/, branch: "NUC" }, // SLC23
  { re: /^riboflavin transporter family$/, branch: "NUC" }, // SLC52
  { re: /^bile acid:sodium symporter \(bass\) family$/, branch: "BASS" }, // SLC10
  { re: /^inorganic phosphate transporter \(pit\) family$/, branch: "PHOS" }, // SLC20
  { re: /^sodium-dependent phosphate cotransporter family$/, branch: "PHOS" }, // SLC34
  { re: /^slc34a transporter family$/, branch: "PHOS" }, // SLC34（单段链）
  { re: /^multi antimicrobial extrusion \(mate\) family$/, branch: "MATE" }, // SLC47
  { re: /^sweet sugar transporter family$/, branch: "SWEET" }, // SLC50
  { re: /^ctl \(choline transporter-like\) family$/, branch: "OTHER" }, // SLC44
  { re: /^laat-1 family$/, branch: "OTHER" }, // SLC66
  // 兜底：单段链 "SLCxxA transporter family" 直接并入对应分支（防非 SLC 命名成员残留在外）
];

/** 链节点名提取 SLC 编号（如 "SLC30A subfamily" → "30"） */
const SLC_SUBFAM_RE = /^slc-?(\d+)[a-g]? subfamily$/;
const SLC_CHAINFAM_RE = /^slc-?(\d+)[a-g]? transporter family$/;

/** SLC 家族编号 → (分支, 中文, 别名)；未列编号回退 OTHER + 链/名称推断 */
const SLC_FAMS: Record<string, { b: string; zh: string; alias: string }> = {
  SLC1:   { b: "DAACS", zh: "兴奋性氨基酸转运", alias: "EAAT" },
  SLC2:   { b: "MFS",   zh: "易化葡萄糖转运", alias: "GLUT" },
  SLC3:   { b: "APC",   zh: "氨基酸转运重链", alias: "rBAT/4F2hc" },
  SLC4:   { b: "HCO3",  zh: "碳酸氢盐/氯交换", alias: "AE" },
  SLC5:   { b: "SSF",   zh: "钠/葡萄糖碘同向转运", alias: "SGLT/NIS" },
  SLC6:   { b: "NSS",   zh: "神经递质钠同向转运", alias: "DAT/SERT/NET" },
  SLC7:   { b: "APC",   zh: "氨基酸转运轻链", alias: "LAT/y+" },
  SLC8:   { b: "CACA",  zh: "钠钙交换", alias: "NCX" },
  SLC9:   { b: "CPA1",  zh: "钠氢交换", alias: "NHE" },
  SLC10:  { b: "BASS",  zh: "胆汁酸钠同向转运", alias: "ASBT/NTCP" },
  SLC11:  { b: "METAL", zh: "二价金属离子转运", alias: "NRAMP/DMT1" },
  SLC12:  { b: "CCC",   zh: "阳离子-氯共转运", alias: "NKCC/KCC" },
  SLC13:  { b: "DAACS", zh: "羧酸/硫酸钠同向转运", alias: "NaDC/NaSi" },
  SLC14:  { b: "OTHER", zh: "尿素转运", alias: "UT" },
  SLC15:  { b: "MFS",   zh: "质子依赖寡肽转运", alias: "PEPT" },
  SLC16:  { b: "MFS",   zh: "单羧酸转运", alias: "MCT" },
  SLC17:  { b: "MFS",   zh: "囊泡谷氨酸/核苷酸转运", alias: "VGLUT" },
  SLC18:  { b: "MFS",   zh: "囊泡单胺/乙酰胆碱转运", alias: "VMAT/VAChT" },
  SLC19:  { b: "MFS",   zh: "叶酸/硫胺素转运", alias: "RFC/THTR" },
  SLC20:  { b: "PHOS",  zh: "III 型钠磷共转运", alias: "PiT" },
  SLC22:  { b: "MFS",   zh: "有机阳离子/阴离子转运", alias: "OCT/OAT" },
  SLC23:  { b: "NUC",   zh: "抗坏血酸/核碱基转运", alias: "SVCT" },
  SLC24:  { b: "CACA",  zh: "钠钙钾交换", alias: "NCKX" },
  SLC25:  { b: "MCF",   zh: "线粒体载体", alias: "MC" },
  SLC26:  { b: "SULP",  zh: "硫酸盐/阴离子交换", alias: "SulP" },
  SLC27:  { b: "OTHER", zh: "长链脂肪酸转运", alias: "FATP" },
  SLC28:  { b: "NUC",   zh: "浓缩型核苷转运", alias: "CNT" },
  SLC29:  { b: "MFS",   zh: "平衡型核苷转运", alias: "ENT" },
  SLC30:  { b: "METAL", zh: "锌外排转运", alias: "ZnT" },
  SLC31:  { b: "METAL", zh: "铜摄入转运", alias: "CTR" },
  SLC32:  { b: "APC",   zh: "囊泡 GABA/甘氨酸转运", alias: "VGAT" },
  SLC33:  { b: "MFS",   zh: "乙酰辅酶 A 转运", alias: "ACATN" },
  SLC34:  { b: "PHOS",  zh: "II 型钠磷共转运", alias: "NaPi" },
  SLC35:  { b: "NST",   zh: "糖核苷酸转运", alias: "NST" },
  SLC36:  { b: "APC",   zh: "质子偶联氨基酸转运", alias: "PAT" },
  SLC37:  { b: "MFS",   zh: "糖磷酸反向转运", alias: "G6PT" },
  SLC38:  { b: "APC",   zh: "钠偶联中性氨基酸转运", alias: "SNAT" },
  SLC39:  { b: "METAL", zh: "锌摄入转运", alias: "ZIP" },
  SLC40:  { b: "METAL", zh: "铁外排转运", alias: "FPN" },
  SLC41:  { b: "METAL", zh: "镁转运", alias: "MgtE" },
  SLC43:  { b: "MFS",   zh: "中性氨基酸转运", alias: "LAT4" },
  SLC44:  { b: "OTHER", zh: "胆碱转运样蛋白", alias: "CTL" },
  SLC45:  { b: "MFS",   zh: "糖质子同向转运", alias: "" },
  SLC46:  { b: "MFS",   zh: "质子偶联叶酸转运", alias: "PCFT" },
  SLC47:  { b: "MATE",  zh: "多药及毒性化合物外排", alias: "MATE" },
  SLC48:  { b: "OTHER", zh: "血红素转运", alias: "HRG" },
  SLC49:  { b: "MFS",   zh: "血红素/卟啉外排", alias: "FLVCR" },
  SLC50:  { b: "SWEET", zh: "糖外排转运", alias: "SWEET" },
  SLC51:  { b: "OTHER", zh: "有机溶质 α/β 转运", alias: "OST" },
  SLC52:  { b: "NUC",   zh: "核黄素转运", alias: "RFVT" },
  SLC60:  { b: "MFS",   zh: "MFSD 型糖转运", alias: "" },
  SLC61:  { b: "MFS",   zh: "MFSD 型转运", alias: "" },
  SLC66:  { b: "OTHER", zh: "溶酶体氨基酸转运", alias: "LAAT/PQ-loop" },
  SLC67:  { b: "MFS",   zh: "突触囊泡转运", alias: "SV2" },
  SLC68:  { b: "MFS",   zh: "MFSD 型转运", alias: "" },
  SLC71:  { b: "MFS",   zh: "糖转运 (HIAT)", alias: "" },
  SLC75:  { b: "MFS",   zh: "MFSD 型转运", alias: "" },
  SLCO:   { b: "MFS",   zh: "有机阴离子转运多肽", alias: "OATP" },
};

interface SlcAssign { branch: string; fam: string; name: string; nameEn: string }

/** SLC 家族展示名：多字母亚族家族（SLC8/9/18/35/51）不带 A 后缀 */
function slcFamLabel(num: string, isSLCO: boolean): string {
  if (isSLCO) return "SLCO";
  if (["8", "9", "18", "35", "51"].includes(num)) return `SLC${num}`;
  return `SLC${num}A`;
}

/** 判定 SLC 蛋白：基因名/蛋白名提取编号，映射超家族分支 */
function slcInfo(gene: string, pname: string, origSuperfamily: string): SlcAssign | null {
  const g = gene.trim();
  // SLC9 调节相关（NHERF/PDZK1 别名 SLC9A3R1；RSC1A1 名称自带 solute carrier；
  // SLC2A4RG 等 RG 结尾的是转录调节子而非转运体）
  if (/^NHERF|^RSC1A1/i.test(g) || /^SLC-?\d+[A-G]?\d*(RG|R\d)$/i.test(g)) {
    return { branch: "OTHER", fam: "SLCREG", name: "SLC 调节相关蛋白 (NHERF/RSC/SLC 调节子)", nameEn: "SLC regulatory proteins (NHERF/RSC1A1/SLC2A4RG)" };
  }
  let num: string | null = null;
  let isSLCO = false;
  let m = g.match(/^SLCO(\d+)/i);
  if (m) { num = m[1]; isSLCO = true; }
  // OATP 旧命名（如果蝇 Oatp74D）
  if (!m) { m = g.match(/^OATP/i); if (m) { isSLCO = true; num = ""; } }
  if (!m) {
    m = g.match(/^SLC-?(\d+)/i);
    if (m) num = m[1];
  }
  if (!num && !isSLCO) {
    m = pname.match(/[Ss]olute carrier family (\d+)/);
    if (m) num = m[1];
  }
  if (num === null && !isSLCO) return null;
  const numStr = (num ?? "").trim();
  if (!isSLCO && !numStr) return null;
  // 防假阳性（如酵母 SLC1 脂酰转移酶）：无字母后缀的基因要求蛋白名有转运体特征或链指向转运超家族；
  // 带字母后缀的哺乳动物式 SLC 基因（SLC35A4 等，含微蛋白/异构体）直接认可
  const hasLetterSuffix = /^SLC-?\d+[A-G]/i.test(g) || /^SLCO\d/i.test(g);
  const looksTransporter = /solute carrier|transporter|symporter|antiporter|carrier|permease|exchange|transport/i.test(pname);
  const chainTransport = /major facilitator|carrier|transporter|symporter|antiporter|permease/i.test(origSuperfamily);
  if (!looksTransporter && !chainTransport && !hasLetterSuffix) return null;
  const famKey = isSLCO ? "SLCO" : `SLC${numStr}`;
  const def = SLC_FAMS[famKey];
  let branch = def?.b ?? "OTHER";
  const zh = def?.zh ?? "";
  const alias = def?.alias ?? "";
  // 未列编号：链指向 MFS 则归 MFS
  if (!def && /major facilitator|mfs/i.test(origSuperfamily)) branch = "MFS";
  let name: string;
  let nameEn: string;
  if (isSLCO) {
    name = "SLCO · OATP 有机阴离子转运多肽";
    nameEn = "Organic anion transporting polypeptide family (SLCO/OATP)";
  } else {
    const label = slcFamLabel(numStr, false);
    name = alias ? `${label} · ${alias} ${zh}` : zh ? `${label} · ${zh}` : label;
    nameEn = `Solute carrier family ${numStr}${zh ? ` — ${alias || zh}` : ""}`;
  }
  return { branch, fam: famKey, name, nameEn };
}

/** 从原始链文本提取超家族段（用于 slcInfo 链推断） */
function superfamilyOfChain(segs: string[]): string {
  return segs[0] ?? "";
}

// ===== 4) 树节点构建 =====
interface TreeNode {
  nid: number; // 唯一数字 id（蛋白行的挂载引用，手术中保持稳定）
  parentNid: number | null;
  nameEn: string; // 官方名（首个出现的原貌）
  name: string; // 中文映射或英文短名
  level: number; // 2=超家族/超群 3=超家族分支 4=家族 5=亚家族
  code: string; // 分配后编码 {class}.{i}[.{j}[.{k}]]
  kind?: "group" | "surgery"; // 手术组节点标记（超群/超家族分支）
  directCount: number; // 直接挂该节点的蛋白数
  totalCount: number; // 递归总数
  children: Map<string, TreeNode>; // key = normKey(nameEn)
}

const LEVEL_LABEL = ["", "大类", "超家族", "家族", "亚家族", "细分"];

let NID = 0;
const nodeById = new Map<number, TreeNode>();

function newNode(nameEn: string, level: number, parentNid: number | null, name?: string): TreeNode {
  const nid = ++NID;
  const zh = name ?? zhFor(nameEn);
  const node: TreeNode = {
    nid,
    parentNid,
    nameEn: shortName(nameEn),
    name: zh || shortName(nameEn),
    level,
    code: "",
    directCount: 0,
    totalCount: 0,
    children: new Map(),
  };
  nodeById.set(nid, node);
  return node;
}

/** 递归统计节点全部蛋白数（手术用，未算 totalCount 前） */
function countTree(n: TreeNode): number {
  return n.directCount + [...n.children.values()].reduce((s, c) => s + countTree(c), 0);
}

/** 递归剪除空节点（蛋白全部移走且无子节点） */
function pruneEmpty(children: Map<string, TreeNode>): number {
  let removed = 0;
  for (const [key, node] of [...children.entries()]) {
    removed += pruneEmpty(node.children);
    if (node.directCount <= 0 && node.children.size === 0) {
      children.delete(key);
      nodeById.delete(node.nid);
      removed++;
    }
  }
  return removed;
}

/** 重算层级（手术重挂后） */
function fixLevels(children: Map<string, TreeNode> | undefined, level: number) {
  if (!children) return;
  for (const node of children.values()) {
    node.level = level;
    fixLevels(node.children, level + 1);
  }
}

/** 遍历全部节点 */
function walkRoots(classRoots: Map<string, Map<string, TreeNode>>, fn: (n: TreeNode) => void) {
  const walk = (children: Map<string, TreeNode>) => {
    for (const n of children.values()) {
      fn(n);
      walk(n.children);
    }
  };
  for (const children of classRoots.values()) walk(children);
}

// ===== 去重保护名单：这些名称在不同父节点下是【不同】的类别，禁止跨父合并 =====
const DENY_MERGE_RE: RegExp[] = [
  // 泛型亚家族标签（含义依赖父节点）
  /^(type|class|subtype|plant|other) [a-z0-9+-]+(\/[a-z0-9+-]+)?( subfamily)?$/,
  /^highly divergent$/,
  /^(alpha|beta|gamma|delta|epsilon) subunit$/,
  // 同名不同类（真实冲突）
  /^nip subfamily$/, // RING-type NIP ≠ 水通道蛋白 NIP
  /^atl subfamily$/, // RING-type ATL ≠ MGMT ATL
  /^ski2 subfamily$/, // helicase SKI2 ≠ DExH SKI2
  /^5-hydroxytryptamine receptor subfamily$/, // GPCR 5-HT ≠ 5-HT3 离子通道
];

function denyMerge(nameEn: string): boolean {
  const k = normKey(nameEn);
  return DENY_MERGE_RE.some((re) => re.test(k));
}

async function main() {
  const t0 = Date.now();
  console.log("=== 层级分类引擎 v3（超家族唯一节点 + 全局去重） ===");

  // 1) 读家族链
  const simByAcc = new Map<string, string>();
  for (const taxon of TAXA) {
    const f = Bun.file(`download/families/${taxon}.jsonl`);
    if (!(await f.exists())) continue;
    for (const line of (await f.text()).split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as FamilyRaw;
        if (r.accession && r.sim) simByAcc.set(r.accession, r.sim);
      } catch { /* 忽略 */ }
    }
  }
  console.log(`家族链: ${simByAcc.size} 条`);

  // 2) Pass A：解析所有蛋白的链 + 初步 class（规则优先/旧引擎回退）
  interface Entry {
    p: RawProtein;
    segs: string[];
    prelimClass: string;
    oldCode: string;
    nid: number; // 挂载节点
  }
  const entries: Entry[] = [];
  const voteBySF = new Map<string, Map<string, number>>(); // 归一化超家族名 -> class -> 票数
  let withChain = 0;

  for (const taxon of TAXA) {
    const file = Bun.file(`download/proteomes/${taxon}.jsonl`);
    if (!(await file.exists())) continue;
    for (const line of (await file.text()).split("\n")) {
      if (!line.trim()) continue;
      const p = JSON.parse(line) as RawProtein;
      const sim = simByAcc.get(p.accession) ?? "";
      const segs = parseChain(sim);
      const old = classify(p);
      const oldClass = old.code.split(".")[0];
      if (segs.length > 0) {
        withChain++;
        const prelim = classForChain(segs, oldClass, p.ecs.length > 0);
        entries.push({ p, segs, prelimClass: prelim, oldCode: old.code, nid: 0 });
        const sfKey = normKey(segs[0]);
        let votes = voteBySF.get(sfKey);
        if (!votes) {
          votes = new Map();
          voteBySF.set(sfKey, votes);
        }
        votes.set(prelim, (votes.get(prelim) ?? 0) + 1);
      } else {
        entries.push({ p, segs: [], prelimClass: oldClass, oldCode: old.code, nid: 0 });
      }
    }
  }
  console.log(`蛋白总数 ${entries.length}，官方链覆盖 ${withChain} (${((withChain / entries.length) * 100).toFixed(1)}%)`);

  // 3) 超家族名 → 最终 class（多数票）
  const classBySF = new Map<string, string>();
  let unified = 0;
  for (const [sfKey, votes] of voteBySF) {
    let best = "13";
    let bestN = -1;
    for (const [cls, n] of votes) {
      if (n > bestN) {
        best = cls;
        bestN = n;
      }
    }
    classBySF.set(sfKey, best);
  }
  for (const e of entries) {
    if (e.segs.length > 0) {
      const final = classBySF.get(normKey(e.segs[0])) ?? e.prelimClass;
      if (final !== e.prelimClass) unified++;
      e.prelimClass = final;
    }
  }
  console.log(`多数票统一超家族 ${classBySF.size} 个（修正 ${unified} 条蛋白的大类归属）`);

  // 4) Pass B：建树（兜底蛋白挂旧引擎家族）
  const classRoots = new Map<string, Map<string, TreeNode>>();

  for (const e of entries) {
    let classCode: string;
    let leafNode: TreeNode;

    if (e.segs.length > 0) {
      classCode = e.prelimClass;
      let children = classRoots.get(classCode);
      if (!children) {
        children = new Map();
        classRoots.set(classCode, children);
      }
      let parent: TreeNode | null = null;
      let node: TreeNode | null = null;
      for (let i = 0; i < e.segs.length; i++) {
        const nameEn = e.segs[i];
        const key = normKey(nameEn);
        node = children.get(key) ?? null;
        if (!node) {
          node = newNode(nameEn, i + 2, parent ? parent.nid : null);
          children.set(key, node);
        }
        children = node.children;
        parent = node;
      }
      leafNode = node!;
    } else {
      // 回退旧规则引擎家族（平级叶子）
      classCode = e.oldCode.split(".")[0];
      const oldFam = FAM_BY_CODE.get(e.oldCode);
      const nameEn = oldFam?.nameEn ?? "Unclassified";
      const zh = oldFam?.name ?? "";
      let children = classRoots.get(classCode);
      if (!children) {
        children = new Map();
        classRoots.set(classCode, children);
      }
      const key = "fb:" + e.oldCode.toLowerCase();
      let node = children.get(key);
      if (!node) {
        node = newNode(nameEn, 2, null, zh || undefined);
        children.set(key, node);
      }
      leafNode = node;
    }

    leafNode.directCount++;
    e.nid = leafNode.nid;
  }

  // ===== 4.9) 手术 1：SLC 超群统一（超家族唯一节点） =====
  /** 将 src 子树吸收进 dst（计数相加、子级按 normKey 递归并入、蛋白引用重定向） */
  const absorb = (dst: TreeNode, src: TreeNode) => {
    dst.directCount += src.directCount;
    for (const [ck, child] of [...src.children.entries()]) {
      child.parentNid = dst.nid;
      const ex = dst.children.get(ck);
      if (ex) absorb(ex, child);
      else dst.children.set(ck, child);
    }
    for (const e of entries) {
      if (e.nid === src.nid) e.nid = dst.nid;
    }
    nodeById.delete(src.nid);
  };
  {
    const t5 = classRoots.get("5")!;
    const slcGroup = newNode("Solute carrier supergroup (SLC)", 2, null, "溶质载体超群 (SLC)");
    slcGroup.kind = "group";
    t5.set(normKey(slcGroup.nameEn), slcGroup);
    const branchNodes = new Map<string, TreeNode>();
    for (const [bcode, b] of Object.entries(SLC_BRANCHES)) {
      const node = newNode(b.nameEn, 3, slcGroup.nid, b.name);
      node.kind = "surgery";
      slcGroup.children.set(bcode.toLowerCase(), node);
      branchNodes.set(bcode, node);
    }

    // 1a) 动物 SLC 蛋白按编号家族挂入分支（含无链蛋白）
    let moved = 0;
    const branchCount = new Map<string, number>();
    for (const e of entries) {
      const info = slcInfo(e.p.genePrimary ?? "", e.p.proteinName, superfamilyOfChain(e.segs));
      if (!info) continue;
      const oldLeaf = nodeById.get(e.nid);
      if (oldLeaf) oldLeaf.directCount--;
      const branchNode = branchNodes.get(info.branch)!;
      const famKey = "slc:" + info.fam.toLowerCase();
      let famNode = branchNode.children.get(famKey);
      if (!famNode) {
        famNode = newNode(info.nameEn, 4, branchNode.nid, info.name);
        branchNode.children.set(famKey, famNode);
      }
      famNode.directCount++;
      e.nid = famNode.nid;
      moved++;
      branchCount.set(info.branch, (branchCount.get(info.branch) ?? 0) + 1);
    }
    console.log(`手术·SLC 超群①：迁移 ${moved} 条 SLC 编号蛋白，分支分布：`);
    for (const [b, n] of [...branchCount.entries()].sort((x, y) => y[1] - x[1])) {
      console.log(`   ${b}: ${n}`);
    }

    // 1b) 官方链超家族节点整体并入对应分支（全部物种成员 → 每个超家族唯一节点）
    let spliced = 0;
    for (const cls of classRoots.keys()) {
      const children = classRoots.get(cls)!;
      for (const [key, node] of [...children.entries()]) {
        if (node === slcGroup) continue;
        const k = normKey(node.nameEn);
        const hit = SPLICE_TO_BRANCH.find((s) => s.re.test(k));
        if (!hit) continue;
        const branch = branchNodes.get(hit.branch)!;
        // 整体吸收：直接成员并入分支计数、子树重挂（同名递归吸收）、蛋白引用重定向
        const directBefore = node.directCount;
        const childrenBefore = node.children.size;
        absorb(branch, node);
        children.delete(key);
        spliced++;
        console.log(`   并入 ${hit.branch}: "${node.nameEn}" (直挂 ${directBefore}，子级 ${childrenBefore})`);
      }
    }
    console.log(`手术·SLC 超群②：${spliced} 个官方链超家族节点整体并入对应分支`);

    // 1c) 链式 "SLCxxA subfamily"/"SLCxxA transporter family" 节点吸收进对应 SLC 编号叶
    //（与 SLC 编号叶同族，避免同分支下两个 SLCxx 节点并存）
    const collect = (children: Map<string, TreeNode>, out: TreeNode[]) => {
      for (const n of children.values()) {
        const k = normKey(n.nameEn);
        if (SLC_SUBFAM_RE.test(k) || SLC_CHAINFAM_RE.test(k)) out.push(n);
        collect(n.children, out);
      }
    };
    const chainNodes: TreeNode[] = [];
    for (const children of classRoots.values()) collect(children, chainNodes);
    let absorbed = 0;
    for (const node of chainNodes) {
      if (!nodeById.has(node.nid)) continue; // 已随其他吸收处理
      const k = normKey(node.nameEn);
      const m = k.match(SLC_SUBFAM_RE) ?? k.match(SLC_CHAINFAM_RE);
      if (!m) continue;
      const num = m[1];
      const famKey = `SLC${num}`;
      const def = SLC_FAMS[famKey];
      const branch = branchNodes.get(def?.b ?? "OTHER")!;
      const leafKey = "slc:" + famKey.toLowerCase();
      let leaf = branch.children.get(leafKey);
      if (!leaf) {
        const label = slcFamLabel(num, false);
        const zh = def?.zh ?? "";
        const alias = def?.alias ?? "";
        leaf = newNode(
          `Solute carrier family ${num}${zh ? ` — ${alias || zh}` : ""}`,
          4,
          branch.nid,
          alias ? `${label} · ${alias} ${zh}` : zh ? `${label} · ${zh}` : label
        );
        branch.children.set(leafKey, leaf);
      }
      // 从原父节点移除
      if (node.parentNid !== null) {
        const parent = nodeById.get(node.parentNid);
        if (parent) {
          for (const [pk, pc] of [...parent.children.entries()]) {
            if (pc === node) { parent.children.delete(pk); break; }
          }
        }
      } else {
        for (const rc of classRoots.values()) {
          for (const [pk, pc] of [...rc.entries()]) {
            if (pc === node) { rc.delete(pk); break; }
          }
        }
      }
      absorb(leaf, node);
      absorbed++;
      console.log(`   吸收 SLC 编号叶: "${node.nameEn}" → ${leaf.name}（+${node.directCount} 直挂）`);
    }
    console.log(`手术·SLC 超群③：${absorbed} 个链式 SLC 节点吸收进对应编号叶`);
  }

  // ===== 4.95) 手术 2：GPCR 超家族分组 =====
  {
    const t3 = classRoots.get("3")!;
    const gpcr = newNode("G protein-coupled receptor (GPCR) superfamily", 2, null, "G 蛋白偶联受体超家族");
    gpcr.kind = "group";
    t3.set(normKey(gpcr.nameEn), gpcr);
    let movedNodes = 0;
    for (const [key, node] of [...t3.entries()]) {
      if (node === gpcr) continue;
      if (node.level === 2 && /^g protein-coupled receptor/i.test(node.nameEn)) {
        t3.delete(key);
        node.parentNid = gpcr.nid;
        gpcr.children.set(key, node);
        movedNodes++;
      }
    }
    console.log(`手术·GPCR 超家族分组：收拢 ${movedNodes} 个受体类节点（Class A/B/C/T2R/Fz-Smo）`);
  }

  // ===== 手术 3：组蛋白家族组 =====
  {
    const t4 = classRoots.get("4")!;
    const hist = newNode("Histone family group", 2, null, "组蛋白家族");
    hist.kind = "group";
    t4.set(normKey(hist.nameEn), hist);
    let movedNodes = 0;
    for (const [key, node] of [...t4.entries()]) {
      if (node.level === 2 && /^histone h[1-9]/i.test(node.nameEn)) {
        t4.delete(key);
        node.parentNid = hist.nid;
        hist.children.set(key, node);
        movedNodes++;
      }
    }
    console.log(`手术·组蛋白家族组：收拢 ${movedNodes} 个组蛋白亚型家族`);
  }

  // ===== 手术 4：免疫球蛋白合并 =====
  {
    const t8 = classRoots.get("8")!;
    const igKey = normKey("immunoglobulin superfamily");
    let igNode = t8.get(igKey);
    if (!igNode) {
      igNode = newNode("immunoglobulin superfamily", 2, null, "免疫球蛋白超家族 (IgSF)");
      t8.set(igKey, igNode);
    }
    igNode.name = "免疫球蛋白超家族 (IgSF)";
    for (const [key, node] of [...t8.entries()]) {
      if (node !== igNode && node.level === 2 && /^immunoglobulins$/i.test(node.nameEn)) {
        t8.delete(key);
        node.parentNid = igNode.nid;
        node.nameEn = "Immunoglobulin chains & Ig-like receptors";
        node.name = "免疫球蛋白链与 Ig 样受体";
        igNode.children.set(key, node);
        console.log("手术·IgSF 合并：Immunoglobulins 兜底节点收归免疫球蛋白超家族下");
      }
    }
  }

  // ===== 手术 5：生长素响应因子 ARF 迁移（转录因子误挂信号类） =====
  {
    const t3 = classRoots.get("3")!;
    const t4 = classRoots.get("4")!;
    for (const [key, node] of [...t3.entries()]) {
      if (node.level === 2 && /^ARF family$/.test(node.nameEn)) {
        const n = countTree(node);
        t3.delete(key);
        node.nameEn = "Auxin response factor (ARF) family";
        node.name = "生长素响应因子 (ARF) 家族";
        node.parentNid = null;
        t4.set(key, node);
        console.log(`手术·生长素 ARF 迁移：${n} 条拟南芥 ARF 转录因子 3 类 → 4 类`);
      }
    }
  }

  // ===== 手术 6：小 G 蛋白兜底分流 =====
  {
    const t3 = classRoots.get("3")!;
    let sgNode: TreeNode | undefined;
    for (const node of t3.values()) {
      if (node.level === 2 && /^small gtpases$/i.test(node.nameEn)) { sgNode = node; break; }
    }
    const sgsKey = normKey("small GTPase superfamily");
    const sgs = t3.get(sgsKey);
    if (sgNode && sgs) {
      const ensureUnderSGS = (nameEn: string, zh: string): TreeNode => {
        const k = normKey(nameEn);
        let n = sgs.children.get(k);
        if (!n) {
          n = newNode(nameEn, 3, sgs.nid, zh);
          sgs.children.set(k, n);
        }
        return n;
      };
      let moved = 0;
      for (const e of entries) {
        if (e.nid !== sgNode.nid) continue;
        const g = (e.p.genePrimary ?? "").trim();
        let target: TreeNode | undefined;
        if (/^RAB/i.test(g)) target = ensureUnderSGS("Rab family", "RAB 家族");
        else if (/^RHO|^RAC|^CDC42|^RND/i.test(g)) target = ensureUnderSGS("Rho family", "RHO 家族");
        else if (/^ARF\d|^ARL\d|^ARFRP|^ARFI/i.test(g)) target = ensureUnderSGS("Arf family", "ARF 家族");
        else if (/^RAN/i.test(g)) target = ensureUnderSGS("Ran family", "RAN 家族");
        else if (/^RAS|^HRAS|^KRAS|^NRAS|^RAP\d|^RAL|^RIT|^REM|^RHEB|^DIRAS|^ERAS|^RASD|^RASL|^SAR1/i.test(g))
          target = ensureUnderSGS("Other Ras-related GTPases", "其他 Ras 相关小 G 蛋白");
        if (!target) continue;
        target.directCount++;
        sgNode.directCount--;
        e.nid = target.nid;
        moved++;
      }
      if (sgNode.directCount <= 0 && sgNode.children.size === 0) {
        t3.delete(normKey(sgNode.nameEn));
        nodeById.delete(sgNode.nid);
      } else {
        sgNode.name = "其他 GTP 结合蛋白";
        sgNode.nameEn = "Other GTP-binding proteins";
      }
      console.log(`手术·小 G 蛋白兜底分流：${moved} 条按基因名归入对应家族`);
    }
  }

  // ===== 手术 7：全局同名家族去重（修复历史分裂的重复节点） =====
  {
    // 收集 level>=2 的全部节点，按 normKey 分组
    const byName = new Map<string, TreeNode[]>();
    walkRoots(classRoots, (n) => {
      if (n.level < 2) return;
      const k = normKey(n.nameEn);
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k)!.push(n);
    });
    let merged = 0;
    for (const [k, nodes] of byName) {
      if (nodes.length < 2) continue;
      if (denyMerge(nodes[0].nameEn)) continue; // 同名泛型标签：不合并
      // 目标选择：优先有父节点的（挂在超家族结构下的），其次子树更大
      const ranked = [...nodes].sort((a, b) => {
        const ap = a.parentNid !== null ? 0 : 1;
        const bp = b.parentNid !== null ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return countTree(b) - countTree(a);
      });
      const target = ranked[0];
      for (const src of ranked.slice(1)) {
        const srcParent = src.parentNid !== null ? nodeById.get(src.parentNid) : null;
        const srcDirect = src.directCount;
        // 从原父节点移除 src
        if (srcParent) {
          for (const [pk, pc] of [...srcParent.children.entries()]) {
            if (pc === src) { srcParent.children.delete(pk); break; }
          }
        } else {
          for (const rc of classRoots.values()) {
            for (const [pk, pc] of [...rc.entries()]) {
              if (pc === src) { rc.delete(pk); break; }
            }
          }
        }
        // 吸收进 target（计数/子级/蛋白引用全部处理）
        absorb(target, src);
        merged++;
        console.log(`去重·合并 "${k}": "${src.nameEn}" → "${target.nameEn}"（+${srcDirect} 直挂）`);
      }
    }
    console.log(`手术·全局同名去重：合并 ${merged} 个重复节点`);
  }

  // 手术后清理：剪空节点 + 重算层级
  let pruned = 0;
  for (const children of classRoots.values()) pruned += pruneEmpty(children);
  console.log(`手术·剪除空节点 ${pruned} 个`);
  for (const cls of CLASSES) {
    fixLevels(classRoots.get(cls.code), 2);
  }

  // 5) 编码分配：class 内 level2 按递归总数降序编号，子层同理
  const allNodes: TreeNode[] = [];
  const calcTotal = (n: TreeNode): number => {
    n.totalCount = n.directCount + [...n.children.values()].reduce((s, c) => s + calcTotal(c), 0);
    return n.totalCount;
  };
  const assignCodes = (children: Map<string, TreeNode>, prefix: string) => {
    const nodes = [...children.values()];
    nodes.sort((a, b) => b.totalCount - a.totalCount || a.nameEn.localeCompare(b.nameEn));
    nodes.forEach((n, i) => {
      n.code = `${prefix}.${i + 1}`;
      allNodes.push(n);
      if (n.children.size > 0) assignCodes(n.children, n.code);
    });
  };
  for (const cls of CLASSES) {
    const children = classRoots.get(cls.code);
    if (!children) continue;
    [...children.values()].forEach(calcTotal);
    assignCodes(children, cls.code);
  }

  // 6) 最终校验：① MFS 唯一 ② 无残留同名节点（除保护名单） ③ directCount 与蛋白引用一致
  const mfsNodes = allNodes.filter((n) => /^major facilitator/i.test(n.nameEn));
  console.log(`\n校验① MFS 节点数 = ${mfsNodes.length}（应为 1）`);
  for (const n of mfsNodes) {
    console.log(`   ${n.code} ${n.name} total=${n.totalCount} direct=${n.directCount} children=${n.children.size}`);
  }
  {
    const byName = new Map<string, TreeNode[]>();
    walkRoots(classRoots, (n) => {
      if (n.level < 2) return;
      const k = normKey(n.nameEn);
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k)!.push(n);
    });
    const remaining = [...byName.entries()].filter(([, v]) => v.length > 1 && !denyMerge(v[0].nameEn));
    console.log(`校验② 残留同名节点组 = ${remaining.length}（应为 0）`);
    for (const [k, v] of remaining.slice(0, 10)) {
      console.log(`   ✗ [${k}] ×${v.length}: ${v.map((n) => n.code).join(", ")}`);
    }
  }
  {
    const refCount = new Map<number, number>();
    for (const e of entries) refCount.set(e.nid, (refCount.get(e.nid) ?? 0) + 1);
    let bad = 0;
    for (const n of allNodes) {
      const refs = refCount.get(n.nid) ?? 0;
      if (refs !== n.directCount) {
        bad++;
        console.log(`   ✗ 不一致: ${n.code} "${n.nameEn}" directCount=${n.directCount} refs=${refs}`);
      }
    }
    console.log(`校验③ directCount 与蛋白引用一致：${bad} 个不一致（应为 0）`);
  }

  // 7) 写蛋白行（familyCode 回填）
  const outLines = entries.map((e) => {
    const node = nodeById.get(e.nid);
    if (!node) throw new Error(`蛋白 ${e.p.accession} 挂载节点丢失`);
    return JSON.stringify({ ...e.p, familyCode: node.code });
  });

  // 8) families.json（level 标注 + 路径描述）
  const famRows = allNodes.map((n) => {
    const pathSegs: string[] = [];
    let cur: TreeNode | undefined = n;
    while (cur && cur.parentNid !== null) {
      pathSegs.unshift(cur.nameEn);
      cur = nodeById.get(cur.parentNid);
    }
    const desc =
      pathSegs.length > 1
        ? `UniProt 官方层级: ${pathSegs.join(" → ")}`
        : `UniProt 官方${LEVEL_LABEL[n.level] ?? "分类"}`;
    return {
      code: n.code,
      name: n.name,
      nameEn: n.nameEn,
      description: desc,
      level: n.level,
      kind: n.kind ?? "",
      totalCount: n.totalCount,
    };
  });

  await Bun.write("download/hier-families.json", JSON.stringify({ classes: CLASSES, families: famRows }, null, 1));
  await Bun.write("download/hier-classified.jsonl", outLines.join("\n") + "\n");

  // 9) 报告
  const report = {
    total: entries.length,
    withChain,
    fallback: entries.length - withChain,
    unified,
    byClass: {} as Record<string, number>,
    levelCounts: {} as Record<string, number>,
    slcGroup: {} as Record<string, number>,
    dedupRemaining: 0,
  };
  for (const n of allNodes) {
    const lv = String(n.level);
    report.levelCounts[lv] = (report.levelCounts[lv] ?? 0) + 1;
  }
  for (const cls of CLASSES) {
    const children = classRoots.get(cls.code);
    if (!children) { report.byClass[cls.code] = 0; continue; }
    report.byClass[cls.code] = [...children.values()].reduce((s, c) => s + countTree(c), 0);
  }

  // SLC 超群验证输出
  const slcNode = allNodes.find((n) => n.kind === "group" && /^solute carrier supergroup/i.test(n.nameEn));
  if (slcNode) {
    console.log(`\nSLC 超群验证: ${slcNode.code} ${slcNode.name} total=${slcNode.totalCount}`);
    report.slcGroup.total = slcNode.totalCount;
    for (const b of [...slcNode.children.values()].sort((a, b) => b.totalCount - a.totalCount)) {
      console.log(`  ${b.code} ${b.name} — ${b.totalCount} 条，${b.children.size} 个家族，直挂 ${b.directCount}`);
      report.slcGroup[b.name] = b.totalCount;
      const fams = [...b.children.values()].sort((x, y) => y.totalCount - x.totalCount).slice(0, 6);
      for (const f of fams) console.log(`     · ${f.name} (${f.totalCount})`);
    }
  }
  // GPCR 超家族组验证
  const gpcrNode = allNodes.find((n) => n.kind === "group" && /GPCR/.test(n.nameEn));
  if (gpcrNode) {
    console.log(`\nGPCR 超家族验证: ${gpcrNode.code} ${gpcrNode.name} total=${gpcrNode.totalCount}，子类 ${gpcrNode.children.size} 个`);
  }
  await Bun.write("download/hier-report.json", JSON.stringify(report, null, 2));

  console.log(`\n=== 分类报告 ===`);
  for (const cls of CLASSES) {
    const n = report.byClass[cls.code] ?? 0;
    console.log(`类 ${cls.code} ${cls.name}: ${n} (${((n / entries.length) * 100).toFixed(1)}%)`);
  }
  console.log(`节点数: L2=${report.levelCounts["2"] ?? 0} L3=${report.levelCounts["3"] ?? 0} L4=${report.levelCounts["4"] ?? 0} L5=${report.levelCounts["5"] ?? 0}`);
  console.log(`\n=== 完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
