"use client";

import type { BootstrapDTO, CompareDTO, ProteinDetailDTO } from "@/lib/protein-types";

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
  562: "大肠杆菌",
  4932: "酵母",
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
  562: "#64748b",
  4932: "#a16207",
  3702: "#4d7c0f",
  6239: "#0d9488",
  7227: "#db2777",
  7955: "#0891b2",
  9031: "#ca8a04",
  10090: "#ea580c",
  10116: "#d97706",
  9606: "#be123c",
};
