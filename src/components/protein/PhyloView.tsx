"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { CLASS_COLORS, classOf } from "@/lib/protein-types";
import type { GroupSummaryDTO } from "@/lib/protein-types";
import { fetchGroups, fetchProteinList, ORG_COLORS, ORG_SHORT } from "./api";
import { logIntensity, pickGroupRepresentatives, useDebouncedValue } from "./shared";
import { Fragment, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, GitCompare, Grid3x3, Search, TreePine, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SCROLLBAR_CLS =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent";

/* ===== 进化树布局常量（沿用经过验证的 SVG 布局） ===== */
const LABEL_W = 176;
const COL_W = 68;
const COLS = 10;
const TREE_H = 232;
const LEAF_Y = 168;

interface TrieNode {
  name: string;
  children: Map<string, TrieNode>;
  taxon?: number;
}

interface LaidNode {
  name: string;
  x: number;
  y: number;
  taxon?: number;
  children: LaidNode[];
}

export function PhyloView({ ctx }: { ctx: ExplorerCtx }) {
  const { data, setView, setFamilyCode, openDetail, setCompareAccs } = ctx;

  /* ===== A. 物种系统发生树 ===== */
  const tree = useMemo(() => {
    const root: TrieNode = { name: "所有生物", children: new Map() };
    for (const org of data.organisms) {
      let node = root;
      for (const seg of org.phyloPath.split(">")) {
        const key = seg.trim();
        if (!node.children.has(key)) node.children.set(key, { name: key, children: new Map() });
        node = node.children.get(key)!;
      }
      node.taxon = org.taxonId;
    }
    const leafIndex = new Map(data.organisms.map((o, i) => [o.taxonId, i]));

    const layout = (node: TrieNode, depth: number): LaidNode => {
      if (node.taxon !== undefined && node.children.size === 0) {
        const i = leafIndex.get(node.taxon) ?? 0;
        return { name: node.name, x: LABEL_W + i * COL_W + COL_W / 2, y: LEAF_Y, taxon: node.taxon, children: [] };
      }
      const children = [...node.children.values()].map((c) => layout(c, depth + 1));
      // 单链压缩
      if (children.length === 1 && node.children.size === 1) {
        const only = [...node.children.values()][0];
        if (only.children.size > 0 || only.taxon !== undefined) return children[0];
      }
      children.sort((a, b) => a.x - b.x);
      const x = (children[0].x + children[children.length - 1].x) / 2;
      const y = 18 + depth * 28;
      return { name: node.name, x, y, children };
    };
    const laid = layout(root, 0);
    laid.y = 10;
    return laid;
  }, [data]);

  const edges = useMemo(() => {
    const drops: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const brackets: { x1: number; x2: number; y: number }[] = [];
    const walk = (node: LaidNode) => {
      if (node.children.length === 0) return;
      const xs = node.children.map((c) => c.x);
      brackets.push({ x1: Math.min(...xs), x2: Math.max(...xs), y: node.y });
      for (const c of node.children) {
        drops.push({ x1: c.x, y1: node.y, x2: c.x, y2: c.y });
        walk(c);
      }
    };
    walk(tree);
    return { drops, brackets };
  }, [tree]);

  const nodeLabels = useMemo(() => {
    const labels: { x: number; y: number; text: string }[] = [];
    const walk = (node: LaidNode) => {
      if (node.children.length > 0 && node.name !== "所有生物" && node.y < LEAF_Y - 16) {
        labels.push({ x: node.x, y: node.y - 5, text: node.name.split(" ")[0] });
      }
      for (const c of node.children) walk(c);
    };
    walk(tree);
    return labels;
  }, [tree]);

  /* ===== B. 家族 × 物种覆盖热图 ===== */
  const famByTaxon = useMemo(() => new Map(data.organisms.map((o) => [o.taxonId, o])), [data]);
  const heatMax = useMemo(() => {
    let max = 0;
    for (const cls of data.families) {
      for (const fam of cls.children ?? []) {
        for (const n of Object.values(fam.byOrganism)) if (n > max) max = n;
      }
    }
    return max;
  }, [data]);

  /* ===== C. 直系同源组浏览 ===== */
  const [crossOnly, setCrossOnly] = useState(true);
  const [minOrganisms, setMinOrganisms] = useState(3);
  const [familyCls, setFamilyCls] = useState<string>("all");
  const [groupQuery, setGroupQuery] = useState("");
  const debouncedGroupQ = useDebouncedValue(groupQuery, 300);
  const [groupPage, setGroupPage] = useState(1);

  const resetGroupPage = () => setGroupPage(1);

  const groupsQuery = useQuery({
    queryKey: ["groups", crossOnly, minOrganisms, familyCls, debouncedGroupQ, groupPage],
    queryFn: () =>
      fetchGroups({
        cross: crossOnly,
        minOrganisms,
        family: familyCls === "all" ? null : familyCls,
        q: debouncedGroupQ.trim() || undefined,
        page: groupPage,
        pageSize: 30,
      }),
    placeholderData: keepPreviousData,
  });
  const groups = groupsQuery.data ?? null;

  const famNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const cls of data.families) {
      m.set(cls.code, cls.name);
      for (const f of cls.children ?? []) m.set(f.code, f.name);
    }
    return m;
  }, [data]);

  /* 组成员弹窗 */
  const [dialogGroup, setDialogGroup] = useState<GroupSummaryDTO | null>(null);
  const membersQuery = useQuery({
    queryKey: ["groupMembers", dialogGroup?.id],
    queryFn: () => fetchProteinList({ group: dialogGroup!.id, pageSize: 100, sort: "length", dir: "desc" }),
    enabled: !!dialogGroup,
  });
  const members = membersQuery.data ?? null;

  const memberByOrg = useMemo(() => {
    if (!members) return [];
    const m = new Map<number, { common: string; count: number }>();
    for (const r of members.rows) {
      const org = famByTaxon.get(r.taxonId);
      const key = r.taxonId;
      if (!m.has(key)) m.set(key, { common: org?.commonName ?? ORG_SHORT[r.taxonId] ?? String(r.taxonId), count: 0 });
      m.get(key)!.count++;
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [members, famByTaxon]);

  const compareThisGroup = () => {
    if (!members || members.rows.length === 0) return;
    const accs = pickGroupRepresentatives(members.rows, 12);
    setCompareAccs(accs);
    setDialogGroup(null);
    setView("compare");
  };

  const groupTotalPages = groups?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* A. 物种系统发生树 */}
      <section className="rounded-xl border bg-card" aria-label="物种系统发生树">
        <div className="border-b px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <TreePine className="h-4 w-4 text-emerald-600" />
            物种系统发生树
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            10 种模式生物按系统发育关系排列（细菌 → 真菌 → 植物 → 无脊椎 → 脊椎动物），叶子标注各物种全量蛋白条目数。
          </p>
        </div>
        <div className={`overflow-x-auto ${SCROLLBAR_CLS}`}>
          <svg
            width="100%"
            height={TREE_H}
            viewBox={`0 0 ${LABEL_W + COLS * COL_W} ${TREE_H}`}
            style={{ minWidth: LABEL_W + COLS * COL_W }}
            className="block"
            role="img"
            aria-label="物种系统发育树"
          >
            {edges.brackets.map((b, i) => (
              <line key={`b${i}`} x1={b.x1} y1={b.y} x2={b.x2} y2={b.y} stroke="currentColor" className="text-foreground/40" strokeWidth="1.5" />
            ))}
            {edges.drops.map((d, i) => (
              <line key={`d${i}`} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="currentColor" className="text-foreground/40" strokeWidth="1.5" />
            ))}
            {nodeLabels.map((l, i) => (
              <text key={`l${i}`} x={l.x} y={l.y} textAnchor="middle" fontSize="9.5" fill="currentColor" className="text-muted-foreground">
                {l.text}
              </text>
            ))}
            {data.organisms.map((o) => {
              const i = o.orderRank - 1;
              const cx = LABEL_W + i * COL_W + COL_W / 2;
              return (
                <g key={o.taxonId}>
                  <circle cx={cx} cy={LEAF_Y} r={4} fill="currentColor" className="text-foreground/70" />
                  <text x={cx} y={LEAF_Y + 20} textAnchor="middle" fontSize="11" fontWeight={600} fill="currentColor" className="text-foreground">
                    {ORG_SHORT[o.taxonId] ?? o.commonName}
                  </text>
                  <text x={cx} y={LEAF_Y + 34} textAnchor="middle" fontSize="8.5" fill="currentColor" className="text-muted-foreground">
                    {o.proteinCount.toLocaleString()} 蛋白
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* B. 家族 × 物种覆盖热图 */}
      <section className="rounded-xl border bg-card" aria-label="家族与物种覆盖热图">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div className="max-w-xl">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Grid3x3 className="h-4 w-4 text-emerald-600" />
              家族 × 物种覆盖热图
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              行为全部 <span className="font-medium text-foreground">{data.stats.familyCount}</span> 个家族（按大类分组），列为 10 种模式生物。
              颜色深浅按数量对数强度着色（大类配色），空白表示该物种无该家族成员。点击行跳转家族分类树。
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>浅</span>
            <span className="flex h-3 w-24 overflow-hidden rounded-full border" aria-hidden>
              <span className="h-full flex-1 bg-emerald-600/15" />
              <span className="h-full flex-1 bg-emerald-600/35" />
              <span className="h-full flex-1 bg-emerald-600/60" />
              <span className="h-full flex-1 bg-emerald-600/85" />
              <span className="h-full flex-1 bg-emerald-600" />
            </span>
            <span>深</span>
            <span className="ml-1 rounded border border-dashed px-1 py-0.5">0 = 空</span>
          </div>
        </div>
        <div className={`max-h-[560px] overflow-auto ${SCROLLBAR_CLS}`}>
          <table className="w-full min-w-[720px] table-fixed border-collapse text-xs">
            <colgroup>
              <col style={{ width: 200 }} />
              {data.organisms.map((o) => (
                <col key={o.taxonId} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-center [&>th]:text-[10px] [&>th]:font-medium [&>th]:text-muted-foreground">
                <th className="text-left">家族</th>
                {data.organisms.map((o) => (
                  <th key={o.taxonId} title={`${o.commonName} · ${o.scientificName}`}>
                    {ORG_SHORT[o.taxonId] ?? o.commonName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.families.map((cls) => (
                <Fragment key={cls.code}>
                  <tr>
                    <td colSpan={11} className="sticky top-[33px] z-[5] border-y bg-muted/70 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: CLASS_COLORS[cls.code] }} />
                      {cls.name}
                      <span className="ml-1.5 font-normal text-muted-foreground">{cls.children?.length ?? 0} 个家族 · {cls.totalCount.toLocaleString()} 条</span>
                    </td>
                  </tr>
                  {(cls.children ?? []).map((fam) => (
                    <tr
                      key={fam.code}
                      className="group/heat cursor-pointer transition-colors hover:bg-accent/40"
                      onClick={() => {
                        setFamilyCode(fam.code);
                        setView("tree");
                      }}
                      title={`点击查看「${fam.name}」家族蛋白列表`}
                    >
                      <td className="sticky left-0 z-[4] truncate border-b border-border/50 bg-card px-3 py-1 text-left group-hover/heat:bg-accent/40">
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: CLASS_COLORS[cls.code] }} />
                        <span className="font-medium">{fam.name}</span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">{fam.count.toLocaleString()}</span>
                      </td>
                      {data.organisms.map((o) => {
                        const n = fam.byOrganism[o.taxonId] ?? 0;
                        const alpha = logIntensity(n, heatMax);
                        return (
                          <td key={o.taxonId} className="border-b border-border/50 p-0.5 text-center" title={`${fam.name} × ${o.commonName}：${n.toLocaleString()} 条`}>
                            {n > 0 ? (
                              <div
                                className="flex h-6 items-center justify-center rounded text-[10px] font-semibold tabular-nums"
                                style={{
                                  backgroundColor: `${CLASS_COLORS[cls.code]}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`,
                                  color: alpha > 0.55 ? "#fff" : undefined,
                                }}
                              >
                                {n > 999 ? `${(n / 1000).toFixed(1)}k` : n}
                              </div>
                            ) : (
                              <div className="mx-auto h-6 rounded border border-dashed border-border/40" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* C. 直系同源组浏览 */}
      <section className="rounded-xl border bg-card" aria-label="直系同源组浏览">
        <div className="flex flex-col gap-3 border-b px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-xl">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Users className="h-4 w-4 text-emerald-600" />
                直系同源组浏览
                <Badge variant="secondary" className="ml-1 font-normal tabular-nums">
                  {groups ? `${groups.total.toLocaleString()} 组` : "…"}
                </Badge>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                OrthoDB 直系同源组（{data.stats.orthologGroups.toLocaleString()} 组，其中{" "}
                {data.stats.crossSpeciesGroups.toLocaleString()} 组跨物种）。点击行查看组内成员，可直接发起跨物种比较。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <Switch id="cross-only" checked={crossOnly} onCheckedChange={(v) => { setCrossOnly(v); resetGroupPage(); }} />
                <Label htmlFor="cross-only" className="text-xs text-muted-foreground">
                  仅跨物种
                </Label>
              </div>
              <Select value={String(minOrganisms)} onValueChange={(v) => { setMinOrganisms(Number(v)); resetGroupPage(); }}>
                <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="最少物种数">
                  <span className="text-muted-foreground">物种 ≥ </span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={familyCls} onValueChange={(v) => { setFamilyCls(v); resetGroupPage(); }}>
                <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="按大类筛选">
                  <SelectValue placeholder="全部大类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    全部大类
                  </SelectItem>
                  {data.families.map((cls) => (
                    <SelectItem key={cls.code} value={cls.code} className="text-xs">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: CLASS_COLORS[cls.code] }} />
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={groupQuery}
                  onChange={(e) => {
                    setGroupQuery(e.target.value);
                    resetGroupPage();
                  }}
                  placeholder="搜索组名"
                  className="h-8 w-40 pl-8 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 组表格 */}
        <div className={`overflow-auto ${SCROLLBAR_CLS}`}>
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr className="[&>th]:border-b [&>th]:px-2.5 [&>th]:py-2 [&>th]:font-medium [&>th]:text-muted-foreground">
                <th>组名</th>
                <th className="w-16 text-right">蛋白数</th>
                <th className="w-16 text-right">物种数</th>
                <th className="w-[300px]">物种分布</th>
                <th className="w-32">主家族</th>
              </tr>
            </thead>
            <tbody>
              {groupsQuery.error && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-destructive">
                    直系同源组加载失败
                    <Button variant="outline" size="sm" className="ml-3" onClick={() => groupsQuery.refetch()}>
                      重试
                    </Button>
                  </td>
                </tr>
              )}
              {!groups &&
                !groupsQuery.error &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border/60">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-2.5 py-2.5">
                        <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${35 + ((i * 11 + j * 17) % 50)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {groups?.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    没有匹配的直系同源组，试试调整筛选条件
                  </td>
                </tr>
              )}
              {groups?.rows.map((g) => (
                <tr
                  key={g.id}
                  className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/60 ${
                    groupsQuery.isFetching ? "opacity-60" : ""
                  }`}
                  onClick={() => setDialogGroup(g)}
                  title="点击查看组内成员"
                >
                  <td className="max-w-[320px] truncate px-2.5 py-2">
                    <span className="font-medium">{g.name}</span>
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">{g.id}</span>
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{g.proteinCount.toLocaleString()}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{g.organismCount}</td>
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-1">
                      {data.organisms.map((o) => {
                        const has = g.organismIds.includes(o.taxonId);
                        return (
                          <span
                            key={o.taxonId}
                            title={has ? o.commonName : undefined}
                            className={`flex h-4 w-4 items-center justify-center rounded-full ${
                              has ? "" : "border border-dashed border-border/50"
                            }`}
                            style={has ? { backgroundColor: ORG_COLORS[o.taxonId], opacity: 0.9 } : undefined}
                          >
                            {has && <span className="h-1 w-1 rounded-full bg-white/90" />}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-muted-foreground">
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: CLASS_COLORS[classOf(g.familyCode)] }} />
                    {famNameByCode.get(g.familyCode) ?? g.familyCode}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 组分页 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span>
            {groups ? (
              <>
                共 <span className="font-medium text-foreground tabular-nums">{groups.total.toLocaleString()}</span> 组 · 第{" "}
                <span className="font-medium text-foreground tabular-nums">{groups.page}</span>/<span className="tabular-nums">{groups.totalPages}</span> 页
              </>
            ) : (
              "加载中…"
            )}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-7 sm:w-7"
              disabled={!groups || groupPage <= 1}
              onClick={() => setGroupPage(groupPage - 1)}
              aria-label="上一页"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-1 tabular-nums">{groupPage}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-7 sm:w-7"
              disabled={!groups || groupPage >= groupTotalPages}
              onClick={() => setGroupPage(groupPage + 1)}
              aria-label="下一页"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* 组成员弹窗 */}
      <Dialog open={!!dialogGroup} onOpenChange={(o) => !o && setDialogGroup(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
          <DialogHeader className="border-b">
            <DialogTitle className="pr-6 text-base leading-snug">{dialogGroup?.name}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
              <span className="font-mono text-[11px]">{dialogGroup?.id}</span>
              {dialogGroup && (
                <>
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    {dialogGroup.proteinCount.toLocaleString()} 蛋白
                  </Badge>
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    {dialogGroup.organismCount} 物种
                  </Badge>
                  {dialogGroup.crossSpecies && (
                    <Badge variant="outline" className="border-teal-300 bg-teal-50 font-normal text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-400">
                      跨物种
                    </Badge>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {memberByOrg.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1 pt-2">
              {memberByOrg.map(([taxon, info]) => (
                <span
                  key={taxon}
                  className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                  title={`${info.common}：${info.count} 条`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ORG_COLORS[taxon] ?? "#94a3b8" }} />
                  {info.common}
                  <span className="tabular-nums text-muted-foreground">{info.count}</span>
                </span>
              ))}
            </div>
          )}

          <div className={`min-h-0 flex-1 overflow-y-auto px-1 py-2 ${SCROLLBAR_CLS}`}>
            {membersQuery.isPending && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            )}
            {membersQuery.error && (
              <p className="py-8 text-center text-sm text-destructive">组内成员加载失败，请重试</p>
            )}
            {members && members.rows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">该组暂无成员数据</p>
            )}
            {members?.rows.map((p) => (
              <button
                key={p.accession}
                onClick={() => {
                  setDialogGroup(null);
                  openDetail(p.accession);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left text-xs transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
              >
                <span className="shrink-0 font-mono font-semibold text-emerald-700 dark:text-emerald-400">{p.accession}</span>
                <span className="min-w-0 flex-1 truncate" title={p.proteinName}>
                  {p.geneName && <span className="font-medium">{p.geneName} · </span>}
                  {p.proteinName}
                </span>
                <span className="shrink-0 text-muted-foreground">{ORG_SHORT[p.taxonId] ?? ""}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{p.length.toLocaleString()} aa</span>
              </button>
            ))}
            {members && members.total > members.rows.length && (
              <p className="pt-2 text-center text-[10px] text-muted-foreground">
                仅显示前 {members.rows.length} / {members.total} 条成员（按长度降序）
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-[10px] text-muted-foreground">每物种选取长度中位数代表，去重后 ≤12 个</p>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!members || members.rows.length < 2}
              onClick={compareThisGroup}
            >
              <GitCompare className="mr-1 h-3.5 w-3.5" />
              比较此组（≤12）
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
