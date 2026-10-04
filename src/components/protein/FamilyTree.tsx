"use client";

import type { FamilyNodeDTO } from "@/lib/protein-types";
import { CLASS_COLORS } from "@/lib/protein-types";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface TreeProps {
  nodes: FamilyNodeDTO[];
  selected: string | null;
  onSelect: (code: string) => void;
  level?: number;
}

export function FamilyTree({ nodes, selected, onSelect, level = 0 }: TreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (code: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <div className="space-y-0.5" role="tree" aria-label="蛋白家族分类树">
      {nodes.map((node) => {
        const isClass = !node.code.includes(".");
        const color = CLASS_COLORS[node.code] ?? "#64748b";
        const isSelected = selected === node.code;
        const isCollapsed = collapsed.has(node.code);
        const hasChildren = (node.children?.length ?? 0) > 0;

        return (
          <div key={node.code} role="treeitem" aria-expanded={hasChildren ? !isCollapsed : undefined} aria-selected={isSelected}>
            <div
              className={`group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 text-sm transition-colors ${
                isSelected
                  ? "bg-emerald-50 font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
                  : "hover:bg-accent"
              }`}
              style={{ paddingLeft: `${level * 14 + 6}px` }}
              onClick={() => onSelect(node.code)}
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
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className={`truncate ${isClass ? "font-semibold" : ""}`}>{node.name}</span>
              <span
                className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  isSelected ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                }`}
              >
                {isClass ? node.totalCount : node.count}
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
