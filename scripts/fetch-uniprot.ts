/**
 * 从 UniProt REST API 抓取精选蛋白的真实数据
 * 运行: bun run scripts/fetch-uniprot.ts
 * 输出: src/data/proteins-raw.json
 */
import { CURATED, type Curated } from "./curated";

const BASE = "https://rest.uniprot.org/uniprotkb/search";
const FIELDS =
  "accession,id,protein_name,gene_names,organism_name,organism_id,length,mass,cc_function,cc_subcellular_location,cc_ptm,keyword,ft_domain,xref_pdb,sequence";

// UniProt 分类 ID -> 我们的目标物种（含菌株归并）
const TAXON_MAP: Record<number, number> = {
  9606: 9606, 10090: 10090, 10116: 10116, 7955: 7955, 9031: 9031,
  7227: 7227, 6239: 6239, 4932: 4932, 559292: 4932, 3702: 3702,
  562: 562, 83333: 562, 511145: 562,
};

interface UniEntry {
  primaryAccession: string;
  uniProtkbId?: string;
  entryType?: string;
  organism?: { scientificName?: string; commonName?: string[] | string; taxonId?: number };
  proteinDescription?: {
    recommendedName?: { fullName?: { value?: string } };
    submissionNames?: { fullName?: { value?: string } }[];
    alternativeNames?: { fullName?: { value?: string } }[];
  };
  genes?: { geneName?: { value?: string }; synonyms?: { value?: string }[] }[];
  sequence?: { length?: number; molWeight?: string; value?: string };
  comments?: any[];
  keywords?: { name?: string }[];
  features?: { type?: string; description?: string }[];
  uniProtKBCrossReferences?: { database?: string; id?: string }[];
}

interface FetchedProtein {
  accession: string;
  entryName: string;
  reviewed: boolean;
  proteinName: string;
  altNames: string;
  geneName: string;
  geneSynonyms: string;
  taxonId: number;
  scientificName: string;
  commonName: string;
  length: number;
  massKda: number;
  functionText: string;
  subcellular: string;
  ptm: string;
  keywords: string;
  domains: string;
  pdbCount: number;
  sequence: string;
}

function pick<T>(arr: T[] | undefined, n: number): T[] {
  return (arr ?? []).slice(0, n);
}

function extract(entry: UniEntry): FetchedProtein {
  const pd = entry.proteinDescription ?? {};
  const proteinName =
    pd.recommendedName?.fullName?.value ??
    pd.submissionNames?.[0]?.fullName?.value ??
    entry.primaryAccession;
  const altNames = pick(
    (pd.alternativeNames ?? []).map((a) => a.fullName?.value ?? "").filter(Boolean),
    3
  ).join("; ");

  const gene = entry.genes?.[0];
  const geneName = gene?.geneName?.value ?? "";
  const geneSynonyms = pick((gene?.synonyms ?? []).map((s) => s.value ?? "").filter(Boolean), 3).join(", ");

  const funcComment = entry.comments?.find((c) => c.commentType === "FUNCTION");
  const functionText = (funcComment?.texts?.[0]?.value ?? "").slice(0, 1500);

  const subloc = entry.comments?.find((c) => c.commentType === "SUBCELLULAR LOCATION");
  const subcellular = pick(
    (subloc?.locations ?? []).map((l) => l.location?.value ?? "").filter(Boolean),
    3
  ).join("; ");

  const ptmComment = entry.comments?.find((c) => c.commentType === "PTM");
  const ptm = (ptmComment?.texts?.[0]?.value ?? "").slice(0, 900);

  const keywords = pick((entry.keywords ?? []).map((k) => k.name ?? "").filter(Boolean), 30).join("; ");
  const domains = pick(
    (entry.features ?? [])
      .filter((f) => f.type === "Domain")
      .map((f) => f.description ?? "")
      .filter(Boolean),
    8
  ).join("; ");
  const pdbCount = (entry.uniProtKBCrossReferences ?? []).filter((x) => x.database === "PDB").length;
  const mol = parseFloat(entry.sequence?.molWeight ?? "0") / 1000;
  const commonNameRaw = entry.organism?.commonName;
  const commonName = Array.isArray(commonNameRaw) ? commonNameRaw[0] ?? "" : commonNameRaw ?? "";

  return {
    accession: entry.primaryAccession,
    entryName: entry.uniProtkbId ?? "",
    reviewed: (entry.entryType ?? "").includes("reviewed"),
    proteinName,
    altNames,
    geneName,
    geneSynonyms,
    taxonId: entry.organism?.taxonId ?? 0,
    scientificName: entry.organism?.scientificName ?? "",
    commonName,
    length: entry.sequence?.length ?? 0,
    massKda: Math.round(mol * 10) / 10,
    functionText,
    subcellular,
    ptm,
    keywords,
    domains,
    pdbCount,
    sequence: entry.sequence?.value ?? "",
  };
}

