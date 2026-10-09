import {
  UnitArchetype,
  EnemyArchetype,
  enemyPoints,
  type UnitArchetype as Unit,
  type EnemyArchetype as Enemy,
} from './schema/unit';

export type RegistryIssue =
  | { kind: 'duplicate-id'; id: string; detail: string }
  | { kind: 'parse'; id: string; detail: string }
  | { kind: 'points-mismatch'; id: string; detail: string };

export interface Registry {
  units: readonly Unit[];
  enemies: readonly Enemy[];
  unitById: ReadonlyMap<string, Unit>;
  enemyById: ReadonlyMap<string, Enemy>;
}

/**
 * 注册表校验（DEV-PLAN §4 冒烟与 CI 共用的纯逻辑版）：
 * 解析全部原型 → 查重 → 校验敌人点数公式。HEADLESS Phaser 冒烟留到 M1。
 */
export function validateRegistry(units: readonly unknown[], enemies: readonly unknown[]): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const seenUnit = new Set<string>();
  const seenEnemy = new Set<string>();

  for (const raw of units) {
    const result = UnitArchetype.safeParse(raw);
    if (!result.success) {
      const id = (raw as { id?: string }).id ?? '?';
      issues.push({
        kind: 'parse',
        id,
        detail: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
      continue;
    }
    if (seenUnit.has(result.data.id)) {
      issues.push({ kind: 'duplicate-id', id: result.data.id, detail: 'unit id duplicated' });
      continue;
    }
    seenUnit.add(result.data.id);
  }

  for (const raw of enemies) {
    const result = EnemyArchetype.safeParse(raw);
    if (!result.success) {
      const id = (raw as { id?: string }).id ?? '?';
      issues.push({
        kind: 'parse',
        id,
        detail: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
      continue;
    }
    if (seenEnemy.has(result.data.id)) {
      issues.push({ kind: 'duplicate-id', id: result.data.id, detail: 'enemy id duplicated' });
      continue;
    }
    seenEnemy.add(result.data.id);
    const e = result.data;
    if (!e.isBoss && e.points !== enemyPoints(e.hp, e.traits)) {
      issues.push({
        kind: 'points-mismatch',
        id: e.id,
        detail: `declared ${e.points}, formula says ${enemyPoints(e.hp, e.traits)}`,
      });
    }
  }

  return issues;
}

export function registryFrom(units: readonly unknown[], enemies: readonly unknown[]): Registry {
  const parsedUnits = UnitArchetype.array().parse(units);
  const parsedEnemies = EnemyArchetype.array().parse(enemies);
  return {
    units: parsedUnits,
    enemies: parsedEnemies,
    unitById: new Map(parsedUnits.map((u) => [u.id, u])),
    enemyById: new Map(parsedEnemies.map((e) => [e.id, e])),
  };
}
