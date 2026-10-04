/** 检查 13.1 兜底桶中的蛋白在 UniProt 是否真有家族链（真遗漏检测）
 *  方法：直接查 flat-file 的 CC -!- SIMILARITY 段（家族链来源） */
import { db } from "../src/lib/db";

const ORG_TAXON: Record<number, number> = {
  9606: 1, 10090: 2, 10116: 3, 7955: 4, 9031: 5, 7227: 6, 6239: 7, 559292: 8, 3702: 9, 83333: 10,
};

async function main() {
  // 13.1 全量（5813 条太多，按物种分层抽样 60 条）
  const fam = await db.family.findUnique({ where: { code: "13.1" } });
  if (!fam) return;
  const orgs = await db.organism.findMany();
  const samples: { accession: string; name: string }[] = [];
  for (const o of orgs) {
    const ps = await db.protein.findMany({
      where: { familyId: fam.id, organismId: o.id },
      take: 6,
      orderBy: { accession: "asc" },
    });
    samples.push(...ps.map((p) => ({ accession: p.accession, name: p.proteinName.slice(0, 50) })));
  }
  console.log(`抽样 ${samples.length} 条（每物种 6 条）`);

  let miss = 0;
  for (const s of samples) {
    try {
      const res = await fetch(`https://rest.uniprot.org/uniprotkb/${s.accession}.txt`);
      const txt = await res.text();
      // 提取 SIMILARITY 段的 "Belongs to ..." 行
      const lines = txt.split("\n");
      const sim: string[] = [];
      let inSim = false;
      for (const ln of lines) {
        if (ln.startsWith("CC   -!- SIMILARITY:")) {
          inSim = true;
          sim.push(ln.replace(/^CC\s+-!- SIMILARITY:\s*/, ""));
        } else if (inSim && ln.startsWith("CC       ")) {
          sim.push(ln.replace(/^CC\s+/, ""));
        } else if (ln.startsWith("CC   -!-") || ln.startsWith("CC   -----")) {
          inSim = false;
        }
      }
      const belongs = sim.join(" ");
      if (/belongs/i.test(belongs)) {
        miss++;
        console.log(`⚠ ${s.accession} ${s.name}\n    → ${belongs}`);
      }
    } catch (e) {
      console.log(`! ${s.accession} 请求失败`);
    }
  }
  console.log(`\n结论：抽样 ${samples.length} 条，真遗漏 ${miss} 条`);
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
