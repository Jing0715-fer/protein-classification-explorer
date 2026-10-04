/** 反向验证：已分类蛋白的家族指派是否与 UniProt 家族链一致（随机分层抽样 12 条） */
import { db } from "../src/lib/db";

async function main() {
  const orgs = await db.organism.findMany();
  const samples: string[] = [];
  for (const o of orgs) {
    // 每物种随机取 1-2 条已分类（非兜底桶）蛋白
    const ps = await db.protein.findMany({
      where: { organismId: o.id, family: { NOT: { OR: [{ code: { startsWith: "14.1" } }, { code: { startsWith: "14.2" } }] } } },
      take: 2,
      skip: Math.floor(Math.random() * 50),
      include: { family: true },
    });
    samples.push(...ps.map((p) => p.accession));
  }
  console.log(`抽样 ${samples.length} 条`);
  let ok = 0;
  let bad = 0;
  for (const acc of samples) {
    const p = await db.protein.findUnique({ where: { accession: acc }, include: { family: true } });
    if (!p) continue;
    const res = await fetch(`https://rest.uniprot.org/uniprotkb/${acc}.txt`);
    const txt = await res.text();
    const lines = txt.split("\n");
    const sim: string[] = [];
    let inSim = false;
    for (const ln of lines) {
      if (ln.startsWith("CC   -!- SIMILARITY:")) {
        inSim = true;
        sim.push(ln.replace(/^CC\s+-!- SIMILARITY:\s*/, ""));
      } else if (inSim && ln.startsWith("CC       ")) {
        sim.push(ln.replace(/^CC\s+/, ""));
      } else if (ln.startsWith("CC   -!-")) {
        inSim = false;
      }
    }
    const belongs = sim.join(" ").replace(/^-\s*/, "");
    if (belongs) {
      ok++;
      console.log(`✓ ${acc} | 本库: ${p.family.nameEn} | UniProt: ${belongs.slice(0, 90)}`);
    } else {
      bad++;
      console.log(`? ${acc} | 本库: ${p.family.nameEn} | UniProt: 无链（可能来自关键词/EC 兜底）`);
    }
  }
  console.log(`\n结论：${ok} 有链 / ${bad} 无链（共 ${samples.length}）`);
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
