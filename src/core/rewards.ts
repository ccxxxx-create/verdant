import type { LevelDef } from './schema/level.ts';
import {
  FIRST_THREE_STAR_DIAMONDS,
  LEVEL_STAR_REWARDS,
  PLANT_FOOD_PER_CLEAR,
  REPLAY_FACTOR,
  STAR_MILESTONES,
} from '../data/economy.ts';

export interface LevelReward {
  coins: number;
  diamonds: number;
  seeds: number;
  plantFood: number;
}

export interface RewardInput {
  level: LevelDef;
  stars: 1 | 2 | 3;
  /** 该关历史最佳星数（null=首通） */
  previousStars: number | null;
  /** 里程碑发放前的累计星数 */
  totalStarsBefore: number;
}

/** 星星里程碑（累计星数跨越档位时发种子券）。 */
export function milestoneSeeds(totalStarsBefore: number, totalStarsAfter: number): number {
  let seeds = 0;
  for (const m of STAR_MILESTONES) {
    if (totalStarsBefore < m.stars && totalStarsAfter >= m.stars) seeds += m.seeds;
  }
  return seeds;
}

/**
 * 关卡通关奖励（M2 经济闭环）：
 * - 金币按星级 20/40/60；重打取 50% 向下取整
 * - 首通三星 +2 钻石；每次通关 +1 能量豆
 * - 种子券只来自星星里程碑（不重复发）
 */
export function levelClearReward(input: RewardInput): LevelReward {
  const { level, stars, previousStars, totalStarsBefore } = input;
  const isReplay = previousStars !== null && previousStars >= stars;
  const base = LEVEL_STAR_REWARDS[stars];
  const coins = isReplay ? Math.floor(base * REPLAY_FACTOR) : base;
  const firstThreeStar = previousStars !== 3 && stars === 3;
  const diamonds = firstThreeStar ? FIRST_THREE_STAR_DIAMONDS : 0;
  const totalStarsAfter = totalStarsBefore - (previousStars ?? 0) + stars;
  const seeds = milestoneSeeds(totalStarsBefore, totalStarsAfter);
  return { coins, diamonds, seeds, plantFood: PLANT_FOOD_PER_CLEAR, ...(level ? {} : {}) };
}

/** 商店购买价校验：角色渠道与库存（返回购买是否合法）。 */
export function canAfford(wallet: { coins: number; diamonds: number }, channel: 'coins' | 'diamonds', price: number): boolean {
  if (channel === 'coins') return wallet.coins >= price;
  return wallet.diamonds >= price;
}
