import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeComposition } from "@/lib/composition";
import type { DomainFeature, GoTermDTO, InteractionDTO, IsoformDTO, KeywordDTO, OrthologBrief, ProteinDetailDTO, XrefLinkDTO } from "@/lib/protein-types";

export const dynamic = "force-dynamic";

/** UniProt REST API 原始 JSON 结构（局部） */
interface UniEntry {
  entryType?: string;
  primaryAccession: string;
  uniProtkbId?: string;
  annotationScore?: number;
  proteinExistence?: string;
  entryAudit?: {
    firstPublicDate?: string;
    lastAnnotationUpdateDate?: string;
    lastSequenceUpdateDate?: string;
    entryVersion?: number;
    sequenceVersion?: number;
  };
  organism?: { scientificName?: string; commonName?: string[] | string; taxonId?: number };
  proteinDescription?: {
    recommendedName?: { fullName?: { value?: string } };
    submissionNames?: { fullName?: { value?: string } }[];
    alternativeNames?: { fullName?: { value?: string } }[];
  };
  genes?: { geneName?: { value?: string }; synonyms?: { value?: string }[] }[];
  comments?: {
    commentType?: string;
    texts?: { value?: string }[];
    locations?: { location?: { value?: string } }[];
    note?: { texts?: { value?: string }[] };
    reaction?: { name?: string } | { name?: string }[];
    disease?: {
      diseaseId?: string;
      acronym?: string;
      description?: string;
      diseaseCrossReference?: { database?: string; id?: string };
    };
    cofactors?: { name?: string }[];
    interactions?: {
      interactantOne?: { uniProtKBAccession?: string; geneName?: string };
      interactantTwo?: { uniProtKBAccession?: string; geneName?: string };
      numberOfExperiments?: number;
    }[];
    isoforms?: {
      name?: { value?: string };
      synonyms?: { value?: string }[];
      isoformIds?: string[];
      isoformSequenceStatus?: string;
    }[];
  }[];
  features?: {
    type?: string;
    description?: string;
    location?: { start?: { value?: number }; end?: { value?: number } };
  }[];
  keywords?: { id?: string; name?: string; category?: string }[];
  uniProtKBCrossReferences?: {
    database?: string;
    id?: string;
    properties?: { key?: string; value?: string }[];
  }[];
  sequence?: { value?: string; length?: number; molWeight?: string };
}

function commentText(entry: UniEntry, type: string, max = 4000): string {
  const c = entry.comments?.filter((x) => x.commentType === type) ?? [];
  const parts: string[] = [];
  for (const cc of c) {
    const t = (cc.texts ?? []).map((x) => x.value ?? "").filter(Boolean).join(" ");
    if (t) parts.push(t);
  }
  return parts.join("\n").slice(0, max);
}

/** 序列特征优先级（域/拓扑 → 加工 → 位点/修饰），超出 60 个截断 */
const FEATURE_PRIORITY = [
  "Domain",
  "Region",
  "Repeat",
  "Zinc finger",
  "DNA-binding",
  "Nucleotide binding",
  "Motif",
  "Transmembrane",
  "Intramembrane",
  "Signal",
  "Transit peptide",
  "Topological domain",
  "Active site",
  "Binding site",
  "Site",
  "Calcium-binding",
  "Chain",
  "Propeptide",
  "Peptide",
  "Disulfide bond",
  "Cross-link",
  "Glycosylation",
  "Lipid",
  "Modified residue",
];
const FEATURE_SET = new Set(FEATURE_PRIORITY);

/** 精选交叉引用数据库（已验证 URL 可达；403 为站点反爬，浏览器正常） */
const XREF_GROUPS: Record<string, string> = {
  gene: "基因与基因组",
  pathway: "通路注释",
  structure: "结构预测",
  family: "家族与域",
  orthology: "直系同源",
  interaction: "相互作用",
  drug: "疾病与药物",
  expression: "表达",
};

