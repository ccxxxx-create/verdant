import { describe, expect, it } from 'vitest';
import { readSave, writeSave, type SaveStorage } from '../src/core/save';
import { SaveV4, defaultSave, migrate, CURRENT_SCHEMA_VERSION } from '../src/core/schema/save';

function memoryStore(initial?: string): SaveStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  if (initial !== undefined) data['verdant.save.v1'] = initial;
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('save default & roundtrip', () => {
  it('empty storage yields default save', () => {
    const save = readSave(memoryStore());
    expect(save.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(save.progress.unlockedUnits).toContain('firefly_reed');
    expect(save.settings.handLayout).toBe('right');
    // M2 钱包默认值
    expect(save.wallet).toEqual({ coins: 0, diamonds: 0, seeds: 0, plantFood: 0 });
    expect(save.gacha).toEqual({ singlePulls: 0, diamondTenPulls: 0 });
  });

  it('write then read roundtrips', () => {
    const store = memoryStore();
    const save = { ...defaultSave(), stats: { playSeconds: 120, wins: 2, losses: 1 } };
    writeSave(store, save);
    const back = readSave(store);
    expect(back.stats).toEqual({ playSeconds: 120, wins: 2, losses: 1 });
  });

  it('corrupted payload falls back to default without throwing', () => {
    const save = readSave(memoryStore('{not json'));
    expect(save.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe('migration chain', () => {
  it('v1 migrates to current with defaults filled', () => {
    const v1 = {
      schemaVersion: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      progress: { clearedLevels: ['meadow-1-1'], stars: { 'meadow-1-1': 3 }, unlockedUnits: ['firefly_reed'] },
    };
    const result = SaveV4.parse(migrate(v1));
    expect(result.progress.currentWorld).toBe('meadow');
    expect(result.settings.quality).toBe('auto');
    expect(result.settings.handLayout).toBe('right');
    expect(result.stats).toEqual({ playSeconds: 0, wins: 0, losses: 0 });
    expect(result.wallet).toEqual({ coins: 0, diamonds: 0, seeds: 0, plantFood: 0 });
  });

  it('v2 migrates adding quality/handLayout/stats', () => {
    const v2 = {
      schemaVersion: 2,
      updatedAt: '2026-02-01T00:00:00.000Z',
      progress: { clearedLevels: [], stars: {}, unlockedUnits: [], currentWorld: 'meadow' },
      settings: { master: 1, music: 0.5, sfx: 0.8, speedDefault: 2 },
    };
    const result = SaveV4.parse(migrate(v2));
    expect(result.settings.speedDefault).toBe(2);
    expect(result.settings.handLayout).toBe('right');
  });

  it('v3 wallet migrates to v4 defaults while preserving coins', () => {
    const v3 = {
      schemaVersion: 3,
      updatedAt: '2026-09-01T00:00:00.000Z',
      progress: { clearedLevels: [], stars: {}, unlockedUnits: [], currentWorld: 'meadow' },
      wallet: { coins: 320, diamonds: 2 },
      settings: { master: 0.7, music: 0.5, sfx: 1, quality: 'auto', speedDefault: 1, handLayout: 'right' },
      stats: { playSeconds: 10, wins: 1, losses: 0 },
    };
    const result = SaveV4.parse(migrate(v3));
    expect(result.wallet).toEqual({ coins: 320, diamonds: 2, seeds: 0, plantFood: 0 });
    expect(result.gacha).toEqual({ singlePulls: 0, diamondTenPulls: 0 });
  });

  it('future version is rejected, not silently downgraded', () => {
    expect(() => migrate({ schemaVersion: 99 })).toThrow(/future/);
  });

  it('missing schemaVersion is rejected', () => {
    expect(() => migrate({})).toThrow(/schemaVersion/);
  });
});
