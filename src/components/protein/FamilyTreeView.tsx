"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { FamilyTree } from "./FamilyTree";
import { CLASS_COLORS, classOf } from "@/lib/protein-types";
import type { ProteinLite } from "@/lib/protein-types";
import { ORG_SHORT } from "./api";
import { useMemo, useState } from "react";
import { ArrowDownUp, Check, ExternalLink, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type SortKey = "default" | "length" | "massKda" | "accession";

function inFamily(code: string, sel: string | null): boolean {
  if (!sel) return true;
  if (sel.includes(".")) return code === sel;
  return classOf(code) === sel;
}

export function FamilyTreeView({ ctx }: { ctx: ExplorerCtx }) {
  const { data, familyCode, setFamilyCode, taxonFilter, setTaxonFilter, query, setQuery, compareIds, toggleCompare, openDetail } = ctx;
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortAsc, setSortAsc] = useState(true);

  const orgByTaxon = useMemo(() => new Map(data.organisms.map((o) => [o.taxonId, o])), [data]);
  const famByCode = useMemo(() => {
    const m = new Map<string, { name: string; nameEn: string }>();
    for (const c of data.families) {
      m.set(c.code, { name: c.name, nameEn: c.nameEn });
      for (const f of c.children ?? []) m.set(f.code, { name: f.name, nameEn: f.nameEn });
    }
    return m;
  }, [data]);

  const countByTaxon = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of data.proteins) {
      if (!inFamily(p.familyCode, familyCode)) continue;
      m.set(p.taxonId, (m.get(p.taxonId) ?? 0) + 1);
    }
    return m;
  }, [data, familyCode]);

  const proteins = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data.proteins.filter((p) => {
      if (!inFamily(p.familyCode, familyCode)) return false;
      if (taxonFilter && p.taxonId !== taxonFilter) return false;
      if (q) {
        const hay = `${p.accession} ${p.entryName} ${p.geneName} ${p.proteinName} ${p.group}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const orgRank = (t: number) => orgByTaxon.get(t)?.orderRank ?? 99;
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "length":
          return sortAsc ? a.length - b.length : b.length - a.length;
        case "massKda":
          return sortAsc ? a.massKda - b.massKda : b.massKda - a.massKda;
        case "accession":
          return sortAsc ? a.accession.localeCompare(b.accession) : b.accession.localeCompare(a.accession);
        default:
          return (
            Number(b.rep) - Number(a.rep) ||
            a.familyCode.localeCompare(b.familyCode, undefined, { numeric: true }) ||
            orgRank(a.taxonId) - orgRank(b.taxonId) ||
            a.accession.localeCompare(b.accession)
          );
      }
    });
    return list;
  }, [data, familyCode, taxonFilter, query, sortKey, sortAsc, orgByTaxon]);

  const selectedNode = useMemo(() => {
    for (const c of data.families) {
      if (c.code === familyCode) return c;
      for (const f of c.children ?? []) if (f.code === familyCode) return f;
    }
    return null;
  }, [data, familyCode]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
      {/* 左侧：分类树 */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <h2 className="text-sm font-semibold">蛋白家族分类体系</h2>
          <span className="text-[10px] text-muted-foreground">{data.stats.familyCount} 个家族</span>
        </div>
        <ScrollArea className="h-[540px] px-2 py-2">
          <FamilyTree nodes={data.families} selected={familyCode} onSelect={(c) => setFamilyCode(c === familyCode ? null : c)} />
        </ScrollArea>
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2">
          {data.families.map((c) => (
            <span key={c.code} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLASS_COLORS[c.code] }} />
              {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* 右侧：蛋白列表 */}
      <div className="min-w-0 rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">
              {selectedNode ? (
                <>
                  <span style={{ color: CLASS_COLORS[classOf(selectedNode.code)] }}>■</span>{" "}
                  {selectedNode.name}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">{selectedNode.nameEn}</span>
                </>
              ) : (
                "全部蛋白"
              )}
            </h2>
            <Badge variant="secondary" className="tabular-nums">{proteins.length} 条</Badge>
            {(familyCode || taxonFilter || query) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setFamilyCode(null);
                  setTaxonFilter(null);
                  setQuery("");
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
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索名称 / 基因 / 登录号"
                  className="h-8 w-44 pl-8 text-xs sm:w-56"
                />
              </div>
            </div>
          </div>

          {/* 物种筛选 chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                taxonFilter === null ? "border-emerald-600 bg-emerald-600 text-white" : "bg-background text-muted-foreground hover:border-foreground/30"
              }`}
              onClick={() => setTaxonFilter(null)}
            >
              全部物种 {familyCode ? data.proteins.filter((p) => inFamily(p.familyCode, familyCode)).length : data.proteins.length}
            </button>
            {data.organisms.map((o) => {
              const n = countByTaxon.get(o.taxonId) ?? 0;
              const active = taxonFilter === o.taxonId;
              return (
                <button
                  key={o.taxonId}
                  disabled={n === 0}
                  title={`${o.commonName} · ${o.scientificName}`}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-35 ${
                    active ? "border-emerald-600 bg-emerald-600 text-white" : "bg-background text-muted-foreground hover:border-foreground/30"
                  }`}
                  onClick={() => setTaxonFilter(active ? null : o.taxonId)}
                >
                  {o.commonName} {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* 蛋白表格 */}
        <div className="max-h-[620px] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr className="[&>th]:border-b [&>th]:px-2.5 [&>th]:py-2 [&>th]:font-medium [&>th]:text-muted-foreground">
                <th className="w-8" aria-label="加入比较" />
                <th>
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("accession")}>
                    登录号
                    {sortKey === "accession" && <ArrowDownUp className="h-3 w-3" />}
                  </button>
                </th>
                <th>蛋白名称</th>
                <th>基因</th>
                <th>物种</th>
                <th>家族</th>
                <th>同源组</th>
                <th className="text-right">
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("length")}>
                    长度 aa {sortKey === "length" && <ArrowDownUp className="h-3 w-3" />}
                  </button>
                </th>
                <th className="text-right">
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("massKda")}>
                    kDa {sortKey === "massKda" && <ArrowDownUp className="h-3 w-3" />}
                  </button>
                </th>
                <th className="text-right">PDB</th>
              </tr>
            </thead>
            <tbody>
              {proteins.map((p: ProteinLite) => {
                const inCompare = compareIds.includes(p.accession);
                const fam = famByCode.get(p.familyCode);
                return (
                  <tr
                    key={p.accession}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/60"
                    onClick={() => openDetail(p.accession)}
                  >
                    <td className="px-2.5 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={inCompare}
                        onCheckedChange={() => toggleCompare(p.accession)}
                        aria-label={`将 ${p.accession} 加入比较`}
                        className="h-3.5 w-3.5"
                      />
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5">
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{p.accession}</span>
                      {p.rep && (
                        <span className="ml-1 align-middle text-[9px] text-amber-500" title="组内代表蛋白">
                          ★
                        </span>
                      )}
                    </td>
                    <td className="max-w-[280px] truncate px-2.5 py-1.5" title={p.proteinName}>
                      {p.proteinName}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[11px]">{p.geneName || "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">{ORG_SHORT[p.taxonId] ?? "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: CLASS_COLORS[classOf(p.familyCode)] }} />
                      {fam?.name ?? p.familyCode}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">{p.group}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{p.length.toLocaleString()}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{p.massKda}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{p.pdbCount > 0 ? p.pdbCount : "—"}</td>
                  </tr>
                );
              })}
              {proteins.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    当前筛选条件下没有蛋白，试试清除筛选或切换物种
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-muted-foreground sm:px-4">
          <span>点击行查看 UniProt 详情 · 勾选加入跨物种比较</span>
          <span className="flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            <Check className="h-3 w-3" /> Swiss-Prot reviewed
          </span>
        </div>
      </div>
    </div>
  );
}
