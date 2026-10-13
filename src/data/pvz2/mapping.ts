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
  { repoId: 'firefly_reed', repoKind: 'unit', pvz2Id: 'sunflower', status: 'aligned', delta: '充能 5s（派生）、单次产出 50（PvZ2 普通阳光面值）已落地' },
  { repoId: 'twin_glow', repoKind: 'unit', pvz2Id: 'twinSunflower', status: 'aligned', delta: '充能 10s、单次产出 100（2×50）已落地' },
  { repoId: 'thorn_pea', repoKind: 'unit', pvz2Id: 'peashooter', status: 'aligned', delta: '充能 5s、伤害 20 / 间隔 1.425s / HP 300 已落地' },
  { repoId: 'trifold_arrow', repoKind: 'unit', pvz2Id: 'threepeater', status: 'aligned', delta: '充能 5s、cost 300 已落地' },
  { repoId: 'frost_pea', repoKind: 'unit', pvz2Id: 'snowPea', status: 'aligned', delta: 'cost 150、充能 5s 已落地' },
  { repoId: 'wood_core', repoKind: 'unit', pvz2Id: 'wallNut', status: 'aligned', delta: '充能 20s、cost 50 / HP 4000 已落地' },
  { repoId: 'drum_cap', repoKind: 'unit', pvz2Id: 'potatoMine', status: 'aligned', delta: '充能 20s、cost 25 已落地（埋地时长 12s 待与 PvZ2 核对）' },
  { repoId: 'lob_shroom', repoKind: 'unit', pvz2Id: 'cabbagePult', status: 'aligned', delta: 'cost 100、充能 5s 已落地' },
  { repoId: 'ember_fluff', repoKind: 'unit', pvz2Id: null, status: 'no-counterpart', delta: 'PvZ2 火系豌豆（Fire Peashooter）数值待查证；充能取 PvZ2 标准 5s' },
  { repoId: 'storm_cap', repoKind: 'unit', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创 AOE 单位；充能取 PvZ2 标准 5s' },
  { repoId: 'tether_moss', repoKind: 'unit', pvz2Id: null, status: 'no-counterpart', delta: '近似 Stunion 但机制不同；充能取 PvZ2 标准 5s' },
  { repoId: 'nectar_moss', repoKind: 'unit', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创光环单位；充能取 PvZ2 标准 5s' },
  { repoId: 'mist_lamp', repoKind: 'unit', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创反遮挡单位；充能保留原值 15s' },
];

/** 敌人对齐表。 */
export const ENEMY_ALIGNMENT: readonly AlignRow[] = [
  { repoId: 'march_ant', repoKind: 'enemy', pvz2Id: 'basic', status: 'aligned', delta: 'HP 190（PvZ2 Average 档）、啃食 100 dps、速度 4.76s/格 ≈ Basic 已落地' },
  { repoId: 'iron_beak_sparrow', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: 'HP 270（Solid 档）为档位映射；PvZ2 飞行僵尸非一一对应' },
  { repoId: 'gnaw_back_rat', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创"路过啃生产位"机制；HP 190（Average 档）' },
  { repoId: 'grey_tide_swarm', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创群怪（4 身体 1 次出怪）；HP 100（Fragile 档）' },
  { repoId: 'vine_boa', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创免减速单位；HP 560（Protected 档）' },
  { repoId: 'web_spider', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '近似 PvZ2 控制型僵尸；HP 350（Protected 档下沿）' },
  { repoId: 'shell_raiser', repoKind: 'enemy', pvz2Id: 'conehead', status: 'structural-gap', delta: 'HP 560 已按路障档（370+190）；但 PvZ2 是"层叠护甲"，仓库用 armor 档位减伤系数，结构仍不同' },
  { repoId: 'vine_gnawer', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创"专挑攻击单位"机制；HP 490（Protected 档下沿）' },
  { repoId: 'lightdew_moth', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创偷露珠单位；HP 270（Solid 档）' },
  { repoId: 'stone_hide_beast', repoKind: 'enemy', pvz2Id: null, status: 'no-counterpart', delta: '本仓原创铁甲火抗单位；HP 1290（Hardened 档 ≈ 铁桶）' },
  { repoId: 'stone_hide_giant', repoKind: 'enemy', pvz2Id: 'gargantuar', status: 'structural-gap', delta: 'HP 3600 已按 Gargantuar 档；但 PvZ2 的 Gargantuar 非 Boss，真 Boss 是 Zombot（18500~54000），本仓尚未拆分' },
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
