import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { BootstrapDTO, FamilyNodeDTO, OrganismDTO } from "@/lib/protein-types";

export const dynamic = "force-dynamic";

/**
 * 引导数据：物种、家族树（含家族×物种计数）、全局统计
 * 不再返回全量蛋白列表（87k 条过多，蛋白列表走 /api/proteins 分页）
 */
export async function GET() {
  const [organisms, families, famOrgCounts, groupStats, seqAgg] = await Promise.all([
    db.organism.findMany({ orderBy: { orderRank: "asc" }, include: { _count: { select: { proteins: true } } } }),
    db.family.findMany({ orderBy: { code: "asc" } }),
    db.protein.groupBy({
      by: ["familyId", "organismId"],
      _count: { _all: true },
    }),
    db.orthologGroup.aggregate({
      _count: { _all: true },
      where: {},
    }),
    db.protein.aggregate({
      _avg: { length: true, massKda: true },
      _count: { _all: true },
    }),
  ]);

  const famById = new Map(families.map((f) => [f.id, f]));
  const orgById = new Map(organisms.map((o) => [o.id, o]));

  // familyId -> (organismTaxonId -> count)
  const famOrg = new Map<number, Map<number, number>>();
  for (const row of famOrgCounts) {
    if (!famOrg.has(row.familyId)) famOrg.set(row.familyId, new Map());
    const taxon = orgById.get(row.organismId)?.taxonId ?? 0;
    famOrg.get(row.familyId)!.set(taxon, (famOrg.get(row.familyId)!.get(taxon) ?? 0) + row._count._all);
  }

  const orgDTOs: OrganismDTO[] = organisms.map((o) => ({
    id: o.id,
    taxonId: o.taxonId,
    scientificName: o.scientificName,
    commonName: o.commonName,
    phyloPath: o.phyloPath,
    orderRank: o.orderRank,
    proteinCount: o._count.proteins,
  }));

  // 组装家族树（大类 -> 家族）
  const famMap = new Map<string, FamilyNodeDTO>();
  for (const f of families) {
    const byOrg = famOrg.get(f.id) ?? new Map();
    let count = 0;
    for (const n of byOrg.values()) count += n;
    famMap.set(f.code, {
      code: f.code,
      name: f.name,
      nameEn: f.nameEn,
      description: f.description ?? "",
      count,
      totalCount: 0,
      byOrganism: Object.fromEntries(byOrg),
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

  // 统计
  const [crossGroups, ecCount, odbCount, unclassified] = await Promise.all([
    db.orthologGroup.count({ where: { crossSpecies: true } }),
    db.protein.count({ where: { NOT: [{ ec: null }, { ec: "" }] } }),
    db.protein.count({ where: { NOT: [{ orthodb: null }, { orthodb: "" }] } }),
    db.protein.count({ where: { family: { code: "13.2" } } }),
  ]);

  const totalProteins = seqAgg._count._all;
  const dto: BootstrapDTO = {
    organisms: orgDTOs,
    families: roots,
    stats: {
      totalProteins,
      classCount: roots.length,
      familyCount: families.filter((f) => f.code.includes(".")).length,
      organismCount: orgDTOs.length,
      orthologGroups: groupStats._count._all,
      crossSpeciesGroups: crossGroups,
      ecAnnotated: ecCount,
      orthodbCovered: odbCount,
      avgLength: Math.round(seqAgg._avg.length ?? 0),
      avgMass: Math.round((seqAgg._avg.massKda ?? 0) * 10) / 10,
      classifiedPct: Math.round(((totalProteins - unclassified) / Math.max(1, totalProteins)) * 1000) / 10,
      dataDate: "2026-10",
    },
  };

  return NextResponse.json(dto);
}
