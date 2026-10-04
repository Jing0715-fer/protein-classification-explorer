import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { BootstrapDTO, FamilyNodeDTO, OrganismDTO, ProteinLite } from "@/lib/protein-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [organisms, families, proteins] = await Promise.all([
    db.organism.findMany({ orderBy: { orderRank: "asc" }, include: { _count: { select: { proteins: true } } } }),
    db.family.findMany({ orderBy: { code: "asc" } }),
    db.protein.findMany({
      select: {
        accession: true,
        entryName: true,
        geneName: true,
        proteinName: true,
        organism: { select: { taxonId: true } },
        family: { select: { code: true } },
        orthologGroup: true,
        length: true,
        massKda: true,
        reviewed: true,
        isRepresentative: true,
        pdbCount: true,
      },
    }),
  ]);

  const orgDTOs: OrganismDTO[] = organisms.map((o) => ({
    id: o.id,
    taxonId: o.taxonId,
    scientificName: o.scientificName,
    commonName: o.commonName,
    phyloPath: o.phyloPath,
    orderRank: o.orderRank,
    proteinCount: o._count.proteins,
  }));

  const proteinDTOs: ProteinLite[] = proteins.map((p) => ({
    accession: p.accession,
    entryName: p.entryName,
    geneName: p.geneName ?? "",
    proteinName: p.proteinName,
    taxonId: p.organism.taxonId,
    familyCode: p.family.code,
    group: p.orthologGroup,
    length: p.length,
    massKda: p.massKda,
    reviewed: p.reviewed,
    rep: p.isRepresentative,
    pdbCount: p.pdbCount,
  }));

  // 组装家族树（大类 -> 二级家族）
  const countByFamily = new Map<string, number>();
  for (const p of proteinDTOs) countByFamily.set(p.familyCode, (countByFamily.get(p.familyCode) ?? 0) + 1);

  const famMap = new Map<string, FamilyNodeDTO>();
  for (const f of families) {
    famMap.set(f.code, {
      code: f.code,
      name: f.name,
      nameEn: f.nameEn,
      description: f.description ?? "",
      count: countByFamily.get(f.code) ?? 0,
      totalCount: 0,
      children: [],
    });
  }
  const roots: FamilyNodeDTO[] = [];
  for (const f of families) {
    const node = famMap.get(f.code)!;
    if (f.code.includes(".")) {
      const parentCode = f.code.split(".")[0];
      const parent = famMap.get(parentCode);
      if (parent) {
        parent.children!.push(node);
        continue;
      }
    }
    roots.push(node);
  }
  for (const node of roots) {
    node.totalCount = node.count + node.children!.reduce((s, c) => s + c.count, 0);
    node.children!.sort((a, b) => Number(a.code.split(".")[1]) - Number(b.code.split(".")[1]));
  }
  roots.sort((a, b) => Number(a.code) - Number(b.code));

  const groups = new Set(proteinDTOs.map((p) => p.group));
  const groupTaxa = new Map<string, Set<number>>();
  for (const p of proteinDTOs) {
    if (!groupTaxa.has(p.group)) groupTaxa.set(p.group, new Set());
    groupTaxa.get(p.group)!.add(p.taxonId);
  }
  let multiGroups = 0;
  for (const taxa of groupTaxa.values()) if (taxa.size >= 2) multiGroups++;

  const dto: BootstrapDTO = {
    organisms: orgDTOs,
    families: roots,
    proteins: proteinDTOs,
    stats: {
      totalProteins: proteinDTOs.length,
      reviewed: proteinDTOs.filter((p) => p.reviewed).length,
      classCount: roots.length,
      familyCount: families.filter((f) => f.code.includes(".")).length,
      groupCount: groups.size,
      multiSpeciesGroups: multiGroups,
      organismCount: orgDTOs.length,
      avgLength: Math.round(proteinDTOs.reduce((s, p) => s + p.length, 0) / Math.max(proteinDTOs.length, 1)),
      avgMass: Math.round((proteinDTOs.reduce((s, p) => s + p.massKda, 0) / Math.max(proteinDTOs.length, 1)) * 10) / 10,
    },
  };

  return NextResponse.json(dto);
}
