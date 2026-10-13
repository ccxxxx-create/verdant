import { describe, expect, it } from 'vitest';
import { DECK_CAP, ENEMY_BITE_DPS } from '../src/core/balance.ts';
import {
  BITE_DPS,
  SEED_SLOTS,
  SPEED_TIERS_S_PER_TILE,
  TOUGHNESS_TIERS,
  PVZ2_UNVERIFIED,
  speedTierOf,
  toughnessTierOf,
} from '../src/data/pvz2/mechanics.ts';
import { PVZ2_PLANTS, pvz2PlantByRepoUnit } from '../src/data/pvz2/plants.ts';
import { peashooterCurveMatchesPvz2, statsAtLevel, upgradeCost } from '../src/data/pvz2/leveling.ts';
import { PVZ2_ZOMBIES } from '../src/data/pvz2/zombies.ts';
import { ALL_ALIGNMENT } from '../src/data/pvz2/mapping.ts';
import { meadowUnits } from '../src/data/archetypes/units/meadow.ts';
import { meadowEnemies } from '../src/data/archetypes/enemies/meadow.ts';
import { LevelDef } from '../src/core/schema/level.ts';
import level11 from '../src/data/levels/meadow-1-1.json';
import level12 from '../src/data/levels/meadow-1-2.json';
import level13 from '../src/data/levels/meadow-1-3.json';
import level14 from '../src/data/levels/meadow-1-4.json';
import level15 from '../src/data/levels/meadow-1-5.json';
import level41 from '../src/data/levels/meadow-4-1.json';
import { registryFrom } from '../src/core/registry.ts';
import { allEnemies, allUnits } from '../src/data/archetypes/index.ts';
import { createBattle } from '../src/core/battle/sim.ts';
import { startWave, waveBudget } from '../src/core/battle/director.ts';
import { PLANT_FOOD_CAP } from '../src/core/battle/layout.ts';
import { SKY_SUN } from '../src/core/balance.ts';
import { SUN, PLANT_FOOD } from '../src/data/pvz2/mechanics.ts';

const REG = registryFrom(allUnits, allEnemies);

const unitById = new Map(meadowUnits.map((u) => [u.id, u]));

describe('PvZ2 参考数据集：完整性', () => {
  it('植物参考表字段合法且 repoUnit 不重复', () => {
    const repoUnits = PVZ2_PLANTS.map((p) => p.repoUnit).filter((x): x is string => !!x);
    expect(new Set(repoUnits).size).toBe(repoUnits.length);
    for (const p of PVZ2_PLANTS) {
      expect(p.cost, `${p.id} cost`).toBeGreaterThanOrEqual(0);
      expect(p.rechargeS, `${p.id} recharge`).toBeGreaterThan(0);
      expect(p.plantFood.length, `${p.id} plantFood`).toBeGreaterThan(0);
    }
  });

  it('映射表里引用的本仓单位 id 都真实存在', () => {
    for (const p of PVZ2_PLANTS) {
      if (p.repoUnit) expect(unitById.has(p.repoUnit), `${p.id} -> ${p.repoUnit}`).toBe(true);
    }
    for (const row of ALL_ALIGNMENT) {
      if (row.repoKind === 'unit') expect(unitById.has(row.repoId), row.repoId).toBe(true);
    }
  });

  it('僵尸参考表：普通僵尸 = 190 且强度档 Average（国际版现行口径）', () => {
    const basic = PVZ2_ZOMBIES.find((z) => z.id === 'basic');
    expect(basic?.hp).toBe(190);
    expect(basic?.toughness).toBe('average');
    expect(basic?.speed).toBe('basic');
    expect(toughnessTierOf(190)).toBe('average');
  });

  it('待查证清单非空（查不到的项必须显式挂账，不得静默）', () => {
    expect(PVZ2_UNVERIFIED.length).toBeGreaterThan(0);
  });
});

describe('PvZ2 参考数据集：与仓库取值一致（防漂移闸）', () => {
  it('牌组上限 = PvZ2 基础种子槽（单一事实源）', () => {
    expect(DECK_CAP).toBe(SEED_SLOTS.base);
  });

  it('有 PvZ2 对应的单位：cooldownMs 必须等于参考充能', () => {
    for (const p of PVZ2_PLANTS) {
      if (!p.repoUnit) continue;
      const u = unitById.get(p.repoUnit);
      expect(u, `${p.repoUnit} 缺失`).toBeTruthy();
      expect(u?.cooldownMs, `${p.repoUnit} 充能应为 ${p.rechargeS}s`).toBe(Math.round(p.rechargeS * 1000));
    }
  });

  it('啃食基准 = 100 dps（PvZ2 与 PvZ1 同口径）', () => {
    expect(BITE_DPS.base).toBe(100);
    expect(ENEMY_BITE_DPS).toBe(BITE_DPS.base);
  });

  it('有 PvZ2 对应的单位：cost 必须等于参考阳光花费', () => {
    for (const p of PVZ2_PLANTS) {
      if (!p.repoUnit) continue;
      const u = unitById.get(p.repoUnit);
      expect(u?.cost, `${p.repoUnit} 花费应为 ${p.cost}`).toBe(p.cost);
    }
  });

  it('非 Boss 敌人啃食 dps 统一 = ENEMY_BITE_DPS（PvZ2：所有僵尸啃食一致）', () => {
    for (const e of meadowEnemies) {
      if (e.isBoss) continue;
      expect(e.biteDps, `${e.id} 啃食应为基准值`).toBe(ENEMY_BITE_DPS);
    }
  });

  it('行蚁血量 = PvZ2 普通僵尸 190，且落在 Average 档', () => {
    const ant = meadowEnemies.find((e) => e.id === 'march_ant');
    expect(ant?.hp).toBe(190);
    expect(toughnessTierOf(ant?.hp ?? 0)).toBe('average');
    expect(toughnessTierOf(190)).toBe(PVZ2_ZOMBIES.find((z) => z.id === 'basic')?.toughness);
  });

  it('僵尸血量全表与 PvZ2 强度分档一致（防漂移）', () => {
    const expected: Record<string, number> = {
      march_ant: 190,
      iron_beak_sparrow: 270,
      gnaw_back_rat: 190,
      grey_tide_swarm: 100,
      vine_boa: 560,
      web_spider: 350,
      shell_raiser: 560,
      vine_gnawer: 490,
      lightdew_moth: 270,
      stone_hide_beast: 1290,
      stone_hide_giant: 3600,
    };
    for (const [id, hp] of Object.entries(expected)) {
      expect(meadowEnemies.find((e) => e.id === id)?.hp, id).toBe(hp);
    }
  });

  it('阳光面值与产出 = PvZ2 普通阳光 50（天空与向日葵同值）', () => {
    expect(SKY_SUN.value).toBe(SUN.normal);
    expect(unitById.get('firefly_reed')?.produce?.amount).toBe(SUN.normal);
    expect(unitById.get('twin_glow')?.produce?.amount).toBe(SUN.normal * 2);
  });

  it('能量豆上限 = PvZ2 基础 3', () => {
    expect(PLANT_FOOD_CAP).toBe(PLANT_FOOD.capBase);
  });
});

