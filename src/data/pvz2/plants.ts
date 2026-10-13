/**
 * PvZ2 植物权威参考表（只读）。
 * 来源：plantsvszombies.wiki.gg — `Plants_(PvZ2)`（花费/充能表）与各植物独立条目页（HP/伤害）。
 * 版本基准：PvZ2 v13.5.1；抓取日期 2026-10-14。数值均为 **Level 1**。
 *
 * 注意：PvZ2 的充能（recharge）与 PvZ1 不同——豌豆/向日葵等多为 **5 秒**（PvZ1 为 7.5 秒）。
 */

export interface Pvz2PlantRef {
  /** PvZ2 内部名（小驼峰）。 */
  id: string;
  nameZh: string;
  /** 阳光花费（Lv1）。 */
  cost: number;
  /** 充能秒数（Lv1）。 */
  rechargeS: number;
  /** 韧性 / 生命值（Lv1，仅逐植物页给出时填）。 */
  hp?: number;
  /** 单发伤害（Lv1）。 */
  damage?: number;
  /** 攻击间隔（ms，Lv1）。 */
  intervalMs?: number;
  /** 参考 DPS（Lv1）。 */
  dps?: number;
  /** Plant Food 效果描述。 */
  plantFood: string;
  /** 本仓承担该角色的单位 id；无对应为 null。 */
  repoUnit: string | null;
  note?: string;
}

/** 已查证的 PvZ2 植物参考表（按 PvZ2 解锁顺序）。 */
export const PVZ2_PLANTS: readonly Pvz2PlantRef[] = [
  {
    id: 'peashooter',
    nameZh: '豌豆射手',
    cost: 100,
    rechargeS: 5,
    hp: 300,
    damage: 20,
    intervalMs: 1425,
    dps: 14.035,
    plantFood: '变加特林形态，2 秒内连发 60 颗豌豆',
    repoUnit: 'thorn_pea',
    note: '仓库已对齐（充能 5s / cost 100 / 伤害 20 / 间隔 1.425s / HP 300）',
  },
  {
    id: 'sunflower',
    nameZh: '向日葵',
    cost: 50,
    rechargeS: 5,
    plantFood: '立即产出大量阳光',
    repoUnit: 'firefly_reed',
    note: '仓库已对齐（单次产出 50 / 充能 5s）',
  },
  {
    id: 'wallNut',
    nameZh: '坚果墙',
    cost: 50,
    rechargeS: 20,
    hp: 4000,
    plantFood: '自我治疗并获得坚硬护甲外壳',
    repoUnit: 'wood_core',
    note: '仓库已对齐（充能 20s / cost 50 / HP 4000）',
  },
  {
    id: 'potatoMine',
    nameZh: '土豆雷',
    cost: 25,
    rechargeS: 20,
    plantFood: '立即武装并生成多个自身复制',
    repoUnit: 'drum_cap',
    note: '仓库已对齐（充能 20s / cost 25）；埋地时长 12s 待与 PvZ2 武装时间核对',
  },
  {
    id: 'cabbagePult',
    nameZh: '卷心菜投手',
    cost: 100,
    rechargeS: 5,
    plantFood: '向每个僵尸投掷多个卷心菜，造成重伤害',
    repoUnit: 'lob_shroom',
    note: '仓库已对齐（cost 100 / 充能 5s）',
  },
  {
    id: 'repeater',
    nameZh: '双发射手',
    cost: 200,
    rechargeS: 5,
    plantFood: '向本行僵尸射出两轮豌豆',
    repoUnit: null,
    note: '仓库缺该单位（建议补）',
  },
  {
    id: 'snowPea',
    nameZh: '寒冰射手',
    cost: 150,
    rechargeS: 5,
    plantFood: '先冰冻整列僵尸，再射出一连串冰冻豌豆',
    repoUnit: 'frost_pea',
    note: '仓库已对齐（cost 150 / 充能 5s）',
  },
  {
    id: 'threepeater',
    nameZh: '三线射手',
    cost: 300,
    rechargeS: 5,
    plantFood: '向多个方向散射豌豆造成伤害',
    repoUnit: 'trifold_arrow',
    note: '仓库已对齐（cost 300 / 充能 5s）',
  },
  {
    id: 'cherryBomb',
    nameZh: '樱桃炸弹',
    cost: 150,
    rechargeS: 35,
    plantFood: '无 Plant Food 效果',
    repoUnit: null,
    note: '仓库缺该单位（一次性清场）',
  },
  {
    id: 'twinSunflower',
    nameZh: '双胞向日葵',
    cost: 125,
    rechargeS: 10,
    plantFood: '立即产出大量阳光',
    repoUnit: 'twin_glow',
    note: '仓库已对齐（cost 125 / 充能 10s）',
  },
  {
    id: 'bloomerang',
    nameZh: '回旋镖射手',
    cost: 175,
    rechargeS: 5,
    plantFood: '向四个方向投掷回旋镖，伤害范围内所有僵尸',
    repoUnit: null,
    note: '仓库缺该单位',
  },
  {
    id: 'icebergLettuce',
    nameZh: '冰莴苣',
    cost: 0,
    rechargeS: 20,
    plantFood: '冰冻或减速草坪上所有僵尸',
    repoUnit: null,
    note: '仓库缺该单位（0 费控制）',
  },
  {
    id: 'spikeweed',
    nameZh: '地刺',
    cost: 100,
    rechargeS: 5,
    plantFood: '将本行所有僵尸拉到自身位置并造成伤害',
    repoUnit: null,
    note: '仓库缺该单位',
  },
  {
    id: 'kernelPult',
    nameZh: '玉米投手',
    cost: 100,
    rechargeS: 5,
    plantFood: '引发黄油风暴，眩晕草坪上所有僵尸数秒',
    repoUnit: null,
    note: '仓库缺该单位',
  },
];

