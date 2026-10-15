import { describe, expect, it } from 'vitest';
import { LevelDef } from '../src/core/schema/level.ts';
import level11 from '../src/data/levels/meadow-1-1.json';
import level12 from '../src/data/levels/meadow-1-2.json';
import level13 from '../src/data/levels/meadow-1-3.json';
import level14 from '../src/data/levels/meadow-1-4.json';
import level15 from '../src/data/levels/meadow-1-5.json';
import level41 from '../src/data/levels/meadow-4-1.json';
import { registryFrom } from '../src/core/registry.ts';
import { allEnemies, allUnits } from '../src/data/archetypes/index.ts';
import { SIM_DT_MS, SHIELD_HP, SKY_SUN } from '../src/core/balance.ts';
import { cellX } from '../src/core/battle/layout.ts';
import {
  cmdCollectDrop,
  cmdPlant,
  cmdUsePlantFoodOnUnit,
  createBattle,
  drainEvents,
  findCollectableDrop,
  spawnEnemy,
  step,
} from '../src/core/battle/sim.ts';
import { findBiteTarget } from '../src/core/battle/traits.ts';
import { BITE_OFFSET, BITE_LOCK_SLACK } from '../src/core/battle/layout.ts';
import type { BattleState } from '../src/core/battle/types.ts';
import { firstWaveDelayMs, isHugeWave, waveBudget } from '../src/core/battle/director.ts';

const REG = registryFrom(allUnits, allEnemies);

const LEVELS = [level11, level12, level13, level14, level15, level41].map((lv) => LevelDef.parse(lv));

function levelById(id: string): LevelDef {
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) throw new Error(`unknown level ${id}`);
  return lv;
}

/** 托管牌组：2 产物 + 5 攻击 + 1 防御（M3 模拟基线牌组，选卡面板默认截前 8 同口径）。 */
const SIM_DECK = ['firefly_reed', 'twin_glow', 'thorn_pea', 'frost_pea', 'trifold_arrow', 'ember_fluff', 'lob_shroom', 'wood_core'];

function battle(levelId: string, deck: string[] = SIM_DECK, seed = 0x5eed): BattleState {
  const level = levelById(levelId);
  return createBattle({ level, units: REG.unitById, enemies: REG.enemyById, deck, seed });
}

/** 简单托管 AI：收全部落地露珠 + 每 1.5s 补一次种植（先产物后攻击）。 */
function runHeadless(levelId: string, seed: number, maxGameMs = 20 * 60 * 1000): BattleState {
  const state = battle(levelId, levelById(levelId).template === 'conveyor' ? [] : SIM_DECK, seed);
  let lastPlantAt = -9999;
  while (state.status === 'playing' && state.now < maxGameMs) {
    step(state, SIM_DT_MS);
    for (const d of [...state.drops]) {
      if (!d.falling) cmdCollectDrop(state, d.did);
    }
    if (state.now - lastPlantAt >= 1500 && tryPlant(state)) lastPlantAt = state.now;
  }
  return state;
}

function tryPlant(state: BattleState): boolean {
  const freeCell = (col: number): { row: number; col: number } | undefined => {
    for (let row = 0; row < 6; row++) {
      if (!state.units.some((u) => u.row === row && u.col === col)) return { row, col };
    }
    return undefined;
  };
  const affordable = (id: string): boolean => {
    const def = state.config.units.get(id);
    if (!def) return false;
    if (state.lightdew < def.cost) return false;
    const cd = state.cooldowns[id];
    return !cd || state.now >= cd.end;
  };
  const producers = state.units.filter((u) => u.def.role === 'producer');
  if (producers.length < 6) {
    const pid = SIM_DECK.find((id) => state.config.units.get(id)?.role === 'producer' && affordable(id));
    if (pid) {
      // 生产者钉 col1 起，col0 留给"最后防线"攻击植物：子弹向右，越过 col2 防线的敌人只有 col0/col1 植物够得着（藤蟒啃 col0 生产者致死循环事故，2026-10-12 节奏对齐后暴露）
      const cell = freeCell(1) ?? freeCell(0);
      if (cell && cmdPlant(state, pid, cell.row, cell.col)) return true;
    }
  }
  const aid = SIM_DECK.find((id) => {
    const d = state.config.units.get(id);
    return !!d?.attack && affordable(id);
  });
  if (aid) {
    for (const col of [0, 3, 2, 4, 5, 1]) {
      const cell = freeCell(col);
      if (cell && cmdPlant(state, aid, cell.row, cell.col)) return true;
    }
  }
  return false;
}

