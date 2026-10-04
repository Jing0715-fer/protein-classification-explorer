import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeComposition, cosineSim, jaccard } from "@/lib/composition";
import type { CompareDTO, CompareProtein, PairSimilarity } from "@/lib/protein-types";

export const dynamic = "force-dynamic";

/**
 * 跨物种比较（≤12 个蛋白）
 * GET /api/compare?ids=P04637,P02545,...
 * 相似度 = 组成余弦 45% + 关键词 Jaccard 40% + 结构域 Jaccard 15%
 */
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]{6,10}$/.test(s))
    .slice(0, 12);
  if (ids.length === 0) {
    return NextResponse.json({ error: "请提供 1-12 个 UniProt 登录号（ids 参数）" }, { status: 400 });
  }

  const proteins = await db.protein.findMany({
    where: { accession: { in: ids } },
    include: { organism: { select: { commonName: true, taxonId: true } } },
  });
  if (proteins.length === 0) {
    return NextResponse.json({ error: "未找到任何蛋白条目" }, { status: 404 });
  }

  const items: CompareProtein[] = proteins.map((p) => ({
    accession: p.accession,
    entryName: p.entryName,
    geneName: p.geneName ?? "",
    proteinName: p.proteinName,
    organismCommon: p.organism.commonName,
    taxonId: p.organism.taxonId,
    length: p.length,
    massKda: p.massKda,
    domainCount: p.domains ? p.domains.split(";").filter((s) => s.trim()).length : 0,
    keywordCount: p.keywords ? p.keywords.split(";").filter((s) => s.trim()).length : 0,
    domains: p.domains ? p.domains.split(";").map((s) => s.trim()).filter(Boolean) : [],
    keywords: p.keywords ? p.keywords.split(";").map((s) => s.trim()).filter(Boolean) : [],
    aaComposition: computeComposition(p.sequence ?? ""),
    group: p.orthodb ?? "",
  }));

  // 按输入顺序排序
  items.sort((a, b) => ids.indexOf(a.accession) - ids.indexOf(b.accession));

  const compVec = new Map<string, number[]>();
  for (const it of items) compVec.set(it.accession, it.aaComposition.map((c) => c.pct));

  const pairs: PairSimilarity[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const composition = Math.round(cosineSim(compVec.get(a.accession)!, compVec.get(b.accession)!) * 1000) / 10;
      const keywords = Math.round(jaccard(a.keywords, b.keywords) * 1000) / 10;
      const domains = Math.round(jaccard(a.domains, b.domains) * 1000) / 10;
      const overall = Math.round((composition * 0.45 + keywords * 0.4 + domains * 0.15) * 10) / 10;
      pairs.push({ a: a.accession, b: b.accession, composition, keywords, domains, overall });
    }
  }

  const dto: CompareDTO = { proteins: items, pairs };
  return NextResponse.json(dto);
}
