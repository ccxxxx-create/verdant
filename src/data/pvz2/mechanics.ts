/**
 * PvZ2 权威机制参考（只读·唯一事实源）。
 *
 * 来源：plantsvszombies.wiki.gg（Plants vs. Zombies Wiki，CC BY-SA 4.0）
 * 版本基准：PvZ2 v13.5.1（各页最后编辑 2026-09 ~ 2026-10）
 * 抓取日期：2026-10-14
 * 涉及页面：Plants_(PvZ2)、Peashooter_(PvZ2)、Zombies_(PvZ2)、Basic_Zombie_(PvZ2)、
 *           Plant_Food、Seed_slot、Sun
 *
 * 纪律：
 * - 本文件只放**已查证**的值；查不到的显式登记在 `PVZ2_UNVERIFIED`，不得凭记忆补全。
 * - archetype 与 balance.ts 的取值必须能回溯到本文件（防再次漂移）。
 * - 中文版与国际版存在差异时，两个值都记，并标注默认采用哪一个。
 */

export const PVZ2_SOURCE = {
  site: 'plantsvszombies.wiki.gg',
  version: 'PvZ2 v13.5.1',
  retrievedAt: '2026-10-14',
  license: 'CC BY-SA 4.0',
} as const;

/**
 * 僵尸速度分档：走完 1 格所需秒数（越小越快）。
 * 换算到本仓：speed(格/秒) = 1 / 秒每格。
 */
export const SPEED_TIERS_S_PER_TILE = {
  creeper: 7.5,
  stiff: 6.75,
  basic: 5.0,
  hungry: 3.75,
  speedy: 2.5,
  flighty: 0.5,
} as const;
export type SpeedTier = keyof typeof SPEED_TIERS_S_PER_TILE;

/** 僵尸强度分档：可吸收伤害区间（闭区间，最后一档无上界）。 */
export const TOUGHNESS_TIERS = [
  { tier: 'fragile', min: 1, max: 100 },
  { tier: 'average', min: 101, max: 200 },
  { tier: 'solid', min: 201, max: 320 },
  { tier: 'protected', min: 321, max: 600 },
  { tier: 'dense', min: 601, max: 1000 },
  { tier: 'hardened', min: 1001, max: 1700 },
  { tier: 'machined', min: 1701, max: 2500 },
  { tier: 'great', min: 2501, max: 8000 },
  { tier: 'undying', min: 8001, max: 29500 },
  { tier: 'ultraUndying', min: 29501, max: Number.POSITIVE_INFINITY },
] as const;
export type ToughnessTier = (typeof TOUGHNESS_TIERS)[number]['tier'];

/**
 * 阳光面值与关键口径。
 * 注意：PvZ2 的普通阳光是 **50**（PvZ1 为 25），天空自然阳光与向日葵单次产出都是 50。
 */
export const SUN = {
  tiny: 5,
  small: 25,
  normal: 50,
  large: 75,
  startingSun: 50,
  /** 国际版上限（中文版 33,464）。 */
  cap: 9900,
} as const;

/**
 * 种子槽（局前选卡上限）。
 * PvZ2：基础 8 个，第 8 个需进度解锁 / 真钱购买 / 650 金币租一关；中文版可到 9 个。
 */
export const SEED_SLOTS = {
  base: 8,
  chinaMax: 9,
} as const;

/**
 * 僵尸啃食 dps。
 * PvZ2 基准 **100**（与 PvZ1 相同）；个别僵尸被强化到 150 / 200。
 * 依据：多个僵尸条目的平衡性改动记载"啃食 DPS 从 100 提升至 150/200"。
 */
export const BITE_DPS = {
  base: 100,
  pharaoh: 150,
  heavy: 200,
} as const;

/** Plant Food（能量豆 / 叶绿素）规则。 */
export const PLANT_FOOD = {
  capBase: 3,
  capWithAncientEgyptUpgrade: 4,
  capWithIap: 5,
  /** 效果持续时长逐植物不同（示例值，秒）。 */
  durationSExamples: {
    peashooter: 3,
    spikeweed: 4.5,
    icebergLettuce: 10,
    stunion: 18,
  },
  /** 即时充能：把养料拖到冷却中的种子包可立即刷新（解锁：狂野西部 Day 20）。 */
  instantRechargeUnlock: 'Wild West - Day 20',
  /** 养料不能跨关保存（无尽模式除外）。 */
  carryOverBetweenLevels: false,
  /** 被强化的植物发光期间暂时无敌且免疫铲子。 */
  empoweredInvulnerable: true,
} as const;

/** 关卡结构（社区口径）。 */
export const LEVEL_STRUCTURE = {
  /** 每关旗数（flag）取 1~3。 */
  flagsPerLevel: [1, 2, 3] as const,
  /** 单关时长（分钟）。 */
  durationMinutes: { min: 1, max: 2 },
  worlds: 11,
  levels: 317,
} as const;

/**
 * 待查证项：wiki 未给出、需另找数据源。
 * 在 docs/PLAN-PVZ2-ALIGN.md 挂账，查证后回填本文件。
 */
export const PVZ2_UNVERIFIED = [
  '波次间隔秒数与大波（Final Wave）强度倍率：wiki 未给出 PvZ2 独立值（当前 18s 由"5 波 / 1~2 分钟"反推）',
  '僵尸等级 / 阶级（Level / Tier）的动态缩放公式：wiki 未给出',
  '向日葵 / 双胞向日葵的精确产出周期秒数：wiki 未给出',
  '天空自然阳光在 PvZ2 的精确刷新秒数：wiki 仅有初代通用的"约 10 秒"描述',
  'Plant Food 掉落概率与大波是否必掉：wiki 未给出（仅知 Ancient Egypt Day 1 每波携带 1x Plant Food）',
  '强度 10 档 / 速度 6 档的边界值未逐项标注来源页与章节（值本身来自 Zombies_(PvZ2) 的速率表）',
  '护甲加值阶梯（PVZ2_ARMOR_LADDER 的 8 项）未逐项标注来源页',
  '关卡结构统计（11 世界 / 317 关）为社区口径，未核对官方',
  'PLANT_FOOD.durationSExamples 为逐植物摘录的示例值，未覆盖全植物',
  '除豌豆射手外，其余植物的 HP / 伤害 / 攻击间隔尚未逐页查证',
] as const;

/** 按伤害反查强度分档。 */
export function toughnessTierOf(hp: number): ToughnessTier {
  for (const t of TOUGHNESS_TIERS) {
    if (hp >= t.min && hp <= t.max) return t.tier;
  }
  return 'fragile';
}

/** 按"秒每格"反查速度分档（取最接近的一档）。 */
export function speedTierOf(secondsPerTile: number): SpeedTier {
  let best: SpeedTier = 'basic';
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const [tier, sec] of Object.entries(SPEED_TIERS_S_PER_TILE) as [SpeedTier, number][]) {
    const diff = Math.abs(sec - secondsPerTile);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = tier;
    }
  }
  return best;
}
