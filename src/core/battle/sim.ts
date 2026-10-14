/**
 * Battle kernel main step (M3A): zero Phaser dependency, deterministic RNG, event output.
 * The scene is a rendering/input/FX shell: each frame step(state, dt), then drainEvents for FX.
 */
import type { BattleConfig, BattleState, BattleEvent, UnitInst, EnemyInst, ProjInst, DropInst } from './types.ts';
import { Rng } from '../rng.ts';
import {
  ARMOR_MULT,
  DECK_CAP,
  SKY_SUN,
  WAVE_PACING,
  enemyBiteDps,
} from '../balance.ts';
import {
  BITE_OFFSET,
  COL_W,
  HIT_R,
  MOWER_LINE,
  MULTI_SHOT_STAGGER_MS,
  PLANT_SUN_FALL_MS,
  PLANT_FOOD_CAP,
  PROJ_SPEED,
  ROWS,
  SUN_FALL_MS,
  SUN_PICK_R,
  SUN_REST_X0,
  SUN_REST_X1,
  SUN_REST_Y0,
  SUN_REST_Y1,
  cellX,
  cellY,
} from './layout.ts';
import {
  betweenWavesMs,
  firstWaveDelayMs,
  isHugeWave,
  spawnEnemy,
  spawnQueuedEnemy,
  startWave,
  totalEnemyHp,
  updateBossSummon,
  updateWaves,
} from './director.ts';
import {
  applyWebStun,
  auraIntervalFactor,
  controlStep,
  findBiteTarget,
  gnawPauseStep,
  isEnemySlowed,
  isEnemyStunned,
  isUnitStunned,
  mothEatStep,
  revealStep,
} from './traits.ts';
import { POWER_GENERIC_DAMAGE_MULT, isPowered, tickPowerUps, usePlantFoodAtCell, usePlantFoodOnUnit } from './power.ts';

