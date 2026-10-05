"use client";

import type { BootstrapStats } from "@/lib/protein-types";

/** 期刊式统计条：大数字 + overline 标签，细竖线分隔（无卡片、无图标） */
export function StatsBar({ stats }: { stats: BootstrapStats }) {
  const items: { label: string; value: string; sub: string }[] = [
    {
      label: "全量蛋白",
      value: stats.totalProteins.toLocaleString(),
      sub: "Swiss-Prot reviewed",
    },
    {
      label: "模式生物",
      value: `${stats.organismCount}`,
      sub: "细菌 · 真菌 · 植物 · 动物",
    },
    {
      label: "超家族",
      value: stats.superfamilyCount.toLocaleString(),
      sub: `${stats.classCount} 大类 · ${stats.subclassCount} 亚类`,
    },
    {
      label: "家族",
      value: stats.familyCount.toLocaleString(),
      sub: "含亚家族叶节点",
    },
    {
      label: "直系同源组",
      value: stats.orthologGroups.toLocaleString(),
      sub: `${stats.crossSpeciesGroups.toLocaleString()} 组跨物种`,
    },
    {
      label: "已归入具名家族",
      value: `${stats.classifiedPct}%`,
      sub: "其余归入其他/未分类",
    },
    {
      label: "平均长度",
      value: `${stats.avgLength.toLocaleString()} aa`,
      sub: `平均质量 ${stats.avgMass.toLocaleString()} kDa`,
    },
    {
      label: "OrthoDB 覆盖",
      value: `${Math.round((stats.orthodbCovered / Math.max(1, stats.totalProteins)) * 100)}%`,
      sub: `${stats.orthodbCovered.toLocaleString()} 条已归属`,
    },
  ];

  return (
    <section aria-label="数据总览" className="border-y border-border">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:overflow-x-auto">
        {items.map((it, i) => (
          <div
            key={it.label}
            className={`min-w-0 px-4 py-4 sm:px-5 sm:py-5 ${
              i > 0 ? "border-border lg:border-l" : ""
            } ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${
              i >= 4 ? "lg:border-t-0" : ""
            }`}
          >
            <p className="overline-label truncate">{it.label}</p>
            <p className="mt-1.5 font-serif text-[26px] leading-none tracking-tight text-foreground tabular-nums sm:text-[30px]">
              {it.value}
            </p>
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground" title={it.sub}>
              {it.sub}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