interface XrefDef {
  group: keyof typeof XREF_GROUPS;
  label: string;
  max: number;
  url: (id: string, acc: string) => string;
  note?: (props: { key?: string; value?: string }[]) => string;
}

const XREF_DEFS: Record<string, XrefDef> = {
  Ensembl: {
    group: "gene",
    label: "Ensembl",
    max: 2,
    url: (id) => `https://www.ensembl.org/id/${id}`,
  },
  RefSeq: {
    group: "gene",
    label: "RefSeq",
    max: 2,
    url: (id) => (/^(NP_|XP_|AP_|YP_|WP_)/.test(id) ? `https://www.ncbi.nlm.nih.gov/protein/${id}` : `https://www.ncbi.nlm.nih.gov/nuccore/${id}`),
  },
  GeneID: { group: "gene", label: "NCBI Gene", max: 1, url: (id) => `https://www.ncbi.nlm.nih.gov/gene/${id}` },
  HGNC: { group: "gene", label: "HGNC", max: 1, url: (id) => `https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${id}` },
  Reactome: {
    group: "pathway",
    label: "Reactome",
    max: 6,
    url: (id) => `https://reactome.org/content/detail/${id}`,
    note: (props) => {
      const n = props.find((p) => p.key === "PathwayName")?.value ?? "";
      return n;
    },
  },
  KEGG: { group: "pathway", label: "KEGG", max: 2, url: (id) => `https://www.genome.jp/entry/${id}` },
  AlphaFoldDB: { group: "structure", label: "AlphaFold", max: 1, url: (_id, acc) => `https://alphafold.ebi.ac.uk/entry/${acc}` },
  SMR: { group: "structure", label: "SWISS-MODEL", max: 1, url: (_id, acc) => `https://swissmodel.expasy.org/repository/uniprot/${acc}` },
  Pfam: { group: "family", label: "Pfam", max: 6, url: (id) => `https://www.ebi.ac.uk/interpro/entry/Pfam/${id}/` },
  InterPro: { group: "family", label: "InterPro", max: 6, url: (id) => `https://www.ebi.ac.uk/interpro/entry/InterPro/${id}/` },
  PROSITE: { group: "family", label: "PROSITE", max: 4, url: (id) => `https://prosite.expasy.org/${id}` },
  PANTHER: { group: "family", label: "PANTHER", max: 2, url: (id) => `https://www.pantherdb.org/panther/family.do?clsAccession=${id}` },
  TCDB: { group: "family", label: "TCDB", max: 2, url: (id) => `https://www.tcdb.org/tcdb/index.php?tc=${id}` },
  OrthoDB: { group: "orthology", label: "OrthoDB", max: 1, url: (id) => `https://www.orthodb.org/?query=${id}` },
  STRING: { group: "interaction", label: "STRING", max: 1, url: (id) => `https://string-db.org/network/${id}` },
  MIM: { group: "drug", label: "OMIM", max: 4, url: (id) => `https://www.omim.org/entry/${id}` },
  ChEMBL: { group: "drug", label: "ChEMBL", max: 3, url: (id) => `https://www.ebi.ac.uk/chembl/target_report_card/${id}` },
  DrugBank: { group: "drug", label: "DrugBank", max: 4, url: (id) => `https://go.drugbank.com/drugs/${id}` },
  GuidetoPHARMACOLOGY: {
    group: "drug",
    label: "IUPHAR 药理",
    max: 2,
    url: (id) => `https://www.guidetopharmacology.org/GRAC/ObjectDisplayForward?objectId=${id}`,
  },
  PharmGKB: { group: "drug", label: "PharmGKB", max: 2, url: (id) => `https://www.pharmgkb.org/gene/${id}` },
  HPA: { group: "expression", label: "Human Protein Atlas", max: 1, url: (id) => `https://www.proteinatlas.org/${id}` },
};

