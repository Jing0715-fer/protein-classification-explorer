/**
 * 一次性脚本：将 NCBI 校准后的系统发生谱系写入 Organism 表（phyloPath/orderRank）。
 * 与 scripts/seed-full.ts 的 ORGANISMS 保持一致；运行: bun run scripts/update-phylo.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PATHS: Record<number, string> = {
  83333: "细菌域 Bacteria>变形菌门 Proteobacteria>γ-变形菌纲 Gammaproteobacteria>肠杆菌目 Enterobacterales>肠杆菌科 Enterobacteriaceae>埃希氏菌属 Escherichia",
  3702: "真核生物域 Eukaryota>植物界 Plantae>有胚植物 Embryophyta>维管植物 Tracheophyta>被子植物 Magnoliophyta>真双子叶植物 Eudicots>十字花目 Brassicales>十字花科 Brassicaceae",
  559292: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>真菌界 Fungi>子囊菌门 Ascomycota>酵母亚门 Saccharomycotina",
  6239: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>原口动物 Protostomia>蜕皮动物 Ecdysozoa>线虫动物门 Nematoda>色杆纲 Chromadorea>小杆目 Rhabditida>隐杆线虫属 Caenorhabditis",
  7227: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>原口动物 Protostomia>蜕皮动物 Ecdysozoa>节肢动物门 Arthropoda>昆虫纲 Insecta>双翅目 Diptera>果蝇属 Drosophila",
  7955: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>辐鳍鱼纲 Actinopterygii>真骨下纲 Teleostei>鲤形目 Cypriniformes",
  9031: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>鸟纲 Aves>鸡形目 Galliformes>雉科 Phasianidae",
  10090: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>哺乳纲 Mammalia>灵长总目 Euarchontoglires>啮齿目 Rodentia>鼠科 Muridae>小鼠属 Mus",
  10116: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>哺乳纲 Mammalia>灵长总目 Euarchontoglires>啮齿目 Rodentia>鼠科 Muridae>大鼠属 Rattus",
  9606: "真核生物域 Eukaryota>后鞭毛生物 Opisthokonta>后生动物 Metazoa>真后生动物 Eumetazoa>两侧对称动物 Bilateria>后口动物 Deuterostomia>脊索动物门 Chordata>脊椎动物亚门 Vertebrata>有颌类 Gnathostomata>硬骨鱼类 Osteichthyes>肉鳍鱼纲 Sarcopterygii>四足动物 Tetrapoda>羊膜动物 Amniota>哺乳纲 Mammalia>灵长总目 Euarchontoglires>灵长目 Primates>人科 Hominidae>人属 Homo",
};

const RANKS: Record<number, number> = { 83333: 1, 3702: 2, 559292: 3, 6239: 4, 7227: 5, 7955: 6, 9031: 7, 10090: 8, 10116: 9, 9606: 10 };

async function main() {
  for (const [taxon, path] of Object.entries(PATHS)) {
    const taxonId = Number(taxon);
    const r = await db.organism.update({
      where: { taxonId },
      data: { phyloPath: path, orderRank: RANKS[taxonId] },
    });
    console.log(`✓ ${r.commonName} (${r.taxonId}) → ${path.split(">").length} 阶元`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
