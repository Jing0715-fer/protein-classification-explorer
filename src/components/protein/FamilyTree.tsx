"use client";

import type { FamilyNodeDTO } from "@/lib/protein-types";
import { CLASS_COLORS } from "@/lib/protein-types";
import { ORG_COLORS } from "./api";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface TreeProps {
  nodes: FamilyNodeDTO[];
  selected: string | null;
  onSelect: (code: string) => void;
  level?: number;
}

/** 家族 × 物种迷你堆叠条（40px 宽） */
function OrgStackBar({ byOrganism, active }: { byOrganism: Record<number, number>; active: boolean }) {
  const entries = Object.entries(byOrganism)
    .map(([t, n]) => ({ taxon: Number(t), n }))
    .filter((e) => e.n > 0 && ORG_COLORS[e.taxon])
    .sort((a, b) => b.n - a.n);
  const total = entries.reduce((s, e) => s + e.n, 0);
  if (total <= 0) return <span className="h-2 w-10 shrink-0" aria-hidden />;
  return (
    <span
      className={`flex h-2 w-10 shrink-0 overflow-hidden transition-opacity ${
        active ? "opacity-100" : "opacity-0 group-hover/tree:opacity-70"
      }`}
      title={entries.map((e) => `${e.taxon}: ${e.n}`).join(" · ")}
      aria-hidden
    >
      {entries.map((e) => (
        <span
          key={e.taxon}
          style={{
            width: `${(e.n / total) * 100}%`,
            backgroundColor: ORG_COLORS[e.taxon],
          }}
        />
      ))}
    </span>
  );
}

/** 层级标记：大类实方块 / 超群菱形 / 超家族 ring 圆 / 家族小点 / 亚家族微点 */
function LevelMark({
  segs,
  isGroup,
  color,
}: {
  segs: number;
  isGroup: boolean;
  color: string;
}) {
  if (segs === 1) {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
        <span className="h-2.5 w-2.5" style={{ backgroundColor: color }} />
      </span>
    );
  }
  if (isGroup) {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
        <span
          className="h-2 w-2 rotate-45 border"
          style={{ backgroundColor: color, borderColor: color }}
        />
      </span>
    );
  }
  if (segs === 2) {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
        <span className="h-2 w-2 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${color}` }} />
      </span>
    );
  }
  if (segs === 3) {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      </span>
    );
  }
  return (
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
      <span className="h-1 w-1 rounded-full opacity-60" style={{ backgroundColor: color }} />
    </span>
  );
}

export function FamilyTree({ nodes, selected, onSelect, level = 0 }: TreeProps) {
  // 大树（数千节点）：默认全部折叠，仅渲染展开路径
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <div className="space-y-px" role="tree" aria-label="蛋白家族分类树">
      {nodes.map((node) => {
        const segs = node.code.split(".").length; // 1=大类 2=超家族/超群 3=家族 4=亚家族
        const isClass = segs === 1;
        const isGroup = node.kind === "group";
        const color = CLASS_COLORS[node.code.split(".")[0]] ?? "#8b857a";
        const isSelected = selected === node.code;
        const isCollapsed = !expanded.has(node.code);
        const hasChildren = (node.children?.length ?? 0) > 0;

        return (
          <div key={node.code} role="treeitem" aria-expanded={hasChildren ? !isCollapsed : undefined} aria-selected={isSelected}>
            <div
              className={`group/tree flex cursor-pointer items-center gap-1.5 rounded-sm px-1.5 transition-colors ${
                isClass ? "py-2" : "py-[5px]"
              } ${
                isSelected
                  ? "bg-primary/10 font-medium text-foreground ring-1 ring-inset ring-primary/25"
                  : isClass
                    ? "hover:bg-accent/60"
                    : "hover:bg-accent/40"
              }`}
              style={{ paddingLeft: `${level * 14 + 6}px` }}
              onClick={() => {
                onSelect(node.code);
                // 选中时自动展开（折叠走箭头按钮）
                if (hasChildren && !expanded.has(node.code)) toggle(node.code);
              }}
              title={`${node.name}${node.nameEn ? ` · ${node.nameEn}` : ""}${(node.children?.length ?? 0) > 0 ? `\n含子级共 ${node.totalCount.toLocaleString()} 条蛋白` : `\n${node.count.toLocaleString()} 条蛋白`}`}
            >
              {hasChildren ? (
                <button
                  className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground"
                  aria-label={isCollapsed ? "展开" : "折叠"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(node.code);
                  }}
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              <LevelMark segs={segs} isGroup={isGroup} color={color} />

              <span
                className={`truncate ${
                  isClass
                    ? "font-serif text-[13.5px] font-semibold tracking-tight"
                    : isGroup
                      ? "font-serif text-[13px] font-semibold italic"
                      : segs === 2
                        ? "text-[13px] font-medium"
                        : segs >= 4
                          ? "text-[12.5px] text-muted-foreground"
                          : "text-[13px]"
                }`}
              >
                {node.name}
              </span>

              {isGroup && (
                <span className="shrink-0 border border-primary/30 bg-primary/5 px-1 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-primary">
                  超群
                </span>
              )}

              {/* 超家族/家族行：物种构成迷你堆叠条 */}
              {!isClass && <OrgStackBar byOrganism={node.byOrganism} active={isSelected} />}

              <span
                className={`ml-auto shrink-0 font-mono text-[10.5px] tabular-nums ${
                  isSelected ? "font-medium text-primary" : "text-muted-foreground/80"
                }`}
                title={hasChildren ? `含子级共 ${node.totalCount.toLocaleString()} 条（直接挂载 ${node.count.toLocaleString()}）` : `${node.count.toLocaleString()} 条`}
              >
                {(hasChildren ? node.totalCount : node.count).toLocaleString()}
              </span>
            </div>

            {hasChildren && !isCollapsed && (
              <div className="ml-[13px] border-l border-border/70 pl-0.5" aria-hidden>
                <FamilyTree
                  nodes={node.children!}
                  selected={selected}
                  onSelect={onSelect}
                  level={level + 1}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
