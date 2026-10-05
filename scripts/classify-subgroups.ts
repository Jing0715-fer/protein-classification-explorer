/**
 * 亚类（subclass）分组定义 + 跨类修正清单 —— 层级树「手术 9」数据源
 *
 * 设计目标（应用户反馈"家族比较多的大类下最好再进行一些分类，
 * 比如膜通道和膜转运可以把几类不同转运方式都再分一类，不然很难找"）：
 *   在 14 大类与超家族/家族之间插入一层「亚类」节点（kind=subclass），
 *   将每大类下数百个平铺的直接子节点按【科学上标准的机制/类别】归组。
 *
 * 分组依据：
 *   类 1 酶类 —— IUBMB 酶学委员会 EC 六大类（氧化还原酶 EC1 / 转移酶 EC2 / 水解酶 EC3 /
 *               裂合酶 EC4 / 异构酶 EC5 / 连接酶 EC6），名称正则优先、成员 EC 多数票兜底
 *   类 2 激酶 —— 受体型 / 酪氨酸 / 丝苏氨酸 / 脂质 / 小分子代谢物激酶
 *   类 5 膜转运 —— 参照 TC 转运蛋白分类系统（Saier et al.）的运输机制分层：
 *               通道（TC 1.A：电压/配体/感觉门控、水通道）/ 二级载体（TC 2.A：SLC 等，
 *               电化学梯度驱动）/ ATP 驱动泵（TC 3.A：P/V/F 型、ABC）/ β桶孔蛋白（TC 1.B）/
 *               蛋白转位酶（TC 3.A.5-3.A.9：Sec/Tat/Tim/Tom/Tic）
 *   类 6/7/8/9/10/11/12/13 —— 各领域教科书标准分组
 *   类 14 其他功能蛋白 —— 未分类 / 膜蛋白 / 按物种分布（细菌/植物/真菌/动物/跨物种保守）
 *
 * CLASS_FIXES：跨大类修正（取证于 UniProt 功能注释），运行于亚类分组之前。
 *
 * 注意：routes 正则匹配对象为节点 nameEn【原串】（大小写不敏感）；
 *       每个大类的 defs 数组按【先具体后泛化】排序，数组最后一个为残差亚类（无 routes）。
 *       absorbFb 匹配旧规则引擎兜底节点（无链蛋白挂载的 L2 节点）——其蛋白并入亚类本体。
 */

export interface SubgroupDef {
  key: string; // 稳定 key（子节点 map 键，前缀 "sg:"）
  name: string; // 中文显示名
  nameEn: string;
  routes?: RegExp; // 匹配 nameEn（先具体后泛化，顺序敏感）
  absorbFb?: RegExp; // 命中的旧引擎兜底 L2 节点整体并入本亚类（蛋白成亚类直接成员）
}

/** 跨大类修正：{ re: 匹配 nameEn, from: 原大类, to: 目标大类, why: 证据 } */
export interface ClassFixDef {
  re: RegExp;
  from: string;
  to: string;
  why: string;
}

