/**
 * 补充抓取：10 物种全量蛋白的 UniProt 官方家族链（cc_similarity "Belongs to..."）
 * 只抓 accession + cc_similarity 两个字段，轻量快速
 * 运行: bun run scripts/fetch-families.ts
 * 输出: download/families/{taxon}.jsonl ({accession, sim}) + histogram.json
 */
import { mkdir } from "node:fs/promises";

const BASE = "https://rest.uniprot.org/uniprotkb/search";
const FIELDS = "accession,cc_similarity";
const FIELDS_ENCODED = encodeURIComponent(FIELDS);

interface Target {
  taxonId: number;
  commonName: string;
}

const TARGETS: Target[] = [
  { taxonId: 9606, commonName: "Human" },
  { taxonId: 10090, commonName: "Mouse" },
  { taxonId: 10116, commonName: "Rat" },
  { taxonId: 7955, commonName: "Zebrafish" },
  { taxonId: 9031, commonName: "Chicken" },
  { taxonId: 7227, commonName: "Fruit fly" },
  { taxonId: 6239, commonName: "C. elegans" },
  { taxonId: 559292, commonName: "Yeast" },
  { taxonId: 3702, commonName: "Arabidopsis" },
  { taxonId: 83333, commonName: "E. coli" },
];

export interface FamilyRaw {
  accession: string;
  sim: string;
}

function nextUrlFromLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const m = linkHeader.match(/<([^>]+)>\s*;\s*rel="next"/);
  return m ? m[1] : null;
}

async function fetchWithRetry(url: string, tries = 5): Promise<Response> {
  let lastErr: unknown = null;
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "protein-explorer/2.1 (contact: sandbox)" },
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 429 || res.status >= 500) {
        const wait = 3000 * (t + 1);
        console.log(`    HTTP ${res.status}，${wait / 1000}s 后重试`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      const wait = 2000 * (t + 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("重试次数耗尽");
}

async function fetchOrganism(target: Target, outDir: string): Promise<{ fetched: number; withSim: number }> {
  const { taxonId, commonName } = target;
  const outFile = `${outDir}/${taxonId}.jsonl`;
  const doneMarker = `${outDir}/${taxonId}.done`;
  if (await Bun.file(doneMarker).exists()) {
    const text = await Bun.file(outFile).text();
    let n = 0, ws = 0;
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      n++;
      try {
        const p = JSON.parse(line) as FamilyRaw;
        if (p.sim) ws++;
      } catch { /* ignore */ }
    }
    console.log(`[跳过] ${commonName}(${taxonId}) 已完成 ${n} 条`);
    return { fetched: n, withSim: ws };
  }

  const writer = Bun.file(outFile).writer();
  let fetched = 0;
  let withSim = 0;
  let url: string | null =
    `${BASE}?query=${encodeURIComponent(`(organism_id:${taxonId}) AND reviewed:true`)}&format=tsv&fields=${FIELDS_ENCODED}&size=500`;
  let page = 0;
  while (url) {
    const res = await fetchWithRetry(url);
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.length > 0);
    if (lines.length >= 2) {
      const header = lines[0].split("\t");
      const iAcc = header.indexOf("Entry");
      const iSim = header.indexOf("Sequence similarities");
      if (iAcc < 0) throw new Error(`意外表头: ${header.join("|")}`);
      for (let li = 1; li < lines.length; li++) {
        const cols = lines[li].split("\t");
        const acc = cols[iAcc] ?? "";
        const sim = iSim >= 0 ? (cols[iSim] ?? "") : "";
        if (!acc) continue;
        writer.write(JSON.stringify({ accession: acc, sim } satisfies FamilyRaw) + "\n");
        fetched++;
        if (sim) withSim++;
      }
    }
    page++;
    if (page % 10 === 0) console.log(`  ${commonName}: 已抓取 ${fetched} 条 (${page} 页)`);
    await new Promise((r) => setTimeout(r, 120));
    url = nextUrlFromLink(res.headers.get("link"));
    if (!url) console.log(`  ${commonName}: 完成 ${fetched} 条，其中有家族链 ${withSim} (${((withSim / Math.max(1, fetched)) * 100).toFixed(1)}%)`);
  }
  await writer.end();
  await Bun.write(doneMarker, new Date().toISOString());
  return { fetched, withSim };
}

async function main() {
  const outDir = "download/families";
  await mkdir(outDir, { recursive: true });
  console.log(`=== 抓取 ${TARGETS.length} 物种的 UniProt 官方家族链 ===`);
  const t0 = Date.now();
  const results: { taxonId: number; commonName: string; fetched: number; withSim: number }[] = [];
  for (const target of TARGETS) {
    const r = await fetchOrganism(target, outDir);
    results.push({ ...target, ...r });
  }
  const total = results.reduce((a, b) => a + b.fetched, 0);
  const withSim = results.reduce((a, b) => a + b.withSim, 0);
  console.log(`\n=== 完成: ${total} 条，有家族链 ${withSim} (${((withSim / total) * 100).toFixed(1)}%)，耗时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟 ===`);
  await Bun.write(`${outDir}/manifest.json`, JSON.stringify({ generatedAt: new Date().toISOString(), total, withSim, organisms: results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
