import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeComposition } from "@/lib/composition";
import type { DomainFeature, GoTermDTO, KeywordDTO, OrthologBrief, ProteinDetailDTO } from "@/lib/protein-types";

export const dynamic = "force-dynamic";

/** UniProt REST API 原始 JSON 结构（局部） */
interface UniEntry {
  entryType?: string;
  primaryAccession: string;
  uniProtkbId?: string;
  entryAudit?: {
    firstPublicDate?: string;
    lastAnnotationUpdateDate?: string;
    entryVersion?: number;
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
    reaction?: { name?: string }[];
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

/** 从 UniProt 实时 JSON 提取详情 */
function extractDetail(entry: UniEntry): {
  entryType: string;
  altNames: string[];
  geneSynonyms: string[];
  functionText: string;
  catalyticActivity: string;
  subunit: string;
  tissueSpecificity: string;
  induction: string;
  ptm: string;
  similarity: string;
  subcellular: string[];
  keywords: KeywordDTO[];
  domainFeatures: DomainFeature[];
  goTerms: GoTermDTO[];
  pdbIds: string[];
  sequence: string;
  firstPublicDate: string;
  lastAnnotationUpdateDate: string;
  entryVersion: number;
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
  const subcellSet = [...new Set(subcellular)].slice(0, 8);

  const keywords: KeywordDTO[] = (entry.keywords ?? [])
    .filter((k) => k.name)
    .map((k) => ({
      id: k.id ?? "",
      name: k.name!,
      category: k.category ?? "",
    }))
    .slice(0, 40);

  const domainFeatures: DomainFeature[] = (entry.features ?? [])
    .filter((f) => ["Domain", "Region", "Repeat", "Zinc finger", "DNA-binding", "Nucleotide binding", "Motif", "Active site", "Binding site"].includes(f.type ?? ""))
    .map((f) => ({
      type: f.type ?? "",
      description: f.description ?? "",
      start: f.location?.start?.value ?? 0,
      end: f.location?.end?.value ?? 0,
    }))
    .filter((f) => f.end > 0)
    .slice(0, 30);

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
    .slice(0, 24);

  const pdbIds = (entry.uniProtKBCrossReferences ?? [])
    .filter((x) => x.database === "PDB" && x.id)
    .map((x) => x.id!)
    .slice(0, 30);

  const catalytic = (entry.comments ?? [])
    .filter((c) => c.commentType === "CATALYTIC ACTIVITY")
    .map((c) => (c.reaction ?? []).map((r) => r.name ?? "").join("; "))
    .filter(Boolean)
    .join("\n");

  return {
    entryType: entry.entryType ?? "",
    altNames,
    geneSynonyms,
    functionText: commentText(entry, "FUNCTION"),
    catalyticActivity: catalytic.slice(0, 1500),
    subunit: commentText(entry, "SUBUNIT", 2500),
    tissueSpecificity: commentText(entry, "TISSUE SPECIFICITY", 2500),
    induction: commentText(entry, "INDUCTION", 1500),
    ptm: commentText(entry, "PTM", 4000),
    similarity: commentText(entry, "SIMILARITY", 1500),
    subcellular: subcellSet,
    keywords,
    domainFeatures,
    goTerms,
    pdbIds,
    sequence: entry.sequence?.value ?? "",
    firstPublicDate: entry.entryAudit?.firstPublicDate ?? "",
    lastAnnotationUpdateDate: entry.entryAudit?.lastAnnotationUpdateDate ?? "",
    entryVersion: entry.entryAudit?.entryVersion ?? 0,
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
      }
    } catch {
      // UniProt 不可达时降级为库内字段
    }
  }

  const sequence = live?.sequence || protein.sequence || "";
  const familyRow = await db.family.findUnique({ where: { code: classCode } });

  const dto: ProteinDetailDTO = {
    accession: protein.accession,
    entryName: protein.entryName,
    entryType: live?.entryType || "UniProtKB reviewed (Swiss-Prot)",
    proteinName: protein.proteinName,
    altNames: live?.altNames ?? [],
    geneName: protein.geneName ?? "",
    geneSynonyms: live?.geneSynonyms ?? [],
    organismCommon: protein.organism.commonName,
    organismScientific: protein.organism.scientificName,
    taxonId: protein.organism.taxonId,
    familyCode,
    familyName: protein.family.name,
    familyNameEn: protein.family.nameEn,
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
    subunit: live?.subunit ?? "",
    tissueSpecificity: live?.tissueSpecificity ?? "",
    induction: live?.induction ?? "",
    ptm: live?.ptm ?? "",
    similarity: live?.similarity ?? "",
    subcellular: live?.subcellular ?? [],
    keywords: live?.keywords ?? [],
    domains: protein.domains ? protein.domains.split(";").map((s) => s.trim()).filter(Boolean) : [],
    domainFeatures: live?.domainFeatures ?? [],
    goTerms: live?.goTerms ?? [],
    pdbCount: live?.pdbIds.length ?? 0,
    pdbIds: live?.pdbIds ?? [],
    ecNumbers: protein.ec ? protein.ec.split(";").filter(Boolean) : [],
    sequence,
    firstPublicDate: live?.firstPublicDate ?? "",
    lastAnnotationUpdateDate: live?.lastAnnotationUpdateDate ?? "",
    entryVersion: live?.entryVersion ?? 0,
    aaComposition: computeComposition(sequence),
    orthologs,
    source,
  };

  return NextResponse.json(dto);
}
