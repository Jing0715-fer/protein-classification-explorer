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
      className={`flex h-2 w-10 shrink-0 overflow-hidden rounded-full transition-opacity ${
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
    <div className="space-y-0.5" role="tree" aria-label="蛋白家族分类树">
      {nodes.map((node) => {
        const segs = node.code.split(".").length; // 1=大类 2=超家族 3=家族 4=亚家族
        const isClass = segs === 1;
        const isSuperfamily = segs === 2;
        const color = CLASS_COLORS[node.code.split(".")[0]] ?? "#64748b";
        const isSelected = selected === node.code;
        const isCollapsed = !expanded.has(node.code);
        const hasChildren = (node.children?.length ?? 0) > 0;

        return (
          <div key={node.code} role="treeitem" aria-expanded={hasChildren ? !isCollapsed : undefined} aria-selected={isSelected}>
            <div
              className={`group/tree flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 transition-colors ${
                isSelected
                  ? "bg-emerald-50 font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
                  : "hover:bg-accent"
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
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-border"
                  aria-label={isCollapsed ? "展开" : "折叠"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(node.code);
                  }}
                >
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              <span
                className={`${isClass ? "h-2 w-2" : isSuperfamily ? "h-2 w-2" : "h-1.5 w-1.5"} shrink-0 rounded-full ${isSuperfamily ? "ring-2 ring-offset-1 ring-offset-card" : ""}`}
                style={{ backgroundColor: color, ...(isSuperfamily ? { boxShadow: `0 0 0 1px ${color}` } : {}) }}
                aria-hidden
              />
              <span
                className={`truncate ${
                  isClass
                    ? "font-semibold"
                    : isSuperfamily
                      ? "font-medium"
                      : segs >= 4
                        ? "text-[13px] text-muted-foreground"
                        : ""
                }`}
              >
                {node.name}
              </span>

              {/* 超家族/家族行：物种构成迷你堆叠条 */}
              {!isClass && <OrgStackBar byOrganism={node.byOrganism} active={isSelected} />}

              <span
                className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  isSelected
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
                title={hasChildren ? `含子级共 ${node.totalCount.toLocaleString()} 条（直接挂载 ${node.count.toLocaleString()}）` : `${node.count.toLocaleString()} 条`}
              >
                {(hasChildren ? node.totalCount : node.count).toLocaleString()}
              </span>
            </div>

            {hasChildren && !isCollapsed && (
              <FamilyTree
                nodes={node.children!}
                selected={selected}
                onSelect={onSelect}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
