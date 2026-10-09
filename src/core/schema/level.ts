import { z } from 'zod';

/** 关卡定义（GDD §8 + v1.1 §13 传送带/世界能量扩展）。 */
export const LevelDef = z.strictObject({
  id: z.string().regex(/^[a-z]+-\d+-\d+$/),
  world: z.enum(['meadow', 'reef', 'sky', 'frost']),
  template: z.enum(['teach', 'normal', 'flag', 'survive', 'boss', 'chal', 'conveyor']),
  rows: z.literal(6),
  cols: z.literal(9),
  terrain: z
    .strictObject({
      waterColumns: z.array(z.number().int().min(1).max(8)).default([]),
      brokenCells: z.array(z.number().int().min(0).max(53)).default([]),
      iceColumns: z.array(z.number().int().min(1).max(8)).default([]),
      wind: z.enum(['none', 'left', 'right']).default('none'),
    })
    .default({ waterColumns: [], brokenCells: [], iceColumns: [], wind: 'none' as const }),
  waves: z.number().int().positive(),
  /** 亮相敌人池（波次导演只允许从此池选，GDD §8.2） */
  pool: z.array(z.string()).min(1),
  unlockUnits: z.array(z.string()).default([]),
  starCondition: z
    .enum(['none', 'no_producer', 'deck_le6', 'field_le12', 'no_fire', 'no_electric', 'under_90s', 'no_mower_break', 'no_shovel'])
    .default('none'),
  startingLight: z.number().int().nonnegative().default(50),
  /** 世界能量大招开关（GDD §13.1，默认开） */
  plantFood: z.boolean().default(true),
  /** 传送带配置（GDD §13.2；仅 conveyor 模板关卡填写） */
  conveyor: z
    .object({
      intervalMs: z.number().int().positive(),
      handLimit: z.number().int().positive().max(9),
      pool: z.array(z.string()).min(1),
    })
    .optional(),
});

export type LevelDef = z.infer<typeof LevelDef>;
export type LevelInput = z.input<typeof LevelDef>;
