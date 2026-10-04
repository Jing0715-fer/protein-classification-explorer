"use client";

import type { ExplorerCtx } from "./ProteinExplorer";
import { fetchDetail } from "./api";
import { CLASS_COLORS, classOf } from "@/lib/protein-types";
import type { ProteinDetailDTO, XrefLinkDTO } from "@/lib/protein-types";
import { LONG_TEXT_MAX } from "./shared";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Baby,
  BadgeCheck,
  Boxes,
  Check,
  Copy,
  DatabaseZap,
  ExternalLink,
  FlaskConical,
  Gauge,
  GitCompare,
  HeartPulse,
  Info,
  Layers,
  MapPin,
  Microscope,
  Network,
  Sparkles,
  Star,
  TriangleAlert,
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
  "Chain": "#57534e",
  "Propeptide": "#78716c",
  "Peptide": "#8c8378",
  "Disulfide bond": "#991b1b",
  "Cross-link": "#9a3412",
  "Glycosylation": "#0e7490",
  "Lipid": "#86198f",
  "Modified residue": "#854d0e",
  "Calcium-binding": "#155e75",
  "DNA-binding": "#9333ea",
  "Nucleotide binding": "#c026d3",
};

/** 特征类型中文名 */
const TYPE_ZH: Record<string, string> = {
  Domain: "结构域",
  Repeat: "重复序列",
  Region: "区域",
  Motif: "基序",
  "Compositional bias": "组成偏向区",
  "Topological domain": "拓扑域",
  "Transmembrane": "跨膜区",
  "Intramembrane": "膜内区",
  "Signal": "信号肽",
  "Transit peptide": "转运肽",
  "Zinc finger": "锌指",
  "Site": "位点",
  "Active site": "活性位点",
  "Binding site": "结合位点",
  "DNA-binding": "DNA 结合区",
  "Nucleotide binding": "核苷酸结合区",
  "Chain": "成熟肽链",
  "Propeptide": "前肽",
  "Peptide": "肽段",
  "Disulfide bond": "二硫键",
  "Cross-link": "交联",
  "Glycosylation": "糖基化",
  "Lipid": "脂质修饰",
  "Modified residue": "修饰残基",
  "Calcium-binding": "钙结合区",
};

/** 泳道分组：跨膜区独立成泳道突出显示 */
const LANE_DEFS: { key: string; label: string; types: string[] }[] = [
  {
    key: "region",
    label: "结构域与区域",
    types: ["Domain", "Region", "Repeat", "Motif", "Zinc finger", "DNA-binding", "Nucleotide binding", "Compositional bias"],
  },
  { key: "membrane", label: "跨膜区", types: ["Transmembrane", "Intramembrane"] },
  { key: "topo", label: "拓扑域", types: ["Topological domain"] },
  { key: "peptide", label: "信号与肽段", types: ["Signal", "Transit peptide", "Chain", "Propeptide", "Peptide"] },
  {
    key: "site",
    label: "位点与修饰",
    types: ["Active site", "Binding site", "Site", "Calcium-binding", "Disulfide bond", "Cross-link", "Glycosylation", "Lipid", "Modified residue"],
  },
];

/** 刻度尺取整步长（目标 5-9 格） */
function niceStep(len: number): number {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]) {
    if (len / s <= 9) return s;
  }
  return 2000;
}

/** 特征描述友好化：跨膜段编号 / 拓扑域方位翻译 */
function featureDescZh(f: { type: string; description: string }): string | null {
  const d = f.description;
  if (!d) return null;
  if (f.type === "Transmembrane") {
    const n = d.match(/Name=(\d+)/)?.[1];
    const helical = /helical/i.test(d);
    const note = d.replace(/\s*[;,]?\s*Name=\d+\s*;?\s*/i, "").replace(/helical/i, "").trim();
    const zh = `${n ? `第 ${n} 段` : ""}${helical ? "α-螺旋跨膜段" : "跨膜段"}`;
    return note ? `${zh} · ${note}` : zh;
  }
  if (f.type === "Topological domain") {
    if (/cytoplasmic/i.test(d)) return `胞质侧${d.replace(/cytoplasmic/i, "").trim() ? " · " + d : ""}`;
    if (/extracellular/i.test(d)) return `胞外侧${d.replace(/extracellular/i, "").trim() ? " · " + d : ""}`;
    if (/luminal/i.test(d)) return `腔内侧${d.replace(/luminal/i, "").trim() ? " · " + d : ""}`;
    return d;
  }
  if (f.type === "Disulfide bond") {
    return d.replace(/by\s+C\d+/i, "").trim() || "二硫键";
  }
  return d;
}

