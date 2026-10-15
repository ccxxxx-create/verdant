/**
 * 本仓单位 / 敌人 ↔ PvZ2 条目映射与对齐状态（只读·差距表的代码镜像）。
 * 供 docs/PLAN-PVZ2-ALIGN.md 的差距表与 tests/pvz2Align.test.ts 防漂移闸使用。
 *
 * status 语义：
 * - aligned         仓库现值已与 PvZ2 参考一致（delta 记录"已如何对齐"）
 * - numeric-drift   口径一致但数值仍有差（delta 写清差在哪）
 * - structural-gap  缺少对应机制 / 单位（需新增）
 * - no-counterpart  PvZ2 无对应物（本仓原创，保持不动）
 *
 * 维护纪律：**状态必须反映当前代码**。改动 archetype / balance.ts 后若状态过期，视为文档缺陷。
 */

export type AlignStatus = 'aligned' | 'numeric-drift' | 'structural-gap' | 'no-counterpart';

export interface AlignRow {
  repoId: string;
  repoKind: 'unit' | 'enemy' | 'system';
  /** 对应的 PvZ2 条目 id；无对应为 null。 */
  pvz2Id: string | null;
  status: AlignStatus;
  /** 差异或对齐要点（人读）。 */
  delta: string;
}

/** 植物（本仓单位）对齐表。 */
export const UNIT_ALIGNMENT: readonly AlignRow[] = [
  { repoId: 'firefly_reed', repoKind: 'unit', pvz2Id: 'sunflower', status: 'aligned', delta: '充能 5s（派生）、单次产出 50（PvZ2 普通阳光面值）已落地（产出周期 24s：PvZ2 codex 无数字，试玩裁定+挂账）' },
  { repoId: 'twin_glow', repoKind: 'unit', pvz2Id: 'twinSunflower', status: 'aligned', delta: '充能 10s、单次产出 100（2×50）已落地（周期同上挂账）' },
  { repoId: 'thorn_pea', repoKind: 'unit', pvz2Id: 'peashooter', status: 'aligned', delta: '充能 5s、伤害 20 / 间隔 1.35s（codex 解包）/ HP 300 已落地' },
  { repoId: 'trifold_arrow', repoKind: 'unit', pvz2Id: 'threepeater', status: 'aligned', delta: '充能 5s、cost 300、伤害 20 / 间隔 1.35s 已落地；空间分布不同：codex 三线射手向三行各射 1 颗，本仓为本行三连发' },
  { repoId: 'frost_pea', repoKind: 'unit', pvz2Id: 'snowPea', status: 'aligned', delta: 'cost 150、充能 5s、伤害 20 / 间隔 1.35s 已落地（codex 该条为 pvz2cn 代际）' },
  { repoId: 'wood_core', repoKind: 'unit', pvz2Id: 'wallNut', status: 'aligned', delta: '充能 20s、cost 50 / HP 4000 已落地' },
  { repoId: 'drum_cap', repoKind: 'unit', pvz2Id: 'potatoMine', status: 'aligned', delta: '充能 20s、cost 25、武装 14s（codex armingTime）已落地；伤害 400 自拟（codex 1800 为秒杀雷口径，本作为溅射触发）' },
  { repoId: 'lob_shroom', repoKind: 'unit', pvz2Id: 'cabbagePult', status: 'aligned', delta: 'cost 100、充能 5s、伤害 40 已落地；间隔 2900ms 补缺 PvZ1（PvZ2 codex 无射速）' },
  { repoId: 'ember_fluff', repoKind: 'unit', pvz2Id: 'firePeashooter', status: 'aligned', delta: 'PvZ2 火焰豌豆全对齐：cost 175 / 充能 5s / 伤害 40 / 间隔 1.35s（codex 解包）' },
  { repoId: 'storm_cap', repoKind: 'unit', pvz2Id: 'lightningReed', status: 'no-counterpart', delta: '机制不同（PvZ2 芦苇=多目标电弧 10 伤，本仓=3×3 落雷 AOE）：45 伤/2500ms/300 阳光为参照芦苇强度自拟，已登记' },
  { repoId: 'tether_moss', repoKind: 'unit', pvz2Id: 'tangleKelp', status: 'no-counterpart', delta: '机制不同（PvZ2 水草=水体绑杀秒杀 400，Stunion=一次性触发）：定身 4s / 175 阳光自拟，已登记' },
  { repoId: 'nectar_moss', repoKind: 'unit', pvz2Id: null, status: 'no-counterpart', delta: '两代均无攻速光环植物：20% / 100 阳光自拟，已登记' },
  { repoId: 'mist_lamp', repoKind: 'unit', pvz2Id: 'plantern', status: 'no-counterpart', delta: '机制不同（PvZ2 路灯花=驱雾显形 75/10s，本仓=反 cover）：25 阳光 / 15s 充能自拟，已登记' },
  { repoId: 'dandelion', repoKind: 'unit', pvz2Id: 'dandelion', status: 'aligned', delta: 'PvZ2 蒲公英精确同名全对齐：cost 275 / 充能 15s / 伤害 50 / 间隔 1.9s（codex 解包）' },
];

