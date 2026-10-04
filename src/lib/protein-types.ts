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
  subunit: string;
  tissueSpecificity: string;
  induction: string;
  ptm: string;
  similarity: string;
  subcellular: string[];
  keywords: KeywordDTO[];
  domains: string[];
  domainFeatures: DomainFeature[];
  goTerms: GoTermDTO[];
  pdbCount: number;
  pdbIds: string[];
  ecNumbers: string[];
  sequence: string;
  firstPublicDate: string;
  lastAnnotationUpdateDate: string;
  entryVersion: number;
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

/** 13 个大类的配色（用于树/矩阵/图例） */
export const CLASS_COLORS: Record<string, string> = {
  "1": "#059669", // 酶类 - emerald
  "2": "#65a30d", // 激酶 - lime
  "3": "#0d9488", // 受体与信号 - teal
  "4": "#e11d48", // 转录与染色质 - rose
  "5": "#d97706", // 通道与转运 - amber
  "6": "#ea580c", // 细胞骨架 - orange
  "7": "#ca8a04", // ECM与分泌 - yellow
  "8": "#dc2626", // 免疫防御 - red
  "9": "#7c3aed", // 核糖体与翻译 - violet
  "10": "#0891b2", // 蛋白质稳态 - cyan
  "11": "#db2777", // 周期与肿瘤 - pink
  "12": "#c026d3", // 核酸加工 - fuchsia
  "13": "#78716c", // 膜与其他 - stone
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
