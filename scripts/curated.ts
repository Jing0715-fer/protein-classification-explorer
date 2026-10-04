/**
 * 精选蛋白清单 —— 覆盖 10 种模式/代表生物的主要蛋白类别
 * 数据来源：UniProtKB / Swiss-Prot（通过 REST API 抓取真实数据）
 *
 * 字段说明:
 *  a: UniProt 登录号（有把握的直填，可批量精确抓取）
 *  g: 基因符号（用于 gene_exact 搜索回退，也用于校验）
 *  t: NCBI 分类 ID（大肠杆菌用 K-12 株 83333，入库时归并到 562）
 *  f: 家族编码（见 FAMILIES 定义）
 *  o: 直系同源组（跨物种比较的核心）
 *  r: 是否为该组代表蛋白
 */

export const TAX = {
  H: 9606, // Human
  M: 10090, // Mouse
  R: 10116, // Rat
  Z: 7955, // Zebrafish
  C: 9031, // Chicken
  F: 7227, // Drosophila
  W: 6239, // C. elegans
  Y: 4932, // S. cerevisiae
  A: 3702, // Arabidopsis
  E: 83333, // E. coli K-12
} as const;

export interface Curated {
  a?: string;
  g: string;
  t: number;
  f: string;
  o: string;
  r?: boolean;
}

