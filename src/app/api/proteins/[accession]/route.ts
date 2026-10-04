import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeComposition } from "@/lib/composition";
import type { OrthologBrief, ProteinDetailDTO } from "@/lib/protein-types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ accession: string }> }) {
  const { accession } = await params;
  const acc = accession.toUpperCase();

  const protein = await db.protein.findUnique({
    where: { accession: acc },
    include: {
      organism: true,
      family: true,
    },
  });
  if (!protein) {
    return NextResponse.json({ error: "未找到该蛋白条目" }, { status: 404 });
  }

  const orthologsRaw = await db.protein.findMany({
    where: { orthologGroup: protein.orthologGroup, NOT: { accession: acc } },
    include: { organism: { select: { commonName: true, scientificName: true, taxonId: true } } },
    orderBy: [{ isRepresentative: "desc" }, { length: "asc" }],
  });

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
    rep: o.isRepresentative,
  }));

  const familyCode = protein.family.code;
  const className = familyCode.includes(".") ? familyCode.split(".")[0] : familyCode;

  const dto: ProteinDetailDTO = {
    accession: protein.accession,
    entryName: protein.entryName,
    reviewed: protein.reviewed,
    proteinName: protein.proteinName,
    altNames: protein.altNames ? protein.altNames.split(";").map((s) => s.trim()).filter(Boolean) : [],
    geneName: protein.geneName ?? "",
    geneSynonyms: protein.geneSynonyms ? protein.geneSynonyms.split(",").map((s) => s.trim()).filter(Boolean) : [],
    organismCommon: protein.organism.commonName,
    organismScientific: protein.organism.scientificName,
    taxonId: protein.organism.taxonId,
    familyCode,
    familyName: protein.family.name,
    familyNameEn: protein.family.nameEn,
    className,
    group: protein.orthologGroup,
    length: protein.length,
    massKda: protein.massKda,
    functionText: protein.functionText ?? "",
    subcellular: protein.subcellular ? protein.subcellular.split(";").map((s) => s.trim()).filter(Boolean) : [],
    ptm: protein.ptm ?? "",
    keywords: protein.keywords ? protein.keywords.split(";").map((s) => s.trim()).filter(Boolean) : [],
    domains: protein.domains ? protein.domains.split(";").map((s) => s.trim()).filter(Boolean) : [],
    pdbCount: protein.pdbCount,
    sequence: protein.sequence ?? "",
    isRepresentative: protein.isRepresentative,
    aaComposition: computeComposition(protein.sequence ?? ""),
    orthologs,
  };

  return NextResponse.json(dto);
}
