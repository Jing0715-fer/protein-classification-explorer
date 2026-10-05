/**
 * 亚类分组重建（DB 直通版）—— 在现有数据库树上执行「跨类修正 + 亚类分组」手术
 *
 * 背景：download/proteomes 原始 jsonl 已清理，数据库即当前权威状态；
 * classify-hierarchy.ts 中的手术 9（同源逻辑）用于未来全量重跑，本脚本用于就地重建。
 *
 * 流程：
 *   1) 从 DB 读出家族树（code 前缀层级）+ 每节点蛋白计数 / 物种分布 / EC 票
 *   2) 手术 A：CLASS_FIXES 跨类修正（证据明确的功能错位节点）
 *   3) 手术 B：SUBGROUPS 亚类分组（14 大类插入亚类层，kind=subclass）
 *      - 类 1：名称正则优先，残差按成员 EC 多数票救援（IUBMB EC 六大类）
 *      - 类 5：按 TC 运输机制（转位酶/ATP 泵/孔蛋白/三类门控通道/水通道/二级载体）
 *      - 类 14：未分类/其他膜蛋白兜底 + 具名家族按成员物种进化支归组
 *   4) 重算 totalCount → 按总量降序重编码（与主管线 assignCodes 同规则）
 *   5) bun:sqlite 单连接事务重建 Family 表（旧 id→新码映射表驱动蛋白迁移）+ 重算 OrthologGroup.familyCode
 *
 * 运行: bun run scripts/rebuild-subgroups.ts
 */
import { Database } from "bun:sqlite";
import * as nodeFs from "node:fs";
import { SUBGROUPS, CLASS_FIXES } from "./classify-subgroups";

interface N {
  oldCode: string;
  dbId: number;
  name: string;
  nameEn: string;
  kind: string; // "" | group | surgery | subclass
  count: number; // 直接挂载蛋白数
  totalCount: number;
  children: N[];
  parent: N | null;
  newCode: string;
}

const CLASSES_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"];
const BAC = [83333, 562];
const FUNGI = [559292, 4932];
const PLANT = [3702];
const EC_SUBGROUP: Record<string, string> = { "1": "ox", "2": "tr", "3": "hy", "4": "ly", "5": "iz", "6": "lg", "7": "etc" };

