import type { PixelSprite } from '../palette.ts';

/**
 * 草原战斗场景像素背景（320×180 逻辑网格，运行时 ×6 放大到 1920×1080）。
 * 几何与战斗网格单一事实源：HUD 108px / 种子条 108–256 / 草坪 y272–1040（bg 45–174）。
 * 六车道刈纹带与 BattleScene 的 6 行车道逐一对齐（每车道 bg≈21.3 行）。
 * v2 明亮草原（用户第 12 轮反馈#2）：晨蓝天+太阳+云+树线+亮草刈纹+花+木栅栏。
 * 代码生成+确定性种子，无图片文件。
 */

const W = 320;
const H = 180;
import { GRID_BOTTOM, GRID_Y0 } from '../../../scenes/battleGeometry.ts';

/** 战斗网格参数（与 battleGeometry.ts 单一事实源换算，bg 像素 = 设计像素 / 6） */
const HORIZON = Math.round(GRID_Y0 / 6); // 45
const LAWN_BOTTOM = Math.round(GRID_BOTTOM / 6); // 174
const LANE_H = (LAWN_BOTTOM - HORIZON) / 6; // ≈ 21.5

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

/** 天空渐变带（上深下浅三带，无抖动横线）。 */
const SKY: [number, string][] = [
  [14, 'S'],
  [15, 'S'],
  [16, 's'],
];

export function meadowBattleBg(): PixelSprite {
  // 1. 天空带（晨蓝三段）
  let y = 0;
  for (const [rows, ch] of SKY) {
    for (let i = 0; i < rows && y < HORIZON; i++, y++) {
      for (let x = 0; x < W; x++) set(y, x, ch);
    }
  }

  // 2. 太阳（右上，穿透半透明顶栏发光）
  const sunX = 258;
  const sunY = 30;
  const sunR = 9;
  for (let yy = -sunR - 2; yy <= sunR + 2; yy++) {
    for (let xx = -sunR - 2; xx <= sunR + 2; xx++) {
      const d2 = xx * xx + yy * yy;
      if (d2 <= sunR * sunR) {
        set(sunY + yy, sunX + xx, d2 <= (sunR * 0.35) ** 2 ? 'W' : 'G');
      } else if (d2 <= (sunR + 2) * (sunR + 2) && (Math.abs(xx) < 2 || Math.abs(yy) < 2)) {
        set(sunY + yy, sunX + xx, 'y'); // 十字光芒
      }
    }
  }

  // 3. 云（三朵，圆润ellip叠形）
  const clouds: [number, number, number, number][] = [
    [58, 13, 12, 4],
    [150, 7, 14, 5],
    [222, 19, 10, 3.5],
  ];
  for (const [cx, cy, rx, ry] of clouds) {
    for (let a = -1; a <= 1; a++) {
      const ox = cx + a * Math.round(rx * 0.6);
      const rr = a === 0 ? ry * 1.35 : ry;
      const rxx = a === 0 ? rx * 0.7 : rx * 0.55;
      for (let yy = Math.floor(cy - rr); yy <= Math.ceil(cy + rr); yy++) {
        for (let xx = Math.floor(ox - rxx); xx <= Math.ceil(ox + rxx); xx++) {
          const dx = (xx - ox) / rxx;
          const dy = (yy - cy) / rr;
          if (dx * dx + dy * dy <= 1) set(yy, xx, 'W');
        }
      }
    }
    for (let xx = cx - Math.round(rx); xx <= cx + Math.round(rx); xx++) set(cy + Math.round(ry * 0.8), xx, 's'); // 云底阴影
  }

  // 4. 远山（两枚圆丘，垫树线后）
  for (const [cx, rx, ry] of [
    [70, 64, 11],
    [235, 84, 13],
  ] as [number, number, number][]) {
    for (let yy = HORIZON - ry; yy < HORIZON; yy++) {
      for (let xx = cx - rx; xx <= cx + rx; xx++) {
        const dx = (xx - cx) / rx;
        const dy = (yy - (HORIZON - 1)) / ry;
        if (dx * dx + dy * dy <= 1) set(yy, xx, yy < HORIZON - ry + 2 ? 'l' : 'm');
      }
    }
  }

  // 5. 树线（圆形灌木簇贴草坪顶：bg y45，确定性 hash 间距）
  const treeRnd = mulberry(4242);
  let tx = 0;
  while (tx < W) {
    const r = 3 + Math.floor(treeRnd() * 4);
    const cx = tx + r;
    const cy = HORIZON - 1 - r;
    for (let yy = cy - r; yy <= cy + r; yy++) {
      for (let xx = cx - r; xx <= cx + r; xx++) {
        const dx = (xx - cx) / r;
        const dy = (yy - cy) / r;
        if (dx * dx + dy * dy <= 1) set(yy, xx, yy <= cy - r * 0.35 ? 'l' : yy >= cy + r * 0.5 ? 'd' : 'm');
      }
    }
    set(HORIZON - 1, cx, 'e'); // 树干
    set(HORIZON, cx, 'd');
    tx += r * 2 + 2 + Math.floor(treeRnd() * 7);
  }

  // 6. 地面 + 六车道刈纹（与游戏 6 行逐一对齐）
  for (let py = HORIZON; py < H; py++) {
    for (let x = 0; x < W; x++) set(py, x, 'v');
  }
  for (let lane = 0; lane < 6; lane++) {
    const y0 = Math.round(HORIZON + lane * LANE_H);
    const y1 = Math.round(HORIZON + (lane + 1) * LANE_H);
    for (let py = y0; py < y1 && py < H; py++) {
      const mid = py - y0;
      const hgt = y1 - y0;
      for (let x = 0; x < W; x++) set(py, x, mid >= 3 && mid < hgt - 3 ? 'o' : 'v');
    }
  }

  // 7. 草屑与小花
  const rnd = mulberry(20261010);
  for (let i = 0; i < 800; i++) {
    const x = Math.floor(rnd() * W);
    const py = HORIZON + Math.floor(rnd() * (H - HORIZON));
    const cur = grid[py]?.[x];
    if (cur === 'v' || cur === 'o') set(py, x, rnd() < 0.72 ? 'h' : 'd');
  }
  for (let i = 0; i < 26; i++) {
    const x = 30 + Math.floor(rnd() * (W - 60));
    const py = HORIZON + 4 + Math.floor(rnd() * (H - HORIZON - 8));
    const petal = rnd() < 0.5 ? 'f' : 'y';
    set(py, x, petal);
    set(py, x + 1, petal);
    set(py + 1, x, petal);
    set(py + 1, x + 1, 'W');
  }

  // 8. 左侧木栅栏（竖立于车道带左侧：立柱+两道横杆）
  for (const px of [5, 19]) {
    for (let py = HORIZON + 2; py < H - 2; py++) set(py, px, 'N');
    for (let py = HORIZON + 2; py < H - 2; py += 2) set(py, px, 'n');
    set(HORIZON + 2, px, 'K');
    set(H - 3, px, 'K');
  }
  for (const py of [HORIZON + 6, H - 10, Math.floor((HORIZON + H) / 2)]) {
    for (let px = 3; px <= 21; px++) set(py, px, 'n');
    set(py, 21, 'N');
  }

  return grid.map((row) => row.join(''));
}
