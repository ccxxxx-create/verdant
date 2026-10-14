import { describe, expect, it } from 'vitest';
import { readSave, writeSave, type SaveStorage } from '../src/core/save';
import { SaveV6, defaultSave, migrate, CURRENT_SCHEMA_VERSION } from '../src/core/schema/save';
import { GAME_VERSION } from '../src/core/version';
import { CURRENT_NOTE, PATCH_NOTES } from '../src/data/patchNotes';

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
    expect(save.settings.motion).toBe(true); // v5：减弱动态默认开
    // M2 钱包默认值
    expect(save.wallet).toEqual({ coins: 0, diamonds: 0, seeds: 0, plantFood: 0 });
    expect(save.gacha).toEqual({ singlePulls: 0, diamondTenPulls: 0 });
    // v6：道具持有为空、兑换计数为 0
    expect(save.inventory).toEqual({});
    expect(save.stats.redeemCount).toBe(0);
  });

  it('write then read roundtrips', () => {
    const store = memoryStore();
    const save = { ...defaultSave(), stats: { playSeconds: 120, wins: 2, losses: 1, redeemCount: 0 } };
    writeSave(store, save);
    const back = readSave(store);
    expect(back.stats).toEqual({ playSeconds: 120, wins: 2, losses: 1, redeemCount: 0 });
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
    const result = SaveV6.parse(migrate(v1));
    expect(result.progress.currentWorld).toBe('meadow');
    expect(result.settings.quality).toBe('auto');
    expect(result.settings.handLayout).toBe('right');
    expect(result.stats).toEqual({ playSeconds: 0, wins: 0, losses: 0, redeemCount: 0 });
    expect(result.wallet).toEqual({ coins: 0, diamonds: 0, seeds: 0, plantFood: 0 });
    expect(result.inventory).toEqual({});
  });

  it('v2 migrates adding quality/handLayout/stats', () => {
    const v2 = {
      schemaVersion: 2,
      updatedAt: '2026-02-01T00:00:00.000Z',
      progress: { clearedLevels: [], stars: {}, unlockedUnits: [], currentWorld: 'meadow' },
      settings: { master: 1, music: 0.5, sfx: 0.8, speedDefault: 2 },
    };
    const result = SaveV6.parse(migrate(v2));
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
    const result = SaveV6.parse(migrate(v3));
    expect(result.wallet).toEqual({ coins: 320, diamonds: 2, seeds: 0, plantFood: 0 });
    expect(result.gacha).toEqual({ singlePulls: 0, diamondTenPulls: 0 });
  });

  it('v4 migrates to v5 adding settings.motion=true', () => {
    const v4 = {
      schemaVersion: 4,
      updatedAt: '2026-10-01T00:00:00.000Z',
      progress: { clearedLevels: [], stars: {}, unlockedUnits: [], currentWorld: 'meadow' },
      wallet: { coins: 1, diamonds: 0, seeds: 0, plantFood: 0 },
      gacha: { singlePulls: 0, diamondTenPulls: 0 },
      settings: { master: 0.8, music: 0.6, sfx: 1, quality: 'auto', speedDefault: 1, handLayout: 'right' },
      stats: { playSeconds: 0, wins: 0, losses: 0 },
    };
    const result = SaveV6.parse(migrate(v4));
    expect(result.settings.motion).toBe(true);
    expect(result.wallet.coins).toBe(1);
  });

  it('v5 migrates to v6 adding inventory={} and stats.redeemCount=0', () => {
    const v5 = {
      schemaVersion: 5,
      updatedAt: '2026-10-12T00:00:00.000Z',
      progress: { clearedLevels: [], stars: {}, unlockedUnits: [], currentWorld: 'meadow' },
      wallet: { coins: 7, diamonds: 3, seeds: 1, plantFood: 2 },
      gacha: { singlePulls: 4, diamondTenPulls: 1 },
      settings: { master: 0.8, music: 0.6, sfx: 1, quality: 'auto', speedDefault: 1, handLayout: 'right', motion: false },
      stats: { playSeconds: 42, wins: 3, losses: 1 },
    };
    const result = SaveV6.parse(migrate(v5));
    expect(result.inventory).toEqual({});
    expect(result.stats.redeemCount).toBe(0);
    // 旧档无损
    expect(result.wallet.diamonds).toBe(3);
    expect(result.gacha.singlePulls).toBe(4);
    expect(result.settings.motion).toBe(false);
    expect(result.stats.wins).toBe(3);
  });

  it('legacy v6 save without patchSeen migrates to empty string (patch dialog due)', () => {
    const v6 = { ...defaultSave(), patchSeen: undefined };
    const result = SaveV6.parse(migrate(v6));
    expect(result.patchSeen).toBe('');
  });

  it('v6 inventory keeps positive counts and drops invalid entries', () => {
    const raw = {
      ...defaultSave(),
      inventory: { lightdew_jar: 3, energy_core: 0, bad: -2, worse: 'x', '': 5 },
    };
    const result = SaveV6.parse(migrate(raw));
    expect(result.inventory).toEqual({ lightdew_jar: 3 });
  });

  it('future version is rejected, not silently downgraded', () => {
    expect(() => migrate({ schemaVersion: 99 })).toThrow(/future/);
  });

  it('missing schemaVersion is rejected', () => {
    expect(() => migrate({})).toThrow(/schemaVersion/);
  });
});

describe('patch notes gate', () => {
  it('new save has not seen the current version (patch dialog due, all players)', () => {
    expect(defaultSave().patchSeen).toBe('');
  });

  it('GAME_VERSION stays in sync with the latest patch note (release discipline)', () => {
    expect(GAME_VERSION).toBe(CURRENT_NOTE.version);
    expect(CURRENT_NOTE.lines.length).toBeGreaterThan(0);
    for (const note of PATCH_NOTES) {
      expect(note.lines.length, `patch ${note.version} has empty lines`).toBeGreaterThan(0);
    }
  });

  it('patchSeen roundtrips through write/read', () => {
    const store = memoryStore();
    const save = { ...defaultSave(), patchSeen: '2026.09.01' };
    writeSave(store, save);
    expect(readSave(store).patchSeen).toBe('2026.09.01');
  });

  it('dialogue condition holds for both fresh and upgraded saves', () => {
    const fresh = defaultSave();
    const upgraded = SaveV6.parse(migrate({ ...defaultSave(), patchSeen: undefined }));
    expect(fresh.patchSeen).not.toBe(GAME_VERSION);
    expect(upgraded.patchSeen).not.toBe(GAME_VERSION);
  });
});
