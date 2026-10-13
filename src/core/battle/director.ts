import type { BattleState } from './types.ts';
import type { EnemyArchetype } from '../schema/unit.ts';
import type { LevelDef } from '../schema/level.ts';
import type { EnemyInst } from './types.ts';
import { WAVE_PACING, SHIELD_HP, BOSS_SUMMON } from '../balance.ts';
import { SPAWN_X } from './layout.ts';

/** 大波判定：每 flagEvery 波 + 末波恒为大波（PvZ1 口径）。 */
export function isHugeWave(level: LevelDef, waveNumber: number): boolean {
  if (waveNumber <= 0) return false;
  return waveNumber % WAVE_PACING.flagEvery === 0 || waveNumber === level.waves;
}

/** 波次预算：round(BASE 脳 (1 + w 脳 GROWTH) 脳 SCALE 脳 大波系数)。 */
export function waveBudget(level: LevelDef, waveNumber: number): number {
  const scale = WAVE_PACING.scale[level.template] ?? 1;
  const huge = isHugeWave(level, waveNumber) ? WAVE_PACING.finalWaveMult : 1;
  return Math.max(1, Math.round(WAVE_PACING.base * (1 + waveNumber * WAVE_PACING.growth) * scale * huge));
}

export function firstWaveDelayMs(level: LevelDef): number {
  return (WAVE_PACING.firstWave[level.template] ?? WAVE_PACING.firstWave.default ?? 10) * 1000;
}

/** 波间间隔（播种 RNG：内核全随机走 state.rng，保模拟可复现）。 */
export function betweenWavesMs(state: BattleState): number {
  return (WAVE_PACING.betweenWaves.base + state.rng.next() * WAVE_PACING.betweenWaves.range) * 1000;
}

export function spawnIntervalMs(level: LevelDef): number {
  return (WAVE_PACING.spawnInterval[level.template] ?? WAVE_PACING.spawnInterval.default ?? 1.6) * 1000;
}

/** 池内"普通僵尸"替身：大波灌场用（取池内 points 最低者）。 */
function plainStandIn(pool: EnemyArchetype[]): EnemyArchetype | undefined {
  let best: EnemyArchetype | undefined;
  for (const e of pool) {
    if (e.isBoss || e.points <= 0) continue;
    if (!best || e.points < best.points) best = e;
  }
  return best;
}

/**
 * 规划一波的出怪队列（GDD §8.2 选择规则 + PvZ1 大波灌场）：
 * 1. 仅从本关池选随机；每个敌人前 3 波至少出现 1 次；同波同敌 ≤2
 *    （GDD"不连续 3 波同敌"跨波约束留 W7 量产时随模拟终校实现）
 * 2. 大波：强灌 min(points, 8) 只普通僵尸 + 剩余预算走随机
 * 3. Boss 模板末波追加 Boss（不计预算）
 */
export function planWave(state: BattleState): { id: string; row: number }[] {
  const { level } = state.config;
  const pool = level.pool.map((id) => state.config.enemies.get(id)).filter((e): e is EnemyArchetype => !!e && !e.isBoss && e.points > 0);
  const queue: { id: string; row: number }[] = [];
  if (pool.length === 0) return queue;

  // 注意：startWave 已先把 state.wave 置为"本波序号"，此处不得再 +1
  // （原实现 `state.wave + 1` 是双重递增 → 每波吃下一波预算、末波 ×2.5 大波系数从未生效，2026-10-14 修正）
  const w = state.wave;
  const budget = waveBudget(level, w);
  const huge = isHugeWave(level, w);
  const plain = plainStandIn(pool);

  if (huge && plain) {
    const n = Math.min(budget, WAVE_PACING.hugeWavePlain, plain.points > 0 ? Math.floor(budget / plain.points) : WAVE_PACING.hugeWavePlain);
    for (let i = 0; i < Math.max(0, n); i++) queue.push({ id: plain.id, row: state.rng.int(0, 6) });
  }

  let left = budget;
  // 前 3 波保底：每个池内敌人至少出现一次（**计入预算**）。
  // 原实现不扣预算，与随机段叠加后首波实际密度可达预算的 2 倍以上（群怪 1 点换 4 身体更放大），
  // 是 2026-10-14 "第一波出怪太多"的直接成因；预算不足则该敌顺延到后续波。
  if (w <= 3) {
    for (const e of pool) {
      if (e.points > left) continue;
      queue.push({ id: e.id, row: state.rng.int(0, 6) });
      left -= e.points;
    }
  }

  let guard = 0;
  const perWaveCount = new Map<string, number>();
  const maxPoints = Math.max(...pool.map((e) => e.points));
  while (left > 0 && guard++ < 120) {
    if (left < 1.2 * maxPoints) break; // 提前收波，避免残预算换怪破坏节奏
    const pick = pool[state.rng.int(0, pool.length)];
    if (!pick || pick.points <= 0) break;
    if (pick.points > left) continue;
    if ((perWaveCount.get(pick.id) ?? 0) >= 2) continue; // 同波同敌 ≤2
    queue.push({ id: pick.id, row: state.rng.int(0, 6) });
    perWaveCount.set(pick.id, (perWaveCount.get(pick.id) ?? 0) + 1);
    left -= pick.points;
  }

  if (level.template === 'boss' && w === level.waves) {
    const boss = [...state.config.enemies.values()].find((e) => e.isBoss);
    if (boss) queue.push({ id: boss.id, row: Math.floor(6 / 2) });
  }

  // 洗牌出怪顺序，避免同敌连续贴脸
  for (let i = queue.length - 1; i > 0; i--) {
    const j = state.rng.int(0, i + 1);
    const a = queue[i];
    const b = queue[j];
    if (a && b) {
      queue[i] = b;
      queue[j] = a;
    }
  }
  return queue;
}

