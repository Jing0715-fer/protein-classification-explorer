/**
 * 全量抓取 10 种模式生物的 Swiss-Prot 已审核蛋白组
 * 通过 UniProt REST API 游标分页获取，含 OrthoDB 直系同源组、关键词、结构域、EC、序列
 * 运行: bun run scripts/fetch-proteomes.ts
 * 输出: download/proteomes/{taxon}.jsonl + download/proteomes/manifest.json + stats.json
 */
import { mkdir } from "node:fs/promises";

const BASE = "https://rest.uniprot.org/uniprotkb/search";
const FIELDS = [
  "accession",
  "id",
  "protein_name",
  "gene_primary",
  "organism_name",
  "organism_id",
  "length",
  "mass",
  "keyword",
  "ft_domain",
  "ec",
  "xref_orthodb",
  "xref_eggnog",
  "sequence",
].join(",");

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
  { taxonId: 559292, commonName: "Yeast (S288C)" },
  { taxonId: 4932, commonName: "Yeast (species-level)" },
  { taxonId: 3702, commonName: "Arabidopsis" },
  { taxonId: 83333, commonName: "E. coli (K-12)" },
  { taxonId: 562, commonName: "E. coli (species-level)" },
];

export interface RawProtein {
  accession: string;
  entryName: string;
  entryType: string;
  proteinName: string;
  genePrimary: string;
  organismName: string;
  organismId: number;
  length: number;
  mass: number;
  keywords: string[];
  domains: string[];
  ecs: string[];
  orthodb: string[];
  eggnog: string[];
  sequence: string;
}

function splitList(v: string): string[] {
  return v
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 解析一页 TSV 文本为结构化蛋白行 */
function parseTsvPage(text: string): RawProtein[] {
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split("\t");
  const idx = (name: string) => header.indexOf(name);
  const iAcc = idx("Entry");
  const iId = idx("Entry Name");
  const iType = -1; // entry_type 字段不可用，全部为 reviewed
  const iName = idx("Protein names");
  const iGene = idx("Gene Names (primary)") >= 0 ? idx("Gene Names (primary)") : -1;
  const iOrgName = idx("Organism");
  const iOrgId = idx("Organism (ID)");
  const iLen = idx("Length");
  const iMass = idx("Mass");
  const iKw = idx("Keywords");
  const iDom = idx("Domain [FT]");
  const iEc = idx("EC number");
  const iOdb = idx("OrthoDB");
  const iEgg = idx("eggNOG");
  const iSeq = idx("Sequence");
  if (iAcc < 0 || iId < 0 || iName < 0 || iSeq < 0) {
    throw new Error(`意外表头: ${header.join("|")}`);
  }
  const rows: RawProtein[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split("\t");
    const get = (i: number) => (i >= 0 ? (cols[i] ?? "") : "");
    const massRaw = get(iMass).replace(/,/g, "");
    const massNum = massRaw ? parseFloat(massRaw) : 0;
    rows.push({
      accession: get(iAcc),
      entryName: get(iId),
      entryType: "reviewed",
      proteinName: get(iName),
      genePrimary: get(iGene),
      organismName: get(iOrgName),
      organismId: parseInt(get(iOrgId) || "0", 10),
      length: parseInt(get(iLen) || "0", 10),
      mass: massNum ? Math.round(massNum) / 1000 : 0, // Da -> kDa
      keywords: splitList(get(iKw)),
      domains: splitList(get(iDom)),
      ecs: splitList(get(iEc)),
      orthodb: splitList(get(iOdb)),
      eggnog: splitList(get(iEgg)),
      sequence: get(iSeq).replace(/\s/g, ""),
    });
  }
  return rows;
}

function nextUrlFromLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  // 注意: Link header 的 URL 内含未编码逗号（fields=a,b,c），不能简单 split(",")
  // URL 本身不含 ">" 和引号，直接整体匹配即可
  const m = linkHeader.match(/<([^>]+)>\s*;\s*rel="next"/);
  return m ? m[1] : null;
}

async function fetchWithRetry(url: string, tries = 5): Promise<Response> {
  let lastErr: unknown = null;
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "protein-explorer/2.0 (contact: sandbox)" },
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
      console.log(`    请求失败(${String(e).slice(0, 80)})，${wait / 1000}s 后重试`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("重试次数耗尽");
}

interface OrgStats {
  taxonId: number;
  commonName: string;
  fetched: number;
  orthodbCovered: number;
  ecCovered: number;
  keywordHistogram: Record<string, number>;
  domainHistogram: Record<string, number>;
}

