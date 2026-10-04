// 蛋白数据共享类型定义（全量蛋白组版）

export interface OrganismDTO {
  id: number;
  taxonId: number;
  scientificName: string;
  commonName: string;
  phyloPath: string;
  orderRank: number;
  proteinCount: number;
}

export interface FamilyNodeDTO {
  code: string;
  name: string;
  nameEn: string;
  description: string;
  /** 组节点标记：group=超群（SLC/GPCR/组蛋白），surgery=手术分支 */
  kind?: string;
  /** 直接挂载的蛋白数（二级家族） */
  count: number;
  /** 含子节点的蛋白数（大类） */
  totalCount: number;
  /** 家族 × 物种计数（taxonId -> count） */
  byOrganism: Record<number, number>;
  children?: FamilyNodeDTO[];
}

export interface BootstrapStats {
  totalProteins: number;
  classCount: number;
  /** 超家族节点数（含子节点的 level-2 节点） */
  superfamilyCount: number;
  /** 叶子家族数（树末端节点） */
  familyCount: number;
  organismCount: number;
  orthologGroups: number;
  crossSpeciesGroups: number;
  ecAnnotated: number;
  orthodbCovered: number;
  avgLength: number;
  avgMass: number;
  /** 已归入具名家族的比例 0-100 */
  classifiedPct: number;
  /** 数据生成日期 */
  dataDate: string;
}

export interface BootstrapDTO {
  organisms: OrganismDTO[];
  families: FamilyNodeDTO[];
  stats: BootstrapStats;
}

/** 蛋白列表行（分页返回） */
export interface ProteinLite {
  accession: string;
  entryName: string;
  geneName: string;
  proteinName: string;
  taxonId: number;
  familyCode: string;
  orthodb: string;
  length: number;
  massKda: number;
  hasEC: boolean;
}

