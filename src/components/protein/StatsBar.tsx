"use client";

import type { BootstrapDTO } from "@/lib/protein-types";
import { FlaskConical, GitBranch, Layers, Microscope, Ruler, Sigma } from "lucide-react";

export function StatsBar({ stats }: { stats: BootstrapDTO["stats"] }) {
  const items = [
    { icon: FlaskConical, label: "精选蛋白", value: stats.totalProteins.toLocaleString(), sub: `${stats.reviewed} 条 Swiss-Prot reviewed` },
    { icon: Layers, label: "蛋白家族", value: `${stats.familyCount}`, sub: `${stats.classCount} 大类分类体系` },
    { icon: GitBranch, label: "直系同源组", value: `${stats.groupCount}`, sub: `${stats.multiSpeciesGroups} 组跨物种保守` },
    { icon: Microscope, label: "模式生物", value: `${stats.organismCount}`, sub: "细菌 → 真菌 → 植物 → 动物" },
    { icon: Ruler, label: "平均长度", value: `${stats.avgLength} aa`, sub: `平均质量 ${stats.avgMass} kDa` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border bg-card p-3.5 transition-shadow hover:shadow-sm sm:p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <it.icon className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium">{it.label}</span>
          </div>
          <div className="mt-1.5 text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{it.value}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function StatsHint() {
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <Sigma className="h-3 w-3" /> 统计基于当前数据库快照
    </div>
  );
}