/** 敌人对齐表。 */
export const ENEMY_ALIGNMENT: readonly AlignRow[] = [
  { repoId: 'march_ant', repoKind: 'enemy', pvz2Id: 'basic', status: 'aligned', delta: 'HP 190（PvZ2 Average 档）、啃食 100 dps、速度 0.185 格/s ≈5.41s/格（PvZ2 codex 解包）已落地' },
  { repoId: 'iron_beak_sparrow', repoKind: 'enemy', pvz2Id: 'seagull', status: 'aligned', delta: 'HP 270 + 速度 0.355 格/s（PvZ2 海鸥，codex 解包）已落地；飞行机制为仓内原创' },
  { repoId: 'gnaw_back_rat', repoKind: 'enemy', pvz2Id: 'basic', status: 'no-counterpart', delta: '机制不同（PvZ2 无此行为）：本仓原创"路过啃生产位"；HP 190/速度 0.185 按 PvZ2 basic 档（codex 参照）' },
  { repoId: 'grey_tide_swarm', repoKind: 'enemy', pvz2Id: 'chicken', status: 'no-counterpart', delta: '机制不同（codex 鸡 HP=1/2.0 格/s 过速）：群体 HP 100/速度 0.6 折中自拟，已登记' },
  { repoId: 'vine_boa', repoKind: 'enemy', pvz2Id: 'conehead', status: 'no-counterpart', delta: '机制不同（免减速两代均无）：HP 560/速度 0.185 按 PvZ2 路障档（codex 参照），减速免疫为自拟' },
  { repoId: 'web_spider', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创吐网定植物机制（两代均无）；HP 350/速度 0.18 自拟，已登记' },
  { repoId: 'shell_raiser', repoKind: 'enemy', pvz2Id: 'conehead', status: 'structural-gap', delta: 'HP 560 + 速度 0.185 已按路障档（codex）；但 PvZ2 是"层叠护甲"，仓库用 armor 档位减伤系数，结构仍不同' },
  { repoId: 'vine_gnawer', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创"专挑攻击单位"机制；HP 490/速度 0.185（Protected 档同速 basic，codex 参照）' },
  { repoId: 'lightdew_moth', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创偷露珠机制；HP 270（Solid 档）、速度 0.22 自拟（无 codex 对应条目）' },
  { repoId: 'stone_hide_beast', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创铁甲火抗单位；HP 1290（Hardened 档 ≈ 铁桶）' },
  { repoId: 'stone_hide_giant', repoKind: 'enemy', pvz2Id: 'gargantuar', status: 'structural-gap', delta: 'HP 3600 + 速度 0.24 已按 Gargantuar 档（codex）；但 PvZ2 的 Gargantuar 非 Boss，真 Boss 是 Zombot（18500~54000），本仓尚未拆分' },
];

/** 系统级对齐表（机制骨架）。 */
export const SYSTEM_ALIGNMENT: readonly AlignRow[] = [
  { repoId: 'unitCooldown', repoKind: 'system', pvz2Id: null, status: 'aligned', delta: '充能 5s 系已由参考层派生（坚果/土豆雷 20s、双胞葵 10s）' },
  { repoId: 'biteDps', repoKind: 'system', pvz2Id: null, status: 'aligned', delta: '啃食统一走 enemyBiteDps() 单一入口，基准 100（PvZ2 口径），archetype 不再各写小数值' },
  { repoId: 'toughnessTier', repoKind: 'system', pvz2Id: null, status: 'aligned', delta: '10 档强度分档已建模（TOUGHNESS_TIERS + toughnessTierOf）' },
  { repoId: 'speedTier', repoKind: 'system', pvz2Id: null, status: 'aligned', delta: '6 档速度分档已建模（SPEED_TIERS_S_PER_TILE + speedTierOf）' },
  { repoId: 'seedSlots', repoKind: 'system', pvz2Id: null, status: 'aligned', delta: 'DECK_CAP=8（= PvZ2 基础种子槽）已收敛为 balance.ts 单一事实源' },
  { repoId: 'sunValue', repoKind: 'system', pvz2Id: null, status: 'aligned', delta: '阳光面值 50（天空掉落与向日葵单次产出同值）已落地' },
  { repoId: 'skySunInterval', repoKind: 'system', pvz2Id: null, status: 'numeric-drift', delta: '掉落间隔仍为 PvZ1 口径 4.25~7s；PvZ2 精确值待查证（wiki 未给）' },
  { repoId: 'wavePacing', repoKind: 'system', pvz2Id: null, status: 'numeric-drift', delta: '首波 2s 与 5 波/关已按 PvZ2 落地；但波间隔 18s+rand(0~5s) 是由"5 波 / 1~2 分钟"反推，PvZ2 官方值待查证' },
  { repoId: 'plantFood', repoKind: 'system', pvz2Id: null, status: 'aligned', delta: '能量豆上限 3（PvZ2 基础值）已落地' },
  { repoId: 'plantLeveling', repoKind: 'system', pvz2Id: null, status: 'numeric-drift', delta: '等级 1~10 曲线已建模并与 PvZ2 豌豆射手逐级表一致；但尚未接入局外成长（无 UI / 无存档字段）' },
  { repoId: 'plantFoodPerPlant', repoKind: 'system', pvz2Id: null, status: 'structural-gap', delta: '逐植物 Plant Food 文案与查表已备（plants.ts），但未接线到战斗（现仅通用"世界能量"）' },
  { repoId: 'levelLength', repoKind: 'system', pvz2Id: null, status: 'aligned', delta: '单关时长 7~15 分钟 → 2.9~3.7 分钟（8 seeds 扫荡），已进入 PvZ2 量级' },
  { repoId: 'levelFlags', repoKind: 'system', pvz2Id: null, status: 'aligned', delta: '6 关由 10~20 波改为 5 波（= PvZ2 1 面旗）' },
];

export const ALL_ALIGNMENT: readonly AlignRow[] = [...UNIT_ALIGNMENT, ...ENEMY_ALIGNMENT, ...SYSTEM_ALIGNMENT];

/** 差距统计（供文档与测试引用）。 */
export function alignmentSummary(): Record<AlignStatus, number> {
  const out: Record<AlignStatus, number> = { aligned: 0, 'numeric-drift': 0, 'structural-gap': 0, 'no-counterpart': 0 };
  for (const row of ALL_ALIGNMENT) out[row.status] += 1;
  return out;
}