export function createBattle(config: BattleConfig): BattleState {
  const deck = config.deck
    .map((id) => config.units.get(id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .slice(0, DECK_CAP)
    .map((u) => u.id);
  const effectiveDeck = deck.length > 0 ? deck : ['firefly_reed', 'thorn_pea'];
  const level = config.level;
  const conveyor = level.conveyor
    ? { hand: [] as string[], timer: level.conveyor.intervalMs, exhausted: [] as string[] }
    : null;
  // 出战携带道具（M-INV）：只修正初始状态，不引入新命令
  const carried = config.carriedItem?.effect;
  const bonusLightdew = carried?.t === 'bonusLightdew' ? carried.amount : 0;
  const bonusPlantFood = carried?.t === 'bonusPlantFood' ? carried.amount : 0;
  const mowerWardS = carried?.t === 'mowerWard' ? carried.durationS : 0;
  return {
    config: { ...config, deck: effectiveDeck },
    rng: new Rng(config.seed ?? 0x5eed),
    now: 0,
    lightdew: (conveyor ? 0 : level.startingLight) + bonusLightdew,
    plantFood: bonusPlantFood,
    units: [],
    enemies: [],
    projectiles: [],
    drops: [],
    mowers: Array.from({ length: ROWS }, () => true),
    mowerWardUntil: mowerWardS * 1000,
    mowerWardUsed: Array.from({ length: ROWS }, () => false),
    wave: 0,
    waveTimer: firstWaveDelayMs(level),
    waveAge: 0,
    waveHpStart: 0,
    inWave: false,
    spawnQueue: [],
    spawnTimer: 0,
    skySunTimer: SKY_SUN.firstS * 1000,
    conveyor,
    bossSummonTimer: 8000,
    cooldowns: {},
    warnedWaves: new Set<number>(),
    status: 'playing',
    stats: { kills: 0, peakUnits: 0, dug: 0, mowersUsed: 0, elapsedMs: 0 },
    seq: 0,
    events: [],
  };
}

/** Take and clear the event queue (the scene consumes it for FX). */
export function drainEvents(state: BattleState): BattleEvent[] {
  if (state.events.length === 0) return [];
  const out = state.events;
  state.events = [];
  return out;
}

/** Main step. dtMs is the already speed-scaled duration of this frame (the scene passes dt * speed). */
export function step(state: BattleState, dtMs: number): void {
  if (state.status !== 'playing' || dtMs <= 0) return;
  state.now += dtMs;
  state.stats.elapsedMs += dtMs;
  state.stats.peakUnits = Math.max(state.stats.peakUnits, state.units.length);

  updateSunSpawns(state, dtMs);
  updateDrops(state, dtMs);
  updateConveyor(state, dtMs);
  updateWaves(state, dtMs);
  updateUnits(state, dtMs);
  updateProjectiles(state, dtMs);
  updateEnemies(state, dtMs);
  updateBossSummon(state, dtMs);
  tickPowerUps(state);
  warnHugeWave(state);
}

function warnHugeWave(state: BattleState): void {
  if (state.inWave || state.wave >= state.config.level.waves) return;
  const next = state.wave + 1;
  if (!isHugeWave(state.config.level, next)) return;
  if (state.warnedWaves.has(next)) return;
  if (state.waveTimer > WAVE_PACING.warningS * 1000) return;
  state.warnedWaves.add(next);
  state.events.push({ t: 'banner', text: '一大波僵尸正在接近！', hold: 1.6 });
}

// 鈥斺€?露珠（阳光）鈥斺€?

function updateSunSpawns(state: BattleState, dtMs: number): void {
  state.skySunTimer -= dtMs;
  if (state.skySunTimer > 0) return;
  state.skySunTimer = (SKY_SUN.intervalMinS + state.rng.next() * (SKY_SUN.intervalMaxS - SKY_SUN.intervalMinS)) * 1000;
  const x = SUN_REST_X0 + state.rng.next() * (SUN_REST_X1 - SUN_REST_X0);
  const restY = SUN_REST_Y0 + state.rng.next() * (SUN_REST_Y1 - SUN_REST_Y0);
  const drop: DropInst = { did: ++state.seq, kind: 'light', x, y: -40, restY, life: SKY_SUN.restS, falling: true, age: 0, fallMs: SUN_FALL_MS };
  state.drops.push(drop);
  state.events.push({ t: 'sunSpawn', drop });
}

function spawnPlantSun(state: BattleState, u: UnitInst): void {
  const drop: DropInst = {
    did: ++state.seq,
    kind: 'light',
    x: u.x + 14,
    y: u.y - 70,
    restY: u.y - 44,
    life: SKY_SUN.restS,
    falling: true,
    age: 0,
    fallMs: PLANT_SUN_FALL_MS,
  };
  state.drops.push(drop);
  state.events.push({ t: 'sunSpawn', drop });
}

function updateDrops(state: BattleState, dtMs: number): void {
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const d = state.drops[i];
    if (!d) continue;
    if (d.falling) {
      d.age += dtMs;
      const t = Math.min(1, d.age / d.fallMs);
      d.y = -40 + (d.restY + 40) * t;
      if (t >= 1) d.falling = false;
      continue;
    }
    d.life -= dtMs / 1000;
    if (d.life <= 0) state.drops.splice(i, 1);
  }
}

function updateConveyor(state: BattleState, dtMs: number): void {
  const c = state.conveyor;
  if (!c) return;
  const cfg = state.config.level.conveyor;
  if (!cfg) return;
  c.timer -= dtMs;
  if (c.timer > 0) return;
  c.timer = cfg.intervalMs;
  if (c.hand.length >= cfg.handLimit) return; // full then pause emission
  const inHand = new Set(c.hand);
  const candidates = cfg.pool.filter((id) => !inHand.has(id));
  const pool = candidates.length > 0 ? candidates : cfg.pool;
  const pick = pool[state.rng.int(0, pool.length)];
  if (pick) c.hand.push(pick);
}

// 鈥斺€?单位行为鈥斺€?

function updateUnits(state: BattleState, dtMs: number): void {
  void dtMs;
  for (const u of [...state.units]) {
    if (u.hp <= 0) continue;
    if (isUnitStunned(state, u)) continue;
    if (u.def.control) controlStep(state, u);
    if (u.def.reveal) revealStep(state, u);

    // 产物（露珠只走掉落收集路径，反馈#7）
    if (u.def.produce && state.now - u.lastShot >= u.def.produce.intervalMs) {
      u.lastShot = state.now;
      spawnPlantSun(state, u);
      state.events.push({ t: 'shoot', x: u.x, y: u.y, element: 'none' });
      continue;
    }

    // 排队弹（三连发/大招连发）
    if (u.pendingShots.length > 0) {
      const ready = u.pendingShots.filter((s) => s.at <= state.now);
      if (ready.length > 0) {
        u.pendingShots = u.pendingShots.filter((s) => s.at > state.now);
        for (const s of ready) fireStraight(state, u, s.damage, s.element);
        continue;
      }
    }

    const a = u.def.attack;
    if (!a) continue;

    if (a.kind === 'trigger') {
      const prep = a.prepMs ?? 12000;
      if (state.now - u.lastShot < prep) continue;
      const reach = COL_W * ((a.radius ?? 1) + 0.2);
      let hitAny = false;
      for (const e of [...state.enemies]) {
        if (Math.abs(e.x - u.x) > reach) continue;
        damageEnemy(state, e, a.damage, a.element, false);
        hitAny = true;
      }
      if (!hitAny) continue;
      state.events.push({ t: 'blast', x: u.x, y: u.y });
      u.lastShot = state.now;
      removeUnit(state, u, true);
      continue;
    }

    const interval = (a.intervalMs ?? 1400) * auraIntervalFactor(state, u);
    if (state.now - u.lastShot < interval) continue;

    if (a.kind === 'aoe') {
      const radius = a.radius ?? 1;
      const area = state.enemies.filter(
        (e) => e.hp > 0 && Math.abs(e.row - u.row) <= radius && Math.abs(e.x - u.x) <= COL_W * (radius + 0.5),
      );
      if (area.length === 0) continue;
      u.lastShot = state.now;
      const dmg = poweredDamage(state, u, a.damage);
      for (const e of area) damageEnemy(state, e, dmg, a.element, true);
      state.events.push({ t: 'shoot', x: u.x, y: u.y, element: a.element });
      continue;
    }

    if (a.kind === 'lobbed') {
      const target = nearestEnemyAnyRow(state, u.x);
      if (!target) continue;
      u.lastShot = state.now;
      const dmg = poweredDamage(state, u, a.damage);
      fireLobbed(state, u, target, dmg, a.element);
      continue;
    }

    if (a.kind === 'melee') {
      const target = nearestEnemyInRow(state, u.row, u.x - 10);
      if (!target) continue;
      u.lastShot = state.now;
      damageEnemy(state, target, poweredDamage(state, u, a.damage), a.element, true);
      state.events.push({ t: 'shoot', x: u.x, y: u.y, element: a.element });
      continue;
    }

    // single / multi：真正 shots 连发（multi 不再是一发 N 倍伤）
    const target = nearestEnemyInRow(state, u.row, u.x - 20);
    if (!target) continue;
    u.lastShot = state.now;
    const shots = a.kind === 'multi' ? (a.shots ?? 3) : 1;
    const dmg = poweredDamage(state, u, a.damage);
    for (let i = 0; i < shots; i++) {
      u.pendingShots.push({ at: state.now + i * MULTI_SHOT_STAGGER_MS, damage: dmg, element: a.element });
    }
    state.events.push({ t: 'shoot', x: u.x, y: u.y - 24, element: a.element });
  }
}

function poweredDamage(state: BattleState, u: UnitInst, base: number): number {
  if (!isPowered(u, state.now)) return base;
  if ((u.def.power?.kind ?? 'generic') === 'generic') return base * POWER_GENERIC_DAMAGE_MULT;
  return base;
}

function fireStraight(state: BattleState, u: UnitInst, damage: number, element: string): void {
  const p: ProjInst = {
    pid: ++state.seq,
    row: u.row,
    sx: u.x + 40,
    sy: u.y - 24,
    x: u.x + 40,
    y: u.y - 24,
    damage,
    element,
    kind: 'straight',
    tx: 0,
    ty: 0,
    tRow: u.row,
    age: 0,
    duration: 0,
  };
  state.projectiles.push(p);
}

function fireLobbed(state: BattleState, u: UnitInst, target: EnemyInst, damage: number, element: string): void {
  const tx = target.x;
  const ty = target.yOffset;
  const dist = Math.abs(tx - u.x);
  const duration = Math.max(120, (dist / PROJ_SPEED) * 1000);
  const p: ProjInst = {
    pid: ++state.seq,
    row: u.row,
    sx: u.x + 20,
    sy: u.y - 40,
    x: u.x + 20,
    y: u.y - 40,
    damage,
    element,
    kind: 'lobbed',
    tx,
    ty,
    tRow: target.row,
    age: 0,
    duration,
  };
  state.projectiles.push(p);
  state.events.push({ t: 'shoot', x: u.x, y: u.y - 40, element });
}

function nearestEnemyInRow(state: BattleState, row: number, fromX: number): EnemyInst | undefined {
  let best: EnemyInst | undefined;
  for (const e of state.enemies) {
    if (e.row !== row || e.hp <= 0 || e.x < fromX) continue;
    if (!best || e.x < best.x) best = e;
  }
  return best;
}

function nearestEnemyAnyRow(state: BattleState, fromX: number): EnemyInst | undefined {
  let best: EnemyInst | undefined;
  for (const e of state.enemies) {
    if (e.hp <= 0 || e.x < fromX - COL_W) continue;
    if (!best || Math.abs(e.x - fromX) < Math.abs(best.x - fromX)) best = e;
  }
  return best;
}

function updateProjectiles(state: BattleState, dtMs: number): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    if (!p) continue;
    if (p.kind === 'lobbed') {
      p.age += dtMs;
      const t = Math.min(1, p.age / p.duration);
      p.x = p.sx + (p.tx - p.sx) * t;
      p.y = p.sy + (p.ty - p.sy) * t - Math.sin(t * Math.PI) * 130;
      if (p.age >= p.duration) {
        // Landing splash: full damage in the target row, 1/3 splash in adjacent rows
        for (const e of [...state.enemies]) {
          if (e.hp <= 0) continue;
          const sameRow = e.row === p.tRow;
          const splash = !sameRow && Math.abs(e.row - p.tRow) === 1;
          if (!sameRow && !splash) continue;
          if (Math.abs(e.x - p.tx) > (sameRow ? COL_W * 0.9 : COL_W * 0.5)) continue;
          damageEnemy(state, e, sameRow ? p.damage : p.damage / 3, p.element, true);
        }
        state.projectiles.splice(i, 1);
      }
      continue;
    }
    p.x += (PROJ_SPEED * dtMs) / 1000;
    const hit = nearestEnemyInRow(state, p.row, p.x - HIT_R);
    if (hit && Math.abs(hit.x - p.x) <= HIT_R) {
      applyProjectileHit(state, hit, p);
      state.projectiles.splice(i, 1);
    } else if (p.x > 1980) {
      state.projectiles.splice(i, 1);
    }
  }
}

