import { describe, expect, it } from 'vitest';
import { allUnits, allEnemies } from '../src/data/archetypes';
import { validateRegistry, registryFrom } from '../src/core/registry';

describe('registry validation (CI gate, DEV-PLAN §4)', () => {
  it('real meadow prototypes pass with zero issues', () => {
    expect(validateRegistry(allUnits, allEnemies)).toEqual([]);
  });

  it('counts match GDD §5.3/§6.2 (13 units / 10 enemies + boss)', () => {
    expect(allUnits).toHaveLength(13);
    expect(allEnemies).toHaveLength(11);
    expect(allEnemies.filter((e) => e.isBoss)).toHaveLength(1);
  });

  it('every unit has behaviors and every role is legal', () => {
    for (const u of allUnits) {
      expect(u.behaviors.length).toBeGreaterThan(0);
      expect(['producer', 'attacker', 'defender', 'support']).toContain(u.role);
    }
  });

  it('detects duplicate unit ids', () => {
    const issues = validateRegistry([...allUnits, allUnits[0]], []);
    expect(issues.some((i) => i.kind === 'duplicate-id')).toBe(true);
  });

  it('detects duplicate enemy ids', () => {
    const dup = { ...allEnemies[0] };
    const issues = validateRegistry([], [dup, dup]);
    expect(issues.some((i) => i.kind === 'duplicate-id')).toBe(true);
  });

  it('detects points mismatch against the formula', () => {
    const broken = { ...allEnemies[0], points: 999 };
    const issues = validateRegistry([], [broken]);
    expect(issues.some((i) => i.kind === 'points-mismatch')).toBe(true);
  });

  it('detects schema violations (missing field)', () => {
    const sample = allEnemies[1];
    expect(sample).toBeDefined();
    if (!sample) return;
    const { hp: _hp, ...noHp } = sample;
    const issues = validateRegistry([], [noHp]);
    expect(issues.some((i) => i.kind === 'parse')).toBe(true);
  });

  it('registryFrom maps round-trip', () => {
    const reg = registryFrom(allUnits, allEnemies);
    expect(reg.unitById.get('thorn_pea')?.name).toBe('刺豆');
    expect(reg.enemyById.size).toBe(allEnemies.length);
    expect(reg.units).toHaveLength(13);
  });
});
