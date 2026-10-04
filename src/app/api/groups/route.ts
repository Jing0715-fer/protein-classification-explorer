import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { GroupListDTO, GroupSummaryDTO } from "@/lib/protein-types";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * 直系同源组浏览（OrthoDB 聚合）
 * GET /api/groups?cross=1&family=3.5&minOrganisms=3&q=rho&page=1&pageSize=30
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const crossOnly = sp.get("cross") === "1";
  const family = sp.get("family")?.trim() || null;
  const minOrganisms = Math.max(1, Math.min(10, parseInt(sp.get("minOrganisms") ?? "1", 10) || 1));
  const q = sp.get("q")?.trim() || null;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(60, Math.max(10, parseInt(sp.get("pageSize") ?? "30", 10) || 30));

  const where: Prisma.OrthologGroupWhereInput = {
    organismCount: { gte: minOrganisms },
  };
  if (crossOnly) where.crossSpecies = true;
  if (family) {
    where.familyCode = family.includes(".")
      ? { equals: family }
      : { startsWith: `${family}.` };
  }
  if (q) {
    const term = q.replace(/[%_]/g, "");
    where.name = { contains: term };
  }

  const [total, rows] = await Promise.all([
    db.orthologGroup.count({ where }),
    db.orthologGroup.findMany({
      where,
      orderBy: [{ organismCount: "desc" }, { proteinCount: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const dto: GroupListDTO = {
    rows: rows.map((g) => ({
      id: g.id,
      name: g.name,
      proteinCount: g.proteinCount,
      organismCount: g.organismCount,
      organismIds: g.organismIds.split(",").map((s) => parseInt(s, 10)).filter(Boolean),
      crossSpecies: g.crossSpecies,
      familyCode: g.familyCode,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
  return NextResponse.json(dto);
}
