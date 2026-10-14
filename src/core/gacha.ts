import { Rng } from './rng.ts';
import { allUnits } from '../data/archetypes/index.ts';
import { DUPLICATE_UNIT_COINS } from '../data/economy.ts';
import { ITEMS, itemById, type ItemRarity } from '../data/items.ts';

/**
 * 抽奖核心（用户第 13 轮拍板：种子券单抽 + 钻石十连保底）。
 * 结构参考 PvZ2 piñata 公开范式：奖池=角色/金币/钻石/种子/能量豆；
 * 角色未拥有优先，重复折算金币；钻石十连必出至少 1 名未拥有角色。
 * 数值=自有配平（docs/RESEARCH-PVZ.md §三）。
 */

export type GachaPrizeKind = 'unit' | 'coins' | 'diamonds' | 'seeds' | 'plantFood' | 'item';

export interface GachaPrize {
  kind: GachaPrizeKind;
  /** unit/coins/diamonds/seeds/plantFood/item = 数量（unit 恒为 0） */
  amount: number;
  /** unit 渠道的角色 id；item 渠道的道具 id */
  name?: string;
  /** 重复角色折算金币时为 true */
  duplicate?: boolean;
}

interface WeightedEntry {
  kind: GachaPrizeKind;
  weight: number;
  amount: number;
}

/**
 * 单抽奖池（权重合计 100；M-INV 起加入道具奖项 15%）。
 * 纪律：改权重必须同步 tests/economy.test.ts 的「权重和 === 100」断言。
 */
export const GACHA_POOL: readonly WeightedEntry[] = [
  { kind: 'coins', weight: 32, amount: 100 },
  { kind: 'seeds', weight: 22, amount: 1 },
  { kind: 'plantFood', weight: 13, amount: 1 },
  { kind: 'item', weight: 15, amount: 1 },
  { kind: 'diamonds', weight: 10, amount: 1 },
  { kind: 'unit', weight: 8, amount: 0 },
];

/** 道具奖项的稀有度权重（普通更容易出）。 */
const ITEM_RARITY_WEIGHT: Record<ItemRarity, number> = { common: 60, rare: 30, legendary: 10 };

/** 按稀有度权重抽一个道具 id。 */
function rollItemId(rng: Rng): string {
  const total = ITEMS.reduce((s, it) => s + ITEM_RARITY_WEIGHT[it.rarity], 0);
  let roll = rng.next() * total;
  for (const it of ITEMS) {
    roll -= ITEM_RARITY_WEIGHT[it.rarity];
    if (roll <= 0) return it.id;
  }
  return ITEMS[0]?.id ?? 'lightdew_jar';
}

/** 抽奖可获得的角色全集（图鉴 13；已拥有者折算）。 */
const ALL_UNIT_IDS = allUnits.map((u) => u.id);

function pickUnowned(owned: readonly string[]): string | null {
  const unowned = ALL_UNIT_IDS.filter((id) => !owned.includes(id));
  if (unowned.length === 0) return null;
  return unowned[0] ?? null; // 调用方用 rng 打乱取
}

/** 单抽一次（种子券）。重复角色折 250 金币。 */
export function rollOnce(rng: Rng, owned: readonly string[]): GachaPrize {
  const table = GACHA_POOL.map((e) => ({ e, w: e.weight }));
  const total = table.reduce((s, t) => s + t.w, 0);
  let roll = rng.next() * total;
  for (const { e, w } of table) {
    roll -= w;
    if (roll <= 0) {
      if (e.kind === 'item') return { kind: 'item', amount: 1, name: rollItemId(rng) };
      if (e.kind !== 'unit') return { kind: e.kind, amount: e.amount };
      const unowned = ALL_UNIT_IDS.filter((id) => !owned.includes(id));
      if (unowned.length === 0) return { kind: 'coins', amount: DUPLICATE_UNIT_COINS, duplicate: true };
      const id = unowned[rng.int(0, unowned.length)];
      return id === undefined ? { kind: 'coins', amount: DUPLICATE_UNIT_COINS } : { kind: 'unit', amount: 0, name: id };
    }
  }
  return { kind: 'coins', amount: GACHA_POOL[0]?.amount ?? 100 };
}

/** 十连（钻石）：必出至少 1 名未拥有角色；其余 9 次按奖池权重。 */
export function rollTen(rng: Rng, owned: readonly string[]): GachaPrize[] {
  const unowned = ALL_UNIT_IDS.filter((id) => !owned.includes(id));
  const results: GachaPrize[] = [];
  const ownedAfter: string[] = [...owned];
  for (let i = 0; i < 10; i++) {
    const isLast = i === 9;
    const needsGuarantee = isLast && unowned.length > 0 && !results.some((r) => r.kind === 'unit');
    if (needsGuarantee) {
      const id = unowned[rng.int(0, unowned.length)];
      if (id !== undefined) {
        ownedAfter.push(id);
        unowned.splice(unowned.indexOf(id), 1);
        results.push({ kind: 'unit', amount: 0, name: id });
      } else {
        results.push(rollOnce(rng, ownedAfter));
      }
    } else {
      const prize = rollOnce(rng, ownedAfter);
      if (prize.kind === 'unit' && prize.name) ownedAfter.push(prize.name); // 防十连同名角色两入队（审查 P2-2）
      results.push(prize);
    }
  }
  return results;
}

export const GACHA_COST = { singleSeed: 1, diamondTen: 10 };

export function serializePool(): { kind: GachaPrizeKind; weight: number }[] {
  return GACHA_POOL.map(({ kind, weight }) => ({ kind, weight }));
}

/**
 * 奖品品质档（M-INV 抽卡分级动画的单一事实源）：
 * 普通 = 金币/种子/能量豆；稀有 = 钻石；传说 = 角色。
 * 道具按其自身稀有度归档，避免场景侧再写一套映射。
 */
export type PrizeTier = 'common' | 'rare' | 'legendary';

export function prizeTier(prize: GachaPrize): PrizeTier {
  switch (prize.kind) {
    case 'diamonds':
      return 'rare';
    case 'unit':
      return 'legendary';
    case 'item':
      return itemById(prize.name ?? '')?.rarity ?? 'common';
    default:
      return 'common';
  }
}

export { pickUnowned };
