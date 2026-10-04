"use client";

import type { BootstrapStats } from "@/lib/protein-types";
import {
  Activity,
  Dna,
  FlaskConical,
  GitBranch,
  Layers,
  Microscope,
  Percent,
  Ruler,
} from "lucide-react";

export function StatsBar({ stats }: { stats: BootstrapStats }) {
  const items = [
    {
      icon: Dna,
      label: "全量蛋白",
      value: stats.totalProteins.toLocaleString(),
      sub: "Swiss-Prot reviewed 条目",
    },
    {
      icon: Microscope,
      label: "模式生物",
      value: `${stats.organismCount}`,
      sub: "细菌 → 真菌 → 植物 → 动物",
    },
    {
      icon: Layers,
      label: "蛋白家族",
      value: `${stats.familyCount.toLocaleString()}`,
      sub: `${stats.superfamilyCount.toLocaleString()} 超家族 · ${stats.classCount} 大类`,
    },
    {
      icon: GitBranch,
      label: "直系同源组",
      value: stats.orthologGroups.toLocaleString(),
      sub: `${stats.crossSpeciesGroups.toLocaleString()} 组跨物种`,
    },
    {
      icon: Percent,
      label: "已分类",
      value: `${stats.classifiedPct}%`,
      sub: "归入具名家族的蛋白",
    },
    {
      icon: Ruler,
      label: "平均长度",
      value: `${stats.avgLength.toLocaleString()} aa`,
      sub: `平均质量 ${stats.avgMass.toLocaleString()} kDa`,
    },
    {
      icon: FlaskConical,
      label: "EC 注释",
      value: stats.ecAnnotated.toLocaleString(),
      sub: "含酶学委员会编号",
    },
    {
      icon: Activity,
      label: "OrthoDB 覆盖",
      value: stats.orthodbCovered.toLocaleString(),
      sub: `${Math.round((stats.orthodbCovered / Math.max(1, stats.totalProteins)) * 100)}% 蛋白已归属`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border bg-card p-3.5 transition-shadow hover:shadow-sm sm:p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <it.icon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="truncate text-[11px] font-medium">{it.label}</span>
          </div>
          <div className="mt-1.5 truncate text-lg font-bold tracking-tight tabular-nums sm:text-xl">{it.value}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={it.sub}>
            {it.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
