"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { fetchCompare, fetchGroups, fetchProteinList, ORG_COLORS, ORG_SHORT } from "./api";
import type { CompareDTO, PairSimilarity } from "@/lib/protein-types";
import { pickGroupRepresentatives, similarityColor, similarityTextColor, useDebouncedValue } from "./shared";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
} from "recharts";

const MAX_COMPARE = 12;
const SCROLLBAR_CLS =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent";

export function CompareView({ ctx }: { ctx: ExplorerCtx }) {
  const { data, compareAccs, setCompareAccs, openDetail, setView } = ctx;

  const [mode, setMode] = useState<"group" | "manual">(compareAccs.length >= 2 ? "manual" : "group");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupQ, setGroupQ] = useState("");
  const debouncedGroupQ = useDebouncedValue(groupQ, 250);
  const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string } | null>(null);
  const [pairSel, setPairSel] = useState<PairSimilarity | null>(null);

  /* ===== 组模式：搜索组 ===== */
  const groupOptions = useQuery({
    queryKey: ["groupOptions", debouncedGroupQ],
    queryFn: () => fetchGroups({ q: debouncedGroupQ.trim() || undefined, minOrganisms: 2, pageSize: 30 }),
    placeholderData: keepPreviousData,
  });

  const loadGroup = async (groupId: string, groupName: string) => {
    setGroupOpen(false);
    setSelectedGroup({ id: groupId, name: groupName });
    try {
      const members = await fetchProteinList({ group: groupId, pageSize: 100, sort: "length", dir: "desc" });
      if (members.rows.length < 2) {
        toast.error("该组成员不足 2 个，无法比较");
        return;
      }
      const accs = pickGroupRepresentatives(members.rows, MAX_COMPARE);
      setCompareAccs(accs);
      setPairSel(null);
      toast.success(`已选取 ${accs.length} 个代表蛋白`, {
        description: `${groupName} · 每物种长度中位数代表（≤${MAX_COMPARE}）`,
      });
    } catch (e) {
      toast.error("组内成员加载失败", { description: (e as Error).message });
    }
  };

  /* ===== 比较数据 ===== */
  const activeIds = compareAccs;
  const compareQuery = useQuery({
    queryKey: ["compare", activeIds],
    queryFn: () => fetchCompare(activeIds),
    enabled: activeIds.length >= 2,
  });
  const compareData: CompareDTO | null = compareQuery.data ?? null;
  const loading = (compareQuery.isPending && activeIds.length >= 2) || compareQuery.isFetching;
  const error = compareQuery.error ? (compareQuery.error as Error).message : null;

  const orgRank = useMemo(() => new Map(data.organisms.map((o) => [o.taxonId, o.orderRank])), [data]);

  /** 蛋白卡头数据（按进化顺序） */
  const cards = useMemo(() => {
    if (!compareData) return [];
    return [...compareData.proteins].sort(
      (a, b) =>
        (orgRank.get(a.taxonId) ?? 99) - (orgRank.get(b.taxonId) ?? 99) || a.accession.localeCompare(b.accession)
    );
  }, [compareData, orgRank]);

  /** 柱状图数据 */
  const chartData = useMemo(() => {
    if (!compareData) return [];
    const orgCount = new Map<number, number>();
    for (const p of compareData.proteins) orgCount.set(p.taxonId, (orgCount.get(p.taxonId) ?? 0) + 1);
    return [...compareData.proteins]
      .sort(
        (a, b) =>
          (orgRank.get(a.taxonId) ?? 99) - (orgRank.get(b.taxonId) ?? 99) || a.accession.localeCompare(b.accession)
      )
      .map((p) => ({
        ...p,
        label: `${ORG_SHORT[p.taxonId] ?? p.organismCommon}${(orgCount.get(p.taxonId) ?? 1) > 1 ? ` · ${p.geneName}` : ""}`,
        color: ORG_COLORS[p.taxonId] ?? "#64748b",
      }));
  }, [compareData, orgRank]);

  /** 雷达数据（20 aa，多蛋白叠加） */
  const radarData = useMemo(() => {
    if (!compareData || compareData.proteins.length === 0) return [];
    const aas = compareData.proteins[0].aaComposition.map((c) => c.aa);
    return aas.map((aa, i) => {
      const row: Record<string, string | number> = { aa };
      compareData.proteins.forEach((p, j) => {
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

  const removeAcc = (acc: string) => {
    setCompareAccs(activeIds.filter((x) => x !== acc));
    setPairSel(null);
  };

  return (
    <div className="space-y-4">
      {/* 模式与选择器 */}
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border bg-muted/40 p-0.5" role="tablist" aria-label="比较模式">
            {(
              [
                { key: "group", label: "按直系同源组", icon: GitCompare },
                { key: "manual", label: "自由选择蛋白", icon: HandMetal },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                role="tab"
                aria-selected={mode === m.key}
                onClick={() => setMode(m.key)}
                className={`flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 ${
                  mode === m.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            ))}
          </div>

          {mode === "group" ? (
            <Popover open={groupOpen} onOpenChange={setGroupOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 max-w-[320px] gap-2 font-medium">
                  <span className="truncate text-emerald-600">{selectedGroup?.name ?? "搜索并选择同源组"}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="搜索组名（如 p53 / actin）…" value={groupQ} onValueChange={setGroupQ} />
                  <CommandList>
                    {groupOptions.isFetching && (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 搜索中…
                      </div>
                    )}
                    <CommandEmpty>{groupOptions.isFetching ? " " : "未找到匹配的同源组"}</CommandEmpty>
                    {!groupOptions.isFetching && (
                      <CommandGroup heading="跨物种直系同源组（物种 ≥ 2）">
                        {groupOptions.data?.rows.map((g) => (
                          <CommandItem
                            key={g.id}
                            value={g.id}
                            onSelect={() => loadGroup(g.id, g.name)}
                            className="gap-2 text-xs"
                          >
                            <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
                            <span className="shrink-0 text-muted-foreground tabular-nums">
                              {g.organismCount} 物种 · {g.proteinCount}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <p className="text-xs text-muted-foreground">在「家族分类树」勾选蛋白后点击"开始比较"，或在进化视角选择直系同源组</p>
          )}

          <span className="ml-auto text-[10px] text-muted-foreground">上限 {MAX_COMPARE} 个蛋白</span>
        </div>

        {/* 参与比较的蛋白 chips */}
        {activeIds.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
            <span className="mr-1 text-[11px] text-muted-foreground">
              参与比较（{activeIds.length} 个{selectedGroup && mode === "group" ? " · 组内代表" : ""}）：
            </span>
            {activeIds.map((id) => {
              const p = compareData?.proteins.find((x) => x.accession === id);
              return (
                <button
                  key={id}
                  onClick={() => removeAcc(id)}
                  title={p ? `${p.proteinName} · ${p.organismCommon} · 点击移除` : "点击移除"}
                  className="flex h-11 items-center gap-1.5 rounded-full border bg-card px-2.5 text-[11px] transition-colors hover:border-destructive hover:text-destructive sm:h-7"
                >
                  {p && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ORG_COLORS[p.taxonId] ?? "#64748b" }} />}
                  <span className="font-mono">{id}</span>
                  <span className="text-muted-foreground">×</span>
                </button>
              );
            })}
            {activeIds.length < 2 && (
              <span className="text-[10px] text-muted-foreground">至少选择 2 个蛋白</span>
            )}
          </div>
        )}
      </div>

      {/* 加载 / 错误 / 空态 */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      )}
      {error && !loading && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          比较数据加载失败：{error}
        </div>
      )}

      {!loading && activeIds.length < 2 && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
          <GitCompare className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">选择至少 2 个蛋白开始跨物种比较</p>
          <p className="mt-1 text-xs text-muted-foreground">
            从家族分类树勾选蛋白，或在进化视角选一个直系同源组
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setView("tree")}>
              去家族分类树 →
            </Button>
            <Button size="sm" variant="outline" onClick={() => setView("phylo")}>
              去进化视角选组 →
            </Button>
          </div>
        </div>
      )}

      {/* 结果 */}
      {!loading && compareData && summary && (
        <div className="space-y-4">
          {/* 蛋白卡头 */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map((p) => (
              <button
                key={p.accession}
                onClick={() => openDetail(p.accession)}
                className="rounded-xl border bg-card p-3 text-left transition-colors hover:border-emerald-400 hover:shadow-sm"
                title={`${p.proteinName} · 点击查看详情`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ORG_COLORS[p.taxonId] ?? "#64748b" }} />
                  <span className="truncate text-xs font-semibold">{ORG_SHORT[p.taxonId] ?? p.organismCommon}</span>
                </div>
                <div className="mt-1 truncate font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">{p.accession}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.geneName || p.entryName}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
                  <span>{p.length.toLocaleString()} aa</span>
                  <span>{p.massKda.toLocaleString()} kDa</span>
                </div>
              </button>
            ))}
          </div>

          {/* 概要 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { icon: Users, label: "物种数", value: `${summary.species}` },
              { icon: Ruler, label: "平均长度", value: `${summary.avgL.toLocaleString()} aa` },
              { icon: Scale, label: "平均质量", value: `${summary.avgM.toLocaleString()} kDa` },
              { icon: Sigma, label: "长度范围", value: `${summary.minL.toLocaleString()}–${summary.maxL.toLocaleString()}` },
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="蛋白长度对比" desc="氨基酸残基数 · 列按物种进化顺序">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.35} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} angle={-18} dy={8} height={44} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} stroke="#94a3b8" />
                  <ReTooltip
                    cursor={{ fill: "rgba(148,163,184,0.15)" }}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: number, _n, item) => [`${v.toLocaleString()} aa`, item?.payload?.proteinName ?? ""]}
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
                    cursor={{ fill: "rgba(148,163,184,0.15)" }}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: number, _n, item) => [`${v.toLocaleString()} kDa`, item?.payload?.proteinName ?? ""]}
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="氨基酸组成谱"
              desc={`20 种氨基酸 mol% · ${compareData.proteins.length} 个蛋白叠加${compareData.proteins.length > 8 ? "（仅描边）" : ""}`}
            >
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="70%">
                      <PolarGrid stroke="#94a3b8" strokeOpacity={0.35} />
                      <PolarAngleAxis dataKey="aa" tick={{ fontSize: 9, fill: "#94a3b8" }} stroke="#94a3b8" />
                      <PolarRadiusAxis tick={{ fontSize: 8, fill: "#94a3b8" }} stroke="#94a3b8" />
                      {compareData.proteins.map((p, j) => {
                        const orgCount = compareData.proteins.filter((x) => x.taxonId === p.taxonId).length;
                        const name = `${ORG_SHORT[p.taxonId] ?? p.organismCommon}${orgCount > 1 ? `·${p.geneName}` : ""}`;
                        return (
                          <Radar
                            key={p.accession}
                            name={name}
                            dataKey={`p${j}`}
                            stroke={ORG_COLORS[p.taxonId] ?? "#64748b"}
                            fill={ORG_COLORS[p.taxonId] ?? "#64748b"}
                            fillOpacity={compareData.proteins.length > 8 ? 0.02 : 0.08}
                            strokeWidth={1.6}
                            isAnimationActive={false}
                          />
                        );
                      })}
                      <ReTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                {/* 自绘图例（可换行，避免 recharts Legend 横向溢出） */}
                <div className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1">
                  {compareData.proteins.map((p) => {
                    const orgCount = compareData.proteins.filter((x) => x.taxonId === p.taxonId).length;
                    const name = `${ORG_SHORT[p.taxonId] ?? p.organismCommon}${orgCount > 1 ? `·${p.geneName}` : ""}`;
                    return (
                      <span key={p.accession} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ORG_COLORS[p.taxonId] ?? "#64748b" }} />
                        {name}
                      </span>
                    );
                  })}
                </div>
              </div>
            </ChartCard>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold">两两相似度矩阵</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                综合相似度 = 组成 45% + 关键词 40% + 结构域 15% · 悬停查看分项 · 点击锁定明细
              </p>
              <div className={`mt-3 max-h-72 overflow-auto ${SCROLLBAR_CLS}`}>
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
                          const isSel =
                            pairSel && ((pairSel.a === rl.acc && pairSel.b === cl.acc) || (pairSel.b === rl.acc && pairSel.a === cl.acc));
                          return (
                            <td key={cl.acc} className="border border-border/40 p-0">
                              <button
                                onClick={() => pair && setPairSel(pair)}
                                className={`flex h-7 w-12 items-center justify-center tabular-nums transition-transform hover:scale-105 ${
                                  isSel ? "ring-2 ring-emerald-500" : ""
                                }`}
                                style={{
                                  backgroundColor: similarityColor(v),
                                  color: similarityTextColor(v),
                                }}
                                title={`${rl.full} ↔ ${cl.full}
综合 ${v}% · 组成 ${pair?.composition ?? 0}% · 关键词 ${pair?.keywords ?? 0}% · 结构域 ${pair?.domains ?? 0}%`}
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

          {/* 配对明细列表 */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">配对明细</h3>
              <Badge variant="secondary" className="font-normal tabular-nums">
                {compareData.pairs.length} 对
              </Badge>
              {pairSel && (
                <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => setPairSel(null)}>
                  查看全部
                </Button>
              )}
            </div>
            <div className={`mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1 ${SCROLLBAR_CLS}`}>
              {(pairSel ? [pairSel] : compareData.pairs).map((pair) => {
                const pa = compareData.proteins.find((p) => p.accession === pair.a);
                const pb = compareData.proteins.find((p) => p.accession === pair.b);
                return (
                  <button
                    key={`${pair.a}|${pair.b}`}
                    onClick={() => setPairSel(pairSel === pair ? null : pair)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors hover:border-emerald-400/60 ${
                      pairSel === pair ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30" : "bg-muted/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 font-mono font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ORG_COLORS[pa?.taxonId ?? 0] ?? "#64748b" }} />
                        {pair.a}
                      </span>
                      <span className="text-muted-foreground">↔</span>
                      <span className="flex items-center gap-1 font-mono font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ORG_COLORS[pb?.taxonId ?? 0] ?? "#64748b" }} />
                        {pair.b}
                      </span>
                      <span className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground tabular-nums">
                        <span title="氨基酸组成余弦相似度">组成 {pair.composition}%</span>
                        <span title="关键词 Jaccard">关键词 {pair.keywords}%</span>
                        <span title="结构域 Jaccard">结构域 {pair.domains}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pair.overall}%`, backgroundColor: similarityColor(pair.overall) }}
                        />
                      </div>
                      <span className="w-14 text-right text-xs font-bold tabular-nums" style={{ color: similarityColor(pair.overall) }}>
                        {pair.overall}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 锁定配对的共同项 */}
            {pairSel && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {sharedKeywords.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground">共同关键词（{sharedKeywords.length} 个）</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {sharedKeywords.slice(0, 24).map((k) => (
                        <Badge key={k} variant="outline" className="text-[10px] font-normal">
                          {k}
                        </Badge>
                      ))}
                      {sharedKeywords.length > 24 && (
                        <span className="text-[10px] text-muted-foreground">+{sharedKeywords.length - 24}</span>
                      )}
                    </div>
                  </div>
                )}
                {sharedDomains.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground">共同结构域（{sharedDomains.length} 个）</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {sharedDomains.map((d) => (
                        <Badge key={d} variant="outline" className="text-[10px] font-normal">
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {sharedKeywords.length === 0 && sharedDomains.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">该配对无共同关键词与结构域注释</p>
                )}
              </div>
            )}
          </div>

          {/* 属性总表 */}
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b bg-muted/40 [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:text-muted-foreground">
                  <th>登录号</th>
                  <th>蛋白名称</th>
                  <th>物种</th>
                  <th>基因</th>
                  <th className="text-right">长度 aa</th>
                  <th className="text-right">kDa</th>
                  <th className="text-right">结构域</th>
                  <th className="text-right">关键词</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((p) => (
                  <tr
                    key={p.accession}
                    className="cursor-pointer border-b border-border/50 hover:bg-accent/50"
                    onClick={() => openDetail(p.accession)}
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-emerald-700 dark:text-emerald-400">{p.accession}</td>
                    <td className="max-w-[260px] truncate px-3 py-2" title={p.proteinName}>
                      {p.proteinName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: ORG_COLORS[p.taxonId] ?? "#64748b" }} />
                      {ORG_SHORT[p.taxonId] ?? p.organismCommon}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{p.geneName || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.length.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.massKda.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.domainCount || "—"}</td>
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
