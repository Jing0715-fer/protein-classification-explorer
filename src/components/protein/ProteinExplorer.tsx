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
import { Dna, Search, Network, GitCompare, ListTree } from "lucide-react";
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
        {/* 顶部导航 */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <Dna className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <h1 className="text-base font-bold tracking-tight sm:text-lg">蛋白分类树浏览器</h1>
                <p className="hidden text-[11px] text-muted-foreground sm:block">
                  全量蛋白组 · 10 种模式生物 Swiss-Prot reviewed 蛋白组
                </p>
              </div>
            </div>

            <nav className="order-3 w-full sm:order-none sm:ml-2 sm:w-auto" aria-label="视图切换">
              <div className="flex rounded-lg border bg-muted/40 p-0.5" role="tablist">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={view === t.key}
                    onClick={() => setView(t.key)}
                    className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 sm:flex-none sm:text-sm ${
                      view === t.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="h-11 gap-2 text-muted-foreground sm:h-9"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">搜索蛋白 / 家族 / 物种</span>
                <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 sm:py-6">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
              <p className="font-medium text-destructive">数据加载失败</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
                重试
              </Button>
            </div>
          )}

          {!data && !error && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                <Skeleton className="h-[480px] rounded-xl" />
                <Skeleton className="h-[480px] rounded-xl" />
              </div>
            </div>
          )}

          {data && ctx && (
            <div className="space-y-5">
              <StatsBar stats={data.stats} />
              {view === "tree" && <FamilyTreeView ctx={ctx} />}
              {view === "phylo" && <PhyloView ctx={ctx} />}
              {view === "compare" && <CompareView ctx={ctx} />}
            </div>
          )}
        </main>

        <footer className="mt-auto border-t bg-muted/30">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              数据来源：
              <a
                href="https://www.uniprot.org"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                UniProtKB / Swiss-Prot
              </a>
              <span className="mx-1.5 text-border">·</span>
              全量 reviewed 蛋白组
              {stats ? (
                <>
                  <span className="mx-1.5 text-border">·</span>
                  {stats.totalProteins.toLocaleString()} 条 · {stats.organismCount} 物种 · {stats.superfamilyCount.toLocaleString()} 超家族 ·{" "}
                  {stats.familyCount.toLocaleString()} 家族 · {stats.orthologGroups.toLocaleString()} 直系同源组
                </>
              ) : null}
            </p>
            <p>仅供科研可视化演示 · Next.js + Prisma + Recharts 构建</p>
          </div>
        </footer>

        {data && ctx && (
          <>
            <CommandSearch open={searchOpen} setOpen={setSearchOpen} ctx={ctx} />
            <ProteinDetailSheet ctx={ctx} />
            {/* 比较选择浮层 */}
            {compareIds.length > 0 && view !== "compare" && (
              <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2">
                <div className="flex items-center gap-3 rounded-full border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur">
                  <span className="shrink-0 text-sm font-medium">
                    已选 <span className="text-emerald-600">{compareIds.length}</span>
                    <span className="text-muted-foreground">/{MAX_COMPARE}</span> 个蛋白
                  </span>
                  <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
                    {compareIds.slice(0, 6).map((id) => (
                      <span
                        key={id}
                        className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {id}
                      </span>
                    ))}
                    {compareIds.length > 6 && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">+{compareIds.length - 6}</span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-11 shrink-0 px-2 text-xs sm:h-7" onClick={clearCompare}>
                    清空
                  </Button>
                  <Button
                    size="sm"
                    className="h-11 shrink-0 rounded-full bg-emerald-600 px-4 text-xs hover:bg-emerald-700 sm:h-8"
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
