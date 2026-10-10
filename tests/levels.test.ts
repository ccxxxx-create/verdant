import { describe, expect, it } from 'vitest';
import { LevelDef } from '../src/core/schema/level.ts';
import level11 from '../src/data/levels/meadow-1-1.json';
import level12 from '../src/data/levels/meadow-1-2.json';
import level13 from '../src/data/levels/meadow-1-3.json';
import level14 from '../src/data/levels/meadow-1-4.json';
import level15 from '../src/data/levels/meadow-1-5.json';
import level41 from '../src/data/levels/meadow-4-1.json';

const MEADOW_1 = [level11, level12, level13, level14, level15];

describe('level definitions parse against schema', () => {
  it('meadow 1-1..1-5 all parse and stay progression-consistent (M1C 前 5 关)', () => {
    MEADOW_1.forEach((lv, i) => {
      const r = LevelDef.safeParse(lv);
      expect(r.success, `meadow-1-${i + 1}`).toBe(true);
      if (!r.success) return;
      expect(r.data.id).toBe(`meadow-1-${i + 1}`);
      expect(r.data.waves).toBeGreaterThan(0);
      expect(r.data.startingLight).toBeGreaterThanOrEqual(50); // M2：PvZ1 口径起步 50
      expect(r.data.unlockUnits.length).toBeGreaterThan(0); // 卡组非空
      expect(r.data.pool.length).toBeGreaterThan(0);
      expect(r.data.terrain.waterColumns).toEqual([]);
      // 卡组渐进扩充：后一关包含前一关全部卡
      const prev = MEADOW_1[i - 1];
      if (i > 0 && prev) {
        for (const u of prev.unlockUnits) {
          expect(r.data.unlockUnits).toContain(u);
        }
      }
    });
  });

  it('meadow-1-1 (teach) keeps gentle teach parameters', () => {
    const r = LevelDef.safeParse(level11);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.template).toBe('teach');
      expect(r.data.waves).toBe(10);
      expect(r.data.startingLight).toBe(50); // M2：PvZ1 口径
      expect(r.data.pool).toEqual(['march_ant']);
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
