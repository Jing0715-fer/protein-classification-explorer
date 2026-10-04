// 蛋白数据共享类型定义

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
  children?: FamilyNodeDTO[];
}

export interface ProteinLite {
  accession: string;
  entryName: string;
  geneName: string;
  proteinName: string;
  taxonId: number;
  familyCode: string;
  group: string;
  length: number;
  massKda: number;
  reviewed: boolean;
  rep: boolean;
  pdbCount: number;
}

export interface BootstrapDTO {
  organisms: OrganismDTO[];
  families: FamilyNodeDTO[];
  proteins: ProteinLite[];
  stats: {
    totalProteins: number;
    reviewed: number;
    classCount: number;
    familyCount: number;
    groupCount: number;
    multiSpeciesGroups: number;
    organismCount: number;
    avgLength: number;
    avgMass: number;
  };
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
  rep: boolean;
}

export interface ProteinDetailDTO {
  accession: string;
  entryName: string;
  reviewed: boolean;
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
  group: string;
  length: number;
  massKda: number;
  functionText: string;
  subcellular: string[];
  ptm: string;
  keywords: string[];
  domains: string[];
  pdbCount: number;
  sequence: string;
  isRepresentative: boolean;
  aaComposition: { aa: string; pct: number }[];
  orthologs: OrthologBrief[];
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
  pdbCount: number;
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

/** 11 个大类的配色（用于树/矩阵/图例） */
export const CLASS_COLORS: Record<string, string> = {
  "1": "#059669", // 酶类 - emerald
  "2": "#0d9488", // 受体与信号 - teal
  "3": "#e11d48", // 转录与表观 - rose
  "4": "#d97706", // 细胞结构 - amber
  "5": "#ea580c", // 跨膜转运 - orange
  "6": "#65a30d", // 免疫防御 - lime
  "7": "#db2777", // 周期与凋亡 - pink
  "8": "#0891b2", // 蛋白质稳态 - cyan
  "9": "#7c3aed", // 翻译机器 - violet
  "10": "#dc2626", // 血液载体 - red
  "11": "#78716c", // 物种特征 - stone
};

export function classOf(familyCode: string): string {
  return familyCode.split(".")[0];
}