function snapshot(state: BattleState): Record<string, unknown> {
  return {
    status: state.status,
    kills: state.stats.kills,
    mowersUsed: state.stats.mowersUsed,
    wave: state.wave,
    lightdew: state.lightdew,
    plantFood: state.plantFood,
    elapsedMs: state.stats.elapsedMs,
    units: state.units.map((u) => [u.uid, u.hp]),
    enemies: state.enemies.map((e) => [e.eid, Math.round(e.hp)]),
  };
}

describe('M3A battle kernel: wave pacing (PvZ2 口径)', () => {
  const lv = levelById('meadow-1-1');
  it('isHugeWave：末波恒为大波，flagEvery=10 中间波不触发', () => {
    expect(isHugeWave(lv, lv.waves)).toBe(true);
    expect(isHugeWave(lv, 3)).toBe(false); // 中间波（非末波、非 10 的倍数）
    expect(isHugeWave(lv, 0)).toBe(false);
  });

  it('waveBudget：teach 缩放 0.35 + 终波 ×2.5', () => {
    expect(waveBudget(lv, 1)).toBe(4); // round(8 × 1.3 × 0.35) = round(3.64)；base 8 = PvZ2 速度对齐后重校（对冲僵尸提速）
    expect(waveBudget(lv, lv.waves)).toBeGreaterThan(waveBudget(lv, 1) * 2);
  });

  it('firstWaveDelayMs：全关卡 2s（PvZ2 权威口径：关卡开始 2 秒后首波）', () => {
    expect(firstWaveDelayMs(lv)).toBe(2000);
  });
});

describe('M3A battle kernel: cmdPlant 校验', () => {
  it('拒绝不在牌组 / 光露不足 / 冷却中 / 占用格', () => {
    const state = battle('meadow-1-1', ['thorn_pea']);
    expect(cmdPlant(state, 'firefly_reed', 0, 0)).toBe(false); // 不在牌组
    state.lightdew = 5;
    expect(cmdPlant(state, 'thorn_pea', 0, 0)).toBe(false); // 光露不足
    state.lightdew = 500;
    expect(cmdPlant(state, 'thorn_pea', 0, 0)).toBe(true);
    expect(cmdPlant(state, 'thorn_pea', 1, 1)).toBe(false); // 冷却中
    delete state.cooldowns['thorn_pea'];
    expect(cmdPlant(state, 'thorn_pea', 0, 0)).toBe(false); // (row0,col0) 已占用
  });
});