describe('PvZ2 对齐：预算与出怪密度（points 尺度耦合闸）', () => {
  const levels = [level11, level12, level13, level14, level15, level41].map((lv) => LevelDef.parse(lv));

  it('每关第 1 波至少出 1 只怪（HP 重锚后若 base 未同步会出现空波）', () => {
    for (const lv of levels) {
      const state = createBattle({ level: lv, units: REG.unitById, enemies: REG.enemyById, deck: [], seed: 1 });
      startWave(state);
      expect(state.spawnQueue.length, `${lv.id} 首波为空`).toBeGreaterThan(0);
    }
  });

  it('waveBudget 首波预算 ≥ 池内最低 points（预算能买到 1 只怪）', () => {
    for (const lv of levels) {
      const minPoints = Math.min(...lv.pool.map((id) => REG.enemyById.get(id)?.points ?? 0));
      expect(waveBudget(lv, 1), `${lv.id} 首波预算`).toBeGreaterThanOrEqual(minPoints);
    }
  });
});

describe('PvZ2 分档派生', () => {
  it('强度分档边界覆盖 10 档且无空洞', () => {
    expect(TOUGHNESS_TIERS.length).toBe(10);
    for (let i = 1; i < TOUGHNESS_TIERS.length; i++) {
      expect(TOUGHNESS_TIERS[i]!.min).toBe(TOUGHNESS_TIERS[i - 1]!.max + 1);
    }
    expect(toughnessTierOf(1)).toBe('fragile');
    expect(toughnessTierOf(100)).toBe('fragile');
    expect(toughnessTierOf(101)).toBe('average');
    expect(toughnessTierOf(200)).toBe('average');
    expect(toughnessTierOf(3600)).toBe('great');
    expect(toughnessTierOf(40000)).toBe('ultraUndying');
  });

  it('速度分档：5.0 秒/格 = basic；仓库行蚁（0.21 格/s）应落在 basic', () => {
    expect(SPEED_TIERS_S_PER_TILE.basic).toBe(5.0);
    expect(speedTierOf(5.0)).toBe('basic');
    const marchAnt = meadowEnemies.find((e) => e.id === 'march_ant');
    expect(marchAnt).toBeTruthy();
    expect(speedTierOf(1 / (marchAnt?.speed ?? 1))).toBe('basic');
  });
});

describe('PvZ2 植物等级曲线（Level 1~10）', () => {
  it('豌豆射手 Lv1~10 曲线与 PvZ2 逐级表完全一致', () => {
    expect(peashooterCurveMatchesPvz2()).toBe(true);
  });

  it('升级消耗来自 PvZ2 表（Lv2 = 3 种子包 / 50 金币；Lv10 = 225 / 8000）', () => {
    expect(upgradeCost(2)).toEqual({ seeds: 3, coins: 50 });
    expect(upgradeCost(10)).toEqual({ seeds: 225, coins: 8000 });
  });

  it('每级 +5 伤害 / +50 韧性；Lv5 起阳光花费降至 75', () => {
    const base = { damage: 20, hp: 300, cost: 100, rechargeMs: 5000 };
    const lv1 = statsAtLevel(base, 1);
    const lv3 = statsAtLevel(base, 3);
    expect(lv3.damage - lv1.damage).toBe(10);
    expect(lv3.hp - lv1.hp).toBe(100);
    expect(statsAtLevel(base, 4).cost).toBe(100);
    expect(statsAtLevel(base, 5).cost).toBe(75);
  });
});

describe('PvZ2 差距表自洽', () => {
  it('每条差距都能追溯到参考表或显式标注 no-counterpart', () => {
    for (const row of ALL_ALIGNMENT) {
      if (row.status === 'no-counterpart') expect(row.pvz2Id).toBeNull();
      expect(row.delta.length, `${row.repoId} delta 不能为空`).toBeGreaterThan(0);
    }
  });

  it('充能漂移行已收敛（thorn_pea 5s / wood_core 20s / twin_glow 10s）', () => {
    expect(pvz2PlantByRepoUnit('thorn_pea')?.rechargeS).toBe(5);
    expect(pvz2PlantByRepoUnit('wood_core')?.rechargeS).toBe(20);
    expect(pvz2PlantByRepoUnit('twin_glow')?.rechargeS).toBe(10);
  });
});
