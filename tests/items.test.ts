import { describe, expect, it } from 'vitest';
import { ITEMS, itemById, RARITY_LABEL, RARITY_ORDER } from '../src/data/items.ts';
import { ITEM_ACQUISITION } from '../src/data/economy.ts';
import { REDEEM_CODES, findRedeemCode, normalizeCode } from '../src/data/redeem.ts';
import { pixelIcons } from '../src/data/pixels/icons.ts';
import { Rng } from '../src/core/rng.ts';
import { rollOnce, rollTen, prizeTier, type GachaPrize } from '../src/core/gacha.ts';
import { LevelDef } from '../src/core/schema/level.ts';
import level11 from '../src/data/levels/meadow-1-1.json';
import { registryFrom } from '../src/core/registry.ts';
import { allEnemies, allUnits } from '../src/data/archetypes/index.ts';
import { SIM_DT_MS } from '../src/core/balance.ts';
import { MOWER_LINE } from '../src/core/battle/layout.ts';
import { createBattle, spawnEnemy, step } from '../src/core/battle/sim.ts';
import { levelClearReward } from '../src/core/rewards.ts';

const REG = registryFrom(allUnits, allEnemies);
const LV11 = LevelDef.parse(level11);

describe('M-INV items table', () => {
  it('defines 4 items with unique ids and known rarities', () => {
    expect(ITEMS).toHaveLength(4);
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const it of ITEMS) {
      expect(['common', 'rare', 'legendary']).toContain(it.rarity);
      expect(RARITY_LABEL[it.rarity]).toBeTruthy();
      expect(RARITY_ORDER[it.rarity]).toBeGreaterThanOrEqual(0);
      expect(it.name.length).toBeGreaterThan(0);
      expect(it.desc.length).toBeGreaterThan(0);
    }
  });

  it('every item icon exists in pixelIcons (否则纹理烘焙会缺图)', () => {
    for (const it of ITEMS) {
      expect(Object.keys(pixelIcons), `icon ${it.icon}`).toContain(it.icon);
    }
  });

  it('every item has a shop price entry and vice versa', () => {
    for (const it of ITEMS) {
      const acq = ITEM_ACQUISITION[it.id];
      expect(acq, `定价缺失: ${it.id}`).toBeDefined();
      expect(['coins', 'diamonds']).toContain(acq!.channel);
      expect(acq!.price).toBeGreaterThan(0);
    }
    for (const id of Object.keys(ITEM_ACQUISITION)) {
      expect(itemById(id), `定价多余: ${id}`).toBeDefined();
    }
  });

  it('itemById returns undefined for unknown ids', () => {
    expect(itemById('nope')).toBeUndefined();
    expect(itemById('lightdew_jar')?.name).toBe('晨露罐');
  });
});

describe('M-INV gacha: item prizes', () => {
  it('item prizes reference real item ids and amount >= 1', () => {
    const rng = new Rng(20261014);
    let sawItem = false;
    for (let i = 0; i < 800; i++) {
      const p = rollOnce(rng, []);
      if (p.kind !== 'item') continue;
      sawItem = true;
      expect(itemById(p.name ?? '')).toBeDefined();
      expect(p.amount).toBeGreaterThanOrEqual(1);
    }
    // 道具权重 15%，800 抽内必然命中
    expect(sawItem).toBe(true);
  });

  it('prizeTier maps kinds to the 3 tiers', () => {
    const cases: [GachaPrize, string][] = [
      [{ kind: 'coins', amount: 100 }, 'common'],
      [{ kind: 'seeds', amount: 1 }, 'common'],
      [{ kind: 'plantFood', amount: 1 }, 'common'],
      [{ kind: 'diamonds', amount: 1 }, 'rare'],
      [{ kind: 'unit', amount: 0, name: 'thorn_pea' }, 'legendary'],
      [{ kind: 'item', amount: 1, name: 'lightdew_jar' }, 'common'],
      [{ kind: 'item', amount: 1, name: 'energy_core' }, 'rare'],
      [{ kind: 'item', amount: 1, name: 'lucky_clover' }, 'legendary'],
    ];
    for (const [prize, tier] of cases) {
      expect(prizeTier(prize), `${prize.kind}:${prize.name ?? ''}`).toBe(tier);
    }
  });

  it('ten-pull still guarantees an unowned unit with items in the pool', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const prizes = rollTen(new Rng(seed * 977), ['firefly_reed']);
      expect(prizes.some((p) => p.kind === 'unit')).toBe(true);
    }
  });
});

