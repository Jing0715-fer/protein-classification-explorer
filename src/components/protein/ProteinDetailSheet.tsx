"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { fetchDetail } from "./api";
import { CLASS_COLORS } from "@/lib/protein-types";
import type { ProteinDetailDTO } from "@/lib/protein-types";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Boxes,
  ExternalLink,
  FlaskConical,
  GitCompare,
  Info,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  Waves,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/** 氨基酸着色（按理化性质） */
const AA_COLOR: Record<string, string> = {
  A: "#22c55e", G: "#22c55e", V: "#22c55e", L: "#22c55e", I: "#22c55e", P: "#22c55e", F: "#84cc16", W: "#84cc16", Y: "#84cc16", M: "#84cc16",
  S: "#eab308", T: "#eab308", N: "#eab308", Q: "#eab308", C: "#eab308",
  K: "#ef4444", R: "#ef4444", H: "#ef4444",
  D: "#f97316", E: "#f97316",
};

export function ProteinDetailSheet({ ctx }: { ctx: ExplorerCtx }) {
  const { detailAcc, setDetailAcc, openDetail, toggleCompare, compareIds, setView, setCompareMode } = ctx;
  const [showSeq, setShowSeq] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["protein-detail", detailAcc],
    queryFn: () => fetchDetail(detailAcc!),
    enabled: !!detailAcc,
  });
  const detail: ProteinDetailDTO | null = detailQuery.data ?? null;
  const loading = detailQuery.isPending && !!detailAcc;
  const error = detailQuery.error ? (detailQuery.error as Error).message : null;

  const compData = useMemo(() => detail?.aaComposition ?? [], [detail]);
  const inCompare = detail ? compareIds.includes(detail.accession) : false;

  return (
    <Sheet open={!!detailAcc} onOpenChange={(o) => !o && setDetailAcc(null)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl lg:max-w-2xl">
        <SheetTitle className="sr-only">{detailAcc ? `蛋白详情 ${detailAcc}` : "蛋白详情"}</SheetTitle>
        <SheetDescription className="sr-only">UniProt 蛋白条目详情</SheetDescription>
        {loading && (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {error && (
          <div className="p-6 text-sm text-destructive">
            加载失败：{error}
            <Button variant="outline" size="sm" className="ml-3" onClick={() => setDetailAcc(detailAcc)}>
              重试
            </Button>
          </div>
        )}

        {detail && (
          <>
            <SheetHeader className="space-y-2 border-b bg-muted/30 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg tracking-tight text-emerald-700 dark:text-emerald-400">
                  {detail.accession}
                </span>
                <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
                  <BadgeCheck className="h-3 w-3" /> Swiss-Prot
                </Badge>
                {detail.isRepresentative && (
                  <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-[10px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                    <Star className="h-3 w-3" /> 组代表
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1 text-[10px] font-medium">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CLASS_COLORS[detail.className] }} />
                  {detail.familyName}
                </Badge>
              </div>
              <SheetDescription asChild>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{detail.proteinName}</p>
                  <p className="font-mono text-xs">{detail.entryName}</p>
                  {detail.altNames.length > 0 && (
                    <p className="text-xs">别名：{detail.altNames.join("；")}</p>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-5 py-4 sm:px-6">
              {/* 关键属性 */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "长度", value: `${detail.length.toLocaleString()} aa` },
                  { label: "分子质量", value: `${detail.massKda} kDa` },
                  { label: "PDB 结构", value: detail.pdbCount > 0 ? `${detail.pdbCount} 个` : "—" },
                  { label: "关键词", value: `${detail.keywords.length} 个` },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg border bg-card p-2.5">
                    <div className="text-[10px] text-muted-foreground">{k.label}</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums">{k.value}</div>
                  </div>
                ))}
              </div>

              {/* 基因 / 物种 / 家族 */}
              <div className="space-y-2.5 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">基因</span>
                  <span className="font-mono font-medium">{detail.geneName || "—"}
                    {detail.geneSynonyms.length > 0 && (
                      <span className="ml-2 font-normal text-muted-foreground">（{detail.geneSynonyms.join(", ")}）</span>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">物种</span>
                  <span className="font-medium">{detail.organismCommon}</span>
                  <span className="font-normal italic text-muted-foreground">{detail.organismScientific} · taxon {detail.taxonId}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">分类</span>
                  <span>
                    {detail.className} 大类 → <span style={{ color: CLASS_COLORS[detail.className] }}>{detail.familyName}</span>
                    <span className="ml-1 text-muted-foreground">({detail.familyNameEn} · {detail.familyCode})</span>
                  </span>
                </div>
              </div>

              <Separator />

              {/* 直系同源组 */}
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <GitCompare className="h-4 w-4 text-emerald-600" />
                  直系同源组 · {detail.group}
                  <span className="text-xs font-normal text-muted-foreground">（{detail.orthologs.length} 个其他成员）</span>
                </h3>
                {detail.orthologs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.orthologs.map((o) => (
                      <button
                        key={o.accession}
                        onClick={() => openDetail(o.accession)}
                        title={`${o.proteinName} · ${o.organismScientific} · ${o.length} aa`}
                        className="group flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      >
                        <span className="font-medium">{o.organismCommon}</span>
                        <span className="font-mono text-muted-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{o.accession}</span>
                        {o.rep && <Star className="h-3 w-3 text-amber-500" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">该组暂无其他成员（物种特异蛋白）</p>
                )}
              </div>

              {/* 功能描述 */}
              {detail.functionText && (
                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <Info className="h-4 w-4 text-emerald-600" /> 功能
                    <span className="text-xs font-normal text-muted-foreground">Function · UniProt 注释</span>
                  </h3>
                  <p className="text-justify text-[13px] leading-relaxed text-foreground/90">{detail.functionText}</p>
                </div>
              )}

              {/* 亚细胞定位 */}
              {detail.subcellular.length > 0 && (
                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <MapPin className="h-4 w-4 text-emerald-600" /> 亚细胞定位
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {detail.subcellular.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[11px] font-normal">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 结构域 */}
              {detail.domains.length > 0 && (
                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <Boxes className="h-4 w-4 text-emerald-600" /> 结构域
                    <span className="text-xs font-normal text-muted-foreground">Pfam / UniProt 注释</span>
                  </h3>
                  <ul className="space-y-1">
                    {detail.domains.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 关键词 */}
              {detail.keywords.length > 0 && (
                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-emerald-600" /> 关键词
                    <span className="text-xs font-normal text-muted-foreground">UniProt Keywords</span>
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {detail.keywords.map((k) => (
                      <Badge key={k} variant="outline" className="border-border/80 text-[11px] font-normal">{k}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 翻译后修饰 */}
              {detail.ptm && (
                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <Waves className="h-4 w-4 text-emerald-600" /> 翻译后修饰 PTM
                  </h3>
                  <p className="text-justify text-[13px] leading-relaxed text-foreground/90">{detail.ptm}</p>
                </div>
              )}

              {/* 氨基酸组成 */}
              {compData.length > 0 && (
                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <FlaskConical className="h-4 w-4 text-emerald-600" /> 氨基酸组成
                    <span className="text-xs font-normal text-muted-foreground">mol %</span>
                  </h3>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                        <XAxis dataKey="aa" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={0} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} stroke="#94a3b8" domain={[0, "dataMax"]} unit="%" />
                        <ReTooltip
                          cursor={{ fill: "hsl(var(--muted))" }}
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          formatter={(v: number) => [`${v}%`, "占比"]}
                        />
                        <Bar dataKey="pct" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                          {compData.map((c) => (
                            <Cell key={c.aa} fill={AA_COLOR[c.aa] ?? "#94a3b8"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 序列 */}
              {detail.sequence && (
                <div>
                  <button
                    className="flex w-full items-center gap-1.5 text-sm font-semibold"
                    onClick={() => setShowSeq((v) => !v)}
                  >
                    <span className="text-emerald-600">▸</span> 氨基酸序列
                    <span className="text-xs font-normal text-muted-foreground">（{detail.length} aa · 点击{showSeq ? "折叠" : "展开"}）</span>
                  </button>
                  {showSeq && (
                    <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-all rounded-lg border bg-muted/40 p-3 font-mono text-[10px] leading-relaxed">
                      {detail.sequence}
                    </pre>
                  )}
                </div>
              )}

              <Separator />

              {/* 操作 & 外链 */}
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <Button
                  size="sm"
                  variant={inCompare ? "secondary" : "default"}
                  className={inCompare ? "" : "bg-emerald-600 hover:bg-emerald-700"}
                  onClick={() => toggleCompare(detail.accession)}
                >
                  <GitCompare className="mr-1 h-3.5 w-3.5" />
                  {inCompare ? "已加入比较" : "加入跨物种比较"}
                </Button>
                {inCompare && (
                  <Button size="sm" variant="outline" onClick={() => { setCompareMode("manual"); setView("compare"); setDetailAcc(null); }}>
                    去比较 →
                  </Button>
                )}
                <a href={`https://www.uniprot.org/uniprotkb/${detail.accession}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> UniProt 页面
                  </Button>
                </a>
                {detail.pdbCount > 0 && (
                  <a href={`https://www.rcsb.org/uniprot/${detail.accession}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Boxes className="h-3.5 w-3.5" /> PDB 结构（{detail.pdbCount}）
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function SheetLoading() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}