export const CURATED: Curated[] = [
  // ============ 1.1 蛋白激酶 ============
  { a: "P28482", g: "MAPK1", t: TAX.H, f: "1.1", o: "MAPK", r: true },
  { a: "P27361", g: "MAPK3", t: TAX.H, f: "1.1", o: "MAPK" },
  { a: "P63085", g: "Mapk1", t: TAX.M, f: "1.1", o: "MAPK" },
  { a: "P63086", g: "Mapk1", t: TAX.R, f: "1.1", o: "MAPK" },
  { a: "P40417", g: "rl", t: TAX.F, f: "1.1", o: "MAPK" },
  { g: "mpk-1", t: TAX.W, f: "1.1", o: "MAPK" },
  { a: "P16892", g: "FUS3", t: TAX.Y, f: "1.1", o: "MAPK" },
  { a: "P06493", g: "CDK1", t: TAX.H, f: "1.1", o: "CDK1", r: true },
  { a: "P24941", g: "CDK2", t: TAX.H, f: "1.1", o: "CDK1" },
  { a: "P11440", g: "Cdk1", t: TAX.M, f: "1.1", o: "CDK1" },
  { g: "Cdk1", t: TAX.F, f: "1.1", o: "CDK1" },
  { g: "cdk-1", t: TAX.W, f: "1.1", o: "CDK1" },
  { a: "P00546", g: "CDC28", t: TAX.Y, f: "1.1", o: "CDK1" },
  { a: "P17612", g: "PRKACA", t: TAX.H, f: "1.1", o: "PKA", r: true },
  { a: "P05132", g: "Prkaca", t: TAX.M, f: "1.1", o: "PKA" },
  { a: "P12370", g: "Pka-C1", t: TAX.F, f: "1.1", o: "PKA" },
  { g: "kin-1", t: TAX.W, f: "1.1", o: "PKA" },
  { a: "P06244", g: "TPK1", t: TAX.Y, f: "1.1", o: "PKA" },
  { a: "P17252", g: "PRKCA", t: TAX.H, f: "1.1", o: "PKC", r: true },
  { a: "Q9UQM7", g: "CAMK2A", t: TAX.H, f: "1.1", o: "CAMK2", r: true },
  { a: "P49841", g: "GSK3B", t: TAX.H, f: "1.1", o: "GSK3", r: true },
  { a: "P31749", g: "AKT1", t: TAX.H, f: "1.1", o: "AKT", r: true },
  { g: "MTOR", t: TAX.H, f: "1.1", o: "mTOR", r: true },
  { g: "BRAF", t: TAX.H, f: "1.1", o: "RAF", r: true },
  { g: "PIK3CA", t: TAX.H, f: "1.1", o: "PI3K", r: true },
  { g: "PRKAA1", t: TAX.H, f: "1.1", o: "AMPK", r: true },
  { a: "P06782", g: "SNF1", t: TAX.Y, f: "1.1", o: "AMPK" },
  { a: "P12931", g: "SRC", t: TAX.H, f: "1.1", o: "SRC", r: true },

  // ============ 1.2 蛋白磷酸酶 ============
  { a: "P62136", g: "PPP1CA", t: TAX.H, f: "1.2", o: "PP1", r: true },
  { a: "P32598", g: "GLC7", t: TAX.Y, f: "1.2", o: "PP1" },
  { a: "P67775", g: "PPP2CA", t: TAX.H, f: "1.2", o: "PP2A", r: true },
  { a: "P18031", g: "PTPN1", t: TAX.H, f: "1.2", o: "PTP1B", r: true },
  { a: "Q08209", g: "PPP3CA", t: TAX.H, f: "1.2", o: "PP2B", r: true },
  { g: "PTEN", t: TAX.H, f: "1.2", o: "PTEN", r: true },

  // ============ 1.3 蛋白酶 ============
  { a: "P07477", g: "PRSS1", t: TAX.H, f: "1.3", o: "trypsin", r: true },
  { a: "P08246", g: "ELANE", t: TAX.H, f: "1.3", o: "elastase", r: true },
  { a: "P00734", g: "F2", t: TAX.H, f: "1.3", o: "thrombin", r: true },
  { a: "P42574", g: "CASP3", t: TAX.H, f: "1.3", o: "caspase-3", r: true },
  { a: "P70677", g: "Casp3", t: TAX.M, f: "1.3", o: "caspase-3" },
  { g: "Dcp-1", t: TAX.F, f: "1.3", o: "caspase-3" },
  { g: "ced-3", t: TAX.W, f: "1.3", o: "caspase-3" },
  { a: "P55211", g: "CASP9", t: TAX.H, f: "1.3", o: "caspase-9", r: true },
  { g: "Dronc", t: TAX.F, f: "1.3", o: "caspase-9" },
  { a: "P08253", g: "MMP2", t: TAX.H, f: "1.3", o: "MMP", r: true },
  { a: "P14780", g: "MMP9", t: TAX.H, f: "1.3", o: "MMP" },

  // ============ 1.4 核酸聚合酶 ============
  { a: "P24928", g: "POLR2A", t: TAX.H, f: "1.4", o: "RNAP-II", r: true },
  { g: "Polr2A", t: TAX.F, f: "1.4", o: "RNAP-II" },
  { a: "P04050", g: "RPO21", t: TAX.Y, f: "1.4", o: "RNAP-II" },
  { g: "rpoC", t: TAX.E, f: "1.4", o: "RNAP" },
  { a: "P09884", g: "POLA1", t: TAX.H, f: "1.4", o: "DNAP-alpha", r: true },
  { g: "dnaE", t: TAX.E, f: "1.4", o: "DNAP-III" },

  // ============ 1.5 泛素化通路酶 ============
  { a: "P0CG47", g: "UBB", t: TAX.H, f: "1.5", o: "ubiquitin", r: true },
  { a: "P0CG48", g: "UBC", t: TAX.H, f: "1.5", o: "ubiquitin" },
  { g: "Ubc", t: TAX.M, f: "1.5", o: "ubiquitin" },
  { a: "P22314", g: "UBA1", t: TAX.H, f: "1.5", o: "UBA1", r: true },
  { a: "P22515", g: "UBA1", t: TAX.Y, f: "1.5", o: "UBA1" },
  { a: "Q00987", g: "MDM2", t: TAX.H, f: "1.5", o: "MDM2", r: true },
  { a: "P23804", g: "Mdm2", t: TAX.M, f: "1.5", o: "MDM2" },
  { a: "O60260", g: "PARK2", t: TAX.H, f: "1.5", o: "parkin", r: true },
  { a: "Q93009", g: "USP7", t: TAX.H, f: "1.5", o: "USP7", r: true },

  // ============ 1.6 代谢酶 ============
  { a: "P04406", g: "GAPDH", t: TAX.H, f: "1.6", o: "GAPDH", r: true },
  { a: "P16858", g: "Gapdh", t: TAX.M, f: "1.6", o: "GAPDH" },
  { a: "P04797", g: "Gapdh", t: TAX.R, f: "1.6", o: "GAPDH" },
  { g: "Gapdh1", t: TAX.F, f: "1.6", o: "GAPDH" },
  { a: "P00359", g: "TDH3", t: TAX.Y, f: "1.6", o: "GAPDH" },
  { g: "gapA", t: TAX.E, f: "1.6", o: "GAPDH" },
  { a: "P19367", g: "HK1", t: TAX.H, f: "1.6", o: "hexokinase", r: true },
  { a: "P04807", g: "HXK2", t: TAX.Y, f: "1.6", o: "hexokinase" },
  { a: "P35557", g: "GCK", t: TAX.H, f: "1.6", o: "glucokinase", r: true },
  { a: "P14618", g: "PKM", t: TAX.H, f: "1.6", o: "pyruvate-kinase", r: true },
  { g: "pykF", t: TAX.E, f: "1.6", o: "pyruvate-kinase" },
  { a: "P00338", g: "LDHA", t: TAX.H, f: "1.6", o: "LDH", r: true },
  { g: "Ldha", t: TAX.M, f: "1.6", o: "LDH" },
  { a: "P40926", g: "MDH2", t: TAX.H, f: "1.6", o: "MDH", r: true },
  { a: "O75874", g: "IDH1", t: TAX.H, f: "1.6", o: "IDH", r: true },
  { a: "P00330", g: "ADH1", t: TAX.Y, f: "1.6", o: "ADH", r: true },
  { g: "Adh", t: TAX.F, f: "1.6", o: "ADH" },
  { a: "P04385", g: "GAL1", t: TAX.Y, f: "1.6", o: "GAL1", r: true },

  // ============ 1.7 氧化还原与抗氧化酶 ============
  { a: "P00441", g: "SOD1", t: TAX.H, f: "1.7", o: "SOD1", r: true },
  { g: "Sod1", t: TAX.M, f: "1.7", o: "SOD1" },
  { a: "P00445", g: "SOD1", t: TAX.Y, f: "1.7", o: "SOD1" },
  { g: "Sod", t: TAX.F, f: "1.7", o: "SOD1" },
  { a: "P04040", g: "CAT", t: TAX.H, f: "1.7", o: "catalase", r: true },
  { g: "Cat", t: TAX.M, f: "1.7", o: "catalase" },
  { a: "P99999", g: "CYCS", t: TAX.H, f: "1.7", o: "cytochrome-c", r: true },
  { a: "P00044", g: "CYC1", t: TAX.Y, f: "1.7", o: "cytochrome-c" },
  { a: "P00395", g: "MT-CO1", t: TAX.H, f: "1.7", o: "COX1", r: true },
  { g: "G6PD", t: TAX.H, f: "1.7", o: "G6PD", r: true },

  // ============ 2.1 G蛋白偶联受体 ============
  { a: "P07550", g: "ADRB2", t: TAX.H, f: "2.1", o: "ADRB2", r: true },
  { g: "Adrb2", t: TAX.M, f: "2.1", o: "ADRB2" },
  { a: "P08100", g: "RHO", t: TAX.H, f: "2.1", o: "rhodopsin", r: true },
  { g: "Rho", t: TAX.M, f: "2.1", o: "rhodopsin" },
  { a: "P06002", g: "ninaE", t: TAX.F, f: "2.1", o: "rhodopsin" },
  { a: "P14416", g: "DRD2", t: TAX.H, f: "2.1", o: "DRD2", r: true },
  { a: "P11229", g: "CHRM1", t: TAX.H, f: "2.1", o: "CHRM1", r: true },
  { g: "STE2", t: TAX.Y, f: "2.1", o: "pheromone-R", r: true },

  // ============ 2.2 受体酪氨酸激酶 ============
  { a: "P00533", g: "EGFR", t: TAX.H, f: "2.2", o: "EGFR", r: true },
  { g: "Egfr", t: TAX.M, f: "2.2", o: "EGFR" },
  { g: "Egfr", t: TAX.F, f: "2.2", o: "EGFR" },
  { a: "P04626", g: "ERBB2", t: TAX.H, f: "2.2", o: "HER2", r: true },
  { a: "P06213", g: "INSR", t: TAX.H, f: "2.2", o: "INSR", r: true },
  { g: "Insr", t: TAX.M, f: "2.2", o: "INSR" },
  { g: "InR", t: TAX.F, f: "2.2", o: "INSR" },
  { a: "P11362", g: "FGFR1", t: TAX.H, f: "2.2", o: "FGFR1", r: true },
  { a: "P35968", g: "KDR", t: TAX.H, f: "2.2", o: "VEGFR", r: true },

  // ============ 2.3 核受体 ============
  { a: "P04150", g: "NR3C1", t: TAX.H, f: "2.3", o: "GR", r: true },
  { g: "Nr3c1", t: TAX.M, f: "2.3", o: "GR" },
  { a: "P03372", g: "ESR1", t: TAX.H, f: "2.3", o: "ER", r: true },
  { g: "Esr1", t: TAX.M, f: "2.3", o: "ER" },
  { a: "P10828", g: "THRB", t: TAX.H, f: "2.3", o: "THR", r: true },
  { a: "P37231", g: "PPARG", t: TAX.H, f: "2.3", o: "PPAR", r: true },
  { a: "P10275", g: "AR", t: TAX.H, f: "2.3", o: "AR", r: true },
  { g: "PGR", t: TAX.H, f: "2.3", o: "PR", r: true },
  { g: "RXRA", t: TAX.H, f: "2.3", o: "RXR", r: true },
  { g: "EcR", t: TAX.F, f: "2.3", o: "ecdysone-R", r: true },

  // ============ 2.4 离子通道 ============
  { a: "Q14721", g: "KCNB1", t: TAX.H, f: "2.4", o: "KV-channel", r: true },
  { a: "P08510", g: "Sh", t: TAX.F, f: "2.4", o: "KV-channel" },
  { a: "P35498", g: "SCN1A", t: TAX.H, f: "2.4", o: "Nav-channel", r: true },
  { g: "para", t: TAX.F, f: "2.4", o: "Nav-channel" },
  { a: "P42262", g: "GRIA1", t: TAX.H, f: "2.4", o: "AMPAR", r: true },
  { a: "P36544", g: "CHRNA7", t: TAX.H, f: "2.4", o: "nAChR", r: true },

  // ============ 2.5 小GTP酶 ============
  { a: "P01112", g: "HRAS", t: TAX.H, f: "2.5", o: "RAS", r: true },
  { a: "P01116", g: "KRAS", t: TAX.H, f: "2.5", o: "RAS" },
  { a: "P01111", g: "NRAS", t: TAX.H, f: "2.5", o: "RAS" },
  { g: "Kras", t: TAX.M, f: "2.5", o: "RAS" },
  { a: "P01119", g: "RAS1", t: TAX.Y, f: "2.5", o: "RAS" },
  { a: "P01120", g: "RAS2", t: TAX.Y, f: "2.5", o: "RAS" },
  { g: "Ras85D", t: TAX.F, f: "2.5", o: "RAS" },
  { g: "let-60", t: TAX.W, f: "2.5", o: "RAS" },
  { a: "P61586", g: "RHOA", t: TAX.H, f: "2.5", o: "RHO", r: true },
  { a: "P06780", g: "RHO1", t: TAX.Y, f: "2.5", o: "RHO" },
  { a: "P63000", g: "RAC1", t: TAX.H, f: "2.5", o: "RAC", r: true },
  { a: "P60953", g: "CDC42", t: TAX.H, f: "2.5", o: "CDC42", r: true },
  { a: "P20339", g: "RAB5A", t: TAX.H, f: "2.5", o: "RAB", r: true },
  { a: "P84077", g: "ARF1", t: TAX.H, f: "2.5", o: "ARF", r: true },
  { a: "P62826", g: "RAN", t: TAX.H, f: "2.5", o: "RAN", r: true },

  // ============ 2.6 信号接头与通路蛋白 ============
  { a: "P62993", g: "GRB2", t: TAX.H, f: "2.6", o: "GRB2", r: true },
  { a: "Q07889", g: "SOS1", t: TAX.H, f: "2.6", o: "SOS", r: true },
  { a: "P35222", g: "CTNNB1", t: TAX.H, f: "2.6", o: "beta-catenin", r: true },
  { g: "Ctnnb1", t: TAX.M, f: "2.6", o: "beta-catenin" },
  { g: "arm", t: TAX.F, f: "2.6", o: "beta-catenin" },
  { a: "P84022", g: "SMAD3", t: TAX.H, f: "2.6", o: "SMAD", r: true },
  { g: "Mad", t: TAX.F, f: "2.6", o: "SMAD" },
  { g: "sma-3", t: TAX.W, f: "2.6", o: "SMAD" },
  { a: "P46531", g: "NOTCH1", t: TAX.H, f: "2.6", o: "Notch", r: true },
  { a: "P07140", g: "N", t: TAX.F, f: "2.6", o: "Notch" },
  { g: "SHH", t: TAX.H, f: "2.6", o: "Sonic-hedgehog", r: true },
  { g: "hh", t: TAX.F, f: "2.6", o: "Sonic-hedgehog" },
  { a: "Q92008", g: "shha", t: TAX.Z, f: "2.6", o: "Sonic-hedgehog" },
  { g: "WNT1", t: TAX.H, f: "2.6", o: "Wnt", r: true },
  { g: "wg", t: TAX.F, f: "2.6", o: "Wnt" },

  // ============ 3.1 序列特异性转录因子 ============
  { a: "P04637", g: "TP53", t: TAX.H, f: "3.1", o: "TP53", r: true },
  { a: "P02340", g: "Trp53", t: TAX.M, f: "3.1", o: "TP53" },
  { g: "Tp53", t: TAX.R, f: "3.1", o: "TP53" },
  { g: "tp53", t: TAX.Z, f: "3.1", o: "TP53" },
  { g: "cep-1", t: TAX.W, f: "3.1", o: "TP53" },
  { g: "TP73", t: TAX.H, f: "3.1", o: "TP73", r: true },
  { a: "P05412", g: "JUN", t: TAX.H, f: "3.1", o: "AP-1", r: true },
  { g: "Jun", t: TAX.M, f: "3.1", o: "AP-1" },
  { a: "P01100", g: "FOS", t: TAX.H, f: "3.1", o: "AP-1" },
  { a: "P09543", g: "CREB1", t: TAX.H, f: "3.1", o: "CREB", r: true },
  { a: "P01106", g: "MYC", t: TAX.H, f: "3.1", o: "MYC", r: true },
  { a: "P01108", g: "Myc", t: TAX.M, f: "3.1", o: "MYC" },
  { a: "P15172", g: "MYOD1", t: TAX.H, f: "3.1", o: "MYOD", r: true },
  { g: "myod1", t: TAX.Z, f: "3.1", o: "MYOD" },
  { a: "Q04206", g: "RELA", t: TAX.H, f: "3.1", o: "NF-kB", r: true },
  { g: "dl", t: TAX.F, f: "3.1", o: "NF-kB" },
  { a: "P40763", g: "STAT3", t: TAX.H, f: "3.1", o: "STAT", r: true },
  { g: "stat", t: TAX.F, f: "3.1", o: "STAT" },
  { a: "P08047", g: "SP1", t: TAX.H, f: "3.1", o: "SP1", r: true },
  { g: "HOXA1", t: TAX.H, f: "3.1", o: "HOX", r: true },
  { a: "P02833", g: "Antp", t: TAX.F, f: "3.1", o: "HOX" },
  { a: "P83949", g: "Ubx", t: TAX.F, f: "3.1", o: "HOX" },
  { g: "lin-39", t: TAX.W, f: "3.1", o: "HOX" },
  { g: "SOX2", t: TAX.H, f: "3.1", o: "SOX", r: true },
  { g: "POU5F1", t: TAX.H, f: "3.1", o: "OCT4", r: true },
  { g: "PAX6", t: TAX.H, f: "3.1", o: "PAX6", r: true },
  { g: "Pax6", t: TAX.M, f: "3.1", o: "PAX6" },
  { g: "pax6a", t: TAX.Z, f: "3.1", o: "PAX6" },
  { g: "ey", t: TAX.F, f: "3.1", o: "PAX6" },
  { g: "GATA1", t: TAX.H, f: "3.1", o: "GATA", r: true },
  { g: "HIF1A", t: TAX.H, f: "3.1", o: "HIF1", r: true },
  { g: "CTCF", t: TAX.H, f: "3.1", o: "CTCF", r: true },
  { g: "CDX2", t: TAX.H, f: "3.1", o: "CDX/Caudal", r: true },
  { g: "pal-1", t: TAX.W, f: "3.1", o: "CDX/Caudal" },
  { g: "TP63", t: TAX.H, f: "3.1", o: "TP63", r: true },
  { a: "P04386", g: "GAL4", t: TAX.Y, f: "3.1", o: "GAL4", r: true },
  { a: "P03069", g: "GCN4", t: TAX.Y, f: "3.1", o: "GCN4", r: true },
  { g: "LFY", t: TAX.A, f: "3.1", o: "LEAFY", r: true },
  { g: "AP1", t: TAX.A, f: "3.1", o: "AP1", r: true },

  // ============ 3.2 组蛋白 ============
  { a: "P62805", g: "H4C1", t: TAX.H, f: "3.2", o: "H4", r: true },
  { a: "P02309", g: "HHF1", t: TAX.Y, f: "3.2", o: "H4" },
  { a: "P68431", g: "H3C1", t: TAX.H, f: "3.2", o: "H3", r: true },
  { a: "P04908", g: "H2AC1", t: TAX.H, f: "3.2", o: "H2A", r: true },
  { g: "His2Av", t: TAX.F, f: "3.2", o: "H2A" },
  { a: "P33778", g: "H2BC11", t: TAX.H, f: "3.2", o: "H2B", r: true },
  { a: "P02259", g: "H5", t: TAX.C, f: "3.2", o: "H1/H5", r: true },

  // ============ 3.3 表观遗传修饰酶 ============
  { a: "Q13547", g: "HDAC1", t: TAX.H, f: "3.3", o: "HDAC", r: true },
  { a: "Q09472", g: "EP300", t: TAX.H, f: "3.3", o: "p300", r: true },
  { a: "Q15910", g: "EZH2", t: TAX.H, f: "3.3", o: "EZH2", r: true },
  { a: "P26358", g: "DNMT1", t: TAX.H, f: "3.3", o: "DNMT1", r: true },
  { g: "Dnmt1", t: TAX.M, f: "3.3", o: "DNMT1" },
  { g: "MET1", t: TAX.A, f: "3.3", o: "DNMT1" },
  { a: "Q96EB6", g: "SIRT1", t: TAX.H, f: "3.3", o: "SIRT1", r: true },
  { a: "P06700", g: "SIR2", t: TAX.Y, f: "3.3", o: "SIRT1" },
  { g: "MECP2", t: TAX.H, f: "3.3", o: "MECP2", r: true },
  { g: "BRD4", t: TAX.H, f: "3.3", o: "BRD4", r: true },

  // ============ 4.1 细胞骨架 ============
  { a: "P60709", g: "ACTB", t: TAX.H, f: "4.1", o: "actin", r: true },
  { a: "P60710", g: "Actb", t: TAX.M, f: "4.1", o: "actin" },
  { g: "Actb", t: TAX.R, f: "4.1", o: "actin" },
  { a: "Q7ZVI7", g: "actba", t: TAX.Z, f: "4.1", o: "actin" },
  { g: "ACTB", t: TAX.C, f: "4.1", o: "actin" },
  { a: "P10987", g: "Act5C", t: TAX.F, f: "4.1", o: "actin" },
  { g: "act-1", t: TAX.W, f: "4.1", o: "actin" },
  { a: "P60010", g: "ACT1", t: TAX.Y, f: "4.1", o: "actin" },
  { g: "ACT2", t: TAX.A, f: "4.1", o: "actin" },
  { a: "P68133", g: "ACTA1", t: TAX.H, f: "4.1", o: "actin" },
  { a: "P63267", g: "ACTG1", t: TAX.H, f: "4.1", o: "actin" },
  { a: "Q71U36", g: "TUBA1A", t: TAX.H, f: "4.1", o: "tubulin", r: true },
  { a: "P07437", g: "TUBB", t: TAX.H, f: "4.1", o: "tubulin" },
  { g: "Tuba1a", t: TAX.M, f: "4.1", o: "tubulin" },
  { g: "alphaTub84B", t: TAX.F, f: "4.1", o: "tubulin" },
  { a: "P34690", g: "tba-2", t: TAX.W, f: "4.1", o: "tubulin" },
  { a: "P09733", g: "TUB1", t: TAX.Y, f: "4.1", o: "tubulin" },
  { a: "P02557", g: "TUB2", t: TAX.Y, f: "4.1", o: "tubulin" },
  { a: "P08670", g: "VIM", t: TAX.H, f: "4.1", o: "vimentin", r: true },
  { a: "P14136", g: "GFAP", t: TAX.H, f: "4.1", o: "GFAP", r: true },

  // ============ 4.2 分子马达 ============
  { a: "P12883", g: "MYH7", t: TAX.H, f: "4.2", o: "myosin-II", r: true },
  { a: "P35579", g: "MYH9", t: TAX.H, f: "4.2", o: "myosin-II" },
  { a: "P05661", g: "Mhc", t: TAX.F, f: "4.2", o: "myosin-II" },
  { a: "P02566", g: "unc-54", t: TAX.W, f: "4.2", o: "myosin-II" },
  { a: "P33176", g: "KIF5B", t: TAX.H, f: "4.2", o: "kinesin-1", r: true },
  { g: "Khc", t: TAX.F, f: "4.2", o: "kinesin-1" },
  { g: "unc-116", t: TAX.W, f: "4.2", o: "kinesin-1" },
  { a: "Q14204", g: "DYNC1H1", t: TAX.H, f: "4.2", o: "dynein", r: true },
  { a: "P19524", g: "MYO2", t: TAX.Y, f: "4.2", o: "myosin-V", r: true },
  { g: "unc-22", t: TAX.W, f: "4.2", o: "twitchin", r: true },

  // ============ 4.3 细胞外基质 ============
  { a: "P02452", g: "COL1A1", t: TAX.H, f: "4.3", o: "collagen-I", r: true },
  { g: "Col1a1", t: TAX.M, f: "4.3", o: "collagen-I" },
  { a: "P02458", g: "COL2A1", t: TAX.H, f: "4.3", o: "collagen-II", r: true },
  { a: "P02751", g: "FN1", t: TAX.H, f: "4.3", o: "fibronectin", r: true },

  // ============ 5.1 ABC转运体 ============
  { a: "P13569", g: "CFTR", t: TAX.H, f: "5.1", o: "CFTR", r: true },
  { g: "Cftr", t: TAX.M, f: "5.1", o: "CFTR" },
  { a: "P08183", g: "ABCB1", t: TAX.H, f: "5.1", o: "MDR1", r: true },
  { a: "P10090", g: "w", t: TAX.F, f: "5.1", o: "white", r: true },

  // ============ 5.2 溶质载体 ============
  { a: "P11166", g: "SLC2A1", t: TAX.H, f: "5.2", o: "GLUT1", r: true },
  { g: "Slc2a1", t: TAX.M, f: "5.2", o: "GLUT1" },
  { a: "P31645", g: "SLC6A4", t: TAX.H, f: "5.2", o: "SERT", r: true },

  // ============ 5.3 P型ATP酶 ============
  { a: "P05023", g: "ATP1A1", t: TAX.H, f: "5.3", o: "NaK-ATPase", r: true },
  { g: "Atp1a1", t: TAX.M, f: "5.3", o: "NaK-ATPase" },
  { g: "Atp1a1", t: TAX.R, f: "5.3", o: "NaK-ATPase" },
  { g: "Atpalpha", t: TAX.F, f: "5.3", o: "NaK-ATPase" },
  { a: "P16615", g: "ATP2A2", t: TAX.H, f: "5.3", o: "SERCA", r: true },
  { a: "P05030", g: "PMA1", t: TAX.Y, f: "5.3", o: "H-ATPase", r: true },
  { g: "AHA1", t: TAX.A, f: "5.3", o: "H-ATPase" },

  // ============ 6.1 免疫识别分子 ============
  { a: "P01857", g: "IGHG1", t: TAX.H, f: "6.1", o: "IgG", r: true },
  { g: "HLA-A", t: TAX.H, f: "6.1", o: "MHC-I", r: true },
  { g: "H2-K1", t: TAX.M, f: "6.1", o: "MHC-I" },
  { g: "CD4", t: TAX.H, f: "6.1", o: "CD4", r: true },
  { g: "DEFA1", t: TAX.H, f: "6.1", o: "defensin", r: true },
  { g: "Dpt", t: TAX.F, f: "6.1", o: "AMP", r: true },
  { g: "CecA1", t: TAX.F, f: "6.1", o: "AMP" },

  // ============ 6.2 免疫效应分子 ============
  { a: "P01024", g: "C3", t: TAX.H, f: "6.2", o: "complement-C3", r: true },
  { a: "P61626", g: "LYZ", t: TAX.H, f: "6.2", o: "lysozyme", r: true },
  { a: "P00698", g: "LYZ", t: TAX.C, f: "6.2", o: "lysozyme" },
  { a: "P01579", g: "IFNG", t: TAX.H, f: "6.2", o: "IFN-gamma", r: true },
  { a: "P01375", g: "TNF", t: TAX.H, f: "6.2", o: "TNF", r: true },
  { g: "IL6", t: TAX.H, f: "6.2", o: "IL6", r: true },

  // ============ 7.1 周期蛋白与细胞周期调控 ============
  { a: "P14635", g: "CCNB1", t: TAX.H, f: "7.1", o: "cyclin-B", r: true },
  { g: "Ccnb1", t: TAX.M, f: "7.1", o: "cyclin-B" },
  { g: "CycB", t: TAX.F, f: "7.1", o: "cyclin-B" },
  { g: "cyb-1", t: TAX.W, f: "7.1", o: "cyclin-B" },
  { a: "P24869", g: "CLB2", t: TAX.Y, f: "7.1", o: "cyclin-B" },
  { a: "P24385", g: "CCND1", t: TAX.H, f: "7.1", o: "cyclin-D", r: true },
  { a: "P06400", g: "RB1", t: TAX.H, f: "7.1", o: "RB1", r: true },
  { g: "CDKN1A", t: TAX.H, f: "7.1", o: "p21", r: true },

  // ============ 7.2 凋亡机器 ============
  { a: "P10415", g: "BCL2", t: TAX.H, f: "7.2", o: "BCL2", r: true },
  { g: "ced-9", t: TAX.W, f: "7.2", o: "BCL2" },
  { a: "Q07812", g: "BAX", t: TAX.H, f: "7.2", o: "BAX", r: true },
  { g: "Bax", t: TAX.M, f: "7.2", o: "BAX" },
  { a: "P98170", g: "XIAP", t: TAX.H, f: "7.2", o: "XIAP", r: true },
  { a: "O14727", g: "APAF1", t: TAX.H, f: "7.2", o: "APAF1", r: true },
  { g: "ced-4", t: TAX.W, f: "7.2", o: "APAF1" },

  // ============ 7.3 DNA损伤修复 ============
  { g: "BRCA1", t: TAX.H, f: "7.3", o: "BRCA1", r: true },
  { g: "Brca1", t: TAX.M, f: "7.3", o: "BRCA1" },
  { g: "BRCA2", t: TAX.H, f: "7.3", o: "BRCA2", r: true },
  { g: "RAD51", t: TAX.H, f: "7.3", o: "RAD51/RecA", r: true },
  { a: "P0A7G6", g: "recA", t: TAX.E, f: "7.3", o: "RAD51/RecA" },
  { g: "MSH2", t: TAX.H, f: "7.3", o: "MSH2", r: true },
  { g: "PARP1", t: TAX.H, f: "7.3", o: "PARP1", r: true },
  { g: "PCNA", t: TAX.H, f: "7.3", o: "PCNA", r: true },
  { a: "P06778", g: "RAD52", t: TAX.Y, f: "7.3", o: "RAD52", r: true },

  // ============ 8.1 HSP70家族 ============
  { a: "P0DMV8", g: "HSPA1A", t: TAX.H, f: "8.1", o: "HSP70", r: true },
  { a: "P11142", g: "HSPA8", t: TAX.H, f: "8.1", o: "HSP70" },
  { g: "Hspa1a", t: TAX.M, f: "8.1", o: "HSP70" },
  { g: "hspa8", t: TAX.Z, f: "8.1", o: "HSP70" },
  { g: "Hsc70-4", t: TAX.F, f: "8.1", o: "HSP70" },
  { g: "hsp-1", t: TAX.W, f: "8.1", o: "HSP70" },
  { a: "P10591", g: "SSA1", t: TAX.Y, f: "8.1", o: "HSP70" },
  { a: "P0A6Y8", g: "dnaK", t: TAX.E, f: "8.1", o: "HSP70" },
  { g: "HSC70-1", t: TAX.A, f: "8.1", o: "HSP70" },

  // ============ 8.2 HSP90家族 ============
  { a: "P07900", g: "HSP90AA1", t: TAX.H, f: "8.2", o: "HSP90", r: true },
  { g: "Hsp90aa1", t: TAX.M, f: "8.2", o: "HSP90" },
  { g: "Hsp83", t: TAX.F, f: "8.2", o: "HSP90" },
  { a: "P02829", g: "HSP82", t: TAX.Y, f: "8.2", o: "HSP90" },
  { g: "htpG", t: TAX.E, f: "8.2", o: "HSP90" },

  // ============ 8.3 Chaperonin ============
  { a: "P0A6F5", g: "groL", t: TAX.E, f: "8.3", o: "HSP60/GroEL", r: true },
  { a: "P10809", g: "HSPD1", t: TAX.H, f: "8.3", o: "HSP60/GroEL" },
  { a: "P19882", g: "HSP60", t: TAX.Y, f: "8.3", o: "HSP60/GroEL" },
  { a: "P0A6F9", g: "groS", t: TAX.E, f: "8.3", o: "GroES", r: true },

  // ============ 8.4 小分子伴侣 ============
  { a: "P04792", g: "HSPB1", t: TAX.H, f: "8.4", o: "HSP27", r: true },
  { g: "CRYAA", t: TAX.H, f: "8.4", o: "alphaA-crystallin", r: true },
  { g: "Cryaa", t: TAX.M, f: "8.4", o: "alphaA-crystallin" },

  // ============ 8.5 蛋白酶体 ============
  { a: "P20618", g: "PSMB1", t: TAX.H, f: "8.5", o: "20S-core", r: true },
  { g: "PSMA5", t: TAX.H, f: "8.5", o: "20S-core" },

  // ============ 9.1 核糖体蛋白 ============
  { g: "RPL4", t: TAX.H, f: "9.1", o: "RPL4", r: true },
  { a: "P62753", g: "RPS6", t: TAX.H, f: "9.1", o: "RPS6", r: true },
  { g: "rplA", t: TAX.E, f: "9.1", o: "RPL1" },
  { g: "rpsL", t: TAX.E, f: "9.1", o: "RPS12" },

  // ============ 9.2 翻译因子 ============
  { a: "P06730", g: "EIF4E", t: TAX.H, f: "9.2", o: "eIF4E", r: true },
  { a: "P68104", g: "EEF1A1", t: TAX.H, f: "9.2", o: "EF1A", r: true },
  { a: "P02994", g: "TEF1", t: TAX.Y, f: "9.2", o: "EF1A" },
  { a: "P13639", g: "EEF2", t: TAX.H, f: "9.2", o: "EF2", r: true },
  { g: "tufA", t: TAX.E, f: "9.2", o: "EF-Tu" },
  { g: "fusA", t: TAX.E, f: "9.2", o: "EF-G" },

  // ============ 10.1 氧载体 ============
  { a: "P69905", g: "HBA1", t: TAX.H, f: "10.1", o: "hemoglobin-α", r: true },
  { a: "P01942", g: "Hba-a1", t: TAX.M, f: "10.1", o: "hemoglobin-α" },
  { a: "P68871", g: "HBB", t: TAX.H, f: "10.1", o: "hemoglobin-β", r: true },
  { a: "P02088", g: "Hbb-bs", t: TAX.M, f: "10.1", o: "hemoglobin-β" },
  { a: "P15379", g: "MB", t: TAX.H, f: "10.1", o: "myoglobin", r: true },
  { g: "Mb", t: TAX.M, f: "10.1", o: "myoglobin" },

  // ============ 10.2 血浆蛋白 ============
  { a: "P02768", g: "ALB", t: TAX.H, f: "10.2", o: "albumin", r: true },
  { g: "Alb", t: TAX.M, f: "10.2", o: "albumin" },
  { g: "Alb", t: TAX.R, f: "10.2", o: "albumin" },
  { a: "P02787", g: "TF", t: TAX.H, f: "10.2", o: "transferrin", r: true },
  { a: "P02647", g: "APOA1", t: TAX.H, f: "10.2", o: "apolipoprotein-A1", r: true },
  { a: "P02794", g: "FTH1", t: TAX.H, f: "10.2", o: "ferritin-H", r: true },
  { a: "P01012", g: "OVAL", t: TAX.C, f: "10.2", o: "ovalbumin", r: true },

  // ============ 10.3 激素蛋白 ============
  { a: "P01308", g: "INS", t: TAX.H, f: "10.3", o: "insulin", r: true },
  { g: "Ins2", t: TAX.M, f: "10.3", o: "insulin" },
  { a: "P01236", g: "GH1", t: TAX.H, f: "10.3", o: "growth-hormone", r: true },

  // ============ 11.1 光合与植物特异蛋白 ============
  { a: "O03042", g: "rbcL", t: TAX.A, f: "11.1", o: "RuBisCO-L", r: true },
  { a: "P10795", g: "RBCS-1A", t: TAX.A, f: "11.1", o: "RuBisCO-S" },
  { g: "psbA", t: TAX.A, f: "11.1", o: "PSII-D1", r: true },
  { g: "PHYB", t: TAX.A, f: "11.1", o: "phytochrome-B", r: true },
  { g: "CRY1", t: TAX.A, f: "11.1", o: "cryptochrome-1", r: true },
  { g: "ETR1", t: TAX.A, f: "11.1", o: "ethylene-R", r: true },
  { g: "FLC", t: TAX.A, f: "11.1", o: "FLC", r: true },
  { g: "TIR1", t: TAX.A, f: "11.1", o: "TIR1", r: true },

  // ============ 11.2 细菌特征蛋白 ============
  { a: "P00722", g: "lacZ", t: TAX.E, f: "11.2", o: "beta-galactosidase", r: true },
  { a: "P03023", g: "lacI", t: TAX.E, f: "11.2", o: "lac-repressor", r: true },
  { g: "crp", t: TAX.E, f: "11.2", o: "CRP", r: true },
  { g: "rpoD", t: TAX.E, f: "11.2", o: "sigma-70", r: true },
  { g: "ftsZ", t: TAX.E, f: "11.2", o: "FtsZ", r: true },
  { g: "ompA", t: TAX.E, f: "11.2", o: "OmpA", r: true },
  { g: "malE", t: TAX.E, f: "11.2", o: "MBP", r: true },
  { g: "phoA", t: TAX.E, f: "11.2", o: "alkaline-phosphatase", r: true },
  { g: "ampC", t: TAX.E, f: "11.2", o: "beta-lactamase", r: true },

  // ============ 11.3 节律基因（经典模式基因） ============
  { g: "per", t: TAX.F, f: "11.3", o: "period", r: true },
  { g: "PER1", t: TAX.H, f: "11.3", o: "period" },
  { g: "PER2", t: TAX.H, f: "11.3", o: "period" },
  { g: "Per1", t: TAX.M, f: "11.3", o: "period" },
  { g: "tim", t: TAX.F, f: "11.3", o: "timeless", r: true },
  { g: "TIM", t: TAX.H, f: "11.3", o: "timeless" },
];

