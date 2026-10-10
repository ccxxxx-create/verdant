/**
 * M2 经济数值表（用户第 13 轮拍板：金币/钻石 + 种子券 + 能量豆；4 赠送 + 6 金币购 + 3 钻石购）。
 * 口径说明：金币=软货币（通关/重打/成就）；钻石=稀有（首三星/成就）；种子=抽奖券；
 * 能量豆=世界能量大招货币（M3 大招落地前只入账不消耗）。
 * 数值来源=自有配平（PvZ2 经济结构参考见 docs/RESEARCH-PVZ.md，非官方数据）。
 */

export type UnitChannel = 'gift' | 'coins' | 'diamonds';

export interface UnitAcquisition {
  channel: UnitChannel;
  /** coins/diamonds 渠道的价格；gift 渠道无价格 */
  price?: number;
  note: string;
}

/** 13 首发角色获取渠道（4 赠送 + 6 金币购 + 3 钻石购）。 */
export const UNIT_ACQUISITION: Record<string, UnitAcquisition> = {
  firefly_reed: { channel: 'gift', note: '初始赠送' },
  thorn_pea: { channel: 'gift', note: '初始赠送' },
  wood_core: { channel: 'gift', note: '通关 1-2 赠送' },
  frost_pea: { channel: 'gift', note: '通关 1-3 赠送' },
  drum_cap: { channel: 'coins', price: 500, note: '廉价清群手段' },
  trifold_arrow: { channel: 'coins', price: 750, note: '三连发破壳' },
  nectar_moss: { channel: 'coins', price: 800, note: '攻速光环' },
  ember_fluff: { channel: 'coins', price: 900, note: '火系点燃' },
  lob_shroom: { channel: 'coins', price: 1000, note: '抛射越障' },
  storm_cap: { channel: 'coins', price: 1200, note: '范围落雷' },
  twin_glow: { channel: 'diamonds', price: 5, note: '双灯产能翻倍' },
  tether_moss: { channel: 'diamonds', price: 6, note: '藤索定身（M3 实装）' },
  mist_lamp: { channel: 'diamonds', price: 8, note: '驱散遮挡（M3 实装）' },
};

/** 关卡首通金币奖励（按星级梯度）。 */
export const LEVEL_STAR_REWARDS: Record<1 | 2 | 3, number> = { 1: 20, 2: 40, 3: 60 };

/** 重打（已通关）奖励系数：首通的 50%，向下取整。 */
export const REPLAY_FACTOR = 0.5;

/** 首次三星额外钻石。 */
export const FIRST_THREE_STAR_DIAMONDS = 2;

/** 每次通关固定能量豆。 */
export const PLANT_FOOD_PER_CLEAR = 1;

/** 星星里程碑送种子券（首破该档时发一次）。 */
export const STAR_MILESTONES: readonly { stars: number; seeds: number }[] = [
  { stars: 10, seeds: 1 },
  { stars: 20, seeds: 2 },
  { stars: 30, seeds: 3 },
];

/** 成就：首次击败 Boss 的钻石/种子奖励（M3 Boss 关接入）。 */
export const BOSS_FIRST_KILL_REWARD = { diamonds: 5, seeds: 2 };

/** 重复角色折算金币（抽奖/赠送重复时）。 */
export const DUPLICATE_UNIT_COINS = 250;

/** 商店刷新概念暂不做；角色固定价（PvZ2 商店同结构）。 */
export const SHOP_CURRENCY_LABEL: Record<'coins' | 'diamonds', string> = { coins: '金币', diamonds: '钻石' };
