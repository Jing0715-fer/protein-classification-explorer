"use client";

import { StatsBar } from "./StatsBar";
import { FamilyTreeView } from "./FamilyTreeView";
import { PhyloView } from "./PhyloView";
import { CompareView } from "./CompareView";
import { ProteinDetailSheet } from "./ProteinDetailSheet";
import { CommandSearch } from "./CommandSearch";
import { fetchBootstrap } from "./api";
import type { BootstrapDTO } from "@/lib/protein-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Search, Network, GitCompare, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/theme-toggle";

export type ViewMode = "tree" | "phylo" | "compare";

export interface ExplorerCtx {
  data: BootstrapDTO;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  familyCode: string | null;
  setFamilyCode: (c: string | null) => void;
  taxonFilter: number | null;
  setTaxonFilter: (t: number | null) => void;
  query: string;
  setQuery: (q: string) => void;
  detailAcc: string | null;
  setDetailAcc: (acc: string | null) => void;
  openDetail: (acc: string) => void;
  /** 浮层手动勾选的比较候选 */
  compareIds: string[];
  toggleCompare: (acc: string) => void;
  clearCompare: () => void;
  /** 实际参与比较的登录号列表（手动或组模式写入） */
  compareAccs: string[];
  setCompareAccs: (accs: string[]) => void;
}

const MAX_COMPARE = 12;

