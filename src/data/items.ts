/**
 * 道具表（M-INV 背包系统）。
 *
 * 口径（用户拍板）：本轮做到「框架 + 少量可用道具」——4 个真实道具，可查看、可使用；
 * 使用方式为**出战前携带 1 个，开局自动生效**（只改战斗初始状态，不新增 sim 命令）。
 *
 * 设计纪律：
 * - 品质（rarity）为本文件新引入概念；**不给 UnitArchetype 加字段**（其为 strictObject，加字段会破坏既有 schema 测试）。
 * - 效果（effect）用可辨识联合表达"生效层"，避免在场景里写散落 if：
 *   · bonusLightdew / bonusPlantFood / mowerWard → 由 createBattle 写入初始状态
 *   · clearBonus                              → 由 rewards.levelClearReward 在结算层应用
 * - 定价不在此处（见 data/economy.ts 的 ITEM_ACQUISITION），与 UNIT_ACQUISITION 同惯例。
 * - 图标键名对应 data/pixels/icons.ts 的 pixelIcons；ensurePixelTextures 会自动烘焙为 `icon_<key>`。
 */

export type ItemRarity = 'common' | 'rare' | 'legendary';

/** 道具效果：可辨识联合，t 为生效层判别键。 */
export type ItemEffect =
  /** 开局光露加成（光露=阳光）。 */
  | { t: 'bonusLightdew'; amount: number }
  /** 开局能量豆加成。 */
  | { t: 'bonusPlantFood'; amount: number }
  /** 开局限时：每行割草机被突破时免消耗一次（不新增 sim 命令，仅在既有消耗点前只读判定）。 */
  | { t: 'mowerWard'; durationS: number }
  /** 本局通关奖励增益（结算层）。 */
  | { t: 'clearBonus'; coinMult: number; bonusSeeds: number };

export interface ItemDef {
  id: string;
  name: string;
  /** 一句话描述（详情面板/商店卡展示）。 */
  desc: string;
  rarity: ItemRarity;
  /** pixelIcons 键名（渲染时取 `icon_<icon>` 纹理）。 */
  icon: string;
  effect: ItemEffect;
}

/** 道具全集（顺序即背包/商店展示顺序）。 */
export const ITEMS: readonly ItemDef[] = [
  {
    id: 'lightdew_jar',
    name: '晨露罐',
    desc: '开局额外获得 150 光露，起手布防更从容。',
    rarity: 'common',
    icon: 'item_lightdew_jar',
    effect: { t: 'bonusLightdew', amount: 150 },
  },
  {
    id: 'energy_core',
    name: '能量晶核',
    desc: '开局额外获得 2 枚能量豆，可多打两轮强化。',
    rarity: 'rare',
    icon: 'item_energy_core',
    effect: { t: 'bonusPlantFood', amount: 2 },
  },
  {
    id: 'thorn_ward',
    name: '荆棘护盾',
    desc: '开局 30 秒内，每行割草机被突破时不消耗，可各挡一次。',
    rarity: 'rare',
    icon: 'item_thorn_ward',
    effect: { t: 'mowerWard', durationS: 30 },
  },
  {
    id: 'lucky_clover',
    name: '幸运四叶草',
    desc: '本局通关金币 ×1.5，并额外获得 1 张种子券。',
    rarity: 'legendary',
    icon: 'item_lucky_clover',
    effect: { t: 'clearBonus', coinMult: 1.5, bonusSeeds: 1 },
  },
];

const BY_ID: ReadonlyMap<string, ItemDef> = new Map(ITEMS.map((i) => [i.id, i]));

/** 按 id 取道具（未知 id 返回 undefined，调用方自行兜底）。 */
export function itemById(id: string): ItemDef | undefined {
  return BY_ID.get(id);
}

export const RARITY_LABEL: Record<ItemRarity, string> = {
  common: '普通',
  rare: '稀有',
  legendary: '传说',
};

/** 品质排序权重（用于背包排序与"本次最高品质"高亮）。 */
export const RARITY_ORDER: Record<ItemRarity, number> = { common: 0, rare: 1, legendary: 2 };
