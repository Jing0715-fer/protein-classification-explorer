"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { FamilyTree } from "./FamilyTree";
import type { FamilyNodeDTO } from "@/lib/protein-types";
import { CLASS_COLORS, classOf } from "@/lib/protein-types";
import { fetchProteinList, findFamilyPath, flattenFamilies, ORG_COLORS, ORG_SHORT } from "./api";
import { useDebouncedValue } from "./shared";
import { useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const PAGE_SIZE = 50;
const MAX_COMPARE = 12;

type SortField = "default" | "length" | "mass" | "accession" | "name" | "gene";

const SCROLLBAR_CLS =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent";

function pageWindow(current: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: (number | "...")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(totalPages - 1, current + 1);
  if (from > 2) items.push("...");
  for (let p = from; p <= to; p++) items.push(p);
  if (to < totalPages - 1) items.push("...");
  items.push(totalPages);
  return items;
}

export function FamilyTreeView({ ctx }: { ctx: ExplorerCtx }) {
  const {
    data,
    familyCode,
    setFamilyCode,
    taxonFilter,
    setTaxonFilter,
    query,
    setQuery,
    compareIds,
    toggleCompare,
    openDetail,
  } = ctx;

  // 搜索直接写全局 query（即时回显），网络请求用 300ms 防抖值；
  // 家族/物种切换时重置页码（渲染期间调整 state，React 官方模式，不重挂载保留树展开状态）
  const [page, setPage] = useState(1);
  const resetKey = `${familyCode ?? "all"}|${taxonFilter ?? "all"}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }
  const [sort, setSort] = useState<SortField>("default");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const tableRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  const listQuery = useQuery({
    queryKey: ["proteinList", familyCode, taxonFilter, debouncedQuery, page, PAGE_SIZE, sort, dir],
    queryFn: () =>
      fetchProteinList({
        family: familyCode,
        taxon: taxonFilter,
        q: debouncedQuery,
        page,
        pageSize: PAGE_SIZE,
        sort,
        dir,
      }),
    placeholderData: keepPreviousData,
  });

  const list = listQuery.data ?? null;
  const isFetching = listQuery.isFetching;
  const error = listQuery.error ? (listQuery.error as Error).message : null;

  const famByCode = useMemo(() => flattenFamilies(data.families), [data]);

  const selectedNode = useMemo<FamilyNodeDTO | null>(() => famByCode.get(familyCode ?? "") ?? null, [famByCode, familyCode]);

  /** 面包屑：大类 → 超家族 → 家族 → 亚家族 */
  const familyPath = useMemo(() => (familyCode ? findFamilyPath(data.families, familyCode) : null), [data, familyCode]);

  /** chips 计数：节点 byOrganism 已递归聚合（bootstrap）；无 → 物种总数 */
  const chipCounts = useMemo(() => {
    const m = new Map<number, number>();
    if (selectedNode) {
      for (const [t, n] of Object.entries(selectedNode.byOrganism)) m.set(Number(t), n);
    } else {
      for (const o of data.organisms) m.set(o.taxonId, o.proteinCount);
    }
    return m;
  }, [selectedNode, data]);

  const chipTotal = useMemo(() => {
    if (!selectedNode) return data.stats.totalProteins;
    return [...chipCounts.values()].reduce((s, n) => s + n, 0);
  }, [selectedNode, chipCounts, data]);

  const gotoPage = (p: number) => {
    setPage(p);
    if (tableRef.current) tableRef.current.scrollTo({ top: 0 });
  };

  const toggleSort = (field: Exclude<SortField, "default">) => {
    if (sort === field) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setDir("asc");
    }
  };

  const sortIcon = (field: Exclude<SortField, "default">) =>
    sort === field ? (
      dir === "asc" ? (
        <ArrowUp className="h-3 w-3 text-primary" />
      ) : (
        <ArrowDown className="h-3 w-3 text-primary" />
      )
    ) : null;

  const totalPages = list?.totalPages ?? 1;
  const hasFilter = !!(familyCode || taxonFilter || query);

  const renderBody = () => {
    if (error) {
      return (
        <tr>
          <td colSpan={10} className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-destructive">蛋白列表加载失败</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => listQuery.refetch()}>
              重试
            </Button>
          </td>
        </tr>
      );
    }
    if (!list) {
      // 初始加载骨架
      return Array.from({ length: 10 }).map((_, i) => (
        <tr key={`sk-${i}`} className="border-b border-border/60">
          {Array.from({ length: 10 }).map((__, j) => (
            <td key={j} className="px-2.5 py-2.5">
              <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${40 + ((i * 7 + j * 13) % 50)}%` }} />
            </td>
          ))}
        </tr>
      ));
    }
    if (list.rows.length === 0) {
      return (
        <tr>
          <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
            {hasFilter ? "当前筛选条件下没有蛋白，试试清除筛选或切换物种" : "没有匹配的蛋白"}
          </td>
        </tr>
      );
    }
    return list.rows.map((p) => {
      const inCompare = compareIds.includes(p.accession);
      const compareFull = !inCompare && compareIds.length >= MAX_COMPARE;
      const fam = famByCode.get(p.familyCode);
      return (
        <tr
          key={p.accession}
          className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/60 max-sm:[&>td]:py-3.5 ${
            isFetching ? "opacity-60" : ""
          }`}
          onClick={() => openDetail(p.accession)}
        >
          <td className="px-2.5 py-1.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={inCompare}
              disabled={compareFull}
              onCheckedChange={() => toggleCompare(p.accession)}
              aria-label={`将 ${p.accession} 加入比较`}
              title={compareFull ? `比较上限 ${MAX_COMPARE} 个` : "加入跨物种比较"}
              className="h-3.5 w-3.5"
            />
          </td>
          <td className="whitespace-nowrap px-2.5 py-1.5">
            <span className="font-mono font-semibold text-primary">{p.accession}</span>
          </td>
          <td className="max-w-[260px] truncate px-2.5 py-1.5" title={p.proteinName}>
            {p.proteinName}
          </td>
          <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[11px]">{p.geneName || "—"}</td>
          <td className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: ORG_COLORS[p.taxonId] ?? "#94a3b8" }} />
            {ORG_SHORT[p.taxonId] ?? "—"}
          </td>
          <td className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: CLASS_COLORS[classOf(p.familyCode)] }} />
            {fam?.name ?? p.familyCode}
          </td>
          <td className="max-w-[120px] truncate px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground" title={p.orthodb || undefined}>
            {p.orthodb || "—"}
          </td>
          <td className="px-2.5 py-1.5 text-right tabular-nums">{p.length.toLocaleString()}</td>
          <td className="px-2.5 py-1.5 text-right tabular-nums">{p.massKda.toLocaleString()}</td>
          <td className="px-2.5 py-1.5 text-right">
            {p.hasEC ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/5 px-1 py-0 font-mono text-[9px] font-semibold text-primary" title="含酶学委员会编号 EC">
                EC
              </Badge>
            ) : (
              <span className="text-muted-foreground/40">—</span>
            )}
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[290px_1fr]">
      {/* 左侧：分类树 */}
      <div className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <h2 className="overline-label !text-foreground">分类体系</h2>
          <span className="font-mono text-[10px] text-muted-foreground" title="大类 → 亚类（按运输机制/功能类别分组）→ 超群/超家族 → 家族 → 亚家族（UniProt 官方层级链）">
            {data.stats.superfamilyCount.toLocaleString()} SF · {data.stats.familyCount.toLocaleString()} FAM
          </span>
        </div>
        <ScrollArea className={`h-[540px] px-2 py-2 ${SCROLLBAR_CLS}`}>
          <FamilyTree
            nodes={data.families}
            selected={familyCode}
            onSelect={(c) => setFamilyCode(c === familyCode ? null : c)}
          />
        </ScrollArea>
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border px-3 py-2">
          {data.families.map((c) => (
            <span key={c.code} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLASS_COLORS[c.code] }} />
              {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* 右侧：蛋白列表（服务端分页） */}
      <div className="min-w-0 border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[15px] font-semibold tracking-tight">
              {familyPath && familyPath.length > 0 ? (
                <span className="inline-flex flex-wrap items-center gap-x-1">
                  {familyPath.map((n, i) => (
                    <span key={n.code} className="inline-flex items-center gap-1">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/60" />}
                      <button
                        className={
                          i === familyPath.length - 1
                            ? "hover:underline"
                            : "text-muted-foreground hover:text-foreground hover:underline"
                        }
                        style={i === 0 ? { color: CLASS_COLORS[n.code] } : undefined}
                        onClick={() => i < familyPath.length - 1 && setFamilyCode(n.code)}
                        title={n.nameEn}
                      >
                        {n.name}
                      </button>
                    </span>
                  ))}
                </span>
              ) : (
                "全部蛋白"
              )}
            </h2>
            <Badge variant="secondary" className="font-mono tabular-nums">
              {list ? `${list.total.toLocaleString()} 条` : "…"}
            </Badge>
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setFamilyCode(null);
                  setTaxonFilter(null);
                  setQuery("");
                  setPage(1);
                }}
              >
                <X className="h-3 w-3" /> 清除筛选
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索名称 / 基因 / 登录号"
                  className="h-10 w-44 pl-8 text-xs sm:h-8 sm:w-56"
                />
              </div>
            </div>
          </div>

          {familyPath && familyPath.length > 1 && (
            <p className="text-xs leading-relaxed text-muted-foreground" title="UniProt 官方家族层级链">
              UniProt 官方层级：{familyPath.map((n) => n.nameEn || n.name).join(" → ")}
            </p>
          )}

          {/* 物种筛选 chips */}
          <div className={`flex flex-wrap items-center gap-1.5 pb-0.5 ${SCROLLBAR_CLS}`}>
            <button
              className={`h-11 shrink-0 border px-2.5 text-[11px] font-medium transition-colors sm:h-7 ${
                taxonFilter === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/30"
              }`}
              onClick={() => setTaxonFilter(null)}
            >
              全部物种 {chipTotal.toLocaleString()}
            </button>
            {data.organisms.map((o) => {
              const n = chipCounts.get(o.taxonId) ?? 0;
              const active = taxonFilter === o.taxonId;
              return (
                <button
                  key={o.taxonId}
                  disabled={n === 0}
                  title={`${o.commonName} · ${o.scientificName}：${n.toLocaleString()} 条`}
                  className={`flex h-11 shrink-0 items-center gap-1.5 border px-2.5 text-[11px] transition-colors disabled:opacity-35 sm:h-7 ${
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                  }`}
                  onClick={() => setTaxonFilter(active ? null : o.taxonId)}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: taxonFilter === null ? ORG_COLORS[o.taxonId] : "currentColor" }}
                  />
                  {o.commonName} {n.toLocaleString()}
                </button>
              );
            })}
          </div>
        </div>

        {/* 蛋白表格（服务端分页）：学术表头，上框线加重 */}
        <div ref={tableRef} className={`max-h-[560px] overflow-auto ${SCROLLBAR_CLS}`}>
          <table className="data-table w-full min-w-[820px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="[&>th]:border-b-2 [&>th]:border-border [&>th]:px-2.5 [&>th]:py-2.5">
                <th className="w-8" aria-label="加入比较" />
                <th>
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("accession")}>
                    登录号 {sortIcon("accession")}
                  </button>
                </th>
                <th>
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("name")}>
                    蛋白名称 {sortIcon("name")}
                  </button>
                </th>
                <th>
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("gene")}>
                    基因 {sortIcon("gene")}
                  </button>
                </th>
                <th>物种</th>
                <th>家族</th>
                <th>同源组</th>
                <th className="text-right">
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("length")}>
                    长度 aa {sortIcon("length")}
                  </button>
                </th>
                <th className="text-right">
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("mass")}>
                    kDa {sortIcon("mass")}
                  </button>
                </th>
                <th className="text-right">EC</th>
              </tr>
            </thead>
            <tbody>{renderBody()}</tbody>
          </table>
        </div>

        {/* 分页控件 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground sm:px-4">
          <span>
            {list ? (
              <>
                共 <span className="font-medium text-foreground tabular-nums">{list.total.toLocaleString()}</span> 条 · 第{" "}
                <span className="font-medium text-foreground tabular-nums">{list.page}</span>/
                <span className="tabular-nums">{list.totalPages}</span> 页 · 每页 {PAGE_SIZE} 条
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
              disabled={!list || page <= 1}
              onClick={() => gotoPage(page - 1)}
              aria-label="上一页"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {pageWindow(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="px-1">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => gotoPage(p)}
                  className={`h-11 min-w-11 border px-1.5 font-mono text-[11px] tabular-nums transition-colors sm:h-7 sm:min-w-7 ${
                    p === page
                      ? "border-primary bg-primary font-semibold text-primary-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-7 sm:w-7"
              disabled={!list || page >= totalPages}
              onClick={() => gotoPage(page + 1)}
              aria-label="下一页"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground sm:px-4">
          点击行查看 UniProt 详情（首次实时抓取约 2 秒，之后走本地缓存） · 勾选加入跨物种比较（≤{MAX_COMPARE}）
        </div>
      </div>
    </div>
  );
}
