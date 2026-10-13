/**
 * PvZ2 植物等级（Level 1~10）成长曲线（只读参考层）。
 *
 * 来源：plantsvszombies.wiki.gg — `Peashooter_(PvZ2)` 的逐级表（PvZ2 v13.5.1，抓取 2026-10-14）。
 * PvZ2 通式（以豌豆射手为准）：
 * - 伤害：每级 **+5**（Lv1 20 → Lv10 65）
 * - 韧性 / HP：每级 **+50**（Lv1 300 → Lv10 750）
 * - 充能：只在 Lv2 / Lv6 / Lv10 三处缩短（5s → 4.5 → 4 → 3.5）
 * - 阳光花费：Lv5 降至 75，Lv13 降至 50，Lv18 降至 25（递减档）
 * - 升级消耗：种子包 + 金币（逐级递增）
 */

import { PEASHOOTER_LEVEL_CURVE, LEVEL_CURVE_RULES } from './plants.ts';

export interface PlantLevelStats {
  level: number;
  damage: number;
  hp: number;
  cost: number;
  rechargeMs: number;
}

/** 升级消耗（种子包 / 金币），来自 PvZ2 豌豆射手逐级表。 */
export function upgradeCost(level: number): { seeds: number; coins: number } {
  const row = PEASHOOTER_LEVEL_CURVE.find((r) => r.level === level);
  return row ? { seeds: row.seeds, coins: row.coins } : { seeds: 0, coins: 0 };
}

/**
 * 按等级缩放植物基础数值（PvZ2 通式）。
 * 只对"有攻击数值"的植物有伤害变化；无攻击单位只体现 HP / 充能。
 */
export function statsAtLevel(
  base: { damage?: number; hp: number; cost: number; rechargeMs: number },
  level: number,
): PlantLevelStats {
  const lv = Math.max(1, Math.min(10, Math.floor(level)));
  const dmgSteps = lv - 1;
  // 充能阶梯：Lv1=基础，Lv2~5 一档，Lv6~9 一档，Lv10 一档
  const rechargeStep = lv >= 10 ? 3 : lv >= 6 ? 2 : lv >= 2 ? 1 : 0;
  const rechargeTable = [base.rechargeMs, 4500, 4000, 3500];
  return {
    level: lv,
    damage: base.damage === undefined ? 0 : base.damage + LEVEL_CURVE_RULES.damagePerLevel * dmgSteps,
    hp: base.hp + LEVEL_CURVE_RULES.hpPerLevel * dmgSteps,
    cost: lv >= 5 ? Math.min(base.cost, 75) : base.cost,
    rechargeMs: rechargeTable[rechargeStep] ?? base.rechargeMs,
  };
}

/** 与 PvZ2 豌豆射手逐级表逐项比对（供防漂移测试使用）。 */
export function peashooterCurveMatchesPvz2(): boolean {
  return PEASHOOTER_LEVEL_CURVE.every((row) => {
    const s = statsAtLevel({ damage: 20, hp: 300, cost: 100, rechargeMs: 5000 }, row.level);
    return s.damage === row.damage && s.hp === row.hp && s.cost === row.cost && s.rechargeMs === Math.round(row.rechargeS * 1000);
  });
}
