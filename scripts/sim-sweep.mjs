#!/usr/bin/env node
/**
 * 无头扫荡入口（PvZ2 对齐校准用）。
 *
 * 用法：node scripts/sim-sweep.mjs [seeds]
 *
 * 实现说明：仓库内存在无扩展名相对导入（如 `./schema/unit`），Node 的 TS 类型剥离
 * 无法解析，因此真正的扫荡逻辑放在 `tests/sim-sweep.test.ts`（默认跳过），
 * 由本脚本通过 vitest 触发（vite 负责解析），既保留 scripts/ 入口又不必新增依赖。
 */
import { spawnSync } from 'node:child_process';

const seeds = process.argv[2] ?? '10';
const result = spawnSync('npx', ['vitest', 'run', 'tests/sim-sweep.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, SIM_SWEEP: '1', SIM_SWEEP_SEEDS: seeds },
});
process.exit(result.status ?? 1);
