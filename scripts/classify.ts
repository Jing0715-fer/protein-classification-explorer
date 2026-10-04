/**
 * 蛋白家族分类规则引擎
 * 读取 download/proteomes/*.jsonl → 按规则分类 → 输出 classified.jsonl + families.json + 报告
 * 运行: bun run scripts/classify.ts
 */
import type { RawProtein } from "./fetch-proteomes";

// ===== 匹配上下文 =====
export interface MatchCtx {
  p: RawProtein;
  kw: Set<string>;
  name: string; // 小写蛋白名
  gene: string; // 小写主基因名
  dom: string[]; // 清洗后的结构域名（从 /note="..." 提取）
  ecSet: string[];
  hasEC: boolean;
}

export function buildCtx(p: RawProtein): MatchCtx {
  const dom: string[] = [];
  for (const token of p.domains) {
    const m = token.match(/\/note="([^"]+)"/);
    if (m) dom.push(m[1]);
  }
  return {
    p,
    kw: new Set(p.keywords),
    name: p.proteinName.toLowerCase(),
    gene: p.genePrimary.toLowerCase(),
    dom,
    ecSet: p.ecs,
    hasEC: p.ecs.length > 0,
  };
}

const kw = (ctx: MatchCtx, ...names: string[]) => names.some((n) => ctx.kw.has(n));
const nm = (ctx: MatchCtx, re: RegExp) => re.test(ctx.name);
const gn = (ctx: MatchCtx, re: RegExp) => re.test(ctx.gene);
const dm = (ctx: MatchCtx, re: RegExp) => ctx.dom.some((d) => re.test(d));
const ec = (ctx: MatchCtx, prefix: string) => ctx.ecSet.some((e) => e.startsWith(prefix));
const isKinase = (ctx: MatchCtx) =>
  kw(ctx, "Kinase") || nm(ctx, /kinase/) || dm(ctx, /kinase/i);

// ===== 类定义 =====
export interface ClassDef {
  code: string;
  name: string;
  nameEn: string;
  color: string;
}

export const CLASSES: ClassDef[] = [
  { code: "1", name: "酶类", nameEn: "Enzymes", color: "#059669" },
  { code: "2", name: "激酶", nameEn: "Kinases", color: "#65a30d" },
  { code: "3", name: "受体与信号转导", nameEn: "Receptors & Signaling", color: "#0d9488" },
  { code: "4", name: "转录与染色质", nameEn: "Transcription & Chromatin", color: "#e11d48" },
  { code: "5", name: "通道与转运", nameEn: "Channels & Transporters", color: "#d97706" },
  { code: "6", name: "细胞骨架与结构", nameEn: "Cytoskeleton & Structural", color: "#ea580c" },
  { code: "7", name: "胞外基质与分泌", nameEn: "ECM & Secreted", color: "#ca8a04" },
  { code: "8", name: "免疫与防御", nameEn: "Immunity & Defense", color: "#dc2626" },
  { code: "9", name: "核糖体与翻译", nameEn: "Ribosome & Translation", color: "#7c3aed" },
  { code: "10", name: "蛋白质稳态", nameEn: "Proteostasis", color: "#0891b2" },
  { code: "11", name: "细胞周期与肿瘤调控", nameEn: "Cell Cycle & Oncogenesis", color: "#db2777" },
  { code: "12", name: "核酸代谢与加工", nameEn: "Nucleic Acid Processing", color: "#c026d3" },
  { code: "13", name: "膜蛋白与其他", nameEn: "Membrane & Others", color: "#78716c" },
];

export interface FamilyDef {
  code: string;
  name: string;
  nameEn: string;
  description: string;
}