function applyProjectileHit(state: BattleState, e: EnemyInst, p: ProjInst): void {
  // Iron door front block: straight projectiles absorbed by the shield (lobbed/aoe bypass)
  if (p.kind === 'straight' && e.shield > 0) {
    e.shield -= p.damage;
    e.flashUntil = state.now + 90;
    state.events.push({ t: 'hit', x: e.x, y: e.yOffset, damage: 0, element: p.element, target: 'enemy', tid: e.eid });
    if (e.shield <= 0) state.events.push({ t: 'shieldBreak', x: e.x, y: e.yOffset });
    return;
  }
  damageEnemy(state, e, p.damage, p.element, false);
}

/** Unified damage entrance: armor multiplier, elemental status, death event. */
export function damageEnemy(state: BattleState, e: EnemyInst, raw: number, element: string, ignoreArmor: boolean): void {
  if (e.hp <= 0) return;
  const mult = ignoreArmor ? 1 : (ARMOR_MULT[e.def.armor] ?? 1);
  const dmg = Math.round(raw * mult);
  e.hp -= dmg;
  e.flashUntil = state.now + 90;
  if (element === 'ice' && !(e.def.traits.includes('slow_immune') ?? false)) e.slowUntil = state.now + 2200;
  if (element === 'fire' && !(e.def.traits.includes('fire_resist') ?? false)) e.burnUntil = state.now + 4000;
  state.events.push({ t: 'hit', x: e.x, y: e.yOffset, damage: dmg, element, target: 'enemy', tid: e.eid });
  if (e.hp <= 0) killEnemy(state, e);
}