/** PvZ2 豌豆射手等级 1~10 成长曲线（wiki 逐级给出）。 */
export const PEASHOOTER_LEVEL_CURVE = [
  { level: 1, seeds: 0, coins: 0, cost: 100, rechargeS: 5, hp: 300, damage: 20 },
  { level: 2, seeds: 3, coins: 50, cost: 100, rechargeS: 4.5, hp: 350, damage: 25 },
  { level: 3, seeds: 10, coins: 200, cost: 100, rechargeS: 4.5, hp: 400, damage: 30 },
  { level: 4, seeds: 25, coins: 1500, cost: 100, rechargeS: 4.5, hp: 450, damage: 35 },
  { level: 5, seeds: 50, coins: 2000, cost: 75, rechargeS: 4.5, hp: 500, damage: 40 },
  { level: 6, seeds: 75, coins: 3000, cost: 75, rechargeS: 4, hp: 550, damage: 45 },
  { level: 7, seeds: 100, coins: 4000, cost: 75, rechargeS: 4, hp: 600, damage: 50 },
  { level: 8, seeds: 125, coins: 5000, cost: 75, rechargeS: 4, hp: 650, damage: 55 },
  { level: 9, seeds: 175, coins: 6000, cost: 75, rechargeS: 4, hp: 700, damage: 60 },
  { level: 10, seeds: 225, coins: 8000, cost: 75, rechargeS: 3.5, hp: 750, damage: 65 },
] as const;

/** 等级曲线的两条通式（PvZ2 豌豆射手）：伤害每级 +5、韧性每级 +50。 */
export const LEVEL_CURVE_RULES = {
  damagePerLevel: 5,
  hpPerLevel: 50,
  /** 充能只在特定等级缩短。 */
  rechargeStepLevels: [2, 6, 10],
} as const;

/** 按本仓单位 id 反查 PvZ2 参考行（无对应返回 undefined）。 */
export function pvz2PlantByRepoUnit(repoUnitId: string): Pvz2PlantRef | undefined {
  return PVZ2_PLANTS.find((p) => p.repoUnit === repoUnitId);
}

/**
 * 充能毫秒：有 PvZ2 对应则取其口径（单一事实源），否则用 fallback（本仓原创单位）。
 * 供 archetype 直接派生 `cooldownMs`，避免"声明与实现脱节"。
 */
export function pvz2RechargeMs(repoUnitId: string, fallbackMs: number): number {
  const ref = pvz2PlantByRepoUnit(repoUnitId);
  return ref ? Math.round(ref.rechargeS * 1000) : fallbackMs;
}

/** PvZ2 标准充能（无对应植物时的房屋默认值，ms）。 */
export const PVZ2_STANDARD_RECHARGE_MS = 5000;

/** 阳光花费：有 PvZ2 对应则取其口径，否则用 fallback（本仓原创单位）。 */
export function pvz2Cost(repoUnitId: string, fallback: number): number {
  const ref = pvz2PlantByRepoUnit(repoUnitId);
  return ref ? ref.cost : fallback;
}

/**
 * 逐植物 Plant Food 效果（PvZ2 口径）。
 * 注意：本仓目前只有通用"世界能量"（power.ts 的 kind 分类），
 * 逐植物效果属于**后续接线**项（见 docs/PLAN-PVZ2-ALIGN.md 挂账），本函数先提供权威文案与查表能力。
 */
export function plantFoodEffect(repoUnitId: string): string | undefined {
  return pvz2PlantByRepoUnit(repoUnitId)?.plantFood;
}

/** 该植物在 PvZ2 是否有专属 Plant Food 效果（樱桃炸弹等一次性植物为"无"）。 */
export function hasPlantFoodEffect(repoUnitId: string): boolean {
  const effect = plantFoodEffect(repoUnitId);
  return !!effect && !effect.startsWith('无');
}
