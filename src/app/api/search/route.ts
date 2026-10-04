import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SearchResultDTO } from "@/lib/protein-types";

export const dynamic = "force-dynamic";

/**
 * 全局搜索（⌘K）：蛋白（名称/基因/登录号）+ 家族 + 物种
 * GET /api/search?q=p53
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    const dto: SearchResultDTO = { proteins: [], families: [], organisms: [] };
    return NextResponse.json(dto);
  }
  const term = q.replace(/[%_]/g, "");
  const lower = term.toLowerCase();

  const [proteins, families, organisms] = await Promise.all([
    db.protein.findMany({
      where: {
        OR: [
          { accession: { equals: term.toUpperCase() } },
          { accession: { contains: term.toUpperCase() } },
          { entryName: { contains: term.toUpperCase() } },
          { geneName: { contains: term } },
          { proteinName: { contains: term } },
        ],
      },
      orderBy: [{ accession: "asc" }],
      take: 25,
      include: {
        organism: { select: { taxonId: true } },
        family: { select: { code: true } },
      },
    }),
    db.family.findMany({
      where: {
        OR: [{ name: { contains: term } }, { nameEn: { contains: term } }],
      },
      take: 8,
    }),
    db.organism.findMany({
      where: {
        OR: [{ commonName: { contains: term } }, { scientificName: { contains: term } }],
      },
      include: { _count: { select: { proteins: true } } },
    }),
  ]);

  // 排序：登录号精确 > 登录号前缀 > 基因精确 > 其他
  const scored = proteins.map((p) => {
    let score = 0;
    if (p.accession === term.toUpperCase()) score = 100;
    else if (p.accession.startsWith(term.toUpperCase())) score = 90;
    else if ((p.geneName ?? "").toLowerCase() === lower) score = 80;
    else if ((p.geneName ?? "").toLowerCase().startsWith(lower)) score = 70;
    else if (p.entryName.toUpperCase().startsWith(term.toUpperCase())) score = 60;
    else score = 30;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || a.p.accession.localeCompare(b.p.accession));

  const dto: SearchResultDTO = {
    proteins: scored.slice(0, 20).map(({ p }) => ({
      accession: p.accession,
      entryName: p.entryName,
      geneName: p.geneName ?? "",
      proteinName: p.proteinName,
      taxonId: p.organism.taxonId,
      familyCode: p.family.code,
      orthodb: p.orthodb ?? "",
      length: p.length,
      massKda: p.massKda,
      hasEC: !!p.ec,
      familyName: "",
    })),
    families: families.map((f) => ({
      code: f.code,
      name: f.name,
      nameEn: f.nameEn,
      count: 0,
    })),
    organisms: organisms.map((o) => ({
      taxonId: o.taxonId,
      commonName: o.commonName,
      proteinCount: o._count.proteins,
    })),
  };
  return NextResponse.json(dto);
}
