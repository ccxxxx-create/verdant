import type { UnitInput, EnemyInput } from '../../core/schema/unit';
import { meadowUnits, meadowEnemies } from './units/meadow';

/** 原型注册表（M0 仅草原；其余世界随里程碑追加）。 */
export const allUnits: readonly UnitInput[] = meadowUnits;
export const allEnemies: readonly EnemyInput[] = meadowEnemies;
