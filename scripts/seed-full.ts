/**
 * 全量数据入库：87,728 蛋白 / 13 大类 + UniProt 官方超家族→家族→亚家族层级 / OrthoDB 直系同源组
 * 运行: bun run scripts/seed-full.ts
 * 输入: download/hier-classified.jsonl + download/hier-families.json
 */
import { PrismaClient } from "@prisma/client";
import { CLASSES } from "./classify";

const db = new PrismaClient();

interface ClassifiedProtein {
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
  domains: string[]; // 原始 FT token（含 /note="..."）
  ecs: string[];
  orthodb: string[];
  eggnog: string[];
  sequence: string;
  familyCode: string;
}

/**
 * 物种定义（按系统发育顺序排列，谱系对照 NCBI Taxonomy 校准）
 * 大肠杆菌 = K-12 参考株 (83333) + 种级泛条目 (562)；酿酒酵母 = S288C (559292) + 种级条目 (4932)
 *
 * phyloPath 严格拓扑（每个分岔节点均为单系群，节点名 = 中文阶元 + 拉丁名）：
 * - 根为细胞生物（PhyloView 渲染层命名），细菌域与真核生物域为其两大分支；
 * - 植物界先于后鞭毛生物（真菌 + 动物）分化；
 * - 后生动物 → 真后生动物 → 两侧对称动物 → 原口动物（蜕皮动物：线虫 + 节肢动物）/ 后口动物（脊索动物门）；
 * - 脊索动物门 → 脊椎动物亚门 → 有颌类 → 硬骨鱼类 → 辐鳍鱼纲（斑马鱼）/ 肉鳍鱼纲 → 四足动物 → 羊膜动物（鸟纲 / 哺乳纲）；
 * - 哺乳纲 → 灵长总目 →（啮齿目：鼠科下小鼠属/大鼠属 ｜ 灵长目：人科 → 人属）。
 */
