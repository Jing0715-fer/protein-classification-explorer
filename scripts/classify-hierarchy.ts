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
    // 按句点+空格分段（"TC 2.A.1.1" 括号内句点后无空格，不受影响）
    const parts = b
      .split(/(?<=\.)\s+(?=[A-Z0-9])/)
      .map((p) =>
        p
          .replace(/\.+$/, "")
          .replace(/^Belongs to the\s+/i, "")
          .replace(/^Belongs to a\s+/i, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter((p) => p.length > 1);
    if (parts.length > best.length) best = parts;
  }
  return best.slice(0, 3);
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

// ===== 4) 树节点构建 =====
interface TreeNode {
  key: string; // 层级唯一 key（归一化名拼接）
  parentKey: string | null;
  nameEn: string; // 官方名（首个出现的原貌）
  name: string; // 中文映射或英文短名
  level: number; // 2=超家族/单级家族 3=家族 4=亚家族
  code: string; // 分配后编码 {class}.{i}[.{j}[.{k}]]
  directCount: number; // 直接挂该节点的蛋白数
  totalCount: number; // 递归总数
  children: Map<string, TreeNode>;
}

const LEVEL_LABEL = ["", "大类", "超家族", "家族", "亚家族"];

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
        node = children.get(key);
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
    report.byClass[classCode] = (report.byClass[classCode] ?? 0) + 1;
    outLines.push(JSON.stringify({ ...e.p, _nodeKey: leafNode.key }));
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