function main() {
  const t0 = Date.now();
  const sql = new Database("db/custom.db");
  console.log("=== 亚类分组重建（DB 直通版） ===");

  // ===== 1) 读树 + 成员数据 =====
  const famRows = sql.query("SELECT id, code, name, nameEn, kind FROM Family").all() as {
    id: number;
    code: string;
    name: string;
    nameEn: string;
    kind: string | null;
  }[];
  const totalProteins = (sql.query("SELECT COUNT(*) c FROM Protein").get() as { c: number }).c;
  const orgRows = sql.query("SELECT familyId, organismId, COUNT(*) c FROM Protein GROUP BY familyId, organismId").all() as {
    familyId: number;
    organismId: number;
    c: number;
  }[];
  const ecRows = sql.query("SELECT familyId, ec FROM Protein WHERE ec IS NOT NULL AND ec != ''").all() as {
    familyId: number;
    ec: string;
  }[];
  const orgRowsMeta = sql.query("SELECT id, taxonId FROM Organism").all() as { id: number; taxonId: number }[];
  const taxonByDbId = new Map(orgRowsMeta.map((o) => [o.id, o.taxonId]));

  // 节点
  const nodeByCode = new Map<string, N>();
  const dbIdByCode = new Map<string, number>();
  const codeByDbId = new Map<number, string>();
  for (const f of famRows) {
    nodeByCode.set(f.code, {
      oldCode: f.code,
      dbId: f.id,
      name: f.name,
      nameEn: f.nameEn,
      kind: f.kind ?? "",
      count: 0,
      totalCount: 0,
      children: [],
      parent: null,
      newCode: "",
    });
    dbIdByCode.set(f.code, f.id);
    codeByDbId.set(f.id, f.code);
  }
  const dbIdToCode = codeByDbId;

  // 计数 / 物种 / EC（按 db familyId）
  const cntByDbId = new Map<number, number>();
  const orgsByDbId = new Map<number, Set<number>>();
  for (const r of orgRows) {
    cntByDbId.set(r.familyId, (cntByDbId.get(r.familyId) ?? 0) + r.c);
    if (!orgsByDbId.has(r.familyId)) orgsByDbId.set(r.familyId, new Set());
    orgsByDbId.get(r.familyId)!.add(taxonByDbId.get(r.organismId) ?? 0);
  }
  const ecByDbId = new Map<number, string[]>();
  for (const r of ecRows) {
    if (!ecByDbId.has(r.familyId)) ecByDbId.set(r.familyId, []);
    for (const e of r.ec.split(";").filter(Boolean)) ecByDbId.get(r.familyId)!.push(e.trim());
  }
  for (const [code, n] of nodeByCode) {
    n.count = cntByDbId.get(dbIdByCode.get(code)!) ?? 0;
  }

  // 组树（parent = code 去尾段）+ 类根
  const classRoots = new Map<string, Map<string, N>>();
  const classLevelNodes = new Map<string, N>(); // 大类根节点（Family 表亦有行）
  for (const f of famRows) {
    if (!f.code.includes(".")) {
      classLevelNodes.set(f.code, nodeByCode.get(f.code)!);
      continue;
    }
    const i = f.code.lastIndexOf(".");
    const p = f.code.slice(0, i);
    const n = nodeByCode.get(f.code)!;
    const pn = nodeByCode.get(p);
    if (!pn) throw new Error(`孤儿节点: ${f.code}（父 ${p} 不存在）`);
    pn.children.push(n);
    n.parent = pn;
    if (p.split(".").length === 1) {
      const cls = p;
      if (!classRoots.has(cls)) classRoots.set(cls, new Map());
      classRoots.get(cls)!.set(f.code, n);
    }
  }
  // totalCount 自底向上（真实树：从大类根递归）
  const calc = (n: N): number => {
    n.totalCount = n.count + n.children.reduce((s, c) => s + calc(c), 0);
    return n.totalCount;
  };
  for (const r of classLevelNodes.values()) calc(r);
  const totalCheck = [...classLevelNodes.values()].reduce((s, r) => s + r.totalCount, 0);
  if (totalCheck !== totalProteins) throw new Error(`树内蛋白总数 ${totalCheck} ≠ 蛋白表 ${totalProteins}`);
  console.log(`读出 ${famRows.length} 节点 / ${totalProteins} 蛋白，树内计数校验一致 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  // ===== 2) 手术 A：跨类修正 =====
  let movedFixes = 0;
  for (const fix of CLASS_FIXES) {
    const fromRoot = classRoots.get(fix.from);
    const toRoot = classRoots.get(fix.to);
    if (!fromRoot || !toRoot) continue;
    for (const [key, node] of [...fromRoot.entries()]) {
      if (!fix.re.test(node.nameEn)) continue;
      fromRoot.delete(key);
      toRoot.set("fix:" + key, node);
      movedFixes++;
      console.log(`手术·跨类修正: "${node.nameEn}" 类${fix.from}→${fix.to}（${fix.why}）`);
    }
  }
  console.log(`手术·跨类修正：共 ${movedFixes} 个节点`);

  // ===== 3) 手术 B：亚类分组 =====
  const allNodes: N[] = [];
  const subclassList: N[] = [];
  const absorbedSet = new Set<N>(); // 被吸收的兜底节点
  const subtree = (n: N, fn: (x: N) => void) => {
    fn(n);
    for (const c of n.children) subtree(c, fn);
  };
  for (const cls of CLASSES_ORDER) {
    const defs = SUBGROUPS[cls];
    const classChildren = classRoots.get(cls);
    if (!defs || !classChildren) continue;
    const sgNodes = new Map<string, N>();
    for (const def of defs) {
      const n: N = {
        oldCode: `sg:${cls}.${def.key}`,
        dbId: -1,
        name: def.name,
        nameEn: def.nameEn,
        kind: "subclass",
        count: 0,
        totalCount: 0,
        children: [],
        parent: null,
        newCode: "",
      };
      sgNodes.set(def.key, n);
      subclassList.push(n);
    }
    // 先吸收兜底节点（其直接蛋白并入亚类本体）
    let absorbed = 0;
    for (const [key, node] of [...classChildren.entries()]) {
      const def = defs.find((d) => d.absorbFb?.test(node.nameEn));
      if (!def) continue;
      classChildren.delete(key);
      sgNodes.get(def.key)!.count += node.count;
      absorbedSet.add(node);
      absorbed++;
    }
    // 其余 L2 节点归组
    const tally = defs.map(() => ({ nodes: 0, proteins: 0 }));
    for (const [key, node] of [...classChildren.entries()]) {
      let idx = defs.findIndex((d) => d.routes?.test(node.nameEn));
      if (idx < 0) idx = defs.length - 1;
      // 类 1 残差：EC 多数票（IUBMB 大类救援）
      if (idx === defs.length - 1 && cls === "1") {
        const ecs: string[] = [];
        subtree(node, (x) => {
          const dbId = x.dbId;
          if (dbId >= 0) ecs.push(...(ecByDbId.get(dbId) ?? []));
        });
        if (ecs.length > 0) {
          const votes = new Map<string, number>();
          for (const e of ecs) votes.set(e[0], (votes.get(e[0]) ?? 0) + 1);
          const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
          if (sorted && sorted[1] / ecs.length >= 0.5 && EC_SUBGROUP[sorted[0]]) {
            const t = defs.findIndex((d) => d.key === EC_SUBGROUP[sorted[0]]);
            if (t >= 0) idx = t;
          }
        }
      }
      // 类 14：具名家族按成员物种进化支归组
      if (cls === "14" && !defs[idx].routes && !defs[idx].absorbFb) {
        const orgs = new Set<number>();
        subtree(node, (x) => {
          if (x.dbId >= 0) for (const o of orgsByDbId.get(x.dbId) ?? []) orgs.add(o);
        });
        const only = (t: number[]) => orgs.size > 0 && [...orgs].every((o) => t.includes(o));
        let target: string;
        if (only(BAC)) target = "bac";
        else if (only(PLANT)) target = "plant";
        else if (only(FUNGI)) target = "fungi";
        else if (!orgs.has(83333) && !orgs.has(562)) target = "animal"; // 纯真核动物（无细菌/植物/真菌）
        else target = "cons";
        const t = defs.findIndex((d) => d.key === target);
        if (t >= 0) idx = t;
      }
      const sg = sgNodes.get(defs[idx].key)!;
      sg.children.push(node);
      node.parent = sg;
      tally[idx].nodes++;
      tally[idx].proteins += node.totalCount;
    }
    // 大类根 → 亚类
    const newChildren = new Map<string, N>();
    for (const def of defs) newChildren.set("sg:" + def.key, sgNodes.get(def.key)!);
    classRoots.set(cls, newChildren);
    console.log(`手术·亚类分组 类${cls}: 吸收兜底 ${absorbed} 个 / 归组 ${newChildren.size - 0} 亚类（${defs.length}）`);
    for (let i = 0; i < defs.length; i++) {
      console.log(`   类${cls}·${defs[i].name}: ${tally[i].nodes} 家族 / ${tally[i].proteins} 蛋白`);
    }
  }

  // ===== 4) 重编码（子节点按 totalCount 降序、nameEn 字典序，与主管线 assignCodes 一致） =====
  const residualNames: Record<string, string[]> = {};
  for (const cls of CLASSES_ORDER) {
    const list = [...(classRoots.get(cls)?.values() ?? [])];
    const defs = SUBGROUPS[cls];
    const calc2 = (n: N): number => {
      n.totalCount = n.count + n.children.reduce((s, c) => s + calc2(c), 0);
      return n.totalCount;
    };
    for (const r of list) calc2(r);
    list.sort((a, b) => b.totalCount - a.totalCount || a.nameEn.localeCompare(b.nameEn));
    const assign = (n: N, prefix: string) => {
      n.newCode = prefix;
      allNodes.push(n);
      n.children.sort((a, b) => b.totalCount - a.totalCount || a.nameEn.localeCompare(b.nameEn));
      n.children.forEach((c, i) => assign(c, `${prefix}.${i + 1}`));
    };
    list.forEach((r, i) => assign(r, `${cls}.${i + 1}`));
    // 残差成员名单（调试用）
    const last = defs?.[defs.length - 1];
    if (last && classRoots.get(cls)?.get("sg:" + last.key)) {
      const sg = classRoots.get(cls)!.get("sg:" + last.key)!;
      residualNames[cls] = sg.children.map((c) => `${c.nameEn} [${c.totalCount}]`);
    }
  }
  // 大类根节点本身也入表（保持原码）
  for (const [cls, n] of classLevelNodes) {
    n.newCode = cls;
    allNodes.push(n);
  }
  nodeFs.writeFileSync("/tmp/residual-dump.json", JSON.stringify(residualNames, null, 1));
  console.log(`重编码完成：${allNodes.length} 节点（含亚类 ${subclassList.length}，吸收移除 ${absorbedSet.size}）；残差名单已写 /tmp/residual-dump.json`);

  // ===== 5) 描述重建 + 写库（单连接事务） =====
  const LEVEL_LABEL = ["", "大类", "亚类", "超家族", "家族", "亚家族", "细分"];
  const descFor = (n: N): string => {
    if (n.kind === "subclass") return `大类内按科学机制/类别归组的亚类层（${n.nameEn}）`;
    const segs: string[] = [];
    let cur: N | null = n;
    while (cur && cur.parent) {
      if (cur.kind !== "subclass") segs.unshift(cur.nameEn);
      cur = cur.parent;
    }
    const level = Math.min(n.newCode.split(".").length, LEVEL_LABEL.length - 1);
    return segs.length > 1 ? `UniProt 官方层级: ${segs.join(" → ")}` : `UniProt 官方${LEVEL_LABEL[level] ?? "分类"}`;
  };

  // 旧 db familyId → 新 code
  const dbIdToNewCode = new Map<number, string>();
  const newCodeBySgOld = new Map<string, string>(); // "sg:cls.key" -> newCode
  for (const n of allNodes) {
    if (n.kind === "subclass") newCodeBySgOld.set(n.oldCode, n.newCode);
  }
  // 兜底吸收的 db id → 其归属亚类的 key（重演 absorbFb 匹配，幂等）
  const absorbedKeyByDbId = new Map<number, string>();
  for (const f of famRows) {
    if (f.code.includes(".") && f.code.split(".").length === 2) {
      const cls = f.code.split(".")[0];
      const defs = SUBGROUPS[cls];
      if (!defs) continue;
      const def = defs.find((d) => d.absorbFb?.test(f.nameEn));
      if (def) absorbedKeyByDbId.set(f.id, `${cls}.${def.key}`);
    }
  }
  for (const f of famRows) {
    if (absorbedKeyByDbId.has(f.id)) {
      const nc = newCodeBySgOld.get("sg:" + absorbedKeyByDbId.get(f.id));
      if (!nc) throw new Error(`吸收映射缺失: ${f.code}`);
      dbIdToNewCode.set(f.id, nc);
    }
  }
  // 未被吸收的节点：oldCode → newCode（在树上，或跨类移动过的仍在树上）
  const newCodeByOldCode = new Map<string, string>();
  for (const n of allNodes) {
    if (n.kind !== "subclass" && n.dbId >= 0) newCodeByOldCode.set(n.oldCode, n.newCode);
  }
  for (const [dbId, code] of dbIdToCode) {
    if (dbIdToNewCode.has(dbId)) continue;
    const nc = newCodeByOldCode.get(code);
    if (!nc) throw new Error(`旧节点无新码: ${code}`);
    dbIdToNewCode.set(dbId, nc);
  }
  // 断言每个旧家族都映射到新码且新码存在于 allNodes
  const validNew = new Set(allNodes.map((n) => n.newCode));
  for (const nc of dbIdToNewCode.values()) {
    if (!validNew.has(nc)) throw new Error(`新码不存在于树: ${nc}`);
  }
  const proteins = (sql.query("SELECT COUNT(DISTINCT familyId) c FROM Protein").get() as { c: number }).c;
  console.log(`旧→新映射 ${dbIdToNewCode.size}（蛋白引用了 ${proteins} 个家族）`);

  // 写库
  sql.run("PRAGMA foreign_keys = OFF");
  const tx = sql.transaction(() => {
    // 1) 临时映射表
    sql.run("DROP TABLE IF EXISTS _fammap");
    sql.run("CREATE TABLE _fammap (oldId INTEGER PRIMARY KEY, newCode TEXT NOT NULL)");
    const ins = sql.prepare("INSERT INTO _fammap (oldId, newCode) VALUES (?, ?)");
    for (const [oldId, nc] of dbIdToNewCode) ins.run(oldId, nc);
    // 2) 清空 Family（sequence 归零）
    sql.run("DELETE FROM Family");
    sql.run("DELETE FROM sqlite_sequence WHERE name = 'Family'");
    // 3) 插入新家族（含亚类）
    const add = sql.prepare("INSERT INTO Family (code, name, nameEn, description, kind) VALUES (?, ?, ?, ?, ?)");
    for (const n of allNodes) {
      add.run(n.newCode, n.name, n.nameEn, descFor(n), n.kind === "" ? null : n.kind);
    }
    // 4) 蛋白迁移
    sql.run("UPDATE Protein SET familyId = (SELECT f.id FROM Family f JOIN _fammap m ON f.code = m.newCode WHERE m.oldId = Protein.familyId) WHERE familyId IN (SELECT oldId FROM _fammap)");
    // 5) 清理
    sql.run("DROP TABLE _fammap");
  });
  tx();
  sql.run("PRAGMA foreign_keys = ON");

  // 6) OrthologGroup.familyCode 重算（组内成员多数票新码）
  const grpRows = sql
    .query(
      "SELECT p.groupId as groupId, f.code as code, COUNT(*) as c FROM Protein p JOIN Family f ON p.familyId = f.id WHERE p.groupId IS NOT NULL GROUP BY p.groupId, f.code"
    )
    .all() as { groupId: string; code: string; c: number }[];
  const byGroup = new Map<string, { code: string; c: number }[]>();
  for (const r of grpRows) {
    if (!byGroup.has(r.groupId)) byGroup.set(r.groupId, []);
    byGroup.get(r.groupId)!.push({ code: r.code, c: r.c });
  }
  const upd = sql.prepare("UPDATE OrthologGroup SET familyCode = ? WHERE id = ?");
  sql.transaction(() => {
    for (const [gid, list] of byGroup) {
      const main = list.sort((a, b) => b.c - a.c)[0]?.code ?? "";
      upd.run(main, gid);
    }
  })();

  // ===== 校验 =====
  const cnt2 = (sql.query("SELECT COUNT(*) c FROM Protein").get() as { c: number }).c;
  const badRef = (sql.query("SELECT COUNT(*) c FROM Protein p LEFT JOIN Family f ON p.familyId = f.id WHERE f.id IS NULL").get() as { c: number }).c;
  const l2Bad = (
    sql.query("SELECT code FROM Family WHERE code LIKE '__.%' AND instr(SUBSTR(code, instr(code, '.') + 1), '.') = 0 AND kind != 'subclass'").all() as { code: string }[]
  ).length;
  // 注：SQLite 通配两位大类码（10-14），用 length 过滤更稳妥
  const l2rows = sql.query("SELECT code, kind FROM Family").all() as { code: string; kind: string | null }[];
  const l2NonSub = l2rows.filter((r) => {
    const segs = r.code.split(".");
    return segs.length === 2 && r.kind !== "subclass";
  }).length;
  const classCount = l2rows.filter((r) => !r.code.includes(".")).length;
  const subclassCount = l2rows.filter((r) => r.kind === "subclass").length;
  console.log(
    `\n校验：蛋白 ${cnt2}（应 = ${totalProteins}）| 断链蛋白 ${badRef}（应 0）| L2 非亚类 ${l2NonSub}（应 0）| 大类 ${classCount} | 亚类 ${subclassCount}`
  );
  console.log(`=== 完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
  sql.close();
}

main();
