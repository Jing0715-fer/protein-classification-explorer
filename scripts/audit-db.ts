/** Task 12-a：DB 分类全面审计——重名/未分类/泛型节点/层级完整性/物种计数 */
import { db } from "../src/lib/db";

async function main() {
  const total = await db.protein.count();
  const fams = await db.family.findMany();
  const orgs = await db.organism.findMany({ orderBy: { orderRank: "asc" } });
  console.log(`总蛋白 ${total} · 家族节点 ${fams.length} · 物种 ${orgs.length}`);

  // ① 各物种计数
  console.log("\n=== ① 各物种蛋白计数 ===");
  for (const o of orgs) {
    const n = await db.protein.count({ where: { organismId: o.id } });
    console.log(`${o.commonName.padEnd(8)} ${o.taxonId}  ${String(n).padStart(6)}`);
  }

  // ② 显示名重复（全树任何层级）
  console.log("\n=== ② 全树显示名重复 ===");
  const byName = new Map<string, typeof fams>();
  for (const f of fams) {
    const k = f.name;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(f);
  }
  let dup = 0;
  for (const [k, list] of byName) {
    if (list.length > 1) {
      dup++;
      console.log(`× [${k}] ×${list.length}: ${list.map((f) => `${f.code}(${f.nameEn})`).join(" | ")}`);
    }
  }
  console.log(dup === 0 ? "✓ 无重名" : `重名 ${dup} 组`);

  // ③ 泛型/可疑节点名
  console.log("\n=== ③ 泛型/可疑节点名 ===");
  const SUSPECT = /未分类|unclassified|^other|^putative|^unknown|hypothetical|^misc|^uncharacterized|^\s*$|no family/i;
  for (const f of fams) {
    if (SUSPECT.test(f.name) || SUSPECT.test(f.nameEn)) {
      const n = await db.protein.count({ where: { familyId: f.id } });
      console.log(`? ${f.code} "${f.name}" / "${f.nameEn}" — direct ${n}`);
    }
  }

  // ④ 层级完整性：子节点 code 必须以父 code 为前缀
  console.log("\n=== ④ code 层级完整性 ===");
  const codeSet = new Set(fams.map((f) => f.code));
  let orphan = 0;
  for (const f of fams) {
    const parts = f.code.split(".");
    if (parts.length > 1) {
      const parent = parts.slice(0, -1).join(".");
      if (!codeSet.has(parent)) {
        orphan++;
        console.log(`× ${f.code} "${f.name}" 父 ${parent} 缺失`);
      }
    }
  }
  console.log(orphan === 0 ? "✓ 层级完整" : `孤儿节点 ${orphan}`);

  // ⑤ 大类（L1）分布
  console.log("\n=== ⑤ 大类 L1 分布 ===");
  const l1 = fams.filter((f) => !f.code.includes(".")).sort((a, b) => a.code.localeCompare(b.code));
  for (const f of l1) {
    const descendants = fams.filter((x) => x.code === f.code || x.code.startsWith(f.code + "."));
    const ids = descendants.map((d) => d.id);
    // 统计直接+间接（按 familyId 引用）
    const direct = await db.protein.count({ where: { familyId: { in: ids } } });
    console.log(`${f.code} ${f.name} — 节点 ${ids.length} · direct ${direct}`);
  }

  // ⑥ 深层级统计 + 叶子家族
  const leaves = fams.filter((f) => !fams.some((x) => x.code.startsWith(f.code + ".")));
  console.log(`\n叶子家族 ${leaves.length} · 最大层级 ${Math.max(...fams.map((f) => f.code.split(".").length))}`);

  // ⑦ 空家族节点（无蛋白且无子节点）
  console.log("\n=== ⑦ 空节点（无直接蛋白且无子节点） ===");
  let empty = 0;
  for (const f of fams) {
    const hasChild = fams.some((x) => x.code.startsWith(f.code + "."));
    if (!hasChild) {
      const n = await db.protein.count({ where: { familyId: f.id } });
      if (n === 0) {
        empty++;
        if (empty <= 20) console.log(`× ${f.code} "${f.name}" 空`);
      }
    }
  }
  console.log(`空叶子 ${empty}`);

  // ⑧ 多余 species 对照（应 10 物种）
  console.log(`\n=== ⑧ 物种数 ${orgs.length} ===`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
