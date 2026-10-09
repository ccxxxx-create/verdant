import type { PixelSprite } from '../palette.ts';

/**
 * 草原战斗场景像素背景（320×180 逻辑网格，运行时 ×6 放大到 1920×1080）。
 * 几何与战斗网格单一事实源：HUD 高 132px（bg 22 行），游戏区 y150–1040（bg 25–173）。
 * 六车道刈纹带与 BattleScene 的 6 行车道逐一对齐（每车道 bg≈24.7 行）。
 * 代码生成+确定性种子：天空带/太阳/树线/雾抖动/六车道刈纹/草屑散布/左侧栅栏。
 */

const W = 320;
const H = 180;
/** 战斗网格参数（与 BattleScene 保持一致：GRID_Y0=150, ROW_H=148.33, GRID_X0=150） */
const GRID_TOP_BG = 25; // 150 / 6
const LANE_H_BG = (1040 - 150) / 6 / 6; // ≈ 24.72

const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));

function set(y: number, x: number, ch: string): void {
  if (y < 0 || y >= H || x < 0 || x >= W) return;
  const row = grid[y];
  if (row) row[x] = ch;
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 天空带色（上深下浅，仅 HUD 后 22 行可见，故收敛为深→中） */
const SKY: [number, string][] = [
  [10, 'q'],
  [8, 'g'],
  [7, 'L'],
];

/** 树线高度函数（确定性；右侧密左侧疏） */
function treeLine(x: number): number {
  const t = (x * 2654435761) % 100;
  const base = x > 220 ? 20 : x > 120 ? 12 : 5;
  return base + Math.floor(t / 14);
}

export function meadowBattleBg(): PixelSprite {
  // 1. 天空（HUD 后：深青→雾青）
  let y = 0;
  for (const [rows, ch] of SKY) {
    for (let i = 0; i < rows && y < H; i++, y++) {
      for (let x = 0; x < W; x++) set(y, x, ch);
    }
  }

  // 2. 太阳（右侧，半悬地平线）
  const sunX = 262;
  const sunY = 17;
  const sunR = 11;
  for (let yy = -sunR; yy <= sunR; yy++) {
    for (let xx = -sunR; xx <= sunR; xx++) {
      if (xx * xx + yy * yy <= sunR * sunR) {
        set(sunY + yy, sunX + xx, xx * xx + yy * yy <= (sunR * 0.4) ** 2 ? 'W' : 'G');
      }
    }
  }

  // 3. 树线（贴游戏区顶：bg y25 附近）
  const horizon = GRID_TOP_BG;
  for (let x = 0; x < W; x++) {
    const h = treeLine(x);
    for (let i = 0; i < h; i++) set(horizon - 1 - i, x, 'K');
    set(horizon - 1, x, 'd');
  }

  // 4. 雾（地平线上两带，低密度抖动）
  for (let x = 0; x < W; x++) {
    for (let py = horizon - 4; py < horizon; py++) if ((x + py) % 3 === 0) set(py, x, 'W');
    for (let py = horizon - 8; py < horizon - 4; py++) if ((x * 3 + py) % 6 === 0) set(py, x, 'i');
  }

  // 5. 地面 + 六车道刈纹（与游戏 6 行逐一对齐）
  for (let py = horizon; py < H; py++) {
    for (let x = 0; x < W; x++) set(py, x, 'M');
  }
  for (let lane = 0; lane < 6; lane++) {
    const y0 = Math.round(horizon + lane * LANE_H_BG);
    const y1 = Math.round(horizon + (lane + 1) * LANE_H_BG);
    for (let py = y0; py < y1 && py < H; py++) {
      const mid = py - y0;
      const hgt = y1 - y0;
      for (let x = 0; x < W; x++) set(py, x, mid >= 3 && mid < hgt - 3 ? 'L' : 'M');
    }
  }

  // 6. 草屑与小花
  const rnd = mulberry(20261009);
  for (let i = 0; i < 700; i++) {
    const x = Math.floor(rnd() * W);
    const py = horizon + Math.floor(rnd() * (H - horizon));
    const cur = grid[py]?.[x];
    if (cur === 'L' || cur === 'M') set(py, x, rnd() < 0.72 ? 'h' : 'd');
  }
  for (let i = 0; i < 20; i++) {
    const x = 6 + Math.floor(rnd() * (W - 12));
    const py = horizon + 4 + Math.floor(rnd() * (H - horizon - 6));
    set(py, x, rnd() < 0.5 ? 'G' : 'W');
  }

  // 7. 左侧木栅栏（竖立于车道带左侧，先画立柱再画横杆）
  for (let lane = 0; lane < 6; lane++) {
    const y0 = Math.round(horizon + lane * LANE_H_BG);
    const y1 = Math.round(horizon + (lane + 1) * LANE_H_BG);
    for (const px of [12, 26]) {
      for (let py = y0 + 2; py < y1 - 2 && py < H; py++) set(py, px, 'N');
      set(y0 + 3, px, 'n');
      set(y1 - 3, px, 'K');
    }
    for (const py of [y0 + 5, y1 - 6]) {
      for (let px = 10; px <= 30; px++) set(py, px, 'n');
    }
  }

  return grid.map((row) => row.join(''));
}