export function ProteinExplorer() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } },
      })
  );
  const [data, setData] = useState<BootstrapDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("tree");
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [taxonFilter, setTaxonFilter] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [detailAcc, setDetailAcc] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareAccs, setCompareAccs] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetchBootstrap()
      .then(setData)
      .catch((e) => setError(e.message ?? "加载失败"));
  }, []);

  // 全局搜索快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openDetail = useCallback((acc: string) => setDetailAcc(acc.toUpperCase()), []);

  const toggleCompare = useCallback((acc: string) => {
    setCompareIds((prev) => {
      const key = acc.toUpperCase();
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, key];
    });
  }, []);

  const clearCompare = useCallback(() => setCompareIds([]), []);

  const setCompareAccsSafe = useCallback((accs: string[]) => {
    setCompareAccs(accs.map((a) => a.toUpperCase()).slice(0, MAX_COMPARE));
  }, []);

  const ctx = useMemo<ExplorerCtx | null>(() => {
    if (!data) return null;
    return {
      data,
      view,
      setView,
      familyCode,
      setFamilyCode,
      taxonFilter,
      setTaxonFilter,
      query,
      setQuery,
      detailAcc,
      setDetailAcc,
      openDetail,
      compareIds,
      toggleCompare,
      clearCompare,
      compareAccs,
      setCompareAccs: setCompareAccsSafe,
    };
  }, [data, view, familyCode, taxonFilter, query, detailAcc, openDetail, compareIds, toggleCompare, clearCompare, compareAccs, setCompareAccsSafe]);

  const tabs: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: "tree", label: "家族分类树", icon: <ListTree className="h-4 w-4" /> },
    { key: "phylo", label: "进化视角", icon: <Network className="h-4 w-4" /> },
    { key: "compare", label: "跨物种比较", icon: <GitCompare className="h-4 w-4" /> },
  ];

  const stats = data?.stats;

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="bottom-center" richColors />
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {/* 期刊式页头 */}
        <header className="border-b border-border">
          <div className="mx-auto max-w-[1400px] px-4 pt-10 pb-6 sm:px-6 sm:pt-14 sm:pb-8">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="overline-label flex items-center gap-2.5">
                  <span className="inline-block h-px w-8 bg-primary/60" aria-hidden />
                  Proteome Atlas · UniProtKB Swiss-Prot
                </p>
                <h1 className="mt-3 font-serif text-4xl leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
                  蛋白质分类图谱
                </h1>
                <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground sm:text-[15px]">
                  十种模式生物的全量 reviewed 蛋白组，依 UniProt 官方家族链组织为
                  <span className="text-foreground"> 超家族 → 家族 → 亚家族</span>
                  的层级谱系——从溶质载体超群到 G 蛋白偶联受体；以 NCBI Taxonomy 校准的系统发生树纵览物种进化关系，对照 OrthoDB 直系同源组跨物种追踪，并在详情页深读跨膜区序列特征图谱与疾病、互作等深度注释。
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-2 md:flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchOpen(true)}
                  className="h-9 gap-2 border-border bg-transparent font-normal text-muted-foreground hover:border-primary/40 hover:text-foreground"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>检索</span>
                  <kbd className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
                </Button>
                <ThemeToggle />
              </div>
            </div>

            {/* 元数据行 */}
            {stats && (
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11.5px] tracking-wide text-muted-foreground">
                <span className="font-medium text-foreground">{stats.totalProteins.toLocaleString()}</span>
                <span>proteins</span>
                <span aria-hidden className="text-border">/</span>
                <span className="font-medium text-foreground">{stats.organismCount}</span>
                <span>organisms</span>
                <span aria-hidden className="text-border">/</span>
                <span className="font-medium text-foreground">{stats.superfamilyCount.toLocaleString()}</span>
                <span>superfamilies</span>
                <span aria-hidden className="text-border">/</span>
                <span className="font-medium text-foreground">{stats.familyCount.toLocaleString()}</span>
                <span>families</span>
                <span aria-hidden className="text-border">/</span>
                <span className="font-medium text-foreground">{stats.orthologGroups.toLocaleString()}</span>
                <span>ortholog groups</span>
                <span aria-hidden className="text-border">/</span>
                <span>{stats.dataDate}</span>
              </div>
            )}
          </div>
        </header>

        {/* 粘性视图导航：下划线式 */}
        <div className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto flex max-w-[1400px] items-center gap-1 px-4 sm:px-6">
            <nav aria-label="视图切换" role="tablist" className="-mb-px flex min-h-[48px] flex-1 items-stretch gap-1 overflow-x-auto sm:gap-2">
              {tabs.map((t) => {
                const active = view === t.key;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setView(t.key)}
                    className={`relative flex shrink-0 items-center gap-2 px-3 text-[13px] transition-colors sm:px-4 ${
                      active ? "font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                    <span
                      aria-hidden
                      className={`absolute inset-x-2 bottom-0 h-[2px] transition-colors ${
                        active ? "bg-primary" : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
            <div className="flex shrink-0 items-center gap-1.5 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="h-11 w-11 p-0 text-muted-foreground"
                aria-label="检索"
              >
                <Search className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {error && (
            <div className="border border-destructive/40 bg-destructive/5 p-8 text-center">
              <p className="font-serif text-xl text-destructive">数据加载失败</p>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-5" variant="outline" onClick={() => window.location.reload()}>
                重试
              </Button>
            </div>
          )}

          {!data && !error && (
            <div className="space-y-6">
              <div className="h-16 border-y border-border" />
              <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
                <div className="space-y-2.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 rounded-sm" />
                  ))}
                </div>
                <div className="space-y-2.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 rounded-sm" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {data && ctx && (
            <div className="space-y-7">
              <StatsBar stats={data.stats} />
              {view === "tree" && <FamilyTreeView ctx={ctx} />}
              {view === "phylo" && <PhyloView ctx={ctx} />}
              {view === "compare" && <CompareView ctx={ctx} />}
            </div>
          )}
        </main>

        {/* 页脚：极简单行 */}
        <footer className="mt-auto border-t border-border">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-1.5 px-4 py-4 text-[11.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              数据
              <a
                href="https://www.uniprot.org"
                target="_blank"
                rel="noreferrer"
                className="mx-1 font-medium text-foreground underline decoration-border underline-offset-2 transition-colors hover:decoration-primary"
              >
                UniProtKB / Swiss-Prot
              </a>
              · OrthoDB · eggNOG · PDB
              {stats && (
                <span className="ml-1 font-mono">
                  （{stats.totalProteins.toLocaleString()} entries · {stats.dataDate}）
                </span>
              )}
            </p>
            <p className="font-mono tracking-wide">Proteome Atlas · 科研可视化演示</p>
          </div>
        </footer>

        {data && ctx && (
          <>
            <CommandSearch open={searchOpen} setOpen={setSearchOpen} ctx={ctx} />
            <ProteinDetailSheet ctx={ctx} />
            {/* 比较选择浮层 */}
            {compareIds.length > 0 && view !== "compare" && (
              <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2">
                <div className="flex items-center gap-3 border border-border bg-card px-4 py-2.5 shadow-lg">
                  <span className="shrink-0 text-sm font-medium">
                    已选 <span className="font-mono text-primary">{compareIds.length}</span>
                    <span className="text-muted-foreground">/{MAX_COMPARE}</span> 个蛋白
                  </span>
                  <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
                    {compareIds.slice(0, 6).map((id) => (
                      <span
                        key={id}
                        className="shrink-0 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {id}
                      </span>
                    ))}
                    {compareIds.length > 6 && (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">+{compareIds.length - 6}</span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-11 shrink-0 px-2 text-xs sm:h-7" onClick={clearCompare}>
                    清空
                  </Button>
                  <Button
                    size="sm"
                    className="h-11 shrink-0 bg-primary px-4 text-xs text-primary-foreground hover:bg-primary/90 sm:h-8"
                    onClick={() => {
                      setCompareAccsSafe(compareIds);
                      setView("compare");
                    }}
                  >
                    开始比较 →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </QueryClientProvider>
  );
}
