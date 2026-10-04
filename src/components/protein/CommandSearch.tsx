"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { CLASS_COLORS, classOf } from "@/lib/protein-types";
import { ORG_SHORT } from "./api";
import { useMemo } from "react";
import { FlaskConical, Layers, Microscope, SearchIcon } from "lucide-react";
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

  const proteins = useMemo(() => data.proteins, [data]);
  const families = useMemo(() => {
    const list: { code: string; name: string; nameEn: string; count: number }[] = [];
    for (const c of data.families) {
      list.push({ code: c.code, name: c.name, nameEn: c.nameEn, count: c.totalCount });
      for (const f of c.children ?? []) list.push({ code: f.code, name: f.name, nameEn: f.nameEn, count: f.count });
    }
    return list;
  }, [data]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="全库搜索"
      description="搜索蛋白条目、蛋白家族与模式生物"
    >
      <CommandInput placeholder="搜索蛋白（登录号 / 基因 / 名称）、家族、物种…" />
      <CommandList>
        <CommandEmpty>没有找到匹配结果</CommandEmpty>

        <CommandGroup heading="蛋白条目">
          {proteins.slice(0, 500).map((p) => (
            <CommandItem
              key={p.accession}
              value={`${p.accession} ${p.entryName} ${p.geneName} ${p.proteinName} ${p.group}`}
              onSelect={() => {
                openDetail(p.accession);
                setOpen(false);
              }}
              className="gap-2 text-xs"
            >
              <FlaskConical className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="font-mono font-semibold">{p.accession}</span>
              <span className="min-w-0 flex-1 truncate">{p.proteinName}</span>
              <span className="shrink-0 text-muted-foreground">{ORG_SHORT[p.taxonId] ?? ""}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="蛋白家族">
          {families.map((f) => (
            <CommandItem
              key={f.code}
              value={`${f.name} ${f.nameEn} ${f.code}`}
              onSelect={() => {
                setView("tree");
                setFamilyCode(f.code);
                setQuery("");
                setOpen(false);
              }}
              className="gap-2 text-xs"
            >
              <Layers className="h-3.5 w-3.5 shrink-0" style={{ color: CLASS_COLORS[classOf(f.code)] }} />
              <span className="font-medium">{f.name}</span>
              <span className="text-muted-foreground">{f.nameEn}</span>
              <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">{f.count}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="模式生物">
          {data.organisms.map((o) => (
            <CommandItem
              key={o.taxonId}
              value={`${o.commonName} ${o.scientificName}`}
              onSelect={() => {
                setView("tree");
                setTaxonFilter(o.taxonId);
                setFamilyCode(null);
                setQuery("");
                setOpen(false);
              }}
              className="gap-2 text-xs"
            >
              <Microscope className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="font-medium">{o.commonName}</span>
              <span className="italic text-muted-foreground">{o.scientificName}</span>
              <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                {o.proteinCount}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-muted-foreground">
          <SearchIcon className="h-3 w-3" />
          全库 {data.proteins.length} 条蛋白 · {families.length} 个分类节点 · 快捷键 ⌘K / Ctrl+K
        </div>
      </CommandList>
    </CommandDialog>
  );
}