function killEnemy(state: BattleState, e: EnemyInst): void {
  const idx = state.enemies.indexOf(e);
  if (idx >= 0) state.enemies.splice(idx, 1);
  state.stats.kills += 1;
  state.events.push({ t: 'enemyDeath', enemy: e, x: e.x, y: e.yOffset });
  maybeDropPlantFood(state, e);
}

/** World energy drops: guaranteed 1 on the huge wave, 35% chance from wave 15. */
function maybeDropPlantFood(state: BattleState, e: EnemyInst): void {
  void e;
  if (state.status !== 'playing') return;
  const level = state.config.level;
  const hugeNow = isHugeWave(level, state.wave) && state.inWave;
  if (hugeNow && !state.warnedWaves.has(state.wave + 10000)) {
    state.warnedWaves.add(state.wave + 10000);
    spawnPlantFoodDrop(state);
    return;
  }
  if (state.wave >= 15 && state.rng.next() < 0.35) spawnPlantFoodDrop(state);
}

function spawnPlantFoodDrop(state: BattleState): void {
  const x = SUN_REST_X0 + state.rng.next() * (SUN_REST_X1 - SUN_REST_X0);
  const restY = SUN_REST_Y0 + state.rng.next() * (SUN_REST_Y1 - SUN_REST_Y0);
  const drop: DropInst = { did: ++state.seq, kind: 'plantFood', x, y: -40, restY, life: SKY_SUN.restS, falling: true, age: 0, fallMs: SUN_FALL_MS };
  state.drops.push(drop);
  state.events.push({ t: 'plantFoodSpawn', drop });
}