describe('M3A battle kernel: traits', () => {
  it('铁门正面格挡：直射弹扣盾不掉血', () => {
    const state = battle('meadow-1-1', ['thorn_pea']);
    state.lightdew = 1000;
    expect(cmdPlant(state, 'thorn_pea', 2, 0)).toBe(true);
    const def = state.config.enemies.get('shell_raiser');
    if (!def) throw new Error('shell_raiser missing');
    const e = spawnEnemy(state, def, 2);
    e.x = cellX(4);
    const hp0 = e.hp;
    let shieldSeen = false;
    for (let i = 0; i < 60; i++) {
      step(state, SIM_DT_MS); // 3s 内豌豆必然首发（intervalMs 1350）+ 弹飞行 ~1.2s
      if (e.shield < SHIELD_HP) shieldSeen = true;
      if (shieldSeen) break;
    }
    expect(shieldSeen).toBe(true);
    expect(e.hp).toBe(hp0); // 盾未破前本体无伤
  });

  it('generic 大招：无 power 配置的单位 8s 强化期内伤害 ×2（thorn_pea 配 multi_shot 不适用，改用 frost_pea）', () => {
    const state = battle('meadow-1-1', ['frost_pea']);
    state.lightdew = 1000;
    expect(cmdPlant(state, 'frost_pea', 0, 0)).toBe(true);
    const u = state.units[0];
    if (!u) throw new Error('plant failed');
    expect(u.def.power).toBeUndefined(); // 前置：无专属大招配置 → generic
    const ant = state.config.enemies.get('march_ant');
    if (!ant) throw new Error('march_ant missing');
    const e = spawnEnemy(state, ant, 0);
    e.x = cellX(5);
    state.plantFood = 1;
    expect(cmdUsePlantFoodOnUnit(state, u.uid)).toBe(true);
    expect(state.plantFood).toBe(0);
    for (let i = 0; i < 80 && u.pendingShots.length === 0; i++) step(state, SIM_DT_MS); // 首攻 tick（interval 1350ms 内）
    expect(u.pendingShots.length).toBeGreaterThan(0);
    expect(u.pendingShots[0]?.damage).toBe((u.def.attack?.damage ?? 0) * 2); // 强化 ×2
  });

  it('啃食锁定窗口：远距不瞬移、贴脸才锁定（BITE_LOCK_SLACK 回归防线）', () => {    const state = battle('meadow-1-1', ['thorn_pea']);
    state.lightdew = 1000;
    expect(cmdPlant(state, 'thorn_pea', 2, 0)).toBe(true);
    const u = state.units[0];
    if (!u) throw new Error('plant failed');
    const ant = state.config.enemies.get('march_ant');
    if (!ant) throw new Error('march_ant missing');
    const e = spawnEnemy(state, ant, 2);
    // 窗口外（提前量 100px > BITE_LOCK_SLACK）：不得锁定（否则锁定即瞬移 100px）
    e.x = u.x + BITE_OFFSET + 100;
    expect(findBiteTarget(state, e)).toBeUndefined();
    // 窗口内（贴脸 +10px）：锁定
    e.x = u.x + BITE_OFFSET + 10;
    expect(findBiteTarget(state, e)).toBe(u);
    // 深入窗口左界（-12px，越过嘴位）：不锁定（由推犁线/MOWER_LINE 负责）
    e.x = u.x + BITE_OFFSET - 12;
    expect(findBiteTarget(state, e)).toBeUndefined();
  });

  it('僵尸走到嘴边才咬：远距锁定被禁，行内不掉血', () => {
    const state = battle('meadow-1-1', ['frost_pea']);
    state.lightdew = 1000;
    expect(cmdPlant(state, 'frost_pea', 2, 0)).toBe(true);
    const u = state.units[0];
    if (!u) throw new Error('plant failed');
    const ant = state.config.enemies.get('march_ant');
    if (!ant) throw new Error('march_ant missing');
    const e = spawnEnemy(state, ant, 2);
    e.x = u.x + BITE_OFFSET + 100; // 隔着 100px 站着
    // 瞬移防线：biteTarget 锁定前每帧植物不掉血（移近靠行走完成；旧窗口 129px 会"锁定即跳咬"）
    let lockedAt = -1;
    for (let i = 0; i < 60; i++) {
      step(state, SIM_DT_MS);
      if (e.biteTarget) {
        lockedAt = i;
        break;
      }
      expect(u.hp).toBe(u.def.hp);
    }
    expect(lockedAt).toBeGreaterThan(0); // 走了一段才锁定，不是瞬移
    // 锁定后吸附到嘴边（dx 落入窗口）
    expect(e.x - BITE_OFFSET - u.x).toBeLessThan(BITE_LOCK_SLACK);
  });
});

describe('M3A battle kernel: conveyor', () => {
  it('定时发牌不超上限，手牌种植免费免冷却', () => {
    const state = battle('meadow-4-1', []);
    expect(state.conveyor).toBeTruthy();
    expect(state.lightdew).toBe(0);
    for (let i = 0; i < 140; i++) step(state, SIM_DT_MS); // 7s：首张必到手
    const hand = state.conveyor?.hand;
    expect(hand?.length ?? 0).toBeGreaterThan(0);
    expect(hand?.length ?? 0).toBeLessThanOrEqual(5);
    const pick = hand?.[0];
    expect(pick).toBeTruthy();
    if (pick) {
      const before = state.lightdew;
      expect(cmdPlant(state, pick, 0, 0)).toBe(true);
      expect(state.lightdew).toBe(before); // 不扣费
      expect(state.cooldowns[pick]).toBeUndefined(); // 不进冷却
    }
  });
});

