import type { UnitInput, EnemyInput } from '../../core/schema/unit.ts';
import { meadowUnits } from './units/meadow.ts';
import { meadowEnemies } from './enemies/meadow.ts';

/** 原型注册表（M1B 仅草原；其余世界随里程碑追加）。 */
export const allUnits: readonly UnitInput[] = meadowUnits;
export const allEnemies: readonly EnemyInput[] = meadowEnemies;