/** 家族定义（大类 + 二级家族） */
export const FAMILIES: { code: string; name: string; nameEn: string; description: string }[] = [
  { code: "1", name: "酶类", nameEn: "Enzymes", description: "催化生物化学反应的蛋白，包括激酶、磷酸酶、蛋白酶等主要酶类家族" },
  { code: "1.1", name: "蛋白激酶", nameEn: "Protein kinases", description: "催化蛋白质磷酸化，调控几乎所有细胞信号通路（MAPK、CDK、PKA、PKC 等）" },
  { code: "1.2", name: "蛋白磷酸酶", nameEn: "Protein phosphatases", description: "去除磷酸基团，与激酶共同构成可逆磷酸化开关（PP1、PP2A、PTP 等）" },
  { code: "1.3", name: "蛋白酶", nameEn: "Proteases", description: "切割肽键水解蛋白质：丝氨酸蛋白酶、半胱氨酸蛋白酶（caspase）、金属蛋白酶等" },
  { code: "1.4", name: "核酸聚合酶", nameEn: "Nucleic acid polymerases", description: "DNA 与 RNA 的合成机器：RNA 聚合酶 II 大亚基、DNA 聚合酶等" },
  { code: "1.5", name: "泛素化通路酶", nameEn: "Ubiquitin pathway enzymes", description: "泛素-蛋白酶体系统的核心组件：泛素、E1 激活酶、E3 连接酶、去泛素化酶" },
  { code: "1.6", name: "代谢酶", nameEn: "Metabolic enzymes", description: "糖酵解、TCA 循环等中心代谢的酶：GAPDH、己糖激酶、丙酮酸激酶、LDH 等" },
  { code: "1.7", name: "氧化还原与抗氧化酶", nameEn: "Oxidoreductases", description: "电子传递与抗氧化防御：SOD、过氧化氢酶、细胞色素 c、G6PD 等" },
  { code: "2", name: "受体与信号转导", nameEn: "Receptors & Signaling", description: "感知外界与胞内信号并传递信息的膜受体和信号蛋白" },
  { code: "2.1", name: "G蛋白偶联受体", nameEn: "GPCRs", description: "七次跨膜受体超家族，最大的药物靶点家族：肾上腺素能受体、视紫红质、多巴胺受体等" },
  { code: "2.2", name: "受体酪氨酸激酶", nameEn: "Receptor tyrosine kinases", description: "单次跨膜激酶受体：EGFR、胰岛素受体、FGFR、VEGFR 等，癌症重要靶点" },
  { code: "2.3", name: "核受体", nameEn: "Nuclear receptors", description: "配体激活的胞内转录因子：糖皮质激素受体、雌激素受体、甲状腺受体、PPAR 等" },
  { code: "2.4", name: "离子通道", nameEn: "Ion channels", description: "跨膜离子孔道：电压门控钾/钠通道（Shaker、para）、谷氨酸受体、nAChR 等" },
  { code: "2.5", name: "小GTP酶", nameEn: "Small GTPases", description: "Ras 超家族分子开关：Ras、Rho、Rac、Cdc42、Rab、Arf、Ran" },
  { code: "2.6", name: "信号接头与通路蛋白", nameEn: "Adaptors & pathway proteins", description: "信号通路的连接与骨架蛋白：GRB2、β-catenin、SMAD、Notch、Wnt 等" },
  { code: "3", name: "转录调控与表观遗传", nameEn: "Transcription & Epigenetics", description: "基因表达调控的核心蛋白：转录因子、组蛋白、表观遗传修饰酶" },
  { code: "3.1", name: "序列特异性转录因子", nameEn: "Sequence-specific TFs", description: "识别特定 DNA 序列的转录因子：p53、AP-1、MYC、HOX、NF-κB、GAL4 等" },
  { code: "3.2", name: "组蛋白", nameEn: "Histones", description: "染色质基本结构单元——核小体的核心组蛋白 H2A/H2B/H3/H4 与接头组蛋白 H1/H5" },
  { code: "3.3", name: "表观遗传修饰酶", nameEn: "Epigenetic modifiers", description: "书写/擦除/读取表观标记：HDAC、p300、EZH2、DNMT1、SIRT1、MECP2 等" },
  { code: "4", name: "细胞结构", nameEn: "Cell structure", description: "维持细胞形态、运动与组织结构的蛋白" },
  { code: "4.1", name: "细胞骨架", nameEn: "Cytoskeleton", description: "肌动蛋白、微管蛋白与中间丝——细胞骨架三大体系" },
  { code: "4.2", name: "分子马达", nameEn: "Motor proteins", description: "沿细胞骨架运动的马达：肌球蛋白、驱动蛋白、动力蛋白" },
  { code: "4.3", name: "细胞外基质", nameEn: "Extracellular matrix", description: "胶原、纤连蛋白等 ECM 骨架蛋白" },
  { code: "5", name: "跨膜转运", nameEn: "Membrane transport", description: "跨膜物质运输系统" },
  { code: "5.1", name: "ABC转运体", nameEn: "ABC transporters", description: "ATP 结合盒转运体：CFTR（囊性纤维化）、MDR1（多药耐药）、果蝇 white" },
  { code: "5.2", name: "溶质载体", nameEn: "Solute carriers", description: "SLC 转运蛋白：葡萄糖转运体 GLUT1、血清素转运体 SERT" },
  { code: "5.3", name: "P型ATP酶", nameEn: "P-type ATPases", description: "离子泵：Na⁺/K⁺-ATPase、SERCA 钙泵、酵母/植物 H⁺-ATPase" },
  { code: "6", name: "免疫与防御", nameEn: "Immunity & Defense", description: "免疫识别与免疫效应分子" },
  { code: "6.1", name: "免疫识别分子", nameEn: "Immune recognition", description: "抗体、MHC、CD4、防御素与昆虫抗菌肽" },
  { code: "6.2", name: "免疫效应分子", nameEn: "Immune effectors", description: "补体 C3、溶菌酶、干扰素、TNF、IL-6 等效应分子" },
  { code: "7", name: "细胞周期与凋亡", nameEn: "Cell cycle & Apoptosis", description: "细胞增殖、死亡与基因组守护的调控网络" },
  { code: "7.1", name: "周期蛋白与细胞周期调控", nameEn: "Cyclins & cell cycle", description: "cyclin-B/D、RB、p21——细胞周期引擎与检查点" },
  { code: "7.2", name: "凋亡机器", nameEn: "Apoptosis machinery", description: "BCL-2 家族、BAX、XIAP、APAF1 及线虫 ced-9/ced-4 同源体系" },
  { code: "7.3", name: "DNA损伤修复", nameEn: "DNA repair", description: "BRCA1/2、RAD51（同源大肠杆菌 RecA）、MSH2、PARP1 等 DNA 守护蛋白" },
  { code: "8", name: "蛋白质稳态", nameEn: "Proteostasis", description: "蛋白质折叠、质量控制与降解系统" },
  { code: "8.1", name: "HSP70家族", nameEn: "HSP70 family", description: "最保守的伴侣蛋白家族：人 HSP70/Hsc70、酵母 Ssa1、大肠杆菌 DnaK" },
  { code: "8.2", name: "HSP90家族", nameEn: "HSP90 family", description: "信号蛋白折叠的专属伴侣：人 HSP90、果蝇 Hsp83、酵母 Hsp82、细菌 HtpG" },
  { code: "8.3", name: "Chaperonin", nameEn: "Chaperonins", description: "桶状折叠机器：GroEL/GroES（大肠杆菌经典系统）、人 HSP60" },
  { code: "8.4", name: "小分子伴侣", nameEn: "Small HSPs", description: "α-晶状体蛋白家族的小分子伴侣：HSP27、αA-crystallin" },
  { code: "8.5", name: "蛋白酶体", nameEn: "Proteasome", description: "26S 蛋白酶体 20S 核心颗粒亚基" },
  { code: "9", name: "翻译机器", nameEn: "Translation machinery", description: "核糖体与翻译各阶段的因子" },
  { code: "9.1", name: "核糖体蛋白", nameEn: "Ribosomal proteins", description: "核糖体大小亚基蛋白：真核 RPL4/RPS6、细菌 L1/S12" },
  { code: "9.2", name: "翻译因子", nameEn: "Translation factors", description: "翻译起始/延伸/终止因子：eIF4E、EF1A、EF2、EF-Tu、EF-G" },
  { code: "10", name: "血液与载体蛋白", nameEn: "Blood & carrier proteins", description: "脊椎动物血液中的运输与载体蛋白" },
  { code: "10.1", name: "氧载体", nameEn: "Oxygen carriers", description: "血红蛋白 α/β 链与肌红蛋白——氧运输的经典球蛋白折叠" },
  { code: "10.2", name: "血浆蛋白", nameEn: "Plasma proteins", description: "白蛋白、转铁蛋白、载脂蛋白、铁蛋白及鸡卵白蛋白" },
  { code: "10.3", name: "激素蛋白", nameEn: "Hormone proteins", description: "胰岛素、生长激素等肽类激素蛋白" },
  { code: "11", name: "物种特征蛋白", nameEn: "Taxon-specific proteins", description: "植物、细菌特有的经典蛋白与模式生物标志性基因" },
  { code: "11.1", name: "光合与植物特异蛋白", nameEn: "Photosynthesis & plant-specific", description: "RuBisCO、光系统 II D1、光敏色素、乙烯受体、FLC 等拟南芥经典" },
  { code: "11.2", name: "细菌特征蛋白", nameEn: "Bacterial-specific", description: "lac 操纵子体系、σ⁷⁰、FtsZ、OmpA、碱性磷酸酶等大肠杆菌经典" },
  { code: "11.3", name: "节律基因", nameEn: "Circadian clock genes", description: "period/timeless——从果蝇到哺乳动物高度保守的生物钟基因" },
];