// 鈥斺€?敌人行为鈥斺€?

function updateEnemies(state: BattleState, dtMs: number): void {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (!e) continue;
    if (e.hp <= 0) {
      // 大招等路径留下的濒死敌人立即结算，防"尸体"移动/啃食/触发推车（审查 P1）
      killEnemy(state, e);
      continue;
    }
    const fireResist = e.def.traits.includes('fire_resist') ?? false;
    if (e.burnUntil > state.now) {
      e.hp -= (fireResist ? 7 : 15) * (dtMs / 1000);
    }
    if (e.flashUntil && e.flashUntil < state.now) e.flashUntil = 0;

    const stunned = isEnemyStunned(state, e);
    const slowImmune = e.def.traits.includes('slow_immune') ?? false;
    const slow = !slowImmune && isEnemySlowed(e, state.now) ? (e.def.flying ? 0.6 : 0.55) : 1;

    if (!stunned) {
      if (e.def.flying) {
        e.x -= e.def.speed * COL_W * slow * (dtMs / 1000);
        e.yOffset = Math.sin(state.now / 220) * 6;
        mothEatStep(state, e);
      } else {
        if (!e.biteTarget && gnawPauseStep(state, e, dtMs)) {
          // gnaw_pause: 本帧停下啃咬
        } else if (e.biteTarget) {
          const target = e.biteTarget;
          target.hp -= enemyBiteDps(e.def) * (dtMs / 1000);
          e.x = target.x + BITE_OFFSET;
          state.events.push({ t: 'hit', x: target.x, y: target.y, damage: 0, element: 'none', target: 'unit', tid: target.uid });
          if (target.hp <= 0) {
            removeUnit(state, target, true);
            e.biteTarget = undefined;
          }
        } else {
          const found = findBiteTarget(state, e);
          if (found) {
            e.biteTarget = found;
            applyWebStun(state, e, found);
          } else {
            e.x -= e.def.speed * COL_W * slow * (dtMs / 1000);
          }
        }
      }
    }

    if (e.x < MOWER_LINE) {
      const row = e.row;
      // 荆棘护盾（M-INV）：限时内每行首次突破免消耗割草机（只读判定，不新增命令）
      if (state.mowerWardUntil > state.now && !state.mowerWardUsed[row]) {
        state.mowerWardUsed[row] = true;
        state.events.push({ t: 'banner', text: '荆棘护盾挡住了！', hold: 1.1 });
        for (const other of [...state.enemies]) {
          if (other.row === row && other.hp > 0) {
            other.hp = 0;
            killEnemy(state, other);
          }
        }
        continue;
      }
      if (state.mowers[row]) {
        state.mowers[row] = false;
        state.stats.mowersUsed += 1;
        state.events.push({ t: 'mower', row });
        for (const other of [...state.enemies]) {
          if (other.row === row && other.hp > 0) {
            other.hp = 0;
            killEnemy(state, other);
          }
        }
        continue;
      }
      state.status = 'lost';
      state.events.push({ t: 'lose' });
      return;
    }
    if (e.hp <= 0) killEnemy(state, e);
  }

  // Boss 关：Boss 死亡即通关
  if (state.config.level.template === 'boss' && state.status === 'playing') {
    const bossAlive = state.enemies.some((e) => e.def.isBoss);
    if (!bossAlive && state.wave >= state.config.level.waves) {
      state.status = 'won';
      state.events.push({ t: 'win' });
    }
  }
}

