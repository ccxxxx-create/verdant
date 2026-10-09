import { z } from 'zod';

/** 单位原型（DEV-PLAN §2 / GDD §5）。字段只增不删；新增字段给默认值。 */
export const UnitArchetype = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/),
  world: z.enum(['meadow', 'reef', 'sky', 'frost']),
  role: z.enum(['producer', 'attacker', 'defender', 'support']),
  name: z.string().min(1),
  cost: z.number().int().positive(),
  cooldownMs: z.number().int().positive(),
  hp: z.number().int().positive(),
  behaviors: z.array(z.string()).min(1),
  attack: z
    .object({
      damage: z.number().positive(),
      intervalMs: z.number().int().positive().optional(),
      kind: z.enum(['single', 'multi', 'aoe', 'melee', 'lobbed', 'trigger']),
      range: z.number().nonnegative(),
      element: z.enum(['none', 'fire', 'water', 'ice', 'electric']).default('none'),
      shots: z.number().int().positive().optional(),
      radius: z.number().int().positive().optional(),
      prepMs: z.number().int().nonnegative().optional(),
    })
    .optional(),
  produce: z
    .object({ amount: z.number().int().positive(), intervalMs: z.number().int().positive() })
    .optional(),
  aura: z
    .object({ radiusCells: z.number().int().positive(), attackSpeedPct: z.number() })
    .optional(),
  control: z.object({ stunMs: z.number().int().positive() }).optional(),
  reveal: z.object({ durationMs: z.number().int().positive() }).optional(),
  traits: z.array(z.string()).default([]),
  waterOnly: z.boolean().default(false),
  breakSlots: z.boolean().default(false),
});

export type UnitArchetype = z.infer<typeof UnitArchetype>;
/** 数据侧书写类型（默认值未应用前的输入形态）。 */
export type UnitInput = z.input<typeof UnitArchetype>;

/** 敌人原型（GDD §6）。points 由公式派生，声明值必须与公式一致（registry 校验）。 */
export const EnemyArchetype = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/),
  world: z.enum(['meadow', 'reef', 'sky', 'frost']),
  name: z.string().min(1),
  hp: z.number().int().positive(),
  /** 格/秒（1.0 = 基准）。 */
  speed: z.number().positive(),
  biteDps: z.number().nonnegative(),
  armor: z.enum(['cloth', 'hide', 'shell', 'iron']),
  traits: z.array(z.string()).default([]),
  flying: z.boolean().default(false),
  waterborne: z.boolean().default(false),
  isBoss: z.boolean().default(false),
  points: z.number().int().nonnegative(),
});

export type EnemyArchetype = z.infer<typeof EnemyArchetype>;
/** 数据侧书写类型（默认值未应用前的输入形态）。 */
export type EnemyInput = z.input<typeof EnemyArchetype>;

/** GDD §8.2 敌人点数公式：round(HP/50) + traitBonus。 */
export const TRAIT_BONUS: Record<string, number> = {
  flying: 2,
  waterborne: 1,
  slow_immune: 2,
  charge: 3,
  grab: 3,
  summon: 4,
};

export function enemyPoints(hp: number, traits: readonly string[]): number {
  const bonus = traits.reduce((sum, t) => sum + (TRAIT_BONUS[t] ?? 0), 0);
  return Math.round(hp / 50) + bonus;
}