/** 启动一波：填队列 + 记录波起始总血（供清场加速判定）。 */
export function startWave(state: BattleState): void {
  const w = state.wave + 1;
  state.wave = w;
  state.inWave = true;
  state.spawnQueue = planWave(state);
  state.spawnTimer = 500; // ms（波开始 0.5s 后出第一只）
  state.waveHpStart = totalEnemyHp(state);
  state.events.push({ t: 'waveStart', wave: w, final: w === state.config.level.waves });
  if (isHugeWave(state.config.level, w)) {
    state.events.push({ t: 'waveWarning' });
    state.events.push({ t: 'banner', text: '一大波僵尸正在接近！', hold: 1.8 });
  } else {
    state.events.push({ t: 'banner', text: `第 ${w} 波`, hold: 1 });
  }
}

export function totalEnemyHp(state: BattleState): number {
  let sum = 0;
  for (const e of state.enemies) sum += Math.max(0, e.hp);
  return sum;
}

/**
 * 波次推进（PvZ1 口径）：计时到期出下一波；
 * 上一波剩余血量 鈮?55% 且计时已过 4s 鈥 计时压到 2s（清场加速，治"关卡过长"）。
 */
export function updateWaves(state: BattleState, dtMs: number): void {
  if (state.status !== 'playing') return;
  if (!state.inWave) {
    state.waveTimer -= dtMs;
    if (state.waveTimer <= 0 && state.wave < state.config.level.waves) startWave(state);
    return;
  }
  // 出怪
  state.spawnTimer -= dtMs;
  if (state.spawnQueue.length > 0 && state.spawnTimer <= 0) {
    const item = state.spawnQueue.shift();
    if (item) spawnQueuedEnemy(state, item.id, item.row);
    state.spawnTimer = spawnIntervalMs(state.config.level);
  }
  // 清场加速
  const acc = WAVE_PACING.accelerate;
  state.waveAge += dtMs;
  if (
    state.waveTimer > acc.fastS * 1000 &&
    state.waveAge >= acc.afterS * 1000 &&
    state.waveHpStart > 0 &&
    totalEnemyHp(state) <= state.waveHpStart * acc.hpFrac
  ) {
    state.waveTimer = acc.fastS * 1000;
  }
  state.waveTimer -= dtMs;
  // 波结束判定：队列空 且 场上无敌人才收波（PvZ1：计时优先，不等全清）
  if (state.spawnQueue.length === 0 && state.waveTimer <= 0 && state.enemies.length === 0) {
    state.inWave = false;
    state.waveTimer = betweenWavesMs(state);
    if (state.wave >= state.config.level.waves) {
      state.status = 'won';
      state.events.push({ t: 'win' });
    }
  }
}

/** 出怪（swarm 展开 4 连、Boss 特例在 sim.ts 处理）。 */
export function spawnQueuedEnemy(state: BattleState, id: string, row: number): void {
  const def = state.config.enemies.get(id);
  if (!def) return;
  const swarm = def.traits.includes('swarm');
  const count = swarm ? 4 : 1;
  for (let i = 0; i < count; i++) {
    spawnEnemy(state, def, row, swarm ? -i * 46 : 0);
  }
}

/** 生成一个敌人实例（swarm 靠 xOffset 错开进场）。 */
export function spawnEnemy(state: BattleState, def: EnemyArchetype, row: number, xOffset = 0): EnemyInst {
  const e: EnemyInst = {
    eid: ++state.seq,
    def,
    row,
    hp: def.hp,
    maxHp: def.hp,
    x: SPAWN_X + xOffset,
    yOffset: 0,
    slowUntil: 0,
    burnUntil: 0,
    stunUntil: 0,
    flashUntil: 0,
    shield: def.traits.includes('shell_block_front') ? SHIELD_HP : 0,
    summoned: def.traits.includes('summon') ? false : undefined,
    revealed: false,
  };
  state.enemies.push(e);
  state.events.push({ t: 'enemySpawn', enemy: e });
  return e;
}

/** Boss 召唤（stone_hide_giant）：定时召唤灰潮，场上召唤物上限 maxAlive。 */
export function updateBossSummon(state: BattleState, dtMs: number): void {
  const boss = state.enemies.find((e) => e.def.isBoss);
  if (!boss) return;
  state.bossSummonTimer -= dtMs;
  if (state.bossSummonTimer > 0) return;
  state.bossSummonTimer = BOSS_SUMMON.intervalS * 1000;
  const countSummoned = (): number => state.enemies.filter((e) => e.summoned === true).length;
  if (countSummoned() >= BOSS_SUMMON.maxAlive) return;
  const n = state.rng.int(BOSS_SUMMON.minPerCast, BOSS_SUMMON.maxPerCast + 1);
  for (let i = 0; i < n; i++) {
    if (countSummoned() >= BOSS_SUMMON.maxAlive) break;
    const minion = state.config.enemies.get(BOSS_SUMMON.pool[0] ?? 'grey_tide_swarm');
    if (!minion) break;
    const row = Math.min(5, Math.max(0, boss.row + state.rng.int(-1, 2)));
    const spawned = spawnEnemy(state, minion, row);
    spawned.summoned = true;
  }
}
