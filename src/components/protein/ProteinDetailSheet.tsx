"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { fetchDetail } from "./api";
import { CLASS_COLORS, classOf } from "@/lib/protein-types";
import type { ProteinDetailDTO } from "@/lib/protein-types";
import { LONG_TEXT_MAX } from "./shared";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Boxes,
  Check,
  Copy,
  ExternalLink,
  FlaskConical,
  GitCompare,
  Info,
  MapPin,
  Microscope,
  Sparkles,
  Users,
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

/** 氨基酸着色（按理化性质，固定 hex 适配明暗主题） */
const AA_COLOR: Record<string, string> = {
  A: "#22c55e", G: "#22c55e", V: "#22c55e", L: "#22c55e", I: "#22c55e", P: "#22c55e", F: "#84cc16", W: "#84cc16", Y: "#84cc16", M: "#84cc16",
  S: "#eab308", T: "#eab308", N: "#eab308", Q: "#eab308", C: "#eab308",
  K: "#ef4444", R: "#ef4444", H: "#ef4444",
  D: "#f97316", E: "#f97316",
};

/** 结构域特征类型配色 */
const FEATURE_COLOR: Record<string, string> = {
  Domain: "#059669",
  Repeat: "#0891b2",
  Region: "#d97706",
  Motif: "#ca8a04",
  "Compositional bias": "#a16207",
  "Topological domain": "#7c3aed",
  "Transmembrane": "#dc2626",
  "Intramembrane": "#e11d48",
  "Signal": "#db2777",
  "Transit peptide": "#f97316",
  "Zinc finger": "#0d9488",
  "Site": "#65a30d",
  "Active site": "#16a34a",
  "Binding site": "#4d7c0f",
};

/** GO 三aspect 配色：P 生物过程 / F 分子功能 / C 细胞组分 */
const GO_ASPECT: Record<string, { color: string; label: string }> = {
  P: { color: "#059669", label: "生物过程" },
  F: { color: "#0891b2", label: "分子功能" },
  C: { color: "#d97706", label: "细胞组分" },
};

function featureColor(type: string): string {
  return FEATURE_COLOR[type] ?? "#94a3b8";
}

/** 长文本段（折叠 + 展开） */
function TextBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > LONG_TEXT_MAX;
  return (
    <div className="relative">
      <p
        className={`whitespace-pre-wrap text-justify text-[13px] leading-relaxed text-foreground/90 ${
          long && !expanded ? "max-h-44 overflow-hidden" : ""
        }`}
      >
        {text}
      </p>
      {long && !expanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
      )}
      {long && (
        <button
          className="mt-1 text-[11px] font-medium text-primary hover:underline dark:text-primary"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起" : `展开全文（${text.length.toLocaleString()} 字符）`}
        </button>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
      {icon}
      {title}
      {sub && <span className="text-xs font-normal text-muted-foreground">{sub}</span>}
    </h3>
  );
}

