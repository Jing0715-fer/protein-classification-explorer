/**
 * 诊断脚本：排查当前层级树的重复家族节点 + 统计真实链超家族名分布
 * 运行: bun run scripts/analyze-dupes.ts
 */
import { CLASSES } from "./classify";

interface FamRow {
  code: string;
  name: string;
  nameEn: string;
  description: string;
  level: number;
  kind?: string;
  totalCount: number;
}

function normKey(en: string): string {
  return en
    .replace(/\s*\(TC [^)]*\)/gi, "")
    .replace(/\s*\(EC [0-9.()-]+\)/gi, "")
    .replace(/\.+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function main() {
  const data = (await Bun.file("download/hier-families.json").json()) as { families: FamRow[] };
  const fams = data.families;

  // 1) 重建树：code 去尾段 = parent code
  const byCode = new Map(fams.map((f) => [f.code, f]));
  const parentOf = (code: string): string | null => {
    const parts = code.split(".");
    if (parts.length === 1) return null;
    return parts.slice(0, -1).join(".");
  };
  const pathOf = (code: string): string => {
    const segs: string[] = [];
    let cur = code;
    while (true) {
      const f = byCode.get(cur);
      if (!f) break;
      segs.unshift(f.nameEn);
      const p = parentOf(cur);
      if (!p) {
        // 大类根
        const cls = CLASSES.find((c) => c.code === cur);
        if (cls) segs.unshift(cls.nameEn);
        break;
      }
      cur = p;
    }
    return segs.join(" → ");
  };

  // 2) 全局重名检测（归一化名 → 出现位置列表）
  const byName = new Map<string, FamRow[]>();
  for (const f of fams) {
    if (f.level === 1) continue;
    const k = normKey(f.nameEn);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(f);
  }
  const dupes = [...byName.entries()].filter(([, v]) => v.length > 1);
  dupes.sort((a, b) => b[1].length - a[1].length || b[1].reduce((s, f) => s + f.totalCount, 0) - a[1].reduce((s, f) => s + f.totalCount, 0));

  console.log(`\n===== 全局重名家族（同一归一化名出现 >1 次）: ${dupes.length} 组 =====`);
  for (const [k, v] of dupes.slice(0, 60)) {
    console.log(`\n[${k}] ×${v.length}`);
    for (const f of v) {
      console.log(`   ${f.code} (L${f.level}${f.kind ? "," + f.kind : ""}) total=${f.totalCount} :: ${pathOf(f.code)}`);
    }
  }

  // 3) 转运大类 (5) 下的 level2 节点全景（找 SLC 相关超家族的独立节点）
  console.log(`\n===== 类 5 (通道与转运) level2 节点 =====`);
  for (const f of fams) {
    if (f.level === 2 && f.code.startsWith("5.")) {
      console.log(`   ${f.code} total=${f.totalCount}${f.kind ? " [" + f.kind + "]" : ""} ${f.nameEn}`);
    }
  }

  // 4) SLC 超群分支内部结构
  console.log(`\n===== SLC 超群分支内部 (level3/4) =====`);
  const slc = fams.find((f) => f.kind === "group" && /supergroup/i.test(f.nameEn));
  if (slc) {
    for (const f of fams) {
      if (f.code.startsWith(slc.code + ".") && f.level <= 3) {
        console.log(`   ${f.code} (L${f.level}${f.kind ? "," + f.kind : ""}) total=${f.totalCount} ${f.nameEn}`);
      }
    }
  }

  // 5) 统计 MFS 相关蛋白在 families/*.jsonl 的原始链分布
  console.log(`\n===== 原始链超家族名直方图（转运相关 top） =====`);
  const TAXA = [9606, 10090, 10116, 7955, 9031, 7227, 6239, 559292, 3702, 83333];
  const sfHist = new Map<string, number>();
  const sfByOrg = new Map<string, Set<number>>();
  for (const taxon of TAXA) {
    const f = Bun.file(`download/families/${taxon}.jsonl`);
    if (!(await f.exists())) continue;
    for (const line of (await f.text()).split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as { accession: string; sim: string };
        if (!r.sim) continue;
        const first = r.sim
          .replace(/\{ECO:[^}]*\}/g, "")
          .replace(/In the (?:N|C)-terminal section;\s*belongs to (?:the|a)\s*/gi, "")
          .replace(/^.*?belongs to (?:the|a)\s*/i, "")
          .split(/(?<=\.)\s+(?=[A-Z0-9])/)[0]
          .replace(/\.+$/, "")
          .trim();
        if (!first) continue;
        const k = normKey(first);
        sfHist.set(k, (sfHist.get(k) ?? 0) + 1);
        if (!sfByOrg.has(k)) sfByOrg.set(k, new Set());
        sfByOrg.get(k)!.add(taxon);
      } catch { /* ignore */ }
    }
  }
  const transportish = [...sfHist.entries()].filter(([k]) =>
    /major facilitator|carrier|transporter|symporter|antiporter|permease|apc|sul|mate|caca|cpa|nss|sss|zip|zrt|nramp|solute|anion|bicarbonate|mitochondrial|nucleotide-sugar|sugar|peptide|amino acid|cation|metal|iron|copper|zinc|phosphate/i.test(k)
  );
  transportish.sort((a, b) => b[1] - a[1]);
  for (const [k, n] of transportish.slice(0, 50)) {
    console.log(`   ${n}\t${sfByOrg.get(k)!.size}物种\t${k}`);
  }

  // 6) 人 SLC 蛋白链样例（看官方链对 SLC 家族怎么写）
  console.log(`\n===== 人 SLC 蛋白官方链样例 =====`);
  {
    const f = Bun.file(`download/families/9606.jsonl`);
    const text = await f.text();
    const seen = new Set<string>();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as { accession: string; sim: string; gene?: string };
        if (!r.sim) continue;
        const m = r.sim.match(/(?:gene_primary:\s*"?)(SLC[A-Z]?\d+)/i) || r.sim.match(/^(SLC[A-Z]?\d+)/i);
        // families 文件可能只有 accession+sim，改用 proteomes 基因
        void m;
      } catch { /* ignore */ }
    }
    // 改用 proteomes 拿基因名
    const pf = Bun.file(`download/proteomes/9606.jsonl`);
    const simByAcc = new Map<string, string>();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as { accession: string; sim: string };
        if (r.accession && r.sim) simByAcc.set(r.accession, r.sim);
      } catch { /* ignore */ }
    }
    let shown = 0;
    for (const line of (await pf.text()).split("\n")) {
      if (!line.trim()) continue;
      const p = JSON.parse(line) as { accession: string; genePrimary?: string };
      const g = p.genePrimary ?? "";
      const m = g.match(/^SLC-?(\d+)/i) || g.match(/^SLCO(\d+)/i);
      if (!m) continue;
      const famKey = g.match(/^SLCO/) ? `SLCO${m[1]}` : `SLC${m[1]}`;
      if (seen.has(famKey)) continue;
      const sim = simByAcc.get(p.accession) ?? "(无链)";
      seen.add(famKey);
      console.log(`   ${g}\t${sim.slice(0, 160)}`);
      shown++;
      if (shown >= 45) break;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
