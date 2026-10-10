import { describe, expect, it } from 'vitest';
import { producerTick } from '../src/core/economy.ts';
import { migrate } from '../src/core/schema/save.ts';
import { SaveV4 } from '../src/core/schema/save.ts';
import { readSave, writeSave, type SaveStorage } from '../src/core/save.ts';
import { LevelDef } from '../src/core/schema/level.ts';
import { allEnemies, allUnits } from '../src/data/archetypes/index.ts';
import { registryFrom } from '../src/core/registry.ts';
import { projectileSprites } from '../src/data/pixels/enemies/meadow.ts';
import level11 from '../src/data/levels/meadow-1-1.json';
import level12 from '../src/data/levels/meadow-1-2.json';
import level13 from '../src/data/levels/meadow-1-3.json';
import level14 from '../src/data/levels/meadow-1-4.json';
import level15 from '../src/data/levels/meadow-1-5.json';
import level41 from '../src/data/levels/meadow-4-1.json';

const reg = registryFrom(allUnits, allEnemies);
const LEVELS = [level11, level12, level13, level14, level15, level41];
const ELEMENT_BULLET = ['bullet_pea', 'bullet_fire', 'bullet_ice', 'bullet_electric'];

describe('M1C review regression pins (3-subagent audit, 2026-10-10)', () => {
  it('producer yields exactly one drop per interval — no double credit (feedback #7 / P1-1)', () => {
    const firefly = allUnits.find((u) => u.id === 'firefly_reed');
    expect(firefly).toBeDefined();
    const tick = producerTick(firefly!);
    expect(tick.immediateGain).toBe(0); // 禁止立即到账（此前 += amount 与掉落并存=50/7s）
    expect(tick.spawnsDrop).toBe(true); // 收益只经掉落收集路径
    // 非产出单位无收益
    const pea = allUnits.find((u) => u.id === 'thorn_pea');
    expect(producerTick(pea!)).toEqual({ immediateGain: 0, spawnsDrop: false });
  });

  it('every ELEMENT_BULLET texture key exists in projectileSprites (P0: bullets baked missing)', () => {
    for (const key of ELEMENT_BULLET) {
      expect(Object.keys(projectileSprites)).toContain(key);
    }
  });

  it('save migration strips unknown future keys instead of wiping the profile (P1-2)', () => {
    const raw = {
      schemaVersion: 3,
      updatedAt: '2026-10-10T00:00:00.000Z',
      progress: { clearedLevels: ['meadow-1-1'], stars: { 'meadow-1-1': 3 }, unlockedUnits: ['thorn_pea'], currentWorld: 'meadow' },
      settings: { master: 0.5, music: 0.4, sfx: 0.9, quality: 'auto', speedDefault: 2, handLayout: 'left' },
      stats: { playSeconds: 120, wins: 1, losses: 2 },
      futureThing: { hello: 'world' }, // 模拟来自未来的未知 key
    };
    const shaped = migrate(raw as Record<string, unknown>);
    const parsed = SaveV4.parse(shaped); // 未知 key 被剥离，整档可解析 → 不清档
    expect(parsed.progress.clearedLevels).toEqual(['meadow-1-1']);
    expect(parsed.settings.master).toBeCloseTo(0.5);
    expect(parsed.stats.losses).toBe(2);
  });

  it('readSave backs up raw before falling back to default (P1-2: silent wipe)', () => {
    const store = new Map<string, string>();
    const storage: SaveStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    };
    storage.setItem('verdant.save.v1', '{ not valid json');
    const save = readSave(storage);
    expect(save.progress.clearedLevels).toEqual([]); // 回退默认档
    expect(store.get('verdant.save.v1.bak')).toBe('{ not valid json'); // 原档已备份
  });

  it('write/read round trip preserves progress', () => {
    const store = new Map<string, string>();
    const storage: SaveStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    };
    const save = readSave(storage);
    save.progress.clearedLevels.push('meadow-1-1');
    save.stats.wins += 1;
    writeSave(storage, save);
    expect(readSave(storage).progress.clearedLevels).toEqual(['meadow-1-1']);
  });

  it('every level file cross-references existing archetypes (P1-4: empty pool auto-win)', () => {
    for (const lv of LEVELS) {
      const parsed = LevelDef.parse(lv);
      expect(parsed.pool.length, `${parsed.id} pool 非空`).toBeGreaterThan(0);
      for (const id of parsed.pool) {
        expect(reg.enemyById.has(id), `${parsed.id} pool -> ${id}`).toBe(true);
      }
      const deck = parsed.unlockUnits.length > 0 ? parsed.unlockUnits : ['firefly_reed', 'thorn_pea'];
      for (const id of deck) {
        expect(reg.unitById.has(id), `${parsed.id} deck -> ${id}`).toBe(true);
      }
      for (const id of parsed.conveyor?.pool ?? []) {
        expect(reg.unitById.has(id), `${parsed.id} conveyor -> ${id}`).toBe(true);
      }
      // 未实现 behaviors 的死卡不得进可玩卡组（P1-6：tether_moss 种下无效果）
      for (const id of deck) {
        const def = reg.unitById.get(id);
        const dead = def?.behaviors?.some((b) => !['produce', 'attack', 'block'].includes(b));
        expect(dead, `${parsed.id} deck 含未实现 behavior: ${id}`).toBeFalsy();
      }
    }
  });

  it('no boss (0 points) can enter a normal wave pool', () => {
    // 与 BattleScene.startWave 的 points<=0 跳过互为防线
    for (const lv of LEVELS) {
      const parsed = LevelDef.parse(lv);
      for (const id of parsed.pool) {
        const e = reg.enemyById.get(id);
        expect(e?.points, `${parsed.id} pool -> ${id} 点数为 0`).toBeGreaterThan(0);
      }
    }
  });
});
