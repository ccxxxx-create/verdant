import { Rng } from './rng.ts';
import { allUnits } from '../data/archetypes/index.ts';
import { DUPLICATE_UNIT_COINS } from '../data/economy.ts';

/**
 * 抽奖核心（用户第 13 轮拍板：种子券单抽 + 钻石十连保底）。
 * 结构参考 PvZ2 piñata 公开范式：奖池=角色/金币/钻石/种子/能量豆；
 * 角色未拥有优先，重复折算金币；钻石十连必出至少 1 名未拥有角色。
 * 数值=自有配平（docs/RESEARCH-PVZ.md §三）。
 */

export type GachaPrizeKind = 'unit' | 'coins' | 'diamonds' | 'seeds' | 'plantFood';

export interface GachaPrize {
  kind: GachaPrizeKind;
  /** unit=角色 id（见 name）/ coins=数量 / diamonds=数量 / seeds=数量 / plantFood=数量 */
  amount: number;
  /** unit 渠道的角色 id */
  name?: string;
  /** 重复角色折算金币时为 true */
  duplicate?: boolean;
}

interface WeightedEntry {
  kind: GachaPrizeKind;
  weight: number;
  amount: number;
}

/** 单抽奖池（权重合计 100）。 */
export const GACHA_POOL: readonly WeightedEntry[] = [
  { kind: 'coins', weight: 40, amount: 100 },
  { kind: 'seeds', weight: 28, amount: 1 },
  { kind: 'plantFood', weight: 15, amount: 1 },
  { kind: 'diamonds', weight: 9, amount: 1 },
  { kind: 'unit', weight: 8, amount: 0 },
];

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

export { pickUnowned };
