/**
 * 将抓取的 UniProt 数据写入 SQLite（Prisma）
 * 运行: bun run scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { FAMILIES, ORGANISMS } from "./curated";

const db = new PrismaClient();

interface RawProtein {
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
  family: string;
  orthologGroup: string;
  isRepresentative: boolean;
}

// 菌株 → 物种归并
const STRAIN_MAP: Record<number, number> = { 559292: 4932, 83333: 562, 511145: 562 };

async function main() {
  const raw = JSON.parse(await Bun.file("src/data/proteins-raw.json").text()) as {
    proteins: RawProtein[];
  };
  console.log(`读取 ${raw.proteins.length} 条蛋白数据`);

  // 1) 物种
  for (const o of ORGANISMS) {
    await db.organism.upsert({
      where: { taxonId: o.taxonId },
      update: {
        scientificName: o.scientificName,
        commonName: o.commonName,
        phyloPath: o.phyloPath,
        orderRank: o.orderRank,
      },
      create: {
        taxonId: o.taxonId,
        scientificName: o.scientificName,
        commonName: o.commonName,
        phyloPath: o.phyloPath,
        orderRank: o.orderRank,
      },
    });
  }
  const organisms = await db.organism.findMany();
  const orgByTaxon = new Map(organisms.map((o) => [o.taxonId, o]));
  console.log(`物种: ${organisms.length}`);

  // 2) 家族
  for (const f of FAMILIES) {
    await db.family.upsert({
      where: { code: f.code },
      update: { name: f.name, nameEn: f.nameEn, description: f.description },
      create: { code: f.code, name: f.name, nameEn: f.nameEn, description: f.description },
    });
  }
  const families = await db.family.findMany();
  const famByCode = new Map(families.map((f) => [f.code, f]));
  console.log(`家族: ${families.length}`);

  // 3) 蛋白
  await db.protein.deleteMany();
  let inserted = 0;
  let skipped = 0;
  for (const p of raw.proteins) {
    const targetTaxon = STRAIN_MAP[p.taxonId] ?? p.taxonId;
    const organism = orgByTaxon.get(targetTaxon);
    const family = famByCode.get(p.family);
    if (!organism || !family) {
      console.warn(`跳过 ${p.accession}: organism=${p.taxonId} family=${p.family}`);
      skipped++;
      continue;
    }
    await db.protein.create({
      data: {
        accession: p.accession,
        entryName: p.entryName,
        reviewed: p.reviewed,
        proteinName: p.proteinName,
        altNames: p.altNames || null,
        geneName: p.geneName || null,
        geneSynonyms: p.geneSynonyms || null,
        organismId: organism.id,
        familyId: family.id,
        orthologGroup: p.orthologGroup,
        length: p.length,
        massKda: p.massKda,
        functionText: p.functionText || null,
        subcellular: p.subcellular || null,
        ptm: p.ptm || null,
        keywords: p.keywords || null,
        domains: p.domains || null,
        pdbCount: p.pdbCount,
        sequence: p.sequence || null,
        isRepresentative: p.isRepresentative,
      },
    });
    inserted++;
  }

  console.log(`入库 ${inserted} 条，跳过 ${skipped} 条`);

  // 4) 汇总
  const total = await db.protein.count();
  const orgs = await db.organism.findMany({ include: { _count: { select: { proteins: true } } }, orderBy: { orderRank: "asc" } });
  console.log(`\n数据库合计: ${total} 蛋白 / ${families.length} 家族 / ${organisms.length} 物种`);
  for (const o of orgs) console.log(`  ${o.commonName} (${o.scientificName}): ${o._count.proteins}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
