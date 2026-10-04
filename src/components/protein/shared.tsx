"use client";

import type { ProteinLite } from "@/lib/protein-types";
import { useEffect, useState } from "react";

/** 防抖值 hook */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * 从组内蛋白中按物种去重挑选代表（每物种取长度最接近中位数的蛋白），上限 max 个。
 */
export function pickGroupRepresentatives(rows: ProteinLite[], max = 12): string[] {
  const byOrg = new Map<number, ProteinLite[]>();
  for (const p of rows) {
    if (!byOrg.has(p.taxonId)) byOrg.set(p.taxonId, []);
    byOrg.get(p.taxonId)!.push(p);
  }
  const picked: { acc: string; medianDist: number; order: number }[] = [];
  let order = 0;
  for (const list of byOrg.values()) {
    const lens = [...list].map((p) => p.length).sort((a, b) => a - b);
    const median = lens.length % 2 === 1 ? lens[(lens.length - 1) / 2] : (lens[lens.length / 2 - 1] + lens[lens.length / 2]) / 2;
    let best = list[0];
    let bestDist = Infinity;
    for (const p of list) {
      const d = Math.abs(p.length - median);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    picked.push({ acc: best.accession, medianDist: bestDist, order: order++ });
  }
  // 物种数不足时按中位数距离补齐（同物种次优代表）
  if (picked.length < max) {
    const rest: { acc: string; medianDist: number }[] = [];
    for (const list of byOrg.values()) {
      const lens = [...list].map((p) => p.length).sort((a, b) => a - b);
      const median = lens.length % 2 === 1 ? lens[(lens.length - 1) / 2] : (lens[lens.length / 2 - 1] + lens[lens.length / 2]) / 2;
      for (const p of list) {
        if (!picked.some((x) => x.acc === p.accession)) {
          rest.push({ acc: p.accession, medianDist: Math.abs(p.length - median) });
        }
      }
    }
    rest.sort((a, b) => a.medianDist - b.medianDist);
    for (const r of rest) {
      if (picked.length >= max) break;
      picked.push({ acc: r.acc, medianDist: r.medianDist, order: order++ });
    }
  }
  return picked.slice(0, max).sort((a, b) => a.order - b.order).map((x) => x.acc);
}

/** 相似度颜色映射：≥80 深绿 / 60-80 绿 / 40-60 黄 / <40 灰 */
export function similarityColor(v: number): string {
  if (v >= 80) return "#065f46";
  if (v >= 60) return "#059669";
  if (v >= 40) return "#eab308";
  return "#9ca3af";
}

/** 相似度单元格文字颜色（深色背景用白字） */
export function similarityTextColor(v: number): string {
  return v >= 60 ? "#ffffff" : v >= 40 ? "#422006" : "#1f2937";
}

/** log 强度（热图单元格透明度 0-1） */
export function logIntensity(n: number, max: number): number {
  if (n <= 0) return 0;
  if (max <= 1) return 0.9;
  const ratio = Math.log10(1 + n) / Math.log10(1 + max);
  return 0.14 + 0.8 * Math.min(1, Math.max(0, ratio));
}

/** 长文本折叠阈值 */
export const LONG_TEXT_MAX = 420;