export const CLASS_FIXES: ClassFixDef[] = [
  // ===== 类 5 → 类 13 细胞内运输机器 =====
  { re: /^cog[1-8] family$/i, from: "5", to: "13", why: "COG 复合体：高尔基囊泡拴系（胞内运输）" },
  { re: /^(mdm12|mdm34|mmm1) family$/i, from: "5", to: "13", why: "ERMES 线粒体-内质网接触位点（脂质转移）" },
  { re: /^mog1 family$/i, from: "5", to: "13", why: "Ran 鸟苷酸释放因子（核质运输）" },
  { re: /^npc2 family$/i, from: "5", to: "13", why: "溶酶体胆固醇转运蛋白（可溶脂质载体）" },
  { re: /^pra1 family$/i, from: "5", to: "13", why: "PRA1：预基化 Rab 受体（囊泡靶向）" },
  { re: /^(dop1|mon2|vos1|ypp1|sys1|avl9|ccdc93|syndetin|vta1|golim4|spe39) family$/i, from: "5", to: "13", why: "高尔基/内体运输机器组分" },
  { re: /^vsr \(bp-80\) family$/i, from: "5", to: "13", why: "液泡分选受体（BP-80）" },
  // ===== 类 5 → 类 3 受体与信号 =====
  { re: /^ramp family$/i, from: "5", to: "3", why: "受体活性修饰蛋白：GPCR（降钙素受体样）辅助亚基" },
  { re: /^scara5 family$/i, from: "5", to: "3", why: "清道夫受体家族成员" },
  { re: /^dss4\/mss4 family$/i, from: "5", to: "3", why: "RAB 鸟苷酸交换因子（GEF）" },
  { re: /^mrl1\/igf2r family$/i, from: "5", to: "3", why: "甘露糖-6-磷酸受体（内吞受体）" },
  { re: /^wd repeat scap family$/i, from: "5", to: "3", why: "SREBP 裂解激活蛋白：胆固醇感受器" },
  { re: /^insig family$/i, from: "5", to: "3", why: "INSIG：ER 胆固醇感受/SREBP 调节因子" },
  // ===== 类 5 → 类 4 转录 =====
  { re: /^akirin family$/i, from: "5", to: "4", why: "核内转录调控因子（肌生成/NF-κB）" },
  // ===== 类 5 → 类 9 翻译与核糖体 =====
  { re: /^nmd3 family$/i, from: "5", to: "9", why: "60S 核糖体出核/翻译延伸 GTP 酶" },
  { re: /^4e-t\/eif4e-t family$/i, from: "5", to: "9", why: "eIF4E 结合翻译抑制因子" },
  { re: /^sda1 family$/i, from: "5", to: "9", why: "60S 核糖体亚基生成因子" },
  // ===== 类 5 → 类 1 酶类 =====
  { re: /^coq9 family$/i, from: "5", to: "1", why: "辅酶 Q10 生物合成酶" },
  { re: /^vitamin k-dependent gamma-carboxylase family$/i, from: "5", to: "1", why: "γ-谷氨酰羧化酶" },
  { re: /^ndh complex subunit [lmno] family$/i, from: "5", to: "1", why: "呼吸链复合体 I（NDH）亚基" },
  // ===== 类 5 → 类 6 结构与细胞骨架 =====
  { re: /^astrotactin family$/i, from: "5", to: "6", why: "神经元-胶质粘附分子" },
  { re: /^ropporin family$/i, from: "5", to: "6", why: "精子鞭毛骨架相关蛋白" },
  { re: /^mot[ab] family$/i, from: "5", to: "6", why: "细菌鞭毛马达定子（MotA/MotB）" },
  { re: /^hap2\/gcs1 family$/i, from: "5", to: "6", why: "配子质膜融合蛋白（结构性膜蛋白）" },
  { re: /^pmp-22\/emp\/mp20 family$/i, from: "5", to: "6", why: "四次跨膜连接/结构膜蛋白（PMP22-EMP-MP20）" },
  // ===== 类 5 → 类 7 分泌与 ECM =====
  { re: /^ependymin family$/i, from: "5", to: "7", why: "分泌型糖蛋白（脑脊液）" },
  { re: /^ecm1 family$/i, from: "5", to: "7", why: "胞外基质蛋白 1（分泌）" },
  // ===== 类 5 → 类 8 免疫防御 =====
  { re: /^dmbt1 family$/i, from: "5", to: "8", why: "清道夫受体富半胱氨酸防御蛋白（GP340/DMBT1）" },
  // ===== 类 5 → 类 10 蛋白质稳态 =====
  { re: /^pex2\/pex10\/pex12 family$/i, from: "5", to: "10", why: "过氧化物酶体 RING 型 E3 泛素连接酶" },
  { re: /^sil1 family$/i, from: "5", to: "10", why: "SIL1：ER BiP 核苷酸交换因子（伴侣辅因子）" },
  // ===== 类 5 → 类 14 其他 =====
  { re: /^phou family$/i, from: "5", to: "14", why: "Pi 代谢调节子（可溶，非运输机器）" },

  // ===== 类 6 → 其他类 =====
  { re: /^(cob[st]|cobu\/cobp|acsf) family$/i, from: "6", to: "1", why: "钴胺素/叶绿素生物合成酶" },
  { re: /^sdo1\/sbds family$/i, from: "6", to: "9", why: "SBDS：60S 核糖体亚基生成因子" },
  { re: /^selo family$/i, from: "6", to: "1", why: "SELO：硒蛋白氧化还原酶（CxxU 基序）" },
  { re: /^sptss family$/i, from: "6", to: "1", why: "丝氨酸棕榈酰转移酶小亚基" },
  { re: /^aldolase class ii family$/i, from: "6", to: "1", why: "II 类醛缩酶（果糖-1,6-二磷酸醛缩酶，裂合酶）" },
  { re: /^(tiam|rapgef2|cnksr|radil) family$/i, from: "6", to: "3", why: "Rho/Rap 鸟苷酸交换因子（GEF）或激酶支架" },
  { re: /^(cntf|ccn|scf) family$/i, from: "6", to: "3", why: "细胞因子/生长因子配体（CNTF、CCN、SCF/KITL）" },
  { re: /^cdiA toxin family$/i, from: "6", to: "8", why: "接触依赖生长抑制毒素" },
  { re: /^spt3 family$/i, from: "6", to: "4", why: "SAGA 组蛋白乙酰转移酶复合体亚基" },
  { re: /^symplekin family$/i, from: "6", to: "12", why: "聚腺苷酸化支架蛋白（3'端加工）" },
  { re: /^dash complex/i, from: "6", to: "11", why: "Dam1/DASH 动粒-微管偶联复合体" },
  { re: /^spc(110|29|42) family$/i, from: "6", to: "11", why: "纺锤体极体（SPB）核心组分" },
  { re: /^borealin family$/i, from: "6", to: "11", why: "染色体乘客复合体（CPC）亚基" },
  { re: /^pannexin family$/i, from: "6", to: "5", why: "Pannexin：间隙连接样通道（与 connexin 同层）" },
  { re: /^(tenascin|thrombospondin|ltbp) family$/i, from: "6", to: "7", why: "胞外基质糖蛋白（ECM 分泌）" },

  // ===== 类 3 → 其他类 =====
  { re: /^ftsz family$/i, from: "3", to: "6", why: "FtsZ：细菌微管同源物（Z 环细胞分裂骨架）" },
  { re: /^(dgtpase|uprtase|udp-n-acetylglucosamine 2-epimerase|rela\/spot) family$/i, from: "3", to: "1", why: "代谢酶（磷酸核糖转移酶/异构酶/ppGpp 合成酶）" },
  { re: /^eif-2-beta\/eif-5 family$/i, from: "3", to: "9", why: "翻译起始因子 eIF2β/eIF5" },
  { re: /^tom70 family$/i, from: "3", to: "5", why: "线粒体外膜蛋白输入受体（转位机器）" },
  { re: /^rad9 family$/i, from: "3", to: "12", why: "DNA 损伤检查点蛋白（9-1-1 复合体）" },
  { re: /^lin-9 family$/i, from: "3", to: "4", why: "DREAM 复合体转录因子亚基" },
  { re: /^wd repeat groucho\/tle family$/i, from: "3", to: "4", why: "Groucho/TLE 转录共抑制子" },
  { re: /^dp1 family$/i, from: "3", to: "4", why: "TFDP1：E2F 二聚化伙伴（转录因子）" },
  { re: /^srp receptor beta subunit family$/i, from: "3", to: "13", why: "SRP 受体（ER 蛋白靶向机器）" },
  { re: /^gpat\/dapat family$/i, from: "3", to: "1", why: "甘油-3-磷酸酰基转移酶（转移酶）" },
  { re: /^ncf2\/noxa1 family$/i, from: "3", to: "1", why: "NADPH 氧化酶激活因子（氧化还原酶系统）" },
  { re: /^atr family$/i, from: "3", to: "2", why: "ATR：PIKK 家族丝氨酸苏氨酸激酶（DNA 损伤检查点）" },
  { re: /^pbp\/gobp family$/i, from: "3", to: "7", why: "昆虫信息素/气味结合蛋白（分泌载体）" },
  { re: /^zp domain family$/i, from: "3", to: "7", why: "透明带糖蛋白域（分泌）" },
  { re: /^calcoco family$/i, from: "3", to: "10", why: "NDP52 类自噬受体（CALCOCO2）" },
  { re: /^constitutive coactivator of ppar-gamma family$/i, from: "3", to: "4", why: "PPARGC1A：转录共激活因子" },

  // ===== 类 2 → 其他类 =====
  { re: /^disease resistance x-tir-nb-lrr-x family$/i, from: "2", to: "8", why: "植物 NLR 抗病蛋白（非激酶）" },
  { re: /^flagellar radial spoke rsp3 family$/i, from: "2", to: "6", why: "鞭毛辐条头组装支架" },
  { re: /^cdkn2 cyclin-dependent kinase inhibitor family$/i, from: "2", to: "11", why: "CDK 抑制因子（p16INK4/p21 家族）" },

  // ===== 类 4 → 其他类 =====
  { re: /^(mad1|mad2|mad2l1bp) family$/i, from: "4", to: "11", why: "纺锤体组装检查点蛋白（MAD）" },
  { re: /^cenp-(c|mif2|t|cnn1|w|wip1)/i, from: "4", to: "11", why: "着丝粒/动粒核心组分组分（CENP-C/T/W）" },
  { re: /^dna glycosylase family$/i, from: "4", to: "12", why: "DNA 糖苷酶（碱基切除修复）" },
  { re: /^hmg-coa (lyase|reductase) family$/i, from: "4", to: "1", why: "甲羟戊酸途径代谢酶" },
  { re: /^dps family$/i, from: "4", to: "1", why: "Dps：铁蛋白样铁储存/抗氧化蛋白" },
  { re: /^cheb family$/i, from: "4", to: "1", why: "趋化受体甲基酯酶" },
  { re: /^moba\/mobl family$/i, from: "4", to: "1", why: "钼蝶呤腺苷转移酶" },
  { re: /^(ccda antitoxin|ceda|hicb antitoxin|higa antitoxin) family$/i, from: "4", to: "8", why: "毒素-抗毒素系统（细菌防御）" },
  { re: /^ftsk\/spoi ?iie\/sfta family$/i, from: "4", to: "12", why: "FtsK：染色体分离 DNA 移位酶" },
  { re: /^meiob family$/i, from: "4", to: "12", why: "减数分裂重组蛋白（单链 DNA 结合）" },
  { re: /^snf7 family$/i, from: "4", to: "13", why: "Snf7：ESCRT-III 囊泡出芽组分" },

  // ===== 类 7 → 其他类 =====
  { re: /^parvalbumin family$/i, from: "7", to: "3", why: "EF-hand 钙缓冲蛋白（细胞溶质）" },
  { re: /^eif4e-binding protein family$/i, from: "7", to: "9", why: "eIF4E 结合翻译抑制因子（4E-BP）" },
  { re: /^cenp-i\/ctf3 family$/i, from: "7", to: "11", why: "着丝粒/动粒蛋白 CENP-I" },
  { re: /^(thiaminase-2|cn hydrolase) family$/i, from: "7", to: "1", why: "水解酶（硫胺素酶/腈水解酶样）" },
  { re: /^polygalacturonase-inhibiting protein family$/i, from: "7", to: "8", why: "植物 LRR 防御蛋白（真菌多聚半乳糖醛酸酶抑制）" },
  { re: /^integrator subunit/i, from: "7", to: "12", why: "Integrator 复合体（snRNA 3'端加工）" },

  // ===== 类 8 → 其他类 =====
  {
    re: /^(patatin|phzf|prpd|aur1|kre1|skn1\/kre6|dph[12]|5'-nucleotidase type 3|n-acetylmuramoyl-l-alanine amidase 2) family$/i,
    from: "8",
    to: "1",
    why: "代谢酶误入免疫类（磷脂酶/次级代谢合成/酰胺酶等）",
  },
  { re: /^(mla[ac]|mlac\/ttg2d) family$/i, from: "8", to: "5", why: "外膜磷脂逆向转运机器（Mla）" },
  { re: /^anp1\/mmn9\/van1 family$/i, from: "8", to: "1", why: "高尔基甘露糖基转移酶复合体" },
  { re: /^hexim family$/i, from: "8", to: "4", why: "HEXIM：P-TEFb 转录延伸抑制因子" },
  { re: /^horma family$/i, from: "8", to: "11", why: "HORMA 域检查点蛋白（p31/MAD2 样）" },

  // ===== 类 12 → 其他类 =====
  { re: /^pom121 family$/i, from: "12", to: "13", why: "核孔复合体蛋白（核质运输）" },
  { re: /^synaptojanin family$/i, from: "12", to: "13", why: "磷酸肌醇磷酸酶（突触囊泡再循环）" },
  { re: /^centrin family$/i, from: "12", to: "3", why: "EF-hand 钙结合蛋白（中心体）" },
  { re: /^rna polymerase (alpha|beta|beta'|omega|sigma|dna-directed) chain family$/i, from: "12", to: "4", why: "RNA 聚合酶亚基（通用转录机器）" },
  { re: /^archaeal rpo\d+\/eukaryotic r[pb][abcd]?\d+/i, from: "12", to: "4", why: "RNA 聚合酶亚基（通用转录机器）" },
  { re: /^eukaryotic rpb\d+\/rpc\d+/i, from: "12", to: "4", why: "RNA 聚合酶亚基（通用转录机器）" },
  { re: /^eif-5a family$/i, from: "12", to: "9", why: "eIF-5A：翻译起始/延伸因子" },
  { re: /^class-ii fumarase\/aspartase family$/i, from: "12", to: "1", why: "II 类延胡索酸酶/天冬酶（裂合酶）" },
  { re: /^hesa\/moeb\/thif family$/i, from: "12", to: "1", why: "MoeB 类硫载体活化酶（钼蝶呤/泛素样活化）" },
  { re: /^cep63 family$/i, from: "12", to: "6", why: "CEP63：中心体复制蛋白" },

  // ===== 类 11 → 其他类 =====
  { re: /^nlrp family$/i, from: "11", to: "8", why: "NLRP：炎症小体感受器（先天免疫）" },
  { re: /^unc-5 family$/i, from: "11", to: "3", why: "Unc5：netrin 依赖性受体（膜受体）" },
  { re: /^mef2 family$/i, from: "11", to: "4", why: "MEF2：MADS-box 家族转录因子" },
  { re: /^(dnase i|dnase ii) family$/i, from: "11", to: "12", why: "脱氧核糖核酸酶（核酸代谢类）" },
  { re: /^ring-box family$/i, from: "11", to: "10", why: "RBX1：Cullin-RING E3 泛素连接酶催化亚基" },
  { re: /^gadd45 family$/i, from: "11", to: "12", why: "DNA 损伤诱导蛋白（核酸代谢与修复）" },
  { re: /^pdcd4 family$/i, from: "11", to: "9", why: "PDCD4：翻译起始抑制因子（eIF4A 结合）" },
  { re: /^cdc73 family$/i, from: "11", to: "4", why: "CDC73：RNA 聚合酶 II/PAF1 转录因子亚基" },
  { re: /^syce\d family$/i, from: "11", to: "12", why: "联会复合体组分（减数分裂核酸事件）" },
  { re: /^yap1 family$/i, from: "11", to: "3", why: "YAP/TAZ：Hippo 通路信号效应子" },
  { re: /^aatf family$/i, from: "11", to: "4", why: "AATF：转录调节与染色体稳定性因子" },
  { re: /^ctcf zinc-finger protein family$/i, from: "11", to: "4", why: "CTCF：染色体架构锌指蛋白" },
  { re: /^af4 family$/i, from: "11", to: "4", why: "AFF 转录因子家族" },

  // ===== 类 12 → 类 9（tRNA 修饰与翻译因子） =====
  { re: /^(dus|kae1 \/ tsad|mnma\/trmu|ttca|ctu2\/ncs2|elp3|mcts1|pat1) family$/i, from: "12", to: "9", why: "tRNA 修饰酶/翻译起始与脱帽因子" },
  { re: /^(eif-2-alpha|eif-3 subunit [a-z]) family$/i, from: "12", to: "9", why: "翻译起始因子亚基" },
  // ===== 类 12 → 类 4 / 10 =====
  { re: /^ctf\/nf-i family$/i, from: "12", to: "4", why: "CTF/NF-I CCAAT 结合转录因子" },
  { re: /^(ddb1|fam175) family$/i, from: "12", to: "10", why: "CUL4-DDB1\/BRCC 泛素连接酶复合体" },
  { re: /^archaeal rpo[ma0-9]+\/eukaryotic/i, from: "12", to: "4", why: "RNA 聚合酶亚基（通用转录机器）" },
  { re: /^(top6a) family$/i, from: "4", to: "12", why: "拓扑异构酶 VI A 亚基" },
  { re: /^relaxosome tram family$/i, from: "4", to: "12", why: "接合转移 relaxosome 组分（可移动元件）" },
  { re: /^(csn3|cop9) family$/i, from: "6", to: "10", why: "COP9 信号体（Cullin 去 NEDD 化）" },

  // ===== 类 10 → 其他类 =====
  { re: /^beta\/gamma-crystallin family$/i, from: "10", to: "6", why: "晶状体 βγ 晶状蛋白（结构蛋白，非伴侣）" },
  { re: /^small tim family$/i, from: "10", to: "5", why: "small Tim：线粒体蛋白输入转位机器组分" },
  { re: /^tim14 family$/i, from: "10", to: "5", why: "Tim14/PAM18：线粒体输入马达组分" },
  { re: /^(phosducin|synembryn|cttnbip1) family$/i, from: "10", to: "3", why: "Gβγ 调节子/GEF/β-catenin 抑制因子（信号转导）" },
  { re: /^(asf1|nucleoplasmin|spt6) family$/i, from: "10", to: "4", why: "组蛋白伴侣/染色质/转录延伸因子" },
];

// ===== 14 大类亚类定义（顺序敏感：先具体后泛化；末位 = 残差） =====
export const SUBGROUPS: Record<string, SubgroupDef[]> = {
  // ---------- 类 1 酶类：按 IUBMB EC 六大类 ----------
  "1": [
    {
      key: "ox",
      name: "氧化还原酶",
      nameEn: "Oxidoreductases (EC 1)",
      routes:
        /oxidoreductase|dehydrogenase|reductase|oxidase|oxygenase|peroxidase|hydroxylase|desaturase|cytochrome(?! p450)|ferredoxin|flavoprotein|flavodoxin|catalase|superoxide|thioredoxin|glutaredoxin|peroxiredoxin|quinone oxidoreductase|fumarate reductase|sulfite oxidase|nadh|nadph|fadh|fmn|rieske|adrenodoxin|putidaredoxin|^dps family|coq9|lactoylglutathione/i,
      absorbFb: /^oxidoreductases$/i,
    },
    {
      key: "cyp",
      name: "细胞色素P450",
      nameEn: "Cytochrome P450 monooxygenases",
      routes: /cytochrome p450|^p450|steroid 11-|steroid 21-|lanosterol|heme oxygenase/i,
      absorbFb: /^cytochrome p450$/i,
    },
    {
      key: "tr",
      name: "转移酶",
      nameEn: "Transferases (EC 2)",
      routes:
        /transferase|glycosyltransferase|methyltransferase|acetyltransferase|acyltransferase|aminotransferase|transketolase|transaldolase|phosphoribosyltransferase|ribosyltransferase|farnesyltransferase|geranylgeranyl|myristoyltransferase|palmitoyltransferase|prenyltransferase|sulfotransferase|carboxyltransferase|biotin carboxylase|galactosyltransferase|sialyltransferase|glucuronyltransferase|glutathione transferase|succinyltransferase|malonyltransferase|holoenzyme|nrml|cellulose synthase/i,
      absorbFb: /^transferases$/i,
    },
    {
      key: "pep",
      name: "蛋白酶与肽酶",
      nameEn: "Proteases & peptidases (EC 3.4)",
      routes: /peptidase|protease|protease inhibitor|serpin|cathepsin|metalloproteinase|matrix metalloproteinase|\badam\b|adamts|hirudin|pancreatic secretory trypsin|carboxypeptidase|dipeptidase|tripeptidase|aminopeptidase|subtilase|proprotein convertase|rhomboid|signal peptidase|processing protease|proteasome-associated|e3 trypsin-like/i,
      absorbFb: /^proteases$/i,
    },
    {
      key: "ph",
      name: "磷酸酶与酯酶",
      nameEn: "Phosphatases & esterases (EC 3.1)",
      routes:
        /phosphatase|esterase|phospholipase|phosphodiesterase|lipase|thioesterase|sulfatase|amidase|lactamase|amidohydrolase|deacylase|sirtuin|phosphopantetheine|arylsulfatase|acetylcholinesterase|butyrylcholinesterase|cholesterol esterase|carboxylesterase|alkaline phosphatase|acid phosphatase|tartrate-resistant/i,
      absorbFb: /^phosphatases$/i,
    },
    {
      key: "hy",
      name: "糖苷酶与其他水解酶",
      nameEn: "Glycosidases & other hydrolases (EC 3)",
      routes:
        /hydrolase|glycosidase|glycosyl hydrolase|glycoside hydrolase|amylase|cellulase|chitinase|xylanase|lysozyme|atpase|gtpase|pyrophosphatase|deaminase|peptidoglycan|muramidase|trehalase|sucrase|maltase|lactase|glycosylasparaginase|nudix|decapping|cheb family|glycoside|glycogen debranching|dextranase|inulinase|levanase|mannosidase|fucosidase|galactosidase|glucosidase|glucanase|heparanase|hyaluronidase|neuraminidase|sialidase|n-acetyl|amidase family|urease|asparaginase|glutaminase|amidohydrolase/i,
      absorbFb: /^hydrolases \(other\)$/i,
    },
    {
      key: "ly",
      name: "裂合酶",
      nameEn: "Lyases (EC 4)",
      routes: /lyase|aldolase|dehydratase|decarboxylase|carbonic anhydrase|enolase|hydro-lyase|threonine ammonia|adenylosuccinate|argininosuccinate|cystathionine|dihydroxy-acid|phosphoenolpyruvate|fumarase|aconitase|isocitrate lyase|malate synthase|hydroxymethylbilane|threo-3-hydroxyaspartate ammonia/i,
      absorbFb: /^lyases$/i,
    },
    {
      key: "iz",
      name: "异构酶",
      nameEn: "Isomerases (EC 5)",
      routes: /isomerase|mutase|racemase|epimerase/i,
      absorbFb: /^isomerases$/i,
    },
    {
      key: "lg",
      name: "连接酶与合成酶",
      nameEn: "Ligases & synthetases (EC 6)",
      routes: /ligase|synthetase|carboxylase(?!.*kinase)|asparagine synth|glutathione synth|cysteinyl-|ubiquitin-activating|acetyl-coa synthetase|succinyl-coa synthetase/i,
      absorbFb: /^ligases$/i,
    },
    {
      key: "etc",
      name: "其他酶与酶复合体",
      nameEn: "Other enzymes & cofactors",
      absorbFb: /^translocases & others$/i,
    },
  ],

  // ---------- 类 2 激酶 ----------
  "2": [
    {
      key: "rtk",
      name: "受体型与膜激酶",
      nameEn: "Receptor & membrane kinases",
      routes: /receptor|receptor-like|pelle|phytochrome|ethylene|sensor kinase|histidine kinase|two-component|osmosensitive|tachy?|cre1/i,
      absorbFb: /^receptor tyrosine kinases$|^plant receptor-like kinases$/i,
    },
    {
      key: "tyr",
      name: "酪氨酸激酶",
      nameEn: "Tyrosine kinases",
      routes: /tyrosine|\bsrc\b|\bjak\b|\btecb?\b|\bsyk\b|\bfrk\b|\btk\b|etk\/wzc|\bbtk\b|ferm domain|sh1 domain/i,
      absorbFb: /^non-receptor tyrosine kinases$/i,
    },
    {
      key: "st",
      name: "丝苏氨酸激酶",
      nameEn: "Serine/threonine kinases",
      routes:
        /ser\/thr|serine\/threonine|mapk|map kinase|\berk\b|\bmek\b|\bmnk\b|cdk|cyclin-dependent|pkc\b|pka\b|pkg\b|amp-activated|ampk|casein kinase|camk|calcium\/calmodulin|gsk|ck1\b|ck2\b|hipa|prka|srka|ste\d|ste-like|pdk\/bckdk|protein kinase|never-in-mitosis|\bnim\b|snf1|kinase-like|bub1|cek\b|kin-|ilk\b|loomig?|psk\b|osk1|spk[1-5]|nua|silk\b|top6b family/i,
      absorbFb: /^mapk cascade kinases$|^cyclin-dependent kinases$|^pka\/pkc\/pkg$|^other ser\/thr kinases$/i,
    },
    {
      key: "lip",
      name: "脂质与核苷酸激酶",
      nameEn: "Lipid & nucleotide kinases",
      routes: /lipid|pi3|pi4|phosphoinositide|inositol phosphokinase|diacylglycerol|\bdgk\b|sphingosine|choline kinase|ethanolamine kinase|adenylate kinase|guanylate kinase|nucleoside-diphosphate|nucleotide kinase|\bipk\b|dxr\b|mevalonate kinase|pantothenate kinase|pyridoxine kinase|thiamine|riboflavin|flavokinase/i,
      absorbFb: /^lipid kinases$/i,
    },
    {
      key: "met",
      name: "小分子代谢物激酶",
      nameEn: "Small-molecule metabolic kinases",
      absorbFb: /^other kinases$/i,
    },
  ],

  // ---------- 类 3 受体与信号转导 ----------
  "3": [
    {
      key: "gpcr",
      name: "G蛋白偶联与感觉受体",
      nameEn: "GPCR & sensory receptors",
      routes:
        /g protein-coupled|gpcr|olfactory|odorant|opsin|rhodopsin|chemoreceptor|receptor-like protein s[rsta-u]|taste|pheromone|cornichon|chemokine-like receptor|adipo|neuropeptide receptor|biogenic amine receptor|trace amine|melanocortin receptor|f2r\b|lgr\b|moody\b|cb[12] receptor|c5a anaphylatoxin receptor|purinergic receptor|adenosine receptor|dopamine receptor|serotonin receptor|histamine receptor|muscarinic|acetylcholine receptor muscarinic|bombesin receptor|bradykinin receptor|endothelin receptor|galanin receptor|kisspeptin receptor|melanin-concentrating hormone receptor|neurotensin receptor|opioid receptor|orexin receptor|oxytocin receptor|vasopressin receptor|somatostatin receptor|tachykinin receptor|thyrotropin-releasing hormone receptor|gonadotropin-releasing hormone receptor|prostaglandin receptor|leukotriene receptor|lysophospholipid receptor|sphingosine-1-phosphate receptor|free fatty acid receptor|hydroxycarboxylic acid receptor|lactate receptor|succinate receptor|bile acid receptor|mas-related|prokineticin receptor|relaxin receptor|angiotensin receptor|apelin receptor|chemerin receptor|complement c3a receptor|formyl peptide receptor|frizzled|smoothened|gprasp|chemotaxis|methyl-accepting/i,
      absorbFb: /^gpcr$|^olfactory receptors$|^opsins$/i,
    },
    {
      key: "cyto",
      name: "细胞因子与死亡受体",
      nameEn: "Cytokine & death receptors",
      routes:
        /tumor necrosis|\btnf\b|interleukin|interferon|toll-like|chemokine receptor|cytotoxicity receptor|\btnfr\b|\btraf\b|cd3[zt]?|fc receptor|fcε|fcer|fcγ|complement receptor|il-\d|type i cytokine receptor|class ii cytokine receptor|growth hormone receptor|prolactin receptor|erythropoietin receptor|thrombopoietin receptor|leukemia inhibitory|oncostatin|gp130|signal transducer and activator|colony stimulating|c-mpl|lif\/osm/i,
      absorbFb: /^tnf receptors$|^toll-like & cytokine receptors$/i,
    },
    {
      key: "gf",
      name: "生长因子与信号配体",
      nameEn: "Growth factors & signaling ligands",
      routes:
        /growth factor|\bwnt\b|neuregulin|amphiregulin|r-spondin|dickkopf|sclerostin|semaphorin|granulin|draxin|\brgf\b|\bvegf\b|\bpdgf\b|\begf\b|\bfgf\b|tgf-beta|bone morphogen|hedgehog|notch ligand|jagged|delta-like|colony stimulating|erythropoietin|kit ligand|ephrin|\bepha\b|\bephb\b|cerebellin|nptx|\bccn\b|cyr61|ctgf|\bnov\b|\bngf\b|nerve growth factor|wntless/i,
      absorbFb: /^growth factors$|^wnt & beta-catenin$/i,
    },
    {
      key: "gtp",
      name: "小G蛋白与GTP酶开关",
      nameEn: "Small GTPases & switches",
      routes:
        /small gtpase|gtpase|gtp-binding|\bgtpase superfamily|\brab\b|\bras\b|\brho\b|\barf\b|\bran\b|\bsar\b|g-alpha|g protein (gamma|beta)|ga protein|\brgs\b|trafac|dynamin-like|dynamin|mitochondrial rho|ranbp|rgs\d|rho gtp|arfrp|rheb\b|rap1\b|rap2\b|rgs-like|guanine nucleotide-binding(?!.*alpha)|guanine nucleotide dissociation|rho gdi|rab gdi|rho\./i,
      absorbFb: /^small gtpases$|^heterotrimeric g proteins$|^gtpase modulators$/i,
    },
    {
      key: "gefgap",
      name: "GEF/GAP与信号接头",
      nameEn: "GEFs, GAPs & adapters",
      routes:
        /\bgef\b|\bgap\b|guanine nucleotide exchange|\bdock\b|rutbc|rasgrp|rab3-gap|14-3-3|sh2|sh3|adapter|arrestin|calmodulin|ef-hand|s-100|recoverin|\bdsh\b|\bdvl\b|dishevelled|beta-catenin|\baxin\b|\bapcdd1\b|groucho|\bcrk\b|\bgrb2\b|\bsos\b|src homology|shank|sh2b|maguk|ankyrin repeat|\bpdz\b|scaffold|ticas|striatin|caveolin|signal-transducing|\bsamd\d|calpain small subunit|calcineurin regulatory|camkk|phospholipase c beta|plc-beta|rapgef|tiam|kalirin|dbl\b|pag1\b|caveolae|membrane raft|grb7|grb10|grb14|\bbrag\b|\bgab\b|\bnkd\b|rimbp|canopy|pcp4|rhpn|dss4|mss4|armcx|parvalbumin|calbindin|centrin/i,
      absorbFb: /^gefs & gaps$|^sh2\/sh3 adapters$|^calmodulin & ef-hand$/i,
    },
    {
      key: "mem",
      name: "膜受体与共受体",
      nameEn: "Membrane receptors & co-receptors",
      routes: /receptor|ldl|scavenger|low-density|patched|neuropilin|plexin|folate receptor|dispatched|sigma-2|opioid receptor-like|\bramp\b|\braptor\b|cd36|cd200|\blrp\b|sortilin|tie-?2|ret\b|ron\b|\bsema\b|\brlp\b|receptor-like|ms4a|tetraspanin|gdnfr|gdnf family receptor|7tm|lu7tm|insig|mrap|megf|\bnotch\b/i,
      absorbFb: /^other receptors$/i,
    },
    {
      key: "etc",
      name: "其他信号转导组分",
      nameEn: "Other signaling components",
    },
  ],

  // ---------- 类 4 转录与染色质 ----------
  "4": [
    {
      key: "zf",
      name: "锌指转录因子",
      nameEn: "Zinc finger TFs",
      routes:
        /zinc.?finger|c2h2|znf\d|kr.?ppel|iwr1|\bgli\b|ikaros|\begr\b|aebp2|dzip|\bsal[14]\b|insm|klf\d|sp[1-8]\b|b-box|phd.?finger|cchc|gis1|maz\b|znf\b|zar1\b|zfp\b|cysteine-rich|tigger|transposable element|myt1|elbow\/noc|zhx|nfx1|zc2hc1|ctcf/i,
      absorbFb: /^zinc finger tfs$/i,
    },
    {
      key: "hox",
      name: "同源框与发育因子",
      nameEn: "Homeobox & developmental TFs",
      routes:
        /homeobox|homeodomain|hox[abcd]|pax\d|\btal\b|six\d|lhx\d|dmrt|dach|coe\b|emx\b|cut homeobox|antp|caudal|nkx|gsh|vax|barx|barh|irx\d|meis|pbx\d|prep[12]|tshz|mix\b|\bsox\b|sry-box|lim homeobox|orthodenticle|empty spiracles|aristaless-like|brain factor|pod1\b|hhex\b|vndl|not\b|pou\d|pou2af|pou5f/i,
      absorbFb: /^homeobox tfs$/i,
    },
    {
      key: "basic",
      name: "碱性域转录因子",
      nameEn: "Basic-domain TFs (bZIP/bHLH/ETS/MYB/Forkhead)",
      routes:
        /bzip|leucine zipper|bhlh|helix-loop-helix|\bets\b|\bmyb\b|forkhead|fox[a-j]\d|\bfoxa\b|\bfoxb\b|\bfoxc\b|\bfoxd\b|\bfoxe\b|\bfoxf\b|\bfoxg\b|\bfoxj\b|\bfoxk\b|\bfoxl\b|\bfoxm\b|\bfoxn\b|\bfoxo\b|\bfoxp\b|\bfoxq\b|\bfoxr\b|\bfoxs\b|cited|creb|atf\d|\bjun\b|\bfos\b|\bmaf\b|\bmyc\b|\bmax\b|\busf\b|gata\d|\bhsf\b|tfe3|mitf|arid|bhlhe|basic helix|basic leucine|fev\b|elk[1-4]|erg\b|fli1\b|etv\d|myeloblastosis|myb-like|c-myb|i-mfa\b|kat[2-6]|cdk8\b|cdk9\b|cyclin h|tbp-associated|nc2\b|dr1\b|e2f\b|\bdp\b|smad|dwarfin|\brfx\b|\birf\b|groucho|\btle\b|ap-2 family|grh|\bcp2\b|tcf\/lef|lef1|hey\b|mit\/tfe|bzw\b|ski family|requiem|\bdpf\b|rox family|\bgrf\b|torc\b|pc4\b|coactivator|nfy[abc]|\bdp\b|dp1|mef2|wal family/i,
      absorbFb: /^bzip tfs$|^bhlh tfs$|^forkhead tfs$|^hmg-box tfs$/i,
    },
    {
      key: "nr",
      name: "核受体",
      nameEn: "Nuclear receptors",
      routes:
        /nuclear receptor|nuclear hormone receptor|\bnhr\b|steroid|retinoic|thyroid hormone|\bppar\b|\brxr\b|\bror\b|androgen|progesterone|glucocorticoid|mineralocorticoid|vitamin d3|estrogen|liver x|farnesoid|pregnane|constitutive androstane|nerve growth factor ib|nr[0-4][abcd]|estrogen-related|reverba|rxr\b|tailless|tlx\b|coup-tf|ear2\b|hnf4|gcnf\b|dax1\b|shp\b|lrd1\b/i,
      absorbFb: /^nuclear receptors$|^nuclear receptor$|^nuclear receptor corepressors$/i,
    },
    {
      key: "plant",
      name: "植物转录因子",
      nameEn: "Plant-specific TFs",
      routes:
        /wrky|\bnac\b|ap2\/erf|aux\/iaa|auxin response|lob domain|\barr\b|arr-like|b3 domain|\btcp\b|\bdof\b|hd-zip|\bgras\b|\bspl\b|squamosa|myb-cc|ein3|constans|\bbzr\b|camta|\bflz\b|gebp|alfin|bbr\/bpc|trihelix|g2-like|knotted|lbd\b|rwp-rk|jagged|mab\b|dream\b|lhy\b|cca1\b|toc1\b|prr\d|gi\b|col\d|ztl\b|fkf1\b|hwr\b|ice1\b|camta3|bzip[0-9]|tga\b|bzip59|hy5\b|myb2[0-9]|myb3[0-9]|myb[0-9]+-like|pii\b|idd\d|yld\b|hls1\b|dwa\d|bd\b|mterf|shi protein/i,
    },
    {
      key: "chrom",
      name: "染色质修饰与重塑",
      nameEn: "Chromatin modifiers & remodelers",
      routes:
        /chromatin|histone demethylase|histone acetyltransferase|histone methyltransferase|bromodomain|chromodomain|polycomb|\bswi\/snf\b|swr1|ino80|hat1|hat\d|hdac|hda\d|sirtuin|myst\b|baz\b|\bing\b|lem\b|chz1|hmgb|hmgn|hmga|high mobility group|condensin|cohesin|\bsmc\d|\bctcf\b|thap|macro\b|methyl-cpg|\bmbd\b|\blsh\b|rbbp|\brnf2\b|ubf\b|taz1\b|citrullination|hir\d|asf1|caf-1|fact|spt16|nucleosome assembly|nucleosome|nucleosomal|linker histone|h1\b|h5\b| cenp-a|centromere protein a| VARIANT|histone h[1-5]|histone-lysine|histone-arginine|jmjc|jarid|kdm\d|setd\d|smyd\d|prdm\d|mll\b|kmt\d|nsd[12]|asxl\d|baz1|linc\b| tip60|kat\d|p300\b|cbp\b|pcaf|gcn5\b|saga\b|su(var)|suvar|catalytic component 2|enhancer of zeste|polycomb|eed\b|suz12\b|jarid2|l3mbtl|scmh1\b|phf\d|sfmbt|l(3)mbt|sam-binding methyltransferase|methyltransferase superfamily|\bbet\b|smarc|ss18|dpy-30|vefs|\basx\b|sgf\d|spt20|saga\b|nucleoplasmin|asf1\b|spt6\b|rbap|msi1\b|\bbaf\b|metastasis-associated|sap30|snf5|gtf2h|paf1|rrn3|hdgf/i,
      absorbFb: /^chromatin modifiers$/i,
    },
    {
      key: "hist",
      name: "组蛋白",
      nameEn: "Histones",
      routes: /^histone/i,
    },
    {
      key: "gtm",
      name: "通用转录机器",
      nameEn: "General transcription machinery",
      routes:
        /rna polymerase|mediator complex|mediator of rna|\bgtf\b|transcription factor (iib|iid|iie|iif|iih|d)\b|\btbp\b|\btaf\b|tfii|elongin|gre[ab]|dksa|transcription initiation|general transcription|spt5\b|spt6\b|rtf1|pafl|cdc73|p-tefb|cdk7|cdk9\b|tfiih|xpb\b|xpd\b|tfiis|dock\d|rtr\b|nrd1\b|sen1\b|ctd\b|polymerase-associated| rpc\d|pol iii|pol ii\b|rpo\b| sigma|taf\d+|taf1b|rrn7|nfy[abc]|hap[235]|ell\/occludin|\bell\b|rpap2|pc4\b|tho\b|sub1\b/i,
      absorbFb: /^general transcription machinery$/i,
    },
    {
      key: "bact",
      name: "细菌转录调节子",
      nameEn: "Bacterial transcriptional regulators",
      routes:
        /lys[rl]|^fur family|metj\b|dtxr|mnt ?r|\bfis\b|integration host|crp\b|fnr\b|arac|laci|tet ?r|mar[ar]|\bsox\b|\brob\b|h-?ns|lexa|malt|malt|matp|flh[cd]|nar[lp]|uhp|rhamnose|xylr|rhlr|lasr|luxr|csg[dr]|sigma factor|anti-?sigma|rse[abc]|flia|sigma(54|70|32|38|28|24|19)|alg[ud]|rsm[ab]|carbohydrate transcriptional|nitrogen regulatory|pho[bp]|gad[ex]|iscr|asn[cl]|rob\b|aci[rt]|mhp ?r|htt ?r|yie?l|cpx?r|ryhb|glnc|lrp\b|arg[pr]|ilvy|thr?c|tyrb|metj|mle|rut?r|btsr|phor|cbar|btub|dcus|pdh?r|gabr|pcaa|suc?r|sdh?c|frd[ar]|omp?r|envz|rcs[ab]|phop|phoq|bas?r|cbs[st]|fnrl|nos?z|nnrr|fliz|gadw|mer[rd]|ars[rd]|cop[ry]|znt[ry]|cad[cr]|pbt?r|bin\b|cus[rs]|sil[rs]|go[rs]|gol[st]|nik[ry]|zra[rs]|rcn[ry]|cor[ry]|dme[rs]|ter[ry]|tcr\b|hmr\b|iut\b|fec[ir]|fep\b|fur\b|dtxr\b|ide[ry]|per\b|aef\b|etp\b|hly\b|hem[ry]|sft\b|paa\b|ant\b|ben\b|cat\b|xyz\b|xyl\b|tou\b|tdo\b|try\b|prp\b|glp[rd]|ugp\b|mal[qt]|mel\b|rha\b|ara\b|xyl[fa]|fuc\b|gnt\b|idn\b|uxu\b|exu\b|kdg?r|gad\b|csr[ab]|hfq\b|cya\b|rap\b|cod\b|fru\b|man\b|mtl\b|sor\b|srl\b|scr\b|sac\b|lev\b|cel\b|bgl\b|arb\b|esc\b|gan\b|kdg\b|spa\b|hly[abcd]|pnl\b|pel\b|prt\b|to[dt]\b|ttg\b|xylr|rpo[nes]|ntr\b|gln\b|nif[la]|fix[lnkj]|bglj\b|rcs\b/i,
    },
    {
      key: "etc",
      name: "其他转录调控因子",
      nameEn: "Other transcriptional regulators",
      absorbFb: /^other tfs$|^other dna-binding$/i,
    },
  ],

  // ---------- 类 5 膜通道与膜转运：按 TC 运输机制 ----------
  // 路由顺序：蛋白转位(最具体) → ATP 泵 → 孔蛋白 → 电压门控通道 → 配体门控通道 →
  //          感觉/机械门控通道 → 水通道 → 二级载体 → 残差
  "5": [
    {
      key: "transloc",
      name: "蛋白转位与分泌系统",
      nameEn: "Protein translocation & secretion systems",
      routes:
        /sec[0-9]|sec[abcdg]\b|secy|sec61|yajc|tat[ace]|\btim\d|\btom\d|\btic\d|toc75|sam50|pam\d|metaxin|\btram\b|rft1|gsp [c-m]|fimbrial export usher|autotransporter|tam[ab]\b|peroxin|secretin|yidc|emp24/i,
    },
    {
      key: "pump",
      name: "ATP驱动泵",
      nameEn: "ATP-powered pumps (P/V/F-type & ABC)",
      routes:
        /atp-binding cassette|abc transporter|^abc-[234] |p-type|cation transport atpase|transporting atpase|atpase|\batp[0-9]+\b|\batpi\b|\bkdp[acfg]\b|arsA|trwb coupling|binding protein-dependent|solute-binding protein|sulfate-binding protein|leucine-binding protein|btuF|psts|phosphate\/phosphite|cdc50|mla[de]\b|lpt[abfg]|vitamin uptake transporter \(vut\/ecf\)|ecf transporter|energy-coupling factor|fxyd|nkain/i,
      absorbFb: /^p-type atpases$|^abc transporters$/i,
    },
    {
      key: "porin",
      name: "孔蛋白与外膜通道",
      nameEn: "Porins & outer-membrane channels",
      routes:
        /\bporins?\b|lam[bbd]|\btsx\b|kdgm|\bopr\b|oep[0-9]+|mitochondrial porin|outer membrane factor|\bomf\b|\btonb\b|tonb-dependent|exbb\/tolq|ompp1|fadl|bex[cd]|\bctra\b|kps[de]|lpsz|mal[mt] family|to [a-z]\.|yhd[pb]|tsua|ecpc|matd|azlc|pbgA|yejm|mlaa|osmx/i,
      absorbFb: /^porins$/i,
    },
    {
      key: "vgate",
      name: "电压门控离子通道",
      nameEn: "Voltage-gated ion channels",
      routes:
        /potassium channel|sodium channel|calcium channel|chloride channel|cyclic nucleotide-gated|proton channel|hydrogen channel|proton-activated|\bnalcn\b|tmem175|tmem38|\borai\b|\bmcu\b|micu|smdt1|emre|\bcora\b|trkh|kch1|tmco1|voltage|cation channel sperm|kcnmb/i,
      absorbFb: /^potassium channels$|^na\/ca channels$|^chloride channels$/i,
    },
    {
      key: "lgate",
      name: "配体门控离子通道",
      nameEn: "Ligand-gated ion channels",
      routes:
        /ligand-gated|glutamate-gated|ionotropic|p2x receptor|5-hydroxytryptamine receptor 3|cys-loop|acid-sensing|proton-gated|epithelial amiloride|cyclic gmp-gated|gaba-gated|acetylcholine-gated|purinoceptor|insp3|inositol 1,4,5|ryanodine|calcium-release/i,
      absorbFb: /^ligand-gated & other channels$/i,
    },
    {
      key: "sgate",
      name: "感觉与机械敏感通道",
      nameEn: "Sensory & mechanosensitive channels",
      routes:
        /transient receptor|\btrp\b|piezo|otopetrin|connexin|innexin|bestrophin|anoctamin|lrrc8|calhm|tweety|mscl|mscs|polycystin|csc1|catsper|tcaf|saraf|amiloride-sensitive|ammonium transporter|ammonia transporter|castor\/pollux|anion channel|pannexin/i,
    },
    {
      key: "aqp",
      name: "水通道蛋白",
      nameEn: "Aquaporins (MIP)",
      routes: /aquaporin|mip\/aquaporin|major intrinsic/i,
      absorbFb: /^aquaporins$/i,
    },
    {
      key: "slc",
      name: "溶质载体与二级转运体",
      nameEn: "Solute carriers & secondary transporters",
      routes:
        /solute carrier|major facilitator|drug\/metabolite|cpa2|gph|galactoside|glutamate:na|symporter|antiporter|permease|exchanger|efflux|uptake|transporter|carrier|citm|dcu[abcd]|nha[abd]|bcct|arn[ef]|lys[ eo]|ars[bp]|acr3|aromatic acid exporter|gntp|kdgt|rhamnose|lactate permease|branched chain|peptide uptake|peptide transporter|oligopeptide|purine|\bfnt\b|acetate|autoinducer|ala?e exporter|hak\/kup|nicoit|nipa|feo[ab]|ofet|plant ureide|ureide|reduced folate|sideroflexin|tpt transporter|trap transporter|tsup|upf0014|nicotinamide|gdt1|ccc1|letm1|nher|golgi ph|auxin efflux|glutamine dumper|big grain|ysl\b|murj|mviN|tellurite|mgtc|sulfate permease|nitrate|nrt\b|pho84|phosphate transporter|amino acid|monoamine|neurotransmitter|secretory pathway family|acdp|membrane fusion protein|rnd\b|resistance-nodulation|cystinosin|tspo|bzrp|tmem163|ankh|yjb[bb]\b|npr3/i,
      absorbFb: /^solute carriers \(slc\)$/i,
    },
    {
      key: "etc",
      name: "其他膜转运相关蛋白",
      nameEn: "Other transport-associated proteins",
      absorbFb: /^other transport$/i,
    },
  ],

  // ---------- 类 6 细胞骨架与结构 ----------
  "6": [
    {
      key: "actin",
      name: "肌动蛋白系统",
      nameEn: "Actin cytoskeleton",
      routes:
        /actin|arp[23]|\barp\b|formin|profilin|cofilin|gelsolin|tropomyosin|troponin|villin|ezrin|moesin|radixin|filamin|spectrin|dystrophin|utrophin|actinin|thymosin|capping|wasp|wiskott|wrc\b|wave|scar\b|cyfip|brk1|coronin|capza|capzb|twinfilin|advillin|supervillin|espin|fimbrin|plastin|dematin|adducin|drebrin|carmil|lamellipod|mical|eplin|palladin|myopalladin|shroom|toca|cip4|srgap|fascin|scinderin|severin|fragmin|vinculin|talin|paxillin|zyxin|focal adhesion|\bvcl\b|arg\/abl|aip1\b|wdr1\b|n-cofilin|depactin|\badf\b|cofactin| villin| tuba\b|aipl1\b|enah\b|vasp\b|mena\b|evl\b|lamellipodia|filopodia|calponin|tropomodulin|syntrophin|wash\d?|arpc[1-5]?|\babi\b|gas2|cdc42se|\bcas\b|tmod\b|\bcap family\b/i,
      absorbFb: /^actins$|^actin-binding proteins$/i,
    },
    {
      key: "mt",
      name: "微管系统",
      nameEn: "Microtubule cytoskeleton",
      routes:
        /tubulin|kinesin|dynein|microtubule|stathmin|\bmap[12]\b|tau protein|tubg|tppp|spastin|katanin|clip-170|cam?sap|clasp|eb[123]\b|mal3\b|bicaudal|op18|tektin|tubulin tyrosine|xmap215|tog\b|ch-to[gt]|msps|stathmin-like|\bdcx\b|doublecortin|tuba4a|tekt|spc(97|98)|bimc|embly|kif[0-9]+[ab]?$|iqd\b|mapre|eb[123]\b|nud[ei]\b|tbcc|tpx2\b|map7|map65|ase1|hook family|navigator|unc-53|lis1|nudf/i,
      absorbFb: /^tubulins$|^kinesins & dyneins$|^microtubule-associated$/i,
    },
    {
      key: "myo",
      name: "肌球蛋白马达",
      nameEn: "Myosin motors",
      routes: /myosin|meromyosin|paramyosin|myosin light chain|\bmlc\b|\bmhc\b/i,
      absorbFb: /^myosins$/i,
    },
    {
      key: "if",
      name: "中间丝与核纤层",
      nameEn: "Intermediate filaments & lamins",
      routes:
        /keratin|\blamin\b|lamin a|lamin b|vimentin|desmin|neurofilament|internexin|gfap|peripherin|syncoilin|phasin|intermediate filament|nestin|synemin|paranemin|plectin|desmuslin|ahnak|cp49\b|cp115|phakinin|lens filament|nesprin|sun\d\b|krtap|plakin|cytolinker|crystallin|narf\b/i,
      absorbFb: /^intermediate filaments$/i,
    },
    {
      key: "cilia",
      name: "纤毛、鞭毛与中心体",
      nameEn: "Cilia, flagella & centrosome",
      routes:
        /flagell|ciliar|ciliary|intraflagellar|axoneme|tektin|\bift\b|outer arm|inner arm|dnaaf|dnai|\bodf\b|spag\b|radial spoke|rsp\b|bbs[0-9]|bbsome|ceph|centriole|centrosome|centrosomin|cp110|sas[46]|\bspd\b|pericentrin|ninein|cenpj|deup1|cnap|cfap|ccdc(?!134)|c2cd3|talpid|tapt1|ofd1|lrrc6|drc\d|gas8|gas11|\bmks\b|tmem(17|67|107|138|216|231|237)|b9d|kifap|oafx|lrrc\d+|nphp|inversin|cystin|c21orf|\bstil\b|\bcep\d+|rootletin|cryba|otolin|outer dense|fibrous sheath|hydin|armand|spata|katnb1|katnal|prefoldin|ldb3|mak\b|rpgr|sperm|mannidine|fbb|wdr(3|4|5|6|19|3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9])\b|cep family|borg\/cep|chibby|ttc30|dfy-1|fleer|cimap|cimip|fam110|pih1/i,
      absorbFb: /^ciliary & flagellar$/i,
    },
    {
      key: "adh",
      name: "细胞粘附与连接",
      nameEn: "Cell adhesion & junctions",
      routes:
        /cadherin|integrin|catenin|desmo|zonula|adherens|adhesion|selectin|\bicam\b|\bvcam\b|jam[123]|occludin|claudin|marvel|tight junction|focal contact|l1cam|ncam|contactin|neurexin|neurofascin|\bmpz\b|myelin protein zero|\bmag\b|nrcam|dscam|sidekick|cip\b|periplakin|envoplakin|plakoglobin|plakophilin|corneodesmosin|l1 cell|ceacam|podocalyxin|muc[0-9]|sialomucin|stomatin|podoplanin|epcam|nectin|afadin|cingulin|crumbs|pals\d|patj|scribble|dlg\d|par[36]|mpp\d|tjp\d|pmp-22|peripheral myelin|epha?\b|ephb\b|basigin|neuroplastin|testin|lasp|annexin|fimbrial|calsyntenin|lap \(lrr|lin-7|angiomotin|kindlin|ninjurin|cd164/i,
      absorbFb: /^cell adhesion & junctions$/i,
    },
    {
      key: "photo",
      name: "光合系统与质体结构",
      nameEn: "Photosystem & plastid structure",
      routes:
        /photosystem|chlorophyll|light-harvesting|rubisco|photosynth|phycobilisome|cytochrome b6f|chloroplast-coupling|psa[a-z]|psb[a-z]|lhca|lhcb|pet[ab]|rbc[ls]|\boec\b|psii|psi\b|fenna|allophycocyanin|phycocyanin|phycoerythrin|fcp\b|chlorophyll a-b|thylakoid|plastocyanin|plastoquinone|cytochrome c6|chlamy|ycf\d/i,
      absorbFb: /^photosystem proteins$/i,
    },
    {
      key: "etc",
      name: "其他结构蛋白",
      nameEn: "Other structural proteins",
      absorbFb: /^other structural$/i,
    },
  ],

  // ---------- 类 7 胞外基质与分泌 ----------
  "7": [
    {
      key: "col",
      name: "胶原蛋白",
      nameEn: "Collagens",
      routes: /collagen|colq\b|facit|multiplexin|vitelline membrane protein family/i,
      absorbFb: /^collagens$/i,
    },
    {
      key: "glyco",
      name: "基质糖蛋白与基质修饰",
      nameEn: "Matrix glycoproteins & modifiers",
      routes:
        /fibronectin|laminin|fibrillin|elastin|fibulin|nidogen|vitronectin|thrombospondin|matrilin|hgapln|mfap|leprecan|perlecan|extensin|expansin|germin|papilin|osteonectin|heparan sulfate|chondro|dermokine|secreted frizzled|hhip\b|noggin|chordin|twisted gastrulation|isthmin|vascular endothelial|angiopoietin|fzd-related|cartilage|matrix gla|osteocalcin|osteoregulin|spp\d|ucma\b|ccdc80|ccbe1|\bfap\b|loxl|lysyl oxidase|prolyl 4|procollagen|fibril-associated|osteonectin|COMP\b|cartilage oligomeric|matrilin|fibronectin type iii| SRCR\b|scavenger receptor cysteine-rich/i,
      absorbFb: /^fibronectin & laminins$|^other ecm$/i,
    },
    {
      key: "pg",
      name: "蛋白聚糖与凝集素",
      nameEn: "Proteoglycans & matrix lectins",
      routes:
        /proteoglycan|glypican|syndecan|aggrecan|versican|slrp|small leucine-rich|decorin|biglycan|lumican|mimecan|asporin|keratocan|fibromodulin|osteoglycin|epiphycan|lectin|ficolin|pentraxin|calycin|leguminous lectin|concanavalin|heparin-binding|link protein|hyaluronan|hapln|versican| perlecan| testican| sparc/i,
      absorbFb: /^proteoglycans$/i,
    },
    {
      key: "horm",
      name: "激素、神经肽与信号肽",
      nameEn: "Hormones, neuropeptides & peptide signals",
      routes:
        /hormone|insulin|somatotropin|prolactin|neuropeptide|np[wy]\b|ghrelin|leptin|orexin|tachykinin|somatostatin|gastrin|cholecystokinin|glucagon|calcitonin|parathyroid|endothelin|natriuretic|bombesin|galanin|vasopressin|oxytocin|gnrh\b|trh\b|corticotropin|apelin|adrenomedullin|kinin|melanin-concentrating|urotensin|corazonin|allatostatin|prokineticin|opioid|spexin|motilin|neurotensin|melanocortin|pomc|\bcart\b| secretory peptide|clv3|cep\b|rapid alkalinization|phytosulfokine|psk\b|rgf\b|c-terminally encoded|systemin|flg22|peptide family|enkephalin|dynorphin|endorphin|melanocyte|secretogranin|chromogranin|vasoactive|pituitary|hypothalamic|angiotensin|relaxin|inhibin|activin|follistatin|anti-müllerian|amh\b|bnp\b|anp\b|cnp\b|drosophila sex peptide|pyrokinin|myosuppressin|diuretic hormone|ecdysis|eclosion|arthropod|fmrfamide|neurokinin|bradykinin|kallidin|thyrotropin|gonadotropin|glycoprotein hormone|lhb\b|fshb\b|cga\b|tshb\b|elabela|toddler|humanin|c-peptide|proglucagon|pro-islet amyloid|pancreatic polypeptide|peptide yy|neuropeptide [fyw]|azurocidin|dermcidin/i,
      absorbFb: /^hormones & neuropeptides$/i,
    },
    {
      key: "carrier",
      name: "血浆载体与脂质结合蛋白",
      nameEn: "Plasma carriers & lipid-binding proteins",
      routes:
        /apolipoprotein|albumin|alb\/afp|alpha-fetoprotein|transferrin|hemopexin|retinol-binding|retinaldehyde-binding|beta-2-glycoprotein|sex hormone-binding|histidine-rich|vitamin d-binding|lipocalin|globin|hemoglobin|hemocyanin|haptoglobin|fetuin|transthyretin|fatty-acid and retinol|odorant-binding|pbp\/gobp|biogenic amine-binding|corticosteroid-binding|thyroxine-binding|secretoglobin|avidin|angiotensinogen|alpha-2-macroglobulin|c4-binding|vitellogenin|cobra venom factor|plant lipid transfer|non-specific ltp|alpha-1-acid glycoprotein|orosomucoid|ceruloplasmin|haptoglobin-related|alpha-1-microglobulin|bikunin|inter-alpha-trypsin|kallistatin|vitamin d binding/i,
    },
    {
      key: "etc",
      name: "其他分泌与防御相关蛋白",
      nameEn: "Other secreted proteins",
      absorbFb: /^other secreted$/i,
    },
  ],

  // ---------- 类 8 免疫与防御 ----------
  "8": [
    {
      key: "ig",
      name: "抗体与淋巴细胞受体",
      nameEn: "Immunoglobulins & antigen receptors",
      routes:
        /immunoglobulin|\bmhc\b|histocompatibility|beta-2 microglobulin|t-cell receptor|\btcr\b|\bcd3\b|fc receptor|fcε|fcer|fcγ|pi[rl]\b|leukocyte receptor|lag[3]|\bcd8\b|\bcd4\b|slamf|cd84|natural cytotoxicity|nk cell|killer cell|poliovirus receptor|cd226|tactile|cd96|pd-1|pdl1|ctla4|icos\b|\bcd28\b|btla\b|timo\b|\bcam\b.*receptor/i,
      absorbFb: /^immunoglobulins$|^mhc$|^t-cell receptors$/i,
    },
    {
      key: "comp",
      name: "补体与体液免疫",
      nameEn: "Complement & humoral immunity",
      routes:
        /complement|properdin|ficolin|collectin|colec|c1q|rca\b|factor [bdh]|c4bpa|c4bpb|clusterin|cd59\b|\bdaf\b|decay-accelerating|factor h|mannose-binding|mbl\b|masp[12]|\bc3\b|\bc5\b|c6\/c7|cobra venom|anaphylatoxin|properdin/i,
      absorbFb: /^complement$/i,
    },
    {
      key: "ck",
      name: "白介素与干扰素",
      nameEn: "Interleukins & interferons",
      routes:
        /interleukin|interferon|ifi\d|il-\d|il[0-9]+[a-z]* family|type-i \(or|type-ii \(or|type-iii \(or|type-iv \(or|cytokine receptor-like|epo\/tpo|gm-csf|\bcsf2\b|\bcsf3\b|flt3 ligand|adipolin|erythroferrone|thymic stromal|lymphotoxin|\blta\b|\bltb\b|\btl1a\b|\btl[0-9]a?\b/i,
      absorbFb: /^interferons & interleukins$/i,
    },
    {
      key: "chemo",
      name: "趋化因子",
      nameEn: "Chemokines",
      routes: /chemokine|intercrine|cxc[cl]|cc chemokine|cx3cl|xcl[12]\b|mcp-[0-9]|rantes\b|eotaxin|ip-10\b|\bmig\b|\bgro\b|platelet factor 4/i,
      absorbFb: /^chemokines$/i,
    },
    {
      key: "tnf",
      name: "TNF家族配体与受体",
      nameEn: "TNF ligands & receptors",
      routes:
        /tumor necrosis|\btnf\b|\btnfr\b|\btraf\b|tnfaip|death receptor|\btrail\b|\bapril\b|\bbaff\b|blys|rankl|\brank\b|\bcd40\b|\bcd27\b|\bcd30\b|ox40|4-1bb|gitr\b|\blight\b|\btweak\b|\beda\b|\bEDA\b|ectodysplasin/i,
      absorbFb: /^tnf ligands$/i,
    },
    {
      key: "amp",
      name: "抗菌肽与天然免疫",
      nameEn: "Antimicrobial peptides & innate immunity",
      routes:
        /defensin|cathelicidin|cecropin|attacin|drosocin|bomanin|andropin|hepcidin|leap|histatin|statherin|thaumatin|thionin|invertebrate defensin|microcin|colicin|bactericidal|antimicrobial|enterotoxin|antimicrobial peptide|spag11|turandot|heat-stable|mastoparan|melittin|bombinin|brevinin|esculentin|ranatensin|dermaseptin|phylloseptin|adenoregulin|piscidin|pleurocidin|\bhbd\b|\bhdd\b|\bngp\b|s100a8|calprotectin|psoriasin|koebnerisin|lipocalin 2|\bbpi\b|\blbp\b|plunc|bactericidal permeability|mucin 7|lactotransferrin|lactoferrin|nlrp|inflammasome|nod-like/i,
      absorbFb: /^defensins & antimicrobial$/i,
    },
    {
      key: "plant",
      name: "植物抗病与免疫信号",
      nameEn: "Plant disease resistance & immunity",
      routes:
        /disease resistance|nb-lrr|nbs-lrr|tir-nb|rpw8|rin4|npr[1-4]|\bmlo\b|tify|jaz\b|sgs3|brassinazole|bak1\b|bik1\b|pbs\d|avrph|\brps\d|rpm1|rps[245]|fls2\b|\befr\b|cerk1|lyk\d|dnd[12]|edr1|pad4\b|sag101|adr1\b| RPM1| rps2| fla\d|notch|hopm|enhanced disease| rar1| sgt1| eds1| pad4/i,
      absorbFb: /^plant r proteins$/i,
    },
    {
      key: "rm",
      name: "细菌限制与噬菌体防御",
      nameEn: "Restriction-modification & phage defense",
      routes:
        /restriction|hsd[rs]m|crispr|cas[0-9]|cd-ntase|methylase|toxin-antitoxin|antitoxin|microcin immunity|colicin immunity|\bivy\b|mlic\b|tehb|abortive|brex\b|disarm|defense island|methylation-involved|dnd\b/i,
      absorbFb: /^restriction-modification$/i,
    },
    {
      key: "tox",
      name: "毒素与其他免疫",
      nameEn: "Toxins & other immunity",
      routes:
        /toxin|\brtx\b|enterotoxin|cytolysin|hemolysin|leukocidin|shiga|cholera|diphtheria|pertussis|tetanus|botulinum|anthrax|lethal factor|edema|exotoxin|endotoxin|mycotoxin|aflatoxin|cercarial|snake venom|scorpion|conotoxin|spider|wasp|bee venom|histamine-releasing|protease toxin|abrin\b|ricin\b|shiga-like|subtilase cytotoxin|toxin a\b|toxin b\b/i,
      absorbFb: /^toxins$|^other immunity$/i,
    },
  ],

  // ---------- 类 9 核糖体与翻译 ----------
  "9": [
    {
      key: "ribo",
      name: "核糖体蛋白",
      nameEn: "Ribosomal proteins",
      routes: /ribosomal|ribosome|\brpl[0-9]|\brps[0-9]|rplp|rpsa|ria1|mits1|stimulation factor|\bptf\b/i,
      absorbFb: /^ribosomal proteins$/i,
    },
    {
      key: "tf",
      name: "翻译因子与调控",
      nameEn: "Translation factors & regulators",
      routes:
        /elongation factor|initiation factor|release factor|translation|eif[0-9]|eif-|eef[12]|\bef-tu\b|\bef-g\b|\bef-ts\b|selb\b|selenocysteine|4e-|eif4e|4e-bp|pabp|poly(a)-binding|\babce1\b|dcp\d|decapping|pelota|hbs1|\bski\b|dom34|gtp-binding protein \d|peptide chain|nascent|tmrna|smpb|\befp\b|eif5a|diphthamide|dsk2/i,
      absorbFb: /^translation factors$/i,
    },
    {
      key: "aars",
      name: "氨酰tRNA合成酶与tRNA修饰",
      nameEn: "Aminoacyl-tRNA synthetases & tRNA modification",
      routes:
        /aminoacyl|trna synthetase|trna-(guanine|cysteine|adenosine)|trna ligase|prolyl|alanyl|glycyl|histidyl|isoleucyl|leucyl|lysyl|methionyl|phenylalanyl|seryl|threonyl|tryptophanyl|tyrosyl|valyl|glutamyl|glutaminyl|aspartyl|asparaginyl|arginyl|cysteinyl|queuosine|wybutosine|thiolation|mnm[ea]|trmu\b|gtpbp|amino acid adenylation| aa-domain|parc[esr]/i,
      absorbFb: /^aminoacyl-tRNA synthetases$/i,
    },
    {
      key: "bio",
      name: "核糖体生成与组装",
      nameEn: "Ribosome biogenesis & assembly",
      absorbFb: /^ribosome biogenesis$/i,
    },
  ],

  // ---------- 类 10 蛋白质稳态 ----------
  "10": [
    {
      key: "hsp",
      name: "热激蛋白与伴侣机器",
      nameEn: "Heat shock proteins & chaperones",
      routes:
        /heat shock|hsp[0-9]|\bhsp\b|chaperonin|groel|groes|chaperone|prefoldin|dna[jk]|grpe|\bgrp[de]\b|\bbip\b|sse\d|ssb\d|ssa\d|nucleotide exchange|\bhsc\b|\bcct\b|tcp-1|t-complex| hsp10|mge1\b|mdj\d|zuotin|j-protein|holdase|co-chaperone|nucleolar|npl\d|sec63|clp[ab]|clpp|clpx|calreticulin|calnexin|cdc37|p23\/wos2|\bp23\b|\bsgt\b|sco[12]|universal stress/i,
      absorbFb: /^hsp70 family$|^hsp90 family$|^chaperonins & small hsps$|^other chaperones$/i,
    },
    {
      key: "ub",
      name: "泛素与类泛素系统",
      nameEn: "Ubiquitin & ubiquitin-like systems",
      routes:
        /ubiquitin|nedd8|\bsumo\b|fat10|conjugating|ubiquitin-activating|ligase|skp[12]?$|cullin|\bcul[1-7]\b|fbx[wlro]|\bfbxo\b|ring-type|really interesting|\btrim\b|rnf\d|herc\d|klhl|btb-poz|parkin|mdm2|\bvhl\b|\bchip\b|stub1|ubr\d|hhari|\bsiah\b|march\d|znrf|rbr\b|\bARI\b|e6ap|ube\d|otub|otulin|bap1|josephin|usp\d|uch\b|yod1|senp\d|desumoyl|\bulp\b|deneddyl|nse\d| SUMO-specific|pex2\/pex10|ankyrin socs|asb\d|fbox\b|F-box|anaphase-promoting|\bapc[1-5]\b|\bcdc[1245678]| \bRBX\b|ROC1\b|RBX1\b|visceral fat|skp1\b|sina\b|seven in absentia|pias\b|bre1|deltex|hrd1|irf2bp|\bcand\b|ufd1|ltn1|listerin|pellino|ufm1|urm1|desi\b|ring-box/i,
      absorbFb: /^ubiquitin & ubls$|^e3 ubiquitin ligases$|^deubiquitinases$|^e1\/e2 conjugating$/i,
    },
    {
      key: "pros",
      name: "蛋白酶体",
      nameEn: "Proteasome",
      routes: /proteasome|\bpas\d|psm[abcd]|\brpn\d|\brpt\d|blm10|pa28|pa200|11s\b|19s\b|20s\b|sem1\b|\blid\b| regulatory particle/i,
      absorbFb: /^proteasome$/i,
    },
    {
      key: "fold",
      name: "折叠酶与构象催化",
      nameEn: "Folding enzymes (PDI/PPIases)",
      routes: /disulfide-isomerase|protein disulfide|pdi[0-9]|p4hb|pdia|thioredoxin domain-containing|peptidyl-prolyl|peptidylprolyl|cyclophilin|fk506|fkbp|parvulin|survival motor/i,
      absorbFb: /^folding enzymes$/i,
    },
    {
      key: "autoph",
      name: "自噬与蛋白降解机器",
      nameEn: "Autophagy & degradation machinery",
      routes:
        /autophagy|\batg\d|autophag|beclin|wipi|lc3-|gabarap|map1lc3|sqstm1|\bp62\b|nbr1\b|ndp52|optn\b|tax1bp1|ambra1|ulk\d|rb1cc1|\btfeb\b|lamp[12]|lysosome|lysosomal|protease cathepsin|proppin|dram\b|tmem150|fun14|retreg|fam134|vmp1|calcoco/i,
      absorbFb: /^autophagy machinery$/i,
    },
    {
      key: "etc",
      name: "其他蛋白质稳态相关",
      nameEn: "Other proteostasis components",
    },
  ],

  // ---------- 类 11 细胞周期与肿瘤调控 ----------
  "11": [
    {
      key: "cyclin",
      name: "周期蛋白与CDK调控",
      nameEn: "Cyclins & CDK regulation",
      routes: /cyclin|\bcdk\d|cdkn[12ab]|kip\d|\bp21\b|\bp27\b|ink4|cyclin-dependent|cdc25|wee1\b|cdc14|\bcdh1\b|skp2\b|\bp107\b|\bp130\b|pocket protein|rbbp|\brb1\b|retinoblastoma|\bbtg\b|endosulfine/i,
      absorbFb: /^cyclins$|^cdk inhibitors$/i,
    },
    {
      key: "apop",
      name: "凋亡与程序性细胞死亡",
      nameEn: "Apoptosis & programmed cell death",
      routes:
        /caspase|apoptosis|programmed cell death|\bbcl-?\d|\bbcl2\b|bh3-only|\bapaf\b|\biap\b|survivin|baculoviral|\bparp\b|granzyme|death domain|\bfadd\b|\btradd\b|\bbid\b|\bbim\b|\bbad\b|\bbax\b|\bbak\b|\bbok\b|\bbmf\b|puma|noxa|\bbfl\b|mcl-?1|\bdark\b|\bdronc\b|ced-?\d|egl-1|\bhid\b|reaper|grim\b|sickle/i,
      absorbFb: /^apoptosis machinery$/i,
    },
    {
      key: "onc",
      name: "抑癌基因与原癌蛋白",
      nameEn: "Tumor suppressors & oncoproteins",
      routes:
        /tumor suppressor|oncogene|proto-oncogene|\bp53\b|\btp53\b|\bp63\b|\bp73\b|brca[12]|von hippel|\bvhl\b|menin|\bmen1\b|\bwt1\b|\bpten\b|\bnf[12]\b|\bapc\b|hamartin|tuberin|\blkb1\b|stk11\b|\bsmad[234]|\bdpc4\b|rassf|\bwtx\b|\bmts1\b|cdkn2a|hic1\b/i,
      absorbFb: /^tumor suppressors & oncoproteins$/i,
    },
    {
      key: "mito",
      name: "纺锤体检查点与有丝分裂机器",
      nameEn: "Spindle checkpoint & mitotic machinery",
      routes:
        /mad[12]|mad2l1bp|bub[123]|bubr1|bub1b|centromere|cenp-[aciklmtwpq]|mis12|knl1\b|nsl1\b|zwilch|zw10\b|\brod\b|spc24|spc25|ndc80|hecl\b|nuf2\b|dash complex|dam1\b|ask1\b|dad\d|duo1\b|hsk3\b|spc19|spc34|separase|securin|\besp1\b|smc[123]|sororin|wapl\b|shugoshin|sgo[12]|aurora|plk[1234]|polo-like|haspin|borealin|incenp|cdca[38]|spindle|kinetochore|astrin|skap\d|knstrn|mitotic|anaphase|prometaphase|metaphase|cytokinesis|midbody|centralspindlin|\bect2\b|septin|cdc20|fizzy|rad21|scc[123]|pds5|apc\d|cdc27|cdc26|condensin/i,
      absorbFb: /^other cell cycle$/i,
    },
    {
      key: "etc",
      name: "其他细胞周期调控因子",
      nameEn: "Other cell cycle regulators",
    },
  ],

  // ---------- 类 12 核酸代谢与加工 ----------
  "12": [
    {
      key: "rep",
      name: "DNA复制机器",
      nameEn: "DNA replication machinery",
      routes:
        /dna polymerase|minichromosome|\bmcm[2-9]|replication|pcna|\brpa[1-3]\b|\brfa\b|geminin|cdc45|dna2\b|ctc1\b|stn1\b|telomerase|\btert\b|trf\d|\bot1\b|\btpp1\b|tinf2|rif1\b|origin recognition|orc[1-6]|gins\b|psf\d|clamp loader|rfc\b|pri[ab]\b|primase|pol12|ssb\b|rfa\d|activator 1|mcm family/i,
      absorbFb: /^dna replication$/i,
    },
    {
      key: "repair",
      name: "DNA修复与重组",
      nameEn: "DNA repair & recombination",
      routes:
        /repair|recombination|rad[0-9]|brca[12]|mismatch|mut[sl]|excision|xpg\b|xpa\b|ercc[1-5]|photolyase|glycosylase|alkb\b|alkbh|fanconi|fanc[a-z]|bloom|\bwrn\b|recq|xrcc\d|\bape1\b|rev\d|umuc|din[bp]|nucleotide excision|base excision|double-strand break|homologous recombination|strand break|meiob|spo11|mre11|rad50|nbs1\b|nibrin|xrs2|ctip|parp|artd|xpc\b|csb\b|rad23|hr23|translesion|ruvb|nth\/muty|fpg\b|xpf\b|gadd45/i,
      absorbFb: /^dna repair$/i,
    },
    {
      key: "heli",
      name: "解旋酶与拓扑异构酶",
      nameEn: "Helicases & topoisomerases",
      routes: /helicase|topoisomerase|gyrase|dead-box|ddx\d|rec[abfq]|dhh1|rhl\b|senataxin|brr2|supv3|ski2|mtr4|topo[123]|reverse gyrase|dna2/i,
      absorbFb: /^dead-box helicases$|^other helicases$/i,
    },
    {
      key: "splice",
      name: "剪接体与RNA加工修饰",
      nameEn: "Spliceosome & RNA processing/modification",
      routes:
        /spliceosome|snrnp|splice|prp[0-9]|sm protein|\blsm\b|snu\b|polyadenyl|poly\(a\)|cpsf|cstf|cfi\b|cfii|symplekin|clp1\b|rnps1|sf[23]b|sf3[ab]|\bu1\b|\bu2\b|\bu4\b|\bu5\b|\bu6\b|bud\d|brr\d|snu66|snw1|ncrna|snornp|snord|snora|dyskerin|nolc1|fibrillarin|nop\d|nop56|nop58|snu13|gar1\b|nhp2\b|nap57|cca-adding|trna processing|rnase p|\bmrp\b|pop[1-7]|rpp\d|editosome|apobec|adat\d|inosine|pseudo?uridyl|pus\d|dkc1|3' end|3' processing|cleavage factor|rna editing|cap-binding|cbc\b|nucleolin|la-related|larp\d|ro60\b|ssb\/la|integrator|splicing factor|cwc\d+|cwf\d+|esrp|slu7|luc7|muscleblind|mago nashi|crooked-neck|nxf[123]?|khdrbs|fmr1|ssrp1|srsf|tra2|prpf\d+|bud13|syf2|sac3|mt-a70|m6a|rna methyl|wybutosine|thiolation|qtrt|tfp11|stip\b|ncbp/i,
      absorbFb: /^spliceosome$/i,
    },
    {
      key: "rnap",
      name: "RNA结合蛋白",
      nameEn: "RNA-binding proteins",
      routes:
        /rrm\b|kh domain|rna-binding|rna binding|pumilio|hnrnp|la-related|musashi|imp\d|igf2bp|zbp1\b|staufen|daz\b|dazl|boule|nanos|pum\d|squid|\belav\b|\bhur\b|g3bp|tia1\b|au-rich|conserved rnp|rnp\d|rbp\d|celf\b|cugbp|mbnl\d|ptbp\d|roquin|regnase|zfp36|tristetraprolin|pabpn|pabpc|single-stranded|\bssb\b|\bcup\b|bruno|\bppr\b|pentatricopeptide|hnRNP|STAR\b|sam68|gems\b|smn\b|argonaute|piwi|dicer|rna-dependent|rna silencing|khdc1|zc3h|lin-?28|pur dna-binding|gr-rbp|glycine-rich|ifit/i,
      absorbFb: /^rna-binding proteins$/i,
    },
    {
      key: "nuc",
      name: "核酸酶",
      nameEn: "Nucleases",
      routes: /nuclease|ribonuclease|\brnase\b|deoxyribonuclease|\bdnase\b|rnt1|dis3|rrp\d|exo[gs]c|pan2|pan3|caf1\b|ccr4\b|not\d|xrn[12]|rai1|dom3z|\bdxo\b|rat1\b|angiogenin/i,
      absorbFb: /^ribonucleases$/i,
    },
    {
      key: "metab",
      name: "核苷酸代谢酶",
      nameEn: "Nucleotide metabolism enzymes",
      routes:
        /nucleoside|nucleotide|thymidylate|ribonucleotide|purine|pyrimidine|dtmp|dut\b|dcd\b|\bnme\b|prs\b|aprt|hprt|xprt|\bada\b|\bpnp\b|carbamoyl|dihydroorotate|ump synthase|ctps[12]|gmps\b|imps\b|adss\b|adsl\b|atics\b|gart\b|prat|mthfd|mtrr|dhfr|dihydrofolate|thyA|\btk1\b|dtmk|duk\b|nucleoside-diphosphate|phosphoribosyltransferase|ribonucleotide reductase|orotate phosphoribosyltransferase|uracil phosphoribosyltransferase|xanthine phosphoribosyltransferase|adenine phosphoribosyltransferase|nucleotidase/i,
    },
    {
      key: "transposon",
      name: "转座子与可移动元件",
      nameEn: "Transposons & mobile genetic elements",
      routes:
        /transposase|integrase|resolvase|invertase|retrotransposon|mobile element|is\d+ element|ins[ab]\b|rep[ab] protein|reverse transcriptase|retroviral polymerase|recombinase|tdd superfamily|group ii intron|gag-pol|errantivir|copia|gypsy|plasmid|prophage|conjugat| relaxase|virb\b|tra[a-z] family/i,
    },
    {
      key: "chromosome",
      name: "染色体组织与分离",
      nameEn: "Chromosome organization & segregation",
      routes:
        /\bsmc\b|condensin|cohesin|muk[bf]|\bpar[ab]\b|chromosome segregation|smc5|spo0j|\bsoj\b/i,
    },
    {
      key: "etc",
      name: "其他核酸加工蛋白",
      nameEn: "Other nucleic acid processing",
      absorbFb: /^other nucleic acid processing$/i,
    },
  ],

  // ---------- 类 13 细胞内运输 ----------
  "13": [
    {
      key: "ves",
      name: "囊泡运输与胞吞机器",
      nameEn: "Vesicle transport & endocytosis machinery",
      routes:
        /sec[0-9]+|trapp|trs\d|trs[0-9]|vps\d|\bvps\b|cope\b|copg\b|cop[abg]|clathrin|adaptin|adapter complex|adaptor complex|epsin|endophilin|snare|syntaxin|synaptobrevin|\bsnap\b|snap-25|snapin|vamp\b|vti1|bet1|gosr|use1|yif1|yip|bos1|sft2|ergic|surf4|golph3|fcho|necap|stoned|picalm|ap180|end3|pan1|sla[12]|las17|bzz1|fnbp1|vta1|snf8|mvb12|stam|escrt|chmp|did4|sorting nexin|\bsnx\b|ob-rgrp|vdp|uso1|ede1|rint1|zw10|nibp|golim|sys1|avl9|ccdc93|dop1|rgp1|syndetin|chs[57]|mon2|ssh4|sabre|bli1|gamad|golga|tom1|entr1|entrep|vid22|ypp1|pal1|syp1|lbs5|lsb5|dynamin|drp\d|ehd\d|rab\d|\brab\b|gyp\d|\bgdi\b|rabenosyn|rufy|eho1|fyco|svap1|vamp-associated|\bvap\b|\bnsf\b|alpha-snap|gamma-snap|sec17|sec18|synaptotagmin|synaptophysin|sv2\b|secretory carrier|scamp\b|stx\b|stxbp|unc-18|munc18|slp\d|granuphilin|rabphilin|doc2\b|bloc[1-3]|blds\d|dysbindin|muted|cappuccino|hook\d|fhip|arfgap|arf1\b|arf-like|git\b| agap| asap| arfaptin| pdb1| arl1\b/i,
      absorbFb: /^vesicle transport$/i,
    },
    {
      key: "nuc",
      name: "核孔与核质运输",
      nameEn: "Nuclear pore & nucleocytoplasmic transport",
      routes:
        /nup\d|nucleoporin|importin|exportin|karyopherin|\bran\b|ranbp|rangap|rcc1|npip|nuclear pore|nic family|glfg|nsp1|rangtp|tnpo|transportin|xrip|snurportin|nxf[12]|nxp\d|cse1\b|\bcas\b|pom121|aaa+\+ atpase/i,
      absorbFb: /^nuclear pore & transport$/i,
    },
    {
      key: "lip",
      name: "脂质转移与细胞器接触位点",
      nameEn: "Lipid transfer & organelle contact sites",
      routes:
        /osbp|start|stard|lipid transfer|gltp|acbp|pitp|ptdins|patellin|sec14|sfh\b|tricalbin|bridge-like|pde6d|unc-119|tocopherol|ceramide|get[1-4]|mdm\d|mmm1|ysp2|lam[26]|\bvap\b|vps13|atlastin|reep\d|reticulon|membrane contact|emc\b|protrudin|pdzd8|sip\d|star-related|stard3|mln64|metastatic lymph|cholesterol|npc2|e-syt|extended synaptotagmin|esyt\d|ceramide transfer|synaptotagmin-like| golgin| grip\b|grasp\b| golgi matrix| golgin/i,
    },
    {
      key: "etc",
      name: "其他胞内运输相关",
      nameEn: "Other intracellular transport",
    },
  ],

  // ---------- 类 14 其他功能蛋白（按物种分布分组 + 两大兜底） ----------
  // 特殊处理：未分类蛋白/其他膜蛋白为吸收兜底；具名家族按成员物种分布归组
  "14": [
    {
      key: "uncls",
      name: "未分类蛋白",
      nameEn: "Unclassified proteins",
      absorbFb: /^unclassified$/i,
    },
    {
      key: "omb",
      name: "其他膜蛋白",
      nameEn: "Other membrane proteins",
      absorbFb: /^other membrane proteins$/i,
    },
    { key: "bac", name: "细菌特异家族", nameEn: "Bacteria-specific families" },
    { key: "plant", name: "植物特异家族", nameEn: "Plant-specific families" },
    { key: "fungi", name: "真菌特异家族", nameEn: "Fungi-specific families" },
    { key: "animal", name: "动物特异家族", nameEn: "Animal-specific families" },
    { key: "cons", name: "跨物种保守家族", nameEn: "Cross-species conserved families" },
  ],
};