/** 结构域位置条（横向 SVG，按序列长度等比绘制） */
function DomainBar({
  features,
  length,
}: {
  features: { type: string; description: string; start: number; end: number }[];
  length: number;
}) {
  const types = useMemo(() => [...new Set(features.map((f) => f.type))], [features]);
  return (
    <div className="mt-2">
      <svg
        viewBox="0 0 1000 22"
        preserveAspectRatio="none"
        className="h-6 w-full rounded-md border bg-muted/30"
        role="img"
        aria-label="结构域在序列上的位置分布"
      >
        {features.map((f, i) => {
          const x = (f.start / Math.max(1, length)) * 1000;
          const w = Math.max(((f.end - f.start) / Math.max(1, length)) * 1000, 1.5);
          return (
            <rect
              key={i}
              x={x}
              y={4}
              width={Math.min(w, 1000 - x)}
              height={14}
              rx={1.5}
              fill={featureColor(f.type)}
              opacity={0.88}
            >
              <title>{`${f.type} · ${f.description} · ${f.start}-${f.end}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground" aria-hidden>
        <span>1</span>
        <span>{Math.round(length / 2).toLocaleString()}</span>
        <span>{length.toLocaleString()}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {types.map((t) => (
          <span key={t} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: featureColor(t) }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProteinDetailSheet({ ctx }: { ctx: ExplorerCtx }) {
  const { detailAcc, setDetailAcc, openDetail, toggleCompare, compareIds, setView, setCompareAccs, data } = ctx;
  const [showSeq, setShowSeq] = useState(false);
  const [copied, setCopied] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["protein-detail", detailAcc],
    queryFn: () => fetchDetail(detailAcc!),
    enabled: !!detailAcc,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });
  const detail: ProteinDetailDTO | null = detailQuery.data ?? null;
  const loading = detailQuery.isPending && !!detailAcc;
  const error = detailQuery.error ? (detailQuery.error as Error).message : null;

  const compData = useMemo(() => detail?.aaComposition ?? [], [detail]);
  const inCompare = detail ? compareIds.includes(detail.accession) : false;
  const classCode = detail ? classOf(detail.familyCode) : "";

  const goGroups = useMemo(() => {
    if (!detail) return null;
    const groups: Record<"P" | "F" | "C", { id: string; name: string }[]> = { P: [], F: [], C: [] };
    for (const g of detail.goTerms) groups[g.aspect].push({ id: g.id, name: g.name });
    return (["P", "F", "C"] as const).filter((a) => groups[a].length > 0).map((a) => ({ aspect: a, terms: groups[a] }));
  }, [detail]);

  const copySequence = async () => {
    if (!detail?.sequence) return;
    try {
      await navigator.clipboard.writeText(detail.sequence);
      setCopied(true);
      toast.success("氨基酸序列已复制到剪贴板", { description: `${detail.accession} · ${detail.length.toLocaleString()} aa` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败", { description: "浏览器可能未授权剪贴板访问" });
    }
  };

  /** 当前蛋白 + 直系同源全部加入比较（≤12 截断） */
  const addOrthologsToCompare = () => {
    if (!detail) return;
    const accs = [detail.accession, ...detail.orthologs.map((o) => o.accession)].slice(0, 12);
    setCompareAccs(accs);
    setDetailAcc(null);
    setView("compare");
    toast.success(`已加入 ${accs.length} 个蛋白进入比较`, { description: "直系同源组成员（按上限 12 截断）" });
  };

  const orgTaxa = useMemo(() => new Set(data.organisms.map((o) => o.taxonId)), [data]);

  return (
    <Sheet open={!!detailAcc} onOpenChange={(o) => !o && setDetailAcc(null)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl lg:max-w-2xl">
        <SheetTitle className="sr-only">{detailAcc ? `蛋白详情 ${detailAcc}` : "蛋白详情"}</SheetTitle>
        <SheetDescription className="sr-only">UniProt 蛋白条目详情</SheetDescription>
        {loading && (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <p className="text-center text-xs text-muted-foreground">首次访问将从 UniProt 实时抓取（约 2 秒）…</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-6 text-sm text-destructive">
            <p className="font-medium">详情加载失败</p>
            <p className="mt-1 text-xs">{error}（可能为登录号不存在或 UniProt 接口暂时不可用）</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => detailQuery.refetch()}>
              重试
            </Button>
          </div>
        )}

        {detail && !loading && (
          <>
            <SheetHeader className="space-y-2.5 border-b bg-muted/30 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://www.uniprot.org/uniprotkb/${detail.accession}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-lg tracking-tight text-primary underline-offset-2 hover:underline dark:text-primary"
                >
                  {detail.accession}
                </a>
                <Badge variant="outline" className="gap-1 border-primary/25 bg-primary/10 text-[10px] font-medium text-primary dark:border-emerald-900 dark:bg-primary/10 dark:text-primary">
                  <BadgeCheck className="h-3 w-3" /> {detail.entryType?.includes("reviewed") ? "Swiss-Prot" : detail.entryType || "UniProtKB"}
                </Badge>
                <Badge
                  variant="outline"
                  className={`gap-1 text-[10px] font-medium ${
                    detail.source === "live"
                      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
                      : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                  }`}
                  title={detail.source === "live" ? "首次点击：实时从 UniProt API 抓取" : "已缓存：本地 SQLite 毫秒级响应"}
                >
                  {detail.source === "live" ? "实时抓取" : "本地缓存"}
                </Badge>
                {detail.crossSpeciesGroup && (
                  <Badge variant="outline" className="gap-1 border-teal-300 bg-teal-50 text-[10px] font-medium text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-400">
                    跨物种直系同源组
                  </Badge>
                )}
              </div>
              <SheetDescription asChild>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{detail.proteinName}</p>
                  <p className="font-mono text-xs">{detail.entryName}</p>
                  {detail.altNames.length > 0 && (
                    <p className="text-xs">
                      别名：<span className="text-muted-foreground">{detail.altNames.slice(0, 4).join("；")}</span>
                      {detail.altNames.length > 4 && <span className="text-muted-foreground"> 等 {detail.altNames.length} 个</span>}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs">
                    <span>
                      <span className="text-muted-foreground">物种 </span>
                      <span className="font-medium">{detail.organismCommon}</span>
                      <span className="ml-1 italic text-muted-foreground">{detail.organismScientific}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">分类 </span>
                      <span style={{ color: CLASS_COLORS[classCode] }}>■</span>{" "}
                      {(detail.familyChain?.length ?? 0) > 0
                        ? detail.familyChain!.map((f, i) => (
                            <span key={f.code}>
                              {i > 0 && <span className="text-muted-foreground"> → </span>}
                              <span
                                className={i === 0 ? "" : "font-medium"}
                                style={i === 0 ? { color: CLASS_COLORS[classCode] } : undefined}
                                title={f.nameEn}
                              >
                                {f.name}
                              </span>
                            </span>
                          ))
                        : (
                          <>
                            <span className="font-medium">{detail.className}</span>
                            <span className="text-muted-foreground"> → </span>
                            <span style={{ color: CLASS_COLORS[classCode] }} className="font-medium">
                              {detail.familyName}
                            </span>
                          </>
                        )}
                    </span>
                  </div>
                  {(detail.orthodb || detail.groupName) && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
                      {detail.orthodb && (
                        <span>
                          OrthoDB <span className="font-mono text-foreground">{detail.orthodb}</span>
                        </span>
                      )}
                      {detail.eggnog && (
                        <span>
                          eggNOG <span className="font-mono text-foreground">{detail.eggnog}</span>
                        </span>
                      )}
                      {detail.groupName && (
                        <span className="truncate" title={detail.groupName}>
                          组名 <span className="text-foreground">{detail.groupName}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-5 py-4 sm:px-6">
              {/* 关键数字行 */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: "长度", value: `${detail.length.toLocaleString()} aa` },
                  { label: "分子质量", value: `${detail.massKda.toLocaleString()} kDa` },
                  { label: "EC 编号", value: detail.ecNumbers.length > 0 ? detail.ecNumbers.join(", ") : "—" },
                  { label: "PDB 结构", value: detail.pdbCount > 0 ? `${detail.pdbCount} 个` : "—" },
                  { label: "条目版本", value: `v${detail.entryVersion}` },
                  { label: "首次公开", value: detail.firstPublicDate || "—" },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg border bg-card p-2.5" title={k.value}>
                    <div className="text-[10px] text-muted-foreground">{k.label}</div>
                    <div className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums">{k.value}</div>
                  </div>
                ))}
              </div>
              {detail.lastAnnotationUpdateDate && (
                <p className="-mt-3 text-[11px] text-muted-foreground">
                  最近注释更新：<span className="font-mono">{detail.lastAnnotationUpdateDate}</span>
                </p>
              )}

              {/* PDB chips */}
              {detail.pdbIds.length > 0 && (
                <div>
                  <SectionTitle icon={<Boxes className="h-4 w-4 text-primary" />} title="PDB 结构" sub={`前 ${Math.min(12, detail.pdbIds.length)} / ${detail.pdbCount} 个 · RCSB 外链`} />
                  <div className="flex flex-wrap gap-1.5">
                    {detail.pdbIds.slice(0, 12).map((id) => (
                      <a
                        key={id}
                        href={`https://www.rcsb.org/structure/${id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border bg-card px-2.5 py-1 font-mono text-[11px] transition-colors hover:border-emerald-400 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary"
                      >
                        {id}
                      </a>
                    ))}
                    {detail.pdbIds.length > 12 && (
                      <a
                        href={`https://www.rcsb.org/uniprot/${detail.accession}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-dashed px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        +{detail.pdbCount - 12} 更多
                      </a>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* 文本注释区 */}
              {detail.functionText && (
                <div>
                  <SectionTitle icon={<Info className="h-4 w-4 text-primary" />} title="功能" sub="Function · UniProt 注释" />
                  <TextBlock text={detail.functionText} />
                </div>
              )}
              {detail.catalyticActivity && (
                <div>
                  <SectionTitle icon={<FlaskConical className="h-4 w-4 text-primary" />} title="催化活性" sub="Catalytic activity" />
                  <TextBlock text={detail.catalyticActivity} />
                </div>
              )}
              {detail.subunit && (
                <div>
                  <SectionTitle icon={<Users className="h-4 w-4 text-primary" />} title="亚基结构" sub="Subunit structure" />
                  <TextBlock text={detail.subunit} />
                </div>
              )}
              {detail.tissueSpecificity && (
                <div>
                  <SectionTitle icon={<Microscope className="h-4 w-4 text-primary" />} title="组织特异性" sub="Tissue specificity" />
                  <TextBlock text={detail.tissueSpecificity} />
                </div>
              )}
              {detail.induction && (
                <div>
                  <SectionTitle icon={<Sparkles className="h-4 w-4 text-primary" />} title="诱导表达" sub="Induction" />
                  <TextBlock text={detail.induction} />
                </div>
              )}
              {detail.ptm && (
                <div>
                  <SectionTitle icon={<Waves className="h-4 w-4 text-primary" />} title="翻译后修饰" sub="PTM / Processing" />
                  <TextBlock text={detail.ptm} />
                </div>
              )}
              {detail.similarity && (
                <div>
                  <SectionTitle icon={<GitCompare className="h-4 w-4 text-primary" />} title="序列相似性" sub="Similarity" />
                  <TextBlock text={detail.similarity} />
                </div>
              )}

              {/* 亚细胞定位 */}
              {detail.subcellular.length > 0 && (
                <div>
                  <SectionTitle icon={<MapPin className="h-4 w-4 text-primary" />} title="亚细胞定位" />
                  <div className="flex flex-wrap gap-1">
                    {detail.subcellular.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[11px] font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 结构域 + 位置条 */}
              {detail.domains.length > 0 && (
                <div>
                  <SectionTitle icon={<Boxes className="h-4 w-4 text-primary" />} title="结构域" sub="Pfam / UniProt 注释" />
                  <div className="flex flex-wrap gap-1">
                    {detail.domains.map((d) => (
                      <Badge key={d} variant="outline" className="border-border/80 text-[11px] font-normal">
                        {d}
                      </Badge>
                    ))}
                  </div>
                  {detail.domainFeatures.length > 0 && (
                    <DomainBar features={detail.domainFeatures} length={detail.length} />
                  )}
                </div>
              )}
              {detail.domains.length === 0 && detail.domainFeatures.length > 0 && (
                <div>
                  <SectionTitle icon={<Boxes className="h-4 w-4 text-primary" />} title="序列特征区" sub={`${detail.domainFeatures.length} 个特征`} />
                  <DomainBar features={detail.domainFeatures} length={detail.length} />
                </div>
              )}

              {/* GO 词条 */}
              {goGroups && goGroups.length > 0 && (
                <div>
                  <SectionTitle icon={<Sparkles className="h-4 w-4 text-primary" />} title="Gene Ontology" sub={`${detail.goTerms.length} 条注释`} />
                  <div className="space-y-2">
                    {goGroups.map((g) => (
                      <div key={g.aspect}>
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GO_ASPECT[g.aspect].color }} />
                          {GO_ASPECT[g.aspect].label}（{g.terms.length}）
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {g.terms.map((t) => (
                            <a
                              key={t.id}
                              href={`https://www.ebi.ac.uk/QuickGO/term/${t.id}`}
                              target="_blank"
                              rel="noreferrer"
                              title={`${t.id} · ${t.name}`}
                              className="rounded-full border px-2 py-0.5 text-[11px] transition-colors hover:bg-accent"
                              style={{ borderColor: `${GO_ASPECT[g.aspect].color}55` }}
                            >
                              {t.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 关键词 */}
              {detail.keywords.length > 0 && (
                <div>
                  <SectionTitle icon={<Sparkles className="h-4 w-4 text-primary" />} title="关键词" sub="UniProt Keywords · 悬停查看分类" />
                  <div className="flex flex-wrap gap-1">
                    {detail.keywords.map((k) => (
                      <Badge key={k.id} variant="outline" className="border-border/80 text-[11px] font-normal" title={k.category}>
                        {k.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 氨基酸组成 */}
              {compData.length > 0 && (
                <div>
                  <SectionTitle icon={<FlaskConical className="h-4 w-4 text-primary" />} title="氨基酸组成" sub="mol %" />
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                        <XAxis dataKey="aa" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={0} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} stroke="#94a3b8" domain={[0, "dataMax"]} unit="%" />
                        <ReTooltip
                          cursor={{ fill: "rgba(148,163,184,0.15)" }}
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

              <Separator />

              {/* 直系同源表格 */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <GitCompare className="h-4 w-4 text-primary" />
                    直系同源
                    <span className="text-xs font-normal text-muted-foreground">（{detail.orthologs.length} 个其他成员）</span>
                  </h3>
                  {detail.orthologs.length > 0 && (
                    <Button size="sm" variant="outline" className="ml-auto h-7 gap-1.5 border-primary/40 text-[11px] text-primary hover:bg-primary/10 dark:text-primary dark:hover:bg-primary/10" onClick={addOrthologsToCompare}>
                      <GitCompare className="h-3 w-3" />
                      全部加入比较（≤12）
                    </Button>
                  )}
                </div>
                {detail.orthologs.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-muted/40 [&>th]:px-2.5 [&>th]:py-1.5 [&>th]:font-medium [&>th]:text-muted-foreground">
                          <th>登录号</th>
                          <th>基因</th>
                          <th className="hidden sm:table-cell">名称</th>
                          <th>物种</th>
                          <th className="text-right">长度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.orthologs.map((o) => (
                          <tr
                            key={o.accession}
                            className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-accent/60 max-sm:[&>td]:py-3"
                            onClick={() => openDetail(o.accession)}
                            title={`${o.proteinName} · ${o.organismScientific}`}
                          >
                            <td className="px-2.5 py-1.5 font-mono font-semibold text-primary">{o.accession}</td>
                            <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[11px]">{o.geneName || "—"}</td>
                            <td className="hidden max-w-[220px] truncate px-2.5 py-1.5 text-muted-foreground sm:table-cell">{o.proteinName}</td>
                            <td className="whitespace-nowrap px-2.5 py-1.5">
                              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: orgTaxa.has(o.taxonId) ? undefined : "#94a3b8" }} />
                              {o.organismCommon}
                            </td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{o.length.toLocaleString()} aa</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">该蛋白暂无其他直系同源成员（物种特异蛋白）</p>
                )}
              </div>

              {/* 序列 */}
              {detail.sequence && (
                <div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 text-sm font-semibold" onClick={() => setShowSeq((v) => !v)}>
                      <span className="text-primary">{showSeq ? "▾" : "▸"}</span> 氨基酸序列
                      <span className="text-xs font-normal text-muted-foreground">（{detail.length.toLocaleString()} aa · 点击{showSeq ? "折叠" : "展开"}）</span>
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto h-7 gap-1.5 text-[11px]"
                      onClick={copySequence}
                      aria-label="复制序列"
                    >
                      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                      {copied ? "已复制" : "复制"}
                    </Button>
                  </div>
                  {showSeq && (
                    <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-all rounded-lg border bg-muted/40 p-3 font-mono text-[10px] leading-relaxed [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
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
                  className={inCompare ? "" : "bg-primary hover:bg-primary/90"}
                  onClick={() => toggleCompare(detail.accession)}
                >
                  <GitCompare className="mr-1 h-3.5 w-3.5" />
                  {inCompare ? "已加入比较候选" : "加入比较候选"}
                </Button>
                {inCompare && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCompareAccs(compareIds);
                      setView("compare");
                      setDetailAcc(null);
                    }}
                  >
                    去比较 →
                  </Button>
                )}
                <a href={`https://www.uniprot.org/uniprotkb/${detail.accession}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> UniProt 页面
                  </Button>
                </a>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