async function fetchBatch(accessions: string[]): Promise<UniEntry[]> {
  const query = `accession:(${accessions.join(" OR ")})`;
  const url = `${BASE}?query=${encodeURIComponent(query)}&format=json&size=500&fields=${encodeURIComponent(FIELDS)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.error(`  ! batch HTTP ${res.status}`);
    return [];
  }
  const json = (await res.json()) as { results?: UniEntry[] };
  return json.results ?? [];
}

async function fetchByGene(gene: string, taxon: number): Promise<UniEntry | null> {
  const query = `gene_exact:"${gene}" AND organism_id:${taxon} AND reviewed:true`;
  const url = `${BASE}?query=${encodeURIComponent(query)}&format=json&size=2&fields=${encodeURIComponent(FIELDS)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: UniEntry[] };
  return json.results?.[0] ?? null;
}

async function main() {
  console.log(`共 ${CURATED.length} 条精选记录，开始抓取 UniProt...`);

  // 1) 批量按登录号抓取
  const withAcc = CURATED.filter((c) => c.a);
  const accSet = new Set<string>();
  for (const c of withAcc) if (c.a) accSet.add(c.a);
  const accList = [...accSet];
  console.log(`按登录号批量抓取: ${accList.length} 个`);

  const accMap = new Map<string, UniEntry>();
  const chunk = 100;
  for (let i = 0; i < accList.length; i += chunk) {
    const part = accList.slice(i, i + chunk);
    const entries = await fetchBatch(part);
    for (const e of entries) accMap.set(e.primaryAccession, e);
    console.log(`  批 ${i / chunk + 1}: 获取 ${entries.length}/${part.length}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  // 2) 无登录号或批量未命中的 → 按 gene_exact + organism 搜索
  const needGene: Curated[] = [];
  for (const c of CURATED) {
    if (!c.a || !accMap.has(c.a)) needGene.push(c);
  }
  console.log(`按基因符号搜索: ${needGene.length} 条`);

  const geneResults = new Map<string, UniEntry>(); // key: `${gene}|${taxon}`
  const misses: Curated[] = [];
  for (const c of needGene) {
    const entry = await fetchByGene(c.g, c.t);
    if (entry) {
      geneResults.set(`${c.g}|${c.t}`, entry);
    } else {
      misses.push(c);
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  // 3) 汇总提取
  const proteins: (FetchedProtein & { family: string; orthologGroup: string; isRepresentative: boolean; curatedGene: string; curatedTaxon: number })[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();

  const push = (c: Curated, e: UniEntry, via: string) => {
    const p = extract(e);
    const mappedTaxon = TAXON_MAP[p.taxonId] ?? 0;
    if (!mappedTaxon) {
      dropped.push(`${c.g}(${c.t}) via ${via}: ${p.accession} 物种不匹配 -> ${p.scientificName} (${p.taxonId})`);
      return;
    }
    if (seen.has(p.accession)) {
      dropped.push(`${c.g}(${c.t}) via ${via}: ${p.accession} 重复`);
      return;
    }
    seen.add(p.accession);
    proteins.push({
      ...p,
      family: c.f,
      orthologGroup: c.o,
      isRepresentative: !!c.r,
      curatedGene: c.g,
      curatedTaxon: c.t,
    });
  };

  for (const c of CURATED) {
    if (c.a) {
      const e = accMap.get(c.a);
      if (e) push(c, e, "acc");
      else {
        const g = geneResults.get(`${c.g}|${c.t}`);
        if (g) push(c, g, "gene-fallback");
        else dropped.push(`${c.g}(${c.t}) 登录号 ${c.a} 未命中且基因搜索失败`);
      }
    } else {
      const g = geneResults.get(`${c.g}|${c.t}`);
      if (g) push(c, g, "gene");
      // misses 已记录
    }
  }

  // 4) 报告
  const byTaxon = new Map<number, number>();
  for (const p of proteins) byTaxon.set(p.taxonId, (byTaxon.get(p.taxonId) ?? 0) + 1);

  console.log("\n=== 抓取报告 ===");
  console.log(`成功: ${proteins.length}`);
  for (const [t, n] of [...byTaxon].sort((a, b) => a[0] - b[0])) console.log(`  taxon ${t}: ${n}`);
  console.log(`基因搜索未命中(${misses.length}): ${misses.map((m) => `${m.g}(${m.t})`).join(", ")}`);
  console.log(`丢弃(${dropped.length}):`);
  for (const d of dropped) console.log(`  - ${d}`);

  const out = { generatedAt: new Date().toISOString(), proteins, stats: { total: proteins.length, dropped: dropped.length, missed: misses.length } };
  const path = new URL("./../src/data/proteins-raw.json", import.meta.url).pathname;
  await Bun.write(path, JSON.stringify(out, null, 1));
  console.log(`\n已写入 ${path}`);

  // 控制台输出完整清单（accession | entryName | gene | organism）便于人工校对
  console.log("\n=== 数据校对清单 ===");
  for (const p of proteins.sort((a, b) => a.family.localeCompare(b.family) || a.orthologGroup.localeCompare(b.orthologGroup))) {
    console.log(`${p.family.padEnd(5)} ${p.accession.padEnd(7)} ${p.entryName.padEnd(14)} ${(p.geneName || "-").padEnd(10)} ${p.scientificName.padEnd(28)} ${p.orthologGroup}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