export function removeUnit(state: BattleState, u: UnitInst, byDeath: boolean): void {
  const idx = state.units.indexOf(u);
  if (idx >= 0) state.units.splice(idx, 1);
  for (const e of state.enemies) {
    if (e.biteTarget === u) {
      e.biteTarget = undefined;
    }
  }
  state.events.push(byDeath ? { t: 'unitDeath', unit: u, x: u.x, y: u.y } : { t: 'dig', unit: u });
}

// 鈥斺€?命令（输入层调用）鈥斺€?

export function cmdPlant(state: BattleState, unitId: string, row: number, col: number): boolean {
  if (state.status !== 'playing') return false;
  const def = state.config.units.get(unitId);
  if (!def) return false;
  if (state.units.some((u) => u.row === row && u.col === col)) return false;

  const fromConveyor = state.conveyor?.hand.includes(unitId) ?? false;
  if (!fromConveyor && !state.config.deck.includes(unitId)) return false;
  if (!fromConveyor && state.lightdew < def.cost) return false;
  if (!fromConveyor) {
    const cd = state.cooldowns[unitId];
    if (cd && state.now < cd.end) return false;
  }

  const u: UnitInst = {
    uid: ++state.seq,
    def,
    row,
    col,
    x: cellX(col),
    y: cellY(row),
    hp: def.hp,
    lastShot: state.now,
    pendingShots: [],
    powerUntil: 0,
    stunUntil: 0,
    controlled: new Set<number>(),
  };
  state.units.push(u);
  if (fromConveyor) {
    const c = state.conveyor;
    if (c) {
      const i = c.hand.indexOf(unitId);
      if (i >= 0) c.hand.splice(i, 1);
    }
  } else {
    state.lightdew -= def.cost;
    state.cooldowns[unitId] = { start: state.now, end: state.now + def.cooldownMs };
  }
  state.events.push({ t: 'plant', unit: u });
  return true;
}

export function cmdDig(state: BattleState, row: number, col: number): boolean {
  if (state.status !== 'playing') return false;
  const u = state.units.find((x) => x.row === row && x.col === col);
  if (!u) return false;
  state.stats.dug += 1;
  removeUnit(state, u, false);
  return true;
}

export function cmdCollectDrop(state: BattleState, dropId: number): boolean {
  const idx = state.drops.findIndex((d) => d.did === dropId && !d.falling);
  if (idx < 0) return false;
  const d = state.drops[idx];
  if (!d) return false;
  state.drops.splice(idx, 1);
  if (d.kind === 'light') {
    state.lightdew += SKY_SUN.value;
    state.events.push({ t: 'sunCollect', did: d.did, x: d.x, y: d.y, amount: SKY_SUN.value });
  } else {
    state.plantFood = Math.min(PLANT_FOOD_CAP, state.plantFood + 1);
    state.events.push({ t: 'plantFoodCollect', did: d.did, x: d.x, y: d.y });
  }
  return true;
}

export function cmdUsePlantFoodOnUnit(state: BattleState, uid: number): boolean {
  return usePlantFoodOnUnit(state, uid);
}

export function cmdUsePlantFoodAtCell(state: BattleState, row: number, col: number): boolean {
  return usePlantFoodAtCell(state, row, col);
}

/** Sun collection hit test helper (the scene calls it after pointerdown). */
export function findCollectableDrop(state: BattleState, px: number, py: number): DropInst | undefined {
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const d = state.drops[i];
    if (!d || d.falling) continue;
    if (Math.hypot(px - d.x, py - d.y) <= SUN_PICK_R) return d;
  }
  return undefined;
}



export { firstWaveDelayMs, betweenWavesMs, spawnQueuedEnemy, spawnEnemy, totalEnemyHp };