const ORGANISMS = [
  { taxonId: 83333, scientificName: "Escherichia coli", commonName: "大肠杆菌", phyloPath: "细菌域 Bacteria>变形菌门 Proteobacteria>γ-变形菌纲 Gammaproteobacteria>肠杆菌目 Enterobacterales>肠杆菌科 Enterobacteriaceae>埃希氏菌属 Escherichia", orderRank: 1 },
  { taxonId: 3702, scientificName: "Arabidopsis thaliana", commonName: "拟南芥", phyloPath: "真核生物域 Eukaryota>植物界 Plantae>有胚植物 Embryophyta>维管植物 Tracheophyta>被子植物 Magnoliophyta>真双子叶植物 Eudicots>十字花目 Brassicales>十字花科 Brassicaceae", orderRank: 2 },
  { taxonId: 559292, scientificName: "Saccharomyces cerevisiae", commonName: "酿酒酵母", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>真菌界 Fungi>子囊菌门 Ascomycota>酵母亚门 Saccharomycotina", orderRank: 3 },
  { taxonId: 6239, scientificName: "Caenorhabditis elegans", commonName: "秀丽隐杆线虫", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>原口动物 Protostomia>蜕皮动物 Ecdysozoa>线虫动物门 Nematoda>色杆纲 Chromadorea>小杆目 Rhabditida>隐杆线虫属 Caenorhabditis", orderRank: 4 },
  { taxonId: 7227, scientificName: "Drosophila melanogaster", commonName: "黑腹果蝇", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>原口动物 Protostomia>蜕皮动物 Ecdysozoa>节肢动物门 Arthropoda>昆虫纲 Insecta>双翅目 Diptera>果蝇属 Drosophila", orderRank: 5 },
  { taxonId: 7955, scientificName: "Danio rerio", commonName: "斑马鱼", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>辐鳍鱼纲 Actinopterygii>真骨下纲 Teleostei>鲤形目 Cypriniformes", orderRank: 6 },
  { taxonId: 9031, scientificName: "Gallus gallus", commonName: "红原鸡（家鸡）", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>鸟纲 Aves>鸡形目 Galliformes>雉科 Phasianidae", orderRank: 7 },
  { taxonId: 10090, scientificName: "Mus musculus", commonName: "小家鼠", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>哺乳纲 Mammalia>灵长总目 Euarchontoglires>啮齿目 Rodentia>鼠科 Muridae>小鼠属 Mus", orderRank: 8 },
  { taxonId: 10116, scientificName: "Rattus norvegicus", commonName: "褐家鼠", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>哺乳纲 Mammalia>灵长总目 Euarchontoglires>啮齿目 Rodentia>鼠科 Muridae>大鼠属 Rattus", orderRank: 9 },
  { taxonId: 9606, scientificName: "Homo sapiens", commonName: "人", phyloPath: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>哺乳纲 Mammalia>灵长总目 Euarchontoglires>灵长目 Primates>人科 Hominidae>人属 Homo", orderRank: 10 },
];

/** 菌株/种级 taxon → 归并目标物种（蛋白组统计与直系同源组跨物种判定按归并后物种计算） */
const ORG_REMAP = new Map<number, number>([
  [562, 83333],
  [4932, 559292],
]);

const ORG_RANK = new Map(ORGANISMS.map((o) => [o.taxonId, o.orderRank]));

/** 从 FT token 提取干净结构域名 */
function cleanDomains(tokens: string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    const m = token.match(/\/note="([^"]+)"/);
    if (m) out.push(m[1]);
  }
  return [...new Set(out)].slice(0, 12);
}

/** 清洗蛋白名做组名：取推荐名（首个括号前） */
function cleanName(name: string): string {
  const head = name.split("(")[0].trim();
  return (head || name).slice(0, 80);
}

async function main() {
  const t0 = Date.now();
  console.log("=== 全量入库开始 ===");

  // 1) 流式读取 hier-classified.jsonl
  const proteins: ClassifiedProtein[] = [];
  const file = Bun.file("download/hier-classified.jsonl");
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let read = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const p = JSON.parse(line) as ClassifiedProtein;
      p.organismId = ORG_REMAP.get(p.organismId) ?? p.organismId; // 菌株/种级归并
      proteins.push(p);
      read++;
    }
  }
  if (buf.trim()) {
    const p = JSON.parse(buf) as ClassifiedProtein;
    p.organismId = ORG_REMAP.get(p.organismId) ?? p.organismId;
    proteins.push(p);
  }
  console.log(`读取 ${proteins.length} 条蛋白 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  // 2) 清空旧数据
  await db.proteinDetail.deleteMany();
  await db.protein.deleteMany();
  await db.orthologGroup.deleteMany();
  await db.family.deleteMany();
  await db.organism.deleteMany();
  db.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name IN ('Protein','Family','Organism')");
  console.log("旧数据已清空");

  // 3) 物种
  for (const o of ORGANISMS) {
    await db.organism.create({ data: o });
  }
  const orgByTaxon = new Map((await db.organism.findMany()).map((o) => [o.taxonId, o]));
  console.log(`物种 ${orgByTaxon.size} 个`);

  // 4) 家族层级节点（大类 + 超家族/家族/亚家族，编码即层级）
  const famDefs = (await Bun.file("download/hier-families.json").json()) as {
    classes: { code: string; name: string; nameEn: string; description: string }[];
    families: { code: string; name: string; nameEn: string; description: string; kind?: string }[];
  };
  await db.family.createMany({
    data: [
      ...CLASSES.map((c) => ({
        code: c.code,
        name: c.name,
        nameEn: c.nameEn,
        description: `${c.nameEn}（大类）`,
      })),
      ...famDefs.families.map((f) => ({
        code: f.code,
        name: f.name,
        nameEn: f.nameEn,
        description: f.description ?? "",
        kind: f.kind && f.kind.length > 0 ? f.kind : null,
      })),
    ],
  });
  const famByCode = new Map((await db.family.findMany()).map((f) => [f.code, f]));
  console.log(`家族节点 ${famByCode.size} 个（${CLASSES.length} 大类 + ${famDefs.families.length} 超家族/家族/亚家族）`);

  // 5) OrthoDB 直系同源组（≥2 个成员才建组）
  const groups = new Map<string, { members: ClassifiedProtein[] }>();
  for (const p of proteins) {
    for (const g of p.orthodb) {
      if (!groups.has(g)) groups.set(g, { members: [] });
      groups.get(g)!.members.push(p);
    }
  }
  const multiGroups = [...groups.entries()].filter(([, v]) => v.members.length >= 2);
  // 代表名：优先人 -> rank 小
  const groupRows = multiGroups.map(([id, v]) => {
    const sorted = [...v.members].sort(
      (a, b) =>
        (a.organismId === 9606 ? -1 : b.organismId === 9606 ? 1 : 0) ||
        (ORG_RANK.get(a.organismId) ?? 99) - (ORG_RANK.get(b.organismId) ?? 99) ||
        a.accession.localeCompare(b.accession)
    );
    const taxa = [...new Set(v.members.map((m) => m.organismId))];
    const famCount = new Map<string, number>();
    for (const m of v.members) famCount.set(m.familyCode, (famCount.get(m.familyCode) ?? 0) + 1);
    const mainFamily = [...famCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return {
      id,
      name: cleanName(sorted[0].proteinName),
      proteinCount: v.members.length,
      organismCount: taxa.length,
      organismIds: taxa.join(","),
      crossSpecies: taxa.length >= 2,
      familyCode: mainFamily,
    };
  });
  const CHUNK = 500;
  for (let i = 0; i < groupRows.length; i += CHUNK) {
    await db.orthologGroup.createMany({ data: groupRows.slice(i, i + CHUNK) });
  }
  const groupIdByOdb = new Map((await db.orthologGroup.findMany({ select: { id: true } })).map((g) => [g.id, g.id]));
  console.log(`直系同源组 ${groupRows.length} 个（跨物种 ${groupRows.filter((g) => g.crossSpecies).length} 个）`);

  // 6) 蛋白入库
  const rows = proteins.map((p) => {
    const org = orgByTaxon.get(p.organismId);
    const fam = famByCode.get(p.familyCode);
    if (!org || !fam) throw new Error(`物种或家族缺失: ${p.accession} ${p.organismId} ${p.familyCode}`);
    const primaryOdb = p.orthodb[0] ?? null;
    return {
      accession: p.accession,
      entryName: p.entryName,
      proteinName: p.proteinName,
      geneName: p.genePrimary || null,
      organismId: org.id,
      familyId: fam.id,
      groupId: primaryOdb ? groupIdByOdb.get(primaryOdb) ?? null : null,
      length: p.length,
      massKda: p.mass ? Math.round(p.mass * 10) / 10 : 0,
      keywords: p.keywords.join(";"),
      domains: cleanDomains(p.domains).join(";"),
      ec: p.ecs.join(";"),
      orthodb: primaryOdb,
      eggnog: p.eggnog[0] ?? null,
      sequence: p.sequence,
    };
  });
  const PCHUNK = 1000;
  for (let i = 0; i < rows.length; i += PCHUNK) {
    await db.protein.createMany({ data: rows.slice(i, i + PCHUNK) });
    if ((i / PCHUNK) % 10 === 0) {
      console.log(`  蛋白入库 ${i + PCHUNK}/${rows.length}`);
    }
  }
  const total = await db.protein.count();
  console.log(`\n=== 完成: ${total} 条蛋白入库，总耗时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟 ===`);

  // 摘要
  const byOrg = await db.protein.groupBy({ by: ["organismId"], _count: { _all: true } });
  for (const g of byOrg.sort((a, b) => b._count._all - a._count._all)) {
    const org = [...orgByTaxon.values()].find((o) => o.id === g.organismId);
    console.log(`  ${org?.commonName ?? g.organismId}: ${g._count._all}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
