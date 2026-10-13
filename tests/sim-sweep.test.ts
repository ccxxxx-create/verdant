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
import { SIM_DT_MS } from '../src/core/balance.ts';
import { cmdCollectDrop, cmdPlant, createBattle, step } from '../src/core/battle/sim.ts';
import type { BattleState } from '../src/core/battle/types.ts';

/**
 * 无头扫荡（PvZ2 对齐校准用）。默认 **跳过**，只在显式开启时运行：
 *   npm run sweep            # 默认 10 seeds
 *   npm run sweep -- 20      # 自定义 seeds
 * 或直接 `SIM_SWEEP=1 npx vitest run tests/sim-sweep.test.ts`。
 * 不进 CI 主路径（耗时随 seeds × 关卡线性增长）。
 */
// 仓库未引入 @types/node：局部声明 process.env（vitest 运行时由 Node 提供）。
declare const process: { env: Record<string, string | undefined> };

const RUN = process.env.SIM_SWEEP === '1';
const SEEDS = Number(process.env.SIM_SWEEP_SEEDS ?? 10);

const REG = registryFrom(allUnits, allEnemies);
const LEVELS = [level11, level12, level13, level14, level15, level41].map((lv) => LevelDef.parse(lv));

/** 真实解锁进度：初始赠送 2 + 前序关卡 unlockUnits 累积。 */
function ownedBefore(levelId: string): string[] {
  const owned = ['firefly_reed', 'thorn_pea'];
  for (const lv of LEVELS) {
    if (lv.id === levelId) break;
    for (const id of lv.unlockUnits) if (!owned.includes(id)) owned.push(id);
  }
  return owned;
}

function freeCell(state: BattleState, col: number): { row: number; col: number } | undefined {
  for (let row = 0; row < 6; row++) {
    if (!state.units.some((u) => u.row === row && u.col === col)) return { row, col };
  }
  return undefined;
}

function affordable(state: BattleState, id: string): boolean {
  const def = state.config.units.get(id);
  if (!def) return false;
  if (state.lightdew < def.cost) return false;
  const cd = state.cooldowns[id];
  return !cd || state.now >= cd.end;
}

/** 托管 AI：先铺产能（≤6）再补攻击；生产者钉 col1 起，col0 留给最后防线。 */
function tryPlant(state: BattleState, deck: string[]): boolean {
  const producers = state.units.filter((u) => u.def.role === 'producer');
  if (producers.length < 6) {
    const pid = deck.find((id) => state.config.units.get(id)?.role === 'producer' && affordable(state, id));
    if (pid) {
      const cell = freeCell(state, 1) ?? freeCell(state, 0);
      if (cell && cmdPlant(state, pid, cell.row, cell.col)) return true;
    }
  }
  const aid = deck.find((id) => {
    const d = state.config.units.get(id);
    return !!d?.attack && affordable(state, id);
  });
  if (aid) {
    for (const col of [0, 3, 2, 4, 5, 1]) {
      const cell = freeCell(state, col);
      if (cell && cmdPlant(state, aid, cell.row, cell.col)) return true;
    }
  }
  return false;
}

function run(level: LevelDef, deck: string[], seed: number, maxMs = 20 * 60 * 1000): BattleState {
  const state = createBattle({
    level,
    units: REG.unitById,
    enemies: REG.enemyById,
    deck: level.template === 'conveyor' ? [] : deck,
    seed,
  });
  let lastPlant = -9999;
  while (state.status === 'playing' && state.now < maxMs) {
    step(state, SIM_DT_MS);
    for (const d of [...state.drops]) if (!d.falling) cmdCollectDrop(state, d.did);
    if (state.now - lastPlant >= 1500 && tryPlant(state, deck)) lastPlant = state.now;
  }
  return state;
}

describe.skipIf(!RUN)('无头扫荡（PvZ2 对齐校准）', () => {
  it('输出各关胜率 / 平均时长 / 推车消耗', () => {
    console.log(`[sim-sweep] levels=${LEVELS.length} seeds=${SEEDS}`);
    console.log('level            waves  deck   win   avgS  mowers');
    for (const lv of LEVELS) {
      const deck = ownedBefore(lv.id);
      let wins = 0;
      let timeSum = 0;
      let mowerSum = 0;
      for (let s = 0; s < SEEDS; s++) {
        const st = run(lv, deck, 0x1000 + s * 7919);
        if (st.status === 'won') {
          wins++;
          timeSum += st.stats.elapsedMs;
        }
        mowerSum += st.stats.mowersUsed;
      }
      const avgS = wins ? (timeSum / wins / 1000).toFixed(0) : '-';
      console.log(
        `${lv.id.padEnd(15)} ${String(lv.waves).padStart(5)} ${String(deck.length).padStart(5)} ${`${wins}/${SEEDS}`.padStart(6)} ${avgS.padStart(6)} ${(mowerSum / SEEDS).toFixed(2).padStart(7)}`,
      );
    }
    expect(LEVELS.length).toBeGreaterThan(0);
  }, 600000);
});