/** 从 UniProt 实时 JSON 提取详情 */
function extractDetail(entry: UniEntry): {
  entryType: string;
  proteinExistence: string;
  annotationScore: number;
  altNames: string[];
  geneSynonyms: string[];
  functionText: string;
  catalyticActivity: string;
  activityRegulation: string;
  cofactors: string[];
  subunit: string;
  tissueSpecificity: string;
  developmentalStage: string;
  induction: string;
  domainComment: string;
  ptm: string;
  similarity: string;
  caution: string;
  miscellaneous: string;
  diseases: { name: string; acronym: string; description: string; mimId: string }[];
  isoforms: IsoformDTO[];
  interactions: { accession: string; geneName: string; experiments: number }[];
  subcellular: string[];
  keywords: KeywordDTO[];
  domainFeatures: DomainFeature[];
  goTerms: GoTermDTO[];
  pdbIds: string[];
  xrefs: XrefLinkDTO[];
  sequence: string;
  firstPublicDate: string;
  lastAnnotationUpdateDate: string;
  lastSequenceUpdateDate: string;
  entryVersion: number;
  sequenceVersion: number;
} {
  const pd = entry.proteinDescription ?? {};
  const altNames = (pd.alternativeNames ?? [])
    .map((a) => a.fullName?.value ?? "")
    .filter(Boolean)
    .slice(0, 4);
  const gene = entry.genes?.[0];
  const geneSynonyms = (gene?.synonyms ?? []).map((s) => s.value ?? "").filter(Boolean).slice(0, 6);

  const subloc = (entry.comments ?? []).filter((c) => c.commentType === "SUBCELLULAR LOCATION");
  const subcellular: string[] = [];
  for (const c of subloc) {
    for (const l of c.locations ?? []) {
      const v = l.location?.value;
      if (v) subcellular.push(v);
    }
  }
  // 去重
  const subcellSet = [...new Set(subcellular)].slice(0, 10);

  const keywords: KeywordDTO[] = (entry.keywords ?? [])
    .filter((k) => k.name)
    .map((k) => ({
      id: k.id ?? "",
      name: k.name!,
      category: k.category ?? "",
    }))
    .slice(0, 48);

  // 序列特征（按优先级排序，cap 60）
  const feats = (entry.features ?? []).filter((f) => f.type && FEATURE_SET.has(f.type) && (f.location?.start?.value ?? 0) > 0);
  feats.sort((a, b) => FEATURE_PRIORITY.indexOf(a.type!) - FEATURE_PRIORITY.indexOf(b.type!));
  const domainFeatures: DomainFeature[] = feats
    .map((f) => ({
      type: f.type ?? "",
      description: f.description ?? "",
      start: f.location?.start?.value ?? 0,
      end: f.location?.end?.value ?? f.location?.start?.value ?? 0,
    }))
    .slice(0, 60);

  const goTerms: GoTermDTO[] = (entry.uniProtKBCrossReferences ?? [])
    .filter((x) => x.database === "GO")
    .map((x) => {
      const gt = (x.properties ?? []).find((p) => p.key === "GoTerm")?.value ?? "";
      const aspectMatch = gt.match(/^([PFC]):(.+)$/);
      return {
        id: x.id ?? "",
        name: aspectMatch ? aspectMatch[2] : gt,
        aspect: (aspectMatch ? aspectMatch[1] : "P") as "P" | "F" | "C",
      };
    })
    .slice(0, 60);

  const pdbIds = (entry.uniProtKBCrossReferences ?? [])
    .filter((x) => x.database === "PDB" && x.id)
    .map((x) => x.id!)
    .slice(0, 30);

  // 疾病关联（DISEASE 注释，含 MIM 交叉引用）
  const diseases: { name: string; acronym: string; description: string; mimId: string }[] = [];
  for (const c of (entry.comments ?? []).filter((x) => x.commentType === "DISEASE")) {
    const d = c.disease;
    if (!d?.diseaseId) continue;
    diseases.push({
      name: d.diseaseId,
      acronym: d.acronym ?? "",
      description: (d.description ?? "").slice(0, 600),
      mimId: d.diseaseCrossReference?.database === "MIM" ? (d.diseaseCrossReference.id ?? "") : "",
    });
  }

  // 异构体（可变剪接等）
  const altComment = (entry.comments ?? []).find((x) => x.commentType === "ALTERNATIVE PRODUCTS");
  const isoforms: IsoformDTO[] = (altComment?.isoforms ?? [])
    .map((iso) => ({
      name: iso.name?.value ?? "",
      synonyms: (iso.synonyms ?? []).map((s) => s.value ?? "").filter(Boolean).slice(0, 4),
      ids: iso.isoformIds ?? [],
      status: iso.isoformSequenceStatus ?? "",
    }))
    .filter((iso) => iso.name || iso.ids.length > 0)
    .slice(0, 12);

  // 分子互作（取自身之外的互作对象）
  const interactions: { accession: string; geneName: string; experiments: number }[] = [];
  for (const c of (entry.comments ?? []).filter((x) => x.commentType === "INTERACTION")) {
    for (const it of c.interactions ?? []) {
      const one = it.interactantOne?.uniProtKBAccession ?? "";
      const two = it.interactantTwo?.uniProtKBAccession ?? "";
      if (!one || !two) continue;
      const other = one === entry.primaryAccession ? it.interactantTwo : it.interactantOne;
      if (!other?.uniProtKBAccession || other.uniProtKBAccession === entry.primaryAccession) continue;
      interactions.push({
        accession: other.uniProtKBAccession,
        geneName: other.geneName ?? "",
        experiments: it.numberOfExperiments ?? 0,
      });
    }
  }
  // 按登录号去重（保留最大实验数），按实验数降序，cap 40
  const byAcc = new Map<string, { accession: string; geneName: string; experiments: number }>();
  for (const it of interactions) {
    const prev = byAcc.get(it.accession);
    if (!prev || prev.experiments < it.experiments) byAcc.set(it.accession, it);
  }
  const interactionsSorted = [...byAcc.values()].sort((a, b) => b.experiments - a.experiments).slice(0, 40);

  // 辅因子
  const cofactors = (entry.comments ?? [])
    .filter((x) => x.commentType === "COFACTOR")
    .flatMap((x) => (x.cofactors ?? []).map((cf) => cf.name ?? "").filter(Boolean))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 8);

  const catalytic = (entry.comments ?? [])
    .filter((c) => c.commentType === "CATALYTIC ACTIVITY")
    .map((c) => {
      // reaction 为单对象（主流）或数组（兼容防御）
      const r = c.reaction;
      if (!r) return "";
      if (Array.isArray(r)) return r.map((x) => x.name ?? "").join("; ");
      return r.name ?? "";
    })
    .filter(Boolean)
    .join("\n");

  // 精选交叉引用链接
  const xrefCount = new Map<string, number>();
  const xrefs: XrefLinkDTO[] = [];
  for (const x of entry.uniProtKBCrossReferences ?? []) {
    const def = XREF_DEFS[x.database ?? ""];
    const id = x.id ?? "";
    if (!def || !id) continue;
    const used = xrefCount.get(x.database!) ?? 0;
    if (used >= def.max) continue;
    xrefCount.set(x.database!, used + 1);
    const note = def.note ? def.note(x.properties ?? []) : "";
    xrefs.push({ db: def.label, group: XREF_GROUPS[def.group], id, url: def.url(id, entry.primaryAccession), note });
  }

  return {
    entryType: entry.entryType ?? "",
    proteinExistence: entry.proteinExistence ?? "",
    annotationScore: entry.annotationScore ?? 0,
    altNames,
    geneSynonyms,
    functionText: commentText(entry, "FUNCTION"),
    catalyticActivity: catalytic.slice(0, 1500),
    activityRegulation: commentText(entry, "ACTIVITY REGULATION", 2500),
    cofactors,
    subunit: commentText(entry, "SUBUNIT", 2500),
    tissueSpecificity: commentText(entry, "TISSUE SPECIFICITY", 2500),
    developmentalStage: commentText(entry, "DEVELOPMENTAL STAGE", 2500),
    induction: commentText(entry, "INDUCTION", 1500),
    domainComment: commentText(entry, "DOMAIN", 2500),
    ptm: commentText(entry, "PTM", 4000),
    similarity: commentText(entry, "SIMILARITY", 1500),
    caution: commentText(entry, "CAUTION", 1200),
    miscellaneous: commentText(entry, "MISCELLANEOUS", 2000),
    diseases: diseases.slice(0, 12),
    isoforms,
    interactions: interactionsSorted,
    subcellular: subcellSet,
    keywords,
    domainFeatures,
    goTerms,
    pdbIds,
    xrefs,
    sequence: entry.sequence?.value ?? "",
    firstPublicDate: entry.entryAudit?.firstPublicDate ?? "",
    lastAnnotationUpdateDate: entry.entryAudit?.lastAnnotationUpdateDate ?? "",
    lastSequenceUpdateDate: entry.entryAudit?.lastSequenceUpdateDate ?? "",
    entryVersion: entry.entryAudit?.entryVersion ?? 0,
    sequenceVersion: entry.entryAudit?.sequenceVersion ?? 0,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ accession: string }> }) {
  const { accession } = await params;
  const acc = accession.toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(acc)) {
    return NextResponse.json({ error: "无效的 UniProt 登录号" }, { status: 400 });
  }

  const protein = await db.protein.findUnique({
    where: { accession: acc },
    include: {
      organism: true,
      family: true,
      group: true,
    },
  });
  if (!protein) {
    return NextResponse.json({ error: `未在 10 个模式生物全量蛋白组中找到 ${acc}` }, { status: 404 });
  }

  const familyCode = protein.family.code;
  const classCode = familyCode.split(".")[0];

  // 直系同源组成员（同 OrthoDB 组，跨物种）
  const orthologsRaw = protein.groupId
    ? await db.protein.findMany({
        where: { groupId: protein.groupId, NOT: { accession: acc } },
        include: { organism: { select: { commonName: true, scientificName: true, taxonId: true } } },
        orderBy: [{ organism: { orderRank: "asc" } }, { length: "asc" }],
        take: 40,
      })
    : [];
  const orthologs: OrthologBrief[] = orthologsRaw.map((o) => ({
    accession: o.accession,
    entryName: o.entryName,
    geneName: o.geneName ?? "",
    proteinName: o.proteinName,
    organismCommon: o.organism.commonName,
    organismScientific: o.organism.scientificName,
    taxonId: o.organism.taxonId,
    length: o.length,
    massKda: o.massKda,
  }));

  // UniProt 详情：优先读缓存，未命中实时抓取并缓存
  let live: ReturnType<typeof extractDetail> | null = null;
  let source: "cache" | "live" = "cache";
  const cached = await db.proteinDetail.findUnique({ where: { accession: acc } });
  if (cached) {
    try {
      live = JSON.parse(cached.json);
    } catch {
      live = null;
    }
  }
  if (!live) {
    try {
      const res = await fetch(`https://rest.uniprot.org/uniprotkb/${acc}.json`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const entry = (await res.json()) as UniEntry;
        live = extractDetail(entry);
        await db.proteinDetail.upsert({
          where: { accession: acc },
          update: { json: JSON.stringify(live), fetchedAt: new Date() },
          create: { accession: acc, json: JSON.stringify(live) },
        });
        source = "live";
      } else {
        console.error(`[detail] UniProt HTTP ${res.status} for ${acc}`);
      }
    } catch (e) {
      console.error(`[detail] UniProt 抓取失败 ${acc}:`, e);
    }
  }

  // 互作对象标注是否在本库（10 物种全量蛋白组）中，可点击跳转详情
  let interactions: InteractionDTO[] = (live?.interactions ?? []) as InteractionDTO[];
  if (interactions.length > 0) {
    const accs = interactions.map((i) => i.accession);
    const found = await db.protein.findMany({ where: { accession: { in: accs } }, select: { accession: true } });
    const foundSet = new Set(found.map((f) => f.accession));
    interactions = interactions.map((i) => ({ ...i, inDb: foundSet.has(i.accession) }));
  }

  const sequence = live?.sequence || protein.sequence || "";
  const familyRow = await db.family.findUnique({ where: { code: classCode } });

  // 完整层级链：大类 → 超家族 → 家族 → 亚家族
  const segs = familyCode.split(".");
  const chainCodes: string[] = [];
  for (let i = 1; i <= segs.length; i++) chainCodes.push(segs.slice(0, i).join("."));
  const chainRows = await db.family.findMany({ where: { code: { in: chainCodes } } });
  const familyChain = chainCodes
    .map((c) => chainRows.find((r) => r.code === c))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ code: r.code, name: r.name, nameEn: r.nameEn }));

  const dto: ProteinDetailDTO = {
    accession: protein.accession,
    entryName: protein.entryName,
    entryType: live?.entryType || "UniProtKB reviewed (Swiss-Prot)",
    proteinName: protein.proteinName,
    proteinExistence: live?.proteinExistence ?? "",
    annotationScore: live?.annotationScore ?? 0,
    altNames: live?.altNames ?? [],
    geneName: protein.geneName ?? "",
    geneSynonyms: live?.geneSynonyms ?? [],
    organismCommon: protein.organism.commonName,
    organismScientific: protein.organism.scientificName,
    taxonId: protein.organism.taxonId,
    familyCode,
    familyName: protein.family.name,
    familyNameEn: protein.family.nameEn,
    familyChain,
    className: familyRow?.name ?? "",
    classNameEn: familyRow?.nameEn ?? "",
    orthodb: protein.orthodb ?? "",
    eggnog: protein.eggnog ?? "",
    groupName: protein.group?.name ?? "",
    crossSpeciesGroup: protein.group?.crossSpecies ?? false,
    length: protein.length,
    massKda: protein.massKda,
    functionText: live?.functionText ?? "",
    catalyticActivity: live?.catalyticActivity ?? "",
    activityRegulation: live?.activityRegulation ?? "",
    cofactors: live?.cofactors ?? [],
    subunit: live?.subunit ?? "",
    tissueSpecificity: live?.tissueSpecificity ?? "",
    developmentalStage: live?.developmentalStage ?? "",
    induction: live?.induction ?? "",
    domainComment: live?.domainComment ?? "",
    ptm: live?.ptm ?? "",
    similarity: live?.similarity ?? "",
    caution: live?.caution ?? "",
    miscellaneous: live?.miscellaneous ?? "",
    diseases: live?.diseases ?? [],
    isoforms: live?.isoforms ?? [],
    interactions,
    subcellular: live?.subcellular ?? [],
    keywords: live?.keywords ?? [],
    domains: protein.domains ? protein.domains.split(";").map((s) => s.trim()).filter(Boolean) : [],
    domainFeatures: live?.domainFeatures ?? [],
    goTerms: live?.goTerms ?? [],
    pdbCount: live?.pdbIds.length ?? 0,
    pdbIds: live?.pdbIds ?? [],
    ecNumbers: protein.ec ? protein.ec.split(";").filter(Boolean) : [],
    xrefs: live?.xrefs ?? [],
    sequence,
    firstPublicDate: live?.firstPublicDate ?? "",
    lastAnnotationUpdateDate: live?.lastAnnotationUpdateDate ?? "",
    lastSequenceUpdateDate: live?.lastSequenceUpdateDate ?? "",
    entryVersion: live?.entryVersion ?? 0,
    sequenceVersion: live?.sequenceVersion ?? 0,
    aaComposition: computeComposition(sequence),
    orthologs,
    source,
  };

  return NextResponse.json(dto);
}
