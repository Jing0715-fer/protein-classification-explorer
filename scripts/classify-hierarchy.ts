/**
 * 层级分类引擎 v2：基于 UniProt 官方家族链（cc_similarity "Belongs to..."）
 * 层级结构：13 大类 → 超家族(UniProt链第1段) → 家族(第2段) → 亚家族(第3段)
 * 两遍算法：① 解析链+规则打分 → 按归一化超家族名做多数票统一大类（避免同一超家族分裂）
 *          ② 建树分配编码；无链蛋白回退旧规则引擎家族
 * 节点 key 用归一化名（去 TC/EC 编号括号），避免同家族变体分裂
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
    // 去掉双功能酶的区段前缀："In the N/C-terminal section; belongs to the ..."
    const cleaned = b.replace(
      /In the (?:N|C)-terminal section;\s*belongs to (?:the|a)\s*/gi,
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
  [/^peptide transporter/i, "肽转运蛋白家族"],
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

// ===== 4.5) 层级手术：超群/同义合并/误并列修正 =====

/** SLC 超家族分支（IUPHAR/TC 分类，SLC 超群 → 超家族 → SLC 家族） */
const SLC_BRANCHES: Record<string, { nameEn: string; name: string }> = {
  MFS:   { nameEn: "Major facilitator superfamily (MFS)", name: "MFS 主要易化超家族" },
  APC:   { nameEn: "Amino acid/polyamine/organocation (APC) superfamily", name: "APC 氨基酸/多胺/有机阳离子超家族" },
  DAACS: { nameEn: "Dicarboxylate/amino acid:cation symporter (DAACS)", name: "DAACS 二羧酸/氨基酸阳离子同向转运" },
  NSS:   { nameEn: "Neurotransmitter:sodium symporter (NSS) family", name: "NSS 神经递质钠同向转运家族" },
  SSF:   { nameEn: "Solute:sodium symporter (SSF) family", name: "SSF 钠:溶质同向转运家族" },
  CPA1:  { nameEn: "Monovalent cation:proton antiporter-1 (CPA1)", name: "CPA1 单价阳离子:质子反向转运" },
  CACA:  { nameEn: "Ca2+/cation antiporter (CaCA) family", name: "CaCA 钙/阳离子反向转运家族" },
  CCC:   { nameEn: "Cation-chloride cotransporter (CCC) family", name: "CCC 阳离子-氯共转运家族" },
  SULP:  { nameEn: "Sulfate permease (SulP) family", name: "SulP 硫酸盐通透酶家族" },
  HCO3:  { nameEn: "Bicarbonate transporter family (SLC4)", name: "SLC4 碳酸氢盐转运体" },
  BASS:  { nameEn: "Bile acid:sodium symporter (BASS) family", name: "BASS 胆汁酸:钠同向转运家族" },
  MCF:   { nameEn: "Mitochondrial carrier (MCF) family", name: "MCF 线粒体载体超家族" },
  METAL: { nameEn: "Metal ion transporters (NRAMP/ZnT/ZIP/CTR/FPN/MgtE)", name: "金属离子转运体" },
  PHOS:  { nameEn: "Na+-phosphate cotransporters (NaPi/PiT)", name: "钠磷共转运 (NaPi/PiT)" },
  NST:   { nameEn: "Nucleotide-sugar transporter (NST) family", name: "糖核苷酸转运体家族" },
  NUC:   { nameEn: "Nucleoside & vitamin transporters (CNT/ENT/SVCT/RFVT)", name: "核苷与维生素转运体" },
  MATE:  { nameEn: "Multidrug and toxic compound extrusion (MATE) family", name: "MATE 多药外排转运体家族" },
  OTHER: { nameEn: "Other SLC families", name: "其他 SLC 家族" },
};