export interface ProteinListDTO {
  rows: ProteinLite[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OrthologBrief {
  accession: string;
  entryName: string;
  geneName: string;
  proteinName: string;
  organismCommon: string;
  organismScientific: string;
  taxonId: number;
  length: number;
  massKda: number;
}

export interface KeywordDTO {
  id: string;
  name: string;
  category: string;
}

/** 疾病关联（UniProt DISEASE 注释） */
export interface DiseaseDTO {
  name: string;
  acronym: string;
  description: string;
  /** OMIM/MIM 编号（可能为空） */
  mimId: string;
}

/** 分子互作对象（UniProt INTERACTION 注释，IntAct 证据） */
export interface InteractionDTO {
  accession: string;
  geneName: string;
  /** 支持实验数 */
  experiments: number;
  /** 是否在本库（可点击跳转详情） */
  inDb: boolean;
}

/** 异构体（可变剪接/可变启动子） */
export interface IsoformDTO {
  name: string;
  synonyms: string[];
  ids: string[];
  status: string;
}

/** 精选外部数据库链接 */
export interface XrefLinkDTO {
  /** 展示名（中文分组见 group） */
  db: string;
  /** 中文分组：基因与基因组/通路注释/结构预测/家族与域/直系同源/相互作用/疾病与药物/表达 */
  group: string;
  id: string;
  url: string;
  /** 附加说明（如 Reactome 通路名） */
  note: string;
}

export interface GoTermDTO {
  id: string;
  name: string;
  aspect: "P" | "F" | "C";
}

export interface DomainFeature {
  type: string;
  description: string;
  start: number;
  end: number;
}

export interface ProteinDetailDTO {
  accession: string;
  entryName: string;
  entryType: string;
  /** 蛋白存在性证据（Protein existence） */
  proteinExistence: string;
  /** UniProt 注释评分 1-5 */
  annotationScore: number;
  proteinName: string;
  altNames: string[];
  geneName: string;
  geneSynonyms: string[];
  organismCommon: string;
  organismScientific: string;
  taxonId: number;
  familyCode: string;
  familyName: string;
  familyNameEn: string;
  /** 完整层级链：大类 → 超家族 → 家族 → 亚家族 */
  familyChain?: { code: string; name: string; nameEn: string }[];
  className: string;
  classNameEn: string;
  orthodb: string;
  eggnog: string;
  groupName: string;
  crossSpeciesGroup: boolean;
  length: number;
  massKda: number;
  functionText: string;
  catalyticActivity: string;
  /** 酶活性调控 */
  activityRegulation: string;
  /** 辅因子列表 */
  cofactors: string[];
  subunit: string;
  tissueSpecificity: string;
  /** 发育阶段表达 */
  developmentalStage: string;
  induction: string;
  /** 域功能文字注释（区别于 FT 特征） */
  domainComment: string;
  ptm: string;
  similarity: string;
  /** 注释警告 */
  caution: string;
  /** 其他注释 */
  miscellaneous: string;
  diseases: DiseaseDTO[];
  isoforms: IsoformDTO[];
  interactions: InteractionDTO[];
  subcellular: string[];
  keywords: KeywordDTO[];
  domains: string[];
  domainFeatures: DomainFeature[];
  goTerms: GoTermDTO[];
  pdbCount: number;
  pdbIds: string[];
  ecNumbers: string[];
  xrefs: XrefLinkDTO[];
  sequence: string;
  firstPublicDate: string;
  lastAnnotationUpdateDate: string;
  lastSequenceUpdateDate: string;
  entryVersion: number;
  sequenceVersion: number;
  aaComposition: { aa: string; pct: number }[];
  orthologs: OrthologBrief[];
  source: "cache" | "live";
}

export interface CompareProtein {
  accession: string;
  entryName: string;
  geneName: string;
  proteinName: string;
  organismCommon: string;
  taxonId: number;
  length: number;
  massKda: number;
  domainCount: number;
  keywordCount: number;
  domains: string[];
  keywords: string[];
  aaComposition: { aa: string; pct: number }[];
  group: string;
}

export interface PairSimilarity {
  a: string;
  b: string;
  /** 氨基酸组成余弦相似度 0-100 */
  composition: number;
  /** 关键词 Jaccard 相似度 0-100 */
  keywords: number;
  /** 结构域 Jaccard 相似度 0-100 */
  domains: number;
  /** 综合相似度 0-100 */
  overall: number;
}

export interface CompareDTO {
  proteins: CompareProtein[];
  pairs: PairSimilarity[];
}

/** 直系同源组（浏览） */
export interface GroupSummaryDTO {
  id: string;
  name: string;
  proteinCount: number;
  organismCount: number;
  organismIds: number[];
  crossSpecies: boolean;
  familyCode: string;
}

export interface GroupListDTO {
  rows: GroupSummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 全局搜索 */
export interface SearchResultDTO {
  proteins: (ProteinLite & { familyName: string })[];
  families: { code: string; name: string; nameEn: string; count: number }[];
  organisms: { taxonId: number; commonName: string; proteinCount: number }[];
}

/** 13 个大类的配色（自然学术色板，用于树/矩阵/图例） */
export const CLASS_COLORS: Record<string, string> = {
  "1": "#6e8b3d", // 酶类 - 橄榄绿
  "2": "#c9a227", // 激酶 - 芥末金
  "3": "#2e7d64", // 受体与信号 - 松绿
  "4": "#b5496a", // 转录与染色质 - 绯梅
  "5": "#c0762f", // 通道与转运 - 琥珀赭
  "6": "#a35a3c", // 细胞骨架 - 赭红
  "7": "#8a7b52", // ECM与分泌 - 黄褐
  "8": "#ab3b30", // 免疫防御 - 砖红
  "9": "#7c8a70", // 核糖体与翻译 - 灰绿
  "10": "#3d7a78", // 蛋白质稳态 - 深青
  "11": "#b8638f", // 周期与肿瘤 - 梅粉
  "12": "#96637e", // 核酸加工 - 灰梅
  "13": "#8b857a", // 膜与其他 - 暖灰
};

export const CLASS_NAMES: Record<string, string> = {
  "1": "酶类",
  "2": "激酶",
  "3": "受体与信号转导",
  "4": "转录与染色质",
  "5": "通道与转运",
  "6": "细胞骨架与结构",
  "7": "胞外基质与分泌",
  "8": "免疫与防御",
  "9": "核糖体与翻译",
  "10": "蛋白质稳态",
  "11": "细胞周期与肿瘤调控",
  "12": "核酸代谢与加工",
  "13": "膜蛋白与其他",
};

export function classOf(familyCode: string): string {
  return familyCode.split(".")[0];
}
