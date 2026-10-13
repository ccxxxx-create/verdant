/**
 * PvZ2 僵尸权威参考表（只读）。
 * 来源：plantsvszombies.wiki.gg — `Zombies_(PvZ2)`（全表 HP）、`Basic_Zombie_(PvZ2)`（普通僵尸口径）。
 * 版本基准：PvZ2 v13.5.1；抓取日期 2026-10-14。
 *
 * 关键口径（本轮查证结论）：
 * - 普通僵尸（Basic）：国际版现行 **HP 190**（Update 6.3.1 由 270 下调为 190，掉臂阈值 95）；
 *   中文版仍为 **270**（掉臂阈值 135）。速度分档 Basic（5.0 秒/格），强度分档 Average。
 * - 护甲是"叠加"的：Conehead = 370 路障 + 190 本体 = 560；Buckethead = 1100 铁桶 + 190 = 1290。
 */

import { BITE_DPS, type SpeedTier, type ToughnessTier } from './mechanics.ts';

export interface Pvz2ZombieRef {
  id: string;
  nameZh: string;
  /** 总可吸收伤害（含护甲）。 */
  hp: number;
  /** 护甲构成（本体之外的加值）。 */
  armor?: { kind: string; amount: number }[];
  toughness: ToughnessTier;
  speed: SpeedTier;
  /** 本仓承担该角色的敌人 id；无对应为 null。 */
  repoEnemy: string | null;
  note?: string;
}

/** 基准与护甲阶梯（Player's House，PvZ2 最基础一组）。 */
export const PVZ2_ZOMBIES: readonly Pvz2ZombieRef[] = [
  {
    id: 'basic',
    nameZh: '普通僵尸',
    hp: 190,
    toughness: 'average',
    speed: 'basic',
    repoEnemy: 'march_ant',
    note: '国际版现行 190（6.3.1 前为 270）；中文版 270。仓库行蚁为 45',
  },
  {
    id: 'flag',
    nameZh: '旗帜僵尸',
    hp: 190,
    toughness: 'average',
    speed: 'basic',
    repoEnemy: null,
    note: '仓库以横幅文本代替旗手单位',
  },
  {
    id: 'conehead',
    nameZh: '路障僵尸',
    hp: 560,
    armor: [{ kind: 'cone', amount: 370 }],
    toughness: 'protected',
    speed: 'basic',
    repoEnemy: null,
    note: '仓库护甲以 armor 档位（cloth/hide/shell/iron）表达，非层叠护甲',
  },
  {
    id: 'buckethead',
    nameZh: '铁桶僵尸',
    hp: 1290,
    armor: [{ kind: 'bucket', amount: 1100 }],
    toughness: 'hardened',
    speed: 'basic',
    repoEnemy: null,
  },
  {
    id: 'gargantuar',
    nameZh: '巨人僵尸',
    hp: 3600,
    toughness: 'great',
    speed: 'creeper',
    repoEnemy: 'stone_hide_giant',
    note: '仓库石皮巨兽 hp 4000（Boss）；PvZ2 Gargantuar 为 3600 且非 Boss',
  },
  {
    id: 'zombotPlayerHouse',
    nameZh: '僵王（各世界 Boss）',
    hp: 18500,
    toughness: 'undying',
    speed: 'creeper',
    repoEnemy: 'stone_hide_giant',
    note: '各世界 Zombot 区间 13000~54000（分阶段护甲）',
  },
];

/** 护甲加值阶梯（PvZ2 常用头部护具）。 */
export const PVZ2_ARMOR_LADDER = {
  cone: 370,
  bucket: 1100,
  blockhead: 1600,
  knight: 1600,
  pyramidHead: 2200,
  amberhead: 2200,
  fossilhead: 1800,
  centurion: 1950,
} as const;

/** 啃食基准（PvZ2 = 100 dps，与 PvZ1 同；个别僵尸强化到 150/200）。 */
export const PVZ2_BITE_DPS = BITE_DPS;

/** 世界维度（PvZ2 11 世界，仅列出与本仓四世界可能对应的强度区间）。 */
export const PVZ2_WORLD_RAMP = [
  { world: 'Player\'s House', basicHp: 190, note: '教学' },
  { world: 'Ancient Egypt', basicHp: 190, note: '首个正式世界' },
  { world: 'Modern Day', basicHp: 190, note: '末世界（本体强度不变，靠变体与数量加压）' },
] as const;
