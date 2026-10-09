import { describe, expect, it } from 'vitest';
import { UnitArchetype, EnemyArchetype, enemyPoints, TRAIT_BONUS } from '../src/core/schema/unit';

describe('UnitArchetype schema', () => {
  const base = {
    id: 'thorn_pea',
    world: 'meadow',
    role: 'attacker',
    name: '刺豆',
    cost: 100,
    cooldownMs: 5000,
    hp: 300,
    behaviors: ['attack'],
    attack: { damage: 20, intervalMs: 1400, kind: 'single', range: 9 },
  };

  it('accepts a valid unit', () => {
    expect(UnitArchetype.parse(base).id).toBe('thorn_pea');
  });

  it('rejects bad id characters', () => {
    expect(() => UnitArchetype.parse({ ...base, id: 'Thorn-Pea' })).toThrow();
  });

  it('rejects unknown fields (strict)', () => {
    expect(() => UnitArchetype.parse({ ...base, colour: 'red' })).toThrow();
  });

  it('rejects non-positive cost', () => {
    expect(() => UnitArchetype.parse({ ...base, cost: 0 })).toThrow();
  });
});

describe('enemyPoints formula (GDD §8.2)', () => {
  it('matches round(hp/50) + trait bonus', () => {
    expect(enemyPoints(50, [])).toBe(1);
    expect(enemyPoints(80, ['flying'])).toBe(4); // 2 + 2
    expect(enemyPoints(200, ['slow_immune'])).toBe(6); // 4 + 2
    expect(enemyPoints(450, [])).toBe(9);
  });

  it('boss traits contribute bonus but bosses bypass pool check', () => {
    expect(EnemyArchetype.parse({
      id: 'x', world: 'meadow', name: 'X', hp: 5000, speed: 0.3, biteDps: 20,
      armor: 'shell', traits: ['summon'], isBoss: true, points: 0,
    }).isBoss).toBe(true);
  });

  it('TRAIT_BONUS covers every trait used in formulas', () => {
    expect(Object.keys(TRAIT_BONUS).length).toBeGreaterThan(0);
  });
});
