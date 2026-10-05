import { NextResponse } from "next/server";
import { gzipSync } from "node:zlib";
import { db } from "@/lib/db";
import type { BootstrapDTO, FamilyNodeDTO, OrganismDTO } from "@/lib/protein-types";

export const dynamic = "force-dynamic";

/**
 * 引导数据：物种、家族层级树（大类 → 超家族 → 家族 → 亚家族，UniProt 官方链）、全局统计
 * 不返回全量蛋白列表（蛋白列表走 /api/proteins 分页）
 */

/** 按编码数字段比较（"5.10" > "5.2"） */
function compareCode(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.min(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    if (pa[i] !== pb[i]) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return pa.length - pb.length;
}

/** parentCode: "5.2.1" -> "5.2"；"5" -> null（大类） */
function parentOf(code: string): string | null {
  const i = code.lastIndexOf(".");
  return i < 0 ? null : code.slice(0, i);
}

// 静态数据内存缓存（数据库重跑 seed 后需重启 dev server 生效）
let cachedGz: Uint8Array | null = null;

function gzResponse(gz: Uint8Array): NextResponse {
  return new NextResponse(gz as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "Content-Length": String(gz.length),
    },
  });
}

export async function GET() {
  if (cachedGz) return gzResponse(cachedGz);
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

  // familyId -> (taxonId -> count)
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

  // 1) 全部节点（直接计数）——载荷优化：description 不传（前端按路径拼），nameEn 仅在与 name 不同时传
  const nodeMap = new Map<string, FamilyNodeDTO & { _children: (FamilyNodeDTO & { _children: unknown[] })[] }>();
  for (const f of families) {
    const byOrg = famOrg.get(f.id) ?? new Map();
    let count = 0;
    for (const n of byOrg.values()) count += n;
    const name = f.name || f.nameEn;
    nodeMap.set(f.code, {
      code: f.code,
      name,
      nameEn: f.nameEn && f.nameEn !== name ? f.nameEn : "",
      description: "",
      kind: f.kind && f.kind.length > 0 ? f.kind : "",
      count,
      totalCount: 0,
      byOrganism: Object.fromEntries(byOrg),
      children: [],
      _children: [],
    });
  }

  // 2) 组树：parent = 去掉最后一段
  const roots: FamilyNodeDTO[] = [];
  for (const f of families) {
    const node = nodeMap.get(f.code)!;
    const pCode = parentOf(f.code);
    if (pCode) {
      const parent = nodeMap.get(pCode);
      if (parent) {
        (parent.children as (FamilyNodeDTO & { _children: unknown[] })[]).push(node);
        continue;
      }
    }
    roots.push(node);
  }

  // 3) 递归聚合 totalCount / byOrganism（自底向上：先深后浅——树很深，用递归函数）
  const aggregate = (node: FamilyNodeDTO & { _children: unknown[] }): { total: number; byOrg: Record<number, number> } => {
    let total = node.count;
    const byOrg: Record<number, number> = { ...node.byOrganism };
    for (const child of node.children as (FamilyNodeDTO & { _children: unknown[] })[]) {
      const r = aggregate(child);
      total += r.total;
      for (const [t, n] of Object.entries(r.byOrg)) {
        byOrg[Number(t)] = (byOrg[Number(t)] ?? 0) + n;
      }
    }
    node.totalCount = total;
    node.byOrganism = byOrg;
    return { total, byOrg };
  };
  for (const r of roots) {
    const node = r as FamilyNodeDTO & { _children: unknown[] };
    aggregate(node);
    // 4) 子节点按 totalCount 降序（编码即按数量分配，此处再按实际数量稳定排序）
    const sortChildren = (n: FamilyNodeDTO) => {
      (n.children ?? []).sort((a, b) => b.totalCount - a.totalCount || compareCode(a.code, b.code));
      for (const c of n.children ?? []) sortChildren(c);
    };
    sortChildren(node);
  }
  roots.sort((a, b) => compareCode(a.code, b.code));

  // 清理内部字段
  const clean = (n: FamilyNodeDTO) => {
    delete (n as { _children?: unknown[] })._children;
    for (const c of n.children ?? []) clean(c);
  };
  for (const r of roots) clean(r);

  // 统计
  const unclassifiedFam = await db.family.findFirst({ where: { name: "未分类蛋白" } });
  const [crossGroups, ecCount, odbCount, unclassified] = await Promise.all([
    db.orthologGroup.count({ where: { crossSpecies: true } }),
    db.protein.count({ where: { NOT: [{ ec: null }, { ec: "" }] } }),
    db.protein.count({ where: { NOT: [{ orthodb: null }, { orthodb: "" }] } }),
    unclassifiedFam
      ? db.protein.count({ where: { family: { code: unclassifiedFam.code } } })
      : Promise.resolve(0),
  ]);

  const totalProteins = seqAgg._count._all;
  // 层级统计：大类 → 亚类 → 超群/超家族 → 家族 → 亚家族
  // 超家族 = 有子级的层级节点（超群/超家族/分支，排除大类与亚类）；家族 = 末端叶子节点
  const isLeaf = (code: string) => !families.some((x) => parentOf(x.code) === code);
  const superfamilyCount = families.filter((f) => {
    const segs = f.code.split(".").length;
    if (segs < 3) return false; // 大类/亚类不计
    return !isLeaf(f.code);
  }).length;
  const familyCount = families.filter((f) => {
    const segs = f.code.split(".").length;
    if (segs < 3) return false;
    return isLeaf(f.code);
  }).length;
  const subclassCount = families.filter((f) => f.kind === "subclass").length;

  const dto: BootstrapDTO = {
    organisms: orgDTOs,
    families: roots,
    stats: {
      totalProteins,
      classCount: roots.length,
      subclassCount,
      superfamilyCount,
      familyCount,
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

  // gzip 压缩（全层级树 JSON 1.8MB+，压缩后 ~150KB）+ 内存缓存
  cachedGz = new Uint8Array(gzipSync(JSON.stringify(dto), { level: 4 }));
  return gzResponse(cachedGz);
}