describe('M3A battle kernel: determinism & headless sweep', () => {
  it('同种子两局终态完全一致（确定性）', () => {
    const a = runHeadless('meadow-1-1', 0xa11ce);
    const b = runHeadless('meadow-1-1', 0xa11ce);
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it.each(LEVELS.map((lv) => [lv.id, lv.template] as const))('%s 托管模拟终态合法', (levelId) => {
    const s1 = runHeadless(levelId, 0x5eed);
    expect(['won', 'lost']).toContain(s1.status);
    expect(s1.lightdew).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(s1.lightdew)).toBe(true);
    expect(Number.isFinite(s1.stats.elapsedMs)).toBe(true);
    // 不变式：同格至多一单位
    const cells = new Set(s1.units.map((u) => `${u.row},${u.col}`));
    expect(cells.size).toBe(s1.units.length);
  });

  it('meadow-1-1（教学关）托管可胜——M3A 重锚后难度底线', () => {
    let wins = 0;
    const runs = 5;
    for (let i = 0; i < runs; i++) {
      if (runHeadless('meadow-1-1', 0xbeef + i).status === 'won') wins++;
    }
    expect(wins).toBe(runs); // teach 关 8 卡托管必须全胜，否则数值重锚过紧
  });

  it('事件队列 drain 后清空（场景消费协议）', () => {
    const state = battle('meadow-1-1');
    for (let i = 0; i < 20; i++) step(state, SIM_DT_MS);
    drainEvents(state);
    expect(state.events.length).toBe(0);
    expect(drainEvents(state).length).toBe(0);
  });

  it('findCollectableDrop 默认只匹配已落地露珠；includeFalling 放下落可收', () => {
    const state = battle('meadow-1-1');
    for (let i = 0; i < 110; i++) step(state, SIM_DT_MS); // 首滴 4.25s 天降 → 必有露珠
    const anyDrop = state.drops[0];
    expect(anyDrop).toBeTruthy();
    if (!anyDrop) return;
    const before = state.lightdew;
    if (anyDrop.falling) {
      expect(findCollectableDrop(state, anyDrop.x, anyDrop.y)).toBeUndefined(); // 默认不收落空中的
      // 用户反馈 2026-10-15：下落过程也可点（opts.includeFalling）
      expect(findCollectableDrop(state, anyDrop.x, anyDrop.y, { includeFalling: true })?.did).toBe(anyDrop.did);
      expect(cmdCollectDrop(state, anyDrop.did, { includeFalling: true })).toBe(true);
      expect(state.lightdew).toBe(before + SKY_SUN.value);
      expect(state.drops.find((d) => d.did === anyDrop.did)).toBeUndefined(); // 已入袋
    } else {
      expect(findCollectableDrop(state, anyDrop.x, anyDrop.y)?.did).toBe(anyDrop.did);
      expect(cmdCollectDrop(state, anyDrop.did)).toBe(true);
      expect(state.lightdew).toBe(before + SKY_SUN.value);
    }
  });
});

describe('lobbed same-row & dandelion homing（用户反馈 2026-10-15）', () => {
  it('雾菇只投本行：异行敌人不触发投射', () => {
    const state = battle('meadow-1-1', ['lob_shroom']);
    state.lightdew = 1000;
    expect(cmdPlant(state, 'lob_shroom', 2, 0)).toBe(true);
    const ant = state.config.enemies.get('march_ant');
    if (!ant) throw new Error('march_ant missing');
    spawnEnemy(state, ant, 4); // 异行
    for (let i = 0; i < 120; i++) step(state, SIM_DT_MS); // 6s 够反射击
    expect(state.projectiles.filter((p) => p.kind === 'lobbed')).toHaveLength(0);
  });

  it('雾菇本行投射：弧线终点落在本行命中高度（ty=发射者行 y-24）', () => {
    const state = battle('meadow-1-1', ['lob_shroom']);
    state.lightdew = 1000;
    expect(cmdPlant(state, 'lob_shroom', 2, 0)).toBe(true);
    const u = state.units[0];
    if (!u) throw new Error('plant failed');
    const ant = state.config.enemies.get('march_ant');
    if (!ant) throw new Error('march_ant missing');
    spawnEnemy(state, ant, 2); // 同行
    let shot = null;
    for (let i = 0; i < 120 && !shot; i++) {
      step(state, SIM_DT_MS);
      shot = state.projectiles.find((p) => p.kind === 'lobbed') ?? null;
    }
    expect(shot).toBeTruthy();
    if (!shot) return;
    expect(shot.row).toBe(2);
    expect(shot.tRow).toBe(2);
    expect(shot.ty).toBe(u.y - 24); // 弹道修正：旧实现 ty=yOffset 致弧线飞顶屏
  });

  it('蒲公英追踪种子：跨行命中且射的是全场最左敌人', () => {
    const state = battle('meadow-1-1', ['dandelion']);
    state.lightdew = 1000;
    expect(cmdPlant(state, 'dandelion', 0, 0)).toBe(true);
    const ant = state.config.enemies.get('march_ant');
    if (!ant) throw new Error('march_ant missing');
    const eTop = spawnEnemy(state, ant, 5); // 远行
    eTop.x = 1500;
    const eLow = spawnEnemy(state, ant, 2); // 更左（更靠家）
    eLow.x = 1200;
    let homing = null;
    for (let i = 0; i < 60 && !homing; i++) {
      step(state, SIM_DT_MS);
      homing = state.projectiles.find((p) => p.kind === 'homing') ?? null;
    }
    expect(homing).toBeTruthy();
    if (!homing) return;
    expect(homing.element).toBe('wind');
    expect(homing.targetEid).toBe(eLow.eid); // 全场最左优先（不分行）
    // 追击直到命中：目标在异行（row2 vs 发射者 row0）——跨行能力本体
    for (let i = 0; i < 200 && eLow.hp > 0; i++) step(state, SIM_DT_MS);
    expect(eLow.hp).toBeLessThan(eLow.maxHp);
    expect(eTop.hp).toBe(eTop.maxHp); // 不打非锁定目标
  });

  it('蒲公英追踪种子：目标死亡即消散（不留幽灵弹）', () => {
    const state = battle('meadow-1-1', ['dandelion']);
    state.lightdew = 1000;
    expect(cmdPlant(state, 'dandelion', 0, 0)).toBe(true);
    const ant = state.config.enemies.get('march_ant');
    if (!ant) throw new Error('march_ant missing');
    const e = spawnEnemy(state, ant, 3);
    e.x = 1200;
    let homing = null;
    for (let i = 0; i < 60 && !homing; i++) {
      step(state, SIM_DT_MS);
      homing = state.projectiles.find((p) => p.kind === 'homing') ?? null;
    }
    expect(homing).toBeTruthy();
    if (!homing) return;
    // 目标死亡（内核敌人被移除，eid 作废）
    const idx = state.enemies.indexOf(e);
    if (idx >= 0) state.enemies.splice(idx, 1);
    for (let i = 0; i < 20; i++) step(state, SIM_DT_MS);
    expect(state.projectiles.some((p) => p.pid === homing.pid)).toBe(false);
  });

  it('蒲公英数值：50 伤 / 1900ms 间隔 / 275 阳光 / 15s 充能（PvZ2 同名全对齐）', () => {
    const def = REG.unitById.get('dandelion');
    if (!def) throw new Error('dandelion missing from registry');
    expect(def.attack?.kind).toBe('homing');
    expect(def.attack?.damage).toBe(50);
    expect(def.attack?.intervalMs).toBe(1900);
    expect(def.cost).toBe(275);
    expect(def.cooldownMs).toBe(15000);
  });
});
