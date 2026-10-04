/** 快速扫描：SLC 基因编号分布 + 需并入 SLC 分支的独立超家族节点名 */
import { CLASSES } from "./classify";

const TAXA = [9606, 10090, 10116, 7955, 9031, 7227, 6239, 559292, 3702, 83333];

async function main() {
  // 1) 所有 SLC 基因编号分布
  const slcNums = new Map<string, number>();
  const genes = new Set<string>();
  for (const taxon of TAXA) {
    const f = Bun.file(`download/proteomes/${taxon}.jsonl`);
    if (!(await f.exists())) continue;
    for (const line of (await f.text()).split("\n")) {
      if (!line.trim()) continue;
      const p = JSON.parse(line) as { genePrimary?: string };
      const g = (p.genePrimary ?? "").trim();
      if (!g) continue;
      const m = g.match(/^SLC-?(\d+)/i) ?? g.match(/^SLCO(\d+)/i);
      if (m) {
        const key = g.match(/^SLCO/i) ? "SLCO" : `SLC${m[1]}`;
        slcNums.set(key, (slcNums.get(key) ?? 0) + 1);
        genes.add(g);
      }
    }
  }
  console.log("===== SLC 基因编号（按家族）=====");
  for (const [k, n] of [...slcNums.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
    console.log(`   ${k}: ${n}`);
  }

  // 2) 类 5 中所有 level2 节点名（用 hier-families.json 重建 parent 关系）
  const data = (await Bun.file("download/hier-families.json").json()) as {
    families: { code: string; nameEn: string; level: number; totalCount: number }[];
  };
  const codes = new Set(data.families.map((f) => f.code));
  console.log(`\n===== 类 5 level2 独立节点（去掉编码含 5.1 前缀的）=====`);
  for (const f of data.families) {
    if (!f.code.startsWith("5.")) continue;
    const segs = f.code.split(".");
    if (segs.length !== 2) continue;
    if (f.code === "5.1") continue;
    // transport-related 名称
    console.log(`   ${f.code} ${f.totalCount}\t${f.nameEn}`);
  }
  void codes;
  void CLASSES;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