/** 模式生物定义（含系统发育路径，用于进化树渲染；谱系对照 NCBI Taxonomy 校准，详见 seed-full.ts 注释） */
export const ORGANISMS = [
  { taxonId: 562, scientificName: "Escherichia coli", commonName: "大肠杆菌", phyloPath: "细菌域 Bacteria>变形菌门 Proteobacteria>γ-变形菌纲 Gammaproteobacteria>肠杆菌目 Enterobacterales>肠杆菌科 Enterobacteriaceae>埃希氏菌属 Escherichia", orderRank: 1, modelTag: "细菌模式生物" },
  { taxonId: 4932, scientificName: "Saccharomyces cerevisiae", commonName: "酿酒酵母", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>真菌界 Fungi>子囊菌门 Ascomycota>酵母亚门 Saccharomycotina", orderRank: 2, modelTag: "真核模式生物" },
  { taxonId: 3702, scientificName: "Arabidopsis thaliana", commonName: "拟南芥", phyloPath: "真核生物域 Eukaryota>植物界 Plantae>有胚植物 Embryophyta>维管植物 Tracheophyta>被子植物 Magnoliophyta>真双子叶植物 Eudicots>十字花目 Brassicales>十字花科 Brassicaceae", orderRank: 3, modelTag: "植物模式生物" },
  { taxonId: 6239, scientificName: "Caenorhabditis elegans", commonName: "秀丽隐杆线虫", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>原口动物 Protostomia>蜕皮动物 Ecdysozoa>线虫动物门 Nematoda>色杆纲 Chromadorea>小杆目 Rhabditida>隐杆线虫属 Caenorhabditis", orderRank: 4, modelTag: "无脊椎模式生物" },
  { taxonId: 7227, scientificName: "Drosophila melanogaster", commonName: "黑腹果蝇", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>原口动物 Protostomia>蜕皮动物 Ecdysozoa>节肢动物门 Arthropoda>昆虫纲 Insecta>双翅目 Diptera>果蝇属 Drosophila", orderRank: 5, modelTag: "遗传学模式生物" },
  { taxonId: 7955, scientificName: "Danio rerio", commonName: "斑马鱼", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>辐鳍鱼纲 Actinopterygii>真骨下纲 Teleostei>鲤形目 Cypriniformes", orderRank: 6, modelTag: "脊椎发育模型" },
  { taxonId: 9031, scientificName: "Gallus gallus", commonName: "红原鸡（家鸡）", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>鸟纲 Aves>鸡形目 Galliformes>雉科 Phasianidae", orderRank: 7, modelTag: "鸟类模式生物" },
  { taxonId: 10090, scientificName: "Mus musculus", commonName: "小家鼠", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>哺乳纲 Mammalia>灵长总目 Euarchontoglires>啮齿目 Rodentia>鼠科 Muridae>小鼠属 Mus", orderRank: 8, modelTag: "哺乳模式生物" },
  { taxonId: 10116, scientificName: "Rattus norvegicus", commonName: "褐家鼠", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>哺乳纲 Mammalia>灵长总目 Euarchontoglires>啮齿目 Rodentia>鼠科 Muridae>大鼠属 Rattus", orderRank: 9, modelTag: "生理药理模型" },
  { taxonId: 9606, scientificName: "Homo sapiens", commonName: "人", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>哺乳纲 Mammalia>灵长总目 Euarchontoglires>灵长目 Primates>人科 Hominidae>人属 Homo", orderRank: 10, modelTag: "参照物种" },
];
