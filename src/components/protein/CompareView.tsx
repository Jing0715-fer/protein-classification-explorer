"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { fetchCompare, ORG_COLORS, ORG_SHORT } from "./api";
import type { CompareDTO, PairSimilarity } from "@/lib/protein-types";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  GitCompare,
  HandMetal,
  Loader2,
  Microscope,
  Ruler,
  Scale,
  Sigma,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";

const PALETTE = ["#059669", "#e11d48", "#0891b2", "#d97706", "#7c3aed", "#65a30d"];

export function CompareView({ ctx }: { ctx: ExplorerCtx }) {
  const { data, compareGroup, setCompareGroup, compareMode, setCompareMode, compareIds, toggleCompare, openDetail, setView } = ctx;

  const [groupOpen, setGroupOpen] = useState(false);
  const [memberSel, setMemberSel] = useState<string[] | null>(null);
  const [pairSel, setPairSel] = useState<PairSimilarity | null>(null);

  // 注：组件由父级通过 key={`${compareMode}:${compareGroup}`} 重挂载，切换组/模式时自动重置本地状态

  // 组列表（多物种优先）
  const groups = useMemo(() => {
    const m = new Map<string, { species: number; count: number }>();
    for (const p of data.proteins) {
      if (!m.has(p.group)) m.set(p.group, { species: 0, count: 0 });
      const g = m.get(p.group)!;
      g.count++;
    }
    const byOrg = new Map<string, Set<number>>();
    for (const p of data.proteins) {
      if (!byOrg.has(p.group)) byOrg.set(p.group, new Set());
      byOrg.get(p.group)!.add(p.taxonId);
    }
    for (const [k, v] of byOrg) m.get(k)!.species = v.size;
    return [...m.entries()]
      .map(([group, info]) => ({ group, ...info }))
      .sort((a, b) => b.species - a.species || a.group.localeCompare(b.group));
  }, [data]);

  const groupMembers = useMemo(() => {
    if (compareMode !== "group" || !compareGroup) return [];
    const orgRank = new Map(data.organisms.map((o) => [o.taxonId, o.orderRank]));
    return data.proteins
      .filter((p) => p.group === compareGroup)
      .sort(
        (a, b) =>
          (orgRank.get(a.taxonId) ?? 99) - (orgRank.get(b.taxonId) ?? 99) ||
          Number(b.rep) - Number(a.rep) ||
          a.accession.localeCompare(b.accession)
      );
  }, [data, compareGroup, compareMode]);

  // 当前生效的 ids
  const activeIds = useMemo(() => {
    if (compareMode === "manual") return compareIds;
    if (memberSel) return memberSel;
    // 自动选择：每物种优先取代表蛋白
    const seen = new Set<number>();
    const picked: string[] = [];
    for (const p of groupMembers) {
      if (!seen.has(p.taxonId)) {
        seen.add(p.taxonId);
        picked.push(p.accession);
      }
    }
    return picked.slice(0, 12);
  }, [compareMode, compareIds, memberSel, groupMembers]);

  const compareQuery = useQuery({
    queryKey: ["compare", activeIds],
    queryFn: () => fetchCompare(activeIds),
    enabled: activeIds.length >= 2,
  });
  const compareData: CompareDTO | null = compareQuery.data ?? null;
  const loading = (compareQuery.isPending && activeIds.length >= 2) || compareQuery.isFetching;
  const error = compareQuery.error ? (compareQuery.error as Error).message : null;

  const orgRank = useMemo(() => new Map(data.organisms.map((o) => [o.taxonId, o.orderRank])), [data]);

  // 图表数据（按进化顺序）
  const chartData = useMemo(() => {
    if (!compareData) return [];
    const orgCount = new Map<number, number>();
    for (const p of compareData.proteins) orgCount.set(p.taxonId, (orgCount.get(p.taxonId) ?? 0) + 1);
    return [...compareData.proteins]
      .sort((a, b) => (orgRank.get(a.taxonId) ?? 99) - (orgRank.get(b.taxonId) ?? 99) || a.accession.localeCompare(b.accession))
      .map((p) => ({
        ...p,
        label: `${ORG_SHORT[p.taxonId] ?? p.organismCommon}${(orgCount.get(p.taxonId) ?? 1) > 1 ? ` · ${p.geneName}` : ""}`,
        color: ORG_COLORS[p.taxonId] ?? "#64748b",
      }));
  }, [compareData, orgRank]);

  // 雷达数据（最多 5 条）
  const radarData = useMemo(() => {
    if (!compareData || compareData.proteins.length === 0) return [];
    const aas = compareData.proteins[0].aaComposition.map((c) => c.aa);
    return aas.map((aa, i) => {
      const row: Record<string, string | number> = { aa };
      compareData.proteins.slice(0, 5).forEach((p, j) => {
        row[`p${j}`] = p.aaComposition[i]?.pct ?? 0;
      });
      return row;
    });
  }, [compareData]);

  const matrixLabels = useMemo(() => {
    if (!compareData) return [];
    const counts = new Map<number, number>();
    for (const p of compareData.proteins) counts.set(p.taxonId, (counts.get(p.taxonId) ?? 0) + 1);
    return compareData.proteins.map((p) => ({
      acc: p.accession,
      label: `${ORG_SHORT[p.taxonId] ?? p.organismCommon}${(counts.get(p.taxonId) ?? 1) > 1 ? `·${p.geneName}` : ""}`,
      full: `${p.organismCommon} · ${p.geneName} · ${p.accession}`,
    }));
  }, [compareData]);

  const pairMatrix = useMemo(() => {
    if (!compareData) return null;
    const map = new Map<string, PairSimilarity>();
    for (const pr of compareData.pairs) {
      map.set(`${pr.a}|${pr.b}`, pr);
      map.set(`${pr.b}|${pr.a}`, pr);
    }
    return map;
  }, [compareData]);

  const summary = useMemo(() => {
    if (!compareData || compareData.proteins.length === 0) return null;
    const ps = compareData.proteins;
    const species = new Set(ps.map((p) => p.taxonId)).size;
    const avgL = Math.round(ps.reduce((s, p) => s + p.length, 0) / ps.length);
    const avgM = Math.round((ps.reduce((s, p) => s + p.massKda, 0) / ps.length) * 10) / 10;
    const maxL = Math.max(...ps.map((p) => p.length));
    const minL = Math.min(...ps.map((p) => p.length));
    return { species, avgL, avgM, maxL, minL, ratio: Math.round((maxL / Math.max(minL, 1)) * 100) / 100 };
  }, [compareData]);

  const sharedKeywords = useMemo(() => {
    if (!pairSel || !compareData) return [];
    const a = compareData.proteins.find((p) => p.accession === pairSel.a);
    const b = compareData.proteins.find((p) => p.accession === pairSel.b);
    if (!a || !b) return [];
    const sb = new Set(b.keywords);
    return a.keywords.filter((k) => sb.has(k));
  }, [pairSel, compareData]);

  const sharedDomains = useMemo(() => {
    if (!pairSel || !compareData) return [];
    const a = compareData.proteins.find((p) => p.accession === pairSel.a);
    const b = compareData.proteins.find((p) => p.accession === pairSel.b);
    if (!a || !b) return [];
    const sb = new Set(b.domains);
    return a.domains.filter((d) => sb.has(d));
  }, [pairSel, compareData]);

  const currentGroup = groups.find((g) => g.group === compareGroup);

  return (
    <div className="space-y-4">
      {/* 模式与选择器 */}
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            {(
              [
                { key: "group", label: "按直系同源组", icon: GitCompare },
                { key: "manual", label: "自由选择蛋白", icon: HandMetal },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                onClick={() => setCompareMode(m.key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  compareMode === m.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            ))}
          </div>

          {compareMode === "group" ? (
            <Popover open={groupOpen} onOpenChange={setGroupOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 font-medium">
                  <span className="text-emerald-600">{compareGroup ?? "选择同源组"}</span>
                  {currentGroup && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {currentGroup.species} 物种 · {currentGroup.count} 蛋白
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索同源组名称…" />
                  <CommandList>
                    <CommandEmpty>未找到匹配的同源组</CommandEmpty>
                    <CommandGroup>
                      {groups.map((g) => (
                        <CommandItem
                          key={g.group}
                          value={`${g.group} ${g.species}`}
                          onSelect={() => {
                            setCompareGroup(g.group);
                            setGroupOpen(false);
                          }}
                          className="gap-2 text-xs"
                        >
                          <span className="font-medium">{g.group}</span>
                          <span className="ml-auto text-muted-foreground">
                            {g.species} 物种 · {g.count}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {compareIds.length > 0 ? (
                <>
                  {compareIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => toggleCompare(id)}
                      title="点击移除"
                      className="rounded-full border bg-card px-2.5 py-1 font-mono text-[11px] transition-colors hover:border-destructive hover:text-destructive"
                    >
                      {id} ×
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground">{compareIds.length} 个已选</span>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">在「家族分类树」勾选蛋白加入比较</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setView("tree")}>
                    去选择 →
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 组内成员 chips */}
        {compareMode === "group" && groupMembers.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
            <span className="mr-1 text-[11px] text-muted-foreground">成员（点击切换参与比较）：</span>
            {groupMembers.map((m) => {
              const on = activeIds.includes(m.accession);
              return (
                <button
                  key={m.accession}
                  onClick={() => {
                    const base = memberSel ?? activeIds;
                    setMemberSel(
                      base.includes(m.accession) ? base.filter((x) => x !== m.accession) : [...base, m.accession].slice(0, 12)
                    );
                  }}
                  title={`${m.proteinName} · ${m.length} aa`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    on
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-border bg-muted/40 text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {ORG_SHORT[m.taxonId]}
                  {m.rep && <span className="ml-0.5">{m.rep ? "★" : ""}</span>}
                  <span className="ml-1 font-mono opacity-80">{m.accession}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 加载 / 空态 */}
      {loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      )}
      {error && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {!loading && activeIds.length < 2 && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
          <GitCompare className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">选择至少 2 个蛋白开始跨物种比较</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {compareMode === "group" ? "从上方选择一个直系同源组，或切换成员" : "回到家族分类树勾选感兴趣的蛋白"}
          </p>
        </div>
      )}

      {/* 结果 */}
      {!loading && compareData && summary && (
        <div className="space-y-4">
          {/* 概要 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { icon: Users, label: "物种数", value: `${summary.species}` },
              { icon: Ruler, label: "平均长度", value: `${summary.avgL} aa` },
              { icon: Scale, label: "平均质量", value: `${summary.avgM} kDa` },
              { icon: Sigma, label: "长度范围", value: `${summary.minL}–${summary.maxL}` },
              { icon: Microscope, label: "长度倍差", value: `${summary.ratio}×` },
            ].map((it) => (
              <div key={it.label} className="rounded-xl border bg-card p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <it.icon className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[11px] font-medium">{it.label}</span>
                </div>
                <div className="mt-1 text-lg font-bold tabular-nums">{it.value}</div>
              </div>
            ))}
          </div>

          {/* 长度 / 质量 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="蛋白长度对比" desc="氨基酸残基数 · 列按物种进化顺序">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.35} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} angle={-18} dy={8} height={44} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} stroke="#94a3b8" />
                  <ReTooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: number, _n, item: any) => [`${v.toLocaleString()} aa`, item?.payload?.proteinName ?? ""]}
                  />
                  <Bar dataKey="length" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="分子质量对比" desc="kDa · UniProt 序列计算值">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.35} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} angle={-18} dy={8} height={44} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} stroke="#94a3b8" />
                  <ReTooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: number, _n, item: any) => [`${v} kDa`, item?.payload?.proteinName ?? ""]}
                  />
                  <Bar dataKey="massKda" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* 组成雷达 + 相似度矩阵 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="氨基酸组成谱" desc={compareData.proteins.length > 5 ? "mol% · 仅展示前 5 个蛋白" : "mol%"}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#94a3b8" strokeOpacity={0.35} />
                  <PolarAngleAxis dataKey="aa" tick={{ fontSize: 9, fill: "#94a3b8" }} stroke="#94a3b8" />
                  <PolarRadiusAxis tick={{ fontSize: 8, fill: "#94a3b8" }} stroke="#94a3b8" />
                  {compareData.proteins.slice(0, 5).map((p, j) => {
                    const orgCount = compareData.proteins.filter((x) => x.taxonId === p.taxonId).length;
                    const name = `${ORG_SHORT[p.taxonId] ?? p.organismCommon}${orgCount > 1 ? `·${p.geneName}` : ""}`;
                    return (
                      <Radar
                        key={p.accession}
                        name={name}
                        dataKey={`p${j}`}
                        stroke={PALETTE[j % PALETTE.length]}
                        fill={PALETTE[j % PALETTE.length]}
                        fillOpacity={0.12}
                        strokeWidth={1.8}
                        isAnimationActive={false}
                      />
                    );
                  })}
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <ReTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold">两两相似度矩阵</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                综合相似度 = 组成 45% + 关键词 40% + 结构域 15% · 点击单元格查看明细
              </p>
              <div className="mt-3 max-h-72 overflow-auto">
                <table className="border-collapse text-[10px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card" />
                      {matrixLabels.map((l) => (
                        <th key={l.acc} className="bg-card px-1 pb-1 text-center font-medium">
                          <span title={l.full}>{l.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixLabels.map((rl, i) => (
                      <tr key={rl.acc}>
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-card pr-2 text-right font-medium">
                          <span title={rl.full}>{rl.label}</span>
                        </td>
                        {matrixLabels.map((cl, j) => {
                          if (i === j)
                            return (
                              <td key={cl.acc} className="border border-border/40 p-0">
                                <div className="flex h-7 w-12 items-center justify-center bg-muted font-semibold text-muted-foreground">—</div>
                              </td>
                            );
                          const pair = pairMatrix?.get(`${rl.acc}|${cl.acc}`);
                          const v = pair?.overall ?? 0;
                          const isSel = pairSel && ((pairSel.a === rl.acc && pairSel.b === cl.acc) || (pairSel.b === rl.acc && pairSel.a === cl.acc));
                          return (
                            <td key={cl.acc} className="border border-border/40 p-0">
                              <button
                                onClick={() => pair && setPairSel(pair)}
                                className={`flex h-7 w-12 items-center justify-center tabular-nums transition-transform hover:scale-105 ${
                                  isSel ? "ring-2 ring-emerald-500" : ""
                                }`}
                                style={{
                                  backgroundColor: `rgba(5, 150, 105, ${0.06 + (v / 100) * 0.8})`,
                                  color: v > 52 ? "white" : "hsl(var(--foreground))",
                                }}
                                title={`${rl.full} ↔ ${cl.full}：综合 ${v}%`}
                              >
                                {v}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 配对明细 */}
          {pairSel && compareData && (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">配对明细</h3>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {pairSel.a} ↔ {pairSel.b}
                </Badge>
                <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => setPairSel(null)}>
                  关闭
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { label: "氨基酸组成相似度", v: pairSel.composition, desc: "20 维组成向量余弦相似度" },
                  { label: "关键词相似度", v: pairSel.keywords, desc: "UniProt 关键词 Jaccard" },
                  { label: "结构域相似度", v: pairSel.domains, desc: "结构域注释 Jaccard" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-[11px] text-muted-foreground">{m.label}</div>
                    <div className="mt-0.5 text-xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">{m.v}%</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{m.desc}</div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${m.v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {sharedKeywords.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-medium text-muted-foreground">共同关键词（{sharedKeywords.length} 个）</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {sharedKeywords.slice(0, 24).map((k) => (
                      <Badge key={k} variant="outline" className="text-[10px] font-normal">
                        {k}
                      </Badge>
                    ))}
                    {sharedKeywords.length > 24 && <span className="text-[10px] text-muted-foreground">+{sharedKeywords.length - 24}</span>}
                  </div>
                </div>
              )}
              {sharedDomains.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-medium text-muted-foreground">共同结构域（{sharedDomains.length} 个）</div>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {sharedDomains.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 属性总表 */}
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b bg-muted/40 [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:text-muted-foreground">
                  <th>登录号</th>
                  <th>蛋白名称</th>
                  <th>物种</th>
                  <th>基因</th>
                  <th className="text-right">长度 aa</th>
                  <th className="text-right">kDa</th>
                  <th className="text-right">结构域</th>
                  <th className="text-right">PDB</th>
                  <th className="text-right">关键词</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((p) => (
                  <tr
                    key={p.accession}
                    className="cursor-pointer border-b border-border/50 hover:bg-accent/50"
                    onClick={() => openDetail(p.accession)}
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-emerald-700 dark:text-emerald-400">{p.accession}</td>
                    <td className="max-w-[260px] truncate px-3 py-2" title={p.proteinName}>{p.proteinName}</td>
                    <td className="whitespace-nowrap px-3 py-2">{ORG_SHORT[p.taxonId] ?? p.organismCommon}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{p.geneName || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.length.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.massKda}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.domainCount || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.pdbCount || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.keywordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
      <div className="mt-2 h-64">{children}</div>
    </div>
  );
}