describe('M-INV carried item → createBattle 初始状态', () => {
  const base = { level: LV11, units: REG.unitById, enemies: REG.enemyById, deck: [] as string[] };

  it('no carried item leaves initial state untouched', () => {
    const s = createBattle({ ...base });
    expect(s.lightdew).toBe(LV11.startingLight);
    expect(s.plantFood).toBe(0);
    expect(s.mowerWardUntil).toBe(0);
    expect(s.mowerWardUsed.every((v) => v === false)).toBe(true);
  });

  it('bonusLightdew / bonusPlantFood only shift initial state', () => {
    const s = createBattle({
      ...base,
      carriedItem: { id: 'lightdew_jar', effect: { t: 'bonusLightdew', amount: 150 } },
    });
    expect(s.lightdew).toBe(LV11.startingLight + 150);
    const s2 = createBattle({
      ...base,
      carriedItem: { id: 'energy_core', effect: { t: 'bonusPlantFood', amount: 2 } },
    });
    expect(s2.plantFood).toBe(2);
  });

  it('mowerWard: first breach in a row is blocked without consuming the mower', () => {
    const enemyId = LV11.pool[0];
    expect(enemyId).toBeDefined();
    const def = REG.enemyById.get(enemyId!);
    expect(def).toBeDefined();

    // 无护盾：割草机被消耗
    const plain = createBattle({ ...base });
    const e0 = spawnEnemy(plain, def!, 0);
    e0.x = MOWER_LINE - 1;
    step(plain, SIM_DT_MS);
    expect(plain.mowers[0]).toBe(false);

    // 有护盾：本行首次突破免消耗，且不判负
    const warded = createBattle({
      ...base,
      carriedItem: { id: 'thorn_ward', effect: { t: 'mowerWard', durationS: 30 } },
    });
    expect(warded.mowerWardUntil).toBe(30_000);
    const e1 = spawnEnemy(warded, def!, 0);
    e1.x = MOWER_LINE - 1;
    step(warded, SIM_DT_MS);
    expect(warded.mowers[0]).toBe(true); // 未消耗
    expect(warded.mowerWardUsed[0]).toBe(true);
    expect(warded.status).toBe('playing');

    // 同一行第二次突破：护盾每行只挡一次 → 消耗割草机
    const e2 = spawnEnemy(warded, def!, 0);
    e2.x = MOWER_LINE - 1;
    step(warded, SIM_DT_MS);
    expect(warded.mowers[0]).toBe(false);

    // 超出时限后：其他行不再享受护盾
    warded.now = 31_000;
    const e3 = spawnEnemy(warded, def!, 1);
    e3.x = MOWER_LINE - 1;
    step(warded, SIM_DT_MS);
    expect(warded.mowers[1]).toBe(false);
  });

  it('carried clearBonus 不改变初始状态（只在结算层生效）', () => {
    const s = createBattle({
      ...base,
      carriedItem: { id: 'lucky_clover', effect: { t: 'clearBonus', coinMult: 1.5, bonusSeeds: 1 } },
    });
    expect(s.lightdew).toBe(LV11.startingLight);
    expect(s.plantFood).toBe(0);
    expect(s.mowerWardUntil).toBe(0);
  });

  it('clearBonus 在结算层生效：金币倍率 + 额外种子券', () => {
    const plain = levelClearReward({ level: LV11, stars: 3, previousStars: null, totalStarsBefore: 0 });
    const boosted = levelClearReward({
      level: LV11,
      stars: 3,
      previousStars: null,
      totalStarsBefore: 0,
      carriedItem: { t: 'clearBonus', coinMult: 1.5, bonusSeeds: 1 },
    });
    expect(boosted.coins).toBe(Math.floor(plain.coins * 1.5));
    expect(boosted.seeds).toBe(plain.seeds + 1);
    expect(boosted.diamonds).toBe(plain.diamonds); // 其余奖励不受影响
  });
});

describe('M-INV redeem codes', () => {
  it('6666 is redeemable and grants bulk resources + items', () => {
    const hit = findRedeemCode('6666');
    expect(hit).not.toBeNull();
    const r = hit!.reward;
    expect(r.coins).toBeGreaterThan(0);
    expect(r.diamonds).toBeGreaterThan(0);
    expect(Object.keys(r.items ?? {}).length).toBeGreaterThan(0);
    // 发放的道具必须是真实道具
    for (const id of Object.keys(r.items ?? {})) {
      expect(itemById(id), `兑换码发放未知道具 ${id}`).toBeDefined();
    }
  });

  it('normalizes whitespace and case', () => {
    expect(normalizeCode('  6666 ')).toBe('6666');
    expect(findRedeemCode(' 6666 ')).not.toBeNull();
  });

  it('unknown / empty codes return null', () => {
    expect(findRedeemCode('nope')).toBeNull();
    expect(findRedeemCode('')).toBeNull();
    expect(findRedeemCode('   ')).toBeNull();
  });

  it('every code grants at least one reward field', () => {
    for (const [code, r] of Object.entries(REDEEM_CODES)) {
      const anyReward = (r.coins ?? 0) + (r.diamonds ?? 0) + (r.seeds ?? 0) + (r.plantFood ?? 0) + Object.keys(r.items ?? {}).length;
      expect(anyReward, `兑换码 ${code} 无任何奖励`).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});
