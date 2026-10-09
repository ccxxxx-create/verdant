import { describe, expect, it } from 'vitest';
import { LevelDef } from '../src/core/schema/level.ts';
import level11 from '../src/data/levels/meadow-1-1.json';
import level41 from '../src/data/levels/meadow-4-1.json';

describe('level definitions parse against schema (review P0: terrain was missing)', () => {
  it('meadow-1-1 (teach) parses with terrain defaults', () => {
    const r = LevelDef.safeParse(level11);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.template).toBe('teach');
      expect(r.data.waves).toBe(10);
      expect(r.data.startingLight).toBe(75);
      expect(r.data.terrain.waterColumns).toEqual([]);
    }
  });

  it('meadow-4-1 (conveyor) parses with conveyor config', () => {
    const r = LevelDef.safeParse(level41);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.template).toBe('conveyor');
      expect(r.data.conveyor?.handLimit).toBe(5);
      expect(r.data.conveyor?.pool.length).toBeGreaterThan(0);
      expect(r.data.plantFood).toBe(true);
    }
  });
});