export const FAMILIES: FamilyDef[] = [
  // 类 1 酶类
  { code: "1.1", name: "氧化还原酶", nameEn: "Oxidoreductases", description: "EC 1.x，催化氧化还原反应" },
  { code: "1.2", name: "细胞色素P450", nameEn: "Cytochrome P450", description: "CYP 家族血红素单加氧酶" },
  { code: "1.3", name: "转移酶", nameEn: "Transferases", description: "EC 2.x（激酶之外），转移化学基团" },
  { code: "1.4", name: "蛋白酶", nameEn: "Proteases", description: "EC 3.4.x，催化蛋白质水解" },
  { code: "1.5", name: "磷酸酶", nameEn: "Phosphatases", description: "催化磷酸基团水解（EC 3.1.3/3.1.4）" },
  { code: "1.6", name: "其他水解酶", nameEn: "Hydrolases (other)", description: "EC 3.x 中蛋白酶/磷酸酶之外的水解酶" },
  { code: "1.7", name: "裂合酶", nameEn: "Lyases", description: "EC 4.x，催化键的断裂（非水解/氧化）" },
  { code: "1.8", name: "异构酶", nameEn: "Isomerases", description: "EC 5.x，催化异构化反应" },
  { code: "1.9", name: "连接酶", nameEn: "Ligases", description: "EC 6.x，催化两分子连接（消耗 ATP）" },
  { code: "1.10", name: "易位酶与其他酶", nameEn: "Translocases & others", description: "EC 7.x 易位酶及未细分酶" },
  // 类 2 激酶
  { code: "2.1", name: "受体酪氨酸激酶", nameEn: "Receptor tyrosine kinases", description: "RTK，跨膜受体型酪氨酸激酶（EGFR/INSR 等）" },
  { code: "2.2", name: "非受体酪氨酸激酶", nameEn: "Non-receptor tyrosine kinases", description: "胞质酪氨酸激酶（SRC/JAK/ABL 等）" },
  { code: "2.3", name: "MAPK级联激酶", nameEn: "MAPK cascade kinases", description: "促分裂原活化蛋白激酶及其上游 MEK/MAPKKK" },
  { code: "2.4", name: "周期蛋白依赖激酶", nameEn: "Cyclin-dependent kinases", description: "CDK 家族，驱动细胞周期进程" },
  { code: "2.5", name: "PKA/PKC/PKG激酶", nameEn: "PKA/PKC/PKG", description: "AGC 家族经典第二信使依赖激酶" },
  { code: "2.6", name: "植物受体样激酶", nameEn: "Plant receptor-like kinases", description: "植物 LRR/SD 类受体激酶（RLK/Pelle）" },
  { code: "2.7", name: "其他丝/苏氨酸激酶", nameEn: "Other Ser/Thr kinases", description: "CK1/CMGC/GSK 等其余丝苏氨酸蛋白激酶" },
  { code: "2.8", name: "脂质激酶", nameEn: "Lipid kinases", description: "PI3K/PI4K 等磷脂酰肌醇激酶" },
  { code: "2.9", name: "其他激酶", nameEn: "Other kinases", description: "未归入以上亚家族的激酶" },
  // 类 3 受体与信号
  { code: "3.1", name: "G蛋白偶联受体", nameEn: "GPCR", description: "7 次跨膜 α 螺旋受体，第二大药物靶点家族" },
  { code: "3.2", name: "嗅觉受体", nameEn: "Olfactory receptors", description: "OR 家族，动物最大基因家族之一" },
  { code: "3.3", name: "视蛋白", nameEn: "Opsins", description: "视黄醛结合感光 GPCR" },
  { code: "3.4", name: "肿瘤坏死因子受体", nameEn: "TNF receptors", description: "TNFRSF 家族，含死亡结构域的受体" },
  { code: "3.5", name: "小GTP酶", nameEn: "Small GTPases", description: "RAS 超家族（RAS/RHO/RAB/ARF/RAN）分子开关" },
  { code: "3.6", name: "GTP酶调节子", nameEn: "GEFs & GAPs", description: "鸟苷酸交换因子与 GTP 酶激活蛋白" },
  { code: "3.7", name: "异源三聚体G蛋白", nameEn: "Heterotrimeric G proteins", description: "Gα/Gβ/Gγ 亚基" },
  { code: "3.8", name: "Toll样与细胞因子受体", nameEn: "Toll-like & cytokine receptors", description: "TLR 与白细胞介素/干扰素受体" },
  { code: "3.9", name: "SH2/SH3信号接头", nameEn: "SH2/SH3 adapters", description: "含 SH2/SH3 结构域的接头蛋白" },
  { code: "3.10", name: "生长因子", nameEn: "Growth factors", description: "EGF/FGF/VEGF/TGF-β 等分泌信号分子" },
  { code: "3.11", name: "钙调蛋白与EF-hand", nameEn: "Calmodulin & EF-hand", description: "EF-hand 钙结合信号中介" },
  { code: "3.12", name: "Wnt与β-catenin信号", nameEn: "Wnt & beta-catenin", description: "Wnt 配体/Frizzled 受体/β-catenin 通路" },
  { code: "3.13", name: "其他受体", nameEn: "Other receptors", description: "清道夫受体/LDL 受体等其余膜受体" },
  // 类 4 转录与染色质
  { code: "4.1", name: "锌指转录因子", nameEn: "Zinc finger TFs", description: "C2H2 及其他锌指类 DNA 结合蛋白" },
  { code: "4.2", name: "同源框因子", nameEn: "Homeobox TFs", description: "HOX/PAX 等同源结构域转录因子" },
  { code: "4.3", name: "bZIP因子", nameEn: "bZIP TFs", description: "碱性亮氨酸拉链（JUN/FOS/CREB）" },
  { code: "4.4", name: "bHLH因子", nameEn: "bHLH TFs", description: "碱性螺旋-环-螺旋（MYC/MYOD）" },
  { code: "4.5", name: "Forkhead因子", nameEn: "Forkhead TFs", description: "FOX 家族翼状螺旋因子" },
  { code: "4.6", name: "HMG-box因子", nameEn: "HMG-box TFs", description: "SOX/TCF 高迁移率族蛋白" },
  { code: "4.7", name: "核受体", nameEn: "Nuclear receptors", description: "核激素受体（类固醇/甲状腺/视黄酸受体）" },
  { code: "4.8", name: "组蛋白修饰与染色质", nameEn: "Chromatin modifiers", description: "HAT/HDAC/甲基转移酶及重塑因子" },
  { code: "4.9", name: "组蛋白", nameEn: "Histones", description: "H2A/H2B/H3/H4/H1 核小体核心蛋白" },
  { code: "4.10", name: "通用转录机器", nameEn: "General transcription machinery", description: "RNA 聚合酶 II/GTF/TBP/中介子" },
  { code: "4.11", name: "其他转录因子", nameEn: "Other TFs", description: "未归入以上家族的转录调控因子" },
  { code: "4.12", name: "其他DNA结合蛋白", nameEn: "Other DNA-binding", description: "具备 DNA 结合特征的其他蛋白" },
  // 类 5 通道与转运
  { code: "5.1", name: "钾离子通道", nameEn: "Potassium channels", description: "KV/KCa/KIR 等钾通道" },
  { code: "5.2", name: "钠钙通道", nameEn: "Na/Ca channels", description: "电压门控钠通道与钙通道" },
  { code: "5.3", name: "氯离子通道", nameEn: "Chloride channels", description: "CLC/CFTR 等阴离子通道" },
  { code: "5.4", name: "配体门控与其他通道", nameEn: "Ligand-gated & other channels", description: "nAChR/GABA(NR)/谷氨酸门控、TRP、Connexin" },
  { code: "5.5", name: "溶质载体", nameEn: "Solute carriers (SLC)", description: "SLC 超家族膜转运蛋白" },
  { code: "5.6", name: "ABC转运蛋白", nameEn: "ABC transporters", description: "ATP 结合盒转运体" },
  { code: "5.7", name: "水通道蛋白", nameEn: "Aquaporins", description: "水/甘油选择性通道" },
  { code: "5.8", name: "膜孔蛋白", nameEn: "Porins", description: "细菌外膜 β 桶孔道蛋白" },
  { code: "5.9", name: "P型ATP酶与离子泵", nameEn: "P-type ATPases", description: "Na+/K+/Ca2+ transporting ATPase 离子泵" },
  { code: "5.10", name: "囊泡运输与胞吞", nameEn: "Vesicle transport", description: "SNARE/SEC/网格蛋白/发动蛋白机器" },
  { code: "5.11", name: "其他转运相关", nameEn: "Other transport", description: "未归入以上家族的转运/载体蛋白" },
  { code: "5.12", name: "核孔与核质运输", nameEn: "Nuclear pore & transport", description: "Importin/Exportin/核孔复合体" },
  // 类 6 细胞骨架与结构
  { code: "6.1", name: "肌动蛋白", nameEn: "Actins", description: "ACT 肌动蛋白家族" },
  { code: "6.2", name: "微管蛋白", nameEn: "Tubulins", description: "α/β/γ 微管蛋白" },
  { code: "6.3", name: "肌球蛋白", nameEn: "Myosins", description: "肌动蛋白依赖马达家族" },
  { code: "6.4", name: "驱动与动力蛋白", nameEn: "Kinesins & Dyneins", description: "微管依赖马达蛋白" },
  { code: "6.5", name: "中间丝蛋白", nameEn: "Intermediate filaments", description: "角蛋白/核纤层蛋白/波形蛋白" },
  { code: "6.6", name: "微管结合蛋白", nameEn: "Microtubule-associated", description: "MAP/tau 等微管稳定因子" },
  { code: "6.7", name: "肌动蛋白结合蛋白", nameEn: "Actin-binding proteins", description: "Profilin/Cofilin/Spectrin 等" },
  { code: "6.8", name: "隔膜蛋白", nameEn: "Septins", description: "GTP 结合隔膜骨架蛋白" },
  { code: "6.9", name: "纤毛与鞭毛蛋白", nameEn: "Ciliary & flagellar", description: "鞭毛素/轴丝/IFT 复合体" },
  { code: "6.10", name: "光合系统蛋白", nameEn: "Photosystem proteins", description: "光系统/捕光复合物/Rubisco" },
  { code: "6.11", name: "其他结构蛋白", nameEn: "Other structural", description: "细胞骨架关联与其他结构蛋白" },
  { code: "6.12", name: "细胞粘附与连接", nameEn: "Cell adhesion & junctions", description: "钙粘蛋白/整合素/连接复合体" },
  // 类 7 ECM 与分泌
  { code: "7.1", name: "胶原蛋白", nameEn: "Collagens", description: "COL 家族三螺旋胞外基质" },
  { code: "7.2", name: "纤连蛋白类糖蛋白", nameEn: "Fibronectin & laminins", description: "FN/LN/Fibrillin 等基质糖蛋白" },
  { code: "7.3", name: "蛋白聚糖", nameEn: "Proteoglycans", description: "GAG 链修饰的胞外蛋白" },
  { code: "7.4", name: "激素与神经肽", nameEn: "Hormones & neuropeptides", description: "内分泌信号肽（胰岛素等）" },
  { code: "7.5", name: "其他分泌蛋白", nameEn: "Other secreted", description: "分泌信号的其他蛋白" },
  { code: "7.6", name: "其他胞外基质", nameEn: "Other ECM", description: "未归入以上家族的基质蛋白" },
  // 类 8 免疫与防御
  { code: "8.1", name: "免疫球蛋白", nameEn: "Immunoglobulins", description: "IG 轻重链（抗体分子）" },
  { code: "8.2", name: "MHC分子", nameEn: "MHC", description: "主要组织相容性复合体抗原提呈分子" },
  { code: "8.3", name: "T细胞受体", nameEn: "T-cell receptors", description: "TCR α/β/γ/δ 链" },
  { code: "8.4", name: "补体系统", nameEn: "Complement", description: "补体级联 C1-C9 及调节因子" },
  { code: "8.5", name: "干扰素与白介素", nameEn: "Interferons & interleukins", description: "IFN/IL 家族细胞因子" },
  { code: "8.6", name: "趋化因子", nameEn: "Chemokines", description: "CCL/CXCL 趋化细胞因子" },
  { code: "8.7", name: "肿瘤坏死因子", nameEn: "TNF ligands", description: "TNFSF 家族配体" },
  { code: "8.8", name: "防御素与抗菌肽", nameEn: "Defensins & antimicrobial", description: "先天免疫抗菌肽" },
  { code: "8.9", name: "植物抗病蛋白", nameEn: "Plant R proteins", description: "NBS-LRR 类植物抗病蛋白" },
  { code: "8.10", name: "限制修饰系统", nameEn: "Restriction-modification", description: "细菌限制酶/甲基化酶防御系统" },
  { code: "8.11", name: "毒素", nameEn: "Toxins", description: "微生物/动物毒素蛋白" },
  { code: "8.12", name: "其他免疫防御", nameEn: "Other immunity", description: "其余免疫相关蛋白" },
  // 类 9 核糖体与翻译
  { code: "9.1", name: "核糖体蛋白", nameEn: "Ribosomal proteins", description: "大/小亚基 r 蛋白" },
  { code: "9.2", name: "翻译因子", nameEn: "Translation factors", description: "起始/延伸/释放因子" },
  { code: "9.3", name: "氨酰tRNA合成酶", nameEn: "Aminoacyl-tRNA synthetases", description: "20 类氨基酸 tRNA 连接酶" },
  { code: "9.4", name: "核糖体生成与其他", nameEn: "Ribosome biogenesis", description: "rRNA 加工/核糖体组装因子" },
  // 类 10 蛋白质稳态
  { code: "10.1", name: "HSP70家族", nameEn: "HSP70 family", description: "70 kDa 热休克/伴护蛋白" },
  { code: "10.2", name: "HSP90家族", nameEn: "HSP90 family", description: "90 kDa 伴侣，信号激酶折叠" },
  { code: "10.3", name: "伴侣蛋白与小HSP", nameEn: "Chaperonins & small HSPs", description: "GroEL/CCT/HSP27 伴侣机器" },
  { code: "10.4", name: "泛素与类泛素", nameEn: "Ubiquitin & UBLs", description: "泛素/SUMO/NEDD8 修饰分子" },
  { code: "10.5", name: "E3泛素连接酶", nameEn: "E3 ubiquitin ligases", description: "底物特异性泛素连接酶（RING/HECT）" },
  { code: "10.6", name: "去泛素化酶", nameEn: "Deubiquitinases", description: "USP/UCH 家族泛素剪切酶" },
  { code: "10.7", name: "E1/E2结合酶", nameEn: "E1/E2 conjugating", description: "泛素激活与结合酶" },
  { code: "10.8", name: "自噬机器", nameEn: "Autophagy machinery", description: "ATG 自噬相关蛋白" },
  { code: "10.9", name: "蛋白酶体", nameEn: "Proteasome", description: "26S 蛋白酶体核心与调节颗粒" },
  { code: "10.10", name: "折叠酶", nameEn: "Folding enzymes", description: "PDI/脯氨酰异构酶（亲环素/FKBP）" },
  { code: "10.11", name: "其他分子伴侣", nameEn: "Other chaperones", description: "未归入以上家族的伴侣" },
  // 类 11 细胞周期
  { code: "11.1", name: "周期蛋白", nameEn: "Cyclins", description: "CCN 家族周期调控亚基" },
  { code: "11.2", name: "CDK抑制因子", nameEn: "CDK inhibitors", description: "CDKN/INK4/CIP 家族" },
  { code: "11.3", name: "凋亡机器", nameEn: "Apoptosis machinery", description: "Caspase/BCL-2/Apaf 蛋白" },
  { code: "11.4", name: "抑癌与原癌蛋白", nameEn: "Tumor suppressors & oncoproteins", description: "p53/RB 等肿瘤调控因子" },
  { code: "11.5", name: "其他细胞周期蛋白", nameEn: "Other cell cycle", description: "纺锤体检查点等其他周期蛋白" },
  // 类 12 核酸代谢
  { code: "12.1", name: "DNA复制机器", nameEn: "DNA replication", description: "DNA 聚合酶/MCM/PCNA" },
  { code: "12.2", name: "DNA修复蛋白", nameEn: "DNA repair", description: "BRCA/MSH/PARP 等修复因子" },
  { code: "12.3", name: "DEAD-box解旋酶", nameEn: "DEAD-box helicases", description: "DDX 家族 ATP 依赖 RNA 解旋酶" },
  { code: "12.4", name: "其他解旋酶", nameEn: "Other helicases", description: "RecQ/XP DNA 解旋酶等" },
  { code: "12.5", name: "剪接体", nameEn: "Spliceosome", description: "snRNP/剪接因子" },
  { code: "12.6", name: "RNA结合蛋白", nameEn: "RNA-binding proteins", description: "RRM/KH 含 RNA 结合蛋白" },
  { code: "12.7", name: "核糖核酸酶", nameEn: "Ribonucleases", description: "RNase A/H 家族" },
  { code: "12.8", name: "其他核酸加工", nameEn: "Other nucleic acid processing", description: "未归入以上家族的核酸加工蛋白" },
  // 类 13 膜与其他
  { code: "13.1", name: "其他膜蛋白", nameEn: "Other membrane proteins", description: "跨膜区标注但未归入以上家族" },
  { code: "13.2", name: "未分类蛋白", nameEn: "Unclassified", description: "注释信息不足以归入已知家族" },
];

