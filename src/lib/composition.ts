// 氨基酸组成计算（共享工具）
const AA_LIST = ["A", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "Y"];

export function computeComposition(seq: string): { aa: string; pct: number }[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const ch of seq.toUpperCase()) {
    if (AA_LIST.includes(ch)) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
      total++;
    }
  }
  return AA_LIST.map((aa) => ({
    aa,
    pct: total > 0 ? Math.round(((counts.get(aa) ?? 0) / total) * 10000) / 100 : 0,
  }));
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}
