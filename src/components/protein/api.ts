"use client";

import type {
  BootstrapDTO,
  CompareDTO,
  FamilyNodeDTO,
  GroupListDTO,
  ProteinDetailDTO,
  ProteinListDTO,
  SearchResultDTO,
} from "@/lib/protein-types";

/** 递归展平家族树（大类→超家族→家族→亚家族）→ code -> node */
export function flattenFamilies(nodes: FamilyNodeDTO[]): Map<string, FamilyNodeDTO> {
  const m = new Map<string, FamilyNodeDTO>();
  const walk = (list: FamilyNodeDTO[]) => {
    for (const n of list) {
      m.set(n.code, n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return m;
}

/** 找从根到指定 code 的路径链（面包屑用） */
export function findFamilyPath(nodes: FamilyNodeDTO[], code: string): FamilyNodeDTO[] | null {
  for (const n of nodes) {
    if (n.code === code) return [n];
    if (n.children?.length) {
      const sub = findFamilyPath(n.children, code);
      if (sub) return [n, ...sub];
    }
  }
  return null;
}

let bootstrapCache: BootstrapDTO | null = null;
let bootstrapPromise: Promise<BootstrapDTO> | null = null;

export function fetchBootstrap(): Promise<BootstrapDTO> {
  if (bootstrapCache) return Promise.resolve(bootstrapCache);
  if (!bootstrapPromise) {
    bootstrapPromise = fetch("/api/bootstrap")
      .then((r) => {
        if (!r.ok) throw new Error("加载基础数据失败");
        return r.json();
      })
      .then((d: BootstrapDTO) => {
        bootstrapCache = d;
        return d;
      });
  }
  return bootstrapPromise;
}

export interface ProteinListQuery {
  family?: string | null;
  taxon?: number | null;
  q?: string;
  group?: string | null;
  page?: number;
  pageSize?: number;
  sort?: "default" | "length" | "mass" | "accession" | "name" | "gene";
  dir?: "asc" | "desc";
}

export async function fetchProteinList(query: ProteinListQuery): Promise<ProteinListDTO> {
  const sp = new URLSearchParams();
  if (query.family) sp.set("family", query.family);
  if (query.taxon) sp.set("taxon", String(query.taxon));
  if (query.q) sp.set("q", query.q);
  if (query.group) sp.set("group", query.group);
  sp.set("page", String(query.page ?? 1));
  sp.set("pageSize", String(query.pageSize ?? 50));
  if (query.sort && query.sort !== "default") sp.set("sort", query.sort);
  if (query.dir) sp.set("dir", query.dir);
  const r = await fetch(`/api/proteins?${sp.toString()}`);
  if (!r.ok) throw new Error("加载蛋白列表失败");
  return r.json();
}

export interface GroupListQuery {
  cross?: boolean;
  family?: string | null;
  minOrganisms?: number;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchGroups(query: GroupListQuery): Promise<GroupListDTO> {
  const sp = new URLSearchParams();
  if (query.cross) sp.set("cross", "1");
  if (query.family) sp.set("family", query.family);
  sp.set("minOrganisms", String(query.minOrganisms ?? 1));
  if (query.q) sp.set("q", query.q);
  sp.set("page", String(query.page ?? 1));
  sp.set("pageSize", String(query.pageSize ?? 30));
  const r = await fetch(`/api/groups?${sp.toString()}`);
  if (!r.ok) throw new Error("加载直系同源组失败");
  return r.json();
}

export async function searchAll(q: string): Promise<SearchResultDTO> {
  const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("搜索失败");
  return r.json();
}

const detailCache = new Map<string, ProteinDetailDTO>();

export async function fetchDetail(acc: string): Promise<ProteinDetailDTO> {
  const key = acc.toUpperCase();
  if (detailCache.has(key)) return detailCache.get(key)!;
  const r = await fetch(`/api/proteins/${key}`);
  if (!r.ok) throw new Error("加载蛋白详情失败");
  const d: ProteinDetailDTO = await r.json();
  detailCache.set(key, d);
  return d;
}

export async function fetchCompare(ids: string[]): Promise<CompareDTO> {
  const r = await fetch(`/api/compare?ids=${encodeURIComponent(ids.join(","))}`);
  if (!r.ok) throw new Error("加载比较数据失败");
  return r.json();
}

/** 物种简称（矩阵/图表用） */
export const ORG_SHORT: Record<number, string> = {
  83333: "大肠杆菌",
  559292: "酵母",
  3702: "拟南芥",
  6239: "线虫",
  7227: "果蝇",
  7955: "斑马鱼",
  9031: "家鸡",
  10090: "小鼠",
  10116: "大鼠",
  9606: "人",
};

/** 物种图表配色（按进化顺序） */
export const ORG_COLORS: Record<number, string> = {
  83333: "#64748b",
  559292: "#a16207",
  3702: "#4d7c0f",
  6239: "#0d9488",
  7227: "#db2777",
  7955: "#0891b2",
  9031: "#ca8a04",
  10090: "#ea580c",
  10116: "#d97706",
  9606: "#be123c",
};