/** SLC 家族编号 → (分支, 中文, 别名)；未列编号回退 OTHER + 链/名称推断 */
const SLC_FAMS: Record<string, { b: string; zh: string; alias: string }> = {
  SLC1:   { b: "DAACS", zh: "兴奋性氨基酸转运", alias: "EAAT/GLAST" },
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
  SLC50:  { b: "MFS",   zh: "核黄素转运", alias: "RFT" },
  SLC51:  { b: "OTHER", zh: "有机溶质 α/β 转运", alias: "OST" },
  SLC52:  { b: "NUC",   zh: "核黄素转运", alias: "RFVT" },
  SLC66:  { b: "OTHER", zh: "PQ 环重复转运", alias: "PQ-loop" },
  SLC68:  { b: "MFS",   zh: "MFS 型转运", alias: "" },
  SLCO:   { b: "MFS",   zh: "有机阴离子转运多肽", alias: "OATP" },
};

interface SlcAssign { branch: string; fam: string; name: string; nameEn: string }

/** 判定 SLC 蛋白：基因名/蛋白名提取编号，映射超家族分支 */
function slcInfo(gene: string, pname: string, origSuperfamily: string): SlcAssign | null {
  const g = gene.trim();
  // SLC9 调节相关（NHERF 别名 SLC9A3R1；RSC1A1 名称自带 solute carrier）
  if (/^NHERF|^RSC1A1/i.test(g)) {
    return { branch: "OTHER", fam: "SLCREG", name: "SLC 调节相关蛋白 (NHERF/RSC)", nameEn: "SLC regulatory proteins (NHERF/RSC1A1)" };
  }
  let num: string | null = null;
  let isSLCO = false;
  let m = g.match(/^SLCO(\d+)/i);
  if (m) { num = m[1]; isSLCO = true; }
  else {
    m = g.match(/^SLC-?(\d+)/i);
    if (m) num = m[1];
  }
  if (!num) {
    m = pname.match(/[Ss]olute carrier family (\d+)/);
    if (m) num = m[1];
  }
  if (!num) return null;
  // 防假阳性（如酵母 SLC1 脂酰转移酶）：要求蛋白名有转运体特征或链指向转运超家族
  const looksTransporter = /solute carrier|transporter|symporter|antiporter|carrier|permease|exchange|transport/i.test(pname);
  const chainTransport = /major facilitator|carrier|transporter|symporter|antiporter|permease/i.test(origSuperfamily);
  if (!looksTransporter && !chainTransport) return null;
  const famKey = isSLCO ? "SLCO" : `SLC${num}`;
  const def = SLC_FAMS[famKey];
  let branch = def?.b ?? "OTHER";
  let zh = def?.zh ?? "";
  let alias = def?.alias ?? "";
  // 未列编号：链指向 MFS 则归 MFS
  if (!def && /major facilitator|mfs/i.test(origSuperfamily)) branch = "MFS";
  const name = alias ? `SLC${num}A · ${alias} ${zh}` : zh ? `SLC${num}A · ${zh}` : `SLC${num}A`;
  const nameEn = isSLCO ? `Organic anion transporter family (SLCO${num})` : `Solute carrier family ${num}${zh ? ` — ${alias || zh}` : ""}`;
  return { branch, fam: famKey, name, nameEn };
}

/** 从原始链文本提取超家族段（用于 slcInfo 链推断） */
function superfamilyOfChain(segs: string[]): string {
  return segs[0] ?? "";
}

// ===== 4) 树节点构建 =====
interface TreeNode {
  key: string; // 层级唯一 key（归一化名拼接）
  parentKey: string | null;
  nameEn: string; // 官方名（首个出现的原貌）
  name: string; // 中文映射或英文短名
  level: number; // 2=超家族/单级家族 3=家族 4=亚家族
  code: string; // 分配后编码 {class}.{i}[.{j}[.{k}]]
  kind?: "group" | "surgery"; // 手术组节点标记（超群等）
  directCount: number; // 直接挂该节点的蛋白数
  totalCount: number; // 递归总数
  children: Map<string, TreeNode>;
}