/** GO 三aspect 配色：P 生物过程 / F 分子功能 / C 细胞组分 */
const GO_ASPECT: Record<string, { color: string; label: string }> = {
  P: { color: "#059669", label: "生物过程" },
  F: { color: "#0891b2", label: "分子功能" },
  C: { color: "#d97706", label: "细胞组分" },
};

function featureColor(type: string): string {
  return FEATURE_COLOR[type] ?? "#94a3b8";
}

/** 蛋白存在性证据等级中文（UniProt Protein existence） */
const PE_ZH: Record<string, string> = {
  "1": "蛋白水平证据",
  "2": "转录水平证据",
  "3": "同源推断",
  "4": "预测",
  "5": "存疑",
};

/** 外部数据库分组固定展示顺序（未列出的组按首次出现顺序追加在末尾） */
const XREF_GROUP_ORDER = [
  "基因与基因组",
  "通路注释",
  "结构预测",
  "家族与域",
  "直系同源",
  "相互作用",
  "疾病与药物",
  "表达",
];

/** 长文本段（折叠 + 展开） */
function TextBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > LONG_TEXT_MAX;
  return (
    <div className="relative">
      <p
        className={`whitespace-pre-wrap text-justify text-[13px] leading-relaxed break-words text-foreground/90 ${
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

/** 序列特征图谱（多泳道：跨膜区独立泳道 + 位点棒棒糖 + 悬停详情） */
function FeatureMap({
  features,
  length,
}: {
  features: { type: string; description: string; start: number; end: number }[];
  length: number;
}) {
  const len = Math.max(1, length);
  const [hover, setHover] = useState<{ lane: string; i: number; cx: number } | null>(null);

  const lanes = useMemo(
    () =>
      LANE_DEFS.map((def) => ({
        def,
        items: features.filter((f) => def.types.includes(f.type)),
      })).filter((l) => l.items.length > 0),
    [features]
  );
  const types = useMemo(() => [...new Set(features.map((f) => f.type))], [features]);

  const step = niceStep(len);
  const ticks: number[] = [];
  for (let t = step; t < len; t += step) ticks.push(t);

  const pct = (v: number) => Math.min(100, Math.max(0, (v / len) * 100));

  /** 泳道内单个特征元素（悬停 / 键盘焦点 / 触屏点击均可查看详情） */
  const renderItem = (
    lane: string,
    f: { type: string; description: string; start: number; end: number },
    i: number
  ) => {
    const color = featureColor(f.type);
    const point = f.end - f.start <= 2;
    const x = pct(f.start);
    const w = Math.max(pct(f.end) - x, 0);
    const cx = pct((f.start + f.end) / 2);
    const active = hover?.lane === lane && hover?.i === i;
    const set = () => setHover({ lane, i, cx });

    const common = {
      onMouseEnter: set,
      onFocus: set,
      onBlur: () => setHover((h) => (h?.lane === lane && h.i === i ? null : h)),
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        set();
      },
      tabIndex: 0,
      role: "img" as const,
      "aria-label": `${TYPE_ZH[f.type] ?? f.type} ${f.start}-${f.end}${f.description ? ` · ${f.description}` : ""}`,
      className: `absolute cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "z-10" : ""}`,
    };

    if (lane === "membrane") {
      return (
        <div
          key={i}
          {...common}
          className={`${common.className} top-1/2 h-6 -translate-y-1/2 rounded-full border border-red-900/30 shadow-sm transition-[scale,filter] hover:scale-y-110 hover:brightness-110 dark:border-red-100/20`}
          style={{ left: `${x}%`, width: `max(${w}%, 4px)`, backgroundColor: color }}
        >
          <span className="pointer-events-none absolute -inset-x-1 -inset-y-1.5" />
        </div>
      );
    }

    if (lane === "site") {
      if (point) {
        return (
          <div key={i} {...common} className={`${common.className} bottom-0 h-full w-2 -translate-x-1/2`} style={{ left: `${cx}%` }}>
            <span className="absolute bottom-0 left-1/2 h-3.5 w-px -translate-x-1/2" style={{ backgroundColor: color }} />
            <span
              className="absolute bottom-3 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[1.5px] shadow-[0_0_0_1px_rgba(255,255,255,0.45)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
              style={{ backgroundColor: color }}
            />
            <span className="pointer-events-none absolute bottom-[-4px] left-1/2 h-[calc(100%+8px)] w-3 -translate-x-1/2" />
          </div>
        );
      }
      return (
        <div
          key={i}
          {...common}
          className={`${common.className} bottom-[10px] h-[3.5px] rounded-full`}
          style={{ left: `${x}%`, width: `max(${w}%, 4px)`, backgroundColor: color }}
        >
          <span className="absolute -left-[3.5px] -top-[2.5px] h-2 w-2 rotate-45 rounded-[1.5px] shadow-[0_0_0_1px_rgba(255,255,255,0.45)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ backgroundColor: color }} />
          <span className="absolute -right-[3.5px] -top-[2.5px] h-2 w-2 rotate-45 rounded-[1.5px] shadow-[0_0_0_1px_rgba(255,255,255,0.45)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ backgroundColor: color }} />
          <span className="pointer-events-none absolute -inset-x-1 -inset-y-2" />
        </div>
      );
    }

    // region / topo / peptide 泳道：横向色条
    const isTopo = lane === "topo";
    const cyto = /cytoplasmic/i.test(f.description);
    const op = isTopo ? (cyto ? 0.32 : 0.18) : 0.85;
    return (
      <div
        key={i}
        {...common}
        className={`${common.className} top-1/2 -translate-y-1/2 rounded-[3px] ${
          isTopo ? "h-4 border" : "h-3.5 border border-black/10 dark:border-white/10"
        } transition-[filter] hover:brightness-110`}
        style={{
          left: `${x}%`,
          width: `max(${w}%, 3px)`,
          backgroundColor: color,
          opacity: op,
          ...(isTopo ? { borderColor: color } : {}),
        }}
      >
        <span className="pointer-events-none absolute -inset-x-1 -inset-y-1.5" />
      </div>
    );
  };

  /** 泳道悬停详情卡 */
  const tip = (lane: string) => {
    if (!hover || hover.lane !== lane) return null;
    const laneTypes = LANE_DEFS.find((d) => d.key === lane)?.types ?? [];
    const f = features.filter((x) => laneTypes.includes(x.type))[hover.i];
    if (!f) return null;
    const color = featureColor(f.type);
    const aa = f.end - f.start + 1;
    return (
      <div
        className="pointer-events-none absolute bottom-full z-30 mb-1.5 w-max max-w-[280px] -translate-x-1/2 rounded-lg border bg-popover p-2 text-[11px] leading-relaxed shadow-lg"
        style={{ left: `${Math.min(88, Math.max(12, hover.cx))}%` }}
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
          <span className="font-semibold">{TYPE_ZH[f.type] ?? f.type}</span>
          <span className="font-mono text-muted-foreground">
            {f.start === f.end ? f.start : `${f.start}–${f.end}`}（{aa} aa）
          </span>
        </div>
        {(() => {
          const dz = featureDescZh(f);
          return dz ? <div className="mt-0.5 max-w-[260px] break-words text-muted-foreground">{dz}</div> : null;
        })()}
      </div>
    );
  };

  const laneH = (key: string) => (key === "membrane" ? "h-8" : key === "site" ? "h-8" : key === "topo" ? "h-5" : "h-6");

  return (
    <div className="mt-2 select-none">
      {/* 刻度尺 */}
      <div className="flex items-end gap-2">
        <div className="w-[76px] shrink-0 sm:w-[92px]" aria-hidden />
        <div className="relative h-4 flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${pct(t)}%` }}>
              <span className="h-1 w-px bg-border" />
              <span className="mt-0.5 -translate-x-1/2 font-mono text-[9px] leading-none text-muted-foreground">{t.toLocaleString()}</span>
            </div>
          ))}
          <div className="absolute right-0 bottom-0 flex flex-col items-center">
            <span className="h-1 w-px bg-border" />
            <span className="mt-0.5 font-mono text-[9px] leading-none text-muted-foreground">{len.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 泳道 */}
      <div className="mt-1 space-y-2">
        {lanes.map(({ def, items }) => (
          <div key={def.key} className="flex items-center gap-2">
            <div className="w-[76px] shrink-0 text-right sm:w-[92px]">
              <div className="text-[10px] leading-tight font-medium">{def.label}</div>
              <div className="font-mono text-[9px] leading-tight text-muted-foreground">{items.length} 个</div>
            </div>
            <div
              className={`relative ${laneH(def.key)} flex-1 overflow-visible rounded-md border bg-muted/30`}
              onMouseLeave={() => setHover((h) => (h?.lane === def.key ? null : h))}
              onClick={(e) => {
                if (e.target === e.currentTarget) setHover(null);
              }}
            >
              {/* 跨膜泳道：脂双层背景带 */}
              {def.key === "membrane" && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 inset-y-[18%] rounded-sm border-y border-amber-300/50 bg-gradient-to-b from-amber-100/70 via-amber-50/40 to-amber-100/70 dark:border-amber-500/25 dark:from-amber-500/10 dark:via-amber-500/5 dark:to-amber-500/10"
                />
              )}
              {/* 位点泳道：基线 */}
              {def.key === "site" && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[10px] h-px bg-border" />}
              {items.map((f, i) => renderItem(def.key, f, i))}
              {tip(def.key)}
            </div>
          </div>
        ))}
      </div>

      {/* 类型图例 */}
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 pl-[84px] sm:pl-[100px]">
        {types.map((t) => (
          <span key={t} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: featureColor(t) }} />
            {TYPE_ZH[t] ?? t}
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

  /** 版本与关键日期行（仅拼接非空部分） */
  const versionLine = useMemo(() => {
    if (!detail) return "";
    const parts: string[] = [];
    if (detail.entryVersion) parts.push(`条目版本 v${detail.entryVersion}`);
    if (detail.sequenceVersion) parts.push(`序列版本 v${detail.sequenceVersion}`);
    if (detail.lastAnnotationUpdateDate) parts.push(`最近注释更新 ${detail.lastAnnotationUpdateDate}`);
    if (detail.lastSequenceUpdateDate) parts.push(`最近序列更新 ${detail.lastSequenceUpdateDate}`);
    if (detail.firstPublicDate) parts.push(`首次公开 ${detail.firstPublicDate}`);
    return parts.join(" · ");
  }, [detail]);

  /** 外部数据库链接分组（固定组序 + 未知组按首次出现追加，组内保持 API 顺序） */
  const xrefGroups = useMemo(() => {
    if (!detail || detail.xrefs.length === 0) return null;
    const map = new Map<string, XrefLinkDTO[]>();
    for (const x of detail.xrefs) {
      const list = map.get(x.group);
      if (list) list.push(x);
      else map.set(x.group, [x]);
    }
    const known = XREF_GROUP_ORDER.filter((g) => map.has(g));
    const rest = [...map.keys()].filter((g) => !XREF_GROUP_ORDER.includes(g));
    return [...known, ...rest].map((g) => ({ group: g, items: map.get(g)! }));
  }, [detail]);

  /** 分子互作：按实验证据数降序取前 12 行 */
  const shownInteractions = useMemo(() => {
    if (!detail || detail.interactions.length === 0) return [];
    return [...detail.interactions].sort((a, b) => b.experiments - a.experiments).slice(0, 12);
  }, [detail]);

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
                {detail.proteinExistence && (
                  <Badge
                    variant="outline"
                    className="border-muted-foreground/30 bg-muted/40 text-[10px] font-medium text-muted-foreground"
                    title={detail.proteinExistence}
                  >
                    {PE_ZH[detail.proteinExistence.split(":")[0]?.trim() ?? ""] ?? detail.proteinExistence}
                  </Badge>
                )}
                {detail.annotationScore > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-muted-foreground/30 bg-muted/40 text-[10px] font-medium text-muted-foreground"
                    title="UniProt 注释完整度评分"
                  >
                    <Star className="h-3 w-3 text-primary" fill="currentColor" aria-hidden />
                    {detail.annotationScore}/5
                  </Badge>
                )}
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
                          OrthoDB{" "}
                          <a
                            href={`https://www.orthodb.org/?query=${detail.orthodb}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-foreground underline-offset-2 hover:underline"
                          >
                            {detail.orthodb}
                          </a>
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
                  { label: "注释评分", value: detail.annotationScore > 0 ? `${detail.annotationScore}/5` : "—" },
                  { label: "首次公开", value: detail.firstPublicDate || "—" },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg border bg-card p-2.5" title={k.value}>
                    <div className="text-[10px] text-muted-foreground">{k.label}</div>
                    <div className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums">{k.value}</div>
                  </div>
                ))}
              </div>
              {versionLine && <p className="-mt-3 text-[11px] text-muted-foreground">{versionLine}</p>}

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
              {detail.activityRegulation && (
                <div>
                  <SectionTitle icon={<Gauge className="h-4 w-4 text-primary" />} title="酶活性调控" sub="Activity regulation" />
                  <TextBlock text={detail.activityRegulation} />
                </div>
              )}
              {detail.cofactors.length > 0 && (
                <div>
                  <SectionTitle icon={<FlaskConical className="h-4 w-4 text-primary" />} title="辅因子" sub="Cofactors" />
                  <div className="flex flex-wrap gap-1">
                    {detail.cofactors.map((c) => (
                      <Badge key={c} variant="secondary" className="text-[11px] font-normal">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {detail.subunit && (
                <div>
                  <SectionTitle icon={<Users className="h-4 w-4 text-primary" />} title="亚基结构" sub="Subunit structure" />
                  <TextBlock text={detail.subunit} />
                </div>
              )}
              {detail.interactions.length > 0 && (
                <div>
                  <SectionTitle
                    icon={<Network className="h-4 w-4 text-primary" />}
                    title="分子互作"
                    sub={`（${detail.interactions.length} 个互作对象 · IntAct 证据）`}
                  />
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-left text-xs" aria-label="分子互作对象列表">
                      <thead>
                        <tr className="bg-muted/40 [&>th]:px-2.5 [&>th]:py-1.5 [&>th]:font-medium [&>th]:text-muted-foreground">
                          <th>登录号</th>
                          <th>基因名</th>
                          <th className="text-right">实验数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownInteractions.map((it) => (
                          <tr
                            key={it.accession}
                            className={`border-b border-border/50 transition-colors last:border-0 max-sm:[&>td]:py-3.5 ${
                              it.inDb ? "cursor-pointer hover:bg-accent/60" : ""
                            }`}
                            onClick={it.inDb ? () => openDetail(it.accession) : undefined}
                            title={it.inDb ? `点击查看 ${it.accession} 详情` : `在 UniProt 查看 ${it.accession}`}
                          >
                            <td className="px-2.5 py-1.5 font-mono font-semibold text-primary">
                              {it.inDb ? (
                                <button
                                  type="button"
                                  className="text-left font-mono font-semibold text-primary underline-offset-2 hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDetail(it.accession);
                                  }}
                                >
                                  {it.accession}
                                </button>
                              ) : (
                                <a
                                  href={`https://www.uniprot.org/uniprotkb/${it.accession}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                                >
                                  {it.accession}
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                </a>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[11px]">{it.geneName || "—"}</td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{it.experiments}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {detail.interactions.length > 12 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      仅显示实验证据数最多的前 12 个互作对象，共 {detail.interactions.length} 个
                    </p>
                  )}
                </div>
              )}
              {detail.tissueSpecificity && (
                <div>
                  <SectionTitle icon={<Microscope className="h-4 w-4 text-primary" />} title="组织特异性" sub="Tissue specificity" />
                  <TextBlock text={detail.tissueSpecificity} />
                </div>
              )}
              {detail.developmentalStage && (
                <div>
                  <SectionTitle icon={<Baby className="h-4 w-4 text-primary" />} title="发育阶段" sub="Developmental stage" />
                  <TextBlock text={detail.developmentalStage} />
                </div>
              )}
              {detail.induction && (
                <div>
                  <SectionTitle icon={<Sparkles className="h-4 w-4 text-primary" />} title="诱导表达" sub="Induction" />
                  <TextBlock text={detail.induction} />
                </div>
              )}
              {detail.diseases.length > 0 && (
                <div>
                  <SectionTitle icon={<HeartPulse className="h-4 w-4 text-primary" />} title="疾病关联" sub="Involvement in disease · UniProt" />
                  <div className="space-y-2">
                    {detail.diseases.map((dz, i) => (
                      <div key={`${dz.name}-${i}`} className="space-y-1 rounded-lg border bg-card p-3">
                        <div className="flex flex-wrap items-center gap-1.5 break-words">
                          <span className="break-words text-[13px] font-semibold">{dz.name}</span>
                          {dz.acronym && (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {dz.acronym}
                            </Badge>
                          )}
                          {dz.mimId && (
                            <a
                              href={`https://www.omim.org/entry/${dz.mimId}`}
                              target="_blank"
                              rel="noreferrer"
                              title={`OMIM ${dz.mimId}`}
                              className="rounded-full border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                            >
                              OMIM {dz.mimId}
                            </a>
                          )}
                        </div>
                        {dz.description && <TextBlock text={dz.description} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail.ptm && (
                <div>
                  <SectionTitle icon={<Waves className="h-4 w-4 text-primary" />} title="翻译后修饰" sub="PTM / Processing" />
                  <TextBlock text={detail.ptm} />
                </div>
              )}
              {detail.domainComment && (
                <div>
                  <SectionTitle icon={<Boxes className="h-4 w-4 text-primary" />} title="结构域注释" sub="Domain" />
                  <TextBlock text={detail.domainComment} />
                </div>
              )}
              {detail.similarity && (
                <div>
                  <SectionTitle icon={<GitCompare className="h-4 w-4 text-primary" />} title="序列相似性" sub="Similarity" />
                  <TextBlock text={detail.similarity} />
                </div>
              )}
              {detail.miscellaneous && (
                <div>
                  <SectionTitle icon={<Info className="h-4 w-4 text-primary" />} title="其他注释" sub="Miscellaneous" />
                  <TextBlock text={detail.miscellaneous} />
                </div>
              )}
              {detail.caution && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] dark:border-amber-800 dark:bg-amber-950/60">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                    <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                    注解警告
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90">{detail.caution}</p>
                </div>
              )}
              {detail.isoforms.length > 0 && (
                <div>
                  <SectionTitle icon={<Layers className="h-4 w-4 text-primary" />} title="异构体" sub={`Isoforms · ${detail.isoforms.length} 个`} />
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {detail.isoforms.map((iso, i) => (
                      <div key={`${iso.name}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-card px-2.5 py-2">
                        <span className="break-words text-[12px] font-semibold">{iso.name}</span>
                        {iso.synonyms.length > 0 && <span className="break-words text-[11px] text-muted-foreground">{iso.synonyms.join("/")}</span>}
                        {iso.ids.length > 0 && <span className="break-all font-mono text-[10px] text-muted-foreground">{iso.ids.join(" ")}</span>}
                        {iso.status === "Displayed" ? (
                          <Badge
                            variant="outline"
                            className="ml-auto border-teal-300 bg-teal-50 text-[10px] font-medium text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-400"
                          >
                            展示序列
                          </Badge>
                        ) : iso.status ? (
                          <Badge variant="outline" className="ml-auto border-border/80 text-[10px] font-medium text-muted-foreground">
                            已描述
                          </Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
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

              {/* 结构域 + 特征图谱 */}
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
                    <FeatureMap features={detail.domainFeatures} length={detail.length} />
                  )}
                </div>
              )}
              {detail.domains.length === 0 && detail.domainFeatures.length > 0 && (
                <div>
                  <SectionTitle
                    icon={<Boxes className="h-4 w-4 text-primary" />}
                    title="序列特征图谱"
                    sub={`${detail.domainFeatures.length} 个特征 · 悬停查看详情`}
                  />
                  <FeatureMap features={detail.domainFeatures} length={detail.length} />
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

              {/* 外部数据库 */}
              {xrefGroups && (
                <div>
                  <SectionTitle
                    icon={<DatabaseZap className="h-4 w-4 text-primary" />}
                    title="外部数据库"
                    sub={`Cross-references · ${detail.xrefs.length} 条`}
                  />
                  <div className="space-y-2">
                    {xrefGroups.map((g) => (
                      <div key={g.group}>
                        <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                          {g.group}（{g.items.length}）
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.items.map((x, i) => {
                            const label = x.note || (x.id.length > 14 ? `${x.id.slice(0, 14)}…` : x.id);
                            const fullTitle = `${x.db} · ${x.id}${x.note ? ` · ${x.note}` : ""}`;
                            return (
                              <a
                                key={`${x.db}-${x.id}-${i}`}
                                href={x.url}
                                target="_blank"
                                rel="noreferrer"
                                title={fullTitle}
                                className="inline-flex max-w-full items-baseline gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:border-primary/60 hover:bg-primary/5"
                              >
                                <span className="shrink-0 font-medium">{x.db}</span>
                                <span className={`truncate text-muted-foreground ${x.note ? "" : "font-mono"}`}>{label}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
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
