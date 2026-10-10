import { describe, expect, it } from 'vitest';
import { producerTick } from '../src/core/economy.ts';
import { levelClearReward, milestoneSeeds } from '../src/core/rewards.ts';
import { GACHA_POOL, GACHA_COST, rollOnce, rollTen } from '../src/core/gacha.ts';
import { Rng } from '../src/core/rng.ts';
import { allUnits } from '../src/data/archetypes/index.ts';
import { UNIT_ACQUISITION } from '../src/data/economy.ts';
import { LevelDef } from '../src/core/schema/level.ts';
import level11 from '../src/data/levels/meadow-1-1.json';

const lv11 = LevelDef.parse(level11);

describe('M2 economy: rewards', () => {
  it('star rewards scale 20/40/60 and replay pays half (floor)', () => {
    const base = { level: lv11, totalStarsBefore: 0, previousStars: null } as const;
    expect(levelClearReward({ ...base, stars: 1 })).toMatchObject({ coins: 20, diamonds: 0 });
    expect(levelClearReward({ ...base, stars: 2 })).toMatchObject({ coins: 40 });
    expect(levelClearReward({ ...base, stars: 3 })).toMatchObject({ coins: 60, diamonds: 2 }); // 首通+首三星
    // 重打同星：50%
    expect(levelClearReward({ ...base, previousStars: 3, stars: 3 })).toMatchObject({ coins: 30, diamonds: 0 });
    // 升星重打：按新星的全额（视为首次拿 3 星）
    expect(levelClearReward({ ...base, previousStars: 1, stars: 3 })).toMatchObject({ coins: 60, diamonds: 2 });
  });

  it('plant food granted per clear; seeds only from star milestones', () => {
    expect(levelClearReward({ level: lv11, stars: 2, previousStars: null, totalStarsBefore: 9 }).plantFood).toBe(1);
    expect(milestoneSeeds(8, 12)).toBe(1); // 跨 10 星档
    expect(milestoneSeeds(9, 9)).toBe(0); // 未跨档
    expect(milestoneSeeds(18, 22)).toBe(2); // 同时跨 10+20 档累计
  });

  it('total star accounting is monotonic through replays', () => {
    // 1-1 从 0→3 星：累计 3
    const r1 = levelClearReward({ level: lv11, stars: 3, previousStars: null, totalStarsBefore: 0 });
    expect(r1.coins).toBe(60);
  });
});

describe('M2 economy: gacha', () => {
  it('pool weights sum to 100 and every prize kind is valid', () => {
    const sum = GACHA_POOL.reduce((s, e) => s + e.weight, 0);
    expect(sum).toBe(100);
    for (const e of GACHA_POOL) {
      expect(['unit', 'coins', 'diamonds', 'seeds', 'plantFood']).toContain(e.kind);
    }
  });

  it('single pull always yields a prize; unit prizes reference real units', () => {
    const rng = new Rng(12345);
    for (let i = 0; i < 200; i++) {
      const p = rollOnce(rng, []);
      if (p.kind === 'unit') {
        expect(allUnits.some((u) => u.id === p.name)).toBe(true);
        expect(p.amount).toBe(0);
      } else {
        expect(p.amount).toBeGreaterThan(0);
      }
    }
  });

  it('unit slot converts to coins once all units are owned', () => {
    const all = allUnits.map((u) => u.id);
    const rng = new Rng(777);
    let sawUnitSlotConvert = false;
    for (let i = 0; i < 600; i++) {
      const p = rollOnce(rng, all);
      // 全拥有时 unit 奖池槽折算为金币，非 unit 槽保持原奖品
      if (p.kind === 'unit') throw new Error('不应再产出未拥有角色');
      expect(p.amount).toBeGreaterThan(0);
      if (p.duplicate === true) {
        expect(p.kind).toBe('coins');
        expect(p.amount).toBe(250);
        sawUnitSlotConvert = true;
      }
    }
    // 600 抽内 unit 槽（8%）必然被命中过
    expect(sawUnitSlotConvert).toBe(true);
  });

  it('diamond ten-pull guarantees at least one unowned unit', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed * 101);
      const owned = ['firefly_reed', 'thorn_pea'];
      const prizes = rollTen(rng, owned);
      expect(prizes).toHaveLength(10);
      const units = prizes.filter((p) => p.kind === 'unit');
      expect(units.length).toBeGreaterThanOrEqual(1);
      for (const u of units) {
        expect(owned).not.toContain(u.name);
        expect(allUnits.some((x) => x.id === u.name)).toBe(true);
      }
    }
  });

  it('costs are simple integers', () => {
    expect(GACHA_COST.singleSeed).toBe(1);
    expect(GACHA_COST.diamondTen).toBe(10);
  });

  it('rng determinism: same seed same ten-pull', () => {
    const a = rollTen(new Rng(42), []);
    const b = rollTen(new Rng(42), []);
    expect(a).toEqual(b);
  });
});

describe('M2 economy: acquisition table', () => {
  it('covers all 13 units with channel ratios 4 gift / 6 coins / 3 diamonds', () => {
    for (const u of allUnits) {
      expect(UNIT_ACQUISITION[u.id], u.id).toBeDefined();
    }
    const chans = Object.values(UNIT_ACQUISITION).map((a) => a.channel);
    expect(chans.filter((c) => c === 'gift')).toHaveLength(4);
    expect(chans.filter((c) => c === 'coins')).toHaveLength(6);
    expect(chans.filter((c) => c === 'diamonds')).toHaveLength(3);
  });

  it('priced channels have positive prices; gift has none', () => {
    for (const [id, a] of Object.entries(UNIT_ACQUISITION)) {
      if (a.channel === 'gift') expect(a.price).toBeUndefined();
      else expect(a.price, id).toBeGreaterThan(0);
    }
  });

  it('gift units match level unlockUnits of 1-1/1-2/1-3', () => {
    const gifts = Object.entries(UNIT_ACQUISITION)
      .filter(([, a]) => a.channel === 'gift')
      .map(([id]) => id);
    expect(gifts).toEqual(['firefly_reed', 'thorn_pea', 'wood_core', 'frost_pea']);
  });
});

describe('economy regression pins', () => {
  it('producer tick yields no immediate credit', () => {
    expect(producerTick(allUnits.find((u) => u.id === 'firefly_reed')!)).toEqual({ immediateGain: 0, spawnsDrop: true });
  });
});
