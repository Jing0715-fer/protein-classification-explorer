"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { CLASS_COLORS, classOf } from "@/lib/protein-types";
import { ORG_SHORT } from "./api";
import { Fragment, useMemo, useState } from "react";
import { ArrowLeftRight, GitCompare, Search, TreePine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LABEL_W = 176;
const COL_W = 68;
const COLS = 10;
const ROW_H = 34;
const LEAF_Y = 168;
const TREE_H = 232;

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

function opacityForCount(n: number): number {
  if (n <= 1) return 0.32;
  if (n === 2) return 0.5;
  if (n === 3) return 0.68;
  if (n === 4) return 0.82;
  return 0.95;
}

export function PhyloView({ ctx }: { ctx: ExplorerCtx }) {
  const { data, setView, setCompareGroup, setCompareMode, openDetail } = ctx;
  const [classFilter, setClassFilter] = useState<Set<string>>(new Set(data.families.map((f) => f.code)));
  const [multiOnly, setMultiOnly] = useState(true);
  const [groupQuery, setGroupQuery] = useState("");
  const [hoverTaxon, setHoverTaxon] = useState<number | null>(null);
  const [cellDialog, setCellDialog] = useState<{ group: string; taxon: number } | null>(null);

  // 直系同源组 -> 物种 -> 蛋白列表
  const groupMap = useMemo(() => {
    const m = new Map<string, Map<number, typeof data.proteins>>();
    for (const p of data.proteins) {
      if (!m.has(p.group)) m.set(p.group, new Map());
      const byOrg = m.get(p.group)!;
      if (!byOrg.has(p.taxonId)) byOrg.set(p.taxonId, []);
      byOrg.get(p.taxonId)!.push(p);
    }
    return m;
  }, [data]);

  const orgByTaxon = useMemo(() => new Map(data.organisms.map((o) => [o.taxonId, o])), [data]);

  // 可见的组（按家族分组）
  const visibleFamilies = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    const result: { code: string; name: string; groups: { group: string; speciesCount: number; cells: Map<number, number> }[] }[] = [];
    for (const cls of data.families) {
      for (const fam of cls.children ?? []) {
        if (!classFilter.has(cls.code)) continue;
        const groups: { group: string; speciesCount: number; cells: Map<number, number> }[] = [];
        for (const [group, byOrg] of groupMap) {
          // 该组是否属于该家族
          const members = [...byOrg.values()].flat();
          if (!members.some((m) => m.familyCode === fam.code)) continue;
          if (multiOnly && byOrg.size < 2) continue;
          if (q && !group.toLowerCase().includes(q) && !fam.name.toLowerCase().includes(q) && !fam.nameEn.toLowerCase().includes(q)) continue;
          const cells = new Map<number, number>();
          for (const [t, list] of byOrg) cells.set(t, list.length);
          groups.push({ group, speciesCount: byOrg.size, cells });
        }
        if (groups.length > 0) {
          groups.sort((a, b) => b.speciesCount - a.speciesCount || a.group.localeCompare(b.group));
          result.push({ code: fam.code, name: fam.name, groups });
        }
      }
    }
    return result;
  }, [data, classFilter, multiOnly, groupQuery, groupMap]);

  const visibleGroupCount = visibleFamilies.reduce((s, f) => s + f.groups.length, 0);

  // ===== 进化树布局 =====
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
      // 单链压缩：只有一个孩子且非叶 → 提升孩子
      if (children.length === 1 && node.children.size === 1) {
        const only = [...node.children.values()][0];
        if (only.children.size > 0 || only.taxon !== undefined) {
          // 将本节点名称并入孩子标签链
          return children[0];
        }
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
    const list: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const brackets: { x1: number; x2: number; y: number }[] = [];
    const walk = (node: LaidNode) => {
      if (node.children.length === 0) return;
      const xs = node.children.map((c) => c.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      brackets.push({ x1: minX, x2: maxX, y: node.y });
      for (const c of node.children) {
        list.push({ x1: c.x, y1: node.y, x2: c.x, y2: c.y });
        walk(c);
      }
    };
    walk(tree);
    return { drops: list, brackets };
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

  const cellDialogProteins = useMemo(() => {
    if (!cellDialog) return [];
    return groupMap.get(cellDialog.group)?.get(cellDialog.taxon) ?? [];
  }, [cellDialog, groupMap]);

  const dialogOrg = cellDialog ? orgByTaxon.get(cellDialog.taxon) : null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* 说明 + 过滤器 */}
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-xl">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <TreePine className="h-4 w-4 text-emerald-600" />
                物种进化树 × 直系同源组覆盖矩阵
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                每行是一个<span className="font-medium text-foreground">直系同源组</span>
                （跨物种的同源蛋白家族），列按物种的<span className="font-medium text-foreground">系统发育关系</span>排列。
                色块表示该物种中该组的蛋白条目数——自左向右即从细菌到人类的演化之路。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="multi-only" checked={multiOnly} onCheckedChange={setMultiOnly} />
                <Label htmlFor="multi-only" className="text-xs text-muted-foreground">
                  仅跨物种保守组
                </Label>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                  placeholder="筛选组名 / 家族"
                  className="h-8 w-44 pl-8 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {data.families.map((c) => {
              const on = classFilter.has(c.code);
              return (
                <button
                  key={c.code}
                  onClick={() => {
                    setClassFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.code)) next.delete(c.code);
                      else next.add(c.code);
                      return next;
                    });
                  }}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all ${
                    on ? "border-transparent font-medium text-white" : "border-border bg-muted/40 text-muted-foreground opacity-60"
                  }`}
                  style={on ? { backgroundColor: CLASS_COLORS[c.code] } : undefined}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: on ? "rgba(255,255,255,.85)" : CLASS_COLORS[c.code] }} />
                  {c.name}
                </button>
              );
            })}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {visibleGroupCount} 个组 · {data.organisms.length} 个物种
            </span>
          </div>
        </div>

        {/* 树 + 矩阵 */}
        <div className="max-h-[700px] overflow-auto rounded-xl border bg-card">
          <div style={{ minWidth: LABEL_W + COLS * COL_W }}>
            {/* 进化树 */}
            <svg
              width="100%"
              height={TREE_H}
              viewBox={`0 0 ${LABEL_W + COLS * COL_W} ${TREE_H}`}
              className="sticky top-0 z-20 block bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
              role="img"
              aria-label="物种系统发育树"
            >
              {/* 分支 */}
              {edges.brackets.map((b, i) => (
                <line key={`b${i}`} x1={b.x1} y1={b.y} x2={b.x2} y2={b.y} stroke="currentColor" className="text-foreground/40" strokeWidth="1.5" />
              ))}
              {edges.drops.map((d, i) => (
                <line key={`d${i}`} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="currentColor" className="text-foreground/40" strokeWidth="1.5" />
              ))}
              {/* 内部节点标签 */}
              {nodeLabels.map((l, i) => (
                <text key={`l${i}`} x={l.x} y={l.y} textAnchor="middle" fontSize="9.5" fill="currentColor" className="text-muted-foreground">
                  {l.text}
                </text>
              ))}
              {/* 叶子 */}
              {data.organisms.map((o, i) => {
                const cx = LABEL_W + i * COL_W + COL_W / 2;
                const hovered = hoverTaxon === o.taxonId;
                return (
                  <g key={o.taxonId} onMouseEnter={() => setHoverTaxon(o.taxonId)} onMouseLeave={() => setHoverTaxon(null)}>
                    <circle cx={cx} cy={LEAF_Y} r={hovered ? 5 : 3.5} fill={hovered ? "#059669" : "currentColor"} className={hovered ? undefined : "text-foreground/70"} />
                    <rect x={cx - COL_W / 2} y={LEAF_Y - 8} width={COL_W} height={52} fill="transparent" />
                    <text x={cx} y={LEAF_Y + 20} textAnchor="middle" fontSize="11" fontWeight={hovered ? 700 : 600} fill="currentColor" className="text-foreground">
                      {ORG_SHORT[o.taxonId] ?? o.commonName}
                    </text>
                    <text x={cx} y={LEAF_Y + 34} textAnchor="middle" fontSize="8.5" fill="currentColor" className="text-muted-foreground">
                      {o.proteinCount} 蛋白
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* 矩阵 */}
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col style={{ width: LABEL_W }} />
                {data.organisms.map((o) => (
                  <col key={o.taxonId} style={{ width: COL_W }} />
                ))}
              </colgroup>
              <tbody>
                {visibleFamilies.map((fam) => (
                  <Fragment key={fam.code}>
                    <tr>
                      <td
                        colSpan={11}
                        className="sticky top-[232px] z-10 border-y bg-muted/60 px-3 py-1.5 text-[11px] font-semibold backdrop-blur"
                      >
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: CLASS_COLORS[classOf(fam.code)] }} />
                        {fam.name}
                        <span className="ml-2 font-normal text-muted-foreground">{fam.groups.length} 组</span>
                      </td>
                    </tr>
                    {fam.groups.map((g) => (
                      <tr key={`${fam.code}-${g.group}`} className="group/row hover:bg-accent/40">
                        <td className="sticky left-0 z-[5] truncate border-b border-border/50 bg-card px-3 py-1 text-left">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="flex w-full items-center gap-1 text-left"
                                onClick={() => {
                                  setCompareGroup(g.group);
                                  setCompareMode("group");
                                  setView("compare");
                                }}
                              >
                                <span className="truncate font-medium">{g.group}</span>
                                <GitCompare className="h-3 w-3 shrink-0 text-emerald-600 opacity-0 transition-opacity group-hover/row:opacity-100" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">
                              点击「{g.group}」进入跨物种比较（{g.speciesCount} 个物种）
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        {data.organisms.map((o) => {
                          const n = g.cells.get(o.taxonId) ?? 0;
                          const colHover = hoverTaxon === o.taxonId;
                          return (
                            <td
                              key={o.taxonId}
                              className="relative border-b border-border/50 p-0.5 text-center"
                              onMouseEnter={() => setHoverTaxon(o.taxonId)}
                              onMouseLeave={() => setHoverTaxon(null)}
                            >
                              {n > 0 ? (
                                <button
                                  onClick={() => setCellDialog({ group: g.group, taxon: o.taxonId })}
                                  className="flex h-7 w-full items-center justify-center rounded text-[10px] font-semibold tabular-nums text-white transition-transform hover:scale-110"
                                  style={{
                                    backgroundColor: CLASS_COLORS[classOf(fam.code)],
                                    opacity: opacityForCount(n),
                                  }}
                                  aria-label={`${ORG_SHORT[o.taxonId]} ${g.group} ${n} 条`}
                                >
                                  {n}
                                </button>
                              ) : (
                                <div className={`mx-auto h-7 w-full rounded border border-dashed border-border/40 ${colHover ? "bg-accent/60" : ""}`} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {visibleFamilies.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center text-muted-foreground">
                      没有匹配的直系同源组，试试调整筛选
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-600" />
          点击色块查看该物种的具体蛋白条目；点击组名直接进入跨物种比较；树结构与列顺序一一对应。
        </p>
      </div>

      {/* 单元格详情弹窗 */}
      <Dialog open={!!cellDialog} onOpenChange={(o) => !o && setCellDialog(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
              {cellDialog?.group}
              <Badge variant="secondary" className="font-normal">
                {dialogOrg?.commonName}
              </Badge>
            </DialogTitle>
            <DialogDescription className="italic">{dialogOrg?.scientificName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {cellDialogProteins.map((p) => (
              <button
                key={p.accession}
                onClick={() => {
                  setCellDialog(null);
                  openDetail(p.accession);
                }}
                className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left text-xs transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
              >
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{p.accession}</span>
                <span className="min-w-0 flex-1 truncate">{p.proteinName}</span>
                {p.rep && <span className="text-[9px] text-amber-500" title="组代表">★</span>}
                <span className="shrink-0 text-muted-foreground tabular-nums">{p.length} aa</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