const LEVEL_LABEL = ["", "大类", "超家族", "家族", "亚家族"];

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

function newNode(key: string, parentKey: string | null, nameEn: string, level: number): TreeNode {
  const zh = zhFor(nameEn);
  return {
    key,
    parentKey,
    nameEn: shortName(nameEn),
    name: zh || shortName(nameEn),
    level,
    code: "",
    directCount: 0,
    totalCount: 0,
    children: new Map(),
  };
}

async function main() {
  const t0 = Date.now();
  console.log("=== 层级分类引擎 v2（UniProt 官方链 + 超家族多数票统一） ===");

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
        entries.push({ p, segs, prelimClass: prelim, oldCode: old.code });
        const sfKey = normKey(segs[0]);
        let votes = voteBySF.get(sfKey);
        if (!votes) {
          votes = new Map();
          voteBySF.set(sfKey, votes);
        }
        votes.set(prelim, (votes.get(prelim) ?? 0) + 1);
      } else {
        entries.push({ p, segs: [], prelimClass: oldClass, oldCode: old.code });
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
    // 统计被多数票修正的数量（用于报告）
  }
  for (const e of entries) {
    if (e.segs.length > 0) {
      const final = classBySF.get(normKey(e.segs[0])) ?? e.prelimClass;
      if (final !== e.prelimClass) unified++;
      e.prelimClass = final;
    }
  }
  console.log(`多数票统一超家族 ${classBySF.size} 个（修正 ${unified} 条蛋白的大类归属）`);

  // 4) Pass B：建树（key 用归一化名；兜底蛋白挂旧引擎家族）
  const classRoots = new Map<string, Map<string, TreeNode>>();
  const outLines: string[] = [];
  const leafByKey = new Map<string, TreeNode>();
  const report = {
    total: entries.length,
    withChain,
    fallback: entries.length - withChain,
    unified,
    byClass: {} as Record<string, number>,
    levelCounts: {} as Record<string, number>,
    sampleMFS: [] as string[],
  };

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
      let parentKey: string | null = null;
      let node: TreeNode | null = null;
      for (let i = 0; i < e.segs.length; i++) {
        const nameEn = e.segs[i];
        const key = (parentKey ?? classCode) + "|" + normKey(nameEn);
        node = children.get(key) ?? null;
        if (!node) {
          node = newNode(key, parentKey, nameEn, i + 2);
          children.set(key, node);
        }
        children = node.children;
        parentKey = key;
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
      const key = (classCode + "|fb:" + e.oldCode).toLowerCase();
      let node = children.get(key);
      if (!node) {
        node = newNode(key, null, nameEn, 2);
        if (zh) node.name = zh;
        children.set(key, node);
      }
      leafNode = node;
    }

    leafNode.directCount++;
    leafByKey.set(leafNode.key, leafNode);
    report.byClass[classCode] = (report.byClass[classCode] ?? 0) + 1;
    outLines.push(JSON.stringify({ ...e.p, _nodeKey: leafNode.key }));
  }

  // ===== 4.9) 层级手术：超群/同义合并/误并列修正 =====
  // 手术 1：SLC 超群 —— 溶质载体作为超群，MFS/APC/CPA1 等超家族挂其下，SLC 家族作叶子
  {
    const t5 = classRoots.get("5")!;
    const slcKey = "5|slc:group";
    const slcGroup = newNode(slcKey, null, "Solute carrier supergroup (SLC)", 2);
    slcGroup.name = "溶质载体超群 (SLC)";
    slcGroup.kind = "group";
    t5.set(slcKey, slcGroup);
    const branchNodes = new Map<string, TreeNode>();
    for (const [bcode, b] of Object.entries(SLC_BRANCHES)) {
      const bKey = `${slcKey}|${bcode.toLowerCase()}`;
      const node = newNode(bKey, slcKey, b.nameEn, 3);
      node.name = b.name;
      node.kind = "surgery";
      slcGroup.children.set(bKey, node);
      branchNodes.set(bcode, node);
    }
    let moved = 0;
    const branchCount = new Map<string, number>();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const info = slcInfo(e.p.genePrimary ?? "", e.p.proteinName, superfamilyOfChain(e.segs));
      if (!info) continue;
      const p = JSON.parse(outLines[i]) as { _nodeKey: string };
      const oldLeaf = leafByKey.get(p._nodeKey);
      if (oldLeaf) oldLeaf.directCount--;
      const branchNode = branchNodes.get(info.branch)!;
      const famKey = branchNode.key + "|slc:" + info.fam.toLowerCase();
      let famNode = branchNode.children.get(famKey);
      if (!famNode) {
        famNode = newNode(famKey, branchNode.key, info.nameEn, 4);
        famNode.name = info.name;
        branchNode.children.set(famKey, famNode);
      }
      famNode.directCount++;
      p._nodeKey = famKey;
      outLines[i] = JSON.stringify(p);
      leafByKey.set(famKey, famNode);
      moved++;
      branchCount.set(info.branch, (branchCount.get(info.branch) ?? 0) + 1);
    }
    console.log(`手术·SLC 超群：迁移 ${moved} 条溶质载体蛋白，分支分布：`);
    for (const [b, n] of [...branchCount.entries()].sort((x, y) => y[1] - x[1])) {
      console.log(`   ${b}: ${n}`);
    }
  }

  // 手术 2：GPCR 超家族分组 —— Class A/B/C/T2R/Fz-Smo 从大类下并列收归 GPCR 超家族下
  {
    const t3 = classRoots.get("3")!;
    const gpcrKey = "3|gpcr:group";
    const gpcr = newNode(gpcrKey, null, "G protein-coupled receptor (GPCR) superfamily", 2);
    gpcr.name = "G 蛋白偶联受体超家族";
    gpcr.kind = "group";
    t3.set(gpcrKey, gpcr);
    let movedNodes = 0;
    for (const [key, node] of [...t3.entries()]) {
      if (node === gpcr) continue;
      if (node.level === 2 && /^g protein-coupled receptor/i.test(node.nameEn)) {
        t3.delete(key);
        node.parentKey = gpcrKey;
        gpcr.children.set(key, node);
        movedNodes++;
      }
    }
    console.log(`手术·GPCR 超家族分组：收拢 ${movedNodes} 个受体类节点（Class A/B/C/T2R/Fz-Smo）`);
  }

  // 手术 3：组蛋白家族组 —— H1/H2A/H2B/H3/H4 从并列收归组蛋白组下
  {
    const t4 = classRoots.get("4")!;
    const histKey = "4|histone:group";
    const hist = newNode(histKey, null, "Histone family group", 2);
    hist.name = "组蛋白家族";
    hist.kind = "group";
    t4.set(histKey, hist);
    let movedNodes = 0;
    for (const [key, node] of [...t4.entries()]) {
      if (node.level === 2 && /^histone h[1-9]/i.test(node.nameEn)) {
        t4.delete(key);
        node.parentKey = histKey;
        hist.children.set(key, node);
        movedNodes++;
      }
    }
    console.log(`手术·组蛋白家族组：收拢 ${movedNodes} 个组蛋白亚型家族`);
  }

  // 手术 4：免疫球蛋白合并 —— Immunoglobulins 兜底节点收归 IgSF 超家族下
  {
    const t8 = classRoots.get("8")!;
    const igKey = "8|immunoglobulin superfamily";
    let igNode = t8.get(igKey);
    if (!igNode) {
      igNode = newNode(igKey, null, "immunoglobulin superfamily", 2);
      t8.set(igKey, igNode);
    }
    igNode.name = "免疫球蛋白超家族 (IgSF)";
    for (const [key, node] of [...t8.entries()]) {
      if (node !== igNode && node.level === 2 && /^immunoglobulins$/i.test(node.nameEn)) {
        t8.delete(key);
        node.parentKey = igKey;
        node.nameEn = "Immunoglobulin chains & Ig-like receptors";
        node.name = "免疫球蛋白链与 Ig 样受体";
        igNode.children.set(key, node);
        console.log("手术·IgSF 合并：Immunoglobulins 兜底节点收归免疫球蛋白超家族下");
      }
    }
  }

  // 手术 5：生长素响应因子 ARF 迁移 —— 拟南芥 ARF（转录因子）误挂信号类，迁到转录与染色质类
  {
    const t3 = classRoots.get("3")!;
    const t4 = classRoots.get("4")!;
    for (const [key, node] of [...t3.entries()]) {
      if (node.level === 2 && /^ARF family$/.test(node.nameEn)) {
        const n = countTree(node);
        t3.delete(key);
        node.nameEn = "Auxin response factor (ARF) family";
        node.name = "生长素响应因子 (ARF) 家族";
        node.parentKey = null;
        t4.set(key, node);
        report.byClass["3"] = (report.byClass["3"] ?? 0) - n;
        report.byClass["4"] = (report.byClass["4"] ?? 0) + n;
        console.log(`手术·生长素 ARF 迁移：${n} 条拟南芥 ARF 转录因子 3 类 → 4 类`);
      }
    }
  }

  // 手术 6：小 G 蛋白兑底分流 —— 基因名 RAB/RAS/RHO/ARF/RAN 等分流到 small GTPase 超家族对应家族
  {
    const t3 = classRoots.get("3")!;
    let sgNode: TreeNode | undefined;
    for (const node of t3.values()) {
      if (node.level === 2 && /^small gtpases$/i.test(node.nameEn)) { sgNode = node; break; }
    }
    const sgsKey = "3|small gtpase superfamily";
    const sgs = t3.get(sgsKey);
    if (sgNode && sgs) {
      const famByKey = new Map<string, TreeNode>();
      for (const [k, n] of sgs.children) famByKey.set(normKey(n.nameEn), n);
      const ensureUnderSGS = (nameEn: string, zh: string): TreeNode => {
        const k = sgsKey + "|" + normKey(nameEn);
        let n = sgs.children.get(k);
        if (!n) {
          n = newNode(k, sgsKey, nameEn, 3);
          n.name = zh;
          sgs.children.set(k, n);
        }
        return n;
      };
      let moved = 0;
      for (let i = 0; i < entries.length; i++) {
        const p = JSON.parse(outLines[i]) as { _nodeKey: string; genePrimary?: string };
        if (p._nodeKey !== sgNode.key) continue;
        const g = (p.genePrimary ?? "").trim();
        let target: TreeNode | undefined;
        if (/^RAB/i.test(g)) target = famByKey.get("rab family") ?? ensureUnderSGS("Rab family", "RAB 家族");
        else if (/^RHO|^RAC|^CDC42|^RND/i.test(g)) target = famByKey.get("rho family") ?? ensureUnderSGS("Rho family", "RHO 家族");
        else if (/^ARF\d|^ARL\d|^ARFRP|^ARFI/i.test(g)) target = famByKey.get("arf family") ?? ensureUnderSGS("Arf family", "ARF 家族");
        else if (/^RAN/i.test(g)) target = famByKey.get("ran family") ?? ensureUnderSGS("Ran family", "RAN 家族");
        else if (/^RAS|^HRAS|^KRAS|^NRAS|^RAP\d|^RAL|^RIT|^REM|^RHEB|^DIRAS|^ERAS|^RASD|^RASL|^SAR1/i.test(g))
          target = ensureUnderSGS("Other Ras-related GTPases", "其他 Ras 相关小 G 蛋白");
        if (!target) continue;
        target.directCount++;
        sgNode.directCount--;
        p._nodeKey = target.key;
        outLines[i] = JSON.stringify(p);
        leafByKey.set(target.key, target);
        moved++;
      }
      if (sgNode.directCount <= 0 && sgNode.children.size === 0) {
        t3.delete(sgNode.key);
      } else {
        sgNode.name = "其他 GTP 结合蛋白";
        sgNode.nameEn = "Other GTP-binding proteins";
      }
      console.log(`手术·小 G 蛋白兑底分流：${moved} 条按基因名归入对应家族`);
    }
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

  // 6) key -> code 映射，回填蛋白行
  const codeByKey = new Map(allNodes.map((n) => [n.key, n.code]));
  const nodeByKey = new Map(allNodes.map((n) => [n.key, n]));
  for (let i = 0; i < outLines.length; i++) {
    const p = JSON.parse(outLines[i]);
    const code = codeByKey.get(p._nodeKey);
    delete p._nodeKey;
    outLines[i] = JSON.stringify({ ...p, familyCode: code });
  }

  // 7) families.json（level 标注 + 路径描述）
  const famRows = allNodes.map((n) => {
    const pathSegs: string[] = [];
    let cur: TreeNode | undefined = n;
    while (cur && cur.parentKey) {
      pathSegs.unshift(cur.nameEn);
      cur = nodeByKey.get(cur.parentKey);
    }
    const desc =
      pathSegs.length > 1
        ? `UniProt 官方层级: ${pathSegs.join(" → ")}`
        : `UniProt 官方${LEVEL_LABEL[n.level]}`;
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

  // 8) 报告
  for (const n of allNodes) {
    const lv = String(n.level);
    report.levelCounts[lv] = (report.levelCounts[lv] ?? 0) + 1;
  }
  for (const n of allNodes) {
    if (/^major facilitator/i.test(n.nameEn) || /主要易化/.test(n.name)) {
      report.sampleMFS.push(`${n.code} ${n.nameEn} (level${n.level}) total=${n.totalCount} direct=${n.directCount} children=${n.children.size}`);
    }
  }
  // SLC 超群验证输出
  const slcNode = allNodes.find((n) => n.kind === "group" && /^solute carrier supergroup/i.test(n.nameEn));
  if (slcNode) {
    console.log(`\nSLC 超群验证: ${slcNode.code} ${slcNode.name} total=${slcNode.totalCount}`);
    for (const b of [...slcNode.children.values()].sort((a, b) => b.totalCount - a.totalCount)) {
      console.log(`  ${b.code} ${b.name} — ${b.totalCount} 条，${b.children.size} 个 SLC 家族`);
      const fams = [...b.children.values()].sort((x, y) => y.totalCount - x.totalCount).slice(0, 5);
      for (const f of fams) console.log(`     · ${f.name} (${f.totalCount})`);
    }
  }
  // GPCR 超家族组验证
  const gpcrNode = allNodes.find((n) => n.kind === "group" && /GPCR/.test(n.nameEn));
  if (gpcrNode) {
    console.log(`\nGPCR 超家族验证: ${gpcrNode.code} ${gpcrNode.name} total=${gpcrNode.totalCount}，子类 ${gpcrNode.children.size} 个`);
    for (const b of [...gpcrNode.children.values()].sort((a, b) => b.totalCount - a.totalCount)) {
      console.log(`  ${b.code} ${b.nameEn} — ${b.totalCount}`);
    }
  }
  await Bun.write("download/hier-report.json", JSON.stringify(report, null, 2));

  console.log(`\n=== 分类报告 ===`);
  for (const cls of CLASSES) {
    const n = report.byClass[cls.code] ?? 0;
    console.log(`类 ${cls.code} ${cls.name}: ${n} (${((n / entries.length) * 100).toFixed(1)}%)`);
  }
  console.log(`节点数: level2=${report.levelCounts["2"] ?? 0} level3=${report.levelCounts["3"] ?? 0} level4=${report.levelCounts["4"] ?? 0}`);
  console.log(`\nMFS 超家族验证（应聚合为单一节点）:`);
  for (const s of report.sampleMFS) console.log(`  ${s}`);
  console.log(`\n=== 完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
