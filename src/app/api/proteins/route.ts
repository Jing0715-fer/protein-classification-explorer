import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ProteinLite, ProteinListDTO } from "@/lib/protein-types";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * 分页蛋白列表
 * GET /api/proteins?family=3.4&taxon=9606&q=kinase&group=5915660at2759&page=1&pageSize=50&sort=length&dir=desc
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const family = sp.get("family")?.trim() || null;
  const taxon = sp.get("taxon")?.trim() || null;
  const q = sp.get("q")?.trim() || null;
  const group = sp.get("group")?.trim() || null;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(sp.get("pageSize") ?? "50", 10) || 50));
  const sort = sp.get("sort") ?? "default";
  const dir = sp.get("dir") === "desc" ? "desc" : "asc";

  const where: Prisma.ProteinWhereInput = {};
  if (family) {
    where.family = family.includes(".")
      ? { code: family }
      : { code: { startsWith: `${family}.` } };
  }
  if (taxon) {
    const taxonId = parseInt(taxon, 10);
    if (!Number.isNaN(taxonId)) where.organism = { taxonId };
  }
  if (group) {
    where.orthodb = group;
  }
  if (q) {
    const term = q.replace(/[%_]/g, "");
    if (term.length > 0) {
      where.OR = [
        { accession: { contains: term } },
        { entryName: { contains: term } },
        { geneName: { contains: term } },
        { proteinName: { contains: term } },
      ];
    }
  }

  let orderBy: Prisma.ProteinOrderByWithRelationInput[] = [
    { family: { code: "asc" } },
    { length: "desc" },
  ];
  switch (sort) {
    case "length":
      orderBy = [{ length: dir }];
      break;
    case "mass":
      orderBy = [{ massKda: dir }];
      break;
    case "accession":
      orderBy = [{ accession: dir }];
      break;
    case "name":
      orderBy = [{ proteinName: dir }];
      break;
    case "gene":
      orderBy = [{ geneName: dir }, { accession: "asc" }];
      break;
    default:
      break;
  }

  const [total, rows] = await Promise.all([
    db.protein.count({ where }),
    db.protein.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        organism: { select: { taxonId: true } },
        family: { select: { code: true } },
      },
    }),
  ]);

  const lite: ProteinLite[] = rows.map((p) => ({
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
  }));

  const dto: ProteinListDTO = {
    rows: lite,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
  return NextResponse.json(dto);
}