async function fetchOrganism(target: Target, outDir: string): Promise<OrgStats> {
  const { taxonId, commonName } = target;
  const outFile = `${outDir}/${taxonId}.jsonl`;
  const stats: OrgStats = {
    taxonId,
    commonName,
    fetched: 0,
    orthodbCovered: 0,
    ecCovered: 0,
    keywordHistogram: {},
    domainHistogram: {},
  };

  // 已完成则跳过（行数 > 0 且有完成标记）
  const doneMarker = `${outDir}/${taxonId}.done`;
  const existing = await Bun.file(outFile).exists();
  const done = await Bun.file(doneMarker).exists();
  if (existing && done) {
    // 读取已有文件统计
    const text = await Bun.file(outFile).text();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      stats.fetched++;
      try {
        const p = JSON.parse(line) as RawProtein;
        if (p.orthodb?.length) stats.orthodbCovered++;
        if (p.ecs?.length) stats.ecCovered++;
        for (const k of p.keywords ?? []) stats.keywordHistogram[k] = (stats.keywordHistogram[k] ?? 0) + 1;
        for (const d of p.domains ?? []) stats.domainHistogram[d] = (stats.domainHistogram[d] ?? 0) + 1;
      } catch {
        /* 忽略坏行 */
      }
    }
    console.log(`[跳过] ${commonName}(${taxonId}) 已完成 ${stats.fetched} 条`);
    return stats;
  }

  const writer = Bun.file(outFile).writer();
  let url: string | null =
    `${BASE}?query=${encodeURIComponent(`(organism_id:${taxonId}) AND reviewed:true`)}&format=tsv&fields=${FIELDS_ENCODED}&size=500`;
  let page = 0;
  while (url) {
    const res = await fetchWithRetry(url);
    const text = await res.text();
    const rows = parseTsvPage(text);
    for (const p of rows) {
      writer.write(JSON.stringify(p) + "\n");
      stats.fetched++;
      if (p.orthodb.length) stats.orthodbCovered++;
      if (p.ecs.length) stats.ecCovered++;
      for (const k of p.keywords) stats.keywordHistogram[k] = (stats.keywordHistogram[k] ?? 0) + 1;
      for (const d of p.domains) stats.domainHistogram[d] = (stats.domainHistogram[d] ?? 0) + 1;
    }
    page++;
    if (page % 5 === 0) console.log(`  ${commonName}: 已抓取 ${stats.fetched} 条 (${page} 页)`);
    await new Promise((r) => setTimeout(r, 120));
    const link = res.headers.get("link");
    if (page <= 2) console.log(`    [debug] page${page} link=${link ? link.slice(0, 80) : "NULL"}`);
    url = nextUrlFromLink(link);
    if (!url) {
      // Link header 里可能没有 next 但有 last —— 到达末页时 next 为空
      console.log(`  ${commonName}: 分页完成，共 ${page} 页 / ${stats.fetched} 条`);
    }
  }
  await writer.end();
  await Bun.write(doneMarker, new Date().toISOString());
  return stats;
}

async function main() {
  const outDir = "download/proteomes";
  await mkdir(outDir, { recursive: true });
  console.log(`=== 开始全量抓取 ${TARGETS.length} 个物种的 Swiss-Prot 蛋白组 ===`);
  const t0 = Date.now();
  const allStats: OrgStats[] = [];
  for (const target of TARGETS) {
    const ts = await fetchOrganism(target, outDir);
    allStats.push(ts);
    console.log(
      `[完成] ${target.commonName}(${target.taxonId}): ${ts.fetched} 条, OrthoDB覆盖 ${ts.orthodbCovered} (${((ts.orthodbCovered / Math.max(1, ts.fetched)) * 100).toFixed(1)}%)`
    );
  }

  // 汇总 manifest + 全局关键词/结构域直方图
  const keywordHistogram: Record<string, number> = {};
  const domainHistogram: Record<string, number> = {};
  for (const s of allStats) {
    for (const [k, n] of Object.entries(s.keywordHistogram)) keywordHistogram[k] = (keywordHistogram[k] ?? 0) + n;
    for (const [k, n] of Object.entries(s.domainHistogram)) domainHistogram[k] = (domainHistogram[k] ?? 0) + n;
  }
  const total = allStats.reduce((a, b) => a + b.fetched, 0);
  const manifest = {
    generatedAt: new Date().toISOString(),
    fields: FIELDS,
    organisms: allStats.map((s) => ({
      taxonId: s.taxonId,
      commonName: s.commonName,
      fetched: s.fetched,
      orthodbCovered: s.orthodbCovered,
      ecCovered: s.ecCovered,
    })),
    total,
  };
  await Bun.write(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
  await Bun.write(
    `${outDir}/stats.json`,
    JSON.stringify(
      {
        manifest,
        keywordHistogram: Object.fromEntries(Object.entries(keywordHistogram).sort((a, b) => b[1] - a[1])),
        domainHistogram: Object.fromEntries(Object.entries(domainHistogram).sort((a, b) => b[1] - a[1])),
      },
      null,
      1
    )
  );
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n=== 全部完成: ${total} 条蛋白, 耗时 ${mins} 分钟 ===`);
  console.log(`输出: ${outDir}/manifest.json, stats.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
