"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { CLASS_COLORS, classOf } from "@/lib/protein-types";
import { ORG_COLORS, searchAll } from "./api";
import { useDebouncedValue } from "./shared";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Layers, Loader2, Microscope, SearchIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandSearch({
  open,
  setOpen,
  ctx,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  ctx: ExplorerCtx;
}) {
  const { data, openDetail, setView, setFamilyCode, setTaxonFilter, setQuery } = ctx;
  const [input, setInput] = useState("");
  const debounced = useDebouncedValue(input, 250);

  const searchQuery = useQuery({
    queryKey: ["globalSearch", debounced],
    queryFn: () => searchAll(debounced.trim()),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 60 * 1000,
  });
  const results = searchQuery.data ?? null;
  const searching = searchQuery.isFetching && debounced.trim().length >= 2;
  const hasQuery = debounced.trim().length >= 2;

  // 家族计数（服务端 search 不返回计数，从 bootstrap 树递归查询）
  const famCountByCode = useMemo(() => {
    const m = new Map<string, number>();
    const walk = (nodes: typeof data.families) => {
      for (const n of nodes) {
        m.set(n.code, (n.children?.length ?? 0) > 0 ? n.totalCount : n.count);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(data.families);
    return m;
  }, [data]);

  const sciByTaxon = useMemo(() => new Map(data.organisms.map((o) => [o.taxonId, o.scientificName])), [data]);

  const hasResults =
    !!results && (results.proteins.length > 0 || results.families.length > 0 || results.organisms.length > 0);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setInput("");
      }}
      title="全库搜索"
      description="搜索全量蛋白组中的蛋白条目、蛋白家族与模式生物"
    >
      <CommandInput
        placeholder="搜索蛋白（登录号 / 基因 / 名称）、家族、物种…（至少 2 个字符）"
        value={input}
        onValueChange={setInput}
      />
      <CommandList>
        {!hasQuery && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
            <SearchIcon className="h-6 w-6 opacity-40" />
            <p className="text-xs">输入至少 2 个字符，在全量蛋白组中搜索</p>
            <p className="text-[10px]">
              {data.stats.totalProteins.toLocaleString()} 条蛋白 · {data.stats.superfamilyCount.toLocaleString()} 超家族 · {data.stats.familyCount.toLocaleString()} 叶子家族 ·{" "}
              {data.stats.organismCount} 种模式生物
            </p>
          </div>
        )}

        {hasQuery && searching && !results && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 搜索中…
          </div>
        )}

        {hasQuery && !searching && !hasResults && <CommandEmpty>无匹配结果，换个关键词试试</CommandEmpty>}

        {hasQuery && hasResults && (
          <>
            {results!.proteins.length > 0 && (
              <CommandGroup heading={`蛋白条目（${results!.proteins.length}）`}>
                {results!.proteins.map((p) => (
                  <CommandItem
                    key={p.accession}
                    value={`${p.accession} ${p.entryName} ${p.geneName} ${p.proteinName}`}
                    onSelect={() => {
                      openDetail(p.accession);
                      setOpen(false);
                    }}
                    className="gap-2 text-xs"
                  >
                    <FlaskConical className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="shrink-0 font-mono font-semibold">{p.accession}</span>
                    <span className="min-w-0 flex-1 truncate">{p.proteinName}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{p.geneName || p.entryName}</span>
                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ORG_COLORS[p.taxonId] ?? "#94a3b8" }} />
                      {p.length.toLocaleString()} aa
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results!.families.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={`蛋白家族（${results!.families.length}）`}>
                  {results!.families.map((f) => (
                    <CommandItem
                      key={f.code}
                      value={`${f.name} ${f.nameEn} ${f.code}`}
                      onSelect={() => {
                        setFamilyCode(f.code);
                        setView("tree");
                        setQuery("");
                        setOpen(false);
                      }}
                      className="gap-2 text-xs"
                    >
                      <Layers className="h-3.5 w-3.5 shrink-0" style={{ color: CLASS_COLORS[classOf(f.code)] }} />
                      <span className="font-medium">{f.name}</span>
                      <span className="text-muted-foreground">{f.nameEn}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                        {(famCountByCode.get(f.code) ?? 0).toLocaleString()}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {results!.organisms.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={`模式生物（${results!.organisms.length}）`}>
                  {results!.organisms.map((o) => (
                    <CommandItem
                      key={o.taxonId}
                      value={`${o.commonName} ${sciByTaxon.get(o.taxonId) ?? ""}`}
                      onSelect={() => {
                        setTaxonFilter(o.taxonId);
                        setView("tree");
                        setQuery("");
                        setOpen(false);
                      }}
                      className="gap-2 text-xs"
                    >
                      <Microscope className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="font-medium">{o.commonName}</span>
                      <span className="truncate italic text-muted-foreground">{sciByTaxon.get(o.taxonId)}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                        {o.proteinCount.toLocaleString()}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}

        <CommandSeparator />
        <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-muted-foreground">
          <SearchIcon className="h-3 w-3" />
          全库 {data.stats.totalProteins.toLocaleString()} 条蛋白 · 快捷键 ⌘K / Ctrl+K · 回车选择第一条
        </div>
      </CommandList>
    </CommandDialog>
  );
}