// ===== 规则表（按优先级排列，首个命中生效） =====
export interface Rule {
  code: string;
  test: (ctx: MatchCtx) => boolean;
}

const RULES: Rule[] = [
  // --- 核糖体（最先：避免被其他规则误伤） ---
  { code: "9.1", test: (c) => kw(c, "Ribosomal protein") },
  // --- 组蛋白 ---
  {
    code: "4.9",
    test: (c) => nm(c, /^histone h/i) || gn(c, /^(h2a|h2b|h3|h4|h1[0-9]?|h1-|hta|htb|hht|hhf|cena|h4c)/),
  },
  // --- RNA聚合酶/通用转录 ---
  {
    code: "4.10",
    test: (c) =>
      nm(c, /dna-directed rna polymerase|rna polymerase (i|ii|iii)|mediator of rna polymerase|transcription factor (iib|iid|iie|iif|iih|d) ,?/i) ||
      nm(c, /transcription factor b|transcription initiation factor|general transcription factor/i) ||
      gn(c, /^(polr|gtf2|tbp|taf|med[0-9]|medi|rpabc)/),
  },
  // --- DNA 复制机器 ---
  {
    code: "12.1",
    test: (c) =>
      nm(c, /dna[- ]directed dna polymerase|dna polymerase|minichromosome maintenance|replication factor|replication protein|proliferating cell nuclear antigen/i) ||
      gn(c, /^(mcm[2-9]|pcna|pole|pol[adeq]|rpa[1-3]|fena|pcn)/),
  },
  // --- DNA 修复与重组 ---
  { code: "12.2", test: (c) => kw(c, "DNA repair") || kw(c, "DNA recombination") || kw(c, "DNA damage") },
  // --- 蛋白酶体（先于酶类） ---
  { code: "10.9", test: (c) => nm(c, /proteasome/i) || kw(c, "Proteasome") },
  // --- 泛素系统 ---
  {
    code: "10.5",
    test: (c) =>
      nm(c, /e3 ubiquitin-protein ligase|e3 sumo-protein ligase|ubiquitin-protein ligase e3|ubiquitin ligase|really interesting new gene/i) ||
      gn(c, /^(rnf|trim|fbxw|fbxl|fbxo|cul|skp[12]?|ube3|itch|mdm2|stub1|birc[36]|chip)/),
  },
  {
    code: "10.6",
    test: (c) =>
      nm(c, /ubiquitin carboxyl-terminal hydrolase|ubiquitin-specific protease|deubiquitinas[ae]|ubiquitin thiolesterase|otubain|otulin|josephin/i) ||
      gn(c, /^(usp|otub|otulin|bap1|josephin|yod1)/),
  },
  {
    code: "10.7",
    test: (c) => nm(c, /ubiquitin-activating enzyme|ubiquitin conjugating enzyme|ubiquitin-conjugating enzyme|sumo-activating enzyme|nedd8-activating enzyme/i) || gn(c, /^(ube1|uba[1-7]|ube2|atg7)/),
  },
  {
    code: "10.4",
    test: (c) =>
      nm(c, /^(poly)?ubiquitin|ubiquitin$|ubiquitin-like|small ubiquitin-related modifier|nedd8|sumo|fau protein|ubiquitin-related/i) ||
      gn(c, /^(ubb|ubc|uba52|rps27a|sumo[0-9]|smt3|nedd8|rub[12]|ubl[0-9]|ubi[1-4]|ubq|fau)/),
  },
  // --- 自噬 ---
  { code: "10.8", test: (c) => kw(c, "Autophagy") || nm(c, /autophagy/i) || gn(c, /^atg/) },
  // --- 伴侣 ---
  {
    code: "10.1",
    test: (c) =>
      nm(c, /heat shock (70|70kda|70 kda)|heat shock cognate|heat shock protein ssa|heat shock protein ssb|78 kda glucose-regulated|75 kda glucose-regulated|stch|bip/i) ||
      gn(c, /^(hspa|hsp70|hsc70|ssb[12]|ssa[1-4]|kar2|bipl|hyou|hsa)/),
  },
  {
    code: "10.2",
    test: (c) => nm(c, /heat shock (protein )?(90|85|89)|endoplasmin|heat shock protein htpg/i) || gn(c, /^(hsp90|hspe|htpg|grp94|trap1)/),
  },
  {
    code: "10.3",
    test: (c) => nm(c, /chaperonin|tcp-1|t-complex protein|groel|groes|heat shock protein beta|heat shock (25|26|27|22|20)|alpha-crystallin|small heat shock/i) || gn(c, /^(cct|hsp[bde]|groel|groes|hspe1|crya?b?)/),
  },
  {
    code: "10.10",
    test: (c) =>
      nm(c, /protein disulfide-isomerase|peptidyl-prolyl cis-trans isomerase|cyclophilin|fk[0-9] binding protein|fk506-binding|parvulin|thioredoxin domain/i) ||
      gn(c, /^(pdi[0-9]|p4hb|pdia|ppia|ppif|fkbp|cyclo|cyp[bcfg])/),
  },
  { code: "10.11", test: (c) => kw(c, "Chaperone") },
  // --- TNF 受体（先于凋亡关键词） ---
  { code: "3.4", test: (c) => nm(c, /tumor necrosis factor receptor|tnf receptor/i) || gn(c, /^tnfrsf/) },
  // --- Toll 样与细胞因子受体（先于凋亡/免疫/受体兜底，避免误抢） ---
  {
    code: "3.8",
    test: (c) =>
      nm(c, /toll-like|interleukin[^,;()]{0,8} receptor|cytokine receptor|interferon[^,;()]{0,12} receptor|colony stimulating factor receptor|erythropoietin receptor|thrombopoietin receptor|leukemia inhibitory factor receptor|oncostatin|gp130|signal transducer and activator/i) ||
      gn(c, /^(tlr[0-9]|il[0-9]{1,2}(ra|rb|rg|x)|csf[123]r|epor|thpor|lifr|osmr|stat[1-7])/),
  },
  // --- CDK 抑制因子（先于凋亡关键词） ---
  { code: "11.2", test: (c) => nm(c, /cyclin-dependent kinase inhibitor/i) || gn(c, /^cdkn/) },
  // --- 抑癌与原癌（先于凋亡关键词：p53/RB 等更应以抑癌蛋白归类） ---
  { code: "11.4", test: (c) => kw(c, "Tumor suppressor") || kw(c, "Proto-oncogene") || nm(c, /tumor suppressor|proto-oncogene|oncogene/i) },
  // --- 凋亡 ---
  {
    code: "11.3",
    test: (c) => nm(c, /^caspase|apoptosis|programmed cell death|bcl-2|bcl2-|bh3-only|apaf|baculoviral iap/i) || kw(c, "Apoptosis"),
  },
  // --- GPCR（嗅觉/视蛋白细分在前） ---
  { code: "3.2", test: (c) => nm(c, /^olfactory receptor|^odorant receptor/i) || gn(c, /^(or[0-9]|olfr)/) || kw(c, "Olfaction") },
  { code: "3.3", test: (c) => nm(c, /rhodopsin|\bopsin|visual pigment|retinal pigment epithelium-derived/i) || gn(c, /^(rho|opn[1-5]|rgr|rrho)/) },
  { code: "3.1", test: (c) => kw(c, "G protein-coupled receptor") || nm(c, /g protein-coupled receptor|g-protein coupled receptor|7 transmembrane receptor/i) },
  // --- 激酶类 ---
  {
    code: "2.1",
    test: (c) => kw(c, "Kinase") && kw(c, "Tyrosine-protein kinase") && (kw(c, "Receptor") || nm(c, /receptor/i)),
  },
  { code: "2.2", test: (c) => kw(c, "Tyrosine-protein kinase") || nm(c, /tyrosine-protein kinase/i) },
  {
    code: "2.3",
    test: (c) =>
      nm(c, /mitogen-activated protein kinase|map kinase|mapk|dual specificity mitogen-activated|map\/erk kinase|mapkk/i) || gn(c, /^(mapk[0-9]|map2k|map3k|mapk8ip)/),
  },
  { code: "2.4", test: (c) => nm(c, /cyclin-dependent kinase|cdc2-related|cdk-activating kinase/i) || gn(c, /^cdk[0-9]/) },
  {
    code: "2.5",
    test: (c) => nm(c, /camp-dependent protein kinase|cgmp-dependent protein kinase|protein kinase c |protein kinase c\b|pkc-|pka\b|ribosomal protein s6 kinase|dblk/i),
  },
  {
    code: "2.6",
    test: (c) => nm(c, /receptor-like (protein )?kinase|receptor-like serine|leucine-rich repeat receptor|brassinosteroid insensitive|somatic embryogenesis receptor/i) || gn(c, /^(rlk|crpk|bak1|bri1|serk|fsl2|rks)/),
  },
  {
    code: "2.8",
    test: (c) => nm(c, /phosphatidylinositol|phosphoinositide|diacylglycerol kinase|sphingosine kinase/i) && kw(c, "Kinase"),
  },
  {
    code: "2.7",
    test: (c) => isKinase(c) && (kw(c, "Serine/threonine-protein kinase") || nm(c, /serine\/threonine-protein kinase/i) || dm(c, /protein kinase/i) || nm(c, /protein kinase|casein kinase|glycogen synthase kinase|ikk|raf proto-oncogene|rapidly accelerated fibrosarcoma/i)),
  },
  {
    code: "2.9",
    test: (c) => isKinase(c) && !c.hasEC,
  },
  // --- tRNA 合成酶（先于连接酶 EC 6） ---
  { code: "9.3", test: (c) => nm(c, /trna (ligase|synthetase)|aminoacyl-trna/i) || gn(c, /^(aa[rs]s|pars|qars)/) },
  // --- 核糖核酸酶（先于水解酶） ---
  { code: "12.7", test: (c) => nm(c, /ribonuclease|\brnase/i) },
  // --- DEAD-box / 解旋酶 ---
  {
    code: "12.3",
    test: (c) => nm(c, /atp-dependent rna helicase|dead-box|dea[hd] box|atp-dependent dna\/rna helicase/i) || gn(c, /^(ddx|dhx|dbp|dmp|eif4a|fal1|mss116)/),
  },
  { code: "12.4", test: (c) => nm(c, /helicase/i) || gn(c, /^(blm|wrn|recq|xpd|xp[bdgf]|brad1)/) },
  // --- 剪接体 ---
  {
    code: "12.5",
    test: (c) =>
      nm(c, /splicing factor|spliceosome|small nuclear ribonucleoprotein|snrnp|pre-mRNA splicing|RNA splicing/i) ||
      kw(c, "mRNA splicing") ||
      gn(c, /^(srsf|snrp|sf3b|prpf|u2af|rbm5)/),
  },
  // --- RNA 结合 ---
  { code: "12.6", test: (c) => kw(c, "RNA-binding") || nm(c, /rna-binding|heterogeneous nuclear ribonucleoprotein|poly\(a\)-binding/i) },
  {
    code: "12.8",
    test: (c) => kw(c, "tRNA processing") || kw(c, "mRNA transport") || kw(c, "DNA replication") || nm(c, /topoisomerase|gyrase|single-stranded dna-binding|origin recognition/i),
  },
  // --- 磷酸酶（先于水解酶 EC 3） ---
  { code: "1.5", test: (c) => nm(c, /phosphatase/i) },
  // --- 蛋白酶 ---
  { code: "1.4", test: (c) => kw(c, "Protease") || ec(c, "3.4.") || nm(c, /\bprotease\b|\bpeptidase\b|renin|cathepsin|thermolysin|subtilisin/i) },
  // --- 细胞色素 P450（先于氧化还原酶） ---
  { code: "1.2", test: (c) => nm(c, /cytochrome p450/i) || gn(c, /^cyp[0-9]/) },
  // --- 限制修饰（先于酶类：细菌防御） ---
  { code: "8.10", test: (c) => nm(c, /restriction (endonuclease|enzyme|methylase|modification)|modification methylase/i) || nm(c, /^type i+ restriction/i) },
  // --- 转录因子家族（先于酶类，让染色质修饰优先于 EC） ---
  { code: "4.8", test: (c) => kw(c, "Chromatin regulator") || nm(c, /chromatin|histone (acetyl|methyl|deacetyl|demethyl|ubiquitin)|dna (cytosine|adenine)-|nucleosome|swi\/snf|polycomb/i) },
  { code: "4.2", test: (c) => kw(c, "Homeobox") || nm(c, /homeobox|homeodomain|pax /i) || gn(c, /^(hox|pax|msx|dlx|six[1-9]|lbx|barx|gsc|cdx|evx)/) },
  {
    code: "4.3",
    test: (c) => nm(c, /bzip|basic leucine zipper|leucine zipper dna/i) || gn(c, /^(jun|fos|atf[0-9]|creb[1-5]|cebp[a-z]|batf|maf[a-z]|nr4a)/),
  },
  {
    code: "4.4",
    test: (c) => nm(c, /helix-loop-helix|bhlh transcription/i) || gn(c, /^(myc|mycl|max|mad|mnt|myod|myf[56]|neurod|hand[12]|twist|tcf3|tcf4|e2a|hlf|scl|tal1|olig[123]|id[1-4])/),
  },
  { code: "4.5", test: (c) => nm(c, /forkhead/i) || gn(c, /^fox[a-z]/) },
  { code: "4.6", test: (c) => nm(c, /hmg-box|high mobility group/i) || gn(c, /^(sox|sry|hmgb|hmga|hmgn|tox)/) },
  {
    code: "4.7",
    test: (c) =>
      nm(c, /nuclear receptor subfamily|steroid hormone receptor|nuclear hormone receptor/i) ||
      nm(c, /^(estrogen|androgen|progesterone|glucocorticoid|mineralocorticoid|thyroid hormone|retinoic acid|retinoid|vitamin d[3]?|peroxisome proliferator|farnesoid|liver x|pregnane x|constitutive androstane|hepatocyte nuclear factor 4|steroidogenic factor|dosage-sensitive sex|germ cell nuclear|nerve growth factor) receptor/i) ||
      gn(c, /^(nr[0-9][a-z]|esr[123]|ar$|ppar[abdg]|thr[ab]|rar[abg]|rxr[abg]|rox|rev-erb|ror|lxr|fxr|pxr|car1|shp|dax|coopa|eco)/),
  },
  { code: "4.1", test: (c) => nm(c, /zinc finger|zn-finger/i) || gn(c, /^(znf|zfp|zic|zfpm|rba[kb]|klf|sp[1-8]|evil|wt1|glis|maz|patz)/) },
  {
    code: "4.11",
    test: (c) =>
      nm(c, /transcription (factor|regulator|activator|repressor|coactivator|corepressor|enhancer)|transcriptional (regulator|activator|repressor)/i) ||
      gn(c, /^(tf[a-z]|etv|elk|ets[12]|gata[1-6]|nf-kb|nfkbia|rel|stat[1-7]|smad[1-9]|runx|cbfb|lefl|tcfl|lyl1|atf|cebpa|irf|foxo|hnf4|onecut|lhx|lim|arid|fox)/),
  },
  { code: "4.12", test: (c) => kw(c, "DNA-binding") || kw(c, "DNA-binding protein") },
  // --- 通道与转运 ---
  { code: "5.1", test: (c) => kw(c, "Potassium channel") || nm(c, /potassium channel|\bk+ channel/i) },
  { code: "5.2", test: (c) => kw(c, "Sodium channel") || kw(c, "Calcium channel") || nm(c, /sodium channel|calcium channel|voltage-dependent (calcium|sodium)/i) },
  { code: "5.3", test: (c) => kw(c, "Chloride channel") || nm(c, /chloride channel|\bclc-[0-9]/i) },
  {
    code: "5.4",
    test: (c) =>
      nm(c, /ionotropic|ligand-gated|transient receptor potential|gap junction|connexin|innexin|5-hydroxytryptamine receptor 3|ion channel/i) ||
      kw(c, "Ion channel") || kw(c, "Ligand-gated ion channel"),
  },  { code: "5.5", test: (c) => nm(c, /solute carrier/i) || gn(c, /^slc/) },
  { code: "5.6", test: (c) => nm(c, /atp-binding cassette|abc transporter|abc-type/i) || gn(c, /^abc[a-z]/) },
  { code: "5.7", test: (c) => nm(c, /aquaporin|water channel/i) || gn(c, /^aqp/) },
  { code: "5.8", test: (c) => nm(c, /porin/i) || kw(c, "Porin") },
  { code: "5.9", test: (c) => nm(c, /transporting atpase|p-type atpase|na\+\/k\+|sodium pump|calcium-transporting/i) || kw(c, "Sodium/potassium-transporting ATPase") },
  {
    code: "5.10",
    test: (c) =>
      nm(c, /syntaxin|snap-|vesicle-associated|vesicle-fusing|clathrin|coatomer|dynamin|endophilin|amphiphysin|sorting nexin|arfgap|rab escort|guanine nucleotide dissociation inhibitor|sec[0-9]|secretory carrier|vesicle transport|endocytic/i) ||
      kw(c, "Endocytosis") || kw(c, "ER-Golgi transport") || kw(c, "Golgi stack") || gn(c, /^(snap|stx|vamp|sec[0-9]|ap[1-5][abm]|apba|eps|cltc|cop[abg]|dyn|rab3a|rab5a|rabs)/),
  },
  // --- 细胞骨架 ---
  { code: "6.1", test: (c) => nm(c, /^actin[ ,(-]|^actin-related|^actin$/i) || gn(c, /^(act[a-z]+[0-9]*|actr|act[1-7]$)/) },
  { code: "6.2", test: (c) => nm(c, /tubulin/i) || gn(c, /^(tub[abg]|tuba|tubb|tubg)/) },
  { code: "6.3", test: (c) => nm(c, /myosin/i) || gn(c, /^(myh|myl|myo[a-z]|mys)/) },
  { code: "6.4", test: (c) => nm(c, /kinesin|dynein/i) || gn(c, /^(kif|dyn[clth]|dnc|dna[hil]|wal)/) },
  {
    code: "6.5",
    test: (c) => nm(c, /keratin|lamin |^lamin-|prelamin|vimentin|desmin|neurofilament|glial fibrillary acidic|peripherin|internexin|syncoilin|phasin/i) || gn(c, /^(krt|lmma|lmb[1-5]|vimentin|des|nefl|nefm|nefh|gfap|prph|ina)/),
  },
  {
    code: "6.6",
    test: (c) => nm(c, /microtubule-associated|microtubule-associated protein|tau protein|tubulin tyrosine|stathmin/i) || kw(c, "Microtubule") || gn(c, /^(mapt|map[12]|stmn|tuba4a)/),
  },
  {
    code: "6.7",
    test: (c) =>
      nm(c, /profilin|cofilin|gelsolin|tropomyosin|troponin|villin|ezrin|moesin|radixin|filamin|spectrin|dystrophin|utrophin|actinin|thymosin|capza|capzb|arp[23]|formin| WAS protein|wiskott|capping protein/i) ||
      kw(c, "Actin-binding") || gn(c, /^(pfn|cfl|gsn|tpm|tnn|ezr|msn|rdx|fln|spt|actn|tmsb|arpc|was|wasp|diap|fmnl|vcl|tlmn)/),
  },
  { code: "6.8", test: (c) => nm(c, /septin/i) || gn(c, /^septin/) },
  {
    code: "6.9",
    test: (c) => nm(c, /flagellar|flagellin|ciliary|intraflagellar|axoneme|outer arm|inner arm|tektin|dynein light chain light/i) || kw(c, "Cilium") || kw(c, "Flagellum") || kw(c, "Ciliary basal body") || gn(c, /^(fli[ckg]|flg|flia|ift|tekt|dnaaf)/),
  },
  {
    code: "6.10",
    test: (c) =>
      nm(c, /chlorophyll|photosystem|ribulose|photosynthesis|light-harvesting|phycobilisome|cytochrome b6f|photosynthetic|chloroplast-coupling|rubisco/i) ||
      kw(c, "Photosynthesis") || gn(c, /^(psa|psb|lhca|lhcb|rbcl|rbc[sl]|pet[ab])/),
  },
  { code: "6.11", test: (c) => kw(c, "Cytoskeleton") || kw(c, "Structural protein") },
  {
    code: "6.12",
    test: (c) =>
      kw(c, "Cell adhesion") || kw(c, "Cell junction") || kw(c, "Tight junction") ||
      nm(c, /cadherin|integrin|catenin|desmocol|desmoplakin|desmoglein|zonula occludens|adherens junction|cell adhesion molecule|selectin|focal adhesion|talin|paxillin|vinculin/i) ||
      gn(c, /^(cdh[1-9]|itg[a-g]|ctnn[a-z]|dsc[1-3]|dsp|gja|gjb|gjc|ocln|jam[123]|pvrl|ncam|l1cam|icam|vcam|selp|sele|tln|pxn|vinc)/),
  },
  // --- 转运兕底与核质运输（在细胞骨架之后，避免抢驱动蛋白） ---
  { code: "5.11", test: (c) => kw(c, "Transport") || kw(c, "Protein transport") || kw(c, "Lipid-binding") || kw(c, "Lipid transport") || kw(c, "Sugar transport") || nm(c, /fatty acid-binding|sterol carrier|lipid transfer|lipocalin|apolipoprotein|ferritin|transferrin|hemoglobin|myoglobin/i) },
  {
    code: "5.12",
    test: (c) => nm(c, /importin|exportin|karyopherin|nuclear pore|nucleoporin|ran-binding|nuclear transport|rcc1|ran-specific/i) || gn(c, /^(kpn|ipo|xpo|nup|ranbp|rangap|rnpc|kaa)/),
  },
  // --- 免疫与防御（先于分泌/膜） ---
  {
    code: "8.1",
    test: (c) =>
      nm(c, /^ig[a-z]? .{0,12}chain|^immunoglobulin|ig gamma|ig heavy|ig kappa|ig lambda|immunoglobulin-like/i) ||
      gn(c, /^(igh[gma][0-9]?|igk[cv]?[0-9]*|igl[cv]?[0-9]*|igj|igll|vpre|cd79)/),
  },
  { code: "8.2", test: (c) => nm(c, /histocompatibility|\bmhc\b|antigen-presenting/i) || gn(c, /^(hla|h2|rt1)/) },
  {
    code: "8.3",
    test: (c) => nm(c, /t-cell (receptor|antigen receptor)|t cell receptor/i) || gn(c, /^(tr[abdg][a-z0-9]|trac|trbc|trdc|trgc|trav|trbv)/),
  },
  { code: "8.4", test: (c) => nm(c, /^complement|complement (c|factor|component)/i) || gn(c, /^c[1-9][aqbrsf]?[a-z0-9]*$/) },
  {
    code: "8.5",
    test: (c) =>
      (nm(c, /interferon|interleukin|colony stimulating|macrophage colony|granulocyte colony|stem cell factor|thrombopoietin|erythropoietin/i) && !nm(c, /receptor|regulatory factor|kinase|induced protein/i)) ||
      gn(c, /^(il[0-9]{1,2}|il[0-9]{1,2}[a-z]|ifn[a-z0-9]*|csf[1-3]|epo|thpo|kitlg|clcf1|il18rap)$/),
  },
  { code: "8.6", test: (c) => nm(c, /chemokine/i) || gn(c, /^(ccl|cxcl|cx3cl|xcl|ckb)/) },
  { code: "8.7", test: (c) => nm(c, /tumor necrosis factor/i) || gn(c, /^tnf[s]?f/) },
  {
    code: "8.8",
    test: (c) => nm(c, /defensin|cathelicidin|hepcidin|bactericidal|antimicrobial peptide|bacteriocin|lysozyme|lactoferrin|prophenin|protegrin/i),
  },
  { code: "8.9", test: (c) => nm(c, /disease resistance|pathogenesis-related|resistance protein|^rpp[0-9]|^rpm1|^rps[0-9]|^rpt[0-9]|mla|toll-interleukin/i) || kw(c, "Plant defense") || kw(c, "Disease resistance") || gn(c, /^(rps[0-9]|rpm1|rpp|rps4|rpg1|rx|bsk|nbs-lrr)/) },
  { code: "8.11", test: (c) => kw(c, "Toxin") },
  {
    code: "8.12",
    test: (c) => kw(c, "Immunity") || kw(c, "Innate immunity") || kw(c, "Adaptive immunity") || kw(c, "Antiviral defense") || kw(c, "Antibiotic") || nm(c, /immun[ei]/i),
  },
  // --- ECM 与分泌 ---
  { code: "7.1", test: (c) => nm(c, /collagen/i) || gn(c, /^col[1-9][a-z0-9]/) },
  {
    code: "7.2",
    test: (c) => nm(c, /fibronectin|laminin|vitronectin|osteopontin|fibrillin|fibulin|matrilin|nidogen|tectorin|elastin|fibulin|emilin|von willebrand/i) || gn(c, /^(fn1|lamb|lama|lamc|vit|postn|fbln|fbn|eln|vwf|thbs)/),
  },
  { code: "7.3", test: (c) => nm(c, /proteoglycan|glypican|syndecan|perlecan|agrin|versican|neurocan|brevican|aggrecan|biglycan|decorin|lumican/i) },
  { code: "7.4", test: (c) => kw(c, "Hormone") || kw(c, "Neuropeptide") || nm(c, /hormone|neuropeptide|insulin|gastrin|secretin|glucagon|somatostatin|melanocyte-stimulating/i) },
  // --- 受体与信号（先于其他膜蛋白） ---
  {
    code: "3.6",
    test: (c) => kw(c, "GTPase activation") || nm(c, /guanine nucleotide exchange factor|gtpase-activating|gtpase activating|gtpase regulator|guanine nucleotide dissociation stimulator|regulator of g protein|ralgef|son of sevenless/i) || gn(c, /^(arhgef|sos[12]|rapgef|tiam|dbl|rasgrp|rasal|nf1|rapgap|rgs[0-9]{1,2}|srgap)/),
  },
  { code: "3.5", test: (c) => nm(c, /gtpase|\bras |^ras-|ras-related|rab-|rho-|arf[0-9]|ran$|rap[12]\b|gtp-binding protein (ras|rab)/i) || gn(c, /^(rab[0-9a-z]|ras|kras|hras|nras|rho[a-z]|arfgap|rap[12ab]|ran$|ral[ab]|rras|rit1|rasl|rem2|gem|rad|di-ras)/) || kw(c, "GTP-binding") },
  { code: "3.7", test: (c) => nm(c, /guanine nucleotide-binding protein/i) || gn(c, /^(gn[a-z]{1,3}|gnb|gng|gpa|gbp)/) },
  { code: "3.9", test: (c) => kw(c, "SH2 domain") || kw(c, "SH3 domain") },
  {
    code: "3.10",
    test: (c) =>
      nm(c, /growth factor|hepatocyte growth factor|neurotrophin|neuregulin|stem cell factor|macrophage stimulating/i) ||
      gn(c, /^(egf|fgf[0-9]|vegf[a-z]|pdgf|ngf[b]?|bmp[0-9]|tgfb?[12]?|igf[12]|hgf|pdgfb|csf|kitlg|ndf|gdnf|artn|nrt[12]|bdnf|ntf[3-6]|cnp)/),
  },
  { code: "3.11", test: (c) => nm(c, /calmodulin|calmodulin-like|calcium-binding protein.*ef|troponin c/i) || kw(c, "EF-hand") || gn(c, /^(calm[1-3]|calml)/) },
  {
    code: "3.12",
    test: (c) => kw(c, "Wnt signaling pathway") || nm(c, /\bwnt-?\d|beta-catenin|\bb-catenin|frizzled|disheveled|armadillo|wnt signaling/i) || gn(c, /^(wnt[0-9a-z]|ctnnb|fzd[1-9]|dvl[123]|lgr[456]|lef1)/),
  },
  { code: "3.13", test: (c) => kw(c, "Receptor") || nm(c, /receptor/i) },
  // --- 细胞周期 ---
  { code: "11.1", test: (c) => nm(c, /cyclin/i) || gn(c, /^ccn[abcde]/) },
  { code: "11.5", test: (c) => kw(c, "Cell cycle") || kw(c, "Cell division") || kw(c, "Mitosis") || kw(c, "Meiosis") || kw(c, "Chromosome partition") || nm(c, /cell cycle|mitotic|spindle checkpoint|separase|securin|condensin|cohesin/i) },
  // --- 翻译因子（先于其他信号） ---
  {
    code: "9.2",
    test: (c) =>
      nm(c, /elongation factor|initiation factor|release factor|translation factor|translation-initiation|peptide chain release/i) ||
      kw(c, "Initiation factor") ||
      gn(c, /^(eef[12][ab]?|eif[0-9a-z]+|efts|eftu|tufm|tef[1-5]|ts|inf[abc]|aif|sui1|sup[23]5|ssbg|selb|rf[1-3])/),
  },
  { code: "9.4", test: (c) => kw(c, "Ribosome biogenesis") || kw(c, "rRNA processing") || kw(c, "Translation regulation") || nm(c, /ribosome biogenesis|ribosomal rna processing|rrna processing|nucleolar protein|ribosome assembly/i) },
  // --- 酶类（EC 归类，放靠后避免抢注功能家族） ---
  { code: "1.1", test: (c) => ec(c, "1.") || kw(c, "Oxidoreductase") },
  { code: "1.3", test: (c) => ec(c, "2.") || kw(c, "Transferase") },
  { code: "1.6", test: (c) => ec(c, "3.") || kw(c, "Hydrolase") },
  { code: "1.7", test: (c) => ec(c, "4.") || kw(c, "Lyase") },
  { code: "1.8", test: (c) => ec(c, "5.") || kw(c, "Isomerase") },
  { code: "1.9", test: (c) => ec(c, "6.") || kw(c, "Ligase") },
  { code: "1.10", test: (c) => ec(c, "7.") || kw(c, "Translocase") },
  // --- 分泌与 ECM 兜底 ---
  { code: "7.6", test: (c) => kw(c, "Extracellular matrix") || kw(c, "Extracellular matrix protein") },
  { code: "7.5", test: (c) => kw(c, "Secreted") },
  // --- 膜与其他兜底 ---
  { code: "13.1", test: (c) => kw(c, "Transmembrane") || kw(c, "Transmembrane helix") || kw(c, "Membrane") },
  { code: "13.2", test: () => true },
];

export function classify(p: RawProtein): { ctx: MatchCtx; code: string } {
  const ctx = buildCtx(p);
  for (const rule of RULES) {
    if (rule.test(ctx)) return { ctx, code: rule.code };
  }
  return { ctx, code: "13.2" };
}

// ===== CLI 入口：读取 jsonl → 分类 → 输出 =====
async function main() {
  const taxa = [9606, 10090, 10116, 7955, 9031, 7227, 6239, 559292, 3702, 83333];
  const outLines: string[] = [];
  const famCount = new Map<string, number>();
  const unMatched: { name: string; gene: string; kws: string[] }[] = [];
  let total = 0;

  for (const taxon of taxa) {
    const file = Bun.file(`download/proteomes/${taxon}.jsonl`);
    if (!(await file.exists())) {
      console.log(`! 缺少 ${taxon}.jsonl（跳过）`);
      continue;
    }
    const text = await file.text();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const p = JSON.parse(line) as RawProtein;
      const { code } = classify(p);
      famCount.set(code, (famCount.get(code) ?? 0) + 1);
      if (code === "13.2" && unMatched.length < 400) {
        unMatched.push({ name: p.proteinName.slice(0, 70), gene: p.genePrimary, kws: p.keywords.slice(0, 8) });
      }
      total++;
      outLines.push(JSON.stringify({ ...p, familyCode: code }));
    }
  }

  await Bun.write("download/classified.jsonl", outLines.join("\n") + "\n");
  await Bun.write("download/families.json", JSON.stringify({ classes: CLASSES, families: FAMILIES }, null, 2));

  // 报告
  console.log(`\n=== 分类报告: 共 ${total} 条 ===`);
  const byClass = new Map<string, number>();
  for (const [code, n] of famCount) {
    const cls = code.split(".")[0];
    byClass.set(cls, (byClass.get(cls) ?? 0) + n);
  }
  for (const cls of CLASSES) {
    const n = byClass.get(cls.code) ?? 0;
    console.log(`类 ${cls.code} ${cls.name}: ${n} (${((n / total) * 100).toFixed(1)}%)`);
    for (const fam of FAMILIES.filter((f) => f.code.startsWith(cls.code + "."))) {
      const m = famCount.get(fam.code) ?? 0;
      if (m > 0) console.log(`   ${fam.code} ${fam.name}: ${m}`);
    }
  }
  const unclassified = famCount.get("13.2") ?? 0;
  console.log(`\n未分类占比: ${((unclassified / total) * 100).toFixed(1)}%`);
  console.log(`\n=== 未分类样例（前 25）===`);
  for (const u of unMatched.slice(0, 25)) {
    console.log(`  ${u.gene.padEnd(12)} ${u.name} | kw: ${u.kws.join(",")}`);
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
